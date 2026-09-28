import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { projectAdminCase, collectAdminCases, projectAdminEmergencies, buildAdminReadModel, modernCoordinates } from '../src/lib/adminReadModel.js';
import { getCaseRecordType } from '../src/lib/caseRecords.js';

const nik = '3201234567890001';
const otherNik = '3201234567890002';
const at = (value) => Timestamp.fromDate(new Date(value));
const doc = (id, value) => ({ id, data: () => value });
const snapshot = (...docs) => ({ docs });
const pfa = (overrides = {}) => ({ recordType: 'pfa', phase: 'akut', protocolVersion: 'pfa-prototype-v1', patientNik: nik, patientName: 'Siti', poskoName: 'Posko A', relawanId: 'r1', responses: { 'look.safety_checked': true }, timestamp: at('2026-09-27T00:00:00Z'), ...overrides });
const srq = (overrides = {}) => ({ recordType: 'srq20', phase: 'lanjutan', protocolVersion: 'srq20-prototype-v1', patientNik: nik, patientName: 'Siti', relawanId: 'r1', responses: { 'srq20.01': false }, inputMode: 'verbal', srq20Score: 18, baseTier: 'T1', tier: 'T2', riskFunctionProtocolVersion: 'risk-function-prototype-v1', riskFactors: { 'risk.01': false }, functionalImpairment: { 'function.01': false }, classificationVersion: 'classification-prototype-v1', timestamp: at('2026-09-27T00:00:00Z'), ...overrides });
const origin = (overrides = {}) => ({ protocolVersion: 'redflag-prototype-v1', status: 't0-suspect', relawanId: 'r1', gates: ['redflag.immediate_harm'], timestamp: at('2026-09-27T00:00:00Z'), ...overrides });
const validation = (outcome, extra = {}) => ({ version: 'secondary-validation-prototype-v1', outcome, reviewerId: 'n1', decidedAt: at('2026-09-27T00:00:00Z'), ...extra });
const referral = (status) => ({ version: 'referral-prototype-v1', status, createdAt: at('2026-09-27T00:00:00Z'), createdBy: 'n1', updatedAt: at('2026-09-27T00:00:00Z'), updatedBy: 'n1' });
const model = (cases, emergencies = snapshot(), now = '2026-09-28T00:00:00Z') => buildAdminReadModel(collectAdminCases(cases), projectAdminEmergencies(emergencies), now);

describe('Admin case read projection', () => {
  it('projects typed PFA and stored responses', () => {
    expect(projectAdminCase('p', pfa())).toMatchObject({ type: 'pfa', patientNik: nik, patientName: 'Siti', responses: { 'look.safety_checked': true } });
  });
  it('keeps canonical string NIKs for typed PFA and SRQ patient aggregation', () => {
    const result = model(snapshot(doc('p', pfa()), doc('s', srq())));
    expect(result.cases.map((item) => item.patientNik)).toEqual([nik, nik]);
    expect(result.metrics.trackedPatients).toBe(1);
    expect(result.patients[0]).toMatchObject({ nik, pfaCount: 1, srqCount: 1, latestSrq: { id: 's' } });
  });
  it('keeps legacy cases but excludes numeric and other malformed NIKs from tracked patients', () => {
    const invalidNiks = [Number(nik), new String(nik), ' 3201234567890001', '320123456789000', null];
    const result = model(snapshot(...invalidNiks.map((patientNik, index) => doc(`legacy-${index}`, { zona: 'merah', patientNik }))));
    expect(result.cases).toHaveLength(invalidNiks.length);
    expect(result.cases.every((item) => item.type === 'legacy-triage' && item.patientNik === null)).toBe(true);
    expect(result.metrics.trackedPatients).toBe(0);
    expect(result.patients).toEqual([]);
    expect(result.metrics.legacy.merah).toBe(invalidNiks.length);
  });
  it('uses persisted SRQ result even when answers imply a different result', () => {
    const record = srq();
    expect(getCaseRecordType(record)).toBe('unknown'); // save-side validation still recomputes
    expect(projectAdminCase('s', record)).toMatchObject({ type: 'srq20', score: 18, baseTier: 'T1', tier: 'T2', inputMode: 'verbal' });
  });
  it('requires supported structural and version contracts without rescoring', () => {
    expect(projectAdminCase('bad', srq({ protocolVersion: 'future' }))).toBeNull();
    expect(projectAdminCase('bad', srq({ srq20Score: 21 }))).toBeNull();
    expect(projectAdminCase('bad', srq({ riskFunctionProtocolVersion: 'future' }))).toBeNull();
    expect(projectAdminCase('bad', pfa({ phase: 'lanjutan' }))).toBeNull();
  });
  it.each(['merah', 'kuning', 'hijau'])('keeps legacy %s separate from SRQ tiers', (zone) => {
    const result = model(snapshot(doc('old', { zona: zone, patientNik: nik })));
    expect(result.cases[0]).toMatchObject({ type: 'legacy-triage', zone });
    expect(result.metrics.latestTiers).toEqual({ T1: 0, T2: 0, T3: 0 });
    expect(result.metrics.legacy[zone]).toBe(1);
  });
  it('isolates malformed documents and keeps valid records', () => {
    const result = collectAdminCases(snapshot(doc('good', pfa()), doc('bad', { recordType: 'srq20' }), { id: 'throw', data: () => { throw new Error('boom'); } }));
    expect(result.items.map((item) => item.id)).toEqual(['good']);
    expect(result.rejected.map((item) => item.id)).toEqual(['bad', 'throw']);
  });
  it('counts unique observed NIKs and chooses the latest dated SRQ once per patient', () => {
    const result = model(snapshot(doc('first', srq({ tier: 'T1', timestamp: at('2026-09-25T00:00:00Z') })), doc('latest', srq({ tier: 'T3' })), doc('other', pfa({ patientNik: otherNik })), doc('no-nik', { zona: 'merah' })));
    expect(result.metrics.trackedPatients).toBe(2);
    expect(result.metrics.latestTiers).toEqual({ T1: 0, T2: 0, T3: 1 });
    expect(result.patients.find((item) => item.nik === nik)).toMatchObject({ srqCount: 2, latestSrq: { id: 'latest', tier: 'T3' } });
  });
  it('uses document ID as stable tie-breaker and retains all SRQ history', () => {
    const result = model(snapshot(doc('z', srq({ tier: 'T3' })), doc('a', srq({ tier: 'T1' }))));
    expect(result.patients[0].latestSrq.id).toBe('a');
    expect(result.patients[0].srqHistory.map((item) => item.id)).toEqual(['a', 'z']);
  });
  it('keeps future SRQ in history without replacing the latest eligible SRQ or current tier', () => {
    const result = model(snapshot(
      doc('eligible', srq({ tier: 'T2', srq20Score: 6, baseTier: 'T2', timestamp: at('2026-09-27T00:00:00Z') })),
      doc('future', srq({ tier: 'T1', timestamp: at('2026-09-29T00:00:00Z') })),
    ));
    expect(result.cases.map((item) => item.id)).toEqual(['future', 'eligible']);
    expect(result.patients[0].srqHistory.map((item) => item.id)).toEqual(['future', 'eligible']);
    expect(result.patients[0].latestSrq).toMatchObject({ id: 'eligible', score: 6, baseTier: 'T2', tier: 'T2' });
    expect(result.metrics.latestTiers).toEqual({ T1: 0, T2: 1, T3: 0 });
    expect(result.metrics.futureDatedCases).toBe(1);
  });
  it('uses the latest eligible case for patient summary without borrowing fields from future snapshots', () => {
    const result = model(snapshot(
      doc('old', pfa({ timestamp: at('2026-09-26T00:00:00Z'), patientName: 'Lama', poskoName: 'Posko Lama' })),
      doc('eligible', srq({ timestamp: at('2026-09-27T00:00:00Z'), patientName: 'Sekarang', poskoName: undefined })),
      doc('future', pfa({ timestamp: at('2026-09-29T00:00:00Z'), patientName: 'Masa Depan', poskoName: 'Posko Masa Depan' })),
    ));
    expect(result.patients[0]).toMatchObject({
      patientName: 'Sekarang', poskoName: null,
      firstAssessment: '2026-09-26T00:00:00.000Z',
      latestAssessment: '2026-09-27T00:00:00.000Z',
    });
    expect(result.cases[0].id).toBe('future');
    expect(result.metrics.futureDatedCases).toBe(1);
  });
  it('does not invent current patient state when all assessments are future-dated', () => {
    const result = model(snapshot(doc('future', srq({ timestamp: at('2026-09-29T00:00:00Z') }))));
    expect(result.patients[0]).toMatchObject({ patientName: null, poskoName: null, latestAssessment: null, latestSrq: null, srqCount: 1 });
    expect(result.metrics.latestTiers).toEqual({ T1: 0, T2: 0, T3: 0 });
    expect(result.metrics.futureDatedCases).toBe(1);
  });
  it('retains document-ID tie-breaking among eligible SRQ even when a future record sorts first', () => {
    const result = model(snapshot(
      doc('future', srq({ timestamp: at('2026-09-29T00:00:00Z'), tier: 'T3' })),
      doc('z', srq({ tier: 'T2' })),
      doc('a', srq({ tier: 'T1' })),
    ));
    expect(result.patients[0].latestSrq.id).toBe('a');
    expect(result.metrics.latestTiers).toEqual({ T1: 1, T2: 0, T3: 0 });
  });
  it('includes an assessment exactly at now and excludes one millisecond after now from current state', () => {
    const result = model(snapshot(
      doc('at-now', srq({ timestamp: at('2026-09-28T00:00:00.000Z'), tier: 'T2' })),
      doc('after-now', srq({ timestamp: at('2026-09-28T00:00:00.001Z'), tier: 'T1' })),
    ));
    expect(result.patients[0].latestSrq.id).toBe('at-now');
    expect(result.patients[0].latestAssessment).toBe('2026-09-28T00:00:00.000Z');
    expect(result.metrics.latestTiers).toEqual({ T1: 0, T2: 1, T3: 0 });
    expect(result.metrics.windowSrq).toBe(1);
    expect(result.metrics.futureDatedCases).toBe(1);
  });
  it('includes exactly 30 days old and excludes older records and future records', () => {
    const result = model(snapshot(doc('boundary', srq({ timestamp: at('2026-08-29T00:00:00Z') })), doc('older', srq({ timestamp: at('2026-08-28T23:59:59Z') })), doc('future', pfa({ timestamp: at('2026-09-29T00:00:00Z') }))));
    expect(result.windowStart).toBe('2026-08-29T00:00:00.000Z');
    expect(result.metrics.windowSrq).toBe(1);
    expect(result.metrics.windowPfa).toBe(0);
    expect(result.patients[0].windowSrqHistory.map((item) => item.id)).toEqual(['boundary']);
    expect(result.metrics.futureDatedCases).toBe(1);
  });
  it('selects deterministic latest available name and posko snapshots', () => {
    const result = model(snapshot(doc('a', pfa({ timestamp: at('2026-09-25T00:00:00Z'), patientName: 'Lama', poskoName: 'Posko A' })), doc('b', srq({ patientName: 'Baru', poskoName: 'Posko B' }))));
    expect(result.patients[0]).toMatchObject({ patientName: 'Baru', poskoName: 'Posko B', pfaCount: 1, srqCount: 1 });
  });
  it('does not invent location and preserves zero coordinates', () => {
    expect(modernCoordinates({ location: { lat: 0, lng: 0 } })).toEqual({ lat: 0, lng: 0 });
    for (const location of [null, { lat: 0 }, { lng: 0 }, { lat: '0', lng: 0 }, { lat: 91, lng: 0 }, { lat: 0, lng: -181 }, { lat: NaN, lng: 0 }]) {
      expect(modernCoordinates({ location })).toBeNull();
    }
    expect(projectAdminCase('p', pfa()).coordinates).toBeNull();
  });
});

describe('Admin emergency operations', () => {
  it('classifies undecided and confirmed with incomplete referral as active', () => {
    const result = model(snapshot(), snapshot(doc('undecided', origin()), doc('confirmed', origin({ validation: validation('t0-confirmed'), referral: referral('en-route-to-location') }))));
    expect(result.metrics.activeT0).toBe(2);
    expect(result.activeEmergencies.map((item) => item.state)).toEqual(['confirmed', 'undecided']);
    expect(result.emergencies.every((item) => item.origin.status === 't0-suspect')).toBe(true);
  });
  it('removes completed referral from active attention but keeps its immutable origin', () => {
    const result = model(snapshot(), snapshot(doc('done', origin({ validation: validation('t0-confirmed'), referral: referral('completed') }))));
    expect(result.metrics.activeT0).toBe(0);
    expect(result.emergencies[0]).toMatchObject({ state: 'completed', origin: { status: 't0-suspect' } });
  });
  it.each(['T1', 'T2'])('keeps Nakes downgrade %s separate from SRQ counts', (tier) => {
    const result = model(snapshot(), snapshot(doc('down', origin({ validation: validation('downgraded', { downgradedTo: tier }) }))));
    expect(result.metrics.activeT0).toBe(0);
    expect(result.metrics.downgraded[tier]).toBe(1);
    expect(result.metrics.latestTiers[tier]).toBe(0);
    expect(result.emergencies[0].origin.status).toBe('t0-suspect');
  });
  it('preserves valid origin with malformed workflow and isolates invalid origin', () => {
    const result = model(snapshot(), snapshot(doc('issue', origin({ validation: { outcome: 'bad' } })), doc('invalid', origin({ gates: ['wrong'] })), doc('good', origin())));
    expect(result.metrics.workflowIssues).toBe(1);
    expect(result.metrics.rejectedEmergencies).toBe(1);
    expect(result.metrics.activeT0).toBe(1);
    expect(result.emergencies.find((item) => item.id === 'issue')).toMatchObject({ state: 'workflow-issue', origin: { status: 't0-suspect' } });
  });
  it('preserves valid emergency coordinates including zero and rejects partial origin', () => {
    const result = projectAdminEmergencies(snapshot(doc('zero', origin({ lat: 0, lng: 0 })), doc('partial', origin({ lat: 0 }))));
    expect(result.items[0].coordinates).toEqual({ lat: 0, lng: 0 });
    expect(result.rejected.map((item) => item.id)).toEqual(['partial']);
  });
});

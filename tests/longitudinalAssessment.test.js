import { describe, expect, it, vi } from 'vitest';
import { SRQ20_PROTOCOL } from '../src/protocols/srq20Protocol.js';
import { RISK_FUNCTION_PROTOCOL } from '../src/protocols/riskFunctionProtocol.js';
import { validateSrq20Responses } from '../src/lib/srq20.js';
import { validateRiskFunctionResponses } from '../src/lib/riskFunction.js';
import { analyzeSrq20 } from '../src/lib/scoring.js';
import { calculateFinalTier } from '../src/lib/classification.js';
import { getCaseRecordType } from '../src/lib/caseRecords.js';
import {
  LONGITUDINAL_DRAFT_KEY, buildSrq20CaseRecord, clearLongitudinalDraft, loadLongitudinalDraft,
  restoreLongitudinalDraft, saveLongitudinalDraft,
} from '../src/lib/longitudinalAssessment.js';

const uid = 'relawan-123';
const assessment = {
  relawanId: uid,
  patient: { nik: '3201234567890001', nama: 'Siti', usia: 34, jenisKelamin: 'P', poskoName: 'Posko A' },
  phase: 'lanjutan', previousHistory: [], isNewPatient: false,
  startedAt: '2026-09-27T10:00:00.000Z',
};
const draft = (change = {}) => ({
  relawanId: uid,
  patientNik: assessment.patient.nik,
  assessmentStartedAt: assessment.startedAt,
  srqProtocolVersion: SRQ20_PROTOCOL.version,
  riskFunctionProtocolVersion: RISK_FUNCTION_PROTOCOL.version,
  inputMode: 'verbal',
  currentStep: 'srq20',
  srqResponses: { 'srq20.01': false },
  riskFactors: { 'risk.01': false },
  functionalImpairment: { 'function.01': true },
  ...change,
});
const completeDraft = (yes = 0, change = {}) => draft({
  currentStep: 'risk-function',
  srqResponses: Object.fromEntries(SRQ20_PROTOCOL.items.map(({ id }, index) => [id, index < yes])),
  riskFactors: Object.fromEntries(RISK_FUNCTION_PROTOCOL.sections[0].items.map(({ id }) => [id, false])),
  functionalImpairment: Object.fromEntries(RISK_FUNCTION_PROTOCOL.sections[1].items.map(({ id }) => [id, false])),
  ...change,
});
const user = { uid };
const profile = { name: 'Rina', poskoName: 'Posko A', poskoLat: -6.2, poskoLng: 106.8 };

describe('completed SRQ-20 case builder', () => {
  it.each([
    ['verbal', 0, 'T3'],
    ['nonverbal', 6, 'T2'],
    ['verbal', 11, 'T1'],
  ])('builds a validated %s case with %i Yes answers and %s', (inputMode, yes, tier) => {
    const progress = completeDraft(yes, {
      inputMode,
      riskFactors: { ...completeDraft().riskFactors, 'risk.01': true },
      functionalImpairment: { ...completeDraft().functionalImpairment, 'function.01': true },
    });
    const before = structuredClone(progress);
    const record = buildSrq20CaseRecord(progress, assessment, user, profile);

    expect(getCaseRecordType(record)).toBe('srq20');
    expect(record).toMatchObject({
      recordType: 'srq20', phase: 'lanjutan', protocolVersion: SRQ20_PROTOCOL.version,
      inputMode, srq20Score: yes, baseTier: tier,
      riskFunctionProtocolVersion: RISK_FUNCTION_PROTOCOL.version,
      classificationVersion: 'classification-prototype-v1', tier,
      patientNik: assessment.patient.nik, relawanId: uid,
      patientName: 'Siti', patientAge: 34, patientGender: 'P',
      relawanName: 'Rina', poskoName: 'Posko A', poskoLat: -6.2, poskoLng: 106.8,
    });
    expect(record.responses).toEqual(progress.srqResponses);
    expect(Object.keys(record.responses)).toHaveLength(20);
    expect(Object.values(record.responses).every((value) => typeof value === 'boolean')).toBe(true);
    expect(record.riskFactors).toEqual(progress.riskFactors);
    expect(record.functionalImpairment).toEqual(progress.functionalImpairment);
    expect(Object.keys(record.riskFactors)).toHaveLength(4);
    expect(Object.keys(record.functionalImpairment)).toHaveLength(4);
    for (const field of ['zona', 'triageResult', 'transcript', 'audio', 'riskFactorScore', 'adjustmentRuleDefined', 'adjustmentsApplied']) {
      expect(record).not.toHaveProperty(field);
      expect(progress).not.toHaveProperty(field);
    }
    expect(progress).toEqual(before);
  });

  it.each([
    ['zero coordinates', { poskoLat: 0, poskoLng: 0 }, { poskoLat: 0, poskoLng: 0 }],
    ['partial coordinates', { poskoLat: -6.2 }, null],
    ['string coordinates', { poskoLat: '-6.2', poskoLng: 106.8 }, null],
    ['NaN coordinates', { poskoLat: NaN, poskoLng: 106.8 }, null],
    ['infinite coordinates', { poskoLat: Infinity, poskoLng: 106.8 }, null],
    ['out-of-range coordinates', { poskoLat: 91, poskoLng: 106.8 }, null],
  ])('uses only valid authenticated profile %s', (_name, coordinates, expected) => {
    const record = buildSrq20CaseRecord(completeDraft(), assessment, user, { name: 'Rina', ...coordinates });
    if (expected) expect(record).toMatchObject(expected);
    else {
      expect(record).not.toHaveProperty('poskoLat');
      expect(record).not.toHaveProperty('poskoLng');
    }
  });

  it('omits Patient Lookup demo posko metadata without a verified profile posko', () => {
    const context = { ...assessment, patient: { ...assessment.patient, poskoName: 'Posko Utama - Kota' } };
    expect(buildSrq20CaseRecord(completeDraft(), context, user, null)).not.toHaveProperty('poskoName');
    expect(buildSrq20CaseRecord(completeDraft(), context, user, { poskoName: ' Posko Utama - Kota ' })).not.toHaveProperty('poskoName');
    expect(buildSrq20CaseRecord(completeDraft(), context, user, { poskoName: ' Posko B ' }).poskoName).toBe('Posko B');
  });

  it.each([
    ['missing assessment', null, user, completeDraft()],
    ['wrong phase', { ...assessment, phase: 'akut' }, user, completeDraft()],
    ['UID mismatch', assessment, { uid: 'other' }, completeDraft()],
    ['wrong patient binding', assessment, user, completeDraft(0, { patientNik: '3201234567890002' })],
    ['wrong session binding', assessment, user, completeDraft(0, { assessmentStartedAt: '2026-09-27T11:00:00.000Z' })],
    ['incomplete SRQ', assessment, user, completeDraft(0, { srqResponses: { 'srq20.01': false } })],
    ['malformed SRQ', assessment, user, completeDraft(0, { srqResponses: { ...completeDraft().srqResponses, 'srq20.01': 'false' } })],
    ['incomplete risk', assessment, user, completeDraft(0, { riskFactors: {} })],
    ['incomplete function', assessment, user, completeDraft(0, { functionalImpairment: {} })],
    ['unsupported SRQ version', assessment, user, completeDraft(0, { srqProtocolVersion: 'srq20-prototype-v2' })],
    ['unsupported Risk/Function version', assessment, user, completeDraft(0, { riskFunctionProtocolVersion: 'risk-function-prototype-v2' })],
  ])('rejects %s', (_name, context, actor, progress) => {
    expect(() => buildSrq20CaseRecord(progress, context, actor, profile)).toThrow();
  });
});

describe('longitudinal draft binding', () => {
  it.each(['verbal', 'nonverbal'])('accepts a fresh %s draft with all answers unanswered', (inputMode) => {
    const fresh = draft({
      inputMode, srqResponses: {}, riskFactors: {}, functionalImpairment: {},
    });
    expect(restoreLongitudinalDraft(fresh, assessment, uid)).toEqual(fresh);
    expect(validateSrq20Responses(fresh.srqResponses, { requireComplete: true }).valid).toBe(false);
  });

  it('restores valid partial Screen 5 and Screen 6 progress for the same session', () => {
    expect(restoreLongitudinalDraft(draft(), assessment, uid)).toEqual(draft());
    expect(restoreLongitudinalDraft(draft({ inputMode: 'nonverbal', currentStep: 'risk-function' }), assessment, uid))
      .toEqual(draft({ inputMode: 'nonverbal', currentStep: 'risk-function' }));
  });

  it('switches input mode without changing structured answers or their validity', () => {
    const verbal = draft();
    const nonverbal = restoreLongitudinalDraft({ ...verbal, inputMode: 'nonverbal' }, assessment, uid);
    expect(nonverbal.inputMode).toBe('nonverbal');
    expect(nonverbal.srqResponses).toEqual(verbal.srqResponses);
    expect(validateSrq20Responses(nonverbal.srqResponses)).toEqual(validateSrq20Responses(verbal.srqResponses));
  });

  it.each([
    [{}, {}],
    [{ 'risk.01': false }, { 'function.01': true }],
  ])('keeps complete SRQ answers and partial Screen 6 data on step transition', (riskFactors, functionalImpairment) => {
    const srqResponses = Object.fromEntries(SRQ20_PROTOCOL.items.map(({ id }) => [id, false]));
    const next = draft({ currentStep: 'risk-function', srqResponses, riskFactors, functionalImpairment });
    expect(restoreLongitudinalDraft(next, assessment, uid)).toEqual(next);
    expect(validateSrq20Responses(next.srqResponses, { requireComplete: true }).valid).toBe(true);
  });

  it('requires complete SRQ and Risk/Function answers before readiness', () => {
    const srqResponses = Object.fromEntries(SRQ20_PROTOCOL.items.map(({ id }) => [id, false]));
    const incompleteSrq = { ...srqResponses };
    delete incompleteSrq['srq20.20'];
    expect(() => analyzeSrq20(incompleteSrq)).toThrow();

    const { baseTier } = analyzeSrq20(srqResponses);
    expect(validateRiskFunctionResponses({ riskFactors: {}, functionalImpairment: {} }, { requireComplete: true }).valid).toBe(false);
    expect(() => calculateFinalTier({ baseTier, riskFactors: {}, functionalImpairment: {} })).toThrow();

    const riskFactors = Object.fromEntries(RISK_FUNCTION_PROTOCOL.sections[0].items.map(({ id }) => [id, false]));
    const functionalImpairment = Object.fromEntries(RISK_FUNCTION_PROTOCOL.sections[1].items.map(({ id }) => [id, false]));
    expect(calculateFinalTier({ baseTier, riskFactors, functionalImpairment }).finalTier).toBe(baseTier);
  });

  it.each([
    ['wrong draft Relawan', { relawanId: 'other' }],
    ['wrong patient NIK', { patientNik: '3201234567890002' }],
    ['wrong assessment start', { assessmentStartedAt: '2026-09-27T11:00:00.000Z' }],
    ['wrong SRQ protocol', { srqProtocolVersion: 'srq20-prototype-v2' }],
    ['wrong Risk/Function protocol', { riskFunctionProtocolVersion: 'risk-function-prototype-v2' }],
    ['unknown current step', { currentStep: 'result' }],
    ['unknown input mode', { inputMode: 'audio' }],
    ['bad SRQ response', { srqResponses: { 'srq20.01': 'false' } }],
    ['unknown SRQ ID', { srqResponses: { 'srq20.21': true } }],
    ['bad Risk Factor response', { riskFactors: { 'risk.01': 1 } }],
    ['bad Gangguan Fungsi response', { functionalImpairment: { 'function.01': null } }],
    ['unknown Risk Factor ID', { riskFactors: { 'risk.05': false } }],
    ['unknown Gangguan Fungsi ID', { functionalImpairment: { 'function.05': false } }],
    ['forbidden transcript payload', { transcript: 'example' }],
  ])('rejects %s', (_name, change) => {
    expect(restoreLongitudinalDraft(draft(change), assessment, uid)).toBeNull();
  });

  it('rejects absent or malformed context, wrong phase, and UID mismatch', () => {
    expect(restoreLongitudinalDraft(draft(), null, uid)).toBeNull();
    expect(restoreLongitudinalDraft(draft(), { ...assessment, phase: 'akut' }, uid)).toBeNull();
    expect(restoreLongitudinalDraft(draft(), assessment, null)).toBeNull();
    expect(restoreLongitudinalDraft(draft(), assessment, 'other')).toBeNull();
    expect(restoreLongitudinalDraft(draft(), { ...assessment, relawanId: 'other' }, uid)).toBeNull();
  });
});

describe('defensive sessionStorage draft helpers', () => {
  it.each(['verbal', 'nonverbal'])('saves a bound %s draft, restores it, and clears only its key', (inputMode) => {
    const rows = new Map();
    const storage = {
      setItem: vi.fn((key, value) => rows.set(key, value)),
      getItem: vi.fn((key) => rows.get(key) ?? null),
      removeItem: vi.fn((key) => rows.delete(key)),
    };
    vi.stubGlobal('sessionStorage', storage);
    try {
      const expected = draft({ inputMode });
      const { currentStep, srqResponses, riskFactors, functionalImpairment } = expected;
      expect(saveLongitudinalDraft({ inputMode, currentStep, srqResponses, riskFactors, functionalImpairment }, assessment, uid)).toBe(true);
      expect(JSON.parse(rows.get(LONGITUDINAL_DRAFT_KEY))).toEqual(expected);
      expect(loadLongitudinalDraft(assessment, uid)).toEqual(expected);
      clearLongitudinalDraft();
      expect(storage.removeItem).toHaveBeenLastCalledWith(LONGITUDINAL_DRAFT_KEY);
      expect(loadLongitudinalDraft(assessment, uid)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('persists a step transition with complete SRQ and partial Risk/Function data', () => {
    const rows = new Map();
    vi.stubGlobal('sessionStorage', {
      getItem: (key) => rows.get(key) ?? null,
      setItem: (key, value) => rows.set(key, value),
      removeItem: (key) => rows.delete(key),
    });
    try {
      const srqResponses = Object.fromEntries(SRQ20_PROTOCOL.items.map(({ id }) => [id, false]));
      const progress = {
        inputMode: 'nonverbal', currentStep: 'risk-function', srqResponses,
        riskFactors: { 'risk.01': true }, functionalImpairment: {},
      };
      expect(saveLongitudinalDraft(progress, assessment, uid)).toBe(true);
      expect(loadLongitudinalDraft(assessment, uid)).toMatchObject(progress);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects invalid saves and removes malformed or mismatched stored drafts', () => {
    const rows = new Map([[LONGITUDINAL_DRAFT_KEY, '{bad json']]);
    vi.stubGlobal('sessionStorage', {
      getItem: (key) => rows.get(key) ?? null,
      setItem: (key, value) => rows.set(key, value),
      removeItem: (key) => rows.delete(key),
    });
    try {
      expect(loadLongitudinalDraft(assessment, uid)).toBeNull();
      expect(rows.has(LONGITUDINAL_DRAFT_KEY)).toBe(false);
      rows.set(LONGITUDINAL_DRAFT_KEY, JSON.stringify(draft({ patientNik: '3201234567890002' })));
      expect(loadLongitudinalDraft(assessment, uid)).toBeNull();
      expect(rows.has(LONGITUDINAL_DRAFT_KEY)).toBe(false);
      expect(() => saveLongitudinalDraft({ inputMode: 'invalid' }, assessment, uid)).toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('handles unavailable browser storage without trusting or losing validation', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('unavailable'); },
      setItem: () => { throw new Error('unavailable'); },
      removeItem: () => { throw new Error('unavailable'); },
    });
    try {
      expect(loadLongitudinalDraft(assessment, uid)).toBeNull();
      expect(saveLongitudinalDraft(draft(), assessment, uid)).toBe(false);
      expect(() => clearLongitudinalDraft()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

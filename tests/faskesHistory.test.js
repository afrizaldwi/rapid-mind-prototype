import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SRQ20_PROTOCOL } from '../src/protocols/srq20Protocol.js';
import { RISK_FUNCTION_PROTOCOL } from '../src/protocols/riskFunctionProtocol.js';
import { CLASSIFICATION_VERSION } from '../src/lib/classification.js';

const state = vi.hoisted(() => ({ patientRead: vi.fn(), caseRead: vi.fn() }));
vi.mock('../src/lib/firebase.js', () => ({ db: {} }));
vi.mock('../src/lib/patients.js', () => ({ findCloudPatientByNik: state.patientRead }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...await importOriginal(),
  collection: (_db, name) => ({ name }),
  where: (...args) => args,
  query: (reference, filter) => ({ reference, filter }),
  getDocsFromServer: state.caseRead,
}));

import { loadFaskesHistory, summarizeFaskesCases } from '../src/lib/faskesHistory.js';

const nik = '3201234567890001';
const document = (id, value) => ({ id, data: () => value });
const time = (value) => ({ toDate: () => new Date(value) });
const pfa = { recordType: 'pfa', protocolVersion: 'pfa-prototype-v1', patientNik: nik, relawanId: 'relawan-1', phase: 'akut', responses: { look: true } };
const srq = {
  recordType: 'srq20', phase: 'lanjutan', protocolVersion: SRQ20_PROTOCOL.version,
  responses: Object.fromEntries(SRQ20_PROTOCOL.items.map(({ id }, index) => [id, index < 6])),
  patientNik: nik, relawanId: 'relawan-1', inputMode: 'nonverbal', srq20Score: 6, baseTier: 'T2',
  riskFunctionProtocolVersion: RISK_FUNCTION_PROTOCOL.version,
  riskFactors: Object.fromEntries(RISK_FUNCTION_PROTOCOL.sections[0].items.map(({ id }) => [id, false])),
  functionalImpairment: Object.fromEntries(RISK_FUNCTION_PROTOCOL.sections[1].items.map(({ id }) => [id, false])),
  classificationVersion: CLASSIFICATION_VERSION, tier: 'T2',
};

beforeEach(() => { state.patientRead.mockReset(); state.caseRead.mockReset(); });

describe('server-only Faskes history boundary', () => {
  it('summarizes persisted PFA, SRQ, and legacy results without recalculation', () => {
    const summary = summarizeFaskesCases({ docs: [
      document('pfa', { ...pfa, timestamp: time('2026-09-25T12:00:00Z') }),
      document('srq', { ...srq, timestamp: time('2026-09-27T12:00:00Z') }),
      document('legacy', { zona: 'merah', triageResult: 'MERAH', timestamp: time('2026-09-26T12:00:00Z') }),
      document('invalid', { recordType: 'srq20', tier: 'T1' }),
    ] });
    expect(summary.items.map((item) => item.id)).toEqual(['srq', 'legacy', 'pfa']);
    expect(summary.items[0]).toMatchObject({ type: 'srq20', score: 6, tier: 'T2' });
    expect(summary.items[1]).toMatchObject({ type: 'legacy-triage', zone: 'merah' });
    expect(summary.items[2]).toMatchObject({ type: 'pfa', protocolVersion: 'pfa-prototype-v1' });
    expect(summary.unknownCount).toBe(1);
  });

  it('displays the persisted SRQ result rather than deriving a new one from answers', () => {
    const summary = summarizeFaskesCases({ docs: [document('stored', { ...srq, srq20Score: 7 })] });
    expect(summary.items[0]).toMatchObject({ type: 'srq20', score: 7, tier: 'T2' });
  });

  it('reads patient and cases independently from the server and distinguishes verified empty', async () => {
    state.patientRead.mockResolvedValue(null);
    state.caseRead.mockResolvedValue({ docs: [] });
    expect(await loadFaskesHistory(nik)).toEqual({
      patient: { status: 'not-found', data: null }, cases: { status: 'ready', items: [], unknownCount: 0 },
    });
    expect(state.patientRead).toHaveBeenCalledWith(nik);
    expect(state.caseRead).toHaveBeenCalledWith({ reference: { name: 'cases' }, filter: ['patientNik', '==', nik] });
  });

  it('keeps available cases when patient lookup fails and vice versa', async () => {
    state.patientRead.mockRejectedValue(new Error('unavailable'));
    state.caseRead.mockResolvedValue({ docs: [document('pfa', pfa)] });
    const partial = await loadFaskesHistory(nik);
    expect(partial.patient.status).toBe('unavailable');
    expect(partial.cases.items[0].type).toBe('pfa');
    state.patientRead.mockResolvedValue({ patient: { nik, nama: 'Demo' } });
    state.caseRead.mockRejectedValue(new Error('unavailable'));
    const other = await loadFaskesHistory(nik);
    expect(other.patient).toMatchObject({ status: 'found', data: { nama: 'Demo' } });
    expect(other.cases.status).toBe('unavailable');
  });

  it('rejects invalid NIK before any server query', async () => {
    await expect(loadFaskesHistory('bad')).rejects.toThrow();
    expect(state.patientRead).not.toHaveBeenCalled();
    expect(state.caseRead).not.toHaveBeenCalled();
  });
});

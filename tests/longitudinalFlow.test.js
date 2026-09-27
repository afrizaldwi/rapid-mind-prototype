import { describe, expect, it } from 'vitest';
import { SRQ20_PROTOCOL } from '../src/protocols/srq20Protocol.js';
import { RISK_FUNCTION_PROTOCOL } from '../src/protocols/riskFunctionProtocol.js';
import { restoreLongitudinalDraft } from '../src/lib/longitudinalAssessment.js';
import {
  advanceToRiskFunction, canEnterRiskFunction, changeInputMode,
  checkPhase2BReadiness, countRiskFunctionAnswers, countSrqAnswers,
  createLongitudinalProgress, returnToSrq20,
} from '../src/lib/longitudinalFlow.js';
import { validateRiskFunctionResponses } from '../src/lib/riskFunction.js';
import { validateSrq20Responses } from '../src/lib/srq20.js';

const uid = 'relawan-123';
const assessment = {
  relawanId: uid,
  patient: { nik: '3201234567890001', nama: 'Siti', usia: 34, jenisKelamin: 'P', poskoName: 'Posko A' },
  phase: 'lanjutan', previousHistory: [], isNewPatient: false,
  startedAt: '2026-09-27T10:00:00.000Z',
};
const srq = (positiveCount = 0) => Object.fromEntries(SRQ20_PROTOCOL.items.map(({ id }, index) => [id, index < positiveCount]));
const risk = () => Object.fromEntries(RISK_FUNCTION_PROTOCOL.sections[0].items.map(({ id }) => [id, false]));
const functionAnswers = () => Object.fromEntries(RISK_FUNCTION_PROTOCOL.sections[1].items.map(({ id }) => [id, false]));
const progress = (change = {}) => ({ ...createLongitudinalProgress(), ...change });
const draft = (change = {}) => ({
  relawanId: uid, patientNik: assessment.patient.nik, assessmentStartedAt: assessment.startedAt,
  srqProtocolVersion: SRQ20_PROTOCOL.version,
  riskFunctionProtocolVersion: RISK_FUNCTION_PROTOCOL.version,
  ...progress({ srqResponses: srq(), ...change }),
});

describe('Screen 5 progress and transitions', () => {
  it('starts verbal on SRQ with no answers; missing differs from explicit false', () => {
    const fresh = createLongitudinalProgress();
    expect(fresh).toEqual({ inputMode: 'verbal', currentStep: 'srq20', srqResponses: {}, riskFactors: {}, functionalImpairment: {} });
    expect(countSrqAnswers(fresh.srqResponses)).toBe(0);
    expect(Object.hasOwn(fresh.srqResponses, 'srq20.01')).toBe(false);
    expect(validateSrq20Responses(fresh.srqResponses, { requireComplete: true }).valid).toBe(false);
    const answeredNo = { 'srq20.01': false };
    expect(Object.hasOwn(answeredNo, 'srq20.01')).toBe(true);
    expect(countSrqAnswers(answeredNo)).toBe(1);
    expect(validateSrq20Responses(answeredNo).valid).toBe(true);
  });

  it.each([0, 19])('%i of 20 answers cannot advance', (count) => {
    const partial = Object.fromEntries(SRQ20_PROTOCOL.items.slice(0, count).map(({ id }) => [id, false]));
    const before = progress({ srqResponses: partial });
    const result = advanceToRiskFunction(before);
    expect(countSrqAnswers(partial)).toBe(count);
    expect(result.valid).toBe(false);
    expect(result.progress).toBeNull();
    expect(before.currentStep).toBe('srq20');
  });

  it('advances with 20 explicit booleans and preserves all other progress', () => {
    const before = progress({
      inputMode: 'nonverbal', srqResponses: srq(7),
      riskFactors: { 'risk.01': false }, functionalImpairment: { 'function.02': true },
    });
    const result = advanceToRiskFunction(before);
    expect(countSrqAnswers(before.srqResponses)).toBe(20);
    expect(result.valid).toBe(true);
    expect(result.progress).toEqual({ ...before, currentStep: 'risk-function' });
    expect(before.currentStep).toBe('srq20');
  });

  it.each([
    ['unknown ID', { 'srq20.21': true }],
    ['wrong type', { 'srq20.01': 'false' }],
  ])('rejects %s during transition', (_name, change) => {
    expect(advanceToRiskFunction(progress({ srqResponses: { ...srq(), ...change } })).valid).toBe(false);
  });

  it('switches both directions while preserving answers, step, and session metadata', () => {
    const before = draft({ srqResponses: { 'srq20.01': false }, riskFactors: { 'risk.01': true }, functionalImpairment: { 'function.01': false } });
    const nonverbal = changeInputMode(before, 'nonverbal');
    const verbal = changeInputMode(nonverbal, 'verbal');
    expect(nonverbal).toEqual({ ...before, inputMode: 'nonverbal' });
    expect(verbal).toEqual(before);
    expect(restoreLongitudinalDraft(nonverbal, assessment, uid)).toEqual(nonverbal);
    expect(restoreLongitudinalDraft(verbal, assessment, uid)).toEqual(verbal);
  });

  it('returns to Screen 5 with all Screen 6 partial answers intact', () => {
    const before = draft({ currentStep: 'risk-function', inputMode: 'nonverbal', riskFactors: { 'risk.01': true }, functionalImpairment: { 'function.02': false } });
    const back = returnToSrq20(before);
    expect(back).toEqual({ ...before, currentStep: 'srq20' });
    expect(advanceToRiskFunction(back).progress).toEqual(before);
  });
});

describe('Screen 6 entry and readiness', () => {
  it('requires a valid session draft and complete, supported SRQ answers', () => {
    const complete = draft();
    expect(canEnterRiskFunction(complete, assessment, uid)).toBe(true);
    const missing = { ...srq() };
    delete missing['srq20.20'];
    expect(canEnterRiskFunction(draft({ srqResponses: missing }), assessment, uid)).toBe(false);
    expect(canEnterRiskFunction(draft({ srqResponses: { ...srq(), 'srq20.01': 'false' } }), assessment, uid)).toBe(false);
    expect(canEnterRiskFunction(draft({ srqProtocolVersion: 'srq20-prototype-v2' }), assessment, uid)).toBe(false);
    expect(canEnterRiskFunction(draft({ riskFunctionProtocolVersion: 'risk-function-prototype-v2' }), assessment, uid)).toBe(false);
    expect(canEnterRiskFunction(draft({ patientNik: '3201234567890002' }), assessment, uid)).toBe(false);
    expect(canEnterRiskFunction(complete, assessment, 'other')).toBe(false);
    expect(canEnterRiskFunction(null, assessment, uid)).toBe(false);
  });

  it('counts zero, seven, and eight explicit Screen 6 answers across separate sections', () => {
    const empty = progress();
    expect(countRiskFunctionAnswers(empty)).toBe(0);
    expect(validateRiskFunctionResponses(empty, { requireComplete: true }).valid).toBe(false);
    const seven = progress({ riskFactors: risk(), functionalImpairment: { ...functionAnswers() } });
    delete seven.functionalImpairment['function.04'];
    expect(countRiskFunctionAnswers(seven)).toBe(7);
    expect(validateRiskFunctionResponses(seven, { requireComplete: true }).valid).toBe(false);
    const eight = progress({ riskFactors: risk(), functionalImpairment: functionAnswers() });
    expect(eight.riskFactors['risk.01']).toBe(false);
    expect(eight.functionalImpairment['function.01']).toBe(false);
    expect(countRiskFunctionAnswers(eight)).toBe(8);
    expect(validateRiskFunctionResponses(eight, { requireComplete: true }).valid).toBe(true);
  });

  it.each([
    ['incomplete SRQ', { srqResponses: {} }, 'srq20'],
    ['malformed SRQ', { srqResponses: { ...srq(), 'srq20.01': 1 } }, 'srq20'],
    ['incomplete risk', { riskFactors: {} }, 'risk-function'],
    ['incomplete function', { functionalImpairment: {} }, 'risk-function'],
    ['malformed risk', { riskFactors: { ...risk(), 'risk.01': 'false' } }, 'risk-function'],
    ['unknown function ID', { functionalImpairment: { ...functionAnswers(), 'function.05': true } }, 'risk-function'],
    ['unsupported SRQ version', { srqProtocolVersion: 'srq20-prototype-v2' }, 'srq20'],
    ['unsupported Risk/Function version', { riskFunctionProtocolVersion: 'risk-function-prototype-v2' }, 'risk-function'],
  ])('rejects %s', (_name, change, reason) => {
    const result = checkPhase2BReadiness(draft({ srqResponses: srq(), riskFactors: risk(), functionalImpairment: functionAnswers(), ...change }));
    expect(result.ready).toBe(false);
    expect(result.reason).toBe(reason);
  });

  it.each([[0, 'T3'], [8, 'T2'], [14, 'T1']])('calculates readiness for %i Yes answers without storing derived data', (yes, tier) => {
    const before = draft({ srqResponses: srq(yes), riskFactors: risk(), functionalImpairment: functionAnswers() });
    before.riskFactors['risk.01'] = true;
    before.functionalImpairment['function.01'] = true;
    const snapshot = structuredClone(before);
    const result = checkPhase2BReadiness(before);
    expect(result).toEqual({
      ready: true,
      analysis: { score: yes, baseTier: tier },
      classification: {
        classificationVersion: 'classification-prototype-v1', baseTier: tier, finalTier: tier,
        adjustmentRuleDefined: false, adjustmentsApplied: [],
      },
    });
    expect(before).toEqual(snapshot);
    expect(Object.keys(restoreLongitudinalDraft(before, assessment, uid))).toEqual(Object.keys(before));
    for (const key of ['srq20Score', 'baseTier', 'tier', 'classificationVersion', 'adjustmentsApplied']) {
      expect(Object.hasOwn(before, key)).toBe(false);
    }
  });
});

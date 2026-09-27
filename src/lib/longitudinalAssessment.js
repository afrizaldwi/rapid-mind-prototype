import { assessmentSchema } from '../schemas/assessment.js';
import { SRQ20_PROTOCOL } from '../protocols/srq20Protocol.js';
import { RISK_FUNCTION_PROTOCOL } from '../protocols/riskFunctionProtocol.js';
import { validateSrq20Responses } from './srq20.js';
import { validateRiskFunctionResponses } from './riskFunction.js';

export const LONGITUDINAL_DRAFT_KEY = 'rapidMind.longitudinalDraft';
export const LONGITUDINAL_STEPS = ['srq20', 'risk-function'];
export const LONGITUDINAL_INPUT_MODES = ['verbal', 'nonverbal'];

const draftKeys = new Set([
  'relawanId', 'patientNik', 'assessmentStartedAt', 'srqProtocolVersion',
  'riskFunctionProtocolVersion', 'inputMode', 'currentStep', 'srqResponses',
  'riskFactors', 'functionalImpairment',
]);
const isPlainRecord = (value) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

export function restoreLongitudinalDraft(draft, assessment, userUid) {
  const context = assessmentSchema.safeParse(assessment);
  if (!context.success || context.data.phase !== 'lanjutan' || !userUid ||
      context.data.relawanId !== userUid || !isPlainRecord(draft) ||
      Object.keys(draft).length !== draftKeys.size ||
      Object.keys(draft).some((key) => !draftKeys.has(key)) ||
      draft.relawanId !== userUid ||
      draft.patientNik !== context.data.patient.nik ||
      draft.assessmentStartedAt !== context.data.startedAt ||
      draft.srqProtocolVersion !== SRQ20_PROTOCOL.version ||
      draft.riskFunctionProtocolVersion !== RISK_FUNCTION_PROTOCOL.version ||
      !LONGITUDINAL_STEPS.includes(draft.currentStep) ||
      !LONGITUDINAL_INPUT_MODES.includes(draft.inputMode)) return null;

  const srq = validateSrq20Responses(draft.srqResponses, {
    protocolVersion: draft.srqProtocolVersion,
  });
  const riskFunction = validateRiskFunctionResponses({
    riskFactors: draft.riskFactors,
    functionalImpairment: draft.functionalImpairment,
  }, { protocolVersion: draft.riskFunctionProtocolVersion });
  if (!srq.valid || !riskFunction.valid) return null;
  return {
    relawanId: userUid,
    patientNik: context.data.patient.nik,
    assessmentStartedAt: context.data.startedAt,
    srqProtocolVersion: draft.srqProtocolVersion,
    riskFunctionProtocolVersion: draft.riskFunctionProtocolVersion,
    inputMode: draft.inputMode,
    currentStep: draft.currentStep,
    srqResponses: srq.normalizedResponses,
    riskFactors: riskFunction.normalizedRiskFactors,
    functionalImpairment: riskFunction.normalizedFunctionalImpairment,
  };
}

export function clearLongitudinalDraft() {
  try { sessionStorage.removeItem(LONGITUDINAL_DRAFT_KEY); } catch { /* unavailable */ }
}

export function loadLongitudinalDraft(assessment, userUid) {
  try {
    const stored = sessionStorage.getItem(LONGITUDINAL_DRAFT_KEY);
    if (!stored) return null;
    const restored = restoreLongitudinalDraft(JSON.parse(stored), assessment, userUid);
    if (!restored) clearLongitudinalDraft();
    return restored;
  } catch {
    clearLongitudinalDraft();
    return null;
  }
}

export function saveLongitudinalDraft(progress, assessment, userUid) {
  const draft = restoreLongitudinalDraft({
    relawanId: userUid,
    patientNik: assessment?.patient?.nik,
    assessmentStartedAt: assessment?.startedAt,
    srqProtocolVersion: SRQ20_PROTOCOL.version,
    riskFunctionProtocolVersion: RISK_FUNCTION_PROTOCOL.version,
    inputMode: progress?.inputMode,
    currentStep: progress?.currentStep,
    srqResponses: progress?.srqResponses,
    riskFactors: progress?.riskFactors,
    functionalImpairment: progress?.functionalImpairment,
  }, assessment, userUid);
  if (!draft) throw new Error('Draf asesmen lanjutan tidak valid.');
  try {
    sessionStorage.setItem(LONGITUDINAL_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

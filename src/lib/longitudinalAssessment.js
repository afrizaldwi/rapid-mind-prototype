import { assessmentSchema } from '../schemas/assessment.js';
import { SRQ20_PROTOCOL } from '../protocols/srq20Protocol.js';
import { RISK_FUNCTION_PROTOCOL } from '../protocols/riskFunctionProtocol.js';
import { validateSrq20Responses } from './srq20.js';
import { validateRiskFunctionResponses } from './riskFunction.js';
import { analyzeSrq20 } from './scoring.js';
import { calculateFinalTier } from './classification.js';
import { validateCaseForSave } from './caseRecords.js';

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

function validCoordinates(lat, lng) {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

export function buildSrq20CaseRecord(progress, assessment, user, userProfile) {
  const draft = restoreLongitudinalDraft(progress, assessment, user?.uid);
  if (!draft) throw new Error('Konteks asesmen lanjutan tidak valid.');

  const srq = validateSrq20Responses(draft.srqResponses, {
    protocolVersion: draft.srqProtocolVersion,
    requireComplete: true,
  });
  if (!srq.valid) throw new Error('Lengkapi semua jawaban SRQ-20 sebelum menyimpan.');

  const riskFunction = validateRiskFunctionResponses({
    riskFactors: draft.riskFactors,
    functionalImpairment: draft.functionalImpairment,
  }, { protocolVersion: draft.riskFunctionProtocolVersion, requireComplete: true });
  if (!riskFunction.valid) throw new Error('Lengkapi semua jawaban Risk/Function sebelum menyimpan.');

  const analysis = analyzeSrq20(srq.normalizedResponses, { protocolVersion: draft.srqProtocolVersion });
  const classification = calculateFinalTier({
    baseTier: analysis.baseTier,
    riskFactors: riskFunction.normalizedRiskFactors,
    functionalImpairment: riskFunction.normalizedFunctionalImpairment,
    riskFunctionProtocolVersion: draft.riskFunctionProtocolVersion,
  });

  const patient = assessment.patient;
  const record = {
    recordType: 'srq20',
    phase: 'lanjutan',
    protocolVersion: draft.srqProtocolVersion,
    responses: srq.normalizedResponses,
    inputMode: draft.inputMode,
    srq20Score: analysis.score,
    baseTier: analysis.baseTier,
    riskFunctionProtocolVersion: draft.riskFunctionProtocolVersion,
    riskFactors: riskFunction.normalizedRiskFactors,
    functionalImpairment: riskFunction.normalizedFunctionalImpairment,
    classificationVersion: classification.classificationVersion,
    tier: classification.finalTier,
    patientNik: patient.nik,
    relawanId: user.uid,
  };
  if (patient.nama?.trim()) record.patientName = patient.nama;
  if (typeof patient.usia === 'number' && Number.isFinite(patient.usia)) record.patientAge = patient.usia;
  if (patient.jenisKelamin?.trim()) record.patientGender = patient.jenisKelamin;
  if (typeof userProfile?.name === 'string' && userProfile.name.trim()) record.relawanName = userProfile.name;
  const profilePosko = typeof userProfile?.poskoName === 'string' ? userProfile.poskoName.trim() : '';
  if (profilePosko && profilePosko !== 'Posko Utama - Kota') record.poskoName = profilePosko;
  if (validCoordinates(userProfile?.poskoLat, userProfile?.poskoLng)) {
    record.poskoLat = userProfile.poskoLat;
    record.poskoLng = userProfile.poskoLng;
  }

  validateCaseForSave(record);
  return record;
}

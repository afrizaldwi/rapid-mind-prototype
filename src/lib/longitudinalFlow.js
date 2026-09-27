import { RISK_FUNCTION_PROTOCOL } from '../protocols/riskFunctionProtocol.js';
import { SRQ20_PROTOCOL } from '../protocols/srq20Protocol.js';
import { calculateFinalTier } from './classification.js';
import { restoreLongitudinalDraft } from './longitudinalAssessment.js';
import { validateRiskFunctionResponses } from './riskFunction.js';
import { analyzeSrq20 } from './scoring.js';
import { validateSrq20Responses } from './srq20.js';

export function createLongitudinalProgress() {
  return {
    inputMode: 'verbal', currentStep: 'srq20', srqResponses: {},
    riskFactors: {}, functionalImpairment: {},
  };
}

export function countSrqAnswers(responses) {
  return SRQ20_PROTOCOL.items.filter(({ id }) => Object.hasOwn(responses, id)).length;
}

export function countRiskFunctionAnswers(progress) {
  return RISK_FUNCTION_PROTOCOL.sections.reduce((count, section, index) => {
    const responses = index === 0 ? progress.riskFactors : progress.functionalImpairment;
    return count + section.items.filter(({ id }) => Object.hasOwn(responses, id)).length;
  }, 0);
}

export function changeInputMode(progress, inputMode) {
  return { ...progress, inputMode };
}

export function advanceToRiskFunction(progress) {
  const validation = validateSrq20Responses(progress.srqResponses, {
    protocolVersion: progress.srqProtocolVersion,
    requireComplete: true,
  });
  return {
    valid: validation.valid,
    errors: validation.errors,
    progress: validation.valid ? { ...progress, currentStep: 'risk-function' } : null,
  };
}

export function returnToSrq20(progress) {
  return { ...progress, currentStep: 'srq20' };
}

export function canEnterRiskFunction(draft, assessment, userUid) {
  const restored = restoreLongitudinalDraft(draft, assessment, userUid);
  return Boolean(restored && validateSrq20Responses(restored.srqResponses, {
    protocolVersion: restored.srqProtocolVersion,
    requireComplete: true,
  }).valid);
}

export function checkPhase2BReadiness(progress) {
  const riskValidation = validateRiskFunctionResponses({
    riskFactors: progress.riskFactors,
    functionalImpairment: progress.functionalImpairment,
  }, { protocolVersion: progress.riskFunctionProtocolVersion, requireComplete: true });
  if (!riskValidation.valid) return { ready: false, reason: 'risk-function', errors: riskValidation.errors };

  const srqValidation = validateSrq20Responses(progress.srqResponses, {
    protocolVersion: progress.srqProtocolVersion,
    requireComplete: true,
  });
  if (!srqValidation.valid) return { ready: false, reason: 'srq20' };

  try {
    const analysis = analyzeSrq20(progress.srqResponses, { protocolVersion: progress.srqProtocolVersion });
    const classification = calculateFinalTier({
      baseTier: analysis.baseTier,
      riskFactors: progress.riskFactors,
      functionalImpairment: progress.functionalImpairment,
      riskFunctionProtocolVersion: progress.riskFunctionProtocolVersion,
    });
    return { ready: true, analysis, classification };
  } catch {
    return { ready: false, reason: 'analysis' };
  }
}

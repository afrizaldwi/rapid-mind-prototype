import { RISK_FUNCTION_PROTOCOL } from '../protocols/riskFunctionProtocol.js';
import { validateRiskFunctionResponses } from './riskFunction.js';

export const CLASSIFICATION_VERSION = 'classification-prototype-v1';

export function calculateFinalTier({
  baseTier,
  riskFactors,
  functionalImpairment,
  riskFunctionProtocolVersion = RISK_FUNCTION_PROTOCOL.version,
  classificationVersion = CLASSIFICATION_VERSION,
} = {}) {
  if (!['T1', 'T2', 'T3'].includes(baseTier)) throw new Error('Base tier tidak valid.');
  const validation = validateRiskFunctionResponses(
    { riskFactors, functionalImpairment },
    { protocolVersion: riskFunctionProtocolVersion, requireComplete: true },
  );
  if (!validation.valid) throw new Error('Respons Risk/Function lengkap tidak valid.');

  switch (classificationVersion) {
    case 'classification-prototype-v1':
      // Screen 6 will adjust classification later; no adjustment rule exists in v1.
      return {
        classificationVersion,
        baseTier,
        finalTier: baseTier,
        adjustmentRuleDefined: false,
        adjustmentsApplied: [],
      };
    default: throw new Error('Versi klasifikasi tidak didukung.');
  }
}

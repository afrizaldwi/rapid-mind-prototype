import { getRiskFunctionProtocol, RISK_FUNCTION_PROTOCOL } from '../protocols/riskFunctionProtocol.js';

const isPlainRecord = (value) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

function validateSection(responses, items, requireComplete) {
  const normalized = {};
  const errors = Object.create(null);
  if (!isPlainRecord(responses)) {
    errors._responses = 'Respons bagian ini tidak valid.';
    return { normalized, errors };
  }
  const ids = new Set(items.map((item) => item.id));
  for (const [id, value] of Object.entries(responses)) {
    if (!ids.has(id)) errors[id] = 'Butir tidak dikenal.';
    else if (typeof value !== 'boolean') errors[id] = 'Jawaban harus boolean.';
    else normalized[id] = value;
  }
  if (requireComplete) {
    for (const id of ids) {
      if (!Object.hasOwn(normalized, id) && !errors[id]) errors[id] = 'Jawaban ini wajib diisi.';
    }
  }
  return { normalized, errors };
}

export function validateRiskFunctionResponses(responses, {
  protocolVersion = RISK_FUNCTION_PROTOCOL.version,
  requireComplete = false,
} = {}) {
  const empty = { normalizedRiskFactors: {}, normalizedFunctionalImpairment: {} };
  const protocol = getRiskFunctionProtocol(protocolVersion);
  if (!protocol || !isPlainRecord(responses)) {
    return {
      valid: false,
      errors: { _responses: !protocol ? 'Versi protokol Risk/Function tidak didukung.' : 'Respons Risk/Function tidak valid.' },
      ...empty,
    };
  }
  const risk = validateSection(responses.riskFactors, protocol.sections[0].items, requireComplete);
  const functional = validateSection(responses.functionalImpairment, protocol.sections[1].items, requireComplete);
  return {
    valid: Object.keys(risk.errors).length === 0 && Object.keys(functional.errors).length === 0,
    errors: { riskFactors: risk.errors, functionalImpairment: functional.errors },
    normalizedRiskFactors: risk.normalized,
    normalizedFunctionalImpairment: functional.normalized,
  };
}

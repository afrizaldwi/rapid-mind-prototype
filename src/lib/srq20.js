import { getSrq20Protocol, SRQ20_PROTOCOL } from '../protocols/srq20Protocol.js';

const isPlainRecord = (value) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

export function validateSrq20Responses(responses, {
  protocolVersion = SRQ20_PROTOCOL.version,
  requireComplete = false,
} = {}) {
  const normalizedResponses = {};
  const errors = Object.create(null);
  const protocol = getSrq20Protocol(protocolVersion);
  if (!protocol) errors._protocolVersion = 'Versi protokol SRQ-20 tidak didukung.';
  if (!isPlainRecord(responses)) errors._responses = 'Respons SRQ-20 tidak valid.';
  if (!protocol || !isPlainRecord(responses)) {
    return { valid: false, errors, normalizedResponses };
  }

  const ids = new Set(protocol.items.map((item) => item.id));
  for (const [id, value] of Object.entries(responses)) {
    if (!ids.has(id)) errors[id] = 'Butir SRQ-20 tidak dikenal.';
    else if (typeof value !== 'boolean') errors[id] = 'Jawaban SRQ-20 harus boolean.';
    else normalizedResponses[id] = value;
  }
  if (requireComplete) {
    for (const id of ids) {
      if (!Object.hasOwn(normalizedResponses, id) && !errors[id]) errors[id] = 'Jawaban ini wajib diisi.';
    }
  }
  return { valid: Object.keys(errors).length === 0, errors, normalizedResponses };
}

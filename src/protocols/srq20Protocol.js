// Template content only. Stable IDs are independent of future clinical wording.
const SRQ20_PROTOCOL_V1 = {
  version: 'srq20-prototype-v1',
  items: Array.from({ length: 20 }, (_, index) => ({
    id: `srq20.${String(index + 1).padStart(2, '0')}`,
    type: 'boolean',
    label: `[Template] Pertanyaan SRQ-20 nomor ${index + 1}`,
  })),
};

export const SRQ20_PROTOCOL = SRQ20_PROTOCOL_V1;

// Keep supported historical protocols here when the active version changes.
export function getSrq20Protocol(version) {
  switch (version) {
    case 'srq20-prototype-v1': return SRQ20_PROTOCOL_V1;
    default: return null;
  }
}

// Template content only. These are not clinical indicators or weighted factors.
const RISK_FUNCTION_PROTOCOL_V1 = {
  version: 'risk-function-prototype-v1',
  sections: [
    {
      id: 'risk',
      title: 'Faktor Risiko',
      items: Array.from({ length: 4 }, (_, index) => ({
        id: `risk.${String(index + 1).padStart(2, '0')}`,
        type: 'boolean',
        label: `[Template] Faktor risiko ${index + 1}`,
      })),
    },
    {
      id: 'function',
      title: 'Gangguan Fungsi',
      items: Array.from({ length: 4 }, (_, index) => ({
        id: `function.${String(index + 1).padStart(2, '0')}`,
        type: 'boolean',
        label: `[Template] Gangguan fungsi ${index + 1}`,
      })),
    },
  ],
};

export const RISK_FUNCTION_PROTOCOL = RISK_FUNCTION_PROTOCOL_V1;

// Keep supported historical protocols here when the active version changes.
export function getRiskFunctionProtocol(version) {
  switch (version) {
    case 'risk-function-prototype-v1': return RISK_FUNCTION_PROTOCOL_V1;
    default: return null;
  }
}

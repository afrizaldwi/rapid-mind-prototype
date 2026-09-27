// Template content only. Stable IDs are independent of future clinical wording.
const SRQ20_TEMPLATE_LABELS = [
  '[Template] Apakah Anda merasa cemas atau takut setelah kejadian bencana?',
  '[Template] Apakah Anda merasa sulit untuk tenang setelah kejadian tersebut?',
  '[Template] Apakah Anda mengalami kesulitan tidur sejak kejadian bencana?',
  '[Template] Apakah Anda sering terbangun atau mengalami mimpi yang mengganggu?',
  '[Template] Apakah Anda merasa lebih mudah lelah daripada biasanya?',
  '[Template] Apakah Anda merasa sulit berkonsentrasi pada aktivitas sehari-hari?',
  '[Template] Apakah Anda sering memikirkan kembali kejadian bencana yang dialami?',
  '[Template] Apakah ingatan tentang kejadian tersebut membuat Anda merasa tidak nyaman?',
  '[Template] Apakah Anda merasa sedih lebih sering setelah kejadian bencana?',
  '[Template] Apakah Anda kehilangan minat terhadap aktivitas yang biasanya Anda sukai?',
  '[Template] Apakah Anda merasa kesulitan melakukan pekerjaan atau aktivitas rutin?',
  '[Template] Apakah Anda merasa kesulitan berkomunikasi dengan keluarga atau orang di sekitar Anda?',
  '[Template] Apakah Anda merasa lebih mudah marah atau tersinggung daripada biasanya?',
  '[Template] Apakah Anda merasa tidak aman berada di lingkungan tempat tinggal atau pengungsian saat ini?',
  '[Template] Apakah Anda merasa kebutuhan dasar Anda saat ini belum terpenuhi dengan baik?',
  '[Template] Apakah Anda merasa kesulitan mendapatkan dukungan dari keluarga atau orang terdekat?',
  '[Template] Apakah kondisi yang Anda alami mengganggu kemampuan Anda merawat diri sendiri?',
  '[Template] Apakah kondisi yang Anda alami mengganggu kemampuan Anda membantu atau merawat keluarga?',
  '[Template] Apakah Anda merasa membutuhkan bantuan lebih lanjut dari petugas atau tenaga kesehatan?',
  '[Template] Apakah kondisi psikologis yang Anda rasakan saat ini mengganggu aktivitas sehari-hari Anda?',
];

const SRQ20_PROTOCOL_V1 = {
  version: 'srq20-prototype-v1',
  items: SRQ20_TEMPLATE_LABELS.map((label, index) => ({
    id: `srq20.${String(index + 1).padStart(2, '0')}`,
    type: 'boolean',
    label,
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

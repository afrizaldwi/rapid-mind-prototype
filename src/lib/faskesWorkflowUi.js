import { nextReferralStatus, validationDecisionSchema } from '../schemas/emergencyWorkflow.js';

export const referralLabels = Object.freeze({
  'waiting-dispatch': 'Menunggu Dispatch',
  'en-route-to-location': 'Menuju Lokasi',
  'arrived-at-posko': 'Tiba di Posko',
  'en-route-to-hospital': 'Dalam Perjalanan ke RS',
  completed: 'Selesai',
});

export function getNextReferralAction(record) {
  if (record?.workflowIssue || record?.validation?.outcome !== 't0-confirmed') return null;
  const currentStatus = record.referral?.status;
  const nextStatus = nextReferralStatus(currentStatus);
  return nextStatus ? { currentStatus, nextStatus, label: referralLabels[nextStatus] } : null;
}

export function getWorkflowPresentation(record) {
  if (!record) return null;
  if (record.workflowIssue) return { title: 'Alur Faskes perlu diperiksa', detail: 'Metadata alur tidak valid' };
  const validation = record.validation;
  if (!validation) return { title: 'T0-Suspect', detail: 'Belum divalidasi' };
  if (validation.outcome === 'downgraded') {
    return { title: 'Downgraded', detail: validation.downgradedTo };
  }
  return { title: 'T0-Confirmed', detail: referralLabels[record.referral?.status] || 'Status referral tidak tersedia' };
}

export function buildDecisionPayload({ outcome, downgradedTo, clinicalNote }) {
  const decision = { outcome };
  if (outcome === 'downgraded') decision.downgradedTo = downgradedTo;
  const note = typeof clinicalNote === 'string' ? clinicalNote.trim() : '';
  if (note) decision.clinicalNote = note;
  return validationDecisionSchema.parse(decision);
}

export function getWriteBlockReason({ online, detail, busy = false, awaiting = false }) {
  if (busy) return 'Tindakan sedang disimpan.';
  if (awaiting) return 'Menunggu pembaruan resmi dari Firestore.';
  if (!online) return 'Browser offline. Tindakan Faskes memerlukan koneksi server.';
  if (detail.loading) return 'Menunggu data emergency dari server.';
  if (detail.listenerError) return 'Listener terputus. Sambungkan kembali sebelum bertindak.';
  if (detail.invalidOrigin) return 'Data asal emergency tidak valid.';
  if (detail.notFound) return 'Emergency tidak ditemukan.';
  if (!detail.record) return 'Data emergency belum tersedia.';
  if (detail.fromCache || detail.hasPendingWrites) return 'Data belum terkonfirmasi oleh server.';
  if (detail.record.workflowIssue) return 'Metadata alur Faskes tidak valid.';
  return null;
}

export function isAwaitingListener(awaiting, detail) {
  if (!awaiting) return false;
  if (detail.loading || detail.listenerError || detail.fromCache || detail.hasPendingWrites) return true;
  if (awaiting.type === 'fault') {
    if (awaiting.code === 'malformed-workflow') return !detail.record?.workflowIssue;
    if (awaiting.code === 'invalid-origin') return !detail.invalidOrigin;
    if (awaiting.code === 'not-found') return !detail.notFound;
  }
  if (!detail.record) return true;
  if (awaiting.type === 'decision') return !detail.record.validation;
  if (awaiting.type === 'referral') return detail.record.referral?.status === awaiting.previousStatus;
  return true;
}

const errorMessages = {
  'already-decided': 'Nakes lain sudah menetapkan keputusan final. Menunggu status terbaru.',
  'stale-transition': 'Nakes lain sudah mengubah status referral. Menunggu status terbaru.',
  'permission-denied': 'Akun ini tidak diizinkan mengubah alur Faskes.',
  offline: 'Browser offline. Tindakan Faskes memerlukan koneksi server.',
  unavailable: 'Server Firestore belum dapat dihubungi. Coba lagi saat koneksi pulih.',
  'malformed-workflow': 'Metadata alur Faskes tidak valid. Tindakan dihentikan.',
  'invalid-origin': 'Data asal T0-Suspect tidak valid. Tindakan dihentikan.',
  'not-found': 'Emergency tidak ditemukan.',
  unauthenticated: 'Sesi Nakes tidak tersedia. Masuk kembali untuk melanjutkan.',
  'invalid-transition': 'Perubahan status referral tidak valid.',
  'no-referral': 'Emergency ini tidak memiliki referral aktif.',
  'invalid-id': 'ID emergency tidak valid.',
};

export function getWorkflowErrorMessage(error) {
  return errorMessages[error?.code] || 'Tindakan belum dapat disimpan. Periksa koneksi dan coba lagi.';
}

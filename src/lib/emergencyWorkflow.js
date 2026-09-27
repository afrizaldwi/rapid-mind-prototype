import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { parseEmergencySnapshot } from './emergencyCloud.js';
import { nextReferralStatus, validationDecisionSchema } from '../schemas/emergencyWorkflow.js';

export class EmergencyWorkflowError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'EmergencyWorkflowError';
    this.code = code;
  }
}

function requireOnlineNakesUid() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new EmergencyWorkflowError('offline', 'Tindakan Faskes memerlukan koneksi server.');
  }
  const uid = auth.currentUser?.uid;
  if (!uid) throw new EmergencyWorkflowError('unauthenticated', 'Akun Nakes tidak tersedia.');
  return uid;
}

function readCurrentEmergency(snapshot) {
  if (!snapshot.exists()) throw new EmergencyWorkflowError('not-found', 'Emergency tidak ditemukan.');
  let record;
  try {
    record = parseEmergencySnapshot(snapshot);
  } catch {
    throw new EmergencyWorkflowError('invalid-origin', 'Data asal T0-Suspect tidak valid.');
  }
  if (record.workflowIssue) {
    throw new EmergencyWorkflowError('malformed-workflow', 'Metadata alur Faskes tidak valid.');
  }
  return record;
}

function classifyFirestoreError(error) {
  if (error instanceof EmergencyWorkflowError) return error;
  if (error?.code === 'permission-denied') {
    return new EmergencyWorkflowError('permission-denied', 'Akun ini tidak diizinkan mengubah alur Faskes.');
  }
  if (error?.code === 'unavailable' || error?.code === 'deadline-exceeded') {
    return new EmergencyWorkflowError('unavailable', 'Server Firestore belum dapat dihubungi.');
  }
  return error;
}

export async function decideEmergency(id, decision) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new EmergencyWorkflowError('invalid-id', 'ID emergency tidak valid.');
  }
  const parsedDecision = validationDecisionSchema.parse(decision);
  const reviewerId = requireOnlineNakesUid();
  const reference = doc(db, 'emergencies', id);
  try {
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      const current = readCurrentEmergency(snapshot);
      if (current.validation) {
        throw new EmergencyWorkflowError('already-decided', 'Emergency sudah divalidasi Nakes lain.');
      }
      if (current.referral) {
        throw new EmergencyWorkflowError('malformed-workflow', 'Referral ada tanpa validasi.');
      }
      const validation = {
        version: 'secondary-validation-prototype-v1',
        ...parsedDecision,
        reviewerId,
        decidedAt: serverTimestamp(),
      };
      const patch = { validation };
      if (parsedDecision.outcome === 't0-confirmed') {
        patch.referral = {
          version: 'referral-prototype-v1',
          status: 'waiting-dispatch',
          createdAt: serverTimestamp(),
          createdBy: reviewerId,
          updatedAt: serverTimestamp(),
          updatedBy: reviewerId,
        };
      }
      transaction.update(reference, patch);
      return { id, outcome: parsedDecision.outcome };
    });
  } catch (error) {
    throw classifyFirestoreError(error);
  }
}

export async function advanceReferral(id, expectedStatus, nextStatus) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new EmergencyWorkflowError('invalid-id', 'ID emergency tidak valid.');
  }
  const reviewerId = requireOnlineNakesUid();
  const reference = doc(db, 'emergencies', id);
  try {
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      const current = readCurrentEmergency(snapshot);
      if (current.validation?.outcome !== 't0-confirmed' || !current.referral) {
        throw new EmergencyWorkflowError('no-referral', 'Emergency tidak memiliki referral aktif.');
      }
      if (current.referral.status !== expectedStatus) {
        throw new EmergencyWorkflowError('stale-transition', 'Status referral telah berubah.');
      }
      if (nextReferralStatus(current.referral.status) !== nextStatus) {
        throw new EmergencyWorkflowError('invalid-transition', 'Transisi status referral tidak valid.');
      }
      transaction.update(reference, {
        referral: {
          ...snapshot.data().referral,
          status: nextStatus,
          updatedAt: serverTimestamp(),
          updatedBy: reviewerId,
        },
      });
      return { id, status: nextStatus };
    });
  } catch (error) {
    throw classifyFirestoreError(error);
  }
}

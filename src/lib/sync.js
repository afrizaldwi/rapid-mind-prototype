import { collection, doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import localDb from "./db";
import { syncPendingPatients } from "./patients";

const caseWrites = new Map();
let aggregateRun = null;

export async function getSyncCounts() {
  const [patients, cases, activeConflicts, localConflicts] = await Promise.all([
    localDb.patients.where("syncStatus").equals("pending").count(),
    localDb.cases.where("synced").equals(0).count(),
    localDb.patients.where("syncStatus").equals("conflict").toArray(),
    localDb.patientConflicts.where("status").equals("unresolved").toArray(),
  ]);
  // Count each NIK once even when both an active row and audit record describe it.
  const groups = new Set(activeConflicts.map((row) => row.nik));
  for (const row of localConflicts) groups.add(row.nik || `invalid:${row.auditId}`);
  return { patients, cases, pending: patients + cases, conflicts: groups.size };
}

/**
 * Simpan kasus ke IndexedDB (selalu dilakukan pertama)
 */
export async function saveCaseLocally(caseData) {
  const localCase = {
    ...caseData,
    synced: 0,
    timestamp: new Date().toISOString(),
    firestoreId: null,
  };

  const localId = await localDb.cases.add(localCase);
  return localId;
}

/**
 * Push satu kasus ke Firestore
 */
async function writeCase(localId) {
  const current = await localDb.cases.get(localId);
  if (!current) throw new Error("Kasus lokal tidak ditemukan");
  if (current.synced === 1) return current.firestoreId;

  const allocatedId = doc(collection(db, "cases")).id;
  // The IndexedDB transaction serializes ID allocation across tabs. Always use
  // the ID stored on the record, including after a previous cloud write.
  const firestoreId = await localDb.transaction("rw", localDb.cases, async () => {
    const latest = await localDb.cases.get(localId);
    if (!latest) throw new Error("Kasus lokal tidak ditemukan");
    if (latest.firestoreId) return latest.firestoreId;
    await localDb.cases.update(localId, { firestoreId: allocatedId });
    return allocatedId;
  });
  const localCase = await localDb.cases.get(localId);
  if (localCase.synced === 1) return firestoreId;
  try {
    const { localId: unusedLocalId, synced: unusedSynced, firestoreId: unusedFirestoreId, ...data } = localCase;
    void unusedLocalId;
    void unusedSynced;
    void unusedFirestoreId;
    const zonaUpper = (data.zona || data.triageResult || "hijau").toUpperCase();
    const recordedAt = new Date(data.timestamp);
    if (Number.isNaN(recordedAt.getTime())) throw new Error("Waktu kasus lokal tidak valid");
    const cloudTimestamp = Timestamp.fromDate(recordedAt);
    await setDoc(doc(db, "cases", firestoreId), {
      ...data,
      zona: (data.zona || zonaUpper).toLowerCase(),
      triageResult: zonaUpper,
      volunteerName: data.volunteerName || data.relawanName || "Relawan",
      relawanName: data.relawanName || data.volunteerName || "Relawan",
      createdAt: cloudTimestamp,
      timestamp: cloudTimestamp,
      location: {
        lat: data.lat || data.poskoLat || -6.2088,
        lng: data.lng || data.poskoLng || 106.8456,
      },
      syncedFromOffline: localCase.synced === 0,
    });

    // Update local record
    await localDb.cases.update(localId, { synced: 1 });

    return firestoreId;
  } catch (error) {
    console.error("Gagal push ke Firestore:", error);
    throw error;
  }
}

export function pushCaseToFirestore(localCase) {
  const localId = localCase.localId;
  if (caseWrites.has(localId)) return caseWrites.get(localId);
  const work = writeCase(localId).finally(() => caseWrites.delete(localId));
  caseWrites.set(localId, work);
  return work;
}

/**
 * Sync semua kasus yang belum ter-sync
 */
export async function syncPendingCases() {
  const pendingCases = await localDb.cases.where("synced").equals(0).toArray();

  if (pendingCases.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const localCase of pendingCases) {
    try {
      await pushCaseToFirestore(localCase);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

export function syncPendingData() {
  if (aggregateRun) return aggregateRun;
  aggregateRun = (async () => {
    const patients = await syncPendingPatients();
    const cases = await syncPendingCases();
    const remaining = await getSyncCounts();
    return { patients, cases, remaining };
  })().finally(() => { aggregateRun = null; });
  return aggregateRun;
}

/**
 * Simpan kasus — offline-first approach
 * Selalu simpan ke IndexedDB, lalu coba push ke Firestore jika online
 */
export async function saveCase(caseData) {
  const localId = await saveCaseLocally(caseData);

  if (navigator.onLine) {
    try {
      const localCase = await localDb.cases.get(localId);
      await pushCaseToFirestore(localCase);
      return { localId, synced: true };
    } catch {
      return { localId, synced: false };
    }
  }

  return { localId, synced: false };
}

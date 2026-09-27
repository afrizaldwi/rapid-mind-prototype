import { collection, doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import localDb from "./db";
import { findCloudPatientByNik, findLocalPatientByNik, pushPatientToFirestore, syncPendingPatients } from "./patients";
import { getCaseRecordType, getLegacyZone, validateCaseForSave } from "./caseRecords";
import { syncPendingEmergencies } from "./emergencies";

const caseWrites = new Map();
let aggregateRun = null;

export async function getSyncCounts() {
  const [patients, cases, emergencies, activeConflicts, localConflicts] = await Promise.all([
    localDb.patients.where("syncStatus").equals("pending").count(),
    localDb.cases.where("synced").equals(0).count(),
    localDb.emergencies.where("synced").equals(0).count(),
    localDb.patients.where("syncStatus").equals("conflict").toArray(),
    localDb.patientConflicts.where("status").equals("unresolved").toArray(),
  ]);
  // Count each NIK once even when both an active row and audit record describe it.
  const groups = new Set(activeConflicts.map((row) => row.nik));
  for (const row of localConflicts) groups.add(row.nik || `invalid:${row.auditId}`);
  return { patients, cases, emergencies, pending: patients + cases + emergencies, conflicts: groups.size };
}

export function isSyncComplete(result, counts) {
  return !!counts && counts.pending === 0 && counts.conflicts === 0 &&
    result.patients.failed === 0 && result.emergencies.failed === 0 && result.cases.failed === 0;
}

/**
 * Simpan kasus ke IndexedDB (selalu dilakukan pertama)
 */
export async function saveCaseLocally(caseData) {
  validateCaseForSave(caseData);
  const localCase = {
    ...caseData,
    synced: 0,
    timestamp: new Date().toISOString(),
    firestoreId: null,
  };

  const localId = await localDb.cases.add(localCase);
  return localId;
}

async function ensureCasePatientReady(patientNik) {
  if (patientNik == null) return; // Old demo cases may have no patient link.
  const patient = await findLocalPatientByNik(patientNik);
  if (!patient) {
    // An older linked case can lack a local directory row. Reuse the patient
    // domain's server-backed uniqueness check; an unreachable server is not proof.
    if (!await findCloudPatientByNik(patientNik)) throw new Error("Pasien cloud belum terkonfirmasi.");
    return;
  }
  if (patient.syncStatus === 'pending') {
    const result = await pushPatientToFirestore(patientNik);
    if (result.patient.syncStatus !== 'synced') throw new Error("Sinkronisasi pasien belum selesai.");
    return;
  }
  if (patient.syncStatus !== 'synced') throw new Error("Status pasien belum aman untuk sinkronisasi kasus.");
}

function typedLocation(data) {
  const pairs = [
    [data.lat, data.lng],
    [data.poskoLat, data.poskoLng],
    [data.location?.lat, data.location?.lng],
  ];
  for (const [lat, lng] of pairs) {
    if (typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
        typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * Push satu kasus ke Firestore
 */
async function writeCase(localId) {
  const current = await localDb.cases.get(localId);
  if (!current) throw new Error("Kasus lokal tidak ditemukan");
  if (current.synced === 1) return current.firestoreId;
  validateCaseForSave(current);
  await ensureCasePatientReady(current.patientNik);

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
    const { localId: unusedLocalId, synced: unusedSynced, firestoreId: unusedFirestoreId,
      location: unusedLocation, ...data } = localCase;
    void unusedLocalId;
    void unusedSynced;
    void unusedFirestoreId;
    void unusedLocation;
    const recordType = getCaseRecordType(data);
    const recordedAt = new Date(data.timestamp);
    if (Number.isNaN(recordedAt.getTime())) throw new Error("Waktu kasus lokal tidak valid");
    const cloudTimestamp = Timestamp.fromDate(recordedAt);
    const cloudCase = {
      ...data,
      volunteerName: data.volunteerName || data.relawanName || "Relawan",
      relawanName: data.relawanName || data.volunteerName || "Relawan",
      createdAt: cloudTimestamp,
      timestamp: cloudTimestamp,
      syncedFromOffline: localCase.synced === 0,
    };
    if (recordType === 'legacy-triage') {
      const zone = getLegacyZone(data);
      cloudCase.zona = zone;
      cloudCase.triageResult = zone.toUpperCase();
      cloudCase.location = {
        lat: data.lat || data.poskoLat || -6.2088,
        lng: data.lng || data.poskoLng || 106.8456,
      };
    } else {
      const location = typedLocation(localCase);
      if (location) cloudCase.location = location;
    }
    await setDoc(doc(db, "cases", firestoreId), cloudCase);

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
    let patients;
    try {
      patients = await syncPendingPatients();
    } catch (error) {
      // Emergency dispatch is independent of patient-directory readiness.
      console.error("Gagal sinkronisasi pasien:", error);
      patients = { synced: 0, failed: 1, conflicts: 0 };
    }
    let emergencies;
    try {
      emergencies = await syncPendingEmergencies();
    } catch (error) {
      console.error("Gagal sinkronisasi Red Flag:", error);
      emergencies = { synced: 0, failed: 1 };
    }
    const cases = await syncPendingCases();
    const remaining = await getSyncCounts();
    return { patients, emergencies, cases, remaining };
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

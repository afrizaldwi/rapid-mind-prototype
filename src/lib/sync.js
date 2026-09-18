import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import localDb from "./db";

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
export async function pushCaseToFirestore(localCase) {
  try {
    const { localId, synced, firestoreId, ...data } = localCase;
    const zonaUpper = (data.zona || data.triageResult || "hijau").toUpperCase();
    const docRef = await addDoc(collection(db, "cases"), {
      ...data,
      zona: (data.zona || zonaUpper).toLowerCase(),
      triageResult: zonaUpper,
      volunteerName: data.volunteerName || data.relawanName || "Relawan",
      relawanName: data.relawanName || data.volunteerName || "Relawan",
      createdAt: serverTimestamp(),
      timestamp: serverTimestamp(),
      location: {
        lat: data.lat || data.poskoLat || -6.2088,
        lng: data.lng || data.poskoLng || 106.8456,
      },
      syncedFromOffline: localCase.synced === 0,
    });

    // Update local record
    await localDb.cases.update(localId, {
      synced: 1,
      firestoreId: docRef.id,
    });

    return docRef.id;
  } catch (error) {
    console.error("Gagal push ke Firestore:", error);
    throw error;
  }
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
    } catch (error) {
      failed++;
    }
  }

  return { synced, failed };
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
    } catch (error) {
      return { localId, synced: false };
    }
  }

  return { localId, synced: false };
}

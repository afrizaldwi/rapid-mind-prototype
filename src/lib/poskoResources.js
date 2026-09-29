import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { DEMO_POSKOS } from '../data/demoPoskos';
import { canonicalPosko, parsePoskoResource, POSKO_RESOURCE_VERSION, resourceQuantitiesSchema } from '../schemas/poskoResource';

export function projectPoskoResources(documents) {
  const byId = new Map();
  let rejected = 0;
  const invalidIds = [];
  documents.forEach((document) => {
    try {
      const resource = parsePoskoResource(document.id, document.data());
      if (resource && !byId.has(document.id)) byId.set(document.id, resource);
      else { rejected++; if (canonicalPosko(document.id)) invalidIds.push(document.id); }
    } catch { rejected++; if (canonicalPosko(document.id)) invalidIds.push(document.id); }
  });
  return { resources: DEMO_POSKOS.map((posko) => byId.get(posko.id)).filter(Boolean),
    invalidIds, rejected };
}

export function watchPoskoResources(onData, onError) {
  return onSnapshot(collection(db, 'poskoResources'), { includeMetadataChanges: true }, (snapshot) => {
    onData({ ...projectPoskoResources(snapshot.docs), fromCache: snapshot.metadata.fromCache,
      pending: snapshot.metadata.hasPendingWrites });
  }, onError);
}

export async function savePoskoResource(poskoId, quantities) {
  const posko = canonicalPosko(poskoId);
  const parsed = resourceQuantitiesSchema.safeParse(quantities);
  if (!posko || !parsed.success) throw new Error('Posko atau jumlah alokasi tidak valid.');
  const adminUid = auth.currentUser?.uid;
  if (!adminUid || !navigator.onLine) throw new Error('Sesi Admin dan koneksi server diperlukan.');
  const reference = doc(db, 'poskoResources', posko.id);
  await runTransaction(db, async (transaction) => {
    const admin = await transaction.get(doc(db, 'users', adminUid));
    if (!admin.exists() || admin.data().role !== 'admin' || auth.currentUser?.uid !== adminUid || !navigator.onLine) {
      throw new Error('Sesi Admin atau koneksi server tidak tersedia.');
    }
    const current = await transaction.get(reference);
    if (auth.currentUser?.uid !== adminUid || !navigator.onLine) {
      throw new Error('Sesi Admin atau koneksi server tidak tersedia.');
    }
    if (current.exists()) {
      if (!parsePoskoResource(posko.id, current.data())) throw new Error('Dokumen alokasi tidak valid; pembaruan dibatalkan.');
      transaction.update(reference, { ...parsed.data, updatedAt: serverTimestamp(), updatedBy: adminUid });
    } else {
      transaction.set(reference, { schemaVersion: POSKO_RESOURCE_VERSION, poskoId: posko.id,
        poskoName: posko.name, ...parsed.data, createdAt: serverTimestamp(), createdBy: adminUid,
        updatedAt: serverTimestamp(), updatedBy: adminUid });
    }
  });
}

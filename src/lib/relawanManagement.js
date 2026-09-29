import { collection, doc, onSnapshot, query, runTransaction, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { DEMO_POSKOS } from '../data/demoPoskos';
import { validDocumentId } from './accountProvisioningDomain';

export function projectRelawan(id, data) {
  if (!validDocumentId(id) || !data || data.role !== 'relawan' ||
      data.uid !== id || typeof data.name !== 'string' || !data.name.trim() ||
      typeof data.email !== 'string' || !data.email.trim() ||
      typeof data.poskoName !== 'string' || !data.poskoName.trim() ||
      !Number.isFinite(data.poskoLat) || data.poskoLat < -90 || data.poskoLat > 90 ||
      !Number.isFinite(data.poskoLng) || data.poskoLng < -180 || data.poskoLng > 180) return null;
  return { uid: id, name: data.name, email: data.email, poskoName: data.poskoName,
    poskoLat: data.poskoLat, poskoLng: data.poskoLng };
}

export function projectRelawanRoster(docs) {
  const relawan = [];
  let rejected = 0;
  docs.forEach((item) => {
    const profile = projectRelawan(item.id, item.data());
    if (profile) relawan.push(profile);
    else rejected++;
  });
  relawan.sort((a, b) => a.name.localeCompare(b.name, 'id') || a.uid.localeCompare(b.uid));
  return { relawan, rejected };
}

export function rosterIsCurrent(roster, online) {
  return !!online && !!roster && !roster.fromCache && !roster.pending;
}

export function assignmentPatch(poskoName) {
  const posko = DEMO_POSKOS.find((item) => item.name === poskoName);
  if (!posko) throw new Error('Pilih Posko prototipe yang tersedia.');
  return { poskoName: posko.name, poskoLat: posko.lat, poskoLng: posko.lng };
}

export function watchRelawan(onData, onError) {
  const rosterQuery = query(collection(db, 'users'), where('role', '==', 'relawan'));
  return onSnapshot(rosterQuery, { includeMetadataChanges: true }, (snapshot) => {
    onData({ ...projectRelawanRoster(snapshot.docs), fromCache: snapshot.metadata.fromCache,
      pending: snapshot.metadata.hasPendingWrites });
  }, onError);
}

export async function reassignRelawan(uid, poskoName) {
  if (!validDocumentId(uid)) throw new Error('Relawan tidak valid.');
  const patch = assignmentPatch(poskoName);
  const adminUid = auth.currentUser?.uid;
  if (!adminUid || !navigator.onLine) throw new Error('Penugasan memerlukan sesi Admin dan koneksi server.');
  await runTransaction(db, async (transaction) => {
    const admin = await transaction.get(doc(db, 'users', adminUid));
    if (!admin.exists() || admin.data().role !== 'admin' || auth.currentUser?.uid !== adminUid || !navigator.onLine) {
      throw new Error('Sesi Admin atau koneksi server tidak tersedia.');
    }
    const reference = doc(db, 'users', uid);
    const current = await transaction.get(reference);
    if (!current.exists() || current.data().role !== 'relawan') throw new Error('Profil Relawan tidak tersedia. Muat ulang daftar.');
    transaction.update(reference, patch);
  });
}

import { collection, deleteField, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { healthcareOrganizationInputSchema, healthcareOrganizationSchema, nakesMembershipPatch } from '../schemas/healthcareOrganization';

const organizations = collection(db, 'healthcareOrganizations');

export function watchHospitals(onData, onError) {
  return onSnapshot(organizations, { includeMetadataChanges: true }, (snapshot) => {
    const valid = [];
    const rejected = [];
    snapshot.docs.forEach((item) => {
      const parsed = healthcareOrganizationSchema.safeParse(item.data());
      if (parsed.success) valid.push({ id: item.id, ...parsed.data });
      else rejected.push(item.id);
    });
    onData({ hospitals: valid.sort((a, b) => a.name.localeCompare(b.name)), rejected, fromCache: snapshot.metadata.fromCache, pending: snapshot.metadata.hasPendingWrites });
  }, onError);
}

export async function saveHospital({ id, input, adminUid }) {
  const data = healthcareOrganizationInputSchema.parse(input);
  if (!adminUid) throw new Error('Sesi Admin tidak tersedia.');
  const reference = id ? doc(organizations, id) : doc(organizations);
  await runTransaction(db, async (transaction) => {
    const prior = await transaction.get(reference);
    if (id && !prior.exists()) throw new Error('Rumah sakit tidak ditemukan. Muat ulang daftar.');
    if (!id && prior.exists()) throw new Error('ID organisasi sudah digunakan.');
    const audit = { updatedAt: serverTimestamp(), updatedBy: adminUid };
    if (prior.exists()) {
      const existing = healthcareOrganizationSchema.parse(prior.data());
      transaction.set(reference, { ...data, createdAt: existing.createdAt, createdBy: existing.createdBy, ...audit });
    } else {
      transaction.set(reference, { ...data, createdAt: serverTimestamp(), createdBy: adminUid, ...audit });
    }
  });
  return reference.id;
}

export async function lookupPrivilegedProfile(uid) {
  if (typeof uid !== 'string' || !uid.trim() || uid !== uid.trim() || uid.includes('/')) throw new Error('UID tidak valid.');
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) throw new Error('Profil tidak ditemukan.');
  const profile = snapshot.data();
  if (profile.role !== 'nakes') throw new Error('Profil ini bukan Nakes.');
  return { ...profile, uid: snapshot.id };
}

export async function assignNakesOrganization(profile, organizationId) {
  const patch = nakesMembershipPatch(profile, organizationId);
  if (!profile.uid || profile.uid.includes('/')) throw new Error('UID tidak valid.');
  if (organizationId !== null) {
    const snapshot = await getDoc(doc(organizations, organizationId));
    if (!snapshot.exists() || !healthcareOrganizationSchema.safeParse(snapshot.data()).success) throw new Error('Rumah sakit tidak tersedia atau datanya tidak valid.');
  }
  await updateDoc(doc(db, 'users', profile.uid), patch ?? { organizationId: deleteField() });
}

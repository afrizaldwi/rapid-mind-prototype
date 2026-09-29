import { getApps, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, deleteUser, getAuth, inMemoryPersistence, initializeAuth, setPersistence, signOut } from 'firebase/auth';
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig } from './firebase';
import { healthcareOrganizationSchema } from '../schemas/healthcareOrganization';
import { buildNakesProfile, buildRelawanProfile, validateNakesInput, validateRelawanInput } from './accountProvisioningDomain';

const secondaryAppName = 'admin-account-provisioning';

function secondaryAuth() {
  const existingApp = getApps().find((app) => app.name === secondaryAppName);
  if (existingApp) return getAuth(existingApp);
  return initializeAuth(initializeApp(firebaseConfig, secondaryAppName), { persistence: inMemoryPersistence });
}

async function requirePrimaryAdmin() {
  const adminUid = auth.currentUser?.uid;
  if (!adminUid) throw new Error('Sesi Admin tidak tersedia.');
  const snapshot = await getDocFromServer(doc(db, 'users', adminUid));
  if (!snapshot.exists() || snapshot.data().role !== 'admin' || auth.currentUser?.uid !== adminUid) {
    throw new Error('Hanya Admin dapat membuat akun.');
  }
  return adminUid;
}

async function provision(input, validate, buildProfile) {
  const valid = validate(input);
  const adminUid = await requirePrimaryAdmin();
  if (valid.organizationId) {
    const organization = await getDocFromServer(doc(db, 'healthcareOrganizations', valid.organizationId));
    if (!organization.exists() || !healthcareOrganizationSchema.safeParse(organization.data()).success ||
        organization.data().type !== 'hospital') throw new Error('Rumah sakit tidak tersedia atau datanya tidak valid.');
  }

  const temporaryAuth = secondaryAuth();
  await setPersistence(temporaryAuth, inMemoryPersistence);
  if (temporaryAuth.currentUser) await signOut(temporaryAuth);
  if (auth.currentUser?.uid !== adminUid) throw new Error('Sesi Admin berubah. Coba lagi.');

  const credential = await createUserWithEmailAndPassword(temporaryAuth, valid.email, valid.initialPassword);
  const uid = credential.user.uid;
  const email = credential.user.email || valid.email;
  let profile;
  try {
    profile = buildProfile(valid, uid, new Date().toISOString(), email);
    if (auth.currentUser?.uid !== adminUid) throw new Error('Sesi Admin berubah.');
    await setDoc(doc(db, 'users', uid), profile);
  } catch {
    let rollbackFailed = false;
    try { await deleteUser(credential.user); }
    catch { rollbackFailed = true; }
    try { await signOut(temporaryAuth); } catch { /* The secondary session remains in memory only. */ }
    throw new Error(rollbackFailed
      ? `Profil gagal disimpan dan akun Auth ${uid} mungkin masih ada. Periksa sebelum mencoba lagi.`
      : 'Profil gagal disimpan. Akun Auth baru telah dibatalkan.');
  }

  const result = { uid, email, role: profile.role, ...(valid.organizationId ? { organizationId: valid.organizationId } : {}),
    ...(valid.poskoName ? { poskoName: valid.poskoName } : {}) };
  try { await signOut(temporaryAuth); }
  catch { return { ...result, cleanupIssue: true }; }
  return result;
}

export function createRelawanAccount(input) {
  return provision(input, validateRelawanInput, buildRelawanProfile);
}

export function createNakesAccount(input) {
  return provision(input, validateNakesInput, buildNakesProfile);
}

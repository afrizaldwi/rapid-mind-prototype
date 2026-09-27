import { collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import localDb from './db';
import { emergencyEventSchema, localEmergencySchema } from '../schemas/emergencyRecord.js';
import { RED_FLAG_PROTOCOL } from '../protocols/redFlagProtocol.js';

const emergencyWrites = new Map();

function validCoordinates(lat, lng) {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

function meaningfulText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function buildEmergencyRecord({ user, userProfile, assessment, gates, note = '' }) {
  if (!user?.uid || userProfile?.role !== 'relawan') {
    throw new Error('Profil Relawan tidak tersedia.');
  }
  const record = {
    protocolVersion: RED_FLAG_PROTOCOL.version,
    relawanId: user.uid,
    gates,
    status: 't0-suspect',
    timestamp: new Date().toISOString(),
  };

  if (assessment?.relawanId === user.uid && assessment.patient) {
    record.patientNik = assessment.patient.nik;
    const patientName = meaningfulText(assessment.patient.nama);
    if (patientName) record.patientName = patientName;
  }
  const relawanName = meaningfulText(userProfile.name);
  const poskoName = meaningfulText(userProfile.poskoName);
  if (relawanName) record.relawanName = relawanName;
  if (poskoName) record.poskoName = poskoName;
  if (validCoordinates(userProfile.poskoLat, userProfile.poskoLng)) {
    record.lat = userProfile.poskoLat;
    record.lng = userProfile.poskoLng;
  }
  if (typeof note !== 'string') throw new Error('Catatan Red Flag tidak valid.');
  if (note.trim()) record.note = note.trim();

  return emergencyEventSchema.parse(record);
}

export async function saveEmergencyLocally(record) {
  const event = emergencyEventSchema.parse(record);
  return localDb.emergencies.add({ ...event, synced: 0, firestoreId: null });
}

// Keep this boundary explicit: Dexie keys and sync bookkeeping never reach Firestore.
export function serializeEmergencyForFirestore(record) {
  const { id, synced, firestoreId, ...data } = localEmergencySchema.parse(record);
  void id;
  void synced;
  void firestoreId;
  const event = emergencyEventSchema.parse(data);
  const timestamp = Timestamp.fromDate(new Date(event.timestamp));
  return { ...event, timestamp, createdAt: timestamp };
}

async function writeEmergency(id) {
  const current = await localDb.emergencies.get(id);
  if (!current) throw new Error('Red Flag lokal tidak ditemukan.');
  if (current.synced === 1) return current.firestoreId;
  localEmergencySchema.parse(current);

  const allocatedId = current.firestoreId || doc(collection(db, 'emergencies')).id;
  const firestoreId = await localDb.transaction('rw', localDb.emergencies, async () => {
    const latest = await localDb.emergencies.get(id);
    if (!latest) throw new Error('Red Flag lokal tidak ditemukan.');
    if (latest.firestoreId) return latest.firestoreId;
    await localDb.emergencies.update(id, { firestoreId: allocatedId });
    return allocatedId;
  });
  const localEmergency = await localDb.emergencies.get(id);
  if (localEmergency.synced === 1) return firestoreId;
  await setDoc(doc(db, 'emergencies', firestoreId), serializeEmergencyForFirestore(localEmergency));
  await localDb.emergencies.update(id, { synced: 1 });
  return firestoreId;
}

export function pushEmergencyToFirestore(id) {
  if (emergencyWrites.has(id)) return emergencyWrites.get(id);
  const work = writeEmergency(id).finally(() => emergencyWrites.delete(id));
  emergencyWrites.set(id, work);
  return work;
}

export async function syncPendingEmergencies() {
  const pending = await localDb.emergencies.where('synced').equals(0).toArray();
  let synced = 0;
  let failed = 0;
  for (const event of pending) {
    try {
      await pushEmergencyToFirestore(event.id);
      synced++;
    } catch (error) {
      failed++;
      console.error('Gagal sinkronisasi Red Flag:', error);
    }
  }
  return { synced, failed };
}

export async function saveEmergency(input) {
  const id = await saveEmergencyLocally(buildEmergencyRecord(input));
  // The caller can acknowledge the local save immediately, then observe this
  // settled Promise without an unhandled cloud rejection.
  const upload = navigator.onLine
    ? pushEmergencyToFirestore(id).then(() => ({ synced: true })).catch((error) => {
      console.error('Gagal upload Red Flag; rekaman lokal menunggu sinkronisasi:', error);
      return { synced: false };
    })
    : Promise.resolve({ synced: false });
  return { id, upload };
}

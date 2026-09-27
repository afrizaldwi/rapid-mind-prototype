import { Timestamp } from 'firebase/firestore';
import { emergencyEventSchema } from '../schemas/emergencyRecord.js';

// A cloud document may gain independent Faskes metadata. Strip those fields
// only at this read boundary; the Relawan event and local schemas stay strict.
const cloudOriginSchema = emergencyEventSchema.strip();

export function parseEmergencySnapshot(snapshot) {
  if (typeof snapshot?.id !== 'string' || !snapshot.id) {
    throw new Error('ID dokumen emergency tidak valid.');
  }
  const data = snapshot.data();
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Data emergency tidak valid.');
  }
  if (!(data.timestamp instanceof Timestamp)) {
    throw new Error('Timestamp emergency Firestore tidak valid.');
  }
  const time = data.timestamp.toDate();
  if (!Number.isFinite(time.getTime())) {
    throw new Error('Waktu emergency tidak valid.');
  }
  const origin = cloudOriginSchema.parse({ ...data, timestamp: time.toISOString() });
  return { id: snapshot.id, origin };
}

export function collectEmergencyQueue(querySnapshot) {
  const byId = new Map();
  const rejected = [];
  for (const snapshot of querySnapshot.docs) {
    try {
      const emergency = parseEmergencySnapshot(snapshot);
      byId.set(emergency.id, emergency);
    } catch (error) {
      rejected.push({ id: snapshot?.id || '(unknown)', reason: error instanceof Error ? error.message : String(error) });
    }
  }
  const items = [...byId.values()].sort((a, b) =>
    Date.parse(b.origin.timestamp) - Date.parse(a.origin.timestamp) || a.id.localeCompare(b.id));
  return { items, rejected };
}

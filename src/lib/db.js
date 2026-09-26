import Dexie from 'dexie'

export const localDb = new Dexie('RapidMindDB')

localDb.version(1).stores({
  cases: '++localId, firestoreId, synced, timestamp, zona, poskoName, relawanId',
  pendingSync: '++id, caseLocalId, action, createdAt'
})

localDb.version(2).stores({
  cases: '++localId, firestoreId, synced, timestamp, zona, poskoName, relawanId, patientNik, tier',
  patients: '++id, nik, nama, poskoName, registeredAt',
  emergencies: '++id, patientNik, relawanId, status, timestamp, synced',
  pendingSync: null // cleanup unused table
})

export default localDb

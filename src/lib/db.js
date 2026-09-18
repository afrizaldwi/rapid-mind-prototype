import Dexie from 'dexie'

export const localDb = new Dexie('RapidMindDB')

localDb.version(1).stores({
  cases: '++localId, firestoreId, synced, timestamp, zona, poskoName, relawanId',
  pendingSync: '++id, caseLocalId, action, createdAt'
})

export default localDb

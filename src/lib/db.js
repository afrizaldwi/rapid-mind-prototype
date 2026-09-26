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

const validNik = (nik) => typeof nik === 'string' && /^\d{16}$/.test(nik)
const normalized = (value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID') : ''
const materiallyDifferent = (rows, field) =>
  new Set(rows.map((row) => normalized(row[field])).filter(Boolean)).size > 1

// v3 cleans legacy rows before v4 installs the unique NIK index. The upgrade is
// transactional: if any audit copy or deletion fails, IndexedDB retains v2.
localDb.version(3).stores({
  cases: '++localId, firestoreId, synced, timestamp, zona, poskoName, relawanId, patientNik, tier',
  patients: '++id, nik, nama, poskoName, registeredAt, syncStatus',
  emergencies: '++id, patientNik, relawanId, status, timestamp, synced',
  patientConflicts: '++auditId, nik, status, reason, originalId'
}).upgrade(async (tx) => {
  const patients = tx.table('patients')
  const audit = tx.table('patientConflicts')
  const rows = await patients.toArray()
  const groups = new Map()

  for (const row of rows) {
    if (!validNik(row.nik)) {
      await audit.add({ nik: row.nik ?? null, status: 'unresolved', reason: 'invalid-nik', originalId: row.id, originalRecord: row })
      await patients.delete(row.id)
      continue
    }
    const group = groups.get(row.nik) || []
    group.push(row)
    groups.set(row.nik, group)
  }

  for (const [nik, group] of groups) {
    if (group.length === 1) {
      await patients.update(group[0].id, { syncStatus: 'pending' })
      continue
    }

    const conflicting = materiallyDifferent(group, 'nama') || materiallyDifferent(group, 'jenisKelamin')
    const bySurvivorOrder = [...group].sort((a, b) => {
      const aTime = Date.parse(a.registeredAt)
      const bTime = Date.parse(b.registeredAt)
      const first = (Number.isFinite(aTime) ? aTime : Infinity) - (Number.isFinite(bTime) ? bTime : Infinity)
      return Number.isNaN(first) || first === 0 ? a.id - b.id : first
    })
    for (const row of group) {
      await audit.add({ nik, status: conflicting ? 'unresolved' : 'resolved', reason: conflicting ? 'duplicate-identity' : 'equivalent-duplicate', originalId: row.id, originalRecord: row })
      if (conflicting || row.id !== bySurvivorOrder[0].id) await patients.delete(row.id)
    }
    if (!conflicting) await patients.update(bySurvivorOrder[0].id, { syncStatus: 'pending' })
  }
})

localDb.version(4).stores({
  cases: '++localId, firestoreId, synced, timestamp, zona, poskoName, relawanId, patientNik, tier',
  patients: '++id, &nik, nama, poskoName, registeredAt, syncStatus',
  emergencies: '++id, patientNik, relawanId, status, timestamp, synced',
  patientConflicts: '++auditId, nik, status, reason, originalId'
})

export default localDb

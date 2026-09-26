import {
  collection, doc, getDocFromServer, getDocsFromServer, query,
  runTransaction, serverTimestamp, where,
} from 'firebase/firestore'
import localDb from './db'
import { db } from './firebase'

const isNik = (nik) => typeof nik === 'string' && /^\d{16}$/.test(nik)
const patientFields = ['nama', 'usia', 'jenisKelamin', 'poskoName', 'registeredAt', 'lastPhase', 'pfaCompleted', 'registeredBy']

export class PatientConflictError extends Error {
  constructor(message, reason = 'data-integrity') {
    super(message)
    this.name = 'PatientConflictError'
    this.reason = reason
  }
}

function cleanPatient(source, nik, fallback = {}) {
  const result = { nik }
  for (const field of patientFields) {
    let value = source[field] ?? fallback[field]
    if (field === 'registeredAt' && value?.toDate) value = value.toDate().toISOString()
    if (field === 'usia' && typeof value === 'string' && /^\d+$/.test(value)) value = Number(value)
    if (value !== undefined && value !== null && typeof value !== 'object') result[field] = value
  }
  return result
}

async function unresolvedLocalConflict(nik) {
  return localDb.patientConflicts.where('nik').equals(nik).and((row) => row.status === 'unresolved').first()
}

async function conflictState(nik) {
  const [patient, records] = await Promise.all([
    localDb.patients.where('nik').equals(nik).first(),
    localDb.patientConflicts.where('nik').equals(nik).and((row) => row.status === 'unresolved').toArray(),
  ])
  return {
    patient,
    localConflict: records.some((row) => row.reason !== 'cloud-duplicate'),
    // Older Phase 0B records marked the active patient but did not save a reason.
    cloudDuplicate: records.some((row) => row.reason === 'cloud-duplicate') || patient?.syncStatus === 'conflict',
  }
}

export async function findLocalPatientByNik(nik) {
  if (!isNik(nik)) throw new Error('NIK harus 16 digit angka.')
  if (await unresolvedLocalConflict(nik)) throw new PatientConflictError('NIK ini memiliki konflik data pasien lokal yang perlu ditinjau.')
  const patient = await localDb.patients.where('nik').equals(nik).first()
  if (patient?.syncStatus === 'conflict') throw new PatientConflictError('NIK ini memiliki duplikasi data pasien di cloud yang perlu ditinjau.')
  return patient || null
}

// Both reads must come from the server. An unreachable server is never absence.
export async function findCloudPatientByNik(nik) {
  if (!isNik(nik)) throw new Error('NIK harus 16 digit angka.')
  const canonicalRef = doc(db, 'patients', nik)
  const canonical = await getDocFromServer(canonicalRef)
  const matches = await getDocsFromServer(query(collection(db, 'patients'), where('nik', '==', nik)))
  const distinct = new Map(matches.docs.map((snapshot) => [snapshot.id, snapshot]))
  if (canonical.exists()) {
    if (canonical.data().nik && canonical.data().nik !== nik) {
      throw new PatientConflictError('Dokumen pasien canonical memiliki NIK yang berbeda.', 'canonical-nik-mismatch')
    }
    distinct.set(canonical.id, canonical)
  }
  if (distinct.size > 1) throw new PatientConflictError('Ada lebih dari satu dokumen cloud untuk NIK ini.', 'cloud-duplicate')
  const single = [...distinct.values()][0]
  return single ? { documentId: single.id, patient: cleanPatient(single.data(), nik) } : null
}

async function markCloudConflict(nik) {
  await localDb.transaction('rw', localDb.patients, localDb.patientConflicts, async () => {
    const patient = await localDb.patients.where('nik').equals(nik).first()
    if (patient) await localDb.patients.update(patient.id, { syncStatus: 'conflict' })
    const existing = await localDb.patientConflicts.where('nik').equals(nik)
      .and((row) => row.status === 'unresolved' && row.reason === 'cloud-duplicate').first()
    if (!existing) await localDb.patientConflicts.add({
      nik, status: 'unresolved', reason: 'cloud-duplicate', originalId: patient?.id ?? null, originalRecord: null,
    })
  })
}

async function cacheCloudPatient(nik, cloudPatient, resolveDuplicate = false) {
  return localDb.transaction('rw', localDb.patients, localDb.patientConflicts, async () => {
    const unresolved = await localDb.patientConflicts.where('nik').equals(nik)
      .and((row) => row.status === 'unresolved').toArray()
    if (unresolved.some((row) => row.reason !== 'cloud-duplicate')) {
      throw new PatientConflictError('NIK ini memiliki konflik data pasien lokal yang perlu ditinjau.')
    }
    if (unresolved.length && !resolveDuplicate) {
      throw new PatientConflictError('NIK ini memiliki duplikasi data pasien di cloud yang perlu ditinjau.', 'cloud-duplicate')
    }
    const current = await localDb.patients.where('nik').equals(nik).first()
    const cached = cleanPatient(cloudPatient, nik, current || {})
    if (resolveDuplicate) {
      if (current?.syncStatus === 'conflict' && unresolved.length === 0) {
        await localDb.patientConflicts.add({
          nik, status: 'resolved', reason: 'cloud-duplicate', originalId: current.id, originalRecord: null,
        })
      }
      for (const row of unresolved) {
        await localDb.patientConflicts.update(row.auditId, { status: 'resolved' })
      }
    }
    if (current) {
      const changed = patientFields.some((field) => current[field] !== cached[field])
      if (changed) {
        await localDb.patientConflicts.add({
          nik, status: 'resolved', reason: 'cloud-profile-reconciliation',
          originalId: current.id, originalRecord: current,
        })
      }
      await localDb.patients.update(current.id, { ...cached, syncStatus: 'synced' })
      return { ...current, ...cached, syncStatus: 'synced' }
    }
    const id = await localDb.patients.add({ ...cached, syncStatus: 'synced' })
    return { id, ...cached, syncStatus: 'synced' }
  })
}

export async function lookupPatient(nik, online) {
  if (!isNik(nik)) throw new Error('NIK harus 16 digit angka.')
  const state = await conflictState(nik)
  if (state.localConflict) throw new PatientConflictError('NIK ini memiliki konflik data pasien lokal yang perlu ditinjau.')
  const local = state.patient
  if (state.cloudDuplicate) {
    if (!online) throw new PatientConflictError('Duplikasi NIK cloud perlu diperiksa ulang saat online.', 'cloud-duplicate')
    let cloud
    try {
      cloud = await findCloudPatientByNik(nik)
    } catch (error) {
      if (error instanceof PatientConflictError && error.reason === 'cloud-duplicate') await markCloudConflict(nik)
      throw error
    }
    if (!cloud) {
      await markCloudConflict(nik)
      throw new PatientConflictError('Riwayat duplikasi NIK cloud belum dapat diselesaikan karena tidak ada dokumen pasien. Perlu peninjauan data.', 'cloud-duplicate')
    }
    return { patient: await cacheCloudPatient(nik, cloud.patient, true), source: 'firestore' }
  }
  if (!online) return local ? { patient: local, source: 'local' } : null

  try {
    const cloud = await findCloudPatientByNik(nik)
    if (cloud) return { patient: await cacheCloudPatient(nik, cloud.patient), source: local ? 'local' : 'firestore' }
    if (local) {
      if (local.syncStatus === 'synced') await localDb.patients.update(local.id, { syncStatus: 'pending' })
      return { patient: { ...local, syncStatus: 'pending' }, source: 'local' }
    }
    return null
  } catch (error) {
    if (error instanceof PatientConflictError && error.reason === 'cloud-duplicate') {
      await markCloudConflict(nik)
      throw error
    }
    if (error instanceof PatientConflictError) throw error
    // A local record remains usable when Firebase is unreachable. A local miss
    // must fail lookup instead of showing a misleading new-patient form.
    if (local) return { patient: local, source: 'local' }
    throw error
  }
}

export async function registerPatientLocally(data) {
  if (!isNik(data.nik)) throw new Error('NIK harus 16 digit angka.')
  if (await unresolvedLocalConflict(data.nik)) throw new PatientConflictError('NIK ini memiliki konflik data pasien lokal yang perlu ditinjau.')
  const existing = await findLocalPatientByNik(data.nik)
  if (existing) return { patient: existing, alreadyExists: true }
  const record = { ...cleanPatient(data, data.nik), syncStatus: 'pending' }
  try {
    const id = await localDb.patients.add(record)
    return { patient: { id, ...record }, alreadyExists: false }
  } catch (error) {
    if (error.name !== 'ConstraintError') throw error
    const raced = await findLocalPatientByNik(data.nik)
    if (!raced) throw error
    return { patient: raced, alreadyExists: true }
  }
}

export async function pushPatientToFirestore(nik) {
  const local = await findLocalPatientByNik(nik)
  if (!local) throw new Error('Pasien lokal tidak ditemukan.')
  if (local.syncStatus === 'synced') return { patient: local, existing: true }

  let cloud
  try {
    cloud = await findCloudPatientByNik(nik)
  } catch (error) {
    if (error instanceof PatientConflictError && error.reason === 'cloud-duplicate') await markCloudConflict(nik)
    throw error
  }
  if (cloud) return { patient: await cacheCloudPatient(nik, cloud.patient), existing: true }

  const ref = doc(db, 'patients', nik)
  const data = cleanPatient(local, nik)
  const created = await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref)
    if (existing.exists()) return false
    transaction.set(ref, { ...data, createdAt: serverTimestamp() })
    return true
  })
  // Recheck after the write to detect a legacy addDoc race from an older client.
  try {
    cloud = await findCloudPatientByNik(nik)
  } catch (error) {
    if (error instanceof PatientConflictError && error.reason === 'cloud-duplicate') await markCloudConflict(nik)
    throw error
  }
  if (!cloud) throw new Error('Dokumen pasien belum terkonfirmasi di server.')
  return { patient: await cacheCloudPatient(nik, cloud.patient), existing: !created }
}

export async function registerPatient(data, online) {
  const { patient, alreadyExists } = await registerPatientLocally(data)
  if (alreadyExists) return { patient, existing: true, pending: patient.syncStatus === 'pending' }
  if (!online) return { patient, existing: false, pending: true }
  try {
    const result = await pushPatientToFirestore(data.nik)
    return { ...result, pending: false }
  } catch (error) {
    if (error instanceof PatientConflictError) throw error
    return { patient, existing: false, pending: true }
  }
}

export async function syncPendingPatients() {
  const pending = await localDb.patients.where('syncStatus').equals('pending').toArray()
  let synced = 0
  let failed = 0
  let conflicts = 0
  for (const patient of pending) {
    try {
      await pushPatientToFirestore(patient.nik)
      synced++
    } catch (error) {
      if (error instanceof PatientConflictError) conflicts++
      else failed++
      console.error('Gagal sinkronisasi pasien:', error)
    }
  }
  return { synced, failed, conflicts }
}

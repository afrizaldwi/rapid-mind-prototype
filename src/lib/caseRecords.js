import { pfaCaseRecordSchema, srq20CaseRecordSchema } from '../schemas/caseRecord.js'

const LEGACY_ZONES = new Set(['merah', 'kuning', 'hijau'])

function normalizedZone(value) {
  if (typeof value !== 'string') return null
  const zone = value.trim().toLowerCase()
  return LEGACY_ZONES.has(zone) ? zone : null
}

export function getLegacyZone(record) {
  if (!record || (record.recordType != null && record.recordType !== 'legacy-triage')) return null
  const zona = normalizedZone(record.zona)
  const triageResult = normalizedZone(record.triageResult)
  if (zona && triageResult && zona !== triageResult) return null
  return zona || triageResult
}

export function getCaseRecordType(record) {
  if (!record || typeof record !== 'object') return 'unknown'
  if (record.recordType == null || record.recordType === 'legacy-triage') {
    return getLegacyZone(record) ? 'legacy-triage' : 'unknown'
  }
  if (record.recordType === 'pfa' && pfaCaseRecordSchema.safeParse(record).success) return 'pfa'
  if (record.recordType === 'srq20' && srq20CaseRecordSchema.safeParse(record).success) return 'srq20'
  return 'unknown'
}

export function validateCaseForSave(record) {
  const recordType = getCaseRecordType(record)
  if (recordType === 'unknown') {
    if (record?.recordType === 'pfa') throw new Error('Struktur catatan PFA tidak valid.')
    if (record?.recordType === 'srq20') throw new Error('Struktur catatan SRQ-20 tidak valid.')
    throw new Error('Jenis atau zona catatan asesmen tidak valid.')
  }
  if (record.patientNik != null && !/^\d{16}$/.test(record.patientNik)) {
    throw new Error('NIK pasien pada catatan asesmen tidak valid.')
  }
}

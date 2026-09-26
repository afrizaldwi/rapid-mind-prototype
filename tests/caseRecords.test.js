import { describe, expect, it } from 'vitest'
import { getCaseRecordType, getLegacyZone, validateCaseForSave } from '../src/lib/caseRecords.js'
import { pfaCaseRecordSchema, srq20CaseRecordSchema } from '../src/schemas/caseRecord.js'

const pfa = () => ({
  recordType: 'pfa',
  protocolVersion: 'demo-v1',
  patientNik: '3201234567890001',
  relawanId: 'relawan-123',
  phase: 'akut',
  responses: { 'look-1': true, 'listen-1': 'Runtime value', 'link-1': false },
})

describe('case record classification and save validation', () => {
  it('recognizes explicit and old untyped legacy zones', () => {
    expect(getCaseRecordType({ recordType: 'legacy-triage', zona: 'merah' })).toBe('legacy-triage')
    expect(getCaseRecordType({ zona: 'kuning' })).toBe('legacy-triage')
    expect(getLegacyZone({ triageResult: 'HIJAU' })).toBe('hijau')
    expect(getCaseRecordType({ triageResult: 'HIJAU' })).toBe('legacy-triage')
  })

  it('fails closed for missing, invalid, or conflicting legacy zones', () => {
    for (const record of [{}, { zona: 'blue' }, { zona: 'merah', triageResult: 'HIJAU' }]) {
      expect(getLegacyZone(record)).toBeNull()
      expect(getCaseRecordType(record)).toBe('unknown')
      expect(() => validateCaseForSave(record)).toThrow()
    }
  })

  it('accepts valid PFA and optional snapshot metadata without narrowing it', () => {
    const record = { ...pfa(), patientName: 'Siti', relawanName: 'Rina', poskoName: 'Posko A', poskoLat: 0, poskoLng: 106 }
    expect(getCaseRecordType(record)).toBe('pfa')
    expect(() => validateCaseForSave(record)).not.toThrow()
    expect(pfaCaseRecordSchema.safeParse(record).data).toMatchObject(record)
    expect(getCaseRecordType(pfa())).toBe('pfa')
  })

  it.each([
    ['wrong phase', { phase: 'lanjutan' }],
    ['invalid NIK', { patientNik: '123' }],
    ['missing relawan ID', { relawanId: undefined }],
    ['empty relawan ID', { relawanId: '' }],
    ['missing protocol version', { protocolVersion: undefined }],
    ['empty protocol version', { protocolVersion: '' }],
    ['empty responses', { responses: {} }],
    ['nested response', { responses: { 'look-1': { value: true } } }],
    ['NaN response', { responses: { 'look-1': NaN } }],
    ['infinite response', { responses: { 'look-1': Infinity } }],
    ['zona', { zona: 'hijau' }],
    ['triageResult', { triageResult: 'HIJAU' }],
    ['undefined zona', { zona: undefined }],
    ['undefined triageResult', { triageResult: undefined }],
  ])('rejects PFA with %s', (_name, change) => {
    const record = { ...pfa(), ...change }
    expect(getCaseRecordType(record)).toBe('unknown')
    expect(() => validateCaseForSave(record)).toThrow()
  })

  it.each([
    ['leading protocol whitespace', { protocolVersion: ' demo-v1' }],
    ['trailing protocol whitespace', { protocolVersion: 'demo-v1 ' }],
    ['blank protocol version', { protocolVersion: '   ' }],
    ['relawan whitespace', { relawanId: ' relawan-123 ' }],
    ['leading response key whitespace', { responses: { ' look-1': true } }],
    ['trailing response key whitespace', { responses: { 'look-1 ': true } }],
    ['blank response key', { responses: { '   ': true } }],
  ])('requires canonical identifiers: %s', (_name, change) => {
    const record = { ...pfa(), ...change }
    expect(getCaseRecordType(record)).toBe('unknown')
    expect(() => validateCaseForSave(record)).toThrow()
  })

  it('accepts every approved scalar, including zero, false, and untrimmed answer text', () => {
    const responses = { 'item-1': 0, 'item-2': false, 'item-3': null, 'item-4': '', 'item-5': '  original free text  ' }
    const record = { ...pfa(), responses }
    expect(getCaseRecordType(record)).toBe('pfa')
    expect(pfaCaseRecordSchema.safeParse(record).data.responses).toEqual(responses)
  })

  it('reserves only the Phase 1A SRQ-20 structure', () => {
    const record = { ...pfa(), recordType: 'srq20', phase: 'lanjutan' }
    expect(getCaseRecordType(record)).toBe('srq20')
    expect(srq20CaseRecordSchema.safeParse(record).success).toBe(true)
    expect(() => validateCaseForSave(record)).not.toThrow()
    expect(getCaseRecordType({ ...record, phase: 'akut' })).toBe('unknown')
  })

  it('rejects an invalid supplied NIK even on a valid legacy zone', () => {
    expect(() => validateCaseForSave({ zona: 'merah', patientNik: '123' })).toThrow()
  })
})

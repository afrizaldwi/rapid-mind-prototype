import { describe, expect, it } from 'vitest'
import { getCaseRecordType, getLegacyZone, validateCaseForSave } from '../src/lib/caseRecords.js'
import { pfaCaseRecordSchema, srq20CaseRecordSchema } from '../src/schemas/caseRecord.js'
import { SRQ20_PROTOCOL } from '../src/protocols/srq20Protocol.js'
import { RISK_FUNCTION_PROTOCOL } from '../src/protocols/riskFunctionProtocol.js'
import { CLASSIFICATION_VERSION } from '../src/lib/classification.js'

const pfa = () => ({
  recordType: 'pfa',
  protocolVersion: 'demo-v1',
  patientNik: '3201234567890001',
  relawanId: 'relawan-123',
  phase: 'akut',
  responses: { 'look-1': true, 'listen-1': 'Runtime value', 'link-1': false },
})

const srq20 = () => ({
  recordType: 'srq20',
  phase: 'lanjutan',
  protocolVersion: SRQ20_PROTOCOL.version,
  responses: Object.fromEntries(SRQ20_PROTOCOL.items.map(({ id }, index) => [id, index < 6])),
  patientNik: '3201234567890001',
  relawanId: 'relawan-123',
  inputMode: 'nonverbal',
  srq20Score: 6,
  baseTier: 'T2',
  riskFunctionProtocolVersion: RISK_FUNCTION_PROTOCOL.version,
  riskFactors: Object.fromEntries(RISK_FUNCTION_PROTOCOL.sections[0].items.map(({ id }) => [id, false])),
  functionalImpairment: Object.fromEntries(RISK_FUNCTION_PROTOCOL.sections[1].items.map(({ id }) => [id, false])),
  classificationVersion: CLASSIFICATION_VERSION,
  tier: 'T2',
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

  it('recognizes only a completed and internally consistent SRQ-20 case', () => {
    const record = srq20()
    expect(getCaseRecordType(record)).toBe('srq20')
    expect(srq20CaseRecordSchema.safeParse(record).success).toBe(true)
    expect(() => validateCaseForSave(record)).not.toThrow()
    expect(getCaseRecordType({ ...record, phase: 'akut' })).toBe('unknown')
  })

  it.each([
    ['missing score', { srq20Score: undefined }],
    ['bad score type', { srq20Score: '6' }],
    ['score outside range', { srq20Score: 21 }],
    ['score mismatch', { srq20Score: 5 }],
    ['wrong base tier', { baseTier: 'T3' }],
    ['invalid tier', { tier: 'T0' }],
    ['v1 final tier mismatch', { tier: 'T1' }],
    ['invalid input mode', { inputMode: 'audio' }],
    ['missing Risk/Function version', { riskFunctionProtocolVersion: undefined }],
    ['missing classification version', { classificationVersion: undefined }],
    ['missing risk factors', { riskFactors: undefined }],
    ['missing function data', { functionalImpairment: undefined }],
    ['incomplete SRQ', { responses: { 'srq20.01': true } }],
    ['unknown SRQ ID', { responses: { ...srq20().responses, 'srq20.21': false } }],
    ['wrong SRQ type', { responses: { ...srq20().responses, 'srq20.01': 'true' } }],
    ['incomplete risk', { riskFactors: {} }],
    ['unknown function ID', { functionalImpairment: { ...srq20().functionalImpairment, 'function.05': false } }],
    ['unsupported SRQ version', { protocolVersion: 'srq20-prototype-v2' }],
    ['unsupported Risk/Function version', { riskFunctionProtocolVersion: 'risk-function-prototype-v2' }],
    ['unsupported classification version', { classificationVersion: 'classification-prototype-v2' }],
    ['acute phase', { phase: 'akut' }],
    ['legacy zona', { zona: 'hijau' }],
    ['legacy triageResult', { triageResult: 'HIJAU' }],
  ])('rejects an SRQ-20 record with %s', (_name, change) => {
    const record = { ...srq20(), ...change }
    expect(getCaseRecordType(record)).toBe('unknown')
    expect(() => validateCaseForSave(record)).toThrow()
  })

  it('rejects an invalid supplied NIK even on a valid legacy zone', () => {
    expect(() => validateCaseForSave({ zona: 'merah', patientNik: '123' })).toThrow()
  })
})

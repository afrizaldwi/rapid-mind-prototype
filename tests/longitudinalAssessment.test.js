import { describe, expect, it, vi } from 'vitest';
import { SRQ20_PROTOCOL } from '../src/protocols/srq20Protocol.js';
import { RISK_FUNCTION_PROTOCOL } from '../src/protocols/riskFunctionProtocol.js';
import {
  LONGITUDINAL_DRAFT_KEY, clearLongitudinalDraft, loadLongitudinalDraft,
  restoreLongitudinalDraft, saveLongitudinalDraft,
} from '../src/lib/longitudinalAssessment.js';

const uid = 'relawan-123';
const assessment = {
  relawanId: uid,
  patient: { nik: '3201234567890001', nama: 'Siti', usia: 34, jenisKelamin: 'P', poskoName: 'Posko A' },
  phase: 'lanjutan', previousHistory: [], isNewPatient: false,
  startedAt: '2026-09-27T10:00:00.000Z',
};
const draft = (change = {}) => ({
  relawanId: uid,
  patientNik: assessment.patient.nik,
  assessmentStartedAt: assessment.startedAt,
  srqProtocolVersion: SRQ20_PROTOCOL.version,
  riskFunctionProtocolVersion: RISK_FUNCTION_PROTOCOL.version,
  inputMode: 'verbal',
  currentStep: 'srq20',
  srqResponses: { 'srq20.01': false },
  riskFactors: { 'risk.01': false },
  functionalImpairment: { 'function.01': true },
  ...change,
});

describe('longitudinal draft binding', () => {
  it('restores valid partial Screen 5 and Screen 6 progress for the same session', () => {
    expect(restoreLongitudinalDraft(draft(), assessment, uid)).toEqual(draft());
    expect(restoreLongitudinalDraft(draft({ inputMode: 'nonverbal', currentStep: 'risk-function' }), assessment, uid))
      .toEqual(draft({ inputMode: 'nonverbal', currentStep: 'risk-function' }));
  });

  it.each([
    ['wrong draft Relawan', { relawanId: 'other' }],
    ['wrong patient NIK', { patientNik: '3201234567890002' }],
    ['wrong assessment start', { assessmentStartedAt: '2026-09-27T11:00:00.000Z' }],
    ['wrong SRQ protocol', { srqProtocolVersion: 'srq20-prototype-v2' }],
    ['wrong Risk/Function protocol', { riskFunctionProtocolVersion: 'risk-function-prototype-v2' }],
    ['unknown current step', { currentStep: 'result' }],
    ['unknown input mode', { inputMode: 'audio' }],
    ['bad SRQ response', { srqResponses: { 'srq20.01': 'false' } }],
    ['unknown SRQ ID', { srqResponses: { 'srq20.21': true } }],
    ['bad Risk Factor response', { riskFactors: { 'risk.01': 1 } }],
    ['bad Gangguan Fungsi response', { functionalImpairment: { 'function.01': null } }],
    ['unknown Risk Factor ID', { riskFactors: { 'risk.05': false } }],
    ['unknown Gangguan Fungsi ID', { functionalImpairment: { 'function.05': false } }],
    ['forbidden transcript payload', { transcript: 'example' }],
  ])('rejects %s', (_name, change) => {
    expect(restoreLongitudinalDraft(draft(change), assessment, uid)).toBeNull();
  });

  it('rejects absent or malformed context, wrong phase, and UID mismatch', () => {
    expect(restoreLongitudinalDraft(draft(), null, uid)).toBeNull();
    expect(restoreLongitudinalDraft(draft(), { ...assessment, phase: 'akut' }, uid)).toBeNull();
    expect(restoreLongitudinalDraft(draft(), assessment, null)).toBeNull();
    expect(restoreLongitudinalDraft(draft(), assessment, 'other')).toBeNull();
    expect(restoreLongitudinalDraft(draft(), { ...assessment, relawanId: 'other' }, uid)).toBeNull();
  });
});

describe('defensive sessionStorage draft helpers', () => {
  it('saves a bound normalized draft, restores it, and clears only its key', () => {
    const rows = new Map();
    const storage = {
      setItem: vi.fn((key, value) => rows.set(key, value)),
      getItem: vi.fn((key) => rows.get(key) ?? null),
      removeItem: vi.fn((key) => rows.delete(key)),
    };
    vi.stubGlobal('sessionStorage', storage);
    try {
      const { inputMode, currentStep, srqResponses, riskFactors, functionalImpairment } = draft();
      expect(saveLongitudinalDraft({ inputMode, currentStep, srqResponses, riskFactors, functionalImpairment }, assessment, uid)).toBe(true);
      expect(JSON.parse(rows.get(LONGITUDINAL_DRAFT_KEY))).toEqual(draft());
      expect(loadLongitudinalDraft(assessment, uid)).toEqual(draft());
      clearLongitudinalDraft();
      expect(storage.removeItem).toHaveBeenLastCalledWith(LONGITUDINAL_DRAFT_KEY);
      expect(loadLongitudinalDraft(assessment, uid)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects invalid saves and removes malformed or mismatched stored drafts', () => {
    const rows = new Map([[LONGITUDINAL_DRAFT_KEY, '{bad json']]);
    vi.stubGlobal('sessionStorage', {
      getItem: (key) => rows.get(key) ?? null,
      setItem: (key, value) => rows.set(key, value),
      removeItem: (key) => rows.delete(key),
    });
    try {
      expect(loadLongitudinalDraft(assessment, uid)).toBeNull();
      expect(rows.has(LONGITUDINAL_DRAFT_KEY)).toBe(false);
      rows.set(LONGITUDINAL_DRAFT_KEY, JSON.stringify(draft({ patientNik: '3201234567890002' })));
      expect(loadLongitudinalDraft(assessment, uid)).toBeNull();
      expect(rows.has(LONGITUDINAL_DRAFT_KEY)).toBe(false);
      expect(() => saveLongitudinalDraft({ inputMode: 'invalid' }, assessment, uid)).toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('handles unavailable browser storage without trusting or losing validation', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('unavailable'); },
      setItem: () => { throw new Error('unavailable'); },
      removeItem: () => { throw new Error('unavailable'); },
    });
    try {
      expect(loadLongitudinalDraft(assessment, uid)).toBeNull();
      expect(saveLongitudinalDraft(draft(), assessment, uid)).toBe(false);
      expect(() => clearLongitudinalDraft()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

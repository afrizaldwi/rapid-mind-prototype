import { describe, expect, it, vi } from 'vitest';
import { PFA_PROTOCOL } from '../src/protocols/pfaProtocol.js';
import { PFA_DRAFT_KEY, buildPfaCaseRecord, clearPfaDraft, getPfaProgressState, hasCompletedPfa, restorePfaDraft, validatePfaResponses } from '../src/lib/pfa.js';
import { validateCaseForSave } from '../src/lib/caseRecords.js';
import { pfaCaseRecordSchema } from '../src/schemas/caseRecord.js';

const assessment = {
  startedAt: '2026-09-26T10:00:00.000Z',
  relawanId: 'relawan-123',
  phase: 'akut',
  patient: {
    nik: '3201234567890001',
    nama: 'Siti Aminah',
    usia: 34,
    jenisKelamin: 'P',
    poskoName: 'Posko Utama - Kota',
  },
};
const user = { uid: 'relawan-123' };
const completeResponses = () => Object.fromEntries(
  PFA_PROTOCOL.sections.flatMap((section) => section.items)
    .filter((item) => item.required)
    .map((item) => [item.id, false]),
);
const draft = (overrides = {}) => ({
  assessmentStartedAt: assessment.startedAt,
  patientNik: assessment.patient.nik,
  protocolVersion: PFA_PROTOCOL.version,
  currentSection: 'listen',
  responses: { 'look.safety_checked': false },
  ...overrides,
});

describe('provisional PFA protocol', () => {
  it('has one canonical version and ordered, unique LOOK/LISTEN/LINK sections', () => {
    expect(PFA_PROTOCOL.version).toBe('pfa-prototype-v1');
    expect(PFA_PROTOCOL.sections.map((section) => section.id)).toEqual(['look', 'listen', 'link']);
    expect(new Set(PFA_PROTOCOL.sections.map((section) => section.id)).size).toBe(3);
  });

  it('uses globally unique semantic item IDs independent from labels', () => {
    const items = PFA_PROTOCOL.sections.flatMap((section) =>
      section.items.map((item) => ({ ...item, sectionId: section.id })));
    expect(items).toHaveLength(10);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    for (const item of items) {
      expect(item.id).toMatch(/^(look|listen|link)\.[a-z][a-z0-9_]*$/);
      expect(item.id.startsWith(`${item.sectionId}.`)).toBe(true);
      expect(item.label.trim()).not.toBe('');
      expect(['boolean', 'text']).toContain(item.type);
      expect(typeof item.required).toBe('boolean');
    }
  });
});

describe('PFA response validation', () => {
  it('rejects missing required answers and accepts explicit false', () => {
    const missing = validatePfaResponses(PFA_PROTOCOL, {});
    expect(missing.valid).toBe(false);
    expect(missing.errors['look.safety_checked']).toBeTruthy();
    const complete = validatePfaResponses(PFA_PROTOCOL, completeResponses());
    expect(complete.valid).toBe(true);
    expect(complete.normalizedResponses['look.safety_checked']).toBe(false);
  });

  it('validates only the current section when advancing', () => {
    const look = Object.fromEntries(PFA_PROTOCOL.sections[0].items.map((item) => [item.id, false]));
    expect(validatePfaResponses(PFA_PROTOCOL, look, { sectionId: 'look' }).valid).toBe(true);
    expect(validatePfaResponses(PFA_PROTOCOL, look).valid).toBe(false);
  });

  it('rejects an unknown section ID', () => {
    const result = validatePfaResponses(PFA_PROTOCOL, {}, { sectionId: 'unknown' });
    expect(result.valid).toBe(false);
    expect(result.errors._section).toBeTruthy();
  });

  it('allows absent optional text and omits blank optional text', () => {
    const responses = completeResponses();
    expect(validatePfaResponses(PFA_PROTOCOL, responses).valid).toBe(true);
    responses['link.notes'] = '   ';
    responses['listen.priority_concern'] = '  Perlu tempat istirahat  ';
    const result = validatePfaResponses(PFA_PROTOCOL, responses);
    expect(result.valid).toBe(true);
    expect(result.normalizedResponses).not.toHaveProperty('link.notes');
    expect(result.normalizedResponses['listen.priority_concern']).toBe('Perlu tempat istirahat');
  });

  it('requires meaningful text if a future protocol marks it required', () => {
    const protocol = {
      ...PFA_PROTOCOL,
      sections: PFA_PROTOCOL.sections.map((section) => section.id === 'listen'
        ? { ...section, items: section.items.map((item) => item.id === 'listen.priority_concern' ? { ...item, required: true } : item) }
        : section),
    };
    expect(validatePfaResponses(protocol, { ...completeResponses(), 'listen.priority_concern': '   ' }).valid).toBe(false);
    expect(validatePfaResponses(protocol, { ...completeResponses(), 'listen.priority_concern': 'Butuh air' }).valid).toBe(true);
  });

  it('rejects unknown IDs and answer types, including scalar types from the wider case schema', () => {
    for (const responses of [
      { ...completeResponses(), 'look.unknown': true },
      { ...completeResponses(), 'look.safety_checked': 'false' },
      { ...completeResponses(), 'link.notes': null },
      { ...completeResponses(), 'link.notes': ['text'] },
      { ...completeResponses(), 'link.notes': 3 },
      JSON.parse('{"__proto__":true}'),
    ]) {
      expect(validatePfaResponses(PFA_PROTOCOL, responses).valid).toBe(false);
    }
  });
});

describe('PFA draft binding', () => {
  it('restores an incomplete, valid draft without requiring completion', () => {
    expect(restorePfaDraft(draft(), assessment, PFA_PROTOCOL)).toEqual(draft());
  });

  it.each([
    ['different patient', { patientNik: '3201234567890002' }],
    ['different assessment session', { assessmentStartedAt: '2026-09-26T11:00:00.000Z' }],
    ['older protocol', { protocolVersion: 'pfa-prototype-v0' }],
    ['unknown section', { currentSection: 'other' }],
    ['unknown item ID', { responses: { 'look.unknown': true } }],
    ['wrong answer type', { responses: { 'look.safety_checked': 'yes' } }],
    ['invalid response container', { responses: [] }],
  ])('discards the entire draft with %s', (_name, change) => {
    expect(restorePfaDraft(draft(change), assessment, PFA_PROTOCOL)).toBeNull();
  });

  it('rejects a draft for a non-acute assessment', () => {
    expect(restorePfaDraft(draft(), { ...assessment, phase: 'lanjutan' }, PFA_PROTOCOL)).toBeNull();
  });
});

describe('completed PFA case construction', () => {
  it('builds a Phase 1A-valid typed record with stable-ID responses and snapshots', () => {
    const record = buildPfaCaseRecord(PFA_PROTOCOL, assessment, user, { name: 'Rina' }, completeResponses());
    expect(record).toMatchObject({
      recordType: 'pfa',
      protocolVersion: PFA_PROTOCOL.version,
      patientNik: assessment.patient.nik,
      relawanId: user.uid,
      phase: 'akut',
      patientName: 'Siti Aminah',
      patientAge: 34,
      patientGender: 'P',
      poskoName: assessment.patient.poskoName,
      relawanName: 'Rina',
      responses: completeResponses(),
    });
    expect(pfaCaseRecordSchema.safeParse(record).success).toBe(true);
    expect(() => validateCaseForSave(record)).not.toThrow();
    expect(record).not.toHaveProperty('zona');
    expect(record).not.toHaveProperty('triageResult');
    expect(record).not.toHaveProperty('tier');
  });

  it('does not invent location from absent, partial, invalid, or string coordinates', () => {
    for (const profile of [null, {}, { poskoLat: -6.2 }, { poskoLat: 91, poskoLng: 106 }, { poskoLat: '-6.2', poskoLng: 106 }]) {
      const record = buildPfaCaseRecord(PFA_PROTOCOL, assessment, user, profile, completeResponses());
      expect(record).not.toHaveProperty('poskoLat');
      expect(record).not.toHaveProperty('poskoLng');
      expect(record).not.toHaveProperty('location');
      expect(record).not.toHaveProperty('lat');
      expect(record).not.toHaveProperty('lng');
    }
  });

  it('preserves valid profile coordinate pairs, including zero', () => {
    for (const [lat, lng] of [[-6.2, 106.8], [0, 0]]) {
      const record = buildPfaCaseRecord(PFA_PROTOCOL, assessment, user, { poskoLat: lat, poskoLng: lng }, completeResponses());
      expect(record).toMatchObject({ poskoLat: lat, poskoLng: lng });
      expect(() => validateCaseForSave(record)).not.toThrow();
    }
  });

  it('rejects wrong phase, wrong volunteer, and incomplete responses', () => {
    expect(() => buildPfaCaseRecord(PFA_PROTOCOL, { ...assessment, phase: 'lanjutan' }, user, {}, completeResponses())).toThrow();
    expect(() => buildPfaCaseRecord(PFA_PROTOCOL, assessment, { uid: 'other' }, {}, completeResponses())).toThrow();
    expect(() => buildPfaCaseRecord(PFA_PROTOCOL, assessment, user, {}, {})).toThrow();
  });
});

describe('completed PFA history', () => {
  const completed = () => buildPfaCaseRecord(PFA_PROTOCOL, assessment, user, {}, completeResponses());
  const legacy = { recordType: 'legacy-triage', zona: 'hijau', triageResult: 'HIJAU' };

  it('does not infer completion from an empty history or a legacy case', () => {
    expect(hasCompletedPfa([])).toBe(false);
    expect(hasCompletedPfa([legacy])).toBe(false);
  });

  it.each([0, 1])('counts a valid typed PFA with synced: %i', (synced) => {
    expect(hasCompletedPfa([{ ...completed(), synced }])).toBe(true);
  });

  it('rejects invalid or unknown typed records', () => {
    expect(hasCompletedPfa([{ ...completed(), responses: {} }])).toBe(false);
    expect(hasCompletedPfa([{ ...completed(), recordType: 'unknown' }])).toBe(false);
  });

  it('finds a valid PFA among other history records', () => {
    expect(hasCompletedPfa([legacy, { recordType: 'unknown' }, { ...completed(), synced: 0 }])).toBe(true);
  });
});

describe('PFA progress state', () => {
  const completed = () => buildPfaCaseRecord(PFA_PROTOCOL, assessment, user, {}, completeResponses());
  const legacy = { recordType: 'legacy-triage', zona: 'hijau', triageResult: 'HIJAU' };
  const state = (overrides = {}) => getPfaProgressState({
    history: [], cloudVerified: false, assessment: null, patientNik: assessment.patient.nik, ...overrides,
  });

  it('accepts valid local completion without cloud verification, including unsynced cases', () => {
    expect(state({ history: [completed()] })).toBe('completed');
    expect(state({ history: [{ ...completed(), synced: 0 }] })).toBe('completed');
  });

  it.each([false, true])('keeps the matching active acute PFA resumable when cloudVerified is %s', (cloudVerified) => {
    expect(state({ assessment, cloudVerified })).toBe('in-progress');
  });

  it('requires verified absence before calling PFA incomplete', () => {
    expect(state({ cloudVerified: true })).toBe('incomplete');
    expect(state()).toBe('unknown');
    expect(state({ history: [legacy], cloudVerified: true })).toBe('incomplete');
    expect(state({ history: [legacy] })).toBe('unknown');
  });

  it('does not treat another patient’s active assessment as this patient’s progress', () => {
    expect(state({ assessment, patientNik: '3201234567890002' })).toBe('unknown');
    expect(state({ assessment, patientNik: '3201234567890002', cloudVerified: true })).toBe('incomplete');
  });
});

describe('PFA draft cleanup', () => {
  it('removes only the PFA draft session entry', () => {
    const removeItem = vi.fn();
    vi.stubGlobal('sessionStorage', { removeItem });
    try {
      clearPfaDraft();
      expect(removeItem).toHaveBeenCalledExactlyOnceWith(PFA_DRAFT_KEY);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

import { getCaseRecordType, validateCaseForSave } from './caseRecords.js';

export const PFA_DRAFT_KEY = 'rapidMind.pfaDraft';

export function clearPfaDraft() {
  try { sessionStorage.removeItem(PFA_DRAFT_KEY); } catch { /* unavailable */ }
}

export function hasCompletedPfa(history) {
  return Array.isArray(history) && history.some((record) => getCaseRecordType(record) === 'pfa');
}

export function getPfaProgressState({ history, cloudVerified, assessment, patientNik }) {
  if (hasCompletedPfa(history)) return 'completed';
  if (assessment?.patient?.nik === patientNik && assessment.phase === 'akut') return 'in-progress';
  return cloudVerified === true ? 'incomplete' : 'unknown';
}

const isPlainObject = (value) => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

export function validatePfaResponses(protocol, responses, { sectionId, requireComplete = true } = {}) {
  const errors = Object.create(null);
  const normalizedResponses = {};
  if (!isPlainObject(responses)) {
    return { valid: false, errors: { _responses: 'Respons PFA tidak valid.' }, normalizedResponses };
  }
  if (sectionId && !protocol.sections.some((section) => section.id === sectionId)) {
    return { valid: false, errors: { _section: 'Bagian PFA tidak dikenal.' }, normalizedResponses };
  }

  const items = new Map(protocol.sections.flatMap((section) => section.items.map((item) => [item.id, item])));
  for (const [id, value] of Object.entries(responses)) {
    const item = items.get(id);
    if (!item) {
      errors[id] = 'Butir PFA tidak dikenal.';
    } else if (item.type === 'boolean' && typeof value === 'boolean') {
      normalizedResponses[id] = value;
    } else if (item.type === 'text' && typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) normalizedResponses[id] = trimmed;
    } else {
      errors[id] = 'Jenis jawaban tidak sesuai.';
    }
  }

  if (requireComplete) {
    for (const section of protocol.sections) {
      if (sectionId && section.id !== sectionId) continue;
      for (const item of section.items) {
        if (item.required && !Object.hasOwn(normalizedResponses, item.id) && !errors[item.id]) {
          errors[item.id] = 'Jawaban ini wajib diisi.';
        }
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, normalizedResponses };
}

export function restorePfaDraft(draft, assessment, protocol) {
  if (!isPlainObject(draft) || assessment?.phase !== 'akut' ||
      draft.assessmentStartedAt !== assessment.startedAt ||
      draft.patientNik !== assessment.patient?.nik ||
      draft.protocolVersion !== protocol.version ||
      !protocol.sections.some((section) => section.id === draft.currentSection) ||
      !isPlainObject(draft.responses)) return null;

  // Drafts may be unfinished, but every stored answer must still belong to this protocol.
  const validation = validatePfaResponses(protocol, draft.responses, { requireComplete: false });
  if (!validation.valid) return null;
  return {
    assessmentStartedAt: draft.assessmentStartedAt,
    patientNik: draft.patientNik,
    protocolVersion: draft.protocolVersion,
    currentSection: draft.currentSection,
    responses: draft.responses,
  };
}

function validCoordinates(lat, lng) {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

export function buildPfaCaseRecord(protocol, assessment, user, userProfile, responses) {
  if (assessment?.phase !== 'akut' || !assessment.patient ||
      !user?.uid || user.uid !== assessment.relawanId) {
    throw new Error('Konteks asesmen PFA tidak valid.');
  }
  const validation = validatePfaResponses(protocol, responses);
  if (!validation.valid) throw new Error('Lengkapi jawaban PFA sebelum menyimpan.');

  const patient = assessment.patient;
  const record = {
    recordType: 'pfa',
    protocolVersion: protocol.version,
    patientNik: patient.nik,
    relawanId: user.uid,
    phase: 'akut',
    responses: validation.normalizedResponses,
  };
  if (patient.nama?.trim()) record.patientName = patient.nama;
  if (typeof patient.usia === 'number' && Number.isFinite(patient.usia)) record.patientAge = patient.usia;
  if (patient.jenisKelamin?.trim()) record.patientGender = patient.jenisKelamin;
  if (patient.poskoName?.trim()) record.poskoName = patient.poskoName;
  if (userProfile?.name?.trim()) record.relawanName = userProfile.name;
  if (validCoordinates(userProfile?.poskoLat, userProfile?.poskoLng)) {
    record.poskoLat = userProfile.poskoLat;
    record.poskoLng = userProfile.poskoLng;
  }

  validateCaseForSave(record);
  return record;
}

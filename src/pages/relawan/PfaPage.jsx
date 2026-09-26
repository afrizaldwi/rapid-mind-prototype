import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save } from 'lucide-react';
import PfaSection from '../../components/pfa/PfaSection';
import { useAssessment } from '../../hooks/useAssessment';
import { useAuth } from '../../hooks/useAuth';
import { PFA_DRAFT_KEY, buildPfaCaseRecord, clearPfaDraft, restorePfaDraft, validatePfaResponses } from '../../lib/pfa';
import { saveCase } from '../../lib/sync';
import { PFA_PROTOCOL } from '../../protocols/pfaProtocol';

function loadDraft(assessment) {
  let stored;
  try {
    stored = sessionStorage.getItem(PFA_DRAFT_KEY);
  } catch {
    return { draft: null, storageWarning: true };
  }
  if (!stored) return { draft: null, storageWarning: false };
  try {
    const draft = restorePfaDraft(JSON.parse(stored), assessment, PFA_PROTOCOL);
    if (!draft) clearPfaDraft();
    return { draft, storageWarning: false };
  } catch {
    clearPfaDraft();
    return { draft: null, storageWarning: false };
  }
}

export default function PfaPage() {
  const navigate = useNavigate();
  const { assessment, patient } = useAssessment();
  const { user, userProfile } = useAuth();
  const initial = useState(() => loadDraft(assessment))[0];
  const [responses, setResponses] = useState(() => initial.draft?.responses ?? {});
  const [sectionId, setSectionId] = useState(() => initial.draft?.currentSection ?? PFA_PROTOCOL.sections[0].id);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [storageWarning, setStorageWarning] = useState(initial.storageWarning);
  const [isSaving, setIsSaving] = useState(false);
  const saveLock = useRef(false);

  if (!assessment || !patient) return <Navigate to="/relawan/patient-lookup" replace />;
  if (assessment.phase !== 'akut') return <Navigate to="/relawan/triage" replace />;

  const sectionIndex = PFA_PROTOCOL.sections.findIndex((section) => section.id === sectionId);
  const section = PFA_PROTOCOL.sections[sectionIndex];
  const lastSection = sectionIndex === PFA_PROTOCOL.sections.length - 1;

  const persistDraft = (nextResponses, nextSection) => {
    try {
      sessionStorage.setItem(PFA_DRAFT_KEY, JSON.stringify({
        assessmentStartedAt: assessment.startedAt,
        patientNik: patient.nik,
        protocolVersion: PFA_PROTOCOL.version,
        currentSection: nextSection,
        responses: nextResponses,
      }));
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    }
  };

  const handleAnswer = (id, value) => {
    if (saveLock.current) return;
    const next = { ...responses, [id]: value };
    setResponses(next);
    setErrors((current) => {
      const updated = { ...current };
      delete updated[id];
      return updated;
    });
    setSaveError('');
    persistDraft(next, sectionId);
  };

  const handleNext = () => {
    const validation = validatePfaResponses(PFA_PROTOCOL, responses, { sectionId });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    const nextSection = PFA_PROTOCOL.sections[sectionIndex + 1].id;
    setSectionId(nextSection);
    persistDraft(responses, nextSection);
  };

  const handleBack = () => {
    setErrors({});
    const previousSection = PFA_PROTOCOL.sections[sectionIndex - 1].id;
    setSectionId(previousSection);
    persistDraft(responses, previousSection);
  };

  const handleSave = async () => {
    if (saveLock.current) return;
    const validation = validatePfaResponses(PFA_PROTOCOL, responses);
    if (!validation.valid) {
      setErrors(validation.errors);
      const firstIncomplete = PFA_PROTOCOL.sections.find((part) =>
        part.items.some((item) => validation.errors[item.id]));
      if (firstIncomplete) {
        setSectionId(firstIncomplete.id);
        persistDraft(responses, firstIncomplete.id);
      }
      setSaveError('Lengkapi jawaban wajib sebelum menyimpan.');
      return;
    }

    saveLock.current = true;
    setIsSaving(true);
    setSaveError('');
    try {
      const record = buildPfaCaseRecord(PFA_PROTOCOL, assessment, user, userProfile, responses);
      await saveCase(record);
      clearPfaDraft();
      navigate('/relawan', {
        replace: true,
        state: { completedAssessmentStartedAt: assessment.startedAt },
      });
    } catch (error) {
      console.error('Gagal menyimpan PFA:', error);
      setSaveError('PFA belum tersimpan secara lokal. Periksa penyimpanan perangkat lalu coba lagi.');
      setIsSaving(false);
      saveLock.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="space-y-4 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Pertolongan Pertama Psikologis</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">PFA Fase Akut</h1>
          <p className="mt-1 text-xs text-gray-500">Panduan prototipe; isi protokol masih sementara.</p>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">{patient.nama || 'Penyintas'}</p>
          <p>NIK: {patient.nik}</p>
          <p>Posko: {patient.poskoName || 'Belum tersedia'}</p>
        </div>

        {storageWarning && (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Draf tidak dapat disimpan di tab ini. Jawaban dapat hilang jika halaman dimuat ulang.
          </p>
        )}
        {saveError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}

        <ol className="grid grid-cols-3 gap-2" aria-label="Tahapan PFA">
          {PFA_PROTOCOL.sections.map((part, index) => (
            <li key={part.id} aria-current={part.id === sectionId ? 'step' : undefined}
              className={`rounded-lg px-2 py-2 text-center text-xs font-bold ${
                part.id === sectionId ? 'bg-blue-600 text-white' : index < sectionIndex ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
              }`}>
              {index + 1}. {part.title}
            </li>
          ))}
        </ol>

        <PfaSection section={section} responses={responses} errors={errors} onAnswer={handleAnswer} disabled={isSaving} />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white p-4 shadow-lg">
        <div className="mx-auto flex max-w-md gap-3">
          {sectionIndex > 0 && (
            <button type="button" onClick={handleBack} disabled={isSaving}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700 disabled:opacity-50">
              <ArrowLeft className="h-4 w-4" /> Kembali
            </button>
          )}
          <button type="button" onClick={lastSection ? handleSave : handleNext} disabled={isSaving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
            {lastSection ? <Save className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            {isSaving ? 'Menyimpan...' : lastSection ? 'Simpan PFA' : 'Lanjut'}
          </button>
        </div>
      </div>
    </div>
  );
}

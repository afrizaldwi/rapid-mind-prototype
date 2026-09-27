import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import BooleanItem from '../../components/assessment/BooleanItem';
import Srq20SpeechAssist from '../../components/srq20/Srq20SpeechAssist';
import { useAssessment } from '../../hooks/useAssessment';
import { useAuth } from '../../hooks/useAuth';
import { loadLongitudinalDraft, saveLongitudinalDraft } from '../../lib/longitudinalAssessment';
import {
  advanceToRiskFunction, changeInputMode, countSrqAnswers,
  createLongitudinalProgress, returnToSrq20,
} from '../../lib/longitudinalFlow';
import { SRQ20_PROTOCOL } from '../../protocols/srq20Protocol';

function Srq20Assessment({ assessment, patient, userUid }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(() => loadLongitudinalDraft(assessment, userUid) ?? createLongitudinalProgress());
  const progressRef = useRef(progress);
  const [errors, setErrors] = useState({});
  const [pageError, setPageError] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);

  const persist = useCallback((next) => {
    try {
      const saved = saveLongitudinalDraft(next, assessment, userUid);
      setStorageWarning(!saved);
      return saved;
    } catch {
      setStorageWarning(true);
      return false;
    }
  }, [assessment, userUid]);

  useEffect(() => {
    const next = returnToSrq20(progressRef.current);
    progressRef.current = next;
    setProgress(next);
    persist(next);
  }, [persist]);

  const updateProgress = (change) => {
    const next = { ...progressRef.current, ...change, currentStep: 'srq20' };
    progressRef.current = next;
    setProgress(next);
    persist(next);
    setPageError('');
  };

  const handleAnswer = (id, value) => {
    updateProgress({ srqResponses: { ...progressRef.current.srqResponses, [id]: value } });
    setErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const handleNext = () => {
    const current = progressRef.current;
    const transition = advanceToRiskFunction(current);
    if (!transition.valid) {
      setErrors(transition.errors);
      setPageError('Lengkapi semua 20 jawaban SRQ-20 sebelum melanjutkan.');
      return;
    }
    setErrors({});
    if (!persist(transition.progress)) {
      setPageError('Draf belum dapat disimpan. Coba lagi sebelum melanjutkan.');
      return;
    }
    navigate('/relawan/risk-factor');
  };

  const answered = countSrqAnswers(progress.srqResponses);

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="space-y-4 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Asesmen lanjutan · Screen 5</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">SRQ-20</h1>
          <p className="mt-1 text-xs text-gray-600">Semua pertanyaan bertanda [Template] dan masih bersifat sementara.</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">{patient.nama || 'Penyintas'}</p>
          <p>NIK: {patient.nik}</p>
          <p>Posko: {patient.poskoName || 'Belum tersedia'}</p>
        </div>

        <fieldset className="rounded-xl border border-gray-200 bg-white p-4">
          <legend className="px-1 text-sm font-bold text-gray-900">Mode input</legend>
          <p className="mb-3 text-xs text-gray-600">Kedua mode memakai 20 jawaban yang sama.</p>
          <div className="grid grid-cols-2 gap-2">
            {[["verbal", "Verbal"], ["nonverbal", "Non-Verbal / Mutisme"]].map(([mode, label]) => (
              <button key={mode} type="button" aria-pressed={progress.inputMode === mode}
                onClick={() => updateProgress(changeInputMode(progressRef.current, mode))}
                className={`rounded-lg border px-2 py-3 text-xs font-bold ${progress.inputMode === mode
                  ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {progress.inputMode === 'verbal' && <Srq20SpeechAssist />}
        {progress.inputMode === 'nonverbal' && (
          <p className="rounded-xl border border-slate-200 bg-slate-100 p-3 text-sm text-slate-700">
            Pilih jawaban Ya atau Tidak berdasarkan wawancara atau observasi Relawan. Mikrofon tidak digunakan dalam mode ini.
          </p>
        )}

        {storageWarning && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Draf tidak dapat disimpan di tab ini. Jawaban dapat hilang jika halaman dimuat ulang.
        </p>}
        {pageError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{pageError}</p>}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Pertanyaan SRQ-20</h2>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">{answered} / 20 dijawab</span>
        </div>
        <div className="space-y-3">
          {SRQ20_PROTOCOL.items.map((item) => (
            <BooleanItem key={item.id} item={item} value={progress.srqResponses[item.id]}
              error={errors[item.id]} onAnswer={handleAnswer} />
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white p-4 shadow-lg">
        <div className="mx-auto max-w-md">
          <button type="button" onClick={handleNext}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">
            Lanjut ke Faktor Risiko <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Srq20Page() {
  const { assessment, patient } = useAssessment();
  const { user } = useAuth();

  if (!assessment || !patient || !user || assessment.relawanId !== user.uid) {
    return <Navigate to="/relawan/patient-lookup" replace />;
  }
  if (assessment.phase !== 'lanjutan') return <Navigate to="/relawan/pfa" replace />;

  return <Srq20Assessment key={assessment.startedAt} assessment={assessment} patient={patient} userUid={user.uid} />;
}

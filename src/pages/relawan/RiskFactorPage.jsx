import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BooleanItem from '../../components/assessment/BooleanItem';
import { useAssessment } from '../../hooks/useAssessment';
import { useAuth } from '../../hooks/useAuth';
import { loadLongitudinalDraft, saveLongitudinalDraft } from '../../lib/longitudinalAssessment';
import {
  canEnterRiskFunction, checkPhase2BReadiness, countRiskFunctionAnswers, returnToSrq20,
} from '../../lib/longitudinalFlow';
import { RISK_FUNCTION_PROTOCOL } from '../../protocols/riskFunctionProtocol';

function RiskFactorAssessment({ assessment, patient, userUid }) {
  const navigate = useNavigate();
  const [initial] = useState(() => loadLongitudinalDraft(assessment, userUid));
  const [progress, setProgress] = useState(() => initial ? { ...initial, currentStep: 'risk-function' } : null);
  const progressRef = useRef(progress);
  const [errors, setErrors] = useState({ riskFactors: {}, functionalImpairment: {} });
  const [pageError, setPageError] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  const srqComplete = canEnterRiskFunction(initial, assessment, userUid);

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
    if (srqComplete) persist(progressRef.current);
  }, [persist, srqComplete]);

  if (!srqComplete) {
    return <Navigate to="/relawan/srq20" replace />;
  }

  const handleAnswer = (sectionKey, id, value) => {
    const next = {
      ...progressRef.current,
      currentStep: 'risk-function',
      [sectionKey]: { ...progressRef.current[sectionKey], [id]: value },
    };
    progressRef.current = next;
    setProgress(next);
    persist(next);
    setPageError('');
    setErrors((current) => {
      const sectionErrors = { ...current[sectionKey] };
      delete sectionErrors[id];
      return { ...current, [sectionKey]: sectionErrors };
    });
  };

  const handleBack = () => {
    if (!persist(returnToSrq20(progressRef.current))) {
      setPageError('Draf belum dapat disimpan. Coba lagi sebelum kembali.');
      return;
    }
    navigate('/relawan/srq20');
  };

  const handleComplete = () => {
    const current = progressRef.current;
    const readiness = checkPhase2BReadiness(current);
    if (readiness.reason === 'risk-function') {
      setErrors(readiness.errors);
      setPageError('Lengkapi semua jawaban Faktor Risiko dan Gangguan Fungsi.');
      return;
    }
    if (readiness.reason === 'srq20') {
      setPageError('Jawaban SRQ-20 belum lengkap. Kembali ke Screen 5 untuk melengkapinya.');
      return;
    }

    if (!readiness.ready) {
      setPageError('Data asesmen belum dapat diverifikasi. Periksa kembali semua jawaban.');
      return;
    }
    if (!persist({ ...current, currentStep: 'risk-function' })) {
      setPageError('Draf lengkap belum dapat disimpan. Coba lagi.');
      return;
    }
    setErrors({ riskFactors: {}, functionalImpairment: {} });
    setPageError('');
    navigate('/relawan/srq20/result');
  };

  const answered = countRiskFunctionAnswers(progress);

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="space-y-4 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Asesmen lanjutan · Screen 6</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Faktor Risiko & Gangguan Fungsi</h1>
          <p className="mt-1 text-xs text-gray-600">Semua pertanyaan bertanda [Template] dan masih bersifat sementara.</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">{patient.nama || 'Penyintas'}</p>
          <p>NIK: {patient.nik}</p>
        </div>
        {storageWarning && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Draf tidak dapat disimpan di tab ini. Jawaban dapat hilang jika halaman dimuat ulang.
        </p>}
        {pageError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{pageError}</p>}
        <div className="flex justify-end">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">{answered} / 8 dijawab</span>
        </div>
        {RISK_FUNCTION_PROTOCOL.sections.map((section, index) => {
          const sectionKey = index === 0 ? 'riskFactors' : 'functionalImpairment';
          return (
            <section key={section.id} className="space-y-3" aria-labelledby={`section-${section.id}`}>
              <h2 id={`section-${section.id}`} className="text-lg font-bold text-gray-900">{section.title}</h2>
              {section.items.map((item) => (
                <BooleanItem key={item.id} item={item} value={progress[sectionKey][item.id]}
                  error={errors[sectionKey]?.[item.id]}
                  onAnswer={(id, value) => handleAnswer(sectionKey, id, value)} />
              ))}
            </section>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white p-4 shadow-lg">
        <div className="mx-auto flex max-w-md gap-3">
          <button type="button" onClick={handleBack}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>
          <button type="button" onClick={handleComplete}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">
            Lihat Hasil Asesmen
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RiskFactorPage() {
  const { assessment, patient } = useAssessment();
  const { user } = useAuth();

  if (!assessment || !patient || !user || assessment.relawanId !== user.uid) {
    return <Navigate to="/relawan/patient-lookup" replace />;
  }
  if (assessment.phase !== 'lanjutan') return <Navigate to="/relawan/pfa" replace />;

  return <RiskFactorAssessment key={assessment.startedAt} assessment={assessment} patient={patient} userUid={user.uid} />;
}

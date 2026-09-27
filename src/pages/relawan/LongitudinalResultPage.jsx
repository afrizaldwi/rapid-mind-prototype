import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useAssessment } from '../../hooks/useAssessment';
import { useAuth } from '../../hooks/useAuth';
import { buildSrq20CaseRecord, clearLongitudinalDraft, loadLongitudinalDraft } from '../../lib/longitudinalAssessment';
import { checkPhase2BReadiness } from '../../lib/longitudinalFlow';
import { validateSrq20Responses } from '../../lib/srq20';
import { saveCase } from '../../lib/sync';

const tierLabels = {
  T1: 'Risiko tinggi',
  T2: 'Risiko sedang',
  T3: 'Risiko rendah',
};

function LongitudinalResult({ assessment, user, userProfile }) {
  const navigate = useNavigate();
  const [draft] = useState(() => loadLongitudinalDraft(assessment, user.uid));
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saveLock = useRef(false);

  if (!draft) return <Navigate to="/relawan/srq20" replace />;

  const srq = validateSrq20Responses(draft.srqResponses, {
    protocolVersion: draft.srqProtocolVersion,
    requireComplete: true,
  });
  if (!srq.valid) return <Navigate to="/relawan/srq20" replace />;

  const readiness = checkPhase2BReadiness(draft);
  if (!readiness.ready) {
    return <Navigate to={readiness.reason === 'srq20' ? '/relawan/srq20' : '/relawan/risk-factor'} replace />;
  }

  const { analysis, classification } = readiness;
  const riskYes = Object.values(draft.riskFactors).filter((answer) => answer === true).length;
  const functionYes = Object.values(draft.functionalImpairment).filter((answer) => answer === true).length;

  const handleSave = async () => {
    if (saveLock.current) return;
    saveLock.current = true;
    setIsSaving(true);
    setSaveError('');
    try {
      const record = buildSrq20CaseRecord(draft, assessment, user, userProfile);
      await saveCase(record);
      clearLongitudinalDraft();
      navigate('/relawan', {
        replace: true,
        state: { completedAssessmentStartedAt: assessment.startedAt },
      });
    } catch (error) {
      console.error('Gagal menyimpan asesmen SRQ-20:', error);
      setSaveError('Asesmen belum tersimpan secara lokal. Periksa penyimpanan perangkat lalu coba lagi.');
      setIsSaving(false);
      saveLock.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="space-y-4 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Asesmen lanjutan · Screen 7</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Hasil SRQ-20</h1>
          <p className="mt-1 text-xs text-gray-600">Klasifikasi prototipe berdasarkan jawaban terstruktur; belum tervalidasi secara klinis.</p>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">{assessment.patient.nama || 'Penyintas'}</p>
          <p>NIK: {assessment.patient.nik}</p>
          <p>Mode input: {draft.inputMode === 'verbal' ? 'Verbal' : 'Non-Verbal / Mutisme'}</p>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-4" aria-label="Hasil klasifikasi">
          <p className="text-sm text-gray-600">Jawaban Ya SRQ-20</p>
          <p className="text-3xl font-bold text-gray-900">{analysis.score} / 20</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-100 p-3">
              <p className="text-xs text-gray-600">Tier dasar</p>
              <p className="text-xl font-bold text-gray-900">{analysis.baseTier}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs text-gray-600">Tier akhir</p>
              <p className="text-xl font-bold text-blue-800">{classification.finalTier}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-gray-700">{classification.finalTier} · {tierLabels[classification.finalTier]}</p>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700" aria-label="Ringkasan Risk/Function">
          <h2 className="font-bold text-gray-900">Ringkasan Risk/Function</h2>
          <p className="mt-2">Faktor Risiko: {riskYes} dari 4 jawaban Ya</p>
          <p>Gangguan Fungsi: {functionYes} dari 4 jawaban Ya</p>
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-amber-900">
            Versi klasifikasi prototipe saat ini belum memiliki aturan penyesuaian Risk/Function. Tier akhir sama dengan tier dasar.
          </p>
        </section>

        {saveError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white p-4 shadow-lg">
        <div className="mx-auto flex max-w-md gap-3">
          <button type="button" onClick={() => navigate('/relawan/risk-factor')} disabled={isSaving}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700 disabled:opacity-50">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>
          <button type="button" onClick={handleSave} disabled={isSaving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:bg-gray-400">
            <Save className="h-4 w-4" /> {isSaving ? 'Menyimpan...' : 'Simpan Hasil Asesmen'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LongitudinalResultPage() {
  const { assessment, patient } = useAssessment();
  const { user, userProfile } = useAuth();

  if (!assessment || !patient || !user || assessment.relawanId !== user.uid) {
    return <Navigate to="/relawan/patient-lookup" replace />;
  }
  if (assessment.phase !== 'lanjutan') return <Navigate to="/relawan/pfa" replace />;

  return <LongitudinalResult key={assessment.startedAt} assessment={assessment} user={user} userProfile={userProfile} />;
}

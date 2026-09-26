import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { analyzeChecklist } from '../../lib/scoring';
import { useAssessment } from '../../hooks/useAssessment';
import { twMerge } from 'tailwind-merge';

const questions = [
  { id: 'q1', text: 'Korban menunjukkan histeria / menjerit tidak terkendali', isCritical: true },
  { id: 'q2', text: 'Korban tidak merespons saat diajak bicara (disosiatif)', isCritical: true },
  { id: 'q3', text: 'Korban menyatakan niat menyakiti diri sendiri', isCritical: true },
  { id: 'q4', text: 'Korban gemetar hebat / panik berlebihan', isCritical: false },
  { id: 'q5', text: 'Korban menangis terus-menerus', isCritical: false },
  { id: 'q6', text: 'Korban menolak makan/minum lebih dari 24 jam', isCritical: false },
  { id: 'q7', text: 'Korban terlihat bingung / disorientasi', isCritical: false },
  { id: 'q8', text: 'Korban bisa berkomunikasi dan tampak relatif tenang', isCritical: false, isPositive: true },
];

export default function NonVerbalPage() {
  const navigate = useNavigate();
  const { assessment, patient } = useAssessment();
  const [answers, setAnswers] = useState(
    questions.reduce((acc, q) => ({ ...acc, [q.id]: false }), {})
  );

  const toggleAnswer = (id) => {
    setAnswers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAnalyze = () => {
    const result = analyzeChecklist(answers);
    navigate('/relawan/triage/result', {
      state: {
        ...result,
        checklistAnswers: answers,
        jalur: 'nonverbal',
        assessmentStartedAt: assessment.startedAt
      }
    });
  };

  const hasAnyAnswer = Object.values(answers).some(val => val === true);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate('/relawan/triage')} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-800">Jalur B — Checklist Observasi</h1>
          <p className="text-xs text-gray-500">{patient.nama}</p>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-sm text-gray-600 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
          Pilih semua kondisi yang sesuai dengan observasi Anda terhadap korban saat ini.
        </p>

        {questions.map((q) => (
          <div 
            key={q.id}
            onClick={() => toggleAnswer(q.id)}
            className={twMerge(
              "bg-white p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3",
              answers[q.id] ? "border-blue-500 bg-blue-50/50" : "border-gray-200 hover:border-gray-300"
            )}
          >
            <div className={twMerge(
              "w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-colors",
              answers[q.id] ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300"
            )}>
              {answers[q.id] && <Check className="w-4 h-4 text-white" />}
            </div>
            <div className="flex-1">
              <span className={twMerge(
                "text-sm font-medium leading-snug block",
                answers[q.id] ? "text-gray-900" : "text-gray-700"
              )}>
                {q.text}
              </span>
              {q.isCritical && (
                <div className="inline-flex items-center gap-1 mt-1.5 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  <AlertCircle className="w-3 h-3" />
                  Kritis
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleAnalyze}
            disabled={!hasAnyAnswer}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl disabled:bg-gray-300 disabled:text-gray-500 transition-colors shadow-sm"
          >
            Analisis Hasil
          </button>
        </div>
      </div>
    </div>
  );
}

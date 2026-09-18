import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, ClipboardCheck, ArrowLeft } from 'lucide-react';

export default function TriagePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <button 
          onClick={() => navigate('/relawan')}
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-gray-800">Pilih Metode Triase</h1>
      </div>

      <div className="p-4 space-y-4 mt-2">
        <Link 
          to="/relawan/triage/verbal"
          className="block bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all active:scale-[0.98]"
        >
          <div className="flex items-start gap-4">
            <div className="bg-blue-100 p-3 rounded-xl flex-shrink-0">
              <Mic className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Jalur A — Verbal (Suara)</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Rekam suara korban dan sistem akan menganalisis kata kunci risiko secara otomatis menggunakan NLP.
              </p>
            </div>
          </div>
        </Link>

        <Link 
          to="/relawan/triage/nonverbal"
          className="block bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all active:scale-[0.98]"
        >
          <div className="flex items-start gap-4">
            <div className="bg-emerald-100 p-3 rounded-xl flex-shrink-0">
              <ClipboardCheck className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Jalur B — Non-Verbal (Observasi)</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Isi checklist cepat berdasarkan observasi perilaku korban ({"<"}10 detik). Cocok untuk korban histeris atau diam.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

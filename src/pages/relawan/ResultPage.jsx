import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Save, X, Info } from "lucide-react";
import { saveCase } from "../../lib/sync";
import { useAuth } from "../../hooks/useAuth";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

export default function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const state = location.state;

  const [showPfaModal, setShowPfaModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (state?.zona === "merah") {
      setShowPfaModal(true);
    }
  }, [state]);

  if (!state) {
    return <Navigate to="/relawan/triage" replace />;
  }

  const {
    zona,
    jalur,
    transcript,
    detectedKeywords,
    criticalItems,
    warningItems,
    score,
  } = state;

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const baseLat = userProfile?.poskoLat || -6.2088;
      const baseLng = userProfile?.poskoLng || 106.8456;
      const caseData = {
        ...state,
        relawanId: user?.uid,
        relawanName: userProfile?.name || "Relawan",
        poskoName: userProfile?.poskoName || "Posko Utama - Kota",
        poskoLat: baseLat,
        poskoLng: baseLng,
        // Add random slight variation to posko coords to prevent exact overlapping pins on map
        lat: baseLat + (Math.random() - 0.5) * 0.008,
        lng: baseLng + (Math.random() - 0.5) * 0.008,
      };

      await saveCase(caseData);
      navigate("/relawan");
    } catch (error) {
      console.error("Error saving case:", error);
      alert("Gagal menyimpan data.");
      setIsSaving(false);
    }
  };

  const getZonaConfig = (z) => {
    switch (z) {
      case "merah":
        return {
          bg: "bg-red-500",
          light: "bg-red-50",
          border: "border-red-200",
          text: "text-red-700",
          label: "🔴 ZONA MERAH — Risiko Tinggi",
        };
      case "kuning":
        return {
          bg: "bg-amber-500",
          light: "bg-amber-50",
          border: "border-amber-200",
          text: "text-amber-700",
          label: "🟡 ZONA KUNING — Risiko Sedang",
        };
      case "hijau":
        return {
          bg: "bg-green-500",
          light: "bg-green-50",
          border: "border-green-200",
          text: "text-green-700",
          label: "🟢 ZONA HIJAU — Stabil",
        };
      default:
        return {
          bg: "bg-gray-500",
          light: "bg-gray-50",
          border: "border-gray-200",
          text: "text-gray-700",
          label: "ZONA TIDAK DIKETAHUI",
        };
    }
  };

  const cfg = getZonaConfig(zona);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-800">
          Hasil Analisis Triase
        </h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Banner Zona */}
        <div
          className={twMerge(
            "rounded-2xl p-6 text-center text-white shadow-md font-bold text-xl",
            cfg.bg,
          )}
        >
          {cfg.label}
        </div>

        {/* Rincian Analisis */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">
            Rincian Analisis ({jalur === "verbal" ? "Verbal" : "Non-Verbal"})
          </h2>

          {jalur === "verbal" && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-1 font-medium">
                  Transkrip:
                </p>
                <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 border border-gray-100 italic">
                  "{transcript}"
                </div>
              </div>

              {detectedKeywords && detectedKeywords.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">
                    Kata Kunci Terdeteksi:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {detectedKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className={twMerge(
                          "px-2.5 py-1 rounded-md text-xs font-bold border",
                          cfg.light,
                          cfg.text,
                          cfg.border,
                        )}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {jalur === "nonverbal" && (
            <div className="space-y-4">
              {criticalItems && criticalItems.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-red-600 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Indikator Kritis:
                  </p>
                  <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                    {criticalItems.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {warningItems && warningItems.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-amber-600 mb-2 flex items-center gap-1">
                    <Info className="w-4 h-4" /> Indikator Peringatan:
                  </p>
                  <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                    {warningItems.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!criticalItems?.length && !warningItems?.length && (
                <p className="text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Tidak ada indikator
                  risiko terdeteksi.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl disabled:bg-gray-400 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {isSaving ? "Menyimpan..." : "Simpan Hasil Triase"}
          </button>
        </div>
      </div>

      {/* PFA Modal */}
      {showPfaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-slide-up">
            <div className="bg-red-600 p-4 text-white flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Peringatan Zona Merah
                </h3>
                <p className="text-red-100 text-sm mt-1">
                  Panduan Pertolongan Pertama Psikologis (PFA)
                </p>
              </div>
              <button
                onClick={() => setShowPfaModal(false)}
                className="text-red-200 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-gray-600 mb-4 font-medium">
                Korban membutuhkan intervensi segera. Lakukan langkah-langkah
                berikut:
              </p>
              <ol className="space-y-3 text-sm text-gray-800">
                <li className="flex gap-2">
                  <span className="font-bold text-red-600 shrink-0">1.</span>
                  <span>Pastikan keamanan korban dan lingkungan sekitar.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-red-600 shrink-0">2.</span>
                  <span>
                    Dekati korban dengan tenang, perkenalkan diri Anda.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-red-600 shrink-0">3.</span>
                  <span>
                    Dengarkan tanpa menghakimi, biarkan korban bercerita jika
                    mau.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-red-600 shrink-0">4.</span>
                  <span>
                    Bantu korban merasa aman (katakan: "Anda sekarang aman
                    bersama kami").
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-red-600 shrink-0">5.</span>
                  <span className="font-bold">
                    Hubungkan dengan layanan profesional / psikolog sesegera
                    mungkin.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-red-600 shrink-0">6.</span>
                  <span>Jangan tinggalkan korban sendirian.</span>
                </li>
              </ol>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setShowPfaModal(false)}
                className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors"
              >
                Saya Mengerti & Laksanakan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

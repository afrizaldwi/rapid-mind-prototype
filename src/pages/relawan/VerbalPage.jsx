import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mic,
  Square,
  ArrowLeft,
  AlertTriangle,
  Volume2,
  Shield,
} from "lucide-react";
import { useSpeechToText } from "../../hooks/useSpeechToText";
import { analyzeTranscript } from "../../lib/scoring";

export default function VerbalPage() {
  const navigate = useNavigate();
  const {
    isListening,
    transcript,
    setTranscript,
    audioLevel,
    audioUrl,
    isSupported,
    error,
    isBraveOrOffline,
    startListening,
    stopListening,
  } = useSpeechToText();
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!transcript.trim()) return;
    setAnalyzing(true);

    try {
      const result = await analyzeTranscript(transcript);
      navigate("/relawan/triage/result", {
        state: {
          ...result,
          transcript,
          jalur: "verbal",
        },
      });
    } catch (error) {
      console.error("Error analyzing:", error);
      alert("Terjadi kesalahan saat menganalisis teks.");
      setAnalyzing(false);
    }
  };

  const handlePreset = (text) => {
    setTranscript(text);
  };

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => navigate("/relawan/triage")}
            className="p-2 -ml-2 text-gray-600 rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-800">
            Jalur A — Rekam Suara
          </h1>
        </div>
        <div className="p-6 flex flex-col items-center justify-center flex-1 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Browser Tidak Mendukung Web Speech
          </h2>
          <p className="text-gray-600 text-sm mb-4">
            Browser Anda tidak mendukung Speech-to-Text langsung. Namun Anda
            tetap dapat menggunakan Jalur A dengan mengetik teks pernyataan
            korban secara manual.
          </p>
          <button
            onClick={() => navigate("/relawan/triage/nonverbal")}
            className="w-full bg-blue-600 text-white font-medium py-3 rounded-xl mb-2"
          >
            Beralih ke Jalur B (Checklist)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <button
          onClick={() => navigate("/relawan/triage")}
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-gray-800">
          Jalur A — Rekam Suara
        </h1>
      </div>

      <div className="flex-1 flex flex-col p-4">
        {/* Brave / Offline Info Notice */}
        {isBraveOrOffline && (
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl mb-4 text-xs text-blue-900 shadow-sm">
            <div className="flex items-center gap-2 font-bold mb-1">
              <Shield className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Mode Audio Lokal (Brave / Offline)</span>
            </div>
            <p className="leading-relaxed text-blue-800">
              Browser Brave secara default mematikan pengiriman suara ke Google
              Cloud demi privasi pengguna (atau perangkat sedang offline).
              Mikrofon tetap aktif merekam suara secara lokal. Anda dapat
              menggunakan tombol simulasi cepat atau mengetik transkrip di
              bawah.
            </p>
          </div>
        )}

        {/* Generic Error Display (only if not Brave network error) */}
        {error && !isBraveOrOffline && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4 text-xs text-amber-800">
            <div className="flex items-center gap-2 font-bold mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Info Pengenalan Suara</span>
            </div>
            <p>{error}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-slate-700 leading-relaxed">
            <strong>Petunjuk:</strong> Tekan tombol mikrofon untuk merekam suara
            korban. Untuk transkrip otomatis via Google Cloud STT, gunakan
            Google Chrome atau MS Edge. Di Brave/Offline, mikrofon merekam audio
            dan transkrip dapat dipilih via tombol cepat atau diketik langsung.
          </p>
        </div>

        {/* Mic Button Area */}
        <div className="flex flex-col items-center justify-center py-3">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`relative flex items-center justify-center w-28 h-28 rounded-full shadow-lg transition-all active:scale-95 ${
              isListening
                ? "bg-red-500 text-white hover:bg-red-600 shadow-red-200"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
            }`}
          >
            {isListening && (
              <div className="absolute inset-0 rounded-full border-4 border-red-400 opacity-40 animate-ping"></div>
            )}
            {isListening ? (
              <Square className="w-9 h-9 fill-current" />
            ) : (
              <Mic className="w-12 h-12" />
            )}
          </button>

          {/* Sound Wave Visualizer when listening */}
          {isListening && (
            <div className="flex items-center gap-1.5 h-8 mt-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => {
                const dynamicHeight = Math.max(
                  20,
                  Math.min(100, audioLevel * (0.6 + (bar % 3) * 0.4)),
                );
                return (
                  <div
                    key={bar}
                    className="w-1.5 bg-red-500 rounded-full transition-all duration-75"
                    style={{ height: `${dynamicHeight}%` }}
                  />
                );
              })}
            </div>
          )}

          <p className="mt-3 text-base font-semibold text-gray-700">
            {isListening
              ? "⏺ Sedang Merekam... Tekan untuk berhenti"
              : transcript
                ? "✅ Teks siap dianalisis"
                : "🎤 Tekan untuk mulai merekam"}
          </p>
          {isListening && (
            <p className="mt-1 text-xs text-red-500 animate-pulse">
              Bicara ke mikrofon sekarang...
            </p>
          )}
        </div>

        {/* Audio Player if Audio Recorded */}
        {audioUrl && (
          <div className="bg-slate-100 border border-slate-200 p-3 rounded-xl mb-4">
            <p className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-blue-600" />
              Putar Hasil Rekaman Audio Mikrofon:
            </p>
            <audio src={audioUrl} controls className="w-full h-8" />
          </div>
        )}

        {/* Transcript Area (Editable & Scrollable) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Transkrip Percakapan
            </span>
            {transcript && (
              <button
                onClick={() => setTranscript("")}
                className="text-xs text-gray-400 hover:text-red-500 font-medium"
              >
                Hapus Teks
              </button>
            )}
          </div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Teks ucapan korban akan muncul di sini otomatis, atau ketik langsung jika tanpa mikrofon..."
            rows={4}
            className="w-full text-sm text-gray-800 placeholder-gray-400 border-0 focus:ring-0 p-0 resize-none outline-none leading-relaxed"
          />
        </div>

        {/* Quick Simulation Presets for Demo */}
        <div className="mb-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Simulasi Cepat (Demo Juri):
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                handlePreset(
                  "Saya sudah putus asa, rumah hancur dan saya mau mati saja menyakiti diri.",
                )
              }
              className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs rounded-lg font-medium transition-colors"
            >
              🔴 Kasus Merah (Kritis)
            </button>
            <button
              type="button"
              onClick={() =>
                handlePreset(
                  "Saya sangat takut, panik dan bingung sekali. Semalam tidak bisa tidur.",
                )
              }
              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs rounded-lg font-medium transition-colors"
            >
              🟡 Kasus Kuning (Cemas)
            </button>
            <button
              type="button"
              onClick={() =>
                handlePreset(
                  "Alhamdulillah kami sekeluarga aman dan merasa tenang di posko ini.",
                )
              }
              className="px-2.5 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs rounded-lg font-medium transition-colors"
            >
              🟢 Kasus Hijau (Stabil)
            </button>
          </div>
        </div>

        {/* Actions Button */}
        <button
          onClick={handleAnalyze}
          disabled={!transcript.trim() || isListening || analyzing}
          className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl disabled:bg-gray-300 disabled:text-gray-500 transition-colors shadow-sm"
        >
          {analyzing ? "Menganalisis..." : "Analisis Hasil Triase"}
        </button>
      </div>
    </div>
  );
}

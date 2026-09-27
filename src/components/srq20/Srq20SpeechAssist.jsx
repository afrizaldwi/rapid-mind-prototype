import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import { useOfflineWhisper } from '../../hooks/useOfflineWhisper';

export default function Srq20SpeechAssist() {
  const {
    transcript, setTranscript, isListening, audioLevel, audioUrl, audioBlob,
    error, isSupported, isBraveOrOffline, startListening, stopListening,
  } = useSpeechToText();
  const {
    modelStatus, downloadProgress, progressText, workerError, loadModel,
    transcribeAudio, isModelReady, isTranscribing, isLoadingModel,
  } = useOfflineWhisper();
  const [starting, setStarting] = useState(false);
  const [transcribeError, setTranscribeError] = useState('');
  const activeRef = useRef(true);
  const startUiAttemptRef = useRef(0);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const handleRecord = async () => {
    if (starting) {
      startUiAttemptRef.current++;
      stopListening();
      setStarting(false);
      return;
    }
    if (isListening) {
      stopListening();
      return;
    }
    setStarting(true);
    setTranscribeError('');
    const attempt = ++startUiAttemptRef.current;
    try {
      await startListening();
    } finally {
      if (activeRef.current && attempt === startUiAttemptRef.current) setStarting(false);
    }
  };

  const handleTranscribe = async () => {
    if (!audioBlob || !isModelReady) return;
    setTranscribeError('');
    try {
      const text = await transcribeAudio(audioBlob);
      if (!activeRef.current) return;
      if (typeof text === 'string' && text.trim()) setTranscript(text.trim());
      else setTranscribeError('Tidak ada kata yang jelas terdeteksi. Coba rekam ulang atau ketik transkrip.');
    } catch (cause) {
      if (activeRef.current) setTranscribeError(`Transkripsi gagal: ${cause.message}`);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-4" aria-labelledby="srq-speech-title">
      <div>
        <h2 id="srq-speech-title" className="text-base font-bold text-gray-900">Bantuan wawancara suara</h2>
        <p className="mt-1 text-sm text-gray-700">
          Transkrip hanya membantu wawancara. Pilih Ya atau Tidak untuk setiap pertanyaan secara manual.
          Protokol template ini belum memiliki pemetaan jawaban otomatis.
        </p>
      </div>

      <button type="button" onClick={handleRecord}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white ${
          isListening || starting ? 'bg-red-600' : 'bg-blue-600'
        }`}>
        {isListening || starting ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        {starting ? 'Batalkan permintaan mikrofon' : isListening ? 'Hentikan rekaman' : 'Mulai rekam / Speech-to-Text'}
      </button>
      {isListening && <p className="text-xs text-blue-800">Mikrofon aktif · level audio {audioLevel}%</p>}
      {!isSupported && <p className="text-xs text-amber-800">Speech-to-Text langsung tidak didukung browser ini. Rekaman dan isian manual tetap tersedia.</p>}
      {isBraveOrOffline && <p className="text-xs text-blue-800">Speech-to-Text langsung mungkin tidak tersedia di browser atau jaringan ini. Gunakan transkrip manual atau Whisper lokal.</p>}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}

      {audioUrl && (
        <div className="space-y-2">
          <audio src={audioUrl} controls className="w-full" aria-label="Putar rekaman wawancara" />
          {modelStatus === 'idle' && (
            <button type="button" onClick={loadModel} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700">
              Muat model Whisper untuk transkrip lokal
            </button>
          )}
          {isLoadingModel && <p className="text-xs text-blue-800">{progressText || 'Memuat model Whisper...'} {downloadProgress}%</p>}
          {isModelReady && (
            <button type="button" onClick={handleTranscribe} disabled={isTranscribing}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {isTranscribing ? 'Mentranskripsi...' : 'Transkripsi rekaman dengan Whisper lokal'}
            </button>
          )}
          {workerError && <p role="alert" className="text-xs text-red-700">{workerError}</p>}
          {transcribeError && <p role="alert" className="text-xs text-red-700">{transcribeError}</p>}
        </div>
      )}

      <label htmlFor="srq-transcript" className="block text-sm font-semibold text-gray-800">Transkrip sementara (dapat diedit)</label>
      <textarea id="srq-transcript" rows={4} value={transcript} onChange={(event) => setTranscript(event.target.value)}
        placeholder="Hasil Speech-to-Text atau catatan wawancara sementara"
        className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm focus:border-blue-500 focus:outline-none" />
      <p className="text-xs text-gray-600">Transkrip dan audio tidak disimpan dalam draf asesmen.</p>
    </section>
  );
}

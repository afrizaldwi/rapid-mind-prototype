import { useState, useRef, useCallback, useEffect } from "react";

export function useSpeechToText() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isBraveOrOffline, setIsBraveOrOffline] = useState(false);

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);
  const startAttemptRef = useRef(0);
  const recordingSessionRef = useRef(0);
  const audioUrlRef = useRef(null);
  const mountedRef = useRef(true);

  // Check if browser is Brave
  useEffect(() => {
    if (navigator.brave && typeof navigator.brave.isBrave === "function") {
      navigator.brave.isBrave().then((brave) => {
        if (brave) setIsBraveOrOffline(true);
      });
    }
  }, []);

  const revokeAudioUrl = useCallback(() => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
  }, []);

  const releaseMedia = useCallback((discardRecording = false) => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Recognition stop error:", e);
      }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current) {
      const recorder = mediaRecorderRef.current;
      if (discardRecording) recorder.onstop = null;
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch (e) {
          console.warn("MediaRecorder stop error:", e);
        }
      }
      mediaRecorderRef.current = null;
    }
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
  }, []);

  const startListening = useCallback(async () => {
    const attempt = ++startAttemptRef.current;
    const recordingSession = ++recordingSessionRef.current;
    releaseMedia(true);
    revokeAudioUrl();
    setError(null);
    setAudioUrl(null);
    setAudioBlob(null);
    const chunks = [];

    // 1. Start real microphone capture for audio recording & visualizer
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (!mountedRef.current || attempt !== startAttemptRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;

        // Setup audio visualizer
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animationFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        }

        // Setup MediaRecorder
        if (typeof MediaRecorder !== "undefined") {
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              chunks.push(e.data);
            }
          };
          mediaRecorder.onstop = () => {
            if (mountedRef.current && recordingSession === recordingSessionRef.current && chunks.length > 0) {
              const blob = new Blob(chunks, {
                type: "audio/webm",
              });
              setAudioBlob(blob);
              revokeAudioUrl();
              const url = URL.createObjectURL(blob);
              audioUrlRef.current = url;
              setAudioUrl(url);
            }
          };
          mediaRecorder.start();
        }
      }
    } catch (err) {
      if (!mountedRef.current || attempt !== startAttemptRef.current) return;
      console.warn("Microphone access warning:", err);
      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        setError(
          "Izin mikrofon ditolak oleh browser. Silakan izinkan akses mikrofon di ikon perizinan browser.",
        );
        setIsListening(false);
        releaseMedia(true);
        return;
      }
      releaseMedia(true);
    }

    if (!mountedRef.current || attempt !== startAttemptRef.current) return;

    // 2. Try SpeechRecognition for live text streaming
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setIsListening(true);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "id-ID";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        if (mountedRef.current && attempt === startAttemptRef.current) setIsListening(true);
        else {
          try { recognition.stop(); } catch { /* already stopped */ }
        }
      };

      recognition.onresult = (event) => {
        if (!mountedRef.current || attempt !== startAttemptRef.current) return;
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + " ";
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        setTranscript(finalTranscript + interimTranscript);
      };

      recognition.onerror = (event) => {
        if (!mountedRef.current || attempt !== startAttemptRef.current) return;
        console.warn("Speech recognition event error:", event.error);
        if (event.error === "network") {
          // Brave or offline - do not abort the recording, just flag Brave/offline
          setIsBraveOrOffline(true);
        } else if (event.error === "not-allowed") {
          setError("Izin mikrofon untuk Google Speech tidak diberikan.");
        }
      };

      recognition.onend = () => {
        // Kept alive until user stops listening
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn("Recognition start failed:", e);
      setIsBraveOrOffline(true);
    }

    if (mountedRef.current && attempt === startAttemptRef.current) setIsListening(true);
  }, [releaseMedia, revokeAudioUrl]);

  const stopListening = useCallback(() => {
    startAttemptRef.current++;
    releaseMedia();
    setAudioLevel(0);
    setIsListening(false);
  }, [releaseMedia]);

  const resetTranscript = useCallback(() => {
    revokeAudioUrl();
    setTranscript("");
    setAudioUrl(null);
    setAudioBlob(null);
    setError(null);
  }, [revokeAudioUrl]);

  const dispose = useCallback(() => {
    mountedRef.current = false;
    startAttemptRef.current++;
    releaseMedia(true);
    revokeAudioUrl();
  }, [releaseMedia, revokeAudioUrl]);

  useEffect(() => {
    mountedRef.current = true;
    return dispose;
  }, [dispose]);

  return {
    transcript,
    setTranscript,
    isListening,
    audioLevel,
    audioUrl,
    audioBlob,
    error,
    isSupported,
    isBraveOrOffline,
    startListening,
    stopListening,
    resetTranscript,
  };
}

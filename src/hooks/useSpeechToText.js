import { useState, useRef, useCallback, useEffect } from "react";

export function useSpeechToText() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isBraveOrOffline, setIsBraveOrOffline] = useState(false);

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);

  // Check if browser is Brave
  useEffect(() => {
    if (navigator.brave && typeof navigator.brave.isBrave === "function") {
      navigator.brave.isBrave().then((brave) => {
        if (brave) setIsBraveOrOffline(true);
      });
    }
  }, []);

  const cleanupAudio = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setAudioLevel(0);
  };

  const startListening = useCallback(async () => {
    setError(null);
    setAudioUrl(null);
    audioChunksRef.current = [];

    // 1. Start real microphone capture for audio recording & visualizer
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
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
              audioChunksRef.current.push(e.data);
            }
          };
          mediaRecorder.onstop = () => {
            if (audioChunksRef.current.length > 0) {
              const blob = new Blob(audioChunksRef.current, {
                type: "audio/webm",
              });
              const url = URL.createObjectURL(blob);
              setAudioUrl(url);
            }
          };
          mediaRecorder.start();
        }
      }
    } catch (err) {
      console.warn("Microphone access warning:", err);
      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        setError(
          "Izin mikrofon ditolak oleh browser. Silakan izinkan akses mikrofon di ikon perizinan browser.",
        );
        setIsListening(false);
        return;
      }
    }

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
        setIsListening(true);
      };

      recognition.onresult = (event) => {
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

    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    // Stop SpeechRecognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Recognition stop error:", e);
      }
      recognitionRef.current = null;
    }

    // Stop MediaRecorder
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("MediaRecorder stop error:", e);
      }
    }

    cleanupAudio();
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setAudioUrl(null);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  return {
    transcript,
    setTranscript,
    isListening,
    audioLevel,
    audioUrl,
    error,
    isSupported,
    isBraveOrOffline,
    startListening,
    stopListening,
    resetTranscript,
  };
}

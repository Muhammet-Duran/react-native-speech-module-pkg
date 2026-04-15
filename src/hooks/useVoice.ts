import { useCallback, useEffect, useRef, useState } from "react";
import voiceService from "../voiceService";
import { requestMicrophonePermission } from "../permissionService";
import useSilenceDetection from "./useSilenceDetection";
import useTypingAnimation from "./useTypingAnimation";
import type { UseVoiceReturn, VoiceStatus } from "../types";

const RESULT_COMMIT_FALLBACK_MS = 1200;

const useVoice = (locale = "tr-TR"): UseVoiceReturn => {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setTranscript("");
    setDisplayedText("");
    setError(null);
  }, []);

  const statusRef = useRef<VoiceStatus>(status);
  const transcriptRef = useRef<string>(transcript);
  const accumulatedRef = useRef<string>("");
  const noSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // --- No-speech guard: auto-idle after 5s without any speech ---
  const clearNoSpeechTimer = useCallback(() => {
    if (noSpeechTimerRef.current !== null) {
      clearTimeout(noSpeechTimerRef.current);
      noSpeechTimerRef.current = null;
    }
  }, []);

  const startNoSpeechTimer = useCallback(() => {
    clearNoSpeechTimer();
    noSpeechTimerRef.current = setTimeout(async () => {
      if (statusRef.current === "listening") {
        setStatus("idle");
        try {
          await voiceService.stop();
        } catch {}
      }
    }, 5000);
  }, [clearNoSpeechTimer, setStatus]);

  // --- Fallback commit: if onSpeechEnd is delayed, commit transcript after 1.2s ---
  const clearCommitFallbackTimer = useCallback(() => {
    if (commitFallbackTimerRef.current !== null) {
      clearTimeout(commitFallbackTimerRef.current);
      commitFallbackTimerRef.current = null;
    }
  }, []);

  const startCommitFallbackTimer = useCallback(() => {
    clearCommitFallbackTimer();
    commitFallbackTimerRef.current = setTimeout(async () => {
      if (statusRef.current !== "listening") return;
      const text = transcriptRef.current.trim();
      if (!text) return;
      setStatus("typing");
      try {
        await voiceService.stop();
      } catch {}
    }, RESULT_COMMIT_FALLBACK_MS);
  }, [clearCommitFallbackTimer, setStatus]);

  // --- Silence detection ---
  const handleSilence = useCallback(async () => {
    if (statusRef.current !== "listening") return;
    setStatus("processing");
    try {
      await voiceService.stop();
    } catch {}
  }, [setStatus]);

  const { startSilenceTimer, clearSilenceTimer } =
    useSilenceDetection(handleSilence);

  // --- Typing animation ---
  const handleTypingComplete = useCallback(() => {
    setStatus("done");
  }, [setStatus]);

  const { startTyping } = useTypingAnimation({
    onCharAdded: setDisplayedText,
    onComplete: handleTypingComplete,
  });

  const prevStatusRef = useRef<VoiceStatus>(status);
  useEffect(() => {
    if (
      prevStatusRef.current !== "typing" &&
      status === "typing" &&
      transcript
    ) {
      startTyping(transcript);
    }
    prevStatusRef.current = status;
  }, [status, transcript, startTyping]);

  // --- Register callbacks once on mount ---
  useEffect(() => {
    voiceService.setup({
      onResult: (text) => {
        clearNoSpeechTimer();
        const full = accumulatedRef.current
          ? `${accumulatedRef.current} ${text}`
          : text;
        accumulatedRef.current = full;
        setTranscript(full);
        startSilenceTimer();
        startCommitFallbackTimer();
      },
      onPartialResult: (text) => {
        clearNoSpeechTimer();
        const full = accumulatedRef.current
          ? `${accumulatedRef.current} ${text}`
          : text;
        setTranscript(full);
        startCommitFallbackTimer();
      },
      onError: (err) => {
        clearNoSpeechTimer();
        clearCommitFallbackTimer();
        clearSilenceTimer();
        setError(err);
        setStatus("idle");
      },
      onEnd: () => {
        clearNoSpeechTimer();
        clearCommitFallbackTimer();
        clearSilenceTimer();
        const current = statusRef.current;
        if (current !== "listening" && current !== "processing") return;
        const text = transcriptRef.current;
        setStatus(text ? "typing" : "idle");
      },
    });

    return () => {
      clearNoSpeechTimer();
      clearCommitFallbackTimer();
      clearSilenceTimer();
      voiceService.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Toggle action ---
  const toggleListening = useCallback(async () => {
    const current = statusRef.current;

    if (current === "listening") {
      clearCommitFallbackTimer();
      clearSilenceTimer();
      setStatus("processing");
      try {
        await voiceService.stop();
      } catch {}
      return;
    }

    if (current === "processing" || current === "typing") return;

    if (current === "done") reset();
    accumulatedRef.current = "";
    clearCommitFallbackTimer();

    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      setError("Microphone permission denied.");
      return;
    }

    setStatus("listening");
    const startError = await voiceService.startWithError(locale);
    if (startError) {
      setError(`Could not start speech recognition: ${startError}`);
      setStatus("idle");
      return;
    }
    startNoSpeechTimer();
  }, [
    locale,
    clearSilenceTimer,
    clearNoSpeechTimer,
    clearCommitFallbackTimer,
    startNoSpeechTimer,
    setStatus,
    reset,
    setError,
  ]);

  const onTextChange = useCallback(
    (text: string) => {
      accumulatedRef.current = text;
      setTranscript(text);
      setDisplayedText(text);
    },
    [setTranscript, setDisplayedText],
  );

  return {
    status,
    displayedText,
    error,
    isListening: status === "listening",
    toggleListening,
    onTextChange,
  };
};

export default useVoice;

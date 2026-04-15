import { useRef, useCallback } from "react";

const SILENCE_DELAY_MS = 800;

export interface UseSilenceDetectionReturn {
  startSilenceTimer: () => void;
  clearSilenceTimer: () => void;
}

const useSilenceDetection = (
  onSilence: () => void,
): UseSilenceDetectionReturn => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onSilence);
  callbackRef.current = onSilence;

  const clearSilenceTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    timerRef.current = setTimeout(() => {
      callbackRef.current();
    }, SILENCE_DELAY_MS);
  }, [clearSilenceTimer]);

  return { startSilenceTimer, clearSilenceTimer };
};

export default useSilenceDetection;

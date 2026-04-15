import { useRef, useCallback, useEffect } from "react";

const CHAR_INTERVAL_MS = 40;

export interface UseTypingAnimationReturn {
  startTyping: (text: string) => void;
}

const useTypingAnimation = ({
  onCharAdded,
  onComplete,
}: {
  onCharAdded: (partial: string) => void;
  onComplete: () => void;
}): UseTypingAnimationReturn => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCharAddedRef = useRef(onCharAdded);
  const onCompleteRef = useRef(onComplete);
  onCharAddedRef.current = onCharAdded;
  onCompleteRef.current = onComplete;

  const clearTyping = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTyping = useCallback(
    (text: string) => {
      clearTyping();
      let index = 0;

      intervalRef.current = setInterval(() => {
        index += 1;
        onCharAddedRef.current(text.slice(0, index));

        if (index >= text.length) {
          clearTyping();
          onCompleteRef.current();
        }
      }, CHAR_INTERVAL_MS);
    },
    [clearTyping],
  );

  useEffect(() => clearTyping, [clearTyping]);

  return { startTyping };
};

export default useTypingAnimation;

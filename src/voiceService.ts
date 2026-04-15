import { NativeModules, NativeEventEmitter } from "react-native";

const { SpeechModule } = NativeModules;

export interface VoiceServiceCallbacks {
  onResult: (text: string) => void;
  onPartialResult: (text: string) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

let subscriptions: ReturnType<NativeEventEmitter["addListener"]>[] = [];

const voiceService = {
  isAvailable(): boolean {
    return SpeechModule != null;
  },

  setup(callbacks: VoiceServiceCallbacks): void {
    if (!SpeechModule) {
      return;
    }

    subscriptions.forEach((s) => s.remove());
    subscriptions = [];

    const emitter = new NativeEventEmitter(SpeechModule);

    subscriptions.push(
      emitter.addListener("onSpeechResults", (e: { value?: string[] }) => {
        const text = e.value?.[0] ?? "";
        if (text) {
          callbacks.onResult(text);
        }
      }),
    );

    subscriptions.push(
      emitter.addListener(
        "onSpeechPartialResults",
        (e: { value?: string[] }) => {
          const text = e.value?.[0] ?? "";
          if (text) {
            callbacks.onPartialResult(text);
          }
        },
      ),
    );

    subscriptions.push(
      emitter.addListener(
        "onSpeechError",
        (e: { error?: { code?: string; message?: string } }) => {
          const code = e.error?.code ?? "";
          const message = e.error?.message ?? "Unknown error";
          callbacks.onError(code ? `[${code}] ${message}` : message);
        },
      ),
    );

    subscriptions.push(
      emitter.addListener("onSpeechEnd", () => {
        callbacks.onEnd();
      }),
    );
  },

  async startWithError(locale = "tr-TR"): Promise<string | null> {
    if (!SpeechModule) {
      return "SpeechModule not found. Rebuild the app (npx react-native run-android / run-ios).";
    }
    try {
      await SpeechModule.startListening(locale);
      return null;
    } catch (e: unknown) {
      return e instanceof Error ? e.message : String(e);
    }
  },

  async stop(): Promise<void> {
    if (!SpeechModule) {
      return;
    }
    try {
      await SpeechModule.stopListening();
    } catch {}
  },

  async destroy(): Promise<void> {
    subscriptions.forEach((s) => s.remove());
    subscriptions = [];
    if (!SpeechModule) {
      return;
    }
    try {
      await SpeechModule.destroy();
    } catch {}
  },
};

export default voiceService;

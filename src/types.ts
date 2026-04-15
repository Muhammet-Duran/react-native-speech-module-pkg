export type VoiceStatus =
  | "idle"
  | "listening"
  | "processing"
  | "typing"
  | "done";

export interface UseVoiceReturn {
  status: VoiceStatus;
  displayedText: string;
  error: string | null;
  isListening: boolean;
  toggleListening: () => Promise<void>;
  onTextChange: (text: string) => void;
}

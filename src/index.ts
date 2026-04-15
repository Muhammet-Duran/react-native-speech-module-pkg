// Native bridge
export { default as voiceService } from "./voiceService";
export type { VoiceServiceCallbacks } from "./voiceService";

// Hooks
export { default as useVoice } from "./hooks/useVoice";
export { default as useSilenceDetection } from "./hooks/useSilenceDetection";
export { default as useTypingAnimation } from "./hooks/useTypingAnimation";

// Utilities
export { requestMicrophonePermission } from "./permissionService";

// Types
export type { VoiceStatus, UseVoiceReturn } from "./types";

import { Platform, PermissionsAndroid } from "react-native";

export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== "android") {
    // iOS: microphone permission is prompted automatically by AVAudioSession on first use.
    // Speech recognition permission is requested inside SpeechModule.swift.
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: "Microphone Permission",
      message: "This app needs microphone access to use voice input.",
      buttonPositive: "Allow",
      buttonNegative: "Deny",
    },
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

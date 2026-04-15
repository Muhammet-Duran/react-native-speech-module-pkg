# react-native-speech-module

Custom native speech-to-text module for React Native.  
No third-party SDK — uses **Android SpeechRecognizer** and **iOS SFSpeechRecognizer** directly.  
Compatible with React Native **New Architecture (0.82+)**.

---

## Installation

```bash
npm install github:Muhammet-Duran/react-native-speech-module-pkg
```

### Android
No extra steps. Autolinking handles everything.

### iOS
```bash
cd ios && pod install
```
Then in Xcode, add `SpeechModule.swift` and `SpeechModuleBridge.m` to your target.

---

## Permissions

### Android
Add to `AndroidManifest.xml` (auto-merged via the package manifest):
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

### iOS
Add to `Info.plist`:
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Microphone access is required for voice input.</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>Speech recognition is required to convert voice to text.</string>
```

---

## Usage

```tsx
import { useVoice } from 'react-native-speech-module';

const MyScreen = () => {
  const { status, displayedText, toggleListening, onTextChange } = useVoice('tr-TR');

  return (
    <>
      <TextInput value={displayedText} onChangeText={onTextChange} />
      <Button title={status === 'listening' ? 'Stop' : 'Speak'} onPress={toggleListening} />
    </>
  );
};
```

---

## API

### `useVoice(locale?: string)`

| Return value      | Type                        | Description                        |
|-------------------|-----------------------------|------------------------------------|
| `status`          | `VoiceStatus`               | idle / listening / processing / typing / done |
| `displayedText`   | `string`                    | Transcribed text (animated)        |
| `isListening`     | `boolean`                   | Shorthand for `status === 'listening'` |
| `error`           | `string \| null`            | Last error message                 |
| `toggleListening` | `() => Promise<void>`       | Start / stop listening             |
| `onTextChange`    | `(text: string) => void`    | Manual text edit handler           |

### `voiceService`
Low-level bridge. Use `useVoice` instead unless you need custom orchestration.

### `requestMicrophonePermission()`
Requests Android microphone permission. iOS is handled automatically.

---

## How it works

1. `toggleListening` → `SpeechModule.startListening(locale)`
2. Android `SpeechRecognizer` / iOS `SFSpeechRecognizer` streams audio
3. Partial results fire `onSpeechPartialResults` → live preview in input
4. Final result fires `onSpeechResults` → silence detection triggers commit
5. `onSpeechEnd` → typing animation starts, text revealed character by character
6. A 1.2s fallback timer ensures text appears even if `onSpeechEnd` is delayed

---

## License

MIT

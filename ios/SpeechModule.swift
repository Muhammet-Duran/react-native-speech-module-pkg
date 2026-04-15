import Foundation
import Speech
import AVFoundation
import React

@objc(SpeechModule)
class SpeechModule: RCTEventEmitter {

  private var speechRecognizer: SFSpeechRecognizer?
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?
  private let audioEngine = AVAudioEngine()

  private var isActive = false
  private var isEngineRunning = false
  private var currentLocale = "tr-TR"
  private var lastPartialText = ""
  // Session ID prevents stale task callbacks from affecting a new session
  private var sessionId = 0

  override static func requiresMainQueueSetup() -> Bool { return true }

  override func supportedEvents() -> [String]! {
    return [
      "onSpeechStart",
      "onSpeechResults",
      "onSpeechPartialResults",
      "onSpeechError",
      "onSpeechEnd",
    ]
  }

  // MARK: - Public API

  @objc(startListening:resolver:rejecter:)
  func startListening(
    _ locale: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    SFSpeechRecognizer.requestAuthorization { [weak self] authStatus in
      guard let self = self else { return }
      DispatchQueue.main.async {
        guard authStatus == .authorized else {
          reject("PERMISSION_DENIED", "Speech recognition permission denied", nil)
          return
        }
        self.currentLocale = locale
        self.lastPartialText = ""
        self.isActive = true
        do {
          try self.beginSession(resolve: resolve)
        } catch {
          reject("START_ERROR", error.localizedDescription, error)
        }
      }
    }
  }

  @objc(stopListening:rejecter:)
  func stopListening(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      self.isActive = false
      // endAudio triggers a final isFinal result → onSpeechEnd will be sent
      self.recognitionRequest?.endAudio()
      resolve(nil)
    }
  }

  @objc(destroy:rejecter:)
  func destroy(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      self.isActive = false
      self.sessionId += 1
      self.recognitionTask?.cancel()
      self.recognitionTask = nil
      self.recognitionRequest = nil
      self.stopEngine()
      resolve(nil)
    }
  }

  // New Architecture compatibility
  override func addListener(_ eventName: String!) { super.addListener(eventName) }
  override func removeListeners(_ count: Double) { super.removeListeners(count) }

  // MARK: - Private

  private func beginSession(resolve: RCTPromiseResolveBlock? = nil) throws {
    sessionId += 1
    let mySession = sessionId

    recognitionTask?.cancel()
    recognitionTask = nil
    recognitionRequest = nil

    let localeObj = Locale(identifier: currentLocale)
    speechRecognizer = SFSpeechRecognizer(locale: localeObj) ?? SFSpeechRecognizer()

    guard let recognizer = speechRecognizer, recognizer.isAvailable else {
      isActive = false
      sendEvent(withName: "onSpeechError",
                body: ["error": ["code": "NOT_AVAILABLE",
                                 "message": "Speech recognition unavailable for this locale/device"]])
      sendEvent(withName: "onSpeechEnd", body: [:])
      return
    }

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    recognitionRequest = request

    recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
      guard let self = self, mySession == self.sessionId else { return }
      DispatchQueue.main.async {
        self.handleRecognition(result: result, error: error)
      }
    }

    if !isEngineRunning {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.record, mode: .measurement, options: .duckOthers)
      try session.setActive(true, options: .notifyOthersOnDeactivation)

      let inputNode = audioEngine.inputNode
      inputNode.removeTap(onBus: 0)
      let format = inputNode.outputFormat(forBus: 0)
      inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
        self?.recognitionRequest?.append(buffer)
      }
      audioEngine.prepare()
      try audioEngine.start()
      isEngineRunning = true
    }

    sendEvent(withName: "onSpeechStart", body: [:])
    resolve?(nil)
  }

  private func handleRecognition(result: SFSpeechRecognitionResult?, error: Error?) {
    if let result = result {
      let transcript = result.bestTranscription.formattedString

      if result.isFinal {
        // Prefer the longer of final vs last partial (mirrors Android behaviour)
        let partialWords = lastPartialText.split(separator: " ").count
        let finalWords   = transcript.split(separator: " ").count
        let bestText     = partialWords > finalWords ? lastPartialText : transcript
        lastPartialText  = ""

        if !bestText.isEmpty {
          sendEvent(withName: "onSpeechResults", body: ["value": [bestText]])
        }

        if isActive {
          try? beginSession()   // Continuous recognition: restart
        } else {
          sendEvent(withName: "onSpeechEnd", body: [:])
          stopEngine()
        }
        return
      }

      if !transcript.isEmpty {
        lastPartialText = transcript
        sendEvent(withName: "onSpeechPartialResults", body: ["value": [transcript]])
      }
    }

    if let error = error {
      let nsError = error as NSError
      let isCancelled   = nsError.code == 209 || nsError.code == 1100
      let isRecoverable = nsError.code == 1107 || nsError.code == 1110

      if isCancelled || !isActive {
        sendEvent(withName: "onSpeechEnd", body: [:])
        stopEngine()
        return
      }

      if isRecoverable {
        try? beginSession()
        return
      }

      isActive = false
      sendEvent(withName: "onSpeechError",
                body: ["error": ["code": String(nsError.code),
                                 "message": error.localizedDescription]])
      sendEvent(withName: "onSpeechEnd", body: [:])
      stopEngine()
    }
  }

  private func stopEngine() {
    guard isEngineRunning else { return }
    audioEngine.stop()
    audioEngine.inputNode.removeTap(onBus: 0)
    isEngineRunning = false
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }
}

package com.speechmodule

import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SpeechModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var speechRecognizer: SpeechRecognizer? = null
    private var isActive = false
    private var activeIntent: Intent? = null
    private var lastPartialText = ""
    private var noResultRestartCount = 0
    private val MAX_NO_RESULT_RESTARTS = 1

    override fun getName(): String = "SpeechModule"

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun startListening(locale: String, promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Activity is null")
            return
        }

        if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
            promise.reject("NOT_AVAILABLE", "Speech recognition is not available on this device")
            return
        }

        activity.runOnUiThread {
            try {
                speechRecognizer?.destroy()
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext)

                speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {
                        sendEvent("onSpeechStart", Arguments.createMap())
                    }

                    override fun onResults(results: Bundle?) {
                        val finalText = results
                            ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            ?.firstOrNull() ?: ""

                        // Prefer the longer of final vs last partial (Android sometimes cuts the final)
                        val bestText = if (
                            lastPartialText.split(" ").size > finalText.split(" ").size
                        ) lastPartialText else finalText
                        lastPartialText = ""

                        if (bestText.isNotEmpty()) {
                            val map = Arguments.createMap()
                            val arr = Arguments.createArray()
                            arr.pushString(bestText)
                            map.putArray("value", arr)
                            sendEvent("onSpeechResults", map)
                        }

                        if (isActive) {
                            noResultRestartCount = 0
                            speechRecognizer?.startListening(activeIntent)
                        } else {
                            sendEvent("onSpeechEnd", Arguments.createMap())
                        }
                    }

                    override fun onPartialResults(partialResults: Bundle?) {
                        val text = partialResults
                            ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            ?.firstOrNull() ?: ""
                        if (text.isNotEmpty()) {
                            lastPartialText = text
                            val map = Arguments.createMap()
                            val arr = Arguments.createArray()
                            arr.pushString(text)
                            map.putArray("value", arr)
                            sendEvent("onSpeechPartialResults", map)
                        }
                    }

                    override fun onError(error: Int) {
                        // Transient errors → silently restart (continuous recognition)
                        if (isActive && (error == SpeechRecognizer.ERROR_NO_MATCH ||
                                         error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT)) {
                            noResultRestartCount++
                            if (noResultRestartCount <= MAX_NO_RESULT_RESTARTS) {
                                speechRecognizer?.startListening(activeIntent)
                                return
                            }
                            isActive = false
                            noResultRestartCount = 0
                            sendEvent("onSpeechEnd", Arguments.createMap())
                            return
                        }
                        // After stopListening Android fires an error — don't surface it,
                        // but always send onSpeechEnd so JS doesn't get stuck in 'processing'
                        if (!isActive) {
                            sendEvent("onSpeechEnd", Arguments.createMap())
                            return
                        }
                        isActive = false
                        noResultRestartCount = 0
                        val map = Arguments.createMap()
                        val errorMap = Arguments.createMap()
                        errorMap.putString("code", error.toString())
                        errorMap.putString("message", getSpeechErrorMessage(error))
                        map.putMap("error", errorMap)
                        sendEvent("onSpeechError", map)
                        sendEvent("onSpeechEnd", Arguments.createMap())
                    }

                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {}
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, locale)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra("android.speech.extra.SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS", 1500L)
                    putExtra("android.speech.extra.SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS", 1000L)
                }

                isActive = true
                activeIntent = intent
                noResultRestartCount = 0
                speechRecognizer?.startListening(intent)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("START_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        isActive = false
        reactContext.currentActivity?.runOnUiThread {
            try {
                speechRecognizer?.stopListening()
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("STOP_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    @ReactMethod
    fun destroy(promise: Promise) {
        isActive = false
        reactContext.currentActivity?.runOnUiThread {
            try {
                speechRecognizer?.destroy()
                speechRecognizer = null
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("DESTROY_ERROR", e.message ?: "Unknown error")
            }
        }
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    private fun getSpeechErrorMessage(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_AUDIO                  -> "Audio recording error"
        SpeechRecognizer.ERROR_CLIENT                 -> "Client-side error"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Missing microphone permission"
        SpeechRecognizer.ERROR_NETWORK                -> "Network error"
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT        -> "Network timeout"
        SpeechRecognizer.ERROR_NO_MATCH               -> "No speech match, please try again"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY        -> "Recognizer busy"
        SpeechRecognizer.ERROR_SERVER                 -> "Server error"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT         -> "No speech detected"
        else                                          -> "Unknown error ($error)"
    }

    override fun onCatalystInstanceDestroy() {
        isActive = false
        reactContext.currentActivity?.runOnUiThread {
            speechRecognizer?.destroy()
            speechRecognizer = null
        }
    }
}

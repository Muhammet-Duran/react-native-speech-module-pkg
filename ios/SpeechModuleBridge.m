#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

RCT_EXTERN_MODULE(SpeechModule, RCTEventEmitter)

RCT_EXTERN_METHOD(startListening:(NSString *)locale
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopListening:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(destroy:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

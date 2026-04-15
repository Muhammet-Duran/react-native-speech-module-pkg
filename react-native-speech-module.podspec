require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-speech-module"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/Muhammet-Duran/react-native-speech-module"
  s.license      = package["license"]
  s.author       = package["author"]
  s.platforms    = { :ios => "13.0" }
  s.source       = {
    :git => "https://github.com/Muhammet-Duran/react-native-speech-module.git",
    :tag => "#{s.version}"
  }
  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.dependency   "React-Core"
  s.frameworks   = "Speech", "AVFoundation"
end

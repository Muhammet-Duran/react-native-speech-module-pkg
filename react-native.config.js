module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: "./android",
        packageImportPath: "import com.speechmodule.SpeechPackage;",
        packageInstance: "new SpeechPackage()",
      },
      ios: {},
    },
  },
};

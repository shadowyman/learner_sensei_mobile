module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^@shopify/react-native-skia$': '<rootDir>/jest-mocks/@shopify/react-native-skia.js',
    '^@callstack/liquid-glass$': '<rootDir>/jest-mocks/@callstack/liquid-glass.js',
    '^@react-native-community/blur$': '<rootDir>/jest-mocks/@react-native-community/blur.js',
    '^react-native-document-picker$': '<rootDir>/jest-mocks/react-native-document-picker.js',
    '^react-native-fs$': '<rootDir>/jest-mocks/react-native-fs.js',
    '^react-native-linear-gradient$': '<rootDir>/jest-mocks/react-native-linear-gradient.js',
    '^react-native-webview$': '<rootDir>/jest-mocks/react-native-webview.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-fs)/)',
  ],
};

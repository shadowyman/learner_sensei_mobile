module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^@shopify/react-native-skia$': '<rootDir>/__mocks__/@shopify/react-native-skia.js',
    '^react-native-document-picker$': '<rootDir>/__mocks__/react-native-document-picker.js',
    '^react-native-fs$': '<rootDir>/__mocks__/react-native-fs.js',
    '^react-native-linear-gradient$': '<rootDir>/__mocks__/react-native-linear-gradient.js',
    '^react-native-webview$': '<rootDir>/__mocks__/react-native-webview.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-fs)/)',
  ],
};

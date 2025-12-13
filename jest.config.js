/**
 * @type {import('jest').Config}
 */
let useSwc = true;

try {
  require('@swc/core');
  console.info('[jest] Using @swc/jest transformer');
} catch (error) {
  useSwc = false;
  const message = error instanceof Error ? error.message : String(error);
  console.warn('[jest] Falling back to ts-jest transformer', message);
}

const transformConfig = useSwc
  ? ['@swc/jest', { module: { type: 'es6' }, jsc: { target: 'es2022' } }]
  : ['ts-jest', { useESM: true, tsconfig: 'tsconfig.jest.json' }];

const config = {
  clearMocks: true,
  collectCoverage: false,
  collectCoverageFrom: [
    '<rootDir>/src/adaptiveEngine.ts',
    '<rootDir>/src/curriculum.ts',
    '<rootDir>/src/geminiService.ts',
    '<rootDir>/src/interactionHelpers.ts',
    '<rootDir>/src/moduleSelectionHandler.ts',
    '<rootDir>/src/selectionSensei.ts',
    '<rootDir>/src/ui.ts',
    '<rootDir>/src/prompts.ts'
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageThreshold: {
    global: {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0
    }
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^react-native-webview$': '<rootDir>/__mocks__/react-native-webview.js',
    '^\\./interactionHelpers\\.js$': '<rootDir>/src/interactionHelpers.ts',
    '^\\./selectionSensei\\.js$': '<rootDir>/src/selectionSensei.ts',
    '^\\./ui\\.js$': '<rootDir>/src/ui.ts',
    '^\\./curriculum\\.js$': '<rootDir>/src/curriculum.ts',
    '^\\./mermaidManager\\.js$': '<rootDir>/src/mermaidManager.ts',
    '^\\./index$': '<rootDir>/__mocks__/index.ts',
    '^\\./codeEditorModal$': '<rootDir>/__mocks__/codeEditorModal.ts',
    '^@google/genai$': '<rootDir>/__mocks__/@google/genai.js',
    '^@google/generative-ai$': '<rootDir>/__mocks__/@google/generative-ai.js',
    '^\\.\\./adaptiveEngine$': '<rootDir>/src/adaptiveEngine.ts',
    '^\\.\\./curriculum$': '<rootDir>/src/curriculum.ts',
    '^\\.\\./geminiService$': '<rootDir>/src/geminiService.ts',
    '^\\.\\./interactionHelpers$': '<rootDir>/src/interactionHelpers.ts',
    '^\\.\\./moduleSelectionHandler$': '<rootDir>/src/moduleSelectionHandler.ts',
    '^\\.\\./notepad$': '<rootDir>/src/notepad.ts',
    '^\\.\\./notepadImporter$': '<rootDir>/src/notepadImporter.ts',
    '^\\.\\./prompts$': '<rootDir>/src/prompts.ts',
    '^\\.\\./saveloadProgressManager$': '<rootDir>/src/saveloadProgressManager.ts',
    '^\\.\\./saveloadSerialization$': '<rootDir>/src/saveloadSerialization.ts',
    '^\\.\\./selectionSensei$': '<rootDir>/src/selectionSensei.ts',
    '^\\.\\./ui$': '<rootDir>/src/ui.ts',
    '^\\.\\./logger$': '<rootDir>/src/logger.ts',
    '^\\.\\./consolidationManager$': '<rootDir>/src/consolidationManager.ts',
    '^\\.\\./mermaidManager$': '<rootDir>/src/mermaidManager.ts',
    '^\\.\\./codeEditorModal$': '<rootDir>/__mocks__/codeEditorModal.ts',
    '^\\.\\./mermaid-theme-integration\\.js$': '<rootDir>/src/mermaid-theme-integration.js',
    '^\\.\\./mermaidErrorRecovery$': '<rootDir>/src/mermaidErrorRecovery.ts',
    '^mocks/(.*)$': '<rootDir>/__mocks__/$1',
    '^.+\\.(css|sass|scss|less)$': '<rootDir>/__mocks__/styleStub.js',
    '^.+\\.(gif|ttf|eot|svg|png|jpg|jpeg|webp)$': '<rootDir>/__mocks__/assetStub.js',
    '^.+\\.(txt)$': '<rootDir>/__mocks__/textStub.js'
  },
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: '<rootDir>/__tests__/reports',
      filename: 'index.html',
      expand: true,
      pageTitle: 'Jest Test Report'
    }]
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/tmp/', '/tests/'],
  transform: {
    '^.+\\.(t|j)sx?$': transformConfig
  },
  transformIgnorePatterns: ['node_modules/(?!(?:.*\\.mjs$))']
};

module.exports = config;

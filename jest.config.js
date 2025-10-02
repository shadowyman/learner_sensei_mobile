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
    '<rootDir>/adaptiveEngine.ts',
    '<rootDir>/curriculum.ts',
    '<rootDir>/geminiService.ts',
    '<rootDir>/interactionHelpers.ts',
    '<rootDir>/moduleSelectionHandler.ts',
    '<rootDir>/selectionSensei.ts',
    '<rootDir>/ui.ts',
    '<rootDir>/prompts.ts'
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
    '^\\./interactionHelpers\\.js$': '<rootDir>/interactionHelpers.ts',
    '^\\./selectionSensei\\.js$': '<rootDir>/selectionSensei.ts',
    '^\\./ui\\.js$': '<rootDir>/ui.ts',
    '^\\./curriculum\\.js$': '<rootDir>/curriculum.ts',
    '^\\./mermaidManager\\.js$': '<rootDir>/mermaidManager.ts',
    '^.+\\.(css|sass|scss|less)$': '<rootDir>/__mocks__/styleStub.js',
    '^.+\\.(gif|ttf|eot|svg|png|jpg|jpeg|webp)$': '<rootDir>/__mocks__/assetStub.js'
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

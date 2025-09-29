# Jest Test Harness

## Running The Suite
- `npm test` executes Jest with coverage enabled.
- `npm test -- --watch` runs Jest in watch mode for interactive workflows.
- Keep `npx tsc --noEmit` in CI alongside Jest to preserve static type checking.

## Default Environment
- Tests execute with jsdom by default to mirror browser-facing modules.
- Opt into the Node environment per file by adding the pragma `/** @jest-environment node */` at the top of a test when DOM APIs are unnecessary.

## Global Shims And Utilities
- Global browser shims live in `jest.setup.ts`. ResizeObserver, IntersectionObserver, DOMRect, matchMedia, localStorage, sessionStorage, TextEncoder, TextDecoder, crypto.randomUUID, window.ai, hljs, anime, and simple File/Blob helpers are initialized there.
- Extend the setup by appending new shims to `jest.setup.ts` when modules rely on additional browser or AI APIs.
- Asset and style imports resolve to `__mocks__/assetStub.js` and `__mocks__/styleStub.js` to keep tests lightweight.

## Google GenAI Mocking
- Manual mocks for `@google/genai` reside in `__mocks__/@google/genai.ts`.
- Configure responses per test with `__setMockGenerativeContent` and reset state using `__resetMockGenerativeContent`.
- Streaming helpers yield async iterator chunks with optional delays for deterministic fake timer scenarios.

## Transformer Strategy
- The default configuration uses `@swc/jest` targeting NodeNext/ESM for fast transpilation.
- If ESM interop issues surface, switch to `ts-jest` by updating `jest.config.ts` to use `ts-jest/presets/default-esm` and set `globals['ts-jest'] = { useESM: true }`. Retain `tsconfig.jest.json` but change its `module` option to `commonjs` only when CommonJS fallback is required.
- Revert to the SWC path once the ESM fixes land to minimize compile times.

## Extending Placeholder Suites
- Smoke tests live in `__tests__/` and focus on high-impact modules: adaptiveEngine, curriculum, geminiService, interactionHelpers, moduleSelectionHandler, selectionSensei, ui, and prompts.
- Replace `test.todo` entries with richer fixtures as real scenarios arrive.
- Leverage the shared shims and mocks above to cover DOM streaming, LLM integration flows, and prompt outputs without re-creating boilerplate.

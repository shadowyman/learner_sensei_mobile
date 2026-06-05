# Mission State: LLM Stream PR Review Remediation

Created: 2026-06-05T00:30:38Z

## Current analysis scope and entry points

This checkpoint covers remediation for the first five actionable inline comments on PR #1 for branch `codex/llm-streaming-core-bff-migration`. The sixth review comment, about keeping the real Gemini smoke out of default `bff npm test`, is explicitly out of scope because the user confirmed that default inclusion was a deliberate migration requirement.

The fresh full analyzer snapshot was run with `npm run analysis:run` from `/Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh`. `tmp/analysis/brief.md` reports `src/index.tsx` as top fan-out, `src/moduleSelectionHandler.ts` as another high fan-out WebView orchestrator, `src/ui.ts` as a major DOM/state risk hotspot, `bff/src/container.js` and `bff/src/server.js` as BFF hubs, and `bff/src/services/streamingService.js` as a global-heavy stream/timer file. The selected remediation entry points are `src/index.tsx::generateNextSenseiResponse`, `src/index.tsx::handleReloadSenseiMessage`, `src/moduleSelectionHandler.ts::ModuleSelectionHandler.executePhaseSelection`, `src/interactionHelpers.ts::streamModuleIntroduction`, `src/interactionHelpers.ts::streamMainSenseiResponse`, `core/mainSenseiResponse.ts::buildMainSenseiResponsePrompt`, `core/moduleIntroduction.ts::buildModuleIntroductionPrompt`, `bff/src/controllers/sessionController.js::SessionController.submitLlmStream`, `bff/src/services/streamingService.js::StreamingService.handleLlmStreamConnection`, and `bff/src/integration/geminiGateway.js::GeminiGateway.streamMainResponse`.

## Static execution trace mapping

For module introduction, `ModuleSelectionHandler.executePhaseSelection` creates a Sensei intro bubble and calls `streamModuleIntroduction`. On mobile, `streamModuleIntroduction` uses `requestLlmStreamViaBridge`, React Native forwards the request through `BffClient.submitLlmStream`, BFF stores the request, `StreamingService.handleLlmStreamConnection` builds a Core prompt through `SenseiCoreAdapter.buildCapabilityPrompt`, and `GeminiGateway.streamMainResponse` streams chunks back over WebSocket. On reload, `handleReloadSenseiMessage` currently calls `streamModuleIntroduction` without the structured request, which is the reload regression.

For main Sensei responses, `generateNextSenseiResponse` builds standard or Socratic prompt context, creates a `mainSenseiLlmStreamRequest`, displays a reloadable loading bubble, and calls `streamMainSenseiResponse`. On mobile the same bridge/BFF/Core/Gemini path is used. The migrated payload currently contains only current-turn prompt ingredients, while the browser path historically relied on persistent `mainSenseiChat` history and `SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS`.

For BFF validation, `SessionController.submitLlmStream` validates schema, rate-limits, stores the pending stream request, and returns a WebSocket URL. It does not currently enforce the `/turns` `MAX_INPUT_CHARS` cap for capability payload learner-input fields.

For stream lifecycle, `StreamingService.handleLlmStreamConnection` emits `started`, starts keepalive, starts a hard timeout from `config.hardStreamTimeoutMs`, builds the Core prompt, calls `geminiGateway.streamMainResponse`, sends chunks, then emits `completed`. The timeout currently defaults to 60 seconds even for long main-response provider streams.

## Dependency and side-effect analysis

`src/index.tsx::generateNextSenseiResponse` depends on curriculum state, learner model, pedagogical profiler output, prompt wrappers, UI rendering, and history arrays. Its side effects include DOM rendering through `displayMessage`, teaching history mutation, enhancer start/finalize, and WebView/native stream initiation through the wrapper. Risk is high because changing payload construction affects standard and Socratic mobile teaching turns.

`src/moduleSelectionHandler.ts::executePhaseSelection` depends on curriculum/module selection state, teaching plan state, UI rendering, Core prompt-compatible context, and stream wrappers. Analyzer marks it as a high side-effect hotspot with DOM, timer, and state writes. Risk is high because it owns the first post-selection Sensei bubble and reload context.

`src/interactionHelpers.ts::streamModuleIntroduction` and `src/interactionHelpers.ts::streamMainSenseiResponse` depend on native stream bridge availability, Core request types, `updateMessageStream`, and optional enhancer controller. Analyzer side effects are not fully captured because bridge and DOM effects are through imported functions. Risk is medium-high because they must preserve progressive UI updates.

`core/mainSenseiResponse.ts::buildMainSenseiResponsePrompt` and `core/moduleIntroduction.ts::buildModuleIntroductionPrompt` are pure builders. Risk is high for behavior but low for side effects. They are the right place to preserve server-side persona/history prompt semantics without sending final prompt text from mobile.

`bff/src/controllers/sessionController.js::submitLlmStream` depends on Zod schemas, session service, rate limiter, streaming service, and API error helpers. Risk is medium because validation changes can reject legitimate mobile requests or allow oversized payloads.

`bff/src/services/streamingService.js::handleLlmStreamConnection` depends on pending request state, timers, Core adapter, Gemini gateway, and WebSocket state. Analyzer flags timer and state-write effects. Risk is high because wrong timeout or cleanup behavior can leave sockets open or close active streams.

`bff/src/integration/geminiGateway.js::streamMainResponse` depends on Gemini SDK, model config, safety settings, provider timeout, and fallback policy. Risk is medium-high because it is the provider execution boundary for this migration.

## Risk register and coverage checklist

High risks:

- Mobile reload may bypass BFF/Core for module introductions. Validation: WebView interaction test must assert `moduleIntro` reload passes `llmStreamRequest` into `streamModuleIntroduction`.
- Mobile main streams may lose chat context. Validation: Core prompt parity/test must assert structured `conversationHistory` appears in the server-built prompt, and WebView payload test must assert history is sent structurally.
- BFF/Core stream prompt may omit base persona. Validation: Core prompt test must assert the base persona section is included when provided, and BFF deterministic integration must assert gateway prompt contains the marker.
- `/llm-stream` may accept oversized learner inputs. Validation: deterministic BFF test must assert oversized `currentUserInput` and `userInputText` return 413.
- Long active LLM stream may be closed at 60 seconds. Validation: deterministic BFF test must assert the timeout used for LLM capability streams comes from the main response timeout when larger than generic stream timeout.

Coverage checklist:

- `src/moduleSelectionHandler.ts::ModuleSelectionHandler.executePhaseSelection`
- `src/index.tsx::generateNextSenseiResponse`
- `src/index.tsx::handleReloadSenseiMessage`
- `src/interactionHelpers.ts::streamModuleIntroduction`
- `src/interactionHelpers.ts::streamMainSenseiResponse`
- `core/mainSenseiResponse.ts::buildMainSenseiResponsePrompt`
- `core/moduleIntroduction.ts::buildModuleIntroductionPrompt`
- `bff/src/controllers/sessionController.js::SessionController.submitLlmStream`
- `bff/src/services/streamingService.js::StreamingService.handleLlmStreamConnection`
- `bff/src/integration/geminiGateway.js::GeminiGateway.streamMainResponse`

## Assumptions and unknowns register

Assumption: bounded structured history is acceptable for mobile parity because the prior browser chat history may be large and opaque, while the app already maintains recent user and Sensei history arrays. Impact: medium. Verification: tests assert included recent history order and no final prompt text is sent from mobile.

Assumption: preserving base persona by embedding it server-side in the Core prompt envelope satisfies the behavioral contract even though Gemini `generateContentStream` is not using a separate `systemInstruction` field for this BFF path. Impact: high. Verification: Core/BFF tests assert the base persona text is present in the prompt sent to the gateway.

Assumption: the LLM capability hard timeout should be the maximum of generic stream timeout and Gemini main response timeout. Impact: medium. Verification: deterministic BFF test with fake timers or injected config asserts the longer timeout is used.

Unknown: fresh post-Socratic-fix manual simulator behavior still needs provider quota. Impact: medium. Verification: user-provided simulator/WebView/BFF logs after quota is available; tracked in the ExecPlan.

## Architectural insights

The PR review confirms that migrating transport alone is insufficient. The capability boundary must also carry structured state needed to reconstruct browser-chat semantics server-side. The right fix is not to send final prompt strings from WebView, but to extend the structured Core request with bounded history and base-persona identity so Core/BFF own final prompt assembly.

## Triggering protocol

The triggering protocol is Mandatory Adaptive Root Cause Analysis and Remediation for PR-review defects, with Comprehensive Impact Analysis folded into the remediation notes. The user explicitly approved robust fixes and requested push plus GitHub comment replies after remediation.

## Functional-test traceability

Planned tests will import or exercise production modules as follows: Core prompt tests import `@sensei/core/mainSenseiResponse` and `@sensei/core/moduleIntroduction`; WebView/Jest interaction tests import `src/interactionHelpers.ts`, `src/index.tsx`, or module-selection helpers through existing test seams; BFF deterministic integration starts the real BFF server and exercises `POST /sessions/:sessionId/llm-stream` plus WebSocket streaming through production controllers/services with a deterministic gateway override.

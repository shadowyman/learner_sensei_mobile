# LLM Streaming Migration Core Analysis Checkpoint

Timestamp: 2026-06-04T20:36:36Z

Fresh checkout: `/Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh`

Triggering workflow: Module introduction and main Sensei response streaming Core/BFF migration, continuing `docs/execplans/module_intro_main_sensei_streaming_core_bff_migration_execplan.md`.

Next protocol: COMPREHENSIVE IMPACT ANALYSIS PROTOCOL.

## Protocol Inputs Read

- `AGENTS.md`
- `docs/protocols/PLAN.md`
- `docs/protocols/MANDATORY_CORE_ANALYSIS_PROTOCOL_STEP_0.md`
- `docs/mission_state/mission_state_llm_streaming_migration_handoff_20260604T195400Z.md`
- `docs/execplans/module_intro_main_sensei_streaming_core_bff_migration_execplan.md`
- `docs/execplans/wrap_up_assessment_core_bff_migration_execplan.md` for existing BFF real-provider integration-test posture

## Environment Verification

The fresh BFF dependency tree passed the handoff checks from `/Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh/bff`.

Observed output:

    zod start
    zod done
    server start
    server done

The server import also loaded `.env` through dotenv and completed without hanging. This confirms the fresh checkout does not currently show the old Documents checkout's dataless `zod` import failure.

## Analyzer Runs

All analyzer commands completed with exit code 0.

Baseline snapshots were run before and after focused/DOM scoped passes so `tmp/analysis/brief.md`, `brief.json`, `summary.txt`, `functions.json`, `calls.json`, `fan_in.json`, and `fan_out.json` currently reflect a full-repo snapshot.

Commands run:

    npm run analysis:run
    npm run analysis:run -- --entry src/interactionHelpers.ts::streamModuleIntroduction --maxDepth 5
    cp tmp/analysis/focused_trace.txt tmp/analysis/focused_trace_module_intro.txt
    npm run analysis:run -- --entry src/interactionHelpers.ts::streamMainSenseiResponse --maxDepth 5
    cp tmp/analysis/focused_trace.txt tmp/analysis/focused_trace_main_sensei_response.txt
    npm run analysis:run -- --include interactionHelpers.ts,moduleSelectionHandler.ts,index.tsx,webviewMessageRouter.ts,ui.ts --dom-index

Saved DOM-scoped artifacts:

- `tmp/analysis/brief_streaming_dom_scope.md`
- `tmp/analysis/domsuite_index_streaming_scope.json`
- `tmp/analysis/domsuite_handlers_streaming_scope.json`
- `tmp/analysis/domsuite_templates_streaming_scope.json`

## Entry Points And Scope

Primary migration entry points:

- `src/interactionHelpers.ts::streamModuleIntroduction`
- `src/interactionHelpers.ts::streamMainSenseiResponse`

Analyzer-confirmed callers:

- `src/moduleSelectionHandler.ts::ModuleSelectionHandler.executePhaseSelection` calls `streamModuleIntroduction` for non-Socratic phase intros.
- `src/moduleSelectionHandler.ts::ModuleSelectionHandler.sendSystemSocraticMessage` calls `streamMainSenseiResponse` for Socratic system introduction messages.
- `src/index.tsx::generateNextSenseiResponse` calls `streamMainSenseiResponse` for normal user turns.
- `src/index.tsx::handleReloadSenseiMessage` calls both streaming functions for reloads.

Hot modules from analyzer fan-in/fan-out and risk drilldowns:

- `src/index.tsx`: top fan-out file, builds normal main-response dynamic context and reload contexts.
- `src/moduleSelectionHandler.ts`: high side-effect/risk function `executePhaseSelection`; builds module-intro context.
- `src/interactionHelpers.ts`: scoped wrappers currently do direct `chat.sendMessageStream`.
- `src/curriculum.ts`: focus derivation plus prompt-language builders for current turn.
- `src/prompts.ts`: currently owns module-intro and main-response prompt text.
- `src/ui.ts`: `updateMessageStream` applies streamed text to DOM and sends native render progress.
- `src/mobile/webviewMessageRouter.ts` and `src/mobile/webviewBridge.ts`: WebView/RN bridge request/result pattern.
- `SenseiMobile/src/mobile/network/BffClient.ts`: existing async-iterable WebSocket queue and HTTP route patterns.
- `SenseiMobile/src/mobile/MainScreen.tsx`: WebView message dispatcher to BFF client.
- `SenseiMobile/src/mobile/bridge/contracts.ts`: RN/WebView message union types.
- `bff/src/server.js` and `bff/src/container.js`: route/service wiring.
- `bff/src/stream/streamServer.js` and `bff/src/services/streamingService.js`: old `/stream?turnId=` WebSocket scaffold.
- `bff/src/integration/geminiGateway.js`: server-side provider adapter and fallback behavior.

## Static Execution Trace

### Module Introduction

Current flow:

1. `ModuleSelectionHandler.executePhaseSelection`
2. `getCurriculumFocusInstruction(...)`
3. `calculateFocusPoints(...)`
4. `buildSenseiDynamicSystemInstruction(...)`
5. `MODULE_INTRODUCTION_TASK_TEMPLATE(...)`
6. `streamModuleIntroduction(chat, introContext, moduleTitleForPrompt, senseiMessageId, { enhancerController })`
7. `logSenseiPromptValidation(...)`
8. `chat.sendMessageStream({ message: introContext + "\n\nLet's begin ..." })`
9. For every chunk: accumulate text, optionally `KeyTakeawayEnhancerController.onChunk(...)`, then `updateMessageStream(...)`
10. At stream end: optionally `KeyTakeawayEnhancerController.finalize()` and return `getLatestText()`, otherwise return accumulated text.

Focused trace file: `tmp/analysis/focused_trace_module_intro.txt`.

### Main Sensei Response

Current flow:

1. `generateNextSenseiResponse` or reload/Socratic system callers
2. `calculateFocusPoints(...)`
3. `getCurriculumFocusInstruction(...)`
4. `buildSocraticExecutionInstruction(...)` for Socratic turns, otherwise `buildSenseiDynamicSystemInstruction(...)`
5. `streamMainSenseiResponse(chat, dynamicContext, currentUserInput, senseiMessageId, { enhancerController })`
6. Build `User: ${currentUserInput}` and replace `USER_LAST_INPUT_PLACEHOLDER`, or append the user line.
7. `logSenseiPromptValidation(...)`
8. `chat.sendMessageStream({ message })`
9. For every chunk: track first-chunk latency/chunk count, accumulate text, optionally `KeyTakeawayEnhancerController.onChunk(...)`, then `updateMessageStream(...)`
10. At stream end: log stream metrics, optionally finalize enhancer and return latest text, otherwise return accumulated text.

Focused trace file: `tmp/analysis/focused_trace_main_sensei_response.txt`.

### Existing BFF/RN Stream Scaffold

Current old scaffold:

1. `BffClient.submitTurn(...)`
2. `POST /sessions/:sessionId/turns`
3. `SessionController.submitTurn(...)`
4. `TurnService.createOrGetTurn(...)`
5. Response `{ turnId, streamUrl: /sessions/:sessionId/stream?turnId=... }`
6. `BffClient.createStream(streamUrl, turnId)` opens WebSocket and yields async stream events.
7. `streamServer.js` only accepts `/sessions/:sessionId/stream?turnId=...`.
8. `StreamingService.handleConnection({ ws, sessionId, turnId })` looks up turn, builds prompt via `senseiCoreAdapter.buildPrompt(context)`, streams through `GeminiGateway.streamMainResponse(...)`, emits `status`, `chunk`, optional `wrapUp`, and errors.

Important finding: current production WebView chat path is not using `submitTurn`; it still calls WebView-local direct streaming. Existing `submitTurn` consumers are tests and scaffold/docs, not the current WebView chat path.

## Dependency And Side-Effect Analysis

| Function / Module | Dependencies | Side Effects | Risk |
|---|---|---|---|
| `streamModuleIntroduction` | Gemini `Chat`, `introContext`, `moduleTitleForPrompt`, `KeyTakeawayEnhancerController`, `updateMessageStream` | External LLM streaming, DOM update through `updateMessageStream`, enhancer state | High cost, high behavior risk; must preserve per-chunk UI and final return behavior |
| `streamMainSenseiResponse` | Gemini `Chat`, dynamic context, `USER_LAST_INPUT_PLACEHOLDER`, enhancer, `updateMessageStream` | External LLM streaming, DOM update, logs first-chunk latency | High cost, high behavior risk; sentinel must prevent mobile direct `chat.sendMessageStream` |
| `buildSenseiDynamicSystemInstruction` | `MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION`, guidance parsing | Prompt text generation only | High architecture risk because prompt ownership moves to Core |
| `buildSocraticExecutionInstruction` | Socratic teaching plan and guidance objects, `buildSocraticInitialInstruction` | Prompt text generation only | Medium-high risk; Socratic system message currently uses main-response stream path |
| `ModuleSelectionHandler.executePhaseSelection` | Curriculum state, prompt builders, display/update helpers, enhancer | DOM writes, state writes, timers, response history | High blast radius; module-intro payload shape must preserve this state-derived context |
| `generateNextSenseiResponse` | Curriculum/adaptive state, focus builders, enhancer, stream wrapper | DOM writes, learner/curriculum state writes, response history | High blast radius; main-response payload must include enough structured state |
| `handleReloadSenseiMessage` | Reload context, stream wrappers, enhancer | DOM update/reload state | Medium-high; reloads need either structured payloads or a documented compatibility path |
| `getCurriculumFocusInstruction` | `calculateFocusPoints`, primary action builders, curriculum item/state | Prompt text generation | High architecture risk; prompt-language pieces should move to Core while state calculation stays WebView |
| `calculateFocusPoints` | Curriculum state teaching-plan chunk, covered/revisit sets | Pure derivation | Medium; safe WebView-owned structured input candidate |
| `updateMessageStream` | DOM `messageId`, markdown sanitizer/parser, native bridge progress, code block enhancement | DOM writes and `render:progress` bridge message | High UI risk; migrated stream must still call this per chunk in WebView |
| `KeyTakeawayEnhancerController.onChunk/finalize/getLatestText` | Placeholder detection, optional enhancer LLM call, `updateMessageStream` | State writes, timers, optional external LLM call, DOM update | High; this pass preserves hooks but does not migrate enhancer internals |
| `BffClient.createStream` | WebSocket implementation, async queue, bridge enqueue for wrap-up | WebSocket handlers, queue state, bridge messages | Medium-high; can be reused for `submitLlmStream` but must carry request/message/capability identity |
| `MainScreen.handleWebViewMessage` | Parsed WebView messages, `BffClient`, `BridgeManager` | Async BFF calls, bridge enqueue to WebView | Medium-high; add `llmStream` request handling here |
| `StreamingService.handleConnection` | Turn store, prompt adapter, `GeminiGateway`, wrap-up service | Timers, WebSocket writes, provider streaming | High; new capability stream should not depend on `turnId` |
| `GeminiGateway.streamMainResponse` | `@google/genai`, model config, fallback splitter | External network stream; currently catches provider errors and yields deterministic fallback | High; real Gemini smoke test must disable or detect fallback |
| `streamServer.js` | `ws`, URL path parser, `StreamingService` | WebSocket server handling | Medium; needs new `/llm-stream?requestId=` path |

## Risk Register

1. Mobile accidentally continues using browser Gemini or `chat.sendMessageStream`.
   Impact: High. Verification: Mobile Routing Gate sentinel for both scoped functions must fail if mobile path calls `chat.sendMessageStream`, browser Gemini chat, or browser `CoreLlmClient`.

2. Prompt drift when moving wording into Core.
   Impact: High. Verification: Core prompt parity tests should hash or string-compare representative module-intro and main-response prompts against old builders.

3. WebView sends full prompt bodies to BFF under the label of structured payloads.
   Impact: High. Verification: inspect payload builders and add tests asserting mobile payloads contain structured fields, not final prompt strings or known prompt-template sections.

4. Real Gemini smoke passes on local fallback text.
   Impact: High. Verification: add `allowFallback: false` / `requireRealProvider: true` or provider provenance for `bff/tests/llmStream.realGemini.int.test.js`.

5. BFF WebSocket request store leaks abandoned requests.
   Impact: Medium-high. Verification: request store expiration tests for unknown, expired, consumed, and mismatched requests.

6. Existing `/turns` scaffold behavior regresses.
   Impact: Medium. Verification: keep or update existing `BffClient` tests and BFF tests; remove/deprecate only after impact analysis proves no production consumer.

7. Key-takeaway enhancer stream behavior regresses.
   Impact: Medium-high. Verification: interaction-helper tests for enhancer `onChunk`, `finalize`, and final `getLatestText`; do not migrate enhancer internals in this pass.

8. WebView per-chunk UI behavior changes to buffered-only.
   Impact: High. Verification: wrapper tests and manual simulator validation confirm progressive `updateMessageStream` calls.

9. Core export/package subpaths are incomplete.
   Impact: Medium. Verification: `npm run core:build`, root Jest imports from `@sensei/core/...`, and BFF `require('@sensei/core')` work.

## Unknowns Register

| Unknown | Impact | Verification Plan | Owner / Target |
|---|---|---|---|
| Exact structured payload fields for `moduleIntroduction` | High | Impact analysis/source review of `ModuleSelectionHandler.executePhaseSelection`, `curriculum.ts`, and current prompt builders; parity tests lock output | Current agent before implementation |
| Exact structured payload fields for `mainSenseiResponse` | High | Impact analysis/source review of `generateNextSenseiResponse`, Socratic branch, reload branch, and focus builders; parity tests lock output | Current agent before implementation |
| Whether reload paths should be migrated fully or temporarily use compatibility fields | Medium-high | Impact analysis and tests for `handleReloadSenseiMessage`; document any temporary compatibility decision in ExecPlan | Current agent before implementation |
| Whether old `/turns` scaffold should be removed, kept, or deprecated | Medium | Comprehensive Impact Analysis over references and tests; current evidence shows scaffold/tests/docs only, not current WebView chat production path | Current agent during impact protocol |
| Best test injection point for deterministic BFF stream test | Medium | Inspect `startServer`/container patterns; choose either dependency injection or route-local test gateway pattern | Current agent during BFF implementation |
| Real Gemini smoke credential/model reliability | Medium-high | Include real smoke in default `bff npm test`; strict provider mode; failures triaged separately from deterministic transport failures | Current agent during validation |

All high-impact unknowns have explicit verification plans, satisfying Core Analysis Step 5 gate.

## Coverage Checklist

Production modules the planned tests should import or exercise:

- Core prompt/capability parity:
  - `core/prompts/moduleIntroduction.ts`
  - `core/prompts/mainSenseiResponse.ts`
  - `core/moduleIntroduction.ts`
  - `core/mainSenseiResponse.ts`
  - compatibility exports from `src/prompts.ts` and `src/interactionHelpers.ts` as needed for old/new parity
- WebView wrappers and mobile routing:
  - `src/interactionHelpers.ts`
  - `src/moduleSelectionHandler.ts`
  - `src/index.tsx`
  - `src/mobile/webviewMessageRouter.ts`
  - new streaming routing helper if introduced
- BFF deterministic and real-provider stream tests:
  - `bff/src/routes/llmStream.js`
  - `bff/src/controllers/llmStreamController.js`
  - `bff/src/services/llmStreamRequestStore.js`
  - `bff/src/services/streamingService.js`
  - `bff/src/stream/streamServer.js`
  - `bff/src/integration/geminiGateway.js`
  - `bff/src/server.js`
  - `bff/src/container.js`
- RN client/bridge tests:
  - `SenseiMobile/src/mobile/network/BffClient.ts`
  - `SenseiMobile/src/mobile/network/types.ts`
  - `SenseiMobile/src/mobile/bridge/contracts.ts`
  - `SenseiMobile/src/mobile/MainScreen.tsx`

Existing test candidates confirmed:

- `__tests__/interactionHelpers.test.ts`
- `__tests__/corePromptParity.test.ts`
- `__tests__/BffClient.test.ts`
- `__tests__/teachingPlan.mobileRoutingGate.sentinel.test.ts`
- `__tests__/wrapUpAssessment.mobileRoutingGate.sentinel.test.ts`
- `bff/tests/teachingPlan.int.test.js`
- `bff/tests/wrapUp.int.test.js`
- `bff/tests/analysis.int.test.js`
- `bff/tests/jsonBodyLimit.int.test.js`

## Architectural Insights

- Existing Core migration patterns already exist for wrap-up, teaching-plan, learner-analysis, and Mermaid repair. New streaming capability modules should follow the same pattern: Core owns prompt/capability shape; BFF owns provider calls; WebView/RN own UI and bridge.
- The WebView wrappers should remain the UI streaming integration points because `updateMessageStream` performs DOM rendering and emits native render progress. BFF/RN should not directly decide WebView DOM updates for these migrated capabilities.
- The old `/turns` abstraction is conceptually wrong for module introductions and too thin for structured main Sensei context. It can still inform WebSocket queue mechanics, error handling, and test patterns.
- `GeminiGateway.streamMainResponse` currently catches provider errors and yields fallback chunks internally. That is acceptable for product resilience only if tests can distinguish fallback from real Gemini. The real smoke test must use strict no-fallback behavior or provider provenance.

## Clarified Objectives

The user explicitly directed execution of the ExecPlan and confirmed that a real Gemini smoke integration test must be included in default `bff npm test`, matching existing BFF integration test behavior. No further clarification is required before proceeding to impact analysis.

## Next Step

Core analysis complete. I have mapped the execution trace and identified the dependencies and side effects. I am now ready to proceed with the COMPREHENSIVE IMPACT ANALYSIS PROTOCOL.

## Post-Core Protocol Update: Impact And Architecture

Timestamp: 2026-06-04T21:08:00Z

Comprehensive Impact Analysis completed after this checkpoint. The migration is now classified as Risk 5 mixed Data, Control, Interface, State, and Configuration work because it changes prompt ownership, server transport, mobile bridge contracts, WebSocket lifecycle, and default BFF real-provider test behavior across WebView, React Native, BFF, and Core.

Architectural Synthesis Steps 0-5 also completed. The recommended architecture is the additive capability-stream route:

- WebView remains the teaching-state and UI-streaming owner.
- Core builds final prompts from structured capability requests.
- BFF validates payloads, stores short-lived stream requests, owns provider execution and strict no-fallback real-provider test behavior.
- React Native owns BFF transport and bridge forwarding.

The old `/sessions/:sessionId/turns` route and `BffClient.submitTurn` should remain during this implementation unless a later implementation-specific blocker proves removal is safer. Impact analysis found that old route is not the production path for the scoped WebView stream functions, but it remains scaffolded and tested.

The ExecPlan now contains the full Comprehensive Impact Analysis and Architectural Synthesis details, including the required approval gate before implementation protocol starts.

## Architecture Approval Update

Timestamp: 2026-06-05T00:00:00Z

The user approved proceeding with the additive capability-stream architecture recorded in `docs/execplans/module_intro_main_sensei_streaming_core_bff_migration_execplan.md`.

Next required protocol step: transition to the MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL, read the TEST IMPLEMENTATION PROTOCOL before creating or modifying tests, and create the required repository backup before non-doc project edits.

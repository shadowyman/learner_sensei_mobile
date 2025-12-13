# Wrap-Up Assessment Core/BFF Migration (Phase 1 Mobile/Web)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `docs/protocols/PLAN.md` and the repository protocols in `docs/protocols/*.md`. It assumes the mission-state checkpoint file `docs/mission_state/mission_state_wrap_up_assessment_core_migration_20251210T000000Z.md` exists and will be updated if scope or risks change.

## Purpose / Big Picture

After this change, both desktop web and the mobile WebView will use the same TypeScript implementation to generate wrap-up assessments. Desktop web continues to call Gemini from the browser via the Core browser client (parity with the pre-migration app), while the mobile WebView triggers the same Core tool through the BFF and `GeminiGateway`. A novice should be able to follow this plan to:

- Extract the wrap-up assessment generator into Core as a reusable tool behind `CoreLlmClient`.
- Wire the web bundle to call that Core tool via a browser-side `CoreLlmClient`.
- Implement a BFF endpoint that uses Core via `CoreLlmAdapter` and returns `WrapUpAssessmentOverlayData`.
- Wire the React Native mobile shell to trigger wrap-up through the BFF and show the same overlay in the WebView as the desktop web path.

When this plan is complete, a learner will be able to reach the Solidify phase for a module on both desktop and mobile, trigger a wrap-up assessment, and see a consistent overlay of 15 questions (with 5 snippet-based questions) that is generated via Core and transported through the BFF.

## Progress

- [x] (2025-12-10 00:00Z) Initial ExecPlan drafted and mission-state checkpoint created for wrap-up assessment migration.
- [x] (2025-12-12) Repository and environment sanity-check completed (Node, npm, workspace layout).
- [x] (2025-12-12) Core wrap-up tool introduced and exported from `@sensei/core`.
- [x] (2025-12-12) Web bundle updated to use Core-based wrap-up via a browser `CoreLlmClient`.
- [x] (2025-12-12) BFF non-streaming LLM primitive and `CoreLlmAdapter` extended for wrap-up.
- [x] (2025-12-12) BFF wrap-up service and HTTP route implemented and returning `WrapUpAssessmentOverlayData`.
- [x] (2025-12-12) `SenseiMobile` `BffClient` wired to call BFF wrap-up and bridge `wrapup:show` events to WebView.
- [x] (2025-12-12) Mobile routing gate wired (Pattern A): Solidify sends `wrapup:requestShow` to RN, RN calls BFF `/wrapup`, desktop keeps browser SDK path.
- [x] (2025-12-12) DRY wrap-up presentation gate: funnel every wrap-up receipt into one shared handler that validates, shows overlay, and on failure shows apology + unlocks.
- [x] (2025-12-12) Mobile wrap-up failure signaling: RN sends `wrapup:failed` to WebView when BFF wrap-up request fails or times out.
- [x] (2025-12-12) Mobile wrap-up client timeouts: add a configurable request timeout for wrap-up in `SenseiMobile` BFF client (separate knobs for mermaid vs wrap-up).
- [x] (2025-12-12) Mobile routing sentinel test: add a test that fails if the mobile WebView path calls a browser `CoreLlmClient` for wrap-up instead of sending `wrapup:requestShow`.
- [x] (2025-12-13) Mobile UX parity: keep Solidify phase-loading bubble visible until `wrapup:show`/`wrapup:failed` and clear it in the shared presenter.
- [x] (2025-12-13) BFF hardening: raise the JSON body limit (configurable) to a `3mb` default so large mobile wrap-up prompt contexts do not fail with `413`.
- [x] (2025-12-13) BFF hardening: rate-limit `POST /sessions/:sessionId/wrapup` (20s throttle + burst ban) to protect expensive LLM calls.
- [x] (2025-12-13) BFF LLM SDK parity: migrate BFF from deprecated `@google/generative-ai` to the recommended `@google/genai` and re-run integration tests.
- [ ] Manual validation of wrap-up behavior on desktop web.
- [ ] Manual validation of wrap-up behavior on mobile (iOS WebView).
- [x] (2025-12-12) Tests and logging updated; Outcomes & Retrospective written.
- [x] (2025-12-12) Restored wrap-up tool-calling parity with pre-migration web behavior (extended `CoreLlmClient` for tool calls, reverted wrap-up prompt/config, re-ran tests).

## Surprises & Discoveries

- Observation (resolved): Wrap-up logic was web-local; BFF wrap-up service and `/wrapup` route were missing.
  Evidence: prior stub in `bff/src/services/wrapUpService.js` and no route in `bff/src/routes/`; fixed during this ExecPlan.
- Discovery: Mobile routing required an explicit WebView→RN request to avoid the browser SDK path; implemented `wrapup:requestShow` bridge flow mirroring mermaid.
- Discovery: Core `CoreLlmClient` initially lacked tool/function-call support, so the first migration iteration temporarily used a plain-JSON wrap-up prompt. A follow-up parity pass will extend the Core LLM seam and revert wrap-up to the original tool-calling prompt + parsing to guarantee zero behavior drift.
- Discovery: Root Jest UI tests were executing `src/index.tsx` side effects via `src/ui.ts` importing `API_KEY`, causing circular-import crashes; resolved by mocking `./index` in Jest.
- Discovery: Wrap-up payload validation and error UX (apology + unlock) was duplicated across desktop entry points and not guarded for the mobile `wrapup:show` bridge path; add a single shared handler to keep behavior consistent and crash-resistant.
- Discovery: Mobile `promptContext` payloads can exceed the BFF’s default JSON body size; make the limit explicit/configurable and add a regression test for >2MB payloads.
- Discovery: The recommended Google SDK is now `@google/genai`; BFF is CommonJS, so use `import('@google/genai')` (dynamic import) rather than `require`.

## Decision Log

- Decision: Treat `generateWrapUpAssessment` as a pure Core tool and keep overlay rendering and Solidify orchestration in `src/index.tsx`, `src/moduleSelectionHandler.ts`, and `src/wrapUpAssessment.ts`.
  Rationale: This matches the Phase 1 architecture docs and the LLM tools migration plan, preserving WebView ownership of teaching and UI while centralizing LLM tools in Core.
  Date/Author: 2025-12-10 / Coding agent.

- Decision: Implement wrap-up over HTTP (`POST /sessions/:sessionId/wrapup`) first, and treat WebSocket-based `wrapUp` frames as optional follow-up work.
  Rationale: An HTTP route is simpler to validate and reason about, and it gives a clean, idempotent API that the mobile client can call on demand.
  Date/Author: 2025-12-10 / Coding agent.

- Decision: Preserve pre-migration wrap-up behavior by keeping Gemini tool/function-calling for wrap-up end-to-end. Extend `CoreLlmClient` with a minimal tool-call surface, revert the Core wrap-up prompt to instruct `submit_wrap_up_assessment` tool usage, and remove any wrap-up `responseMimeType: 'application/json'` configuration that conflicts with tool calls.
  Rationale: The user requirement is zero drift from the previous web app; tool calling + existing parsing is the canonical behavior for wrap-up.
  Date/Author: 2025-12-12 / Coding agent.

## Outcomes & Retrospective

- Core: Wrap-up generation now lives in `core/wrapUpAssessment.ts` and is exported as a reusable tool behind `CoreLlmClient`.
- Web/WebView: Solidify planners call the Core tool via a browser `CoreLlmClient`; `src/geminiService.ts::generateWrapUpAssessment` remains as a legacy wrapper for tests and fallback only.
- BFF: `GeminiGateway` routes `task: 'wrap_up_assessment'`; `WrapUpService` and `POST /sessions/:sessionId/wrapup` return `WrapUpAssessmentOverlayData` by invoking the Core tool through `CoreLlmAdapter`.
- Mobile: `SenseiMobile` calls the wrap-up endpoint via `BffClient.generateWrapUp` and forwards results to WebView with `wrapup:show`.
- Note: The initial migration iteration used a plain-JSON prompt due to the Core LLM seam shape; parity has now been restored to the original tool-calling behavior.
- Regressions fixed during migration:
  - Added missing `handleTurnResponse` in `SenseiMobile/src/mobile/network/BffClient.ts` to satisfy the MobileParitySentinel.
  - Prevented Jest circular-import crashes by mocking `src/index.tsx` exports needed by `src/ui.ts`.
- Validation status:
  - Automated: Root Jest suite passes (`npm test --silent --bail --noStackTrace`); BFF integration tests pass (mermaid + wrap-up) when run with local server/network permissions.
  - Manual desktop and iOS runtime validation remain pending; no behavior changes are expected beyond LLM routing.
- Lessons learned:
  - Keep Core tools provider-agnostic; avoid Gemini-specific function-call dependencies in Core prompts.
  - Jest tests that import UI modules should not execute `src/index.tsx` top-level initialization; mock narrow exports instead.

## Context and Orientation

This section assumes that the reader is starting from a fresh checkout of the repository and has no prior knowledge of the codebase beyond this plan.

The project is a multi-part system:

- `src/` contains the desktop/mobile WebView web app, including the teaching pipeline and wrap-up overlay rendering.
- `SenseiMobile/` contains the React Native shell for iOS/Android, which hosts the WebView and talks to the BFF.
- `bff/` is the Backend-for-Frontend server that will act as the single LLM and infrastructure proxy.
- `core/` (`@sensei/core`) houses reusable, environment-agnostic tools implemented in TypeScript (e.g., mermaid error recovery).

The wrap-up assessment feature currently works like this on desktop web:

- When a learner reaches the Solidify phase, `src/index.tsx::createLLMPlannerCallback` (entrypoint identified in `tmp/analysis/summary.txt`) decides whether to request a wrap-up assessment.
- It calls `src/geminiService.ts::generateWrapUpAssessment`, which:
  - Builds a prompt using a wrap-up-specific prompt builder.
  - Calls the Gemini SDK (`GoogleGenAI`) with wrap-up-specific configuration and tools.
  - Parses JSON or function-call results into a normalized `WrapUpAssessmentGenerationResult`, using helpers:
    - `normalizeWrapUpAssessmentQuestions`
    - `stripJsonFence`
    - `extractFunctionCall`
    - `extractQuestionsFromToolCode`
    - `reorderWrapUpAssessmentQuestions`
- The caller validates the questions using `src/wrapUpAssessment.ts::validateWrapUpAssessmentQuestions`, which checks each question’s required fields and counts.
- `src/wrapUpAssessment.ts::showWrapUpAssessmentOverlay`:
  - Builds the overlay DOM (shell, header, grid, footer).
  - Disables the main chat input and buttons via `disableChatControls`.
  - Renders 15 questions with 5 snippet-focused questions, and wires up the overlay’s CTA and feedback controls.

On mobile, the WebView bundle is the same, but wrap-up integration is incomplete:

- `SenseiMobile/src/mobile/network/BffClient.ts` does not yet expose a `generateWrapUp` method.
- `bff/src/services/wrapUpService.js` is a stub:
  - It logs `wrap-up skipped (stub)` and returns `null` from `maybeGenerateWrapUp`.
- There is no `bff/src/routes/wrapUp.js` route, nor a `POST /sessions/:sessionId/wrapup` endpoint.
- `StreamingService.handleConnection` calls `wrapUpService.maybeGenerateWrapUp(context)` and, if it receives a payload, will send a `wrapUp` WebSocket frame to the client, but this path is currently never exercised in a real environment because the service returns `null`.

Core tools and LLM abstraction:

- `core/llmTypes.ts` defines a generic `CoreLlmClient` interface with `callText` and `callJson` methods.
- `core/mermaidErrorRecovery.ts` and `bff/src/integration/coreLlmAdapter.js` (to be created or extended) provide a reference pattern:
  - Core defines deterministic logic and a tool function that uses `CoreLlmClient`.
  - BFF implements `CoreLlmClient` on top of `GeminiGateway`.
  - WebView uses Core for logic and BFF for LLM transport.
- There is currently no `core/wrapUpAssessment.ts` file; the wrap-up tool exists only in `src/geminiService.ts`.

Repository-specific protocols and practices:

- `docs/protocols/MANDATORY_CORE_ANALYSIS_PROTOCOL_STEP_0.md` and `docs/protocols/COMPREHENSIVE_IMPACT_ANALYSIS_PROTOCOL.md` describe how to use the analyzer and how to reason about impact; they have already been applied at a high level to the wrap-up tool and their findings are summarized in the mission-state file.
- `docs/protocols/MANDATORY_ARCHITECTURAL_SYNTHESIS_PROTOCOL.md` requires:
  - Explicit articulation of architectural patterns and guiding principles.
  - Avoidance of anti-patterns such as duplicated tool logic and UI/LLM coupling in the BFF.
- The `AGENTS.md` instructions enforce:
  - Running `npm run analysis:run` before major work (already done for the wrap-up scope).
  - Taking a backup with `npm run backup:create` before modifying non-doc project files.

Architectural pattern for this plan:

- Core owns LLM tools:
  - Wrap-up generation logic (prompt, model selection, parsing, validation) should move into `core/wrapUpAssessment.ts`.
- BFF owns LLM transport:
  - All wrap-up LLM calls should go through `GeminiGateway` and a `CoreLlmAdapter` that implements `CoreLlmClient`.
- WebView and RN shell own teaching and UI:
  - `src/index.tsx`, `src/moduleSelectionHandler.ts`, and `src/wrapUpAssessment.ts` remain responsible for when wrap-up is triggered and how it is rendered.
  - `SenseiMobile` `BffClient` should only transport structured JSON payloads and bubble them back to WebView via the bridge.

Guiding principles for this work:

- DRY (Don’t Repeat Yourself): Wrap-up prompts, parsing, and validation must live in a single Core module reused by both web and BFF.
- Separation of Concerns:
  - Core: pure tools and types, no DOM or environment-specific code.
  - BFF: HTTP/WS wiring and LLM transport, no DOM or teaching logic.
  - WebView: teaching pipeline and overlays, no direct `@google/genai` usage.
  - RN: mobile shell, bridge, and telemetry, no LLM or curriculum logic.
- Testability and Observability:
  - Core functions should be easy to unit test.
  - BFF wrap-up calls should be logged with clear tags and payload summaries.
  - Web and mobile behavior should be provably identical for a given prompt context.

## Plan of Work

This section gives a prose description of the sequence of edits and additions. The `Concrete Steps` section later will translate these into executable commands and checkpoints.

1. Repository sanity-check and analyzer refresh.
   - Confirm `npm install` has been run at the repository root and that `npm run analysis:run` completes successfully (these should already be true if you are reading this plan in the main repo).
   - Skim `tmp/analysis/summary.txt` to confirm `src/index.tsx`, `src/geminiService.ts`, `src/wrapUpAssessment.ts`, and `src/moduleSelectionHandler.ts` are in scope and that `src/geminiService.ts` and `src/wrapUpAssessment.ts` appear with non-zero fan-in.

2. Take a repository backup as required by `AGENTS.md`.
   - Before modifying any non-doc project file (anything under `src/`, `core/`, `SenseiMobile/`, `bff/`), run:
     - `npm run backup:create -- --feature "wrap_up_assessment_core_bff_migration" --context "Migrate wrap-up assessment generator into Core and BFF; wire web and mobile to use shared tool via CoreLlmClient."`
   - This creates an archive under `./backup` that can be restored if needed.

3. Introduce the Core wrap-up assessment module.
   - Create `core/wrapUpAssessment.ts` with the following responsibilities:
     - Define `WrapUpAssessmentPromptContext`, `WrapUpAssessmentQuestion`, `WrapUpAssessmentGenerationResult`, and any other types currently defined or implied in `src/geminiService.ts` and `src/wrapUpAssessment.ts`.
     - Implement a pure function:
       - `generateWrapUpAssessment(llm: CoreLlmClient, moduleId: string, promptContext: WrapUpAssessmentPromptContext): Promise<WrapUpAssessmentGenerationResult | null>`
     - Move the following logic from `src/geminiService.ts` into this Core module:
       - Prompt construction for wrap-up assessments (formerly using `buildWrapUpAssessmentPrompt`), preserving the original instruction to invoke the `submit_wrap_up_assessment` tool.
       - LLM invocation logic expressed in terms of a provider-agnostic Core tool-call method on `CoreLlmClient` with `task: 'wrap_up_assessment'`.
       - JSON fence stripping (`stripJsonFence`).
       - Function-call extraction (`extractFunctionCall`) and tool-code JSON parsing (`extractQuestionsFromToolCode`).
       - Normalization and reordering of questions (`normalizeWrapUpAssessmentQuestions`, `reorderWrapUpAssessmentQuestions`), including any code that ensures the final 15-question, 5-snippet layout.
       - Optional debug behavior (`isWrapUpDebugEnabled`, `buildDebugAssessment`) in a way that can still be toggled without tying Core to browser-specific state.
     - Ensure that the Core implementation does not import `@google/genai` or browser globals; it should depend only on `CoreLlmClient` and plain TypeScript types.
   - Update `core/index.ts` to export the new Core wrap-up functions and types.

4. Refactor the web bundle to use the Core wrap-up tool.
   - In `src/geminiService.ts`:
     - Remove direct use of `GoogleGenAI` for wrap-up, or convert `generateWrapUpAssessment` into a thin wrapper that calls the Core function.
     - If the old function remains as a wrapper, it must delegate to `core/wrapUpAssessment.ts` without rebuilding prompts or parsing locally to avoid drift.
   - In or near `src/index.tsx`, wire up the existing browser-side `CoreLlmClient` from `core/browserLlmClient.ts`:
     - Reuse the same `CoreLlmClient` instance that mermaid recovery uses (created via `createBrowserCoreLlmClient` or equivalent).
     - Ensure that when the Core wrap-up tool calls `llm.callJson` or `llm.callText` with a `task` such as `'wrap_up_assessment'`, the underlying implementation selects the correct wrap-up configuration (model name, temperature, tools) so behavior matches the previous web implementation.
   - Update `src/index.tsx::createLLMPlannerCallback` and `src/moduleSelectionHandler.ts::createSolidifyTeachingPlan` to:
     - Call `core/wrapUpAssessment.ts::generateWrapUpAssessment` with the browser `CoreLlmClient`, `moduleId`, and a constructed `WrapUpAssessmentPromptContext`.
   - Add a DRY wrap-up presentation gate in `src/wrapUpAssessment.ts` and use it everywhere wrap-up is presented (desktop and mobile bridge):
     - Define a single shared handler that enforces the policy:
       - Validate the received overlay payload (`validateWrapUpAssessmentQuestions`).
       - Show the overlay.
       - On failure (missing payload or invalid payload), show the standard apology message and unlock controls.
     - Route these entry points through that handler:
       - The desktop Solidify auto-overlay path in `src/index.tsx` (payload stored in `window.__wrapUpAssessmentPayload`).
       - The module-selection Solidify path in `src/moduleSelectionHandler.ts`.
       - The mobile bridge `wrapup:show` handler in `src/mobile/webviewMessageRouter.ts` (via a dependency passed from `src/index.tsx` to avoid import cycles).
   - Keep `showWrapUpAssessmentOverlay`’s external behavior stable; the goal is to remove duplicated validation and duplicated apology/unlock behavior, not to change the UI.

5. Implement BFF non-streaming wrap-up primitives (reusing existing abstractions).
   - In `bff/src/integration/geminiGateway.js`:
     - A `callText(prompt, { task })` and `callJson(prompt, { task })` implementation already exists and is used for mermaid recovery.
     - Extend the existing task-switching logic so that when `task === 'wrap_up_assessment'`, the method:
       - Selects the correct model and configuration for wrap-up (mirroring the previous web-only implementation).
       - Passes the wrap-up `submit_wrap_up_assessment` tool/function declaration so Gemini returns a function call (do not set `responseMimeType` for this task).
       - Logs with a `task` tag of `'wrap_up_assessment'` so wrap-up traffic can be monitored separately.
   - In `bff/src/integration/coreLlmAdapter.js`:
     - A `CoreLlmAdapter` class already wraps `GeminiGateway` and implements `CoreLlmClient` by delegating `callText` and `callJson`.
     - Reuse this class as-is for wrap-up; no new adapter type is required.
     - If needed, only adjust call sites to pass `task: 'wrap_up_assessment'` so the existing adapter and gateway can route calls appropriately.

6. Replace `WrapUpService` stub with a Core-based implementation and add a wrap-up HTTP route.
   - In `bff/src/services/wrapUpService.js`:
     - Extend the class to accept `geminiGateway` or a `CoreLlmAdapter` instance in its constructor.
     - Add a method:
       - `async generateWrapUp({ session, moduleId, promptContext })`
         - Construct a `CoreLlmAdapter` from the shared `geminiGateway`.
         - Call `core/wrapUpAssessment.ts::generateWrapUpAssessment` with the adapter.
         - If the result is `null` or contains no questions, log an error and return `null`.
         - Otherwise, map the result into a `WrapUpAssessmentOverlayData` shape that matches what `src/wrapUpAssessment.ts::showWrapUpAssessmentOverlay` expects.
     - Keep `maybeGenerateWrapUp(context)` as a thin wrapper that:
       - For WebSocket streaming scenarios (if desired later) can call `generateWrapUp`.
       - For now, may return `null` unless a specific wrap-up request is identified in the turn metadata.
   - Add a new controller and route:
     - Create `bff/src/controllers/wrapUpController.js`:
       - Define a `postWrapUp` handler that:
         - Reads `sessionId` from the URL and `moduleId` plus `promptContext` from the body.
         - Validates the input shape.
         - Looks up the session from `SessionService`/`SessionStore`.
         - Calls `wrapUpService.generateWrapUp({ session, moduleId, promptContext })`.
         - Returns a `200` response with the overlay payload on success, or an appropriate error code if session lookup or generation fails.
     - Create `bff/src/routes/wrapUp.js`:
       - Define `POST /sessions/:sessionId/wrapup` and bind it to `wrapUpController.postWrapUp`.
     - Wire the route into `bff/src/server.js` so the BFF server exposes the new endpoint.

7. Wire the mobile BFF client and bridge.
   - In `SenseiMobile/src/mobile/network/BffClient.ts`:
     - Add a method:
       - `async generateWrapUp(moduleId: string, promptContext: WrapUpAssessmentPromptContext): Promise<void>`
         - Ensure a session via the existing session logic.
         - POST to `/sessions/{sessionId}/wrapup` with `{ moduleId, promptContext }`.
         - On success, read the `WrapUpAssessmentOverlayData` payload and immediately enqueue a bridge message:
           - `{ type: 'wrapup:show', data: overlay }`.
     - Add a client-side timeout for wrap-up requests (separate from mermaid recovery), implemented with `AbortController` and a per-task timeout constant so it can be tuned later without environment variables.
   - In `SenseiMobile/src/mobile/MainScreen.tsx`, handle a WebView-initiated wrap-up request:
     - When the WebView sends `{ type: 'wrapup:requestShow', moduleId, promptContext }`, call `bffClient.generateWrapUp(moduleId, promptContext)`.
     - On wrap-up request failure (HTTP error, timeout, or exception), enqueue `{ type: 'wrapup:failed', moduleId, moduleTitle }` so the WebView can show the standard apology and unlock controls.
   - Confirm that the WebView bridge is handling `wrapup:show` messages by routing them through the shared wrap-up presentation gate (validate → show overlay → on failure: apology + unlock). If not, add or adjust the message handler in `src/index.tsx` or `src/mobile/webviewMessageRouter.ts` to do so.

8. Add functional and integration tests for wrap-up (mandatory).
   - Tests must be treated as contracts. Do not relax, delete, or rewrite tests to “fit” an implementation. If a test fails, fix the production code so the test passes.
   - Add a Core functional test in the root Jest suite:
     - Create `__tests__/wrapUpAssessment.core.functional.test.ts`.
     - Use a mocked `CoreLlmClient` to simulate LLM returns and exercise the real Core `generateWrapUpAssessment` tool.
     - Cover:
       - Happy path: valid JSON/tool-code response produces 15 questions with 5 snippet questions after normalization/reordering.
       - Negative path: malformed/empty LLM payload returns `null` (or throws a controlled error) and does not crash the caller.
   - Add a BFF integration test mirroring `mermaidRecover.int.test.js`:
     - Create `bff/tests/wrapUp.int.test.js`.
     - Start the BFF with `startServer({ host: '127.0.0.1', port: 0 })`, wait for `server` to emit `listening`, then derive the base URL from `server.address().port`. Create a session via `POST /sessions` (use the valid `topicId` from `bff/src/config/index.js`, currently `c++_recursive_mastery`), then call `POST /sessions/:sessionId/wrapup`.
     - Assert invariants on the overlay payload (`questions.length === 15`, snippet count === 5, required fields present).
     - Include at least one negative case (unknown sessionId or invalid promptContext → `400 BAD_REQUEST`).
   - Add a BFF integration test for request body size:
     - Create `bff/tests/jsonBodyLimit.int.test.js`.
     - POST `/sessions` with a JSON body slightly larger than 2MB (for example, `metadata.oversized` filled with `x` characters) and assert `200` with a valid `sessionId`.
   - Run both test suites after implementation:
     - Root Jest: `npm test --silent --bail --noStackTrace`
     - BFF integration: `cd bff && npm test`
     - Note: in sandboxed environments, BFF integration tests may require elevated permissions because they bind `127.0.0.1` and start a WebSocket server.
   - Add a mobile routing gate sentinel test in the root Jest suite:
     - The test must fail if the mobile WebView build path attempts to generate wrap-up via a browser `CoreLlmClient` instead of sending a `wrapup:requestShow` bridge message.
     - The test should be deterministic and should not require starting the BFF.

9. Clean up direct wrap-up LLM usage and references.
   - Search for `generateWrapUpAssessment` in `src/`:
     - Ensure that all call sites have been updated to use the Core-based version.
   - Ensure there are no remaining `@google/genai` or `GoogleGenAI` references used directly for wrap-up in `src/geminiService.ts` or elsewhere.
   - Confirm that the Core module is the single source of truth for wrap-up prompts and parsing logic.

10. Update documentation and mission state.
    - Update `docs/llm_entry_exit_traces.md`:
      - Reflect that wrap-up generation is now a Core tool accessed via `CoreLlmClient` rather than a direct `src/geminiService.ts` function.
    - Update `docs/architecture_mobile_sensei_phase1.md` and `docs/architecture_mobile_llm_tools_migration_plan.md` only if necessary to align text with the final implementation (for example, confirming that `core/wrapUpAssessment.ts` exists and that BFF wrap-up endpoints are implemented).
    - Append a brief note to `docs/mission_state/mission_state_wrap_up_assessment_core_migration_20251210T000000Z.md` summarizing actual changes versus the planned scope.

## Concrete Steps

This section lists exact commands and checkpoints. All commands should be run from the repository root unless otherwise noted.

1. Ensure dependencies and analyzer artifacts are present.

    npm install
    npm run analysis:run -- --include wrapUpAssessment,geminiService.ts,moduleSelectionHandler.ts,index.tsx,wrapUpService.js

   Confirm that `tmp/analysis/summary.txt` lists `src/index.tsx` as an entry candidate and shows non-zero fan-in for `src/geminiService.ts` and `src/wrapUpAssessment.ts`.

2. Take a backup before modifying non-doc files.

    npm run backup:create -- --feature "wrap_up_assessment_core_bff_migration" --context "Migrate wrap-up assessment generation into Core and BFF; wire web and mobile to shared CoreLlmClient tool."

   This step should be performed once per migration; do not skip it.

3. Implement the Core wrap-up tool.

   - Create `core/wrapUpAssessment.ts` with the responsibilities described in the Plan of Work.
   - Update `core/index.ts` to export the new tool.
   - Run a TypeScript build for Core if a script exists (for example `cd core && npm test` or `npm run build` if defined).

4. Refactor web code to use the Core wrap-up tool.

   - Modify `src/geminiService.ts`, `src/index.tsx`, and `src/moduleSelectionHandler.ts` as described above.
   - Run the web app in a desktop browser (for example, via the existing dev script).
   - Drive the teaching flow to the Solidify phase and confirm that the wrap-up overlay appears and looks identical to the pre-migration behavior for a known module.

5. Extend BFF with wrap-up support.

   - Modify `bff/src/integration/geminiGateway.js` and add or update `bff/src/integration/coreLlmAdapter.js`.
   - Extend `bff/src/services/wrapUpService.js` as described.
   - Add `bff/src/controllers/wrapUpController.js` and `bff/src/routes/wrapUp.js`, wiring them into `bff/src/server.js`.
   - Start the BFF locally:

        cd bff
        npm start

   - Use a tool like `curl` or `HTTPie` to call `POST /sessions/:sessionId/wrapup` with a known session and prompt context; verify that you receive a plausible overlay payload.

6. Wire the mobile client and validate mobile behavior.

   - Modify `SenseiMobile/src/mobile/network/BffClient.ts` and the relevant Solidify orchestration to call the wrap-up endpoint and enqueue `wrapup:show`.
   - Build the WebView bundle:

        npm run webview:bundle

     This regenerates `SenseiMobile/app_web/webview_dist/*`. Do not hand-edit the dist assets; always rebuild from `src/`.

   - Start the mobile stack:

        cd bff
        npm start
        cd ../SenseiMobile
        npm start
        npm run ios

   - On the iOS simulator, progress a module to the Solidify phase and confirm:
     - A wrap-up request is sent to the BFF (visible in BFF logs).
     - The WebView receives a `wrapup:show` message and displays the wrap-up overlay.
     - The overlay matches desktop behavior.

7. Add and run wrap-up tests (mandatory).

   Tests are contracts. Do not change tests to make them pass. If a test fails, fix the production code until it passes.

   - Add Core functional tests in the root Jest suite:
     - Create `__tests__/wrapUpAssessment.core.functional.test.ts`.
     - Mock `CoreLlmClient` by providing a stub with `callText`/`callJson` returning deterministic payloads.
     - Include at least:
       - Happy path: stub returns a valid wrap-up payload (direct `questions` JSON or `{ tool_code: "questions=[...]" }`) and assert Core returns 15 ordered questions with 5 snippet items.
       - Negative path: stub returns malformed/empty text and assert Core returns `null` (or throws a controlled error) without crashing.
   - Add a BFF integration test mirroring the existing mermaid test:
     - Create `bff/tests/wrapUp.int.test.js`.
     - Use the pattern from `bff/tests/mermaidRecover.int.test.js`:
       - Start the BFF with `startServer()`.
       - `POST /sessions` with `{ topicId: "c++_recursive_mastery" }` to obtain a real `sessionId`.
       - `POST /sessions/:sessionId/wrapup` with `{ moduleId, promptContext }`.
       - Assert response invariants: 200 OK, `questions.length === 15`, snippet count === 5, and required fields present.
       - Add a negative check (unknown session or invalid promptContext should return `400 BAD_REQUEST`).
     - Update `bff/package.json` `test` script to run both integration tests, for example:
       - `node tests/mermaidRecover.int.test.js && node tests/wrapUp.int.test.js`
   - Run the suites:

        npm test --silent --bail --noStackTrace
        cd bff && npm test

8. Final validation and cleanup.

   - Re-run `npm run analysis:run` and confirm there are no remaining direct wrap-up LLM calls in `src` (search for `generateWrapUpAssessment` and `@google/genai`).
   - Ensure logs around wrap-up usage are informative but not overly noisy.
   - Update `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` sections of this ExecPlan to reflect the actual state.

## Validation and Acceptance

To accept this migration as complete, a novice should be able to perform the following checks and observe the described behaviors.

1. Desktop web wrap-up behavior:
   - Start the web app and open a module that reaches Solidify.
   - Trigger wrap-up and confirm:
     - The overlay appears with a grid of 15 questions and 5 snippet-based items.
     - The questions are well-formed and similar to the pre-migration behavior.
     - The chat input is disabled while the overlay is visible and re-enabled when the overlay is closed.

2. Mobile iOS wrap-up behavior:
   - Start the BFF, WebView bundle, and iOS app as described in `Concrete Steps`.
   - Progress a module to Solidify on mobile and trigger wrap-up.
   - Confirm:
     - BFF logs show a `WRAPUP_SERVICE` request and a successful Core call.
     - A `wrapup:show` event is enqueued in the RN bridge and handled by WebView.
     - The overlay renders correctly in the WebView, matching the desktop UX.

3. Automated tests:
   - Root Jest suite passes:
     - Run `npm test --silent --bail --noStackTrace` and expect all tests to pass, including the new `wrapUpAssessment.core.functional.test.ts`.
   - BFF integration suite passes:
     - Run `cd bff && npm test` and expect both:
       - `mermaidRecover.int.test.js`
       - `wrapUp.int.test.js`
       to complete without errors.
   - If any test fails, do not weaken the test. Fix the production code until the test passes.

4. Code and architecture validation:
   - Search the repo to confirm:
     - There are no remaining direct wrap-up calls to `@google/genai` or `GoogleGenAI` in `src`.
     - Wrap-up logic is centralized in `core/wrapUpAssessment.ts`.
   - Confirm that:
     - BFF wrap-up endpoints use `CoreLlmAdapter` and `CoreLlmClient`.
     - WebView and RN code do not contain any BFF-specific wrap-up logic beyond calling `BffClient.generateWrapUp` and handling `wrapup:show`.

If all of these acceptance checks pass, the wrap-up assessment LLM tool migration can be considered successful.

## Idempotence and Recovery

- The Core and BFF changes are additive and can be applied incrementally; if a mistake is made, you can:
  - Re-run `npm run backup:create` with an updated context to take another snapshot before further changes.
  - Use your preferred version control tools to revert or adjust specific files.
- The new BFF `/wrapup` endpoint is safe to call multiple times for the same `sessionId` and `moduleId`; each call simply regenerates a wrap-up overlay payload and does not mutate server-side state beyond logs.
- Re-running `npm run analysis:run` after changes is safe and recommended; it will refresh analyzer artifacts and help confirm there are no stray direct LLM calls in `src`.

## Artifacts and Notes

- Mission-state file:
  - `docs/mission_state/mission_state_wrap_up_assessment_core_migration_20251210T000000Z.md` (scope, trace, DSE table summary, risk register).
- Analyzer artifacts:
  - `tmp/analysis/summary.txt`
  - `tmp/analysis/functions.json`
  - `tmp/analysis/calls.json`
  - `tmp/analysis/fan_in.json`
  - `tmp/analysis/fan_out.json`

These artifacts should be consulted if new questions arise during implementation or future migrations.

## Interfaces and Dependencies

At the end of this ExecPlan, the following interfaces and contracts should exist and be stable:

- In `core/wrapUpAssessment.ts`:

    export interface WrapUpAssessmentPromptContext {
      moduleTitle: string;
      moduleGoal: string;
      solidifyContent: string;
      conceptSummaries: string[];
    }

    export type WrapUpAssessmentQuestionType = 'snippet' | 'concept';

    export interface WrapUpAssessmentQuestion {
      id: string;
      type: WrapUpAssessmentQuestionType;
      prompt: string;
      code?: string;
      choices: string[];
      correct_choice: string;
      explanation: string;
      interviewer_insight: string;
    }

    export interface WrapUpAssessmentGenerationResult {
      questions: WrapUpAssessmentQuestion[];
    }

    export async function generateWrapUpAssessment(
      llm: CoreLlmClient,
      moduleId: string,
      context: WrapUpAssessmentPromptContext
    ): Promise<WrapUpAssessmentGenerationResult | null>;

- In `core/llmTypes.ts`:
  - The `CoreLlmClient` interface already exists and is used by Core mermaid recovery. For wrap-up parity, extend it with a minimal, provider-agnostic tool-call method (keeping existing methods intact), for example:

    export type CoreToolCall = { name: string; args: unknown };

    export interface CoreLlmClient {
      callText(prompt: string, options?: { task?: string }): Promise<string>;
      callJson<T>(prompt: string, options?: { task?: string }): Promise<T>;
      callWithTools(prompt: string, options: { task: string; tools: unknown }): Promise<{ toolCalls?: CoreToolCall[]; text?: string }>;
    }

  - `callWithTools` is only required for wrap-up and future tool-calling migrations; mermaid recovery continues to use `callText`/`callJson`.

- In `bff/src/integration/coreLlmAdapter.js`:
  - The existing `CoreLlmAdapter` class continues to implement `CoreLlmClient` over `GeminiGateway`; wrap-up integration should reuse this adapter instead of introducing another client type.

- In `bff/src/services/wrapUpService.js`:
  - A `generateWrapUp({ session, moduleId, promptContext })` method that calls Core and returns a `WrapUpAssessmentOverlayData` payload.

- In `bff/src/controllers/wrapUpController.js` and `bff/src/routes/wrapUp.js`:
  - `POST /sessions/:sessionId/wrapup` accepting `{ moduleId, promptContext }` and returning overlay JSON.

- In `SenseiMobile/src/mobile/network/BffClient.ts`:
  - A `generateWrapUp(moduleId: string, promptContext: WrapUpAssessmentPromptContext)` method that calls the BFF route and bridges `wrapup:show` to WebView.

If these interfaces exist and behave as described, and the validation steps pass, the wrap-up assessment Core/BFF migration will be complete and aligned with the Phase 1 architecture.

---

Plan revision notes (2025-12-10):

- Updated the Plan of Work step describing browser-side `CoreLlmClient` usage to clarify that the implementation should reuse the existing client from `core/browserLlmClient.ts` (used for mermaid recovery), rather than creating a second, separate implementation. This keeps the design DRY and consistent with current Core LLM client usage.
- Updated BFF-related steps and the Interfaces/Dependencies section to acknowledge the existing `GeminiGateway.callText/callJson`, `CoreLlmAdapter`, and `CoreLlmClient` definitions, and to frame wrap-up integration as an extension of these shared abstractions instead of introducing parallel or duplicate clients.
- Added an explicit, mandatory testing milestone modeled after mermaid recovery: new Core functional Jest tests and a BFF integration test script for wrap-up, plus concrete commands and acceptance criteria. The plan now states that production code must be fixed if tests fail, never the other way around.

Plan revision notes (2025-12-12):

- Revised the plan to guarantee zero behavior drift from the pre-migration web app by restoring Gemini tool/function-calling for wrap-up end-to-end. This adds a small `CoreLlmClient` tool-call extension, reverts the Core wrap-up prompt to tool-invocation form, and removes wrap-up JSON response mime typing that conflicts with tools.
- Revised the plan to strengthen Phase 1 mobile correctness and DRY behavior: added a DRY wrap-up presentation gate (single validate → show → apology+unlock policy), added explicit mobile failure signaling (`wrapup:failed`), added a mobile wrap-up request timeout (configurable separately from mermaid), and added a mobile routing sentinel test to prevent regressions where mobile accidentally calls a browser `CoreLlmClient`.
- Corrected BFF routing instructions to match the repo’s actual server composition (wire `wrapUp` in `bff/src/server.js`, not a non-existent `bff/src/routes/index.js`), and clarified that mobile wrap-up triggering is WebView-initiated via `wrapup:requestShow` (RN only relays to BFF and returns `wrapup:show`/`wrapup:failed`).

Plan revision notes (2025-12-13):

- Added a BFF JSON-body-size hardening step plus a standalone integration test to prevent regressions when mobile sends large wrap-up `promptContext` payloads.
- Updated BFF LLM gateway implementation notes to prefer the recommended `@google/genai` SDK and to call it via dynamic import in the CommonJS BFF.

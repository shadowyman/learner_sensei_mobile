# BFF Implementation Walkthrough (Mobile Phase 1)

This walkthrough breaks BFF implementation into small, testable steps, starting from the simplest possible end‑to‑end path for the iOS mobile client. It is intentionally narrower than the full `BFF_System_Master_Arhitectural_Guide.md` and can be followed incrementally.

> **How to read this document**
>
> - Steps 1–7 describe **scaffolding milestones**: they get basic LLM streaming, Core extraction, and BFF hardening in place as quickly as possible. Some of these steps (especially Step 1’s direct RN→BFF→WebView streaming for teaching turns) are intentionally transitional.
> - Step 8 defines the **Phase 1 target architecture** for mobile: the WebView’s existing teaching pipeline owns each turn; the BFF owns LLM calls; Core owns reusable tools. Where there is tension between Step 8 and earlier steps, **Step 8 is the canonical Phase 1 intent**.
> - When implementing new behavior or refactoring existing code:
>   - Use this document together with:
>     - `docs/architecture_mobile_sensei_phase1.md` (big‑picture mobile architecture).
>     - `docs/llm_entry_exit_traces.md` and `docs/architecture_mobile_llm_tools_migration_plan.md` (per‑function LLM guidance).
>   - Treat early steps’ patterns as **bootstrapping** unless explicitly called out as part of the final Phase 1 design.

The first milestone is a **simple LLM streaming turn**: get real Gemini output flowing from the mobile app, through the BFF, back into the WebView, without migrating full Sensei Core logic yet.

---

## Step 1 – Simple LLM Streaming Turn (Minimal Core)

**Objective:** When the learner sends a message from the iOS app, the response is streamed from Gemini via the BFF, using a single, generic prompt. No curriculum, phases, or analysis logic are required in this step.

### 1.1 Runtime Flow (Target Behavior)

End‑to‑end flow for one turn:

1. Learner types a message in the native `InputBar`.
2. `SenseiMobile` calls `BffClient.submitTurn({ text, clientTurnId })`, which:
   - Ensures a session via `POST /sessions`.
   - Creates a turn via `POST /sessions/{sessionId}/turns`.
   - Receives `{ turnId, streamUrl }`.
3. `runForwardStream` opens `streamUrl` (WebSocket) and hands the async stream to `MainScreen`.
4. In the BFF, `StreamingService.handleConnection`:
   - Loads the `Turn` from `SessionStore`.
   - Builds a prompt via `SenseiCoreAdapter.buildPrompt({ session, turn })`.
   - Calls `GeminiGateway.streamMainResponse(prompt, { context })`.
   - For each yielded `{ text }` chunk, sends `{ type: "chunk", text }` WS messages.
   - Sends a final `{ type: "status", phase: "completed", footer? }` message.
5. `BffClient` forwards `chunk`/`status` events into the RN↔WebView bridge.
6. The web bundle uses existing DOM helpers to render the Sensei bubble from the streamed text.

At this stage, all “core logic” is just the prompt string built in `SenseiCoreAdapter.buildPrompt`.

> **Important:** This step’s direct RN→BFF→WebView streaming path is a **transitional scaffold**. It proves the BFF can stream from Gemini to the mobile app, but it is **not** the final teaching architecture for Phase 1. Step 8 later moves the teaching loop back into the WebView (matching desktop), while keeping BFF as the LLM proxy. New features should not be tightly coupled to this early streaming pattern.

### 1.2 Implement a Real `GeminiGateway.streamMainResponse`

File: `bff/src/integration/geminiGateway.js`

Replace the stub implementation with a real Gemini‑backed stream:

- Read configuration:
  - API key and model name from environment or BFF config.
  - Basic generation parameters (max tokens, temperature, safety settings).
- Implement `async *streamMainResponse(prompt, { context })`:
  - Log the request with `turnId` and prompt length.
  - Create a Gemini client using the configured API key.
  - Call the streaming API with the provided `prompt`.
  - For each chunk of generated text from Gemini, `yield { text }`.
  - On error:
    - Log the error with enough metadata for debugging.
    - Rethrow or wrap the error so `StreamingService` can fall back or send an error frame.

The gateway should **not** encode Sensei‑specific rules; it only turns a prompt into streamed text.

### 1.3 Keep `SenseiCoreAdapter.buildPrompt` Minimal

File: `bff/src/integration/senseiCoreAdapter.js`

For this step, `SenseiCoreAdapter` acts as a minimal “core”:

- `buildPrompt(context)`:
  - Extract `input = context.turn.input?.text ?? ""`.
  - Return a single generic prompt, for example:  
    `You are Recursive Sensei. Respond helpfully to: ${input}`.
- `deriveFooter(context)`:
  - May continue to return a static footer (`confidence: "Medium"`, etc.) or a simple heuristic; detailed footer logic is out of scope for this step.

No curriculum state, teaching plans, or learner‑model analysis are required yet; the goal is just to wire the LLM round‑trip.

### 1.4 Verify End‑to‑End Behavior

Once `GeminiGateway` and `SenseiCoreAdapter` are updated:

1. Start the BFF (`cd bff && npm start`).
2. Start the iOS app and ensure it is configured to talk to the local BFF (`BffClient.baseUrl`, typically `http://localhost:8787`).
3. In the mobile app:
   - Open a session (the app does this via `ensureSession`).
   - Send a short message from the input bar.
4. Confirm:
   - BFF logs show `STREAMING_SERVICE` and `GEMINI_GATEWAY` handling the turn.
   - The learner sees a streamed Sensei response that clearly depends on their input (not the old stub text).
   - No LLM API keys are present in the mobile app or WebView bundle.

When this step passes, the mobile app is officially using a real, server‑side LLM path, and we have a clean place (`SenseiCoreAdapter`) to grow richer core behavior in subsequent steps.

---

## Step 2 – Introduce a Shared Core Module and Move `mermaidErrorRecovery` into It

**Objective:** Create a real, shared Core module and move one non‑UI TS file from `src/` into it so that both the web bundle and the BFF can use the same implementation. For this first move, we use `mermaidErrorRecovery` because it is purely logical (no DOM) and already encapsulates deterministic + LLM logic.

### 2.1 Create a Core Module

1. Add a `core/` directory at the repo root (or under a `packages/` folder if you prefer a workspace layout).
2. Add a minimal `tsconfig` and `package.json` for Core:
   - `core/tsconfig.json` targeting JS output consumable by both web and BFF.
   - `core/package.json` with a simple `"build"` script (`tsc`) and a name (e.g., `"@sensei/core"`).

The goal is not to design the final package structure now, but to get a compilable Core module that both runtimes can import from.

### 2.2 Move `mermaidErrorRecovery` into Core

1. Move `src/mermaidErrorRecovery.ts` to `core/mermaidErrorRecovery.ts`.
2. Fix imports inside `core/mermaidErrorRecovery.ts`:
   - Any references to `./logger`, `./model_usage`, or other local modules must either:
     - Also be moved into Core, or
     - Be imported from `src/` via a stable path that works for both web and BFF builds.
3. Run the Core build to ensure `core/mermaidErrorRecovery` compiles to JS.

For now it is acceptable that this Core file still imports `@google/genai`; we will refactor that in a later step when we introduce a shared LLM interface.

### 2.3 Update Web Imports to Use Core

Search for imports of `./mermaidErrorRecovery` under `src/` and update them to import from Core instead:

- Before (example):  
  `import { attemptMermaidFix, runMermaidRecovery } from './mermaidErrorRecovery';`
- After:  
  `import { attemptMermaidFix, runMermaidRecovery } from '@sensei/core/mermaidErrorRecovery';`  
  (or the concrete Core path you define).

The web bundle should behave identically after this step; only the import source has changed.

### 2.4 Make BFF `MermaidService` Call Core

File: `bff/src/services/mermaidService.js`

Replace the existing deterministic‑fix implementation with a call into Core:

1. Import Core’s `attemptMermaidFix` or (for now) just the deterministic helpers as needed:
   - `const { applyBacktickFix, applyUniversalQuoteFix } = require('@sensei/core/mermaidErrorRecovery');`
2. In `recover(payload)`:
   - Use the Core functions instead of locally re‑encoding the same rules.
   - Keep the high‑level shape with explicit modes:
     - `mode:'auto'`: apply deterministic fixes; if they change the diagram, return it; if not, fall through to a single LLM attempt in the same call.
     - `mode:'llm'`: skip deterministic early returns and always invoke the LLM (set `forceLlm:true`).

After this step, both web and BFF use the same TypeScript implementation for mermaid deterministic behavior, and the first Core module (`@sensei/core/mermaidErrorRecovery`) exists and builds successfully.

### 2.5 Verify the First Core Module

1. Run the web app:
   - Confirm mermaid behavior matches pre‑Core‑move behavior for diagrams that previously succeeded or were deterministically fixed.
2. Run BFF + mobile:
   - Trigger a mermaid error.
   - Confirm `MermaidService` logs show Core helpers being used (e.g., backtick/quote fixes).
   - Ensure there is no duplicated deterministic logic left in `MermaidService`; it delegates to Core.

With Steps 1 and 2 complete, you have:

- A real, server‑side LLM streaming path for main turns via `GeminiGateway.streamMainResponse`.
- A first Core module (`core/mermaidErrorRecovery`) that is shared between web and BFF.
- A proven mechanism for moving TS files from `src/` into Core without breaking behavior.

---

## Step 3 – Introduce a Generic Core LLM Interface and Route Mermaid Through It (BFF via `GeminiGateway`)

**Objective:** Stop Core from talking directly to `@google/genai` for mermaid repair and instead have it use a generic Core LLM interface that is implemented on the BFF via `GeminiGateway`. This aligns mermaid recovery with the long‑term “Core ↔ LLM gateway” architecture.

### 3.1 Define a Generic Core LLM Interface

In the Core module (e.g., `core/llmTypes.ts`), define a minimal generic interface:

```ts
export interface CoreLlmClient {
  callText(prompt: string, options: { task: string }): Promise<string>;
  callJson<T>(prompt: string, options: { task: string }): Promise<T>;
}
```

The goal is to have one reusable interface that future Core modules (teaching plans, analysis, wrap‑up) can also depend on, not a per‑domain client.

### 3.2 Refactor Core `mermaidErrorRecovery` to Use `CoreLlmClient`

File: `core/mermaidErrorRecovery.ts`

Change the LLM‑related parts as follows:

- Before: `attemptMermaidFix(ai: GoogleGenAI, failedDiagram: string, errorMessage: string)` calls `ai.models.generateContent(...)` directly using `MERMAID_ERROR_RECOVERY_CONFIG`.
- After:
  - Change the signature to:
    - `attemptMermaidFix(llm: CoreLlmClient, failedDiagram: string, errorMessage: string)`
  - Build the prompt exactly as today (using `MERMAID_FIX_PROMPT_TEMPLATE`).
  - Call `llm.callJson<MermaidFixResponse>(prompt, { task: 'mermaid_repair' })`.
  - Parse and validate the returned `MermaidFixResponse` as the function does today (including fenced JSON handling).
- Remove the direct `GoogleGenAI` dependency from this file; any `@google/genai` usage should move to the BFF‑side implementation of `CoreLlmClient`.

### 3.3 Implement `CoreLlmClient` on the BFF Using `GeminiGateway`

Create a small adapter in the BFF, for example: `bff/src/integration/coreLlmAdapter.js`:

- Implement the `CoreLlmClient` interface:

```js
class CoreLlmAdapter {
  constructor({ geminiGateway }) {
    this.geminiGateway = geminiGateway;
  }

  async callText(prompt, { task }) {
    // Optionally branch on task for model/config selection.
    return this.geminiGateway.callText(prompt, { task });
  }

  async callJson(prompt, { task }) {
    const text = await this.geminiGateway.callText(prompt, { task });
    return JSON.parse(text);
  }
}
```

- Extend `GeminiGateway` with a simple non‑streaming primitive:
  - `callText(prompt, { task })` that:
    - Chooses the correct model/config based on `task` (e.g., `"mermaid_repair"`).
    - Calls `models.generateContent` with that prompt.
    - Returns `response.text`.

### 3.4 Wire `MermaidService` to Use Core via `CoreLlmClient`

File: `bff/src/services/mermaidService.js`

In `recover(payload)`:

1. Construct a `CoreLlmAdapter` with the shared `geminiGateway` instance.
2. Call Core’s `attemptMermaidFix` with the adapter:
   - `const fixResult = await attemptMermaidFix(coreLlmClient, baseCode, errorMessage);`
3. Map `fixResult` to the BFF contract:
   - If `fixResult.fixed && fixResult.diagram`:
     - Return `{ fixed: true, fixedCode: fixResult.diagram }`.
   - Otherwise:
     - Return `{ fixed: false }`.

The deterministic behavior remains entirely in Core; the LLM transport is now provided by the BFF via `GeminiGateway`.

### 3.5 Verify Mermaid LLM Calls Use `GeminiGateway`

1. Run BFF + mobile:
   - Trigger mermaid failures that are not resolved by deterministic fixes.
   - Confirm logs show:
     - `MermaidService` calling Core `attemptMermaidFix`.
     - Core `attemptMermaidFix` using `CoreLlmClient`.
     - `CoreLlmAdapter` delegating to `GeminiGateway.callText`.
2. Ensure that:
   - No direct `@google/genai` imports remain in `core/mermaidErrorRecovery.ts`.
   - All mermaid LLM calls go through `GeminiGateway` on the BFF side.

After Step 3:

- Mermaid recovery logic (deterministic + LLM) lives in Core.
- Core uses a generic `CoreLlmClient` instead of the Gemini SDK.
- The BFF implements `CoreLlmClient` via `GeminiGateway`, fulfilling the “Core ↔ LLM gateway” architecture for the mermaid path.

---

## Step 4 – Extract Wrap‑Up Assessment Generation into Core (Web Path Only)

**Objective:** Apply the same “Core + generic LLM interface” pattern to wrap‑up assessment generation, but first on the **web path only**. This keeps wrap‑up behavior identical for the web bundle while preparing the logic to be callable from the BFF in a later step.

### 4.1 Move Wrap‑Up Generation Logic into Core (single prompt source)

Current wrap‑up flow on web:

- `src/geminiService.ts`:
  - `generateWrapUpAssessment(ai: GoogleGenAI, moduleId: string, promptContext: WrapUpAssessmentPromptContext): Promise<WrapUpAssessmentGenerationResult | null>`.
  - Helpers: `normalizeWrapUpAssessmentQuestions`, `reorderWrapUpAssessmentQuestions`, `extractFunctionCall`, `extractQuestionsFromToolCode`, `stripJsonFence`.
- `src/prompts.ts`:
  - `buildWrapUpAssessmentPrompt(context: WrapUpAssessmentPromptContext): string`.
- `src/wrapUpAssessment.ts`:
  - `validateWrapUpAssessmentQuestions`, `showWrapUpAssessmentOverlay`, and DOM rendering.
- Call sites:
  - `src/index.tsx:createLLMPlannerCallback` (Solidify path).
  - `src/moduleSelectionHandler.ts:createSolidifyTeachingPlan`.

For Step 4:

1. Create `core/wrapUpAssessment.ts`.
2. Move `generateWrapUpAssessment` and its internal helpers from `src/geminiService.ts` into `core/wrapUpAssessment.ts`.
3. **Move the prompt builder too**: relocate `buildWrapUpAssessmentPrompt` from `src/prompts.ts` into Core (or re‑export it from Core). After the move, remove the duplicate in `src/prompts.ts` or make it a thin re-export so there is a single prompt source in Core.

At this point, Core owns all prompt and parsing logic for wrap‑up; the web app will call into this module instead of `src/geminiService.ts` for wrap‑up generation.

### 4.2 Refactor Core Wrap‑Up to Use `CoreLlmClient`

In `core/wrapUpAssessment.ts`:

1. Change the signature of `generateWrapUpAssessment`:
   - Before: `(ai: GoogleGenAI, moduleId: string, promptContext: WrapUpAssessmentPromptContext)`.
   - After: `(llm: CoreLlmClient, moduleId: string, promptContext: WrapUpAssessmentPromptContext)`.
2. Replace direct `ai.models.generateContent(...)` calls with:
   - `const prompt = buildWrapUpAssessmentPrompt(promptContext);`
   - `const response = await llm.callJson<WrapUpAssessmentGenerationResult | RawToolPayload>(prompt, { task: 'wrap_up_assessment' });`
3. Reuse the existing logic for:
   - Extracting tool calls.
   - Normalizing questions.
   - Enforcing question counts and snippet/concept ratios.

After this refactor, `core/wrapUpAssessment.ts` no longer imports `@google/genai`; it depends only on the generic `CoreLlmClient` interface.

### 4.3 Implement `CoreLlmClient` on the Web

In the web bundle (e.g., alongside `initializeGoogleAI` in `src/index.tsx` or a small helper module), implement `CoreLlmClient` using the existing `GoogleGenAI` instance:

- Use the same `CoreLlmClient` interface introduced in Step 3 (for mermaid).
- Implement:
  - `callText(prompt, { task })`:
    - Select the appropriate model/config from `WRAP_UP_ASSESSMENT_GENERATION_CONFIG` when `task === 'wrap_up_assessment'`.
    - Call `ai.models.generateContent(...)`.
    - Return `response.text ?? ''`.
  - `callJson<T>(prompt, { task })`:
    - Call `callText`.
    - Parse `JSON.parse(text)` into `T`.

This mirrors the BFF‑side `CoreLlmAdapter`, but is implemented in the browser using the in‑page `ai` instance.

### 4.4 Update Web Call Sites to Use Core

Update the two call sites that currently reference `generateWrapUpAssessment` from `src/geminiService.ts`:

- `src/index.tsx:createLLMPlannerCallback`.
- `src/moduleSelectionHandler.ts:createSolidifyTeachingPlan`.

Changes:

1. Change imports to pull `generateWrapUpAssessment` from `core/wrapUpAssessment` instead of `src/geminiService`.
2. Pass the `CoreLlmClient` instead of `ai`:
   - Before: `await generateWrapUpAssessment(ai, module.id, { ...promptContext });`
   - After: `await generateWrapUpAssessment(coreLlmClient, module.id, { ...promptContext });`
3. Leave downstream behavior unchanged:
   - Still call `validateWrapUpAssessmentQuestions` from `src/wrapUpAssessment.ts`.
   - Still construct `WrapUpAssessmentOverlayData` and either:
     - Store it in `window.__wrapUpAssessmentPayload` (for `wrapup:requestShow`), or
     - Set `ModuleSelectionHandler.pendingWrapUpAssessment`.

### 4.5 Verify Wrap‑Up Behavior on Web

1. Run the web app (or the WebView bundle in a browser).
2. Drive a module to the Solidify phase:
   - Confirm `generateWrapUpAssessment` is now resolved from Core.
   - Confirm the overlay still renders with 15 questions and 5 snippet items.
3. Check logs:
   - `WRAP_UP_ASSESSMENT` logs still appear.
   - No direct `@google/genai` imports remain in `core/wrapUpAssessment.ts`; LLM calls are handled via `CoreLlmClient`.

After Step 4:

- Wrap‑up assessment generation logic and its prompt live in Core and use the generic `CoreLlmClient`, like mermaid recovery, for the **web path**.
- The web bundle implements `CoreLlmClient` using the existing `GoogleGenAI` client, preserving behavior.
- The BFF’s `WrapUpService` remains a stub for now. Moving wrap‑up generation server‑side requires a clear design for how curriculum/module context (currently held in `src/index.tsx` and `src/moduleSelectionHandler.ts`) is surfaced to the BFF (e.g., via new turn metadata or a dedicated wrap‑up request path). Until that curriculum state story is defined, it is intentional that wrap‑up generation stays web‑only while the Core API and LLM interface are prepared for future BFF usage.

---

## Step 5 – Harden BFF Streaming, Limits, and Error Semantics

**Objective:** Align the BFF’s `/sessions`, `/sessions/:sessionId/turns`, and `/sessions/:sessionId/stream` behavior with the Functional Spec and mobile client expectations so the LLM proxy path is robust and production‑ready for Phase 1.

### 5.1 Enforce Turn Limits and Input Validation

File: `bff/src/controllers/sessionController.js`

- Confirm and enforce input length limits:
  - `MAX_INPUT_CHARS` should match the Functional Spec (e.g., 4000 characters).
  - For inputs exceeding this limit:
    - Return 413 with a clear message.
    - Do **not** create a turn or consume rate‑limit tokens.
- Harden error codes:
  - Invalid session → 400 with `code: 'BAD_REQUEST'` and message `"Unknown session"`.
  - Invalid turn payload → 400 with `code: 'BAD_REQUEST'`.
  - Over‑limit → 429 with `code: 'RATE_LIMITED'` and a `Retry-After` header in seconds.
  - Ensure `sendError` is used consistently so `code` and `message` fields are predictable.

### 5.2 Make Streaming Semantics Match Mobile Expectations

File: `bff/src/services/streamingService.js`

- Verify WebSocket message shapes:
  - `chunk` frames: `{ type: 'chunk', text: string }`.
  - `status` frames: `{ type: 'status', phase: 'started' | 'keepalive' | 'completed', footer?: FooterPayload }`.
  - `wrapUp` frames: `{ type: 'wrapUp', payload: any }` (payload shape compatible with `WrapUpAssessmentOverlayData` used in RN/Web bridge).
  - `error` frames: `{ type: 'error', code: ErrorCode, message: string }`, where `ErrorCode` is one of:
    - `'BAD_REQUEST'`, `'RATE_LIMITED'`, `'DOWNSTREAM_UNAVAILABLE'`, `'TURN_TIMEOUT'`.
- Harden lifecycle behavior:
  - Keepalive:
    - Ensure keepalive interval matches the Spec (e.g., ~15s) and emits `status` frames with `phase: 'keepalive'`.
  - Stall → buffered mode:
    - After a configurable stall duration (e.g., ~25s), switch to buffered mode and buffer remaining text.
    - On completion, send one final `chunk` with the buffered text and then `status: 'completed'`.
  - Hard timeout:
    - After the hard stream timeout (e.g., ~60s), send an `error` frame with `code: 'TURN_TIMEOUT'` and close the socket.
  - Always check `ws.readyState` before sending and guard `ws.send` calls in `try/catch` to avoid crashes on closed sockets.

### 5.3 Centralize Non‑Streaming LLM Calls Through `GeminiGateway`

File: `bff/src/integration/geminiGateway.js`

- Ensure `GeminiGateway` exposes:
  - `streamMainResponse(prompt, { context })` for main chat streaming (Step 1).
  - `callText(prompt, { task })` (and optionally `callJson`) for non‑streaming tasks like mermaid recovery.
- For `callText`:
  - Choose model/config based on `task` (e.g., `'mermaid_repair'`).
  - Enforce timeouts and safe cancellation.
  - Map provider errors into internal error shapes so callers can convert them to `DOWNSTREAM_UNAVAILABLE` or `TURN_TIMEOUT`.
- Confirm that:
  - `MermaidService` uses `GeminiGateway` via Core’s `CoreLlmClient` adapter.
  - No other BFF code calls `@google/genai` directly.

### 5.4 Logging and Telemetry Alignment

Files: `bff/src/utils/logger.js`, `bff/src/services/telemetryService.js`, `bff/src/controllers/*`

- Ensure log messages are structured and consistent:
  - Session lifecycle:
    - `[BFF] session created`, `[BFF] session missing`.
  - Turn lifecycle:
    - `[BFF] turn created`, `[BFF] turn replay`, `[BFF] turn accepted`, `[BFF] turn missing`.
  - Streaming:
    - `[BFF] stream started`, `[BFF] stream keepalive`, `[BFF] stream completed`, `[BFF] stream timeout`, `[BFF] stream error`.
  - LLM:
    - `[BFF] LLM request`, `[BFF] LLM error`, `[BFF] mermaid recovery`.
- Telemetry:
  - `/telemetry`:
    - Accepts `events: TelemetryEvent[]` as used by `TelemetryManager` in `SenseiMobile`.
    - Logs malformed payloads but still returns 204; telemetry must never break the app.

### 5.5 End‑to‑End Validation with the Mobile Client

With Steps 1–4 and this hardening in place:

1. Run the BFF and iOS app.
2. Validate:
   - Sessions and turns:
     - `BffClient.ensureSession()` creates sessions.
     - `submitTurn` returns `{ turnId, streamUrl }` with correct error handling for bad inputs and rate limits.
   - Streaming:
     - Short and long turns stream multiple `chunk` frames.
     - Keepalives and buffered mode behave correctly under slow or stalled network.
- Mermaid:
  - WebView mermaid errors trigger `/mermaid/recover`; BFF runs `mode:'auto'` first (deterministic fixes, falls through to LLM if unchanged) and, on subsequent attempts, `mode:'llm'` (force LLM) via `GeminiGateway`.
   - Wrap‑up (Phase 1):
     - Wrap‑up remains web‑driven, but BFF streaming does not interfere with the overlay flow.
   - Telemetry:
     - Telemetry events sent by `TelemetryManager` are accepted and logged; no errors or crashes on malformed events.

After Step 5:

- The BFF’s LLM streaming and tool endpoints are hardened and aligned with mobile expectations.
- All server-side LLM calls go through `GeminiGateway`, and error semantics are consistent.
- Phase 1’s foundational goal—secure, spec-aligned LLM proxy + mermaid support for the mobile app—is met. The **canonical Phase 1 teaching architecture** is still defined in Step 8: the WebView owns the teaching loop, and BFF remains the LLM proxy. Treat the hardened streaming path from this step as infrastructure that future work can reuse, not as a license to move teaching logic into BFF.

---

## Step 6 – Wrap-Up Assessment via Core + BFF (Parity with Web)

**Objective:** Use the shared Core wrap-up generator and `GeminiGateway` so that wrap-up assessments are produced by the same TS logic for both web and mobile, with all LLM calls going through the BFF. The learner should see the same wrap-up overlay and questions as the current web app, while BFF remains an LLM/infra proxy (no curriculum state on the server).

### 6.1 Confirm Core Wrap-Up Extraction (from Step 4)

Prerequisite: Step 4 is complete.

- Core:
  - `core/wrapUpAssessment.ts` exists and exports:
    - `generateWrapUpAssessment(llm: CoreLlmClient, moduleId: string, promptContext: WrapUpAssessmentPromptContext): Promise<WrapUpAssessmentGenerationResult | null>`.
    - `WrapUpAssessmentQuestion`, `WrapUpAssessmentGenerationResult`.
  - `WrapUpAssessmentPromptContext` and `buildWrapUpAssessmentPrompt` are owned by Core (either in `core/wrapUpAssessment.ts` or a nearby Core prompt module).
- Web:
  - `src/index.tsx` and `src/moduleSelectionHandler.ts` call the Core version of `generateWrapUpAssessment` with a web-side `CoreLlmClient` and still use:
    - `validateWrapUpAssessmentQuestions` and `WrapUpAssessmentOverlayData` from `src/wrapUpAssessment.ts`.

This ensures there is a single TS implementation for wrap-up generation that both environments can call.

### 6.2 Implement BFF-Side `CoreLlmClient` for Wrap-Up

Files: `bff/src/integration/geminiGateway.js`, `bff/src/integration/coreLlmAdapter.js` (or similar helper introduced in Step 3)

- Ensure `GeminiGateway` exposes a non-streaming primitive (from Step 3/5.3):
  - `callText(prompt, { task })` that:
    - Selects wrap-up-specific model/config when `task === 'wrap_up_assessment'` (e.g., using `WRAP_UP_ASSESSMENT_GENERATION_CONFIG` equivalent in BFF config).
    - Calls the Gemini SDK’s `generateContent` API and returns `response.text ?? ''`.
- Extend the BFF `CoreLlmAdapter` introduced for mermaid to support wrap-up:
  - When `task === 'wrap_up_assessment'`, delegate to `geminiGateway.callText(prompt, { task: 'wrap_up_assessment' })`.
  - Keep the existing behavior for other tasks (e.g., `mermaid_repair`).
- This adapter now satisfies Core’s `CoreLlmClient` interface for both mermaid and wrap-up.

### 6.3 Replace `WrapUpService` Stub with Real Core-Based Implementation

File: `bff/src/services/wrapUpService.js`

Replace the stub `maybeGenerateWrapUp`-only class with a real implementation that can be called both from HTTP and, optionally, from the streaming path:

- Constructor:
  - Accept dependencies: `{ logger, geminiGateway }` (and optionally config).
- Add:
  - `async generateWrapUp({ session, moduleId, promptContext })`:
    - Log `[WRAPUP_SERVICE] request-start` with `sessionId`, `moduleId`, `moduleTitle: promptContext.moduleTitle`.
    - Construct a `CoreLlmAdapter` instance using the shared `geminiGateway`.
    - Call Core:
      - `const result = await generateWrapUpAssessment(coreLlmClient, moduleId, promptContext);`
    - If `result` is null or has no questions:
      - Log `[WRAPUP_SERVICE] request-fail` and return `null`.
    - Otherwise, construct a `WrapUpAssessmentOverlayData` payload compatible with `src/wrapUpAssessment.ts` and the mobile bridge contracts:
      - `{ moduleTitle: promptContext.moduleTitle, moduleGoal: promptContext.moduleGoal || undefined, conceptSummaries: promptContext.conceptSummaries, questions: result.questions }`.
    - Log `[WRAPUP_SERVICE] request-success` with counts (15 questions, 5 snippets) and return this overlay payload.
- Keep `maybeGenerateWrapUp(context)` as a thin wrapper:
  - For Phase 1 LLM proxy, it is acceptable for `maybeGenerateWrapUp` to return `null` for normal chat turns.
  - If you define a dedicated “wrap-up turn” (see 6.4/6.5), `maybeGenerateWrapUp` can delegate to `generateWrapUp` when the turn metadata indicates a wrap-up request.

After this step, `wrapUpService` is no longer a stub; it can produce real overlay payloads using the same Core logic as the web app.

### 6.4 Add a Dedicated HTTP Endpoint for Wrap-Up

Files: `bff/src/routes/wrapUp.js`, `bff/src/controllers/wrapUpController.js`, `bff/src/routes/index` wiring

- Route:
  - `POST /sessions/:sessionId/wrapup`
- Request body:
  - `{ moduleId: string, promptContext: WrapUpAssessmentPromptContext }`
  - `promptContext` contains:
    - `moduleTitle: string`
    - `moduleGoal: string`
    - `solidifyContent: string`
    - `conceptSummaries: string[]`
- Controller behavior:
  - Validate `sessionId`, `moduleId`, and `promptContext` shape (reusing the same schema as Core/ web where possible).
  - Look up the session in `SessionStore`:
    - If missing, return 400 with `code: 'BAD_REQUEST'` and message `Unknown session`.
  - Call:
    - `const overlay = await wrapUpService.generateWrapUp({ session, moduleId, promptContext });`
  - If `overlay` is `null`:
    - Return 500 with `code: 'WRAP_UP_FAILED'` and a generic message.
  - Otherwise:
    - Return `200` with the `WrapUpAssessmentOverlayData` payload.

This endpoint keeps curriculum knowledge on the client: the client is responsible for constructing `promptContext` from its view of the module; the BFF only runs Core + LLM and returns the overlay payload.

### 6.5 Mobile: Use BFF Wrap-Up Endpoint and Existing Overlay Wiring

File: `SenseiMobile/src/mobile/network/BffClient.ts` (and the mobile orchestration that triggers wrap-up)

- Add a method on `BffClient`:
  - `async generateWrapUp(moduleId: string, promptContext: WrapUpAssessmentPromptContext): Promise<void>`:
    - Ensure a session via `ensureSession()`.
    - `POST` to `/sessions/{sessionId}/wrapup` with the body `{ moduleId, promptContext }`.
    - On success, parse the `WrapUpAssessmentOverlayData` payload.
    - Immediately enqueue a bridge event:
      - `this.bridge.enqueue({ type: 'wrapup:show', data: overlay } as any);`
- The WebView already handles this event type in `src/index.tsx`:
  - `case 'wrapup:show': showWrapUpAssessmentOverlay(message.data);`
- The module-selection / Solidify flow on mobile should:
  - Build the same `WrapUpAssessmentPromptContext` as the web code (using the module’s title, goal, and concept summaries).
  - Call `BffClient.generateWrapUp(...)` at the appropriate time.

This keeps wrap-up UX identical: the overlay is still rendered in the web bundle by `showWrapUpAssessmentOverlay`, but the questions now come from the BFF using Core + `GeminiGateway`.

### 6.6 (Optional) Use WS `wrapUp` Frames for Turn-Scoped Wrap-Up

If you prefer wrap-up to arrive on the same WebSocket stream as the main Sensei response (instead of via a separate HTTP call), you can reuse the existing `wrapUp` message path:

- On the BFF:
  - Decide on a way for a `Turn` to indicate a wrap-up request (e.g., `turn.metadata.wrapUpPromptContext`).
  - In `StreamingService.handleConnection`, after streaming the main response:
    - If `context.turn.metadata.wrapUpPromptContext` is present, call `wrapUpService.generateWrapUp({ session, moduleId, promptContext })`.
    - If it returns an overlay payload, send:
      - `this.#sendWrapUp(ws, overlayPayload);`
  - The existing `BffClient.createStream` already translates `wrapUp` frames into `wrapup:show` bridge events.
- On mobile/web:
  - Ensure the curriculum-derived `WrapUpAssessmentPromptContext` is attached to the turn metadata when the user triggers a wrap-up-specific action.

This optional variant keeps all wrap-up delivery on the WebSocket stream, but the core requirement—Core-based wrap-up generation with BFF-owned LLM calls—remains the same as in the HTTP design.

---

## Step 7 – Phase‑1 Methodology for Remaining `*` LLM Functions

**Objective:** Apply the same BFF‑centric LLM/infra‑proxy pattern to all remaining `*` LLM entry points listed in `docs/llm_entry_exit_traces.md`, without moving the teaching runtime to the server or duplicating logic. After this step, no `*` function talks to Gemini directly; all use `CoreLlmClient` implemented via `GeminiGateway` on the BFF.

This step defines the required process; it is meant to be repeated per `*` function.

### 7.1 For Each `*` Function, Define Its LLM Boundary

Using `docs/llm_entry_exit_traces.md` as the checklist:

- For each `*` function (e.g., `llmExtractAndPlanTeachingOrder`, `getAnalysisFromGemini`, `requestSenseiEnhancement`, Selection Sensei calls, key takeaway enhancer):
  - Identify:
    - Inputs: the structured data it consumes (text, module information, flags, context).
    - Output: the structured result it returns to the rest of the app.
  - Decide whether it behaves like:
    - A reusable “tool” (similar to mermaid or wrap-up), where moving the entire LLM logic into Core is realistic and beneficial for Phase 1.
    - A tightly web‑coupled helper where only the LLM **transport** should be proxied via BFF for now (logic stays in `src/`).

This choice determines whether you follow Pattern A (Shared Core) or Pattern B (LLM‑Only Proxy) below.

### 7.2 Introduce `CoreLlmClient` at the Function Boundary

For each `*` function:

- Refactor it so it no longer creates or owns a `GoogleGenAI` client directly:
  - Its signature becomes `(llm: CoreLlmClient, ...existingParams)` or it receives `llm` from an enclosing context.
  - Internal calls to `ai.models.generateContent(...)` are replaced with:
    - `llm.callText(prompt, { task: '...' })`, or
    - `llm.callJson<T>(prompt, { task: '...' })`.
- This mirrors what has already been done for:
  - `core/mermaidErrorRecovery.ts` (mermaid fix path).
  - `core/wrapUpAssessment.ts` (wrap-up generation).

After this refactor, each `*` function is agnostic about where the LLM actually runs.

### 7.3 Ensure BFF Provides a Single `CoreLlmClient` via `GeminiGateway`

On the BFF:

- Extend `GeminiGateway` if needed so that:
  - `callText(prompt, { task })` and/or `callJson(prompt, { task })` handle all Phase‑1 tasks the `*` functions need.
  - Model/config selection is based on `task` (e.g., `'teaching_plan'`, `'learner_analysis'`, `'enhancement'`, `'selection_sensei_followup'`), reusing the existing configuration schema.
- Maintain a `CoreLlmAdapter` (introduced in Steps 3 and 6) that:
  - Implements `CoreLlmClient`.
  - Delegates to `GeminiGateway.callText` / `callJson` with the appropriate `task`.

This adapter is the single BFF implementation of `CoreLlmClient` used by Core modules and, where appropriate, by thin HTTP endpoints that proxy raw LLM calls.

### 7.4 Required Pattern (Pattern A Only) per `*` Function

For every `*` function listed in `docs/llm_entry_exit_traces.md`, use Pattern A (Shared Core):
- Move the **entire implementation** into `core/<function>.ts`. That means: prompt builder, model/config selection, retries/backoff, response parsing/validation/normalization, and any helper transforms the caller relies on. The original `src/` file should retain only a thin call site (or re-export), not partial logic.
- Move the prompt builder(s) out of `src/prompts.ts` into the Core module (or make `prompts.ts` re-export the Core version) so there is one prompt source of truth.
- Export a function that depends on `CoreLlmClient` and returns the structured result the web expects.
- Web and BFF both call this Core function:
  - Web uses a browser `CoreLlmClient` implementation (local SDK or BFF-proxy).
  - BFF calls the same Core function via the BFF-side `CoreLlmAdapter`.
- If server ownership is wanted, add a small BFF endpoint for that tool that:
  - Accepts structured inputs.
  - Invokes the Core function with `CoreLlmAdapter`.
  - Returns the structured JSON output.
- After migrating each `*`, ensure the WebView/mobile build actually uses the BFF-backed path: wire the WebView’s `CoreLlmClient` (or a specific endpoint call) so Sensei Mobile executes the Core function via BFF → `GeminiGateway`, not the local SDK. Desktop web may continue to use the local SDK implementation. Use the existing WebView flag `window.__SENSEI_MOBILE_BUILD__` to branch. Example: mermaid recovery should send a bridge message to RN and let `BffClient.recoverMermaid` hit `/mermaid/recover`, then return the result to the WebView; desktop keeps the local `runMermaidRecovery` path.

### 7.5 Repeat Until All Phase‑1 `*` Functions Use BFF‑Backed `CoreLlmClient`

Iterate over all `*` entries in `docs/llm_entry_exit_traces.md`:

- For each, apply 7.1–7.4 using Pattern A only (no Pattern B).
- Confirm that:
  - The function now depends on `CoreLlmClient`.
  - The web/mobile `CoreLlmClient` implementation for the relevant build sends LLM traffic to the BFF.
  - The BFF’s `CoreLlmAdapter` delegates all LLM work to `GeminiGateway`.
- Verify behavior for each flow (planning, analysis, Selection Sensei, enhancements, key takeaways, etc.) remains consistent from a learner’s perspective.

After Step 7:

- All `*` LLM entry points in `docs/llm_entry_exit_traces.md` use `CoreLlmClient`; no direct `GoogleGenAI` construction remains.
- Prompts and parsing for the migrated functions live in Core (single source of truth).
- For mobile/WebView builds, `CoreLlmClient` is implemented via BFF → `GeminiGateway`; web desktop can use either local SDK or BFF-proxy.
- BFF continues as LLM/infra proxy (no curriculum/learner state); Core + web remain the source of teaching logic/UX.

---

## Step 8 – Mobile Wiring: Web Bundle Owns the Turn, BFF Owns LLM

**Objective:** Ensure that on mobile, the same teaching pipeline used on the web (`handleUserInput` → `generateNextSenseiResponse` → curriculum/learner updates) drives each turn, while all LLM calls inside that pipeline still go through the BFF via `CoreLlmClient`. The WebView remains the “teacher,” and BFF remains the LLM/infra proxy.

### 8.1 Split `handleUserInput` into DOM Reader vs. Text Processor

File: `src/index.tsx`

- Extract the core logic of `handleUserInput(event)` into a new function:
  - `async function handleUserInputText(rawInput: string): Promise<void>`
    - Responsibilities:
      - Create and display the user `Message` bubble (`displayMessage`).
      - Run the module selection / `mskip` / normal teaching logic:
        - Calls `handleInitialModuleSelectionInternal` when there is no `curriculumState`.
        - Calls `generateNextSenseiResponse(rawInput)` in the “normal” path.
      - Performs any necessary UI cleanup (clearing input, autosize).
- Make the existing `handleUserInput(event)` a thin wrapper:
  - Read `rawInput` from the textarea (`userInputElement.value`).
  - Call `handleUserInputText(rawInput)`.

After this change, both DOM events and bridge messages can reuse the same text-processing pipeline.

### 8.2 Add a Bridge Message for User Input

Files: `src/mobile/bridge/contracts.ts`, `src/index.tsx`

- In `src/mobile/bridge/contracts.ts`, add a new RN→Web message type:
  - `{ type: 'chat:userInput'; clientTurnId: string; text: string }`
    - `clientTurnId` mirrors the ID used by telemetry on RN.
- In the WebView bridge handler in `src/index.tsx` (the `switch` on `message.type` that already handles `chat:startMessage`, `chat:update`, `chat:completeMessage`, `wrapup:show`, etc.):
  - Add:
    - `case 'chat:userInput': { await handleUserInputText(message.text); break; }`

Now RN can send user input text into the web bundle, and the web bundle will run the same teaching logic as desktop for that text.

### 8.3 Change RN `MainScreen` to Send Input to WebView, Not Directly to BFF

File: `SenseiMobile/src/mobile/MainScreen.tsx`

- In `handleSubmit` (or its equivalent), change the behavior for the main chat path:
  - Keep:
    - Trimming and early return if `!trimmed` or `isStreaming`.
    - `clientTurnId = telemetryManager.nextClientTurnId()`.
    - Telemetry logging (`turn_submitted`).
  - Instead of calling `bffClient.submitTurn` for the main chat:
    - Enqueue a bridge message:
      - `bridge.enqueue({ type: 'chat:userInput', clientTurnId, text: trimmed });`
  - Optionally:
    - Either continue to enqueue a `chat:startMessage` for the user bubble, or let `handleUserInputText` handle message creation and display entirely. The key requirement is that teaching logic and Sensei response generation happen in the WebView, not on BFF.

After this, mobile user input flows through the same `handleUserInputText` / `generateNextSenseiResponse` pipeline as desktop, but still carries a `clientTurnId` for telemetry.

### 8.4 Ensure Web LLM Calls Use BFF-Backed `CoreLlmClient` in Mobile Builds

Files: Core + web LLM integration (from Steps 3, 4, 6, 7)

- Using the methodology in Step 7, make sure all `*` functions used by `generateNextSenseiResponse` and its helpers:
  - Depend on `CoreLlmClient` (no direct `GoogleGenAI`).
  - For the mobile/WebView build, the `CoreLlmClient` implementation:
    - Calls BFF endpoints (e.g., generic `/llm/text` or tool-specific endpoints like `/sessions/:sessionId/wrapup` for wrap-up) instead of calling Gemini directly.
    - Uses the same `task` routing and configs as `GeminiGateway`.
- For streaming main responses:
  - Either:
    - Introduce a small web-side `BffClient` that `streamMainSenseiResponse` can use to call BFF’s `/sessions/:sessionId/turns` + `/stream` and turn streamed text into the same callbacks the web code expects, or
    - Temporarily accept non-streaming LLM responses for Phase 1 mobile if streaming integration adds too much complexity (in which case, the `CoreLlmClient` in mobile builds calls a non-streaming BFF endpoint and returns completed text to `generateNextSenseiResponse`).

The key requirement is that *from the WebView’s perspective*, `generateNextSenseiResponse` and related functions see an `llm` that ultimately uses BFF → `GeminiGateway`, not direct `@google/genai`.

### 8.5 Limit RN `runForwardStream` to Future Server-Driven Modes

Files: `SenseiMobile/src/mobile/MainScreen.tsx`, `SenseiMobile/src/mobile/network/BffClient.ts`

- Once the WebView path is in place:
  - The main mobile teaching flow no longer uses `BffClient.submitTurn` → `runForwardStream` to drive Sensei responses.
  - You can:
    - Keep `runForwardStream` for future “server-driven” modes (e.g., Phase 2 Core runtime where BFF owns teaching logic), or
    - Confine its usage to non-core features that explicitly need server-streamed text.
- For Phase 1:
  - The canonical path for teaching turns on mobile is:
    - RN input → `chat:userInput` → WebView `handleUserInputText` → `generateNextSenseiResponse` → `CoreLlmClient` → BFF → `GeminiGateway`.

After Step 8:

- Mobile turns use the same teaching pipeline as web: `handleUserInputText` and `generateNextSenseiResponse` in the WebView remain the source of truth for curriculum and learner behavior.
- All LLM calls inside that pipeline still go through BFF’s `GeminiGateway` via `CoreLlmClient`, preserving the Phase‑1 “LLM/infra proxy” design.
- RN’s responsibility is limited to capturing input, relaying it to the WebView, and forwarding UI-related events (wrap-up overlay, footer, selection, telemetry), not running the teacher loop.
- Earlier steps’ direct RN→BFF→WebView streaming patterns for main turns should now be treated as **transitional** or reserved for future server-driven modes; they are not the canonical Phase 1 teaching path once Step 8 is in place.

---

## Phase 2 – Core Teaching Runtime (Future Work)

The following steps outline a **future** migration path toward a shared Core teaching runtime and server‑driven pedagogy. They are **not required** for Phase 1 BFF (LLM proxy + mermaid + wrap‑up support).

### Phase 2 – Step 1: Design the Core Teaching Runtime API

Define a Core‑level API around existing `CurriculumState` and `LearnerModel` that mirrors `generateNextSenseiResponse`, but without DOM or SDK calls:

- Introduce `CoreState` reusing `CurriculumState` and `LearnerModel`.
- Define `TeachingRuntimeInput` and an event or plan API for turns.
- Add a stub `runTeachingTurn` or `prepareTeachingTurn` in Core, with comments mapping the current web behavior to the future Core implementation.

### Phase 2 – Step 2: Implement Core Turn Preparation and Adapt Web

Once the API is in place, implement Core turn preparation and adapt the web bundle:

- Move non‑DOM logic from `generateNextSenseiResponse` into a Core `prepareTeachingTurn` function (analysis, curriculum advancement, prompt building, wrap‑up prep).
- Have `generateNextSenseiResponse` construct `CoreState`/`TeachingRuntimeInput`, call `prepareTeachingTurn`, and apply the resulting plan:
  - Update in‑memory state from `updatedState`.
  - Use `dynamicSystemInstruction` + `effectiveUserInput` with `streamMainSenseiResponse`.
  - Render wrap‑up from `wrapUpPayload`.
- Streaming (`streamMainSenseiResponse`) and DOM updates remain in the web layer; Core stays UI‑agnostic.

These Phase 2 steps become relevant when you decide to move the teaching loop into shared Core and, eventually, let the BFF drive pedagogy. They are documented here as a roadmap, but are not part of the Phase 1 BFF implementation.

---

## Appendix – BFF Architectural Overview (Folder Layout and Responsibilities)

This section summarizes where BFF functionality lives so later steps can be slotted in systematically.

All paths below are relative to `bff/`.

### Top Level

- `index.js` / `server.js`
  - Bootstraps Express + WebSocket.
  - Creates the DI container and passes dependencies into routes and the stream server.
- `src/`
  - Contains all BFF implementation code described below.

### `src/config/`

- Holds configuration and wiring for:
  - LLM model names and generation parameters.
  - Timeouts and keepalive intervals.
  - Rate‑limit settings.
  - Topic registry / allowed `topicId`s.
- No business logic; configuration only.

### `src/container.js`

- Dependency injection wiring:
  - Instantiates:
    - `SessionStore`, `RateLimiter`.
    - `SessionService`, `TurnService`, `StreamingService`.
    - `MermaidService`, `WrapUpService`, `TelemetryService`.
    - `SenseiCoreAdapter`, `GeminiGateway`.
  - Returns a single object of constructed dependencies used by:
    - Route modules (`src/routes/*`).
    - WebSocket stream server (`src/stream/*`).

### `src/routes/`

- Express route wiring only:
  - `sessions.js`:
    - `POST /sessions`.
    - `POST /sessions/:sessionId/turns`.
  - `mermaid.js`:
    - `POST /mermaid/recover`.
  - `telemetry.js`:
    - `POST /telemetry`.
- Each route module:
  - Constructs the appropriate controller with dependencies from `container.js`.
  - Forwards requests to controller methods.

### `src/controllers/`

- HTTP‑facing controllers with validation and response shaping:
  - `SessionController`:
    - Validates `/sessions` and `/turns` payloads (via zod).
    - Calls `SessionService` / `TurnService`.
    - Returns `{ sessionId }` and `{ turnId, streamUrl }`.
  - `MermaidController`:
    - Validates mermaid recovery payload.
    - Calls `MermaidService.recover`.
    - Returns `{ fixed, fixedCode? }`.
  - `TelemetryController`:
    - Validates telemetry envelopes.
    - Calls `TelemetryService.ingest`.
    - Always returns 204 (telemetry is non‑critical).
- Controllers do not contain domain logic; they translate HTTP ↔ service calls.

### `src/stream/`

- WebSocket server integration:
  - Attaches a `ws` server to the HTTP server.
  - Routes `/sessions/:sessionId/stream?turnId=…` to:
    - Lookup of dependencies from the container.
    - `StreamingService.handleConnection`.
- Owns handshake details and connection lifecycle; delegates streaming semantics to `StreamingService`.

### `src/services/` (Domain Services)

- `sessionService.js`
  - Thin layer over `SessionStore`:
    - Creates sessions, applies topic validation.
    - Looks up sessions by `sessionId`.
- `turnService.js`
  - Manages turn creation and idempotency:
    - `createOrGetTurn(session, clientTurnId, input, metadata)`.
    - `getTurn(turnId)` for streaming.
- `streamingService.js`
  - Orchestrates WebSocket streaming for a turn:
    - Validates `{ sessionId, turnId }`.
    - Builds a `context` object with `session` and `turn`.
    - Calls `SenseiCoreAdapter.buildPrompt(context)`.
    - Calls `GeminiGateway.streamMainResponse(prompt, { context })`.
    - Sends WS messages:
      - `status` (`started`, `keepalive`, `completed`) with optional footer.
      - `chunk` with streamed text.
      - `wrapUp` if wrap‑up is available.
      - `error` on failure, using `ErrorMapper`.
    - Enforces:
      - Keepalive interval.
      - Stall→buffered mode behavior.
      - Hard timeout with `TURN_TIMEOUT`.
- `mermaidService.js`
  - Mermaid diagram recovery domain logic:
    - `mode:'auto'`: applies deterministic fixes and, if they make no change, falls through to a single LLM attempt in the same call.
    - `mode:'llm'`: forces an LLM attempt (skips deterministic early-return).
    - Returns `{ fixed, fixedCode? }` to controllers.
    - Returns `{ fixed, fixedCode? }` to controllers.
- `wrapUpService.js`
  - Phase‑1 stub:
    - `maybeGenerateWrapUp(context)` currently logs and returns `null`.
    - Later: will call Core wrap‑up helpers via `GeminiGateway` and return validated overlay payloads.
- `telemetryService.js`
  - Accepts telemetry events and logs or aggregates them.
  - Ensures telemetry failures never break main flows.

### `src/infra/` (Infrastructure)

- `sessionStore.js`
  - In‑memory store for:
    - `Session` objects.
    - `Turn` objects.
    - `clientTurnId` → `turnId` mappings per session (idempotency).
  - Future‑proofed so it can later be backed by Redis or another store.
- `rateLimiter.js`
  - Per IP/UA rate limiting:
    - Enforces Functional Spec limits on `/turns`.
    - Returns “allowed / retryAfterSeconds” to controllers or `TurnService`.

### `src/integration/` (External Integrations)

- `geminiGateway.js`
  - The only place that knows about the Gemini SDK:
    - Creates the Gemini client using API key and config.
    - Implements:
      - `streamMainResponse(prompt, { context })` for main teaching streams.
      - (Later) generic primitives for other LLM calls (text/JSON).
    - Handles:
      - Timeouts and cancellation.
      - Logging of prompt metadata and errors.
      - Translation of provider errors into internal error shapes.
  - Does not contain teaching or mermaid logic; it is an LLM transport layer.
- `senseiCoreAdapter.js`
  - Phase‑1 “core façade”:
    - `buildPrompt(context)`:
      - Converts `Turn` (and, later, curriculum state) into a full prompt for `GeminiGateway`.
    - `deriveFooter(context)`:
      - Produces a footer payload for WS `status` messages.
  - Over time, this adapter will call shared Core modules (extracted from `src/`) instead of inlined logic.

### `src/middleware/`

- Shared Express middleware:
  - CORS, JSON body parsing, basic request logging.
  - No business or LLM logic.

### `src/utils/`

- Utility helpers:
  - `logger.js`: structured logging helpers.
  - `errorMapper.js`: maps internal errors to:
    - HTTP `{ status, body: { code, message } }`.
    - WS `{ code, message }` error frames.
  - Other pure helpers (ID generation, timing) as needed.

This layout keeps concerns separated:

- **Integration (`geminiGateway`)** owns LLM provider details.
- **Domain services (`streamingService`, `mermaidService`, `wrapUpService`)** own teaching and diagram semantics.
- **Infra (`sessionStore`, `rateLimiter`)** owns storage and limits.
- **Controllers/routes** handle HTTP/WS boundaries.

Future Core extraction (moving TS from `src/` into a shared package) will primarily change `senseiCoreAdapter.js` and some service internals, without disrupting this folder structure.

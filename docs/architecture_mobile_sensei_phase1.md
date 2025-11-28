# Mobile Sensei Architecture – Phase 1 (BFF LLM Proxy)

## 1. Purpose & Scope

This document explains how the **mobile Sensei system** is wired end‑to‑end in Phase 1:

- How the React Native shell app, WebView bundle, BFF, and Core package work together.
- How data moves between components (input, turns, mermaid, wrap‑up, telemetry).
- What the **Phase 1 architecture goal** is (BFF as LLM/infra proxy; WebView owns teaching), and where the code is still migrating toward that goal.
- How to safely extend the BFF and Core for future mobile work.

It is written for engineers new to this repo who need to understand mobile behavior and continue Phase 1+ work, especially on the BFF and Core.

This document focuses on:

- The **mobile** runtime (SenseiMobile + WebView).
- The **BFF** as an LLM gateway.
- The **Core** package (`@sensei/core`) as the home of reusable LLM tools (e.g., mermaid recovery).

Desktop web and the full teaching/pedagogy model are referenced but not described exhaustively.

---

## 1.1 How to Use This Guide

If you are new to this codebase and need to understand or extend the mobile stack, read this document **in tandem** with:

- `docs/bff_implementation_walkthrough.md` – for the phased BFF rollout and Step 8 intent.
- `docs/llm_entry_exit_traces.md` – for the complete list of LLM entry points (`*` functions) in the web app.
- `docs/architecture_mobile_llm_tools_migration_plan.md` – for detailed, per‑function migration guidance for those `*` functions.
- The source files referenced in each section (paths are listed explicitly).

Recommended reading order / usage:

1. **Big picture (this doc, Sections 2–4):**
   - Understand the repo layout, the roles of `src/`, `SenseiMobile/`, `bff/`, and `core/`.
   - Ground yourself in the Phase 1 goals: WebView owns teaching; Core owns tools; BFF owns LLM/infra.
2. **Flows (Sections 5–7):**
   - Follow the end‑to‑end flows:
     - App launch.
     - Main teaching turn (Step 8 target).
     - Mermaid and wrap‑up behavior.
   - Cross‑reference the mentioned files as needed.
3. **Extending BFF/Core (Sections 8–9):**
   - Before touching any LLM‑related code:
     - Look up the relevant `*` function(s) in `docs/llm_entry_exit_traces.md`.
     - Use Section 9 here plus `docs/architecture_mobile_llm_tools_migration_plan.md` to:
       - Identify the tool vs orchestration parts.
       - Decide what belongs in Core, what stays in `src/`, and what BFF endpoints are needed.
4. **While coding:**
   - Keep this doc open to check:
     - Which component should own which responsibility (UI vs Core vs BFF).
     - What patterns to reuse (e.g., the mermaid request–response pattern).
   - Keep the migration plan doc open for the specific function(s) you are modifying.

If you ever find yourself:

- Adding a new `@google/genai` call in `src/`, or
- Re‑implementing a prompt/parsing routine that looks similar to existing Core logic,

stop and re‑read Sections 3, 8, and 9 here plus the migration plan—those are the guardrails to keep the architecture coherent and DRY.

## 2. Repository Layout & Project Boundaries

High‑level structure relevant to mobile:

- `src/`
  - Browser/web app (Sensei UI and teaching logic).
  - Important files:
    - `src/index.tsx` – main web entrypoint; teaching pipeline, input handling, curriculum boot.
    - `src/ui.ts` – chat UI, message rendering, mermaid rendering/recovery.
    - `src/mobile/` – webview‑side mobile integration:
      - `src/mobile/webviewBridge.ts` – low‑level RN↔WebView messaging.
      - `src/mobile/webviewMessageRouter.ts` – routes bridge messages to web handlers; mermaid bridge.
      - `src/mobile/bridge/contracts.ts` – re‑exports RN bridge contracts for web.
      - `src/mobile/network/types.ts` – re‑exports RN network types for web.

- `SenseiMobile/`
  - React Native shell app (iOS/Android).
  - Important files:
    - `SenseiMobile/App.tsx` – RN app root.
    - `SenseiMobile/src/mobile/MainScreen.tsx` – main mobile screen; hosts WebView, header, input bar, overlay, and bridge.
    - `SenseiMobile/src/mobile/bridge/BridgeManager.ts` – queues RN→WebView messages.
    - `SenseiMobile/src/mobile/bridge/contracts.ts` – canonical RN↔WebView message types.
    - `SenseiMobile/src/mobile/network/BffClient.ts` – RN BFF client (HTTP + WebSocket).
    - `SenseiMobile/src/mobile/network/types.ts` – BFF payload/result types (e.g., `MermaidRecoveryPayload`).
    - `SenseiMobile/src/mobile/saveLoad/*` – mobile‑specific save/load integration.
    - `SenseiMobile/src/mobile/telemetry/TelemetryManager.ts` – mobile telemetry adapter.

- `bff/`
  - Backend‑for‑Frontend server (Node, Express/WebSocket).
  - Important files:
    - `bff/src/config/index.js` – environment/config, Gemini settings.
    - `bff/src/integration/geminiGateway.js` – wraps Gemini SDK; streaming + non‑streaming calls.
    - `bff/src/integration/coreLlmAdapter.js` – implements `CoreLlmClient` on the BFF.
    - `bff/src/services/streamingService.js` – main streaming turn handler.
    - `bff/src/services/mermaidService.js` – mermaid recovery service using Core.
    - `bff/src/controllers/*` – HTTP controllers (sessions, mermaid, telemetry).
    - `bff/src/routes/*` – routing.

- `core/` (published as `@sensei/core`)
  - Shared, environment‑agnostic TS modules.
  - Important files:
    - `core/mermaidErrorRecovery.ts` – deterministic and LLM‑assisted mermaid recovery.
    - `core/modelUsage.ts` – LLM model and mermaid config (including mermaid timeouts).
    - `core/llmTypes.ts` – `CoreLlmClient` interface.
    - `core/browserLlmClient.ts` – adapter from browser `ai` SDK to `CoreLlmClient`.
    - `core/index.ts` – public exports (mermaid, LLM types, browser adapter).

- `docs/`
  - Specs, walkthroughs, mission state.
  - Particularly relevant:
    - `docs/bff_implementation_walkthrough.md` – Phased BFF rollout (this doc must match its Phase 1 intent).
    - `docs/architecture_mobile_llm_tools_migration_plan.md` – per‑function migration guidance for all `*` LLM entry points.
    - `docs/engineering/mobile_phase1_engineering_spec.md`, `docs/functional_spec/recursive_sensei_mobile_phase1_functional_spec.md`.

---

## 3. Phase 1 Architecture Goals (BFF Walkthrough Alignment)

Phase 1 as described in `docs/bff_implementation_walkthrough.md` has three key goals for mobile:

1. **BFF as the LLM proxy for mobile**
   - Mobile must not talk directly to Gemini/`@google/genai`.
   - Main Sensei chat and mermaid recovery use BFF → `GeminiGateway` for LLM calls.

2. **Core owns reusable LLM tools**
   - Logic like mermaid recovery lives in Core (`@sensei/core`), not duplicated in BFF or web.
   - Core uses a generic `CoreLlmClient` interface for all LLM work.

3. **WebView “owns the turn,” BFF owns LLM (Step 8 intent)**
   - The **same teaching pipeline used on desktop** (`handleUserInputText` → `generateNextSenseiResponse` → curriculum/learner updates) remains the source of truth, even on mobile.
   - RN InputBar sends **text** into that pipeline via a bridge (`chat:userInput`), not directly into BFF.
   - All LLM calls *inside* that teaching pipeline use `CoreLlmClient` implementations that, for mobile/WebView, call the BFF instead of a browser SDK.

Special cases / current status:

- **Mermaid recovery**
  - Core (`core/mermaidErrorRecovery.ts`) owns deterministic + LLM mermaid fixes.
  - BFF implements `CoreLlmClient` via `coreLlmAdapter` + `GeminiGateway` and exposes `/mermaid/recover`.
  - Mobile mermaid recovery already goes through BFF; web desktop can still use the browser SDK path.

- **Wrap‑up assessment**
  - Phase 1: wrap‑up generation logic and its prompt live in Core; the **web path** uses it via a browser `CoreLlmClient`.
  - BFF’s wrap‑up service remains a stub until curriculum/module state is properly surfaced server‑side.

---

## 4. Mobile Runtime Components

### 4.1 React Native Shell (`SenseiMobile`)

`SenseiMobile/src/mobile/MainScreen.tsx`:

- Hosts:
  - `SenseiHeader` and backdrop effects.
  - Central WebView surface.
  - `InputBar` at the bottom.
  - Selection overlay and telemetry.
- Wires:
  - `BridgeManager` (RN→WebView send API).
  - `BffClient` (HTTP/WS client for BFF).
  - `SaveLoadService` and `TelemetryManager`.

It uses `react-native-webview` to load `SenseiMobile/app_web/webview_dist/index.html` and injects:

- `window.__SENSEI_MOBILE_BUILD__ = true` (so web bundle can branch on “mobile build”).
- A runtime error bridge to report WebView errors back to RN.

### 4.2 WebView Bundle (`src/` → `SenseiMobile/app_web/webview_dist`)

Built via:

- `npm run webview:bundle` – bundles `src/index.tsx` + dependencies into `SenseiMobile/app_web/webview_dist/index.js` and copies CSS/HTML.

Key responsibilities:

- Teaching pipeline and UI:
  - `src/index.tsx` – teaching entrypoint, curriculum load, `handleUserInput`/`handleUserInputText`.
  - `src/ui.ts` – chat bubbles, markdown/mermaid rendering, mermaid recovery UI, footer.
  - `src/selectionSensei.ts` – selection‑based interactions in web.
- Mobile bridge:
  - `src/mobile/webviewBridge.ts` – registers message handler with the RN WebView.
  - `src/mobile/webviewMessageRouter.ts` – top‑level router for RN→Web messages; handles save/load, chat lifecycle, footer, wrap‑up, mermaid recovery results.
  - `src/mobile/bridge/contracts.ts` – re‑exports RN bridge contracts for TS reuse.

### 4.3 BFF (`bff/`)

For mobile Phase 1:

- Acts as an **LLM and infra proxy**:
  - Provides `/sessions`, `/turns`, and stream endpoints for main chat (Step 1/5).
  - Provides `/mermaid/recover` for mermaid recovery, implemented via Core.
  - Telemetry endpoints.
- Never manipulates DOM/HTML; it only moves JSON and text.

Core LLM integration:

- `bff/src/integration/geminiGateway.js`:
  - Wraps `@google/generative-ai`.
  - `streamMainResponse(prompt, { context })` – streaming chat.
  - `callText(prompt, { task })` – non‑streaming tools (e.g., `'mermaid_repair'`).
- `bff/src/integration/coreLlmAdapter.js`:
  - Implements `CoreLlmClient` over `GeminiGateway` for Core tools (mermaid, future wrap‑up).

### 4.4 Core (`@sensei/core`)

Core contains environment‑agnostic, reusable TS logic:

- `core/mermaidErrorRecovery.ts`:
  - Deterministic fixes: backticks, quoting, `graph` directives, `direction TD` normalization.
  - LLM fixes via `CoreLlmClient`.
  - `runMermaidRecovery` orchestrator (used on web desktop).
- `core/modelUsage.ts`:
  - `MERMAID_ERROR_RECOVERY_CONFIG` – model + config for mermaid.
  - `MERMAID_RECOVERY_TIMEOUT_MS` – global mermaid LLM timeout (currently 40 s).
- `core/llmTypes.ts`:
  - `CoreLlmClient` interface (`callText`/`callJson` with optional `task`).
- `core/browserLlmClient.ts`:
  - `createBrowserCoreLlmClient(ai)` – adapter from browser `ai` SDK to `CoreLlmClient` (used on desktop web).

---

## 5. Runtime Flow – From App Launch to First Teaching Turn

### 5.1 Launch & Bootstrap

1. **RN app startup**
   - `SenseiMobile/App.tsx` mounts `MainScreen`.
   - `MainScreen` creates `BridgeManager`, `BffClient`, `TelemetryManager`, `SaveLoadService`.

2. **WebView initialization**
   - WebView loads `app_web/webview_dist/index.html`.
   - Injected JS sets `window.__SENSEI_MOBILE_BUILD__ = true` and installs a window error bridge.

3. **Web bundle bootstrap (`src/index.tsx`)**
   - Sets up logger, curriculum, teaching state, message registry.
   - Calls `initializeWebviewBridge(handleReactNativeMessage)`, where `handleReactNativeMessage` is created via `createWebviewMessageHandler` from `src/mobile/webviewMessageRouter.ts`.

At this point, RN and WebView have a full duplex message channel via `BridgeManager` and `webviewBridge`.

### 5.2 Main Teaching Turn – Step 8 Target Flow

The **target Phase 1 architecture** from Step 8 is:

1. Learner types into RN `InputBar`.
2. RN `MainScreen`:
   - Validates input, obtains `clientTurnId` from `TelemetryManager`.
   - Sends a **bridge message**:
     - `{ type: 'chat:userInput', clientTurnId, text }` via `BridgeManager.enqueue`.
3. WebView `createWebviewMessageHandler` sees `chat:userInput`:
   - Calls `handleUserInputText(text)` in `src/index.tsx`.
4. `handleUserInputText`:
   - Creates the user bubble via `displayMessage`.
   - Runs module selection / ms‑skip / teaching logic:
     - When appropriate, calls `generateNextSenseiResponse(text)`.
   - That function uses Core LLM tools (teaching prompts, analysis, enhancements) **through a `CoreLlmClient`**.
5. In the **mobile build**, that `CoreLlmClient` implementation:
   - Calls BFF endpoints (e.g., generic `/llm/text` or tool‑specific) instead of directly calling the Gemini SDK.
   - BFF uses `GeminiGateway` to get LLM output, and returns structured JSON/text back to the web bundle.
6. WebView updates UI (Sensei bubble text, mermaid rendering, footer, wrap‑up) based solely on the Core tool outputs and existing teaching pipeline, exactly as on desktop.

**Current code status:**  
The repository today still uses a direct RN→BFF→WebView streaming path for main responses. Step 8 describes the **direction we are moving toward**: WebView owning the entire teaching loop, with BFF used only as an LLM proxy via `CoreLlmClient`. New work on BFF/Core should be consistent with this target.

---

## 6. Mermaid Rendering & Recovery (Mobile Phase 1)

Mermaid is the first fully migrated Core tool used by both web and BFF.

### 6.1 Rendering Pipeline

On both web and mobile:

1. Sensei response markdown is rendered into a bubble.
2. `processMermaidBlocks(messageId, options?)` in `src/ui.ts`:
   - Finds `<pre><code class="language-mermaid">` blocks in the bubble.
   - Tries `mermaidManager.render(...)`.
   - On success: calls `renderMermaidThumbnailWithTheme(...)` and returns.

### 6.2 Desktop Web Recovery (Local LLM)

For desktop web (non‑mobile build):

- On render failure:
  - `runMermaidRecovery` from `@sensei/core/mermaidErrorRecovery` is called with:
    - `llm: createBrowserCoreLlmClient(window.ai)` (a `CoreLlmClient`).
    - `initialDiagram` and `initialError`.
    - A `renderAttempt` callback that calls `mermaidManager.render`.
  - `runMermaidRecovery`:
    - Applies deterministic fixes (backticks, quotes, `graph` directive).
    - On repeated failure, calls `attemptMermaidFix` via the provided `CoreLlmClient` (Gemini through `window.ai`).
    - Attempts to render each candidate diagram; on success, returns `{ svg, diagram }`.
  - UI:
    - Replaces the original code fence in the raw text (`replaceMermaidFenceInRaw`).
    - Renders the recovered diagram thumbnail.

### 6.3 Mobile Recovery (BFF LLM Proxy)

For mobile WebView (`window.__SENSEI_MOBILE_BUILD__ === true`):

1. Render failure in `processMermaidBlocks`:
   - Swaps the code block for a spinner div (“Attempting to fix diagram…”).
2. Determines mobile build and uses the bridge:
   - Calls `requestMermaidRecoveryViaBridge({ messageId, code, theme, errorMessage, mode })`.
   - Under the hood:
     - Sends `WebToRNMessage { type: 'mermaid:recover', ... }` via `sendToNative`.
     - Starts a resolver with a bridge timeout derived from `MERMAID_RECOVERY_TIMEOUT_MS`.
3. RN `MainScreen` receives `mermaid:recover`:
   - Calls `bffClient.recoverMermaid(payload)` → `POST /mermaid/recover`.
   - On success, enqueues `RNToWebMessage { type: 'mermaid:recoverResult', messageId, fixed, fixedCode? }`.
4. BFF `MermaidService`:
   - Uses Core deterministics:
     - `ensureGraphDirective`, `applyBacktickFix`, `applyUniversalQuoteFix`, `fixSubgraphDirections`.
   - For `mode:'auto'`:
     - Applies deterministic fixes; if they change the diagram, returns `{ fixed:true, fixedCode }`.
   - Otherwise:
     - Uses `CoreLlmAdapter` (BFF `CoreLlmClient`) + `attemptMermaidFix` in Core to call Gemini via `GeminiGateway`.
     - Returns `{ fixed:true, fixedCode }` or `{ fixed:false }`.
5. WebView `handleMermaidRecoverResult` resolves the pending promise:
   - On `{ fixed:true, fixedCode }`:
     - Tries `mermaidManager.render` with the recovered diagram.
     - On success, patches the raw text fence and renders the thumbnail.
   - If all attempts fail:
     - Replaces the spinner with a static error message and patches the raw text to reflect the failure.

**Mermaid request–response pattern (template for future tools):**

- WebView is responsible for:
  - Detecting the need for a tool (e.g., a failed diagram).
  - Sending a *structured request* via the bridge (`WebToRNMessage`).
  - Receiving a *structured response* (`RNToWebMessage`) and:
    - Updating its own canonical state (raw markdown, teaching state).
    - Rendering UI (SVGs, overlays, error messages).
- RN is responsible for:
  - Relaying the request to BFF (`BffClient`) and forwarding the response back.
  - Adding telemetry context (e.g., `messageId`, `clientTurnId`).
- BFF is responsible for:
  - Validating input, calling the Core tool with `CoreLlmClient` (LLM via `GeminiGateway`).
  - Returning JSON with **no UI concerns** (no HTML, no layout decisions).

Future BFF‑backed tools (beyond mermaid) should follow this exact pattern: a clear WebView‑initiated request, a thin RN/BFF relay, Core‑based processing on the server, and WebView‑owned application of the result to UI.

Timeout coordination:

- `MERMAID_RECOVERY_TIMEOUT_MS` (Core) – max Gemini time (40 s).
- RN `BffClient.recoverMermaid` – aborts the HTTP call slightly above that (~42 s).
- Web `requestMermaidRecoveryViaBridge` – waits slightly longer (~44 s) before giving up.

Result: Gemini work is not discarded while still in flight; fallback UI only appears after deterministic/LLM attempts and coordinated timeouts are exhausted.

---

## 7. Wrap‑Up Assessment (Current Phase 1)

Current state, per the BFF walkthrough:

- Core wrap‑up module:
  - `core/wrapUpAssessment.ts` (planned/partially implemented) owns prompt+parsing for wrap‑up generation.
  - It uses `CoreLlmClient`, similar to mermaid.
- Web path:
  - Desktop and WebView bundles call the Core wrap‑up tool using a browser `CoreLlmClient` (local SDK).
  - They still validate questions and build overlay payloads via `src/wrapUpAssessment.ts`.
- BFF:
  - `wrapUpService` remains a stub during Phase 1.
  - A real BFF wrap‑up endpoint is deferred until curriculum/module state can be surfaced server‑side in a principled way.

Phase‑1 implication:

- Mobile WebView **still uses the web path for wrap‑up**.
- BFF does **not yet** own LLM for wrap‑up responses; this is a planned extension after Phase 1.

---

## 8. BFF as LLM Proxy – Design & Extension Guidelines

To extend BFF/Core in line with Phase 1 architecture:

1. **Core first**
   - New LLM‑backed tools (e.g., analysis, enhancements, future wrap‑up work) should:
     - Live in `core/` as pure TS modules.
     - Accept a `CoreLlmClient` and return structured results (no DOM or SDK imports).

2. **BFF implements `CoreLlmClient`**
   - Use `GeminiGateway` for streaming or non‑streaming calls.
   - Implement or extend `CoreLlmAdapter` to satisfy `CoreLlmClient` for new tasks.

3. **Endpoints are thin**
   - BFF endpoints for Core tools should:
     - Accept validated, structured input (e.g., `MermaidRecoveryPayload`, wrap‑up prompt context).
     - Call Core tool with `CoreLlmClient`.
     - Return structured JSON for the web/mobile clients.
   - They must not implement teaching logic, curriculum control, or UI behavior.

4. **WebView remains the “teacher”**
  - Teaching logic stays in `src/index.tsx`, `src/moduleSelectionHandler.ts`, and related modules.
  - RN should forward **text and metadata** into that teaching pipeline (e.g., `chat:userInput`, selection context), not bypass it.
  - All LLM calls *inside* that pipeline must eventually use a `CoreLlmClient` implementation:
     - Desktop: browser client (via `createBrowserCoreLlmClient` or future BFF proxy).
     - Mobile/WebView: BFF‑backed client that wraps `/llm/*` endpoints.

5. **Apply the mermaid pattern to new tools**
   - When adding a new mobile BFF‑backed capability (for example, a future diagram tool or analysis helper):
     - Define a Core module that:
       - Accepts a `CoreLlmClient` and structured input.
       - Returns structured JSON (no DOM, no HTML).
     - Add a BFF endpoint that:
       - Validates a typed request payload.
       - Invokes the Core module with `CoreLlmAdapter` and returns its result.
     - Add WebView + RN wiring that:
       - Sends a clear request message from WebView to RN to BFF.
       - Receives the response back in WebView and applies it to UI (updating raw text, overlays, etc.).
   - This keeps the code DRY (Core logic reused across web and BFF) and ensures the BFF never manipulates UI directly; WebView is always the component that decides how to present the server’s response.

Following these guidelines keeps the architecture consistent with the Phase 1 BFF walkthrough: WebView owns teaching, Core owns reusable tools, and BFF owns LLM/infra. Future work can move additional tools into Core and route their LLM calls via BFF without violating this separation of concerns.

---

## 9. `*` Functions and Future Migration (Bootcamp for LLM Work)

The authoritative list of current LLM entry points in the web bundle is in:

- `docs/llm_entry_exit_traces.md`

Any function marked with an asterisk (`*`) there:

- Either currently calls the LLM directly, or historically did.
- Must not gain new `@google/genai` usages outside the Core/BFF abstractions.
- Is a candidate for migration to the **Core + `CoreLlmClient` + BFF** pattern, like mermaid.

### 9.1 Source of Truth and Rules of Engagement

- Treat `docs/llm_entry_exit_traces.md` as the **source of truth** for LLM entry points.
- When you:
  - Add a new LLM‑backed behavior, or
  - Significantly change an existing one,
  you should:
  - Update `docs/llm_entry_exit_traces.md` to describe the new call site(s).
  - Ensure the implementation follows the patterns in this architecture document.
- Do **not**:
  - Add fresh `@google/genai` imports in `src/` files.
  - Re‑implement prompts/parsing for a “tool” in BFF or RN when it already exists in Core or web.

### 9.2 Pattern A Only: Core‑Owned Tools

As reinforced in the BFF walkthrough (Step 7.4):

- For every `*` function in `docs/llm_entry_exit_traces.md`, Phase 1+ uses **Pattern A only**:
  - Move the entire “tool” (prompts, model selection, parsing, validation) into `core/`.
  - Export a function that:
    - Accepts a `CoreLlmClient`.
    - Accepts structured tool input (e.g., module ID, context).
    - Returns structured tool output (e.g., teaching plan, wrap‑up questions, enhancement entries).
  - Web and BFF both call that Core function; **no tool logic is duplicated**.
- BFF then:
  - Implements `CoreLlmClient` via `CoreLlmAdapter` + `GeminiGateway`.
  - Exposes thin HTTP endpoints that:
    - Validate requests.
    - Call the Core tool with `CoreLlmClient`.
    - Return the Core result as JSON.
- WebView:
  - Either calls Core directly (desktop path) or calls BFF endpoints (mobile/WebView path) through a `CoreLlmClient` implementation that talks to BFF.

**DRY enforcement and provider usage (end of Phase 1):**

- Core is the **only** place that should contain tool‑specific prompts and parsing logic. Once a tool is in Core:
  - Do not re‑implement its prompts or parsing in `src/`, BFF, or RN.
  - Web and BFF must call the Core tool instead of maintaining separate copies.
- Provider usage:
  - In Phase 1, desktop web may temporarily use `createBrowserCoreLlmClient(window.ai)` while the BFF/Core foundation is being laid.
  - The **intention after foundational Phase 1 work** is:
    - No remaining direct `window.ai` / `@google/genai` calls in `src/`.
    - All LLM traffic (mobile and desktop) goes through BFF → `GeminiGateway` → provider, via `CoreLlmClient`/`CoreLlmAdapter`.
  - When in doubt, assume new work should move toward “BFF as the sole LLM gateway” and avoid adding new window‑level SDK calls.

### 9.3 Categories of `*` Functions and How to Migrate Them

This sub‑section summarizes the categories of `*` functions from `docs/llm_entry_exit_traces.md` and how to approach each, without duplicating all code here.

#### 9.3.1 Planning and Wrap‑Up (`src/index.tsx`, `src/moduleSelectionHandler.ts`, `src/geminiService.ts`)

Examples (from `llm_entry_exit_traces`):

- `*generateWrapUpAssessment`
- `*llmExtractAndPlanTeachingOrder`
- `*getAnalysisFromGemini`

Recommended approach:

- Core:
  - Create or extend modules such as:
    - `core/wrapUpAssessment.ts` – wrap‑up prompt + parsing (already started).
    - `core/teachingPlan.ts` – teaching plan extraction / ordering.
    - `core/learnerAnalysis.ts` – learner analysis JSON parsing.
  - Move prompt builders and JSON normalization from `src/geminiService.ts` into these modules.
  - Export functions like:
    - `generateWrapUpAssessment(llm: CoreLlmClient, moduleId, context)`.
    - `llmExtractAndPlanTeachingOrder(llm: CoreLlmClient, context)`.
    - `getAnalysisFromGemini(llm: CoreLlmClient, context)`.
- Web:
  - Replace direct usages of `@google/genai` with calls into Core functions.
  - For desktop, use a browser `CoreLlmClient` implementation (e.g., `createBrowserCoreLlmClient` or a future BFF‑proxy client).
  - Keep orchestration in:
    - `createLLMPlannerCallback`, `executePhaseSelection`, `generateNextSenseiResponse`, etc.
    - These functions decide *when* to call tools, not *how* to talk to LLMs.
- BFF:
  - For mobile/WebView, add endpoints such as `/llm/wrapup`, `/llm/plan`, `/llm/analysis` that:
    - Take the same inputs as the Core functions.
    - Call Core via `CoreLlmAdapter`.
    - Return structured outputs the WebView pipeline already expects.

#### 9.3.2 Streaming Session Channels (`src/interactionHelpers.ts`)

Examples:

- `*streamModuleIntroduction`
- `*streamMainSenseiResponse`

Recommended approach:

- Core:
  - Keep Core tools synchronous/non‑streaming; they return structured results.
  - Streaming is mostly a BFF concern (WS and chunks).
- BFF:
  - `GeminiGateway.streamMainResponse` is already the streaming primitive.
  - `StreamingService` should be the only place that invokes streaming on Gemini.
- Web:
  - `streamModuleIntroduction` / `streamMainSenseiResponse`:
    - For desktop, they can use a browser LLM streaming path or a BFF streaming path.
    - For mobile/WebView, Step 8’s target is to route main teaching turns via the WebView teaching pipeline + Core tools + BFF endpoints, not via direct WebSocket streaming from BFF into RN UI.
  - When migrating these functions, keep:
    - Prompt assembly and enhancer wiring in `interactionHelpers.ts`.
    - All transport/LLM details in BFF/`GeminiGateway`.

#### 9.3.3 Selection Sensei (`src/selectionSensei.ts`)

Examples:

- `*dispatchFollowupToAI`
- `*handleToolbarAction`

Recommended approach:

- Core:
  - Add a `core/selectionSensei.ts` module that:
    - Accepts a `CoreLlmClient` and prompt context (selected text, user question, mode).
    - Returns a normalized result structure (e.g., title + explanation + optional code).
  - Move existing prompt building and regex parsing from `src/selectionSensei.ts` into Core.
- Web:
  - `selectionSensei.ts` continues to:
    - Listen for selections.
    - Drive modal UI.
    - Call Core’s `dispatchFollowupToAI`/equivalent via a `CoreLlmClient` that either:
      - Uses the browser SDK (desktop), or
      - Calls a BFF endpoint (mobile/WebView).
- BFF:
  - Expose a thin selection endpoint (e.g., `/llm/selection`) that:
    - Takes selection context (text, question, actionId).
    - Calls Core’s selection tool via `CoreLlmAdapter`.
    - Returns normalized selection results for the web modal.

#### 9.3.4 Enhancements & Key Takeaways (`src/enhancementManager.ts`, `src/keyTakeawayEnhancerController.ts`)

Examples:

- `*requestSenseiEnhancement`
- `*KeyTakeawayEnhancerController.start`

Recommended approach:

- Core:
  - Create modules like:
    - `core/enhancement.ts` – enhancement prompt + parsing.
    - `core/keyTakeaway.ts` – key‑takeaway prompt + parsing.
  - Move JSON fence stripping, normalization, and reordering into Core.
- Web:
  - `enhancementManager` and `KeyTakeawayEnhancerController`:
    - Continue to manage per‑message state, toggles, and placeholder injection.
    - Call Core functions via a `CoreLlmClient`, not directly via `@google/genai`.
- BFF:
  - Add endpoints such as `/llm/enhancement`, `/llm/key_takeaway` that:
    - Accept the same inputs as Core functions.
    - Return normalized payloads that the UI can apply.

#### 9.3.5 Pedagogical Directives (`src/pedagogicalProfiler.ts`)

Example:

- `*generateDirectiveFromMetaPrompt`

Recommended approach:

- Core:
  - Create `core/pedagogicalDirective.ts`.
  - Move prompt and parsing for directives there.
  - Export `generateDirectiveFromMetaPrompt(llm: CoreLlmClient, context)` returning the directive string.
- Web:
  - `PedagogicalProfiler` continues to:
    - Track flags and learner model context.
    - Call Core’s directive generator with a `CoreLlmClient`.
- BFF:
  - If/when directives become server‑backed for mobile, introduce `/llm/directive` endpoint that:
    - Accepts relevant state (or a compressed representation).
    - Calls the Core directive tool.

#### 9.3.6 Mermaid (Already Migrated)

Example:

- `*attemptMermaidFix` (LLM branch in the old `src/mermaidErrorRecovery.ts`)

Current status:

- Logic moved to `core/mermaidErrorRecovery.ts`.
- Core uses `CoreLlmClient`; web and BFF both call into the same module.
- Mobile mermaid recovery goes through BFF (`MermaidService` + `CoreLlmAdapter`).

Use mermaid as the **reference pattern** for new tools: Core owns logic, BFF owns LLM transport, WebView/RN own how results affect UI.

### 9.3.7 Rule of Thumb: `*` Functions vs. Tools

Most `*` functions listed in `docs/llm_entry_exit_traces.md` *correspond to* a tool, but the function itself may also include orchestration or UI code. Use this rule of thumb:

- If a `*` function is already a **clean, non‑UI function** that encapsulates one LLM capability (prompt + model choice + parsing + validation), then:
  - That function *is* the tool.
  - Move it into `core/` as‑is, behind a `CoreLlmClient`, and update callers to use the Core version. Do **not** leave a separate copy in `src/` or BFF.
- If a `*` function also does **UI orchestration, streaming, or DOM work**, then:
  - Extract the tool portion into `core/`:
    - Prompt/model selection.
    - LLM call via `CoreLlmClient`.
    - Parsing, normalization, validation.
  - Leave the orchestration wrapper in `src/`:
    - It should call the Core tool function, receive structured results, and apply them to UI.

Examples:

- Tool‑like `*` functions (move almost directly to Core):
  - `generateWrapUpAssessment`, `llmExtractAndPlanTeachingOrder`, `getAnalysisFromGemini`, `requestSenseiEnhancement`, `generateDirectiveFromMetaPrompt`, `attemptMermaidFix` (LLM branch).
- Mixed `*` functions (split into Core tool + orchestration wrapper):
  - `streamModuleIntroduction`, `streamMainSenseiResponse` (streaming + enhancer hooks).
  - `dispatchFollowupToAI`, `handleToolbarAction` (selection modals + DOM interactions).

Always aim for: Core tools are pure and reusable; `src/` functions orchestrate them and own DOM/UI behavior.

### 9.4 Checklist for Future Engineers (Per `*` Function)

When you touch a `*` function from `docs/llm_entry_exit_traces.md`, follow this checklist:

1. **Locate the tool**:
   - Identify the specific responsibility (planner, wrap‑up, analysis, enhancement, selection, directive, diagram).
2. **Create or extend the Core module**:
   - Define clear inputs/outputs.
   - Move prompts and parsing into Core.
   - Depend on `CoreLlmClient` for all LLM work.
3. **Update web code to call Core**:
   - Replace direct SDK calls with Core tool calls.
   - For desktop, use a browser `CoreLlmClient` (or future BFF‑proxy client).
   - Keep orchestration and UI logic in existing `src/` modules.
4. **Add or update BFF endpoint(s) if needed**:
   - When mobile/WebView needs the tool, expose thin JSON endpoints that call Core via `CoreLlmAdapter`.
   - Follow the mermaid request–response pattern (Section 6.3).
5. **Wire WebView/RN/BFF**:
   - Add bridge message types as needed (WebToRN/RNToWeb).
   - Ensure WebView initiates requests and applies responses to UI.
6. **Document the change**:
   - Update `docs/llm_entry_exit_traces.md` and, if appropriate, this architecture doc when new tools or endpoints are introduced.

If you consistently follow these steps, you will avoid spaghetti code, keep the system DRY, and respect the separation of concerns: Core for tools, BFF for LLM/infra, WebView for teaching and UI, RN for mobile shell/bridging.

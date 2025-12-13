# Mobile/Web LLM Tools Migration Plan (Phase 1+)

This document expands on `docs/llm_entry_exit_traces.md` and the Phase 1 mobile architecture, providing **concrete guidance per `*` function** in the web app.

Goals:

- Ensure all LLM “tools” are eventually owned by Core (`@sensei/core`) and invoked via `CoreLlmClient`.
- Ensure the BFF acts as the **single LLM gateway** for mobile and, after Phase 1 foundational work, for desktop as well.
- Prevent duplication of prompts/parsing and avoid “spaghetti” integrations.

For each `*` function below:

- “Tool vs orchestration” classification is based on the **current implementation** (as of this document).
- Migration steps describe how to move toward the **Core + BFF + WebView** pattern.

Terminology:

- **Tool** – A cohesive LLM capability:
  - Owns its prompt(s), model selection/config, parsing, and validation.
  - Has no DOM/UI logic.
- **Orchestration** – Code that:
  - Decides *when* to call tools.
  - Coordinates UI, state, streaming, and error handling.

> When in doubt: tools live in `core/`, orchestration stays in `src/`.

## Mandatory Mobile Routing Gate (Phase 1 invariant)

For every `*` function migrated into a Core tool and/or BFF endpoint, the migration is not complete until:

1. You choose and wire a mobile transport pattern:
   - Pattern A (preferred Phase 1): WebView sends a bridge request to RN; RN calls a BFF endpoint; RN returns a structured result to WebView (mermaid is the reference).
   - Pattern B: WebView uses a mobile-only `CoreLlmClient` that calls BFF endpoints directly.
2. You gate or remove the desktop/browser SDK path for that task when `window.__SENSEI_MOBILE_BUILD__ === true`.
3. You add a regression/sentinel test proving the mobile build uses the BFF path (tests must fail if a browser `CoreLlmClient` is used on mobile).

Do not mark a tool migrated until this gate is satisfied.

---

## 1. Planning & Wrap‑Up Tools

### 1.1 `llmExtractAndPlanTeachingOrder` (Tool)

- **File(s):**
  - `src/geminiService.ts` (implementation)
  - Callers: `src/index.tsx::createLLMPlannerCallback`, `src/moduleSelectionHandler.ts::executePhaseSelection`.
- **Current behavior:**
  - Builds different prompts for Socratic vs non‑Socratic phases (uses `GET_*_PROMPT_FUNCTION`s).
  - Calls `ai.models.generateContent` with `TEACHING_PLAN_GENERATION_CONFIG`.
  - Handles JSON/fenced JSON responses.
  - Transforms raw JSON into `TeachingPoint[][]` with `kcValue` distribution and sanity checks.
- **Classification:** **Tool (pure)**
  - No DOM/UI operations.
  - Entirely prompt/model/parse/validate.
- **Migration plan:**
  1. Create `core/teachingPlan.ts`:
     - Move `llmExtractAndPlanTeachingOrder` logic into a Core function:
       - `export async function extractAndPlanTeachingOrder(llm: CoreLlmClient, args: { textToProcess, phase, moduleTitle?, moduleGoal?, conceptsSummary? }): Promise<TeachingPoint[][] | null>`
     - Move JSON parsing and validation as‑is.
     - Accept prompt‑builder functions as parameters or re‑export them from a shared Core prompt module to avoid duplicating prompt strings.
  2. Web:
     - Replace calls to `llmExtractAndPlanTeachingOrder(ai, ...)` with calls to the Core function via a `CoreLlmClient`.
     - For desktop, use a browser `CoreLlmClient` (initially via `createBrowserCoreLlmClient` or a BFF‑proxy implementation).
  3. BFF:
     - Add an endpoint (e.g. `/llm/teaching-plan`) that:
       - Accepts the same structured input as the Core function.
       - Uses `CoreLlmAdapter` to call Core and returns `TeachingPoint[][]` as JSON.
     - The mobile/WebView build’s `CoreLlmClient` implementation should call this BFF endpoint.

### 1.2 `getAnalysisFromGemini` (Tool)

- **File:**
  - `src/geminiService.ts`
- **Current behavior:**
  - Builds a comprehensive analysis prompt via `GET_COMPREHENSIVE_ANALYSIS_PROMPT_FUNCTION`.
  - Calls `ai.models.generateContent` with `COMPREHENSIVE_ANALYSIS_CONFIG`.
  - Uses `parseGeminiJsonResponse` to parse and normalize JSON into `ComprehensiveAnalysisResultType`.
- **Classification:** **Tool (pure)**
  - Prompt + model config + JSON parsing; no DOM.
- **Migration plan:**
  1. Create `core/learnerAnalysis.ts`:
     - Move `parseGeminiJsonResponse` and `getAnalysisFromGemini` logic into Core functions:
       - `parseAnalysisJson(text: string): ComprehensiveAnalysisResultType | null`.
       - `getAnalysis(llm: CoreLlmClient, context): Promise<ComprehensiveAnalysisResultType | null>`.
  2. Web:
     - `generateNextSenseiResponse` should call Core’s `getAnalysis` via a `CoreLlmClient`.
  3. BFF:
     - Optionally expose `/llm/analysis` endpoint for mobile/WebView:
       - Accepts prompt context.
       - Returns structured analysis result.

### 1.3 `generateWrapUpAssessment` (Tool)

- **File(s):**
  - `core/wrapUpAssessment.ts` (canonical tool)
  - `src/geminiService.ts` (legacy wrapper for tests/desktop fallback)
- **Current behavior (post‑migration):**
  - Core owns the prompt, model config, parsing, normalization, and validation into `WrapUpAssessmentGenerationResult`.
  - Web/WebView calls the Core tool via a browser `CoreLlmClient`.
  - BFF exposes `POST /sessions/:sessionId/wrapup` and calls Core via `CoreLlmAdapter` to return `WrapUpAssessmentOverlayData`.
- **Classification:** **Tool (pure)**
  - Entirely prompt + parsing/validation; no DOM.
- **Migration status:** Completed (2025‑12‑12). Keep orchestration and overlay rendering in `src/*`.

### 1.4 `generateDirectiveFromMetaPrompt` (Tool)

- **File:**
  - `src/geminiService.ts` (tool logic).
  - Used by `src/pedagogicalProfiler.ts`.
- **Current behavior:**
  - Calls `ai.models.generateContent` with `PEDAGOGICAL_DIRECTIVE_GENERATION_CONFIG`.
  - Returns trimmed directive text with a safe fallback on error.
- **Classification:** **Tool (pure)**
  - Prompt + model config + error fallback; no DOM.
- **Migration plan:**
  1. Create `core/pedagogicalDirective.ts`:
     - Move this function into Core:
       - `generateDirectiveFromMetaPrompt(llm: CoreLlmClient, metaPrompt: string): Promise<string>`.
  2. Web:
     - In `PedagogicalProfiler`, call Core’s directive generator via a `CoreLlmClient`.
  3. BFF:
     - If directives are later server‑backed for mobile, add a `/llm/directive` endpoint that proxies to Core.

---

## 2. Streaming Session Channels

### 2.1 `streamModuleIntroduction` (Mixed: Tool + Orchestration)

- **File:**
  - `src/interactionHelpers.ts`
- **Current behavior:**
  - Accepts a `Chat` instance (Gemini streaming client), context, module title, messageId, and optional `KeyTakeawayEnhancerController`.
  - Builds a combined intro message.
  - Uses `chat.sendMessageStream` to:
    - Stream chunks, append to `fullResponseText`.
    - Feed chunks through `KeyTakeawayEnhancerController.onChunk`.
    - Call `updateMessageStream` to update the bubble.
  - On completion, optionally uses `KeyTakeawayEnhancerController.finalize` and returns final text.
- **Classification:** **Mixed**
  - Tool aspects:
    - Prompt assembly for the intro.
  - Orchestration aspects:
    - Streaming (`sendMessageStream`), enhancer wiring, UI updates via `updateMessageStream`.
- **Migration plan:**
  1. Core:
     - You generally do **not** move streaming orchestration to Core.
     - Keep streaming in BFF/clients; consider a Core helper only if you need reusable prompt fragments.
  2. Web/BFF:
     - Long‑term, for mobile Phase 1+, we want main teaching turns (including intros) to go through the WebView teaching pipeline and Core tools via BFF, rather than direct `Chat` streaming in the web bundle.
     - In that model:
       - The BFF is responsible for streaming `Sensei` responses (already happening via `GeminiGateway.streamMainResponse`).
       - The WebView teaching pipeline remains the “owner” of how those streams are displayed.
  3. Practical guidance:
     - Treat `streamModuleIntroduction` as **orchestration** that:
       - Should stop constructing `Chat` instances directly from `GoogleGenAI`.
       - Should rely on either:
         - A BFF‑backed streaming path, or
         - A higher‑level “stream introduction” helper that is built on top of `CoreLlmClient` + BFF.

### 2.2 `streamMainSenseiResponse` (Mixed: Tool + Orchestration)

- **File:**
  - `src/interactionHelpers.ts`
- **Current behavior:**
  - Accepts a `Chat` instance, dynamic context, user input, messageId, and optional enhancer controller.
  - Builds `messageWithContext` (dynamic instruction + user line).
  - Streams using `chat.sendMessageStream`, forwards chunks to:
    - `KeyTakeawayEnhancerController.onChunk`.
    - `updateMessageStream` for bubble updates.
  - Logs metrics on chunk count and latency.
  - Finalizes enhancer and returns full text.
- **Classification:** **Mixed**
  - Tool aspects:
    - Prompt assembly for the main turn.
  - Orchestration:
    - Streaming, enhancer interaction, UI updates.
- **Migration plan:**
  1. Similar to `streamModuleIntroduction`, streaming is an orchestration concern.
  2. For Phase 1 mobile, the target (Step 8) is:
     - WebView teaching pipeline calls Core tools via a `CoreLlmClient` that talks to the BFF.
     - BFF handles streaming and yields text chunks; the WebView updates UI based on BFF or Core outputs.
  3. Guidance:
     - Do **not** introduce new `Chat` usage in `interactionHelpers.ts`.
     - When refactoring, aim to:
       - Move prompt construction into Core where possible.
       - Use a shared streaming mechanism wired to BFF, with `interactionHelpers` retaining only UI orchestration.

---

## 3. Selection Sensei

### 3.1 `SelectionSensei.dispatchFollowupToAI` (Mixed)

- **File:**
  - `src/selectionSensei.ts` (private method).
- **Current behavior:**
  - Sends a loading message into the selection modal transcript.
  - Uses `ensureSelectionChat` to construct or reuse a `Chat` instance backed by `GoogleGenAI` and `SELECTION_SENSEI_CONFIG`.
  - Calls `chat.sendMessage({ message: question })`.
  - Formats the response via `formatFollowupAnswer` (regex extraction + markdown).
  - Updates the modal transcript through `appendModalMessage`.
- **Classification:** **Mixed**
  - Tool aspects:
    - Prompt building (system instruction + message).
    - Parsing + formatting via `formatFollowupAnswer` and `extractContentWithRegex`.
  - Orchestration:
    - Modal state management, message IDs, conversation token checks.
    - DOM updates through `appendModalMessage`.
- **Migration plan:**
  1. Core:
     - Create `core/selectionSensei.ts`:
       - Implement a pure tool function, e.g.:
         - `runSelectionSenseiFollowup(llm: CoreLlmClient, payload: { question, context, mode }): Promise<{ suggestedTitle?: string; explanation?: string; rawText: string }>`
       - Move parsing/formatting logic from `formatFollowupAnswer`/`extractContentWithRegex` into Core (or a shared parser module).
  2. Web:
     - Keep `SelectionSensei` UI orchestration (modal state, DOM, “ask” flows).
     - Replace direct `Chat` usage with calls to the Core tool via:
       - A desktop `CoreLlmClient` implementation, or
       - A BFF endpoint (`/llm/selection`) for mobile/WebView.
  3. BFF:
     - Implement `/llm/selection`:
       - Validates selection context (selected text, original message, action type).
       - Calls Core’s selection tool via `CoreLlmAdapter`.
       - Returns a structured payload the modal can render.

### 3.2 `SelectionSensei.handleToolbarAction` (Mixed)

- **File:**
  - `src/selectionSensei.ts` (private method).
- **Current behavior:**
  - Wires the selection toolbar UI:
    - For `'askQuestion'`, activates an ask‑mode in the modal.
    - For other actions, calls `handleToolbarAction` which:
      - Computes the appropriate prompt context.
      - Triggers either direct text insertion (notepad) or a follow‑up request (`dispatchFollowupToAI`).
  - Entirely UI‑driven; no direct LLM calls here, but orchestrates them.
- **Classification:** **Orchestration only**
  - Should not be moved to Core.
- **Migration plan:**
  - Once the selection tool is in Core and BFF uses it via an endpoint:
    - `handleToolbarAction` should:
      - Build structured selection payloads.
      - Call the Core/BFF selection tool via `CoreLlmClient` or a web‑side client that hits `/llm/selection`.
      - Apply results to the modal using existing DOM helpers.

---

## 4. Enhancements & Key Takeaways

### 4.1 `requestSenseiEnhancement` (Tool)

- **File:**
  - `src/geminiService.ts`
- **Current behavior:**
  - Builds enhancement prompt via `buildSenseiEnhancementPrompt`.
  - Calls `ai.models.generateContent` with `ENHANCEMENT_REQUEST_CONFIG`.
  - Strips fences, parses JSON, normalizes into `EnhancementPayload` via `normalizeEnhancementEntries`.
  - Logs latency and count of enhancements.
- **Classification:** **Tool (pure)**
  - Prompt + JSON parsing; no DOM.
- **Migration plan:**
  1. Core:
     - Create `core/enhancement.ts` and move:
       - `EnhancementEntry`, `EnhancementPayload` types (or re‑export from Core).
       - Prompt building (or import prompt builders from a shared Core prompt module).
       - JSON parsing/normalization.
     - Export a Core function:
       - `requestSenseiEnhancement(llm: CoreLlmClient, request: EnhancementRequest): Promise<EnhancementPayload | null>`.
  2. Web:
     - In `src/enhancementManager.ts`, keep:
       - State tracking, `toggleEnhancement`, `applyEnhancementSequence`, and DOM re‑render logic.
     - Replace direct calls to `requestSenseiEnhancement(ai, ...)` with calls into Core:
       - `requestSenseiEnhancement(coreLlmClient, ...)`.
  3. BFF:
     - Add `/llm/enhancement` endpoint:
       - Accepts `EnhancementRequest`.
       - Calls Core via `CoreLlmAdapter`.
       - Returns `EnhancementPayload` as JSON.

### 4.2 `KeyTakeawayEnhancerController.start` (Mixed)

- **File:**
  - `src/keyTakeawayEnhancerController.ts`
- **Current behavior:**
  - Uses `GoogleGenAI` directly to:
    - Create a `Chat`.
    - Send the key‑takeaway prompt.
    - Cache results keyed by prompt hash.
  - Logging, caching, and async management of the enhancer response.
  - `onChunk`/`finalize`/`handleEnhancerReady` integrate the enhancer text into streamed responses and update the UI via `updateMessageStream`.
- **Classification:** **Mixed**
  - Tool aspects:
    - Prompt text and model selection (`modelName`, `modelConfig`).
  - Orchestration:
    - Streaming control, caching, and UI updates.
- **Migration plan:**
  1. Core:
     - Add `core/keyTakeaway.ts`:
       - Implement a tool function:
         - `generateKeyTakeaway(llm: CoreLlmClient, promptText: string): Promise<string>`.
       - No streaming; purely `callText`/`callJson` + normalization.
  2. Web:
     - Keep `KeyTakeawayEnhancerController` as an orchestration wrapper:
       - It should request the enhancer text via `CoreLlmClient` instead of `GoogleGenAI`.
       - Streaming integration (`onChunk`, `finalize`) remains in `src/`, but uses the Core‑generated text.
  3. BFF:
     - Add `/llm/key_takeaway` that:
       - Accepts prompt text or a structured context.
       - Calls Core’s key‑takeaway tool via `CoreLlmAdapter`.
       - Returns the enhancer text.

---

## 5. Pedagogical Directives

### 5.1 `PedagogicalProfiler.getDirective` → `generateDirectiveFromMetaPrompt` (Tool + Orchestration)

- **File(s):**
  - `src/pedagogicalProfiler.ts` (orchestration + meta‑prompt building).
  - `src/geminiService.ts::generateDirectiveFromMetaPrompt` (tool).
- **Current behavior:**
  - `PedagogicalProfiler.getDirective`:
    - Computes `activeFlags` from the learner model.
    - Generates the complex `metaPrompt` string (using `ITEM_SPECIFIC_PEDAGOGICAL_META_PROMPT_TEMPLATE`).
    - Calls `generateDirectiveFromMetaPrompt(ai, metaPrompt)`.
  - `generateDirectiveFromMetaPrompt`:
    - Calls `ai.models.generateContent` with a directive config.
    - Returns trimmed directive text or a safe fallback.
- **Classification:**
  - `generateDirectiveFromMetaPrompt`: **Tool (pure)**.
  - `PedagogicalProfiler.getDirective`: **Orchestration** (owns meta‑prompt assembly and learner context).
- **Migration plan:**
  1. Core:
     - Move `generateDirectiveFromMetaPrompt` into `core/pedagogicalDirective.ts` as described in §1.4.
  2. Web:
     - `PedagogicalProfiler`:
       - Keeps `getDirective` and all learner‑state logic.
       - Calls Core’s directive tool via `CoreLlmClient`.
  3. BFF:
     - Add an endpoint if directives are needed on mobile/WebView; otherwise, keep as a web‑only tool for now.

---

## 6. Mermaid Tool (Reference Implementation)

### 6.1 `attemptMermaidFix` (Already Migrated Tool)

- **Original file:**
  - `src/mermaidErrorRecovery.ts` (now re‑exporting Core).
- **Current status:**
  - Logic moved to `core/mermaidErrorRecovery.ts`.
  - Core exposes:
    - Deterministic helpers: `applyBacktickFix`, `applyUniversalQuoteFix`, `ensureGraphDirective`, `fixSubgraphDirections`.
    - `attemptMermaidFix(llm: CoreLlmClient | null, failedDiagram, errorMessage, options?)`.
    - `runMermaidRecovery` orchestrator for desktop web (uses a `CoreLlmClient` built from browser SDK).
  - BFF:
    - Implements `CoreLlmClient` with `CoreLlmAdapter` and `GeminiGateway`.
    - `MermaidService` calls `attemptMermaidFix` with the adapter and exposes `/mermaid/recover`.
  - Mobile:
    - WebView sends `mermaid:recover` bridge message.
    - RN relays to BFF; BFF uses Core; RN sends back `mermaid:recoverResult`.
    - WebView applies `fixedCode` to raw markdown and re‑renders the diagram.

Mermaid is the **reference pattern** for all future tools: Core owns the logic, BFF provides transport via `CoreLlmClient`, and WebView/RN own UI.

---

## 7. Summary: How to Work on `*` Functions

When you touch a `*` function listed in `docs/llm_entry_exit_traces.md`:

1. **Identify the tool**
   - Pinpoint the pure LLM capability (prompt + model + parsing + validation), separate from UI/stream orchestration.
2. **Move tool logic into Core**
   - Create or extend a `core/` module for that tool.
   - Move prompts and parsing into Core.
   - Implement the tool as a function that:
     - Accepts a `CoreLlmClient` and structured input.
     - Returns structured output.
3. **Keep orchestration in `src/`**
   - Leave teaching flow, streaming, modal management, and DOM in `src/`.
   - Replace direct SDK/`Chat` calls with calls to the Core tool via a `CoreLlmClient` (desktop) or via BFF endpoints (mobile/WebView).
4. **Use BFF as the LLM gateway**
   - For mobile/WebView (and, after foundational Phase 1 work, desktop):
     - All LLM calls must go through BFF → `GeminiGateway`.
   - Add or reuse endpoints that simply call Core tools via `CoreLlmAdapter` and return JSON.
5. **Avoid duplication**
   - Once a tool is in Core:
     - Do not keep old implementations in `src/` or BFF.
     - Do not add another provider‑specific implementation elsewhere.
6. **Update docs**
   - Update `docs/llm_entry_exit_traces.md` when adding or materially changing LLM entry points.
   - Keep this migration plan and the main mobile architecture doc accurate.

Following this plan will keep LLM integrations clean, DRY, and aligned with the Phase 1 architecture: WebView as the teacher, Core as the tool library, BFF as the LLM gateway.

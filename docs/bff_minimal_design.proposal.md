# Minimal BFF-Style Design for Web LLM Integration

This document describes a minimal, layered design that separates the backend into:

- A world-class **LLM orchestrator** (`llmGateway.ts`).
- A **core domain layer** (curriculum, learner model, selection sensei, mermaid, enhancements, etc.).
- An **interaction controller “X”** that acts as a BFF-style backend API surface.

On the frontend, a thin client stub talks to X and uses existing UI tools to render bubbles.

The goal is to get clear boundaries and a BFF-like controller with **minimal changes to existing code**, while keeping the design ready to run X and core on a backend server.

---

## 1. Layers and Responsibilities (Backend + Frontend)

At a high level, the three backend pieces work together as follows:

- **LLM orchestrator (`llmGateway.ts`)** sits at the bottom:
  - Core and X never talk to `@google/genai` directly; they call `llmGateway` primitives (`callJsonModel`, `streamChat`, etc.).
  - The orchestrator is provider- and transport-focused: given a prompt + model config, it returns text/JSON/streams.

- **Core domain layer** sits in the middle:
  - Existing modules (`geminiService.ts`, `curriculum.ts`, `adaptiveEngine.ts`, `selectionSensei.ts`, `mermaidErrorRecovery.ts`, `enhancementManager.ts`, `pedagogicalProfiler.ts`, `prompts.ts`, etc.) keep their responsibilities:
    - Build prompts via `prompts.ts`.
    - Call `llmGateway` to execute LLM tasks.
    - Parse and normalize responses into domain types.
  - Apart from swapping direct SDK calls for `llmGateway` calls, these files remain structurally the same.

- **Interaction controller X (`interactionController.ts`)** sits at the top of the backend:
  - Implements “handle a main turn”, “handle a selection action”, “restore a session” by orchestrating core functions.
  - Receives domain results and converts them into `UiEffect[]` suitable for the frontend.
  - Exposes HTTP/SSE/WebSocket endpoints for the browser client.

On the frontend:

- A thin `InteractionControllerClient` sends user intents to the backend X and applies incoming `UiEffect`s to the UI by calling existing helpers like `displayMessage`, `updateMessageStream`, and `showWrapUpAssessmentOverlay`. This allows us to introduce X and `llmGateway` with minimal change to current UI logic.

---

## 1.4 File Classification Overview (Core vs Infrastructure vs UI)

To make future changes safer, it helps to classify the main `/src` files by role. This section is descriptive of the target architecture; most of these files already exist and only need minimal refactoring to fit these buckets.

### Infrastructure (LLM + BFF)

- `src/llmGateway.ts`
  - New orchestrator module; the only place that imports `@google/genai` and issues provider calls.
- `src/interactionController.ts`
  - Backend InteractionController “X”; orchestrates core + `llmGateway` and exposes HTTP/SSE/WebSocket endpoints.
- `src/interactionControllerClient.ts`
  - Frontend client stub; talks to backend X and applies `UiEffect`s to the browser UI using existing helpers.

These files are infrastructural; they wrap the core but are not themselves domain logic.

### Core Domain Layer

These are the “core” files that should remain structurally the same, except for replacing direct SDK calls with `llmGateway` primitives:

- Curriculum and learner model:
  - `src/curriculum.ts`
  - `src/adaptiveEngine.ts`
- LLM domain adapters and services:
  - `src/geminiService.ts`
  - `src/pedagogicalProfiler.ts`
  - `src/enhancementManager.ts`
  - `src/mermaidErrorRecovery.ts`
  - `src/keyTakeawayEnhancerController.ts`
- Interaction and selection logic:
  - `src/moduleSelectionHandler.ts`
  - `src/selectionSensei.ts`
  - `src/interactionHelpers.ts` (logic side; DOM bits can be gradually factored out into UI helpers)
  - `src/selectionSenseiResponseParser.ts`
- Prompt and config:
  - `src/prompts.ts`
  - `src/model_usage.ts`
- Wrap-up and teaching plan support:
  - `src/wrapUpAssessment.ts`
  - `src/teachingPlanCache.ts`
- Save/load and state:
  - `src/saveloadProgressManager.ts`
  - `src/saveloadSerialization.ts`

These modules:

- Own domain state, algorithms, and LLM response normalization.
- Use `prompts.ts` to build prompts.
- Call `llmGateway` instead of `@google/genai` directly.
- Do not need structural changes beyond that refactor.

### UI / Browser Shell

These files are presentation and browser wiring, not core domain:

- `src/index.tsx`
  - Main browser entrypoint; sets up event handlers and initial wiring.
  - Should depend on `InteractionControllerClient`, not core or `llmGateway` directly.
- `src/ui.ts`
  - Rendering and DOM utilities (displaying messages, updating streams, overlays, etc.).
- Assets and shell:
  - `src/index.html`
  - `src/index.css`
  - `src/logo.png`
  - `src/metadata.json`
- Mobile/webview-specific wiring:
  - `src/mobile/**` and `SenseiMobile/**` (where applicable).

UI code remains mostly unchanged: where it currently calls core directly, it should instead call `InteractionControllerClient`, but the actual bubble rendering continues to use existing helpers.

### Dev / Testing / Debug / Ancillary

Files that are not core domain but live under `/src`:

- Debug and experiments:
  - `src/debugMode.ts`
  - `src/test.ts`
- Chat window and editor helpers:
  - `src/chatWindowController.ts`
  - `src/codeEditorModal.ts`
  - `src/consolidationManager.ts`
- Notepad and import/export tools:
  - `src/notepad.ts`
  - `src/notepadExporter.ts`
  - `src/notepadImporter.ts`
- Mermaid and misc:
  - `src/mermaidManager.ts`
  - `src/mermaid-theme-integration.js`

These may call into core or `llmGateway`, but they are considered tooling/UI rather than part of the central pedagogy/curriculum engine.

### 1.1 LLM Orchestrator (existing)

- File: `src/llmGateway.ts`.
- Responsibilities:
  - All `@google/genai` calls (streaming and one-shot).
  - Executing model calls given a model name, config, and prompt/content payload.
  - Mapping to model configs (`model_usage.ts`) where appropriate.
  - Error and response normalization, including JSON fence handling.
  - Optional cross-cutting concerns (retries, rate limiting, telemetry).
- Typical methods:
  - Low-level primitives:
    - `callJsonModel({ modelName, config, prompt })`.
    - `callTextModel({ modelName, config, prompt })`.
    - `streamChat({ modelName, config, message })`.
  - Optionally thin task-oriented wrappers that still take a ready-made prompt and config.

The orchestrator knows **everything about the LLM provider** and **nothing about DOM/UI**.

### 1.2 Core Logic Code (existing, backend-shared)

- Representative files:
  - `src/curriculum.ts`
  - `src/adaptiveEngine.ts`
  - `src/geminiService.ts`
  - `src/moduleSelectionHandler.ts`
  - `src/selectionSensei.ts`
  - `src/interactionHelpers.ts`
  - `src/mermaidErrorRecovery.ts`
  - `src/enhancementManager.ts`
  - `src/pedagogicalProfiler.ts`
  - `src/keyTakeawayEnhancerController.ts`
  - `src/prompts.ts`
- Responsibilities:
  - Domain state and algorithms:
    - Curriculum transitions and teaching-plan management.
    - Learner model updates and analysis integration.
    - Selection Sensei parsing / follow-up logic.
    - Wrap-up assessment validation.
    - Mermaid repair heuristics.
    - Prompt construction for Sensei tasks (via `prompts.ts`).
  - Zero knowledge of the LLM SDK:
    - Call `llmGateway` methods instead of `@google/genai` directly.
  - Ideally no direct DOM manipulation (though today some modules still call `displayMessage` and friends).

Within this layer, `prompts.ts` remains a pure **prompt factory**:

- It takes structured domain inputs (curriculum items, learner state, recent turns) and returns strings or structured content for specific tasks (teaching plan, analysis, wrap-up, enhancements).
- It does not import `@google/genai` or call the LLM directly.
- Domain LLM adapters (today mostly `geminiService.ts`, and to a lesser extent `pedagogicalProfiler.ts`) are responsible for:
  - Calling `prompts.ts` to build the right prompt for each task.
  - Calling `llmGateway` primitives (e.g., `callJsonModel`, `streamChat`) with the prompt and model config.
  - Post-processing responses into domain types (`TeachingPoint[][]`, `ComprehensiveAnalysisResultType`, `WrapUpAssessmentQuestion[]`, `EnhancementPayload`, etc.).

This preserves minimal code changes: `prompts.ts` stays where it is, and existing adapters like `geminiService.ts` simply switch from direct SDK usage to using `llmGateway` under the hood.

### 1.3 Interaction Boundary X (backend BFF)

- Backend module: `src/interactionController.ts` (or `src/senseiRuntime.ts`).
- Responsibilities:
  - Acts as a BFF-style controller for the web client, running on the server.
  - Owns **entry points** (user actions entering the system) and **exit points** (effects delivered back to UI).
  - Translates user intents (free text, selection actions, session restore) into core operations.
  - Outputs structured “UI effects” that are serialized to the client over HTTP/SSE/WebSocket and then rendered by the UI.

Conceptually (end-to-end):

- Browser UI → **InteractionControllerClient** (thin stub) → backend **InteractionController** → core logic + `llmGateway` → stream of `UiEffect` objects → InteractionControllerClient → Browser UI.
- UI never talks directly to core or `llmGateway`; it only talks to the client stub, which talks to the backend.

---

## 2. InteractionController API (Boundary X)

Define a narrow, stable API that the **client stub** exposes to UI code and that the backend InteractionController implements behind an HTTP/SSE/WebSocket boundary.

```ts
// Simplified; real types can reuse existing ones.
type UserTextTurn = {
  text: string;
  skipPedagogicalIntervention?: boolean;
};

type SelectionAction = {
  actionType: string;
  selectedText: string;
  context: string;
  userQuestion?: string;
};

type UiEffect =
  | { type: 'message'; payload: Message }
  | { type: 'wrapupOverlay'; payload: WrapUpAssessmentOverlayData }
  | { type: 'error'; message: string }
  | { type: 'stateUpdate'; payload: unknown };

export interface InteractionController {
  handleMainTurn(turn: UserTextTurn): Promise<UiEffect[]>;
  handleSelectionAction(action: SelectionAction): Promise<UiEffect[]>;
  restoreSession(session: SavedSession): Promise<UiEffect[]>;
}

// Browser-side client stub (calls backend via HTTP/SSE/WebSocket)
export interface InteractionControllerClient {
  handleMainTurn(turn: UserTextTurn): Promise<void>;
  handleSelectionAction(action: SelectionAction): Promise<void>;
  restoreSession(session: SavedSession): Promise<void>;
}
```

### 2.1 Backend Implementation (`interactionController.ts`)

- Constructor receives:
  - `llmGateway` instance.
  - Core dependencies:
    - Curriculum object and `curriculumState`.
    - `moduleSelectionHandler` instance.
    - `SelectionSensei` instance.
    - `EnhancementManager`, `Notepad`, etc. as needed.
  - Optional sink or callback for streaming effects (e.g., `onEffect(effect: UiEffect)`).

- HTTP/SSE/WebSocket handlers:
  - `POST /api/interaction/main-turn` → calls `handleMainTurn`, returns a JSON array of `UiEffect` or starts an SSE stream of `UiEffect`.
  - `POST /api/interaction/selection-action` → calls `handleSelectionAction`, same pattern.
  - `POST /api/interaction/restore-session` → calls `restoreSession`.

### 2.2 Frontend Client Stub (`interactionControllerClient.ts`)

- Knows the backend base URL or WebSocket endpoint.
- Implements `InteractionControllerClient` by:
  - Sending `handleMainTurn` / `handleSelectionAction` requests via HTTP or WebSocket.
  - Listening on SSE/WebSocket for `UiEffect` messages and calling the existing UI tools (`displayMessage`, `updateMessageStream`, `showWrapUpAssessmentOverlay`, etc.) to render them.

---

## 3. Wiring Existing Code Through X with Minimal Changes

The key principle: **InteractionController calls existing functions; existing functions do not call InteractionController.** This means we:

1. Add `interactionController.ts`.
2. Update a few UI entry points to call the controller.
3. Swap direct LLM usage in core for `llmGateway` calls.

### 3.1 Main Chat Input

Today, the flow is roughly:

- On user submit:
  - `generateNextSenseiResponse(inputText, skipPedagogicalIntervention)` from `index.tsx`.
  - `generateNextSenseiResponse`:
    - Updates `moduleSelectionHandler` state.
    - Calls `ensureTeachingPlanExists` / `advanceCurriculumState`.
    - Calls `getAnalysisFromGemini` and `createLLMPlannerCallback` (which call into Gemini service).
    - Calls `displayMessage`, `updateCurriculumDisplay`, `updateFooter`, etc.

With the backend InteractionController and frontend client stub, the UI handler becomes:

```ts
// In the browser: use a client stub that talks to the backend BFF.
const controllerClient = createInteractionControllerClient({
  baseUrl: '/api/interaction',
  onEffect: applyUiEffects, // maps UiEffect -> displayMessage/updateCurriculumDisplay/etc.
});

async function onUserSubmit(inputText: string, skip: boolean) {
  await controllerClient.handleMainTurn({
    text: inputText,
    skipPedagogicalIntervention: skip,
  });
}
```

Backend-side, inside `InteractionController.handleMainTurn` (server) the target design is:

- Step 1: delegate to shared runtime logic:
  - Call a helper that encapsulates what `generateNextSenseiResponse` does today (advance curriculum, call analysis/teaching-plan adapters, update learner model), but returns `UiEffect[]` instead of touching the DOM directly.
  - Internally, that helper uses `llmGateway.fetchLearnerAnalysis`, `llmGateway` teaching-plan calls, etc.
- Step 2: return those `UiEffect[]` to the client so it can render bubbles.

To preserve **minimal code change**, you can phase this migration:

1. **Phase A (client-side X only)**  
   - Implement `InteractionController` initially in the browser rather than on the server.
   - Have it call the existing `generateNextSenseiResponse` (which still uses DOM helpers) so behavior is unchanged.
   - The UI continues to render via `displayMessage` / `updateCurriculumDisplay`.

2. **Phase B (extract shared runtime)**  
   - Gradually extract the non-DOM logic from `generateNextSenseiResponse` into a shared core helper (e.g., `senseiRuntime.handleMainTurnCore`) that:
     - Returns `UiEffect[]` instead of mutating the DOM.
   - Update the client-side `InteractionController` to use this helper and apply `UiEffect` via `applyUiEffects`.

3. **Phase C (move X to backend)**  
   - Move `InteractionController` to the backend, calling the same shared helper.
   - Replace client-side `InteractionController` with the `InteractionControllerClient` that talks to the backend over HTTP/SSE/WebSocket.

This path keeps initial changes small (Phase A), while still converging on a clean backend BFF (Phase C) once core logic is de-DOMed.

### 3.2 Selection Sensei

Today:

- UI code (event handlers, toolbar buttons) directly call `SelectionSensei` methods:
  - `handleToolbarAction(...)`.
  - `dispatchFollowupToAI(...)`.

With InteractionController and the client stub:

- UI calls:

```ts
async function onSelectionAction(action: SelectionAction) {
  await controllerClient.handleSelectionAction(action);
}
```

Backend implementation (server):

```ts
async handleSelectionAction(action: SelectionAction): Promise<UiEffect[]> {
  await selectionSensei.handleToolbarAction(
    action.selectedText,
    action.actionType,
    action.context,
    action.userQuestion ? 'Ask' : action.actionType,
    action.userQuestion
  );
  // For now, underlying code still calls displayMessage/updateModal.
  return [];
}
```

- Internally, `SelectionSensei`:
  - Uses `llmGateway.sendSelectionToolbarRequest` / `llmGateway.sendSelectionFollowup` instead of `Chat.sendMessage`.
  - Continues to own parsing (`parseSelectionSenseiResponsePayload`) and DOM updates until we choose to lift those into `UiEffect`.

---

## 4. Dependency Graph and Boundaries

Final structure:

- **UI layer** (`index.tsx`, DOM event handlers):
  - Depends only on `InteractionControllerClient`.
  - Applies `UiEffect` messages (when used) to actual components / DOM via `applyUiEffects`.

- **InteractionControllerClient (browser)** (`interactionControllerClient.ts`):
  - Depends on:
    - HTTP/SSE/WebSocket APIs exposed by the backend.
    - UI helpers (`displayMessage`, `updateMessageStream`, `showWrapUpAssessmentOverlay`, etc.).
  - Sends user intents to the backend and applies incoming `UiEffect` messages to the UI.

- **InteractionController (X, backend)** (`interactionController.ts`):
  - Depends on:
    - `llmGateway` (LLM orchestrator).
    - Core modules (`curriculum`, `moduleSelectionHandler`, `SelectionSensei`, `EnhancementManager`, `mermaidErrorRecovery` helpers, etc.).
  - Owns the mapping from user events to core calls.
  - Owns high-level entry and exit points and returns `UiEffect[]` (or streams them) to the client.

- **Core modules**:
  - Depend on:
    - `llmGateway` for any LLM calls.
    - Each other as they do today.
  - Do not depend on UI or `InteractionController`.

- **LLM orchestrator** (`llmGateway.ts`):
  - Depends on:
    - `@google/genai`.
    - Configs in `model_usage.ts`.
  - Does not depend on core modules or UI.

This allows:

- Policy changes (e.g., model swaps, safety filters, retries) in one place (`llmGateway.ts`).
- UI changes (different rendering, different client) by just reusing `InteractionController`.
- Core evolution (new phases, new selection behaviors) without touching the LLM or UI layers.

---

## 5. Migration Strategy

This migration plan is designed to be **incremental and low-risk**, preserving existing behavior at each step while moving toward the full backend BFF architecture.

1. **Introduce `llmGateway.ts` (no API changes)**
   - Add `src/llmGateway.ts` with prompt-agnostic primitives (`callJsonModel`, `callTextModel`, `streamChat`).
   - Replace direct `@google/genai` calls in core modules (`geminiService.ts`, `selectionSensei.ts`, `interactionHelpers.ts`, `mermaidErrorRecovery.ts`, `enhancementManager.ts`, `pedagogicalProfiler.ts`, `keyTakeawayEnhancerController.ts`) with calls to `llmGateway`.
   - No changes to public APIs of those modules or to UI code.

2. **Introduce client-side `InteractionController` (Phase A)**
   - Implement `InteractionController` in the browser (same module shape as the eventual backend), calling existing functions:
     - `handleMainTurn` → calls `generateNextSenseiResponse`.
     - `handleSelectionAction` → calls `SelectionSensei.handleToolbarAction`.
   - UI entry points (`onUserSubmit`, selection toolbar handlers) now call this controller instead of calling core functions directly.
   - Behavior remains identical; this just centralizes orchestration behind a single object.

3. **Extract shared runtime helpers (Phase B)**
   - Incrementally refactor DOM-heavy functions like `generateNextSenseiResponse` into:
     - A core helper (e.g., `senseiRuntime.handleMainTurnCore`) that:
       - Uses core modules + `llmGateway`.
       - Returns `UiEffect[]` instead of directly manipulating the DOM.
     - A thin UI adapter that takes `UiEffect[]` and calls `displayMessage`, `updateCurriculumDisplay`, etc.
   - Update the client-side `InteractionController` to:
     - Call the new core helper.
     - Apply `UiEffect` through a single `applyUiEffects` function.

4. **Add backend `interactionController.ts` and client stub (Phase C)**
   - Move `InteractionController` implementation to the backend, reusing the same core helper(s) from Phase B.
   - Add `interactionControllerClient.ts` in the browser:
     - Implements `InteractionControllerClient` by POSTing to backend endpoints and subscribing to SSE/WebSocket for `UiEffect` streams.
     - Uses the existing `applyUiEffects` implementation to update the UI.
   - Switch UI entry points to call `InteractionControllerClient` instead of the in-browser controller.

5. **Enforce boundaries**
   - After the above steps are stable:
     - Ensure no `@google/genai` imports exist outside `llmGateway.ts`.
     - Ensure UI code calls only `InteractionControllerClient`, never core modules or `llmGateway` directly.
     - Gradually migrate any remaining DOM calls in core modules into UI adapters if needed.

This yields a clean, BFF-style architecture where:

- The backend owns LLM calls and domain orchestration.
- The frontend remains thin and mostly unchanged, rendering bubbles and overlays via the same helpers it uses today.
- Core modules keep their structure and responsibilities, with the only required change being that they call `llmGateway` instead of the LLM SDK directly.

This yields a clean, BFF-like architecture without a disruptive rewrite, and it leverages the world-class LLM orchestrator as a first-class dependency rather than a cross-cutting concern scattered throughout the codebase.

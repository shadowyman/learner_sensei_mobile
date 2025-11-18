# Recursive Sensei BFF System — Master Architectural Guide
Status (2025-11-16): Phase 1 BFF implementation is scheduled; scaffolding and contract-aligned services are pending.

## Introduction

This document defines the end‑to‑end architecture and implementation roadmap for the Backend‑for‑Frontend (BFF) layer that will serve Recursive Sensei’s clients, with Phase 1 focused on the iOS React Native mobile shell embedding the existing web UI via WKWebView.

The BFF is the sole network boundary for each client family (mobile, desktop, web). It exposes a small, client‑specific REST + WebSocket surface, delegates all pedagogy and curriculum logic to shared “Sensei Core” libraries, and encapsulates all interaction with external LLM providers (Gemini), storage, and infrastructure. Mobile and desktop BFFs are tailored to their clients’ UX needs, but they share Core libraries and follow the same contract families (Functional Spec, Contracts v1, Mobile Engineering Spec).

This guide is written to be the primary reference for designing, implementing, and evolving the BFF stack over multiple phases. It is grounded in:
- The current TypeScript web application (streaming, curriculum, wrap‑up, save/load, selection overlays).
- The existing React Native iOS shell and WebView bridge.
- The Phase 1 Mobile Engineering Spec.
- Contracts v1 for REST, WebSocket, RN↔WebView bridge, telemetry, and save‑file formats.

The overarching goals are:
- **Correctness for Phase 1 mobile**: deliver the minimal, fully functional path that lets the iOS client boot, load curriculum, present the initial Sensei bubble, and conduct full chat turns via the BFF and Gemini.
- **Clear separation of concerns**: keep HTTP/WS, observability, and client‑specific concerns inside the BFF, and concentrate pedagogy and prompt construction in Sensei Core.
- **Forward‑compatible design**: ensure the Phase 1 implementation can evolve into a highly scalable, efficient, and secure system across Phases 2 and 3 without large rewrites.

Subsequent sections will:
- Break down BFF responsibilities and classify them into three development phases that cover the full lifecycle of the system.
- Describe in detail what must be implemented in Phase 1 for the mobile client to function end‑to‑end.
- Provide both high‑level and low‑level designs for Phase 1, alongside a concrete implementation roadmap and appendices.

## System Overview (Current State)

### Clients and UI Shells

- **Web app (existing)**  
  - Runs entirely in the browser.  
  - Initializes the Gemini client directly using `GoogleGenAI` and `chat.sendMessageStream`.  
  - Manages curriculum state, teaching plans, and wrap‑up assessments in the browser.  
  - Streams LLM output through `streamModuleIntroduction` and `streamMainSenseiResponse`, updating the DOM via `updateMessageStream`.  
  - Implements save/load by serializing local state into `sensei_progress_*.json` files.

- **iOS mobile app (Phase 1)**  
  - React Native shell running `SenseiMobile/App.tsx`.  
  - Hosts a single WKWebView as the chat body (`MainScreen`), which loads the bundled web assets from `app_web/webview_dist/index.html`.  
  - Owns native UI for:
    - Compact, notch‑aware header and controls (`SenseiHeader`).  
    - Skia‑based glass/backdrop effects (`SenseiBackdropCanvas`).  
    - Selection overlay toolbox (`SelectionOverlay`).  
    - Native input bar and code editor badge (`InputBar`, `CodeEditorBadge`).  
    - Native save/load via filesystem (`IOSFileAdapter` + `SaveLoadService`).  
    - Telemetry toggle and delivery (`TelemetryManager`).
  - Communicates with the WebView using a throttled bridge (`BridgeManager` on the RN side, `webviewBridge.ts` in the Web bundle).

### Web Bundle and Bridge

- The web bundle (`src/index.tsx` → `SenseiMobile/app_web/webview_dist/index.js`) still assumes an in‑browser Gemini client and local `API_KEY`. It:
  - Boots the UI, initializes Google GenAI with `API_KEY`, and runs `loadCurriculumAndGreet()`.  
  - Fetches `Modules.txt` and renders the initial “choose a module/phase” Sensei bubble.  
  - Streams chat turns entirely client‑side, with no server involvement.  
  - Exposes several globals on `window` for save/load and debugging.
- Mobile integration added a WebView bridge:
  - `initializeWebviewBridge(handler)` wires window message events to a `handleReactNativeMessage` function in the bundle.  
  - On the RN side, `BridgeManager` and `SelectionOverlayController` dispatch messages such as `chat:startMessage`, `chat:update`, `chat:completeMessage`, `selectionSensei:invoke`, and `saveload:*`.
  - `Contracts v1` defines the canonical set of RN↔WebView messages and payload shapes.

### Existing BFF Stub

- `bff/index.js` currently provides a **local development stub**:
  - `POST /sessions` → `{ sessionId }` using an in‑memory set.  
  - `POST /sessions/:sessionId/turns` → `{ turnId, streamUrl }` and records the input text.  
  - `WS /stream?turnId=…` → emits fake `status` and `chunk` frames, an optional `wrapUp` payload, then `status:completed`.  
  - `POST /mermaid/recover` → a trivial “fixed if contains 'graph'” heuristic.  
  - `POST /telemetry` → logs events and returns 204.
- This stub matches the **shape** of the Contracts v1 endpoints but does not yet:
  - Invoke real Sensei Core logic for curriculum or pedagogy.  
  - Orchestrate real Gemini conversations on the server.  
  - Enforce the production semantics for rate limiting, timeouts, or error codes beyond basic validation.

### Sensei Core (Conceptual, Not Yet Fully Extracted)

- The engineering spec identifies a “Sensei Core” as a server‑side, pure TypeScript package that should:
  - Encapsulate curriculum and teaching plan logic (`src/curriculum.ts`).  
  - Encapsulate adaptive learner model updates (`src/adaptiveEngine.ts`).  
  - Encapsulate prompt builders and instruction templates (`src/prompts.ts`).  
  - Encapsulate wrap‑up validation and scoring (`src/wrapUpAssessment.ts`).  
  - Use injected logger and LLM gateway interfaces instead of browser‑bound `logger.ts` and direct Google SDK calls.
- In the current codebase, this logic is still coupled to the browser environment, and the BFF stub does not yet call into a Core package.

### Target Role of the BFF

For Phase 1 mobile, the BFF is intended to:

- Act as the **sole server boundary** for the iOS RN client:
  - RN uses only BFF REST/WS endpoints for sessions and streams.
  - No LLM keys or prompt text live on the device; all Gemini calls are made by the BFF on the server.
- Mediate between **client contracts** and **Sensei Core**:
  - Translate `/sessions` and `/turns` requests into Core calls.  
  - Stream Core/LLM output back over the WebSocket in the exact shapes defined in Contracts v1.  
  - Handle `/mermaid/recover` by delegating to Core’s mermaid repair logic and/or LLM gateway.  
  - Accept telemetry envelopes from mobile and forward/store them appropriately.
- Provide a foundation that can later:
  - Scale horizontally and serve additional clients (desktop, web) via dedicated BFF instances.  
  - Integrate more advanced routing, caching, and observability without breaking mobile contracts.

With this context in place, the next section (A) will break down the BFF’s responsibilities into three phases and outline how they span the complete lifecycle of the BFF’s development.

## A. High‑Level Breakdown of BFF Responsibilities and Phasing

This section defines what the BFF is responsible for in the Recursive Sensei ecosystem and then organizes the work into three development phases that span the full lifecycle: from a mobile‑focused MVP to a hardened, scalable, multi‑client backend.

Important context for reading Section A:
- **A.1 (Core Responsibilities)** describes the *full lifecycle* responsibilities of a Sensei BFF (where Sensei Core is fully extracted and multiple clients may exist).
- **A.2 (Phasing)** then slices those responsibilities into what is expected in Phase 1 vs what is deferred to Phase 2 and Phase 3.
- Phase‑specific details and implementation plans are expanded in Sections B and C; Section A is intentionally high‑level but must remain consistent with those later sections.

### A.1 Core Responsibilities of a Sensei BFF

For each client family (e.g., iOS mobile, desktop), we expect to stand up a **dedicated BFF** that:

1. **Owns the Client‑Facing API Surface**
   - Implements the REST and WebSocket contracts defined in `Contracts v1` for that client:
     - `/sessions`, `/sessions/{id}/turns`, `/mermaid/recover`, `/telemetry`.
     - WebSocket `/sessions/{id}/stream?turnId=…` with `status`, `chunk`, `wrapUp`, and `error` frames.
   - Adapts responses to client‑specific needs (e.g., mobile‑optimized footer payloads, debug information for desktop, etc.) while preserving shared contract invariants (status codes, error shapes, limits).

2. **Mediates Between Clients and Sensei Core**
   - Translates HTTP/WS payloads into domain‑level operations against Sensei Core:
     - Session bootstrap (initial curriculum, learner state, and header status).
     - Turn handling (interpret user input in context, select prompts and phases, orchestrate streaming).
     - Wrap‑up generation/validation and mermaid recovery.
   - Maintains the illusion, for clients, that they are talking to a single cohesive “Sensei brain,” even though Core may evolve independently.

3. **Encapsulates Gemini and Other External Services**
   - Holds all secrets and LLM credentials; mobile and desktop binaries never embed API keys.
   - Calls Gemini via a well‑defined LLM gateway (streaming and non‑streaming calls), implementing:
     - Timeouts and retries consistent with the Functional Spec.
     - Error normalization into the BFF’s error codes and WS `error` messages.
   - Integrates with any future services (e.g., feature flag systems, logging backends) behind stable interfaces.

4. **Implements Cross‑Cutting Concerns**
   - **Rate limiting and quotas** per client and per IP/UA, as defined in Functional Spec (e.g., 3 turns/min in Phase 1).
   - **Idempotency** for turn submissions via `clientTurnId`.
   - **Telemetry ingestion**, shaping events into shared envelopes, handling opt‑out semantics, and batching.
   - **Observability**: structured logging, request IDs, metrics, tracing hooks.
   - **Security boundaries**: validating inputs, ensuring no arbitrary code execution, and enforcing CORS and TLS where applicable.
   - **Persistence policy**: respect the Functional Spec’s Phase 1 rule that no long‑term learner progress is stored server‑side; sessions and turns are ephemeral in this phase.

5. **Client‑Specific Adaptation**
   - For mobile:
     - Respect low‑latency constraints and limited background execution.
     - Provide concise, battery‑friendly streaming behavior (controlled keepalives, bounded retries).
   - For desktop or web:
     - Potentially expose more debugging or introspection endpoints.
     - Handle higher concurrency levels and richer telemetry.

In short, the BFF is **the network boundary + protocol adapter + cross‑cutting concern handler** for a given client family, while Sensei Core is the **pedagogical and stateful brain** shared across BFFs.

### A.2 Three‑Phase Development Plan (Lifecycle View)

To move from today’s hybrid client‑side system to a robust, multi‑client architecture, we divide BFF work into three phases:

#### Phase 1 — Mobile E2E MVP (Functional Correctness)

Objective: **Enable the iOS mobile client to function end‑to‑end** using the BFF and Gemini, with the minimum viable slice of Sensei Core behavior moved server‑side and contracts stabilized between RN, WebView, and BFF.

High‑level tasks:
- Implement a production‑quality version of the Contracts v1 API surface for **mobile only**.
- Introduce a first Sensei Core façade (`SenseiCoreAdapter`) that:
  - Cooperates with the existing web curriculum bootstrap (the WebView still loads `Modules.txt` and renders the initial module list); the BFF does **not** own UI bootstrap in Phase 1.
  - Handles primary chat turn orchestration for the main teaching interaction by constructing prompts and streaming responses via Gemini, based on metadata from the client.
  - Delegates wrap‑up and mermaid repair to simple, well‑defined functions (which may initially mirror today’s client logic), establishing stable interfaces for future Core extraction.
- Implement a Gemini‑backed LLM gateway that:
  - Supports streaming responses for turns.
  - Enforces conservative timeouts, with basic error handling mapped into the BFF’s WS/HTTP semantics.
- Tighten the RN ↔ WebView ↔ BFF wiring so:
  - The mobile app can start in fullscreen mode, load curriculum via the BFF, display the first Sensei bubble, and handle real turn streams.
  - The local BFF stub is either upgraded or replaced so it no longer diverges from the target architecture.

Constraints:
- Prefer correctness and clear boundaries over full feature coverage.
- Accept limited telemetry and observability in Phase 1 as long as they are designed in a way that won’t require interface changes later.
 - Keep server‑side state ephemeral: no long‑term persistence of learner progress or transcripts in Phase 1; save/load remains client‑side.

Deliverable: A mobile build where:
- The WebView no longer depends on a browser‑side API key.
- The BFF sits between mobile and Gemini, and the curriculum/module selection and main chat flow work end‑to‑end with real model responses.

#### Phase 2 — Core Extraction and Multi‑Client Readiness

Objective: **Fully separate Sensei Core from UI and BFF concerns**, and make the BFF ready to serve both mobile and desktop clients with shared behavior and strong testing guarantees.

High‑level tasks:
- Extract pedagogy and curriculum logic into a dedicated **Sensei Core package**:
  - Migrate `curriculum.ts`, `adaptiveEngine.ts`, `prompts.ts`, and `wrapUpAssessment.ts` into Core with injected logger and LLM gateway interfaces.
  - Remove browser and DOM assumptions from Core code paths so they can run in Node.
  - Define stable Core APIs for:
    - Session creation and bootstrap.
    - Turn processing (including streaming plans).
    - Wrap‑up generation/validation.
    - Mermaid recovery decision logic (which can then call the LLM gateway).
- Refactor the BFF to call into the extracted Core instead of ad‑hoc logic.
- Extend BFF behavior to support:
  - Desktop clients (if required) via separate BFF instances or client‑aware routing while still using the same Core.
  - Richer telemetry and logging envelopes matching Contracts v1.
- Introduce **golden tests** that:
  - Feed identical prompts through Sensei Core (in a controlled environment) and assert on outputs for regression detection.
  - Validate that BFF JSON payloads and WS streams conform to Contracts v1.

Constraints:
- Avoid changing the mobile contracts established in Phase 1, except to add optional fields.
- Keep LLM provider fixed (Gemini), but design the gateway abstraction to be easily extended later.

Deliverable: A BFF + Sensei Core combination where:
- Core contains the canonical pedagogy logic.
- BFF for mobile and desktop share the same Core and behavior, with a robust integration test suite and golden fixtures.

#### Phase 3 — Scalability, Resilience, and Security Hardening

Objective: **Scale the BFF and Core stack to production load and reliability targets**, with strong security, observability, and operational tooling, while preserving client contracts.

High‑level tasks:
- Scalability:
  - Design BFF deployment for horizontal scaling (stateless BFFs with shared session stores or stateless session semantics).
  - Introduce distributed idempotency and rate limiting (e.g., Redis or equivalent), while keeping the API unchanged.
  - Optimize streaming pipelines for high throughput (connection limits, backpressure handling, batching of telemetry).
- Resilience:
  - Implement robust retry and fallback strategies for Gemini outages (within Functional Spec constraints).
  - Implement circuit breakers and load shedding to protect Core and LLM gateways.
  - Harden WebSocket handling for long‑lived connections, including ping/pong, idle timeouts, and graceful shutdown.
- Security:
  - Tighten input validation, JSON schema enforcement, and error sanitization.
  - Ensure secrets management is robust (vault integration, rotation pipelines).
  - Align telemetry and crash reporting with privacy requirements and App Store disclosures.
- Operational excellence:
  - Establish logging, metrics, and tracing standards for BFF and Core.
  - Add feature flagging and A/B testing hooks where necessary.

Constraints:
- No breaking changes to client contracts without a migration plan.
- All hardening must be incremental and validated via automated tests and staging rollouts.

Deliverable: A **highly scalable, efficient, and secure** BFF + Core stack that meets production needs for multiple clients without sacrificing correctness, with clear SLOs and operational observability.

---

The remaining sections of this guide will now zoom into Phase 1: first by enumerating the concrete responsibilities of the BFF in that phase (Section B), then by defining a detailed roadmap, high‑level and low‑level designs, and finally appendices and notes that tie the implementation back to the existing codebase and specs.

## B. Responsibilities of the BFF in Phase 1

Phase 1 is explicitly scoped as a **mobile‑first, web‑parity MVP** where:
- The iOS RN client uses a WKWebView to render the existing web UI.
- A dedicated BFF mediates all interactions between the mobile app and Gemini.
- Sensei Core is partially extracted or approximated, but the user experience must match the web app’s behavior for curriculum, streaming, and wrap‑up.

This section enumerates what the BFF must do *specifically in Phase 1* to enable the mobile client to function end‑to‑end. Section A described the full lifecycle responsibilities; Section B narrows that list to “Phase 1 slice” only and should be read in that light.

### B.1 Session Lifecycle and State Handling

1. **Session Creation (`POST /sessions`)**
   - Accepts `{ topicId, metadata? }` from the mobile client (per Contracts v1 and Functional Spec).
   - Validates `topicId` against a server‑owned TopicRegistry loaded from `config/topics.json`; unknown topics result in `400 BAD_REQUEST` with a structured error body.
   - Returns a `sessionId` that:
     - Is unique and opaque to clients.
     - Can be used to scope subsequent `/turns` and WebSocket streams.
   - Optionally returns `stateBootstrap` for future phases; in Phase 1 this may be minimal or omitted, provided the WebView can still bootstrap from `Modules.txt` and local state.
   - Does not perform long‑term persistence in Phase 1; session state is **ephemeral** for the duration of the app usage.

2. **Turn Submission (`POST /sessions/{id}/turns`)**
   - Validates:
     - `sessionId` exists and is active.
     - Request body conforms to Contracts v1 schema:
       - `clientTurnId` (required, string).
       - `input.text` (required, non‑empty string, max 4000 characters).
       - Optional `metadata` (source, appVersion, selectionSensei context).
   - Enforces **idempotency**:
     - A given `{ sessionId, clientTurnId }` pair always maps to the same `turnId`.
     - Retried POSTs with the same pair do not recreate work; they return the original `{ turnId, streamUrl }`.
   - Returns:
     - `turnId`: server‑generated identifier for the turn.
     - `streamUrl`: WebSocket URL for streaming this turn’s output, consistent with Contracts v1.

3. **Streaming Lifecycle (WebSocket `/sessions/{id}/stream?turnId=…`)**
   - On new WS connection:
     - Validates that the `{ sessionId, turnId }` combination is valid and associated with a prior `/turns` call.
     - Emits an initial `status` frame:
       - `{ type: "status", phase: "started", footer, kcProgress? }`, where `footer` can be a minimal placeholder in Phase 1 (e.g., `confidence: medium, confusion: low, intent: learn`), aligned with the Functional Spec.
   - During streaming:
     - Forwards text chunks from the Sensei Core + Gemini pipeline as `chunk` frames, preserving order.
     - Periodically emits `status` frames with `phase: "keepalive"` to satisfy the 15s keepalive requirement.
     - May emit `wrapUp` frames when the Core decides a wrap‑up assessment is ready.
   - Completion and error handling:
     - On normal completion, emits a final `status` frame with `phase: "completed"` and closes the WS gracefully.
     - On stall (no data/ping ack for ~25s) implements the **buffered mode** semantics:
       - Swaps to buffered mode; stops sending incremental `chunk`s.
       - When the LLM finishes, sends a final `chunk` or terminal payload and then `status:completed`.
     - On hard timeout or unrecoverable LLM/Core error, emits an `error` frame:
       - `{ type: "error", code, message }` with `code` in `[BAD_REQUEST, RATE_LIMITED, DOWNSTREAM_UNAVAILABLE, TURN_TIMEOUT]`.

4. **Session State (In‑Memory for Phase 1)**
   - Maintains minimal per‑session data:
     - Mapping of `sessionId` → session metadata (creation time, topicId).
     - Mapping of `turnId` → input payload (text, clientTurnId, metadata) and state needed to resume/emit the stream.
   - May maintain a **lightweight ephemeral state** for:
     - Recent learner model snapshots.
     - Curriculum state and teaching phase across turns, if that logic is moved server‑side in Phase 1.
   - Does not persist state across app restarts or between devices; save/load remains local in Phase 1.

### B.2 Integration with Sensei Core and Curriculum Workflow

Even before Core is fully extracted, Phase 1 BFF must integrate with the teaching workflow in a way that matches what the browser currently does:

1. **Session Bootstrap / Curriculum Initialization**
   - For Phase 1, the mobile WebView still loads `Modules.txt` and builds the module list locally. However, the BFF must be designed to:
     - Either be agnostic to module selection (treating the initial turn after selection as the first teaching turn), or
     - Receive sufficient metadata (moduleId, phase, concept) from the client so that Core can adjust its prompts accordingly.
   - The BFF should not block initial module listing; its primary responsibility here is to:
     - Be ready to handle the *first* teaching turn after the learner picks a module/phase, with knowledge of the selected module and phase if that information is passed in metadata.

2. **Turn Orchestration against Sensei Core**
   - For each `/turns` request, the BFF must:
     - Forward the user input and relevant context to Sensei Core (or, in Phase 1, to a façade approximating it via prompt builders and Gemini).
     - Include:
       - Current module and phase (if known and provided by the client in `metadata`).
       - Any learner model snapshot maintained in the BFF (or result of previous Core calls).
       - Selection Sensei metadata (if the turn was triggered by selection and not by free input).
     - Receive from Core:
       - A streaming plan (or a generator/async iterator over chunks) representing the Sensei response.
       - Updated learner model and curriculum state for this turn.
   - In Phase 1, this may be approximated by:
     - Having the BFF act as a thin adapter that:
       - Constructs prompts similar to the existing browser logic (`buildSenseiDynamicSystemInstruction`, `buildSocraticExecutionInstruction`) using data from the client.
       - Streams Gemini results directly without full server‑side learner model updates.
     - But the interface must allow a future Core module to drop in without changing the BFF’s external contracts.

3. **Wrap‑Up Assessment Integration**
   - The BFF must support the notion of a wrap‑up assessment at the end of a module or phase:
     - When Core decides to trigger a wrap‑up, it should return a structured payload equivalent to `WrapUpAssessmentOverlayData` (module title/goal, concept summaries, 15 questions with 5 snippet items).
     - The BFF forwards that payload as a `wrapUp` WS message.
   - In Phase 1, the UI rendering remains in the WebView (`wrapUpAssessment.ts`), but:
     - The generation and validation logic can remain on the client as long as the BFF’s interface is compatible with moving it server‑side later.
     - The BFF should already expect the `{ type: 'wrapUp' }` stream event type and propagate it intact.

4. **Mermaid Recovery Integration (Contract Level)**
   - The BFF implements `POST /mermaid/recover` per Contracts v1:
     - Accepts `{ messageId, code, theme?, errorHash?, context? }`.
     - Returns `{ fixed: boolean, fixedCode? }` or appropriate error codes (400/422/503) with these semantics:
       - `fixed:true` with `fixedCode` (non-empty string) → diagram successfully repaired; clients should render `fixedCode` instead of the original.
       - `fixed:false` or HTTP 422 → repair not possible with current inputs; clients treat this as a failed recovery (no fix) and show fallback UI.
       - HTTP 400 → invalid payload (e.g., missing `messageId`/`code`); clients treat as failed recovery and should not retry with the same payload.
       - HTTP 503 → temporary backend/LLM outage; clients may offer a retry, but this attempt is considered failed.
   - In Phase 1:
     - The actual recovery logic may be simple (e.g., echo back code if it looks valid) or may directly call a Gemini repair prompt.
     - The key requirement is to establish the correct endpoint and response semantics so mobile can rely on BFF for diagram recovery, instead of calling Gemini directly from the WebView.

### B.3 Gemini / LLM Gateway Responsibilities

Given Gemini is the sole provider for the foreseeable future, the BFF must:

1. **Provide a Stable LLM Gateway API (Internal)**
   - Offer an internal interface used by Sensei Core and orchestration code, such as:
     - `streamMainResponse(context, userInput, options) -> AsyncIterable<{ text: string }>`
     - `generateModuleIntroduction(context, moduleTitle, options)`
     - `analyzeLearnerTurn(context) -> ComprehensiveAnalysis`
     - `generateWrapUp(context) -> WrapUpAssessmentPayload`
     - `recoverMermaidDiagram(context) -> { fixed, fixedCode? }`
   - Encapsulate:
     - Gemini model names and configuration (temperature, max tokens, safety settings).
     - Error translation into BFF error codes.

2. **Handle Timeouts and Retries**
   - Enforce reasonable timeouts on all Gemini calls based on Functional Spec (e.g., ~60s hard timeout for turns).
   - Retry transient failures where safe, but:
     - Ensure idempotency for `clientTurnId`.
     - Bubble up a `DOWNSTREAM_UNAVAILABLE` or `TURN_TIMEOUT` error when retries are exhausted.

3. **Keep Secrets Server‑Side**
   - Read Gemini API keys and any related credentials only from server‑side configuration (env vars, secret managers).
   - Ensure no secrets are ever returned to clients or embedded in responses.

### B.4 Telemetry and Logging Responsibilities

Even in a “minimal” Phase 1, the BFF must fulfill core telemetry obligations from the Functional Spec:

1. **Telemetry Endpoint (`POST /telemetry`)**
   - Accepts event bundles from mobile (`{ events: TelemetryEvent[] }` where each event matches Contracts v1 schema).
   - Supports opt‑out semantics:
     - If the client telemetry toggle is OFF, the client should stop sending events, but the BFF must still tolerate stray telemetry calls.
   - For Phase 1:
     - May log events to stdout or a simple store.
     - Must not fail hard if payloads are malformed; best‑effort logging is acceptable.

2. **Structured Logging**
   - Log key lifecycle events:
     - Session creation/destruction.
     - Turn submission and streaming phases (started, keepalive, completed, error).
     - LLM errors and timeouts.
     - Mermaid recovery attempts.
   - Adopt a consistent log structure (“Sensei: [BFF] …”) so downstream tooling can filter mobile BFF logs and correlate them with client‑side logs.

3. **Minimal Metrics Hooks**
   - In Phase 1, emphasize:
     - Turn latency (time from POST `/turns` to first `chunk`).
     - Stream duration (time to `status:completed`).
     - Error rates by error code.
   - These can initially be computed via logging, but should be collected in a way that can later be fed into a metrics system without changing the core code.

### B.5 Error Handling, Limits, and Rate Limiting

The Phase 1 BFF must conform to Functional Spec and Contracts v1 error semantics, even if the backing implementation is simple:

1. **Input Validation and Limits**
   - Reject any `/turns` request where:
     - `text` is missing or empty → 400 BAD_REQUEST.
     - `text` length exceeds 4000 characters → 413 with a message instructing the user to shorten input.
   - Ensure all required fields in `/sessions` and `/mermaid/recover` requests exist and are correctly typed; otherwise return 400.

2. **Rate Limiting**
   - Implement a simple per‑IP/per‑UA rate limit for Phase 1:
     - E.g., allow up to 3 turns per minute per IP/UA as per Functional Spec.
   - On violation:
     - Return 429 RATE_LIMITED from `/turns` with `Retry-After` header.
     - Emit the corresponding `error` code in any existing streams, where applicable.

3. **Error Code Mapping**
   - Ensure that:
     - Client input errors and schema violations → BAD_REQUEST.
     - Over‑limit conditions → RATE_LIMITED.
     - LLM outage/infra failures → DOWNSTREAM_UNAVAILABLE.
     - Exceeded LLM timeouts → TURN_TIMEOUT.
   - Map these into both HTTP responses and WS `error` frames consistently.

### B.6 RN and WebView Contract Responsibilities

The BFF doesn’t talk directly to the WebView; RN acts as the bridge. But the BFF must:

1. **Respect RN Metadata Envelope**
   - The mobile app attaches metadata to `/turns`:
     - `source: "mobile"`
     - `appVersion`
     - Optional selection context (Selection Sensei actionId and snippet).
   - The BFF must:
     - Treat `source` and `appVersion` as observability hints (e.g., for telemetry).
     - Forward selection context into Core/LLM prompts when necessary (for Selection Sensei actions).

2. **Avoid UI‑Specific Coupling**
   - The BFF must not assume anything about DOM structure or CSS classes; all such concerns stay in WebView code (`ui.ts`, `wrapUpAssessment.ts`, etc.).
   - Any payloads the BFF emits should:
     - Match Contracts v1 strictly.
     - Avoid embedding HTML or CSS that depends on specific client implementations.

3. **Consistency with Web Contracts (Future‑Proofing)**
   - While Phase 1 focuses on mobile, the BFF’s APIs should be written with an eye toward supporting a desktop/web client in later phases:
     - No mobile‑only field names in stable contracts.
     - Use metadata fields for client‑specific hints when necessary.

---

With these responsibilities defined, the next section (C) will translate them into a **detailed Phase 1 BFF roadmap**: concrete tasks, ordering, and milestones required to get from the current stub to a working, Gemini‑backed BFF that unblocks the iOS mobile client. 

## C. Detailed Roadmap for Phase 1 BFF Tasks

This section turns the Phase 1 responsibilities into a concrete, actionable plan. The goal is to move from the current development stub (`bff/index.js`) to a **minimal‑but‑correct** BFF that allows the mobile app to:
- Start up, load curriculum, and display the initial Sensei module selection bubble using the existing web bundle, without the BFF interfering with that flow.
- Submit turns through the BFF to Gemini.
- Receive and render streamed responses in the WebView.
- Use BFF endpoints for mermaid recovery and telemetry.

The roadmap is organized into milestones. Within each milestone, tasks are ordered so they can be implemented and tested incrementally.

### C.1 Phase 1 Objective Recap

For reference, the Phase 1 BFF must:
- Implement `/sessions`, `/sessions/{id}/turns`, `/mermaid/recover`, `/telemetry`, and `/sessions/{id}/stream` consistent with Contracts v1 and the Functional Spec.
- Mediate between the RN mobile client and Gemini, with no LLM keys on device.
- Provide enough orchestration for:
  - Session creation and turn streaming.
  - Wrap‑up message delivery.
  - Mermaid diagram recovery with the correct contract.
  - Telemetry ingestion and basic logging/metrics.
- Enforce the key limits and error semantics (input length, rate limiting, idempotency).

### C.2 Milestone 1 — BFF Skeleton and Contract Alignment

**Goal:** Replace the ad‑hoc dev stub with a structure that directly reflects Contracts v1, without yet integrating real Sensei Core logic beyond simple echoes. This anchors the external API before behavior becomes more complex.

Actionable tasks:

1. **Create a dedicated BFF module layout**
   - Introduce a `bff/src` directory (or equivalent) and break `index.js` into:
     - `server.ts` or `server.js`: Express app and WS server wiring.
     - `routes/sessions.ts`: HTTP handlers for `/sessions` and `/sessions/:sessionId/turns`.
     - `routes/mermaid.ts`: HTTP handler for `/mermaid/recover`.
     - `routes/telemetry.ts`: HTTP handler for `/telemetry`.
     - `stream/streamServer.ts`: WebSocket server for `/sessions/{id}/stream`.
     - `state/sessionStore.ts`: ephemeral in‑memory session and turn store.
   - Keep the existing `npm run start` contract intact by having `bff/index.js` import and start the new server module.

2. **Align HTTP contracts to Contracts v1**
   - Use a schema validation layer (e.g., `zod`, already present) to enforce request/response shapes:
     - `/sessions` POST: validate `topicId` (string) and optional `metadata`.
     - `/sessions/:sessionId/turns` POST: validate `clientTurnId`, `input.text`, and optional `metadata`.
     - `/mermaid/recover` POST: validate `messageId`, `code`, `theme?`, `errorHash?`, `context?`.
     - `/telemetry` POST: validate that `events` is an array of objects.
   - Normalize responses:
     - Ensure `/sessions` returns `{ sessionId, stateBootstrap? }` with no extra fields.
     - Ensure `/turns` returns `{ turnId, streamUrl }`.
     - Ensure `/mermaid/recover` returns `{ fixed, fixedCode? }`.
   - Replace ad‑hoc inline validation with reusable schemas in a shared `contracts.ts` module inside `bff/src`.

3. **Implement a minimal in‑memory SessionStore**
   - Provide functions:
     - `createSession(topicId, metadata) -> sessionId`
     - `getSession(sessionId) -> Session | null`
     - `createOrGetTurn(session, clientTurnId, input, metadata) -> { turn, isReplay }`
     - `getTurn(turnId) -> Turn | null`
   - Implement **idempotency** at this layer:
     - Maintain a per‑session mapping of `clientTurnId` → `turnId`.
     - If `createOrGetTurn` is called with an existing `clientTurnId`, return the original `turnId` and do not enqueue new work.
   - Attach any ephemeral state needed later (e.g., initial learner model snapshot placeholder, module/phase metadata) to the session/turn records, even if not yet used.
   - Consult TopicRegistry when creating sessions so that only topicIds defined in `config/topics.json` can be used.

4. **Refactor the current WS implementation into streamServer**
   - Move the existing WebSocket handling from `index.js` into `stream/streamServer.ts`, and normalize it on the canonical path `/sessions/{sessionId}/stream?turnId=...` as defined in Contracts v1.
   - Update it to:
     - Resolve `turnId` from the query string and look up the turn in `SessionStore`.
     - Emit `status:started` and `status:completed` frames with the shape defined in Contracts v1.
     - Continue emitting simple `chunk` frames for now (e.g., word‑chunking the stored turn text), but standardize the payload: `{ type: "chunk", text, messageId? }`.
   - Ensure keepalive `status` frames with `phase: "keepalive"` are emitted at 15s intervals even in this stub.

5. **Wire BFF into the existing mobile client**
   - Confirm that `SenseiMobile/App.tsx` still points `BffClient` at `http://localhost:8787`.
   - Ensure `BffClient.ensureSession` and `.submitTurn` work unchanged against the refactored BFF:
     - No schema shape changes for `sessionId`, `turnId`, or `streamUrl`.
   - Run the mobile app against the updated BFF and confirm:
     - `BffClient` can create sessions and turns.
     - `runForwardStream` receives events (`chunk` and `status`) over WS and forwards them to the WebView via `BridgeManager`.

**Exit criteria for Milestone 1:**
- BFF structure matches Contracts v1 at the HTTP/WS level.
- Mobile app can open a session and stream stubbed responses through the BFF, even if the content is not yet driven by real Sensei Core or Gemini.

### C.3 Milestone 2 — Gemini LLM Gateway and Streaming Integration

**Goal:** Replace the stubbed word‑splitting stream with real Gemini‑backed streaming, still using a simplified prompt pipeline but exercising the true LLM and end‑to‑end streaming path.

Actionable tasks:

1. **Introduce a Gemini LLM gateway module**
   - Add `bff/src/llm/geminiGateway.ts` that:
     - Initializes the Gemini client from server‑side configuration (API key, base URL, model names).
     - Exposes functions:
       - `streamMainResponse(context, userInput, options) -> AsyncIterable<{ text: string }>`
       - `generateModuleIntroduction(context, moduleTitle) -> AsyncIterable<{ text: string }>` or non‑streaming variant.
       - `recoverMermaidDiagram(payload) -> { fixed, fixedCode? }` (may initially be a thin wrapper over simple heuristics).
     - Handles:
       - Timeouts (configurable) with safe cancellation.
       - Logging of prompt metadata and errors.

2. **Implement a simple prompt builder aligned with existing web logic**
   - Create `bff/src/orchestration/prompts.ts` (or similar) that:
     - Reuses or mirrors `buildSenseiDynamicSystemInstruction`, `buildSocraticExecutionInstruction`, and other key prompt builders from `src/interactionHelpers.ts` and `src/prompts.ts`.
     - For Phase 1, accepts:
       - A minimal notion of curriculum/topic/phase (even if just a default topic initially).
       - The user’s input.
       - Basic navigation context (if available in turn metadata).
       - Optional selection context (Selection Sensei actionId and selected text) when turns are initiated from the selection toolbox.
   - Do not attempt to fully replicate the web‑side teaching plan pipeline yet; aim for:
     - A correct, stable prompt interface for the LLM gateway.
     - Reasonable behavior that can later be refined using extracted Sensei Core.

3. **Wire `/turns` → LLM gateway in streaming mode**
   - In the `/sessions/:sessionId/turns` handler:
     - After creating a turn, do **not** generate the response yet; instead:
       - Store the turn metadata and any prompt context needed for streaming later, including:
         - `clientTurnId`, `input.text`, and `metadata` (source, appVersion, selection context).
         - Any module/phase identifiers the client already knows (if added to metadata).
   - In the WS stream handler:
     - When a client connects for a given `turnId`:
       - Construct the prompt context using the orchestration module.
       - Call `geminiGateway.streamMainResponse(...)` to obtain an async iterator of `{ text }` chunks.
       - For each yielded chunk, send `{ type: "chunk", text }` WS messages.
       - On completion, send `status:completed` and close.
   - Implement timeout and cancellation:
     - If streaming exceeds the configured hard timeout, stop reading from the iterator, send `error: TURN_TIMEOUT`, and close.

4. **Support basic footer updates**
   - During streaming, periodically send `status` frames with:
     - `phase: "started"` (initial) and `phase: "keepalive"` (heartbeats).
     - A very simple `footer` payload (e.g., static `confidence`, `confusion`, `intent`) until true learner model integration is available.
   - Confirm that the mobile client receives and uses these footer updates:
     - `MainScreen.runForwardStream` already forwards `footer:update` messages into the WebView and local state.

5. **Verify end‑to‑end streaming in mobile**
   - With the BFF now using Gemini:
     - Run the mobile app, submit a turn, and confirm that:
       - RN’s `runForwardStream` sees multiple `chunk` events per turn.
       - The WebView’s `updateMessageStream` renders the streamed text correctly.
       - The web bundle does **not** attempt to initialize its own `GoogleGenAI` client or call Gemini directly when running inside the mobile WebView; LLM calls must originate from the BFF path for mobile.

**Exit criteria for Milestone 2:**
- Mobile app can submit turns that are streamed from Gemini via the BFF.
- WebSocket semantics (status frames, chunk ordering, basic timeouts) are correct and stable for Phase 1.

### C.4 Milestone 3 — Wrap‑Up and Mermaid Recovery Integration

**Goal:** Implement the BFF responsibilities around wrap‑up assessments and mermaid recovery so the mobile app can rely on the server side for these flows, aligning with Contracts v1.

Actionable tasks:

1. **Wrap‑Up stream support**
   - Extend the WS stream handler to support a `wrapUp` event from the orchestration layer:
     - After main response streaming completes (or under specific conditions), the orchestrator may request a wrap‑up assessment from the LLM gateway or a Core stub.
     - Once available, send a WS message:
       - `{ type: "wrapUp", payload: WrapUpAssessmentOverlayData }`, where `WrapUpAssessmentOverlayData` matches the shape expected by the client (`moduleTitle`, optional `moduleGoal`, `conceptSummaries`, and `questions` array).
   - On the client side, `BffClient` already maps `wrapUp` events into `bridge.enqueue({ type: 'wrapup:show', data: payload })`; ensure that still holds and is exercised by tests.

2. **Wrap‑Up payload validation at the BFF boundary**
   - Before sending `wrapUp` to clients:
     - Validate the payload against the same high‑level invariants enforced in `wrapUpAssessment.ts`:
       - 15 questions total; exactly 5 snippet questions.
       - Each question has id, prompt, explanation, interviewer insight, and 4 choices.
       - Snippet questions have non‑empty `code`.
     - Propagate only valid payloads; otherwise:
       - Log an error and either:
         - Skip sending the wrap‑up for that turn, or
         - Send an `error` frame indicating wrap‑up generation failed (non‑fatal to the chat).

3. **Implement `POST /mermaid/recover` against the LLM gateway**
   - Replace the current heuristic implementation with:
     - A call into `geminiGateway.recoverMermaidDiagram(payload)` that:
       - Uses a repair prompt grounded in the Functional Spec and existing web behavior.
       - Produces `{ fixed, fixedCode? }`.
     - Map errors and edge cases to:
       - 400 (bad payload).
       - 422 (unable to repair deterministically).
       - 503 (upstream LLM issues).
   - Ensure:
     - The mobile RN client is wired to call this endpoint when the WebView reports `mermaid:error`.
     - The WebView’s mermaid recovery UI is updated to trust the BFF results (max 2 visible retries, as per spec).

4. **Telemetry for wrap‑up and mermaid**
   - Ensure that the RN client’s telemetry events for wrap‑up and mermaid operations:
     - Are accepted by `/telemetry` without error.
     - Include event names such as `wrapup_submitted`, `mermaid_recovery_attempt`, etc., consistent with Contracts v1 and Functional Spec.
   - In Phase 1:
     - Basic logging of event counts is sufficient, but the shape must be correct.

**Exit criteria for Milestone 3:**
- BFF can emit valid `wrapUp` WS messages that the mobile client renders via the WebView.
- `/mermaid/recover` is implemented via Gemini and successfully wired through to the mobile mermaid recovery flow.

### C.5 Milestone 4 — Limits, Error Semantics, and Rate Limiting

**Goal:** Ensure the BFF enforces Functional Spec limits and error semantics so mobile can rely on predictable behavior for edge cases.

Actionable tasks:

1. **Enforce input length limits on `/turns`**
   - Before creating a turn:
     - Validate `input.text.length <= 4000`.
     - If exceeded:
       - Return 413 with a descriptive error message.
       - Ensure no `turnId` is created.
   - Confirm mobile maps 413 into the correct user‑facing prompt (this may be in RN or WebView code).

2. **Implement per‑IP/UA rate limiting**
   - Add a simple, in‑memory rate limiter for Phase 1:
     - Track the last N (e.g., 3) `/turns` per IP/UA per minute.
   - On exceeding the limit:
     - Return 429 with a `Retry-After` header (integer seconds).
     - Log the event for visibility.
   - Ensure that:
     - Mobile can surface a “too many messages” UI based on the 429 code.

3. **Normalize error codes across HTTP and WS**
   - Standardize a mapping layer:
     - Internal error types → HTTP status + WS `error.code`.
   - Audit all error paths in:
     - `/sessions`, `/turns`, `/mermaid/recover`, `/telemetry`.
     - WS stream handler.
   - Ensure error responses always include:
     - `code` in `[BAD_REQUEST, RATE_LIMITED, DOWNSTREAM_UNAVAILABLE, TURN_TIMEOUT]`.
     - A human‑readable `message` safe for user display.

4. **Add basic stall and timeout handling to WS**
   - Implement:
     - Keepalive timer (15s) to emit `status:keepalive`.
     - Stall detection (~25s without activity) to switch to buffered mode.
     - Hard timeout (~60s) that:
       - Cancels the underlying LLM stream.
       - Emits `error: TURN_TIMEOUT`.
       - Closes the WS.

**Exit criteria for Milestone 4:**
- Inputs beyond 4000 characters are rejected with 413.
- Excessive turn submissions yield 429 with `Retry-After`.
- WS streams respect keepalive, stall, and timeout semantics, and mobile can respond appropriately.

### C.6 Milestone 5 — Telemetry, Logging, and Minimal Observability

**Goal:** Provide enough telemetry and logging to debug Phase 1 behavior and prepare for Phase 2 observability without over‑engineering.

Actionable tasks:

1. **Finalize `/telemetry` payload handling**
   - Ensure the handler:
     - Accepts `events: TelemetryEvent[]` where each event has at least `event`, `timestamp`, `data`.
     - Logs the count of events and key fields (e.g., event names, appVersion, platform).
     - Ignores malformed events (log and continue) instead of failing the request.

2. **Integrate structured logging throughout the BFF**
   - Use a simple, structured logger (or consistent `console.log` shape) to emit:
     - `[BFF] session created`, `[BFF] turn submitted`, `[BFF] stream started/completed`, `[BFF] LLM error`, `[BFF] mermaid recovery`, `[BFF] wrapup emitted`.
   - Include correlation identifiers in logs where possible:
     - `sessionId`, `turnId`, `clientTurnId`, and `ip`/`userAgent`.

3. **Add lightweight metrics hooks**
   - Begin tracking:
     - Turn latency (time from `/turns` to first chunk).
     - Stream duration and chunk counts.
     - Error counts by error code.
   - Initially, these can be logged; later they can feed into a metrics backend without changing call sites.

4. **Smoke tests and log‑driven verification**
   - Add a small Jest or Node test suite (or manual test scripts) that:
     - Exercises `/sessions`, `/turns`, WS streaming, `/mermaid/recover`, and `/telemetry`.
     - Asserts on HTTP status codes and basic response shapes.
   - Use logs during manual QA runs to confirm:
     - Telemetry opt‑out flows behave as expected.
     - Error conditions emit the right codes and messages.

**Exit criteria for Milestone 5:**
- BFF emits structured logs and accepts telemetry without errors.
- Basic metrics can be inferred from logs.
- A small automated or semi‑automated test suite validates core endpoints.

### C.7 Milestone 6 — Mobile E2E Readiness Checklist

**Goal:** Confirm that all Phase 1 BFF responsibilities are satisfied from the mobile app’s perspective.

Checklist (to be run after completing Milestones 1–5):

1. **Startup and Curriculum**
   - Mobile app launches; WebView loads the web bundle.
   - BFF is running; `/sessions` is reachable.
   - WebView can fetch `Modules.txt` and render the initial module list.
   - After module selection, the first teaching turn uses BFF `/turns` → WS stream for Sensei’s response.
   - When running under the mobile shell, the web bundle does not directly call Gemini; all LLM traffic is mediated by the BFF.

2. **Chat Turns**
   - Short and long user inputs (within 4000 chars) produce streamed responses.
   - Buffers and keepalive behavior are correct:
     - Long‑running turns trigger keepalives and, if necessary, buffered mode.
   - Errors (network, LLM, invalid input) generate correct HTTP/WS error responses and can be surfaced in UI.

3. **Wrap‑Up and Mermaid**
   - At module end (or under test conditions), BFF emits `wrapUp` payloads that render correctly in the WebView overlay.
   - Mermaid diagrams that fail in the WebView trigger `/mermaid/recover`, and the BFF responds with appropriate `{ fixed, fixedCode? }` payloads.

4. **Save/Load and Telemetry**
   - Save/load remains local but BFF:
     - Is unaffected by multiple sessions created across app runs.
     - Accepts `/telemetry` payloads with no errors.

5. **Limits and Rate Limiting**
   - Inputs >4000 characters are rejected with 413; mobile shows a suitable prompt.
   - Submitting more than the allowed turns per minute triggers 429; mobile respects `Retry-After`.

Once this checklist passes consistently on the target QA devices (iPhone 12, iPhone 14, iPad 10th gen), Phase 1 BFF can be considered complete and stable enough to support the iOS mobile MVP, and the system will be ready for Phase 2 Core extraction and multi‑client expansion.

## D. High‑Level Design for Phase 1 BFF

This section describes the **architecture and major components** of the Phase 1 BFF. While Section C outlined *what* must be done and in what order, this section explains *how the pieces fit together* so that implementation can proceed with clear boundaries and responsibilities.

The focus here is on conceptual architecture, module decomposition, and the main runtime flows (sessions, turns, streaming, wrap‑up, mermaid recovery, telemetry). Low‑level types, function signatures, and edge‑case handling will be expanded further in Section E.

### D.1 Architectural Overview

At a high level, the Phase 1 BFF is a **Node‑based service** that:
- Exposes a **REST API** (`/sessions`, `/sessions/{id}/turns`, `/mermaid/recover`, `/telemetry`) over HTTP.
- Exposes a **WebSocket streaming endpoint** at `/sessions/{id}/stream?turnId=…`.
- Maintains **ephemeral session/turn state** in memory for the duration of a process (no long‑term persistence in Phase 1).
- Orchestrates calls to a **Gemini LLM gateway** and, where available, a **Sensei Core façade**.
- Implements **cross‑cutting concerns**: idempotency, rate limiting, logging, and telemetry ingestion.

Section D describes **what components exist and how they interact** in this architecture. Section E then specifies **exact interfaces and pseudo‑code** for these same components, and Section C provides the **incremental plan** for building them. The three sections are intended to be read together: D as the structural map, E as the implementation blueprint, and C as the execution sequence.

The BFF runs as a single process in Phase 1, but is designed to scale horizontally in Phase 2+ by keeping state and configuration modular.

Conceptually, the architecture can be viewed as the following layered system:

1. **Transport Layer**
   - HTTP server (Express or equivalent) for REST endpoints.
   - WebSocket server for streaming.

2. **API Controllers / Route Handlers**
   - `SessionController`: handles `/sessions`, `/sessions/{id}/turns`.
   - `MermaidController`: handles `/mermaid/recover`.
   - `TelemetryController`: handles `/telemetry`.
   - `StreamController`: handles WebSocket connections and routing per `sessionId`/`turnId`.

3. **Domain Services**
   - `SessionService`: creates and retrieves sessions.
   - `TurnService`: creates or reuses turns, manages idempotency, and coordinates streaming.
   - `StreamingService`: orchestrates LLM streaming to WebSocket frames and handles keepalives/timeouts.
   - `MermaidService`: handles diagram recovery using LLM gateway or heuristics.
   - `WrapUpService`: manages the generation/validation of wrap‑up assessments (initially stubbed, later moved into Core).
   - `TelemetryService`: validates and forwards telemetry events and performs basic aggregation/logging.

4. **Infrastructure / Utilities**
   - `SessionStore`: in‑memory maps for sessions, turns, and clientTurnId → turnId mappings.
   - `RateLimiter`: simple per‑IP/per‑UA counters enforcing Functional Spec limits.
   - `ErrorMapper`: translates internal errors into HTTP status codes and WS error frames.
   - `Logger`: structured logging wrapper used across BFF modules.

5. **Integration Layer**
   - `GeminiGateway`: wraps calls to Gemini models (streaming, repair, analysis).
   - `SenseiCoreAdapter` (Phase 1 façade): hides the details of prompt building and, in later phases, calls into extracted Sensei Core logic instead of rolling its own prompts.

The BFF does **not** render UI, manage DOM, or know about RN or WebView internals. It purely manipulates JSON payloads and streaming events.

### D.2 Component Decomposition

This subsection describes the main components and their responsibilities at a structural level.

#### D.2.1 HTTP Server and Routers

**HTTP Server (`server.ts`)**
- Creates and configures the Express app:
  - JSON body parsing with appropriate size limits (e.g., 2MB).
  - CORS policy appropriate for local/mobile dev (and later production).
  - Request logging middleware.
  - Error handling middleware that uses `ErrorMapper`.
- Mounts route modules:
  - `/sessions` → `SessionRouter`.
  - `/sessions/:sessionId/turns` → `SessionRouter`.
  - `/mermaid/recover` → `MermaidRouter`.
  - `/telemetry` → `TelemetryRouter`.

**SessionRouter**
- Routes:
  - `POST /sessions` → `SessionController.createSession`.
  - `POST /sessions/:sessionId/turns` → `SessionController.submitTurn`.
- Applies:
  - Schema validation middleware for requests.
  - Rate‑limiting middleware on `/turns`.

**MermaidRouter**
- Routes:
  - `POST /mermaid/recover` → `MermaidController.recover`.

**TelemetryRouter**
- Routes:
  - `POST /telemetry` → `TelemetryController.ingest`.

These routers are thin: they primarily parse/validate requests and delegate to domain services.

#### D.2.2 WebSocket Streaming Server

**StreamServer (`streamServer.ts`)**
- Attaches to the same HTTP server as Express.
- Listens on path: `/sessions/{sessionId}/stream`.
- On `connection`:
  - Extracts `sessionId` and `turnId` from URL.
  - Invokes `StreamController.handleConnection(sessionId, turnId, ws)`.

**StreamController**
- Responsibilities:
  - Validate that `sessionId` and `turnId` correspond to a known session and turn in `SessionStore`.
  - Emit the initial `status` frame with `phase: "started"` (and optional footer).
  - Delegate streaming to `StreamingService`, passing a handle that includes:
    - WebSocket instance.
    - Session and turn info.
    - A reference to `SenseiCoreAdapter` and `GeminiGateway`.
  - Ensure graceful cleanup:
    - Handle client disconnects by cancelling any in‑flight LLM calls.
    - Handle server shutdown signals by closing WS connections cleanly.

#### D.2.3 Session and Turn Services

**SessionService**
- Offers:
  - `createSession(topicId, metadata) -> Session`.
  - `getSession(sessionId) -> Session | null`.
- Uses `SessionStore` for persistence.
- May enrich sessions with:
  - Creation timestamp.
  - Optional initial Core session handle (in later phases).

**TurnService**
- Offers:
  - `createOrGetTurn(sessionId, clientTurnId, input, metadata) -> { turn, isReplay }`.
  - `getTurn(turnId) -> Turn | null`.
  - `prepareTurnContext(turn) -> TurnContext` (used by `StreamingService`).
- Responsibilities:
  - Enforce idempotency:
    - If a turn already exists for `(sessionId, clientTurnId)`, return the same `turn` and mark `isReplay = true`.
  - Attach any early decision metadata to the turn:
    - Type: free input vs selection‑triggered.
    - Module and phase information (if provided in metadata).
    - A lightweight “plan” for what to ask Core/LLM for this turn (e.g., main teaching response vs wrap‑up).

#### D.2.4 Streaming Service

**StreamingService**
- Core responsibilities:
  - Given a `sessionId`, `turnId`, and WebSocket, orchestrate the streaming of the Sensei response:
    - Call `SenseiCoreAdapter` and `GeminiGateway` to obtain an async iterator of chunks.
    - Emit WS frames that match Contracts v1 (`status`, `chunk`, `wrapUp`, `error`).
    - Handle keepalives and timeouts.
  - Manage backpressure (at least minimally) and WS lifetime.

Internal workflow:
1. **Initialization**
   - Look up `turn` in `TurnService`.
   - Call `TurnService.prepareTurnContext(turn)` to obtain:
     - Current module/phase (if known).
     - Prior learner model snapshot (if available).
     - Selection context (for Selection Sensei flows).
   - Call `SenseiCoreAdapter.buildPrompt(turnContext)` to get:
     - A prompt string (or structured prompt) for Gemini.
2. **Streaming**
   - Call `GeminiGateway.streamMainResponse(prompt, options)` to obtain an async iterator.
   - For each chunk:
     - Emit `{ type: "chunk", text }`.
     - Periodically emit `status:keepalive` based on timers or chunk cadence.
3. **Completion / Extras**
   - On completion:
     - Optionally call `SenseiCoreAdapter.maybeGenerateWrapUp(turnContext)`; if it returns a payload, emit `{ type: "wrapUp", payload }`.
     - Emit `{ type: "status", phase: "completed", footer }`.
4. **Error Handling**
   - On LLM error:
     - Classify error via `ErrorMapper` (e.g., `DOWNSTREAM_UNAVAILABLE`, `TURN_TIMEOUT`).
     - Emit `error` frame and close WS.

In Phase 1, `SenseiCoreAdapter` can be simple; it may construct prompts that mirror the current web logic without fully migrating all Core behavior yet.

#### D.2.5 Mermaid and Wrap‑Up Services

**MermaidService**
- Exposes:
  - `recoverDiagram(payload: MermaidRecoveryPayload) -> MermaidRecoveryResult`.
- Implementation:
  - Validates payload against Contracts v1 schema.
  - Calls `GeminiGateway.recoverMermaidDiagram` with:
    - The original code.
    - Optional theme and error context.
  - Maps the result into `{ fixed, fixedCode? }`.
  - Handles:
    - 400 for validation failures.
    - 422 when LLM cannot produce a deterministic fix.
    - 503 when Gemini is unavailable.

**WrapUpService**
- Exposes:
  - `maybeGenerateWrapUp(context: TurnContext) -> WrapUpAssessmentOverlayData | null`.
- Phase 1 behavior:
  - May initially be stubbed to always return `null` or generate a fixed sample payload for testing.
  - The interface is designed so that:
    - In later phases, it will call into Sensei Core (extracted logic from `src/geminiService.ts` and `src/wrapUpAssessment.ts`) to generate a fully validated wrap‑up assessment that matches the existing web overlay.
  - Regardless of generation strategy, the service must:
    - Validate the payload against high‑level constraints (15 questions, 5 snippets), consistent with `src/wrapUpAssessment.ts`.
    - Ensure the JSON structure aligns with Contracts v1 and the RN→WebView bridge types in `src/mobile/bridge/contracts.ts`, so that `handleReactNativeMessage` can call `showWrapUpAssessmentOverlay` without additional adaptation.
    - Return `null` if validation fails, logging details for debugging.

#### D.2.6 TelemetryService and RateLimiter

**TelemetryService**
- Exposes:
  - `ingest(events: TelemetryEvent[], context: RequestContext)`.
- Responsibilities:
  - Validate basic shape of each event.
  - Attach server‑side metadata (timestamp if missing, server instance id, etc.).
  - Forward events to:
    - Logs (Phase 1).
    - Future telemetry pipelines (Phase 2+).
  - Never fail the main app logic because telemetry ingestion failed.

**RateLimiter**
- Exposes:
  - `checkTurnAllowed(ip: string, ua: string, now: number) -> { allowed: boolean, retryAfterSeconds?: number }`.
- Responsibilities:
  - Maintain per‑IP/UA counters of turns in the last rolling window (e.g., 60s).
  - Return `allowed: false` with `retryAfterSeconds` when the count exceeds the limit.
  - Integrate with `SessionRouter` on `/turns`:
    - If not allowed, short‑circuit the handler and respond with 429 + `Retry-After`.

#### D.2.7 ErrorMapper and Logger

**ErrorMapper**
- Encapsulates the mapping from internal errors to standardized error codes:
  - `BAD_REQUEST`, `RATE_LIMITED`, `DOWNSTREAM_UNAVAILABLE`, `TURN_TIMEOUT`.
- Provides helper functions:
  - `toHttpError(err) -> { status: number, body: { code, message } }`.
  - `toWsError(err) -> { code: ErrorCode, message: string }`.
- Ensures consistent error semantics across REST and WS layers.

**Logger**
- Provides structured logging primitives:
  - `info`, `warn`, `error`, `debug`.
- Injected or imported uniformly across BFF modules.
- Designed to be swapped out or wrapped by production logging infrastructure later.

### D.3 Data Models and Key Types (Conceptual)

The BFF’s internal data models line up with the contracts in `docs/engineering/contracts_v1.md` and `docs/functional_spec/recursive_sensei_mobile_phase1_functional_spec.md`. At a high level:

- **TopicConfig**
  - `id: string` (the `topicId` used in `/sessions`)
  - `displayName: string`
  - `modulesPath?: string` (optional path or identifier for the curriculum backing this topic)

- **Session**
  - `id: string`
  - `topicId: string`
  - `createdAt: number`
  - `metadata: { source?: string; appVersion?: string; ... }`

- **Turn**
  - `id: string`
  - `sessionId: string`
  - `clientTurnId: string`
  - `input: { text: string }`
  - `metadata: { source?: "mobile" | "web"; appVersion?: string; selectionSensei?: { actionId: string; selectedText: string } }`
  - `createdAt: number`

- **TurnContext** (used internally)
  - `session: Session`
  - `turn: Turn`
  - `curriculumRef?: { moduleId: string; phase: string; conceptId?: string }`
  - `learnerModelSnapshot?: any` (placeholder for Core integration)

- **MermaidRecoveryPayload / Result**
  - As defined in Contracts v1 and mirrored in `SenseiMobile/src/mobile/network/types.ts`.

- **WrapUpAssessmentOverlayData**
  - Mirror of the client type in `src/wrapUpAssessment.ts` and the web bridge contracts in `src/mobile/bridge/contracts.ts`: module info, optional goal and concept summaries, plus validated question objects compatible with the existing overlay rendering.

D.3.1 Infra Interfaces (for future persistence/scale)

- **SessionStore**
  - Async interface, even if the Phase 1 implementation is in-memory, to allow swapping in Redis or another backing store later without changing controllers/services.
  - Conceptual shape:
    ```ts
    // infra/SessionStore.ts

    export interface SessionStore {
      createSession(topicId: string, metadata: Session['metadata']): Promise<Session>;
      getSession(sessionId: string): Promise<Session | null>;

      createOrGetTurn(
        session: Session,
        clientTurnId: string,
        input: TurnInput,
        metadata: TurnMetadata
      ): Promise<{ turn: Turn; isReplay: boolean }>;

      getTurn(turnId: string): Promise<Turn | null>;

      pruneIdempotency(retentionMs: number): Promise<void>;
    }
    ```
  - Controllers should depend on a `SessionService` that in turn depends on this interface, not on concrete maps, so that storage can be replaced without changing route handlers.

- **RateLimiter**
  - Async interface so that simple in-memory buckets used in Phase 1 can later be backed by Redis or another shared store without changing handlers.
  - Conceptual shape:
    ```ts
    // infra/RateLimiter.ts

    export interface RateLimiter {
      checkAndConsume(key: { ip: string; ua: string }, now: number): Promise<{ allowed: boolean; retryAfterSeconds?: number }>;
    }
    ```
	  - `/sessions/{sessionId}/turns` handlers should call into a `TurnService` that uses this interface; the decision “3 turns per 60s per (ip, ua)” is enforced in the limiter, not spread across controllers.

- **RequestContext / correlation IDs**
  - To make future tracing and telemetry integration easier, each HTTP request is associated with a lightweight `requestId` (and optional `sessionId`, `turnId`, `clientTurnId`), passed through services for logging:
    ```ts
    // infra/RequestContext.ts

    export interface RequestContext {
      requestId: string;
      sessionId?: string;
      turnId?: string;
      clientTurnId?: string;
    }
    ```
  - Controllers construct a `RequestContext` (or obtain it from per-request storage) and pass it into services, `SenseiCoreAdapter`, and `GeminiGateway` purely for logging/metrics; it is not part of the external API and remains an internal concern.

Detailed TypeScript definitions will live in Section E’s low‑level design, but at the high level, the BFF treats these as JSON‑serializable objects with well‑defined schemas and uses them to bridge between client contracts and Core/LLM logic.

### D.4 Primary Runtime Flows

This subsection summarizes the main flows that Phase 1 must support.

#### D.4.1 Session Creation Flow

1. RN app starts and needs a session:
   - `BffClient.ensureSession()` in the mobile app calls `POST /sessions` with `{ topicId: "c++_recursive_mastery", metadata: { source: "mobile", appVersion } }`.
2. `SessionRouter` validates the payload and calls:
   - `SessionService.createSession(topicId, metadata)`, which consults TopicRegistry to ensure `topicId` is defined in `config/topics.json`.
3. `SessionService`:
   - Generates a new `sessionId`.
   - Stores the session in `SessionStore`.
4. Response:
   - The BFF returns `{ sessionId }` to the mobile client.
   - `BffClient` caches `sessionId` for subsequent `/turns`.

#### D.4.2 Turn Submission and Streaming Flow

1. The learner submits text in the RN app:
   - `MainScreen.handleSubmit()` uses `TelemetryManager` to generate a `clientTurnId` and calls:
     - `BffClient.submitTurn({ text, clientTurnId })`.
2. `BffClient.submitTurn`:
   - Calls `POST /sessions/{sessionId}/turns` with `{ clientTurnId, input: { text }, metadata }`.
3. `SessionRouter.submitTurn`:
   - Validates input length (<= 4000), shape, and rate limits.
   - Calls `TurnService.createOrGetTurn(sessionId, clientTurnId, input, metadata)`.
4. `TurnService`:
   - Creates a new `turnId` (or reuses existing for idempotent replay).
   - Stores the turn in `SessionStore`.
   - Builds a `TurnContext` from the persisted `Session` and `Turn` and passes it to `SenseiCoreAdapter.buildPrompt(context)`; all prompt construction for main teaching turns flows through this adapter rather than being inlined in controllers or streaming code.
5. Response:
   - BFF returns `{ turnId, streamUrl }` (e.g., `ws://host/sessions/{sessionId}/stream?turnId=...`).
6. RN streaming:
   - `BffClient.submitTurn` returns `{ messageId: "msg-" + turnId, stream }`, where `stream` is an async iterator over BFF WS events.
   - `runForwardStream` consumes the iterator:
     - `chunk` events → `BridgeManager.enqueue({ type: "chat:update", ... })`.
     - `status` events with `footer` → `BridgeManager.enqueue({ type: "footer:update", ... })`.
     - `wrapUp` events → `BridgeManager.enqueue({ type: "wrapup:show", ... })`.
7. WebView update:
   - Web bundle receives these messages via `initializeWebviewBridge` and updates DOM accordingly.

#### D.4.3 Mermaid Recovery Flow

1. WebView rendering code encounters a mermaid error and sends a `WebToRNMessage` of type `mermaid:error`.
2. RN handler calls:
   - `BffClient.recoverMermaid({ messageId, code, theme, errorHash, context })`, which calls `POST /mermaid/recover`.
3. `MermaidController.recover`:
   - Validates payload.
   - Calls `MermaidService.recoverDiagram(payload)`.
4. `MermaidService`:
   - Delegates to `GeminiGateway.recoverMermaidDiagram`.
   - Returns `{ fixed, fixedCode? }`.
5. RN forwards result back to WebView (either via direct WebView injection or as part of a higher‑level flow), where UI re‑renders diagrams or falls back to raw fences.

#### D.4.4 Wrap‑Up Flow

1. After a teaching sequence, `StreamingService` (or Core in later phases) decides to trigger a wrap‑up.
2. `WrapUpService.maybeGenerateWrapUp(turnContext)` is invoked and returns a `WrapUpAssessmentOverlayData` payload.
3. `StreamingService` emits:
  - `{ type: "wrapUp", payload }` over the WS.
4. RN’s `BffClient` maps this to:
  - `bridge.enqueue({ type: "wrapup:show", data: payload })`.
5. WebView’s `wrapUpAssessment.ts` renders the overlay and manages learner interaction; BFF remains stateless for the wrap‑up answers in Phase 1.

### D.5 Security, Performance, and Extensibility Considerations

Phase 1 is intentionally scoped, but the high‑level design needs to accommodate future growth:

- **Security**
  - No secrets in mobile or web bundles; only the BFF and upstream servers know Gemini credentials.
  - Input validation at the boundary prevents malformed payloads from propagating into Core or LLM prompts.
  - ErrorMapper ensures internal errors are not leaked as raw stack traces; only high‑level codes and messages are returned.

- **Performance**
  - LLM streaming is handled via async iterators, allowing efficient backpressure between BFF and WS clients.
  - Keepalive and timeout policies prevent stuck connections.
  - SessionStore and RateLimiter are simple maps in Phase 1 but can be replaced by external stores (Redis, etc.) without changing controllers.

- **Extensibility**
  - SenseiCoreAdapter is deliberately introduced as an indirection layer:
    - In Phase 1, it may simply build prompts mirroring current web logic.
    - In Phase 2, it will call into extracted Sensei Core modules for curriculum state, learner model updates, and wrap‑up generation, based on code currently residing in `src/curriculum.ts`, `src/adaptiveEngine.ts`, `src/pedagogicalProfiler.ts`, `src/interactionHelpers.ts`, and `src/geminiService.ts`.
  - GeminiGateway is abstracted so:
    - Model names and configuration are centralized.
    - Future providers or hybrid configs can be hidden behind the same interface.

### D.6 Source‑Level Mapping (Phase 1 Crosswalk)

To ensure the Phase 1 BFF design is grounded in the existing codebase, this subsection maps major design components to the current files that inform or depend on them. This crosswalk helps implementers verify that behavior stays aligned with the web app, mobile shell, and existing contracts.

**Client‑Side Mobile Components**
- `SenseiMobile/App.tsx`
  - Creates `BridgeManager`, `BffClient`, `SaveLoadService`, and `TelemetryManager`.
  - Configures `BffClient` with `BFF_BASE_URL` (currently `http://localhost:8787`) and passes it into `MainScreen`.
  - Expects the BFF to expose `/sessions`, `/sessions/{id}/turns`, `/telemetry`, and a `streamUrl` compatible with `react-native-webview`.
- `SenseiMobile/src/mobile/MainScreen.tsx`
  - Uses `runForwardStream` to consume `TurnStreamHandle.stream` produced by `BffClient`.
  - On `StreamStatus` events, forwards `footer:update` to the WebView and records telemetry events (`stream_status`, `stream_completed`, `stream_error`).
  - On `WebToRNMessage` events from the WebView (`footer:update`, `selection`, `saveload:*`, `telemetry:event`, `header:status`), updates local RN state and forwards as needed to BFF‑backed services (e.g., `SaveLoadService`, `TelemetryManager`).
- `SenseiMobile/src/mobile/network/BffClient.ts`
  - Defines the client’s expectations of the BFF:
    - `POST /sessions` returns `{ sessionId }`.
    - `POST /sessions/{sessionId}/turns` returns `{ turnId, streamUrl }`.
    - `POST /mermaid/recover` returns `{ fixed, fixedCode? }`.
  - Interprets WS messages from `streamUrl` as JSON with `type` in `{ "chunk", "status", "wrapUp", "error" }`.
  - On `wrapUp` ws messages, forwards `{ type: 'wrapup:show', data: payload }` into the RN↔WebView bridge.
- `SenseiMobile/src/mobile/bridge/contracts.ts`
  - Defines `WebToRNMessage` and `FooterPayload` used by RN to interpret messages from the WebView.
  - BFF does not emit these directly, but must ensure its WS payloads are compatible with the transformations that `BffClient` and `BridgeManager` apply before messages reach the WebView.
- `SenseiMobile/src/mobile/SelectionOverlay.tsx`
  - Emits `selectionSensei:invoke` messages through the bridge; BFF may later use selection context (e.g., via `/turns` metadata), so the Phase 1 design keeps a slot for this without requiring it on day one.
- `SenseiMobile/src/mobile/saveLoad/SaveLoadService.ts` + `nativeFileAdapter.ts`
  - Handle local save/export and import flows; BFF is intentionally not involved in persistence for Phase 1, in line with the Functional Spec.
- `SenseiMobile/src/mobile/telemetry/TelemetryManager.ts`
  - Sends telemetry events to the BFF’s `/telemetry` endpoint, obeying the opt‑out toggle and batching semantics; the BFF’s `TelemetryService` must accept this shape.

**Web Bundle and Bridge Components**
- `src/index.tsx`
  - Initializes the web UI, curriculum loading, and Gemini client for **web** usage.
  - Registers `initializeWebviewBridge(handleReactNativeMessage)` to receive RN→WebView bridge messages, including:
    - `chat:startMessage`, `chat:update`, `chat:completeMessage`.
    - `wrapup:show` (used to call `showWrapUpAssessmentOverlay`).
    - `footer:update` (used to call `updateFooter` with a `FooterPayload`).
  - In the **mobile path**, LLM calls inside `index.tsx` (e.g., `initializeGoogleAI`, `streamMainSenseiResponse`) should gradually be bypassed or disabled in favor of BFF‑mediated calls; Section C explicitly calls out ensuring the mobile WebView does not use in‑bundle LLM keys.
- `src/mobile/webviewBridge.ts` + `src/mobile/bridge/contracts.ts`
  - Define and implement the WebView side of the RN bridge:
    - `RNToWebMessage` includes `wrapup:show` with `WrapUpAssessmentOverlayData` imported from `src/wrapUpAssessment.ts`.
    - `WebToRNMessage` includes `mermaid:error`, `selection`, `selection:clear`, `footer:update`, etc.
  - These types inform the shape BFF’s WS payloads must conform to via RN’s `BffClient` and `BridgeManager`.
- `src/ui.ts`
  - Implements `updateMessageStream`, which is called during streaming to update the DOM with LLM text.
  - The BFF design ensures WS `chunk` frames deliver text in a way that `updateMessageStream` can process without additional translation.
- `src/geminiService.ts`
  - Contains current browser‑side prompt construction and Gemini calls for:
    - Teaching plan generation (`llmExtractAndPlanTeachingOrder`).
    - Comprehensive learner analysis.
    - Wrap‑up assessment generation (`generateWrapUpAssessment`).
  - The Phase 1 design uses this file as a **reference** for how `GeminiGateway` and `SenseiCoreAdapter` should be structured in the server context, even if not all functionality is migrated immediately.
- `src/curriculum.ts`, `src/adaptiveEngine.ts`, `src/pedagogicalProfiler.ts`, `src/interactionHelpers.ts`
  - Implement curriculum parsing and state (`parseModulesTxt`, `advanceCurriculumState`), learner model updates, pedagogical profiling, and streaming helpers.
  - These are the primary candidates for Sensei Core extraction in Phase 2, and the design of `SenseiCoreAdapter` in Phase 1 anticipates their future move.
- `src/mermaidErrorRecovery.ts`
  - Provides the current client‑side mermaid recovery logic (rule‑based fixes + LLM‑based recovery).
  - The Phase 1 BFF’s `MermaidService` and `GeminiGateway.recoverMermaidDiagram` should converge toward this behavior, including:
    - Fixing invalid `direction TD` inside subgraphs.
    - Removing backticks, semicolons, and illegal comment forms.
    - Using a structured JSON response for fixes (as in `MermaidFixResponse`).
- `src/wrapUpAssessment.ts`
  - Defines `WrapUpAssessmentOverlayData` used by the web overlay and performs client‑side validation of wrap‑up questions.
  - The BFF’s `WrapUpService` validates and shapes outgoing wrap‑up payloads to match this structure.

**Specs and Contracts**
- `docs/functional_spec/recursive_sensei_mobile_phase1_functional_spec.md`
  - Provides product‑level requirements for:
    - Input limits, rate limiting, streaming lifecycle, buffered mode, error semantics, telemetry, and QA criteria.
  - Directly informs `RateLimiter`, `StreamingService`, and `ErrorMapper` behavior.
- `docs/engineering/mobile_phase1_engineering_spec.md`
  - Describes the Phase 1 mobile architecture and the role of Sensei Core; Section 2 (Components, Data flow) and Section 5 (RN ↔ WebView Bridge) are particularly relevant to BFF.
- `docs/engineering/contracts_v1.md`
  - Defines the canonical REST, WS, RN↔WebView, save‑file, and telemetry schemas.
  - Serves as the primary source of truth for the BFF’s schemas and `SessionService`, `TurnService`, `MermaidService`, and `TelemetryService` contracts.

This mapping confirms that Section D’s architectural components are grounded in the existing implementation and specifications. The design deliberately avoids redefining client behavior; instead, it positions the BFF as the glue between these existing modules and the new server‑side responsibilities.

With this high‑level design and crosswalk in place, the implementation team can proceed to build the Phase 1 BFF systematically, ensuring that every major source file and spec relevant to Phase 1 is accounted for. Section E will now drill down into low‑level designs: concrete interfaces, types, and pseudo‑code for the most critical paths.

## E. Low‑Level Design for Phase 1 BFF

This section translates the high‑level architecture into **concrete interfaces, data shapes, and pseudo‑code** that can be implemented directly. Because low‑level design errors propagate into code, this section:
- Stays tightly aligned with existing source (web app, mobile shell, current BFF stub).
- Uses Typescript‑style types as the normative description of JSON payloads and internal structures, even if the initial implementation in `bff/` is JavaScript.
- Avoids guessing about external SDK details; where Gemini APIs may evolve, the design focuses on the BFF’s **own** interfaces and the invariants they must uphold.

The goal is that an engineer can read Section E alone and implement a correct, interoperable Phase 1 BFF without needing to reverse‑engineer the rest of the system.

### E.1 Module and File Layout (Phase 1 Target)

For clarity, this layout is described in terms of a `bff/src` directory, but it can be adapted to plain JS modules if desired. The core idea is modular separation between transport, domain, and integration.

```text
bff/
  index.js                  # entrypoint; imports and starts server.ts
  src/
    server.ts               # HTTP + WS server bootstrap
    routes/
      sessions.ts           # /sessions and /sessions/:sessionId/turns
      mermaid.ts            # /mermaid/recover
      telemetry.ts          # /telemetry
    stream/
      streamServer.ts       # WebSocket server for /sessions/{id}/stream
      streamController.ts   # high-level WS orchestration per connection
    services/
      SessionService.ts
      TurnService.ts
      StreamingService.ts
      MermaidService.ts
      WrapUpService.ts
      TelemetryService.ts
    infra/
      SessionStore.ts
      RateLimiter.ts
      ErrorMapper.ts
      Logger.ts
    integration/
      GeminiGateway.ts
      SenseiCoreAdapter.ts  # Phase 1 façade over existing web logic
    contracts/
      apiSchemas.ts         # zod schemas derived from docs/engineering/contracts_v1.md
      types.ts              # shared TS interfaces for Session, Turn, etc.
```

This structure mirrors Section D but adds explicit file names to guide implementation. It is intentionally minimal for Phase 1 and supports later evolution:
- In Phase 1, `SenseiCoreAdapter` can be a thin prompt‑builder façade over existing browser logic.
- In Phase 2+, `SenseiCoreAdapter` can call into an extracted Sensei Core package without changing `routes/` or `services/` APIs.

### E.2 Core Type Definitions

This subsection formalizes the core data structures used within the BFF. These types are **internal** but must be consistent with:
- Client contracts (`SenseiMobile/src/mobile/network/types.ts`, `SenseiMobile/src/mobile/bridge/contracts.ts`).
- Contracts v1 (`docs/engineering/contracts_v1.md`).
- Functional Spec limits and semantics.

```ts
// contracts/types.ts

// Session and Turn
export interface Session {
  id: string;
  topicId: string;
  createdAt: number;
  metadata: {
    source?: 'mobile' | 'web';
    appVersion?: string;
    // Future fields (deviceId, locale, etc.) may be added as optional.
    [key: string]: unknown;
  };
}

export interface TurnInput {
  text: string;
}

export interface SelectionSenseiMetadata {
  actionId?: string;
  selectedText?: string;
  // Additional future fields as needed
  [key: string]: unknown;
}

export interface TurnMetadata {
  source?: 'mobile' | 'web';
  appVersion?: string;
  selectionSensei?: SelectionSenseiMetadata;
  [key: string]: unknown;
}

export interface Turn {
  id: string;
  sessionId: string;
  clientTurnId: string;
  input: TurnInput;
  metadata: TurnMetadata;
  createdAt: number;
}

// Internal enum for WS status phases; matches StreamStatus in mobile client
export type StreamPhase = 'started' | 'keepalive' | 'completed';

export interface FooterPayload {
  // Contracts v1: enumerated values for each field
  confidence: 'Low' | 'Medium' | 'High' | 'Uncertain';
  confusion: 'Low' | 'Medium' | 'High' | 'Uncertain';
  intent:
    | 'AskingQuestion'
    | 'AnsweringQuestion'
    | 'ExpressingConfusion'
    | 'ExpressingUnderstanding'
    | 'ProvidingFeedback'
    | 'SeekingReassurance'
    | 'RequestingCurriculumStart'
    | 'Other'
    | 'Uncertain';
}

// Optional KC progress payload
export interface KcProgressPayload {
  currentChunkIndex: number;
  totalChunks: number;
}

// WS messages (sent by BFF)
export interface WsStatusMessage {
  type: 'status';
  phase: StreamPhase;
  footer?: FooterPayload;
  kcProgress?: KcProgressPayload;
}

export interface WsChunkMessage {
  type: 'chunk';
  text: string;
  // messageId is optional in Contracts v1; mobile client does not require it today
  messageId?: string;
}

export interface WsWrapUpMessage {
  type: 'wrapUp';
  payload: WrapUpAssessmentOverlayData;
}

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'RATE_LIMITED'
  | 'DOWNSTREAM_UNAVAILABLE'
  | 'TURN_TIMEOUT';

export interface WsErrorMessage {
  type: 'error';
  code: ErrorCode;
  message: string;
}

export type WsServerMessage =
  | WsStatusMessage
  | WsChunkMessage
  | WsWrapUpMessage
  | WsErrorMessage;

// HTTP error body
export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
}

// Mermaid recovery
export interface MermaidRecoveryPayload {
  messageId: string;
  code: string;
  theme?: string;
  errorHash?: string;
  context?: Record<string, unknown>;
}

export interface MermaidRecoveryResult {
  fixed: boolean;
  fixedCode?: string;
}

// WrapUp assessment
// Shape mirrors src/wrapUpAssessment.ts + RN bridge contracts
export interface WrapUpAssessmentQuestion {
  id: string;
  type: 'snippet' | 'concept';
  prompt: string;
  code?: string;
  choices: string[];
  correct_choice: string;
  explanation: string;
  interviewer_insight: string;
}

export interface WrapUpAssessmentOverlayData {
  moduleTitle: string;
  moduleGoal?: string;
  conceptSummaries?: string[];
  questions: WrapUpAssessmentQuestion[];
}

// Telemetry
export interface TelemetryEvent {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface TelemetryEnvelope {
  events: TelemetryEvent[];
}
```

These types are distilled from:
- `SenseiMobile/src/mobile/network/types.ts` (for streaming shapes).
- `SenseiMobile/src/mobile/bridge/contracts.ts` and `src/mobile/bridge/contracts.ts` (for `FooterPayload` and `WrapUpAssessmentOverlayData`).
- `docs/engineering/contracts_v1.md` (for REST/WS/telemetry contracts).

### E.3 HTTP Route Handlers — Detailed Behavior

This subsection defines the low‑level behavior of each HTTP endpoint in terms of:
- Expected request shape (JSON).
- Validation and error handling.
- Side effects on `SessionStore`.
- Response shape.

#### E.3.1 `POST /sessions`

**Request:**

```json
{
  "topicId": "c++_recursive_mastery",
  "metadata": {
    "source": "mobile",
    "appVersion": "1.0.0"
  }
}
```

Fields:
- `topicId` (required, string): For Phase 1 mobile, `"c++_recursive_mastery"` selects the existing recursion curriculum.
- `metadata` (optional, object): May include `source`, `appVersion`, etc.

**Handler pseudo‑code:**

```ts
async function createSessionHandler(req: Request, res: Response) {
  // 1. Validate body using zod schema
  const parseResult = SessionCreateSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errBody: ApiErrorBody = {
      code: 'BAD_REQUEST',
      message: 'Invalid session payload'
    };
    return res.status(400).json(errBody);
  }

  const { topicId, metadata } = parseResult.data;

  // 2. Build metadata from headers + body
  const meta: Session['metadata'] = {
    ...metadata,
    source: (metadata?.source as any) ?? 'mobile',
    appVersion: (metadata?.appVersion as any) ?? req.header('X-App-Version') ?? undefined
  };

  // 3. Create session via SessionService
  const session = SessionService.createSession(topicId, meta);

  // 4. Respond
  return res.status(200).json({ sessionId: session.id });
}
```

**Notes:**
- No rate limiting on `/sessions` in Phase 1.
- Topic validation is performed inside the BFF process, not via a self‑HTTP call. `SessionService.createSession` consults a server‑owned topic registry (for Phase 1, an in‑memory set containing `"c++_recursive_mastery"`); unknown topics result in a 400 BAD_REQUEST from this handler with an `ApiErrorBody` such as `{ code: 'BAD_REQUEST', message: 'Unknown topicId' }`.
- For future phases, this handler may also return a `stateBootstrap` field, but Phase 1 mobile does not depend on it.

#### E.3.2 `POST /sessions/:sessionId/turns`

**Request:**

```json
{
  "clientTurnId": "turn-1731612345678",
  "input": {
    "text": "User message..."
  },
  "metadata": {
    "source": "mobile",
    "appVersion": "1.0.0",
    "selectionSensei": {
      "actionId": "explainSimpler",
      "selectedText": "some code snippet"
    }
  }
}
```

Fields:
- `clientTurnId` (required, string) — idempotency key.
- `input.text` (required, string) — user input, non‑empty, max 4000 characters.
- `metadata` (optional object) — as defined above.

**Handler pseudo‑code:**

```ts
async function submitTurnHandler(req: Request, res: Response) {
  const { sessionId } = req.params;

  // 1. Validate session existence
  const session = SessionService.getSession(sessionId);
  if (!session) {
    const errBody: ApiErrorBody = {
      code: 'BAD_REQUEST',
      message: 'Unknown session'
    };
    return res.status(400).json(errBody);
  }

  // 2. Validate payload (shape & input length)
  const parseResult = TurnSubmitSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errBody: ApiErrorBody = {
      code: 'BAD_REQUEST',
      message: 'Invalid turn payload'
    };
    return res.status(400).json(errBody);
  }

  const { clientTurnId, input, metadata } = parseResult.data;

  if (input.text.trim().length === 0) {
    return res.status(400).json({
      code: 'BAD_REQUEST',
      message: 'Input text must not be empty'
    } satisfies ApiErrorBody);
  }

  if (input.text.length > 4000) {
    return res.status(413).json({
      code: 'BAD_REQUEST',
      message: 'Input too long; maximum is 4000 characters'
    } satisfies ApiErrorBody);
  }

  // 3. Rate limiting
  const ip = req.ip ?? req.connection.remoteAddress ?? 'unknown';
  const ua = req.header('User-Agent') ?? 'unknown';
  const now = Date.now();
  const rateCheck = RateLimiter.checkTurnAllowed(ip, ua, now);
  if (!rateCheck.allowed) {
    return res.status(429)
      .set('Retry-After', String(rateCheck.retryAfterSeconds ?? 60))
      .json({
        code: 'RATE_LIMITED',
        message: 'Too many turns; please wait before trying again.'
      } satisfies ApiErrorBody);
  }

  // 4. Idempotency & turn creation
  const turnResult = TurnService.createOrGetTurn(session, clientTurnId, input, metadata);
  const { turn, isReplay } = turnResult;

  // 5. Construct streamUrl based on server config
  const host = /* derive from config or req headers */;
  const streamUrl = `${host.replace(/^http/, 'ws')}/sessions/${encodeURIComponent(
    session.id
  )}/stream?turnId=${encodeURIComponent(turn.id)}`;

  // 6. Respond with stream info
  return res.status(200).json({ turnId: turn.id, streamUrl });
}
```

**Notes:**
- Idempotency:
  - If `isReplay` is true, the BFF should not enqueue duplicate work; any in‑flight stream can be reused or a new stream can be opened that replays already‑computed results.
- Rate limiting:
  - Implemented per IP/UA; details of windowing are encapsulated in `RateLimiter`.

#### E.3.3 `POST /mermaid/recover`

**Request:**

```json
{
  "messageId": "msg-123",
  "code": "graph TD; A-->B;",
  "theme": "dark",
  "errorHash": "hash-from-client",
  "context": {
    "source": "mobile",
    "appVersion": "1.0.0"
  }
}
```

**Handler pseudo‑code:**

```ts
async function mermaidRecoverHandler(req: Request, res: Response) {
  const parseResult = MermaidRecoverSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      code: 'BAD_REQUEST',
      message: 'Invalid mermaid recovery payload'
    } satisfies ApiErrorBody);
  }

  const payload = parseResult.data;

  try {
    const result = await MermaidService.recoverDiagram(payload);
    // result: { fixed: boolean; fixedCode?: string }
    return res.status(200).json(result);
  } catch (err) {
    const mapped = ErrorMapper.toHttpError(err);
    return res.status(mapped.status).json(mapped.body);
  }
}
```

**Notes:**
- Implementation details of `MermaidService` and `GeminiGateway` are covered in E.5, but the handler simply validates and delegates.

#### E.3.4 `POST /telemetry`

**Request:**

```json
{
  "events": [
    {
      "event": "turn_submitted",
      "data": { "textLength": 120, "platform": "ios" },
      "timestamp": "2025-11-12T04:00:00.000Z"
    }
  ]
}
```

**Handler pseudo‑code:**

```ts
async function telemetryHandler(req: Request, res: Response) {
  const parseResult = TelemetryEnvelopeSchema.safeParse(req.body);
  if (!parseResult.success) {
    // Per spec, telemetry errors are non-fatal; log and accept.
    Logger.warn('[BFF] telemetry (invalid)', { body: req.body });
    return res.status(204).end();
  }

  const envelope = parseResult.data;
  const context = {
    ip: req.ip ?? 'unknown',
    userAgent: req.header('User-Agent') ?? 'unknown'
  };

  try {
    await TelemetryService.ingest(envelope.events, context);
  } catch (err) {
    Logger.warn('[BFF] telemetry ingest error', { error: String(err) });
    // Still return 204; telemetry must not affect app behavior.
  }

  return res.status(204).end();
}
```

### E.4 WebSocket Streaming — Detailed Behavior

This subsection specifies the low‑level logic of `StreamingService` and the `StreamServer`.
It is critical that this behavior matches:
- The expectations of `SenseiMobile/src/mobile/network/BffClient.ts` (which parses WS `type` fields into `StreamChunk`, `StreamStatus`, and `StreamError`).
- The semantics described in the Functional Spec and Contracts v1 (keepalives, buffered mode, timeouts, error codes).

#### E.4.1 WebSocket Connection Handling

**Initialization:**

```ts
function attachWebSocketServer(httpServer: http.Server) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws, req) => {
    // Expected path: /sessions/<sessionId>/stream?turnId=...
    const url = new URL(req.url ?? '', 'http://localhost'); // host placeholder
    const segments = url.pathname.split('/').filter(Boolean); // ['', 'sessions', '{sessionId}', 'stream'] -> ['sessions','{sessionId}','stream']
    const sessionId = segments[1];
    const turnId = url.searchParams.get('turnId') ?? '';

    StreamController.handleConnection(sessionId, turnId, ws);
  });
}
```

**StreamController.handleConnection:**

```ts
async function handleConnection(ws: WebSocket, sessionId: string, turnId: string) {
  const session = SessionService.getSession(sessionId);
  const turn = TurnService.getTurn(turnId);

  if (!session || !turn) {
    const errMsg: WsErrorMessage = {
      type: 'error',
      code: 'BAD_REQUEST',
      message: 'Unknown session or turn'
    };
    ws.send(JSON.stringify(errMsg));
    ws.close();
    return;
  }

  const context: TurnContext = TurnService.prepareTurnContext(session, turn);

  // Initial status message
  const status: WsStatusMessage = {
    type: 'status',
    phase: 'started',
    footer: StreamingService.initialFooterFor(context)
  };
  ws.send(JSON.stringify(status));

  // Delegate streaming to StreamingService
  StreamingService.streamTurn(ws, context).catch(err => {
    // Fallback error handling if exception escapes StreamingService
    const mapped = ErrorMapper.toWsError(err);
    const errMsg: WsErrorMessage = { type: 'error', ...mapped };
    try {
      ws.send(JSON.stringify(errMsg));
    } finally {
      ws.close();
    }
  });
}
```

#### E.4.2 StreamingService.streamTurn

**Core responsibilities:**
- Construct the prompt via `SenseiCoreAdapter`.
- Start the Gemini stream via `GeminiGateway`.
- Emit `chunk`, `status`, and optional `wrapUp` messages.
- Implement keepalives and timeouts.

**Pseudo‑code:**

```ts
class StreamingService {
  static KEEPALIVE_MS = 15_000;
  static HARD_TIMEOUT_MS = 60_000;
  static STALL_TO_BUFFERED_MS = 25_000; // 15s keepalive + 10s grace

  static initialFooterFor(context: TurnContext): FooterPayload {
    // Phase 1: simple default; later phases will derive values from Core
    return {
      confidence: 'Medium',
      confusion: 'Low',
      intent: 'Other'
    };
  }

  static async streamTurn(ws: WebSocket, context: TurnContext): Promise<void> {
    const startTime = Date.now();
    let lastActivity = startTime;
    let bufferedMode = false;
    let bufferedText = ''; // Used only in buffered mode
    let keepaliveTimer: NodeJS.Timeout | null = null;
    let hardTimeout: NodeJS.Timeout | null = null;
    let stallTimer: NodeJS.Timeout | null = null;

    const cleanupTimers = () => {
      if (keepaliveTimer) clearInterval(keepaliveTimer);
      if (hardTimeout) clearTimeout(hardTimeout);
      if (stallTimer) clearTimeout(stallTimer);
    };

    // 1. Schedule keepalives (informational status frames)
    keepaliveTimer = setInterval(() => {
      const now = Date.now();
      if (now - lastActivity >= StreamingService.KEEPALIVE_MS) {
        const keepalive: WsStatusMessage = {
          type: 'status',
          phase: 'keepalive'
        };
        try {
          ws.send(JSON.stringify(keepalive));
        } catch {
          // Ignore; WS errors handled below
        }
        lastActivity = now;
      }
    }, StreamingService.KEEPALIVE_MS);

    // 2. Stall detection → buffered mode
    const scheduleStallTimer = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        // If no activity for STALL_TO_BUFFERED_MS, switch to buffered mode
        bufferedMode = true;
        // From this point onward, we stop sending incremental chunks and instead
        // buffer whatever text remains from the LLM stream, emitting it once at the end.
      }, StreamingService.STALL_TO_BUFFERED_MS);
    };
    scheduleStallTimer();

    // 3. Hard timeout
    hardTimeout = setTimeout(() => {
      const err: WsErrorMessage = {
        type: 'error',
        code: 'TURN_TIMEOUT',
        message: 'Turn processing exceeded time limit'
      };
      try {
        ws.send(JSON.stringify(err));
      } finally {
        ws.close();
      }
    }, StreamingService.HARD_TIMEOUT_MS);

    try {
      // 4. Build prompt and call GeminiGateway
      const prompt = await SenseiCoreAdapter.buildPrompt(context);
      const stream = GeminiGateway.streamMainResponse(prompt, { context });

      // 5. Consume stream
      for await (const chunk of stream) {
        if (typeof chunk.text !== 'string' || chunk.text.length === 0) continue;
        if (bufferedMode) {
          // Buffered mode: accumulate text only
          bufferedText += chunk.text;
        } else {
          const msg: WsChunkMessage = { type: 'chunk', text: chunk.text };
          try {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify(msg));
            } else {
              break;
            }
          } catch {
            break;
          }
        }
        lastActivity = Date.now();
        scheduleStallTimer();
      }

      // 6. If we entered buffered mode and accumulated text, send it as a single final chunk
      if (bufferedMode && bufferedText.length > 0 && ws.readyState === ws.OPEN) {
        const finalChunk: WsChunkMessage = { type: 'chunk', text: bufferedText };
        ws.send(JSON.stringify(finalChunk));
      }

      // 7. Optional wrap-up
      const wrapUpPayload = await WrapUpService.maybeGenerateWrapUp(context);
      if (wrapUpPayload) {
        const wrapMsg: WsWrapUpMessage = {
          type: 'wrapUp',
          payload: wrapUpPayload
        };
        ws.send(JSON.stringify(wrapMsg));
      }

      // 8. Final status
      const footer = StreamingService.deriveFooterFromContext(context);
      const completed: WsStatusMessage = {
        type: 'status',
        phase: 'completed',
        footer
      };
      ws.send(JSON.stringify(completed));
    } catch (err) {
      const mapped = ErrorMapper.toWsError(err);
      const errMsg: WsErrorMessage = { type: 'error', ...mapped };
      ws.send(JSON.stringify(errMsg));
    } finally {
      cleanupTimers();
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
  }

  static deriveFooterFromContext(context: TurnContext): FooterPayload {
    // Phase 1: static or simple heuristic; later phases will map from learner model (adaptiveEngine.ts)
    return {
      confidence: 'Medium',
      confusion: 'Low',
      intent: 'Other'
    };
  }
}
```

**Buffered mode semantics:**
- Buffered mode is an implementation of the Functional Spec’s requirement:
  - After 25 seconds without activity, the server should stop sending incremental chunks and, when the LLM finishes, deliver the complete response in a single payload on the same WS.
- In the design above:
  - Before `STALL_TO_BUFFERED_MS`, users see incremental `chunk` updates.
  - After `STALL_TO_BUFFERED_MS`, `bufferedMode` is set to true and the server aggregates remaining text into `bufferedText`.
  - Once the LLM stream finishes, the server sends a final `chunk` frame containing `bufferedText`.
  - RN’s `runForwardStream` and the WebView treat this just like a single large chunk; the UI’s “Sensei is typing…” indicator persists until this final frame arrives, matching the Functional Spec.

**BffClient interaction note:**
- `SenseiMobile/src/mobile/network/BffClient.ts` injects an initial `StreamStatus` with `phase: "started"` when the WS connection opens, *before* the BFF’s own `status:started` frame arrives.
  - This means `runForwardStream` sees two `status:started` events; it only uses `footer` fields when present, so this duplication is harmless but should be noted.
  - The BFF should still send its own `status:started` frame so that non‑mobile clients (or future BffClient variants) can rely on server‑side status frames alone.

### E.5 Integration with Gemini (GeminiGateway)

Because Gemini’s official Node SDK may evolve, `GeminiGateway` is explicitly an **internal** abstraction. The important part is its interface and error behavior, not the exact SDK calls.

**Interface:**

```ts
// integration/GeminiGateway.ts

export interface StreamChunk {
  text: string;
}

export interface StreamOptions {
  context: TurnContext;
}

export interface IGeminiGateway {
  streamMainResponse(prompt: string, options: StreamOptions): AsyncIterable<StreamChunk>;
  recoverMermaidDiagram(payload: MermaidRecoveryPayload): Promise<MermaidRecoveryResult>;
}
```

**Behavioral expectations:**
- `streamMainResponse`:
  - Must respect a configurable timeout; if the underlying SDK cannot enforce this, BFF must implement a wrapper that cancels the stream after `HARD_TIMEOUT_MS`.
  - Must yield chunks in order.
  - Must not throw for normal stream completion; errors should only represent genuine failures.
- `recoverMermaidDiagram`:
  - Constructs an LLM prompt similar to `MERMAID_FIX_PROMPT_TEMPLATE` in `src/mermaidErrorRecovery.ts`.
  - Attempts to parse the LLM response as JSON in the shape `{ fixed: boolean, diagram?: string, explanation?: string }`.
  - Returns `{ fixed: false }` if:
    - The LLM response is unparsable, or
    - The LLM indicates no deterministic fix.

**Example pseudo‑implementation for streaming:**

```ts
class GeminiGatewayImpl implements IGeminiGateway {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async *streamMainResponse(prompt: string, options: StreamOptions): AsyncIterable<StreamChunk> {
    // Pseudo-code only; exact SDK calls (chat vs models) depend on @google/genai API surface.
    const chat = this.ai.chats.create({
      model: ModelUsage.MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG.modelName,
      config: ModelUsage.MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG.config,
      history: []
    });

    const stream = await chat.sendMessageStream({ message: prompt });
    for await (const part of stream) {
      const text = part.text;
      if (typeof text === 'string' && text.length > 0) {
        yield { text };
      }
    }
  }

  async recoverMermaidDiagram(payload: MermaidRecoveryPayload): Promise<MermaidRecoveryResult> {
    // High-level behavior aligned with src/mermaidErrorRecovery.ts
    const { code, errorHash } = payload;
    const prompt = MERMAID_FIX_PROMPT_TEMPLATE(code, errorHash ?? '');
    // Use generateContent with JSON response config and parse as in mermaidErrorRecovery.ts
    // Return { fixed, fixedCode } based on parsed output.
    // On failure, log and return { fixed: false }.
    return { fixed: false };
  }
}
```

The above is **illustrative**, not normative about exact SDK calls; what matters is that:
- `streamMainResponse` yields text chunks suitable for `WsChunkMessage`.
- `recoverMermaidDiagram` returns a `MermaidRecoveryResult` consistent with `/mermaid/recover` expectations.

#### E.5.1 SenseiCoreAdapter Interface

`SenseiCoreAdapter` is the BFF’s abstraction over Sensei’s pedagogical and curriculum logic. In Phase 1, it may primarily be a **prompt builder façade** that mirrors the existing browser behavior; in Phase 2 it will call into extracted Core modules.

**Interface:**

```ts
// integration/SenseiCoreAdapter.ts

export interface TurnContext {
  session: Session;
  turn: Turn;
  // Optional fields that become more important once Core is extracted
  curriculumRef?: { moduleId: string; phase: string; conceptId?: string };
  learnerModelSnapshot?: unknown;
}

export interface ISenseiCoreAdapter {
  buildPrompt(context: TurnContext): Promise<string>;
  // Future hooks (Phase 2+):
  // updateLearnerModel(context: TurnContext, analysis: ComprehensiveAnalysisResultType): Promise<void>;
  // maybeGenerateWrapUp(context: TurnContext): Promise<WrapUpAssessmentOverlayData | null>;
}
```

**Phase 1 behavior:**
- `buildPrompt`:
  - Uses information from `TurnContext` to approximate the prompts currently built in the browser:
    - `buildSenseiDynamicSystemInstruction`, `buildSocraticExecutionInstruction`, and related helpers from `src/interactionHelpers.ts` and `src/prompts.ts`.
  - Curriculum and phase hints if `curriculumRef` is present (e.g., `"IntroIllustrate"`, `"Socratic"`, `"Solidify"`). In Phase 1 this field may be `undefined` or minimal; it is the single place where module/phase/concept information will flow into server-side logic once Core is extracted.
  - Selection Sensei metadata from `turn.metadata.selectionSensei`, if present, to bias prompts for selection‑triggered actions.
  - Does **not** attempt to fully replicate the detailed Core behavior (e.g., teaching plan generation); that is deferred to Phase 2, but:
    - Prompt structure should be compatible with Core extraction, so that future changes can be tested for parity using golden inputs.
  - All main teaching turns in the BFF must obtain their LLM prompt by calling `SenseiCoreAdapter.buildPrompt(context)`; controllers and streaming code should not construct prompts directly or call Gemini with handcrafted strings. This ensures that swapping in real Sensei Core in Phase 2 only requires changing the adapter implementation.

**Non‑goals for Phase 1:**
- Maintaining a persistent server‑side learner model or curriculum state is **not required** for Phase 1 BFF correctness, since the web bundle still owns most of that logic.
- However, `TurnContext` is structured so that such state can be added in later phases without changing the BFF’s external API.

### E.6 SessionStore and RateLimiter Details

**SessionStore:**

```ts
// infra/SessionStore.ts (Phase 1 in-memory implementation; interface is async for future Redis/DB support)

interface IdempotencyKey {
  clientTurnId: string;
  turnId: string;
  createdAt: number;
}

interface SessionStoreInterface {
  createSession(topicId: string, metadata: Session['metadata']): Promise<Session>;
  getSession(id: string): Promise<Session | undefined>;
  createOrGetTurn(session: Session, clientTurnId: string, input: TurnInput, metadata: TurnMetadata): Promise<{ turn: Turn; isReplay: boolean }>;
  getTurn(id: string): Promise<Turn | undefined>;
  pruneIdempotency(retentionMs: number): Promise<void>;
}

class SessionStore implements SessionStoreInterface {
  private sessions = new Map<string, Session>();
  private turns = new Map<string, Turn>();
  private sessionIdempotency = new Map<string, Map<string, IdempotencyKey>>();

  async createSession(topicId: string, metadata: Session['metadata']): Promise<Session> {
    const topic = TopicRegistry.getTopic(topicId);
    if (!topic) {
      throw new UnknownTopicError(topicId);
    }
    const id = `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    const session: Session = { id, topicId, createdAt: Date.now(), metadata };
    this.sessions.set(id, session);
    return session;
  }

  async getSession(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async createOrGetTurn(
    session: Session,
    clientTurnId: string,
    input: TurnInput,
    metadata: TurnMetadata
  ): Promise<{ turn: Turn; isReplay: boolean }> {
    const sessionMap = this.sessionIdempotency.get(session.id) ?? new Map<string, IdempotencyKey>();
    this.sessionIdempotency.set(session.id, sessionMap);

    const existing = sessionMap.get(clientTurnId);
    if (existing) {
      const existingTurn = this.turns.get(existing.turnId);
      if (existingTurn) {
        return { turn: existingTurn, isReplay: true };
      }
      // If mapping exists but turn was pruned, fall through to new creation
    }

    const turnId = `turn_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    const turn: Turn = {
      id: turnId,
      sessionId: session.id,
      clientTurnId,
      input,
      metadata,
      createdAt: Date.now()
    };
    this.turns.set(turnId, turn);
    sessionMap.set(clientTurnId, { clientTurnId, turnId, createdAt: Date.now() });
    return { turn, isReplay: false };
  }

  async getTurn(id: string): Promise<Turn | undefined> {
    return this.turns.get(id);
  }

  // Optional: clean up idempotency keys older than retention window
  async pruneIdempotency(retentionMs: number): Promise<void> {
    const cutoff = Date.now() - retentionMs;
    for (const [sessionId, map] of this.sessionIdempotency.entries()) {
      for (const [key, entry] of map.entries()) {
        if (entry.createdAt < cutoff) {
          map.delete(key);
        }
      }
      if (map.size === 0) {
        this.sessionIdempotency.delete(sessionId);
      }
    }
  }
}
```

### E.7 TopicRegistry and `config/topics.json`

The BFF owns the registry of valid topics. This registry is backed by a JSON configuration file and accessed through a small abstraction so that topic definitions can evolve without changing endpoint contracts.

```ts
// infra/TopicRegistry.ts

export interface TopicConfig {
  id: string;
  displayName: string;
  modulesPath?: string;
}

export interface TopicRegistry {
  getTopic(id: string): TopicConfig | undefined;
  listTopics(): TopicConfig[];
}

export function loadTopicRegistryFromFile(path: string): TopicRegistry {
  // Implementation detail: read config/topics.json at startup, validate, and keep results in memory.
}
```

For Phase 1:
- Topics are defined in `config/topics.json` as an array of objects:

```json
[
  {
    "id": "c++_recursive_mastery",
    "displayName": "C++ Recursive Mastery",
    "modulesPath": "Modules.txt"
  }
]
```

- `SessionService.createSession` uses `TopicRegistry.getTopic(topicId)` to validate `topicId`:
  - If a topic is found, the session is created with that `topicId`.
  - If not, the handler returns `400 BAD_REQUEST` with an `ApiErrorBody` such as `{ code: "BAD_REQUEST", message: "Unknown topicId" }`.
- `/sessions/{id}/turns` and the streaming layer rely on the stored `session.topicId` and do not re‑validate it, so adding new topics in `config/topics.json` is backward compatible as long as existing topic IDs remain present.

**Idempotency retention notes:**
- Contracts v1 specifies that idempotency records **must** be retained for at least 10 minutes (and SHOULD be retained for 60 minutes), after which replays may return 409.
- The Phase 1 `SessionStore` design:
  - Exposes `pruneIdempotency(retentionMs)` so a periodic job can prune keys older than the chosen retention.
  - For simplicity, Phase 1 may treat replays outside the retention window as new turns (i.e., no 409 implementation yet), but:
    - The type and method signatures are prepared to support proper 409 behavior in later phases.
    - If 409 is needed in Phase 1, `TurnService.createOrGetTurn` can be updated to detect “expired but repeated” `clientTurnId` and throw a specific error that `ErrorMapper` maps to a 409 response.

**RateLimiter:**

```ts
// infra/RateLimiter.ts

interface RateBucketKey {
  ip: string;
  ua: string;
}

interface RateBucket {
  timestamps: number[]; // epoch millis of /turns calls
}

class RateLimiter {
  private buckets = new Map<string, RateBucket>();
  private WINDOW_MS = 60_000;
  private MAX_TURNS = 3;

  checkTurnAllowed(ip: string, ua: string, now: number): { allowed: boolean; retryAfterSeconds?: number } {
    const key = `${ip}|${ua}`;
    const bucket = this.buckets.get(key) ?? { timestamps: [] };
    this.buckets.set(key, bucket);

    // Prune old timestamps
    bucket.timestamps = bucket.timestamps.filter(t => now - t <= this.WINDOW_MS);

    if (bucket.timestamps.length >= this.MAX_TURNS) {
      const oldest = bucket.timestamps[0];
      const retryAfterMs = this.WINDOW_MS - (now - oldest);
      return { allowed: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
    }

    bucket.timestamps.push(now);
    return { allowed: true };
  }
}
```

This simple in‑memory limiter is sufficient for Phase 1; Phase 2+ can swap in a distributed implementation without changing the controller APIs.

### E.7 ErrorMapper Details

**ErrorMapper** standardizes error handling across REST and WS:

```ts
// infra/ErrorMapper.ts

class BadRequestError extends Error {}
class RateLimitedError extends Error {
  constructor(public retryAfterSeconds: number) { super('Rate limited'); }
}
class DownstreamUnavailableError extends Error {}
class TurnTimeoutError extends Error {}

class ErrorMapper {
  static toHttpError(err: unknown): { status: number; body: ApiErrorBody } {
    if (err instanceof BadRequestError) {
      return { status: 400, body: { code: 'BAD_REQUEST', message: err.message } };
    }
    if (err instanceof RateLimitedError) {
      return { status: 429, body: { code: 'RATE_LIMITED', message: err.message } };
    }
    if (err instanceof TurnTimeoutError) {
      return { status: 504, body: { code: 'TURN_TIMEOUT', message: err.message } };
    }
    if (err instanceof DownstreamUnavailableError) {
      return { status: 503, body: { code: 'DOWNSTREAM_UNAVAILABLE', message: err.message } };
    }
    // Fallback
    return { status: 500, body: { code: 'DOWNSTREAM_UNAVAILABLE', message: 'Unexpected server error' } };
  }

  static toWsError(err: unknown): { code: ErrorCode; message: string } {
    if (err instanceof BadRequestError) {
      return { code: 'BAD_REQUEST', message: err.message };
    }
    if (err instanceof RateLimitedError) {
      return { code: 'RATE_LIMITED', message: err.message };
    }
    if (err instanceof TurnTimeoutError) {
      return { code: 'TURN_TIMEOUT', message: err.message };
    }
    if (err instanceof DownstreamUnavailableError) {
      return { code: 'DOWNSTREAM_UNAVAILABLE', message: err.message };
    }
    return { code: 'DOWNSTREAM_UNAVAILABLE', message: 'Unexpected server error' };
  }
}
```

### E.8 TelemetryService Details

**TelemetryService** is intentionally minimal in Phase 1 but must respect the Functional Spec (opt‑out, no PII, batching).

```ts
// services/TelemetryService.ts

interface TelemetryContext {
  ip: string;
  userAgent: string;
}

class TelemetryService {
  static async ingest(events: TelemetryEvent[], ctx: TelemetryContext): Promise<void> {
    // Phase 1: log counts and sample event names; do not store PII
    Logger.info('[BFF] telemetry', {
      count: events.length,
      sample: events.slice(0, 3).map(e => e.event),
      sourceIp: ctx.ip,
      userAgent: ctx.userAgent
    });
    // Future: send to telemetry backend
  }
}
```

---

This low‑level design specifies the BFF’s core types, handlers, and behaviors in enough detail that implementation can proceed without ambiguity, while staying grounded in the current web/mobile code and Contracts v1. Any changes to these interfaces should be reviewed carefully against this document and the specs to avoid the kind of drift that would make Phase 1 mobile integration brittle. Subsequent work (Phase 2 and 3) will build on these foundations by plugging in full Sensei Core extraction and scaling the infrastructure, but the fundamental API and streaming semantics described here are intended to remain stable. 

## F. Notes, Risks, and Appendix

Section F bridges the design and implementation by:
- Calling out risks and edge cases that are easy to overlook but costly to fix late.
- Highlighting performance and robustness considerations that will matter in real devices and networks.
- Providing migration notes for transitioning from the current stubbed/dev behavior to the Phase 1 BFF.
- Offering a short glossary for key terms so future contributors align on language.

This section is intended to be read both before and during implementation, and again when planning Phase 2/3 evolution.

### F.1 Key Risks and Mitigation Strategies

#### Risk 1: Drift Between Web and BFF Behavior

**Description**  
The existing web app still contains full Gemini integration (`src/index.tsx`, `src/geminiService.ts`, `src/mermaidErrorRecovery.ts`, `src/interactionHelpers.ts`). If the BFF’s prompts, wrap‑up behavior, or mermaid recovery diverge significantly, learners may see different behavior on web vs mobile, making parity and debugging difficult.

**Mitigation**
- Treat the web implementation as the **reference behavior** for Phase 1:
  - When implementing `SenseiCoreAdapter.buildPrompt`, start by porting the minimal set of prompt‑building logic from `interactionHelpers.ts` and `prompts.ts` that is required for main teaching responses.
  - For mermaid recovery, follow the rule‑based pre‑fixes in `src/mermaidErrorRecovery.ts` (e.g., TD→TB in subgraphs, backtick fixes) as a pre‑processing stage before calling Gemini from the BFF.
- Use **golden inputs** (from specs and existing logs) to compare BFF outputs against web outputs where feasible:
  - For example, select a few representative user turns and assert that prompts constructed by `SenseiCoreAdapter` are structurally equivalent to those in the web app, within the constraints of provider evolution.

#### Risk 2: Hidden Mobile/WebView LLM Calls

**Description**  
The web bundle currently initializes a `GoogleGenAI` instance and makes LLM calls directly. In the mobile WebView path, this must not happen—LLM calls must go through the BFF or the app will violate the “no secrets on device” requirement and have inconsistent behavior.

**Mitigation**
- Ensure the mobile WebView build path is configured so:
  - `API_KEY` is not set in the mobile environment, forcing any in‑bundle LLM initialization to fail fast.
  - `loadCurriculumAndGreet()` is refactored (when running in a WebView) to treat the BFF as the LLM source and not attempt to initialize its own `GoogleGenAI`.
- Add diagnostics:
  - A debug build mode that logs a warning whenever the web bundle detects it is running in a RN WebView (`window.ReactNativeWebView`) *and* sees a non‑null `ai` instance or direct Gemini SDK usage.

#### Risk 3: Streaming Robustness Under Real Network Conditions

**Description**  
The design assumes the WS connection can send keepalives and stream chunks smoothly. In practice, network instability, proxying, or mobile connection drops can create partial reads, delayed frames, or repeated resume attempts.

**Mitigation**
- Implement conservative error handling in `StreamingService`:
  - Always check `ws.readyState` before `send`.
  - Wrap WS sends in `try/catch` and treat errors as termination conditions for the stream.
- In `BffClient.createStream`, keep the existing error mapping (`DOWNSTREAM_UNAVAILABLE`, `PARSE_ERROR`) so RN can respond gracefully.
- Consider adding:
  - A simple reconnect strategy in RN (`reconnectIfNeeded` already exists on `BffClientLike`) for cases where session is valid but connection dropped before completion.
- Use TestFlight and local network shaping (e.g., poor network simulation) to validate streaming behavior under adverse conditions.

#### Risk 4: Overly Rigid Idempotency and Retention Behavior

**Description**  
Contracts v1 require idempotency for at least 10 minutes and allow 409 outside that window. Implementing too strict 409 behavior early could surprise clients or create confusing UX for intermittent connectivity.

**Mitigation**
- Phase 1:
  - Implement idempotency mapping but treat replays outside the retention window as new turns (no 409 yet).
  - Do not expose 409 in Phase 1; keep the external surface simple (400/413/429/503/504).
- Phase 2+:
  - Introduce a dedicated `IdempotencyExpiredError` mapped to 409 and coordinate a client UI that can surface “stale retry” semantics properly.

#### Risk 5: Over‑ or Under‑Validation of Wrap‑Up Payloads

**Description**  
Wrap‑up payloads are complex and subtle schema mismatches can yield confusing overlay behavior or JS errors in the WebView.

**Mitigation**
- Centralize validation:
  - Implement a BFF‑side validator in `WrapUpService` that mirrors the checks in `src/wrapUpAssessment.ts::validateWrapUpAssessmentQuestions`.
  - Include unit tests that take a few hand‑crafted wrap‑up payloads (including invalid ones) and assert the validator behavior.
- Treat wrap‑up failures as *non‑fatal*:
  - Log and skip wrap‑up if payload fails validation.
  - Do not break streaming or the main teaching flow because of wrap‑up issues.

### F.2 Performance and Scalability Considerations (Phase 1)

Phase 1 is not about large‑scale production traffic, but sensible design choices now will make Phase 2/3 easier.

1. **Streaming Efficiency**
   - The WS streaming loop uses an async iterator and writes directly to the socket; this is O(n) in number of chunks and avoids buffering large responses in memory, except in buffered mode.
   - Buffered mode in the current design only kicks in after a 25s stall; this is acceptable for Phase 1. In heavier production environments, we may:
     - Lower stall thresholds.
     - Enforce a maximum number of chunks or bytes per stream to avoid out‑of‑memory issues.

2. **Session Store Memory Usage**
   - For Phase 1, `SessionStore` holds all sessions and turns in memory. This is fine for local development and limited QA usage.
   - To avoid unbounded growth:
     - Add a periodic cleanup pass to prune sessions and turns older than a configurable TTL (e.g., 2 hours).
     - Integrate `pruneIdempotency` into the same cleanup loop.

3. **Rate Limiting Strategy**
   - The simple per‑IP/UA limiter is adequate for mobile MVP but not for multi‑tenant production.
   - Later, this can be replaced with:
     - An external store (Redis/KeyDB) with distributed counters.
     - Client‑aware buckets (per installation or per user once auth exists).

4. **LLM Cost Control**
   - Phase 1 avoids multiple parallel streams per turn; BFF issues a single Gemini stream per turn and closes it on timeout or error.
   - Additional defenses (Phase 2) could include:
     - Maximum concurrent streams per IP/session.
     - Short‑circuiting repeated calls on identical input within a short window.

### F.3 Edge Cases and Their Handling

1. **WS Open But No `turnId`**
   - If a WS connection hits `/sessions/{sessionId}/stream` without a valid `turnId` query param:
     - `StreamController` should send a `BAD_REQUEST` `error` frame and close.

2. **Session Exists But Turn Does Not**
   - E.g., a stale client retry with a deleted `turnId`.
   - Same behavior: `BAD_REQUEST` `error` frame, close WS.

3. **Double Submit with Same `clientTurnId`**
   - Should return the original `{ turnId, streamUrl }` from `/turns`.
   - If the original stream is still in progress, the second client may attach a new WS connection:
     - This is acceptable in Phase 1, but we should document that only one of them is guaranteed to be seen by the user.

4. **Mermaid Recovery Flapping**
   - If the client repeatedly calls `/mermaid/recover` for the same failing diagram:
     - The BFF should treat each request independently; idempotency is not required here.
     - Telemetry can help reveal repeated failures; in Phase 2+, we could implement per‑diagram rate limiting or caching.

5. **Telemetry Payloads with Unexpected Fields**
   - `TelemetryService` must ignore unknown fields and log only safe metadata.
   - Because the functional spec forbids PII, the BFF should never add user identifiers beyond anonymized device metadata (e.g., platform) and network metadata (IP, UA) in logs.

### F.4 Migration Notes (From Dev Stub to Phase 1 BFF)

The current `bff/index.js` is a development stub. Migrating to the Phase 1 BFF design should be done in deliberate steps:

1. **Introduce the New Structure Behind the Existing Entry Point**
   - Keep `bff/index.js` as the node entry script, but have it import and start the new `src/server.ts`.
   - This avoids breaking `npm run bff` or `npm start` workflows during migration.

2. **Gradual Feature Replacement**
   - Step 1: Replace `/sessions` and `/turns` with new handlers using `SessionStore` and `RateLimiter`, but keep WS streaming logic simple (word‑chunking).
   - Step 2: Introduce `GeminiGateway` and `StreamingService` so WS streaming comes from real Gemini output.
   - Step 3: Replace `/mermaid/recover` implementation and integrate telemetry.

3. **Feature Flag for Web vs Mobile Use**
   - During transition, web may still be using client‑side Gemini while mobile uses the BFF.
   - Consider:
     - A server‑side configuration that tells BFF whether it should expect web clients or mobile only.
     - A client‑side flag that disables direct Gemini use in web bundle when running inside RN WebView.

4. **Testing and Rollout**
   - Before switching mobile to depend on the new BFF for all LLM traffic:
     - Run `__tests__/BffClient.test.ts` and `__tests__/MobileParitySentinel.test.ts` to ensure compatibility.
     - Add integration tests that exercise the full `/sessions` → `/turns` → WS stream lifecycle.

### F.5 Glossary

- **BFF (Backend‑for‑Frontend)**  
  A server component dedicated to serving a specific client family (e.g., mobile, desktop), owning the API contracts, streaming, and cross‑cutting concerns, while delegating business logic to shared core libraries.

- **Sensei Core**  
  A planned, shared, server‑side TypeScript library containing pedagogy, curriculum, and learner model logic, extracted from the current web app and reused by multiple BFFs.

- **Turn**  
  A single client → Sensei interaction, consisting of a user’s input and Sensei’s corresponding response stream. Identified on the client by `clientTurnId` and on the server by `turnId`.

- **Session**  
  A logical grouping of turns for a learner, created via `POST /sessions`. In Phase 1, session state is ephemeral and lives only in memory.

- **Idempotency (for /turns)**  
  The property that resubmitting the same `clientTurnId` under a session returns the same `turnId` and does not duplicate underlying work, within a configured retention window.

- **Buffered Mode**  
  A streaming mode where, after detected stalls, the server stops sending incremental chunks and instead buffers remaining text, sending it as a single final payload when the LLM finishes, as specified in the Functional Spec.

- **Wrap‑Up Assessment**  
  A structured, 15‑question assessment (with 5 snippet questions) presented at the end of a module. Generated by Core/LLM and rendered by the web overlay; the BFF transports a validated payload via `wrapUp` WS messages.

- **Mermaid Recovery**  
  The process of repairing failing Mermaid diagrams via rule‑based transformations and (optionally) LLM assistance, exposed as `POST /mermaid/recover`.

- **Telemetry Event**  
  A JSON object containing an event name, timestamp, and data describing user or system behavior, sent by clients to `/telemetry` for analytics, debugging, or monitoring.

---

Section F is intended as a living set of notes. As implementation proceeds and new insights are gained (e.g., from device testing or early production signals), this section should be updated with additional risks, mitigations, and clarifying glossary entries so that the BFF system remains both robust and understandable over time.

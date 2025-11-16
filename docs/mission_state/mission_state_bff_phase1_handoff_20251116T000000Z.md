# Phase 1 BFF Handoff – Meta‑Guidance for the Next Agent

This handoff is **not** a second spec. It is a guide on **how** to use the existing specs. The canonical sources of truth are:

- `docs/engineering/contracts_v1.md` – REST/WS/bridge contracts for Phase 1 mobile.
- `docs/BFF_System_Master_Arhitectural_Guide.md` – BFF architecture, responsibilities, and flows (Sections A–E).
- `docs/engineering/mobile_phase1_engineering_spec.md` – Mobile shell expectations and BFF integration summary.
- `docs/functional_spec/recursive_sensei_mobile_phase1_functional_spec.md` – Product‑level behavior (timeouts, rate‑limits, telemetry rules, etc.).

**Nothing in this handoff may override or contradict those documents.**  
If you ever see a conflict, treat the design/contract docs as correct and adjust your plan accordingly.

---

## 1. What has been achieved so far

During the previous session:

- Contracts were reviewed and tightened in `contracts_v1.md` so that:
  - `/sessions`, `/sessions/{sessionId}/turns`, WebSocket frames, `/mermaid/recover`, and `/telemetry` all have clear shapes and error semantics for Phase 1.
  - Idempotency, rate‑limits, error mapping, and persistence behavior are spelled out.
- The BFF design document was updated so that:
  - Internal responsibilities are clear (SessionStore, RateLimiter, TopicRegistry, SenseiCoreAdapter, GeminiGateway, ErrorMapper, TelemetryService).
  - There are explicit interfaces for storage, rate limiting, LLM integration, and prompt building that are intended to survive future migrations (e.g., Redis, Core extraction, new LLM provider).
  - Turn flows explicitly route through `TurnService` → `SenseiCoreAdapter` → `GeminiGateway`, rather than ad‑hoc logic in controllers.
- A number of future‑proofing decisions were made, but **only encoded inside the design docs**; this handoff just points to them.

In other words: the **surface area and the architecture are already specified**. Your job now is to implement them, not redesign them.

---

## 2. How you should treat the existing documents

Think of the docs as a layered spec:

1. **Contracts v1** (`docs/engineering/contracts_v1.md`)
   - Defines exactly what the BFF must look like from the outside:
     - Endpoints, payloads, status codes, error bodies, WebSocket message types, telemetry envelopes.
   - Use it to answer: “What should this endpoint return for this kind of request?” and “What must the client always be able to rely on?”

2. **BFF System Architectural Guide** (`docs/BFF_System_Master_Arhitectural_Guide.md`)
   - Explains how the BFF should be structured internally:
     - Which modules exist (`SessionStore`, `RateLimiter`, `TopicRegistry`, `SenseiCoreAdapter`, `GeminiGateway`, etc.).
     - How requests should flow (router → service → infra/adapter/gateway).
     - How streaming, error mapping, topic validation, and mermaid recovery are intended to work.
   - Use it to answer: “Where should this logic live?” and “Which abstraction should I be using here?”

3. **Mobile Engineering / Functional Specs**
   - Explain why some constraints exist (e.g., 3 turns/min, 15s WS keepalive, telemetry opt‑out, no server persistence for Phase 1).
   - Use them to sanity‑check that what you implement is consistent with the product goals.

This handoff is **only a meta‑guide**: it describes how to use those docs and what patterns to preserve. When in doubt, re‑read the spec instead of relying on your memory or on this file.

---

## 3. Ground rules for implementation

Use these rules as guardrails so your implementation does not drift from the design.

### 3.1 Always start from the documents

For any endpoint, feature, or change:

1. Read the relevant section in `contracts_v1.md`.
   - Confirm: path, method, request schema, response schema, status codes, and “Normative behaviors” bullets.
2. Read the relevant sections in the BFF guide:
   - Phase 1 responsibilities (Section B).
   - Milestones and structure (Section C, especially C.2 for the BFF skeleton).
   - Flows and data models (Section D).
   - Low‑level interfaces (Section E: SessionStore, RateLimiter, TopicRegistry, SenseiCoreAdapter, GeminiGateway, ErrorMapper, TelemetryService).

Only after this should you plan code changes. If something is unclear, prefer to clarify it in the docs with a small patch before writing code.

### 3.2 Respect layering

The BFF guide is very explicit about separation of concerns. Preserve that:

- **Routers/controllers** (Express handlers):
  - Parse and validate incoming requests.
  - Construct a per‑request context (e.g., a lightweight `requestId` + identifiers).
  - Invoke the appropriate service method.
  - Map service errors to HTTP/WS responses via ErrorMapper.

- **Services** (e.g., SessionService, TurnService, MermaidService, TelemetryService):
  - Encapsulate business logic for each domain.
  - Use infra interfaces (SessionStore, RateLimiter, TopicRegistry, GeminiGateway, SenseiCoreAdapter) to do their work.
  - Do not know or care about Express/WS specifics beyond what is needed.

- **Infra/Adapters/Gateways**:
  - `SessionStore` abstracts session/turn storage (in-memory now, Redis/DB later).
  - `RateLimiter` abstracts rate limits (in-memory now, shared store later).
  - `TopicRegistry` abstracts the list of valid topic IDs from `config/topics.json`.
  - `SenseiCoreAdapter` is the single place where prompts for teaching turns are constructed, using logic ported from web code.
  - `GeminiGateway` is the single place where Gemini SDK calls happen.

If you find yourself:
- Building prompts in a controller or streaming module, or
- Calling Gemini SDK directly from anything except GeminiGateway, or
- Accessing `SessionStore` maps directly in routers,

then you are violating the design and should refactor toward the abstractions described in the BFF guide.

### 3.3 Keep interfaces async and replaceable

Future scalability and Core extraction depend on being able to swap implementations:

- `SessionStore` must be accessed through its async interface.
  - Even though Phase 1 implementation is in-memory, callers should `await` its methods.
- `RateLimiter` must be accessed through its async interface.
  - All “3 turns / 60s / IP+UA” logic should go there, not spread around.
- `SenseiCoreAdapter` and `GeminiGateway` must be the only way LLMs are used:
  - This allows future Core package or different LLM providers without touching HTTP/WS layers.

When implementing, do not “simplify” by making these synchronous or skipping the extra layer; that would make future migrations painful and contradict the design.

### 3.4 Honor persistence scope

Phase 1 explicitly allows the BFF to keep all session/turn state in memory and makes **no guarantee** about surviving restarts. Save/load lives on the client side.

Do not add server-side persistence for learner progress or transcripts in Phase 1, even if it seems convenient. If you need to store something beyond an in-memory map, it must be justified against the Functional Spec and BFF guide, and likely belongs in a future phase.

### 3.5 Error semantics and rate limits are part of the contract

Error behavior and rate limiting are not implementation details; they are part of the contract:

- Use the status codes and error body shapes described in `contracts_v1.md`.
- For `/turns`, enforce:
  - Input length and non‑emptiness.
  - Per-session idempotency.
  - The documented rate limit (3 turns per 60s per IP+UA).
- Map internal errors to HTTP/WS errors via the ErrorMapper patterns in the BFF guide, rather than ad-hoc `res.status(...).json(...)` scattered in controllers.

If you see behavior that deviates from the described mapping (e.g., returning 500 for a simple validation error), it needs to be brought back in line with the spec.

### 3.6 Telemetry must never break the app

Telemetry is explicitly best-effort. Whatever you implement in the BFF for `/telemetry`:

- Must tolerate malformed or partial events.
- Must not return 4xx/5xx solely because telemetry payloads are “wrong”.
- Should log/forward what it can and answer with a success status (204/200).

If you find yourself adding validation that rejects telemetry aggressively, soften it to logging and dropping instead.

---

## 4. Recommended implementation sequence (high level)

Without going into code, here is the order that will keep you closest to the design:

1. **Scaffold the BFF module layout** exactly as described in the BFF guide:
   - Router files for `/sessions`, `/turns`, `/mermaid/recover`, `/telemetry`.
   - `server.ts` for Express + WS wiring.
   - Supporting infra and services (`SessionStore`, `RateLimiter`, `TopicRegistry`, `SenseiCoreAdapter`, `GeminiGateway`, ErrorMapper, TelemetryService).

2. **Implement `/sessions`** first:
   - Lightweight but correct: topic validation via TopicRegistry, proper error body for unknown topics, `{ sessionId }` response.

3. **Implement `/turns`** next:
   - Validate input
   - Use RateLimiter
   - Use SessionStore & TurnService
   - Do not integrate real Gemini yet; you can stub streaming while the HTTP contract is stabilized.

4. **Implement WebSocket streaming** with stubbed content but correct lifecycle:
   - Start with `status:started` and `status:completed` surrounding simple chunks.

5. **Integrate `SenseiCoreAdapter` and `GeminiGateway`**:
   - Move from stubbed chunks to real prompt + Gemini streaming, keeping the adapter and gateway boundaries intact.

6. **Implement `/mermaid/recover` and `/telemetry`** following their contracts:
   - Recovery: correct `{ fixed, fixedCode? }` semantics and status codes.
   - Telemetry: best-effort, never breaking.

7. **Add logging and request correlation**:
   - Generate a `requestId` per request.
   - Log key actions and errors with `requestId`, `sessionId`, and `turnId` to make debugging and tracing easier later.

At each step, verify against the design and contracts, not against this handoff.

---

## 5. WebView bridge context (how BFF fits in)

The RN ↔ WebView bridge is **not** something the BFF implements directly, but it is the glue between the BFF and the web UI running inside WKWebView. Its design matters for how you interpret WebSocket streams and how you avoid overstepping into UI concerns.

- The bridge contracts live in `docs/engineering/contracts_v1.md` under the RN↔WebView section:
  - `WebViewToRN` – what the web bundle sends to RN.
  - `RNToWebView` – what RN sends back into the WebView (e.g., `chat:startMessage`, `chat:update`, `chat:completeMessage`, `wrapup:show`, etc.).
- `docs/engineering/mobile_phase1_engineering_spec.md` describes how these events map to web behavior (`updateMessageStream`, selection overlay, mermaid recovery, wrap-up, enhance).

From the BFF’s perspective:

- The BFF never talks directly to the WebView.
- The BFF only emits:
  - HTTP responses (`/sessions`, `/turns`, `/mermaid/recover`, `/telemetry`).
  - WebSocket frames (`status`, `chunk`, `wrapUp`, `error`) for a turn.
- RN is responsible for:
  - Turning `{ turnId, streamUrl }` into a `messageId` for the WebView.
  - Mapping `chunk`/`status`/`wrapUp` frames from WS into the correct RN→WebView bridge messages, using the contracts as shape guarantees.

In the overall workflow:

1. WebView JS (the existing web app) renders the chat UI and implements the teaching logic.
2. The bridge carries **two directions of messages**:
   - WebView → RN (upstream), via `WebViewToRN`:
     - Selection events so RN can show the native selection overlay.
     - Mermaid render errors so RN can call the BFF’s `/mermaid/recover`.
     - Render progress or other telemetry-related events.
   - RN → WebView (downstream), via `RNToWebView`:
     - `chat:startMessage` to create a bubble with a given `messageId`.
     - `chat:update` / `chat:completeMessage` to stream and finalize bubble text.
     - `wrapup:show` to display the wrap-up assessment overlay.
     - Theme, footer, and enhance-related updates.
3. RN uses `BffClient` to talk to the BFF:
   - `ensureSession` → `/sessions`.
   - `submitTurn` → `/turns` + WS stream.
   - `recoverMermaid` → `/mermaid/recover`.
   - `TelemetryManager` → `/telemetry`.
4. The BFF handles HTTP/WS according to Contracts v1 and the BFF guide, but remains agnostic about DOM and bubble layout.

Implications for implementation:

- Do **not** try to encode bubble IDs, DOM assumptions, or UI details in the BFF beyond what Contracts v1 defines:
  - For example, do not rely on `chunk.messageId` to route updates; in Phase 1 mobile, the RN/WebView bridge uses its own `messageId` agreed at `chat:startMessage` time.
- Treat the bridge contracts as a separate “client API” layer:
  - BFF → RN: HTTP/WS as per Contracts v1.
  - RN → WebView: bridge messages as per the RN↔WebView contract.
- When adding or adjusting BFF behavior, always ask:
  - “Is this something the BFF should own, or is it a concern for the WebView bridge and web bundle?”
  - If it’s UI-specific (which bubble, DOM shape, CSS, etc.), it belongs in the bridge/web layer, not in the BFF.

To understand or modify bridge behavior, go to `contracts_v1.md` + the mobile engineering spec, not this handoff.

---

## 6. How to think when something is unclear

The next agent may not be as context-rich as the one that wrote this, so here is how it should reason:

1. When in doubt, **re-read the spec** instead of guessing.
2. Prefer adding a small clarification to `contracts_v1.md` or the BFF guide over “doing something that feels right but undocumented”.
3. Always ask:
   - “Which abstraction in the BFF guide should own this?”
   - “Will this make it harder to move to Redis/Core/a new LLM later?”
4. If the answer is “this spreads logic across controllers” or “this bypasses an interface that was explicitly introduced”, refactor toward the documented abstractions.

Following this approach will keep the Phase 1 implementation in sync with the design and avoid creating hidden behaviors that the docs don’t describe.

---

## 7. Addendum: Implementing the WebView bridge (at a high level)

This is not a new spec for the bridge. It is guidance on **how to use the existing design docs and BFF implementation** to implement or refine the bridge without drifting.

1. **Start from the bridge contracts in `contracts_v1.md`**
   - Find the RN↔WebView section:
     - `WebViewToRN` – events emitted by the web app inside the WebView.
     - `RNToWebView` – commands from RN into WebView.
   - Treat these types as the canonical list of allowed messages and payloads.
   - Before adding any new bridge message, consider whether it belongs there and in the mobile spec; do not invent ad-hoc shapes in code.

2. **Use the mobile engineering spec to understand behavior**
   - `docs/engineering/mobile_phase1_engineering_spec.md` details:
     - How `chat:startMessage` / `chat:update` / `chat:completeMessage` map to the web’s `updateMessageStream`.
     - How selection events, mermaid errors, enhance, and wrap-up are expected to behave on mobile.
   - Use it to decide **when** to send existing messages, not to define new ones.

3. **Map BFF interactions to bridge messages, not vice versa**
   - For chat:
     - `/sessions/{sessionId}/turns` + WS frames (`status`, `chunk`, `wrapUp`, `error`) come from the BFF.
     - RN consumes these and translates them into:
       - `chat:startMessage` (when a turn begins).
       - `chat:update` for each text chunk.
       - `chat:completeMessage` when streaming completes.
       - `wrapup:show` when a `wrapUp` WS frame arrives.
   - For mermaid:
     - WebView sends `mermaid:error` via `WebViewToRN`.
     - RN calls BFF `/mermaid/recover`.
     - RN forwards the result back to WebView using the appropriate bridge pattern described in the mobile spec.
   - For telemetry:
     - WebView and RN decide which events to emit.
     - RN batches and sends them to BFF `/telemetry` via `TelemetryManager`, as described in the design docs.

4. **Keep responsibilities separated**
   - The bridge should not:
     - Duplicate BFF logic (e.g., reimplement rate limiting, idempotency, error codes).
     - Peek into BFF internals (SessionStore, TurnContext, etc.).
   - The BFF should not:
     - Depend on bridge message formats beyond what Contracts v1 describes as RN↔WebView types.
     - Attempt to dictate DOM structure or bubble layout.

5. **When extending the bridge**
   - If you need a new interaction between RN and WebView:
     - First, check whether it can be expressed via existing message types.
     - If truly new, propose it in:
       - The RN↔WebView section of `contracts_v1.md`.
       - The mobile engineering spec.
     - Only then add it to the code, so the spec and implementation stay aligned.

If you follow this pattern, the WebView bridge will remain a thin and predictable translation layer between the BFF’s network contracts and the web app’s UI behavior, instead of becoming a second, informal API with undocumented behavior.

# Mission State – Phase 1 BFF Core Analysis (2025-11-16T08:26:29Z)

## Scope & Entry Points
- RN shell: `SenseiMobile/App.tsx` wires `BridgeManager`, `BffClient`, `SaveLoadService`, `TelemetryManager`, and `MainScreen`, so it is the root for all mobile-side orchestration (entry candidate per analyzer summary).
- UI surface: `SenseiMobile/src/mobile/MainScreen.tsx` (fan-out 8) hosts the WebView, SelectionOverlay, header/backdrop components, telemetry toggles, and the exported `runForwardStream` helper that drives RN→WebView chat streaming.
- Bridge throttle: `SenseiMobile/src/mobile/bridge/BridgeManager.ts` (fan-in 6) mediates every RN→WebView payload, enforcing the `chat:update` throttling spec; Analyzer trace highlighted `enqueue -> processQueue -> scheduleThrottle -> dispatch` as the hot path.
- Network layer: `SenseiMobile/src/mobile/network/BffClient.ts` handles `/sessions`, `/turns`, `/mermaid/recover`, and WS streaming. Analyzer call graph shows `submitTurn -> ensureSession -> createStream -> createErrorStream` as the runtime flow.
- Web bundle counterpart: `src/mobile/webviewBridge.ts` + `src/index.tsx::handleReactNativeMessage` (entry candidate) translate RN commands into DOM updates, SaveLoad handlers, wrap-up overlays, and footer updates; analyzer calls show `handleReactNativeMessage` fanning into `displayMessage`, `updateMessageStream`, `processMermaidBlocks`, `updateFooter`, etc.
- Current server stub: `bff/index.js` (outside analyzer scope) is a single-file Express+WS mock without the layered architecture described in the BFF guide, so every feature will replace/extend this surface.
- Hot modules from fan-in/out for parity/risk: `src/logger.ts`, `src/model_usage.ts`, `src/ui.ts`, `src/adaptiveEngine.ts`, `SenseiMobile/src/mobile/bridge/contracts.ts`, and `src/mobile/bridge/contracts.ts`.

## Static Execution Trace
1. **RN boot path**
   - `App` instantiates `BridgeManager` (sender → `WebView.postMessage`), `IOSFileAdapter`, `SaveLoadService`, `TelemetryManager` (`/telemetry` endpoint, memory store), and `BffClient` (base URL `http://localhost:8787`).
   - `MainScreen` mounts with those services, enqueues `app:init`, primes `SelectionOverlayController`, injects header observers, and sets up WebView callbacks.
2. **Turn submission + streaming**
   - `handleSubmit` trims input, blocks concurrent streams, calls `TelemetryManager.nextClientTurnId`, logs+records `turn_submitted`, pushes `chat:startMessage`, and awaits `bffClient.submitTurn`.
   - `BffClient.submitTurn` → `ensureSession` (`POST /sessions`), then `POST /sessions/{sessionId}/turns`, logging `phase:requested`, and returns `{ messageId: msg-<turnId>, stream: createStream(...) }`.
   - `createStream` spins `AsyncEventQueue`, opens a `WebSocket`, and wires `onopen` (push `status:started`), `onmessage` (dispatch `chunk`/`status`/`wrapUp`/`error`), `onerror` (push `DOWNSTREAM_UNAVAILABLE`), `onclose` (push `status:completed`, close queue).
   - `runForwardStream` consumes the async iterator: `chunk` → `bridge.enqueue(chat:update)`; `status.footer` → `footer:update` + RN state update; `status.phase==='completed'` → `chat:completeMessage`; `error` → log + telemetry `stream_error`.
   - Wrap-up frames are forwarded by `BffClient` directly through `bridge.enqueue({ type:'wrapup:show' })`.
3. **WebView handling of RN commands**
   - `initializeWebviewBridge` registers RN handler and message listeners; RN uses `BridgeManager` to throttle commands, so WebView receives JSON events via `handleReactNativeMessage`.
   - `handleReactNativeMessage` logs, handles SaveLoad export/import (calls `SaveLoadProgressManager`), `chat:startMessage` (calls `displayMessage` + `streamingMessagesRawText`), `chat:update` (calls `updateMessageStream`), wrap-up show (calls `showWrapUpAssessmentOverlay`), footer updates (`updateFooter`), selection actions (`invokeSelectionSenseiBridgeAction`), and telemetry toggles (sets `window.__telemetryEnabled`).
4. **Telemetry path**
   - `TelemetryManager.record` appends event+device metadata; `toggle` persists state in the provided storage; `flush` POSTs `{ events }` to the BFF endpoint and re-queues on failure.
5. **Mermaid recovery**
   - RN `BffClient.recoverMermaid` posts `MermaidRecoveryPayload` to `/mermaid/recover` and logs phase `mermaid-recovery`; WebView sends failures to RN through the bridge (per `contracts_v1`).

## Dependency & Side-Effect Table
| Function (file) | Key Dependencies | Side Effects / Risk Notes |
| --- | --- | --- |
| `App` (SenseiMobile/App.tsx) | React hooks, `BridgeManager`, `BffClient`, `TelemetryManager`, `MainScreen` | Writes global services once; sets `SafeAreaProvider` root. Risk: hard-coded `BFF_BASE_URL` + `topicId:'default'` need to align with contracts/env.
| `runForwardStream` (SenseiMobile/src/mobile/MainScreen.tsx) | `BridgeManager.enqueue`, `TelemetryManager.record`, `logger` | Streams events to WebView; errors short-circuit without retry. Must honor buffered-mode events from BFF in future.
| `BridgeManager.enqueue/processQueue/scheduleThrottle/dispatch` | Internal queue, `sender` callback, `setTimeout` scheduling | Writes `queue`, `flushing`, `throttleHandle`, `lastChatUpdateDispatched`; throttles `chat:update`. Risk: mis-tuning could drop UI responsiveness when BFF emits fast chunks.
| `BffClient.ensureSession` | `fetch` to `/sessions` | Writes `sessionId`; throws on non-200. Needs topic validation + metadata to match spec.
| `BffClient.submitTurn` | `ensureSession`, `fetch /turns`, `logger`, `createStream` | Issues POST without metadata/rate handling; returns `msg-<turnId>`. Risk: doesn't pass `selectionSensei`, `appVersion`, or selection context required by contracts.
| `BffClient.createStream` | `WebSocket`, `AsyncEventQueue`, `bridge.enqueue` | Hooks WS event handlers, pushes `status/chunk/error`, forwards wrap-up to bridge. Risk: no buffered-mode fallback or keepalive/timeout enforcement yet.
| `TelemetryManager.record/flush` | `fetch /telemetry`, `storage` | Maintains queue, may drop events on repeated failures. Needs to match spec (best-effort 204, opt-out persistence).
| `initializeWebviewBridge` / `sendToNative` (src/mobile/webviewBridge.ts) | `window.ReactNativeWebView.postMessage`, global listeners | Registers event listeners; logging via `logger`. Must guard double-registration and message parsing per contracts.
| `handleReactNativeMessage` (src/index.tsx) | `sendToNative`, `SaveLoadProgressManager`, `displayMessage`, `updateMessageStream`, `updateFooter`, `showWrapUpAssessmentOverlay`, `selectionSensei` helpers | Modifies DOM/status, surfaces wrap-up overlays, toggles telemetry global. Needs parity with BFF payloads (e.g., footer schema, wrap-up data validation).
| `bff/index.js` stub | Express, ws, zod | Maintains in-memory sets, fake streaming chunks. Risk: does not implement layering, rate limits, buffered-mode, telemetry semantics, or Sensei Core adapters.

## Risk Register
1. **Spec drift between RN/Web bridge and future BFF** – Current RN `BffClient` hard-codes `topicId:'default'`, ignores `metadata`, and derives `messageId` from `turnId`, which conflicts with contracts requiring server-tracked `sessionId`, `clientTurnId` idempotency, and selection context. *Impact: High.* *Mitigation:* Align new BFF interfaces + RN client with `contracts_v1` before roll-out; add schema-enforced DTOs.
2. **Streaming lifecycle gaps** – RN assumes `status:started` and `status:completed` only; there is no buffered-mode handling, keepalive ack, or `wrapUp` validation. *Impact: High.* *Mitigation:* Implement BFF buffered-mode + RCI (Step 8) and extend `runForwardStream` tests to assert chunk ordering & `footer` updates.
3. **Bridge throttling vs WS throughput** – `BridgeManager` enforces `maxChatUpdatesPerSecond`, but there are no safeguards when BFF emits bursts (backpressure, queue growth). *Impact: Medium.* *Mitigation:* Monitor queue size, add drop/merge heuristics or dynamic throttle once BFF sends real LLM streams.
4. **Telemetry delivery reliability** – `TelemetryManager.flush` drops events back into queue only on fetch throw; server responses ≠200 are silently ignored. *Impact: Medium.* *Mitigation:* Onboard BFF `/telemetry` contract early and add retries/backoff instrumentation.
5. **BFF stub coverage gap** – `bff/index.js` lacks modules from BFF guide (SessionService, RateLimiter, StreamingService, etc.), meaning there is no baseline to extend. *Impact: High.* *Mitigation:* Scaffold new `bff/src` tree per design before wiring RN to it; keep stub accessible until parity confirmed.

## Coverage Checklist (functions to validate during implementation/tests)
- `SenseiMobile/App.tsx::App` initialization flow.
- `SenseiMobile/src/mobile/MainScreen.tsx::{runForwardStream, handleSubmit block}`.
- `SenseiMobile/src/mobile/bridge/BridgeManager.ts::{enqueue, processQueue, scheduleThrottle, dispatch}`.
- `SenseiMobile/src/mobile/network/BffClient.ts::{ensureSession, submitTurn, createStream, createErrorStream, recoverMermaid}`.
- `SenseiMobile/src/mobile/telemetry/TelemetryManager.ts::{record, flush, toggle}`.
- `src/mobile/webviewBridge.ts::{initializeWebviewBridge, handleIncoming, sendToNative}`.
- `src/index.tsx::handleReactNativeMessage` downstream DOM updates.
- `src/ui.ts::{displayMessage, updateMessageStream, updateFooter, processMermaidBlocks}` for RN-driven changes.
- `src/wrapUpAssessment.ts::showWrapUpAssessmentOverlay` integration with WS `wrapUp` frames.
- `bff/index.js` (legacy) vs upcoming `bff/src/*` scaffolding to ensure parity.

## Unknowns Register
| Unknown | Impact | Verification Plan |
| --- | --- | --- |
| Production BFF base URL / env config (currently hard-coded `http://localhost:8787`). | Medium | Confirm expected deployment host & injection mechanism (env var, RN config) before wiring final BffClient; update App.tsx accordingly. |
| Required `topicId` + metadata payload for `/sessions` beyond `'default'`. | Medium | Reconcile RN client with `contracts_v1` topic registry + `SessionService` spec; adjust BffClient once server schema finalized. |
| Exact `clientTurnId`/`messageId` mapping once BFF enforces idempotency. | High | Decide whether RN or BFF generates final `messageId`; ensure `/turns` response includes `messageId` or deterministic mapping; update BffClient + bridge accordingly. |
| Buffered-mode + keepalive semantics expected by RN UI. | Medium | Review Functional Spec §4.2 + BFF guide E.4; plan RN changes (e.g., `chat:bufferedMode` bridge event) once server implementation ready. |
| Telemetry opt-in persistence scope (per-device vs per-session). | Low | Clarify with product spec; ensure `TelemetryManager` storage (memory vs async storage) matches requirement. |

## Key Architectural Insights
- RN and web bundles both host `mobile/` mirrors of bridge and network code, so server-side contracts must remain identical across `src` and `SenseiMobile/src` copies until shared packages exist.
- Bridge throttling plus telemetry instrumentation already exist; server streaming must feed them without introducing UI drift (respect `footer`, `wrapUp`, buffered mode, statuses per contracts).
- BFF stub is monolithic and bypasses the layered architecture; implementation must introduce `bff/src/server.ts`, routers, services, infra, adapters, and logging per the BFF guide before swapping endpoints in RN.
- Save/Load, Selection Sensei, and wrap-up flows already rely on RN↔WebView bridge payloads from `contracts_v1`; BFF responses have to strictly emit these shapes so existing DOM code in `src/ui.ts`, `src/wrapUpAssessment.ts`, and `src/selectionSensei.ts` continue working unchanged.

## Next Protocol
`COMPREHENSIVE IMPACT ANALYSIS PROTOCOL` (required before editing existing code) will run next, followed by Architectural Synthesis + implementation once user confirms scope.

## Test Traceability
- Planned backend tests should import `SenseiMobile/src/mobile/network/BffClient.ts` (client contract), `src/mobile/webviewBridge.ts`, and the forthcoming `bff/src` services to ensure message shapes and streaming states stay consistent.
- RN E2E/device tests must cover `MainScreen` streaming (chat start/update/complete), SelectionOverlay RN↔WebView messages, and telemetry toggles hitting `/telemetry`.
- Web bundle regression tests should continue exercising `handleReactNativeMessage` -> `updateMessageStream` and wrap-up overlay triggers driven by server-sent frames.

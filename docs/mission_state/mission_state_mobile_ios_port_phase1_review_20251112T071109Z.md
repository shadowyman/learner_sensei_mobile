# Mission State – Mobile iOS Phase 1 Code Review Core Analysis (2025-11-12T07:11:09Z)

## Scope & Entry Points
- Analyzer snapshot (`npm run analysis:run`) refreshed `tmp/analysis/*` on 2025-11-12T07:11Z; entry candidates skew heavily toward the new mobile stack (`src/mobile/MainScreen.tsx`, `src/mobile/bridge/*`, `src/mobile/network/BffClient.ts`, `src/mobile/saveLoad/SaveLoadService.ts`, `src/mobile/telemetry/TelemetryManager.ts`).
- Hot modules by fan-in/out: `src/logger.ts` (29), `src/mobile/bridge/contracts.ts` (7), `src/mobile/bridge/BridgeManager.ts` (5), `src/mobile/MainScreen.tsx` (fan-out 5). These anchor the RN⇄WebView bridge and telemetry plumbing that the review touches.
- Confirmed scope grouping:
  1. **MainScreen orchestration** – component state, submission pipeline, WebView message intake.
  2. **BridgeManager throttling** – enforces ≤10 `chat:update` events/sec before dispatching via the RN sender.
  3. **BffClient networking** – REST turn submission + WS streaming and wrap-up forwarding.
  4. **SaveLoadService** – RN file adapter integration + WebView bridge responses.
  5. **SelectionOverlayController** – translation of WebView selection geometry into native overlay actions.
  6. **TelemetryManager** – toggle persistence, queueing, and flush guarantees.

## Static Execution Trace
1. **Turn submission happy path**
   - `MainScreen__anon4` (`handleSubmit`) → `BffClient.ensureSession` → `TelemetryManager.nextClientTurnId/record` → `BridgeManager.enqueue('chat:startMessage')` → `forwardStream`.
   - `forwardStream` awaits `BffClient.submitTurn` handle, iterates async `stream`, and enqueues `chat:update` / `chat:completeMessage` / `footer:update` messages.
   - `BffClient.submitTurn` POSTs `/sessions/{id}/turns`, logs, and calls `createStream` with `streamUrl`.
   - `BffClient.createStream` builds a WebSocket, pushes `chunk`/`status`/`error` events to an `AsyncEventQueue`, and injects wrap-up UI via `bridge.enqueue('wrapup:show', payload)`.
   - `BridgeManager.enqueue` → `processQueue` (respect throttling) → `dispatch` (calls RN sender + logs effect).
2. **Streaming completion & telemetry**
   - Within `forwardStream` the `status` branch enqueues footer updates and records `stream_status`; the `finally` block toggles `setIsStreaming(false)`. Errors feed `logger.error` + `telemetryManager.record('stream_error', …)`.
3. **Save / Load flows**
   - `handleSave` → `SaveLoadService.exportSession` builds `requestId`, stores resolver, `bridge.enqueue('saveload:export')`, awaits WebView response, then calls `fileAdapter.saveFile`.
   - `handleImport` → `SaveLoadService.importSession` (document picker) → logs + `bridge.enqueue('saveload:import', json)`.
   - WebView replies captured by `handleWebViewMessage` → `SaveLoadService.handleWebMessage` resolves/rejects pending exports and logs import results.
4. **Selection overlay interactions**
   - WebView posts `selection`/`selection:clear` → `handleWebViewMessage` → `SelectionOverlayController.handleWebMessage` updates controller state & RN overlay.
   - RN overlay actions invoke `SelectionOverlayController.invoke` → `bridge.enqueue('selectionSensei:invoke', …)` and dismiss overlay.
5. **Telemetry toggle + flush**
   - Header button toggles `TelemetryManager.toggle`, which persists to storage, logs, and triggers `flush()` when re-enabled; `record()` merges device metadata into each queued event.
6. **Wrap-up / Mermaid auxiliary events**
   - `BffClient.createStream` intercepts `wrapUp` frames and reuses RN overlay by enqueuing `wrapup:show`.
   - `MainScreen.handleWebViewMessage` forwards `telemetry:event` payloads and selection events, ensuring parity with web instrumentation.

## Dependency & Side-Effect Table
| Function (stableId) | Key Dependencies | Side Effects / Notes | Risk |
| --- | --- | --- | --- |
| `MainScreen` (`src/mobile/MainScreen.tsx::MainScreen#00576e756af9`) | React state hooks, `BridgeManager`, `SelectionOverlayController` | Initializes `SelectionOverlayController`, seeds `app:init` message | Low – mostly setup, but failure to instantiate controller blocks selection parity |
| `forwardStream` (`MainScreen__anon3#7114c3b6b6a6`) | `BffClient.submitTurn`, `BridgeManager.enqueue`, `TelemetryManager` | Mutates `isStreaming`, updates footer state, logs telemetry, suppresses duplicate streams | **High** – incorrect handling drops chunks or leaves `isStreaming` stuck true |
| `handleSubmit` (`MainScreen__anon4#3c811c9cc8de`) | `bffClient.ensureSession`, `telemetryManager`, `bridge` | Clears input, sends `chat:startMessage`, kicks off async stream | Medium – missing guards could double-send or skip idempotency |
| `handleWebViewMessage` (`MainScreen__anon5#fca7ba377ac2`) | `SelectionOverlayController`, `SaveLoadService`, `telemetryManager.record` | Parses untrusted JSON, mutates footer + overlay state, relays telemetry | Medium – parsing failures or missing cases break native overlays |
| `BridgeManager.enqueue/processQueue/dispatch` (`#1f7ce1c764b1`, `#544b99c77956`, `#5d38ccf8a63f`) | RN sender, throttling clock | Maintains queue, enforces ≤10 chat updates/sec, logs each dispatch | Medium – starvation if throttle handle never clears; sender exceptions handled via logger |
| `BffClient.ensureSession` (`#2f2503928f0d`) | `fetch` POST `/sessions` | Persists `sessionId` | Medium – missing retry/backoff yet to be implemented |
| `BffClient.submitTurn` (`#a4221d8c7c93`) | `ensureSession`, `createStream`, `fetch` | Posts turns, logs WS status, returns async stream handle | **High** – HTTP errors currently throw generic `Error`, relying on caller catch |
| `BffClient.createStream` (`#442a518f1a14`) | `WebSocket`, `BridgeManager` | Registers event handlers, pushes status/chunk/error frames, injects wrap-up overlay | **High** – queue never times out if WS stays open without close; relies on server closing connection |
| `SaveLoadService.exportSession` (`#46c2c011e5d7`) | `fileAdapter`, `bridge.enqueue`, resolver map | Creates pending export, awaits WebView ack, writes file; errors propagate | Medium – missing timeout for never-returned exports |
| `SaveLoadService.handleWebMessage` (`#75fff61f2323`) | WebView responses | Resolves/rejects pending exports, logs import results | Low – idempotent map clean-up |
| `SelectionOverlayController.handleWebMessage/invoke` (`#01a605b48360`, `#b96c0a46cee0`) | WebView selection payloads, `BridgeManager` | Maintains overlay state, enqueues `selectionSensei:invoke`, dismisses overlay | Medium – stale `selectionId` guard prevents stray actions |
| `TelemetryManager.toggle/record/flush/restoreState` (`#8b6a9521fa83`, `#f229c6812507`, `#4c6b5e2b9204`, `#3192c1df41c3`) | `storage`, `fetch`, device metadata fn | Persists opt-in flag, queues events, POSTs batches, restores persisted value | Medium – flush failure re-queues but no exponential backoff |

## Risk Register (High cost/blast)
1. **Streaming queue lock (forwardStream / BridgeManager)** – If `bffClient.submitTurn` rejects after `chat:startMessage` enqueued, UI shows ghost bubble with no completion. Need guard to enqueue failure/error message or retract user bubble.
2. **WebSocket lifecycle (BffClient.createStream)** – No explicit timeout/close when server stalls beyond keepalive; queue may stay open indefinitely, leaking `ws` references. Recommend hooking `setTimeout` fallback tied to Contracts v1 stall policy.
3. **Save export promise leak** – `SaveLoadService.exportSession` lacks timeout if WebView never responds, leaving pending resolver + blocked `await`. Consider adding watchdog + user feedback per Contracts v1.
4. **Telemetry toggle persistence** – `TelemetryManager.toggle` writes storage but `restoreState` awaited inside constructor without guarding for rejection; if storage fails, state may stay default ON. Needs try/catch and user feedback to satisfy opt-out guarantee.

## Coverage Checklist (functions to revisit during review/tests)
- `src/mobile/MainScreen.tsx::MainScreen#00576e756af9`
- `src/mobile/MainScreen.tsx::MainScreen__anon3#7114c3b6b6a6`
- `src/mobile/MainScreen.tsx::MainScreen__anon4#3c811c9cc8de`
- `src/mobile/MainScreen.tsx::MainScreen__anon5#fca7ba377ac2`
- `src/mobile/MainScreen.tsx::MainScreen__anon6#65b083594590` (Save)
- `src/mobile/MainScreen.tsx::MainScreen__anon7#d229510c922c` (Load)
- `src/mobile/bridge/BridgeManager.ts::BridgeManager.enqueue#1f7ce1c764b1`
- `src/mobile/bridge/BridgeManager.ts::BridgeManager.processQueue#544b99c77956`
- `src/mobile/bridge/BridgeManager.ts::BridgeManager.scheduleThrottle#2b7da6866cde`
- `src/mobile/bridge/BridgeManager.ts::BridgeManager.dispatch#5d38ccf8a63f`
- `src/mobile/network/BffClient.ts::BffClient.ensureSession#2f2503928f0d`
- `src/mobile/network/BffClient.ts::BffClient.submitTurn#a4221d8c7c93`
- `src/mobile/network/BffClient.ts::BffClient.createStream#442a518f1a14`
- `src/mobile/network/BffClient.ts::BffClient.recoverMermaid#a5b83f280ae6`
- `src/mobile/saveLoad/SaveLoadService.ts::SaveLoadService.exportSession#46c2c011e5d7`
- `src/mobile/saveLoad/SaveLoadService.ts::SaveLoadService.importSession#fc738fe143f4`
- `src/mobile/saveLoad/SaveLoadService.ts::SaveLoadService.handleWebMessage#75fff61f2323`
- `src/mobile/SelectionOverlay.tsx::SelectionOverlayController.handleWebMessage#01a605b48360`
- `src/mobile/SelectionOverlay.tsx::SelectionOverlayController.invoke#b96c0a46cee0`
- `src/mobile/telemetry/TelemetryManager.ts::TelemetryManager.toggle#8b6a9521fa83`
- `src/mobile/telemetry/TelemetryManager.ts::TelemetryManager.record#f229c6812507`
- `src/mobile/telemetry/TelemetryManager.ts::TelemetryManager.flush#4c6b5e2b9204`
- `src/mobile/telemetry/TelemetryManager.ts::TelemetryManager.restoreState#3192c1df41c3`

## Unknowns Register
| Item | Impact | Verification Plan | Owner |
| --- | --- | --- | --- |
| WebView sender resilience – does the RN `sender` supplied to `BridgeManager` debounce errors when WebView is unmounted? | Medium (missed dispatches stall UI) | Inspect RN host integration / add instrumentation in parity tests to confirm dispatch counts match queue | Reviewer (post-review) |
| Save export JSON integrity – does the WebView always include `json` when `success=true`? | Medium (file writes blank content otherwise) | Check web serializer + add parity test that asserts export payload length > 0 | Reviewer |
| Telemetry endpoint schema stability – server contract for `data` envelope unclear (only doc excerpt). | Low/Medium (payload rejection would drop events) | Cross-check with BFF telemetry handler implementation or capture integration logs | Reviewer |

## Key Architectural Insights
- Bridge throttling is the only guardrail preventing RN UI jank; every caller funnels through `BridgeManager`, so review must verify new message types respect throttling.
- Async event queue in `BffClient` doubles as backpressure buffer; without explicit size limits, tests must ensure streaming pauses don’t exhaust memory.
- Save/Load bridging relies entirely on request IDs derived from filenames; collisions are unlikely but not impossible—documented for future phases.

## Next Protocol
Core analysis complete. I have mapped execution traces, dependencies, side effects, and risks. Ready to proceed with the **Code Review workflow** mandated for the RN mobile port artifact.

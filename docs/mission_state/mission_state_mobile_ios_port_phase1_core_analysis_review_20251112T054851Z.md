# Mission State – Mobile iOS Port Phase 1 Core Analysis (2025-11-12T05:48:51Z)

Core analysis complete. I have mapped the execution trace and identified all dependencies and side effects. I am now ready to proceed with the Code Review Flow (HTML artifact via review CLI).

## Scope & Entry Points
- `src/mobile/MainScreen.tsx`: React Native entrypoint coordinating bridge messaging, BFF streaming, save/load, selection overlay, and telemetry toggles.
- `src/mobile/SelectionOverlay.tsx`: Controller + UI for text selection actions triggered by WebView events.
- `src/mobile/bridge/BridgeManager.ts`: Message queue with throttling for `chat:update` payloads before forwarding to the native sender.
- `src/mobile/webviewBridge.ts`: In-WebView shim that attaches message listeners and serializes payloads back to React Native.
- `src/mobile/network/BffClient.ts`: REST + WebSocket client that submits turns and streams responses.
- `src/mobile/saveLoad/SaveLoadService.ts`: File adapter facade that requests exports/imports through the bridge and resolves native storage promises.
- `src/mobile/telemetry/TelemetryManager.ts`: Local queue + persistence for telemetry events sent back to a server endpoint.
- Shared dependencies with high fan-in: `src/logger.ts`, `src/mobile/bridge/contracts.ts`, `src/mobile/bridge/BridgeManager.ts`, `src/mobile/network/types.ts`.

## Hot Modules (fan-in/out signals)
- Highest fan-in: `src/logger.ts` (29), `src/mobile/bridge/contracts.ts` (7), `src/mobile/bridge/BridgeManager.ts` (5).
- Highest fan-out inside scope: `src/mobile/MainScreen.tsx` (5), `src/mobile/network/BffClient.ts` (3), `src/mobile/saveLoad/SaveLoadService.ts` (3).

## Static Execution Trace
1. **App bootstrap** – `MainScreen` `useEffect` enqueues `app:init` and instantiates `SelectionOverlayController` → controller references `bridge` + `setSelectionOverlay`.
2. **User submit path** – `handleSubmit` guards `input`/`isStreaming`, calls `bffClient.ensureSession`, generates `clientTurnId`, logs/records telemetry, enqueues `chat:startMessage`, then calls `forwardStream` with the pending handle.
3. **Streaming loop** – `forwardStream` awaits handle promise, iterates over `stream` async iterator, dispatches `bridge.enqueue` payloads for `chat:update`, `chat:completeMessage`, `footer:update`; on `status` events it updates telemetry/footer; on `error` logs + resets `isStreaming`.
4. **WebView events** – `handleWebViewMessage` parses JSON and routes to `SelectionOverlayController.handleWebMessage`, `SaveLoadService.handleWebMessage`, `telemetryManager.record`, or `onWebViewEvent` callback; footer state updated when `footer:update` arrives.
5. **Selection overlay actions** – `SelectionOverlay` view calls `selectionControllerRef.current.invoke` or `dismiss`; `invoke` logs action, enqueues `selectionSensei:invoke`, then clears selection state.
6. **Save/Load flows** – `handleSave`/`handleImport` call `SaveLoadService` methods; `exportSession` builds filename, registers promise via `createExportPromise`, enqueues `saveload:export`, waits for web payload, and writes via native adapter; `importSession` reads file and enqueues JSON upstream.
7. **Bridge queue** – `BridgeManager.enqueue` pushes to `queue` then `processQueue`; `processQueue` enforces throttle for `chat:update`, otherwise drains queue via `dispatch`, which invokes injected sender and logs; `flushAll` and `scheduleThrottle` manage timers.
8. **WebView shim** – `initializeWebviewBridge` assigns `nativeHandler`, resolves channel, attaches `message` listeners; `sendToNative` serializes `WebToRNMessage` to RN postMessage.
9. **Network client** – `BffClient.ensureSession` POSTs `/sessions`, caches `sessionId`; `submitTurn` POSTs turn, logs, returns stream handle via `createStream`; `createStream` opens WebSocket, pushes events into `AsyncEventQueue`, enqueues wrap-up payloads via `bridge`.
10. **Telemetry** – `TelemetryManager.toggle/record/flush` manipulate queue, storage, and post batched events; `restoreState` hydrates `enabled` flag at construction.

## Dependency & Side-Effect Table
| Function (File) | Key Dependencies | Side Effects | Risk / Notes |
| --- | --- | --- | --- |
| `forwardStream` (`src/mobile/MainScreen.tsx`) | `bridge.enqueue`, `telemetryManager.record`, async iterator from `BffClient.submitTurn` | React state (`isStreaming`, `footer`), emits multiple bridge payloads | Needs resilient handling of mixed `status/error` events to avoid stuck UI.
| `handleSubmit` (`src/mobile/MainScreen.tsx`) | `bffClient.ensureSession`, `telemetryManager.nextClientTurnId/record`, `forwardStream` | Clears input, toggles streaming flag, network POST | Guarding `isStreaming` prevents duplicate turns; relies on `ensureSession` throwing on auth issues.
| `handleWebViewMessage` (`src/mobile/MainScreen.tsx`) | `JSON.parse`, `SelectionOverlayController.handleWebMessage`, `SaveLoadService.handleWebMessage`, `telemetryManager.record` | Mutates `footer` state, cascades events to services | Parse errors are swallowed with logger only; malformed payloads silently drop.
| `SelectionOverlayController.invoke` (`src/mobile/SelectionOverlay.tsx`) | `logger`, `bridge.enqueue`, internal `dismiss` | Sends `selectionSensei:invoke`, wipes controller state | Requires `selectionId` to exist; concurrent selection updates could race.
| `BridgeManager.processQueue` (`src/mobile/bridge/BridgeManager.ts`) | `this.schedule`, `dispatch` | Mutates queue, throttle timer, timestamp tracking | Single-threaded guard via `flushing`; reliance on `lastChatUpdateDispatched` for throttling.
| `BridgeManager.dispatch` (`src/mobile/bridge/BridgeManager.ts`) | `sender`, `logger` | Emits RN messages, logs success/failure | Exceptions caught and logged but messages drop silently.
| `initializeWebviewBridge` (`src/mobile/webviewBridge.ts`) | DOM `window`/`document`, `handleIncoming` | Registers global listeners, stores handler globals | No teardown; repeated calls accumulate listeners.
| `sendToNative` (`src/mobile/webviewBridge.ts`) | `resolvePostMessage`, `postMessageFn`, `logger` | Serializes payloads to RN, logs | Silent no-op if channel missing; risk of lost messages on slow boot.
| `submitTurn` (`src/mobile/network/BffClient.ts`) | `fetchImpl`, `ensureSession`, `createStream`, `logger` | Network POST, returns `AsyncIterable` tied to WebSocket | Throws on non-OK response; relies on `createStream` to surface downstream errors.
| `createStream` (`src/mobile/network/BffClient.ts`) | `WebSocketImpl`, `AsyncEventQueue`, `bridge.enqueue` | Opens WebSocket, pushes events into queue, may enqueue wrap-up UI events | Needs cleanup when `WebSocketImpl` absent; currently returns error stream.
| `exportSession` (`src/mobile/saveLoad/SaveLoadService.ts`) | `fileAdapter`, `bridge.enqueue`, `createExportPromise` | Builds pending resolver maps, writes file | Pending map never times out; export deadlocks if web never responds.
| `handleWebMessage` (`src/mobile/saveLoad/SaveLoadService.ts`) | `pendingResolvers` maps | Resolves promises, logs | Missing branch for rejected exports; errors swallowed.
| `toggle/record/flush` (`src/mobile/telemetry/TelemetryManager.ts`) | `storage`, `fetchImpl`, `logger` | Persist enable flag, mutate queue, POST telemetry | Failed flush re-queues events but may reorder; needs backoff.

## Risk Register
1. **Bridge queue throttling** – Dropped or delayed `chat:update` messages if `lastChatUpdateDispatched` fails to update under concurrent enqueues. *Plan:* Inspect queue state transitions during review; ensure tests/logs cover throttle edges.
2. **Export promise leaks** – `SaveLoadService.exportSession` never times out pending requests; a missing `saveload:exportResult` leaves resolver maps populated. *Plan:* Review diff for timeout/retry handling or flag as gap.
3. **WebView listener duplication** – `initializeWebviewBridge` re-adds DOM listeners on every call without cleanup, risking duplicate events. *Plan:* Verify diff avoids repeated initialization or introduces teardown.
4. **WebSocket error surfacing** – `BffClient.createStream` pushes generic `DOWNSTREAM_UNAVAILABLE`; ensure review changes do not mask richer error codes. *Plan:* Check hunks touching network layer for improved metadata.
5. **Telemetry persistence** – `TelemetryManager.toggle/flush` depends on optional storage; confirm review ensures RN storage implementation exists when feature used.

## Unknowns & Verification Plans
| Unknown / Rationale | Impact | Verification Plan | Owner / Target |
| --- | --- | --- | --- |
| How the native sender injected into `BridgeManager` enforces ordering when React Native is backgrounded. | Medium | During review verify any changes touching sender respect queue semantics; trace `bridge.enqueue` call sites. | Reviewer – before verdict |
| Availability of `WebSocket` in iOS RN environment for `BffClient.createStream`. | Medium | Inspect review for fallbacks (polyfills or native module). If absent, flag risk. | Reviewer – during hunk review |
| Native file adapter contract for save/load (requestId format, error propagation). | Medium | Ensure hunks touching save/load mention adapter guarantees; otherwise request documentation/tests. | Reviewer – during hunk review |

## Coverage Checklist
- `src/mobile/MainScreen.tsx`: `useEffect` init, `handleSubmit`, `forwardStream`, `handleWebViewMessage`.
- `src/mobile/SelectionOverlay.tsx`: controller `handleWebMessage`, `invoke`, `dismiss`.
- `src/mobile/bridge/BridgeManager.ts`: `enqueue`, `processQueue`, `scheduleThrottle`, `dispatch`.
- `src/mobile/webviewBridge.ts`: initialization and `sendToNative` pathways.
- `src/mobile/network/BffClient.ts`: `ensureSession`, `submitTurn`, `createStream`.
- `src/mobile/saveLoad/SaveLoadService.ts`: `exportSession`, `importSession`, web-message handling.
- `src/mobile/telemetry/TelemetryManager.ts`: `toggle`, `record`, `flush`, `restoreState`.

## Architectural Insights
- Bridge + WebView pipeline is strictly single-threaded; any latency is governed by `minChatUpdateInterval`, so changes must avoid blocking the queue.
- `MainScreen` centralizes a large amount of orchestration logic; review changes should minimize further coupling (consider extracting hooks/controllers for testability).
- Save/Load and Selection overlays rely on `bridge.enqueue` so schema changes must stay mirrored between RN and web clients.
- Telemetry and streaming clients share `logger` instrumentation patterns (`[MOBILE_PORT]` tag) that reviewers can leverage for observability expectations.

## Next Protocol
- Proceed with **Code Review Flow (HTML artifact via `npm run review:edit`)** per code_review_policy. No Feature/Bug/Architecture protocol is triggered because the mission is review-only (no repo modifications planned).

## Test Traceability Notes
- Potential automated coverage would need to mock `BridgeManager`, `BffClient`, `fileAdapter`, and `WebSocket` to exercise streaming/save-load flows.
- Entry points validated in this analysis map to RN component tests or integration harnesses that import `src/mobile/MainScreen.tsx`, ensuring telemetry toggles and selection actions are covered alongside bridge messages.

# Mission State – Mobile iOS Port Phase 1 Review (2025-11-12 05:40 UTC)

## Analyzer Snapshot
- `npm run analysis:run` executed 2025-11-12T05:40Z; artifacts refreshed under `tmp/analysis/*`.
- Hot modules via fan-in/out: `src/logger.ts`, `src/model_usage.ts`, `src/adaptiveEngine.ts`, `src/curriculum.ts`, `src/ui.ts`, `src/index.tsx`, and mobile bridge touchpoints (`src/mobile/webviewBridge.ts`, `src/mobile/bridge/contracts.ts`).

## 1. Entry Points & Scope
1. `src/index.tsx:1732` – initializes the mobile webview bridge and contains `handleReactNativeMessage` dispatch logic.
2. `src/mobile/webviewBridge.ts:5-52` – bridge bootstrap (`resolvePostMessage`, event listeners, `sendToNative`).
3. `src/mobile/bridge/contracts.ts` – enumerates RN/Web message schemas that govern switch cases.
4. `src/saveloadProgressManager.ts:110-220` – handles serialization invoked by RN messages.
5. `src/selectionSensei.ts:1751-1754` – exposes `invokeSelectionSenseiBridgeAction` used by RN message handling.
6. Supporting modules observed in imports: `src/mobile/saveLoad/SaveLoadService.ts`, `src/mobile/network/BffClient.ts`, `src/mobile/telemetry/TelemetryManager.ts` (downstream effects for telemetry + persistence).

## 2. Static Execution Trace
1. `src/index.tsx` global bootstrap → `initializeWebviewBridge(handleReactNativeMessage)` once DOM/window available.
2. `initializeWebviewBridge` assigns `nativeHandler`, calls `resolvePostMessage`, registers `window/document` message listeners.
3. `resolvePostMessage` fetches `window.ReactNativeWebView.postMessage` reference and caches `postMessageFn`.
4. Incoming RN message triggers `handleIncoming` → `nativeHandler` (currently `handleReactNativeMessage`).
5. `handleReactNativeMessage` dispatches by `message.type`:
   - `saveload:export` → `SaveLoadProgressManager.exportSessionAsJson` → `sendToNative(saveload:exportResult)`.
   - `saveload:import` → `SaveLoadProgressManager.restoreFromSerializedJson` → `sendToNative(saveload:importResult)`.
   - `selectionSensei:invoke` → `invokeSelectionSenseiBridgeAction`.
   - `telemetry:configure` → toggles `window.__telemetryEnabled`.
6. `sendToNative` ensures `postMessageFn`, serializes payload, and calls `ReactNativeWebView.postMessage`.

## 3. Dependency & Side-Effect Table
| Function (file:line) | Dependencies | Side Effects | Risk |
| --- | --- | --- | --- |
| `initializeWebviewBridge` (`src/mobile/webviewBridge.ts:28`) | `window.ReactNativeWebView`, DOM `addEventListener`, `nativeHandler` injection | Sets global handler, registers listeners without teardown | Medium – missing teardown causes duplicate listeners across hot reloads. |
| `handleIncoming` (`src/mobile/webviewBridge.ts:12`) | `JSON.parse`, `nativeHandler` callback | Parses arbitrary strings, dispatches to handler; logs on parse failure | Medium – parse exceptions handled, but no max payload guard. |
| `sendToNative` (`src/mobile/webviewBridge.ts:35`) | Cached `postMessageFn`, `logger` | Serializes messages, posts to native, logs failures | Medium – silently returns if RN channel unavailable, so native may miss critical replies. |
| `handleReactNativeMessage` (`src/index.tsx:1735`) | `SaveLoadProgressManager`, `sendToNative`, `invokeSelectionSenseiBridgeAction`, `window.__telemetryEnabled` flag | Executes save/load, selection bridge actions, telemetry toggles | High – async errors partially swallowed (only logs), no per-request timeout or ack correlation besides requestId. |
| `SaveLoadProgressManager.exportSessionAsJson` (`src/saveloadProgressManager.ts:110`) | `validateSerializedData`, `collectSessionData`, global `window` state | Walks entire UI/runtime state; can throw on validation; heavy JSON creation | High – large JSON stringification under potential RN timeouts. |
| `SaveLoadProgressManager.restoreFromSerializedJson` (`src/saveloadProgressManager.ts:169`) | `deserializeFromSave`, `restoreSessionData`, curriculum/notepad state | Mutates in-memory curriculum, learner model, DOM; reinitializes SelectionSensei asynchronously | High – invalid JSON or incompatible versions bubble as generic errors to RN. |
| `invokeSelectionSenseiBridgeAction` (`src/selectionSensei.ts:1751`) | `currentSelectionSenseiInstance` (global) | Invokes UI action based on actionId | Medium – null guard prevents crash but no validation of action IDs. |

## 4. Risk Register
1. **Bridge listener lifecycle (Medium):** `initializeWebviewBridge` never removes listeners; repeated initialization (e.g., hot reload) could duplicate handlers and double-send messages. *Verification:* Add bridge teardown on unmount and unit test for single dispatch.
2. **Silent send failures (Medium):** `sendToNative` returns early if `postMessageFn` cannot be resolved, but callers (e.g., save/load responses) assume success, potentially stalling RN UI. *Verification:* Instrument telemetry to detect missing acknowledgments and enforce retry/backoff.
3. **Save/import blast radius (High):** `restoreFromSerializedJson` applies entire session with minimal sandboxing; malformed JSON leads to thrown error but no user-friendly error propagation beyond `sendToNative` fallback. *Verification:* Add schema validation tests and integration coverage for corrupt payloads.

## 5. Unknowns Register
| Statement | Impact | Verification Plan |
| --- | --- | --- |
| Do RN clients ever send `app:init`/`wrapup:*` messages that are not handled in `handleReactNativeMessage`? | Medium – unhandled types currently noop silently. | Inspect RN side emitter definitions (`mobile/native` repo) or extend switch with logging metrics to capture unknown message types. |
| How is `window.__telemetryEnabled` consumed elsewhere? | Low – toggle may be redundant if telemetry manager reads different flag. | Trace references via `rg \"__telemetryEnabled\"` and confirm hooking before enabling feature. |
| Does `invokeSelectionSenseiBridgeAction` handle invalid action IDs gracefully within instance? | Medium – missing guard could throw within instance handler. | Review `SelectionSensei` implementation, add tests for invalid action IDs, ensure `handleBridgeInvoke` sanitizes input. |

## 6. Coverage Checklist
- `src/mobile/webviewBridge.ts`: `initializeWebviewBridge`, `handleIncoming`, `sendToNative` (listener lifecycle, missing RN channel, JSON errors).
- `src/index.tsx:1732-1780`: `handleReactNativeMessage` cases for save/export/import/telemetry/selection sensei.
- `src/saveloadProgressManager.ts`: `exportSessionAsJson`, `restoreFromSerializedJson` including validation failures.
- `src/selectionSensei.ts:1751`: `invokeSelectionSenseiBridgeAction` invalid inputs.
- End-to-end RN ↔ web message exchange (mock `window.ReactNativeWebView`).

## 7. Architectural Insights
- Webview bridge currently runs entirely in browser thread with no cleanup hooks, so mobile embedding must ensure single initialization.
- Save/load pathways reuse desktop logic; RN bridge simply proxies JSON—latency-sensitive operations should be profiled.
- Message contract centralization (`src/mobile/bridge/contracts.ts`) is solid; RN types should remain source of truth for test fixtures.

## 8. Clarifications
User has indicated no interactive responses; proceeding under assumption that Phase 1 review focuses on correctness and completeness of RN bridge integration without new feature scope changes.

## 9. Next Protocol
Core analysis complete. Ready to proceed with **Code Review Policy workflow** for `review_mobile_ios_port_phase1_codex` artifact as the governing protocol for this mission.

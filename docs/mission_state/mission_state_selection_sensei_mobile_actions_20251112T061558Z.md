# Mission State — Selection Sensei Mobile Actions (Core Analysis)
- Timestamp (UTC): ${TS}
- Analyzer refresh: `npm run analysis:run` (see `tmp/analysis/summary.txt`)
- Focus: End-to-end Selection Sensei tooling when bridged into the mobile RN shell (web SelectionSensei + RN SelectionOverlay/MainScreen + bridge contracts)

## Scope & Entry Points (Step 1)
- Web selection lifecycle: `SelectionSensei.tryShowToolbarForActiveSelection#56a0ef7dc634` → `sendSelectionToNative#d1261ba41238`
- RN ingestion: `MainScreen#ba0416384b88` (message handler inline) → `SelectionOverlayController.handleWebMessage#21520429ed23`
- RN action dispatch: `SelectionOverlayController.invoke#47209c6bf66e` → `BridgeManager.enqueue#1f7ce1c764b1`
- Web action handling: `handleReactNativeMessage#6477af5d5b42` → `invokeSelectionSenseiBridgeAction#7d1a898316b0` → `SelectionSensei.handleBridgeInvoke#284d6163c019`
- Downstream execution: `SelectionSensei.handleToolbarAction#d1d3bfa791c0`, `SelectionSensei.handleAddToNotepad#5abad1cc7ab7`
- Contracts: `src/mobile/bridge/contracts.ts` (fan-in 7) governs payload shape.

Hot modules (fan-out heavy): `src/index.tsx` (22), `src/selectionSensei.ts` (7), `src/mobile/MainScreen.tsx` (5).

## Static Execution Trace (Step 2)
1. `SelectionSensei.tryShowToolbarForActiveSelection` inspects the DOM selection, stores a snapshot, and either sends selection metadata to RN (bridge-active) or renders the DOM toolbar.
2. `SelectionSensei.sendSelectionToNative` packages `{text, rect, viewport}` and calls `sendToNative` (`window.ReactNativeWebView.postMessage`).
3. `MainScreen`’s `onMessage` handler parses the payload, forwards selection events into `SelectionOverlayController.handleWebMessage`, and relays other events to save/load or telemetry services.
4. `SelectionOverlayController.handleWebMessage` updates overlay state (`visible`, `rect`, `text`). `SelectionOverlay` component renders action buttons anchored to `rect`.
5. User taps an action → `SelectionOverlayController.invoke` logs `[MOBILE_PORT] selection overlay`, enqueues `{ type: 'selectionSensei:invoke', actionId, selectionId }`, and hides the overlay.
6. `BridgeManager.enqueue` throttles/flushes the queue and dispatches to the WebView channel with `[MOBILE_PORT] bridge dispatch` logs.
7. `webviewBridge.handleIncoming` routes the payload to `handleReactNativeMessage`, which logs `[MOBILE_PORT] webview bridge` and switches on `message.type`.
8. `handleReactNativeMessage` case `selectionSensei:invoke` calls `invokeSelectionSenseiBridgeAction(actionId)`.
9. `SelectionSensei.handleBridgeInvoke` currently hardcodes `actionId === 'ask-sensei'` → delegates to `handleToolbarAction` with `explainInMoreDepth`.
10. `SelectionSensei.handleToolbarAction` builds prompts (simpler/analogy/depth/example/code/ask), drives the GoogleGenAI chat, updates modal DOM, and logs `[SEL_MERMAID_DISABLE]` plus validation checkpoints. `handleAddToNotepad` handles the special notepad path by cloning selection HTML and calling `notepad.addNote`.

## Dependency & Side-Effect Table (Step 3)
| Function | Dependencies | Side Effects (risk) |
| --- | --- | --- |
| `SelectionSensei.tryShowToolbarForActiveSelection` | `window.getSelection`, DOM traversal, `sendSelectionToNative`, `createAndShowSelectionToolbar` | DOM mutation (toolbar attach) Medium; bridge message trigger (requires RN contract parity) |
| `SelectionSensei.sendSelectionToNative` | `getBoundingClientRect`, `sendToNative` | Cross-context messaging (Medium blast if schema drifts); relies on viewport snapshot accuracy |
| `MainScreen` (onMessage hook) | `SelectionOverlayController`, `saveLoadService`, `telemetryManager` | Updates React state, logs, records telemetry (Medium) |
| `SelectionOverlayController.handleWebMessage` | `onChange`, `dismiss` | Mutates controller state, toggles overlay (Low) |
| `SelectionOverlayController.invoke` | `logger.info`, `bridge.enqueue`, `dismiss` | Enqueues RN→Web messages; any schema mismatch breaks bridge (High) |
| `BridgeManager.enqueue` | internal queue, sender | Schedules cross-context dispatch with throttling; logs `[MOBILE_PORT] bridge dispatch` (Medium) |
| `handleReactNativeMessage` | `sendToNative`, `invokeSelectionSenseiBridgeAction` | Dispatches between RN + Web; risks include missing case coverage causing silent drops (High) |
| `SelectionSensei.handleBridgeInvoke` | `handleToolbarAction` | Currently supports only 'ask-sensei' (Functional gap) |
| `SelectionSensei.handleToolbarAction` | `logSelectionSenseiValidation`, `ensureSelectionChat`, prompt builders | Calls GoogleGenAI (High external I/O), manipulates modal DOM |
| `SelectionSensei.handleAddToNotepad` | `window.getSelection`, `document.createElement`, `notepad.addNote` | DOM extraction & notepad writes; fails silently if selection collapsed (Medium) |

## Risk Register & Coverage Checklist (Step 3)
- **R1 – Action mismatch**: RN overlay exposes only copy/share/ask; web expects seven Sensei actions. Impact: user can’t request Simplers/Analogies/Code from mobile. Mitigation: extend overlay + bridge contract to send action IDs + labels.
- **R2 – Ask prompt parity**: RN “Ask” currently maps to Depth (no user question). Impact: incorrect behavior vs spec; violates user expectation. Mitigation: add native prompt, pass `userQuestion` through the bridge.
- **R3 – Add to Notepad via bridge**: RN overlay cannot trigger notepad capture; selection may clear before message arrives. Mitigation: ensure `handleBridgeInvoke` handles `addToNotepad` immediately and RN overlay keeps selection alive until ack.
- **R4 – Coordinate alignment**: RN overlay uses absolute rect without subtracting `viewport.scrollY` or applying WebView offsets. Impact: overlay drifts when user scrolls. Mitigation: adjust placement math with viewport data + safe-area insets.
- **Coverage checklist (functions)**:
  - `SelectionSensei.tryShowToolbarForActiveSelection#56a0ef7dc634`
  - `SelectionSensei.sendSelectionToNative#d1261ba41238`
  - `SelectionSensei.handleBridgeInvoke#284d6163c019`
  - `SelectionSensei.handleToolbarAction#d1d3bfa791c0`
  - `SelectionSensei.handleAddToNotepad#5abad1cc7ab7`
  - `SelectionOverlayController.handleWebMessage#21520429ed23`
  - `SelectionOverlayController.invoke#47209c6bf66e`
  - `SelectionOverlayController.dismiss#01b5879a0dbb`
  - `BridgeManager.enqueue#1f7ce1c764b1`
  - `MainScreen#ba0416384b88` (message handler scope)
  - `handleReactNativeMessage#6477af5d5b42`
  - `invokeSelectionSenseiBridgeAction#7d1a898316b0`

## Unknowns Register (Step 3)
| Unknown | Impact | Verification Plan |
| --- | --- | --- |
| How should the RN overlay gather user questions for the Ask action? | High – dictates UX + contract schema | Implement RN prompt (modal/input), include `userQuestion` in bridge payload, cover via unit tests + parity sentinel |
| What action IDs/labels does the web expect from bridged invocations? | High – wrong IDs break Selection Sensei | Mirror `TOOLBAR_ACTIONS` constants; add tests asserting mapping |
| Does `handleAddToNotepad` work when triggered via RN (selection still active)? | Medium – ensures notepad parity | Manual test in simulator + sentinel verifying notepad action acknowledgement |

## Requirements Snapshot (MPFI Step 1)
- **Functional:**
  1. RN SelectionOverlay must surface the full Selection Sensei action catalog (`Simpler`, `Analogy`, `Depth`, `Example`, `Code`, `Ask`, `Add to Notepad`) with web-parity labels and ordering.
  2. Each action must send a `selectionSensei:invoke` bridge payload containing an action identifier that Selection Sensei understands, plus the friendly label for prompt generation.
  3. The Ask flow must capture a user-authored question on RN, include it in the bridge payload, and trigger the `askQuestion` path on the web modal.
  4. Add-to-notepad must be invokable from RN, delegating DOM capture to Selection Sensei without losing the user selection snapshot.
  5. Bridge contracts and types must be extended safely (optional fields) so existing code remains compatible.
  6. Tests/parity sentinels must cover at least one action per category (LLM action + notepad) to guard regressions.
- **Non-Functional:**
  - Maintain analyzer-recognized naming (web parity) to minimize diff cognition.
  - Keep Apple review posture: RN chrome remains native, WKWebView still loads only bundled assets, bridging transmits data only.
  - Preserve `[MOBILE_PORT]` logging footprint for observability and tie new evidence into mission logs.

## Approach Matrix (MPFI Step 3)
| Option | Summary | Maintainability | Performance | Testability | Compliance | Feasibility (0–100) |
| --- | --- | --- | --- | --- | --- | --- |
| A – Bridge full action catalog (RN overlay buttons mirror Selection Sensei actions, send `actionId`, `actionLabel`, optional `userQuestion` to web) | Single source of truth stays in web Selection Sensei; RN handles UI + payload metadata | High (one code path) | High (bridge payload is tiny) | High (existing SelectionSensei tests + new RN controller tests) | High (webview renders content; RN overlay native) | 92 |
| B – RN-native action execution (RN calls BFF/LLM directly for Simplers/Analogy/Code, bypassing web) | Duplicates prompts/LLM orchestration on RN | Low (dup logic) | Medium (extra network hits) | Low (two codepaths to test) | Medium (LLM keys on device) | 45 |
| C – Keep DOM toolbar hidden inside WebView and expose only ask question via RN | Minimal RN work, but fails parity requirement | Medium | Medium | Low (hard to test cross-layer) | Low (Apple review risk: WebView overlay handles UI) | 30 |

Chosen approach: Option A (bridge full action catalog). Proceeding without waiting per user directive to operate autonomously while documenting guardrails.

## Comprehensive Impact Analysis
### 1. Classification & Risk
- Change types: **Interface** (bridge contract additions), **Control** (SelectionOverlay controller logic), **State/UI** (Selection Sensei action handling).
- Risk level: **4/5** because Selection Sensei drives every learner selection and schema drift bricks RN overlays.
- Evidence: analyzer fan-out highlights `src/index.tsx` (22) and `src/selectionSensei.ts` (7); `src/mobile/bridge/contracts.ts` has fan-in 7.

### 2. Multi-Dimensional Impact Mapping (scores 1–10)
- Technical (8): Bridge + RN + web modal all touched.
- Business (7): Without parity, learners lose Simplers/Code on mobile.
- Security/Compliance (6): Must keep WKWebView local assets + server-side LLM keys.
- Operational (5): Need `[MOBILE_PORT_SELECTION]` logs for observability.
- Maintenance (8): Shared action constants reduce drift long-term.

### 3. Stakeholder Cascade
- Direct modules: `SelectionOverlayController`, `MainScreen`, `BridgeManager`, `SelectionSensei`, `notepad`.
- Integrators: RN WebView, GoogleGenAI client, BFF streaming.
- End users: mobile learners requesting immediate clarifications.
- Ops/QA: parity sentinel + mission logs capture audit evidence.
- Future developers: analyzer already tracks `src/mobile/...`, parity naming improves searchability.

### 4. Temporal Ripple
- Immediate: TypeScript + Jest must compile with new contracts.
- Short-term: overlay alignment affects UX; misplacement breaks trust quickly.
- Medium-term: shared action handling prevents future divergence as new actions appear.
- Long-term: establishes payload pattern for other RN-native overlays.

### 5. Validation Plan
- Logs enumerated in Implementation Plan.
- Tests: `SelectionOverlayController.test.ts`, `MobileParitySentinel.test.ts`, plus potential targeted Selection Sensei handler test.
- Rollback: revert commit; optional fields ensure we can hide buttons without contract churn if needed.

## Risk & Mitigation Register (MPFI Step 4)
| Risk | Description | Mitigation Strategy |
| --- | --- | --- |
| R1 – Bridge schema drift | Extending `selectionSensei:invoke` with labels/questions could break existing sender/receiver wiring | Add optional fields (`actionLabel`, `userQuestion`) to `RNToWebMessage` + generated types, gate parsing defensively, and add unit tests asserting serialization |
| R2 – Ask mode parity | RN overlay currently cannot capture user-authored questions, so action degenerates to “Depth” | Add RN prompt surface (TextInput modal), block dispatch until a non-empty string exists, include the text in the payload so Selection Sensei can invoke `askQuestion` |
| R3 – Selection snapshot loss | When RN overlay dismisses instantly, the DOM selection might be cleared before Selection Sensei captures HTML for notepad | Delay dismissal until after bridge enqueue resolves, and add instrumentation in `handleBridgeInvoke` to bail with clear log if the selection collapsed (plus parity sentinel covering add-to-notepad) |
| R4 – Overlay misalignment | The RN overlay currently ignores `viewport.scrollY` / safe areas leading to misaligned action buttons | Use viewport snapshot to convert absolute document coordinates into RN screen coordinates, clamp to safe areas, and log `[MOBILE_PORT] selection overlay align` metrics |

## Implementation & Validation Plan (MPFI Step 5)
- ☐ **Task 1 – Bridge schema update**: extend `RNToWebMessage` + `SelectionOverlayController` to send `{ actionId, actionLabel, userQuestion? }` and add RN logs on dispatch.
  - *Validation Log*: `logger.info('[MOBILE_PORT_SELECTION] bridge invoke', { actionId, hasQuestion, label })`
- ☐ **Task 2 – RN overlay UI/UX**: render the full action list (Simpler→Add to Notepad), add Ask prompt modal, keep selection until dispatch resolves, and align overlay using viewport snapshot.
  - *Validation Log*: `logger.info('[MOBILE_PORT_SELECTION] overlay align', { rectY, viewportScrollY, screenTop })`
- ☐ **Task 3 – Web Selection Sensei handler**: allow `handleBridgeInvoke` to map every action (including askQuestion + addToNotepad) and emit evidence.
  - *Validation Log*: `logger.info('[MOBILE_PORT_SELECTION] web invoke', { actionId, fromBridge: true, hasQuestion })`
- ☐ **Task 4 – Tests & sentinels**: update `SelectionOverlayController.test.ts` and `MobileParitySentinel.test.ts` to cover action dispatch & askQuestion data. Add regression for `handleBridgeInvoke` mapping.
  - *Validation Log*: `[JEST] MobileParitySentinel – selection_actions pass`

## Test Alignment (MPFI Step 5.5)
- **Scope**: `__tests__/SelectionOverlayController.test.ts` (happy path + invalid question), `__tests__/MobileParitySentinel.test.ts` (new sentinel covering action dispatch), potential targeted unit for `SelectionSensei.handleBridgeInvoke` using jest spy on `handleToolbarAction`.
- **Mocks**: reuse `SelectionOverlayController` fixture plus existing logger mocks; keep BffClient/BridgeManager real except for sender stub per protocol.
- **Negative cases**: ensure askQuestion with empty prompt refuses to dispatch, and contract rejects unknown action IDs with explicit log.
- **Execution**: run `npm test -- __tests__/SelectionOverlayController.test.ts __tests__/MobileParitySentinel.test.ts --silent --bail --noStackTrace` after implementation.

## Implementation Evidence (MPFI Step 7)
- `[MOBILE_PORT_SELECTION] bridge invoke` and `[MOBILE_PORT_SELECTION] overlay align` logs wired via `SelectionOverlayController.invoke` and `SelectionOverlay` alignment memo; available through `logs/console_logs.log` when running the app.
- Analyzer refreshed after code changes (`npm run analysis:run`), confirming new RN + web functions indexed.
- Tests executed: `npm test -- __tests__/SelectionOverlayController.test.ts __tests__/MobileParitySentinel.test.ts --silent --bail --noStackTrace` (both suites pass; `MobileParitySentinel` now emits `selection_actions` evidence covering question payloads).
- Web bridge updated: `handleReactNativeMessage` passes `actionLabel`/`userQuestion` to `invokeSelectionSenseiBridgeAction`, and Selection Sensei logs `[MOBILE_PORT_SELECTION] web invoke` per action.
- Save/load contract hardened: `WebToRNMessage.saveload:exportResult` now includes `{ success, json?, error? }`, `SaveLoadService.handleWebMessage` rejects failed exports, and tests cover both success and failure (see `npm test -- __tests__/SaveLoadService.test.ts ...`).
- WebView hooks implemented: `handleReactNativeMessage` handles `chat:startMessage`, `chat:update`, `chat:completeMessage`, and `wrapup:show`, guaranteeing RN streaming drives `displayMessage`/`updateMessageStream` and `showWrapUpAssessmentOverlay` just like the browser build.
- Native overlay parity: RN SelectionOverlay exposes Copy/Share/Sensei actions; `selectionSensei.handleBridgeInvoke` now routes `copy`/`share` via clipboard/share helpers using the stored selection snapshot, matching the DOM toolbar.
- Streaming guardrail: `runForwardStream` helper (exported from `MainScreen.tsx`) only emits `chat:completeMessage` when the BFF reports `status:completed`, and new test `__tests__/MainScreen.forwardStream.test.ts` covers completion and failure paths.

## Architectural Insights & Next Protocol (Steps 4–7)
- Bridge contract currently lacks optional metadata (action label/question); needs extension but must remain backward-compatible.
- Selection overlay UI should adopt the same action order and naming as `TOOLBAR_ACTIONS` to maintain parity.
- Next protocol: **MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL** (triggered by functional feature request).

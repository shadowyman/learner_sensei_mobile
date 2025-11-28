# Recursive Sensei – Mobile App Functional Specification (Phase 1: Web Parity)

Version: 1.3 (Draft)
Date: 2025-11-12
Owner: Product + Engineering

## 1. Purpose & Scope
- Deliver a native-quality iOS app using React Native that achieves functional parity with the existing web app’s learner experience, excluding Debug Mode (web-only).
- Minimize architectural scope for Phase 1 while maintaining security (server-side LLM keys; authentication deferred to Phase 2—Phase 1 endpoints are rate‑limited and unauthenticated) and enabling a clean path to later optimizations.
- Server persistence of progress is deferred. Phase 1 uses on‑device save files for parity with web. A backend BFF orchestrates LLM calls and pedagogy logic but does not store long‑term user progress.

Out of scope (Phase 1):
- Topic catalog UX beyond a single default subject
- Server-side progress/history storage; cloud save linking
- Notifications, analytics dashboards, admin tooling, Debug Mode
- Advanced performance optimization (caches/queues); to be staged later

## 2. Personas & Roles
- Learner. No login in Phase 1; authentication is deferred to Phase 2.
- No instructor/admin roles in the app.

## 3. Platforms & Devices
- iOS targets: iPhone and iPad; portrait and landscape supported.
- Minimum iOS version: iOS 16+.
- Split View/Slide Over: not supported in Phase 1 (full‑screen only). Keyboard appears on input focus (platform default).
- Android: deferred to later phases; this spec focuses on iOS.

### 3.1 Styling/Theming
- Match current web styling exactly in Phase 1. No platform theme toggles (e.g., iOS dark mode) unless the web already supports them.

## 4. Architecture Summary (Phase 1)
- React Native app (RN) implements all learner UI features present on web except Debug Mode.
- Unified BFF (Node/Nest) exposes minimal REST endpoints and a WebSocket streaming channel. Authentication is deferred to Phase 2; Phase 1 endpoints are temporarily unauthenticated but rate‑limited.
- Sensei Core (extracted TypeScript modules) runs on the BFF to compute curriculum advancement, learner model updates, teaching plan generation, and wrap‑up content.
- Persistence: no long‑term server storage in Phase 1. Session state is ephemeral in the BFF for the duration of the app usage; durable save/load is via on‑device save file.
- LLM keys and prompts remain server‑side (BFF/LLM proxy). Clients never hold keys.

## 4.1 Code Reuse & Extraction Policy (Phase 1)
- Reuse existing code by default. Extract all pure TypeScript logic from the web app into a shared package (Sensei Core) and consume it from both mobile and web. Do not re‑implement algorithms already present in  unless a platform API forces it.
- Server executes pedagogy/curriculum logic: BFF calls Sensei Core for teaching plan generation, learner model updates, instruction building, and wrap‑up content. Mobile never duplicates this logic; it only triggers the same pipeline.
- Client adapters only: React Native provides adapters for UI concerns (selection detection/overlay, message rendering, code editor modal, mermaid WebView) while calling the same endpoints and producing the same request metadata as the web client.
- New logic goes to Sensei Core first so both clients share it by design; the web app is gradually refit to consume the same package to avoid drift.
- Parity tests: define a small golden set of inputs (selection text, user turns) that produce identical instruction payloads and teaching-plan outputs between web and mobile paths.

## 4.2 Backend Workflow Conventions (Phase 1)
- Stateless BFF: endpoints are minimal and do not persist long‑term state in Phase 1; session state is ephemeral for the app lifetime.
- Idempotency: clients include `clientTurnId` with POST /sessions/{id}/turns. Retries with the same `clientTurnId` return the same `turnId` and do not duplicate work.
- Streaming lifecycle:
  - Step 1: client POST /sessions/{id}/turns → `{ turnId, streamUrl }`.
  - Step 2: client connects to WS `.../sessions/{id}/stream?turnId=...`.
  - Server emits: `status:started`, `chunk`, (optional enhancer/metadata events), and a terminal `status:completed` (or `error`). Keepalive pings sent every 15s.
  - Stall rule: if no data or ping ack for 25s (15s ping + 10s grace), server switches to buffered mode (no more chunks) and, when LLM finishes, sends a single final payload on the same WS (no resubmit). UI keeps the existing “Sensei is typing…” indicator (no extra styling) until the payload arrives.
  - On hard timeout (e.g., 60s) or LLM error, emit `{ type: "error", code, message }` and close.
- Metadata envelope on turns: `{ source: mobile|web, appVersion, selectionSensei?: { actionId, selectedText } }`.
- Limits: maximum input length 4000 characters. Reject larger payloads with 413 and UI prompt to shorten.
- Error codes (HTTP → WS mapping): `BAD_REQUEST(400)`, `RATE_LIMITED(429)`, `DOWNSTREAM_UNAVAILABLE(503)`, `TURN_TIMEOUT(504)`.
- Rate limiting: per‑IP/per‑UA cap of 3 turns per minute while auth is deferred.
- Logging: structured logs without sensitive tokens; truncate long inputs in logs; no LLM keys exposed.

## 5. User Flows & Functional Requirements
### 5.1 Authentication (Deferred)
- Authentication, tokens, and entitlements are deferred to Phase 2. Phase 1 launches directly into the subject without login.

### 5.2 Subject Entry (Phase 1 simplification)
- FR‑SUBJ‑1: After login, app loads a single default subject (e.g., Recursion) without topic catalog UI.
- FR‑SUBJ‑2: App calls `POST /sessions` (no server persistence required) to initialize server‑side Sensei Core state.

### 5.3 Teaching Loop & Streaming
- FR‑CHAT‑1: User sends a message; app posts `POST /sessions/{id}/turns` { input }.
- FR‑CHAT‑2: App opens `wss://…/sessions/{id}/stream?turnId=…` and renders incremental chunks in the message bubble.
- FR‑CHAT‑3: On stream completion, app updates footer/status as provided by the stream’s final snapshot.
- FR‑CHAT‑4: “Reload message” behavior (if present on web) is available after completion; no mid‑stream cancel is required in Phase 1.

Backend Workflow Notes:
- BFF invokes Sensei Core to run the same instruction/analysis pipeline as the web path.
- POST /sessions/{id}/turns requires `clientTurnId` for idempotency. Include `selectionSensei` metadata when applicable.
- WS stream emits chunks and a terminal status; client reconciles final text with enhancer updates as on web.

### 5.4 Selection Sensei
- FR‑SEL‑1: Selecting text automatically shows the Selection Sensei toolbox (no long‑press). Behavior matches web: the toolbox appears as soon as a selection is made.
- FR‑SEL‑2: Overlay actions generate requests that follow the same streaming display rules.
- FR‑SEL‑3: Suppress the native iOS edit menu for selected text. The Sensei toolbox includes Copy and Share alongside Sensei actions. Accessibility: expose VoiceOver‑readable actions (UIAccessibilityCustomActions) to ensure assistive users can copy/share and invoke Sensei tools.

Implementation Notes (Code Reuse & Adapters):
- Reuse existing pure logic from the web app:
  - Keep `src/selectionSenseiResponseParser.ts` unchanged (ported into the shared Sensei Core package).
  - Extract any pure helper functions from `src/selectionSensei.ts` (e.g., action derivation/formatting) into Sensei Core.
- Replace only DOM wiring:
  - RN implements the selection detector and overlay (toolbox) UI. Positioning/anchoring is native; logic is identical.
- Unified pipeline:
  - Toolbox actions submit via  with  so the backend runs the same instruction/build/stream path as web.
  - Streaming uses the same WS channel and enhancer behavior as standard turns.

### 5.5 Code Editor Modal
- FR‑CODE‑1: Code editor modal opens from a toolbar button.
- FR‑CODE‑2: Inserting code appends text into the chat input as on web; preserves formatting.
  - Implementation: match web editor font and behavior exactly (no RN‑specific variations).

### 5.6 Mermaid Diagrams
- FR‑MRM‑1: Mermaid renders client‑side inside a WebView by injecting the same mermaid runtime and theme logic used on web.
- FR‑MRM‑2: If rendering fails, show the recovery UI (equivalent to web’s mermaid error recovery) and present raw code fence as fallback.

### 5.5a Markdown, Footer & Notepad
- FR‑MD‑1: The chat body is rendered inside a single WKWebView using the same marked + marked‑katex stack and CSS as the web app.
- FR‑MD‑2: RN sends message updates via postMessage; WebView inserts/replaces DOM nodes. Streaming updates are throttled (≤10 updates per second) to avoid jank.
- FR‑MD‑3: KaTeX math uses the same configuration as web (throwOnError: false, mathml output). If KaTeX emits an error, the WebView marks the block and RN shows the raw fence with a “Math failed” notice.
- FR‑MD‑4: Selection/clipboard events from WebView trigger the same Selection Sensei overlay via JS bridge.
- FR‑MD‑5: WebView loads only bundled HTML/JS/CSS; navigation and remote script injection are blocked.
- FR‑MD‑6: Code blocks use the same syntax highlighting (highlight.js + CSS) as the web client within the WebView.
- FR‑FOOTER‑1: Show the confidence/confusion/intent footer exactly as on web. When the input is focused, display the numeric tooltip/labels continuously until the input loses focus (no timeout). Focus state is signaled from RN via the bridge; see Contracts v1.
- FR‑NOTEPAD‑1: Provide the same notepad UI as web (context header, add/edit entries, export/import via local file). Notepad state is always saved in the session data and included inside the main save file, matching the web schema.
- FR‑NOTEPAD‑2: Support standalone HTML export of notepad entries (same format as web) via the iOS share sheet.

### 5.5b Header & Controls
- FR‑HEADER‑1: Mirror the existing web header layout (brand segment, status segment, controls segment). Tapping the brand toggles the meditation overlay (replaces hover); tapping outside closes it. The “thinking” animation triggers during LLM activity just as on web.
- FR‑HEADER‑2: Status segment (Current Focus + concept/chunk arrows) behaves identically; status tap pins/unpins the meditation overlay.
- FR‑HEADER‑3: Controls ellipsis acts as a toggle (since hover isn’t available). All primary/secondary control buttons retain web behavior (font size cycle, theme selector, fullscreen, notepad, save, load). The theme palette anchors to the button on larger screens but may present as a modal sheet on small screens.
- FR‑HEADER‑4: Debug Mode button is omitted on mobile; all other controls remain accessible and close when tapping outside.

Backend Workflow Notes:
- Server does not render diagrams in Phase 1; mermaid text is passed through. Failures are handled client‑side using the same recovery logic as web.

Recovery Flow (Parity with Web):
- MRM‑REC‑1: Detection – WebView posts an `error` event (or `mermaid.parse` throws). RN records `messageId`, `code`, `errorHash`.
- MRM‑REC‑2: Repair request (attempt 1) – RN calls BFF `POST /mermaid/recover` with `{ messageId, code, theme, errorHash, errorMessage, mode:'auto' }`. The BFF applies deterministic fixes; if they change the diagram it returns that version, otherwise the same call falls through to an LLM attempt and returns the LLM result.
- MRM‑REC‑3: Re‑render – On `{ fixedCode }`, RN re‑invokes WebView render; if success, the diagram is replaced inline and telemetry logs `recovered:true`.
- MRM‑REC‑4: Additional retries – If rendering still fails or the first call returned `{ fixed:false }`, RN may issue up to **two** more `mode:'llm'` requests (maximum **three** total attempts per message). Each response is rendered in the WebView once; failures fall through to the next attempt.
- MRM‑REC‑5: Fallback – If all attempts fail or offline, keep raw code fence and show Retry inline.
- MRM‑REC‑6: Telemetry – Include `recoveryAttempt`, `fixed` flags in logs; no PII sent.

### 5.7 Key Takeaway Enhancer and Standard Enhancer
- FR‑ENH‑1: Standard “Enhance” per‑message button remains available (always visible on each bubble); tapping runs the enhancement flow and updates the rendered markdown.
- FR‑ENH‑2: Key Takeaway Enhancer remains feature‑flagged (off by default) and, when on, augments streaming output similarly to web.
  - Default: OFF in Phase 1.

Backend Workflow Notes:
- Standard Enhance: client requests enhancement for a specific message via POST `/sessions/{id}/enhance`. Server calls the same LLM routines as web and streams the enhanced markdown, preserving message ID.
- Key Takeaway Enhancer: when enabled, server augments the main stream using the same cached prompt hashing behavior as web.

### 5.8 Wrap‑Up Assessment
- FR‑WRAP‑1: Wrap‑up questions are generated by LLM (server‑side) and returned to the client.
- FR‑WRAP‑2: Scoring is client‑side: when the learner submits, the app computes correctness using the provided answer key and immediately shows per‑question feedback.
- FR‑WRAP‑3: No server write‑backs for scoring in Phase 1.

Backend Workflow Notes:
- Server generates questions (LLM) and returns them with answer keys. Client performs scoring locally and shows results; no server persistence in Phase 1.

### 5.9 Save / Load (Local File Parity)
- FR‑SAVE‑1: “Save” exports session state (curriculum state + learner model + recent history summary) to a local file via RN document picker.
- FR‑SAVE‑2: “Load” imports a local file, validates schema/version, and restores app state.
- FR‑SAVE‑3: Server does not store session history or progress in Phase 1. Cross‑device resume is not guaranteed until later phases.
  - Filename pattern: `Sensei_<topic>_<YYYYMMDD-HHMM>.json`.
  - Import behavior: importing a save file always creates a new local session (same schema as web) and does not overwrite the current one. The app switches the active session to the imported session.

Backend Workflow Notes:
- No server endpoints are required for persistence in Phase 1. Export/import is handled entirely on device.

### 5.10 Telemetry & Logging
- FR‑TEL‑1: Client emits telemetry events for key actions (turn submitted, stream completed, enhance used, wrap‑up submitted, mermaid recovery attempts, save/import). Payload includes anonymized device model, iOS version, app build, and non‑PII context.
- FR‑TEL‑2: Telemetry respects offline mode (queued and flushed when connected). No personally identifiable content or raw learner text logged.
- FR‑TEL‑3: Telemetry sampling is configurable; default sample rate is 50% of eligible events to limit volume while still providing coverage.
- FR‑TEL‑4: Provide a user-facing telemetry opt-out toggle (default ON) in Settings; when off, no telemetry events are sent.

### 5.10 Exactly One Active Session per Topic per User
- FR‑ONE‑1: The app enforces a single active session per topic locally (Phase 1 has one default subject). If a session exists in memory, new attempts replace or resume it.

Backend Workflow Notes:
- Not enforced server‑side in Phase 1; client enforces locally. Server enforcement moves to Phase 2.

## 6. Non‑Functional Requirements (Phase 1)
- NFR‑SEC‑1: LLM keys held server‑side; no keys or prompts in the app bundle.
- NFR‑SEC‑2: Temporary unauthenticated endpoints (until Phase 2); apply per‑IP/user‑agent rate limiting and basic abuse detection.
- NFR‑REL‑1: Streaming via WebSocket; reconnect/retry logic with exponential backoff.
- NFR‑PERF‑1: No strict budgets in Phase 1; the architecture must support horizontal scaling later.
- NFR‑OBS‑1: Structured logs for BFF and LLM proxy; client crash reporting enabled.
- NFR‑OBS‑2: Client telemetry (per FR‑TEL‑1) batches events and sends them securely; includes anonymized device metadata.
- NFR‑ACC‑1: Accessibility best‑effort; full WCAG compliance can be deferred. Include minimum VoiceOver labels and sufficient color contrast where feasible.
- NFR‑REUSE‑1: No intentional duplication of pedagogy/curriculum/analysis logic between mobile and web; changes land in the shared package and are consumed by both clients.

## 7. Error Handling & Fallbacks
- EH‑1: Common errors (400, 413, 429, 503, 504) render as Sensei message bubbles. Error codes and standard copy are normative in Contracts v1. (No separate banner styling.)
- EH‑2: If streaming drops, show “connection lost” message and allow retry.
- EH‑3: Mermaid failure: display raw code block with a “Try again” option.
- EH‑4: Enhancement failure: revert to baseline text; log event.
- EH‑5: Import failure: show validation errors and keep the current state intact.

## 8. Security & Integrity
- Backend validates request sizes and content; sanitizes markdown before rendering.
- Session IDs are required for correlation; JWT‑based authentication is not required in Phase 1 and is deferred to Phase 2.
- No client‑controlled fields affect entitlements or locked features.

## 9. Interfaces (Phase 1 Minimal)
### 9.1 REST
- POST `/sessions` → `{ sessionId, stateBootstrap }`
- POST `/sessions/{sessionId}/turns` → `{ turnId, streamUrl }`
 - POST `/mermaid/recover` → `{ fixedCode }`

### 9.2 WebSocket
- `wss:///sessions/{sessionId}/stream?turnId=…`
- Messages:
  - `{ type: "chunk", text, messageId, enhancer? }`
  - `{ type: "status", phase, footer, kcProgress? }`
  - `{ type: "wrapUp", payload }`
  - `{ type: "error", code, message }`
  - SSE fallback: not used in Phase 1.

### 9.3 Client‑Only Persistence Actions (Local)
- Export: triggers RN file system flow to write `Sensei_<topic>_<YYYYMMDD-HHMM>.json` via share sheet or document picker.
- Import: uses RN picker to load/validate a local file and creates a new local session; switches active session on success.

## 10. Data Model (Client Save File – Phase 1)
- Authoritative schema is Contracts v1 (SenseiSaveV2), aligned with the current web serializer (version "2.0.0").
- Filename pattern: `sensei_progress_<YYYY‑MM‑DDTHH‑mm‑ssZ>.json` (same as web).
- Import behavior: importing a save creates a new local session and switches to it; the previous session remains available.

## 11. Accessibility (Deferred with Minimums)
- Minimums: label interactive elements; ensure sufficient contrast on primary screens; support Dynamic Type where feasible. Full WCAG audit deferred.

## 12. Privacy & Compliance (Deferred)
- Data retention, GDPR/COPPA/FERPA analysis, analytics opt‑in/out to be specified in later phases.

## 13. Release & Store
- Crash reporting enabled; no ad tracking; age rating TBD at submission.
- Beta via TestFlight; Play Store planned for later phases.
- Telemetry opt-out toggle available in Settings (default ON), documented in the privacy policy.
- Crash reporting provider: Sentry (Phase 1). Crashes are sent silently (no user prompt) provided Apple guidelines remain satisfied; include this in the privacy policy.

## 14. Open Decisions / TBD
- Minimum iOS version (now fixed at iOS 16+).
- Whether “Reload message” is included in Phase 1 (web parity suggests yes; confirm exact UX copy on mobile).
- Any special iPad split‑screen constraints or keyboard shortcuts to include now vs later.

## 15. Acceptance Criteria (Phase 1)
- AC‑1 Launch: App opens directly into the default subject (auth deferred) and reaches the chat screen in one tap.
- AC‑2 Session Init:  returns ; WS stream connects successfully.
- AC‑3 Send/Stream:  yields ; first chunk renders; terminal  is received.
- AC‑4 Reload: Post‑completion “Reload message” works; no mid‑stream cancel required.
- AC‑5 Idempotency: Re‑posting the same  returns the original  and does not duplicate the turn.
- AC‑6 Errors: 400/429/503/504 map to user‑visible messages; user can retry without app crash.
- AC‑7 WS Resilience: Network drop triggers reconnect/backoff UX; keepalive every 15s; stalls switch to buffered mode and deliver a single final payload on the same WS (no retry path).
- AC‑8 Selection Sensei: Selecting text shows the toolbox immediately; native edit menu is suppressed; toolbox includes Copy/Share and Sensei actions; VoiceOver custom actions are available.
- AC‑9 Toolbox Positioning: Toolbox avoids overlap with selection; pill fallback appears when needed; verified on iPhone and iPad (portrait/landscape).
- AC‑10 Standard Enhance: Tapping Enhance streams updated markdown for the target message and preserves baseline text as needed.
- AC‑11 Key Takeaway (FF): With flag off, no augmentation; with flag on, augmentation mirrors web behavior (prompt hash reuse).
- AC‑12 Code Editor: Modal opens, inserts code into input, and preserves formatting on send.
- AC‑13 Mermaid Render: Valid diagrams render via local WebView to SVG using the same theme logic as web.
- AC‑14 Mermaid Recovery: For invalid code, RN invokes `/mermaid/recover` with `mode:auto` (heuristics, falls through to LLM if unchanged), then up to two `mode:llm` retries; max 3 attempts; success replaces in place.
- AC‑15 Mermaid Fallback: After retries fail, raw code fence + Retry shown; event logged.
- AC‑16 Wrap‑Up: LLM‑generated questions display; client‑side scoring shows immediate per‑question feedback; no server writes.
- AC‑17 Save Export: Export creates a local file (via document picker/share sheet) using the defined schema.
- AC‑18 Save Import: Import restores state; invalid files show validation error without altering current state.
- AC‑19 Single Session: Starting another session for the same topic replaces/resumes the local session; server does not enforce in Phase 1.
- AC‑20 No Secrets: No LLM keys in app binary; traffic shows calls only to BFF/LLM proxy.
- AC‑21 Logging/Crashes: Structured logs emitted; crash reporting active.
- AC‑22 Accessibility Minimums: Core screens meet contrast minimums; toolbox/buttons are VoiceOver‑readable; Dynamic Type respected where feasible.
- AC‑23 Reuse Parity: Golden tests confirm identical instruction payloads/teaching‑plan outputs between mobile and web for the same inputs.
- AC‑24 Input Limits: Inputs over the configured limit are rejected with a clear UI prompt (413) and no stream is opened.
- AC‑25 Rate Limit: Simulated overload returns 429; UI communicates wait/retry.
- AC‑26 Mermaid Telemetry: Recovery attempts and outcomes are logged; no PII recorded.
- AC‑27 WebView Safety: Only local HTML loads; navigation blocked; sanitized payloads prevent script injection.
- AC‑28 WS Keepalive: Client receives periodic keepalives; on stall, shows “slow connection” and receives the complete response in one message (no resubmit). Hard timeouts show an error.
- AC‑29 In‑Flight Guard: While a turn is in flight (streaming or buffered), the UI prevents resubmission/duplicate sends.
- AC‑30 QA Devices: Sign‑off tested on iPhone 12, iPhone 14, and iPad 10th gen in portrait and landscape.
- AC‑31 Markdown & KaTeX: Chat content renders via the WebView using marked + marked‑katex; inline math displays identically to web. KaTeX errors show the raw fence with “Math failed” notice.
- AC‑32 Selection Bridge: Selecting text inside the WebView triggers the RN Selection Sensei overlay with the same actions; Copy/Share/Enhance/Reload work via toolbox even though the native menu is suppressed.
- AC‑33 Footer Visibility: When the input is focused, the footer surfaces the numeric tooltips/labels equivalent to the web hover behavior.
- AC‑34 Notepad Parity: Mobile notepad supports the same fields, editing, and inclusion in the save file as the web version.
- AC‑35 Import New Session: Importing a save creates a new local session and switches to it; previous session remains available.
- AC‑36 Telemetry: Turn, stream, enhance, wrap‑up, mermaid, save/import events are recorded with anonymized device metadata and delivered to telemetry service.
- AC‑37 Crash Reporting: Crashes are automatically sent to Sentry without user prompt (unless Apple guidance changes); verified in TestFlight builds.
- AC‑38 Buffered Mode UI: When streaming switches to buffered mode, the existing “Sensei is typing…” indicator remains visible until the final payload arrives; user cannot resubmit during this state.
- AC‑39 Telemetry Toggle: Disabling telemetry in Settings prevents all telemetry transmissions until re-enabled; verified via logs.
- AC‑40 Header Parity: Brand/status/controls layout visually matches the web header. Brand tap toggles the meditation overlay; tapping outside closes it; status tap pins/unpins overlay.
- AC‑41 Controls & Theme Palette: Controls ellipsis toggles both rows; theme palette anchors on larger screens and falls back to a modal sheet on small screens without layout regressions; debug button absent.

## 16. Phase 1 Deliverables
- RN iOS app with full learner feature parity (excluding Debug Mode)
- Unified BFF with minimal endpoints + WS streaming
- Sensei Core extracted and server‑executed
- Local save/load; no server persistence
- Basic logs + crash reporting

## 17. Phase 2+ (for reference)
- Topic catalog UX, entitlements
- Server‑side persistence of progress and transcripts; cloud save linking
- Performance optimizations (caches/queues), telemetry pipeline
- Android client; accessibility audit; notifications; analytics dashboards

See also: [Phase 2 Functional Spec](recursive_sensei_phase2_functional_spec.md)

## 18. Normative References
- Engineering Spec (Phase 1 Mobile): docs/engineering/mobile_phase1_engineering_spec.md
- Contracts v1 (REST/WS/Bridge/Schemas): docs/engineering/contracts_v1.md

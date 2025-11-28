# Recursive Sensei — Mobile Phase 1 Engineering Spec (Web Parity, iOS)

Version: 1.0 (Draft)
Date: 2025-11-12
Owner: Engineering

Purpose
- Define the engineering plan to implement the Phase 1 mobile client for iOS using React Native with a WKWebView for rendering chat content, achieving functional parity with the existing web app while deferring authentication and server persistence to Phase 2.
- Alignment: Web behaviors are grounded in source code (file:line anchors). Phase 1 product requirements (timeouts, limits, event types) are taken verbatim from the Functional Spec. Prescriptive iOS items are marked as Implementation Guidance.

Scope
- Client: iOS (iPhone/iPad), RN shell + WKWebView for chat body. Minimum iOS 16. Split View/Slide Over unsupported (full screen only). [Per Functional Spec]
- Server: Minimal BFF with REST + WS per the Functional Spec; no server-side progress persistence in Phase 1. [Per Functional Spec]
- Shared: Extract “Sensei Core” (pure TS pedagogy/curriculum logic) for use by BFF.

Out of Scope
- Authentication (deferred to Phase 2 per Functional Spec updates).
- Android client, notifications, analytics dashboards, Admin tooling.

—

1) Grounded Web Baseline (what exists today)

1.1 LLM initialization and streaming
- The web app initializes the Google GenAI client in-browser and exposes it globally: `new GoogleGenAI({ apiKey: API_KEY })` (src/index.tsx:388).
- Streaming is performed via the SDK’s `chat.sendMessageStream`, yielding chunks iterated with `for await`:
  - Intro stream: `streamModuleIntroduction` opens a stream and appends text as chunks arrive (src/interactionHelpers.ts:35–41, 58–67).
  - Main dialogue stream: `streamMainSenseiResponse` opens a stream, tracks first-chunk latency, and appends chunk text (src/interactionHelpers.ts:236–244, 262–287).
- Each chunk triggers UI updates through `updateMessageStream(messageId, fullTextSoFar)` (src/interactionHelpers.ts:59–67, 269–287 → src/ui.ts:2391).

1.2 Streaming UI update pipeline
- `updateMessageStream` maintains a raw-text map, re-parses markdown, highlights code (non-mermaid), and attaches copy/format helpers (src/ui.ts:2391–2460). Sanitization precedes parsing: `sanitizeMarkdownFences` → `parseSanitizedMarkdown` (src/ui.ts:1611–1612; 315–330).

1.3 Selection Sensei overlay and actions
- Selection Sensei is a DOM overlay that detects selection, shows a toolbox, and drives Sensei responses; it imports `Chat` and `GoogleGenAI` (src/selectionSensei.ts:1–17).
- It sanitizes and parses selected markdown using shared helpers (src/selectionSensei.ts:17; 1299–1305).
- The response payload is parsed via `parseSelectionSenseiResponsePayload` (src/selectionSenseiResponseParser.ts:168).

1.4 Enhancers (Standard + Key Takeaway)
- Enhancement manager toggles applied markdown with drift checks against the streaming baseline (src/enhancementManager.ts:166–179, 247–266, 290–318).
- Feature flag and configs are centralized in `model_usage.ts` (e.g., `ENABLE_KEY_TAKEAWAY_ENHANCER`, `KEY_TAKEAWAY_*`) (src/model_usage.ts:92–113).

1.5 Mermaid rendering and recovery
- Mermaid blocks render client-side in the UI with themed thumbnails; on failure, a recovery UI is shown, and fixes may be attempted (src/ui.ts:2216–2260; 2892–3010).
- Recovery includes rule-based fixes and can invoke an LLM call client-side to produce a repaired diagram (src/mermaidErrorRecovery.ts:200–214; 348–387). The web code attempts multiple render/fix cycles (maxAttempts default 5 in `runMermaidRecovery`); Phase 1 mobile now performs up to **three** visible attempts: first an `auto` BFF call that applies deterministic fixes and, if they make no change, falls through to an LLM attempt; if the WebView render still fails, one or two additional `mode:'llm'` calls are issued for forced LLM fixes before showing the fallback UI.

1.6 Save/Load parity, Notepad
- Save/Load is local: `SaveLoadProgressManager` serializes/deserializes complex types and downloads a JSON file (src/saveloadProgressManager.ts:96–114; `serializeForSave` etc. in src/saveloadSerialization.ts:1–40, 120–170).
- Notepad supports adding notes and HTML export via `NotepadExporter` (src/notepad.ts:1–44, 90–117; src/notepadExporter.ts:17–25).

1.7 Footer (confidence/confusion/intent)
- Footer values derive from `LearnerModel` and last analysis, and update DOM text/classes in `updateFooter` (src/ui.ts:1111–1135; 399–401 for element refs).

1.8 Header/Controls and Theme Palette
- Controls area is managed in `ui.ts`, with an ellipsis toggle and a theme palette overlay that anchors to a trigger button; palette positioning and visibility state are explicit (src/ui.ts:792; 806–813; 2535–2557; 2584–2635; 2652–2705; 2705–2816).
- Debug Mode exists in web (button and modal) but is out-of-scope for mobile (src/index.html:115; src/index.tsx:153–158, 1507).

1.9 Wrap-Up Assessment
- Wrap-up question set validation and render logic is client-side; exactly 15 questions with 5 snippet items are enforced in validation (src/wrapUpAssessment.ts:1–40; 62–112). UI overlay gating is handled within the same module (e.g., `isWrapUpAssessmentActive`, `unlockWrapUpChatControls`) (src/wrapUpAssessment.ts:180–187, 540–545).

Observation summary
- LLM keys and streaming are purely client-side today (src/index.tsx:388; src/interactionHelpers.ts:262–287).
- No BFF endpoints or WS service exist yet (server/ contains a Vite project without REST/WS controllers).
- Many “core” pedagogical modules are pure TS and suitable for extraction, but some modules import DOM-centric logging (`logger.ts`).

—

2) Phase 1 Mobile Architecture (what we will build)

2.1 Components
- React Native iOS shell hosts a WKWebView for the chat body. RN owns native UI (selection overlay, code editor modal trigger, file pickers) and bridges to the WebView for content updates.
- BFF provides minimal REST + WS endpoints per Functional Spec Phase 1.
- Sensei Core is a shared, server-side package extracted from web to power pedagogy and instruction building.

2.2 Data flow (turn submission)
- RN posts a turn `{ clientTurnId, input.text, metadata }` to BFF `/sessions/{id}/turns` → receives `{ turnId, streamUrl }`.
- RN opens WS and forwards stream events into the WebView for DOM updates. Buffered-mode and hard-timeout behaviors follow the Functional Spec.

Implementation Guidance (iOS)
- Use a single WKWebView instance for the chat body to match the web’s streaming and rendering pipeline.
- Use `WKWebView` message handlers for RN↔WebView bridge.
- Block navigation and external schemes; load only bundled HTML/CSS/JS assets. See Contracts v1 for WS‑only behavior in Phase 1.

—

3) Sensei Core Extraction (grounded list)

3.1 Candidate core modules (pure logic)
- Curriculum and teaching plan validation: `src/curriculum.ts` (e.g., validation of teaching plan chunks and kcValue ranges) (src/curriculum.ts:226–299; 264–299).
- Adaptive engine state updates and analysis handling: `src/adaptiveEngine.ts` (interfaces and update paths) (src/adaptiveEngine.ts:1–40; 406–434).
- Prompt builders for system instructions and wrap-up generation: `src/prompts.ts` (used by streaming helpers and wrap-up).
- Wrap-up validation (question schema constraints): `src/wrapUpAssessment.ts:62–112`.

3.2 Modules to keep client-side (DOM/UI bound)
- UI and DOM rendering, code fence sanitization, highlight integration: `src/ui.ts` (multiple sections cited above).
- Selection overlay DOM mechanics: `src/selectionSensei.ts`.
- Code editor modal UI: `src/codeEditorModal.ts`.
- Notepad UI and HTML export: `src/notepad.ts`, `src/notepadExporter.ts`.

3.3 Required abstraction seams
- Logger interface: replace `src/logger.ts` dependency in core paths with an injected interface (DOM-free). Rationale: current logger exports logs via Blob/DOM (src/logger.ts:65–106, 139–196), unsuitable for server.
- LLM gateway interface: encapsulate “plan generation,” “analysis,” “enhance,” “wrap-up” calls. Current calls are browser SDK usages (e.g., `chat.sendMessageStream`, `ai.models.generateContent` in src/interactionHelpers.ts:262–287; src/mermaidErrorRecovery.ts:348–387).

—

4) BFF Minimum (Phase 1)

4.1 Endpoints (summarized; full contracts live in Contracts v1)
- POST `/sessions` → `{ sessionId, stateBootstrap }`.
- POST `/sessions/{id}/turns` → `{ turnId, streamUrl }` (requires `clientTurnId`).
- POST `/mermaid/recover` → see Contracts v1 for `{ fixed, fixedCode? }` and 422.
- WS `/sessions/{id}/stream?turnId=…` → emits `status`, `chunk`, `wrapUp`, `error`. See Contracts v1 for lifecycle.

4.2 Idempotency and limits
- `clientTurnId` maps to a stable `turnId`; duplicates return the original result. [Per Functional Spec]
- Input length limit: 4000 characters; reject with HTTP 413 and show UI prompt to shorten. [Per Functional Spec]
- Rate limiting: 3 turns per minute per IP/UA while auth is deferred (return 429; include Retry-After). [Per Functional Spec]
- Error code mapping to WS/HTTP: 400 BAD_REQUEST, 429 RATE_LIMITED, 503 DOWNSTREAM_UNAVAILABLE, 504 TURN_TIMEOUT. [Per Functional Spec]

4.3 Streaming lifecycle (server behavior)
See Contracts v1 for normative timeline: keepalive every 15s; at 25s stall switch to buffered mode; ~60s hard timeout; WS ping/pong for liveness.

Implementation Guidance (server)
- Implement an in-memory (Phase 1) idempotency store keyed by `clientTurnId`; consider Redis when scaling.
- Normalize SDK chunks into the WS payload shape used by clients so web/mobile can later share the same stream semantics.

—

5) RN ↔ WebView Bridge (Phase 1)

5.1 WebView → RN events (observed needs from web code; product rules from Functional Spec)
- Selection events: mirror overlay triggers based on selection inside the WebView (web shows toolbox on selection; src/selectionSensei.ts: getDOMElements/initialize and selection handlers across module).
- Render progress: the web updates rapidly via `updateMessageStream` (src/ui.ts:2391–2460); RN should receive throttled progress metrics for haptics/UX if needed.
- Mermaid/KaTeX errors: web surfaces errors and fallbacks (src/ui.ts:2216–2260; KaTeX integration at imports across modules). RN should be informed to log/telemetry.

- 5.2 RN → WebView events (product rules from Functional Spec)
- Chat lifecycle: `chat:startMessage` (create bubble), `chat:update` (incremental text), `chat:completeMessage` (finalize). The web equivalent for updates is `updateMessageStream` (src/ui.ts:2391–2460). See Contracts v1.
- Enhance apply/revert: web applies enhanced markdown and can revert on drift (src/enhancementManager.ts:290–318; 318–349). RN triggers equivalent DOM updates through the bridge.
- Theme updates: palette and theme changes are applied to mermaid thumbs and classes (src/ui.ts:2535–2557; 2874–2888; 3044–3079).
- Footer updates: when input is focused, continuously display numeric tooltip/labels equivalent to web hover behavior; hide when focus leaves. [Per Functional Spec]

- Implementation Guidance (iOS)
- Throttle RN→WebView `chat:update` to ≤10 updates/second to ensure smooth scrolling and input responsiveness. [Per Functional Spec]
- Use a durable message queue and drop/merge strategy under back-pressure to avoid WebView jank during long outputs.
- Suppress the native selection menu inside WKWebView when selection is active; expose Copy/Share/Sensei actions via RN overlay and VoiceOver UIAccessibilityCustomActions. [Per Functional Spec]

—

6) Parity Checklist (grounded → mobile mapping; Functional Spec alignment)

- Streaming render parity: `updateMessageStream` merges markdown, highlights code, adds copy buttons (src/ui.ts:2391–2460). Mobile: WebView JS must reuse identical sanitizer + marked + highlight integration.
- Selection Sensei toolbox: web overlay shows on selection and drives Sensei responses (src/selectionSensei.ts: initialize/handlers). Mobile: RN overlay activates on WebView selection, with Copy/Share and Sensei actions.
- Standard Enhance toggle: enhancement manager applies/removes with drift checks (src/enhancementManager.ts:166–179; 213–233; 290–349). Mobile: ensure drift check by comparing baseline text from WebView.
- Key Takeaway Enhancer (flagged): feature flag & cache key hash (src/model_usage.ts:92–113; src/keyTakeawayEnhancerController.ts:24–45). Mobile: keep flag OFF by default; honor cache behavior.
- Mermaid render/recovery: themed renders plus recovery attempts and fallback (src/ui.ts:2216–2260; 2892–2960; src/mermaidErrorRecovery.ts:200–214; 348–387). Mobile: route recovery via BFF `/mermaid/recover` per Functional Spec.
- Mermaid retry policy: limit visible recovery retries to 2; after failure, show raw fence + Retry; log attempts/outcomes with no PII. [Per Functional Spec]
- Mermaid recover responses: follow Contracts v1 semantics (`{ fixed: boolean, fixedCode? }`; 422 on unrepairable). Treat `fixed:false` as failure.
- Wrap-up overlay & validation: 15 questions, 5 snippet items (src/wrapUpAssessment.ts:62–112). Mobile: render in RN-native views or WebView sub-HTML and keep client-side scoring.
- Wrap-up persistence: no server write-backs in Phase 1. [Per Functional Spec]
- Save/Load: local JSON export/import (src/saveloadProgressManager.ts:96–114; src/saveloadSerialization.ts). Mobile: implement RN FS export/import with the same schema.
- Import semantics: importing a save creates a new local session and switches to it; previous session remains available. [Per Functional Spec]
- Footer status: update confidence/confusion/intent visuals (src/ui.ts:1111–1135). Mobile: update footer labels based on the same learner model state emitted from Core/BFF.
- Header/controls & theme palette: toggle ellipsis, theme panel anchoring (src/ui.ts:2535–2557; 2584–2635; 2705–2816). Mobile: tap interactions replace hover; theme panel can be a modal on small screens.
- Brand/status behaviors: brand tap toggles the meditation overlay; status tap pins/unpins overlay; debug button absent on mobile; show “thinking” animation during LLM activity. [Per Functional Spec]
- Code editor modal: provide a modal that inserts code into the input and preserves formatting on send. [Per Functional Spec]
- Single active session per topic: enforce locally; server does not enforce in Phase 1. [Per Functional Spec]

—

7) Security & Safety (Phase 1)

Grounded facts from web code
- Current web renders HTML via `marked` on the client after sanitization helpers tailored to code fences and inline pipes (src/ui.ts:315–330; 1611–1612). There is no full HTML sanitizer beyond these helpers.

Implementation Guidance (iOS)
- Sanitize HTML prior to DOM insertion inside the WebView (defense-in-depth), and load assets locally (no remote script tags).
- Block all navigation and external windows from the WebView; allow only local `app://`/bundle resources.
- No secrets in app binary: no LLM keys or prompt text shipped; all LLM calls route to BFF/LLM proxy. [Per Functional Spec]

—

8) Performance & Resilience

Grounded behavior
- Web pushes every chunk straight to `updateMessageStream` (src/interactionHelpers.ts:262–287 → src/ui.ts:2391–2460). No explicit throttle exists in the web code.

Implementation Guidance (iOS)
- Throttle RN→WebView updates to ≤10/s; coalesce updates during fast streams. [Per Functional Spec]
- On app background, pause WS processing and resume on foreground with an “in-flight guard” preventing duplicate sends until terminal status (no resubmission during buffered/streaming state). [Per Functional Spec]
- WS keepalive every 15s; on 25s stall, treat as buffered-mode and deliver final payload on same WS; on ~60s hard timeout, show error. [Per Functional Spec]

—

9) Accessibility (iOS specifics)

Implementation Guidance
- Provide VoiceOver actions for the selection toolbox (Copy/Share/Sensei actions). [Per Functional Spec]
- Honor Dynamic Type by scaling base font sizes in the WebView; expose a bridge to increase/decrease content size without layout shifts. [Per Functional Spec]
- Ensure hit targets (≥44pt), and respect safe-area insets on iPhone and iPad.

—

10) Open Items to be locked in Contracts v1 (second document)

- Exact REST/WS JSON schemas (request/response), including error bodies and `Retry-After` for 429.
- RN↔WebView event payloads and throttling agreement.
- Save-file schema version and filename convention (web currently uses `sensei_progress_<ISO>.json` at src/saveloadProgressManager.ts:105–112).
- Telemetry event schema and sampling rules; Sentry integration points.

Telemetry & Crash (Functional Spec alignment)
- Telemetry toggle in Settings: default ON; when OFF, prevent all telemetry transmissions until re-enabled. Offline queueing allowed. Sample default 50%. Record anonymized device metadata only. [Per Functional Spec]
- Crash reporting: integrate Sentry; send crashes automatically (no prompt) provided App Store guidelines permit; verify in TestFlight builds. [Per Functional Spec]

—

11) Acceptance Criteria Traceability (Phase 1)
- AC‑1 Launch: App opens to default subject; reaches chat in one tap. Engineering: RN app boots directly to chat; one-tap subject entry.
- AC‑2 Session Init: POST /sessions returns sessionId; WS stream connects. Engineering: implement /sessions and WS handshake per §4.
- AC‑3 Send/Stream: POST /turns yields turnId/streamUrl; first chunk renders; terminal completed received. Engineering: §4.1–4.3 + §5.
- AC‑4 Reload: Post‑completion “Reload message” works; no mid‑stream cancel. Engineering: reuse web reload flags and block mid-stream re-sends.
- AC‑5 Idempotency: Re-post same clientTurnId returns original turnId; no duplicate work. Engineering: §4.2.
- AC‑6 Errors: 400/429/503/504 map to user messages; app can retry without crash. Engineering: §4.2 + RN error UI.
- AC‑7 WS Resilience: Keepalive 15s; 25s stall → buffered; final payload on same WS; reconnect/backoff. Engineering: §4.3 + §8.
- AC‑8 Selection Sensei: Toolbox on selection; native menu suppressed; Copy/Share; VoiceOver actions. Engineering: §5 Implementation Guidance.
- AC‑9 Toolbox Positioning: Avoid overlap; pill fallback; verify on iPhone/iPad both orientations. Engineering: RN overlay layout rules + QA plan.
- AC‑10 Standard Enhance: Enhance streams updated markdown; preserves baseline. Engineering: enhancer drift checks mirrored (§6).
- AC‑11 Key Takeaway (FF): Flag OFF by default; when ON mirrors web behavior. Engineering: feature flags (§6).
- AC‑12 Code Editor: Modal opens, inserts code into input, preserves formatting. Engineering: RN modal + bridge insertion.
- AC‑13 Mermaid Render: WebView renders with same theme logic as web. Engineering: bundle mermaid + theme integration (§6, §7).
- AC‑14 Mermaid Recovery: RN calls /mermaid/recover; first call uses `mode:auto` (heuristics, falls through to LLM if unchanged), then up to two `mode:llm` retries; total max 3 attempts. Engineering: §6.
- AC‑15 Mermaid Fallback: After retries fail, show raw fence + Retry; log event. Engineering: §6 + telemetry.
- AC‑16 Wrap‑Up: Client-side scoring; immediate feedback; no server writes. Engineering: §6.
- AC‑17 Save Export: Local file via share sheet; defined schema. Engineering: RN FS export aligned with web schema (§6).
- AC‑18 Save Import: Validates; restores state; on invalid shows error; no partial changes. Engineering: RN import + schema validation.
- AC‑19 Single Session: Local enforcement; replace/resume existing. Engineering: RN session manager (§6).
- AC‑20 No Secrets: No LLM keys in app; calls only to BFF/LLM proxy. Engineering: §7.
- AC‑21 Logging/Crashes: Structured logs; crash reporting active. Engineering: Telemetry & Crash section.
- AC‑22 Accessibility Minimums: Labels/contrast; toolbox/buttons VoiceOver; Dynamic Type respected. Engineering: §9.
- AC‑23 Reuse Parity: Golden tests confirm identical core outputs mobile vs web. Engineering: extract Core + golden tests.
- AC‑24 Input Limits: >4000 char rejected with UI prompt; no stream opened. Engineering: §4.2 + client pre-check.
- AC‑25 Rate Limit: Simulated overload returns 429; UI communicates wait/retry. Engineering: §4.2.
- AC‑26 Mermaid Telemetry: Log recovery attempts/outcomes; no PII. Engineering: Telemetry & Crash.
- AC‑27 WebView Safety: Only local HTML loads; navigation blocked; sanitized payloads prevent script injection. Engineering: §7.
- AC‑28 WS Keepalive: Client receives periodic keepalives; stall shows “slow connection”; final payload single message; hard timeouts show error. Engineering: §4.3 + §8.
- AC‑29 In‑Flight Guard: Prevent duplicate sends while in-flight/buffered. Engineering: §8.
- AC‑30 QA Devices: Verify on iPhone 12, iPhone 14, iPad 10th gen (portrait/landscape). Engineering: QA checklist.
- AC‑31 Markdown & KaTeX: WebView uses marked + marked‑katex; inline math identical; KaTeX errors show raw fence with notice. Engineering: bundle + error hook.
- AC‑32 Selection Bridge: Selecting inside WebView triggers RN overlay; Copy/Share/Enhance/Reload via toolbox; native menu suppressed. Engineering: §5.
- AC‑33 Footer Visibility: Numeric tooltips/labels shown continuously when input focused. Engineering: §5.2.
- AC‑34 Notepad Parity: Same fields/editing; included in save file. Engineering: RN notepad state tied to save schema.
- AC‑35 Import New Session: Importing save creates new local session; switches to it; previous remains. Engineering: §6.
- AC‑36 Telemetry: Turn/stream/enhance/wrap‑up/mermaid/save/import events recorded with anonymized metadata; batching/secure delivery. Engineering: Telemetry & Crash.
- AC‑37 Crash Reporting: Sentry auto‑send without prompt; verified in TestFlight. Engineering: Telemetry & Crash.
- AC‑38 Buffered Mode UI: “Sensei is typing…” persists until final payload; user cannot resubmit. Engineering: §4.3 + §8.
- AC‑39 Telemetry Toggle: Disabling toggle prevents all telemetry; verify via logs. Engineering: Telemetry & Crash.
- AC‑40 Header Parity: Brand/status/controls behavior mirrored; debug absent. Engineering: §6.
- AC‑41 Controls & Theme Palette: Ellipsis toggles rows; theme palette anchor or modal; no layout regressions. Engineering: §6.

—

12) QA Devices & Test Plan (supplemental)
- Devices: iPhone 12, iPhone 14, iPad 10th gen; portrait and landscape. [Per Functional Spec]
- Scenarios: streaming latency/timeout paths; buffered-mode transition; selection overlay on large/zoomed content; mermaid failure/recovery limits; save/import validity and error handling; telemetry opt‑out; crash capture in TestFlight.

—

13) Code Reuse & Apple Compliance
- Two-lane reuse strategy:
  - Server: extract pure pedagogy/curriculum/prompt logic into Sensei Core; BFF invokes Core; no secrets on device.
  - Client: bundle the existing web renderer (markdown/KaTeX/highlight/mermaid + `updateMessageStream` equivalent) as local assets in WKWebView; RN drives it via the bridge.
- Native value (App Review): RN-native selection overlay, code editor modal, Settings with telemetry toggle, iOS file import/export, lifecycle handling, haptics, and accessibility.
- Safety: no remote script loads; navigation blocked; telemetry/crash privacy aligned with App Store disclosures.

—

Appendix — Golden Inputs (QA reference)
- Define a small set of text prompts and expected instruction/plan outputs captured from the current web app and verified through Sensei Core on the server.
- Store as fixtures (JSON) in the repo; use Contracts v1 payloads to assert parity.
Appendix A — Code Anchors Index
- LLM init: src/index.tsx:388
- Streaming helpers: src/interactionHelpers.ts:35–41, 58–67, 236–244, 262–287
- Streaming UI update: src/ui.ts:2391–2460; sanitization: 315–330; 1611–1612
- Selection Sensei: src/selectionSensei.ts:1–17; 1299–1305; parser: src/selectionSenseiResponseParser.ts:168
- Enhancers: src/enhancementManager.ts:166–179; 213–233; 247–266; 290–349
- Feature flags/config: src/model_usage.ts:92–113
- Mermaid render/recovery: src/ui.ts:2216–2260; 2892–2960; src/mermaidErrorRecovery.ts:200–214; 348–387
- Save/Load: src/saveloadProgressManager.ts:96–114; src/saveloadSerialization.ts:1–40; 120–170
- Notepad: src/notepad.ts:90–117; export HTML: src/notepadExporter.ts:17–25
- Footer update: src/ui.ts:1111–1135; element refs: 399–401
- Header/Controls/Theme palette: src/ui.ts:2535–2557; 2584–2635; 2705–2816; 2874–2888; 3044–3079
- Wrap-up validation/render: src/wrapUpAssessment.ts:1–40; 62–112; 180–187; 540–545

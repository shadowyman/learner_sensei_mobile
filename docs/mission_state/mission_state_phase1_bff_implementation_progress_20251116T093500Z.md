# Phase 1 BFF Progress Handoff – 2025-11-16 09:35 UTC

## Canonical Sources & Guardrails
- **Specs rule everything**: `docs/engineering/contracts_v1.md`, `docs/BFF_System_Master_Arhitectural_Guide.md`, `docs/functional_spec/recursive_sensei_mobile_phase1_functional_spec.md`, and `docs/engineering/mobile_phase1_engineering_spec.md` remain the only authorities. Re-read relevant sections before coding.
- **Protocol discipline**: Core Analysis already run, but every subsequent major change must respect the protocol stack (Impact Analysis, Architecture Synthesis, etc.) unless the user explicitly waives them. RCI steps are mandatory after every implementation slice—re-open the matching spec sections and self-review for drift each time.
- **Logging & metadata**: Use `[FEATURE_TAG] ...` structured logs everywhere; include `requestId` in server logs. Clients must send metadata envelopes (`source`, `appVersion`, selection context) exactly as defined in Contracts v1.
- **Session TTL awareness**: Sessions are ephemeral (~2 h TTL). Clients must treat `BAD_REQUEST: Unknown session` as “session expired” and re-issue `/sessions`.
- **Backups & analyzer**: Run `npm run backup:create` before touching project files and keep analyzer outputs fresh (`npm run analysis:run`) whenever scope changes. Analyzer artifacts (`tmp/analysis/*.json`) should influence planning before manual grep.
- **File locations**: All mission docs live under `docs/mission_state/mission_state_<slug>_<timestamp>.md`. No new root-level files unless they are core source files.

## Status – What’s Been Implemented This Session
1. **BFF restructuring**
   - Introduced `bff/src` tree with containerized services: `server.js`, routers (`routes/sessions`, `mermaid`, `telemetry`), infra (`sessionStore`, `rateLimiter`), utilities (`logger`, `errorMapper`), and integrations (`senseiCoreAdapter`, `geminiGateway`).
   - `bff/index.js` now boots the new server directly.
2. **Contracts-compliant REST**
   - `/sessions` validates topic IDs against the registry (`c++_recursive_mastery`) and emits `[SESSION_CONTROLLER]` logs with request IDs.
   - `/sessions/:sessionId/turns` enforces schema validation, 4 000-char limit, per-IP/UA rate limiting (3/min), and proper idempotency via the new `SessionStore` retention map.
3. **Telemetry & Mermaid services**
   - `/telemetry` keeps best-effort semantics (always 204, logs count/context) and ignores malformed payloads.
   - `MermaidService` now runs deterministic fixes (fence stripping, TD→TB normalization) before deferring to `GeminiGateway.recoverMermaidDiagram` (still stubbed but wired).
4. **Streaming pipeline**
   - `StreamingService` handles keepalives, stall-to-buffered switching, wrap-up hook, footer emission, and WebSocket error mapping.
   - `streamServer` validates session/turn IDs and hands off to the service; readyState guards fixed to use `WebSocket.OPEN`.
5. **SenseiCore/Gemini scaffolding**
   - Added `SenseiCoreAdapter` placeholder (current prompt = “Respond to <input>”) and a stub `GeminiGateway` that yields deterministic chunks, ready for real SDK integration.
   - `WrapUpService` currently no-ops but is plumbed into streaming.
6. **Client updates (RN + shared web)**
   - `SenseiMobile/src/mobile/network/BffClient.ts` (and mirrored `src/mobile/...`) now send topic + metadata envelopes, support selection context, and automatically recover from session-TTL 400s by re-running `ensureSession()` exactly once.
   - `SenseiMobile/App.tsx` passes explicit metadata (`topicId`, `appVersion`, `source`).
7. **Request correlation & logging**
   - Introduced `requestContext` middleware to stamp `X-Request-Id`; all controllers log with that ID.
8. **Verification**
   - A suite of inline Node tests confirmed the new REST/WS behaviors (sessions, turns, mermaid, telemetry, buffered streaming, rate limiting, session TTL recovery).

## Remaining Phase 1 Work (per design docs)
1. **SenseiCore parity (Guide §E.5)**
   - Port the actual prompt-building logic from `src/interactionHelpers.ts` / `src/prompts.ts` into `SenseiCoreAdapter.buildPrompt`, including Selection Sensei variants, so server prompts match the web behavior.
   - Prepare the adapter for eventual Sensei Core extraction (structure context fields, module/phase info, learner model stubs).
2. **GeminiGateway real integration (Guide §E.5, Functional Spec §4.2)**
   - Replace the stub with real Gemini streaming + mermaid recovery calls, enforce provider timeouts, map downstream errors to `DOWNSTREAM_UNAVAILABLE` / `TURN_TIMEOUT`, and ensure buffered-mode behavior matches the spec.
   - Securely load API keys/config (probably via env vars) per infra guidance.
3. **Wrap-Up Service (Guide §E.4 & §E.5)**
   - Implement wrap-up payload generation/validation mirroring `src/wrapUpAssessment.ts`. Emit validated `wrapUp` WS frames before `status:completed`; log and skip gracefully when validation fails.
4. **Selection Sensei metadata plumbing (Guide §E.3, Contracts RN↔WebView)**
   - Ensure RN SelectionOverlay passes `{ actionId, selectedText }` into `SubmitTurnPayload.selectionContext` everywhere and that the BFF threads this into `TurnContext` / prompt building so selection actions influence prompts.
5. **Footer & KC progress heuristics (Contracts v1 footer schema)**
   - Replace the static footer with reasonable heuristics (even placeholder logic) and consider emitting optional `kcProgress` payloads if data is derivable from the web bundle/adapter.
6. **Telemetry completeness (Functional Spec §6)**
   - Confirm `/telemetry` receives all mandated events (`turn_submitted`, `stream_completed`, `wrapup_submitted`, `mermaid_recovery_attempt`, save/load events, etc.) and that RN/Web emit them with proper metadata.
7. **Analyzer-backed parity tests (Guide §C, §F)**
   - Use the golden inputs referenced in the specs to compare prompts, mermaid fixes, wrap-up outputs, and streaming behavior between web and BFF implementations. Document any deviations before launch.
8. **Deployment readiness tasks (Guide §F.4)**
   - Plan the final migration steps: remove the old stub entry, integrate real Gemini credentials, and verify the RN/Web builds talk exclusively to the new BFF.

## Operating Notes for the Next Agent
- Keep following the “mission control” persona: re-read design sections before each change, log `[FEATURE_TAG]` actions, back up before edits, and respect protocol sequencing.
- Maintain the `update_plan` structure used here—each implementation step must be followed by an “RCI Step” entry summarizing which sections you re-read and any issues discovered/resolved before proceeding.
- Continue writing mission-state snapshots under `docs/mission_state/mission_state_<slug>_<timestamp>.md` whenever you complete Core Analysis, planning, or major decisions so future agents have traceability.
- When validating work, use the same inline Node/ts-node scripts: spin up the server inside a single command, exercise the relevant endpoint or WebSocket with dummy payloads, log the outcome, and shut down immediately. This keeps tests deterministic without background processes.
- Be explicit about environment assumptions (session TTL, rate-limit window, etc.) and capture any non-spec decisions in the mission-state log before coding.

Good luck—Phase 1 success depends on finishing the spec-defined behaviors above without deviating from the documented architecture. EOF

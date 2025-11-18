 Scope & Architecture

  - ARCH‑1: Phase 1 introduces a Node-based BFF as the sole network boundary for the iOS React Native mobile client (no other servers are
  called by the app).
  - ARCH‑2: The BFF exposes a small REST + WebSocket surface tailored to Phase 1 mobile, not a generic API.
  - ARCH‑3: The BFF must encapsulate all interaction with Gemini and other external services; clients never call LLM providers directly.
  - ARCH‑4: Pedagogy, curriculum, and learner-model logic belong in Sensei Core, with the BFF acting as a protocol adapter and
  cross‑cutting concern handler.
  - ARCH‑5: The BFF must be designed for clear separation of concerns: transport, domain services, infra utilities, and integration with
  Core/LLM are distinct layers.
  - ARCH‑6: Phase 1 must be forward‑compatible with Phases 2 & 3 (Core extraction, multi‑client, scaling) so no large rewrites are needed
  later.
  - ARCH‑7: The BFF must support mobile constraints: low latency, limited background execution, and battery‑friendly streaming behavior.
  - ARCH‑8: The BFF must not depend on DOM, CSS, or WebView internals; it deals only in JSON contracts.
  - ARCH‑9: For Phase 1, the BFF runs as a single process with in‑memory state but is structured so it can scale horizontally later.
  - ARCH‑10: The BFF must treat web behavior as the reference for prompts, wrap‑up, and mermaid recovery when approximating Core logic.

  ———

  Sessions API (POST /sessions)

  - SESS‑1: The BFF must expose POST /sessions as the entrypoint to initialize a Sensei session.
  - SESS‑2: The request body must include topicId: string; metadata?: object.
  - SESS‑3: For Phase 1 mobile, the only valid topicId is "c++_recursive_mastery"; unknown values must be rejected.
  - SESS‑4: Topic validation must use a server-owned TopicRegistry backed by config/topics.json.
  - SESS‑5: On unknown topicId, BFF must return HTTP 400 BAD_REQUEST with a JSON body like { code: "BAD_REQUEST", message: "Unknown
  topicId" }.
  - SESS‑6: metadata is an open-ended observability context; the BFF must accept arbitrary fields and must not reject unknown keys.
  - SESS‑7: The BFF may derive source and appVersion for logging from metadata and/or headers (e.g., X-App-Version); this must not affect
  correctness.
  - SESS‑8: On success, the BFF must return 200 with { sessionId, stateBootstrap? }, where stateBootstrap is optional and Phase‑1 clients
  must ignore it.
  - SESS‑9: sessionId must be unique and opaque; clients must not rely on its structure.
  - SESS‑10: Phase 1 authentication is not required; /sessions is open but protected indirectly via turn-level rate limiting.
  - SESS‑11: Session metadata stored server‑side must at least include topicId, createdAt, and any derived observability fields.

  ———

  Turn Submission API (POST /sessions/{sessionId}/turns)

  - TURN‑1: BFF must expose POST /sessions/{sessionId}/turns to submit learner turns.
  - TURN‑2: sessionId is required path param; BFF must verify that the session exists and is active.
  - TURN‑3: If sessionId is unknown, BFF must return 400 BAD_REQUEST with a suitable error body.
  - TURN‑4: Request body must include clientTurnId: string and input: { text: string }; metadata?: object.
  - TURN‑5: input.text must be at least one non‑whitespace character; empty/whitespace-only text must be rejected with 400 BAD_REQUEST
  and a message like "Input text must not be empty".
  - TURN‑6: input.text.length must not exceed 4000 characters; longer inputs must get 413 with { code: "BAD_REQUEST", message: "Your
  message is too long—shorten it and resend." }.
  - TURN‑7: Turn metadata is optional and open‑ended; servers must not require it and must tolerate unknown fields.
  - TURN‑8: Core routing and limits must be derived from sessionId and session metadata, not turn metadata.
  - TURN‑9: The pair (sessionId, clientTurnId) is the idempotency key; re‑posting the same pair must return the original result without
  duplicating work.
  - TURN‑10: BFF must implement per‑session mapping from clientTurnId to turnId to support idempotency.
  - TURN‑11: Idempotency records must be retained for at least 10 minutes (SHOULD be 60); Phase 1 may treat stale replays as new turns
  and need not emit 409 yet.
  - TURN‑12: On success, BFF must respond with 200 and { turnId, streamUrl }; no extra fields.
  - TURN‑13: streamUrl must be a valid URI pointing to the WS endpoint /sessions/{sessionId}/stream?turnId={turnId}.
  - TURN‑14: BFF must enforce 3 turns per rolling 60 seconds per (IP, User-Agent) on this endpoint only.
  - TURN‑15: On rate limit violation, BFF must respond 429 with header Retry-After: <seconds> and body { code: "RATE_LIMITED", message:
  "Too many messages—wait a moment before trying again." }.
  - TURN‑16: For downstream LLM or infra problems that prevent starting a stream, BFF may return 503 with { code:
  "DOWNSTREAM_UNAVAILABLE", ... }.
  - TURN‑17: For submit‑time timeouts, BFF may return 504 with { code: "TURN_TIMEOUT", ... }.
  - TURN‑18: Turn creation must never start a stream on invalid input (400/413/429), and clients must not open WS in those cases.

  ———

  WebSocket Streaming (/sessions/{sessionId}/stream?turnId=...)

  - WS‑1: BFF must expose a WebSocket endpoint at /sessions/{sessionId}/stream?turnId={turnId}.
  - WS‑2: On new connection, BFF must parse sessionId from path and turnId from query string.
  - WS‑3: If either session or turn cannot be found, BFF must send an Error frame { type: "error", code: "BAD_REQUEST", message: "Unknown
  session or turn" } and close the WS.
  - WS‑4: On successful connection, BFF must send a first Status frame with phase: "started" before any Chunk or WrapUp frames.
  - WS‑5: Status frames must follow the shape { type: "status", phase: "started" | "keepalive" | "completed", footer?, kcProgress? }.
  - WS‑6: footer, if present, must conform to FooterPayload enums (confidence, confusion, intent), matching the contract.
  - WS‑7: kcProgress is optional; if used, it must include integer currentChunkIndex and totalChunks.
  - WS‑8: Streamed response text must be sent as Chunk frames { type: "chunk", text: string, messageId?: string, enhancer?: object }.
  - WS‑9: messageId in Chunk frames is optional and unused by Phase 1 mobile for bubble routing.
  - WS‑10: BFF must emit Status keepalive frames with phase: "keepalive" at about 15s intervals when no other traffic is occurring.
  - WS‑11: BFF must treat WebSocket-level ping/pong as liveness; JSON keepalive frames are informational and require no client ack.
  - WS‑12: If there is no data or ping ack for roughly 25s (15s keepalive + ~10s grace), BFF must switch to buffered mode.
  - WS‑13: In buffered mode, BFF must stop sending incremental Chunks and instead buffer remaining LLM text.
  - WS‑14: When LLM finishes in buffered mode, BFF must send one final Chunk frame containing the buffered text, then the Status frame
  with phase: "completed".
  - WS‑15: On normal completion, BFF must send a final Status frame with phase: "completed" (footer allowed) and then close the WS; no
  more frames afterward.
  - WS‑16: At most one WrapUp frame may be sent per stream; if present, it must come before the terminal Status:completed frame.
  - WS‑17: On stream‑time LLM/infra failure, BFF must send an Error frame with code: "DOWNSTREAM_UNAVAILABLE" and close the WS without
  completed.
  - WS‑18: On stream‑time timeout (~60s), BFF must cancel the LLM stream, send Error with code: "TURN_TIMEOUT", then close the WS.
  - WS‑19: If a rate-limit condition is detected after a stream has started, BFF must send Error with code: "RATE_LIMITED" and close.
  - WS‑20: For unexpected internal streaming errors, BFF must send Error with code: "BAD_REQUEST" and close; no Status:completed after
  an error.
  - WS‑21: SSE fallback is explicitly not used in Phase 1; WebSocket is the only streaming transport.
  - WS‑22: Streaming implementation must check ws.readyState before send and treat send exceptions as signals to terminate gracefully.

  ———

  Session, Turn, State & Topic Registry

  - STATE‑1: BFF must maintain Session objects with fields like id, topicId, createdAt, and metadata.
  - STATE‑2: BFF must maintain Turn objects with fields like id, sessionId, clientTurnId, input, metadata, and createdAt.
  - STATE‑3: Session and turn state in Phase 1 may be stored only in memory; persistence across restarts is not required.
  - STATE‑4: Learner progress and transcripts must not be stored long‑term on the BFF in Phase 1; save/load remains strictly client‑side.
  - STATE‑5: A SessionStore abstraction must hide in‑memory implementation details and offer async methods like createSession,
  getSession, createOrGetTurn, getTurn, and pruneIdempotency.
  - STATE‑6: The in‑memory SessionStore must maintain a per‑session map of clientTurnId → turnId to implement idempotency.
  - STATE‑7: SessionStore.pruneIdempotency(retentionMs) must allow periodic cleanup of old idempotency keys based on retention window.
  - STATE‑8: TopicRegistry must be loaded from config/topics.json at startup and provide getTopic and listTopics APIs.
  - STATE‑9: SessionService.createSession must consult TopicRegistry and throw an error (mapped to 400) on unknown topics.
  - STATE‑10: A periodic cleanup mechanism is recommended to prune old sessions/turns (e.g., older than 2 hours) in long‑running BFF
  processes.

  ———

  Rate Limiting & Input Limits

  - LIMIT‑1: Phase 1 rate limit applies only to POST /sessions/{sessionId}/turns, not to /sessions, /mermaid/recover, or /telemetry.
  - LIMIT‑2: Rate limiter must track per (IP, User-Agent) pair in a rolling 60‑second window.
  - LIMIT‑3: When the limiter denies a call, it must compute a Retry-After value from the oldest timestamp and return it as an integer
  seconds header.
  - LIMIT‑4: BFF must always prune old timestamps from rate buckets before checking limits.
  - LIMIT‑5: Input length limit of 4000 characters must be enforced before any streaming or LLM calls are started.
  - LIMIT‑6: Empty or whitespace‑only input.text must be rejected with 400 without creating a turn or stream.
  - LIMIT‑7: BFF must not silently truncate user input; exceeding limits must yield explicit error responses.
  - LIMIT‑8: Requests violating limits must not allocate turnIds or create session/turn records.

  ———

  Error Codes & HTTP/WS Mapping

  - ERROR‑1: All HTTP error bodies must follow { code: ErrorCode, message: string } where ErrorCode is one of BAD_REQUEST, RATE_LIMITED,
  DOWNSTREAM_UNAVAILABLE, TURN_TIMEOUT.
  - ERROR‑2: BAD_REQUEST is used for input validation errors, unknown sessions, unknown topics, and unexpected internal errors that are
  client‑visible.
  - ERROR‑3: RATE_LIMITED is used for exceeding per‑IP/UA turn limits.
  - ERROR‑4: DOWNSTREAM_UNAVAILABLE is used for LLM/infrastructure outages (503) and corresponding WS errors.
  - ERROR‑5: TURN_TIMEOUT is used for hard timeouts (~60s) on turns (504, WS error).
  - ERROR‑6: 413 responses for too‑long input must still use code: "BAD_REQUEST" in the JSON body.
  - ERROR‑7: 429 responses must use code: "RATE_LIMITED" in the JSON body and attach Retry-After.
  - ERROR‑8: WS Error frames must follow { type: "error", code: ErrorCode, message: string }.
  - ERROR‑9: After emitting an Error frame on a stream, the BFF must close the WS and must not send Status:completed or any further
  frames.
  - ERROR‑10: An ErrorMapper abstraction must translate internal exceptions (e.g., UnknownTopicError, RateLimitedError) into standardized
  HTTP statuses and WS error codes.

  ———

  Mermaid Recovery (POST /mermaid/recover)

  - MER‑1: BFF must expose POST /mermaid/recover for fixing invalid Mermaid diagrams.
  - MER‑2: Request body must include messageId: string and code: string; optional theme, errorHash, context object with arbitrary keys.
  - MER‑3: BFF must accept unknown fields in context without rejecting the request.
  - MER‑4: On valid requests, BFF must respond 200 with { fixed: boolean, fixedCode?: string }.
  - MER‑5: When a repair is successful, BFF must return { fixed: true, fixedCode } where fixedCode is a non-empty string representing the
  corrected diagram.
  - MER‑6: When server declines or cannot produce a better diagram, it must return { fixed: false } and no fixedCode; clients treat this
  as failed recovery.
  - MER‑7: For malformed payloads, BFF must return 400 BAD_REQUEST and an error body like { code: "BAD_REQUEST", message: "Invalid
  mermaid recovery payload" }; clients should not auto‑retry with identical payload.
  - MER‑8: When inputs are valid but deterministic repair is not possible, BFF may respond 422 (with BAD_REQUEST code/message text
  describing inability to repair); clients treat as failed recovery.
  - MER‑9: On upstream LLM or infra issues, BFF must return 503 with { code: "DOWNSTREAM_UNAVAILABLE", message: "Sensei is busy—try again
  shortly." }; clients may offer retries.
  - MER‑10: MermaidService must encapsulate validation, optional rule‑based fixes (per web behavior), and Gemini‑based repair behind a
  single recoverDiagram call.

  ———

  Wrap‑Up Assessment

  - WRAP‑1: BFF WebSocket streams may include at most one WrapUp frame per turn.
  - WRAP‑2: WrapUp frames must follow { type: "wrapUp", payload: WrapUpAssessmentOverlayData }.
  - WRAP‑3: WrapUpAssessmentOverlayData must include moduleTitle, optional moduleGoal, optional conceptSummaries, and questions array.
  - WRAP‑4: Each question must have id, type: "snippet" | "concept", prompt, choices[], correct_choice, explanation, interviewer_insight;
  snippet questions must also have non‑empty code.
  - WRAP‑5: For full canonical wrap‑up, payloads should contain 15 questions with exactly 5 snippet questions; BFF must validate these
  invariants before emitting.
  - WRAP‑6: Invalid or malformed wrap‑up payloads must be treated as non‑fatal: BFF logs the issue and either skips wrap‑up or emits an
  error frame that doesn’t break chat.
  - WRAP‑7: In Phase 1, wrap‑up generation can be stubbed or approximate, but the contract and shape must be correct and tested.
  - WRAP‑8: RN’s BffClient must map wrapUp frames to RN→WebView { type: 'wrapup:show', data: payload }; BFF must not change payload
  schema in a way that breaks this.

  ———

  RN ↔ WebView Bridge & Selection / Chat Contracts

  - BRIDGE‑1: WebView must send selection events as WebViewToRN messages with type: 'selection' | 'selection:clear' | 'mermaid:error'
  | 'render:progress'.
  - BRIDGE‑2: Selection messages must include text, rect (x, y, width, height), and viewport (width, height, scrollY) so RN overlay can
  mirror Range.getBoundingClientRect behavior.
  - BRIDGE‑3: WebView must send mermaid errors as { type: 'mermaid:error'; messageId; code; errorMessage; errorHash? }, which RN uses to
  call /mermaid/recover.
  - BRIDGE‑4: RN must suppress the native iOS selection menu and show its own overlay with Copy/Share/Sensei actions; VoiceOver actions
  must map appropriately (per Functional Spec).
  - BRIDGE‑5: RN→WebView messages must include chat lifecycle events: chat:startMessage, chat:update, chat:completeMessage,
  enhance:apply, enhance:revert, theme:update, footer:update, wrapup:show.
  - BRIDGE‑6: chat:startMessage must specify messageId, sender: 'sensei' | 'user', and optional reload info; WebView uses messageId to
  manage bubbles.
  - BRIDGE‑7: chat:update messages must include messageId and text, with optional replace flag; they must be throttled to ≤10 messages/
  sec to avoid UI jank.
  - BRIDGE‑8: chat:completeMessage must be sent when a message is done streaming.
  - BRIDGE‑9: footer:update messages must include focused: boolean; RN maps BFF footer and local focus state to this.
  - BRIDGE‑10: wrapup:show messages must supply a data payload matching the wrap‑up schema; WebView uses this to render overlay.
  - BRIDGE‑11: BFF must ensure its WS payloads can be mapped into these RN→WebView messages without schema mismatches.

  ———

  Telemetry & Crash Reporting

  - TEL‑1: Telemetry must respect an opt‑out toggle, default ON; when OFF, client should avoid sending events, but BFF must tolerate
  stray calls.
  - TEL‑2: Telemetry events must follow a flexible envelope with fields like event, ts, sessionId, device, sampled, data.
  - TEL‑3: BFF /telemetry endpoint must accept { events: TelemetryEvent[] } where each event has at least event, timestamp (ts/
  timestamp), and data.
  - TEL‑4: BFF must tolerate missing or extra fields in individual events; schema is intentionally flexible.
  - TEL‑5: Telemetry ingestion must be best‑effort and must never affect core chat flows or cause 4xx/5xx responses.
  - TEL‑6: On receipt (valid or partially malformed), BFF should log or forward events and respond 204 (or 200 with empty body).
  - TEL‑7: TelemetryService must avoid logging or storing personally identifiable information; device data must be anonymized.
  - TEL‑8: Crash reporting is handled via Sentry on the client; BFF is not responsible for crash transport but may receive crash
  telemetry.

  ———

  Save File JSON (Client-Side) – Phase 1 Parity

  - SAVE‑1: Save files must follow the SenseiSaveV2 schema, with top‑level { version, timestamp, metadata, session }.
  - SAVE‑2: version must equal "2.0.0"; loaders must reject mismatched major versions.
  - SAVE‑3: timestamp must be an ISO date-time string.
  - SAVE‑4: metadata must include moduleName, phase, chunkProgress, sessionDuration, and totalInteractions; curriculumChecksum and
  saveEnvironment are optional.
  - SAVE‑5: session must include curriculumState, learnerModel, applicationState, chatSession, ui, notepad, and optional consolidation.
  - SAVE‑6: applicationState must track at least currentActiveConceptIndex, currentMessageId, lastSenseiResponses,
  chronologicallyLastLLMSenseiMessageId, userInputHistory, pending* fields, and autoResizeEnabled.
  - SAVE‑7: chatSession.history must store objects with role, content, optional timestamp.
  - SAVE‑8: Save filenames must follow the web pattern sensei_progress_<YYYY-MM-DDTHH-mm-ssZ>.json (ISO string with sanitized
  characters).
  - SAVE‑9: BFF must not interfere with or redefine this format in Phase 1.

  ———

  LLM Gateway & Security

  - LLM‑1: BFF must route all LLM requests through a GeminiGateway abstraction, not directly from controllers.
  - LLM‑2: GeminiGateway must expose methods for streaming main responses and recovering mermaid diagrams, returning iterables and typed
  results as defined in the design.
  - LLM‑3: Gemini API keys and any credentials must only be read from server‑side configuration (env, secrets manager), never from client
  payloads.
  - LLM‑4: No LLM keys or secrets may be embedded in the web bundle or mobile app; all LLM traffic for mobile must go through the BFF.
  - LLM‑5: GeminiGateway must implement timeouts and retries consistent with Functional Spec (e.g., ~60s hard timeout).
  - LLM‑6: Gateway must normalize LLM provider errors into BFF error codes rather than leaking raw provider messages or stack traces.
  - LLM‑7: Gateway must yield response chunks in order for streaming, suitable for direct mapping into Chunk frames.

  ———

  Observability, Logging & Metrics

  - OBS‑1: BFF must log key lifecycle events (session creation, turn submission, stream started/completed, errors, mermaid recovery
  attempts, wrap‑up emission, telemetry ingestion).
  - OBS‑2: Logs must include correlation identifiers where possible (requestId, sessionId, turnId, clientTurnId, IP, User-Agent).
  - OBS‑3: A Logger utility must centralize structured logging with methods like info, warn, error, debug.
  - OBS‑4: Turn latency (submit to first chunk), stream duration, and error rates by code must be derivable from logs.
  - OBS‑5: TelemetryService must log number of events per batch and sample event names, not raw payloads, to avoid PII.
  - OBS‑6: For telemetry ingest failures (downstream telemetry backend issues), BFF must log the error but still respond 204/200 to
  clients.

  ———

  Implementation Structure & Modularity

  - IMPL‑1: BFF must be refactored from the current dev stub into a modular structure with server, routes, services, infra, integration,
  and contracts directories.
  - IMPL‑2: bff/index.js must remain the entry script and delegate to server.ts so npm start continues to work.
  - IMPL‑3: HTTP server (server.ts) must configure JSON body parsing with appropriate size limits (e.g., 2MB), CORS, request logging, and
  error middleware using ErrorMapper.
  - IMPL‑4: SessionRouter must handle POST /sessions and POST /sessions/:sessionId/turns, applying schema validation and rate limiting
  middleware.
  - IMPL‑5: MermaidRouter must handle POST /mermaid/recover; TelemetryRouter must handle POST /telemetry.
  - IMPL‑6: A WebSocket server (streamServer.ts) must attach to the same HTTP server and route connections to StreamController.
  - IMPL‑7: SessionService, TurnService, StreamingService, MermaidService, WrapUpService, and TelemetryService must encapsulate domain
  logic.
  - IMPL‑8: SessionStore, RateLimiter, ErrorMapper, Logger, TopicRegistry must live under an infra layer and be injected into services.
  - IMPL‑9: GeminiGateway and SenseiCoreAdapter must be defined in an integration layer to allow swapping implementation (Core
  extraction) without changing routes.
  - IMPL‑10: contracts must centralize zod schemas and TS interfaces derived from Contracts v1 and be reused across handlers and tests.

  ———

  Versioning, Headers & Compatibility

  - VER‑1: REST and WS contracts are considered v1; breaking changes must be versioned and coordinated.
  - VER‑2: RN↔WebView bridge is versioned as v1; breaking changes require simultaneous client updates.
  - VER‑3: Save-file schema version is "2.0.0"; loaders must reject mismatched major versions.
  - VER‑4: Clients should send X-App-Version: <semver> and X-Client-Platform: ios with BFF calls.
  - VER‑5: BFF should respond with X-Api-Version: 1.0 for observability.
  - VER‑6: Incompatibility detection may use 426 Upgrade Required with { message, minVersion }, but in Phase 1 BFF should mostly log and
  not enforce strict minimum versions.

  ———

  Edge Cases, Risks & QA

  - QA‑1: Mobile WebView builds must be configured so that API_KEY is not set and any attempt to initialize in‑bundle Gemini fails fast.
  - QA‑2: When running in RN WebView (window.ReactNativeWebView present), web bundle must avoid making direct Gemini calls; instead it
  must rely on BFF‑mediated paths.
  - QA‑3: loadCurriculumAndGreet() must be adjusted (in the WebView path) to treat BFF as the LLM backend rather than initializing its
  own Gemini client.
  - QA‑4: Debug builds should log a warning if both RN WebView environment and an active Gemini client are detected concurrently.
  - QA‑5: Streaming implementation must always guard WS sends with state checks, and treat thrown sends as fatal to the current stream.
  - QA‑6: BffClient must maintain its current error mapping (e.g., from WS Error frames to DOWNSTREAM_UNAVAILABLE, PARSE_ERROR, etc.) so
  RN UI responds correctly.
  - QA‑7: Multiple concurrent WS connections for the same turnId are allowed; only one is guaranteed to be presented to the user in Phase
  1.
  - QA‑8: If a WS connects without turnId, or with missing/invalid query params, BFF must send BAD_REQUEST error and close.
  - QA‑9: Repeated /mermaid/recover calls for the same diagram are allowed and treated independently; no idempotency is required on this
  endpoint.
  - QA‑10: Telemetry ingestion failures must never bubble up as 4xx/5xx; they are log‑only.
  - QA‑11: Integration tests (or smoke tests) must exercise /sessions, /turns, WS streaming, /mermaid/recover, and /telemetry, asserting
  status codes and basic shapes.
  - QA‑12: Mobile E2E readiness requires: mobile app starts, WebView loads and shows module list, first teaching turn uses BFF /turns +
  WS stream, wrap‑up and mermaid flows work end‑to‑end, limits and rate limits are enforced with correct error messaging.

Here are just the BFF‑side tags:

  - ARCH-1, ARCH-2, ARCH-3, ARCH-4, ARCH-5, ARCH-6, ARCH-7, ARCH-8, ARCH-9, ARCH-10
  - SESS-1, SESS-2, SESS-3, SESS-4, SESS-5, SESS-6, SESS-7, SESS-8, SESS-9, SESS-10, SESS-11
  - TURN-1, TURN-2, TURN-3, TURN-4, TURN-5, TURN-6, TURN-7, TURN-8, TURN-9, TURN-10, TURN-11, TURN-12, TURN-13, TURN-14, TURN-15, TURN-
  16, TURN-17, TURN-18
  - WS-1, WS-2, WS-3, WS-4, WS-5, WS-6, WS-7, WS-8, WS-9, WS-10, WS-11, WS-12, WS-13, WS-14, WS-15, WS-16, WS-17, WS-18, WS-19, WS-20,
  WS-21, WS-22
  - STATE-1, STATE-2, STATE-3, STATE-4, STATE-5, STATE-6, STATE-7, STATE-8, STATE-9, STATE-10
  - LIMIT-1, LIMIT-2, LIMIT-3, LIMIT-4, LIMIT-5, LIMIT-6, LIMIT-7, LIMIT-8
  - ERROR-1, ERROR-2, ERROR-3, ERROR-4, ERROR-5, ERROR-6, ERROR-7, ERROR-8, ERROR-9, ERROR-10
  - MER-1, MER-2, MER-3, MER-4, MER-5, MER-6, MER-7, MER-8, MER-9, MER-10
  - WRAP-1, WRAP-2, WRAP-3, WRAP-4, WRAP-5, WRAP-6, WRAP-7, WRAP-8
  - TEL-1, TEL-2, TEL-3, TEL-4, TEL-5, TEL-6, TEL-7, TEL-8
  - LLM-1, LLM-2, LLM-3, LLM-4, LLM-5, LLM-6, LLM-7
  - OBS-1, OBS-2, OBS-3, OBS-4, OBS-5, OBS-6
  - IMPL-1, IMPL-2, IMPL-3, IMPL-4, IMPL-5, IMPL-6, IMPL-7, IMPL-8, IMPL-9, IMPL-10
  - VER-1, VER-2, VER-3, VER-4, VER-5, VER-6
  - QA-1, QA-2, QA-3, QA-4, QA-5, QA-6, QA-7, QA-8, QA-9, QA-10, QA-11, QA-12



Implemented tags

    - ARCH-1–ARCH-9
    - SESS-1–SESS-11
    - TURN-1–TURN-4, TURN-6–TURN-14, TURN-18
    - WS-1–WS-10, WS-12–WS-16, WS-18, WS-20–WS-22
    - STATE-1–STATE-6, STATE-8–STATE-9
    - LIMIT-1, LIMIT-2, LIMIT-4, LIMIT-5, LIMIT-7, LIMIT-8
    - ERROR-3, ERROR-5–ERROR-9
    - MER-1–MER-6, MER-10
    - TEL-1–TEL-6, TEL-8
    - LLM-1, LLM-3, LLM-4, LLM-7
    - OBS-1, OBS-3, OBS-5, OBS-6
    - IMPL-1–IMPL-9
    - VER-1
    - QA-5, QA-7–QA-10

    ———

    Remaining tags – partially implemented (with gap)

    - ARCH-10 — SenseiCoreAdapter/mermaid handling exist but prompts/behavior are not yet aligned with the detailed web-side logic.
    - TURN-5 — Empty strings are rejected, but whitespace-only input.text still passes validation.
    - TURN-15 — Rate limiter returns a fixed Retry-After equal to the window, not the exact remaining time.
    - STATE-7 — Idempotency entries expire logically via TTL check but there is no explicit pruneIdempotency API/cleanup pass.
    - STATE-10 — Session cleanup relies on TTL checks on access; no periodic sweeper to reclaim idle sessions.
    - LIMIT-3 — Retry-After is window-based rather than computed from the oldest timestamp in the bucket.
    - LIMIT-6 — There is no trim-based check, so whitespace-only messages are not rejected.
    - ERROR-1 — /sessions and /turns use { code, message }, but /mermaid/recover 400 responses return { error: ... } instead.
    - ERROR-2 — BAD_REQUEST is used consistently for sessions/turns errors, but mermaid 400s do not expose a code: "BAD_REQUEST" field.
    - ERROR-10 — ErrorMapper is only used for WS errors; HTTP paths use ad-hoc sendError without a shared mapper.
    - MER-7 — Invalid mermaid payloads return 400 but not in the standardized { code, message } error shape.
    - WRAP-1 — The streaming pipeline calls WrapUpService.maybeGenerateWrapUp once per stream, but the service always returns null.
    - WRAP-2 — WS wrapUp frames are wired structurally, but no validated wrap-up payload is ever produced or enforced.
    - TEL-7 — Telemetry logging includes raw ip and userAgent rather than an explicitly anonymized device metadata envelope.
    - LLM-2 — GeminiGateway exposes streamMainResponse/recoverMermaidDiagram, but both are stubbed and do not call real Gemini yet.
    - LLM-5 — A hard stream timeout is enforced in StreamingService, but there is no LLM-level timeout/ retry policy inside the gateway.
    - OBS-2 — Logs include a requestId and sometimes session/turn IDs, but correlation identifiers are not consistently attached
      everywhere.
    - OBS-4 — Logs allow rough inspection, but there are no explicit latency/stream-duration metrics or counters.
    - IMPL-10 — Zod schemas/types exist but are embedded in controllers, not centralized in a shared contracts module.

    ———

    Remaining tags – not implemented in the current BFF

    - TURN-16, TURN-17
    - WS-11, WS-17, WS-19
    - ERROR-4
    - MER-8, MER-9
    - WRAP-3, WRAP-4, WRAP-5, WRAP-6, WRAP-7, WRAP-8
    - LLM-6
    - VER-2, VER-3, VER-4, VER-5, VER-6
    - QA-1, QA-2, QA-3, QA-4, QA-6, QA-11, QA-12


# Recursive Sensei — Contracts v1 (Phase 1 Mobile)

Version: 1.0 (Draft)
Date: 2025-11-12
Owner: Engineering

Normative scope
- This document defines the Phase 1 contracts for the BFF (REST + WS), the RN↔WebView bridge, the save‑file JSON format, and telemetry/crash envelopes. It supplements the Functional Spec (Phase 1) and the Mobile Engineering Spec. Where details are product requirements (timeouts, limits, retries), they are taken directly from the Functional Spec. Where details are grounded in current web behavior, file:line anchors are cited.

Notes on grounding
- Web code streams via SDK and updates DOM incrementally (src/interactionHelpers.ts:58, 262–287 → src/ui.ts:2391–2460).
- Message bubbles use string IDs like `msg-<number>` (e.g., `currentMessageId` increment and `msg-${id}` in src/moduleSelectionHandler.ts around concept selection and intros), which this contract reuses for `messageId` where applicable.
- Selection overlay positions itself using `Range.getBoundingClientRect()` (src/selectionSensei.ts:1101–1136); the RN bridge exposes selection rects for equivalent placement.

—

1) REST API (OpenAPI 3.1 excerpt)

```yaml
openapi: 3.1.0
info:
  title: Sensei Phase 1 BFF API
  version: 1.0.0
servers:
  - url: https://{host}
    variables:
      host:
        default: api.example
paths:
  /sessions:
    post:
      summary: Initialize a Sensei session (no persistence in Phase 1)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                topicId:
                  type: string
                  description: Logical subject/topic key. For Phase 1 mobile, the only supported value is "c++_recursive_mastery" (the existing recursion curriculum); the BFF validates topicId against a server-owned topic registry.
                metadata:
                  type: object
                  description: Optional, open-ended observability context (e.g., { source, appVersion }); servers MUST tolerate unknown fields.
                  additionalProperties: true
              required: [topicId]
      responses:
        '200':
          description: Session initialized
          content:
            application/json:
              schema:
                type: object
                properties:
                  sessionId:
                    type: string
                  stateBootstrap:
                    type: object
                    description: Optional, reserved for future server-driven bootstrap hints; MUST be omitted or ignored by Phase 1 mobile clients.
                required: [sessionId]
        '400': { description: BAD_REQUEST }
  /sessions/{sessionId}/turns:
    post:
      summary: Submit a learner turn and receive a streaming URL
      parameters:
        - in: path
          name: sessionId
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                clientTurnId:
                  type: string
                  description: Idempotency key; re‑posting returns the same turn result.
                input:
                  type: object
                  properties:
                    text:
                      type: string
                      minLength: 1
                      maxLength: 4000
                  required: [text]
                metadata:
                  type: object
                  description: Optional, open-ended per-turn context. Any information about client/platform (e.g., source, appVersion) is already derivable from the associated session; servers MUST NOT require turn metadata for correctness and MUST tolerate unknown fields.
                  additionalProperties: true
              required: [clientTurnId, input]
      responses:
        '200':
          description: Stream info
          content:
            application/json:
              schema:
                type: object
                properties:
                  turnId: { type: string }
                  streamUrl: { type: string, format: uri }
                required: [turnId, streamUrl]
        '400': { description: BAD_REQUEST }
        '413': { description: Input too long (max 4000 chars) }
        '429':
          description: RATE_LIMITED (3 turns/min per IP/UA in Phase 1)
          headers:
            Retry-After:
              schema: { type: integer, minimum: 1 }
        '503': { description: DOWNSTREAM_UNAVAILABLE }
        '504': { description: TURN_TIMEOUT }
  /mermaid/recover:
    post:
      summary: Attempt to fix an invalid Mermaid diagram
      description: Returns a fixed diagram when possible. Supports `mode` to distinguish deterministic+LLM (`auto`) from forced LLM (`llm`); if no repair is possible, returns { fixed:false } or 422.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                messageId: { type: string }
                code: { type: string, description: Original mermaid code fence }
                theme: { type: string }
                errorHash: { type: string }
                context: { type: object }
                errorMessage: { type: string }
                mode: { type: string, enum: ['auto', 'llm'], description: "`auto` runs deterministic transforms and, if they make no change, falls through to an LLM attempt in the same call; `llm` skips deterministic early-returns and always calls the LLM." }
              required: [messageId, code]
	      responses:
	        '200':
	          description: Fixed diagram or negative result
          content:
            application/json:
              schema:
                type: object
                properties:
                  fixed: { type: boolean }
                  fixedCode: { type: string }
	              required: [fixed]
	        '400': { description: BAD_REQUEST }
	        '422': { description: Unable to repair with current inputs }
	        '503': { description: DOWNSTREAM_UNAVAILABLE }
	```

Normative behaviors (Mermaid)
- Request:
  - `messageId` and `code` are required; `theme`, `errorHash`, and `context` are optional and may contain arbitrary fields. Servers MUST tolerate unknown fields in `context`.
  - `mode` is optional: `auto` (default) applies deterministic transforms and, if they produce no change, falls through to an LLM attempt within the same call; `llm` skips deterministic short-circuiting and always invokes the LLM. Clients SHOULD send `auto` for the first attempt and `llm` for subsequent retries if needed.
  - `errorMessage` is optional; servers SHOULD forward it to the LLM prompt when provided.
- Responses:
  - 200 with `{ fixed: true, fixedCode }`:
    - Indicates a successful repair; `fixedCode` MUST be a non-empty string containing the diagram the client should render instead of the original.
  - 200 with `{ fixed: false }`:
    - Indicates that the server declined or was unable to produce a better diagram. Clients MUST treat this as a failed recovery (equivalent to “no fix”), and may keep the original code and show an appropriate fallback UI.
  - 400 BAD_REQUEST:
    - Used for malformed payloads (missing `messageId`/`code`, wrong types, etc.). The body SHOULD be `{ code: "BAD_REQUEST", message: "Invalid mermaid recovery payload" }` or a more specific message. Clients MUST treat this as a failed recovery and SHOULD NOT retry automatically with the same payload.
  - 422 Unable to repair:
    - Indicates that the request was valid but a reliable repair is not possible given the inputs. The body SHOULD be `{ code: "BAD_REQUEST", message: "Unable to repair diagram with current inputs." }`. Clients MUST treat this as a failed recovery (equivalent to `{ fixed: false }` for UX) and MAY inform the user that the diagram cannot be repaired.
  - 503 DOWNSTREAM_UNAVAILABLE:
    - Indicates a temporary backend/LLM outage. The body SHOULD be `{ code: "DOWNSTREAM_UNAVAILABLE", message: "Sensei is busy—try again shortly." }`. Clients MAY offer a retry; until then, the recovery attempt is considered failed.

	Normative behaviors
	- Auth: Not required in Phase 1; endpoints are rate‑limited per IP/UA (429 + Retry‑After). [Functional Spec]
	- Input limit: 4000 characters; reject with 413 without opening a stream. [Functional Spec]
	- Idempotency: `clientTurnId` replays return original `turnId` without duplicating work. [Functional Spec]
	- Topic validation: `POST /sessions` must reject unknown topicId values with 400 BAD_REQUEST and a descriptive error message; valid values are determined by the BFF’s server-owned topic registry (Phase 1: "c++_recursive_mastery" only).
	- Error bodies: HTTP 4xx/5xx responses from the BFF use a consistent JSON shape `{ code: string, message: string }`. For an unknown topicId on `/sessions`, servers SHOULD return `{ code: "BAD_REQUEST", message: "Unknown topicId" }`.
	- Session metadata: `/sessions` `metadata` is optional and treated as an open-ended context object. Servers MAY derive `source` and `appVersion` for logging from either `metadata` or headers (such as `X-App-Version`), but MUST NOT reject unknown metadata fields.
	- Turn metadata: `/sessions/{sessionId}/turns` `metadata` is optional, per-turn context. Core routing, auth, and limits derive from `sessionId` and session metadata; servers MUST NOT require turn metadata to be present and MUST tolerate unknown fields.
	- Empty input: `/sessions/{sessionId}/turns` MUST reject empty or whitespace-only `input.text` with 400 BAD_REQUEST and an error body such as `{ code: "BAD_REQUEST", message: "Input text must not be empty" }`.
	- Rate limiting: `/sessions/{sessionId}/turns` MUST enforce a limit of 3 turns per rolling 60-second window per (client IP, User-Agent) pair. When exceeded, servers MUST respond with HTTP 429, include a `Retry-After` header (seconds until a new turn is allowed), and a body such as `{ code: "RATE_LIMITED", message: "Too many messages—wait a moment before trying again." }`.
	 - Message routing (Phase 1 mobile): For `Chunk` frames, `messageId` is optional and is not used by the mobile client to select bubbles. RN and WebView route updates based on the `messageId` they agreed on when issuing `chat:startMessage` (derived from the `{ turnId, streamUrl }` response); the BFF is not responsible for choosing which message bubble to update.

—

2) WebSocket (AsyncAPI 3 excerpt)

```yaml
asyncapi: 3.0.0
info: { title: Sensei Stream, version: 1.0.0 }
servers:
  prod: { url: wss://{host}/sessions/{sessionId}/stream, protocol: wss }
channels:
  stream:
    address: /sessions/{sessionId}/stream?turnId={turnId}
    messages:
      Status:
        payload:
          type: object
          properties:
            type: { const: status }
            phase: { enum: [started, keepalive, completed] }
            footer: { type: object }
            kcProgress: { type: object }
          required: [type, phase]
      Chunk:
        payload:
          type: object
          properties:
            type: { const: chunk }
            text: { type: string }
            messageId: { type: string }
            enhancer: { type: object }
          required: [type, text]
      WrapUp:
        payload:
          type: object
          properties:
            type: { const: wrapUp }
            payload: { type: object }
          required: [type, payload]
      Error:
        payload:
          type: object
          properties:
            type: { const: error }
            code: { enum: [BAD_REQUEST, RATE_LIMITED, DOWNSTREAM_UNAVAILABLE, TURN_TIMEOUT] }
            message: { type: string }
          required: [type, code, message]
```

Normative behaviors
- Keepalive every 15s. If no data or ping ack for 25s (15s + 10s grace), server switches to buffered mode and delivers a single final payload on the same WS. On hard timeout (~60s) or LLM error, emit `error` and close. SSE fallback is not used in Phase 1. [Functional Spec]
- Liveness: Servers use native WebSocket ping/pong for liveness. JSON `status:keepalive` frames are informational and do not require client JSON acks.
- Lifecycle (Phase 1 mobile):
  - On successful connection, servers MUST first send a `Status` frame with `phase: "started"` before any `Chunk` frames.
  - During streaming, servers MAY interleave `Status` frames with `phase: "keepalive"` between `Chunk` frames; these keepalives are informational.
  - On normal completion, servers MUST send a final `Status` frame with `phase: "completed"` and then close the WebSocket; no further `Chunk`, `WrapUp`, or `Error` frames are sent after `completed`.
  - At most one `WrapUp` frame MAY be sent per stream; if present, it MUST appear before the terminal `Status` frame with `phase: "completed"`.
  - If an `Error` frame is sent, servers MUST close the WebSocket after that frame and MUST NOT send `Status` with `phase: "completed"` or additional `Chunk`/`WrapUp` frames for that stream.

—

3) RN ↔ WebView Bridge (TypeScript contracts)

Grounding
- Web DOM updates during stream are applied via `updateMessageStream(messageId, text)` (src/ui.ts:2391–2460).
- Message IDs for bubbles are string IDs like `msg-<n>` (see creation in src/moduleSelectionHandler.ts around `currentMessageId` increments and `const messageId = \`msg-${...}\``).
- Selection overlay placement uses selection range geometry via `getBoundingClientRect()` (src/selectionSensei.ts:1101–1136).

Types
```ts
// WebView -> RN
export type WebViewToRN =
  | { type: 'selection'; phase: 'start' | 'change' | 'end'; text: string; rect: { x: number; y: number; width: number; height: number }; viewport: { width: number; height: number; scrollY: number } }
  | { type: 'selection:clear' }
  | { type: 'mermaid:error'; messageId: string; code: string; errorMessage: string; errorHash?: string }
  | { type: 'render:progress'; messageId: string; chars: number; elapsedMs: number };

// RN -> WebView
export type RNToWebView =
  | { type: 'chat:startMessage'; messageId: string; sender: 'sensei' | 'user'; reloadable?: boolean; reloadContext?: Record<string, unknown> }
  | { type: 'chat:update'; messageId: string; text: string; replace?: boolean }
  | { type: 'chat:completeMessage'; messageId: string }
  | { type: 'enhance:apply'; messageId: string; markdown: string }
  | { type: 'enhance:revert'; messageId: string }
  | { type: 'theme:update'; name: string }
  | { type: 'footer:update'; focused: boolean }
  | { type: 'wrapup:show'; data: { moduleTitle: string; moduleGoal?: string; conceptSummaries?: string[]; questions: Array<{ id: string; type: 'snippet' | 'concept'; prompt: string; code?: string; choices: string[]; correct_choice: string; explanation: string; interviewer_insight: string }> } };
```

Rules
- Throttle `chat:update` to ≤10 messages/second to avoid jank. [Functional Spec]
- Suppress native iOS selection menu; RN overlay exposes Copy/Share/Sensei actions; VoiceOver actions are mapped accordingly. [Functional Spec]

—

4) Save File JSON Schema (Phase 1 — align to web serialization)

Grounding
- Web save structure: top‑level `{ version, timestamp, metadata, session }`, with `version` currently `"2.0.0"`. See construction in src/saveloadProgressManager.ts:95–114; fields collected in `collectSessionData()` (src/saveloadProgressManager.ts:172–219); download filename pattern `sensei_progress_<ISO>.json` (src/saveloadProgressManager.ts:105–112).

Schema (abbreviated)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "SenseiSaveV2",
  "type": "object",
  "required": ["version", "timestamp", "metadata", "session"],
  "properties": {
    "version": { "const": "2.0.0" },
    "timestamp": { "type": "string", "format": "date-time" },
    "metadata": {
      "type": "object",
      "required": ["moduleName", "phase", "chunkProgress", "sessionDuration", "totalInteractions"],
      "properties": {
        "moduleName": { "type": "string" },
        "phase": { "type": "string" },
        "chunkProgress": { "type": "string" },
        "sessionDuration": { "type": "number" },
        "totalInteractions": { "type": "number" },
        "curriculumChecksum": { "type": "string" },
        "saveEnvironment": { "type": "string" }
      }
    },
    "session": {
      "type": "object",
      "required": ["curriculumState", "learnerModel", "applicationState", "chatSession", "ui", "notepad"],
      "properties": {
        "curriculumState": { "type": "object" },
        "learnerModel": { "type": "object" },
        "applicationState": {
          "type": "object",
          "required": ["currentActiveConceptIndex", "currentMessageId", "lastSenseiResponses", "userInputHistory"],
          "properties": {
            "currentActiveConceptIndex": { "type": ["integer", "null"] },
            "currentMessageId": { "type": "integer" },
            "lastSenseiResponses": { "type": "array", "items": { "type": "string" } },
            "chronologicallyLastLLMSenseiMessageId": { "type": ["string", "null"] },
            "userInputHistory": { "type": "array", "items": { "type": "string" } },
            "pendingModuleSelection": { "type": ["integer", "null"] },
            "pendingPhaseSelection": { "type": ["string", "null"] },
            "pendingConceptSelectionIndex": { "type": ["integer", "null"] },
            "pendingConceptSelectionBubbleId": { "type": ["string", "null"] },
            "autoResizeEnabled": { "type": "boolean" }
          }
        },
        "chatSession": {
          "type": "object",
          "required": ["history", "systemInstruction", "modelConfig"],
          "properties": {
            "history": {
              "type": "array",
              "items": {
                "type": "object",
                "required": ["role", "content"],
                "properties": {
                  "role": { "type": "string" },
                  "content": { "type": "string" },
                  "timestamp": { "type": "string", "format": "date-time" }
                }
              }
            },
            "systemInstruction": { "type": "string" },
            "modelConfig": { "type": "object" }
          }
        },
        "ui": { "type": "object" },
        "notepad": { "type": "object", "properties": { "notes": { "type": "array" } } },
        "consolidation": { "type": ["object", "null"] }
      }
    }
  }
}
```

Filename
- Use web parity naming: `sensei_progress_<YYYY-MM-DDTHH-mm-ssZ>.json` (web uses ISO string with `:` and `.` replaced). (src/saveloadProgressManager.ts:105–112)

—

5) Telemetry & Crash Envelopes (Phase 1)

Normative (Functional Spec)
- Telemetry opt‑out toggle (default ON). When OFF, no telemetry is sent. Events are queued offline and flushed when connected. Sampling default 50% of eligible events. No PII; include anonymized device metadata.
- Crash reporting via Sentry; automatic send without prompt (subject to Apple guidelines); verify in TestFlight.

Event envelope (JSON; fields vary by event)
```json
{
  "event": "turn_submitted",
  "ts": "2025-11-12T04:00:00Z",
  "sessionId": "...",
  "device": { "model": "iPhone14,7", "ios": "16.7", "appVersion": "1.0.0" },
  "sampled": true,
  "data": { "clientTurnId": "...", "textLength": 120 }
}
```

Event names
- turn_submitted, stream_completed, enhance_used, wrapup_submitted, mermaid_recovery_attempt, save_exported, save_imported. [Functional Spec]

Telemetry endpoint (`POST /telemetry`)
- Request:
  - Body: `{ "events": TelemetryEvent[] }`, where each event follows the envelope above (at minimum: `event`, `ts`, `device`, `sampled`, `data`).
  - Servers MUST tolerate missing or extra fields inside individual events; telemetry schemas are intentionally flexible in Phase 1 as long as PII is not included.
- Behavior:
  - Telemetry is best-effort only and MUST NOT affect core chat flows.
  - Servers SHOULD log or forward events and then respond with HTTP 204 (or 200 with an empty body) even if some events are malformed.
  - Servers MUST NOT return 4xx/5xx solely due to telemetry payload issues; at most they log and drop or partially process the batch.

—

6) Error Codes & Semantics
- 400 BAD_REQUEST → user‑visible: “Something went wrong. Please try again.”
- 413 (turns) → “Your message is too long—shorten it and resend.”
- 429 → “Too many messages—wait a moment before trying again.” (include Retry-After)
- 503 → “Sensei is busy—try again shortly.”
- 504 → “Sensei timed out—try again.”
[All per Functional Spec]

—

7) Idempotency
- `clientTurnId` is a required string; duplicates for the same `sessionId` must return the original `turnId` and not duplicate work. Clients should generate a unique value per submission attempt. (Implementation detail such as UUID/ULID is not normative in this contract.) [Functional Spec]
- Retention: Servers MUST retain per-session idempotency records for at least 10 minutes (SHOULD be 60 minutes). Replays outside the retention window MAY return 409 with a descriptive message.

9) HTTP vs WebSocket Error Mapping
- Submit-time errors (no stream started):
  - Schema/validation errors, unknown session, or empty/whitespace-only `input.text` → HTTP 400 with `{ code: "BAD_REQUEST", message: "Something went wrong. Please try again." }` or a more specific message such as `"Input text must not be empty"`; clients MUST NOT open a WebSocket for this turn.
  - Input too long (`input.text.length > 4000`) → HTTP 413 with `{ code: "BAD_REQUEST", message: "Your message is too long—shorten it and resend." }`; no stream is started.
  - Rate limit exceeded at submit → HTTP 429 with `{ code: "RATE_LIMITED", message: "Too many messages—wait a moment before trying again." }` and a `Retry-After` header; no stream is started.
- Stream-time errors (after `/turns` has returned 200 and the client has opened the WebSocket):
  - Downstream LLM/infra failure → WS `Error` frame `{ type: "error", code: "DOWNSTREAM_UNAVAILABLE", message: "Sensei is busy—try again shortly." }`, then close.
  - Turn timeout (~60s) → WS `Error` frame `{ type: "error", code: "TURN_TIMEOUT", message: "Sensei timed out—try again." }`, then close.
  - Late rate-limit (if applicable) → WS `Error` frame `{ type: "error", code: "RATE_LIMITED", message: "Too many messages—wait a moment before trying again." }`, then close.
  - Unexpected internal error during streaming → WS `Error` frame `{ type: "error", code: "BAD_REQUEST", message: "Something went wrong. Please try again." }`, then close.

—

8) Conformance & Versioning
- API is versioned implicitly as v1 for Phase 1 endpoints; changes that affect payloads will be recorded as 1.x minor revisions.
- RN↔WebView bridge is versioned as v1; breaking changes require a coordinated client update.
- Save-file schema uses `version: "2.0.0"` to match current web serializer; loaders must reject mismatched major versions (src/saveloadProgressManager.ts:853–867).

Common headers & version handshake
- Clients SHOULD send `X-App-Version: <semver>` and `X-Client-Platform: ios` on REST requests. Servers SHOULD return `X-Api-Version: 1.0` on responses.
- If an incompatible app version is detected, servers MAY respond `426 Upgrade Required` with a JSON body `{ message: string, minVersion: string }`. In Phase 1, BFF implementations are expected to log `X-App-Version`/`X-Client-Platform` for observability but generally SHOULD NOT enforce minimum versions yet; forced-upgrade behavior can be introduced in later revisions without changing the payload schema.

Persistence & durability (Phase 1)
- Session and turn state on the BFF MAY be stored only in memory; servers are not required to persist this state across restarts or deployments in Phase 1.
- Clients MUST NOT rely on the BFF for long-term learner progress or transcript persistence; save/load remains a client-side responsibility using the JSON schema defined above.

Footer payload (WS `status.footer`)
```yaml
FooterPayload:
  type: object
  properties:
    confidence: { enum: [Low, Medium, High, Uncertain] }
    confusion:  { enum: [Low, Medium, High, Uncertain] }
    intent:     { enum: [AskingQuestion, AnsweringQuestion, ExpressingConfusion, ExpressingUnderstanding, ProvidingFeedback, SeekingReassurance, RequestingCurriculumStart, Other, Uncertain] }
  required: [confidence, confusion, intent]
```

kcProgress payload (optional)
```yaml
KcProgress:
  type: object
  properties:
    currentChunkIndex: { type: integer }
    totalChunks: { type: integer }
```

Rate limit scope
- Phase 1 rate limit applies to `POST /sessions/{id}/turns` only: 3 turns/min per IP/UA. Servers SHOULD include `Retry-After` for 429 responses.

Test fixtures
- Golden inputs and expected outputs are curated in the Engineering Spec appendix; Contracts v1 treats them as non-normative references for QA.

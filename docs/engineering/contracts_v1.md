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
                  description: Default subject/topic; Phase 1 may use a single default.
                metadata:
                  type: object
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
                      maxLength: 4000
                  required: [text]
                metadata:
                  type: object
                  properties:
                    source:
                      type: string
                      enum: [mobile, web]
                    appVersion:
                      type: string
                    selectionSensei:
                      type: object
                      properties:
                        actionId: { type: string }
                        selectedText: { type: string }
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
      description: Returns a fixed diagram when possible. If a repair is not possible deterministically, returns { fixed:false } or 422.
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

Normative behaviors
- Auth: Not required in Phase 1; endpoints are rate‑limited per IP/UA (429 + Retry‑After). [Functional Spec]
- Input limit: 4000 characters; reject with 413 without opening a stream. [Functional Spec]
- Idempotency: `clientTurnId` replays return original `turnId` without duplicating work. [Functional Spec]

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

—

6) Error Codes & Semantics
- 400 BAD_REQUEST → user‑visible: “Something went wrong. Please try again.”
- 413 (turns) → “Your message is too long—shorten it and resend.”
- 429 → “Too many messages—wait a moment before trying again.” (include Retry‑After)
- 503 → “Sensei is busy—try again shortly.”
- 504 → “Sensei timed out—try again.”
[All per Functional Spec]

—

7) Idempotency
- `clientTurnId` is a required string; duplicates must return the original `turnId` and not duplicate work. Clients should generate a unique value per submission. (Implementation detail such as UUID/ULID is not normative in this contract.) [Functional Spec]
 - Retention: Servers MUST retain idempotency records for at least 10 minutes (SHOULD be 60 minutes). Replays outside the retention window MAY return 409 with a descriptive message.

—

8) Conformance & Versioning
- API is versioned implicitly as v1 for Phase 1 endpoints; changes that affect payloads will be recorded as 1.x minor revisions.
- RN↔WebView bridge is versioned as v1; breaking changes require a coordinated client update.
- Save‑file schema uses `version: "2.0.0"` to match current web serializer; loaders must reject mismatched major versions (src/saveloadProgressManager.ts:853–867).

Common headers & version handshake
- Clients SHOULD send `X-App-Version: <semver>` and `X-Client-Platform: ios` on REST requests. Servers SHOULD return `X-Api-Version: 1.0` on responses.
- If an incompatible app version is detected, servers MAY respond `426 Upgrade Required` with a JSON body `{ message: string, minVersion: string }`.

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

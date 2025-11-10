# Functional Specification: Key Takeaway Enhancer (Parallel B‑Sensei Inline Replacement)

Version: 0.2 (Draft)
Owner: Sensei Core
Status: Draft — Option B accepted

## Summary
Introduce the “Key Takeaway Enhancer,” a parallel, stateless secondary AI ("B‑Sensei") launched as soon as pedagogical guidance is resolved and determined to be non‑MUST_OBEY. While the main Sensei streams its response, the system scans for the magic keyword `key_takeaway_placeholder`. When detected, the system replaces that placeholder inline with B‑Sensei’s response as soon as it arrives, updating the already‑streaming message non‑destructively. If a MUST_OBEY directive is active for the turn, the enhancer is not invoked.

## Goals
- Launch Key Takeaway Enhancer as soon as pedagogical guidance is available and is non‑MUST_OBEY.
- Keep B‑Sensei stateless: no chat history across turns; one new Chat per request.
- Detect a unique placeholder token in the streaming main response and replace it inline.
- Perform the replacement immediately upon availability of both conditions: placeholder seen and B‑Sensei text received.
- Keep UI streaming smooth; avoid flicker and preserve main content around the replacement.

## Non‑Goals
- Redesigning main Sensei prompting or persona outside of adding the placeholder contract.
- Persisting B‑Sensei chat history or adding B‑Sensei to transcript.
- Choosing the exact B‑Sensei prompt content; user will provide it.

## Terminology
- Main Sensei: Persistent chat session used for the core teaching response.
- B‑Sensei: Ephemeral chat session created per turn with its own prompt; no history retained.
- Magic keyword: Literal `key_takeaway_placeholder` token emitted by main Sensei to mark inline insertion point.
- MUST_OBEY: Turn‑level directive that, when present, suppresses B‑Sensei invocation.
- Key Takeaway Enhancer: The feature name for the entire flow described in this document.

## User Stories
- As a learner, I see the main Sensei reply stream in and, when it reaches the “key takeaway” section, the final key takeaway appears without delay once it’s ready.
- As a developer, I can enable/disable the Key Takeaway Enhancer globally without changing business logic.
- As an operator, I can diagnose issues via structured logs for B‑Sensei start, receipt, placeholder detection, replacement, and failure handling.

## System Context
Existing flow (simplified):
1) Orchestrator computes pedagogical guidance and dynamic system instruction plus user line.
2) Main Sensei chat (`ai.chats.create` persistent) streams response via `chat.sendMessageStream`.
3) UI updates incrementally with `updateMessageStream(messageId, fullTextSoFar)`.

New elements:
- Key Takeaway Enhancer (B‑Sensei): `ai.chats.create` per turn (empty history) with prompt‑only input; launched right after pedagogical guidance resolves as non‑MUST_OBEY.
- Replacement engine: Watches streaming buffer for `key_takeaway_placeholder` and, upon B‑Sensei arrival, performs a single in‑place substitution and re‑emits the updated text to the UI.

## Functional Requirements
1. Invocation rules
   - R1.1: No Socratic involvement — the enhancer does not run during Socratic turns.
   - R1.2: Fire on every non‑Socratic user‑input turn when `MUST_OBEY` is false (pre‑stream launch).
   - R1.3: Fire on chunk navigation from the header (arrows or mediation menu) that produces a new main response (subject to `MUST_OBEY` and non‑Socratic rules).
   - R1.4: Fire when the learner‑model analyzer/revisit logic modifies the focus points for the current chunk (i.e., new teaching points due to a revisit/clarify decision).
   - R1.5: Launch the enhancer as soon as pedagogical guidance is available and confirmed non‑MUST_OBEY (pre‑stream) for all triggers above.
   - R1.6: If `MUST_OBEY` is active for the turn, do not create B‑Sensei and do not attempt replacement.
   - R1.7: On reload of a message for the current chunk, reuse the previously generated B response unless the chunk’s focus points have changed (e.g., revisit); if changed, re‑fire B.

2. B‑Sensei session semantics
   - R2.1: Create a fresh Chat instance for B‑Sensei per turn with empty `history: []`.
   - R2.2: B is prompt‑only: use a separate B‑prompt; do not include main chat history or turn info.
   - R2.3: B‑Sensei returns a single, non‑streaming text payload (OK if underlying SDK streams; buffer into one string for insertion).
   - R2.4: B must receive the active teaching points context for the current chunk, including the dynamic action marker (e.g., “PRIMARY ACTION FOR THIS TURN: Teach New Content …” or Revisit/Clarify variant) in the same format as provided to main Sensei.
   - R2.5: B uses the same model configuration as the main Sensei (model name and config), defined alongside other configs in `src/model_usage.ts`.

3. Parallel execution
   - R3.1: Launch the B‑Sensei request immediately after guidance is resolved and non‑MUST_OBEY, before main streaming begins (for qualifying triggers above).
   - R3.2: The main streaming loop remains responsive and independent of B‑Sensei progress.

4. Placeholder detection and replacement
   - R4.1: Continuously scan `fullResponseText` for the exact token `key_takeaway_placeholder`.
   - R4.2: Replace only in non‑code segments: do not replace inside fenced code blocks or inline code spans; use the same fenced‑block splitting approach as the UI markdown renderer.
   - R4.3: When the token is detected in a non‑code segment and B‑Sensei text is available, replace it immediately and push the updated `fullResponseText` via `updateMessageStream`.
   - R4.4: If the token appears before B arrives, record its position and perform replacement as soon as B arrives (hot‑plugging mid‑stream).
   - R4.5: There is exactly one placeholder per message by design.

5. Completion and idempotency
   - R5.1: Once a replacement is completed for a message, do not attempt additional replacements for that message.
   - R5.2: Subsequent text chunks from main Sensei append normally after the replaced content.

6. Fallbacks and timeouts
   - R6.1: If the placeholder never appears, no replacement occurs; B‑Sensei response is discarded.
   - R6.2: Post‑stream grace window: if B‑Sensei has not arrived by the time main streaming completes, continue to watch for B and perform inline replacement upon arrival within a 60‑second window.
   - R6.3: After 60 seconds from stream end, remove the placeholder token — except when the only occurrence is within code (fenced or inline), in which case leave it in place and log the skip.
   - R6.4: If B‑Sensei fails, remove the placeholder token — except when the only occurrence is within code (fenced or inline), in which case leave it in place and log the skip.

7. Logging & Telemetry
   - R7.1: Emit logs aligned with existing system patterns (bracketed tags, logger.*). Prepend tag `KEY_TAKE_AWAY_SENSEI` to all related events. Phases: `B_REQUEST_START`, `B_RESPONSE_RECEIVED`, `PLACEHOLDER_DETECTED`, `PLACEHOLDER_REPLACED`, `B_FAILURE`, `PLACEHOLDER_REMOVED`, `CACHE_HIT`, `CACHE_MISS`.
   - R7.2: Record timings: main first‑chunk latency (already present), B total latency, detection→replacement latency.
   - R7.3: Cache logs must not include the prompt hash; include `cacheUsed` (boolean) and `reason` (e.g., `unchanged`, `promptChanged`).

8. UI behavior
   - R8.1: Replacements must not reset scroll position or flicker code blocks.
   - R8.2: Preferred path: perform substitution on the raw text buffer (main Sensei response text) then render via the same markdown pipeline used for main output; do not render B separately. Alternate path (if needed): render HTML, replace in the resulting HTML fragment at a safe boundary, and re‑inject.

## Configuration
- Feature flag: `ENABLE_KEY_TAKEAWAY_ENHANCER` (default: enabled).
- Placeholder token: `KEY_TAKEAWAY_PLACEHOLDER` = `key_takeaway_placeholder`.
- Replacement policy: `REPLACE_MODE` = `first-only`.
- Failure policy: On B failure, remove token (delete the placeholder with no replacement).
- Model config: `B_SENSEI_MODEL_CONFIG` lives in `src/model_usage.ts` and matches `MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG` (same model and config), unless explicitly overridden.
- Prompt prefix: `B_SENSEI_PROMPT_PREFIX` = `Provide key takeaway section for the following teaching points:`
 - Cache: same-session only; cache key is a stable hash of the composed enhancer prompt (prefix + primary-action block). Do not log the hash. Log whether cache was used or re-fired and why.

## Interaction Design
Sequence (happy path):
1) Pedagogical guidance resolves. If non‑MUST_OBEY, start B‑Sensei (prompt‑only) immediately with active teaching points context.
2) Main orchestrator starts main streaming.
3) Main stream emits “… key_takeaway_placeholder …”.
4) B‑Sensei finishes; replacement engine substitutes placeholder with B‑text; UI updates immediately.
5) Main continues streaming remaining content; final message contains the inlined B‑text.

Edge cases:
- Placeholder never appears → B discarded (R6.1).
- B late → replacement occurs mid‑stream on detection (R4.4); if B still hasn’t arrived by stream end, replacement can still occur within the 30‑second post‑stream window; after that, remove the token unless only present inside code (keep and log).
- MUST_OBEY present → Enhancer not started; streaming proceeds unchanged.
- B failure → remove placeholder (token disappears) unless only present inside code (keep and log).
- Single placeholder per message by design; no additional tokens expected.

## Failure Handling
- Network errors on B: log and remove the placeholder per failure policy.
- Main streaming errors: existing error handling remains; no special interaction with B beyond allowing its request to be cancelled.
- Cancellation: If user triggers reload, cancel both in‑flight operations.

## Teaching Points Source (Authoritative)
- Do not manually extract or synthesize the “PRIMARY ACTION …” text or teaching points.
- Use the same internal source as main Sensei:
  - Compute focus points via `calculateFocusPoints(curriculumState)`.
  - Use the same template logic that `buildContextualInstruction(...)` uses to render the primary action block (e.g., `TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE`, `REVISIT_*` templates) so B sees the identical teaching points representation.
- B input MUST include ONLY: (1) the exact header line `## ⭐ PRIMARY ACTION FOR THIS TURN: … ⭐` and (2) the primary-action instruction/template output lines for the teaching points. Exclude any other sections/placeholders (e.g., user input placeholder, pedagogical guidance placeholder, supporting context, checks).
- Prepend to that primary action block the instruction exactly as: `Provide key takeaway section for the following teaching points:` on its own line above the block.
- No other per‑turn context is included for B besides this teaching points block (strictly prompt‑only).

## Observability
- Structured logs (as above) with messageId, policy values, and durations.
- Optional metrics counters: replacements_per_turn, time_to_replacement_ms, b_timeouts.

## Security & Privacy
- B‑Sensei receives only the B‑prompt and the explicitly provided active teaching points context. It must not inherit main chat history.
- No additional PII beyond what main path already handles.

## Configuration
- Feature flag: `ENABLE_KEY_TAKEAWAY_ENHANCER` (default: enabled; in `src/model_usage.ts`).
- Placeholder token: `KEY_TAKEAWAY_PLACEHOLDER` = `key_takeaway_placeholder`.
- Replacement policy: `REPLACE_MODE` = `first-only`.
- Failure policy: remove placeholder on B failure or after post‑stream grace window, with code‑context exception (leave in code; log skip).
- Model config: `B_SENSEI_MODEL_CONFIG` (in `src/model_usage.ts`) matches `MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG` (same model and config), unless explicitly overridden.
- Prompt prefix: `B_SENSEI_PROMPT_PREFIX` = `Provide key takeaway section for the following teaching points:` (in `src/prompts.ts`).
- Post‑stream grace window: `POST_STREAM_GRACE_MS` = `60000` (60 seconds; in `src/model_usage.ts`) to allow B to arrive after main streaming completes.
 - Cache: session‑only; key is a hash of the composed enhancer prompt (prefix + primary‑action block). Do not log the hash; log cache hits/misses and reasons only.

## Acceptance Criteria
1) With feature enabled and no MUST_OBEY, the enhancer starts pre‑stream on qualifying turns: every non‑Socratic user‑input turn, chunk navigation events, and revisit‑driven focus‑point changes.
2) If placeholder appears and B finishes, the placeholder is replaced inline promptly after B arrival; target under 100 ms in local tests.
3) If placeholder appears but B fails, the placeholder token is removed from the final output.
4) If B arrives first, replacement occurs when placeholder later appears.
5) If placeholder never appears, no replacement is attempted.
6) With MUST_OBEY or Socratic phase, no B request is issued.
7) UI streaming remains smooth; no flicker or scroll jumps during replacement.
8) Logs contain the defined events with consistent IDs and timings.
9) B’s input uses the same rendered teaching points block produced by the same template path as main Sensei (no manual reconstruction), with the prepended instruction specified above.
10) If B has not arrived by stream end, replacement can still occur within 60 seconds post‑stream; after 60 seconds, the token is removed unless its only occurrence is inside code.

## Wiring (Option B Only)
Controller passed to streamer (hybrid):
- Where: Create a `KeyTakeawayInlineReplacementController` right after guidance resolves (non‑MUST_OBEY) and before streaming. Pass it to `streamMainSenseiResponse` (extended signature) so detection and replacement logic live next to the chunk loop.
- How: The controller launches B immediately (prompt‑only with the rendered primary action block described above), tracks `hasPlaceholder` and `replacedOnce`, and exposes `onChunk(textSoFar)` that returns the updated buffer after performing first‑occurrence replacement when conditions are met. `streamMainSenseiResponse` calls `controller.onChunk` before delegating to `updateMessageStream`.
- Pros: Encapsulates detection/replacement close to streaming, lowering orchestration complexity; a single integration point for both normal and reload paths.
- Cons: Requires extending the helper’s API; ensure it remains backward‑compatible.

### Controller API (Option B)
- Name: `KeyTakeawayInlineReplacementController`
- Constructor inputs: `{ ai, modelConfig, bPromptPrefix, primaryActionBlock, messageId, placeholder, logger, updateMessageStream, cachedBText? }`
- Methods:
  - `start(): void` — If `cachedBText` present, does not re‑fire B. Otherwise, launches B request and resolves internal `bText` when done.
  - `onChunk(textSoFar: string): string | Promise<string>` — Returns updated buffer after first‑occurrence replacement/removal.
  - `finalize(): Promise<void>` — Called when main streaming ends; starts a 30‑second post‑stream grace timer. If the enhancer result arrives within the window and the placeholder is present in non‑code, perform replacement. If the enhancer fails or the timer expires, remove the token (unless only present in code) and push one final update.

### Reload Semantics
- On reload of a main Sensei message (same chunk), do not re‑launch B‑Sensei.
 - Reuse the prior enhancer result when the composed enhancer prompt (prefix + primary‑action block) is unchanged for the same chunk during the same session; seed the controller with `cachedBText` so `start()` becomes a no‑op.
 - If the composed enhancer prompt changed (focus points updated, different primary action, etc.), re‑fire the enhancer. Log `CACHE_MISS` with a reason (do not log the prompt hash).
 - If the prior enhancer failed and the placeholder appears, remove the token per policy.
- On chunk switch (e.g., via header mediation overlay) that results in new teaching points, launch a fresh B‑Sensei request for the new message (subject to MUST_OBEY and non‑Socratic rules).

### Caching
 - Session‑only cache keyed by a stable hash of the composed enhancer prompt (prefix + primary‑action block). Do not log the hash. Flush cache on app unload.
 - On reload, compare the current composed prompt to the cached key: log `CACHE_HIT` or `CACHE_MISS` and the reason; never log the hash.

## Backward Compatibility
- Optional controller param: `streamMainSenseiResponse` accepts the controller as an optional argument; when omitted, behavior is identical to today.
- Feature flag rollback: `ENABLE_KEY_TAKEAWAY_ENHANCER=false` disables all controller creation and B calls, restoring current behavior.
- No UI contract changes: uses existing `updateMessageStream` and markdown pipeline. If the placeholder is never emitted, output is identical to current.
- Non‑invasive model config: `B_SENSEI_MODEL_CONFIG` is additive and mirrors `MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG`; unused when the feature flag is disabled.
- Stable prompts path: main instruction generation is unchanged; a new helper exposes the primary action block without altering `buildContextualInstruction` callers.
- Reload stability: if no cached B exists (e.g., across sessions), the controller does not re‑fire B; if the placeholder appears, it removes the token per policy so the message remains coherent.

## Decisions (Resolved Ambiguities)
- Scope: Enhancer runs on every non‑Socratic user‑input turn (MUST_OBEY=false), on chunk navigation events (header arrows or mediation menu), and when focus points change due to revisit; exclude Socratic.
- Replacement domain: Perform replacement only in non‑code segments (skip fenced code and inline code) using the same fence splitting as the UI.
- Post‑stream handling: No during‑stream timeout; allow a 60‑second post‑stream grace window for B arrival. After that, remove the token except when only present in code (leave and log).
- Placeholder count: Exactly one placeholder per message by design.
- Reload behavior: Reload uses the cached B output for the same message; if focus points changed (e.g., revisit), re‑fire. On chunk switch, launch a new B (subject to rules above).
- Logging: Use bracketed `[KEY_TAKE_AWAY_SENSEI]` tag consistent with system logs.
- Placeholder emission: Main response already emits `key_takeaway_placeholder` at the intended position.
 - Naming: Do not use “B”/“SenseiB” in code identifiers; use `KEY_TAKEAWAY_ENHANCER` naming (e.g., `KeyTakeawayEnhancerController`).
 - Integration points: Pre‑stream wiring in `generateNextSenseiResponse` and in the reload path; Socratic turns explicitly excluded.

# Mission State: Parallel B‑Sensei Integration (Core Analysis)

Date: 2025-11-10
Triggering protocol: FUNCTIONAL SPECIFICATION PROTOCOL (after Core Step 0)

## Scope & Entry Points (Core Step 1)
- Primary flow: src/index.tsx: generateNextSenseiResponse → src/interactionHelpers.ts: streamMainSenseiResponse → src/ui.ts: updateMessageStream
- Additional callers: src/index.tsx: handleReloadSenseiMessage and src/moduleSelectionHandler.ts: ModuleSelectionHandler.sendSystemSocraticMessage
- LLM SDK: @google/genai Chat instance created in src/index.tsx and used via chat.sendMessageStream in streamMainSenseiResponse
- UI mutation surface: src/ui.ts updateMessageStream (DOM innerHTML, markdown parsing, code highlighting)

## Static Execution Trace (Core Step 2)
1) src/index.tsx::generateNextSenseiResponse#6d82a88a2f68
   → calls streamMainSenseiResponse
2) src/interactionHelpers.ts::streamMainSenseiResponse#83c382dafa6d
   → constructs messageWithContext (USER_LAST_INPUT_PLACEHOLDER substitution)
   → chat.sendMessageStream({ message }) [network stream]
   → for each chunk: updateMessageStream(senseiMessageId, fullResponseText)
3) src/ui.ts::updateMessageStream#5a6304e54e44
   → DOM updates: message bubble text, markdown rendering, code highlighting

Callers to streamMainSenseiResponse:
- src/index.tsx::generateNextSenseiResponse#6d82a88a2f68
- src/index.tsx::handleReloadSenseiMessage#20d7d9046f0e
- src/moduleSelectionHandler.ts::ModuleSelectionHandler.sendSystemSocraticMessage#b4db656944bc

## Dependency & Side‑Effect Analysis (Core Step 3)

Function: streamMainSenseiResponse (src/interactionHelpers.ts)
- Dependencies: GoogleGenAI Chat (chat.sendMessageStream), updateMessageStream, logger
- Side effects: network streaming to LLM; indirect DOM updates via updateMessageStream
- Risks: concurrency with UI streaming; partial updates; ordering guarantees rely on chunk loop

Function: updateMessageStream (src/ui.ts)
- Dependencies: DOM APIs, markdown parser, code highlighter, logger
- Side effects: DOM writes (innerHTML), state writes to streamingMessagesRawText
- Risks: medium blast radius on UI; potential race with concurrent edits; performance during frequent updates

Function: generateNextSenseiResponse (src/index.tsx)
- Dependencies: curriculum state, adaptive engine, UI helpers, geminiService for analysis in some paths
- Side effects: writes to learnerModel and curriculumState; triggers streaming path
- Risks: state changes concurrent with streaming; must remain stable for added parallel B‑Sensei flow

Risk Register (extracted High/Medium)
- High: External I/O via chat.sendMessageStream (network latency, failure)
- Medium: DOM updates during rapid streaming (performance, flicker)
- Medium: Concurrency between main stream and planned B‑Sensei insertion (ordering, idempotency)

Coverage Checklist (functions to validate in downstream testing)
- src/index.tsx::generateNextSenseiResponse#6d82a88a2f68
- src/interactionHelpers.ts::streamMainSenseiResponse#83c382dafa6d
- src/ui.ts::updateMessageStream#5a6304e54e44

## Source Grounding Notes (Core Step 3.5)
- Verified streamMainSenseiResponse lines 226–275 update UI per chunk and collect latency metrics.
- Verified updateMessageStream lines 2213–2277 mutate DOM and render markdown safely.
- Verified Chat creation in src/index.tsx lines ~378–396 with MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG and empty history.

## Assumptions & Unknowns (Gate tracked)
1) Magic keyword string: user proposes "key_takeaway_placeholder"; confirm exact casing and uniqueness.
2) Multiplicity: can main Sensei output include multiple placeholders? If yes, replacement strategy.
3) Timeout & fallback: desired behavior if B‑Sensei is slow or fails.
4) Replacement scope: first occurrence only vs all; replacement must be idempotent across subsequent chunks.
5) Formatting: whether B‑Sensei response should be wrapped (e.g., blockquote, fenced div) before insertion.
6) MUST_OBEY override semantics: confirm that when present, B‑Sensei is not invoked at all.
7) Prompting: B‑Sensei model and system instruction (user to provide); any per‑turn params.

Verification Plans
- Instrument logs for events: B_REQUEST_START, B_RESPONSE_RECEIVED, PLACEHOLDER_DETECTED, PLACEHOLDER_REPLACED, TIMEOUT, FALLBACK.
- Unit test replacement engine with synthetic chunk sequences (placeholder before/after B arrival, no placeholder).
- Integration test with mocked chat streams to assert UI text equals expected after replacement.

## Architectural Insights
- Integration point: orchestrate in index.tsx around generateNextSenseiResponse to initiate B‑Sensei concurrently and pass a replacement callback into streamMainSenseiResponse, or wrap the stream with a controller that watches chunks and performs replacement before delegating to updateMessageStream.
- No persistent history required for B‑Sensei: use ai.chats.create per request with empty history.
- UI is already capable of accepting mid‑stream text revisions through updateMessageStream.

## Bookkeeping and Codebase Needs (Updated)
- Teaching points source of truth: reuse curriculum.calculateFocusPoints(state) and the same template path used by curriculum.buildContextualInstruction to render the primary action block; avoid manual extraction.
- Introduce a small exported helper (e.g., curriculum.renderPrimaryActionBlock(state, item, isMustObey)) that returns exactly the primary action section string used by main Sensei; or refactor buildContextualInstruction internals to expose this block. This enables B‑Sensei prompt construction without parsing.
- Model config: add B_SENSEI_MODEL_CONFIG to src/model_usage.ts mirroring MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG.
- Logging: adopt KEY_TAKE_AWAY_SENSEI tag with events B_REQUEST_START, B_RESPONSE_RECEIVED, PLACEHOLDER_DETECTED, PLACEHOLDER_REPLACED, B_FAILURE, PLACEHOLDER_REMOVED.
- Orchestration wiring options remain: (A) index.tsx pre‑stream launch; (B) controller passed to streamMainSenseiResponse.
- Reload behavior: do not re‑fire B on reload; cache and reuse the previous B response. Controller should accept a seeded `cachedBText` to avoid launching a new request.

## Next Protocol
Core analysis complete. I am now ready to proceed with the FUNCTIONAL SPECIFICATION PROTOCOL.

# Bounded LLM History Context Limit

## Status

Open architectural limitation. Updated during Selection Sensei modal LLM migration PR review remediation on 2026-06-06.

Main Sensei and Selection Sensei now use explicit, role-aware bounded history/context for migrated mobile provider-backed paths. The current implementation is intentionally safer than hidden provider chat history, but it still relies on client-supplied recent context for some flows and should eventually move more modal/conversation state to the server.

Numeric LLM caps are centralized in the BFF cap policy/validation layer:

- Tunable defaults live in `bff/src/config/llmCapPolicy.js`, backed by Core defaults in `core/llmCapPolicy.ts`.
- Shared enforcement lives in `bff/src/validation/llmCapValidation.js`.
- Main Sensei and Selection Sensei select different capability policies, but use the same role-aware cap mechanics for user text, Sensei text, entry counts, aggregate budgets, and session-scoped rate-limit keys.

## Summary

Migrated mobile LLM paths must not rely on hidden provider chat history. WebView and React Native send structured domain context to BFF, BFF validates that context, Core builds prompts, and BFF executes provider calls.

This makes the system auditable and testable, but it introduces explicit context budgets. The product issue is that tutoring answers are naturally long, so role-blind caps or very small history truncation can degrade learning quality by dropping conclusions, examples, or code explanations from follow-up context.

## Current Main Sensei Handling

Main Sensei mobile LLM streams use explicit structured `conversationHistory`.

Current role-aware Main Sensei policy:

- User-authored current message cap: `8000` chars
- User-authored history entry cap: `8000` chars
- Sensei-authored history entry cap: `200000` chars
- Max history entries: `40`, roughly `20` alternating user/Sensei turns
- Aggregate structured prompt context cap: `950000` chars

Main Sensei rate limiting for mobile provider-backed turn/stream requests is session-scoped and conversational: `3` requests per `60000ms` window keyed by `sessionId::ip::userAgent`.

Main Sensei BFF controllers now delegate LLM cap checks to `llmCapValidation` instead of embedding history cap mechanics in route handlers.

The old Main Sensei Core history limits were:

- Max history entries: `8`
- Max characters per entry: `1000`
- Max total history characters: `4000`

Those old values were too small for normal tutoring answers and could remove important conclusions from long Sensei messages.

## Current Selection Sensei Handling

Selection Sensei toolbar actions and modal follow-ups use explicit stateless modal context for the migrated mobile path. The old hidden provider chat path remains desktop-local compatibility only and is gated away from mobile toolbar/follow-up execution.

Current role-aware Selection Sensei policy:

- Selected text cap: `12000` chars
- Original Sensei message/context cap: `200000` chars
- Action label cap: `80` chars
- Ask-question user input cap: `8000` chars
- Follow-up user question cap: `8000` chars
- Modal conversation id cap: `200` chars
- Initial response title cap: `500` chars
- Initial response explanation cap: `200000` chars
- Initial response raw fallback cap: `200000` chars
- User transcript entry cap: `8000` chars
- Sensei transcript entry cap: `200000` chars
- Modal transcript entries: `20`, roughly `10` follow-up turns
- Aggregate structured modal context cap: `800000` chars

Selection Sensei rate limiting for mobile provider-backed modal requests is session-scoped and conversational: `3` valid requests per `60000ms` window keyed by `sessionId::ip::userAgent`.

Selection Sensei BFF controllers keep strict shape/unknown-key validation locally, then delegate all numeric LLM cap checks to `llmCapValidation`.

The previous Selection Sensei BFF caps were:

- `initialResponse.explanation` / `initialResponse.rawText`: `24000` chars
- `modalTranscript`: `24` entries
- each transcript entry: `12000` chars regardless of role
- transcript aggregate: `64000` chars
- total structured input: `96000` chars

Those old role-blind values could reject legitimate long Sensei answers before a follow-up question reached Core.

## What Counts As An Entry

An entry is a single structured message with a role:

- `user`
- `sensei`

If history alternates perfectly, `40` Main entries is roughly `20` full turns and `20` Selection modal entries is roughly `10` follow-up turns. It is not guaranteed to be exactly that many complete turns; the sanitizer keeps the latest valid entries within the role-aware and aggregate limits.

## Why User And Sensei Caps Differ

User-authored input remains strictly bounded because it is direct untrusted request input and can be controlled by a client.

Sensei-authored context receives a much higher cap because normal tutoring answers can be long and may include examples, code, proof sketches, or summaries that are needed for follow-up continuity. Arbitrarily trimming these answers degrades the tutoring experience.

BFF still keeps aggregate request budgets so provider-backed calls cannot grow without bound.

## Remaining Limitation

Selection Sensei modal follow-ups are still stateless at the BFF layer. WebView owns modal state and resends the initial action, initial response, visible transcript, and current follow-up question on every modal request.

This is acceptable for the current migration because BFF validates the structured payload and Core owns prompt construction, but it is not the ideal long-term ownership model. BFF cannot independently know whether client-supplied Sensei transcript text is exactly what the provider produced.

## Recommended Future Fix

Move Selection Sensei modal state to the server.

Desired future behavior:

- WebView sends `modalConversationId` and the new user question for follow-up turns.
- BFF stores or retrieves the initial toolbar action, initial response, transcript, and future compact summary state.
- BFF passes server-owned modal context to Core.
- WebView remains the UI renderer and local interaction owner, not the source of truth for LLM context.

Benefits:

- Avoids resending large Sensei transcript payloads from WebView on every follow-up.
- Avoids trusting client-supplied Sensei text as provider-produced context.
- Enables better server-side summarization once modal history approaches the context budget.
- Makes future cap policy easier to enforce without degrading normal tutoring answers.

## Acceptance Criteria For A Future Server-State Fix

- BFF owns modal state keyed by `modalConversationId`.
- WebView follow-up payloads include only the conversation id and new user-authored question.
- BFF validates user input length before provider execution.
- BFF uses server-owned initial response and transcript for Core prompt construction.
- Tests prove a client cannot forge or inflate Sensei transcript text in follow-up payloads.
- Tests prove long normal Sensei responses are preserved or summarized server-side without silent client truncation.

# Bounded LLM History Context Limit

## Status

Open limitation for Main Sensei bounded history. Documented during Selection Sensei modal LLM migration planning on 2026-06-05.

Selection Sensei update: the modal-specific trust-boundary caps are now implemented and validated in `bff/src/controllers/selectionSenseiController.js`. The Selection Sensei modal flow no longer uses the old hidden provider chat history for mobile toolbar/follow-up execution.

## Summary

Migrated mobile LLM paths must not rely on hidden provider chat history. Instead, WebView/RN sends explicit structured context to BFF, Core builds the prompt, and Core renders bounded recent history into the prompt for continuity.

This is intentional and compliant with the Phase 1 mobile LLM proxy plan, but it creates a practical memory limit: long prior Sensei answers or long follow-up exchanges may be truncated or rejected before the next LLM call, depending on the capability-specific schema.

## Current Main Sensei Handling

Main Sensei migrated mobile streams already use explicit structured `conversationHistory` instead of implicit Gemini chat history.

Current Core history limits:

- Max history entries: `8`
- Max characters per entry: `1000`
- Max total history characters: `4000`

Core then renders the bounded history into a `[Recent Conversation History]` block inside the prompt. That block is used for continuity, pronoun resolution, example freshness, and learner-state awareness.

## What Counts As An Entry

An entry is a single message with a role:

- `user`
- `sensei`

If the history alternates perfectly, `8` entries means roughly `4` user/Sensei turns total:

1. User message
2. Sensei answer
3. User message
4. Sensei answer
5. User message
6. Sensei answer
7. User message
8. Sensei answer

It is not guaranteed to be exactly four full turns. The sanitizer keeps the latest valid `8` entries regardless of role ordering.

## Truncation Direction

Current behavior keeps the beginning of an oversized entry and trims the tail.

Per-entry cap:

- `content.slice(0, 1000)`
- Meaning: preserve the first 1000 characters, drop everything after that.

Entry-count cap:

- keep the latest `8` entries.

Total-history cap:

- walk from newest entry backward until the total reaches `4000` characters.
- if the oldest included entry must be shortened to fit, it also keeps that entry's beginning and drops the tail.

Practical implication: if a Sensei response is 2000 characters, only the first 1000 characters currently survive in `conversationHistory`. Important conclusions near the end of a long response may be lost unless separately represented in structured state.

## Why This Matters

The old browser/provider `Chat` object could implicitly remember more conversation state through Gemini's chat session. That memory was hidden from BFF/Core validation and was not suitable for migrated mobile execution.

The new migrated model is safer and more testable, but it turns conversation memory into an explicit bounded prompt input. Long responses, detailed explanations, or multi-turn follow-ups can lose detail when the history cap is too small for the product's real response shape.

## Selection Sensei Impact

Selection Sensei toolbar actions and modal follow-ups now use explicit stateless modal context for the migrated mobile path. The old `ensureSelectionChat` path remains desktop-local compatibility only and is gated away from mobile toolbar/follow-up execution.

The modal should not forget history. WebView sends structured bounded context for each modal-message request, including:

- selected text
- surrounding/original explanation context
- initial toolbar action type
- initial toolbar result
- visible modal transcript
- current follow-up question

Selection Sensei is more sensitive to aggressive caps than main Sensei because even one Sensei modal answer can be around 2000 characters. For that reason, the migrated Selection Sensei route uses its own larger BFF schema caps instead of reusing the current main Sensei `1000` characters per history entry behavior.

## Accepted Planning Decisions

1. For Selection Sensei unknown 1, use explicit stateless modal context rather than BFF-owned modal state for now.
   - Implication: WebView remains the modal state owner, BFF stays stateless for this modal flow, and the request schema carries enough bounded context for follow-up continuity.

2. For Selection Sensei unknown 2, keep `json5` support and parser usage if needed for exact parser parity.
   - Implication: Core should preserve current Selection Sensei response parsing behavior during migration. Any later parser simplification should be a separate change with golden tests.

3. For trusted-boundary caps, allow as much useful context as possible while keeping strict validation.
   - Implication: Selection Sensei does not reuse the main Sensei `1000` chars per entry cap. Its route uses generous but explicit per-field, per-entry, array-count, aggregate, and total structured-input limits.

Implemented and validated Selection Sensei modal-specific caps:

- `selectedText`: max `12000` chars
- `originalSenseiMessageText`: max `48000` chars
- `actionLabel` / `initialActionLabel`: max `80` chars
- `userQuestion` for `askQuestion`: max `8000` chars
- follow-up `question`: max `8000` chars
- `modalConversationId`: max `200` chars
- `initialResponse.suggestedTitle`: max `500` chars
- `initialResponse.explanation`: max `24000` chars
- `initialResponse.rawText`: max `24000` chars
- `modalTranscript`: max `24` entries
- each `modalTranscript` entry text: max `12000` chars
- `modalTranscript` aggregate text cap: max `64000` chars
- overall prompt-rendered structured input cap: max `96000` chars across selected text, original context, questions, initial response, and transcript

These numbers are intentionally larger than the current main Sensei history caps because Selection Sensei modal follow-up context may include long generated answers. Oversized Selection Sensei modal payloads are rejected at the BFF trust boundary with structured errors rather than silently truncated. Deterministic BFF validation tests cover the caps and user-safe oversize behavior.

## Recommended Follow-Up

For future Main Sensei or Selection Sensei cap changes, keep product behavior in mind:

- one normal modal answer should fit without losing its conclusion
- at least a few follow-up exchanges should preserve enough context for pronoun resolution
- selected text and original context should have separate caps from generated responses
- aggregate request size should remain bounded at the BFF trust boundary
- tests should prove oversized entries are handled predictably and user-safe errors appear when context cannot be accepted

Possible implementation direction:

- Keep current main Sensei history caps unchanged unless separately reviewed.
- Keep Selection Sensei on its own modal-context schema and caps unless a new product decision and tests justify changing them.
- Preserve or change Main Sensei truncation behavior only after separate review; do not infer Main Sensei behavior from the Selection Sensei modal route.
- Consider keeping both a bounded transcript and a structured compact summary/result field so important answer conclusions are not lost only because a generated response exceeded an entry cap.

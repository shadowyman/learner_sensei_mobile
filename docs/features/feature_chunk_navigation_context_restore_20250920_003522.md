# Feature: Chunk Navigation Context Restore

## Summary
- Injected an explicit navigation context when the learner switches chunks without submitting an answer so Sensei restarts instruction instead of praising an imaginary response.
- Extended both standard and Socratic prompt builders to append the navigation note, keeping the user channel empty while informing the model of the UI-driven transition.

## Key Changes
- `index.tsx:462` – Detects empty user input during skip-intervention turns, creates a navigation context string, and emits a single success log when it applies.
- `interactionHelpers.ts:62` – `buildSenseiDynamicSystemInstruction` now accepts an optional navigation context and appends it to the system prompt when present.
- `interactionHelpers.ts:108` – `buildSocraticExecutionInstruction` forwards the navigation context for Socratic plans, ensuring consistent behavior across phases.

## Behavioral Impact
- Switching chunks via the meditation overlay no longer produces congratulatory openings; Sensei restarts the chunk with fresh teaching content.
- Socratic phases inherit the same behavior, preventing false positives when navigation occurs mid-dialogue.

## Validation
- Manual run: opened the meditation overlay, toggled to a different chunk, confirmed the log entry `[CHUNK_NAV] Navigation context applied for chunk navigation turn` and saw the generated prompt include the `[NavigationContext]` section without fabricated praise.
- Verified `User:` remained blank in the streamed prompt while the navigation block appeared in the system context.

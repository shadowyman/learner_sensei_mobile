# Mermaid Recovery Unification

## Summary
- Main conversation rendering still uses the shared `runMermaidRecovery` workflow before falling back to static error messaging (`src/ui.ts:3069-3083`, `core/mermaidErrorRecovery.ts:296-323`).
- SelectionSensei no longer participates in Mermaid recovery; current code strips Mermaid blocks and logs `[SEL_MERMAID_DISABLE]` events instead (`src/selectionSensei.ts:1540`, `src/selectionSensei.ts:1585-1600`).

## Rationale
- The shared recovery path still matters for main conversation Mermaid renders, but SelectionSensei has since moved away from Mermaid rendering entirely.

## Key Changes
- `core/mermaidErrorRecovery.ts:296-323` still provides the shared retry orchestrator with a default `maxAttempts = 5`.
- `src/ui.ts:3069-3083` still invokes that orchestrator for main conversation Mermaid recovery.
- `src/selectionSensei.ts:1585-1600` now normalizes Mermaid code blocks out of SelectionSensei responses instead of routing them through recovery.

## Behavioral Impact
- Conversation bubbles can still retry Mermaid renders up to five times before failing over.
- SelectionSensei responses no longer attempt Mermaid repair; Mermaid blocks are downgraded to regular code blocks in that surface.

## Validation
- Current static verification confirms shared recovery usage in `src/ui.ts` and the current Mermaid-disable path in `src/selectionSensei.ts`.
- The historical `MERMAID_RECOVERY` log sample cited in the original note is not present in the current `logs/console_logs.log`, so that run cannot be re-proven from retained artifacts.

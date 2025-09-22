# Mermaid Recovery Unification

## Summary
- Centralized the AI-assisted Mermaid retry workflow and extended it to SelectionSensei so every surface leverages the same five-attempt recovery loop before falling back to static error messaging.

## Rationale
- Previous single-attempt modal rendering left SelectionSensei users without AI fixes. Consolidating retry logic ensures consistent resilience across both real-time Sensei responses and selection popups.

## Key Changes
- Introduced `runMermaidRecovery` orchestrator to sequence render attempts and delegate fixes (`mermaidErrorRecovery.ts:386`).
- Updated conversation rendering to invoke the orchestrator and reuse the shared spinner/error UI (`ui.ts:1167`).
- Swapped SelectionSensei’s bespoke renderer for the shared recovery pathway (`selectionSensei.ts:562`).

## Behavioral Impact
- Conversation bubbles and SelectionSensei modals now retry up to five times with Gemini-provided diagrams before declaring failure.
- Exhausted retries emit a single error log while success paths quietly replace the thumbnail, keeping noise low outside debug mode.

## Validation
- Triggered a failing SelectionSensei diagram; logs record the staged attempts and eventual success (`logs/console_logs.log`, `MERMAID_RECOVERY Attempt 1/2`).

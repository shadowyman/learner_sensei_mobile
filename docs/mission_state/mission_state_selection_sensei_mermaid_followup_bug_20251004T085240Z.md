# Mission State: Selection Sensei Mermaid Follow-Up Recovery Bug (Core Analysis)

- Timestamp: 2025-10-04T08:52:40Z (UTC)
- Analyst: Gene (Apollo Flight Director persona)

## Step 4 Declaration
Core analysis complete. I have mapped the follow-up mermaid recovery path and identified all dependencies and side effects. I am ready to proceed with the COMPREHENSIVE IMPACT ANALYSIS PROTOCOL and the MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL.

## Scope & Entry Points
- `selectionSensei.ts::SelectionSensei.handleFollowupSubmit`
- `selectionSensei.ts::SelectionSensei.dispatchFollowupToAI`
- `selectionSensei.ts::SelectionSensei.appendModalMessage`
- `ui.ts::displayMessage`
- `selectionSensei.ts::SelectionSensei.processMermaidDiagrams`
- `mermaidErrorRecovery.ts::runMermaidRecovery`

## Static Execution Trace
1. `SelectionSensei.handleFollowupSubmit` gates composer state and queues follow-up payloads.
2. `SelectionSensei.dispatchFollowupToAI` posts the follow-up, seeds/loading bubble, then hydrates the final Sensei reply.
3. `SelectionSensei.appendModalMessage` validates modal DOM and relays messages through `ui.displayMessage` into the transcript registry.
4. `ui.displayMessage` rebuilds/updates the Bubble DOM, runs highlight/copy adorners, and currently triggers `runMermaidRecovery` with `window.ai` when `mermaidManager.render` fails.
5. `SelectionSensei.updateResponseModalContentAndTitle` (first Sensei response path) calls `SelectionSensei.processMermaidDiagrams`, which scopes recovery with `this.ai` and local container context.
6. `SelectionSensei.processMermaidDiagrams` renders diagrams per container and falls back to `runMermaidRecovery` with the selection-sensei AI and a message-scoped `renderAttempt`.
7. `mermaidErrorRecovery.runMermaidRecovery` orchestrates up to five render/fix attempts, delegating to `attemptMermaidFix` for GenAI rewrites before returning final SVG/diagram pairs.

## Dependency & Side-Effect Table
| Function | Key Dependencies | Side Effects & Risk | Notes |
| --- | --- | --- | --- |
| `SelectionSensei.handleFollowupSubmit` | `setComposerEnabled`, `generateModalMessageId`, `appendModalMessage`, `dispatchFollowupToAI`, `logger` | Writes `followupInFlight`, mutates composer input value. Risk: Medium (state sync, DOM writes). | Ensures one in-flight follow-up at a time.
| `SelectionSensei.dispatchFollowupToAI` | `ensureSelectionChat`, `formatFollowupAnswer`, `appendModalMessage`, `setComposerEnabled`, `generateModalMessageId` | Repeated `followupInFlight` updates, AI chat call. Risk: High (networked AI call, modal state). | Reuses `loadingMessageId` for in-place updates.
| `SelectionSensei.appendModalMessage` | `ensureDOMElementsValid`, `ui.displayMessage` | Relies on global display pipeline to mutate transcript DOM. Risk: Medium-High (shared UI path, global registries). | Current bug surface because mermaid handling is delegated here.
| `ui.displayMessage` | `mermaidManager.render`, `runMermaidRecovery`, `renderMermaidThumbnailWithTheme`, `replaceMermaidFenceInRaw`, HLJS helpers | Extensive DOM mutations, timers, registry writes, invokes `runMermaidRecovery` with `window.ai`. Risk: High (global side effects, cross-context AI usage). | Shared across entire product; changes have wide blast radius.
| `SelectionSensei.processMermaidDiagrams` | `mermaidManager.render`, `renderMermaidThumbnailWithTheme`, `runMermaidRecovery`, `logger` | Replaces code blocks, inserts status divs. Risk: Medium-High (DOM rewrites within modal). | Scoped to provided container; already uses `this.ai`.
| `mermaidErrorRecovery.runMermaidRecovery` | `attemptMermaidFix`, `mermaidManager.render` (via callback), `logger` | Potential LLM calls (cost, latency). Risk: High (LLM usage, multi-attempt loop). | `maxAttempts` default 5; needs guarding per message.

## Risk Register
- High: `ui.displayMessage` coupling to `window.ai` for recovery introduces cross-message contamination when used inside selection sensei modal, because modal follow-ups reuse global registries.
- High: `runMermaidRecovery` may invoke GenAI fixes up to five times per render failure, so we must ensure follow-up messages do not trigger unnecessary recovery loops.
- Medium: Adjusting `appendModalMessage` must preserve transcript registry invariants (timers, raw text map) to avoid regressions in copy/highlight affordances.

## Coverage Checklist
- `SelectionSensei.handleFollowupSubmit`
- `SelectionSensei.dispatchFollowupToAI`
- `SelectionSensei.appendModalMessage`
- `ui.displayMessage`
- `SelectionSensei.processMermaidDiagrams`
- `mermaidErrorRecovery.runMermaidRecovery`

## Unknowns Register
| Item | Impact | Verification Plan | Owner |
| --- | --- | --- | --- |
| Confirm bubble-level `.message-text` exists when `displayMessage` is called with `skipMermaid` so custom processing can execute. | Medium | Inspect DOM after patch & add targeted unit/UI test covering sensei follow-up mermaid rendering. | Gene |

## Architectural Insights
- Selection Sensei modal shares the global `displayMessage` pipeline, so any change to mermaid recovery in that pipeline affects both global chat and modal transcripts.
- The modal already has a scoped `processMermaidDiagrams` helper that passes `this.ai`; aligning follow-up rendering with that helper will contain recovery to the active message.
- Message registry objects (timers, raw text) are injected from Selection Sensei, so custom mermaid handling must continue to rely on those registries after `displayMessage` completes.

## Next Protocols
1. COMPREHENSIVE IMPACT ANALYSIS PROTOCOL (before editing `selectionSensei.ts` / `ui.ts`).
2. MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL (bug investigation & fix).


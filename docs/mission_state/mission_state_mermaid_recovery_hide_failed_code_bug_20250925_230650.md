Mission State Checkpoint — mermaid_recovery_hide_failed_code_bug

Entry Point & Scope
- Entry: Sensei message rendering in `ui.ts` and SelectionSensei diagram handling in `selectionSensei.ts`.
- Primary files: `ui.ts`, `selectionSensei.ts`, `mermaidErrorRecovery.ts`, `mermaidManager.ts`, `logger.ts`.
- Concern: Post-recovery failure UI still embeds raw Mermaid code; missing dedicated debug log of failed diagram.

Static Execution Trace
- Sensei message: add/update bubble -> markdown -> find `code.language-mermaid` -> `mermaidManager.render` -> catch -> `runMermaidRecovery` (maxAttempts=5) -> null -> create error div with raw code.
- Phase-2 reprocess: `processMermaidBlocks` path mirrors above and on failure inserts error div with raw code.
- SelectionSensei: `processMermaidDiagrams` -> `mermaidManager.render` -> catch -> `runMermaidRecovery` -> null -> inserts error div with raw code.

Dependency & Side-Effect (DSE) Highlights
- `mermaidManager.render(id, code)` depends on Mermaid lib; side effects: throws on parse/render failure.
- `runMermaidRecovery(opts)` depends on `attemptMermaidFix` and optional AI; side effects: logs `[MERMAID_RECOVERY]` errors; returns `{svg, diagram}` or null after 5 attempts.
- UI failure branches (both surfaces) depend on DOM; side effects: replace codeblock with an error container that currently includes the failed diagram code; logs generic errors only.

Initial Understanding
- Root behavior mismatch: after 5 failed fix attempts, UI should not display the codeblock; instead, it must show only `[Sensei's diagram could not be rendered, and automatic fix failed]` and log the full Mermaid code at debug level.

Next Protocol
- Proceed with Adaptive Root Cause Analysis: evidence mapping, hypothesis expansion, and remediation strategy selection.

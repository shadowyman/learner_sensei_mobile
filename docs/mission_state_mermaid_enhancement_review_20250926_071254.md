# Mission State: mermaid_enhancement_review (2025-09-26 07:12:54)

**Scope & Entry Points**
- `enhancementManager.ts`: `applyEnhancements`, `removeEnhancements`, and the injected `renderMarkdown` dependency.
- `ui.ts`: `renderEnhancedMarkdown`, `processMermaidBlocks`, and downstream recovery helpers.
- Supporting modules: `mermaidErrorRecovery.ts` (`runMermaidRecovery`), `logger.ts`, DOM helpers referenced by `renderEnhancedMarkdown`.

**Static Execution Trace**
1. `applyEnhancements(messageId, originalMarkdown, payload)` prepares state and invokes `renderMarkdown(...)` with `skipMermaidProcessing: true`.
2. Injected `renderMarkdown` resolves to `renderEnhancedMarkdown(messageId, markdown, highlights, options)` in `ui.ts`.
3. `renderEnhancedMarkdown` rebuilds `.message-text`, highlights code, and either calls `processMermaidBlocks(messageId, { skipRecovery: true })` or the default path without options.
4. `processMermaidBlocks` iterates Mermaid code blocks, rendering via `mermaidManager.render`. On failure it conditionally logs, optionally bypasses `runMermaidRecovery`, or triggers recovery workflow.
5. Recovery path (when enabled) uses `runMermaidRecovery` to attempt diagram fixes before updating DOM placeholders.
6. `removeEnhancements(messageId)` also calls `renderMarkdown` with `skipMermaidProcessing: true`, exercising the same UI pipeline in reverse.

**Dependency & Side-Effect Analysis (DSE)**

| Function | Dependencies | Side Effects |
| --- | --- | --- |
| `applyEnhancements` | `requireDeps()` (provides `renderMarkdown`, `setLoadingState`, `setActiveState`, `streamingMap`), `applyEnhancementSequence`, `logger` | Mutates `stateByMessage`, toggles loading/active UI state, logs status, awaits injected render which updates DOM |
| `renderMarkdown` (injected) | Bound to `ui.renderEnhancedMarkdown` during initialization | Delegates to UI rendering; inherits DOM mutations and logging from `renderEnhancedMarkdown` |
| `renderEnhancedMarkdown` | DOM APIs (`document.getElementById`), `marked`, `hljs`, `renderIcons`, `processMermaidBlocks`, `addLanguageDisplayToCodeBlocks_internal`, `addCopyButtonsToCodeBlocks_internal`, `streamingMessagesRawText`, `logger` | Overwrites chat bubble HTML, updates streaming text cache, applies syntax highlighting, logs skip path, drives Mermaid processing |
| `processMermaidBlocks` | DOM selection, `mermaidManager.render`, `logger`, `DEBUG_FLAGS`, `runMermaidRecovery`, `replaceMermaidFenceInRaw`, `renderMermaidThumbnailWithTheme` | Renders Mermaid SVGs, manipulates DOM replacements, logs failures, triggers recovery attempts (unless skipped), writes raw fence replacements |
| `runMermaidRecovery` | Google AI client, `mermaidManager`, logger | Asynchronously requests AI-generated diagram fixes, may update DOM via callbacks, logs recovery outcome |
| `removeEnhancements` | `requireDeps()` (same as above), `logger`, `stateByMessage` | Restores original markdown, updates state map, toggles loading/active flags, logs restore operation, invokes `renderMarkdown` with skip flag |

**Architectural Insights**
- Enhancement pipeline relies on dependency injection so UI rendering can evolve without touching manager logic; adding `RenderMarkdownOptions` extends the contract while keeping existing callers untouched (options default to `undefined`).
- Mermaid processing is a second-phase DOM pass; adding `skipRecovery` threads a fast path through both manager and UI layers without altering default behavior for other flows.
- Recovery retries are expensive and involve AI/DOM churn; gating them behind an explicit option mitigates perceived latency for enhancement toggles.

**Next Protocol**
- Proceed to Code Review execution (evaluate `enhancement_fix` changes) once clarifications from the user confirm review focus and expectations.

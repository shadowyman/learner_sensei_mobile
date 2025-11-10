# Mission State: Sensei Markdown Rendering Bug (Core Analysis)

## Analysis Scope & Entry Points
- Primary pipeline: `src/ui.ts::displayMessage` Sensei branch → `sanitizeMarkdownFences` → `parseSanitizedMarkdown` → DOM hydration (`renderIcons`, `highlight.js`, `processMermaidBlocks`) → enhancement helpers.
- Enhancement path mirrors the same renderer via `renderEnhancedMarkdown(messageId, markdown, …)`.
- Hot modules: `src/ui.ts` (sanitizers, renderer, mermaid handling), `src/mermaidManager.ts`, `src/mermaid-theme-integration.js`, `src/logger.ts`, external libs `marked`, `marked-katex-extension`, `highlight.js`.

## Static Execution Trace
1. `renderEnhancedMarkdown` (or Sensei branch of `displayMessage`).
2. `sanitizeMarkdownFences` → `sanitizeClosingBackticksOnly`, `sanitizeCodeFences`, `escapePipesInInlineCode` (with inline pipe placeholder routine), `sanitizeIndentedListItems`.
3. `parseSanitizedMarkdown` → `marked.parse` → `restoreInlinePipePlaceholders`.
4. DOM rehydration: `renderIcons`, `hljs.highlightElement`, conditional `processMermaidBlocks` → `mermaidManager.render` → `renderMermaidThumbnailWithTheme` / `replaceMermaidFenceInRaw` / `runMermaidRecovery`.
5. Post-processing: `addLanguageDisplayToCodeBlocks_internal`, `addCopyButtonsToCodeBlocks_internal`, `attachSenseiBoldInteractions`, `applyEnhancementHighlights` → `highlightAppendAfterKey` & `highlightParagraphAfterKey` → `locateEnhancementRange` → `collectEnhancementTextNodes` → `createEnhancementTextWalker` / `findNthOccurrence` / `findNodeInfoAt` / `stripMarkdownInline` → `surroundEnhancementRange`.

## Dependency & Side-Effect Highlights
- `renderEnhancedMarkdown`: Mutates `.message-text.innerHTML`, updates `streamingMessagesRawText`, runs highlight.js and async mermaid rendering. High DOM blast radius; depends on sanitizer/parsing helpers, logger, enhancement utilities.
- `sanitizeMarkdownFences` & helpers: Pure string transforms except for array line rewrites; dependencies limited to regex helpers. Risk: incorrect regex leading to malformed markdown (Medium).
- `parseSanitizedMarkdown`: Delegates to global `marked.parse` configured with Katex and custom tokenizer override. Risk: parser exceptions halt rendering (High).
- `processMermaidBlocks`: Async DOM mutations, recovery loops, logging; touches `window.ai`, `mermaidManager`, `runMermaidRecovery`. Failure propagates error placeholders; concurrency risk Medium/High.
- Enhancement helpers (`addLanguageDisplay…`, `addCopyButtons…`, `attachSenseiBoldInteractions`, `applyEnhancementHighlights`): DOM mutations on rendered content; regression risk Medium if markup shape changes.

## Risk Register (High/Medium Items)
- **High**: `parseSanitizedMarkdown` → `marked.parse` (parser exception `"cannot set src, report to markeddown"` blocks render).
- **High**: `renderEnhancedMarkdown` DOM overwrite combined with async mermaid processing; failure leaves bubble empty.
- **Medium**: `sanitizeIndentedListItems`/`escapePipesInInlineCode` regex rewrites may corrupt list formatting post-code-fence (suspected raw bullet regression).
- **Medium**: `processMermaidBlocks` recovery altering markdown via `replaceMermaidFenceInRaw`; unintended replacements affect saves.

## Coverage Checklist (Functions to Validate)
- `src/ui.ts::renderEnhancedMarkdown@58521`
- `src/ui.ts::displayMessage@69009` (Sensei branch)
- `src/ui.ts::sanitizeMarkdownFences@8892`
- `src/ui.ts::sanitizeClosingBackticksOnly@4208`
- `src/ui.ts::sanitizeCodeFences@3826`
- `src/ui.ts::escapePipesInInlineCode@5944`
- `src/ui.ts::sanitizeIndentedListItems@7851`
- `src/ui.ts::parseSanitizedMarkdown@9265`
- `src/ui.ts::restoreInlinePipePlaceholders@9077`
- `src/ui.ts::processMermaidBlocks@108813`
- `src/ui.ts::addLanguageDisplayToCodeBlocks_internal@53623`
- `src/ui.ts::addCopyButtonsToCodeBlocks_internal@55166`
- `src/ui.ts::attachSenseiBoldInteractions@65684`
- `src/ui.ts::applyEnhancementHighlights@61211` and downstream highlighting helpers
- `src/ui.ts::replaceMermaidFenceInRaw@9772`

## Unknowns Register
| Unknown | Impact | Verification Plan |
| --- | --- | --- |
| Root cause of `"cannot set src, report to markeddown"` thrown during `marked.parse` on post-code-fence content. | High | Reproduce with captured Sensei message through `sanitizeMarkdownFences` + `parseSanitizedMarkdown` in isolation; inspect tokenizer override and Katex plugin behavior for image/link tokens. |
| Reason bullet lists render as raw markdown after same message (suspect sanitizer regex or whitespace trimming). | High | Diff original vs sanitized text; craft unit harness or console repro to see whether `sanitizeMarkdownFences` or custom tokenizer strips necessary newlines. |
| Whether mermaid recovery or highlight hooks mutate markdown before save, compounding rendering bug. | Medium | Track `streamingMessagesRawText` after render for the problematic snippet; ensure replacements match expectations. |

## Key Architectural Insights
- Global `marked` configuration is mutated at module load to disable indented-code blocks; this affects every parse call and may interact with new sanitizers.
- The pipeline saves pre-sanitized markdown in `streamingMessagesRawText`; any DOM-side rewrites must keep map consistent to avoid save/load drift.
- Sensei and enhancement paths share identical sanitization/parsing, so fixes must cover both entrypoints.

## Next Protocol
- Proceed with **MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL** once unknowns are investigated.

## Analyzer Artifacts Consulted
- `tmp/analysis/summary.txt`
- `tmp/analysis/focused_trace.txt`
- `tmp/analysis/focused_functions.json`

## Test Traceability Notes
- Target functional tests should exercise `renderEnhancedMarkdown` via Sensei response rendering and ensure markdown + mermaid flows stay intact (modules under `src/ui.ts`).

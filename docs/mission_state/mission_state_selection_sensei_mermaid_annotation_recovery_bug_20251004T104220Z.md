# Mission State: Selection Sensei Mermaid Annotation Recovery Bug (2025-10-04T10:42:20Z)

## Scope & Entry Points
- Primary: `selectionSensei.ts::SelectionSensei.updateResponseModalContentAndTitle#2ade5dbcf99e` renders Selection Sensei responses inside the modal and kicks off post-processing.
- Secondary: `selectionSensei.ts::SelectionSensei.processMermaidDiagrams#ceda75e36b96` orchestrates diagram rendering, recovery, and DOM replacement; `selectionSensei.ts::SelectionSensei.updateModalMermaidFence#3ace518fbeef` maintains the modal transcript raw-text map during fence updates.
- Supporting modules: `mermaidManager.ts::MermaidManager.render#e1b8d3183151`, `mermaidErrorRecovery.ts::runMermaidRecovery#0d84b0a2f189`, and `mermaid-theme-integration.js::renderMermaidThumbnailWithTheme#a4fc6fc7ed50`.
- Hot modules from analyzer fan-out: `selectionSensei.ts` (8), `ui.ts` (8), `mermaidManager.ts` (5), and `mermaid-theme-integration.js` (DOM-heavy lightbox + annotation logic).

## Static Execution Trace
1. `selectionSensei.ts::SelectionSensei.handleToolbarAction#269e15517539` requests AI output and forwards the response payload to `updateResponseModalContentAndTitle`.
2. `SelectionSensei.updateResponseModalContentAndTitle#2ade5dbcf99e` sanitizes Markdown, rewrites the modal DOM, applies highlight.js, and triggers `processMermaidDiagrams`.
3. `SelectionSensei.processMermaidDiagrams#ceda75e36b96` scans `pre code.language-mermaid` nodes, attempting `mermaidManager.render` for each.
4. When render fails, the inline async handler swaps in a spinner div and invokes `mermaidErrorRecovery.ts::runMermaidRecovery#0d84b0a2f189`, delegating rerenders to `mermaidManager.render` via the provided callback.
5. On recovery success, `mermaid-theme-integration.js::renderMermaidThumbnailWithTheme#a4fc6fc7ed50` replaces the spinner with a themed figure, moves nearby italic captions under the diagram, and wires the lightbox interactions.
6. If a `messageId` context exists, `SelectionSensei.updateModalMermaidFence#3ace518fbeef` refreshes the raw-text map so regenerated fences persist in history (not currently exercised for the main modal body).
7. Failure exhaustion produces a static error block and logs via `logger.error`.

## Dependency & Side-Effect Table
| Function (Stable ID) | Key Dependencies | Side Effects | Risk |
| --- | --- | --- | --- |
| `SelectionSensei.updateResponseModalContentAndTitle#2ade5dbcf99e` | `sanitizeCodeFences`, `marked.parse`, `hljs.highlightElement`, `addLanguageDisplayToCodeBlocks`, `addCopyButtonsToCodeBlocks`, `SelectionSensei.processMermaidDiagrams` | Replaces modal DOM tree, toggles spinner/title, re-enables composer | High |
| `SelectionSensei.processMermaidDiagrams#ceda75e36b96` | `mermaidManager.render`, `runMermaidRecovery`, `renderMermaidThumbnailWithTheme`, `crypto.randomUUID`, `DEBUG_FLAGS`, `logger` | Replaces code blocks with figures/spinners, mutates modal raw-text map via `updateModalMermaidFence` when ID provided | High |
| `SelectionSensei.updateModalMermaidFence#3ace518fbeef` | `modalMessageRegistry.rawText` | Mutates in-memory transcript state for modal messages | Medium |
| `mermaidManager.ts::MermaidManager.render#e1b8d3183151` | `MermaidManager.initializeMermaid`, underlying Mermaid library | Triggers Mermaid initialization, may throw on failure | Medium |
| `mermaidErrorRecovery.ts::runMermaidRecovery#0d84b0a2f189` | `applyUniversalQuoteFix`, `applyBacktickFix`, `attemptMermaidFix`, provided `renderAttempt` callback (LLM + Mermaid) | Orchestrates iterative AI-assisted fixes, rethrows exhaustion errors | High |
| `mermaid-theme-integration.js::renderMermaidThumbnailWithTheme#a4fc6fc7ed50` | `window.mermaidManager`, DOM APIs, lightbox helpers, `logger` | Builds figure/lightbox structure, moves/creates caption nodes, attaches global listeners | High |

## Risk Register
- High: Modal rewrite path in `SelectionSensei.updateResponseModalContentAndTitle` can regress overall modal presentation or leave stale DOM references if interrupted.
- High: `SelectionSensei.processMermaidDiagrams` interleaves async Mermaid rendering with DOM replacement; race conditions can drop annotations or leak spinners.
- High: `renderMermaidThumbnailWithTheme` injects lightbox listeners onto `window`/`document`; incorrect guards could re-enable outside-click dismissal of the modal.
- High: `runMermaidRecovery` depends on AI responses; transient failures could leave the modal without diagrams unless fallback messaging stays robust.

## Coverage Checklist
- `selectionSensei.ts::SelectionSensei.updateResponseModalContentAndTitle#2ade5dbcf99e`
- `selectionSensei.ts::SelectionSensei.processMermaidDiagrams#ceda75e36b96`
- `selectionSensei.ts::SelectionSensei.updateModalMermaidFence#3ace518fbeef`
- `mermaidErrorRecovery.ts::runMermaidRecovery#0d84b0a2f189`
- `mermaidManager.ts::MermaidManager.render#e1b8d3183151`
- `mermaid-theme-integration.js::renderMermaidThumbnailWithTheme#a4fc6fc7ed50`

## Unknowns & Assumptions Register
| Statement & Rationale | Impact | Verification Plan | Owner / Target |
| --- | --- | --- | --- |
| The modal’s primary response path calls `processMermaidDiagrams` without a `messageId`, so recovered fences may not update `modalMessageRegistry.rawText`; need to confirm linkage to annotation handling. | High | Trace modal message creation to determine whether a stable `messageId` exists for the main body and whether passing it resolves raw-text drift. | Self / Before ARCAR Step 4 |
| Recovered diagrams in the modal may lose proximity to their italic captions due to wrapper structure (`contentWrapper` nesting vs. transcript bubbles). | High | Reconstruct DOM fragment from sanitized Markdown (unit test or fixture) and simulate recovery to observe sibling traversal in `renderMermaidThumbnailWithTheme`. | Self / During ARCAR Investigation |
| Lightbox/event listeners added during recovery might interfere with modal outside-click suppression. | Medium | Review pointer/keydown handlers to ensure they stop propagation in the modal context; smoke test after fix. | Self / QA phase |

## Key Architectural Insights
- Selection Sensei reuses the shared Mermaid pipeline but bypasses the global registry unless `messageId` is supplied; modal/raw-text parity depends on explicitly wiring that context.
- Annotation alignment logic in `renderMermaidThumbnailWithTheme` assumes captions are adjacent siblings; additional modal wrappers may require helper utilities or pre-normalization to preserve placement after async swaps.
- Recovery requests rely on the modal’s dedicated `ai` reference (`this.ai`); failure to set it or to guard concurrent recoveries could cascade into duplicate spinner states.

## Upcoming Protocol
- Next mandated protocol: **MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL** (bug investigation). Run COMPREHENSIVE IMPACT ANALYSIS before applying code changes.

## Test Traceability Notes
- Target regression validations across `selectionSensei.ts`, `mermaidManager.ts`, `mermaidErrorRecovery.ts`, and `mermaid-theme-integration.js`. Ensure tests cover recovery success/failure flows and annotation placement in both modal and transcript contexts.

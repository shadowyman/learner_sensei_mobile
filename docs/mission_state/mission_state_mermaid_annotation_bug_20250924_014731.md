# Mission State Checkpoint 2025-09-24 01:47:31

## Analysis Scope & Entry Points
- Entry point: `processMermaidBlocks(messageId)` in `ui.ts` when post-processing Sensei messages containing ```mermaid``` fences.
- Supporting components: `renderMermaidThumbnailWithTheme` (`mermaid-theme-integration.js`), `mermaidManager.render`, and markdown sanitation via `sanitizeCodeFences`.

## Static Execution Trace
1. `processMermaidBlocks` locates `<pre><code class="language-mermaid">` nodes after message render.
2. For each block, `mermaidManager.render` produces SVG/throws errors; fallback recovery path invoked if needed.
3. On success, `renderMermaidThumbnailWithTheme` replaces `<pre>` with themed thumbnail, wraps it in `.mermaid-figure`, and attempts to relocate caption annotations.

## Dependency & Side-Effect Summary
| Function | Key Dependencies | Side Effects |
| --- | --- | --- |
| `processMermaidBlocks` (`ui.ts`) | DOM APIs, `mermaidManager`, `renderMermaidThumbnailWithTheme`, `runMermaidRecovery`, `logger` | Replaces markdown code fences with rendered thumbnails, logs diagnostics, may adjust surrounding DOM. |
| `renderMermaidThumbnailWithTheme` (`mermaid-theme-integration.js`) | `DOMParser`, `logger`, `updateMermaidThemeClass`, `window.mermaidManager` | Replaces `<pre>` with `.mermaid-figure` wrapper, moves captions, cleans stray backticks, binds lightbox click handler. |
| `sanitizeCodeFences` (`ui.ts`) | Regex replace | Normalizes incoming markdown fences to avoid indentation artifacts (pre-render). |

## Key Architectural Insights
- Caption realignment depends on `renderMermaidThumbnailWithTheme` scanning immediate siblings of the inserted `.mermaid-figure` and detecting `<p><em>...</em></p>` patterns; other node types are skipped.
- Stray backticks are stripped by scanning sibling text nodes, but annotations rendered as `<pre><code>` bypass the current detection logic and remain unstyled.
- Selection Sensei shares the same mermaid rendering pipeline, so fixes must accommodate both modal and chat contexts.

## Next Protocol
- Proceed with **MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL**.

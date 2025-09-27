# Mission State: Mermaid Enhancement Decouple (2025-09-26T06:53:48Z)

## Entry Point & Scope
- Primary trigger: `toggleEnhancement` in `enhancementManager.ts` when user clicks the Enhance button on a Sensei message.
- In-scope modules: `enhancementManager.ts`, `ui.ts` (specifically `renderEnhancedMarkdown`, `processMermaidBlocks`), and `mermaidErrorRecovery.ts` via `runMermaidRecovery`.
- Supporting utilities: `streamingMessagesRawText`, `mermaidManager.render`, `replaceMermaidFenceInRaw`, `runMermaidRecovery`.

## Static Execution Trace
1. `toggleEnhancement` → prepares sanitized markdown and orchestrates enhancement request.
2. `applyEnhancements` → invokes injected `renderMarkdown` (currently `renderEnhancedMarkdown`).
3. `renderEnhancedMarkdown` → rebuilds `.message-text`, runs syntax highlighting, and awaits `processMermaidBlocks`.
4. `processMermaidBlocks` → renders each Mermaid fence; on failure calls `runMermaidRecovery`.
5. `runMermaidRecovery` → loops through render/fix attempts before resolving.

## Dependency & Side-Effect Analysis
| Function | Dependencies | Side Effects |
| --- | --- | --- |
| `toggleEnhancement` | `stripMermaidBlocks`, `requestSenseiEnhancement`, `applyEnhancements`, injected deps (`renderMarkdown`, `setLoadingState`, `setActiveState`) | Mutates enhancement state map, toggles loading/active UI flags, requests Gemini API |
| `applyEnhancements` | `applyEnhancementSequence`, injected `renderMarkdown` | Updates enhancement state, writes to DOM via renderer, logs status |
| `renderEnhancedMarkdown` | DOM (`document.getElementById`), `marked`, `hljs`, `processMermaidBlocks`, helpers (`renderIcons`, highlight applicators) | Overwrites message HTML, populates highlights, triggers Mermaid processing |
| `processMermaidBlocks` | DOM queries, `mermaidManager.render`, `runMermaidRecovery`, `replaceMermaidFenceInRaw`, `logger` | Replaces code fences with SVG/spinner/error blocks, may kick off long recovery loop, logs failures |
| `runMermaidRecovery` | `applyBacktickFix`, `applyUniversalQuoteFix`, `attemptMermaidFix`, provided `renderAttempt` | Calls Gemini for fixes, retries Mermaid rendering, logs each attempt |

## Key Architectural Insights
- Enhancement rendering flow relies on dependency injection, allowing `enhancementManager` to stay UI-agnostic but still await DOM work.
- `renderEnhancedMarkdown` always awaits full Mermaid processing, coupling enhancement completion time to diagram recovery attempts.
- Mermaid recovery logic is centralized in `processMermaidBlocks`, and it assumes recovery is always desired; no flag currently gates that behavior for specific callers.

## Next Protocol
- Proceed to **MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL** with focus on decoupling enhancement renders from Mermaid recovery.

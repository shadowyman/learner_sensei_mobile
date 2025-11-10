# Mission State: sensei_translucency_bug (2025-10-08 16:05:25)

**Scope & Entry Points**
- `src/index.tsx`: `handleUserInput`, `generateNextSenseiResponse`, `handleReloadSenseiMessage`, `updateResponseHistory` orchestrate Sensei turns, stream setup, and reload flows.
- `src/interactionHelpers.ts`: `streamMainSenseiResponse` drives chunked LLM streaming into the active bubble.
- `src/ui.ts`: `displayMessage`, `updateMessageStream`, `processMermaidBlocks`, `setThemeVariables`, `applyTheme`, `renderIcons`, theme palette interactions, enhancement hooks.
- `src/index.css`: `.message-bubble` base rule (backdrop-filter, frosted glass), sender-specific overrides, CSS custom properties for Sensei palette.
- Supporting callers: `src/moduleSelectionHandler.ts` and `src/saveloadProgressManager.ts` reuse `displayMessage` for module intro and persistence restores; `src/enhancementManager.ts::resetEnhancementState` clears per-bubble enhancement state.
- Hot modules (manual due to analyzer gap): `src/ui.ts`, `src/index.css`, `src/index.tsx`, `src/interactionHelpers.ts`.

**Static Execution Trace**
1. `index.tsx::handleUserInput` (or reload/module handlers) validates state, bumps `currentMessageId`, and calls `displayMessage` with `isLoading: true` for the Sensei bubble placeholder.
2. `ui.ts::displayMessage` creates or reuses the `.message-bubble`, sets `dataset` flags, injects skeleton content, timers, and animation state, then appends it to `#message-area`.
3. `interactionHelpers.ts::streamMainSenseiResponse` requests `chat.sendMessageStream`, logging prompt metadata and yielding chunks.
4. Each chunk invokes `ui.ts::updateMessageStream`, which rebuilds `.message-text` via `marked`, sanitizes fences, re-highlights code, and toggles `data-typing`.
5. On stream completion, `index.tsx::generateNextSenseiResponse` (or `handleReloadSenseiMessage`) re-calls `displayMessage` with the final markdown, enabling reload/enhance controls.
6. `ui.ts::processMermaidBlocks` performs the second-phase render, replacing mermaid code fences with SVG thumbnails or recovery fallbacks.
7. Theme state (`ui.ts::setThemeVariables` / `applyTheme`) continuously supplies `--sensei-bubble-background`, while `.message-bubble` CSS applies `backdrop-filter: blur(20px)` to every rendered bubble.

**Dependency & Side-Effect Analysis (DSE)**
| Function | Dependencies | Side Effects | Risk (Cost/Blast/Concurrency) |
| --- | --- | --- | --- |
| `index.tsx::handleUserInput` | DOM refs (`userInputElement`, buttons), `generateNextSenseiResponse`, curriculum state helpers, `logger`, `showLoading` | Mutates `userInputHistory`, dispatches Sensei turn, toggles loading UI, may advance curriculum immediately | Medium / High / Medium |
| `index.tsx::generateNextSenseiResponse` | `displayMessage`, `streamMainSenseiResponse`, `advanceCurriculumState`, `updateResponseHistory`, `processMermaidBlocks`, `logger`, `ai` client | Increments `currentMessageId`, drives network streaming, rewrites DOM twice per turn, mutates curriculum + history state | High / High / Medium |
| `index.tsx::handleReloadSenseiMessage` | `displayMessage`, `streamMainSenseiResponse`, `streamModuleIntroduction`, `processMermaidBlocks`, `logger`, `streamingMessagesRawText` | Reuses bubble DOM, clears caches, triggers another network stream, replays mermaid phase | Medium / High / Medium |
| `interactionHelpers.ts::streamMainSenseiResponse` | `chat.sendMessageStream`, `updateMessageStream`, logging utilities, `streamingMessagesRawText` map | Long-lived network stream, repeated DOM rewrites, latency metrics capture | High / High / Medium |
| `ui.ts::displayMessage` | `messageArea`, `defaultMessageRegistry`, `marked`, `sanitizeCodeFences`, `renderIcons`, enhancement manager, curriculum helpers, `window.anime`, scroll target | Builds/modifies DOM nodes, sets timers/intervals, scrolls container, sets inline styles for animation fallback, registers event handlers | High / High / Medium |
| `ui.ts::updateMessageStream` | DOM queries, `marked`, `sanitizeCodeFences`, `hljs`, copy-button helpers, bold interaction hooks | Replaces `.innerHTML` on every chunk, re-runs syntax highlight, toggles attributes, attaches DOM listeners repeatedly | High / High / Medium |
| `ui.ts::processMermaidBlocks` | DOM, `mermaidManager`, `runMermaidRecovery`, `replaceMermaidFenceInRaw`, `logger`, `DEBUG_FLAGS` | Asynchronously swaps code blocks with SVG or error DOM, may invoke recovery AI, registers observers | High / High / Medium |
| `ui.ts::setThemeVariables` / `applyTheme` | `document.documentElement.style`, theme palette state, `localStorage` | Mutates CSS custom properties for bubbles, writes preferred theme, preview hover constantly rewrites vars | Medium / Medium / Low |
| Style: `index.css::.message-bubble` | CSS custom properties (`--sensei-bubble-background`, `--glass-bg`), shared class selectors | Applies `backdrop-filter: blur(20px)` and translucent backgrounds per bubble; combines with `animation: slideUp` and hover transforms | High / High / Low |

**Risk Register**
- `index.css::.message-bubble` — stacking dozens of `backdrop-filter: blur(20px)` layers appears correlated with Safari dropping translucency (high GPU cost, browser-specific limits).
- `ui.ts::updateMessageStream` — chunk-by-chunk `.innerHTML` replacement plus highlight reflow causes Chrome flicker under heavy load; risk escalates with long Sensei turns.
- `ui.ts::displayMessage` — retains per-bubble timers and falls back to inline opacity when anime.js fails; accumulating intervals or forced inline styles may compound rendering stress if not cleaned.

**Coverage Checklist**
- `index.tsx::generateNextSenseiResponse`
- `index.tsx::handleReloadSenseiMessage`
- `interactionHelpers.ts::streamMainSenseiResponse`
- `ui.ts::displayMessage`
- `ui.ts::updateMessageStream`
- `ui.ts::processMermaidBlocks`
- `ui.ts::setThemeVariables` / `applyTheme`
- `index.css::.message-bubble` style application

**Unknowns Register**
| Unknown | Impact | Verification Plan | Owner / Target |
| --- | --- | --- | --- |
| Does Safari’s loss of translucency stem from exceeding per-layer `backdrop-filter` limits versus JS-side state? | High | Profile Safari rendering with 12+, 16+ bubbles while toggling `.message-bubble` `backdrop-filter` off; capture computed styles via script; confirm by A/B disabling filter by 2025-10-09. | UI team (assistant) |
| What driver causes Chrome flicker despite preserved translucency (GPU saturation vs stream DOM churn)? | Medium | Record Chrome performance trace during long Sensei sessions, compare against build with filter/animation disabled; schedule by 2025-10-10. | UI performance maintainer |
| Analyzer artifacts omit `src/**`; is the analysis tooling misconfigured, risking future protocol compliance? | Medium | Inspect `scripts/analyze.ts` include filters / tsconfig resolution and repair before next major workflow; target 2025-10-11. | Tooling owner |

**Assumptions & Notes**
- Issue reproduced without theme switching; theme palette hover previews are assumed inactive during long chats.
- Current analyzer output lacked application modules; findings derived from manual source review and existing mission archives.
- Fallback animation path (`bubble.style.opacity = '1'`) is assumed to execute when anime.js is unavailable; confirm when reproducing Safari glitch.

**Key Architectural Insights**
- Sensei theming centralizes bubble colors via CSS variables; `setThemeVariables` mutates the root, so every bubble re-evaluates translucency without per-node overrides.
- Message rendering is intentionally two-phased: initial DOM assembly in `displayMessage`, followed by `processMermaidBlocks` once content stabilizes, meaning heavy DOM churn can stack per bubble.
- The frosted-glass look relies on per-bubble `backdrop-filter`; unlike shared container glass panels, this multiplies the GPU workload by bubble count.

**Triggering Protocol Next**
- None — user explicitly limited this mission to Core Analysis findings only; hold for further instructions.

**Core Analysis Declaration**
- Core analysis complete. Execution trace, dependencies, and side effects are mapped; ready to proceed once further direction is provided (no additional protocol requested yet).

**Test Traceability**
- Any targeted test or reproduction harness will need to import `src/ui.ts` (for `displayMessage` and theme application) and `src/index.tsx` orchestration; DOM-focused tests should exercise `.message-bubble` styling under high bubble counts.

# Manual Analyzer Audit: `src/mermaid-theme-integration.js`

Timestamp: 2025-12-13T14:12:20Z

This document manually audits the repository analyzer (`scripts/analyze.ts`) against the repository’s longest JavaScript source file and verifies that every in-repo call/callback edge that the analyzer is designed to capture is represented in `tmp/analysis/calls.json`.

## File Selection (Longest JS Source)

Measured by file size across primary source roots (`src/`, `bff/src/`, `scripts/`, `server/`, `SenseiMobile/`) excluding `node_modules`, `dist`, `tmp`, `backup`, etc.

Result: `src/mermaid-theme-integration.js` (~20 KB, 435 LOC).

## Analyzer Run Used For Audit

Command:

`npm run analysis:run -- --include src/mermaid-theme-integration.js`

Expected behavior (scope of this audit):

- Record call edges between in-repo functions when resolvable.
- Record edges to imported in-repo APIs (e.g., `logger.*`).
- Record callback edges:
  - inline callback arguments as `cb:inline`
  - identifier callback arguments as `arg:<name>` when the identifier resolves to an in-repo function/arrow/function-expression (including nested declarations via typechecker)
- Do not attempt to represent external/library/DOM method calls as call edges (unless they map to explicit pseudo-globals like `console.*`, `fetch`, `setTimeout`, etc.).

## Function-by-Function Audit

Notation:

- **Source call/callback**: an in-repo function/method call or function-value passed as an argument.
- **Analyzer edge**: an entry in `tmp/analysis/calls.json` with `fromStable` beginning with `src/mermaid-theme-integration.js::...`.

### `logMermaidValidation` (startLine 4)

Source:

- Calls `logger.info(...)` (line 5).

Analyzer:

- Edge `logger.info` → `src/logger.ts::Logger.info` ✔

### `renderMermaidThumbnailWithTheme` (startLine 26)

Source:

- Calls `logger.error(...)` (line 77).
- Calls `getNextElementSkippingArtifacts(...)` (lines 137, 174, 223).
- Calls `logMermaidValidation('caption-aligned', ...)` (line 219).
- Passes inline callbacks:
  - `.map((segment) => segment.trim())` (line 212)
  - `.filter((segment) => segment.length > 0)` (line 212)
  - `thumbnail.addEventListener('click', async (event) => { ... })` (line 228)

Analyzer:

- Edge `logger.error` → `src/logger.ts::Logger.error` ✔
- 3x edge `getNextElementSkippingArtifacts` → `src/mermaid-theme-integration.js::getNextElementSkippingArtifacts` ✔
- Edge `logMermaidValidation` → `src/mermaid-theme-integration.js::logMermaidValidation` ✔
- 2x edge `cb:inline` → `renderMermaidThumbnailWithTheme__anon1` / `renderMermaidThumbnailWithTheme__anon2` ✔
- Edge `cb:inline` → `renderMermaidThumbnailWithTheme__anon3` ✔

### `getNextElementSkippingArtifacts` (startLine 95)

Source:

- Calls `logMermaidValidation('stray-backticks-removed', ...)` (lines 107, 121).

Analyzer:

- 2x edge `logMermaidValidation` → `src/mermaid-theme-integration.js::logMermaidValidation` ✔

### `renderMermaidThumbnailWithTheme__anon1` (startLine 212)

Source:

- Calls `segment.trim()` (property-access call; external to in-repo symbol graph).

Analyzer:

- No in-repo edges expected ✔

### `renderMermaidThumbnailWithTheme__anon2` (startLine 212)

Source:

- No in-repo calls.

Analyzer:

- No in-repo edges expected ✔

### `renderMermaidThumbnailWithTheme__anon3` (startLine 228)

This is the async lightbox click handler.

Source (in-repo relevant calls/callbacks):

- Calls `logMermaidValidation('theme-rerender', ...)` (line 270).
- Calls `attachDiagram(...)` (lines 280, 287, 298, 308).
- Calls `logger.warn(...)` (line 283).
- Calls `logger.error(...)` (line 294).
- Passes inline callback:
  - `diagram.addEventListener('click', (diagramEvent) => { ... })` (line 352).
- Passes identifier callbacks:
  - `content.addEventListener('pointermove', handlePointerMove)` (line 422)
  - `window.addEventListener('pointerdown', pointerDownHandler, true)` (line 423)
  - `document.addEventListener('keydown', handleKeydown, true)` (line 424)
  - `closeButton.addEventListener('click', closeButtonHandler)` (line 425)
  - `content.addEventListener('click', contentClickHandler)` (line 426)
  - `lightbox.addEventListener('click', lightboxClickHandler)` (line 427)

Analyzer:

- Edge `logMermaidValidation` → `src/mermaid-theme-integration.js::logMermaidValidation` ✔
- 4x edge `attachDiagram` → `src/mermaid-theme-integration.js::attachDiagram` ✔
- Edge `logger.warn` → `src/logger.ts::Logger.warn` ✔
- Edge `logger.error` → `src/logger.ts::Logger.error` ✔
- Edge `cb:inline` → `renderMermaidThumbnailWithTheme__anon3__anon4` ✔
- Edges `arg:handlePointerMove`, `arg:pointerDownHandler`, `arg:handleKeydown`, `arg:closeButtonHandler`, `arg:contentClickHandler`, `arg:lightboxClickHandler` ✔

### `attachDiagram` (startLine 256)

Source:

- Only DOM method calls (`removeAttribute`, `appendChild`, etc.).

Analyzer:

- No in-repo edges expected ✔

### `renderMermaidThumbnailWithTheme__anon3__anon4` (startLine 352)

This is the diagram click handler (zoom toggle).

Source:

- Calls `setZoomState(nextZoom, diagramEvent)` (line 355).

Analyzer:

- Edge `setZoomState` → `src/mermaid-theme-integration.js::setZoomState` ✔

### `handlePointerMove` (startLine 417)

Source:

- Calls `updateZoomTransform(moveEvent)` (line 419).

Analyzer:

- Edge `updateZoomTransform` → `src/mermaid-theme-integration.js::updateZoomTransform` ✔

### `pointerDownHandler` (startLine 360)

Source:

- Only DOM/event methods (`stopPropagation`, `stopImmediatePropagation`, etc.).

Analyzer:

- No in-repo edges expected ✔

### `handleKeydown` (startLine 391)

Source:

- Calls `removeLightbox('escape')` (line 397).

Analyzer:

- Edge `removeLightbox` → `src/mermaid-theme-integration.js::removeLightbox` ✔

### `closeButtonHandler` (startLine 400)

Source:

- Calls `removeLightbox('button')` (line 403).

Analyzer:

- Edge `removeLightbox` → `src/mermaid-theme-integration.js::removeLightbox` ✔

### `contentClickHandler` (startLine 405)

Source:

- Calls `removeLightbox('backdrop')` (line 408).

Analyzer:

- Edge `removeLightbox` → `src/mermaid-theme-integration.js::removeLightbox` ✔

### `lightboxClickHandler` (startLine 411)

Source:

- Calls `removeLightbox('backdrop')` (line 414).

Analyzer:

- Edge `removeLightbox` → `src/mermaid-theme-integration.js::removeLightbox` ✔

### `setZoomState` (startLine 340)

Source:

- Calls `updateZoomTransform(sourceEvent)` (line 344).
- Calls `updateZoomTransform()` (line 348).

Analyzer:

- 2x edge `updateZoomTransform` → `src/mermaid-theme-integration.js::updateZoomTransform` ✔

### `updateZoomTransform` (startLine 317)

Source:

- Calls `clamp(xRatio)` and `clamp(yRatio)` (lines 334–335).

Analyzer:

- 2x edge `clamp` → `src/mermaid-theme-integration.js::clamp` ✔

### `clamp` (startLine 316)

Source:

- Only `Math.min/Math.max` (external built-in).

Analyzer:

- No in-repo edges expected ✔

### `removeLightbox` (startLine 374)

Source:

- Passes identifier callbacks to event unregistration:
  - `document.removeEventListener('keydown', handleKeydown, true)` (line 379)
  - `window.removeEventListener('pointerdown', pointerDownHandler, true)` (line 380)
  - `closeButton.removeEventListener('click', closeButtonHandler)` (line 381)
  - `content.removeEventListener('click', contentClickHandler)` (line 382)
  - `lightbox.removeEventListener('click', lightboxClickHandler)` (line 383)

Analyzer:

- Edges `arg:handleKeydown`, `arg:pointerDownHandler`, `arg:closeButtonHandler`, `arg:contentClickHandler`, `arg:lightboxClickHandler` ✔

## Issues Detected During Audit (and Fix)

### Missing callback-identifier edges for nested functions (fixed)

Before the fix:

- Nested function declarations and nested arrow functions passed as identifier arguments (e.g., `addEventListener('click', handler)`) were not being resolved via the typechecker in the analyzer’s “call-argument” path.
- Result: callbacks like `pointerDownHandler` / `handleKeydown` / `handlePointerMove` were missing from `functions.json` and had no `arg:<name>` edges.

Fix:

- `scripts/analyze.ts` now attempts typechecker-backed resolution for identifier arguments and registers the underlying declarations when they are function-like.
- Added integration coverage in `tests/analyzer.integration.ts` (`testCallbackIdentifierResolutionInScope`) to lock this behavior.

Post-fix verification:

- `npm run functional:analyzer` passes.
- The audited file now includes the nested functions in `functions.json` and has matching callback edges in `calls.json`, as documented above.


# Mission State — Selection Sensei Minimize → Overlay Button

Trigger: Add a minimize control to Selection Sensei’s modal that collapses to a persistent overlay button anchored to the `#message-area` top‑right; clicking the overlay restores the modal to its prior geometry. Overlay is hidden when the modal is closed or not minimized. Overlay acts as an accessible toggle (`aria-controls`, `aria-expanded`) and manages focus appropriately.

## Entry Points & Scope (from analyzer artifacts)
- Primary UI entry: `src/index.tsx:1195` initializes Selection Sensei via `initializeSelectionSensei(ai, messageArea)` when `#message-area` is resolved.
- Core module: `src/selectionSensei.ts` (top fan‑out file; owns modal creation, show/hide, fullscreen, transcript, composer, and toolbar integration).
- Modal markup & structure: `src/index.html` (`#response-modal`, header, title, fullscreen/close buttons, transcript, composer).
- Styling: `src/index.css` (`#response-modal` fixed layout, z‑index vars, `.chat-messages` scroll area; z‑index tokens: `--z-index-content-overlay`, `--z-index-toolbar`, `--z-index-modal`, …).
- Shared UI helpers: `src/ui.ts` (exports `messageArea`, textarea autosize, message rendering utilities).

Hot modules (by fan‑in/out)
- Fan‑out: `src/index.tsx`, `src/ui.ts`, `src/selectionSensei.ts`, `src/curriculum.ts`.
- Fan‑in: `src/logger.ts`, `src/ui.ts`.

## Static Execution Trace (Selection Sensei)
Bootstrapping
1. `index.tsx::initializeSelectionSensei(ai, messageArea)`
2. `SelectionSensei.initialize()` → `getDOMElements()` → `attachEventListeners()` → `initializeModalComposer()` → `resetModalState()`

User flow (toolbar → modal)
1. `handleTextSelection`/toolbar → `handleToolbarAction(...)`
2. `resetModalState()`; `showResponseModalWithLoading()` (clears content, sets spinner, shows modal)
3. `ensureSelectionChat()`; chat `sendMessage(...)`
4. `updateResponseModalContentAndTitle(title, html)` (renders, enhances code blocks, shows composer)
5. Dismissal paths: `hideResponseModal()` (close button, outside click), or `toggleModalFullscreen()` → `setModalFullscreen(...)`

Planned minimize flow (to be added)
- New state `isModalMinimized` and overlay element anchored to `#message-area`.
- `minimizeModal()` stores geometry (like `modalFullscreenRestore`), hides modal, shows overlay, moves focus, updates `aria-expanded=false` on overlay.
- `restoreFromOverlay()` restores prior geometry, shows modal, hides overlay, focuses modal header, updates `aria-expanded=true`.

## Dependency & Side‑Effect (DSE) Summary
- `SelectionSensei.getDOMElements` — DOM lookups for IDs; logs warning if missing. Side effects: DOM reads.
- `SelectionSensei.attachEventListeners` — Adds listeners to modal controls and message area. Side effects: DOM/event wiring.
- `SelectionSensei.setModalFullscreen` — Writes dataset/style; stores/restore rect; toggles aria on button. High DOM churn; state writes.
- `SelectionSensei.showResponseModalWithLoading` — Clears content, sets spinner, positions and shows modal. High DOM churn.
- `SelectionSensei.updateResponseModalContentAndTitle` — Sanitizes/marks up content, appends nodes, code‑highlight. High DOM churn.
- `SelectionSensei.hideResponseModal` — Resets state; hides modal; clears title/content. DOM + state writes.

Risk Register (initial)
- R1 Z‑index overlap: Overlay button must sit above bubbles but below modal/fullscreen overlays. Mitigation: use `--z-index-toolbar` or introduce `--z-index-overlay` if needed.
- R2 Scroll container semantics: `#message-area` scrolls; overlay must be non‑scrolling relative to that area. Mitigation: wrap anchor with a non‑scrolling layer (absolute in a `position: relative` wrapper) or viewport‑fixed aligned to message area rect.
- R3 Focus management: Ensure focus moves to overlay on minimize, back to modal on restore; trap focus only when modal visible. Mitigation: explicit `focus()` targets and ARIA toggle.
- R4 Event interference: New listeners must not conflict with existing outside‑click dismissal. Mitigation: guard against clicks on overlay.
- R5 Geometry restore: Resizable/draggable modal must restore previous rect precisely. Mitigation: store style props (already modeled by `modalFullscreenRestore`).

Unknowns Register
- U1: Overlay anchoring strategy: absolute within a non‑scrolling wrapper vs. viewport‑fixed aligned to message area rect. Verification: prototype both, choose by collision behavior.
- U2: Mobile layout: top‑right vs. bottom‑right for narrow viewports. Verification: CSS breakpoint toggle; test at 375px width.
- U3: Iconography: minimize glyph style and tooltip copy. Verification: follow existing icon system (`icon-placeholder`/SVG) and UX copy rules.

Coverage Checklist (for Step 10 validation later)
- Toggle minimizes modal, overlay appears; restore re‑shows modal with prior size/position.
- Overlay remains visible while `#message-area` scrolls.
- Overlay hidden when modal closed or not minimized.
- `aria-controls` and `aria-expanded` reflect state; focus moves appropriately.
- Fullscreen toggle remains compatible; ESC closes modal when expanded; outside click does not close when minimized.

## Key Artifacts Consulted
- Analyzer summary/fan‑in/out, calls, functions, imports (`tmp/analysis/*.json|.txt`)
- Modal markup: `src/index.html:226–257`
- Modal styles: `src/index.css:2288–2420` (`#response-modal`), `:root` z‑index tokens
- Selection Sensei module: `src/selectionSensei.ts` (modal show/hide/fullscreen, transcript, composer)

## Next Protocol
Proceed to COMPREHENSIVE IMPACT ANALYSIS PROTOCOL before making code changes.

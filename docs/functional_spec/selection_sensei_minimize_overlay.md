# Functional Specification — Selection Sensei Minimize → Overlay Button

Version: 0.1 (Initial Draft)
Status: Draft — pending user confirmation
Owners: Selection Sensei / UI
Last updated: 2025-11-09

## 1. Summary
Add a “Minimize” capability to the Selection Sensei modal. When minimized, the modal collapses to a persistent overlay button anchored to the top‑right of the chat message area (`#message-area`). The overlay remains visible as the chat content scrolls. Clicking the overlay restores the modal to its prior position and size. The overlay is hidden when the modal is closed or when the modal is not in a minimized state.

## 2. Goals
- Allow users to reclaim screen space without losing quick access to the Selection Sensei response.
- Keep the minimized control consistently reachable while the chat area scrolls.
- Preserve the modal’s geometry on restore (position/size) to maintain user context.
- Provide accessible, keyboard‑operable controls and clear ARIA semantics.

## 3. Non‑Goals
- Changing the modal’s visual design beyond adding a minimize control.
- Persisting minimized state across full page reloads (unless already part of app session persistence).
- Refactoring unrelated chat UI, notepad, or debug overlays.

## 4. User Experience
- New “Minimize” button in the Selection Sensei modal header alongside existing fullscreen and close controls.
- On click:
  - The modal hides; the overlay button appears at the top‑right of `#message-area`.
  - Focus moves to the overlay button; `aria-expanded=false`.
- While minimized:
  - Overlay remains visible (above chat bubbles) as content scrolls.
  - The overlay does not render when the modal is closed.
 - On overlay click:
   - Modal restores to its previous geometry/position; overlay hides.
   - Focus moves to the modal header/title; `aria-expanded=true`.
  - If a response was streaming when minimized, scroll transcript to the last message on restore.

## 5. Accessibility
- Overlay button:
  - `role="button"`, `aria-controls="response-modal"`, `aria-expanded` toggled with state.
  - Keyboard: `Enter`/`Space` to restore; visible focus ring.
  - Accessible name: “Open Selection Sensei” (tooltip/title mirrors label).
- Minimize button in header:
  - `aria-pressed` optional; label: “Minimize”.
  - Keyboard: `Enter`/`Space` to minimize.
- Focus management:
  - On minimize → focus overlay.
  - On restore → focus modal header or title.
  - ESC continues to close the modal only when expanded.

## 6. States & Transitions
- `Expanded` (default): Modal visible; overlay hidden; `aria-expanded=true` on header minimize button context.
- `Minimized`: Modal hidden; overlay visible; overlay `aria-expanded=false`.
- `Closed`: Both modal and overlay hidden; state reset on next open.
- Transition rules:
  - Expanded → Minimized: Hide modal; show overlay; store geometry; exit fullscreen if active.
  - Minimized → Expanded: Hide overlay; restore geometry; show modal.
  - Expanded/Minimized → Closed: Hide both; clear any transient UI (spinners) as today.

## 7. DOM Structure (Additions)
- Modal header (existing id references in `src/index.html`):
  - Add a new button: `#response-modal-minimize-button` (sibling to `#response-modal-fullscreen-button` and `#response-modal-close-button`).
- Message area overlay (mounted inside `#message-area`):
  - Wrapper: `#selection-sensei-overlay` (container for positioning).
  - Button: `#selection-sensei-overlay-button` (the visible control).

Notes:
- The overlay container is inserted once and toggled; guard against duplicate insertion.

## 8. Placement Strategy
Two supported strategies; default is Sticky.

1) Sticky (default — recommended)
- Insert `#selection-sensei-overlay` as the first child of `#message-area` (`.chat-messages`).
- CSS:
  - Wrapper: `position: sticky; top: 8px; display:flex; justify-content:flex-end; pointer-events:none;`
  - Button: `pointer-events:auto; z-index: var(--z-index-toolbar); margin-right: 8px;`
 - Benefit: no JS rect calculations; remains pinned while the chat scrolls.
 - Header safety: the overlay resides within the message area (which is laid out beneath the header), ensuring it renders below the header region.

2) Absolute (alternative)
- Add `position: relative;` to `.chat-messages` and place overlay with `position:absolute; top:8px; right:8px; z-index: var(--z-index-toolbar);`.
- Benefit: overlays the message area box regardless of content flow.
- Trade‑off: potential overlap with message input area on narrow heights; sticky is simpler.

## 9. Styling (Tokens & Rules)
- Z‑index: use `var(--z-index-toolbar)` to keep overlay above message bubbles and below modal (`--z-index-modal`).
- Button visual: rounded square, 32px; 2D emoji icon (default: 🧠) indicating open/restore; tooltip “Open Selection Sensei”.
- Responsive: keep top‑right placement on mobile; reduce offsets to 6px.

## 10. Public API / Events (Internal Module)
- No external API changes.
- Internal logging events (Selection Sensei validation stream):
  - `modal-minimized`, `modal-restored`, `overlay-clicked` with timestamp and current conversation token.

## 11. Error Handling
- If overlay mount fails (container missing), log once and fall back to viewport‑fixed button at window top‑right until `#message-area` appears, then re‑anchor.
- If DOM nodes are reloaded (e.g., save/load/route), reuse `ensureDOMElementsValid()` flow to re‑query and re‑mount overlay if minimized.

## 12. Persistence & Geometry
- On minimize, store modal inline style geometry similar to `modalFullscreenRestore` (top, left, right, bottom, width, height, transform, resize).
- On restore, reapply the stored geometry. If none available, fall back to centered transform used today.

## 13. Security / Privacy
- No additional data collected. Events only include UI state and timestamp.

## 14. Telemetry
- Add validation logs via `logSelectionSenseiValidation` with events enumerated above.

## 15. Compatibility
- Works with existing fullscreen feature. Minimize will first exit fullscreen (if active), then minimize.
- Outside‑click dismissal remains unaffected because the modal is hidden during minimized state.

## 16. Acceptance Criteria
1) Clicking the new header minimize button hides the modal and shows a persistent overlay button at the top‑right of the message area.
2) The overlay remains visible and clickable while the chat content scrolls.
3) Clicking the overlay restores the modal to its prior size and position.
4) When the modal is closed (not minimized), the overlay does not render.
5) `aria-controls="response-modal"` and `aria-expanded` reflect the true state; focus moves to overlay on minimize, and back to modal header on restore.
6) Overlay layering: above bubbles, below modals and global backdrops.
7) Works on mobile widths without occluding primary controls; button remains reachable by keyboard and touch.
8) Overlay renders below the header (visually positioned within the message area, not overlapping the header).
9) If minimized during a pending/streaming response, restoring auto‑scrolls transcript to the last message.

## 17. Test Plan (High‑Level)
- Unit/DOM integration tests (JSDOM):
  - Minimize toggles visibility of modal/overlay; `aria-expanded` updates; focus moves as specified.
  - Restore applies previous geometry; content preserved; composer state maintained.
  - Overlay remains present during simulated scrolls (sticky behavior can be approximated with CSS assertions or by class presence).
- E2E/manual checks:
  - Resize viewport; ensure overlay stays anchored; restore still correct.
  - Interaction with fullscreen: toggling path exits fullscreen then minimizes; restore path consistent.

## 18. Implementation Notes (Non‑binding)
- New private state in `SelectionSensei`:
  - `isModalMinimized: boolean` (default false)
  - `modalMinimizeRestore: { top,left,right,bottom,width,height,transform,resize } | null`
- Methods to add:
  - `minimizeModal()`
  - `restoreFromOverlay()`
  - `ensureOverlayMounted()` (idempotent creator for overlay wrapper + button)
- Event wiring:
  - Header: `#response-modal-minimize-button` → `minimizeModal()`
  - Overlay button: `#selection-sensei-overlay-button` → `restoreFromOverlay()`
- CSS additions:
  - Minimal rules for `#selection-sensei-overlay` and `#selection-sensei-overlay-button` per chosen strategy (Sticky default).
  - Streaming behavior: if a response is in progress when minimizing, maintain transcript state; on restore, scroll the modal transcript to the newest message.

## 19. Impacted Files
- `src/index.html` — add minimize button markup in modal header.
- `src/index.css` — add overlay styles and (if Absolute strategy) `position: relative;` to `.chat-messages`.
- `src/selectionSensei.ts` — state, overlay lifecycle, event handlers, focus & aria updates, logging.

## 20. Risks & Mitigations
- Z‑index conflicts → Use existing tokens (`--z-index-toolbar`, `--z-index-modal`).
- Duplicate overlay mount → Guard with `document.getElementById('selection-sensei-overlay')`.
- DOM remounts after save/load → Re‑query in `ensureDOMElementsValid()`; remount overlay if minimized.
- Mobile collisions → Keep top‑right placement; verify offsets at small widths.

## 21. Open Questions (for user confirmation)
None outstanding at this time.

---
End of specification (v0.1)

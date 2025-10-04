# Feature: Preserve Selection Sensei Modal When Closing Mermaid Lightbox

## Summary
- Added a dedicated close button with ARIA metadata to the fullscreen Mermaid lightbox so users can exit without dismissing Selection Sensei.
- Captured pointer events at the window level, preventing Selection Sensei’s global outside-click handler from misinterpreting overlay interactions.
- Centralized teardown logic to handle close button, backdrop clicks, and Escape key consistently while restoring focus.
- Updated lightbox styles to position the close control within existing theme visuals.

## Rationale
Users reported that when a Mermaid diagram was opened fullscreen from within the Selection Sensei modal, closing the lightbox dismissed the entire modal. The modal attaches a capturing pointer listener on `document`, so any lightbox click bubbled upward as an outside click. Providing an explicit close affordance inside the overlay and suppressing pointer propagation preserves the modal context and matches expected UX.

## Code Changes
- `mermaid-theme-integration.js:234`: Constructed the close button, added dialog semantics, and wired shared teardown helpers for button/backdrop/ESC while capturing pointer events on `window` to stop propagation.
- `index.css:3083`: Positioned the close control, enabling hover/focus styles without affecting existing theme classes.

## Behavioral Impact
- Selection Sensei modal stays open after closing fullscreen Mermaid via close button, backdrop click, or ESC.
- Lightbox maintains keyboard accessibility by focusing the close button on open.
- No regression to other Mermaid render paths; thumbnails still open in fullscreen and support zoom.

## Validation
- Manual walkthrough: launched Selection Sensei modal with Mermaid content, opened fullscreen, exited using button, backdrop, and ESC; verified modal persistence.
- `npx tsc --noEmit`
- RCI review artifact: `code_review/review_mermaid_overlay_close_controls_codex.html`
- Backup: `backup/sensei_backup_mermaid_overlay_close_controls_20251004_105842.zip`

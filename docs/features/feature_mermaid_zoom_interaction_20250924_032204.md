# Mermaid Lightbox Zoom + Pan Enhancements

## Summary
- Allow fullscreen mermaid diagrams to toggle a 1.75× zoom directly from the diagram while moving the graphic with the pointer.
- Close the overlay when clicking outside the diagram, matching the prior user expectation.
- Ensure zoom works for cloned or re-rendered SVGs without relying on intrinsic width/height attributes.

## Rationale
- Users reported that fullscreen diagrams appeared blank and zoom controls felt sluggish; the changes rebuild the lightbox wrapper so SVGs retain visible dimensions and the zoomed view follows the cursor in real time.
- Removing temporary instrumentation keeps production logs clean while retaining a consistent close behavior.

## Key Code Changes
- `mermaid-theme-integration.js:189` — Reworked lightbox construction, added `attachDiagram` helper, pointer-tracked zoom transforms, and delegated zoom toggling to the SVG click target.
- `mermaid-theme-integration.js:304` — Overlay click now dismisses the lightbox when the background (not the diagram) is clicked.
- `mermaid-theme-integration.js:314` — Added pointermove handler for real-time panning while zoomed in.
- `index.css:2629` — Sized `.mermaid-lightbox__content` wrapper, hidden overflow, and introduced `.mermaid-lightbox__diagram` styling for responsive scaling.

## Validation
- `npx tsc --noEmit`
- Manual verification: zoom in/out toggles at 1.75×, pointer pans the diagram as it moves, clicking the backdrop closes the overlay, and rest logs show no lingering `[MERMAID_ZOOM]` entries after cleanup (`logs/console_logs.log`).

## Backup Reference
- `backup/sensei_backup_mermaid_zoom_toggle_20250924_021032.zip`

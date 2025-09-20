# Header Chunk Overlay Access

## Summary
- Clicking the header status segment now opens the Sensei meditation overlay showing all teaching chunks.
- Reuses the existing overlay renderer to avoid duplicating chunk-display logic.

## Rationale
- Aligns the header middle control with the "Chunk </>" label behavior so chunk contents remain one click away from the current focus indicator.

## Key Changes
- `ui.ts:77` caches the status segment element for reuse when wiring overlay triggers.
- `ui.ts:1835` invokes the status click setup during UI initialization so the handler is live once the DOM is ready.
- `ui.ts:1963` adds `setupStatusClickMeditationOverlay` which guards navigation arrow clicks, ensures curriculum data exists, forces all-chunk view, and shows the overlay.

## Behavioral Impact
- Header status clicks from any loaded phase immediately surface the chunk roster overlay without requiring brand hover or the chunk label button.
- Attempts to use the header before curriculum loads silently no-op, matching the prior chunk overlay guardrails.

## Validation Evidence
- Manual interaction: clicked the header status segment with an active teaching plan; overlay appeared displaying six chunks and remained interactive.
- `logs/console_logs.log` confirms the status-triggered overlay entries during validation (timestamp 2025-09-20 04:30:58 through 04:31:41) before debug logs were removed from code.

# Typing Indicator Status Update (2025-09-20 03:23:08)

## Summary
Sensei's live response indicator now displays a readable status message with animated ellipsis, followed by the response timer and spinner while streaming. The debugger view mirrors the same layout so both interfaces stay consistent.

## Rationale
Learners reported the naked timer felt ambiguous; adding explicit copy and motion clarifies that Sensei is still composing a reply. Keeping the UI consistent across main and debug views prevents drift and improves support workflows.

## Key Changes
- `ui.ts:781` – render the status span ahead of the timer and spinner, add animated dot cycling while a Sensei message streams, and ensure the interval is cleaned up when streaming ends.
- `debugMode.ts:401` – apply the same status+dots+timer layout in the debugger chat and reuse the cleanup pattern so animation intervals never leak.
- `index.css:1335` – style the new typing status and dot elements so they align inline without causing layout jitter.

## Behavioral Impact
The chat now shows “Sensei is typing its response…” with animated dots, then the elapsed seconds, then the spinner. Nothing appears once the answer completes, and non-loading messages remain unchanged. Debugging conversations render the same indicator for parity.

## Validation Evidence
- Observed `[SENSEI_TYPING]` lifecycle entries for `msg-6` during validation before log cleanup (mounted at 03:22:07, removed at 03:22:20) confirming the indicator ran through both branches.

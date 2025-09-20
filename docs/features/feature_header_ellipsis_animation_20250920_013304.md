# Header Ellipsis Animation Refresh (2025-09-20)

## Summary
- Replace the font-size toggle icon with animated ellipsis text and a subtle mint halo to hint at interactivity.
- Ensure the ellipsis control keeps a transparent hit area, no hover-triggered button chrome, and stable layout.
- Introduce JavaScript-driven dot cycling with delayed idle and glow phases for clearer affordance.

## Rationale
The previous control relied on a static icon and hover-expanding buttons, which caused layout shifts and visual clutter. Shifting to animated ellipsis provides a clearer affordance, reinforces the hidden menu, and keeps the header visually lightweight.

## Key Changes
- `index.html:56-58` – swap the icon span for `.ellipsis-dots` text inside the toggle button.
- `index.css:432-486` – lock the toggle’s footprint, keep the dormant state fully transparent, define the mint halo, adjust dot spacing, restore the gray background/border when the rail expands, and apply the blue accent via CSS/JS only when the button (or control cluster) is actively hovered.
- `ui.ts:1262-1310` – add `setupHeaderEllipsisAnimation` and wire it into `initializeUI` to drive the delayed loop and glow.

## Behaviour & Validation
- Manual: observe the header; the dots should remain centered, animate `. → .. → ...`, pause 5s, then glow softly for 1s before repeating. On hover/focus, the ellipsis hides and the classic font-size icon appears while the other controls expand.
- No dedicated logs are emitted for this control; behaviour is verified visually.

## Follow-up
- Remove the temporary `[HEADER-ELLIPSIS]` logs after validating the behaviour in `logs/console_logs.log`.

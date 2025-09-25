# Mission State Checkpoint (Recreated)
- Entry Points: `#response-modal-header` mousedown → `SelectionSensei.handleDragStart`; document mousemove → `handleDragMove`; document mouseup → `handleDragEnd`.
- Scope Files: `selectionSensei.ts`, `index.css`, `index.html`, `ui.ts`.
- Static Trace: showResponseModalWithLoading sets centered transform; dragStart now always grounds to left/top; dragMove clamps to viewport.
- Dependencies: DOM getBoundingClientRect, window dimensions; Side effects: inline style left/top updates.
- Next: Stage & commit, generate review, validate.

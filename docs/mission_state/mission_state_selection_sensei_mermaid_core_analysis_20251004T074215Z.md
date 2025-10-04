# Mission State: Selection Sensei Mermaid Overlay Core Analysis (2025-10-04T07:42:15Z)

## Scope & Entry Points
- Scope focuses on Selection Sensei modal rendering pipeline and mermaid fullscreen overlay interactions.
- Entry points: `SelectionSensei.updateResponseModalContentAndTitle`, `SelectionSensei.processMermaidDiagrams`, `mermaid-theme-integration.js::renderMermaidThumbnailWithTheme`, `SelectionSensei.handleOutsidePointerDown`, document-level listener wiring in `SelectionSensei.attachEventListeners`.
- Hot modules (fan-out context): `selectionSensei.ts`, `mermaid-theme-integration.js`, shared UI utilities in `ui.ts`, and styling constraints in `index.css`.

## Static Execution Trace
1. `SelectionSensei.attachEventListeners#13f07654ad8c` registers a capturing `pointerdown` listener on `document` that routes to `handleOutsidePointerDown` for modal dismissal.
2. `SelectionSensei.updateResponseModalContentAndTitle#2ade5dbcf99e` replaces modal content when AI responses arrive and ensures the modal is visible.
3. `SelectionSensei.processMermaidDiagrams#a847a143ed95` scans the modal content for `pre code.language-mermaid` blocks.
4. For each block, the inline handler `SelectionSensei.processMermaidDiagrams__anon9#55570978ef8b` calls `mermaidManager.render` to obtain SVG and forwards to `renderMermaidThumbnailWithTheme`.
5. `mermaid-theme-integration.js::renderMermaidThumbnailWithTheme#513223e3c73a` replaces the `pre` element with a themed thumbnail and installs lightbox event handlers. `renderMermaidThumbnailWithTheme__anon3#954c9fdc9125` creates the fullscreen overlay and binds click/zoom listeners.
6. Clicking the overlay currently removes it and allows the bubbling `pointerdown` to reach `SelectionSensei.handleOutsidePointerDown#039b6abad515`, which interprets the action as an outside click and hides the modal entirely.

## Dependency & Side-Effect Table
| Function (Stable ID) | Key Dependencies | Side Effects | Risk |
| --- | --- | --- | --- |
| `SelectionSensei.updateResponseModalContentAndTitle#2ade5dbcf99e` | `sanitizeCodeFences`, `marked.parse`, `hljs.highlightElement`, DOM refs on the modal | Mutates modal DOM, toggles spinner, re-enables composer | High – broad DOM writes and async flow |
| `SelectionSensei.processMermaidDiagrams#a847a143ed95` | `mermaidManager.render`, `runMermaidRecovery`, `renderMermaidThumbnailWithTheme`, `crypto.randomUUID` | Replaces code blocks, spawns async recovery attempts | High – async operations with UI fallbacks |
| `mermaid-theme-integration.js::renderMermaidThumbnailWithTheme#513223e3c73a` | `window.mermaidManager`, `window.updateMermaidThemeClass`, `logger` | Generates lightbox overlay, binds click/zoom listeners, manipulates `document.body` children | High – global overlay + event wiring |
| `SelectionSensei.handleOutsidePointerDown#039b6abad515` | Document-level pointer events, modal state helpers | Hides the modal if click occurs outside `responseModal` tree | High – captures all outside clicks |

## Risk Register
- Overlay dismissal from `renderMermaidThumbnailWithTheme` currently bubbles to `handleOutsidePointerDown`, collapsing the Selection Sensei modal (High impact, UI regression potential). Mitigation: intercept close interactions so modal state remains untouched.
- Document-level `pointerdown` capture in `SelectionSensei.handleOutsidePointerDown` can consume unrelated overlay interactions (High impact). Mitigation: add explicit allowlist for mermaid lightbox targets.
- Async Mermaid recovery path modifies DOM after failures (Medium impact). Mitigation: ensure UI fallbacks remain intact after overlay changes.

## Coverage Checklist
- `selectionSensei.ts::SelectionSensei.updateResponseModalContentAndTitle@31520`
- `selectionSensei.ts::SelectionSensei.processMermaidDiagrams@41342`
- `selectionSensei.ts::SelectionSensei.processMermaidDiagrams__anon9@41628`
- `mermaid-theme-integration.js::renderMermaidThumbnailWithTheme@193`
- `mermaid-theme-integration.js::renderMermaidThumbnailWithTheme__anon3@10891`
- `selectionSensei.ts::SelectionSensei.handleOutsidePointerDown@55225`
- `selectionSensei.ts::SelectionSensei.attachEventListeners@10172`

## Assumptions & Unknowns
- Unknown: After adjusting event handling, Selection Sensei should no longer close when the mermaid overlay consumes the click. Impact High. Verification plan: manual test in browser or interaction harness clicking overlay close without dismissing modal (owner: self, timeline: before feature protocol completion).
- Unknown: Styling for the new close control must integrate with existing `mermaid-lightbox` theme classes. Impact Medium. Verification plan: verify rendered button in lightbox across base theme, adjust CSS tokens as needed (owner: self, timeline: during implementation QA).
- Assumption: No other subsystems rely on overlay clicks bubbling to `document` for critical behavior. Impact Medium. Verification plan: audit `document` listeners in analyzer artifacts (`fan_in` on `document.addEventListener`) and perform smoke test on other modals if available (owner: self, timeline: before final QA).

## Key Architectural Insights
- Selection Sensei’s modal lifecycle depends on a single document-level pointer capture; any fullscreen UI injected outside the modal must either stop propagation or be explicitly whitelisted.
- The mermaid lightbox manipulates `document.body` directly, so enhancements should remain self-contained and avoid leaking listeners after removal.
- CSS layering relies on `--z-index-lightbox`; new controls must respect existing stacking context to remain accessible above the overlay.

## Triggering Protocol
- Next required protocol: **COMPREHENSIVE IMPACT ANALYSIS PROTOCOL** (prior to code modifications).

## Test Traceability Notes
- Planned validation should exercise Selection Sensei modal updates (`selectionSensei.ts`) and the mermaid lightbox overlay (`mermaid-theme-integration.js`). Manual regression steps must ensure overlay close button and click-outside behavior leave the modal open.

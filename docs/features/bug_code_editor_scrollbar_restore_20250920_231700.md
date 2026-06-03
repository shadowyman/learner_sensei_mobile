# Code Editor Modal Scrollbar Restoration (2025-09-20)

See **Bug Fix #6** in `docs/PREVIOUS_BUG_FIXES.md` for the full root-cause narrative.

## Summary
- Delay CodeMirror setup until the modal is visible so the editor measures a real height (`src/codeEditorModal.ts:411-420`).
- Reserve vertical space for the editor by keeping `#code-editor-root`, `.cm-editor`, and `.cm-scroller` on a flex/min-height chain (`src/index.css:2222-2240`).

## Behavioral Impact
- Long code snippets now scroll smoothly via wheel, drag, and keyboard navigation.
- Fullscreen, insert, and clear actions respect the new layout without resizing the chat input.

## Validation
- Current static verification confirms the `requestAnimationFrame`-gated editor setup in `src/codeEditorModal.ts:411-420` and the flex-based scroll container sizing in `src/index.css:2222-2240`.
- The historical runtime log sample cited in the original note is not present in the current `logs/console_logs.log`, so that portion cannot be re-proven from retained artifacts.

# Code Editor Modal Scrollbar Restoration (2025-09-20)

See **Bug #4** in `PREVIOUS_BUG_FIXES.md` for the full root-cause narrative.

## Summary
- Delay CodeMirror setup until the modal is visible so the editor measures a real height (`codeEditorModal.ts:352`).
- Reserve vertical space for the editor by clamping the modal body height and allowing the CodeMirror layers to flex (`index.css:1735`, `index.css:1755`).

## Behavioral Impact
- Long code snippets now scroll smoothly via wheel, drag, and keyboard navigation.
- Fullscreen, insert, and clear actions respect the new layout without resizing the chat input.

## Validation
- Verified through runtime logs showing the editor height (`~286px`) and scroller `scrollHeight` > `clientHeight`, confirming overflow is active before trimming debug instrumentation.

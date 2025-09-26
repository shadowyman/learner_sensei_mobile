# Selection Modal Outside-Click Dismissal

- Added a document-level pointer listener scoped to Selection Sensei so response modal closes when the learner clicks outside the popup.
- Preserved existing modal drag behavior by guarding against pointer events fired while `isDragging` is true.
- Reused the established `hideResponseModal` lifecycle to avoid duplicating cleanup logic or introducing overlay markup.

## Key Changes
- `selectionSensei.ts:60` introduces a bound pointer handler field so initialization and teardown remove the exact same callback.
- `selectionSensei.ts:73` binds `handleOutsidePointerDown` in the constructor to preserve context.
- `selectionSensei.ts:88` unregisters the pointer listener during cleanup to prevent leaks when reinitializing Selection Sensei.
- `selectionSensei.ts:870` implements the outside-click guard logic (drag check, hidden check, interior hit test) before delegating to `hideResponseModal`.

## Behavioral Impact
- Learners can close the Selection Sensei explanation modal by clicking anywhere outside it, aligning the UX with common modal expectations.
- Clicking inside the modal or dragging it no longer collapses the popup prematurely thanks to the drag and hit-test guards.
- No change to selection toolbar behavior, notepad integration, or Gemini interaction flows.

## Validation
- Manual QA covered: open modal → inside click (stays open), drag modal (stays open), outside click (closes). The original validation logs captured before cleanup showed both ignored interior clicks and successful outside dismissals (e.g., `logs/console_logs.log` entries at `2025-09-26T03:34:42Z` and `2025-09-26T03:41:37Z`).
- `npx tsc --noEmit` (run from the feature worktree with shared `node_modules`) reports no type errors.

## Artifacts
- Backup: `backup/sensei_backup_selection_modal_outside_close_20250926_032355.zip`
- Review: `code_review/review_selection_modal_outside_close_v2.html`

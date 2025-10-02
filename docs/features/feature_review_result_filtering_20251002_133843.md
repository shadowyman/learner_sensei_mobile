# Feature: Review Result Filtering Enhancements

## Summary
- Filter `review:result` output to show failing and neutral hunks first while preserving verdict visibility.
- Added resilient verdict extraction that handles empty or complex markup without breaking formatting.
- Expanded the functional suite with edge-case coverage and structural assertions to enforce the new behavior.

## Rationale
- Reviewers requested quieter output that highlights actionable feedback before PASS items.
- Prior verdict formatting caused Codex to focus on summaries; this change explicitly guides attention to failures.
- Earlier versions lacked thorough negative tests, risking regressions in token parsing and formatting.

## Key Changes
- Updated `cmdResult` classification, ordering, and verdict serialization logic (`scripts/reviewEdit.ts:186`, `scripts/reviewEdit.ts:340`).
- Introduced verdict extraction helper to normalize structured HTML content (`scripts/reviewEdit.ts:216`).
- Added shared assertion utilities and comprehensive scenarios to the functional CLI tests (`tests/reviewEdit.functional.test.ts:120`, `tests/reviewEdit.functional.test.ts:330`).

## Validation Evidence
- `npx ts-node --transpile-only tests/reviewEdit.functional.test.ts`
- `npx ts-node --transpile-only scripts/reviewEdit.ts result --file code_review/review_notepad_custom_concepts.html`
- `npx ts-node --transpile-only scripts/reviewEdit.ts result --file code_review/review_notepad_custom_concepts_v3.html`
- RCI review artifact: PASS (`code_review/review_review_result_filtering_v6.html`)

## Artifacts
- Backup: `backup/sensei_backup_review_result_filtering_20251002_042007.zip`
- Review Artifact: `code_review/review_review_result_filtering_v6.html`

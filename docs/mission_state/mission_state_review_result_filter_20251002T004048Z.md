# Mission State: Review Result Filtering Enhancement

**Timestamp:** 2025-10-02 00:41:05Z
**Trigger:** Enhance `review:result` output to show failing hunks first and surface verdict appropriately.

## Analysis Scope & Entry Points
- Primary module: `scripts/reviewEdit.ts`
- Focus function: `cmdResult` (invoked by `npm run review:result`)
- Supporting helpers in scope: `resolveArtifactPath`, `getRepoRoot`, `findAllArticlesWithUuid`, `cleanReviewNoteText`, `resolveArticleFilePath`, `findChildBySelector`, `textContent`, `hasClass`, `attr`, `isPlaceholderNote`.
- External dependencies: Node `fs`, `path`, `child_process`, and `parse5` DOM parser.
- Hot modules from analyzer snapshot (for regression awareness): `logger.ts`, `adaptiveEngine.ts`, `curriculum.ts`, `model_usage.ts`, `prompts.ts`.

## Static Execution Trace
1. CLI dispatch enters `cmdResult` with `--file` argument.
2. `resolveArtifactPath` normalizes artifact path, calling `getRepoRoot` which shells out to `git rev-parse` when needed.
3. Artifact HTML read via `readFileSync`; parsed with `parse5.parse`.
4. `findAllArticlesWithUuid` walks DOM to list `article.hunk` nodes and their UUIDs (uses `hasClass`, `attr`).
5. For each article:
   - Locate `.review-notes` block, compute label from header (`findChildBySelector`, `textContent`), compute source file via `resolveArticleFilePath` (uses `findNodeByTagAndId`).
   - `cleanReviewNoteText` strips headings and whitespace (leverages `escapeRegExp`, `textContent`).
   - `isPlaceholderNote` filters placeholder content.
   - Diff payload retrieved from `<pre><code>` with `textContent`.
6. Aggregated strings joined with separator and streamed via `stdout`; on empty results, `stderr` + `process.exit(1)`.

## Dependency & Side-Effect Table
| Function | Key Dependencies | Side Effects | Risk Notes |
| --- | --- | --- | --- |
| `cmdResult` | `resolveArtifactPath`, `readFileSync`, `parse5.parse`, helpers listed above | File read; stdout/stderr writes; `process.exit` termination | Medium: exits process on missing notes; ensure new filtering preserves exit semantics |
| `resolveArtifactPath` | `getRepoRoot`, `resolve` | None beyond path resolution | Low: depends on git command availability |
| `getRepoRoot` | `spawnSync('git', ...)` | Executes git subprocess | Low: existing behavior; ensure CLI still works when git unavailable |
| `findAllArticlesWithUuid` | DOM traversal via helper functions | Pure compute | Low |
| `cleanReviewNoteText` | `findChildBySelector`, `textContent`, regex | Pure compute | Low |
| `resolveArticleFilePath` | `findNodeByTagAndId`, `findChildBySelector`, `textContent` | Pure compute | Low |
| `textContent` | Recursive DOM walk | Pure compute | Low |
| `isPlaceholderNote` | String normalization | Pure compute | Low |

## Risk Register
- **R1:** Misclassification of PASS/FAIL states could hide actionable hunks. *Impact:* High; *Plan:* Inspect note classification predicates and ensure filtering keyed on `.is-fail` class or verdict keywords; add focused test artifact covering PASS and FAIL combos.
- **R2:** If no failing hunks remain but PASS hunks exist, output should still surface verdict without error. *Impact:* Medium; *Plan:* Validate branch in manual test using sample artifact.

## Coverage Checklist
- `cmdResult` (both failing-notes-present and only-passing-notes paths).
- Helper filtering branch ensuring placeholder removal still works (`cleanReviewNoteText`, `isPlaceholderNote`).
- Verdict extraction logic once integrated (ensure verdict presence when no fails).

## Unknowns & Assumptions
- **U1:** HTML encoding of PASS vs FAIL markers currently inferred from `.is-pass` / `.is-fail` classes—need confirmation in artifacts. *Impact:* Medium; *Verification:* Inspect existing review artifact (e.g., `code_review/review_notepad_custom_concepts.html`).
- **U2:** Verdict section location and structure assumed to be `<section class="pr-request verdict...">`. *Impact:* Low; *Verification:* Re-read artifact DOM before implementation.

## Architectural Insights
- Review artifacts structure: `section` containers per file; each hunk wrapped in `article.hunk` with nested `.review-notes`.
- Verdict insertion logic already exists (`insertVerdict`); new behavior should reuse it for final output ordering.

## Next Protocol
- Pending clarification, expect to proceed with **COMPREHENSIVE IMPACT ANALYSIS PROTOCOL** followed by **MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL** for the feature change.

# Mission State: Review Script Git Diff

**Timestamp:** 2025-09-27 18:20:04 UTC
**Triggering Request:** Update `scripts/generateReview.ts` so review generation relies on `git diff` rather than feature branches.

## Scope & Entry Points
- Primary entry: `scripts/generateReview.ts::generateReview#L396`
- Supporting utilities within same file: argument parsing, git wrappers, diff parsing, HTML builders.
- No additional files currently within operational scope.

## Hot Modules (from analyzer snapshot)
- High fan-in components: `logger.ts`, `curriculum.ts`, `adaptiveEngine.ts`, `prompts.ts`, `model_usage.ts`.
- High fan-out components: `index.tsx`, `ui.ts`, `moduleSelectionHandler.ts`, `selectionSensei.ts`, `geminiService.ts`.
- None intersect current scope but noted for shared infrastructure interactions.

## Static Execution Trace
1. `generateReview` (CLI orchestration)
2. `parseArgument` → validates `--feature` / `--pr_request`
3. `timestamp`
4. `getRepositoryRoot` → `runGit('rev-parse --git-common-dir')`
5. `ensureDirectory`
6. `readCurrentBranch` → `runGit('rev-parse --abbrev-ref HEAD')`
7. Branch-first diff path: `listChangedFilesAgainstBase` → `runGit('diff --name-only main...branch')`
8. Fallback diff path: `listChangedFiles` → `runGit('diff --cached --name-only')` / `runGit('diff --name-only')`
9. `computeTargetFilename`
10. `loadPreviousPrRequests`
11. `countSentences`
12. `buildPrRequestMarkup`
13. `removeArtifacts`
14. For each file: `fileDiffAgainstBase` *or* `fileDiff` → `runGit('diff ...')`
15. `parseDiff`
16. `sectionIdForPath`
17. `buildChecklist`
18. `buildFileSection`
19. `buildDocument` (or `buildNoDiffDocument`)
20. `writeFileSync` outputs HTML; `console.log` reports location.

## Dependency & Side-Effect Table
| Function | Dependencies | Side Effects | Risk (Cost / Blast / Concurrency) |
| --- | --- | --- | --- |
| `generateReview` | Helpers listed in trace; Node `fs`, `path`, `process` | Exits process, writes files, console IO | High / High / Low |
| `runGit` | Node `child_process.spawnSync` | Executes git subprocess; throws on non-zero exit | High / Medium / Low |
| `getRepositoryRoot` | `runGit`, `path.resolve` | None beyond `runGit` | High / Medium / Low |
| `readCurrentBranch` | `runGit` | None beyond `runGit` | High / Medium / Low |
| `listChangedFilesAgainstBase` | `runGit` | None beyond `runGit` | High / Medium / Low |
| `listChangedFiles` | `runGit` | None beyond `runGit` | High / Medium / Low |
| `fileDiffAgainstBase` | `runGit` | None beyond `runGit` | High / Medium / Low |
| `fileDiff` | `runGit` | None beyond `runGit` | High / Medium / Low |
| `computeTargetFilename` | `fs.readdirSync`, `fs.existsSync` | Reads directory listings | Medium / Medium / Low |
| `loadPreviousPrRequests` | `fs.readFileSync`, JSON parsing | Reads existing HTML outputs | Medium / Medium / Low |
| `removeArtifacts` | `fs.unlinkSync` | Deletes prior review artifacts | Medium / High / Low |
| `buildDocument` / `buildNoDiffDocument` | String builders, `escapeHtml` | None (pure) | Low / Low / Low |
| `buildChecklist`, `buildFileSection`, `parseDiff`, `sectionIdForPath`, `countSentences`, `parseArgument`, `timestamp`, `buildPrRequestMarkup` | Internal helpers | Pure computations | Low / Low / Low |

## Risk Register
- External git dependency (`runGit` and callers): failure if repository state unusual. Mitigation: ensure script gracefully handles zero diff and propagates stderr.
- File deletion via `removeArtifacts`: risk of removing current artifact. Mitigation: confirm backup policy before edits; ensure filtering retains current output filename.
- HTML output writing: ensure target path valid on main-only workflow.

## Coverage Checklist
- Validate CLI run on repo with unstaged changes → ensures `listChangedFiles`/`fileDiff` path works.
- Validate scenario with only staged changes.
- Validate repo with clean status → triggers `buildNoDiffDocument` path.
- Confirm previous PR context reuse path after output exists.

## Assumptions & Unknowns Register
- Assumption: `git diff` commands execute without branch context (impact High). Verification: run updated script on clean + dirty repo before completion. Owner: Agent. Target: prior to RCI review.
- Unknown: Interaction with legacy branch-based HTML labels once branch diff removed (impact Medium). Verification: adjust document templates during implementation and re-run manual inspect. Owner: Agent. Target: implementation phase.

## Architectural Insights
- Script is self-contained CLI orchestrator; current architecture assumes branch comparisons (`main...feature`). Removing branch dependency will simplify control flow and align with main-only workflow.
- No evidence of shared service abstractions; modifications localized to git diff helpers and reporting strings.

## Next Protocol
Prepared to initiate **COMPREHENSIVE IMPACT ANALYSIS PROTOCOL** before design decisions.

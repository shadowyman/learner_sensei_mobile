# Mission State: Review Request Staging Scope (2025-10-04)

## Analysis Scope & Entry Points
- Primary entry: `scripts/generateReview.ts::generateReview` (invoked immediately by the CLI script).
- Supporting helpers inside the same module orchestrate argument parsing, diff acquisition, document assembly, and artifact writes.
- Hot modules to keep in view:
  - `scripts/generateReview.ts` – single orchestration point; every workflow path passes through it.
  - `scripts/review_mediator/messages.ts` – highest fan-in among mediator utilities; consumers may assume current artifact layout.
  - `scripts/review_mediator/log_manager.ts` / `dashboard.ts` – surface review generation progress to operators.

## Static Execution Trace
1. `generateReview` pulls CLI args, timestamps, repository root, and ensures the `code_review` output directory exists.
2. `parseArgument`, `timestamp`, and `pad` process flag values and assemble the run identifier.
3. `getRepositoryRoot` → `runGit(['rev-parse', '--git-common-dir'])` resolves the workspace baseline.
4. `computeTargetFilenames` scans existing artifacts to determine versioning and prior context.
5. `listWorkingTreeDiffFiles` → `runGit(['diff', '--staged', '--name-only'])` captures every currently staged path.
6. Versioning branch issues `runGit(['restore', '--staged', ...])` and `runGit(['add', ...])` before re-listing staged files.
7. `loadPreviousPrRequests` (→ `readFileSync`, `stripHtml`) loads prior review narratives when available.
8. Narrative validation flows through `countSentences`, `normalizeRequestBody`, and `buildPrRequestMarkup`.
9. Each staged path invokes `diffFile` → `runGit(['diff', '--staged', '--', path])`, then `parseDiff` and `sectionIdForPath` build per-file structures.
10. `buildChecklist` and `buildDocument` synthesize the final HTML; `writeFileSync` persists persona-specific copies.

## Dependency & Side-Effect Table
| Function | Key Dependencies | Side Effects | Risk |
| --- | --- | --- | --- |
| `generateReview` | CLI argv, helpers listed below | Triggers git restore/add, terminates via `process.exit`, writes artifacts | High – orchestrates git index mutations and output writes |
| `parseArgument` | Raw argv tokens | None | Low |
| `getRepositoryRoot` | `runGit`, `process.cwd` | Delegates to git command | Medium – fails if git unavailable |
| `runGit` | `spawnSync` | Executes synchronous git command; propagates stderr | High – blocks process, surfaces git errors |
| `listWorkingTreeDiffFiles` | `runGit diff --staged --name-only` | Relies on global index state | High – current design couples to all staged paths |
| `diffFile` | `runGit diff --staged -- <path>` | Reads staged diff for each file | Medium – heavy IO, inherits git failures |
| `computeTargetFilenames` | `readdirSync`, prior artifact naming | None beyond directory read | Low |
| `loadPreviousPrRequests` | `existsSync`, `readFileSync`, HTML parsing | File read; tolerant to parse errors | Medium – corrupt artifacts degrade recovery |
| `ensureDirectory` | `existsSync`, `mkdirSync` | Creates output directory | Medium – filesystem mutation |
| `buildChecklist` / `buildDocument` | In-memory section data | None (pure string assembly) | Low |
| `writeFileSync` (within `generateReview`) | N/A | Writes persona HTML files | High – overwrites artifacts |

## Risk Register
- **Git index mutations:** `generateReview` issues `git restore --staged` and `git add` when previous artifacts exist; incorrect filtering could drop unrelated staged work (High blast radius, concurrency risk High).
- **Global staged diff capture:** `listWorkingTreeDiffFiles` currently snapshots every staged file, so multi-task workflows bleed together (High blast, high cost due to review pollution).
- **Artifact overwrite risk:** Dual `writeFileSync` calls replace `code_review/review_*` files; concurrent runs without scoping can clobber desired history (Medium blast, Medium cost).
- **Dependency on synchronous git execution:** `runGit` blocks the process and fails loudly if git returns non-zero; introducing additional git plumbing must preserve error handling semantics (Medium blast, Medium cost).

## Coverage Checklist (Functions to validate after changes)
- `scripts/generateReview.ts::generateReview`
- `scripts/generateReview.ts::listWorkingTreeDiffFiles`
- `scripts/generateReview.ts::diffFile`
- `scripts/generateReview.ts::runGit`
- `scripts/generateReview.ts::computeTargetFilenames`
- `scripts/generateReview.ts::loadPreviousPrRequests`
- `scripts/generateReview.ts::buildChecklist`
- `scripts/generateReview.ts::buildDocument`

## Unknowns Register
| Unknown | Impact | Verification Plan | Owner / Target |
| --- | --- | --- | --- |
| Best location & format to persist per-task file selection so review runs stay isolated | Medium | **Resolved** – adopt single ledger at `tmp/review-contexts/assignments.json` managed by new CLI | Gene / 2025-10-04 |
| Interaction between new scoping method and versioning branch that re-stages files (`git restore` / `git add`) | High | Simulate multi-task scenario after design selection to ensure unrelated staged entries remain intact; may require dry-run tooling | Gene / before implementation coding |
| Downstream consumers assuming “all staged files” semantics (mediator dashboards, log summaries) | Medium | Audit `scripts/review_mediator/*` for assumptions about file counts when consuming generated artifacts | Gene / before protocol selection finalization |

## Key Architectural Insights
- Review generation is a single-file CLI that synchronously drives git and filesystem operations; there is no notion of task scoping today.
- Artifact versioning depends on staged file list consistency, so any scoping solution must coexist with `restore`/`add` safeguards.
- Mediator components with the highest fan-in (`messages.ts`) mediate artifact distribution; they may need awareness of task-specific metadata.

## Next Protocol to Execute
- Pending user brainstorming, the likely next major workflow is the **COMPREHENSIVE IMPACT ANALYSIS PROTOCOL** to map changes before altering `scripts/generateReview.ts`.

## Test Traceability Notes
- No concrete tests planned yet; anticipated work will need unit coverage around `scripts/generateReview.ts` helpers and potential new manifest utilities to ensure per-task scoping exercises expected git commands.

## Requirements & Approach Blueprint (2025-10-04)
- **Functional Requirements**
  - Provide a `npm run review:context` CLI with an `assign` subcommand that stages a supplied list of non-doc files, records them under `<slug>` in a manifest, and surfaces overlap warnings.
  - Extend the CLI with `append`, `show`, and `reset` operations for day-two adjustments and visibility.
  - Update `scripts/generateReview.ts` to require the manifest entry for the requested slug, filter staged files to the recorded list, and emit explicit guidance when the entry is missing.
  - Supply a managed pre-push hook that trims manifest assignments for files shipped in the push and removes empty slug entries.
- **Non-Functional Requirements**
  - Manifest writes must be atomic to avoid corruption; failures revert with actionable messaging.
  - Logs must surface `[REVCTX]` validation markers during testing, then the code must strip them post-verification.
  - CLI must reject doc paths and non-existent files while staging requested entries to keep index and manifest aligned.

## Trade-off Matrix Snapshot
| Approach | Maintainability | Operator Experience | Risk | Feasibility (/100) | Notes |
| --- | --- | --- | --- | --- | --- |
| Dedicated `review:context` CLI + shared manifest (chosen) | High – centralized ledger and TypeScript module reuse | High – single command stages + records | Medium – hook failure is primary concern | 88 | Aligns with mission FRs and keeps generateReview small |
| Integrate `--files` flag directly into `review:create` | Medium – widens generator responsibilities | Medium – requires manual flag every run | High – easy to mis-specify and skip cleanup | 62 | Lacks persistence across iterations |
| Git stash/scratch index automation | Low – complex git juggling | High once working | High – accidental resets risk data | 45 | Adds heavy git plumbing beyond current needs |

## Risk & Mitigation Register (Feature Scope)
| Risk | Mitigation |
| --- | --- |
| Manifest drift when operators forget to refresh slug entries | `assign` overwrites by default and prints summary of active files; `append` allows deliberate growth without duplicates.|
| Hook failure blocks pushes or leaves stale entries | Hook logs `[REVCTX] Cleanup skipped: <reason>` and exits non-zero only on manifest write failure; fallback `review:context cleanup --files` command documented.|
| Overlapping slugs obscuring shared file ownership | CLI prints `[REVCTX] File shared with <slug>` for every overlap and retains per-file slug array in manifest for audit.|

## Implementation & Validation Plan (Pending Approval)
- ☐ **Task 1**: Build `review_context` manifest utility and CLI entry point (argument parsing, file validation, atomic write helper).
  * *Validation Log*: `console.log('[REVCTX] Manifest persisted for slug', slug, files.length)`
  * *Implementation Details*: Create `scripts/reviewContext.ts` exporting a command dispatcher with strict argv parsing and JSON serialization via temporary file rename.
- ☐ **Task 2**: Implement `assign` and `append` subcommands that stage supplied files (excluding docs), warn on overlaps, and update ledger entries.
  * *Validation Log*: `console.log('[REVCTX] Assigned files for slug', slug, files)`
  * *Implementation Details*: Invoke `git add --` for validated paths, normalize to posix separators, merge with existing slug state when `--append` is present.
- ☐ **Task 3**: Add `show`, `reset`, and `cleanup` subcommands plus `review:context cleanup --files` to support manual manifest hygiene and hook reuse.
  * *Validation Log*: `console.log('[REVCTX] Cleanup removed entries', removedPaths)`
  * *Implementation Details*: Implement shared read-modify-write routine returning arrays of removed slugs/files for messaging.
- ☐ **Task 4**: Update `scripts/generateReview.ts` to require manifest entries, filter staged list, and emit friendly guidance when missing or empty.
  * *Validation Log*: `console.log('[REVCTX] Review files resolved', { slug, selected: selectedFiles.length, staged: stagedFiles.length })`
  * *Implementation Details*: Inject manifest reader before diff loop, bail out with actionable error, and reuse existing git helpers.
- ☐ **Task 5**: Create pre-push hook script (invoked via CLI) that trims manifest records for files in outgoing push and removes empty slugs.
  * *Validation Log*: `console.log('[REVCTX] Hook pruned', { removedFiles, clearedSlugs })`
  * *Implementation Details*: Diff refs supplied to hook to collect paths, call shared cleanup routine, exit zero on success, non-zero with message on manifest write failure.
- ☐ **Task 6**: Author unit/integration tests covering manifest assignment, filtering, cleanup, and hook diff parsing per functional test protocol.
  * *Validation Log*: `console.log('[REVCTX] Test harness executed', { suite: 'review-context' })`
  * *Implementation Details*: Add Jest tests exercising `assign`, `append`, review filtering, and hook cleanup; include negative cases for docs path rejection and missing manifest.
- Validation evidence will be cross-referenced with `[REVCTX]` log lines captured in `logs/console_logs.log` during Step 9 before removal.

## Functional Test Strategy Alignment
- Targeted unit tests around CLI manifest management and generator filtering will follow the Functional Test Implementation Protocol.
- Tests will cover both happy-path manifest assignment and negative cases (missing files, doc path rejection, manifest absence).
- Data sourcing: leverage real filesystem helpers and spawn stubs from production modules instead of ad-hoc mocks; rely on temporary directories managed within tests.
- Coverage breadth: pair success tests with negative cases for invalid paths, overlapping slugs, and missing manifest entries.
- Determinism: isolate filesystem mutations via tmp dirs and remove them in `afterEach` to avoid flaky interactions.
- Traceability: assert on returned manifest structures and generated error messages to mirror production contracts.

## Validation Evidence (2025-10-04)
- Ran `npm run review:context -- assign --feature review-context-demo --files package.json scripts/generateReview.ts scripts/reviewContext.ts scripts/reviewContextLib.ts scripts/prePushCleanup.ts tests/reviewContext.test.ts` producing `[REVCTX] Assigned files for slug { slug: 'review-context-demo', files: [...] }` confirming manifest persistence.
- Generated review via `npm run review:create -- --feature review-context-demo --pr_request <10+ sentence narrative>` observing `[REVCTX] Review files resolved { slug: 'review-context-demo', selected: 6, staged: 6 }` and checklist limited to scoped files.
- Executed `npm run review:context -- cleanup --files ...` capturing `[REVCTX] Hook pruned { removedFiles: [...], clearedSlugs: ['review-context-demo'] }` and verifying manifest reset to empty state.
- Negative path: `npm run review:context -- assign --feature negative-doc-test --files docs/...` rejected doc path with explicit error.
- Negative path: `npm run review:context -- assign --feature negative-missing-test --files does_not_exist.ts` failed fast with "Files not found" message.
- Negative path: `npm run review:create -- --feature missing-manifest ...` aborted with manifest guidance when slug entry absent.
- `npx tsc --noEmit` currently fails due to pre-existing errors in `mermaidErrorRecovery.ts`; noted for follow-up without modifying unrelated files.
- `npm test -- tests/reviewContext.test.ts --runTestsByPath --silent --bail --noStackTrace` reports "No tests found" under existing Jest configuration; flagged as limitation of current test harness.

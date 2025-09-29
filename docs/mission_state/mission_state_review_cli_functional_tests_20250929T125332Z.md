# Mission State – Review CLI Functional Tests (2025-09-29T12:53:32Z)

## Analysis Scope & Entry Points
- Target command surface: `scripts/reviewEdit.ts` (`main`, `cmdListUuid`, `cmdShowDiff`, `cmdResult`, `cmdRemark`, `cmdVerdict`).
- Auxiliary helpers in scope: `resolveArtifactPath`, `getRepoRoot`, DOM utilities (`findAllArticlesWithUuid`, `extractPrReviewContext`, `ensureReviewNoteStyles`, `ensureVerdictStyles`, `insertVerdict`).
- Supporting assets: review artifact HTML fixtures under `code_review/`, new functional test under `tests/`.
- Broader system awareness: high fan-in modules (`logger.ts`, `curriculum.ts`, `adaptiveEngine.ts`) noted for regression consideration even though not directly touched.

## Static Execution Trace
- `main` → `parseArg` → dispatch to requested subcommand → respective `cmd*` handler → `stdout`/`stderr` → optional `process.exit` on failure.
- `cmdListUuid` → `resolveArtifactPath` → `readFileSync` → `parse5.parse` → `findAllArticlesWithUuid` → `extractPrReviewContext` → prints UUIDs/context.
- `cmdShowDiff` → `resolveArtifactPath` → `readFileSync` → `parse5.parse` → `findAllArticlesWithUuid` → locate matching article → collect header/diff text → print.
- `cmdResult` → `resolveArtifactPath` → `readFileSync` → `parse5.parse` → `findAllArticlesWithUuid` → `cleanReviewNoteText`/`isPlaceholderNote` → aggregate remarks/diffs → print or exit non-zero.
- `cmdRemark` → `resolveArtifactPath` → `readFileSync` → optional stdin body → `parse5.parse` → `ensureReviewNoteStyles` → `findAllArticlesWithUuid` → update `review-notes` content/class → `parse5.serialize` → `writeFileSync`.
- `cmdVerdict` → `resolveArtifactPath` → `readFileSync` → stdin/arg body → `insertVerdict` → `ensureVerdictStyles` → `parse5.serialize` → `writeFileSync`.
- `resolveArtifactPath` → optional `getRepoRoot` → `spawnSync('git', …)` when resolving repo-relative artifacts.

## Dependency & Side-Effect Table

| Function | Key Dependencies | Side Effects | Risk (Cost/Blast/Concurrency) |
| --- | --- | --- | --- |
| `main` | `parseArg`, `cmd*`, `process.exit` | Process termination pathways | Medium / Medium / Low |
| `resolveArtifactPath` | `getRepoRoot`, `path.resolve`, `process.cwd` | Triggers git command via `spawnSync` | Medium / Low / Low |
| `getRepoRoot` | `spawnSync('git', …)` | External process invocation | Medium / Low / Low |
| `cmdListUuid` | `resolveArtifactPath`, `fs.readFileSync`, `parse5.parse`, DOM scanners | File read, stdout, process exit on failure | Low / Low / Low |
| `cmdShowDiff` | Same as list + diff extraction helpers | File read, stdout, process exit on failure | Low / Low / Low |
| `cmdResult` | Same as list + `cleanReviewNoteText`, `resolveArticleFilePath` | File read, stdout, process exit when no notes | Medium / Low / Low |
| `cmdRemark` | DOM helpers, `ensureReviewNoteStyles`, `parse5.parseFragment`, `fs.writeFileSync` | File read/write, remark classification | High / Medium / Low |
| `insertVerdict` | `ensureVerdictStyles`, DOM traversal helpers, `fs.writeFileSync` | File write, CSS injection | High / Medium / Low |
| `cmdVerdict` | `insertVerdict`, stdin handling | File write | High / Medium / Low |

## Risk Register
- High: Artifact mutation via `cmdRemark`/`insertVerdict`/`cmdVerdict`; verification plan → operate on isolated fixture, assert exact DOM updates, clean up after test.
- Medium: `resolveArtifactPath`/`getRepoRoot` reliance on git; verification plan → provide absolute fixture path inside test to bypass git dependency.
- Medium: `cmdResult` exits when remarks absent; verification plan → seed fixture with placeholder + real remark, assert skip logic and exit codes.
- Low: stdout formatting regressions; verification plan → snapshot-like assertions on command output streams.

### Additional Risk Assessment (2025-09-29)
- Medium: Functional tests may leave temporary artifacts/directories that pollute future runs or leak to git status. **Mitigation**: create fixtures under `tmp/review-cli-tests/<runId>` and delete after assertions.
- Medium: Negative-path tests that expect non-zero exit codes can terminate the parent process if not isolated. **Mitigation**: invoke CLI via `spawnSync` and assert on `status`/`stderr` without throwing.
- Low: Verdict/remark tests might misclassify PASS/FAIL styling if fixture markup diverges from production structure. **Mitigation**: build fixture using same structural selectors (sections, article.hunk, review-notes) and validate DOM after command execution via `parse5`.

## Coverage Checklist
- CLI dispatch through `main` for each subcommand.
- Successful `list-uuid`, `show-diff`, `result`, `remark`, `verdict` flows on the same artifact.
- Post-command artifact state verification (remark text/class, verdict section placement, CSS deduplication).
- Error/edge coverage: `result` exits when no non-placeholder remarks (plan for follow-up if needed).
- Negative coverage baseline: `list-uuid` missing artifact; `show-diff` invalid UUID; `remark` invalid UUID.
- Expanded negative coverage:
  - Missing required flags for every subcommand (omit `--file`, `--uuid`, or `--body`).
  - Conflicting or unsupported flags (e.g., `remark` with `--verdict`, duplicate flag values).
  - Invalid body payloads (`--body -` with empty stdin, bodies containing both PASS and FAIL keywords, malformed HTML) to confirm neutral styling or graceful error exits.
  - `review:result` with malformed artifact sections (missing `review-notes`) to verify guidance messaging.
  - `verdict` PASS-only vs FAIL-only vs neutral bodies to validate class switching and neutral fallback.
- Each scenario now executes as an individual labeled case with `START/PASS/FAIL` console banners for quick triage.

## Unknowns & Assumptions
- Analyzer did not surface `scripts/reviewEdit.ts` functions (`calls.json` empty for file); assumption: analyzer scope excludes scripts; mitigation: manual trace documented here.
- Need representative artifact structure for tests; assumption: purpose-built fixture replicating minimal required markup is acceptable; plan: craft deterministic fixture within test harness, validate outputs against expectations.
- Validation logs requirement: will temporarily instrument test harness with `[REVIEW_CLI_TESTS]` entries appended to `logs/console_logs.log`, to be removed after Step 9 once evidence captured.

## Implementation & Validation Blueprint (Pending Approval)
- **Task A**: Build mock review artifact generator that emits valid structure, including UUID-bearing hunks, placeholder + real notes, and context scripts. Store under `tmp/review-cli-tests/<case>/artifact.html`.
- **Task B**: Positive command coverage – run each CLI subcommand via `spawnSync` (ts-node entry), assert `status`, `stdout`, and DOM mutations in the fixture (remark rewrite, verdict insertion, result output). Each success path executes as a dedicated case.
- **Task C**: Negative command coverage – intentionally trigger error flows (`list-uuid` missing file, `show-diff` bad UUID, `remark` bad UUID, `result` with only placeholder note) and assert non-zero exit codes plus guidance text. Each failure mode is isolated into its own case for precise reporting.
- **Task D**: Extended flag/body validation scenarios – omit required flags, provide conflicting options, feed empty stdin bodies, and assert neutral styling when PASS/FAIL keywords collide.
  - Validation Log: `[REVIEW_CLI_TESTS] Missing flag rejected for ${command}`
  - Validation Log: `[REVIEW_CLI_TESTS] Conflicting flag error surfaced for ${command}`
  - Validation Log: `[REVIEW_CLI_TESTS] PASS/FAIL collision produced neutral state for ${command}`
  - Implementation Details: Exercise each command-specific invalid flag/body surface (`list-uuid`/`show-diff`/`remark`/`verdict`/`review:result`), capture stderr guidance, verify exit status, and inspect artifacts to ensure no unintended writes.
- **Task E**: Shared harness utilities for executing CLI, reloading updated HTML via `parse5`, and cleaning artifacts.
- **Validation Logs Plan**: During tasks A–D, append `fs.appendFileSync('logs/console_logs.log', "[REVIEW_CLI_TESTS] <message>\n")` at key checkpoints (fixture creation, positive flow verification, negative pathway validation, flag/body enforcement). Logs will be purged after Step 9 per protocol.

## Key Architectural Insights
- Review CLI mutates HTML artifacts directly; tests must isolate artifacts to prevent polluting real review files.
- PASS/FAIL keyword heuristics drive CSS classes; verifying both PASS and neutral flows will harden regression detection.
- `--body -` with empty stdin is accepted by both `remark` and `verdict`; tests assert the resulting state remains neutral rather than erroring, documenting actual tool behaviour.
- Package scripts `functional:review-cli` and `functional:analyzer` standardise functional test entry under the `functional:<slug>` naming scheme, and the review CLI harness now mirrors analyzer-style console banners for each case.

## Next Protocol
- Core analysis complete. I have mapped the execution trace and identified all dependencies and side effects. I am now ready to proceed with the MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL.

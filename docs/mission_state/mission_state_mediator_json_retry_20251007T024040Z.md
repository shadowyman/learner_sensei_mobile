# Mission State: Mediator JSON Retry (2025-10-07)

## Analysis Scope & Entry Points
- Primary entry: `scripts/review_mediator/worker.ts::run` orchestrating review lifecycle.
- High-focus modules: `scripts/review_mediator/worker.ts`, `scripts/review_mediator/command_adapters.ts`, `scripts/review_mediator/dashboard.ts` (status rendering), `scripts/review_mediator/messages.ts` (message contracts).
- Supporting dependencies: `runAgentCommand`, `runDispatch`, `postStatus` messaging, filesystem polling via `waitForJsonReport`.

## Static Execution Trace
1. `run()` seeds dispatch -> `reviewLoop()`.
2. `reviewLoop()` evaluates verdicts; on FAIL issues, calls `runRemediation()`.
3. `runRemediation()` kicks off `runAgent()` to invoke remediation CLI and then awaits `waitForJsonReport()`.
4. `runAgent()` builds prompt, spawns agent via `runAgentCommand()` (`command_adapters.ts`), streams status, handles failures.
5. `waitForJsonReport()` polls JSON artifact (via `jsonReportExists` + `fs.readFile`) until success/timeout; parse yields `newArtifact` passed back up.
6. Successful parse -> `deriveSlugFromFilename()` and `postNewArtifact`; failure flows return null causing `reviewLoop()` to post error and halt.

## Dependency & Side-Effect Table
| Function | Key Dependencies | Side Effects | Risk |
| --- | --- | --- | --- |
| `worker.ts::run` | `postStatus`, `runDispatchPhase`, `reviewLoop`, `postComplete`, `postError`, `postHeartbeat` | None direct | Medium (pipeline orchestrator) |
| `worker.ts::reviewLoop` | `runDispatchPhase`, `evaluateArtifact`, `runRemediation`, `postStatus`, `postLog`, `postComplete`, `postNewArtifact` | None direct | High (controls remediation retries and completion) |
| `worker.ts::evaluateArtifact` | `trackCommand`, `runReviewResult`, `parseVerdict` | None | Medium (verdict accuracy) |
| `worker.ts::parseVerdict` | Regex parse | None | Medium (PARSE_ERROR handling) |
| `worker.ts::runRemediation` | `postStatus`, `postLog`, `runAgent`, `waitForJsonReport`, `postError`, `repoRoot`, `deriveSlugFromFilename` | Orchestrates FS read via `waitForJsonReport` | High (links agent output to pipeline) |
| `worker.ts::runAgent` | `buildAgentPrompt`, `trackCommand`, `runAgentCommand`, `setInterval/clearInterval`, `postStatus`, `postLog`, `postError`, `summarizeCommandFailure` | Timer + child process mgmt | High (external process + concurrency) |
| `worker.ts::waitForJsonReport` | `jsonReportExists`, `fs.readFile`, `delay` | Filesystem read polling | High (root of JSON parse issue) |
| `worker.ts::postStatus/postError` | MessagePort | UI updates | Medium (status fidelity) |
| `worker.ts::extractTextFromJson` | `JSON.parse` | None | Low |
| `command_adapters.ts::runAgentCommand` | `resolveAgentCommandParts`, `runManagedCommand` | Process spawn | High |
| `command_adapters.ts::runManagedCommand` | `spawn`, callbacks | External process control | High |
| `command_adapters.ts::writeJsonReport` | `fs.mkdir`, `fs.writeFile` | Filesystem write | High |
| `command_adapters.ts::jsonReportExists` | `existsSync` | Filesystem stat | Medium |
| `dashboard.ts::renderStatusBlock` | `stateColor`, `stateTag` | UI render | Medium (header ERROR rendering)

## Unknowns Register
| Open Question | Impact | Verification Plan | Owner | Target |
| --- | --- | --- | --- | --- |
| Exact UI element showing `=== file` header | Medium | Trace `dashboard.ts` rendering + status message payload details | Self | During implementation |
| JSON schema guarantees from remediation agent (esp. partial writes) | High | Review current agent output handling, consider adding guards/tests simulating malformed JSON | Self | Prior to coding change |
| Iteration/state tracking for second remediation attempt | Medium | Inspect `currentIteration` handling in `worker.ts`, confirm logging for retries | Self | Prior to implementation |

## Risk Register (High Impact)
- `waitForJsonReport` reads potentially partial JSON → risk of false-negative parse; must guard + retry carefully.
- `runAgentCommand`/`runManagedCommand` spawn processes → ensure retries respect shutdown signals & avoid runaway processes.
- `writeJsonReport` atomicity assumptions → confirm new retry logic does not loop on stale/bad files.

## Coverage Checklist
- `worker.ts::run`
- `worker.ts::reviewLoop`
- `worker.ts::runRemediation`
- `worker.ts::runAgent`
- `worker.ts::waitForJsonReport`
- `worker.ts::parseVerdict`
- `worker.ts::extractTextFromJson`
- `command_adapters.ts::runAgentCommand`
- `command_adapters.ts::writeJsonReport`
- `command_adapters.ts::jsonReportExists`

## Architectural Insights
- Mediator worker relies on file-based handshake between agent runs; failures manifest late in `waitForJsonReport`.
- Status updates propagate through `postStatus`/`postError`, consumed by `dashboard.ts::renderStatusBlock`, so state strings determine header badges.
- Iteration counter `currentIteration` drives `[Iteration N]` label, providing hook for retry-related messaging.

## Next Protocol
- Proceed to **COMPREHENSIVE IMPACT ANALYSIS PROTOCOL**.

## Test Traceability Notes
- Planned automated coverage to exercise remediation retry will target `scripts/review_mediator/worker.ts` via integration harness (simulate agent output file scenarios).
- UI rendering impact validated indirectly by ensuring `postStatus` with `'Error'` state surfaces `[ERROR]` badge in dashboard header for affected artifact.

Core analysis complete. I have mapped the execution trace and identified all dependencies and side effects. I am now ready to proceed with the COMPREHENSIVE IMPACT ANALYSIS PROTOCOL.

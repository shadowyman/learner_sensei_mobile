# Mission State: Mediator JSON Timeout

## Analysis Scope & Entry Points
- Refreshed analyzer snapshot (`npm run analysis:run`) and focused trace for `scripts/review_mediator/worker.ts::run` to bound scope.
- Primary entry: `scripts/review_mediator.ts::main` spawns worker threads via `spawnWorker`.
- Worker execution core: `scripts/review_mediator/worker.ts` (`run`, `runDispatchPhase`, `reviewLoop`, `runRemediation`).
- Command surface: `scripts/review_mediator/command_adapters.ts` (`runManagedCommand`, `runDispatch`, `runReviewResult`, `runAgentCommand`, `jsonReportExists`).
- Messaging and status propagation: `scripts/review_mediator/messages.ts` definitions consumed throughout worker/main thread boundary.

## Static Execution Trace
1. `review_mediator.ts::main` → `spawnWorker` → worker bootstrap (`trackCommand`, message handlers).
2. Worker `run` → `runDispatchPhase` → `runDispatch` (npm script) → `dispatchListener` streaming logs.
3. `reviewLoop` → `evaluateArtifact` → `runReviewResult` (npm script) → `parseVerdict`.
4. On FAIL verdict: `runRemediation` → `runAgent` → `runAgentCommand` (Codex CLI) → polling via `waitForJsonReport` (`jsonReportExists`, `fs.readFile`, `delay`).
5. Success path: `deriveSlugFromFilename` → `postNewArtifact` to main thread → loop restarts with updated `artifactPath`/`slug`.
6. Failure path: `postError` + `postComplete('ERROR')` terminates iteration, leaving stale JSON expectation behind.

## Dependency & Side-Effect Table
| Function | Key Dependencies | Side Effects | Risk (Cost / Blast / Concurrency) |
| --- | --- | --- | --- |
| `review_mediator.ts::main` | `spawnWorker`, `LogManager`, `DashboardRenderer` | Spawns worker threads, maintains global status map | Medium / High / Medium |
| `worker.ts::run` | `runDispatchPhase`, `reviewLoop`, `postStatus`, `postComplete`, `postError`, `postHeartbeat` | Coordinates overall iteration lifecycle, message traffic | Medium / High / Medium |
| `worker.ts::runDispatchPhase` | `runDispatch`, `trackCommand`, `dispatchListener`, `postStatus`, `postError` | Launches `npm run review:dispatch`, forwards AI stream output | High / High / Medium |
| `worker.ts::reviewLoop` | `runDispatchPhase`, `evaluateArtifact`, `runRemediation`, `postLog`, `postNewArtifact`, `postComplete` | Controls verdict handling, queues remediation loops | High / High / Medium |
| `worker.ts::runRemediation` | `runAgent`, `waitForJsonReport`, `postStatus`, `postLog`, `deriveSlugFromFilename`, `repoRoot` | Kicks off Codex remediation, polls for JSON report, mutates iteration counters | High / High / Medium |
| `worker.ts::runAgent` | `buildAgentPrompt`, `trackCommand`, `runAgentCommand`, `postStatus`, `postLog`, `summarizeCommandFailure` | Spawns long-running Codex process, manages 2s heartbeat timer | High / High / Medium |
| `worker.ts::waitForJsonReport` | `jsonReportExists`, `fs.readFile`, `delay`, `Date.now` | Busy-waits filesystem 500 ms cadence for `{ "new_artifact" }` payload | Medium / Medium / Medium |
| `command_adapters.ts::runManagedCommand` | `spawn`, `setPriority`, `repoRoot` | Starts external processes, optional priority boost, aggregates stdout/stderr | High / High / High |
| `command_adapters.ts::jsonReportExists` | `existsSync`, `resolve` | Reads filesystem synchronously each polling cycle | Low / Medium / Medium |
| `worker.ts::postStatus`/`postLog`/`postError` | `messagePort.postMessage` | Emits telemetry to main thread UI/log files | Medium / Medium / Low |

## Risk Register
| Risk | Impact | Verification Plan |
| --- | --- | --- |
| JSON polling kicks in before follow-up agent finishes writing `/review_process/<artifact>.json`, causing hard error despite ongoing remediation | High | Correlate worker log timestamps with Codex CLI session logs; confirm whether the agent process exits before JSON appears. |
| Stale or colliding JSON files (same `<artifact>.json` reused across iterations) can return outdated `new_artifact` paths | Medium | Inspect `/code_review/review_process` lifecycle during multi-iteration runs; instrument cleanup or version tagging if reuse observed. |
| `runManagedCommand` priority boost may starve concurrent workers, delaying file generation and inflating timeout risk | Medium | Capture OS-level scheduling metrics during dual-agent runs to confirm no starvation; adjust boost flag if necessary. |

## Coverage Checklist
- `scripts/review_mediator/worker.ts::run#1c01bcd7c636`
- `scripts/review_mediator/worker.ts::runDispatchPhase#7f5dc6316fe1`
- `scripts/review_mediator/worker.ts::reviewLoop#de6518c9cc4d`
- `scripts/review_mediator/worker.ts::runRemediation#751000942336`
- `scripts/review_mediator/worker.ts::runAgent#c350d4aaed8f`
- `scripts/review_mediator/worker.ts::waitForJsonReport#b6f2463d98c2`
- `scripts/review_mediator/command_adapters.ts::runManagedCommand#d0a1ba6ffcc1`
- `scripts/review_mediator/command_adapters.ts::jsonReportExists#7868708c4a4b`

## Unknowns & Assumptions
| Unknown | Impact | Verification Plan |
| --- | --- | --- |
| Whether the Codex mediator agent guarantees synchronous JSON emission before the CLI process exits on multi-agent (Codex → Claude) runs | High | Review full Codex transcript for failing artifact; confirm exit timestamp vs. filesystem writes or request additional instrumentation from runtime environment. |
| Actual runtime of second mediator agent relative to fixed 120 s timeout window | Medium | Gather empirical duration stats from recent retries; adjust timeout or implement adaptive wait once data collected. |
| Potential concurrent access to `/code_review/review_process/<artifact>.json` by multiple workers leading to partial writes | Medium | Audit LogManager append order and ensure only the owning worker writes/reads; add file-lock diagnostics if anomalies appear. |

## Architectural Insights
- JSON hand-off is the sole gating signal between remediation iterations; any asynchrony between agent completion and file write manifests as a hard failure.
- File naming hinges on the current artifact basename; discrepancies in agent output naming (e.g., missing `_codex_vN` suffix) would strand the loop without detection.
- Worker status pipeline already publishes granular logs (`postLog`), so adding timestamps around JSON polling would make diagnosing premature checks trivial.

## Next Protocol
- Core analysis complete. I have mapped the execution trace and identified all dependencies and side effects. I am now ready to proceed with the **MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL**.

## Test Traceability
- End-to-end verification requires running `npm run review_mediator -- --file <artifact>` against a multi-iteration artifact to capture JSON timings, Codex CLI exit codes, and log outputs under `/code_review/review_process`.
- No automated test harness currently covers the remediation loop; manual or scripted integration run is necessary after any change touching polling or command sequencing.


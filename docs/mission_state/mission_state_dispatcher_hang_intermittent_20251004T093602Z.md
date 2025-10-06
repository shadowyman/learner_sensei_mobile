# Mission State: Dispatcher Agent Hang Investigation

- Timestamp: 2025-10-04T09:36:02Z
- Trigger: Intermittent hang observed while the review mediator invokes the dispatcher agent (`npm run review:dispatch`).
- Core analysis statement: Core analysis complete. I have mapped the execution trace and identified all dependencies and side effects. I am now ready to proceed with the Mandatory Adaptive Root Cause Analysis & Remediation Protocol.

## Scope & Entry Points
- CLI entrypoint `scripts/review_mediator.ts::main@836` coordinating worker lifecycle, dashboard updates, and shutdown flow.
- Worker orchestration via `scripts/review_mediator.ts::spawnWorker@3017`, `handleWorkerMessage@5152`, `render@10195`, and `checkCompletion@9428`.
- Worker execution pipeline `scripts/review_mediator/worker.ts::run@3990` → `runDispatchPhase@4320` → `reviewLoop@4939` → remediation helpers (`evaluateArtifact@6476`, `runRemediation@7064`, `runAgent@8038`, `waitForJsonReport@9604`).
- Command layer `scripts/review_mediator/command_adapters.ts::runManagedCommand@2543` with wrappers (`runDispatch@3810`, `runAgentCommand@4400`, `runReviewResult@4004`).
- Support modules: logging (`scripts/review_mediator/log_manager.ts`), dashboard rendering (`scripts/review_mediator/dashboard.ts`).
- Hot modules (per analyzer fan-in/out): `scripts/review_mediator/messages.ts` (fan-in 3), `logger.ts` (21), `adaptiveEngine.ts` (10), `curriculum.ts` (10) — monitor for shared side effects if further investigation spans beyond mediator scope.

## Static Execution Trace
1. `main` parses CLI args, initializes log manager/dashboard, spawns workers, and schedules dashboard refresh interval.
2. `spawnWorker` resolves worker script, injects context, subscribes to worker messages/errors, and tracks active jobs.
3. Worker boot (`run`) posts initial status and invokes `runDispatchPhase` for the artifact.
4. `runDispatchPhase` starts `runDispatch` (child npm process) via `runManagedCommand`, streaming output through `dispatchListener`, and returns success/failure.
5. On success, `reviewLoop` evaluates results (`runReviewResult`), posts statuses/logs, and either completes or routes to `runRemediation`.
6. `runRemediation` triggers `runAgent` (continuous status streaming via `setInterval`), then waits for JSON handoff (`waitForJsonReport`) before resuming loop with updated artifact.
7. Worker posts messages (`postStatus`, `postLog`, etc.) processed by `handleWorkerMessage`, updating status records, appending logs, and re-rendering dashboard.
8. Completion or failure updates trackers; `checkCompletion` clears timers and exits when all originals finish.

## Dependency & Side-Effect Table
| Function (stable id) | Key Dependencies | Side Effects | Risk |
| --- | --- | --- | --- |
| `scripts/review_mediator.ts::main@836` | `parseArtifacts`, `LogManager.resetLog`, `spawnWorker`, `render`, `process.on` handlers | `fs.mkdir`, `console.info`, installs `setInterval`, sets `process.exitCode` | High (filesystem writes + timer lifecycle + signal handling) |
| `scripts/review_mediator.ts::spawnWorker@3017` | `artifactKey`, `Worker`, `handleWorkerMessage`, `render`, `checkCompletion` | Creates worker threads, mutates tracking maps, handles worker errors | High (concurrency, error propagation) |
| `scripts/review_mediator.ts::handleWorkerMessage@5152` | `logManager.append`, `render`, `createStatusRecord` | Updates shared status map, appends logs to disk | High (shared state + filesystem writes) |
| `scripts/review_mediator/worker.ts::run@3990` | `postStatus`, `runDispatchPhase`, `reviewLoop`, `postError`, `postHeartbeat` | Cross-thread messaging | Medium (UI feedback only) |
| `scripts/review_mediator/worker.ts::runDispatchPhase@4320` | `runDispatch`, `trackCommand`, `dispatchListener`, `postStatus`, `postLog` | Launches npm subprocess, streams logs, posts errors | High (external process lifecycle) |
| `scripts/review_mediator/worker.ts::dispatchListener@12653` | `postLog`, `extractTextFromJson`, `postStatus` | Parses JSON lines, updates status/logs | Medium (dependent on upstream output format) |
| `scripts/review_mediator/command_adapters.ts::runManagedCommand@2543` | `spawn`, `repoRoot`, output listeners | Spawns child process, handles stdio, exposes terminate hook | High (process control, potential resource leaks) |
| `scripts/review_mediator/command_adapters.ts::runDispatch@3810` | `runManagedCommand` | Inherits child process behavior | High (same as runManagedCommand) |
| `scripts/review_mediator/worker.ts::runAgent@8038` | `runAgentCommand`, `trackCommand`, `setInterval`, `postStatus` | Spawns external command, installs interval ticker, posts logs/errors | High (long-running command + timer coordination) |
| `scripts/review_mediator/worker.ts::waitForJsonReport@9604` | `jsonReportExists`, `fs.readFile`, `delay` | Polls filesystem until timeout | Medium (blocking loop, file IO latency) |
| `scripts/review_mediator/log_manager.ts::append@784` | `fs.appendFile`, `sanitize` | Writes log file, mutates in-memory log buffer | Medium (IO cost, potential backpressure) |

## Risk Register (High/Medium)
- External command lifecycle (`runManagedCommand`, `runDispatch`, `runAgent`) — High: potential for hanging subprocesses or unhandled stderr saturation.
- Worker-to-main messaging (`handleWorkerMessage`, `runDispatchPhase`) — High: message queue congestion could stall UI updates.
- Filesystem polling (`waitForJsonReport`) — Medium: tight loop with 500 ms delay could mask underlying hangs if JSON never appears.
- Dashboard rendering interval (`main` setInterval) — Medium: stale render if interval not cleared, but not root cause of hang.

## Coverage Checklist (function IDs)
- `scripts/review_mediator.ts::main@836`
- `scripts/review_mediator.ts::spawnWorker@3017`
- `scripts/review_mediator.ts::handleWorkerMessage@5152`
- `scripts/review_mediator.ts::render@10195`
- `scripts/review_mediator.ts::checkCompletion@9428`
- `scripts/review_mediator/worker.ts::run@3990`
- `scripts/review_mediator/worker.ts::runDispatchPhase@4320`
- `scripts/review_mediator/worker.ts::dispatchListener@12653`
- `scripts/review_mediator/worker.ts::reviewLoop@4939`
- `scripts/review_mediator/worker.ts::evaluateArtifact@6476`
- `scripts/review_mediator/worker.ts::runRemediation@7064`
- `scripts/review_mediator/worker.ts::runAgent@8038`
- `scripts/review_mediator/worker.ts::waitForJsonReport@9604`
- `scripts/review_mediator/command_adapters.ts::runManagedCommand@2543`
- `scripts/review_mediator/command_adapters.ts::runDispatch@3810`
- `scripts/review_mediator/log_manager.ts::append@784`
- `scripts/review_mediator/dashboard.ts::DashboardRenderer.render@447`

## Assumptions & Unknowns Register
- Assertion: Dispatcher hang originates within mediator, not the underlying `review:dispatch` script. Impact: High. Verification: Inspect `npm run review:dispatch` implementation and collect timing logs around `runManagedCommand` start/finish during ARCAR Step 2. Owner: Codex. Target: before ARCAR Step 5.
- Unknown: Whether stdout JSON lines from dispatcher are buffered, delaying `dispatchListener` updates. Impact: Medium. Verification: Add temporary timestamped logging (diagnostic only) or review dispatcher output format before modifying code. Owner: Codex. Target: before proposing remediation.
- Unknown: Active command set cleanup adequacy when dispatcher command stalls. Impact: Medium. Verification: Trace `trackCommand` lifecycle and confirm `handle.result` settles in all code paths during ARCAR analysis.

## Key Architectural Insights
- Mediator relies on Node worker threads with message passing; any blocking in worker (e.g., awaiting child process) halts status updates until completion.
- `runManagedCommand` aggregates stdout/stderr in memory; long-running commands emit chunks but mediator only surfaces latest parsed JSON line, so silent periods translate to apparent hangs despite ongoing work.
- No timeout wraps `runDispatchPhase`; mediator depends entirely on subprocess exit, making upstream slowdowns visible as hangs.
- Dispatcher listener posts raw JSON string instead of extracted text, potentially increasing payload size and delaying UI rendering if logs are large.

## Next Protocol
- Triggering protocol following core analysis: Mandatory Adaptive Root Cause Analysis & Remediation Protocol (bug investigation of dispatcher hang).

## Functional Test Traceability
- Tests exercising this flow must import `scripts/review_mediator.ts`, `scripts/review_mediator/worker.ts`, and `scripts/review_mediator/command_adapters.ts` to cover CLI coordination, worker pipeline, and managed command execution.


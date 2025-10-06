# Mission State: Mediator Iteration Dashboard

## Analysis Scope & Entry Points
- Primary scope: `scripts/review_mediator/worker.ts` (`run`, `reviewLoop`, remediation workflow)
- UI scope: `scripts/review_mediator/dashboard.ts` (status and log rendering)
- Logging scope: `scripts/review_mediator/log_manager.ts` (log truncation and presentation)
- Supporting interfaces: `scripts/review_mediator/messages.ts`, `scripts/review_mediator/command_adapters.ts`

## Static Execution Trace
1. `main` (`scripts/review_mediator.ts`) → `spawnWorker`
2. Worker thread `run` → `runDispatchPhase` → `runDispatch` (`command_adapters.ts`) → `dispatchListener`
3. `reviewLoop` orchestrates `evaluateArtifact` → `runReviewResult` (`command_adapters.ts`)
4. On failure path, `runRemediation` → `runAgent` → `runAgentCommand` (`command_adapters.ts`) → `waitForJsonReport`
5. Successful remediation triggers `postNewArtifact` → main thread `handleWorkerMessage` updates status map
6. Dashboard loop (`DashboardRenderer.render`) pulls `LogManager.getVisibleLogs`, formats entries via `formatStatus`/`formatLogLine`

## Dependency & Side-Effect Table

| Function | Dependencies | Side Effects | Risk (Cost/Blast/Concurrency) |
| --- | --- | --- | --- |
| `runDispatchPhase` (`worker.ts`) | `postLog`, `postStatus`, `trackCommand`, `runDispatch`, `dispatchListener`, `postError` | Launches `npm run review:dispatch`, emits worker status/log messages | High / High / Medium |
| `reviewLoop` (`worker.ts`) | `runDispatchPhase`, `postStatus`, `evaluateArtifact`, `postLog`, `postComplete`, `runRemediation`, `postNewArtifact` | Drives remediation state machine via inter-thread messaging | Medium / Medium / Medium |
| `evaluateArtifact` (`worker.ts`) | `trackCommand`, `runReviewResult`, `parseVerdict` | Executes CLI verdict command, signals errors | Medium / Medium / Medium |
| `runRemediation` (`worker.ts`) | `postStatus`, `postLog`, `runAgent`, `postError`, `waitForJsonReport`, `repoRoot`, `deriveSlugFromFilename` | Runs remediation agent, polls filesystem for JSON | High / High / Medium |
| `runAgent` (`worker.ts`) | `buildAgentPrompt`, `postLog`, `trackCommand`, `runAgentCommand`, `setInterval`, `postStatus`, `postError`, `summarizeCommandFailure` | Launches remediation agent process, manages timers and streaming status | High / High / Medium |
| `waitForJsonReport` (`worker.ts`) | `jsonReportExists`, `fs.readFile`, `delay` | Polls filesystem for JSON output | Medium / Medium / Medium |
| `postStatus` (`worker.ts`) | `postLog` | Sends status updates to main thread renderer | Medium / Medium / Medium |
| `dispatchListener` (`worker.ts`) | `postLog`, `extractTextFromJson`, `postStatus` | Streams dispatch output into logs and status | Medium / Medium / Medium |
| `DashboardRenderer.render` (`dashboard.ts`) | `buildFrame` | Manipulates terminal buffer and cursor state | Medium / Medium / Medium |
| `DashboardRenderer.buildFrame` (`dashboard.ts`) | `formatStatus`, `formatLogLine` | Assembles dashboard UI text | Low / Low / Low |
| `DashboardRenderer.formatStatus` (`dashboard.ts`) | `spinner`, `stateLabel` | Pure formatting | Low / Low / Low |
| `DashboardRenderer.formatLogLine` (`dashboard.ts`) | `limitLogLength`, `parseLogPayload`, `extractField` | Parses JSON payloads into readable lines | Low / Low / Low |
| `DashboardRenderer.limitLogLength` (`dashboard.ts`) | — | String truncation | Low / Low / Low |
| `LogManager.append` (`log_manager.ts`) | `format`, `sanitize`, `fs.appendFile` | Persists logs, maintains visible tail | High / High / Medium |
| `LogManager.sanitize` (`log_manager.ts`) | — | String cleanup/truncation | Low / Low / Low |

## Risk Register

| Risk | Impact | Verification Plan |
| --- | --- | --- |
| External commands (`runDispatch`, `runReviewResult`, `runAgentCommand`) must tolerate updated status strings | Medium | Run mediator against sample artifact; ensure CLI calls succeed and responses parsed |
| Iteration counter could desync if loop exits mid-cycle | Medium | Observe worker logs/status transitions during dry run to confirm increments only on successful JSON hand-off |
| Increased log truncation limit (250 chars) might wrap dashboard lines | Low | Inject long log entry and visually inspect dashboard |

## Coverage Checklist
- `runDispatchPhase`
- `reviewLoop`
- `runRemediation`
- `runAgent`
- `dispatchListener`
- `DashboardRenderer.buildFrame`
- `DashboardRenderer.formatLogLine`
- `LogManager.append`

## Unknowns & Assumptions

| Unknown | Impact | Verification Plan |
| --- | --- | --- |
| Sample run needed to validate iteration display across successive artifacts | Medium | Execute mediator locally once changes land |
| Dashboard layout must accommodate `[Iteration X]` prefix without obscuring verdict/status | Low | Manual visual confirmation post-change |

## Architectural Insights
- Iteration awareness must live in worker loop; status text pipeline already propagates to dashboard without schema changes.
- Dashboard and log truncation share independent limits (renderer vs. manager); both must be updated to keep behavior consistent.

## Next Protocol
- Proceed with **COMPREHENSIVE IMPACT ANALYSIS PROTOCOL** prior to implementation, followed by **MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL** for feature delivery.

## Test Traceability Notes
- Planned verification relies on end-to-end mediator run that invokes `npm run review:dispatch`, `npm run review:result`, and remediation agent; no automated tests currently cover this path, so manual validation is required.

Core analysis complete. I have mapped the execution trace and identified all dependencies and side effects. I am now ready to proceed with the next protocol.

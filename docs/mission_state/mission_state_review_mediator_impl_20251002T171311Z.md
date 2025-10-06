# Mission State: Review Mediator Script Implementation

## Analysis Scope & Entry Points
- Target deliverable: new Node-based mediator script orchestrating review automation described in `docs/functional_spec/review_mediator_functional_spec.md`.
- Expected location: `scripts/review_mediator.ts` (or analogous) executed via new npm script.
- Dependent CLI commands: `npm run review:dispatch` (`python3 scripts/sync_review.py`), `npm run review:result` (`ts-node scripts/reviewEdit.ts result`), `npm run review:create` (`ts-node scripts/generateReview.ts`).
- Supporting assets: `/code_review` artifact directory, `/code_review/review_process/` JSON outputs, per-artifact log files.
- Hot modules from analyzer snapshot: `logger.ts`, `adaptiveEngine.ts`, `curriculum.ts` (watchpoints for unintended side effects though not directly touched).

## Static Execution Trace (Planned)
1. `main()` parses CLI args → list of artifact identifiers.
2. `initializeDashboard()` clears screen, ensures `/code_review/review_process/` exists, sets up double-buffer renderer and global log registry.
3. For each artifact: `spawnReviewWorker(artifact)` creates a worker thread with shared status channel and opens `<artifact>.log` (emptied on start).
4. Worker thread steps:
   - `runDispatchPhase()` → spawn `npm run review:dispatch -- --file <artifact>` and stream spinner/log updates.
   - `pollDispatchCompletion()` → monitor child exit; emit log + status update.
   - `evaluateArtifact()` → run `npm run review:result -- --file <artifact>`; parse stdout to determine PASS/FAIL/NEUTRAL; push summary to main thread.
   - If PASS → send `complete` message; if FAIL → invoke `startRemediation()`.
   - `startRemediation()` → launch AI agent subprocess (Codex-based) with prompts from spec, pipe output back; every 2s send latest line to main thread.
   - `awaitJsonReport()` → watch `/code_review/review_process/<artifact>.json`; once present, read & validate `new_artifact`. On missing/invalid JSON mark Error and bubble up.
   - `requeueWithNewArtifact()` → notify main thread to add new artifact to processing queue; loop continues for new version.
5. Main thread `statusLoop()` merges worker messages, refreshes terminal display with double-buffer, rotates 5-line debug log window, writes full entries to `<artifact>.log`.
6. SIGINT handler triggers `requestShutdown()` → send cancellation to workers, terminate child processes gracefully, final screen restore.
7. Completion path prints "Review process is complete for <artifact>" for each original artifact and exits with aggregated success code.

## Dependency & Side-Effect Table
- `main()`
  - Depends on: `worker_threads`, `fs`, `path`, CLI args.
  - Side effects: spawns workers, manipulates terminal state.
  - Risk: Medium (incorrect parsing or worker coordination could stall pipeline).
- `initializeDashboard()`
  - Depends on: `fs.existsSync`, `fs.mkdirSync`, terminal control sequences.
  - Side effects: ensures `/code_review/review_process/`, clears logs, writes to stdout.
  - Risk: Low.
- `spawnReviewWorker(artifact)`
  - Depends on: `Worker` API, shared memory messaging.
  - Side effects: creates threads, opens log file handles.
  - Risk: High (resource leaks, concurrency bugs).
- `runDispatchPhase()`
  - Depends on: `child_process.spawn` launching `npm run review:dispatch` → `scripts/sync_review.py` (Codex monitor, file watchers).
  - Side effects: spawns external process, inherits stdout/stderr.
  - Risk: High (external script failure, environment requirements like watchdog module).
- `evaluateArtifact()`
  - Depends on: `npm run review:result` (parses HTML via `parse5`).
  - Side effects: executes CLI, consumes stdout/stderr.
  - Risk: Medium (HTML parsing failures propagate as FAIL; ensure robust detection).
- `startRemediation()` / `promptAgent()`
  - Depends on: availability of Codex/agent runtime, prompt correctness.
  - Side effects: triggers AI modifications, writes new artifacts via `review:create`.
  - Risk: High (external service reliability, long-running tasks).
- `awaitJsonReport()`
  - Depends on: `fs.watch`/polling, JSON parsing.
  - Side effects: reads/writes JSON; failure escalates to Error state (no retries).
  - Risk: Medium-High (I/O, race with agent writing file).
- `updateStatusLine()`
  - Depends on: terminal control, double-buffer render state.
  - Side effects: redraws screen, handles spinner.
  - Risk: Medium (flicker, stale data if mis-synced).
- `logEvent()`
  - Depends on: `fs.appendFile`, in-memory ring buffer.
  - Side effects: writes to `<artifact>.log`, updates debug window.
  - Risk: Low.
- `handleCtrlC()`
  - Depends on: `process.on('SIGINT')`, worker message protocol.
  - Side effects: signals threads, terminates child processes.
  - Risk: Medium (dangling processes if not coordinated).

## Risk Register (High Impact)
1. Worker/thread coordination with external processes → potential zombie processes or unflushed logs. Mitigation: shared cancellation tokens, ensure `child_process` handles `SIGTERM`/`SIGINT`.
2. Reliance on Codex agent output and JSON file: agent failure leaves artifacts in Error. Mitigation: surface actionable error, allow operator retry.
3. Terminal rendering concurrency: asynchronous updates from workers may race; buffer and serialize renders on main thread only.
4. `review:create` requires staged git diff; ensure mediator runs in repository with staged changes or handle failure gracefully.

## Coverage Checklist (Functions to Validate)
- `main()` arg parsing / artifact queue seeding.
- `initializeDashboard()` directory & log setup.
- Worker message loop covering dispatch PASS, dispatch FAIL → remediation, JSON error path.
- `updateStatusLine()` double-buffer, spinner removal, AI output refresh.
- `handleCtrlC()` graceful shutdown with running child processes.
- File writing: `<artifact>.log`, `/code_review/review_process/<artifact>.json` lifecycle.

## Unknowns Register
1. Agent invocation transport: confirm whether to reuse `codex exec` (as in `scripts/sync_review.py`) or another interface. Impact: High. Verification: prototype agent call; Owner: implementation; Target: before coding worker thread.
2. Streaming AI output capture: need mechanism to pipe agent stdout into mediator for 2s updates. Impact: Medium. Verification: experiment with `spawn` + incremental buffer; Owner: implementation; Target: before implementing remediation loop.
3. Terminal control dependencies: confirm availability of packages (e.g., `ansi-escapes`) or implement manually. Impact: Medium. Verification: choose library before coding renderer; Owner: implementation; Target: design phase.

## Key Architectural Insights
- Use dedicated worker thread per artifact to simplify state but coordinate via message channel to maintain single render pipeline.
- Double-buffer terminal rendering avoids flicker while respecting log window constraint (top-of-screen static, log window pinned).
- Logging strategy splits display (5 latest) vs full logs on disk to avoid scrollback yet retain audit trail.

## Next Protocol
- Proceed to **Mandatory Principle-Driven Feature Implementation Protocol** to design and build the mediator script per functional spec.

## Traceability / Planned Tests
- Future Jest functional suites will target new mediator module (spawn mocking), CLI integration harness, and shutdown handling, aligning with coverage checklist entries.

Core analysis complete. I have mapped the execution trace and identified all dependencies and side effects. I am now ready to proceed with the Mandatory Principle-Driven Feature Implementation Protocol.

## Updated Goals & Requirements (Step 1)
- **Functional Requirements** (grounded in functional spec & static trace):
  1. Accept one or more review artifacts as CLI params and allocate one worker thread per artifact.
  2. Execute `npm run review:dispatch` in parallel for each artifact, showing per-artifact spinner and status text.
  3. Immediately route completed artifacts through `npm run review:result`, updating inline status and determining PASS/FAIL.
  4. For FAIL artifacts, launch remediation threads that: invoke the AI agent workflow, stream the latest AI output line to the dashboard every 2s, ensure `npm run review:create -- --feature <slug> --pr_request "<10+ sentence narrative explaining all changes made>"` runs, and confirm JSON `{ "new_artifact": "..." }` is saved under `/code_review/review_process/`.
  5. Requeue new artifacts from remediation until `review:result` reports PASS, then print "Review process is complete for <original>".
  6. Maintain per-artifact log files and persistently update the static dashboard without scrolling, keeping only the five newest log entries visible while writing the entire history to disk.
  7. Support graceful shutdown on `Ctrl+C`, ensuring all workers and child processes terminate cleanly.
- **Non-Functional Requirements**:
  - Double-buffer rendering to prevent terminal flicker while honouring 5-line log window constraint.
  - No automatic timeouts; rely on manual cancellation.
  - Worker-per-artifact concurrency with lightweight synchronization to avoid shared-state corruption.
  - Deterministic log prefixes and validation hooks to prove each phase executed (aligned with forthcoming validation plan).
  - Compatibility with existing Node/TypeScript stack; optional Python reuse must match responsiveness.

## Comprehensive Impact Analysis (Step 1)
1. **Change Classification & Risk Stratification**
   - Classification: Control-flow orchestration + Interface extension (new CLI command) touching logging and filesystem.
   - Risk Level: 4 (High). Justification: orchestrates external review commands (`scripts/sync_review.py`, `scripts/reviewEdit.ts`, `scripts/generateReview.ts`), introduces multithreading, writes to logs/JSON; failure could stall review pipeline.
   - Evidence: Analyzer `fan_in/fan_out` shows target scripts currently isolated, minimizing upstream dependencies, but new command will interact with high fan-in modules indirectly (e.g., `logger.ts` if reused). Mission-state DSE highlights high-risk worker coordination and external command execution.
2. **Multi-Dimensional Impact Mapping** (scores 1-10)
   - Technical (8): introduces concurrency, terminal rendering, integration with CLI commands; high implementation complexity.
   - Business/User (6): streamlines review turnaround; failure could block review automation.
   - Security (5): executes existing scripts; minimal new surface but must guard against log/JSON injection.
   - Operational (7): introduces new monitoring/log files; requires operators to manage new CLI.
   - Maintenance (7): adds sizeable script requiring clear structure/tests; concurrency increases maintenance burden.
3. **Stakeholder Cascade Analysis**
   - Direct code consumers: new mediator CLI, worker threads, logging subsystem, spec-defined JSON outputs.
   - System integrators: `npm run review:dispatch/result/create`, `codex exec` via `sync_review.py`, filesystem watchers.
   - End-user impact: review engineers receive live status updates; faster remediation loops.
   - Operations: new per-artifact logs + dashboard behaviours require documentation; must ensure compatibility with automation scripts.
   - Future developers: need modular worker architecture and unit coverage; mission-state coverage checklist enumerates target modules to guide future refactors.
4. **Temporal Ripple Effects**
   - Immediate: TypeScript compile risk (new dependencies), child-process spawning reliability.
   - Short-term: ensures review loop doesn’t bottleneck; poor error handling could leave artifacts stuck.
   - Medium-term: concurrency bugs could introduce technical debt; logging volume manageable but needs rotation plan later.
   - Long-term: mediator could become central orchestrator; architecture should allow extension (e.g., new validation steps) without rewrite.
5. **Context-Aware Validation Plan (Initial)**
   - Evidence to collect: validation logs for dispatch start/completion, result outcomes, remediation loop, JSON ingestion, shutdown path.
   - Tests: future Jest functional tests targeting worker orchestration, spinner render pipeline, JSON error handling (per Testing Plan section).
   - Rollback: revert to manual `review:dispatch/result/create` commands if mediator fails; leave existing scripts untouched to ensure fallback.
   - Monitoring: inspect `<artifact>.log` outputs and potential aggregated metrics once integrated.

## Architectural Context Mapping (Architecture Step 1)
- The Sensei platform follows a componentized front-end architecture orchestrated from `index.tsx`, with curriculum/adaptive logic in `curriculum.ts` and `adaptiveEngine.ts`, as documented in `docs/sensei_teaching_workflow_architecture.md`. High fan-in files (`logger.ts`, `adaptiveEngine.ts`, `curriculum.ts`) indicate centralized state/control flows.
- Existing review automation scripts (`scripts/sync_review.py`, `scripts/reviewEdit.ts`, `scripts/generateReview.ts`) operate as standalone CLI utilities with minimal TypeScript integration. Analyzer fan-in/out metrics show they are largely isolated, enabling compositional extension through a new mediator layer without modifying core teaching modules.
- Architectural pattern: CLI-oriented tooling controlling review lifecycle outside main app; mediator will act as coordinator orchestrating existing commands via worker threads while preserving Sensei's core architecture untouched.

## Guiding Principles (Architecture Step 2)
- **Single Responsibility (SRP)**: Separate dashboard rendering, worker orchestration, and external command adapters into focused modules/functions to simplify testing and future maintenance.
- **Fail-Fast & Explicit Errors**: Propagate external command failures immediately to status/error state to avoid silent hangs.
- **Non-Blocking UI Updates**: Use message queues to decouple worker events from rendering (aligns with responsive UX requirement).
- **Idempotent Logging**: Writing logs should never disrupt worker flow; ensure append-only operations with deterministic prefixes.

## Patterns & Anti-Patterns (Architecture Step 3)
- **Applicable Patterns**:
  - *Worker Pool / Message Passing*: Use Node `worker_threads` with structured messaging to isolate long-running review tasks while keeping main thread responsible for rendering.
  - *Observer/Event Bus*: Central dispatcher collects worker events to update dashboard/logs, mirroring existing CLI event-driven behaviour.
  - *Adapter Pattern*: Wrap existing npm commands (`review:dispatch/result/create`) in adapter functions to normalize spawn handling and error reporting.
- **Anti-Patterns to Avoid**:
  - *God Thread*: main thread should not execute review logic; keep responsibilities partitioned.
  - *Shared Mutable State*: avoid exposing shared objects between workers; use message copies to prevent race conditions.
  - *Busy Waiting*: rely on event-driven updates rather than synchronous polling (except controlled 2s sampling of AI output as required).

## Architectural Approaches (Architecture Step 4)
| Approach | Summary | Maintainability | Performance | Testability | Spec Alignment | Feasibility (0-100) |
|---|---|---|---|---|---|---|
| A. Worker-thread coordinator (message bus) | Implement mediator in Node using `worker_threads`, dedicated adapters for each CLI command, shared status queue for renderer | High – clear separation of worker/main responsibilities | High – true parallelism for I/O-bound processes, low overhead | Medium-High – worker API allows mocking; complexity manageable | Full – matches user preference for worker threads | **92** |
| B. Async event loop only (Promises + `child_process.spawn`) | Keep single thread, orchestrate using async promises and concurrency limits | Medium – simpler concurrency but risks blocking render loop | Medium – relies on event loop, no true parallelism | Medium – easier to test but may require intricate state mgmt | Partial – diverges from worker thread mandate | 68 |
| C. Python asyncio orchestrator invoking Node CLIs | Build new Python script leveraging `asyncio` to call existing npm commands; Node used only for existing CLIs | Low-Medium – mismatched stack, additional maintenance | Medium – good concurrency but cross-language overhead | Low – harder to integrate with existing TS testing | Partial – contradicts worker-thread preference and adds tooling | 41 |

Approach A best satisfies requirements and user mandate while maintaining performance headroom.

## Architectural Blueprint (Architecture Step 5)
- **New / Modified Components**
  - `scripts/review_mediator.ts`: CLI entry point, argument parsing, mission orchestration, dashboard loop, SIGINT handling.
  - `scripts/review_mediator/dashboard.ts`: Double-buffer renderer and log window manager.
  - `scripts/review_mediator/log_manager.ts`: Per-artifact log file controller (`<artifact_basename>.log`) with ring buffer for last five entries.
  - `scripts/review_mediator/command_adapters.ts`: Wrapper functions for `review:dispatch`, `review:result`, `review:create` (spawn child processes, normalize results/events).
  - `scripts/review_mediator/messages.ts`: Shared TypeScript types/enums describing worker ⇄ main thread events and artifact states.
  - `scripts/review_mediator/worker.ts`: Worker-thread implementation executing dispatch/result/remediation loop for a single artifact, including AI streaming and JSON validation.

- **Data Flow Diagram (Textual)**
  1. `review_mediator.ts` parses CLI args → constructs `ArtifactContext` objects (slug, paths) → ensures `/code_review/review_process/` exists and clears `<artifact>.log`.
  2. Main thread initializes dashboard renderer/log manager; registers SIGINT handler setting `shutdownRequested`.
  3. For each artifact, main thread spawns a worker (`worker.ts`) with initial context; stores worker channel in registry.
  4. Worker boot sequence:
     - Sends `status:update` → state `Pending`.
     - Executes `dispatch` adapter → streams stdout/stderr events to main thread (`log:append`, `status:spinner`).
     - On completion, sends `status:update` (`AwaitingReview`) and triggers `result` adapter.
     - If PASS: emits `status:complete` and `log:append`; worker resolves.
     - If FAIL: enters remediation → builds prompt payload → invokes agent via `dispatchAICommand()` helper (wrapping `codex` command defined in spec); every 2s posts `status:aiTick` with latest line.
     - Upon finishing, calls `review:create` adapter; writes JSON via agent; polls filesystem until `/code_review/review_process/<artifact>.json` exists; reads `new_artifact`; on success sends `status:newArtifact` (enqueue new artifact on main thread) else `status:error`.
  5. Main thread event loop receives messages, updates in-memory artifact map, pushes log events to log manager (persist & ring buffer), and re-renders dashboard via double-buffer.
  6. When new artifact arrives, main thread enqueues and spawns additional worker while tracking lineage to original artifact for final completion message.
  7. On SIGINT: main thread sends `control:shutdown` to all workers, waits for confirmations, then exits after final render summarizing termination.

- **API Contract Summary**
  - `parseArgs(argv: string[]): MediatorOptions`
  - `initializeEnvironment(options): MediatorState`
  - `spawnArtifactWorker(state, artifactContext): WorkerHandle`
  - `renderDashboard(state): void`
  - `processWorkerMessage(state, message): void`
  - `handleShutdown(state): Promise<void>`
  - Worker-side exports:
    - `runWorker(workerData: WorkerInitMessage): void`
    - Internal helpers: `runDispatchPhase`, `runResultPhase`, `runRemediationLoop`, `streamAiOutput`, `awaitJsonReport`
  - Command adapter signatures:
    - `runDispatch(filePath: string, onOutput: OutputListener): Promise<DispatchResult>`
    - `runReviewResult(filePath: string): Promise<ReviewOutcome>`
    - `runReviewCreate(slug: string, narrative: string, onOutput: OutputListener): Promise<CreateResult>`
  - Message types defined in `messages.ts` (examples):
    - `StatusUpdateMessage { type: 'status:update'; artifactId; state; spinnerFrame?; text }`
    - `LogAppendMessage { type: 'log:append'; artifactId; threadId; message; timestamp }`
    - `NewArtifactMessage { type: 'status:newArtifact'; originalId; newArtifactPath }`
    - `ErrorMessage { type: 'status:error'; artifactId; errorCode; details }`
    - `ShutdownMessage { type: 'control:shutdown' }`

Architectural blueprint approved. I will now proceed with the Mandatory Principle-Driven Feature Implementation Protocol using Approach A.

## Architectural Checkpoint (Implementation Step 2)
- Architectural Synthesis Protocol completed with approved blueprint (see sections above). Plan proceeds using Approach A worker-thread coordinator with modules outlined.

## Risk & Mitigation Analysis (Implementation Step 4)
1. **Worker/child process leakage** (High risk from DSE). Mitigation: centralized process registry in main thread, ensure every spawn returns handle; send explicit shutdown messages and listen for `exit` events; add validation log `[REVIEW_MEDIATOR] Child process exited` per task plan.
2. **JSON report missing/invalid** (Medium-High). Mitigation: worker enforces strict schema validation; on failure, transition artifact to Error state and surface `[REVIEW_MEDIATOR] JSON validation failed` log to prompt manual intervention.
3. **Dashboard flicker / status desync** (Medium). Mitigation: double-buffer renderer invoked on throttled schedule, all worker updates funnel through serialized queue; include log `[REVIEW_MEDIATOR] Render cycle` for diagnostics during validation.
4. **AI streaming stalls** (Medium). Mitigation: maintain 2-second tick timer with timeout detection; if no new output after threshold, emit warning log `[REVIEW_MEDIATOR] AI stream idle` and continue while allowing operator to intervene.

Open unknowns addressed:
- Agent invocation transport: resolved via adapter wrapping existing `codex` command (consistent with `sync_review.py`).
- Streaming capture mechanism: plan uses incremental stdout buffering with periodic snapshot; validation logs will confirm tick updates.

## Implementation & Validation Plan (Implementation Step 5)
☐ **Task 1**: Scaffold mediator CLI entry (`scripts/review_mediator.ts`) with arg parsing, environment setup, SIGINT handling.
  * *Validation Log*: `logger.info('[REVIEW_MEDIATOR] CLI initialized with artifacts', { artifacts: artifactIds })`
  * *Validation Log*: `logger.info('[REVIEW_MEDIATOR] Shutdown requested')`
  * *Implementation Details*: Build CLI using `yargs`-less manual parsing; initialize global state, ensure `/code_review/review_process/` and log files reset, register signal handlers, bootstrap dashboard loop.

☐ **Task 2**: Implement command adapters for `review:dispatch`, `review:result`, `review:create` in `command_adapters.ts`.
  * *Validation Log*: `logger.info('[REVIEW_MEDIATOR] Dispatch started', { artifact })`
  * *Validation Log*: `logger.info('[REVIEW_MEDIATOR] Dispatch exited', { artifact, code })`
  * *Implementation Details*: Wrap `child_process.spawn` calls, stream stdout/stderr to callbacks, resolve with exit codes and captured output; handle non-zero exit via structured error.

☐ **Task 3**: Build message schema in `messages.ts` for worker/main communication and shared artifact state enums.
  * *Validation Log*: `logger.info('[REVIEW_MEDIATOR] Status update received', { artifact, state })`
  * *Implementation Details*: Define TypeScript types for messages, artifact states (`Pending`, `Dispatching`, `AwaitingReview`, `Remediating`, `Complete`, `Error`), log payload interfaces.

☐ **Task 4**: Implement log manager (`log_manager.ts`) with per-artifact appenders and five-entry ring buffer plus file persistence.
  * *Validation Log*: `logger.info('[REVIEW_MEDIATOR] Log appended', { artifact, message })`
  * *Implementation Details*: Open `<artifact>.log` in append mode, truncate at start, maintain in-memory queue for dashboard display, expose API to retrieve latest entries.

☐ **Task 5**: Create double-buffer dashboard renderer (`dashboard.ts`) supporting spinner frames, AI status line updates, and non-scrolling log window.
  * *Validation Log*: `logger.info('[DashboardRenderer.render] Render cycle completed')`
  * *Implementation Details*: Compose terminal frame string in memory, use ANSI sequences to refresh once per cycle, integrate log manager outputs and per-artifact status text.

☐ **Task 6**: Implement worker thread (`worker.ts`) orchestrating dispatch/result/remediation loop.
  * *Validation Log*: `logger.info('[REVIEW_MEDIATOR] Worker phase transition', { artifact, phase })`
  * *Validation Log*: `logger.info('[REVIEW_MEDIATOR] Review result', { artifact, verdict })`
  * *Implementation Details*: Use `parentPort` messaging; execute dispatch adapter, handle review results, loop remediation on FAIL, manage shared cancellation token.

☐ **Task 7**: Add AI remediation support including 2-second output sampling and JSON validation.
  * *Validation Log*: `logger.info('[REVIEW_MEDIATOR] AI output tick', { artifact, line })`
  * *Validation Log*: `logger.error('[REVIEW_MEDIATOR] JSON validation failed', { artifact })`
  * *Implementation Details*: Spawn Codex agent command, capture stdout incremental buffer, set interval to push latest line, watch for `/code_review/review_process/<artifact>.json`, parse and validate `new_artifact` field.

☐ **Task 8**: Wire main loop event queue and new-artifact requeue logic.
  * *Validation Log*: `logger.info('[REVIEW_MEDIATOR] New artifact queued', { originalArtifact, newArtifact })`
  * *Implementation Details*: Maintain map of original→latest artifacts, spawn additional workers, ensure completion message prints once per original artifact.

☐ **Task 9**: Integrate log removal/cleanup after validation per protocol Step 9.
  * *Validation Log*: `logger.info('[REVIEW_MEDIATOR] Validation cleanup executed')`
  * *Implementation Details*: Provide helper to remove debug logs post-validation, leaving minimal success log.

☐ **Task 10**: Update `package.json` with mediator npm script (e.g., `review:mediate`) and ensure TypeScript config includes new directory.
  * *Validation Log*: `logger.info('[REVIEW_MEDIATOR] CLI entry complete')`
  * *Implementation Details*: Add npm script entry, export compiled entry via `ts-node` path, adjust `tsconfig.json` paths if necessary.

## Functional Test Policy Alignment (Implementation Step 5.5)
- Current scope focuses on core mediator feature; Jest functional tests will be authored in later phase per Testing Plan. Pending tests will:
  - Exercise mediator CLI via production entry (`ts-node scripts/review_mediator.ts`) to honor "exercise real seams".
  - Build scenarios using real review artifacts generated by `review:create`, ensuring authentic data sourcing.
  - Mock only external AI command interface while keeping internal adapters real.
  - Pair success walkthrough (all PASS) with failure path (missing JSON) to satisfy coverage of happy/negative cases.
  - Capture validation logs `[REVIEW_MEDIATOR] ...` via logger spy to verify telemetry contracts.
- Mission state will be updated before test implementation to map each policy rule to concrete test cases per `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md`.

## Implementation Progress (Step 7)
- Scaffolded mediator CLI (`scripts/review_mediator.ts`) with worker orchestration, dashboard rendering loop, SIGINT handling, and validation logs (`[REVIEW_MEDIATOR] CLI initialized with artifacts`, `[REVIEW_MEDIATOR] Shutdown requested`, `[REVIEW_MEDIATOR] CLI entry complete`).
- Added command adapters, message contracts, dashboard renderer, log manager, and worker implementation under `scripts/review_mediator/`, aligning with blueprint modules.
- Worker threads execute dispatch/result/remediation phases, stream AI output ticks every two seconds, enforce JSON validation, and emit structured logs (`[REVIEW_MEDIATOR] Dispatch started`, `[REVIEW_MEDIATOR] Worker phase transition`, `[REVIEW_MEDIATOR] JSON validation failed or timed out`, `[REVIEW_MEDIATOR] Review craft:<path>`).
- Dashboard renders spinner status lines and five-line log window via double-buffer, with render ticks recorded (`[DashboardRenderer.render] Render cycle completed`).
- npm script `review:mediate` registered to launch the mediator entry point.
- Enhanced CLI parser to support `--file <artifact ...>` syntax while retaining positional arguments, matching operator request.
- Added default agent command fallback: when `REVIEW_MEDIATOR_AGENT_CMD` is unset, workers invoke `codex exec --experimental-json --config hide_agent_reasoning=true --model gpt-5-codex --sandbox workspace-write -c approval_policy="never" -c model_reasoning_effort="high"` to mirror the Python dispatcher.
- Updated toolchain so `npm run review:mediate` automatically compiles mediator sources via `tsconfig.review_mediator.json` and runs the emitted CommonJS entry (`dist_review/scripts/review_mediator.js`), removing the need for manual loader flags.

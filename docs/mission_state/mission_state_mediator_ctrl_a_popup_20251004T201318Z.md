# Mission State – Mediator Ctrl+A Artifact Intake (Core Analysis)

## Trigger & Objective
- Protocol: **MANDATORY CORE ANALYSIS PROTOCOL (STEP 0)** triggered ahead of feature work to add Ctrl+A artifact intake, header resizing/scrolling, and log presentation refinements in the mediator dashboard.
- Goal: Ground upcoming implementation affecting mediator UI input flow, tabbed logs, and header layout.

## Current Scope & Entry Points
- Primary entry point: `scripts/review_mediator.ts:33` (`main`).
- Supporting surfaces (selected by analyzer fan-out/calls):
  - `scripts/review_mediator/dashboard.ts` (UI composition, tab management, log rendering).
  - `scripts/review_mediator/log_manager.ts` (log buffering & truncation policy).
  - `scripts/review_mediator/worker.ts` (thread lifecycle, status/log messages).
  - `scripts/review_mediator/messages.ts` (shared message contracts).
- Hot modules (fan-in/out relevance):
  - `scripts/review_mediator.ts` (fan-out 3) – orchestrates workers & renderer.
  - `scripts/review_mediator/dashboard.ts` (fan-in/out 1) – sole renderer but high change surface.
  - `scripts/review_mediator/log_manager.ts` (fan-in/out 1) – truncation limits & persistence.

## Static Execution Trace (summarised)
1. `main` parses CLI artifacts → ensures `review_process` dir → instantiates `LogManager` + `DashboardRenderer`.
2. For each artifact, `spawnWorker` allocates `Worker` (increments `nextThreadId`) → attaches message handlers delegating to `handleWorkerMessage`.
3. `setInterval` drives `render`, which gathers `DashboardSnapshot` via `LogManager.getVisibleLogs` and `statusRecords` map.
4. `DashboardRenderer.render` orchestrates layout: recalculates header, tabs, divider, log viewport → delegates to `buildHeader`, `ensureSelectedTab`, `renderTabs`, `renderLogs`.
5. `renderLogs` filters entries by selected tab, formats via `formatLogEntry`/`formatLogDetails`, applies background styling, updates scroll state (`logScroll`, `logLines`) and invokes `updateLogViewport`.
6. Input handling stems from `DashboardRenderer.initializeScreen` → binds key/mouse handlers via `setupTabInteractions` (`shiftTab`, `scrollLogs`).
7. Worker thread events (`runDispatchPhase`, `reviewLoop`, `runRemediation`) emit `status:*` & `log:append` messages; `handleWorkerMessage` mutates status records, appends logs (filesystem writes), and re-renders.

## Dependency & Side-Effect Table (excerpt)
| Function (file:line) | Key Dependencies | Side Effects & Risk Notes |
| --- | --- | --- |
| `main` (`scripts/review_mediator.ts:33`) | `parseArtifacts`, `fs.mkdir`, `LogManager`, `DashboardRenderer`, worker lifecycle utilities | Writes to filesystem (`fs.mkdir`), manages `process.exitCode`, spawns threads; failure impacts global CLI exit status (High blast if mismanaged).
| `spawnWorker` (`scripts/review_mediator.ts:95`) | Node `Worker`, `artifactKey`, message handlers | Starts worker threads; incorrect reuse of `nextThreadId` could break thread affinity; ensures shutdown messaging.
| `handleWorkerMessage` (`scripts/review_mediator.ts:156`) | `LogManager.append`, `createStatusRecord`, `renderer.render` | Mutates shared `statusRecords` map and writes logs to disk; high-frequency path—must keep JSON parsing/truncation efficient.
| `render` (`scripts/review_mediator.ts:291`) | `LogManager.getVisibleLogs`, `DashboardRenderer.render` | Pure UI update; relies on cached snapshot to avoid flicker.
| `DashboardRenderer.initializeScreen` (`dashboard.ts:367`) | neo-blessed constructors, `setupTabInteractions` | Allocates screen components, binds key/mouse listeners; enabling mouse critical for tabs.
| `DashboardRenderer.render` (`dashboard.ts:182`) | `formatStatuses`, `buildHeader`, `renderTabs`, `renderLogs` | Writes blessed widget positions/heights; mis-sizing impacts layout; header/log height coupling noted.
| `DashboardRenderer.renderTabs` (`dashboard.ts:254`) | `tabLabel`, `style`, `stringWidth`, `stripAnsi` | Maintains `tabZones`; inaccurate widths break mouse hit-tests.
| `DashboardRenderer.renderLogs` (`dashboard.ts:519`) | `formatLogEntry`, `style`, `updateLogViewport` | Updates `logLines`, `logScroll`; ensures separator styling; background highlight limited to parsed text.
| `DashboardRenderer.scrollLogs` (`dashboard.ts:559`) | `updateLogViewport` | Persists `userScrolled`; key for manual scroll vs auto-follow logic.
| `DashboardRenderer.formatLogDetails` (`dashboard.ts:606`) | `JSON.parse`, `normalizeCommand`, `applyBackground` | Parses `command`/`text` payloads; applies cyan/bold command styling + light-green background for parsed text lines.
| `LogManager.resetLog` (`log_manager.ts:23`) | `fs.mkdir`, `fs.writeFile` | Clears log file; High cost (filesystem) but scoped per artifact.
| `LogManager.append` (`log_manager.ts:30`) | `fs.appendFile`, `sanitize` | Enforces 250 char truncation for raw + visible logs; risk: double truncation if upstream not adjusted.
| `worker.runDispatchPhase` (`worker.ts:102`) | `runDispatch`, `postStatus`, `postLog` | Emits `[runDispatchPhase]` logs (pink highlight requirement) and transitions states; depends on command adapters.
| `worker.reviewLoop` (`worker.ts:123`) | `evaluateArtifact`, `runRemediation`, `postStatus` | Iterative loop increments iteration counter, posts `[Iteration N]` lines consumed by dashboard header/log formatting.

## Risk Register (High/Medium)
- **Filesystem operations**: `LogManager.resetLog/append` & `main` `fs.mkdir` – High cost + failure aborts artifact onboarding; ensure retry/backoff when wiring new Ctrl+A flow.
- **Worker thread orchestration**: `spawnWorker` / `handleWorkerMessage` – incorrect thread reuse for newly queued artifacts could leak handles (High blast, Medium likelihood).
- **UI layout calculations**: `DashboardRenderer.render` height math tightly coupled to header/log boxes; adjustments (±4 lines) must retain consistent viewport calculations (Medium risk of clipping/overlap).
- **JSON parsing of logs**: `formatLogDetails` assumes parseable `command`/`text`; upstream truncation must happen post-parse to avoid syntax errors (Medium risk).

## Coverage Checklist (functions to observe/test)
- `scripts/review_mediator.ts::main`, `spawnWorker`, `handleWorkerMessage`, `render`.
- `scripts/review_mediator/dashboard.ts::DashboardRenderer.initializeScreen`, `render`, `buildHeader`, `renderTabs`, `renderLogs`, `scrollLogs`, `formatLogDetails`.
- `scripts/review_mediator/log_manager.ts::append`, `sanitize`.
- `scripts/review_mediator/worker.ts::runDispatchPhase`, `reviewLoop`, `postNewArtifact`.

## Unknowns Register
| Statement & Rationale | Impact | Verification Plan | Owner/ETA |
| --- | --- | --- | --- |
| Need policy for assigning Ctrl+A artifacts to "next available" thread: how to detect idle vs running worker within existing `workerHandles` maps. | High – incorrect routing stalls jobs. | Inspect/extend `workerHandles` lifecycle; simulate idle thread addition after current job completes. | Gene (now) – resolve before implementation.
| Header retains "previously completed" statuses: confirm data source (status map vs new queue). | Medium – UI accuracy. | Trace `statusRecords` cleanup; ensure new artifacts don't overwrite existing keys. | Gene – confirm during design phase.
| Scrollable header requirement: blessed box currently static height; need approach (e.g. `scrollable: true`, `alwaysScroll`). | Medium – layout/regression risk. | Prototype in `DashboardRenderer.initializeScreen` to ensure wheel/keys update header viewport. | Gene – to investigate before coding.
| Popup UX for artifact entry: choose between `prompt` vs custom modal; ensure non-blocking render loop. | Medium – event loop interaction. | Review neo-blessed docs/examples; test with sample input. | Gene – prior to implementation.
| Background highlight limited to parsed text lines only (user request). Confirm we avoid applying to commands/meta separators. | Low – styling nuance. | Audit `formatLogDetails` pipeline after changes. | Gene – during implementation review.

## Key Architectural Insights
- Renderer maintains its own state (`selectedTab`, `logScroll`, `lastSnapshot`); new input flow must update these via existing methods to avoid bypassing re-render logic.
- Tab hit-testing uses `tabZones` with absolute x-coordinates; header height changes must keep `tabBar.top` consistent with layout math.
- `LogManager` truncation currently occurs before JSON parsing in renderer; upstream (worker) should continue sending full payloads for parsing.
- Worker iteration labeling drives `[Iteration N]` markers consumed by `renderDescriptionLine`; header bold/uppercase logic must align with this format.

## Functional Test Traceability Targets
- Prospective automated checks should import `scripts/review_mediator/dashboard.ts` for rendering logic and `scripts/review_mediator/log_manager.ts` for truncation behaviour.
- Integration harness would exercise CLI via `scripts/review_mediator.ts` to cover worker/thread orchestration.

## Next Protocol Recommendation
- Await user go-ahead. Expected follow-up: **MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL** for implementing Ctrl+A popup, header resize/scroll, and thread assignment once authorized.

## Assumptions
- New Ctrl+A popup will feed artifact path(s) identical to CLI `--file` inputs, allowing reuse of `parseArtifacts` / `spawnWorker` utilities.
- Header height increase (-4 log lines) will keep total screen height constant; we will recalculate log viewport accordingly.
- Warp terminal mouse issues persist; rely on keyboard navigation as baseline, mouse optional when terminal supports reporting.

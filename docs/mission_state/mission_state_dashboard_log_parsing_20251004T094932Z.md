# Mission State: Dashboard Log Parsing (2025-10-04)

## Core Analysis Declaration
Core analysis complete. I have mapped the execution trace and identified all dependencies and side effects. I am now ready to proceed with the Comprehensive Impact Analysis Protocol.

## Scope & Entry Points
- scripts/review_mediator.ts: render (line 291) builds the dashboard snapshot and invokes the renderer.
- scripts/review_mediator/log_manager.ts: LogManager.getVisibleLogs (line 40) supplies the rolling debug log strings displayed in the dashboard.
- scripts/review_mediator/dashboard.ts: DashboardRenderer.render (line 15) and DashboardRenderer.buildFrame (line 52) assemble and paint the terminal output, including the debug log block.
- scripts/review_mediator/dashboard.ts: DashboardRenderer.formatStatus/stateLabel/spinner support status rendering and are touched indirectly through buildFrame.

Hot modules for context (from analyzer top fan-in/out): logger.ts, adaptiveEngine.ts, curriculum.ts, ui.ts. None are directly touched by the planned change but inform downstream regression focus on CLI rendering surfaces.

## Static Execution Trace
1. scripts/review_mediator.ts::render builds a DashboardSnapshot from status records and LogManager.getVisibleLogs().
2. scripts/review_mediator/log_manager.ts::getVisibleLogs returns the sanitized rolling log strings (`this.latest`).
3. scripts/review_mediator.ts::render hands the snapshot to DashboardRenderer.render.
4. scripts/review_mediator/dashboard.ts::DashboardRenderer.render hides the cursor if needed, delegates to buildFrame, and writes the frame to stdout.
5. scripts/review_mediator/dashboard.ts::buildFrame sorts statuses, formats each via formatStatus/spinner/stateLabel, then appends the "===== Debug Logs =====" block by iterating snapshot.logs and pushing each string as-is today.

## Dependency & Side-Effect Table
| Function | Dependencies | Side Effects | Risk Notes |
| --- | --- | --- | --- |
| scripts/review_mediator.ts::render | Map of ArtifactStatusRecord (`records`), LogManager.getVisibleLogs, DashboardRenderer.render, module-level `lastRenderLog` | Writes `lastRenderLog`; otherwise pure | Medium risk if snapshot construction changes (affects dashboard refresh cadence).
| scripts/review_mediator/log_manager.ts::LogManager.getVisibleLogs | Internal array `this.latest` populated by append/sanitize | None | Low risk; returns copy to avoid caller mutation.
| scripts/review_mediator/dashboard.ts::DashboardRenderer.render | `process.stdout` (TTY detection, width), this.buildFrame | Hides/shows cursor, writes entire frame to stdout, mutates renderer state (`lastFrame`, `lastLineCount`, etc.) | High visibility: malformed frame or thrown error blanks CLI.
| scripts/review_mediator/dashboard.ts::DashboardRenderer.buildFrame | Snapshot.statuses, this.formatStatus, Snapshot.logs iteration, helper methods spinner/stateLabel | None | Medium risk: incorrect log formatting affects operator visibility; ensure ANSI cleanup preserved.
| scripts/review_mediator/dashboard.ts::DashboardRenderer.formatStatus | spinner(), stateLabel(), status fields | None | Low risk but must preserve semantics when adjusting frame structure.

## Risk Register
- DashboardRenderer.render terminal writes: High blast radius—any exception during log parsing would prevent frame updates. Mitigation: wrap JSON parsing defensively and default to current behavior on failure.
- Debug log formatting change: Medium risk—operators rely on quick scanning. Need confirmation on desired layout for parsed `text`/`command` fields to avoid regressions.

## Coverage Checklist
- scripts/review_mediator.ts::render@10195
- scripts/review_mediator/log_manager.ts::LogManager.getVisibleLogs@1203
- scripts/review_mediator/dashboard.ts::DashboardRenderer.render@447
- scripts/review_mediator/dashboard.ts::DashboardRenderer.buildFrame@1722
- scripts/review_mediator/dashboard.ts::DashboardRenderer.formatStatus@2442 (context verification)

## Unknowns & Verification Plan
- JSON payload boundary: Existing log strings include ISO timestamp and artifact/thread metadata before the message. Need to determine if the JSON object (containing `text`/`command`) is embedded within that string or if logs can be raw JSON. Impact: Medium. Verification: inspect recent mediator log samples or add parsing logic that searches for JSON after metadata while tolerating failures.
- Desired display format: Should parsed logs show both `command` and `text`, or prioritize one? Is ordering important? Impact: Medium. Verification: ask user for formatting expectations before implementation.

## Architectural Insights
- LogManager already truncates entries to 220 characters and strips ANSI codes, so downstream parsing must operate on sanitized text—no raw payload access without LogManager changes.
- DashboardRenderer currently assumes snapshot.logs is an array of plain strings. Introducing structured output implies either inline parsing in buildFrame or upstream adjustment; prefer localized parsing to avoid widening scope.

## Next Protocol
Proceed with Comprehensive Impact Analysis Protocol prior to implementation, followed by Principle-Driven Feature Implementation once impact surface is cleared.

- Functional: When rendering the mediator dashboard, work from the full, pre-sanitized log payload so that `command`, `text`, and `id` can be extracted even when the visible string is truncated. Surface whichever of those fields exist (prioritizing `command` then `text`) alongside the existing timestamp/artifact/thread metadata. Present parsed `command` and `text` values without prepended labels, and when only `command` is available, allow the full command string to pass through without truncation. Fall back to the truncated visible view only if parsing yields no structured fields.
- Non-Functional: Preserve the existing log metadata prefix, avoid regressing render throughput (dashboard refresh runs every event loop tick), and maintain terminal-friendly formatting with sanitized output capped at 220 characters per entry except for the command-only case above.

## Comprehensive Impact Analysis Summary (2025-10-04)
### Change Classification
- Classification: Interface/control-flow refinement within `scripts/review_mediator/dashboard.ts` (fan-in 1 per `tmp/analysis/fan_in.json`).
- Risk Level: 2/5 (low-to-medium) because the change is localized yet directly touches the CLI output loop that operators monitor in real time.

### Multi-Dimensional Impact Scores
- Technical (4/10): Minor logic additions in `buildFrame`; minimal performance impact expected if parsing is guarded and cached metadata preserved.
- Business/User (5/10): Clearer surfacing of agent actions improves operator situational awareness; failure would obscure debugging data.
- Security (2/10): No new I/O; parsing sanitized strings only.
- Operational (6/10): Directly affects on-call workflow; must ensure fallback path always fires to avoid blank lines.
- Maintenance (3/10): Logic stays in one method; ensure code remains readable without comments by isolating parsing helper.

### Stakeholder Cascade
- Direct consumers: `DashboardRenderer.buildFrame` and the terminal operators running `review_mediator` CLI.
- Integrators: `LogManager.append` populates `latest`; no external APIs touched.
- End-user impact: Review leads see clearer intent (`command` vs `text`) without losing metadata.
- Operations: Logging remains in `logs/console_logs.log`; update playbooks to expect structured entries if follow-on automation parses them.
- Developer experience: Future maintainers need a deterministic parsing helper with unit coverage optional but desirable.

### Temporal Ripple Analysis
- Immediate: Ensure TypeScript compilation stays clean and renderer never throws when encountering malformed JSON.
- Short-term: Operators gain clarity during ongoing review sessions; need smoke check against live logs with mixed formats.
- Medium-term: Maintainability improves if helper is reusable; risk of drift if log schema evolves.
- Long-term: Sets precedent for richer CLI dashboards; document approach for future telemetry enhancements.

### Validation Plan
- Manual: Run `npm run review:mediator` (or equivalent entry point) against a fixture directory with mixed JSON/plain logs to confirm dual-field rendering and fallback.
- Automated: Evaluate feasibility of adding unit coverage around a new pure parsing helper; if not, rely on targeted manual scenario while keeping scope tight.
- Regression guard: Re-run `npx tsc --noEmit` and any relevant mediator smoke tests once available.

## Unknowns Update
- Desired display format: Resolved on 2025-10-04 via user clarification—display metadata plus parsed `command` then `text`, with fallback to existing truncation when parsing fails.
- JSON payload boundary: Resolved on 2025-10-04 after validation feedback—the renderer must operate on the original formatted log string before sanitization, because the truncated version loses crucial JSON structure. Implementation will capture both raw and sanitized forms inside `LogManager` and feed the raw payload to the formatter while still falling back to the sanitized string.

## Risk Mitigations (2025-10-04)
1. JSON parse failures throwing during render would freeze dashboard repaint. Mitigation: wrap parsing in a try/catch and default to the original sanitized string when any operation fails.
2. Reconstructed strings might exceed the 220-character cap from `LogManager.sanitize`, producing fragile terminal wrapping. Mitigation: reapply truncation after formatting parsed fields and append an ellipsis when trimming occurs.
3. Payload variants lacking `item`, or numeric identifiers, could surface undefined text or crash concatenation. Mitigation: extract fields through a reusable helper that accepts multiple path candidates, coerces primitives to strings, and only appends non-empty values.
4. Storing both raw and sanitized logs increases memory usage slightly. Mitigation: keep the visible log list capped at five entries (existing behavior) so the additional raw strings remain bounded.

## Implementation & Validation Plan (2025-10-04)
☐ **Task 1**: Extend `LogManager` to retain both the raw formatted log line (pre-sanitization) and the sanitized display string while keeping the rolling buffer capped at five entries. Update `getVisibleLogs()` (and dependent snapshot types) to expose both forms without breaking existing consumers.
  * *Implementation Details*: Replace the `latest` array with structured entries, adjust append/clear code paths, and ensure existing truncation behavior of the visible string remains unchanged.

☐ **Task 2**: Update `DashboardSnapshot`/`DashboardRenderer` to consume the new structured log entries. `formatLogLine` should operate on the raw payload when available, use the sanitized string as fallback, preserve metadata, drop the `command=`/`text=` prefixes, and output the full command string without truncation when no parsed text is present.
  * *Implementation Details*: Adjust type definitions in `messages.ts`, rework the renderer helper to pull from the raw string, remove label prefixes, and conditionally bypass truncation for command-only entries while retaining the ellipsis behavior for other cases.

☐ **Task 3**: Verify behavior manually by running the mediator (or direct harness) against mixed log inputs while observing the rendered output (no validation logs per user exception). Document observations in the final report.
  * *Implementation Details*: Exercise scenarios covering JSON-only lines, timestamp-prefixed JSON, truncated payloads, and non-JSON strings to confirm fallback behavior and identifier extraction.

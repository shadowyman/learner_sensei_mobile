Functional Specification: Review Mediator Script

Purpose
- Automate coordination of code review processing across multiple review artifacts.

Inputs
- One or more review artifact identifiers provided as parameters when the script is executed.

High-Level Workflow
1. Accept the set of review artifact identifiers supplied on invocation.
2. For each artifact, launch a dedicated review-dispatch worker thread that invokes `npm run review:dispatch` in parallel (exactly one worker per artifact; no shared pool).
3. For every active thread, maintain a static terminal output line whose inline status indicator animates with a simple spinner while work is in progress and is updated whenever new development occurs, including transitions such as "Review remarks being addressed," "Complete," descriptions of the most recent AI output, or unexpected error details. Remove the spinner when no work is running for that artifact.
4. When an individual review-dispatch thread finishes, immediately mark its status complete and advance that specific artifact to the evaluation loop while other threads may continue running.
5. Use the show review command (`npm run review:result`) for the completed artifact to determine whether the review passes or needs additional work; update the artifact’s inline status to reflect the latest result or any unexpected command error.
6. If the artifact reports failure states, spawn a remediation worker thread dedicated to that artifact to coordinate AI agent follow-up while other artifacts continue through their own cycles; keep the status line synchronized with each remediation phase.
7. Within each remediation thread:
   a. Prompt the assigned AI agent with the artifact, instructing it to analyze review results using the show review command, address all review comments, and craft a new review request via `npm run review:create -- --feature <slug> --pr_request "<10+ sentence narrative explaining all changes made>"` after implementing fixes (where `<slug>` is derived from the artifact’s original basename and `review:create` automatically versions successive artifacts for the same slug).
   b. Instruct the agent to generate a JSON report containing only the `new_artifact` field and save it at `/code_review/review_process/<artifact_basename>.json` (original artifact filename with `.json` extension replacing `.html`)
   c. After the JSON file is written, the script must immediately read and parse it to confirm the `new_artifact` value. If parsing fails or the JSON is missing the expected field, update the artifact’s status to the Error state with a descriptive message; no automatic retries are attempted because missing JSON is treated as an agent failure.
   d. While remediation is in progress, capture the latest line emitted by the AI agent every two seconds and surface it in the artifact’s status line so operators see ongoing updates.
8. When remediation produces a new artifact, immediately return that artifact to Step 5 for re-evaluation. Continue the loop per artifact until the show review command reports a passing status, at which point print "Review process is complete for <review_artifact_original>" and retain the line in the static output with its final state.

Outputs
- Static terminal dashboard where each artifact occupies a single line whose inline status text is updated in place as stages advance, including error notifications when unexpected issues arise.
- Animated spinner for in-progress tasks paired with textual updates such as "Review remarks being addressed" and the latest AI output snippet for each artifact, removing the spinner when the artifact is idle.
- Inline announcements only show text field of parsed AI json outputs.
- JSON reports stored at `/code_review/review_process/<artifact_basename>.json` documenting the latest review artifact path per artifact.
- Temporary debug logs printed beneath the static status block without causing terminal scroll; display only the five most recent entries while writing the full log to `<artifact_basename>.log`. Logs start clean on script launch.

Artifact State Definitions
- Pending: Artifact accepted as input, awaiting dispatch thread startup.
- Dispatching: Worker thread running `npm run review:dispatch` for the artifact with spinner active.
- Awaiting Review: Dispatch finished; script running `npm run review:result` and monitoring outcomes.
- Remediating: AI agent thread addressing review remarks and producing a new artifact/JSON report.
- Complete: Review loop reported PASS and success message emitted.
- Error: Unexpected command or runtime failure captured (including JSON parsing failure); inline status reflects error details while other artifacts continue.

Command Invocation Details
- Review dispatch is executed via `npm run review:dispatch`, which invokes `python3 scripts/sync_review.py` under the hood.
- Show review status uses `npm run review:result`, routed through `ts-node scripts/reviewEdit.ts result`.
- New review artifacts are crafted with `npm run review:create -- --feature <slug> --pr_request "<10+ sentence narrative explaining all changes made>"`, backed by `ts-node scripts/generateReview.ts`.

Agent Prompt Templates
- Dispatch Follow-up Prompt:
  "You are assisting with code review remediation for <artifact>. Run `npm run review:result -- --file <artifact>` to inspect issues, apply required fixes, and ensure all comments are addressed. When finished, create a fresh review artifact via `npm run review:create -- --feature <slug> --pr_request \"<10+ sentence narrative explaining all changes made>\"` and prepare the JSON summary as described."
- Completion Confirmation Prompt:
  "Output exactly the line `Review has been addressed` once fixes are complete. Provide `Review craft:<new_artifact_path>` on the next line. Save a JSON file at `/code_review/review_process/<artifact_basename>.json` containing `{ \"new_artifact\": \"<new_artifact_path>\" }`, then confirm the path."
- JSON Compliance Reminder:
  "The JSON must contain only `{ \"new_artifact\": \"<path>\" }`. Do not include extra fields."

Non-Functional Requirements
- The script must not impose automatic timeouts; operators may abort manually with `Ctrl+C` if needed.
- Upon receiving `Ctrl+C`, initiate a graceful shutdown that signals all worker threads to terminate, ensuring no dangling tasks remain.

Implementation Considerations
- Worker threads are the chosen concurrency mechanism within the Node/TypeScript ecosystem; they share memory with the main process, enabling low-latency status updates while keeping the orchestration consolidated in a single runtime.
- A Python implementation remains acceptable if it interoperates with the existing toolchain, but it must replicate the worker-thread-style responsiveness using equivalent concurrency constructs (e.g., `asyncio` with thread executors) and adhere to the same status update contract.
- On initialization, the script must ensure the `/code_review/review_process/` directory exists (create it if missing). JSON files remain for inspection; no cleanup policy is currently defined.
- The terminal refresh routine must render the dashboard using a double-buffered approach: build the full screen in memory and emit it in a single update so the five-line log window and status lines remain static without flicker, even while cycling through new log entries.

Diagnostic Logging
- Logs appear beneath the static status block, separated by `=====`. Each entry includes the worker thread ID, associated artifact name, message describing the operation underway, and any relevant transition variables for debugging. Only the five most recent logs are displayed onscreen while the complete log stream is written to `<artifact_basename>.log` and reset at script start.

Testing Plan
- Jest functional tests will be added in a later phase to validate worker-thread orchestration, status rendering (including spinner and AI output updates), JSON parsing, log handling, and graceful shutdown behavior.

Outstanding Clarifications
- None at this time; concurrency strategy, command usage, prompts, state management, logging behaviors, and rendering expectations are confirmed.

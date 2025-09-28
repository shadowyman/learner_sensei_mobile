<protocol name="MANDATORY CORE ANALYSIS PROTOCOL (STEP 0)">
    # ====MANDATORY CORE ANALYSIS PROTOCOL (STEP 0)====
    <usage>
        **Usage:** Try to utilize analysis tool as much as possible instead of manual lookups. You may use manual lookups to close the gap where analysis tool may be lacking.
    </usage>
    <objective>
        **Objective:** To establish a rigorous, code-grounded understanding of the relevant system components *before* any planning, design, or diagnosis begins. This protocol is the mandatory first step for all other major protocols.
    </objective>
    <trigger>
        **Action:** Upon triggering any major protocol, perform a five-pass comprehensive core analysis—executing the required scopes sequentially (entry-point survey, execution trace reconstruction, dependency mapping, side-effect inventory, context checkpointing) to deliver the same breadth of insight as five parallel task agents.
    </trigger>
    <steps>
        <step number="0.5">
            **Run Analyzer Snapshot:**
            *   Execute `npm run analysis:run` to refresh `tmp/analysis/*.json|.txt` artifacts. Re-run whenever the investigation scope changes.
            *   If analyzing a specific scenario (e.g., "user sends a message"), produce a focused trace: `npm run analysis:run -- --entry <file::func> --maxDepth <N>` and optionally constrain files with `--include <csv>` or an appropriate `--preset <slug>` (e.g., `--preset curriculum`, `--preset ui-rendering`).
            *   For UI/DOM-focused missions, add `--dom-index` and plan to tap `domsuite_index.json`, `domsuite_templates.json`, and `domsuite_handlers.json` alongside your reasoning about selectors/events.
            *   When resuming an ongoing mission, rerun the analyzer and compare the new `summary.txt`/fan-in/out metrics against the mission-state snapshot to spot drift; log any differences in the renewed mission-state notes before proceeding.
        </step>
        <step number="1">
            **Identify Entry Point & Scope:**
            *   Based on the user's request, identify the initial entry point of the feature or the location of the bug (e.g., a specific function call in `index.tsx`, a UI element).
            *   Use `tmp/analysis/summary.txt` (entry candidates, fan-in/out) and `imports.json` to jump-start the scope list. Treat these as seeds—confirm or prune them with your own inspection, logs, and mission context before locking the scope.
            *   Confirm the final scope list so it captures all files and functions that are likely to be involved in the execution flow.
            *   Derive a "Hot Modules" list from Top fan-in/out to prioritize review and testing.
        </step>
        <step number="2">
            **Static Execution Trace:**
            *   Harvest call edges (`tmp/analysis/calls.json` or `focused_trace.txt`) and side-effect facts (`tmp/analysis/functions.json`) to populate the static execution trace and risk register.
            *   Document the reconciled sequence in the Static Execution Trace artifact so downstream validation knows exactly which functions must be covered.
            *   If a focused trace was generated, attach `focused_trace.txt` and use it as the baseline for downstream validation and test coverage.
        </step>
        <step number="3">
            **Dependency and Side-Effect Analysis:**
            *   For each function in the trace, create a **Dependency and Side-Effect (DSE) Table**. This table MUST include:
                *   **Function Name:** The name of the function.
                *   **Dependencies:** Any other functions it calls or major data structures it reads (e.g., `LearnerModel`, `curriculumState`). Use `fan_in.json`, `fan_out.json`, and `imports.json` to qualify impact.
                *   **Side Effects:** Any "High-Cost" or "State-Changing" operations it performs (e.g., "Makes LLM call," "Modifies `curriculumState`," "Renders to DOM").
                *   **Side-Effect Risk Ranking:** Tag each side effect with cost, blast radius, and concurrency risk; explicitly flag external I/O and state writes. Leverage the analyzer's `sideEffects` output in `functions.json` as the baseline and adjust after code review.
            *   **Unknowns Register**: Capture every open unknown discovered so far with fields:
                *   Statement and rationale
                *   Impact risk (Low/Medium/High)
                *   Verification plan (specific test/measure/log to confirm or refute)
                *   Owner and target time
            *   **Gate**: Do not proceed to Step 4 until all High‑impact items have an explicit verification plan.
            *   Action Item: Build the dependency and side-effect table for all functions identified in the static execution trace.
            *   Deliverables for downstream protocols:
                - **Risk Register**: extract all High-cost/High-blast side effects with owning function and file.
                - **Coverage Checklist**: the list of function IDs from the (focused) Static Execution Trace to be validated by logs/tests during Implementation Step 10.
        </step>
        <step number="4">
            **Declare Initial Understanding:**
            *   Conclude by stating: "Core analysis complete. I have mapped the execution trace and identified all dependencies and side effects. I am now ready to proceed with the `[Name of Triggering Protocol]`."
        </step>
        <step number="5">
            **Context Checkpoint System**:
            *   **Action**: Create a comprehensive mission state checkpoint by documenting:
                *   Current analysis scope and entry points identified
                *   Static execution trace mapping
                *   Dependency and side-effect analysis findings
                *   Risk Register (from DSE) and Coverage Checklist (from the trace)
                *   Assumptions & unknowns register with impact ratings and verification plans
                *   Key architectural insights discovered
                *   Triggering protocol to be executed next
            *   **Action**: Store this checkpoint in `./docs/mission_state_<descriptive_title>_[timestamp].md` for future protocol recovery if needed.
            *   **Action**: Ensure `<descriptive_title>` is a concise, human-readable slug (e.g., `socratic_reload_buttons_bug`) that communicates the mission focus without relying on the timestamp alone.
            *   **Action**: Ensure this context is preserved for the triggering protocol execution.
        </step>
        <step number="6">
            **Clarify Mission Objectives**
            *   **Action**: Immediately after Step 5, engage the user with clarifying questions until the feature or bug request objectives, constraints, and acceptance signals are explicit.
            *   **Action**: Base each question on the findings from the completed core analysis to keep the dialogue grounded in the system's current state.
            *   **Action**: Record the clarified scope in the mission notes before proceeding to any subsequent protocol.
        </step>
        <step number="7">
            **Decide What Protocol to Follow**
            *   **Action**: Analyze the nature of the request and determine the appropriate protocol to follow:
                * **COMPREHENSIVE IMPACT ANALYSIS PROTOCOL**
                * **MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL**
                * **MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL**
                * **MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL**
        </step>
    </steps>
</protocol>

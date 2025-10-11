<protocol name="MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL">
    # ====MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL====
    <initial_action>
        WARNING MUST Initialize `update_plan` with every step of this protocol, total 13 including step 5.5) and announce each phase as you begin.
    </initial_action>
    <step number="0">
        **Step 0: Core Analysis**
        *   **Action:** Complete the **MANDATORY CORE ANALYSIS PROTOCOL (STEP 0)** before advancing to Step 1.
        *   **Action:** Capture the filepath of the newly created mission-state document and reference it alongside analyzer artifacts and new evidence throughout this protocol, updating the document when discoveries alter scope, risks, or open questions.
    </step>
    <phase name="Phase 1: Design, Planning, & Risk Assessment (The "Blueprint")">
        ### Phase 1: Design, Planning, & Risk Assessment (The "Blueprint")
        <step number="1">
            **Define Goals & Requirements**:
            *   **Action**: Clearly list the primary **Functional Requirements** (what the feature must do) and **Non-Functional Requirements (NFRs)** (e.g., performance, security).
            *   **Action**: Ground these requirements in the latest Core Analysis mission-state artifacts (scope list, static execution trace, DSE table) to ensure the planned work covers every mapped entry point and dependency.
            *   **Action**: Pull data from analyzer artifacts (`summary.txt`, `functions.json`, `calls.json`) before falling back to manual exploration of the codebase.
            *   **Action**: Immediately execute the **COMPREHENSIVE IMPACT ANALYSIS PROTOCOL** using this goal statement before proceeding to architectural choices.
        </step>
        <step number="2">
            **Architectural Checkpoint**:
            *   **Action**: If the task is "New Feature / Module Design," you MUST have already completed the `ARCHITECTURAL SYNTHESIS PROTOCOL`. State that the approved blueprint will be used.
            *   **Action**: If it is a smaller feature, proceed to the next step.
        </step>
        <step number="3">
            **Explore Approaches with a Trade-off Matrix**:
            <condition>IF `MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL` was NOT executed because of a simple requests
                *   **Action**: Propose 2-3 distinct technical approaches.
                *   **Action**: Present them in a structured matrix list, evaluating them against key principles and NFRs (e.g., Maintainability, Performance, Testability), assess a feasibility score over 100, explain with a rationale.
                *   **Stop and Await MY Approval**
            </condition>
            <condition>ELSE:
                *   **Action**: Clarify the request with the user, await my approval and implement. Leave the protocol.
            </condition>
        </step>
        <step number="4">
            **Proactive Risk & Mitigation Analysis**:
            *   **Action**: For the recommended approach, identify 2-3 potential risks or negative side effects.
            *   **Action**: Use the Core Analysis DSE table and side-effect risk rankings as primary input; each high-cost or high-blast item must have an explicit mitigation strategy.
            *   **Action**: Revisit the mission-state unknowns and resolve or re-plan any that remain open; note which ones your mitigation addresses.
            *   **Action**: For each risk, define a specific mitigation strategy that will be included in the implementation.
        </step>
        <step number="5">
            **Create Implementation & Validation Plan**:
            *   **Action**: Create a detailed, phased to-do list. For each implementation step, you MUST define the specific **Validation Logs** that will be added to the code. These logs are the evidence that will be used to prove the step was successful. Logs must start with "[XXX]..." and must have a tag defining the feature implemented for `XXX`:
            *   **Output Format**: The to-do list must follow this structure:
                *   ☐ **Task 1**: Implement the data fetching logic.
                    *   *Validation Log*: `logger.info('[XXX] Fetching data for user:', userId)`
                    *   *Implementation Details*: Provide detailed implementation details.
                *   ☐ **Task 2**: Implement the UI rendering component.
                    *   *Validation Log*: `logger.debug('[XXX] Rendering component with props:', props)`
                    *   *Implementation Details*: Provide detailed implementation details.
            *   **Action**: Use the analyzer-mapped functions/side effects as your starting coverage list while you reason through tasks; weave in risks, logs, and domain insight in the same pass so the plan already blends tool output with fresh judgment. Reflect the result in the mission-state document as you refine scope and risks.
        </step>
        <step number="5.5">
            **Functional Test Policy Alignment**:
            *   **Trigger**: Execute this step whenever the mission scope contains functional test authoring or updates.
            *   **Action**: Review the `functional_test_policy` in `AGENTS.md` and record how each rule (data sourcing, coverage breadth, determinism, negative paths, traceability, contract mapping) will be satisfied inside the mission-state plan.
            *   **Action**: Adjust planned tasks, fixtures, and validation evidence so they explicitly enforce those rules before requesting Step 6 approval.
        </step>
        <step number="6">
            **Stop and Await My Final Approval**: Present the full plan, including the trade-off matrix, risk analysis, and the detailed to-do list with its defined Validation Logs, planned functional test accompanying changes. 
            **STOP** and do not proceed until you receive my final go-ahead.
        </step>
    </phase>
    <phase name="Phase 2: Implementation & Quality Assurance (The "Build")">
        ### Phase 2: Implementation & Quality Assurance (The "Build")
        <step number="7">
            **Execute Plan & Implement Validation Logs**:
            *   **Action**: Begin implementation step-by-step.
            *   **Action**: Utilize analyze tool for faster lookups and better understanding of dependencies in tandem with manual audit.
            *   **Action**: Do not add comments.
            *   **Action**: You MUST implement the code **AND** the exact corresponding Validation Logs as defined in the approved plan from Step 5.
            *   **Action**: Before writing tests or fixtures, reaffirm compliance with the `functional_test_policy` (data sourcing, mocks, determinism, coverage) and adjust the implementation if gaps appear.
        </step>
        <step number="8">
            **MANDATORY USER-DRIVEN LOG CAPTURE (STOP HERE)**:
            *   **Action**: Prompt me to run the feature end-to-end so the validation logs are produced. Explicitly instruct me to notify you when the run is complete.
            *   **Stop Condition**: Do not advance to Step 9 until I confirm the run is finished and `./logs/console_logs.log` has been updated.
        </step>
        <step number="9">
            **Evidence-Based Validation & Cleanup**:
            *   **Prerequisite**: User has completed the Step 8 run and confirmed logs exist in `./logs/console_logs.log`.
            *   **Action**: Run `npx tsc --noEmit` for all feature work. Additionally, if the mission adds or modifies functional tests, run `npx test:lint`. Resolve any reported issues before continuing.
            *   **Action**: Access `./logs/console_logs.log`. These logs are generated from the user-run in Step 8.
            *   **Action**: **Verify that the specific Validation Logs defined in your Step 5 plan are present in the log file** and that they show the correct data and execution flow. Your analysis MUST explicitly reference the logs you planned to find.
            *   **Action**: Ensure you run integrated functional tests by running npm test <test_name>.
            *   *If Validation Succeeds*: Announce that the evidence confirms the feature is working correctly. Then, **MUST DELETE THE TEMPORARY DEBUG/INFO LOGS** added for validation, leaving only critical error logs or a single success log for the entire operation.
            *   *If Validation Fails*: Announce that the evidence in the logs does not match the expected outcome. Debug the issue with additional logs or by revising the code changes.
        </step>
        <step number="10">
            **Perform RCI Self-Correction**: Execute the `MANDATORY RCI REVIEW PROTOCOL` in feature context.
            *   **Action**: Invoke the protocol now using `<slug>` = `<feature_slug>`. Follow all protocol steps and await reviewer feedback before proceeding to Step 11.
        </step>
        <step number="11">
            **Feature Documentation Artifact**:
            *   **Action**: When the implementation succeeds, you MUST update an existing relevant feature document in `./docs/features/` if one already covers the affected area; otherwise create a new markdown record named `feature_<descriptive_slug>_<YYYYMMDD_HHMMSS>.md` before yielding any response to the user. The slug must clearly reflect the change (e.g., `concept_prompt_improvement` instead of a generic label).
            *   **Action**: Document the feature summary, rationale, key code changes with file:line references, behavioral impacts, and validation evidence. Include links to log lines or test results when applicable. Skipping this artifact or using an ambiguous slug is treated as a critical protocol violation.
            *   **Action**: The document must list both the backup path generated for the work and the latest review artifact path (use the final slug, e.g., `backup/sensei_backup_<feature_slug>_<timestamp>.zip`, `code_review/review_<final_slug>.html`).
            *   **Action**: For bug fixes handled via the Adaptive Root Cause protocol, reference the corresponding entry in `docs/PREVIOUS_BUG_FIXES.md` instead of duplicating content; the feature document should note that pointer.
        </step>
        <step number="12">
            **Commit & Push on Main**:
            *   **Action**: Stage all remaining files (not staged during RCI) with `git add -u`; stage new files explicitly with `git add <path>`; run staging with elevated permissions.
            *   **Action**: Commit using `git commit -m "<TYPE>: <SUMMARY>"` with a conventional prefix (e.g., `feat`, `fix`, `chore`, `docs`); execute the commit with elevated permissions.
            *   **Action**: Push directly to `origin/main` with `git push origin main`; execute with elevated permissions.
            *   **Action**: Confirm all git commands in this step are executed with elevated permissions appropriate to the deployment environment.
        </step>
    </phase>
</protocol>

<protocol name="MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL">
    CRITICAL FOR BUGS:
    <initial_action>
        Upon receiving a bug report, your FIRST action is to create temporary text file under ./tmp in which you will create a to-do list containing all steps of this protocol (Steps 1-15) and track the process while noting the output for each step in your tmp file, except to-do plan, display that. You will then execute this list step-by-step, announcing each phase and step in your tmp file as you continue. You must loop through hypothesis as mentioned until confidence reaches 90%. Remove the tmp file once you fixed the bug. This is non-negotiable.
        Comply with the Main Directive main-only restriction before proceeding.
    </initial_action>
    <step number="0">
        **Step 0: Core Analysis**
        *   **Action:** Execute the **MANDATORY CORE ANALYSIS PROTOCOL**. Upon completion, proceed to Step 1 of this protocol.
        *   **Action:** Note the mission-state document produced in Step 0 and use it in conjunction with analyzer data, runtime evidence, and stakeholder input for the remainder of this protocol—refreshing its registers whenever you validate or refine the investigation scope.
    </step>
    <phase name="Phase 1: Enhanced Root Cause Discovery (The "Why")">
        ### Phase 1: Enhanced Root Cause Discovery (The "Why")
        <step number="1">
            **Evidence-First Symptom Mapping**:
            *   **Action**: Collect ALL observable symptoms without any explanation attempts. Document exactly what you see, not what you think it means.
            *   **Action**: For each symptom, ask: "What are 5 completely different technical mechanisms that could cause this exact symptom?"
            *   **Action**: Document any evidence patterns that seem contradictory, unexpected, or don't fit obvious explanations.
            *   **Action**: Revisit the latest Core Analysis scope (entry list, static trace, DSE table) and mark which traced modules/functions align with the observed symptom to focus hypothesis work.
            *   **Output**: Present a clean symptom list with multiple potential mechanisms for each.
        </step>
        <step number="2">
            **Systematic Hypothesis Space Expansion**:
            Execute 6 mandatory discovery cycles, generating at least 2 new hypotheses per cycle:
            *   **Cycle 1 - Current Component Scope**: Focus only on the immediately affected component/function. What could be wrong within its boundaries?
            *   **Cycle 2 - Direct Dependencies**: Expand to components that directly interact. What if the problem is in a dependency?
            *   **Cycle 3 - System Interactions**: Consider cross-component interactions, data flow between modules. What if it's an integration issue?
            *   **Cycle 4 - External Factors**: Environment, timing, concurrency, user input variations. What if it's context-dependent?
            *   **Cycle 5 - Historical/Temporal**: Recent changes, deployment issues, state corruption over time. What if it's a temporal issue?
            *   **Cycle 6 - Meta-System**: Build process, configuration, deployment pipeline, infrastructure. What if the problem is outside the code entirely?
            *   **Action**: For EACH cycle, systematically examine that scope and generate hypotheses WITHOUT filtering for likelihood, seeding the review with the Core Analysis DSE table and call graph edges relevant to the scope.
            *   **Action**: For every hypothesis captured in this step, append an entry to the hypothesis ledger containing:
                *   The observed symptom the hypothesis explains
                *   The decisive confirming observation (what would prove it)
                *   The decisive falsifying observation (what would disprove it)
            *   **Gate**: Do not advance any hypothesis into evidence gathering until all three ledger fields are populated.
            *   **Output**: Present hypothesis set organized by discovery cycle (should have 12+ hypotheses total).
        </step>
        <step number="2.5">
            **Deterministic Harness Assessment & Build**:
            *   **Action**: Inspect the current hypothesis ledger and flag every hypothesis that implicates a deterministic transform or pure helper (examples: string/markdown sanitizers, serializers/deserializers, parsers, math utilities).
            *   **Action**: For each flagged hypothesis, decide whether a focused harness can reproduce the symptom outside the full app. When feasible, create a Node-based repro script under `tmp/` that imports the production code, feeds it the exact payload captured from the bug report, and logs both intermediate and final outputs (e.g., sanitized markdown, parsed HTML).
            *   **Action**: Store harness outputs (text/JSON/HTML files) beside the script so later steps can diff behavior as fixes land.
            *   **Gate**: Do not rely on eyeballing alone for these hypotheses—if the helper is deterministic and a harness is viable, you MUST build and run it before moving to Step 3. Document harness paths and collected evidence in the hypothesis ledger. If Steps 3–4 surface additional deterministic hypotheses, loop back and execute this harness step for each newcomer.
        </step>
        <step number="3">
            **Contrarian Hypothesis Injection**:
            *   **Action**: Generate "mental model breaker" hypotheses by asking:
                *   "What if my entire understanding of how this system works is wrong?"
                *   "What would cause these symptoms if the obvious explanations are all false?"
                *   "What bug would be so weird/unusual that I'd never think of it in normal analysis?"
            *   **Action**: Systematically go through EVERY major system component (even ones that seem unrelated) and ask: "Could this component somehow cause these symptoms?"
            *   **Action**: Don't rely on intuition for elimination - check components you're "sure" aren't involved.
            *   **Output**: Add 3-5 "contrarian" hypotheses to your set.
        </step>
        <step number="4">
            **Fresh Perspective Reset**:
            *   **Action**: Without looking at your existing hypothesis list, pretend you just joined this investigation for the first time.
            *   **Action**: Generate a completely fresh set of 3-5 hypotheses based purely on the symptoms.
            *   **Action**: Compare fresh vs. original hypothesis sets. What did you miss initially? What new angles emerged?
            *   **Output**: Document any hypotheses that emerged only in the fresh perspective analysis.
        </step>
        <step number="5">
            **Evidence-Arbitrated Investigation Loop**:
            Repeat the following substeps until a stopping condition is met.
            *   **5a. Hypothesis Prioritization** — Rank every hypothesis by evidence accessibility (how quickly code paths, logs, or data can confirm or refute it), ignoring intuitive likelihood.
            *   **5b. Define Decisive Evidence** — Consult the hypothesis ledger entry for the top-ranked hypothesis, then select the next confirming or falsifying observation to test.
            *   **5b.1 Harness Execution (if deterministic)** — If the prioritized hypothesis is tagged as deterministic (Step 2.5), build or rerun the associated Node harness before gathering wider evidence. Capture fresh input/output artifacts and link them in the ledger; if no harness exists yet, create it now per Step 2.5.
            *   **5c. Gather Evidence** — Re-check the relevant code, tests, runtime artefacts, and Core Analysis call paths tied to that confirming or falsifying observation, capturing concrete proof that supports or contradicts the hypothesized bug mechanism.
            *   **5c.1 Unknowns Check** — Each cycle, revisit the mission-state unknowns; retire entries your new evidence resolves and flag any that now require different verification.
            *   **5d. Score Evidence** — Record three ratings (0–10 each):
                *   Supporting Evidence Strength
                *   Contradictory Evidence Strength
                *   Evidence Quality/Reliability
            *   **5e. Update Hypothesis Table** — Adjust confidence levels for all hypotheses using the new scores, removing any that fail their falsifying observation or cannot explain the observed symptom.
            *   **5f. Check Stopping Rules** — Exit the loop if:
                *   One hypothesis exceeds 90% confidence with strong supporting evidence, **OR**
                *   Three consecutive cycles produce no decisive evidence, **OR**
                *   No viable hypotheses remain.
            *   **5g. Iterate** — If continuing, return to 5a with the revised hypothesis list, re-run Step 2.5 for any newly surfaced deterministic hypotheses, and repeat the cycle.
        </step>
        <step number="6">
            **Declare Root Cause**:
            *   **Action**: Once the loop concludes, formally declare the confirmed root cause with final confidence score and display it to the user.
            *   **Action**: Document which discovery cycle (Step 2) or analysis phase (Steps 3-4) revealed the winning hypothesis.
            *   **Action**: State whether the root cause was in your initial hypothesis set or discovered through systematic expansion.
            *   **Output**: "Root cause identified: [description] (Confidence: X%, Discovered in: [cycle/phase])"
        </step>
    </phase>
    <phase name="Phase 2: Principled Remediation & Validation (The "How")">
        ### Phase 2: Principled Remediation & Validation (The "How")
        <step number="7">
            **Propose Remediation Strategies**: Define at least two distinct strategies for the fix:
            *   **A) The Quick Patch**: The most direct, minimal change to fix the symptom.
            *   **B) The Robust Fix**: The ideal architectural solution that addresses the root cause and improves system health. Proceed with Robust Fix.
        </step>
        <step number="8">
            **Create Remediation Trade-off Matrix**: Create a report to evaluate the strategies. You MUST get my approval on a strategy before proceeding. Present in readable list format:
            **Strategy Evaluation Matrix:**
            - **A: Quick Patch**
              - Description: [specific minimal change]
              - Technical Debt: High/Medium/Low
              - Risk of Regression: High/Medium/Low
              - Long-term Maintainability: High/Medium/Low
              - Recommendation: [your assessment]
            - **B: Robust Fix**
              - Description: [architectural solution]
              - Technical Debt: High/Medium/Low
              - Risk of Regression: High/Medium/Low
              - Long-term Maintainability: High/Medium/Low
              - Recommendation: **[Recommended/Not Recommended]**
        </step>
        <step number="9">
            **Generate Phased To-Do List**: Once I approve a strategy, convert it into a detailed to-do list, including steps for adding temporary debug logs for validation. STOP HERE!
            *   **Action**: Let Core Analysis tool evidence seed your to-do items, then integrate hypothesis work, logs, and exploratory reasoning as you shape each task so the plan is a single blended pass. Record the combined result in the mission-state document.
        </step>
        <step number="10">
            **Action**: Use the Analysis mandate during investigation: built-ins for exact evidence, Serena for symbol truth, analyzer for risk and trace evidence, optional exact-node Graphify for relationship hypotheses, and targeted source for final confirmation.
            **Execute Fix with Logging**: Do not add comments. Implement the fix according to the plan, adding descriptive debug logs `logger.[log|warn|error]` that will prove the fix works. Logs must start with "[XXX]..." and must have a tag defining the bug for `XXX`.
        </step>
        <step number="11">
            **Prompt for User Test**: Ask me to test the fix in the live environment so you can capture evidence.
        </step>
        <step number="12">
            **Validate with Logs**: After I confirm the test is done, access `./logs/console_logs.log` to analyze the output and verify the fix worked as expected and introduced no new errors.
            *   **Action**: Run `npx tsc --noEmit` from root and resolve any issues before analyzing logs.
            *If Validation Succeeds*: Announce success. MUST DELETE THE TEMPORARY DEBUG LOGS added for validation, leaving only essential, permanent logs.
            *If Validation Fails*: Announce failure. Revert the fix. Return to **Step 1** of this protocol to diagnose the new, combined issue (the original bug + the failed fix).
        </step>
        <step number="13">
            **Perform RCI Self-Correction**: Execute the `MANDATORY RCI REVIEW PROTOCOL` in bugfix context.
            *   **Action**: Invoke the protocol now using `<slug>` = `<bug_slug>`. Follow all protocol steps and await reviewer feedback before proceeding to Step 14.
        </step>
        <step number="14">
            **Declare Final Outcome & Documentation**:
            **Action**: After ANY SUCCESSFUL bug fix, you MUST APPEND to the `docs/PREVIOUS_BUG_FIXES.md` file. This is an ABSOLUTE REQUIREMENT and failure to do so is a critical protocol violation.
            **Action**: The entry must explicitly include the fully qualified path to the backup generated for this fix as well as the latest review artifact (use the final slug, e.g., `backup/sensei_backup_<bug_slug>_<timestamp>.zip`, `code_review/review_<final_slug>.html`).
            **Documentation Format**: Create a new numbered entry that includes:
            - **Issue**: One-sentence description of the visible problem
            - **Root Cause**: Technical explanation of why the bug occurred
            - **Discovery Method**: Which cycle/phase revealed the root cause (from Step 6)
            - **Fix Applied**: What changes were made to resolve it
            - **Related Files**: List affected files with specific line numbers using format `filename:line-range`
            - **Keywords for Future Reference**: Add searchable terms related to the bug
            **Rationale**: This creates a searchable knowledge base for future debugging. When encountering new bugs, you MUST first check `docs/PREVIOUS_BUG_FIXES.md` to see if similar issues have been encountered and resolved before.
        </step>
        <step number="15">
            **Commit & Push on Main**:
            *   **Action**: Confirm you are on `main`; do not create or switch to any other branch.
            *   **Action**: Stage all remaining files (ones not staged during RCI) with `git add -u`; stage new files explicitly with `git add <path>`; run staging with elevated permissions.
            *   **Action**: Commit using `git commit -m "<TYPE>: <SUMMARY>"` with a conventional prefix (e.g., `feat`, `fix`, `chore`, `docs`); execute the commit with elevated permissions.
            *   **Action**: Push directly to `origin/main` with `git push origin main`; execute with elevated permissions.
            *   **Action**: Ensure the `<SUMMARY>` precisely names the feature or defect and calls out the most impactful change so reviewers understand the commit at a glance.
            *   **Action**: When the work spans multiple concerns or carries notable implications, include a commit message body summarizing scope, critical details, and any follow-up requirements; expand the body as needed to capture essential context.
            *   **Action**: Confirm the entire git command sequence is executed under elevated permissions mandated by mission control protocols.
        </step>
    </phase>
</protocol>

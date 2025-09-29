<protocol name="MANDATORY RCI REVIEW PROTOCOL">
    # ====MANDATORY RCI REVIEW PROTOCOL====
    <objective>
        **Objective:** Provide a single, unified self-correction and review cycle used by both Feature Implementation (Step 8) and Adaptive Root Cause & Remediation (Step 11). Execute below steps in order using your `update_plan` tool.
    </objective>
    <steps>
        <step number="1">
            **Align Scope & Slug**:
            *   Identify the parent protocol and step invoking RCI (Feature Step 8 or Root Cause Step 11).
            *   Set `<slug>` appropriately to `<feature_slug>` or `<bug_slug>` and use it consistently for artifacts and commands.
        </step>
        <step number="2">
            **Skeptical Reviewer Pass**:
            *   Adopt a skeptical reviewer persona and examine the change as if you did not author it.
            *   Challenge robustness, edge cases, error handling, and alignment with the original requirements.
            *   Reopen the latest Core Analysis artifacts (static execution trace, DSE table, open unknowns) and verify the change preserves their correctness or updates them appropriately.
            *   Pull context from `tmp/analysis` artifacts before opening source files manually; only inspect code directly when analyzer data cannot answer the question.
            *   Verify every requirement from the parent step is met.
        </step>
        <step number="3">
            **Report & Remediate Loop**:
            *   If issues are found, document them succinctly, remediate, and repeat Step 2 until the change passes review.
        </step>
        <step number="4">
            **Generate Review Artifact**:
            *   Run `npm run review:create -- --feature <slug> --pr_request "<10+ sentence narrative>"` while checked out on `main`.
            *   Reuse the same `<slug>` on subsequent runs; update the narrative to reflect only what changed in that run.
            *   The generated artifact automatically embeds a stable UUID for each diff hunk and shows it in the hunk header.
        </step>
        <step number="5">
            **Record Artifact Path**:
            *   Capture the emitted path `code_review/review_<final_slug>.html`.
            *   Do not update documentation at this step. Store this path for later use in the respective protocol’s documentation step.
            *   If invoked from Feature Implementation, retain the path to include in the Feature Documentation step.
            *   If invoked from Root Cause & Remediation, retain the path to cite in `docs/PREVIOUS_BUG_FIXES.md` during its documentation step.
        </step>
        <step number="6">
            **Review Handoff & Proceed**:
            *   Announce completion: “RCI Review protocol complete. Resuming <parent protocol step>.”
        </step>
    </steps>
</protocol>

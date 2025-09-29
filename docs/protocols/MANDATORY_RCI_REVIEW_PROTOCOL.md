<protocol name="MANDATORY RCI REVIEW PROTOCOL">
    # ====MANDATORY RCI REVIEW PROTOCOL====
    <objective>
        **Objective:** Provide a single, unified self-correction and review cycle used by both Feature Implementation (Step 10) and Adaptive Root Cause & Remediation (Step 13). Execute below steps in order using your `update_plan` tool.
    </objective>
    <steps>
        <step number="1">
            **Align Scope & Slug**:
            *   Identify the parent protocol and step invoking RCI (Feature Step 10 or Root Cause Step 13). You will return to those protocols after successfully finishing this protocol.
            *   Set `<slug>` appropriately to `<feature_slug>` or `<bug_slug>` and use it consistently for artifacts and commands.
        </step>
        <step number="2">
            **Generate Review Artifact**:
            *   Run `npm run review:create -- --feature <slug> --pr_request "<10+ sentence narrative>"` while checked out on `main`.
            *   If re-running after addressing review feedback, ensure the `--pr_request` narrative summarizes only the changes made since the previous review submission.
        </step>
        <step number="3">
            **Dispatch Review & Record Artifact Path**:
            *   Run `npm run review:dispatch -- --file code_review/review_<final_slug>.html` using the artifact generated in Step 2.
            *   Capture the emitted path `code_review/review_<final_slug>.html` and retain it for later documentation steps in the parent protocol.
        </step>
        <step number="4">
            **Review Results & Iterate**:
            *   Run `npm run review:result -- --file code_review/review_<final_slug>.html` to inspect reviewer output.
            *   If the results indicate follow-up actions, carefully validate each concern before changing code. If the agent disagrees with any reviewer feedback, print a console notification for the user and **STOP**, awaiting further guidance.
            *   When alignment is reached on required actions, remediate the code changes, then return to Step 2 and regenerate the artifact—updating `--pr_request` to describe only the new deltas.
            *   If no additional action is requested, continue to Step 5.
        </step>
        <step number="5">
            **Review Handoff & Proceed**:
            *   Announce completion: “RCI Review protocol complete. Resuming <parent protocol step>.”
        </step>
    </steps>
</protocol>

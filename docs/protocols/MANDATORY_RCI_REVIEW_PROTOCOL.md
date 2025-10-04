<protocol name="MANDATORY RCI REVIEW PROTOCOL">
    # ====MANDATORY RCI REVIEW PROTOCOL====
    <objective>
        **Objective:** Provide a single, unified self-correction and review cycle used by both Feature Implementation (Step 10) and Adaptive Root Cause & Remediation (Step 13). Execute below steps in order using your `update_plan` tool.
    </objective>
    <steps>
        <step number="1">
            **Align Scope & Slug**:
            *   Skip IF there are no code changes.
            *   Identify the parent protocol and step invoking RCI (Feature Step 10 or Root Cause Step 13). You will return to those protocols after successfully finishing this protocol.
            *   Set `<slug>` appropriately to `<feature_slug>` or `<bug_slug>` and use it consistently for artifacts and commands.
        </step>
        <step number="2">
            **Generate Review Artifact**:
            *   Ensure all non-documentation file changes are staged before executing the command (exclude files under `docs/`).
            *   Run `npm run review:create -- --feature <slug> --pr_request "<10+ sentence narrative>"` while checked out on `main`.
            *   If re-running after addressing review feedback, ensure the `--pr_request` narrative summarizes only the changes made since the previous review submission.
            *   Capture the emitted path `code_review/review_<final_slug>.html` and retain it for later documentation steps in the parent protocol.
        </step>
        <step number="3">
            **Dispatch Review & Record Artifact Path**:
            *   ASK user to run `npm run review:dispatch -- --file code_review/review_<final_slug>.html` using the artifact generated in Step 2.
        </step>
        <step number="4">
            *   At this stage, system will review your changes and make corrections.
            *   We may proceed with those changes as they are already vetted.
        </step>
        <step number="5">
            **Review Handoff & Proceed**:
            *   Announce completion: “RCI Review protocol complete. Resuming <parent protocol step>.”
        </step>
    </steps>
</protocol>

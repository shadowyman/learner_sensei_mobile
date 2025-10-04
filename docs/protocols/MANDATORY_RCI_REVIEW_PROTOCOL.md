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
            **Prepare Review Manifest**:
            *   Run WITH ELEVATED PERMISSIONS `npm run review:context -- assign --feature <slug> --files <list of changed non-doc files>` while on `main`. This command stages the listed paths and records them in the manifest so parallel work remains isolated. Do NOT include files under `docs/`.
            *   If nothing changed, you do not need to rerun the command; the manifest already reflects the current set. When the list changes, rerun with the complete updated set so the manifest stays accurate. Use `--append` only when you intentionally keep the existing entries and add more files without removing any.
            *   To delete specific files from the slug (without wiping everything), run `npm run review:context -- reset --feature <slug> --files <path1> <path2>` for the paths you want to drop. The command removes those paths and leaves the rest intact; follow up with `assign` only if you need to add or reorder files.
        </step>
        <step number="3">
            **Generate Review Artifact**:
            *   Execute `npm run review:create -- --feature <slug> --pr_request "<10+ sentence narrative>"`. The generator reads the manifest and will abort if required files are missing or unstaged.
            *   Capture the emitted path `code_review/review_<final_slug>.html` and retain it for later documentation steps in the parent protocol.
        </step>
        <step number="4">
            **Dispatch Review & Record Artifact Path**:
            *   ASK user to run `npm run review:mediate -- --file code_review/review_<final_slug>.html` using the artifact generated in Step 3.
        </step>
        <step number="5">
            *   At this stage, system will review your changes and make corrections.
            *   We may proceed with those changes as they are already vetted.
        </step>
        <step number="6">
            **Review Handoff & Proceed**:
            *   Announce completion: “RCI Review protocol complete. Resuming <parent protocol step>.”
        </step>
    </steps>
</protocol>

# Feature: Main Sensei Prompt Restructure

- Updated the dynamic system instruction to open with the new execution directive and to splice in the reorganized curriculum sections (`prompts.ts:363`).
- Rebuilt curriculum focus assembly so every turn now emits the `## Curriculum Focus` through `## SUPPORTING CONTEXT & GUIDANCE FOR YOUR REFERENCE` layout, with IntroIllustrate-specific expansion/formatting and the pedagogical-guidance placeholder (`curriculum.ts:1327`).
- Aligned consolidation prompts with the same hierarchy and separators so remediation flows follow the same structure (`consolidationManager.ts:221`).
- Renamed focus-point headings to `Teaching Points` across chunk templates and moved the check-for-understanding block out of the chunk template so it renders in the new location (`prompts.ts:907`).
- Added the pedagogical-guidance injection point that renders the `**Inputs for your checklist:**` block directly inside the curriculum focus output (`prompts.ts:399`, `curriculum.ts:1434`).

## Validation
- `npx tsc --noEmit`

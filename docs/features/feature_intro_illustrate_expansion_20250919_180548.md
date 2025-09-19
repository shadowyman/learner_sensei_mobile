# Intro Illustrate Expansion

## Summary
- Enhanced Intro/Illustrate prompts to enforce dual-pass explanations, scenario pairing, interview guidance, and reflective steps.
- Added phase-specific directive scaffolding to guarantee richer content without impacting other phases.

## Rationale
- Goal was to double the effective content length by injecting substantive requirements rather than padding.
- Aligns Intro phase outputs with LeetCode-style interview preparation expectations.

## Code Changes
- `curriculum.ts`:1186 added Intro/Illustrate expansion directive in curriculum focus and gated debug logging behind `DEBUG_FLAGS.curriculum_debug`.
- `curriculum.ts`:1120 updated new-content case to emit enhanced chunk prompt when Intro/Illustrate is active.
- `prompts.ts`:820 expanded execution directive with Intro/Illustrate structure checklist.
- `prompts.ts`:884 rewrote `TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE` to support Intro-specific dual-pass structure, scenarios, communication guidance, and reflection.

## Validation
- `npm test` (fails: script intentionally exits with "Error: no test specified").
- Manual inspection confirms new prompt sections; requesting user to run an Intro/Illustrate turn to observe the full structure in practice.

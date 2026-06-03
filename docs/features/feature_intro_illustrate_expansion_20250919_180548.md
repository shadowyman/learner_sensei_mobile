# Intro Illustrate Expansion

## Summary
- Enhanced Intro/Illustrate prompts to enforce dual-pass explanations, scenario pairing, interview guidance, and reflective steps.
- Added phase-specific directive scaffolding to guarantee richer content without impacting other phases.

## Rationale
- Goal was to double the effective content length by injecting substantive requirements rather than padding.
- Aligns Intro phase outputs with LeetCode-style interview preparation expectations.

## Code Changes
- `src/prompts.ts:175-229` defines the current Intro/Illustrate dual-pass structure, application scenarios, interview-oriented perspective, and self-assessment checklist.
- `src/prompts.ts:653-658` keeps the condensed structure summary aligned with those richer requirements.

## Validation
- `npm test` is no longer a placeholder script. The current run fails earlier because Jest cannot resolve `node_modules/agent-base/dist/src/index`, so the original validation note is stale.
- Manual prompt inspection is still the reliable verification path for this document's prompt-structure claims; a live Intro/Illustrate turn is still needed to observe the full structure in practice.

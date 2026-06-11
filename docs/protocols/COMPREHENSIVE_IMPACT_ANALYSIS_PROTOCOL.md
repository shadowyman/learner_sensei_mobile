<protocol name="COMPREHENSIVE IMPACT ANALYSIS PROTOCOL — COMPACT BLAST-RADIUS AND VALIDATION">

<usage>
Use this protocol to define the real change boundary before editing existing production code, identify likely ripple effects, surface risky side effects and external boundaries, choose the right validation targets, and decide whether rollout or recovery guardrails are needed. This protocol is not architecture design, implementation monitoring, org change management, or generic paperwork.
</usage>

<trigger>
Run before non-trivial changes to existing production code when blast radius, shared contracts, side effects, or validation targets are not already obvious. Skip for direct bounded edits such as docs, copy, renames, explicit single-location fixes, isolated config value changes, generated-file refreshes, or other mechanically scoped changes that do not require broader system reasoning.
</trigger>

<steps>

<step number="1" name="Define the exact change boundary">
State the behavior, contract, or invariant being changed. Identify the intended implementation boundary and the specific modules that are in scope. Use targeted built-ins first for strong anchors such as exact files, literals, routes, config keys, UI labels, or log/error text. Use Serena for symbol-shaped discovery, references, source inspection, and precedent. Use analyzer only when dependency, side-effect, blast-radius, or validation evidence is needed.
Output: change summary, chosen boundary, precedent or none found, in-scope modules, out-of-scope modules, unresolved boundary questions.
</step>

<step number="2" name="Map impacted surfaces and consumers">
Identify the direct consumers and likely ripple paths that could observe the change. Focus on callers, callees, shared contracts, generated outputs, tests, bridge layers, API boundaries, storage, and user-visible flows. Prefer targeted analyzer queries over broad artifact reads.
Output: impacted surfaces list, caller/callee map, shared contracts, generated artifacts, likely hidden consumers, blast-radius notes.
</step>

<step number="3" name="Check side effects and boundary risks">
Inspect only the risks that matter for this change: network, storage, bridge transport, DOM or event wiring, prompts, telemetry, async behavior, error handling, compatibility, and migration sequencing. If a risk is not plausible for the scoped change, omit it.
Output: boundary and side-effect summary, compatibility or migration risks, assumptions that must hold, tool gaps or disagreements.
</step>

<step number="4" name="Choose validation and recovery">
Derive the minimum convincing validation plan from the impacted surfaces. Name the exact tests, logs, manual checks, smoke paths, and any rollout or rollback guardrails required to prove the change is safe. Use test impact reasoning when possible instead of blanket validation.
Output: validation checklist, priority test targets, required log or runtime evidence, rollout guardrails if needed, recovery or rollback notes if needed.
</step>

<step number="5" name="Record compact impact summary and handoff">
Create a compact impact record for downstream work. When durable recovery context is needed, update the active mission-state file for the workflow if one already exists. Create a new mission-state file under `docs/mission_state/` only when no active workflow checkpoint exists and durable recovery context is actually needed. Keep the artifact shape consistent whether the analysis leaned on Serena, analyzer, or targeted source inspection.

Mission-state fields:
- Title and timestamp
- Triggering workflow
- Protocol inputs read
- Tool evidence used
- Change summary
- Chosen boundary
- Impacted surfaces and consumer map
- Boundary and side-effect summary
- Risk register
- Unknowns and verification plans
- Validation checklist
- Rollout or recovery notes
- Next protocol or next action

Required statement: “Impact analysis complete. I have mapped the relevant blast radius, boundary risks, and validation targets, and I am ready to proceed with the `[Name of Triggering Protocol or Work Step]`.”
</step>

</steps>

<rules>
Do not run this protocol for every edit by default. Do not use numeric scoring unless another workflow explicitly requires it. Do not expand scope because adjacent files exist. Do not leave high-impact unknowns without verification plans. If the change is already obviously isolated after Step 1, keep the analysis short and stop once the boundary and validation targets are clear. If Serena output is broad, stale, ambiguous, or not symbol-shaped, switch to targeted built-ins, analyzer evidence, or direct source inspection instead of repeating broad Serena calls.
</rules>

</protocol>

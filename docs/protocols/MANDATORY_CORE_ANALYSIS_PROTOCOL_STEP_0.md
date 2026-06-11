<protocol name="MANDATORY CORE ANALYSIS PROTOCOL (STEP 0) — COMPACT TOKEN-EFFICIENT TOOLCHAIN">

<usage>
Mandatory before major workflows. Keep compact. Use the cheapest sufficient evidence path: built-ins for exact anchors, Serena for symbol precision, analyzer for repo-specific risk evidence, and targeted source only for final confirmation. Graphify is optional for exact-node graph-neighborhood snapshots, not default discovery or proof. Do not bulk-read source, Graphify artifacts, or analyzer artifacts.
</usage>

<objective>
Establish enough code-grounded understanding to safely continue into the next protocol without broad file discovery, unnecessary source reading, or large artifact consumption. Completion criteria: relevant files and entry points, precedent or none found, chosen boundary, caller/callee map or trace, impact radius, key risks, unknowns with verification plans, and next protocol.
</objective>

<trigger>
Run for feature work, bug investigation, architecture change, refactor/cleanup, impact analysis, or code review requiring system understanding, unless code-review policy overrides protocol execution. Skip for small informational answers, tiny edits, and low-risk clarifications.
</trigger>

<steps>

<step number="1" name="Discover scope anchor-aware">
Use targeted built-ins for strong anchors such as exact files, literals, routes, config keys, UI labels, or log/error text. Use Serena for symbol-shaped discovery: known-file symbol overview, exact lookup, references, implementations, diagnostics, and targeted source inspection. Use analyzer when impact radius, side effects, DOM/event behavior, dependency evidence, focused trace, or validation targets are not obvious. Graphify may be used only for exact-node graph navigation when a fresh graph exists and the node name is already known; treat `graphify explain`, `path`, or `affected` as relationship hypotheses, not proof.
Output: candidate scope, precedent or none found, chosen boundary, entry points, caller/callee map, impact radius, uncertainties.
</step>

<step number="2" name="Decide analyzer need">
Run analyzer only if the mission needs side effects, assumptions, mutation risk, DOM/event evidence, focused trace, fan-in/out, boundary APIs, hotspots, or protocol-grade risk evidence.
Prefer:
`npm run analysis:run -- --include <scope>`
Known entry:
`npm run analysis:run -- --include <scope> --entry <file::functionPrefix> --maxDepth <N>`
DOM/UI/event: add `--dom-index`.
Broad/unclear/high-risk: start scoped if a safe scope exists; otherwise run `npm run analysis:run`.
Read `docs/tooling/analyzer_reference.md` only when analyzer details are needed.
Output: analyzer needed yes/no; command and rationale if run.
</step>

<step number="3" name="Query artifacts surgically">
If analyzer ran, query only mission-relevant slices. Do not read `brief.md`, `brief.json`, `functions.json`, or `calls.json` end-to-end by default. Use `summary.json` for entry/fan-in/out, `brief.json` for risk/hotspot/boundary/assumption slices, `functions.json` for side effects/locations, `calls.json` or `focused_trace.txt` for trace, `domsuite_*` for DOM/event, and `function_crosswalk.json` for ID mapping. Filter large artifacts first and record the query.
Output: analyzer-confirmed evidence and any tool mismatch.
</step>

<step number="4" name="Confirm source">
Inspect only final relevant source. Prefer Serena for exact symbol lookup, references, diagnostics, and symbol-level source inspection. Use direct file reads only for missing/stale/ambiguous tool output, non-symbol text, high-risk code, tool disagreement, or surrounding context needed to verify guards, mutations, errors, side effects, async behavior, or validation points.
Do not inspect adjacent or nearby files unless the trace, callers/callees, impact radius, analyzer evidence, or tool disagreement requires it.
Output: source-confirmed understanding, surprises, limitations.
</step>

<step number="5" name="Record risks and unknowns">
Create compact Risk Register and Unknowns Register only for mission-relevant items: high-risk functions/files, high-cost/high-blast side effects, unresolved assumptions, tool mismatches, missing runtime evidence, and required tests/logs/harnesses. High-impact unknowns require verification plans before proceeding.
Output: risk register, unknowns register, coverage/validation checklist.
</step>

<step number="6" name="Handoff">
Summarize final scope, boundary, precedent, entry points, trace/caller-callee map, key risks, unknowns, verification plans, and next protocol. Create/update mission state only when downstream work needs durable recovery context. Keep it compact and reference artifact paths/queries instead of pasting large outputs.
When durable recovery context is needed, create/update `docs/mission_state/mission_state_<descriptive_title>_[timestamp].md` using the same artifact shape regardless of tool path. Include: title/timestamp; triggering workflow; protocol inputs read; tool evidence used (built-ins/Serena/analyzer/source and optional Graphify exact-node queries when relevant); scope and entry points; static execution trace or caller/callee map; dependency and side-effect summary; risk register; unknowns register with verification plans; coverage/validation checklist; key architectural insights or boundary decisions; and next protocol.
Required statement: “Core analysis complete. I have established the relevant context using the cheapest sufficient path across built-ins, Serena, analyzer evidence, optional exact-node Graphify where useful, and targeted source inspection. I am ready to proceed with the `[Name of Triggering Protocol]`.”
</step>

</steps>

<rules>
Use progressive disclosure: smallest tool/query/source read that answers the current decision.
Use targeted built-ins first for strong anchors: exact files, literals, routes, config keys, UI labels, and log/error text.
Use Serena for symbol-shaped work: project activation/onboarding, known-file symbol overview, exact symbol lookup, references, diagnostics, semantic source inspection, whole-symbol edits, insertion around symbols, and rename/refactor.
Use analyzer for repo-specific evidence such as side effects, assumptions, mutation risk, DOM/event behavior, fan-in/fan-out, focused traces, boundary APIs, and validation targets.
Graphify is optional exact-node graph navigation only. Do not use it for natural-language discovery, source truth, literals, diagnostics, side-effect evidence, validation proof, or default blast-radius mapping. Verify Graphify-derived hypotheses with Serena, targeted source, analyzer evidence, tests, logs, or runtime output.
If Serena output is broad, stale, ambiguous, or not symbol-shaped, switch to targeted built-ins, analyzer evidence, or direct source inspection instead of repeating broad Serena calls.
Precedent discovery is required before choosing an implementation boundary for reusable or cross-cutting behavior.
Prefer targeted queries over bulk artifact reads.
If tools disagree, inspect source and record the limitation. Do not expand scope because nearby files exist. Do not proceed with High-impact unknowns lacking verification plans.
</rules>

</protocol>

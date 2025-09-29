# Mission State: DOM Suite Empty Artifacts (2025-09-26 13:31:54)

## Scope & Entry Points
- Primary entry: `scripts/analyze.ts:1039` (`main`)
- Supporting functions: `parseArgs`, `collectFunctions`, `analyzeFile`, `emitDomSuiteArtifacts`
- Global stores influencing outcome: `selectorDefinitions`, `selectorUsages`, `templateRecords`, `handlerRecords`, `enableDomIndex`

## Static Execution Trace
1. `main` initializes output dir and parses CLI args (`parseArgs`), registering `opts.domIndex = true` when `--dom-index` is present.
2. `main` resets global selector arrays to empty and sets `enableDomIndex = false` before loading project program (`loadProgram`).
3. First pass: `collectImportGraph(program)` then `collectFunctions(program)` execute while `enableDomIndex` remains `false`. Inside `collectFunctions`, each source file is processed by `gatherFile` and `analyzeFile`, but DOM-capture branches inside `analyzeFile` are skipped because the flag is disabled.
4. `ensurePresetManifest` consumes the first-pass artifacts. Immediately after, `main` clears all global selector arrays again and reinitializes caches (`functionNodeById`, etc.).
5. `applyPresets` mutates CLI options (no-op for bare `--dom-index`) and only after that `main` flips `enableDomIndex = opts.domIndex === true`.
6. Second pass decision: when `opts.include` is undefined (plain `--dom-index` run) the script reuses `fullImportGraph` and `fullFuncs` from the first pass instead of calling `collectFunctions` again. Consequently, no DOM data is gathered post-flag flip.
7. `emitDomSuiteArtifacts` executes with all selector/template/handler arrays still empty, so it writes empty JSON payloads to `tmp/analysis/domsuite_*.json`.
8. When an `--include` list or preset is supplied, the conditional takes the branch that re-executes `collectFunctions(program, opts.include)` after the flag toggle. In that scenario DOM data is captured and emitted correctly (verified via `npm run analysis:run -- --dom-index --include index.tsx`).

## Dependency & Side-Effect Table
- `parseArgs` (`scripts/analyze.ts:132`)
  - Dependencies: CLI argv parsing.
  - Side effects: none (returns `CliOptions`).
- `main` (`scripts/analyze.ts:1039`)
  - Dependencies: `parseArgs`, `loadProgram`, `collectImportGraph`, `collectFunctions`, `ensurePresetManifest`, `applyPresets`, `emitDomSuiteArtifacts`.
  - Side effects: resets global selector arrays, toggles `enableDomIndex`, writes analyzer artifacts (filesystem writes rated High).
- `collectFunctions` (`scripts/analyze.ts:646`)
  - Dependencies: `gatherFile`, `analyzeFile`, `isProjectSource`, `rel`.
  - Side effects: annotates call edges with stable IDs.
- `analyzeFile` (`scripts/analyze.ts:681`)
  - Dependencies: global `enableDomIndex`, helper writers (`addSelectorUsage`, `addTemplateRecord`, `addHandlerRecord`), `analyzeDelegatedHandler`.
  - Side effects: populates `selectorDefinitions`, `selectorUsages`, `templateRecords`, `handlerRecords` when DOM flag true.
- `emitDomSuiteArtifacts` (`scripts/analyze.ts:1004`)
  - Dependencies: global selector/template/handler arrays populated by `analyzeFile`.
  - Side effects: writes `domsuite_index.json`, `domsuite_templates.json`, `domsuite_handlers.json`.

## Risk Register
- R1 (`High`): `enableDomIndex` remains `false` during the only `collectFunctions` run when no `--include` is provided. Result: DOM artifacts are empty, negating the purpose of `--dom-index` default usage.
- R2 (`Medium`): Global selector arrays are cleared twice in `main`; without a second data collection pass, any previously captured DOM metadata is lost before emission.

## Assumptions & Unknowns Register
- A1 (`High` impact): For bare `--dom-index` execution, `opts.include` stays undefined so the second `collectFunctions` branch is never invoked. **Verification**: observed empty DOM artifacts after `npm run analysis:run -- --dom-index`.
- A2 (`Medium` impact): Supplying `--include` (or a preset with include files) forces a second `collectFunctions` run post-flag toggle, restoring expected behavior. **Verification**: `npm run analysis:run -- --dom-index --include index.tsx` produced populated DOM suite JSON files.
- Open question: Determine preferred remediation—moving the `enableDomIndex` toggle before the first `collectFunctions` call versus forcing a second pass when the flag is enabled. Requires stakeholder decision.

## Key Architectural Insights
- The analyzer performs a two-phase build: an unconditional initial pass to build manifests, followed by an optional scoped pass. DOM indexing currently relies on global state mutated inside `analyzeFile`, so any flag gating must be active before the collecting pass.
- Presets mitigate the bug because they populate `opts.include`, causing the second pass to run with DOM indexing active. Manual flag usage without presets skips that second pass, exposing the defect.

## Next Protocol
Core analysis complete. Prepared to proceed with **Root Cause Diagnosis & Remediation Planning** once mission objectives are confirmed with the user.

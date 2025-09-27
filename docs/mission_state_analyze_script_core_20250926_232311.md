# Mission State – analyze_script_core (2025-09-26 23:23:11)

## Scope & Entry Points
- Primary entry: `scripts/analyze.ts::main` (command-line analyzer orchestrator)
- Supporting scope: `ensureDir`, `parseArgs`, `loadPresetSeeds`, `loadProgram`, `collectImportGraph`, `collectFunctions`, `ensurePresetManifest`, `applyPresets`, `computeFanMaps`, `selectEntryCandidates`, `emitDomSuiteArtifacts`, `focusFromEntry` and their internal helpers (`gatherFile`, `analyzeFile`, `scanGlobalExposures`, `generatePreset`).

## Static Execution Trace (Validated Against Source)
1. `main` ensures the analysis output directory, parses CLI flags, loads preset seeds, constructs the TypeScript program, and optionally logs type checker activation.
2. `main` gathers the baseline graphs via `collectImportGraph` and `collectFunctions`, then calls `ensurePresetManifest` which hashes the current graph and regenerates preset metadata when missing or stale.
3. After resetting global caches, `main` applies requested presets (`applyPresets` → `mergeInclude`), recomputes import graphs as needed, derives fan-in/out metrics (`computeFanMaps`), and conditionally re-runs `collectFunctions` for scoped or DOM runs.
4. `main` identifies entry candidates (`selectEntryCandidates`), materializes summary structures, and writes artifacts (imports, fan maps, functions, calls, assumptions, summary, crosswalk).
5. Optional branches: emit DOM selector indices (`emitDomSuiteArtifacts`) when `--dom-index` is active; derive focused traces (`focusFromEntry`) when `--entry` provided; logs artifact paths via `console.log`.
6. Nested analyzer flow: `collectFunctions` iterates project sources (`gatherFile`, `analyzeFile`, `scanGlobalExposures`), building function metadata, call edges, side effects, delegated handler info, and DOM selector records.

## Dependency & Side-Effect Table
| Function | Key Dependencies | Side Effects (cost/blast/concurrency) |
| --- | --- | --- |
| `main` | `ensureDir`, `parseArgs`, `loadPresetSeeds`, `loadProgram`, `collectImportGraph`, `collectFunctions`, `ensurePresetManifest`, `applyPresets`, `computeFanMaps`, `selectEntryCandidates`, `emitDomSuiteArtifacts`, `focusFromEntry`, `fs.writeFileSync`, `console.log` | Multiple global cache resets (Medium/Medium/Medium); extensive artifact writes via `fs.writeFileSync` (High/High/Medium) for summary, imports, fan maps, functions, calls, assumptions, crosswalk, focused outputs. |
| `ensureDir` | Node `fs.mkdirSync` | Creates `tmp/analysis` directory (High/High/Medium). |
| `parseArgs` | Array iteration helpers | Mutates `opts` object fields (Medium/Medium/Medium state writes). |
| `loadPresetSeeds` | Node `fs.existsSync`, `fs.readFileSync`, `JSON.parse` | Reads `config/preset-seeds.json` (High/High/Medium filesystem). |
| `loadProgram` | TypeScript compiler API (`ts.findConfigFile`, `ts.readConfigFile`, `ts.parseJsonConfigFileContent`, `ts.createProgram`) | No direct side effects beyond TypeScript I/O handled by API (treated as Low/Low/Low in practice). |
| `collectImportGraph` | `isProjectSource`, `rel`, per-source visitors, `resolveImport` | Pure graph assembly; no side effects. |
| `collectFunctions` | `isProjectSource`, `rel`, `gatherFile`, `analyzeFile`, `scanGlobalExposures` | Writes call edges’ stable IDs (Medium/Medium/Medium); orchestrates AST traversal. |
| `gatherFile` | `collectAliases`, `functionId`, `stripNonNull` | Maintains local lookup maps; minimal side effects (Medium/Medium/Medium on DOM metadata). |
| `analyzeFile` | Extensive helper network (`collectAliases`, `getLoc`, `mkSideEffect`, `addSelectorUsage`, `addTemplateRecord`, `analyzeDelegatedHandler`, `extractReceiverSelector`, `propertyChain`, etc.) | Registers call edges, side effects, DOM selector metadata, handler records (Medium/Medium/Medium). |
| `scanGlobalExposures` | `unwrap`, `collectAliases`, `resolveImport`, helper closures | Adds edges for globals + records stable IDs (Medium/Medium/Medium). |
| `ensurePresetManifest` | `computeGraphHash`, inline cache check, `regeneratePresetManifest`, `fs.readFileSync`, `fs.writeFileSync`, `console.warn` | Reads/writes `config/presets.generated.json` (High/High/Medium); warns when seeds missing. |
| `computeGraphHash` | Node `crypto.createHash` | Pure hash computation. |
| `regeneratePresetManifest` | `buildFunctionLookups`, `buildDirectedAdjacency`, `generatePreset`, `fs.writeFileSync` | Writes regenerated manifest (High/High/Medium). |
| `generatePreset` | `resolveSeedFunction`, `mergeInclude`, queue traversal, `console.warn` | Mutates include set (Medium/Medium/Medium); warns on limits. |
| `applyPresets` | `mergeInclude`, `console.warn` | Mutates `opts.entry/maxDepth/domIndex` (Medium/Medium/Medium). |
| `computeFanMaps` | None (loop arithmetic) | Pure computation. |
| `selectEntryCandidates` | Array filters/sorts | Pure computation. |
| `emitDomSuiteArtifacts` | Sort helpers, `fs.writeFileSync` | Writes DOM suite JSON artifacts (High/High/Medium). |
| `focusFromEntry` | `buildAdjacency`, BFS helpers | Pure computation; writes focused files upstream via caller.

## Risk Register (High-Cost/Blast Items)
- `main`: Multiple `fs.writeFileSync` invocations writing core analyzer outputs; failure impacts downstream tooling expecting fresh artifacts.
- `ensureDir`: `fs.mkdirSync` on `tmp/analysis`; incorrect path or permissions can abort analysis run.
- `loadPresetSeeds`: File read of preset seeds; malformed JSON or missing file prevents preset regeneration.
- `ensurePresetManifest` / `regeneratePresetManifest`: Regenerates `config/presets.generated.json`; stale or partially written manifest affects preset application.
- `emitDomSuiteArtifacts`: Optional but writes DOM indices consumed by downstream UI analyzers.

## Coverage Checklist (Functions to Validate via Future Tests/Logs)
- `scripts/analyze.ts::main#L1646`
- `scripts/analyze.ts::ensureDir#L220`
- `scripts/analyze.ts::parseArgs#L189`
- `scripts/analyze.ts::loadPresetSeeds#L417`
- `scripts/analyze.ts::loadProgram#L235`
- `scripts/analyze.ts::collectImportGraph#L578`
- `scripts/analyze.ts::collectFunctions#L761`
- `scripts/analyze.ts::gatherFile#L651`
- `scripts/analyze.ts::analyzeFile#L825`
- `scripts/analyze.ts::scanGlobalExposures#L1408`
- `scripts/analyze.ts::ensurePresetManifest#L535`
- `scripts/analyze.ts::regeneratePresetManifest#L521`
- `scripts/analyze.ts::applyPresets#L557`
- `scripts/analyze.ts::computeFanMaps#L614`
- `scripts/analyze.ts::selectEntryCandidates#L1548`
- `scripts/analyze.ts::emitDomSuiteArtifacts#L1611`
- `scripts/analyze.ts::focusFromEntry#L1583`

## Assumptions & Unknowns Register
- Analyzer marked numerous inline helpers (`recordEdgeLocal`, `rec`, `addAnon`) as unresolved externals because they are higher-order parameters; classify as internal closures. Impact Medium; verification: confirm helper closures remain defined within analyzer scope before altering call resolution logic.
- No High-impact unknowns identified; medium items revolve around dynamic callback linkage inside analyzer traversal.

## Key Architectural Insights
- Analyzer operates as a two-pass process: first full snapshot for preset regeneration, second pass respecting CLI filters/DOM options.
- Extensive reliance on TypeScript compiler APIs with caches cleared between passes to avoid stale state.
- File outputs in `tmp/analysis` serve as contract for downstream protocols (RCI, architectural synthesis) and presets manifest under `config/` ties analyzer graph to preset seeds.

## Next Protocol Placeholder
- Awaiting explicit mission objective; no downstream protocol initiated yet. This state snapshot supports whichever protocol the user triggers next.

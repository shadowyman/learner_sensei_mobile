# Mission State: Analyzer Batch1 Core Analysis (2025-09-26 12:02:13)

## Scope & Entry Points
- Objective: Implement Batch 1 analyzer upgrades (DOM selector/HTML index, template schema extraction, selector↔handler binding) in `scripts/analyze.ts` and supporting outputs under `tmp/analysis/`.
- Primary entry point: `scripts/analyze.ts::main` (CLI entry invoked by `npm run analysis:run`).
- Secondary hot spots: `collectImportGraph`, `collectFunctions`, `gatherFile`, `analyzeFile`, `focusFromEntry`.
- External dependencies: TypeScript compiler API, Node.js `fs`/`path` modules.

## Static Execution Trace (from `scripts/analyze.ts::main`)
1. `main` → `ensureDir` (prepare `tmp/analysis/`).
2. `main` → `parseArgs` → `parseArgs__anon1` (CLI parsing).
3. `main` → `loadProgram` (hydrate TS program via `tsconfig`).
4. `main` → `collectImportGraph` → {`isProjectSource`, `rel`, `resolveImport`, inline walkers}.
5. `main` → `computeFanMaps` → `computeFanMaps__anon4`.
6. `main` → `collectFunctions` → {`gatherFile`, `analyzeFile`, helpers}.
7. `main` → `selectEntryCandidates` → inline reducers.
8. `main` → `focusFromEntry` (conditional focused trace) → `buildAdjacency` & BFS helpers.
9. `main` emits artifacts via repeated `fs.writeFileSync` and `console.log`.

## Dependency & Side-Effect Table
| Function | Key Dependencies | Side Effects & Risk | Notes |
| --- | --- | --- | --- |
| `main` | `ensureDir`, `parseArgs`, `loadProgram`, `collectImportGraph`, `computeFanMaps`, `collectFunctions`, `selectEntryCandidates`, `focusFromEntry`, Node `fs` | Multiple `fs.writeFileSync` (cost=High, blast=High, concurrency=Medium); console output (Low/Low/Low) | New Batch 1 features will add more file writes; ensure atomic updates & naming conventions. |
| `collectImportGraph` | `isProjectSource`, `rel`, `resolveImport`, inline visitor callbacks | No external side effects; computes in-memory graph | Must extend to emit selector/template edges without degrading perf. |
| `collectFunctions` | `gatherFile`, `analyzeFile`, `isProjectSource`, `rel` | None external; aggregates arrays | Additional metadata must keep memory in check. |
| `gatherFile` | `rel`, `collectAliases`, `functionId`, inline class/variable scanners | Internal state writes to `locals`, `instanceTypes`, `classFieldInstances` (Medium/Medium/Medium) | Will be expanded to capture template literals & selectors per node. |
| `analyzeFile` | `collectAliases`, `functionId`, `getLoc`, `mkSideEffect`, `stripNonNull`, `isThisExpression`, inline visitors | Appends to `funcs`, `edges`, `assumptions`; existing side-effect tagging `mkSideEffect` (Medium/Medium/Medium) | Batch 1 parsing logic hooks here; must avoid double-counting lambdas. |
| `focusFromEntry` | `buildAdjacency`, BFS helpers | No side effects; reads graph | May consume new DOM/selector nodes in future scenario traces. |

## Risk Register (High-cost / High-blast)
- `main`: File emission expansion could overwrite or grow `tmp/analysis/` unpredictably. Mitigation: namespace new artifacts (`dom_index.json`, `template_schema.json`, `selector_matrix.json`) and gate behind CLI flags.
- `analyzeFile`: Heavier AST traversal for template extraction may increase runtime. Mitigation: profile on large files, short-circuit when literals absent.
- `gatherFile`: Additional captures may retain large strings (templates). Mitigation: enforce size guards and reuse shared references.

## Coverage Checklist (functions to touch or validate)
- `scripts/analyze.ts::main`
- `scripts/analyze.ts::collectImportGraph`
- `scripts/analyze.ts::collectFunctions`
- `scripts/analyze.ts::gatherFile`
- `scripts/analyze.ts::analyzeFile`
- `scripts/analyze.ts::collectAliases`
- `scripts/analyze.ts::resolveImport`
- `scripts/analyze.ts::focusFromEntry`
- Helper factories: `mkSideEffect`, `functionId`, `getLoc`

## Assumptions & Unknowns Register
- `parseInt`, `Boolean` usage for CLI flags: Impact=Medium. Verification: Add unit coverage or runtime guard ensuring NaN handled before new flags.
- Helper closures (`addFunc`, `addAnonFunc`, `recordEdge`, `resolveIdentifier`, `resolveInstanceTarget`, `visit`): Impact=Medium. Verification: When adding Batch 1 hooks, confirm bindings remain valid by snapshotting new IDs via analyzer output.
- File discovery via `fs.existsSync` inside `resolveImport`: Impact=Medium. Verification: After enhancements, run analyzer on Windows + POSIX paths to confirm resolution still succeeds.

## Key Architectural Insights
- Analyzer already centralizes per-function metadata; Batch 1 features should extend existing `FunctionInfo` structures instead of parallel trees.
- Inline visitor pattern is the single choke point for tagging DOM/selector info—augment `analyzeFile` visitor once to feed all new artifacts.
- Output contract must remain deterministic to keep downstream jq recipes stable; version new files cautiously.

## Next Protocol
- Pending user direction post-clarification: proceed to **MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL** or feature implementation planning once core questions are resolved.


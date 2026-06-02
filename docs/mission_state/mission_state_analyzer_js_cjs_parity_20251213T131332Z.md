# Mission State: Analyzer JS/CJS Parity (Manifest-DRY)

Timestamp: 2025-12-13T13:13:32Z

## Mission Objective

Expand `npm run analysis:run` (implemented by `scripts/analyze.ts`) to index CommonJS JavaScript source files (especially `bff/src/**/*.js`) with practical parity to existing TypeScript coverage, while keeping scope DRY and predictable via `src/file-manifest.json`.

Primary user-visible outcome: analyzer artifacts under `tmp/analysis/*` include BFF functions and cross-file edges derived from `require(...)` / `module.exports`, enabling dependency and call-graph reasoning across the full repo stack.

Reference ExecPlan: `docs/execplans/analyzer_js_cjs_parity_execplan.md`.

## Status

Completed on 2025-12-13.

- `scripts/analyze.ts` now includes manifest-listed JS roots, indexes `require(...)` edges, and links CommonJS exports (`module.exports`, `exports.*`) into `functions.json`/`calls.json`.
- Callback identifiers passed as arguments (e.g. `addEventListener(..., handler)`) now resolve via typechecker, so nested handlers appear in `functions.json` with `arg:<name>` edges.
- Analyzer fixtures under `tmp/analyzer-tests/**` are only included when `ANALYZER_INCLUDE_TESTS=1` is set.
- Validation: `npm run functional:analyzer` passes; `npm run analysis:run` produces cross-file edges from `bff/src/server.js` to `bff/src/routes/*.js`.

## Current Scope (Files)

Planned modifications:

- `scripts/analyze.ts` (core analyzer implementation)
- `tests/analyzer.integration.ts` (functional/integration validation for analyzer behavior)

Inputs affected (already updated as prerequisite for DRY coverage):

- `src/file-manifest.json` (project allowlist used by the analyzer’s `isProjectSource`)

Explicitly out of scope (to avoid accidental blast radius):

- `tsconfig.json` (do not widen repo-wide TypeScript project includes to JS)
- BFF runtime behavior (only analyzer indexing behavior changes)

## Analyzer Entry Points & Hot Modules

Entry candidate (from `tmp/analysis/summary.txt`):

- `scripts/analyze.ts` (CLI invoked by `npm run analysis:run`)

Relevant functions (stable IDs from `tmp/analysis/functions.json`):

- `scripts/analyze.ts::main#4419f888ef84`
- `scripts/analyze.ts::loadProgram#d95fb53fa893`
- `scripts/analyze.ts::createTsResolver#acd0b8ced00f`
- `scripts/analyze.ts::isProjectSource#e4c15947c3f9`
- `scripts/analyze.ts::collectImportGraph#4902e73be905`
- `scripts/analyze.ts::collectFunctions#dbb0c9bbfa27`
- `scripts/analyze.ts::gatherFile#ab967420508d`
- `scripts/analyze.ts::collectAliases#72b4e90093e2`
- `scripts/analyze.ts::analyzeFile#1528117a7126`

Hot modules (top fan-in/out in current snapshot) are dominated by app code (`src/*`, `SenseiMobile/*`). This mission’s blast radius is concentrated in the analyzer itself (`scripts/analyze.ts`) because it emits repo-wide artifacts.

## Static Execution Trace (Analyzer Path)

High-level flow for `npm run analysis:run` (from `tmp/analysis/calls.json`):

1) `scripts/analyze.ts::main#4419f888ef84`
2) `scripts/analyze.ts::loadProgram#d95fb53fa893` (build TypeScript `Program`)
3) `scripts/analyze.ts::createTsResolver#acd0b8ced00f` (module resolution to repo-relative paths; skips node_modules and `.d.ts`)
4) `scripts/analyze.ts::collectImportGraph#4902e73be905` (currently ESM-only imports/exports)
5) `scripts/analyze.ts::collectFunctions#dbb0c9bbfa27`
   - calls `scripts/analyze.ts::gatherFile#ab967420508d`
     - calls `scripts/analyze.ts::collectAliases#72b4e90093e2` (currently ESM-only + `import()` destructure)
   - calls `scripts/analyze.ts::analyzeFile#1528117a7126`
     - calls `scripts/analyze.ts::collectAliases#72b4e90093e2`
6) `scripts/analyze.ts::main#4419f888ef84` writes `tmp/analysis/*.json|.txt` artifacts (filesystem side effects)

## Dependency and Side-Effect (DSE) Table

The table below is scoped to the functions that will be modified or whose behavior is directly depended upon by those modifications.

### `scripts/analyze.ts::main#4419f888ef84`

- Dependencies: `loadProgram`, `createTsResolver`, `collectImportGraph`, `collectFunctions`, `computeFanMaps`, artifact emitters
- Side effects: filesystem writes to `tmp/analysis/*` (`fs.writeFileSync`), console output
- Risk: high blast if logic changes produce malformed artifacts or missing edges

### `scripts/analyze.ts::loadProgram#d95fb53fa893`

- Dependencies: TypeScript compiler config parsing
- Side effects: none recorded (but influences what enters the `Program`)
- Risk: broad; if we add the wrong root files we can unintentionally pull in large graphs (perf) or invalid sources (errors)

### `scripts/analyze.ts::isProjectSource#e4c15947c3f9`

- Dependencies: `src/file-manifest.json` allowlist (loaded at module init), `fs.realpathSync`
- Side effects: filesystem reads (`realpathSync`)
- Risk: medium; stricter filtering can silently drop files from analysis; looser filtering can increase scope

### `scripts/analyze.ts::collectImportGraph#4902e73be905`

- Dependencies: `createTsResolver`, TypeScript AST scan
- Side effects: state writes to `graph[file]` (artifact content)
- Risk: medium; adding `require(...)` scanning must remain conservative and fast

### `scripts/analyze.ts::collectAliases#72b4e90093e2`

- Dependencies: `createTsResolver`, AST scan
- Side effects: none recorded (but drives cross-file symbol linkage)
- Risk: medium/high; incorrect alias mapping can create incorrect call edges (false positives)

### `scripts/analyze.ts::gatherFile#ab967420508d`

- Dependencies: `collectAliases`; TypeScript AST scans for function/method nodes; instance type heuristics
- Side effects: none recorded (but populates `functionIndex`, `functionNodeById` maps)
- Risk: medium/high; adding CommonJS export indexing must avoid duplicate IDs and must preserve existing TS behavior

## Risk Register (Initial)

1) Risk: JS roots unintentionally include `bff/node_modules/**` and explode analysis size.
   - Mitigation: do not widen `tsconfig.json`; add JS roots only from `src/file-manifest.json`, and filter out any path containing `/node_modules/`.

2) Risk: Over-eager `require(...)` scanning links dynamic requires incorrectly (false import edges).
   - Mitigation: only treat `require()` when arg0 is a static literal string (or a literal-only template). Ignore non-literals.

3) Risk: CommonJS export indexing creates duplicate functions or unstable names, degrading `stableId` usefulness.
   - Mitigation: reuse existing nodes/IDs when exporting identifiers; only synthesize function nodes for inline arrow/function expressions and object-literal methods, with deterministic names (`default`, `<prop>`).

## Coverage Checklist (What must be validated)

- `loadProgram` includes `bff/src/**/*.js` in the TypeScript `Program` when those files are present in `src/file-manifest.json`.
- `collectImportGraph` records dependencies for `require('./x')` (literal-only) into `imports.json`.
- `collectAliases` recognizes:
  - `const X = require('./x')`
  - `const { foo, bar: baz } = require('./x')`
  - `const foo = require('./x').foo`
- `gatherFile` indexes CommonJS exports so call edges can resolve to:
  - `file::default` for `module.exports = (...) => {}`
  - `file::<name>` for `exports.<name> = (...) => {}` and object-literal export methods
- `analyzeFile` produces at least one real cross-file edge inside BFF (e.g., `bff/src/server.js::startServer` calling `bff/src/routes/sessions.js::default`) once the new indexing is present.

## Assumptions & Unknowns

- Assumption: TypeScript’s parser can parse these BFF CommonJS `.js` sources under `allowJs: true` once they are added as root names.
  - Verification: post-change tests assert BFF functions appear in `tmp/analysis/functions.json`.
- Unknown: whether any BFF JS file relies on syntax not supported by the current TS parser options (unlikely; code appears conventional).
  - Verification: run analyzer after adding JS roots; if parse errors occur, isolate the file and adjust inclusion strategy.

## Triggering Protocol (Next)

Proceed with the **MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL**, using this mission-state file as the Step 0 checkpoint, and execute the **COMPREHENSIVE IMPACT ANALYSIS PROTOCOL** before modifying `scripts/analyze.ts`.

# Analyzer JS/CJS Parity + Manifest-DRY Coverage Expansion

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `docs/protocols/PLAN.md` and the repository protocols in `docs/protocols/*.md`.

## Purpose / Big Picture

After this change, `npm run analysis:run` will index the repository’s JavaScript source files (especially `bff/src/**/*.js`) with the same practical “developer value” as the current TypeScript/TSX coverage:

- `tmp/analysis/functions.json` includes functions/methods found in CommonJS modules.
- `tmp/analysis/imports.json` / `fan_in.json` / `fan_out.json` reflect dependencies expressed via `require(...)` (not just ESM `import`/`export`).
- `tmp/analysis/calls.json` can link common “require + call” patterns across files (so a call in `bff/src/server.js` can resolve to the function exported by `bff/src/routes/sessions.js`, etc.).

The change must be DRY: `src/file-manifest.json` remains the single source of truth for which non-`node_modules` files are in scope for backups and analysis, and we do not widen the TypeScript project (`tsconfig.json`) in a way that accidentally pulls in `bff/node_modules/**` or other unintended sources.

## Progress

- [x] (2025-12-13) Draft and ratify this ExecPlan (scope, acceptance criteria, supported patterns).
- [x] (2025-12-13) Run the required backup before touching analyzer code (`npm run backup:create ...`).
- [x] (2025-12-13) Expand analyzer program roots to include manifest-listed JS sources (without changing `tsconfig.json`).
- [x] (2025-12-13) Add CommonJS `require(...)` support to `imports.json` / fan-in/out graphs.
- [x] (2025-12-13) Add CommonJS `require(...)` alias support so call graph linking works across files.
- [x] (2025-12-13) Index CommonJS exports (`module.exports`, `exports.*`) so “default” and named exports can be linked like ESM exports.
- [x] (2025-12-13) Add/extend analyzer tests for CommonJS (follow `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md`).
- [x] (2025-12-13) Validate on real BFF (`bff/src/server.js`) that `imports.json` and `calls.json` show cross-file edges.

## Surprises & Discoveries

- Observation: `scripts/analyze.ts` currently builds a TypeScript `Program` from root `tsconfig.json` inputs, which only include `*.ts`, `*.tsx`, and `*.d.ts`. As a result, most `.js` files (including BFF) never enter the program and cannot be analyzed.
  Evidence: `tsconfig.json` `include` omits JS; `bff/src/**/*.js` are CommonJS and are not imported from TS.
- Observation: The analyzer’s import graph and alias collection are ESM-centric. They do not currently treat `require('...')` as an import edge, and do not treat `module.exports = (...) => {}` as an exported function node that other files can resolve to.
  Evidence: `scripts/analyze.ts` `collectImportGraph` and `collectAliases` only look for `ImportDeclaration`/`ExportDeclaration` (plus `import()`).

## Decision Log

- Decision: Keep `tsconfig.json` unchanged and make the analyzer DRY by extending `scripts/analyze.ts` to pull JS roots from `src/file-manifest.json`.
  Rationale: A widened `tsconfig.json` can unintentionally pull in `bff/node_modules/**` (or future JS areas) and change editor/typecheck behavior. The manifest is already the canonical allowlist for “in scope” project files, and we want a single source of truth.
  Date/Author: 2025-12-13 / Coding agent.
- Decision: Only include `tmp/analyzer-tests/**` fixture roots when `ANALYZER_INCLUDE_TESTS=1` is set.
  Rationale: Keeps `npm run analysis:run` outputs focused on real repo source while still supporting analyzer integration tests.
  Date/Author: 2025-12-13 / Coding agent.

## Outcomes & Retrospective

- `npm run analysis:run` now indexes `bff/src/**/*.js` and emits `require(...)` import edges and cross-file call edges.
- Analyzer integration tests cover CommonJS require/export patterns and a real BFF smoke check.
- Callback identifier arguments (e.g. `addEventListener(..., handler)`) now resolve via typechecker, so nested in-scope handlers appear in `functions.json` and get `arg:<name>` edges.
- `tmp/analyzer-tests/**` fixtures no longer appear in default analyzer output unless `ANALYZER_INCLUDE_TESTS=1` is set.

## Context and Orientation

This repository has a custom static analyzer at `scripts/analyze.ts`, invoked by `npm run analysis:run` (`package.json`).

Key concepts and files:

- The analyzer builds a TypeScript compiler `Program` in `scripts/analyze.ts::loadProgram` using `tsconfig.json`.
- The analyzer filters which `SourceFile`s are “project source” in `scripts/analyze.ts::isProjectSource`. This function uses `src/file-manifest.json` as an allowlist (plus a `tmp/analyzer-tests/**` exception).
- The analyzer emits artifacts under `tmp/analysis/` (functions, call edges, import graphs, fan-in/out).
- The BFF is in `bff/src/**` and is primarily CommonJS JavaScript (`require`, `module.exports`).

Current limitation to fix:

- Even though the analyzer’s resolver (`createTsResolver`) can resolve `.js` files, `.js` files are mostly absent from the `Program` because the repo’s `tsconfig.json` does not include JS roots. When a file is not in the `Program`, the analyzer never iterates it, so there is nothing to index.

CommonJS patterns in this repo that must be supported:

- Imports:
  - `const X = require('./x')`
  - `const { foo } = require('./x')`
  - `const foo = require('./x').foo`
- Exports:
  - `module.exports = (deps) => { ... }` (default export function)
  - `module.exports = SomeNamedFunction` (default export identifier)
  - `module.exports = { foo: () => {}, bar() {} }` (named exports via object literal)
  - `exports.foo = () => {}` and `module.exports.foo = () => {}`

The analyzer is not expected to “execute JavaScript”. It only needs to statically recognize the common syntactic forms above when the module specifier is a literal string (or a template string with no interpolations).

## Plan of Work

### 0) Confirm the manifest allowlist includes the JS sources you expect to index

This analyzer change is DRY by design: it only adds JS roots that are already present in `src/file-manifest.json`.

Before changing analyzer code, confirm `src/file-manifest.json` lists:

- the BFF JS sources you care about (at minimum `bff/index.js`, `bff/src/server.js`, and all `bff/src/**/*.js` modules that should show up in the analysis graphs),
- any repo automation JS you also want indexed (for example `scripts/installGitHooks.js`, `scripts/sanitize-fences.js`).

If a JS file is not in the manifest, this plan intentionally will not “discover” it automatically.

### 1) Expand analyzer coverage to include manifest-listed JS (DRY)

In `scripts/analyze.ts::loadProgram`, keep the existing `tsconfig.json` parsing, but augment the resulting `parsed.fileNames` with additional absolute paths derived from `src/file-manifest.json` entries that:

- exist on disk,
- have a JS-like extension (`.js`, `.jsx`, `.mjs`, `.cjs`), and
- are not under `node_modules/`.

This makes the TypeScript compiler parse those JS files as `SourceFile`s so the analyzer can process them in the same loop it already uses for TS/TSX.

Important: do not “glob in” `bff/**`; only add JS roots explicitly listed in the manifest so the behavior stays predictable and DRY.

### 2) Add `require(...)` dependency edges to `imports.json` and fan-in/out

In `scripts/analyze.ts::collectImportGraph`, add a second pass that detects `require('<literal>')` calls. For each literal module specifier:

- resolve it with the existing `resolveImport` function,
- if the resolved file is in-scope, add it as a dependency edge.

Keep the existing ESM handling unchanged. This is an additive enhancement.

### 3) Add `require(...)` alias detection (DRY with existing ESM alias pipeline)

In `scripts/analyze.ts::collectAliases`, add support for the CommonJS patterns used in `bff/src/**`:

- `const X = require('<literal>')` maps local `X` to the resolved module’s `default` export.
- `const { foo, bar: baz } = require('<literal>')` maps local `foo` to named export `foo` and local `baz` to named export `bar`.
- `const foo = require('<literal>').foo` maps local `foo` to named export `foo`.

Implementation approach:

- Reuse the existing literal extraction helper (`literalModuleSpecifier` or equivalent) so both ESM and CJS share the same “only literal module specifiers are statically linkable” rule.
- Use the existing `ImportAlias` structure `{ local, source, export }` so downstream logic in `gatherFile` and `analyzeFile` continues to work with minimal branching.

### 4) Index CommonJS exports so other modules can link to them

In `scripts/analyze.ts::gatherFile`, extend the top-level scan to detect common export assignments and register them into the `functionIndex` under stable keys:

- Default export function:
  - `module.exports = (deps) => { ... }` should register a function under `file::default`.
- Default export identifier:
  - `module.exports = someIdentifier` should map `file::default` to the already-registered function id for `someIdentifier` when possible (do not create duplicate function entries).
- Named export assignments:
  - `exports.foo = () => {}` or `module.exports.foo = () => {}` should register a function under `file::foo`.
- Object-literal exports:
  - `module.exports = { foo: () => {}, bar() {} }` should register `file::foo` and `file::bar` similarly, or map them to existing identifiers if the property value is an identifier.

This makes the existing cross-file linking logic work:

- a `require('./routes/sessions')` alias to `default` can resolve to `bff/src/routes/sessions.js::default`,
- a `require('./utils/errorMapper').toWsError` alias can resolve to `bff/src/utils/errorMapper.js::toWsError`.

Non-goals (explicit):

- Support for dynamic `require(x)` where `x` is not statically a string is not required for this repo’s usage.
- Full CommonJS re-export semantics (e.g., `module.exports = require('./x')`) can be treated as “external” unless it is a direct identifier mapping to a known local symbol.

### 5) Tests and acceptance checks

Add integration coverage to `tests/analyzer.integration.ts` (or a new adjacent test file) that creates a small CommonJS mini-project under `tmp/analyzer-tests/cjs/**` and asserts:

- `imports.json` includes an edge from a file with `require('./dep')` to `dep.js`.
- `functions.json` includes a `default` export function indexed from `module.exports = (deps) => { ... }`.
- `calls.json` links a call across files, e.g.:
  - `server.js` requires `routerFactory.js` default and calls it, and the analyzer records an edge to `routerFactory.js::default`.

Follow `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md` while implementing tests.

## Concrete Steps

Run commands from the repository root.

1) Prepare a backup (required before changing analyzer code):

    npm run backup:create -- --feature "analyzer_cjs_parity" --context "Extend scripts/analyze.ts to include manifest-listed JS files and index CommonJS require/module.exports with TS parity."

2) Implement the analyzer changes in `scripts/analyze.ts` following the Plan of Work.

3) Run analyzer and inspect outputs:

    npm run analysis:run
    cat tmp/analysis/summary.txt

4) Run tests:

    npm run functional:analyzer
    npm test --silent --bail --noStackTrace

## Validation and Acceptance

The change is accepted when all of the following are true:

- Running `npm run analysis:run` produces BFF entries in `tmp/analysis/functions.json` (files starting with `bff/src/`).
- Running `npm run analysis:run` produces BFF import edges in `tmp/analysis/imports.json` derived from `require(...)` (not only from ESM).
- Running `npm run analysis:run` produces at least one cross-file call edge from `bff/src/server.js` to a function exported by a required module (for example a `routes/*.js` factory function).
- The new analyzer integration tests pass and are stable (fail before the implementation, pass after).

## Idempotence and Recovery

- `npm run analysis:run` is safe to rerun; it overwrites `tmp/analysis/*`.
- The backup created in the first step is the rollback safety net for `scripts/analyze.ts` changes.
- If parsing a JS file causes an unexpected TypeScript error, first confirm the file is valid JS (not relying on unsupported syntax), then narrow scope by temporarily excluding that file from the manifest-derived roots and reintroduce it after improving parsing support.

## Artifacts and Notes

Useful manual spot-check commands (examples):

    jq -r '.[] | select(.file|startswith("bff/src/")) | .stableId' tmp/analysis/functions.json | head
    jq '.["bff/src/server.js"]' tmp/analysis/imports.json
    jq -r '.[] | select(.fromStable|startswith("bff/src/server.js::")) | [.via,.toStable] | @tsv' tmp/analysis/calls.json | head

## Interfaces and Dependencies

No new runtime dependencies should be introduced. The implementation should reuse:

- TypeScript compiler API already imported in `scripts/analyze.ts`
- existing resolver logic (`createTsResolver`)
- existing literal extraction helpers (`literalText`, `literalModuleSpecifier`)

Any new helper functions added to `scripts/analyze.ts` must be:

- pure (no I/O) unless they are part of `loadProgram` file discovery,
- unit-testable via the existing analyzer integration tests,
- named to reflect their specific CommonJS responsibility (e.g., “extractCjsRequireAliases”, “extractCjsExportAssignments”).

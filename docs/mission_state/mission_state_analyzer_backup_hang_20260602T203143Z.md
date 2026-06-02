# Mission State: Analyzer and Backup Hang

Timestamp: 2026-06-02T20:31:43Z

## Scope

Bug report: `npm run analysis:run` and backup creation hang silently after npm/node_modules reinstall. Earlier symptom included `ERR_INVALID_PACKAGE_CONFIG` from `node_modules/ts-node/package.json`; after reinstalling `ts-node`, the command reaches `ts-node scripts/manifestSync.ts` and appears stalled.

Investigated files and entry points:

- `package.json`: `manifest:sync`, `analysis:run`, `backup:create`
- `scripts/manifestSync.ts`: `main`, `loadGitignoreMatchers`, `walkFiles`, `isIgnoredByGitignore`
- `scripts/analyze.ts`: `main`, `loadProgram`, `createTsResolver`
- `scripts/createBackup.ts`: top-level backup flow
- `src/file-manifest.json`: analyzer root manifest
- `bff/src/controllers/analysisController.js` and `bff/node_modules/zod`: external declaration resolution trigger

## Analyzer Artifact Context

Fresh `npm run analysis:run` could not complete because the requested tool path is the failing path. Existing artifacts in `tmp/analysis` are stale but were reviewed as secondary context.

Stale artifact summary:

- Run type checker: enabled
- Files: 133
- Functions: 2009
- Call edges: 3924
- Script hotspots: `scripts/analyze.ts::main`, `scripts/analyze.ts::loadProgram`, `scripts/manifestSync.ts::main`, `scripts/manifestSync.ts::loadGitignoreMatchers`
- Top fan-out relevant to this issue: `bff/src/container.js`, `bff/src/server.js`

## Runtime Evidence

- `npm run manifest:sync` times out with only the npm banner and no stderr.
- `node node_modules/ts-node/dist/bin.js -e "console.log(4)"` times out before printing.
- `node -r ts-node/register/transpile-only -e "console.log(2)"` loads successfully, but running `scripts/manifestSync.ts` through it takes about 42.5 seconds.
- A pure JS mirror of `manifestSync` completes in about 0.15 seconds.
- A custom TypeScript transpile-only runner completes `scripts/manifestSync.ts` in under 0.5 seconds and `scripts/createBackup.ts` in under 0.5 seconds.
- `ts.createProgram` over the current full manifest roots times out with normal compiler host behavior.
- `ts.createProgram` over a synthetic one-file TS root completes in about 2 seconds.
- `ts.createProgram` over `bff/index.js` hangs unless `noResolve: true` is used.
- `ts.createProgram` over `bff/node_modules/zod/index.d.ts` times out; `bff/node_modules/zod/index.d.cts` is fast.
- A custom compiler host that refuses external package resolution and resolves only in-repo relative modules plus `@sensei/core` builds the full 133-root program in under 1 second.
- `src/file-manifest.json` does not contain generated paths matching `node_modules`, Pods, vendor bundle, Gradle, build output, `.venv`, `.bundle`, or copied ` 2` paths.

## Static Execution Trace

Analysis run:

1. `package.json` script `analysis:run`
2. `npm run manifest:sync`
3. `scripts/manifestSync.ts::main`
4. `loadConfig`
5. `loadGitignoreMatchers`
6. `walkFiles`
7. write `src/file-manifest.json`
8. `scripts/analyze.ts::main`
9. `loadProgram`
10. `ts.createProgram`
11. TypeScript module/declaration resolution
12. `createTsResolver`
13. `collectImportGraph`
14. `collectFunctions`
15. write `tmp/analysis/*`

Backup run:

1. `package.json` script `backup:create`
2. `npm run manifest:sync`
3. `scripts/manifestSync.ts::main`
4. write `src/file-manifest.json`
5. `scripts/createBackup.ts` top-level flow
6. read `src/file-manifest.json`
7. verify entries exist
8. write transient `backup/BACKUP_CONTEXT.md`
9. run `zip`
10. run `unzip -l`
11. remove transient context file

## Dependency and Side-Effect Table

| Function or Flow | Dependencies | Side Effects | Risk |
| --- | --- | --- | --- |
| `manifestSync.main` | `config/file-manifest.roots.json`, root and nested `.gitignore`, `ignore` package | Writes `src/file-manifest.json` | High filesystem blast radius because backup and analyzer both depend on it |
| `loadGitignoreMatchers` | filesystem traversal, `.gitignore` parser | Reads `.gitignore` files | Medium; must not descend generated dependency trees unnecessarily |
| `walkFiles` | matcher list, configured roots | Reads directory tree | Medium; scope correctness affects manifest output |
| `analyze.main` | `loadProgram`, resolver, graph collectors | Writes `tmp/analysis/*` | High; failing here blocks all analysis artifacts |
| `loadProgram` | `tsconfig.json`, manifest roots, TypeScript compiler | Creates TypeScript program | High; current host can resolve external package declarations and hang |
| `createTsResolver` | TypeScript module resolution cache, filesystem realpaths | Reads realpaths for resolved imports | Medium; filters external paths after resolution rather than before program construction |
| `createBackup.ts` top-level | `src/file-manifest.json`, `zip`, `unzip` | Writes backup archive and transient context file | High; depends on manifest and must not include generated files |

## Risk Register

- High: `ts.createProgram` can resolve external declaration files from `node_modules` even though the final analyzer manifest excludes those paths.
- High: package scripts depend on `ts-node`, whose CLI/project startup can be slow or hang before the target script does useful work.
- Medium: `loadGitignoreMatchers` currently treats `extraFiles` parents as recursive scan roots, causing `SenseiMobile/App.tsx` to scan the whole `SenseiMobile` tree during matcher discovery.
- Medium: fixing analyzer resolution must preserve relative in-repo imports and workspace `@sensei/core` resolution.
- Medium: changing script launch strategy affects `analysis:run`, `manifest:sync`, and `backup:create`.

## Unknowns

- Whether TypeScript external declaration resolution hangs only on `bff/node_modules/zod/index.d.ts` or can reappear with other dependencies. Verification: full analyzer run after blocking external resolution.
- Whether a custom local TS runner should be applied only to manifest/analyzer/backup scripts or more broadly to all repo TS utility scripts. Verification: test affected scripts first and avoid broad churn unless necessary.
- Whether current dirty workspace changes from other agents affect `package.json` and `tsconfig.json`. Verification: inspect diff before editing and preserve unrelated changes.

## Coverage Checklist

- `npm run manifest:sync` must complete quickly and write a clean `src/file-manifest.json`.
- `npm run analysis:run` must complete and produce `tmp/analysis/brief.md`, `functions.json`, and `imports.json`.
- `npm run backup:create -- --feature "<slug>" --context "<context>"` must complete and create a zip whose file list is manifest-backed.
- Manifest must exclude `node_modules`, Pods, vendor bundle, Gradle, build outputs, `.venv`, `.bundle`, and copied ` 2` paths.
- Analyzer outputs must not include ignored/generated paths.

## Triggering Protocol

Proceed to `MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL`.

# Mission State: Backup Manifest Expansion

Timestamp: 2026-06-03T18:24:41Z

## Scope

Feature request: expand backup coverage while keeping analyzer coverage unchanged.

Affected entry points:
- `package.json` script `manifest:sync`
- `package.json` script `analysis:run`
- `package.json` script `backup:create`
- `scripts/manifestSync.ts`
- `scripts/createBackup.ts`
- `config/file-manifest.roots.json`
- new backup-only config and manifest files

Analyzer artifacts reviewed:
- `tmp/analysis/brief.md`
- `tmp/analysis/brief.json`
- `tmp/analysis/summary.txt`
- `tmp/analysis/imports.json`
- `tmp/analysis/functions.json`

Analyzer snapshot: full repo, TypeChecker enabled, 140 current source manifest entries.

## Static Execution Trace

Current source/analyzer path:
1. `npm run analysis:run`
2. `npm run manifest:sync`
3. `node scripts/runTs.cjs scripts/manifestSync.ts`
4. `scripts/manifestSync.ts::main`
5. writes `src/file-manifest.json`
6. `scripts/analyze.ts` reads `src/file-manifest.json`

Current backup path:
1. `npm run backup:create`
2. `npm run manifest:sync`
3. `node scripts/runTs.cjs scripts/manifestSync.ts`
4. writes `src/file-manifest.json`
5. `node scripts/runTs.cjs scripts/createBackup.ts`
6. `scripts/createBackup.ts` reads `src/file-manifest.json`
7. writes temporary `backup/BACKUP_CONTEXT.md`
8. runs `zip`
9. runs `unzip -l`
10. deletes temporary context file

Target backup path:
1. `npm run backup:create`
2. source manifest sync remains unchanged
3. backup manifest sync uses backup-only config and output
4. `scripts/createBackup.ts` reads `src/backup-file-manifest.json`
5. archive verification rejects outside-manifest and hard-excluded entries

## Dependency And Side Effects

| Function or block | Dependencies | Side effects | Risk |
| --- | --- | --- | --- |
| `manifestSync.ts::loadConfig` | repo root, config path, JSON parser | reads config from filesystem | Medium: wrong default would break analyzer and backup |
| `manifestSync.ts::loadGitignoreMatchers` | config roots, extra files, `.gitignore`, ignore package | reads directories and ignore files | Medium: ignore semantics can exclude required restore anchors |
| `manifestSync.ts::walkFiles` | roots, ignore dir names, gitignore matchers | recursive filesystem reads | Medium: broad roots can pick up generated or local files if excludes fail |
| `manifestSync.ts::main` | config, extensions, roots, extra files | validates paths, writes manifest file | High: output path must split analyzer and backup correctly |
| `createBackup.ts` top-level execution | CLI args, manifest JSON, `zip`, `unzip` | writes context file, creates zip, deletes context file | High: archive safety depends on manifest resolution and verification |
| `package.json` scripts | npm lifecycle, `runTs.cjs` | orchestrates command order | Medium: command ordering must preserve analyzer behavior |

## Risk Register

- High: expanding `src/file-manifest.json` would accidentally widen analyzer coverage. Mitigation: backup-only manifest and config.
- High: backup archive could include generated, local, or secret files. Mitigation: hard excludes plus post-zip verification.
- Medium: explicit config files under ignored `/config/` could be skipped by gitignore matching. Mitigation: support explicit include semantics for backup config files.
- Medium: missing optional future files such as `SenseiMobile/react-native.config.js` should not break backup creation now. Mitigation: do not list missing files as required explicit files.
- Low: broad docs coverage could increase archive size. Mitigation: exclude generated review artifacts and backup/tmp/log output.

## Coverage Checklist

- Preserve current `npm run analysis:run` and `src/file-manifest.json` behavior.
- Generate `src/backup-file-manifest.json` from `config/backup-manifest.roots.json`.
- Read backup manifest in `scripts/createBackup.ts`.
- Include current source roots, tests, mocks, docs, package metadata, mobile configs, iOS resources, Android Gradle/app source.
- Exclude dependency folders, generated output, local env, logs, review artifacts, Xcode user state, and signing material.
- Verify archive entries against backup manifest and hard excludes.

## Assumptions And Unknowns

- Assumption: user approval in the implementation request is final approval for Feature Protocol Step 6.
- Assumption: validation logs for this CLI feature should be console status output rather than persistent runtime app logs.
- Assumption: `SenseiMobile/ios/.xcode.env` is portable enough to include; `.xcode.env.local` is not.
- Unknown: exact generated backup manifest size after implementation. Verification plan: run backup manifest sync and inspect counts.
- Unknown: whether existing tests cover script CLIs sufficiently. Verification plan: run analyzer, backup create, and focused root Jest if practical.

## Triggering Protocols

Next protocols:
- Comprehensive Impact Analysis Protocol
- Mandatory Principle-Driven Feature Implementation Protocol
- Mandatory RCI Review Protocol during Feature Step 10
- Test Implementation Protocol if tests are added or modified

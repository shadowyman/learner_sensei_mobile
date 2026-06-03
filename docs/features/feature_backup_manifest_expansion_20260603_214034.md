# Feature: Backup Manifest Expansion

## Summary

Backup creation now uses a backup-only manifest so restore coverage can be broader than analyzer coverage. Analyzer runs still refresh and consume `src/file-manifest.json`, while backups generate and consume `src/backup-file-manifest.json`.

## Rationale

The previous backup flow used the same source manifest as the analyzer, which made broader restore coverage risky. Adding docs, tests, package metadata, native mobile project files, and assets to that shared manifest could widen analyzer input or alter analyzer behavior. The split-manifest flow keeps analyzer scope stable while allowing backups to cover restore-critical project state.

## Key Changes

- `scripts/manifestSync.ts` now accepts `--config` and `--out` while keeping defaults for the existing source manifest flow.
- `config/backup-manifest.roots.json` defines backup-only roots, force-included restore anchors, extensions, and hard excludes.
- `package.json` runs source manifest sync, then backup manifest sync, then backup archive creation for `backup:create`.
- `scripts/createBackup.ts` reads `src/backup-file-manifest.json`, verifies zip entries against the manifest, permits only `backup/BACKUP_CONTEXT.md` as an extra archive entry, rejects hard-excluded paths, and checks required restore anchors.
- `.gitignore` narrowly unignores `config/backup-manifest.roots.json` so the backup config can be tracked without surfacing unrelated local config files.
- `tests/analyzer.integration.ts` covers custom manifest config/output generation, `.d.ts` inclusion, force-included extensionless files, and exclusion behavior.

## Behavioral Impact

- `npm run analysis:run` remains source/analyzer-oriented and generated `src/file-manifest.json` with 140 entries during validation.
- `npm run backup:create` generated `src/backup-file-manifest.json` with 537 entries and created an archive with 538 entries including `backup/BACKUP_CONTEXT.md`.
- Sample audit confirmed backup coverage includes tests, mocks, docs, package/config files, React Native assets/source, iOS project/resources, and Android Gradle/app source.
- Sample audit confirmed excluded paths were not archived: dependency folders, `tmp`, generated build output, logs, review artifacts, WebView bundle output, Pods, local env files, Xcode user state, and signing material.

## Validation Evidence

- Passed: `npm run analysis:run`
- Passed: `node scripts/runTs.cjs scripts/manifestSync.ts --config config/backup-manifest.roots.json --out src/backup-file-manifest.json`
- Passed: `npm run backup:create -- --feature "backup_manifest_expansion_validation" --context "..."`
- Passed: `node scripts/runTs.cjs scripts/createBackup.ts --feature backup_manifest_direct_create --context "..."`
- Passed: `npm run functional:analyzer`
- Passed sample audit: `backup/sensei_backup_backup_manifest_sample_audit_20260603_213740.zip`
- Failed with pre-existing unrelated repo-wide issues: `npx tsc --noEmit`
- Failed with pre-existing unrelated repo-wide issues: `npm run test:lint`

## Artifacts

- Pre-change backup: `backup/sensei_backup_backup_manifest_expansion_20260603_212556.zip`
- Validation backup: `backup/sensei_backup_backup_manifest_expansion_validation_20260603_213035.zip`
- Sample audit backup: `backup/sensei_backup_backup_manifest_sample_audit_20260603_213740.zip`
- Mission state: `docs/mission_state/mission_state_backup_manifest_expansion_20260603T182441Z.md`
- RCI review artifact: `code_review/review_backup_manifest_expansion_codex_v2.html`
- RCI status: passed

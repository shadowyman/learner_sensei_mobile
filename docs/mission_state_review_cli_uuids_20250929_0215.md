# Mission State — Review CLI with UUIDs (Core Analysis)

Date: 2025-09-29 02:15 UTC
Triggering Protocol: MANDATORY CORE ANALYSIS PROTOCOL (STEP 0)

## Scope & Objective
- Automate review flow for artifacts under `code_review/` by:
  - Assigning a UUID per diff hunk and rendering it next to the hunk and in a top-level Review Checklist.
  - Embedding the same UUID within each hunk’s review section for direct targeting by CLI.
  - Providing CLI ops: `list`, `show`, `comment` that act on `--file <artifact>` and `--uuid <id>`.

## Entry Points & Relevant Files
- HTML artifact generator: `scripts/generateReview.ts` (invoked via `npm run review`).
- Example artifact: `code_review/review_selection_sensei_modal_close_bug.html`.
- Analyzer scripts: `scripts/analyze.ts` (`npm run analysis:run`).

## Current Artifact Structure (observed)
- Per file section: `<section id="<sanitized-path>" class="file-section">…`.
- Per hunk: `<article id="<file-id>-hN" class="hunk">…<div class="review-notes">…</div>…</article>`.
- Review Checklist: links to `#<file-id>-hN` anchors; no UUIDs yet.

## Static Execution Trace (high level)
- `generateReview()`
  - `parseArgument('--feature')`, `parseArgument('--pr_request')` → args
  - `timestamp()` → label
  - `getRepositoryRoot()` → `git rev-parse --git-common-dir`
  - `ensureDirectory('code_review')`
  - `listWorkingTreeDiffFiles()` → `git diff --name-only`
  - `computeTargetFilename()` → dedupe/versions and prior artifact cleanup set
  - `loadPreviousPrRequests()` → recover prior PR context from HTML `<script id="pr-request-data">`
  - For each changed file:
    - `diffFile(path)` → `git diff -- path`
    - `parseDiff()` → split meta + `@@` hunks, count add/del
    - Build `HunkSummary` ids as `<file-id>-hN` (non-UUID)
  - `buildChecklist()` → file and hunk links
  - `buildDocument()` → style + header + PR context + checklist + file sections
  - `writeFileSync(targetPath, html)`
  - `removeArtifacts()` → delete prior versions

## Dependency & Side-Effect Analysis (selected)
- `runGit(...)` (spawnSync): external process invocation (filesystem/process). Cost: Medium; Blast: Medium; Concurrency: Low.
- `writeFileSync`, `unlinkSync`, `mkdirSync`, `readdirSync`, `readFileSync`: filesystem I/O. Cost: Medium; Blast: Low–Medium; Concurrency: Low.
- HTML generation in-memory: CPU-only; no network.

Risk Register (from DSE)
- Overwrite/cleanup policy can remove prior artifacts (user intent appears to preserve only the latest). Guarded by `computeTargetFilename` which keeps latest and removes others.
- No UUIDs today: hunk anchors unstable across regenerations if block order changes, making CLI addressing ambiguous.

Coverage Checklist (to verify later)
- Generation path: `generateReview()` end-to-end with at least one diff file.
- CLI (to-be-built):
  - `list`: reads artifact and enumerates (uuid, file-id, hunk label, anchor).
  - `show`: resolves by UUID and prints hunk text + metadata.
  - `comment`: locates review section by UUID and replaces inner HTML.

Unknowns Register
- UUID stability: deterministic across regenerations vs per-artifact unique? (High impact)
- Backfill: Should we retrofit UUIDs into older artifacts? (Medium)
- Comment semantics: single replace vs append multiple? (Medium)
- Comment persistence: patch HTML in place vs separate JSON + re-render? (Medium)
- Input modes: allow `--body -` (stdin) and `--body-file`? (Low)
- Sanitization: accept raw HTML from trusted reviewers or sanitize? (Medium)
- Concurrency: any need for file locking? (Low–Medium)

Initial Understanding
Core analysis complete. I have mapped the generator’s flow and side effects and identified open decisions for the CLI + UUID design. Ready to proceed with feature implementation planning after clarifications.


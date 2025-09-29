# Mission State Checkpoint
Timestamp: 20250925_013132
Entry Point & Scope:
- CLI script `scripts/generateReview.ts`
- Functions: `generateReview`, `runGit`, `listChangedFiles`, `buildDocument`, `buildNoDiffDocument`, `buildChecklist`, `buildPrRequestMarkup`
Static Execution Trace:
1. `generateReview` parses arguments and timestamps execution.
2. `generateReview` ensures `code_review/` output directory exists and gathers diff metadata via `listChangedFiles`.
3. `listChangedFiles` invokes `runGit` to inspect staged or working tree changes.
4. `generateReview` determines output targets with `computeTargetFilename` and loads prior narratives through `loadPreviousPrRequests`.
5. `generateReview` assembles PR context via `buildPrRequestMarkup` and either produces a no-diff document or iterates files using `fileDiff` -> `parseDiff` -> `buildChecklist` -> `buildDocument` before writing HTML artifacts.
Dependency & Side-Effect Analysis:
- `generateReview`: depends on filesystem utilities, diff helpers, and writes HTML files plus console output.
- `runGit`: depends on `child_process.spawnSync`; executes git commands to capture stdout/stderr.
- `listChangedFiles`: depends on `runGit`; executes git diff queries.
- `buildDocument` / `buildNoDiffDocument`: depend on `escapeHtml`, diff data, and emit HTML strings for persistence.
- `buildChecklist`: depends on parsed diff sections; pure transformation.
- `buildPrRequestMarkup`: depends on sanitized PR entries; pure transformation.
Key Architectural Insights:
- Review artifact generation centralizes in `generateReview` with dedicated helpers for HTML assembly.
- Git integration is funneled through `runGit`, making branch metadata retrieval straightforward.
Triggering Protocol: COMPREHENSIVE IMPACT ANALYSIS PROTOCOL

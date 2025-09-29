# review:edit CLI Manual

This guide covers the reviewer-facing CLI for interacting with a generated review artifact. It focuses on usage only (no implementation details).

- Command form: `npm run review:edit -- <subcommand> [options]`
- Subcommands: `list-uuid`, `show-diff`, `remark`
- All commands require a review artifact path via `--file`.

## Artifact Path
- `--file <artifact>` accepts:
  - Bare filename (resolved in your review artifacts directory)
  - Relative path
  - Absolute path
- If the specified file does not contain per‑hunk UUIDs, regenerate the artifact using your standard creation flow and rerun the command.

## Subcommands

### 1) list-uuid
- Purpose: List all per‑hunk UUIDs in the order they appear in the artifact.
- Usage: `npm run review:edit -- list-uuid --file <artifact>`
- Output:
  - One UUID per line (top‑down).
  - Final hint line: `To show: npm run review:edit -- show-diff --file <artifact> --uuid <uuid>`
- Exit codes:
  - 0 on success
  - Non‑zero if file missing, unreadable, or lacks UUIDs

### 2) show-diff
- Purpose: Display the code hunk associated with a UUID.
- Usage: `npm run review:edit -- show-diff --file <artifact> --uuid <uuid>`
- Output:
  - Hunk label (e.g., “Block N”)
  - Hunk header (the `@@` range)
  - Diff body for that hunk
- Notes: Does not print existing review remarks.
- Exit codes:
  - 0 on success
  - Non‑zero if file or UUID is invalid

### 3) remark
- Purpose: Add or replace the review remark for a specific hunk.
- Usage: `npm run review:edit -- remark --file <artifact> --uuid <uuid> --body "<text or <div>...>|-" [--verdict "<div>...>|-"]`
- Body forms:
  - Plain text string → escaped and wrapped in `<p>`
  - HTML block (e.g., `<div>...</div>`) → inserted as provided
  - `-` → read multi‑line body from stdin
- Behavior:
  - Replaces the hunk’s existing remark (no append/edit/delete flow)
  - Preserves the “Review Notes” heading in the artifact
  - If `--verdict` is provided, also creates or replaces a top‑level `VERDICT` section immediately after the “PR Review Context”.
    - `--verdict` body may be provided inline as an HTML block (e.g., `<div>…</div>`), or via stdin using `-`.
    - If the `--verdict` body is not an HTML block, it is treated as a code block and rendered as `<pre><code>…</code></pre>`.
- Exit codes:
  - 0 on success
  - Non‑zero if required flags are missing or the UUID is invalid

## Error Behavior
- Missing `--file`: prints guidance and exits non‑zero
- Artifact not found: prints path tips and exits non‑zero
- Artifact lacks UUIDs: instructs to regenerate the artifact and exits non‑zero
- Invalid UUID: prints an error, lists all valid UUIDs, shows example commands, exits non‑zero

## Examples
- List UUIDs:
  - `npm run review:edit -- list-uuid --file review_feature.html`
- Show a specific hunk:
  - `npm run review:edit -- show-diff --file review_feature.html --uuid 0123abcd4567`
- Add a plain‑text remark:
  - `npm run review:edit -- remark --file review_feature.html --uuid 0123abcd4567 --body "Looks correct; verified edge cases."`
- Add a rich HTML remark from stdin:
  - `cat notes.html | npm run review:edit -- remark --file review_feature.html --uuid 0123abcd4567 --body -`
- Add a VERDICT along with a remark:
  - `npm run review:edit -- remark --file review_feature.html --uuid 0123abcd4567 --body "LGTM" --verdict "<div><strong>PASS</strong>: Ready to merge.</div>"`
- Review all hunks sequentially:
  - `npm run review:edit -- list-uuid --file review_feature.html | while read u; do npm run review:edit -- show-diff --file review_feature.html --uuid "$u"; done`

## Conventions
- Output is human‑readable text (no JSON mode).
- `--uuid` is mandatory for `show-diff` and `remark`.
- Remarks always replace the current content for that hunk.

# Principle‑Driven Feature Implementation — Review CLI UUIDs

Date: 2025-09-29 03:32 UTC
Related docs: docs/mission_state_review_cli_uuids_20250929_0215.md, docs/impact_review_cli_uuids_20250929_0220.md

## Step 1 — Goals & NFRs
- Functional:
  - Generate deterministic per‑hunk UUIDs; display in hunk headers; add `data-uuid` to `article.hunk` and `.review-notes`.
  - Provide CLI: `list-uuid`, `show-diff`, `remark` operating on `--file <artifact>` and `--uuid <id>`.
  - `remark` replaces `.review-notes` inner HTML, preserves `<h4>`.
  - Errors: legacy artifact, invalid/missing flags; list valid UUIDs and example commands.
- NFRs:
  - Stability: IDs deterministic for same diff; unique per artifact.
  - Safety: no sanitizer for HTML remarks; plain text escaped.
  - UX: human-readable outputs; no JSON; keep existing anchors/checklist.

## Step 2 — Approaches & Trade‑offs (simple)
- A1: Deterministic 12‑hex (SHA‑1) + in‑place HTML patch via parse5.
  - + Stable, dependency‑free, fast; minimal DOM changes.
  - − None significant for scope.
- A2: Random v4 UUID + sidecar JSON for comments.
  - + No HTML edits for remarks.
  - − More moving parts; sync/render step; harder to diff.
- A3: Anchor‑only IDs; no UUIDs.
  - + No changes to DOM.
  - − Unstable across regenerations; poor CLI targeting.
- Decision: A1 (implemented).

## Step 3 — Risks & Mitigations
- Risk: Diff regeneration changes UUIDs → reviewer confusion.
  - Mitigation: Deterministic hash by path+header+lines; documented behavior.
- Risk: Raw HTML in remarks could break layout.
  - Mitigation: Scope to local artifacts; preserve `<h4>`; allow quick revert via VCS.
- Risk: Legacy artifacts lack UUIDs.
  - Mitigation: Clear error with guidance to rerun `review:create`.

## Step 4 — Implementation & Validation Plan
- Task: Compute UUIDs in generator
  - Validation: `grep 'UUID:'` in new artifact; check `data-uuid` on article & review-notes.
- Task: CLI list-uuid
  - Validation: Lists UUIDs top‑down; prints example command.
- Task: CLI show-diff
  - Validation: Prints label, `@@` header, diff body for UUID.
- Task: CLI remark
  - Validation: Replaces `.review-notes` inner HTML while keeping `<h4>`.
- Task: Error handling
  - Validation: Invalid UUID prints valid list & examples; legacy warns to regenerate.

## Step 5 — Execution Notes
- Implemented in `scripts/generateReview.ts`, `scripts/reviewEdit.ts`, and `package.json`.
- Backup created: `backup/review_cli_uuid_support_20250929_032415.tar.gz`.

## Step 6 — RCI Self‑Review (Step 8)
- Checklist
  - UUIDs present in headers and as data attributes.
  - CLI resolves artifact names and paths correctly.
  - list-uuid outputs only UUIDs, then one example.
  - show-diff outputs label + header + diff body; no remarks.
  - remark preserves heading and replaces inner HTML; plain text escaped, HTML trusted.
  - Error messages exit non‑zero and include examples.
- Evidence
  - Artifact: `code_review/review_review_cli_uuid_support.html` contains UUIDs.
  - Commands executed successfully per validation steps.

## Step 7 — Handoff
- New workflows documented in this file and mission/impact docs.
- Next: Regenerate any active artifacts to enable UUIDs; notify reviewers to switch to `review:edit`.


# Analyzer Enhancements: Low‑Hanging Fruit and Rollout

This document prioritizes practical extensions to `scripts/analyze.ts` that deliver outsized value with modest effort.

## Tier 1 — Easiest Wins (hours)

### Regex Inventory + Basic Classifiers
- What: Walk the TS AST; collect every RegExp literal and `new RegExp(...)` with its file/line. Tag with simple heuristics (`backticks`, `leading-whitespace`, `html-tag`, `digits`, `path-like`).
- How: In the existing TypeScript compiler pass, add a visitor for `NoSubstitutionTemplateLiteral`, `RegularExpressionLiteral`, and `NewExpression(RegExp)`. Emit regex, flags, file, line, and a `tags[]` array.
- Output: `tmp/analysis/regexes.json`; extend `summary.txt` with “Top regex tags.”
- Effort/Risk: S; minimal runtime cost.
- Pitfall: Template-built regex via string concat—log as `dynamic` with best effort.

### Log Correlation Index
- What: Map `logger.(info|warn|error|debug)(<literal>)` → function + line, and build a reverse index from literal substrings → call sites.
- How: In the AST pass, detect `CallExpression` to known logger identifiers; if arg0 is a string literal or template literal with all‑literal parts, record it.
- Output: `tmp/analysis/log_index.json`, and a helper `analyze find-log 'MERMAID'`.
- Effort/Risk: S; very high ROI during RCA.
- Pitfall: Dynamic messages—capture a normalized “pattern” with `${…}` placeholders.

### Analyzer Query CLI (prebaked queries)
- What: Thin Node CLI that wraps common jq patterns with stable commands.
- Examples:
  - `analyze find --regex backticks`
  - `analyze who-touches --text "replace(" --scope src/ui.ts`
  - `analyze by-sideeffect dom --top 20`
- How: Small script that loads analyzer JSONs and runs canned filters.
- Outcome: Ergonomic access to artifacts without bespoke jq.
- Effort/Risk: S; ergonomics improvement only.
- Pitfall: Keep output small and pipe‑friendly.

## Tier 2 — Small Projects (1 day)

### Diff Overlay Mode
- What: Compare current artifacts to a stored baseline; show changed functions, added/removed call edges, and a churn heatmap by file.
- How: `npm run analysis:run -- --save-baseline` writes a snapshot; `--diff <path>` computes set diffs for `functions.json` and `calls.json`; write `tmp/analysis/diff/*.json` and a human summary.
- Output: `tmp/analysis/diff/*.json` and a “Top 10 changed functions / added-removed edges” section in `summary.txt`.
- Effort/Risk: S/M; JSON compare plus a couple of views.
- Pitfall: Line‑number churn—use `stableId` anchors.

### Export Graph Views (Mermaid/DOT)
- What: Render `focused_trace` as an interactive HTML (viz.js or mermaid) with side‑effect badges and fan‑in/out counts in node labels.
- How: Convert trace edges to DOT or mermaid; generate a single self‑contained HTML via viz.js or mermaid‑cli.
- Output: `tmp/analysis/trace.html`.
- Effort/Risk: S/M; quick to prototype; great for reviewers.
- Pitfall: Very large graphs—truncate or cluster by module.

### Coverage Overlay (if coverage available)
- What: Merge coverage summary (per file/line/function) into `functions.json` and color code by coverage band; list “hot & uncovered” functions.
- How: Parse `coverage-final.json` or `lcov`, map to files and function ranges (`startLine..end`); emit overlay JSON and augment summary.
- Output: `tmp/analysis/coverage_overlay.json` and a “Hot & Uncovered” section in `summary.txt`.
- Effort/Risk: M; mapping lines to functions can be fiddly.
- Pitfall: Generated code paths—ignore or mark `external`.

## Tier 3 — Medium (sprint)

### Multi‑Entry Focus + Merge
- What: Accept multiple `--entry file::name` and emit a merged focused trace with deduped edges and per‑entry coloring.
- How: Run the existing traversal per entry, union edges, annotate origin entries on nodes/edges; also emit per‑entry subtraces for ordering context.
- Effort/Risk: M; improves A/B flow comparison.
- Pitfall: Loss of strict ordering—provide per‑entry subtraces.

## Tier 4 — Longer‑Haul

### Dataflow Slicing for Values (SSA‑lite)
- What: Trace “how this identifier’s value changes” across a path; find where newlines/encodings are introduced or removed.
- How: Build per‑function def‑use chains for selected identifiers; start intra‑function; later cross functions via args/returns where resolvable.
- Effort/Risk: L/XL; powerful but non‑trivial.
- Pitfall: Dataflow across dynamic calls/imports—gate behind a feature flag and scope by file.

## Rollout Plan (2–3 weeks)
1) Ship Tier 1 (regex inventory, log index, query CLI).
2) Add Diff Overlay + Graph Export.
3) Integrate Coverage Overlay (where coverage exists).
4) Add Multi‑Entry Merge mode.
5) Prototype SSA‑lite slicing behind a feature flag.

## Acceptance Criteria
- Regex Inventory: `regexes.json` lists each pattern, flags, file:line, and classifier tags; query returns “backticks” or “leading‑whitespace” across repo in <1s.
- Log Index: Given a log fragment, the CLI returns file:line owner(s); reverse lookup works from function → messages.
- Query CLI: At least 6 commands cover 80% of typical jq needs; documented usage.
- Diff Overlay: “Top 10 changed functions” and “added/removed edges” sections in `summary.txt;` machine‑readable JSON diffs for tooling.
- Graph Export: Single HTML artifact opens locally and shows badges and fan‑in/out on nodes.
- Coverage Overlay: “Hot & Uncovered” list in summary; JSON consumable in CI labeling.

## Implementation Kickoff Suggestion
If prioritizing for impact vs. effort, start by adding Tier 1 + Diff Overlay in one PR: extend `scripts/analyze.ts` to emit `regexes.json`/`log_index.json` and a small `analyze` CLI, then add the diff compare. Highest leverage, minimal moving parts.

## Risks & Mitigations
- Large outputs: limit Top‑N; stream to disk; paginate.
- Template‑built regexes: mark as dynamic; surface caller hints.
- File churn: rely on `stableId` anchors; fall back to path+startLine.

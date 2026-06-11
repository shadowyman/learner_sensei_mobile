# Analyzer Reference

Read this only when analyzer evidence is needed.

## Role

Analyzer is not first-pass discovery. Use it after built-ins or Serena have narrowed scope, or immediately when the question specifically needs side effects, assumptions, mutation risk, DOM/event evidence, focused traces, fan-in/fan-out, boundary APIs, hotspots, or validation-target evidence.

Use analyzer for repo-specific evidence:

- side effects
- assumptions and unresolved calls
- mutation risk
- DOM, event, template, and selector analysis
- focused traces
- fan-in and fan-out
- boundary APIs and hotspots
- protocol-grade dependency and side-effect evidence, risk registers, coverage checklists, or mission-state support

Do not bulk-read analyzer artifacts by default. Query slices with `jq` or a small script.

## Command

`npm run analysis:run [-- <option>...]`

This runs manifest sync, then `scripts/analyze.ts`, and writes `tmp/analysis/*`.

Analyzer runs overwrite `tmp/analysis/*`.

## Default Patterns

Scoped run:

`npm run analysis:run -- --include <path-substrings>`

Focused trace:

`npm run analysis:run -- --include <scope> --entry <file::functionPrefix> --maxDepth <N>`

DOM, UI, or event work:

`npm run analysis:run -- --include <scope> --dom-index`

Broad, unclear, or high-risk work:

`npm run analysis:run`

## Options

| Option | Use |
|---|---|
| `--include a,b` | Scope by project-relative path substring. Not glob. |
| `--entry file::prefix` | Start a focused trace from the first matching `file::name`. |
| `--maxDepth N` | Bound focused trace depth. Default `6`. |
| `--dom-index` | Emit DOM selector, template, and handler artifacts. |
| `--preset slug` | Apply a stackable preset. Confirm the preset exists before relying on it. |
| `--no-typechecker` | Last resort when the type checker blocks progress. Record the limitation if used. |

Known documented presets:

`domsuite`, `curriculum`, `adaptive-engine`, `pedagogy`, `prompts`, `mermaid`, `mermaid-recovery`, `mermaid-ui`, `debug-mode`, `chat-window`, `module-selection`, `notepad-export`, `selection-toolbar`, `ui-rendering`, `enhancement`, `consolidation`, `gemini`, `save-load`, `interaction`, `code-editor`, `tests-teaching`

## Artifact Map

| Artifact | Query for |
|---|---|
| `summary.json` / `summary.txt` | entry candidates, top fan-in and fan-out, function count |
| `brief.json` | counts, hotspots, boundary APIs, change-risk index, mutation maps, assumption triage |
| `brief.md` | broad human map; avoid by default |
| `imports.json` | file import dependencies |
| `fan_in.json`, `fan_out.json` | blast radius and orchestrator signals |
| `functions.json` | functions, locations, async and export flags, calls, side effects |
| `calls.json` | call edges and trace checks |
| `assumptions.json` | unresolved or external-call assumptions |
| `function_crosswalk.json` | current function to stable ID mapping |
| `focused_*` | focused trace outputs from `--entry` |
| `domsuite_*` | DOM selector, template, and handler evidence |

## Semantics

`--include` uses substring matching on project-relative paths.

Import graph resolves relative imports plus manifest-listed JavaScript modules reached through `require(...)`. Package imports are excluded unless resolved to in-repo workspace sources such as `@sensei/core/*` or `@sensei/protocol/*`.

Stable IDs are content-derived hashes shaped like:

`file::name#<hash>`

Do not treat them as line anchors. Body edits can change them. Use `function_crosswalk.json` after each analyzer run.

DOM artifacts are emitted only with `--dom-index`. HTML strings generate selector definitions. DOM APIs generate selector usages. `.matches` and `.closest` on handler parameters mark delegated handlers.

## Query Recipes

Counts:

`jq '.counts' tmp/analysis/brief.json`

Entry candidates:

`jq '.entryCandidates' tmp/analysis/summary.json`

Top fan-in and fan-out:

`jq 'to_entries|sort_by(-.value)|.[:10]' tmp/analysis/fan_in.json`

`jq 'to_entries|sort_by(-.value)|.[:10]' tmp/analysis/fan_out.json`

Risk overview:

`jq '.changeRiskIndex[:10]' tmp/analysis/brief.json`

`jq '.boundaryApis[:10]' tmp/analysis/brief.json`

`jq '.hotspotNeighborhoods.risk[:5]' tmp/analysis/brief.json`

Assumptions:

`jq '.assumptionTriage.filtered.topStatements[:10]' tmp/analysis/brief.json`

`jq '.assumptionTriage.topFiles[:10]' tmp/analysis/brief.json`

Side effects:

`jq 'map(select(.sideEffects|length>0))|map({stableId,file,name,sideEffects})' tmp/analysis/functions.json`

`jq '[.[]|.sideEffects[]?.kind]|group_by(.)|map({kind:.[0],count:length})' tmp/analysis/functions.json`

Specific side effects:

`jq 'map(select(any(.sideEffects[]?; .kind=="network")))|map({stableId,file,name,sideEffects})' tmp/analysis/functions.json`

`jq 'map(select(any(.sideEffects[]?; .kind=="filesystem")))|map({stableId,file,name,sideEffects})' tmp/analysis/functions.json`

`jq 'map(select(any(.sideEffects[]?; .kind=="state-write")))|map({stableId,file,name,sideEffects})' tmp/analysis/functions.json`

`jq 'map(select(any(.sideEffects[]?; .kind=="dom")))|map({stableId,file,name,sideEffects})' tmp/analysis/functions.json`

Async exports:

`jq 'map(select(.export and .async))|map({stableId,file,name})' tmp/analysis/functions.json`

Cross-file calls:

`jq 'map(select(.fromStable and .toStable) | select((.fromStable|split("::")[0]) != (.toStable|split("::")[0])))' tmp/analysis/calls.json`

Frequent call pairs:

`jq -r 'group_by(.fromStable+"->"+(.toStable//.to))|map({k:(.[0].fromStable+"->"+(.[0].toStable//.[0].to)),n:length})|sort_by(-.n)|.[:15]' tmp/analysis/calls.json`

Focused trace:

`cat tmp/analysis/focused_trace.txt`

`jq 'map({id,stableId,file,name,sideEffects})' tmp/analysis/focused_functions.json`

Crosswalk:

`jq '.functions|map({id,stableId,file,name,startLine,startCol})' tmp/analysis/function_crosswalk.json`

DOM:

`jq '.handlers[]|select(.delegated)' tmp/analysis/domsuite_handlers.json`

`jq '.selectors[]|select((.definitions|length)==0 and (.usages|length)>0)|{selector,usages}' tmp/analysis/domsuite_index.json`

`jq '.templates[]|{file,line:.loc.start.line,selectors:[.selectors[].selector]}' tmp/analysis/domsuite_templates.json`

## Anti-Patterns

Avoid by default:

- `cat tmp/analysis/brief.md`
- `cat tmp/analysis/brief.json`
- `cat tmp/analysis/functions.json`
- `cat tmp/analysis/calls.json`

Do not use analyzer as a substitute for:

- targeted built-ins for exact anchors
- Serena known-symbol inspection or editing
- optional Graphify exact-node relationship snapshots
- direct source confirmation of final relevant code
- tests, build logs, runtime logs, simulator evidence, or other runtime proof

Analyzer output is static evidence, not runtime truth. Verify dynamic dispatch, generated code, native or mobile boundaries, external dependencies, and high-risk behavior with source or runtime evidence.

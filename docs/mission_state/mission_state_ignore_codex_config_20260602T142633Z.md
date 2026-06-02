# Mission State: Ignore Codex Config

## Scope

User requested adding `.codex/config.toml` to Git ignore rules so local Codex MCP configuration is excluded from commits.

## Analyzer Snapshot

- Command: `npm run analysis:run`
- TypeChecker: enabled
- Snapshot output: `tmp/analysis/summary.txt`, `tmp/analysis/brief.md`, `tmp/analysis/brief.json`
- Relevant analyzer finding: `.gitignore` has no imports, functions, fan-in, fan-out, or call edges in analyzer artifacts.

## Entry Points

- Metadata entry point: `.gitignore`
- Local config candidate: `.codex/config.toml`
- No runtime application entry point applies.

## Static Execution Trace

No runtime trace exists for this change. The intended effect is Git metadata filtering:

1. Git evaluates `.gitignore`.
2. `.codex/config.toml` matches the new ignore pattern.
3. `git status --short` no longer reports `.codex/config.toml` as an untracked commit candidate.

## Dependency And Side Effects

| Item | Dependencies | Side Effects | Risk | Verification |
| --- | --- | --- | --- | --- |
| `.gitignore` rule | Git ignore engine | Hides only `.codex/config.toml` from untracked status | Low | `git check-ignore -v .codex/config.toml` and `git status --short -- .codex/config.toml .gitignore` |

## Risk Register

- Low: Over-broad ignore could hide useful plugin files. Mitigation: use the exact requested path `.codex/config.toml` instead of ignoring all `.codex/`.
- Low: Existing analyzer run refreshed `src/file-manifest.json`; leave that pre-existing generated working-tree state intact.

## Unknowns

- None blocking. User explicitly requested the specific config file, so no clarification is needed before editing.

## Coverage Checklist

- Verify `.codex/config.toml` is ignored.
- Verify `.gitignore` is the only intended runtime-neutral source edit.

## Architectural Notes

This is repository hygiene and secret-risk mitigation. It does not alter build, app, BFF, core, mobile, or test execution paths.

## Triggering Protocol

Direct repository hygiene edit after Core Analysis.

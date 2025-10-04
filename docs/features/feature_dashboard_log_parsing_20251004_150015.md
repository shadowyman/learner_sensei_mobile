# Dashboard Log Parsing Improvements (2025-10-04)

## Summary
- Teach the mediator dashboard to parse raw log payloads and surface `command`, `text`, and `id` data without losing the existing metadata prefix.
- Store both raw and sanitized log representations so JSON extraction works even when the visible line is truncated.
- Present parsed values without `command=`/`text=` prefixes and allow full command strings through when no accompanying text exists, while keeping the prior ellipsis rules for other cases.

## Key Changes
- `scripts/review_mediator/log_manager.ts`: Retain `{ raw, visible }` pairs for each log and expose structured entries to callers.
- `scripts/review_mediator/messages.ts`: Broaden `DashboardSnapshot.logs` to the new `DashboardLogEntry` shape.
- `scripts/review_mediator/dashboard.ts`: Format logs from the raw payload, gracefully fall back to sanitized strings, drop label prefixes, and bypass truncation for command-only rows.

## Validation
- Manual harness exercising pure JSON, timestamp-prefixed JSON, truncated command, and plain-text logs confirmed identifier, command, and text rendering while preserving metadata and fallbacks.
- `npx tsc --noEmit` (fails globally because of `mermaidErrorRecovery.ts`; mediator files compile locally).

## Protocol Artifacts
- Mission state: `docs/mission_state/mission_state_dashboard_log_parsing_20251004T094932Z.md`
- Backup archive: `backup/sensei_backup_dashboard_log_parsing_20251004_133758.zip`
- Review artifact: `code_review/review_dashboard_log_parsing_codex_v3.html`


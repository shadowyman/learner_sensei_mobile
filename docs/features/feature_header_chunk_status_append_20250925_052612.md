# Header chunk progress in status segment (2025-09-25 05:26:12 UTC)

## Summary
- Showing the active teaching chunk (`Chunk x/y`) directly in the top header keeps learners aligned with the meditation overlay’s progress indicator.
- The status line now reuses the existing DOM builder so the chunk label appears inline with the phase/concept without adding new rows.

## Key Changes
- `ui.ts:156` – extended `setStatusLines` options so the header accepts an optional `chunkLabel` span, reused for both concept and non-concept flows.
- `ui.ts:223` – gated chunk computations to active curriculum states and injected the formatted `Chunk current/total` string when indices are valid.
- `index.css:509` – styled `.status-chunk` to match surrounding typography and spacing, replacing the prior inline margin logic.

## Behaviour & Validation
- Confirmed via runtime logs that `[HEADER_CHUNK]` entries appeared during validation (`logs/console_logs.log`, 2025-09-25 run) matching meditation overlay counts, then removed the temporary logging once evidence was captured.
- `npx tsc --noEmit` passes after the updates, ensuring TypeScript safety.
- Visual inspection shows the chunk badge inherits the same green palette as phase/concept text, preventing the white-on-dark regression reported by the user.

## Assets
- Backup: `backup/sensei_backup_header_chunk_status_append_20250925_040056.zip`
- Latest review artifact: `code_review/review_header_chunk_status_append_v3.html`

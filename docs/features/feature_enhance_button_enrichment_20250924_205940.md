# Enhance Button Inline Enrichment

- The enhancement request path still uses a dedicated prompt builder plus a Flash-backed config with a local fallback when `ModelUsage.ENHANCEMENT_REQUEST_CONFIG` is missing (`src/geminiService.ts:256-289`, `src/model_usage.ts:117-120`).
- `src/enhancementManager.ts:64-167` still orchestrates toggle behavior, Mermaid stripping, ordered insertion, and highlight metadata generation.
- `src/ui.ts:1683-1795` and `src/ui.ts:1985-1991` still render enhanced markdown, apply multi-node highlights, and fall back safely when a highlight span cannot be wrapped.
- `src/index.tsx:1432-1437` and `src/index.tsx:1861-1863` still wire manager initialization and the exposed enhance handler into the main lifecycle.

## Validation
- Current `npx tsc --noEmit` is no longer a passing validation step for this repo; it now fails with broader TypeScript issues outside this document's scope.
- The historical 2025-09-24 manual Enhance run is not preserved in the current `logs/console_logs.log`, so that specific runtime proof cannot be re-verified from retained artifacts.

## Backup
- `backup/sensei_backup_enhance_multinode_highlight_20250924_200950.zip`

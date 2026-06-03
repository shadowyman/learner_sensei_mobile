# Mission State: Mobile MainScreen Duplicate Cleanup

Timestamp: 2026-06-03T08:58:13Z

## Scope

Clean up the duplicate root `src/mobile/MainScreen.tsx` after confirming the real iOS runtime imports `SenseiMobile/src/mobile/MainScreen.tsx` through `SenseiMobile/App.tsx`. The final approved path is to retarget the static overlay-order test to the real runtime screen, delete the duplicate root screen, and retire the old direct RN-to-BFF stream-forwarding helper/test because the current migration master plan makes the WebView-owned turn path authoritative.

## Analyzer Snapshot

Command:

`npm run analysis:run -- --include src/mobile/MainScreen.tsx,SenseiMobile/src/mobile/MainScreen.tsx,__tests__/MainScreen.forwardStream.test.ts,__tests__/MainScreen.selectionOverlayOrder.test.ts`

Findings:

- Entry candidates: `SenseiMobile/src/mobile/MainScreen.tsx`, `src/mobile/MainScreen.tsx`.
- Top fan-out: `SenseiMobile/src/mobile/MainScreen.tsx` fan-out 8, `src/mobile/MainScreen.tsx` fan-out 5.
- Root duplicate exported only `runForwardStream` and `MainScreen`.
- Analyzer call edges from root `runForwardStream` went to `BridgeManager.enqueue` and `logger.error`.
- Follow-up master-plan check classified `runForwardStream` as legacy RN-direct streaming scaffold. The active runtime path is WebView-owned `chat:userInput` with release on `chat:turnComplete` or WebView error.

## Impact Analysis

| Dimension | Impact |
| --- | --- |
| Technical | Interface/refactor change. Root tests should import shared helper instead of duplicate screen. |
| Runtime | Low expected simulator impact because runtime imports `SenseiMobile/src/mobile/MainScreen.tsx`. |
| Testing | Medium impact: remove obsolete root forward-stream test and keep the source-order assertion pointed at the runtime iOS screen. |
| Maintenance | Positive: removes a stale screen mirror that can drift from the real runtime screen. |

## Static Trace

1. `SenseiMobile/App.tsx` imports `SenseiMobile/src/mobile/MainScreen.tsx`.
2. `MainScreen.handleSubmit` guards duplicate active WebView turns.
3. It enqueues `chat:userInput` to the WebView-owned teaching loop.
4. `MainScreen.handleWebViewMessage` releases the turn guard on `chat:turnComplete` or `webview:error`.
5. `__tests__/MainScreen.selectionOverlayOrder.test.ts` inspects the real runtime screen file for WebView/overlay order.

## Validation Plan

- Run root Jest with `--silent --bail --noStackTrace` for:
  - `__tests__/MainScreen.selectionOverlayOrder.test.ts`
  - `__tests__/selectionToolbarLayout.test.ts`
  - `__tests__/selectionSensei.test.ts`
- Confirm `rg "runForwardStream|legacy_bff_streaming|src/mobile/runForwardStream"` has no live code/test hits.
- Confirm `rg "src/mobile/MainScreen"` no longer shows live imports.
- Confirm `git status` shows only the intended file deletion/additions/edits for this cleanup, plus unrelated pre-existing dirty work.

## Backup

`backup/sensei_backup_remove_duplicate_root_mobile_mainscreen_20260603_115816.zip`
`backup/sensei_backup_retire_legacy_mobile_forward_stream_20260603_120557.zip`

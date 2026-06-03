# Mission State: iOS Liquid Glass Blur Replacement

## Current Scope

- Triggering request: replace faulty React Native blur on the mobile input bar and Selection Sensei pillbox toolbar with iOS 26 Liquid Glass, preserving fallback behavior.
- Approved implementation scope: `SenseiMobile/src/mobile/components/InputBar.tsx`, `SenseiMobile/src/mobile/SelectionOverlay.tsx`, `SenseiMobile/src/mobile/MainScreen.tsx`, mobile package metadata, Pods, Jest mocks, and a focused renderer smoke test.
- Updated scope decision: Android support and Android validation are explicitly out of scope. Non-iOS platforms do not receive a fallback glass background from this component.
- Current dirty tree policy: preserve existing uncommitted work and layer changes on top. Existing dirty files include `InputBar.tsx`, `SelectionOverlay.tsx`, and `src/file-manifest.json`.
- Analyzer snapshot: full pass plus focused pass on `SenseiMobile/src/mobile/MainScreen.tsx`, `SenseiMobile/src/mobile/SelectionOverlay.tsx`, `SenseiMobile/src/mobile/components/InputBar.tsx`, and `src/mobile/selectionToolbarLayout.ts`.

## Static Execution Trace

- `SenseiMobile/src/mobile/MainScreen.tsx::MainScreen` is the mobile screen entry point. It renders the WebView, `SelectionOverlay`, and bottom `InputBar`.
- `MainScreen` owns the WebView compositing flag currently set as `opaque={true}` while also using `setBackgroundColor={'transparent'}`.
- `SenseiMobile/src/mobile/components/InputBar.tsx::InputBar` owns text entry, keyboard visibility state, measurement via `onLayoutRect`, send handling, and the current direct iOS `BlurView` background.
- `SenseiMobile/src/mobile/SelectionOverlay.tsx::SelectionOverlay` owns toolbar render/layout state, ask prompt state, and the current direct iOS `BlurView` background.
- `SenseiMobile/src/mobile/SelectionOverlay.tsx::SelectionOverlayController` owns selection visibility state, bridge invocation, and dismiss behavior.
- `src/mobile/selectionToolbarLayout.ts::computeSelectionToolbarLayout` computes toolbar top/left/scale without side effects.

## Dependency And Side Effects

- `MainScreen`: imports `SelectionOverlay`, `InputBar`, WebView, bridge/network types, header, and backdrop canvas. No analyzer side effects on the component body, but runtime risk includes WebView compositing and bridge message flow.
- `InputBar`: imports send/editor visuals, logger, theme helpers, and current blur package. Analyzer reports no side effects on `InputBar`; runtime state includes text, keyboard visibility, async submit clearing, and layout measurement.
- `SelectionOverlay`: imports bridge contracts/manager, logger, shared toolbar layout helper, and current blur package. Analyzer side effects are in controller state writes only.
- `SelectionOverlayController.constructor`: writes `this.bridge` and `this.onChange`; medium state-write risk.
- `SelectionOverlayController.handleWebMessage`: writes selection state and can call `dismiss`; medium state-write risk.
- `SelectionOverlayController.invoke`: calls `BridgeManager.enqueue` and `dismiss`; high functional risk if touched, so implementation must avoid changing this flow.
- `SelectionOverlayController.dismiss`: writes hidden state; medium state-write risk.
- `computeSelectionToolbarLayout`: pure calculation, no side effects.

## Risk Register

- Xcode 26 availability: high impact because `@callstack/liquid-glass` requires Xcode 26+ to compile. Verify with `xcodebuild -version`.
- iOS 26 runtime availability: medium impact for proving real Liquid Glass. Verify with `xcrun simctl list runtimes`.
- CocoaPods/autolinking: high impact because native dependency integration must be generated through RN autolinking. Verify with `bundle exec pod install` and `grep -i liquid/glass ios/Podfile.lock`.
- TypeScript/native package compatibility: medium impact due existing `@types/react-native` and path override risk. Verify with `npx tsc --noEmit`; inspect before broad config changes.
- WebView compositing: medium impact; only change `opaque={false}` and manually check for black/white flashes.
- Existing dirty tree: high process risk; preserve user-owned changes and avoid branch/pull/revert commands.

## Coverage Checklist

- `SenseiMobile/src/mobile/MainScreen.tsx::MainScreen`
- `SenseiMobile/src/mobile/components/InputBar.tsx::InputBar`
- `SenseiMobile/src/mobile/SelectionOverlay.tsx::SelectionOverlay`
- `SenseiMobile/src/mobile/SelectionOverlay.tsx::SelectionOverlayController.handleWebMessage`
- `SenseiMobile/src/mobile/SelectionOverlay.tsx::SelectionOverlayController.invoke`
- `SenseiMobile/src/mobile/SelectionOverlay.tsx::SelectionOverlayController.dismiss`
- `src/mobile/selectionToolbarLayout.ts::computeSelectionToolbarLayout`

## Assumptions And Unknowns

- `@callstack/liquid-glass` will install successfully in `SenseiMobile`; verify via `npm ls @callstack/liquid-glass`.
- The reusable background component can be imported by both target surfaces without circular imports; verify via TypeScript and Jest.
- iOS fallback should retain `@react-native-community/blur` for older iOS. Android fallback behavior is intentionally not supported for this change.
- Manual visual QA may be limited by local simulator/runtime availability; document any unavailable checks as environment blockers.

## Next Protocol Disposition

- User explicitly approved skipping additional major protocols. Proceed directly to implementation after this Core Analysis checkpoint and the required backup.
- Before adding or modifying tests, read `docs/protocols/TEST_IMPLEMENTATION_PROTOCOL.md`.

# Mission State: Remove Legacy Blur Fallback

## Scope

- Objective: remove `@react-native-community/blur` from the mobile app and replace the unsupported Liquid Glass fallback with a plain black translucent background.
- Primary files: `SenseiMobile/src/mobile/components/PlatformGlassBackground.tsx`, `SenseiMobile/src/mobile/components/InputBar.tsx`, `SenseiMobile/src/mobile/SelectionOverlay.tsx`, `SenseiMobile/src/mobile/components/__tests__/PlatformGlassBackground.test.tsx`, mobile package metadata, mobile/root Jest mocks and mappers, `SenseiMobile/ios/Podfile.lock`.
- Existing user-owned dirty files are preserved outside this scope.

## Core Analysis Findings

- Analyzer command: `npm run analysis:run -- --include SenseiMobile/src/mobile/components/PlatformGlassBackground.tsx,SenseiMobile/src/mobile/components/__tests__/PlatformGlassBackground.test.tsx,SenseiMobile/src/mobile/SelectionOverlay.tsx,SenseiMobile/src/mobile/components/InputBar.tsx,jest.config.js,SenseiMobile/jest.config.js`.
- Entry candidates: `SenseiMobile/src/mobile/SelectionOverlay.tsx`, `SenseiMobile/src/mobile/components/InputBar.tsx`.
- `PlatformGlassBackground` has fan-in from `InputBar` and `SelectionOverlay`.
- Analyzer side effects are limited to existing selection controller state writes; `PlatformGlassBackground` itself has no analyzer side effects.
- `rg` found legacy blur references in `PlatformGlassBackground`, root/mobile Jest mappers and mocks, `SenseiMobile/package.json`, `SenseiMobile/package-lock.json`, and `SenseiMobile/ios/Podfile.lock`.

## Impact Analysis

- Change classification: configuration/interface/UI fallback cleanup.
- Risk level: 2/5.
- Technical impact: removes a native dependency and its Jest shims; lockfiles and Pods must be coherent.
- Business/UX impact: unsupported Liquid Glass surfaces will show a deterministic black translucent fill instead of legacy blur; input bar and selection toolbar explicitly pass the same black fallback color.
- Security impact: no new exposure; dependency surface is reduced.
- Operational impact: iOS builds require pod state to stop referencing the removed blur pod.
- Maintenance impact: simpler fallback path and fewer native modules.

## Static Trace And DSE

| Function | Dependencies | Side effects | Risk |
| --- | --- | --- | --- |
| `PlatformGlassBackground` | React Native `Platform`, `View`, `LiquidGlassView`, logger | Fallback warning log only | Low |
| `InputBar` | `PlatformGlassBackground`, input/send UI | UI rendering and layout callbacks | Medium visual regression |
| `SelectionOverlay` | `PlatformGlassBackground`, toolbar layout helper | UI rendering and action callbacks | Medium visual regression |

## Validation Plan

- Search for remaining `@react-native-community/blur`, `BlurView`, and `iosFallbackBlur` references.
- Run focused mobile renderer test for `PlatformGlassBackground`.
- Run package check to confirm `@react-native-community/blur` is absent.
- Run `pod install` or an equivalent lockfile refresh so `Podfile.lock` no longer references `react-native-blur`.

Core analysis complete. I have mapped the execution trace and identified all dependencies and side effects. I am now ready to proceed with the Comprehensive Impact Analysis cleanup execution.

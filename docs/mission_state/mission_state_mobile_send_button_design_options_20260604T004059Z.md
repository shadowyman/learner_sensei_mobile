# Mission State: Mobile Send Button Design Options

## Scope

User requested five elegant redesigned send button options in a prototype HTML file under `tmp/`. Production code must not be changed in this pass. User explicitly limited protocol execution to Core Analysis only.

## Analyzer Runs

- `npm run analysis:run -- --include SenseiMobile/src/mobile/components/InputBar.tsx,SenseiMobile/src/mobile/components/CodeEditorBadge.tsx,SenseiMobile/src/mobile/components/SendIconSkia.tsx,SenseiMobile/src/mobile/theme`
- `npm run analysis:run -- --include SenseiMobile/src/mobile/components/InputBar.tsx,SenseiMobile/src/mobile/components/CodeEditorBadge.tsx,SenseiMobile/src/mobile/components/SendIconSkia.tsx,SenseiMobile/src/mobile/theme --entry SenseiMobile/src/mobile/components/InputBar.tsx::InputBar --maxDepth 4`

## Entry Points And Scope

- Primary entry point: `SenseiMobile/src/mobile/components/InputBar.tsx::InputBar`
- Visual composition scope:
  - `SenseiMobile/src/mobile/components/InputBar.tsx`
  - `SenseiMobile/src/mobile/components/CodeEditorBadge.tsx`
  - `SenseiMobile/src/mobile/components/SendIconSkia.tsx`
  - `SenseiMobile/src/mobile/theme/gradients.ts`
  - `SenseiMobile/src/mobile/components/PlatformGlassBackground.tsx`

## Hot Modules

- `InputBar.tsx`: top fan-out file in scoped analyzer output. Owns text input, send button, action stack, and editor badge overlay.
- `gradients.ts`: highest scoped fan-in. Owns `withAlpha`, `lightenColor`, `ensureReadable`, `shiftHue`, and `deriveSendGradient`.
- `CodeEditorBadge.tsx`: uses theme-derived color transforms and is positioned near the send button.
- `SendIconSkia.tsx`: owns the unchanged play/send icon.

## Static Execution Trace

1. `InputBar` receives `themeColors`, `disabled`, `onSubmit`, and `onOpenEditor`.
2. `InputBar` derives `sendGradientColors` via `deriveSendGradient(themeColors)`.
3. `InputBar` derives `sendBaseColor` from `themeColors.linear[1]` using `lightenColor` and `ensureReadable`.
4. `InputBar` derives `sendBorderColor` using `withAlpha`, `lightenColor`, and `ensureReadable`.
5. `InputBar` derives `innerRingColor` using `shiftHue`, `lightenColor`, and `ensureReadable`.
6. `InputBar` renders the send button as a 44 x 44 `TouchableOpacity` with absolute base and gradient layers, a 34 x 34 `sendIconWell`, and `SendIconSkia size={14}`.
7. `InputBar` renders `CodeEditorBadge size={26}` in an absolute overlay when the keyboard is hidden, passing `borderColorOverride={innerRingColor}`.
8. `CodeEditorBadge` derives its own themed gradient and background using `lightenColor`, `withAlpha`, and `ensureReadable`.
9. `SendIconSkia` renders the same triangular play/send icon with a 1 px x-axis translation.

## Dependency And Side-Effect Analysis

| Function or component | Dependencies | Side effects | Risk ranking |
| --- | --- | --- | --- |
| `InputBar` | React state/hooks, `Keyboard`, `TextInput`, `TouchableOpacity`, `PlatformGlassBackground`, `CodeEditorBadge`, `SendIconSkia`, `deriveSendGradient`, `withAlpha`, `lightenColor`, `ensureReadable`, `shiftHue`, `logger` | Render composition, local text state changes, optional `onSubmit`, debug logging | Medium visual blast radius; low external I/O risk for design prototype because production code is untouched |
| `CodeEditorBadge` | Skia SVG, `LinearGradient`, theme helpers | Render-only badge composition | Medium visual interaction risk because it overlaps send button and shares `innerRingColor` |
| `SendIconSkia` | Skia canvas path | Render-only icon | Low risk; user requires keeping the icon |
| `deriveSendGradient` and color helpers | Pure color parsing and HSL transforms | None in analyzer output | Low risk; reusable theme-color basis for prototype |
| `PlatformGlassBackground` | Liquid Glass support detection, fallback `View`, logger | Fallback warning log when unsupported | Low prototype risk; relevant as background context only |

Analyzer side-effect summary found no network, filesystem, or state-changing side effects in the focused visual/color scope.

## Risk Register

- Risk: repeating the existing absolute-layer stack may preserve the ring artifact. Mitigation: prototype designs avoid relying on a hidden nested RN ring concept as the sole visual identity.
- Risk: editor badge overlay may visually conflict with the send button. Mitigation: prototype presents self-contained send-button shapes and avoids sharing a tiny border accent with the editor badge.
- Risk: theme colors may be too dark or too close together. Mitigation: prototype derives accents from the same theme base using hue shifts, lightening, alpha, and contrast fallback.

## Coverage Checklist

- `SenseiMobile/src/mobile/components/InputBar.tsx::InputBar#2d57e873f004`
- `SenseiMobile/src/mobile/components/CodeEditorBadge.tsx::CodeEditorBadge#e99ba79f75fd`
- `SenseiMobile/src/mobile/components/SendIconSkia.tsx::SendIconSkia#db1293e1c0a2`
- `SenseiMobile/src/mobile/theme/gradients.ts::deriveSendGradient#e8635c5d81d4`
- `SenseiMobile/src/mobile/theme/gradients.ts::lightenColor#3d14cbc098a3`
- `SenseiMobile/src/mobile/theme/gradients.ts::shiftHue#c29f8672898f`
- `SenseiMobile/src/mobile/theme/gradients.ts::withAlpha#b65ae54809c7`
- `SenseiMobile/src/mobile/theme/gradients.ts::ensureReadable#de803ad0b828`

## Unknowns Register

| Unknown | Impact | Verification plan | Owner and target |
| --- | --- | --- | --- |
| Whether the final selected HTML design maps cleanly to React Native `TouchableOpacity`, `LinearGradient`, and Skia layers | Medium | After user picks an option, translate it into RN and validate in simulator | Codex during implementation pass |
| Whether the editor badge overlay should remain in the same position after send button replacement | Medium | Compare selected send design against current 26 px badge position and adjust only after user choice | Codex during implementation pass |
| Whether the chosen design should remain circular or become a rounded pill/diamond/soft-square in production | Low | User selection from prototype determines shape | User during design review |

## Architectural Insights

- The current bug is best treated as a visual layer identity issue, not as another size adjustment.
- The redesign should keep the theme-derived color approach but create a new button surface from scratch.
- The unchanged Skia play/send icon can sit inside multiple candidate shapes without changing `SendIconSkia`.

## Clarified Mission Objective

Create five visual design options in a standalone prototype HTML file in `tmp/`, using theme-derived color transformations and the same triangular play/send icon. Do not modify production code in this pass.

## Protocol Decision

No further protocol will run in this pass because the user explicitly requested Core Analysis only. The next action is prototype creation.

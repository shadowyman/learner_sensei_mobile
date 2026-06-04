# Mission State: Responsive Option 1 Send Button

## Scope

Implement the selected Option 1 glass-orb send button in `SenseiMobile/src/mobile/components/InputBar.tsx`. The change must keep theme-selector-driven colors, preserve submit/editor behavior, and scale the whole send control by device class:

- Compact iPhone: button 46, icon 13, inner well 36.
- Default iPhone: button 52, icon 14, inner well 40.
- iPad: button 60, icon 16, inner well 46.

The user explicitly overrode the broader feature protocol and requested Core Analysis only before implementation.

## Analyzer Runs

- `npm run analysis:run -- --include SenseiMobile/src/mobile/components/InputBar.tsx,SenseiMobile/src/mobile/components/CodeEditorBadge.tsx,SenseiMobile/src/mobile/components/SendIconSkia.tsx,SenseiMobile/src/mobile/theme --entry SenseiMobile/src/mobile/components/InputBar.tsx::InputBar --maxDepth 4`

## Entry Point And Scope

- Primary entry point: `SenseiMobile/src/mobile/components/InputBar.tsx::InputBar#2d57e873f004`
- Production edit target: `SenseiMobile/src/mobile/components/InputBar.tsx`
- Unchanged dependencies:
  - `SenseiMobile/src/mobile/theme/gradients.ts`
  - `SenseiMobile/src/mobile/components/SendIconSkia.tsx`
  - `SenseiMobile/src/mobile/components/CodeEditorBadge.tsx`
  - `SenseiMobile/src/mobile/components/PlatformGlassBackground.tsx`

## Hot Modules

- `InputBar.tsx`: top fan-out file in the scoped analyzer result. Owns send button composition, submit handling, editor badge overlay, and theme color derivation.
- `gradients.ts`: highest scoped fan-in. Owns the reusable color transforms used by send and editor controls.
- `CodeEditorBadge.tsx`: related overlay near the send button and uses theme-derived colors.
- `SendIconSkia.tsx`: unchanged send/play icon rendering.

## Static Execution Trace

1. `InputBar` receives `themeColors`, `disabled`, `onSubmit`, and `onOpenEditor`.
2. `InputBar` will derive compact/default/iPad metrics from `useWindowDimensions`, `Platform.OS`, and `(Platform as any).isPad`.
3. `InputBar` derives send colors from `themeColors.linear[1]` using existing helpers from `gradients.ts`.
4. `InputBar` renders the selected glass-orb send button layers and passes the responsive icon size to `SendIconSkia`.
5. `InputBar` keeps the keyboard-hidden `CodeEditorBadge` overlay and passes the theme-derived ring color to it.
6. `handleSubmit`, keyboard listeners, text input configuration, and editor-open callback remain unchanged.

## Dependency And Side-Effect Analysis

| Function or component | Dependencies | Side effects | Risk ranking |
| --- | --- | --- | --- |
| `InputBar` | React hooks, `Keyboard`, `TouchableOpacity`, `TextInput`, `LinearGradient`, `PlatformGlassBackground`, `CodeEditorBadge`, `SendIconSkia`, theme helpers, `logger` | Local text state, optional submit callback, debug logging already present | Medium visual layout risk, low external side-effect risk |
| `deriveSendGradient`, `lightenColor`, `shiftHue`, `withAlpha`, `ensureReadable` | Pure color parsing and HSL transforms | None reported by analyzer | Low risk |
| `SendIconSkia` | Skia path rendering | Render only | Low risk |
| `CodeEditorBadge` | Theme helpers, Skia SVG, gradient layer | Render only | Medium visual overlap risk due adjacent overlay |

Analyzer output reported no network, filesystem, or state-changing side-effect hotspots in the scoped visual surface.

## Risk Register

- Compact iPhone crowding: the input bar could lose horizontal space if the action area grows. Mitigation: use 46 px compact button and keep existing keyboard-visible right padding reduction.
- iPad scale mismatch: a larger button could make the editor badge offset feel detached. Mitigation: use dedicated iPad overlay offsets.
- Theme contrast: dark or low-luminance theme colors could collapse the glass effect. Mitigation: keep `ensureReadable` fallbacks and derive highlight/ring colors from shifted/lightened theme base.
- Artifact recurrence: preserving the old layer stack could keep the bug. Mitigation: replace the previous base/gradient/well structure with new orb, highlight, and inner-well layers.

## Coverage Checklist

- `SenseiMobile/src/mobile/components/InputBar.tsx::InputBar#2d57e873f004`
- `SenseiMobile/src/mobile/theme/gradients.ts::deriveSendGradient#e8635c5d81d4`
- `SenseiMobile/src/mobile/theme/gradients.ts::lightenColor#3d14cbc098a3`
- `SenseiMobile/src/mobile/theme/gradients.ts::shiftHue#c29f8672898f`
- `SenseiMobile/src/mobile/theme/gradients.ts::withAlpha#b65ae54809c7`
- `SenseiMobile/src/mobile/theme/gradients.ts::ensureReadable#de803ad0b828`
- `SenseiMobile/src/mobile/components/SendIconSkia.tsx::SendIconSkia#db1293e1c0a2`
- `SenseiMobile/src/mobile/components/CodeEditorBadge.tsx::CodeEditorBadge#e99ba79f75fd`

## Unknowns Register

| Unknown | Impact | Verification plan | Owner and target |
| --- | --- | --- | --- |
| Whether visual spacing is perfect on all simulator sizes | Medium | Run simulator visual QA after implementation; inspect compact iPhone, default iPhone, and iPad | Codex/user during validation |
| Whether existing targeted tests cover `InputBar` directly | Low | Search showed no direct `InputBar` test; run mobile/MainScreen tests available and TypeScript validation | Codex after implementation |

## Clarified Objective

The selected design is Option 1 from the prototype. The shape/style changes to the glass orb, but colors remain driven by the current theme selector pipeline. The whole control scales by compact iPhone/default/iPad rather than scaling only the icon.

## Protocol Decision

Per user instruction, no Impact Analysis, Feature Implementation protocol, RCI, feature-document creation, or commit/push protocol will run in this pass. Proceed after Core Analysis with the required backup, implementation, and scoped validation.

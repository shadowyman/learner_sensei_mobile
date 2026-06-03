# Mission State: Redirect Selection Overlay Tests

## Scope

- Objective: redirect root SelectionOverlay controller tests from stale `src/mobile/SelectionOverlay.tsx` to the live `SenseiMobile/src/mobile/SelectionOverlay.tsx`, then remove the stale root overlay copy if validation passes.
- Entry candidates from analyzer: `SenseiMobile/src/mobile/SelectionOverlay.tsx`, `src/mobile/SelectionOverlay.tsx`.
- Test consumers: `__tests__/SelectionOverlayController.test.ts`, `__tests__/MobileParitySentinel.test.ts`.

## Analyzer Findings

- Scoped analyzer command: `npm run analysis:run -- --include src/mobile/SelectionOverlay.tsx,SenseiMobile/src/mobile/SelectionOverlay.tsx,__tests__/SelectionOverlayController.test.ts,__tests__/MobileParitySentinel.test.ts,src/mobile/selectionToolbarLayout.ts`.
- Top fan-out: `SenseiMobile/src/mobile/SelectionOverlay.tsx` imports logger, bridge manager/contracts, shared toolbar layout helper, and `PlatformGlassBackground`.
- Duplicate root overlay imports logger, bridge manager/contracts, and the shared toolbar layout helper.
- Shared layout helper `src/mobile/selectionToolbarLayout.ts` has fan-in from both overlays and no analyzer side effects.

## Static Execution Trace

1. `SelectionOverlayController.constructor` stores the bridge and `onChange` callback.
2. `SelectionOverlayController.handleWebMessage` receives `selection` or `selection:clear`.
3. On `selection`, controller writes visible selection state and invokes `onChange`.
4. On `selection:clear`, controller calls `dismiss`.
5. `SelectionOverlayController.invoke` guards missing `selectionId`, logs bridge invocation, enqueues `selectionSensei:invoke`, and dismisses.
6. `SelectionOverlayController.dismiss` writes hidden state and invokes `onChange`.

## Dependency And Side Effects

| Function | Dependencies | Side effects | Risk |
| --- | --- | --- | --- |
| `SelectionOverlayController.constructor` | `BridgeManager`, `onChange` callback | Writes `this.bridge`, `this.onChange` | Medium state-write |
| `SelectionOverlayController.handleWebMessage` | `WebToRNMessage`, `dismiss` | Writes `this.state`, calls `onChange` | Medium state-write |
| `SelectionOverlayController.invoke` | `logger`, `BridgeManager.enqueue`, `dismiss` | Enqueues bridge message and logs | Medium bridge behavior |
| `SelectionOverlayController.dismiss` | `onChange` callback | Writes hidden `this.state` | Medium state-write |

## Impact Analysis

- Change classification: Interface/Test cleanup.
- Risk level: 2/5. Runtime mobile code is not intended to change; root tests should exercise the live app controller export instead of a duplicate.
- Technical impact: remove duplicated stale overlay implementation and prevent root tests from drifting away from the app overlay.
- Business impact: lowers risk that tests pass against stale selection behavior while the real mobile overlay differs.
- Security impact: none identified.
- Operational impact: focused Jest evidence is enough; no native rebuild required for this cleanup.
- Maintenance impact: improves ownership by keeping one overlay implementation.

## Unknowns And Verification Plan

- Unknown: root `src/mobile/MainScreen.tsx` is untracked and imports the stale overlay. Impact is low for tracked code, but it may be part of another in-progress user-owned workflow. Verification: do not modify or delete untracked `src/mobile/MainScreen.tsx`; report that it remains affected if the stale overlay is removed.
- Unknown: root Jest may need mocks for nested `SenseiMobile` native dependencies when importing the live overlay. Impact is medium for test execution. Verification: run `npm test -- __tests__/SelectionOverlayController.test.ts __tests__/MobileParitySentinel.test.ts --silent --bail --noStackTrace`.

## Coverage Checklist

- `__tests__/SelectionOverlayController.test.ts`
- `__tests__/MobileParitySentinel.test.ts`
- Import search for `../src/mobile/SelectionOverlay` and `src/mobile/SelectionOverlay`

Core analysis complete. I have mapped the execution trace and identified all dependencies and side effects. I am now ready to proceed with the Comprehensive Impact Analysis cleanup execution.

# Mission State: Color Formatting Core Analysis (2025-10-07)

## Analysis Scope & Entry Points
- Focused on CLI dashboard rendering pipeline in `scripts/review_mediator/dashboard.ts` (functions `style`, `badge`, `stateColor`, `stateTag`, `DashboardRenderer.*`, and `LegacyDashboardRenderer.*`).
- Considered log formatting hooks (`formatLogEntry`, `formatLogDetails`) that layer ANSI styling on agent output.
- Captured front-end color theme definitions rooted in `index.css` (CSS custom properties and gradients).
- Downstream consumers: `scripts/review_mediator.ts` (instantiates `DashboardRenderer`), blessed screen widgets, and terminal stdio.

## Static Execution Trace (color surface)
1. `DashboardRenderer.render` orchestrates interactive rendering → `buildHeader`, `renderTabs`, `buildStatusContent`, `renderLogs`, `syncStatusScroll`.
2. `buildHeader` → `badge` → `style` to wrap header badges with foreground/background SGR codes.
3. `buildStatusContent` iterates artifacts → `renderStatusBlock`.
4. `renderStatusBlock` → `stateColor` + `stateTag` + `spinnerGlyph` + `style`/`wrapPlain` to produce colored banners, descriptions, AI lines.
5. `renderLogs` → `formatLogEntry` → `formatLogDetails` → `style` for timestamp, command, exit-code coloration; caches separators via `style`.
6. `spinnerGlyph` cycles spinner frames with cyan/gray SGR via `style`.
7. Non-interactive fallback: `LegacyDashboardRenderer.render` → `buildFrame` → `formatStatus` → `spinner`/`stateLabel`; emits plain text with minimal control codes (`\u001b[K`).
8. Web UI color palette resolved through CSS variables in `index.css`; React components bind to variables (out of trace scope but noted for parity).

## Dependency & Side-Effect Table
| Function | Key Dependencies | Side Effects | Risk |
| --- | --- | --- | --- |
| `style` | `SGR` constants | None | Low – core formatter, failure breaks styling globally |
| `badge` | `style` | None | Low |
| `stateColor` | `SGR` map | None | Medium – incorrect mapping miscolors states |
| `stateTag` | Enum mapping | None | Low |
| `DashboardRenderer.buildHeader` | `badge`, `style` | None | Medium – header badges communicate status counts |
| `DashboardRenderer.buildStatusContent` | `renderStatusBlock`, `style`, `wrapPlain`, `truncate` | Writes `spinnerIndex` | Medium – spinner cadence & active block detection depend on it |
| `DashboardRenderer.renderStatusBlock` | `stateColor`, `stateTag`, `spinnerGlyph`, `style`, `wrapPlain`, `truncateLabel` | None | High – primary color application for statuses |
| `DashboardRenderer.renderLogs` | `style`, `formatLogEntry`, `updateLogViewport` | Writes log caches/anchors | Medium – misformatting hides log emphasis |
| `DashboardRenderer.spinnerGlyph` | `style` | None | Low |
| `DashboardRenderer.render` | Blessed widgets, `buildHeader`, `renderLogs`, `buildStatusContent` | Writes widget state (`statusLines`, `logViewport`, etc.) | Medium – orchestrates layout/refresh |
| `DashboardRenderer.formatLogEntry` | `style`, `formatLogDetails`, regex parsing | None | Medium – log meta coloring |
| `DashboardRenderer.formatLogDetails` | `style`, `normalizeCommand`, `wrapPlain` | None | Medium – command/status/exit code tinting |
| `LegacyDashboardRenderer.buildFrame` | `formatStatus`, `limitLogLength` | None | Low – plain-text fallback |
| `LegacyDashboardRenderer.formatStatus` | `spinner`, `stateLabel` | None | Low |
| `index.css` root variables | CSS variable consumers | None | Medium – central theme palette for web UI |

## Unknowns Register
| Item | Impact | Verification Plan |
| --- | --- | --- |
| Terminal capability detection for color (e.g., `TERM=dumb`, Windows cmd) | Medium – incorrect assumption yields raw escape codes | Validate `style` usage under non-color terminals; consider feature flag/toggling test |
| Accessibility (color contrast / colorblind modes) across CLI & web | High – red/green reliance may hinder accessibility | Review usability requirements; audit `stateColor` and CSS palette vs WCAG contrasts |
| Relationship between CSS variables and React components (runtime overrides, theming) | Medium – theme drift could desync colors from UX guidelines | Trace primary components (`ui.ts`, styled components) to confirm usage; inventory dynamic overrides |
| Redundant `SGR` entries (e.g., `lightGreenBg`) | Low – unused constants increase maintenance load | Search references; prune or document intended consumer |

## Risk Register (High/Medium)
- `renderStatusBlock` miscoloring hides ERROR vs REMEDIATING distinctions (High impact on triage).
- Spinner/active tracking (`buildStatusContent`, `spinnerGlyph`) rely on consistent refresh cadence; drift makes UI appear frozen (Medium).
- Web UI color tokens centralized in `index.css`; unintended edits ripple across product (Medium).
- Accessibility gap if color is sole status signal (High) – currently no supplemental glyph for colorblind users.

## Coverage Checklist
- `scripts/review_mediator/dashboard.ts::style`
- `scripts/review_mediator/dashboard.ts::badge`
- `scripts/review_mediator/dashboard.ts::stateColor`
- `scripts/review_mediator/dashboard.ts::stateTag`
- `scripts/review_mediator/dashboard.ts::DashboardRenderer.buildHeader`
- `scripts/review_mediator/dashboard.ts::DashboardRenderer.buildStatusContent`
- `scripts/review_mediator/dashboard.ts::DashboardRenderer.renderStatusBlock`
- `scripts/review_mediator/dashboard.ts::DashboardRenderer.renderLogs`
- `scripts/review_mediator/dashboard.ts::DashboardRenderer.formatLogEntry`
- `scripts/review_mediator/dashboard.ts::DashboardRenderer.formatLogDetails`
- `scripts/review_mediator/dashboard.ts::DashboardRenderer.spinnerGlyph`
- `scripts/review_mediator/dashboard.ts::LegacyDashboardRenderer.buildFrame`
- `scripts/review_mediator/dashboard.ts::LegacyDashboardRenderer.formatStatus`
- `scripts/review_mediator/dashboard.ts::LegacyDashboardRenderer.spinner`
- `index.css` root palette definitions

## Architectural Insights
- Interactive CLI uses ANSI SGR layering via helper `style`, ensuring consistent reset handling; all higher-order functions funnel through it.
- Status coloring keyed off `ArtifactState`, making error/highlight logic centralized in `stateColor`/`stateTag`.
- Logs leverage semantic color coding (cyan commands, magenta categories, red failures) to visually parse agent output.
- Non-interactive fallback intentionally avoids color to remain compatible with basic terminals.
- Web UI shares a separate theme system via CSS variables; no direct coupling to CLI SGR palette, so cross-channel consistency requires manual alignment.

## Next Protocol
- Pending user direction; no subsequent major protocol triggered yet.

## Test Traceability Notes
- CLI color verification should capture `DashboardRenderer.renderStatusBlock` output under varying states (`Pending`, `Remediating`, `Error`).
- CSS theme validation should snapshot key UI components to ensure variables propagate as intended.

Core analysis complete. Prepared to answer color-formatting questions or proceed to further protocols on request.

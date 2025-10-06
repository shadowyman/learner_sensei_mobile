# Core Analysis Checkpoint – Debugger Console Header Controls (2025-10-05)

## Scope & Entry Points
- `index.tsx::loadCurriculumAndGreet#1f921a5e6cf7` bootstraps Sensei, calling `initializeUI` and `initializeGoogleAI` that set up both the main header and the debugger console wiring.
- `ui.ts::initializeUI#28eac9f1c8d2` and `ui.ts::setupControlsRevealPersistence#ceee8667da8e` introduce the new top-right header collapse behavior via the shared `.chat-window-controls` class.
- `index.tsx::initializeGoogleAI#2a6560a49baa` invokes `debugMode.ts::initializeDebugMode#9d690e970bb2`, which binds every debugger modal control including the missing menu buttons.
- Presentation assets (`index.html`, `index.css`) define the shared weighted header layout; the CSS rule `.chat-window-controls button { width: 0; opacity: 0; visibility: hidden; }` is now the critical coupling point.

## Static Execution Trace
1. `index.tsx::loadCurriculumAndGreet#1f921a5e6cf7` → `ui.ts::initializeUI#28eac9f1c8d2` (top-right controls collapse contract applied to the first `.chat-window-controls`).
2. `ui.ts::initializeUI#28eac9f1c8d2` → `ui.ts::setupControlsRevealPersistence#ceee8667da8e` (hover-based `data-expanded` toggling limited to the first controls container).
3. Module top-level: `debugModeButton.addEventListener('click', () => toggleDebugModalVisibility(true))` at `index.tsx:1226` (makes debugger header rely on the shared class).
4. `index.tsx::initializeGoogleAI#2a6560a49baa` → `debugMode.ts::initializeDebugMode#9d690e970bb2` (modal wiring and control buttons live inside the debugger header).
5. `debugMode.ts::initializeDebugMode#9d690e970bb2` → `debugMode.ts::toggleDebugModalVisibility#f556582e3531` (close button and other handlers call the exported visibility toggle).
6. Global CSS (`index.css` lines 720-804) collapses every `.chat-window-controls` instance unless `data-expanded="true"`, so the debugger header stays hidden because no debugger code toggles that dataset flag.

## Dependency & Side-Effect Table
| Function (Stable ID) | Key Dependencies | Side Effects & Risk Notes |
| --- | --- | --- |
| `index.tsx::loadCurriculumAndGreet#1f921a5e6cf7` | `initializeUI`, `initializeGoogleAI`, `initializeCodeEditorModal`, `initializeEnhancementManager`, `setupFullscreenToggle` | Registers numerous `window` globals and kicks off async boot. Risk: medium blast because mis-ordering affects both main UI and debugger boot cadence. |
| `ui.ts::initializeUI#28eac9f1c8d2` | `renderIcons`, `setupThemePalette`, `setupHeaderEllipsisAnimation`, `setupControlsRevealPersistence`, `setupMermaidThemeControls` | Heavy DOM wiring plus global exposures for Mermaid helpers. Risk: medium—any regression changes header behavior app-wide. |
| `ui.ts::setupControlsRevealPersistence#ceee8667da8e` | `document.querySelector('.chat-window-controls')`, `Element.closest`, `window.setTimeout` | Adds hover listeners that write `data-expanded` on only the first controls container. Risk: high—other `.chat-window-controls` instances never expand, causing hidden debugger controls. |
| `index.tsx::initializeGoogleAI#2a6560a49baa` | `GoogleGenAI`, `logAiInitialization`, `debugMode.ts::initializeDebugMode` | Writes `window.ai`, instantiates Gemini chat, hands control to debugger setup. Risk: medium (stateful global, depends on manifest availability). |
| `debugMode.ts::initializeDebugMode#9d690e970bb2` | `setupFullscreenToggle`, `populateFileList`, `setupTextareaAutosize`, debugger-specific handlers | Binds all debugger DOM controls, including menu button handlers. Risk: medium-high—missing elements abort initialization; relies on shared CSS classes. |
| `debugMode.ts::toggleDebugModalVisibility#f556582e3531` | None | Toggles modal display and focuses the debugger textarea. Risk: low—straightforward DOM style mutation. |

## Risk Register
- High: Global CSS collapse rule for `.chat-window-controls` (index.css:720-804) hides every button unless a dataset flag is set; debugger modal never sets it, so controls disappear.
- High: `ui.ts::setupControlsRevealPersistence#ceee8667da8e` targets only the first `.chat-window-controls`; additional instances (debugger, future modals) inherit collapse without relief.
- Medium: `debugMode.ts::initializeDebugMode#9d690e970bb2` assumes all debugger buttons share the main header class; any structural change in the main header propagates immediately.

## Coverage Checklist (Functions to Observe/Test)
- `index.tsx::loadCurriculumAndGreet#1f921a5e6cf7`
- `ui.ts::initializeUI#28eac9f1c8d2`
- `ui.ts::setupControlsRevealPersistence#ceee8667da8e`
- `index.tsx::initializeGoogleAI#2a6560a49baa`
- `debugMode.ts::initializeDebugMode#9d690e970bb2`
- `debugMode.ts::toggleDebugModalVisibility#f556582e3531`
- `index.css` `.chat-window-controls` collapse rule (manual verification of visual state)

## Assumptions & Unknowns
| Item | Impact | Verification Plan | Owner / Target |
| --- | --- | --- | --- |
| Confirm expected debugger header behavior: should its controls always remain visible instead of collapsing like the main header? | High | Ask requester for confirmation during Step 6 clarifications; inspect historical styles if needed. | Self / before starting bug protocol |
| Determine preferred decoupling strategy (unique class vs. dedicated dataset toggling) to keep debugger independent from main header animations. | Medium | Prototype options after user guidance; review CSS to ensure minimal blast radius. | Self / during forthcoming impact analysis |

## Architectural Insights
- The new weighted header architecture centralizes control visibility behind `data-expanded` and assumes a single `.chat-window-controls` instance; duplicate usage breaks without additional scripting.
- Debugger modal inherits the shared header markup and styling but lacks the hover/animation controller, exposing the tight coupling between CSS and JavaScript for the main header.
- Reusing global classes across independent surfaces now poses a maintenance risk; future fixes should isolate debugger styling or provide opt-out hooks.

## Next Protocol
- Pending user approval to launch the **Mandatory Adaptive Root Cause Analysis & Remediation Protocol** for debugger console menu regression.

## Test Traceability Notes
- No automated test plan defined yet; once remediation approach is clear, target UI regression coverage around debugger header visibility and control interaction.

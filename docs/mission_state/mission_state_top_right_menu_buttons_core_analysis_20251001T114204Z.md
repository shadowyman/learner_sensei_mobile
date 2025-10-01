# Mission State Checkpoint — Top-Right Menu Buttons (Core Analysis)

Scope: Analyze structure, handlers, and dependencies for the top-right header controls.

## Entry Points (elements → handler)
- #font-size-toggle → ui.ts::setupFontSizeControls
- #theme-button → ui.ts::setupThemePalette
- #controls-ellipsis → ui.ts::setupHeaderEllipsisAnimation
- #debug-mode-button → ui.ts::setupMermaidThemeControls
- #main-chat-fullscreen-button → ui.ts::setupFullscreenToggle (wired from index.tsx::loadCurriculumAndGreet)
- #save-button, #load-button, #load-file-input → index.tsx::initializeSaveLoadUI
- #notepad-button → notepad.ts::Notepad.attachEventListeners

## Focused Traces (saved artifacts)
- tmp/analysis/focused_trace_font_size.txt
- tmp/analysis/focused_trace_theme_palette.txt
- tmp/analysis/focused_trace_ellipsis.txt
- tmp/analysis/focused_trace_debug_theme.txt
- tmp/analysis/focused_trace_fullscreen.txt
- tmp/analysis/focused_trace_save_load_ui.txt
- tmp/analysis/focused_trace_notepad_attach.txt

## Dependency & Side-Effect Highlights
- Font size: toggles `#chat-container.dataset.fontSize` among preset sizes. DOM reads via getElementById.
- Theme palette: builds overlay panel, stores selected theme in `localStorage`, updates CSS variables, manages hover/escape/resize/scroll listeners; uses `setThemeVariables` and `THEME_OPTIONS`.
- Ellipsis: idle animation on `.ellipsis-dot` + `.ellipsis-plus-svg`, suspends on hover/focus within `.chat-window-controls`.
- Debug button: double-click to cycle Mermaid theme via `cycleMermaidTheme()`; click counter/timer logic.
- Fullscreen: toggles class on `#chat-container`; swaps icon via `.icon-placeholder` dataset and `renderIcons`.
- Save/Load: save uses `SaveLoadProgressManager.saveProgress()`; load uses hidden file input and `SaveLoadProgressManager.loadProgress(file)`; adds Ctrl/Cmd+S shortcut; logs via `logger` and `logSaveloadValidation`.
- Notepad: opens modal, export/import HTML via `NotepadExporter`/`NotepadImporter`; file input change handler async; state tracked in class.

## Risks & Considerations (DSE/Risk Register)
- Missing elements: handlers guard with null checks; silent no-op if controls absent.
- Event duplication: init order repeats should be avoided; current code appears idempotent but duplicates could stack listeners if re-invoked.
- LocalStorage: theme persistence can fail in privacy contexts; code swallows errors.
- Accessibility: Theme panel uses `aria-expanded`/`aria-hidden`; ensure focus return works across modals; ellipsis animation pauses on interaction.
- Performance: Ellipsis setInterval cadence and multiple global listeners (resize/scroll) managed with visibility checks.
- CSS dependencies: Fullscreen and font size depend on CSS classes/vars in index.css; ensure styles exist for all sizes and fullscreen class.

## Coverage Checklist (what to verify manually/with tests)
- Click font-size cycles sizes and persists visually across reflows.
- Theme panel opens/positions; selecting theme updates variables and persists; Esc/blur hides; hover preview restores active theme on exit.
- Ellipsis animates when idle; pauses during hover/focus; resumes afterward.
- Debug button double-click cycles mermaid theme; single clicks do not trigger toggles.
- Fullscreen button toggles container class and icon/labels; initial auto-click works.
- Save/Load: Save produces file; Load via button and via Ctrl/Cmd+S; error paths log appropriately.
- Notepad: Header button toggles modal; export/import flows operate; modal close on backdrop click.

## Unknowns & Assumptions
- “Top-right menu” refers to the header controls in `.chat-window-controls` (main header), not the debug modal’s header controls.
- No server interactions for these buttons (pure client DOM + localStorage + file IO via browser APIs).
- Icon rendering uses `renderIcons` and inline placeholders; assumes icons exist for `fullscreen`/`fullscreen_exit`.

## Next Protocol Candidate
- Pending user objective: choose one of — Impact Analysis (if planning changes), Root Cause Analysis (if bug observed), or Feature Implementation (if enhancing behavior/UI).


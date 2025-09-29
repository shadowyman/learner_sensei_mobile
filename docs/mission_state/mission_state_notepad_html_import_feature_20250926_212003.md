# Mission State: Notepad HTML Import Feature

## Analysis Scope & Entry Points
- `Notepad.createModal` (notepad.ts:117) – builds modal DOM skeleton containing export controls.
- `Notepad.attachEventListeners` (notepad.ts:141) – wires modal controls, including export button binding to HTML export.
- `Notepad.exportToHTML` (notepad.ts:450) – disables UI, routes through exporter, logs success/failure.
- `Notepad.renderNotes` (notepad.ts:190) – regenerates grouped note DOM after mutations.
- `Notepad.addNote` (notepad.ts:72) – primary mutation entry that pushes notes and triggers renders.
- `NotepadExporter.exportToHTML` (notepadExporter.ts:15) – orchestrates HTML generation/download.
- `NotepadExporter.generateStyledHTML` (notepadExporter.ts:25) – renders module/concept layout used by exports we must parse.
- `NotepadExporter.downloadHTML` (notepadExporter.ts:411) – materializes blob, synthetic anchor, triggers download.
- `ui.ts::showConceptAdvanceConfirmation` (ui.ts:383) – existing modal pattern we will reuse for import errors.

## Static Execution Trace (Baseline)
1. `Notepad.createModal` → creates modal container, injects header with 📄 Export control, appends to document.
2. `Notepad.attachEventListeners`
   - binds `#notepad-button` → `Notepad.toggleModal`
   - binds export button click → `Notepad.exportToHTML`
   - binds close interactions → `Notepad.closeModal`
3. `Notepad.exportToHTML`
   - logs `[NOTEPAD_ACTIVITY]` export-started
   - disables export button UI
   - delegates to `NotepadExporter.exportToHTML`
   - logs completion, restores button state, warns on error via `logger.error`
4. `NotepadExporter.exportToHTML`
   - calls `generateStyledHTML` → collects grouped notes, renders module/concept sections, note cards, metadata
   - calls `downloadHTML` → Blob + anchor click to download file
   - logs `[NOTEPAD_EXPORT]`
5. `Notepad.renderNotes`
   - rebuilds grouped markup via `createNoteCard`
   - reattaches delegated listeners with `attachNoteEventListeners`

## Dependency & Side-Effect Table
| Function | Dependencies | Side Effects | Risk Notes |
|----------|--------------|--------------|------------|
| `Notepad.createModal` | DOM APIs | Writes `this.modalElement`, manipulates DOM tree | Medium DOM churn; ensure import UI integrates without breaking export control layout. |
| `Notepad.attachEventListeners` | `toggleModal`, `exportToHTML`, `closeModal` | DOM queries & listener registration | Listener duplication risk if we add more controls without cleanup. |
| `Notepad.addNote` | `logNotepadActivity`, `renderNotes` | Mutates `state.notes`, optional HTML/quill fields | Import must respect IDs & indices when merging to avoid collisions. |
| `Notepad.renderNotes` | `createNoteCard`, `attachNoteEventListeners` | Mutates container `innerHTML` | Import must trigger re-render once new notes injected. |
| `Notepad.exportToHTML` | `logNotepadActivity`, `NotepadExporter.exportToHTML`, `logger.error` | Temporarily disables export button text/state | Import button must align with same control block and avoid conflicting states. |
| `NotepadExporter.exportToHTML` | `generateStyledHTML`, `downloadHTML`, `logger.info` | None inside function | Safe; import should mirror grouping semantics. |
| `NotepadExporter.generateStyledHTML` | `groupNotesByModule`, `escapeHtml`, `convertToHTML`, `getConceptEmoji` | None | Defines module-section → module-header + note-card DOM contract importer must parse. |
| `NotepadExporter.downloadHTML` | Blob/URL APIs | Creates anchor, appends & clicks, revokes URL | Import must avoid leaving hidden inputs or leaked URLs. |
| `ui.ts::showConceptAdvanceConfirmation` | Promise-based modal helpers | Creates backdrop/modal DOM, attaches events | Reusing pattern requires apt copy to new utility to show import failure without duplicating styles. |

## Risk Register
- `Notepad.addNote`: Medium – merging imported notes without dedup may skew module/concept indexes; mitigation: compute indices via curriculum lookup with fallback section.
- `Notepad.renderNotes`: Medium – full DOM rewrite; ensure importer triggers re-render only after `state.notes` update to maintain event wiring.
- `NotepadExporter.generateStyledHTML`: Medium – contract defines `.module-section`, `.module-header`, `.note-card`, `.concept-title`, `.note-content`, `.note-metadata`. Import parser must tolerate missing optional blocks to avoid state corruption.
- `NotepadExporter.downloadHTML`: Medium – DOM append/remove; ensure import flow introduces its own input cleanup so modal remains accessible.

## Coverage Checklist (Functions to Validate Later)
- `notepad.ts::Notepad.createModal#L117`
- `notepad.ts::Notepad.attachEventListeners#L141`
- `notepad.ts::Notepad.addNote#L72`
- `notepad.ts::Notepad.renderNotes#L190`
- `notepad.ts::Notepad.exportToHTML#L450`
- `notepadExporter.ts::NotepadExporter.exportToHTML#L15`
- `notepadExporter.ts::NotepadExporter.generateStyledHTML#L25`
- `notepadExporter.ts::NotepadExporter.downloadHTML#L411`
- `ui.ts::showConceptAdvanceConfirmation#L383`

## Assumptions & Unknowns
- No new high-impact assumptions identified beyond existing logger external callback usage (Medium impact). Import implementation must avoid introducing additional globals; plan to operate entirely within DOM APIs.

## Key Architectural Insights
- Notepad exporter groups notes by module title string; imported HTML must map titles back to curriculum indices to preserve grouping.
- Exported HTML embeds timestamps inside `.timestamp` elements and note body within `.note-content` preserving original Quill HTML – importer can parse these directly without markdown conversion.
- Modal controls live under `.notepad-header-controls`; new import UI should integrate alongside export control for consistent styling.

## Next Protocol
Prepared to proceed with the **Mandatory Architectural Synthesis Protocol** followed by Principle-Driven Feature Implementation once architecture is approved.

# Mission State: Notepad HTML Import Feature (Core Analysis)

**Timestamp:** 2025-09-26 11:10:01

## Scope & Entry Points
- Files: `index.tsx`, `notepad.ts`, `notepadExporter.ts`, `curriculum.ts`
- Primary entry flow: `index.tsx::loadCurriculumAndGreet` → `notepad.ts::Notepad.initialize` → `Notepad.createModal`/`Notepad.attachEventListeners`
- Target interactions: modal header controls, note rendering pipeline, exporter HTML structure

## Static Execution Trace (Analyzer-Derived)
1. `index.tsx::loadCurriculumAndGreet` fetches `Modules.txt`, calls `parseModulesTxt`, `setCurriculum`, and `notepad.initialize` (per `functions.json` & `calls.json`).
2. `Notepad.initialize` stores curriculum, invokes `Notepad.createModal` then `Notepad.attachEventListeners`.
3. `Notepad.createModal` builds modal DOM (header controls include export button) and appends it to `document.body`.
4. `Notepad.attachEventListeners` wires modal toggle, export button → `Notepad.exportToHTML`, close handlers.
5. User opening modal triggers `Notepad.toggleModal` → `openModal` → `renderNotes` → `attachNoteEventListeners`/`createNoteCard`.
6. Export path today: header click → `Notepad.exportToHTML` → `NotepadExporter.exportToHTML` → `generateStyledHTML` → `groupNotesByModule` → `downloadHTML`.
7. Import feature will parallel step 6 with new handlers, `FileReader`, DOM parsing, note merging, and `renderNotes` refresh.

## Dependency & Side-Effect Table
| Function (file) | Key Dependencies | Major Side Effects | Risk Notes |
| --- | --- | --- | --- |
| `loadCurriculumAndGreet` (index.tsx:1030) | `fetch`, `parseModulesTxt`, `setCurriculum`, `notepad.initialize` | Network I/O, window/global handler assignment, DOM hookups | Medium–High: initialization failure blocks notepad setup |
| `Notepad.initialize` (notepad.ts:58) | `Notepad.createModal`, `Notepad.attachEventListeners` | Mutates internal curriculum/state references | Low: pure wiring but prerequisite for modal availability |
| `Notepad.createModal` (notepad.ts:118) | Template literal, DOM APIs | `document.createElement`, `appendChild`, header controls definition | Medium: incorrect markup breaks modal controls |
| `Notepad.attachEventListeners` (notepad.ts:141) | `document.getElementById`, `Notepad.toggleModal`, `Notepad.exportToHTML`, `Notepad.closeModal` | Adds listeners to DOM elements | Medium: missing bindings disable controls |
| `Notepad.renderNotes` (notepad.ts:190) | `this.state.notes`, `marked`, `createNoteCard`, `attachNoteEventListeners` | Rewrites `#notepad-notes-container.innerHTML` | High: inserts HTML directly; importing external HTML raises XSS risk |
| `Notepad.addNote` (notepad.ts:72) | `Curriculum` indices, `crypto.randomUUID`, `logNotepadActivity`, `renderNotes` | Mutates `state.notes` array | Medium: relies on curriculum alignment |
| `Notepad.exportToHTML` (notepad.ts:450) | `NotepadExporter.exportToHTML`, `logNotepadActivity` | Disables/enables export button, triggers file download | Medium: UI feedback coupled to exporter timing |
| `NotepadExporter.generateStyledHTML` (notepadExporter.ts:60) | `groupNotesByModule`, `convertToHTML`, `escapeHtml` | None (pure string assembly) | Low: source of expected HTML schema for import |
| `NotepadExporter.downloadHTML` (notepadExporter.ts:409) | DOM APIs | `document.createElement('a')`, blob URL lifecycle | Medium: ensures cleanup to prevent leaks |

## Risk Register (High-Cost/High-Blast)
1. Rendering imported HTML via `renderNotes` may allow script/event injection if the file is malicious. Mitigation: strip dangerous nodes/attributes before storing; validate structure before merging.
2. Mapping imported module/concept titles to curriculum indices could misalign state, corrupt grouping, or break editing flows. Mitigation: deterministic fallback indices + clear labeling for unmatched items; guard with curriculum lookups.
3. File parsing failures (invalid HTML) could leave modal half-updated if state mutates early. Mitigation: parse into temporary structures, only merge on success, robust error reporting with no state changes on failure.

## Coverage Checklist (Functions to Exercise)
- `index.tsx::loadCurriculumAndGreet`
- `notepad.ts::Notepad.initialize`
- `Notepad.createModal`
- `Notepad.attachEventListeners`
- `Notepad.toggleModal` / `openModal`
- `Notepad.renderNotes`
- `Notepad.exportToHTML`
- New import-path functions: button handler, file selection handler, parser, merge routine, error popup

## Assumptions & Unknowns Register
| Statement & Rationale | Impact | Verification Plan |
| --- | --- | --- |
| Exported HTML from `NotepadExporter.generateStyledHTML` always uses `.module-section` → `.note-card` hierarchy with `.concept-title`, `.note-content`, `.timestamp`. | Medium | Generate a sample export locally before implementing parser to confirm structure. |
| Quill delta data is not embedded in current HTML exports; imported notes likely lack `quillDelta`. | Medium | Inspect exported HTML for delta metadata; if absent, default `quillDelta` to `undefined`. |
| Curriculum modules in import file will often match the active curriculum titles, but mismatch must be tolerated. | High | Implement lookup + fallback mapping, then test with intentionally mismatched titles. |

## Architectural Insights
- Notepad is a singleton with internal state; modal markup is authored inline, so adding controls requires editing `createModal` & companion listeners.
- Notes render via string concatenation and `innerHTML`, so any imported content feeds directly into DOM; sanitization must happen before merge.
- Exporter HTML groups by module title and concept title; importer should reuse these identifiers for reconciliation.

## Next Protocol
- Proceed to **MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL** after clarifying objectives with the user per Main Directive.

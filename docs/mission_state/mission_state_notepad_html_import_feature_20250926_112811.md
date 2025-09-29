# Mission State – Notepad HTML Import Feature (2025-09-26 11:28:11)

## Scope & Entry Points
- Primary entry: `index.tsx:1030 loadCurriculumAndGreet` fetches `Modules.txt`, seeds the curriculum, and invokes `notepad.initialize`, which is where import hooks must connect.
- Modal/UI focus: `notepad.ts:117 Notepad.createModal` builds the notepad modal header controls; this is the location for the new Import button + file input plumbing.
- Event wiring: `notepad.ts:141 Notepad.attachEventListeners` binds modal controls (toggle, export, close) and will host the import trigger + FileReader integration.
- Rendering & state merge: `notepad.ts:72 addNote`, `notepad.ts:190 renderNotes`, and `notepad.ts:229 createNoteCard` manage the in-memory note list and DOM updates that imported notes must blend into without disturbing active selection state.
- Export schema reference: `notepadExporter.ts:25 NotepadExporter.generateStyledHTML` defines the HTML structure emitted today (module/concept sections, metadata blocks) that the importer must parse.
- Hot modules (fan-in/out): `curriculum.ts` (fan-in 11) for module/concept lookup, `notepad.ts` (fan-in 4) for note orchestration, and `index.tsx` (fan-out 18) for lifecycle wiring.

## Static Execution Trace
1. `index.tsx:1030 loadCurriculumAndGreet` → `fetch('Modules.txt')` → `parseModulesTxt` → `setCurriculum` → `notepad.initialize(curriculum)`.
2. `notepad.ts:58 Notepad.initialize` → sets `this.curriculum`, then calls `createModal` (line 117) and `attachEventListeners` (line 141).
3. `notepad.ts:117 Notepad.createModal` → creates `div#notepad-modal`, injects header markup with `📄 Export HTML` button, appends to `document.body`.
4. `notepad.ts:141 Notepad.attachEventListeners` → wires `#notepad-button` → `toggleModal`, `#notepad-export-button` → `exportToHTML`, modal overlay & close icon → `closeModal`.
5. `notepad.ts:173 Notepad.openModal` → flips `state.isOpen`, sets modal display, calls `renderNotes`, logs `[NOTEPAD_ACTIVITY]`.
6. `notepad.ts:190 Notepad.renderNotes` → groups `state.notes` by module/concept, builds HTML via `createNoteCard` (line 229), sets `#notepad-notes-container.innerHTML`, and delegates clicks through `attachNoteEventListeners` (line 263).
7. `notepad.ts:72 Notepad.addNote` → validates active module/concept, constructs `Note` object (uses `crypto.randomUUID`), pushes to `state.notes`, logs, and if modal open calls `renderNotes`.
8. `notepad.ts:450 Notepad.exportToHTML` → disables export button, calls `NotepadExporter.exportToHTML`, re-enables button, logs success/failure.
9. `notepadExporter.ts:12 NotepadExporter.exportToHTML` → `generateStyledHTML` (line 25) → `downloadHTML` (line 411); logs `[NOTEPAD_EXPORT]`.
10. `notepadExporter.ts:25 generateStyledHTML` → groups notes (`groupNotesByModule`), emits sections with `.module-section`, `.module-header h2`, `.note-card`, `.concept-title`, `.note-content`, `.note-metadata .timestamp` – this schema is the contract for import parsing.

## Dependency & Side-Effect Table
| Function (file:line) | Key Dependencies | Side Effects | Risk |
| --- | --- | --- | --- |
| `index.tsx:1030 loadCurriculumAndGreet` | `fetch`, `parseModulesTxt`, `setCurriculum`, `notepad.initialize`, UI helpers | Network fetch, global/window state wiring, kicks off notepad lifecycle | Medium–High: initialization failure blocks import availability |
| `notepad.ts:58 Notepad.initialize` | Cached `Curriculum`, `createModal`, `attachEventListeners` | Stores curriculum reference, creates modal DOM, binds events | Medium: incorrect sequencing leaves controls unbound |
| `notepad.ts:117 Notepad.createModal` | DOM APIs, header markup string | Appends modal to `document.body`, injects HTML controls | Medium: markup errors break both export and future import controls |
| `notepad.ts:141 Notepad.attachEventListeners` | DOM query, `toggleModal`, `exportToHTML`, `closeModal` | Adds click handlers to notepad button, export button, modal overlay | Medium: missed binding would make import path inert |
| `notepad.ts:173 Notepad.openModal` | `renderNotes`, `logNotepadActivity` | Mutates `state.isOpen`, toggles CSS display, logs | Low–Medium: ensures UI refresh occurs before import merge display |
| `notepad.ts:190 Notepad.renderNotes` | `this.state.notes`, `marked`, `createNoteCard`, `attachNoteEventListeners` | Rewrites container HTML with note HTML (potentially rich HTML), rebinds delegates | **High**: importing arbitrary HTML without sanitization could inject scripts/markup |
| `notepad.ts:72 Notepad.addNote` | `curriculum.modules`, `crypto.randomUUID`, `renderNotes`, `logNotepadActivity` | Mutates notes array, logs activity, triggers rerender | Medium: relies on curriculum alignment |
| `notepad.ts:450 Notepad.exportToHTML` | `NotepadExporter.exportToHTML`, `logger`, DOM button state | Disables/re-enables button, file download trigger, alert on failure | Medium: UI feedback must coexist with import control |
| `notepadExporter.ts:12 exportToHTML` | `generateStyledHTML`, `downloadHTML`, `logger` | Builds HTML string, triggers Blob download, logs event | Medium: ensures schema stays consistent for importer |
| `notepadExporter.ts:25 generateStyledHTML` | `groupNotesByModule`, `convertToHTML`, `escapeHtml`, `getConceptEmoji` | Pure string assembly | Low: canonical source of import schema, no side-effects |
| `notepadExporter.ts:411 downloadHTML` | `Blob`, transient `a` element | Creates temp anchor, clicks it, cleans up DOM URL | Medium: must not leak nodes/URLs |

## Risk Register
- **R1 – HTML injection via import** (`notepad.ts:190 renderNotes`, planned importer): bringing in external HTML could inject scripts or unexpected markup. *Mitigation*: parse with `DOMParser`, whitelist expected structures, strip `<script>`/event attributes before converting to note objects; validate before mutating state.
- **R2 – Curriculum mismatch**: imported module/concept titles may not exist in current `Curriculum` leading to bad indices or crashes. *Mitigation*: implement title matching with normalization, fall back to a dedicated “Imported Notes” module/concept bucket, and log mismatches.
- **R3 – Partial import failure**: FileReader/parsing errors could leave UI buttons disabled or mutate state mid-way. *Mitigation*: guard with try/catch, only merge notes after full parse succeeds, reset button/loading states in finally block.
- **R4 – Save/load compatibility**: SaveLoad expects `notepad.restoreNotes`/`getAllNotes`; importer must preserve and possibly extend these behaviors. *Mitigation*: implement or verify those APIs while adding import so persistence remains intact.

## Coverage Checklist (functions to validate during implementation)
- `index.tsx::loadCurriculumAndGreet@41815` – ensures notepad initialization still runs after adding import plumbing.
- `notepad.ts::Notepad.initialize@1626` – confirm curriculum reference stored and modal constructed with new controls.
- `notepad.ts::Notepad.createModal@3580` – verify DOM includes Import button & hidden file input.
- `notepad.ts::Notepad.attachEventListeners@4631` – ensure import button dispatches FileReader workflow alongside existing exports.
- `notepad.ts::Notepad.renderNotes@6253` – confirm imported notes appear without duplicating existing rendering behavior.
- `notepad.ts::Notepad.addNote@2048` – check merging logic keeps manual notes intact.
- `notepad.ts::Notepad.exportToHTML@16308` – validate export remains functional post-import changes.
- `notepadExporter.ts::NotepadExporter.generateStyledHTML@740` – treat as schema reference; ensure importer stays in sync.

## Assumptions & Unknowns Register
| Statement | Rationale | Impact | Verification Plan | Owner / Target |
| --- | --- | --- | --- | --- |
| Exported HTML preserves current class names/structure (`.module-section`, `.note-card`, `.note-content`, metadata blocks). | Import parser will rely on this schema. | High | Generate sample export in dev or inspect existing file before implementation. | Apollo FD (today, before blueprint) |
| Module & concept titles in exported HTML match current curriculum titles exactly. | Needed to map to indices for state integration. | Medium | Implement normalization + fallback “Imported Notes”; test with mismatched titles. | Apollo FD (during implementation) |
| Reconstructing Quill deltas from HTML may not be feasible. | Export omits delta payload; we may only recover HTML. | Low | Document limitation; ensure editor falls back to HTML when `quillDelta` absent. | Apollo FD (during implementation) |
| Browser environment exposes `FileReader`, `<input type="file">`, and DOMParser. | Import flow depends on standard browser APIs. | Low | Smoke-test the feature in-browser during validation step. | Apollo FD (Implementation Step 9) |
| Notepad persistence APIs (`getAllNotes`, `restoreNotes`) must exist or be added to keep Save/Load working with imported notes. | SaveLoadProgressManager calls these methods. | Medium | Audit/implement these APIs while building importer; regression-test save/load. | Apollo FD (before implementation completion) |

## Key Architectural Insights
- Notepad maintains its own in-memory note array keyed by module/concept indices; rendering regenerates the DOM wholesale on each change. Import logic must merge data at the array level before triggering `renderNotes`.
- HTML export groups notes by module and concept with rich formatting; the importer can walk the DOM tree deterministically to rebuild note objects (timestamp text, inner HTML body, etc.).
- The system presently lacks note restoration helpers despite SaveLoad expectations, suggesting an opportunity to add reusable merge/import utilities alongside this feature.
- Logging conventions use `[NOTEPAD_ACTIVITY]`/`[NOTEPAD_EXPORT]`; import should introduce analogous tags for observability.

## Next Protocol
Prepared to enter the **MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL** for the Notepad HTML Import feature.

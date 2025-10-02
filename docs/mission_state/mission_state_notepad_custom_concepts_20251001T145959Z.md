# Mission State: Notepad Custom Concepts Feature

**Timestamp:** 2025-10-01T14:59:59Z

## Analysis Scope & Entry Points
- `index.tsx::loadCurriculumAndGreet` initializes the singleton notepad instance.
- `notepad.ts` modal lifecycle (`initialize`, `createModal`, `attachEventListeners`, `renderNotes`, editing helpers).
- `notepadImporter.ts` and `notepadExporter.ts` for import/export pipelines and `Note` shape.
- `selectionSensei.ts::handleAddToNotepad` and toolbar wiring that injects notes.
- `moduleSelectionHandler.ts` concept/module index propagation to notepad.
- `saveloadProgressManager.ts` persistence hooks (`getAllNotes`, `restoreNotes`).

Hot modules from analyzer snapshot (`tmp/analysis/summary.txt`): `index.tsx` fan-out 18, `ui.ts` fan-out 8, `notepad.ts` fan-out 5, `curriculum.ts` fan-in 11.

## Static Execution Trace
1. `index.tsx::loadCurriculumAndGreet` → `notepad.initialize(curriculum)`.
2. `Notepad.createModal` builds DOM structure; `Notepad.attachEventListeners` wires modal controls.
3. Selection toolbar → `selectionSensei.handleAddToNotepad` → `notepad.addNote`.
4. `Notepad.addNote` pushes note, logs, triggers `renderNotes`.
5. `Notepad.renderNotes` groups by `moduleIndex`/`conceptIndex` → `createNoteCard` → `attachNoteEventListeners`.
6. Editing path: `toggleEditMode` → `initializeQuillEditor` → `saveQuillContent` / `cancelQuillEdit` / `deleteNote`.
7. Import path: `handleImport` → `NotepadImporter.importFromFile` → `transformImportedNotes` → `resolveModuleIndex` / `resolveModuleTitle` / `resolveConceptIndex` / `buildNote` → push into state → `renderNotes`.
8. Persistence path: `SaveLoadProgressManager.collectSessionData` → `window.notepad.getAllNotes`; restore via `restoreNotes`.

## Dependency & Side-Effect Table
| Function | Dependencies | Side Effects | Risk |
| --- | --- | --- | --- |
| `Notepad.addNote` | `curriculum.modules`, `logNotepadActivity`, `renderNotes`, `crypto.randomUUID` | Mutates `state.notes`, logs, rerenders modal | Medium |
| `Notepad.renderNotes` | `state.notes`, `marked`, DOM APIs | Rewrites `#notepad-notes-container.innerHTML`, rebinds events | High |
| `Notepad.attachNoteEventListeners` | DOM (`#notepad-notes-container`), delegated handler | Adds/removes click listeners | Low |
| `Notepad.toggleEditMode` | DOM queries, `initializeQuillEditor`, `saveQuillContent` | Toggles CSS classes, may persist edits | Medium |
| `Notepad.initializeQuillEditor` | Global `Quill`, note HTML/delta | Instantiates editor instance, appends DOM controls | Medium |
| `Notepad.saveQuillContent` | Active Quill editor | Writes HTML/text back to note object, rerenders | Medium |
| `Notepad.deleteNote` | `state.notes`, `renderNotes` | Removes note, rerenders, logs | Medium |
| `Notepad.handleImport` | `NotepadImporter.importFromFile`, DOM buttons, async FileReader | Disables/enables import button, merges notes | Medium |
| `Notepad.transformImportedNotes` | `resolveModuleIndex`, `resolveModuleTitle`, `resolveConceptIndex`, `buildNote` | Produces new notes with curriculum-aligned indices | High (conflicts with custom concept requirement) |
| `Notepad.resolveConceptIndex` | `state.notes`, curriculum metadata | Assigns numeric concept indices | High |
| `SaveLoadProgressManager.collectSessionData` | `window.notepad.getAllNotes` | Serializes current notes snapshot | High |
| `SaveLoadProgressManager.restoreSessionData` | `window.notepad.restoreNotes` | Writes restored notes into singleton | High |

## Risk Register
- **R1 (High):** Import/restore flows currently force curriculum/module alignment; violates new "read-only" requirement. Mitigation: decouple indices, preserve custom strings.
- **R2 (Medium):** DOM rendering via `innerHTML` could expose unsafe markup from user-provided concept titles. Mitigation: escape concept labels when rendering, or constrain editing controls.
- **R3 (Medium):** Save/load must remain compatible with legacy notes while supporting new custom concepts. Mitigation: versionless schema careful defaulting, regression QA.

## Coverage Checklist
- `notepad.ts`: `initialize`, `createModal`, `attachEventListeners`, `addNote`, `renderNotes`, `toggleEditMode`, `initializeQuillEditor`, `saveQuillContent`, `handleImport`, `transformImportedNotes`, `resolveConceptIndex`, `getAllNotes`, `restoreNotes`.
- `selectionSensei.ts::handleAddToNotepad`.
- `moduleSelectionHandler.ts::setActiveCurriculumContext` usages.
- `saveloadProgressManager.ts::collectSessionData` / `restoreSessionData`.

## Assumptions & Unknowns Register
| ID | Statement | Impact | Verification Plan |
| --- | --- | --- | --- |
| U1 | Custom concepts should persist with user-supplied names even without curriculum linkage. | High | Adjust note model to store standalone concept metadata; verify via save/load round-trip. |
| U2 | Blank or new notes created under custom concepts must still initialize Quill delta safely. | Medium | Create note via new button, ensure editor opens with empty delta and saves without errors. |
| U3 | Legacy imported HTML containing module headings should continue to render in new structure. | Medium | Import existing export sample and check grouping consistency. |

## Key Architectural Insights
- Notepad is a DOM-driven singleton; grouping logic hinges on `moduleIndex`/`conceptIndex`, which must be generalized for custom concepts.
- Import pipeline currently reuses exporter schema and curriculum matching helpers; this needs revision to respect raw labels.
- Persistence interfaces already expose `getAllNotes`/`restoreNotes`, enabling schema evolution without changing callers.

## Triggering Protocol
Next sequenced protocols: **COMPREHENSIVE IMPACT ANALYSIS PROTOCOL** (already executed for this mission) followed by **MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL** leading into **MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL** once architecture approved.

## Test Traceability Notes
- Manual QA will exercise notepad modal via `index.tsx` entry and selection toolbar injection from `selectionSensei.ts`.
- Persistence coverage runs through `saveloadProgressManager` interacting with `notepad` APIs.


## Test Plan Alignment
- Functional coverage will be added in `__tests__/notepad.test.ts` using the production `Notepad` class and public APIs under Jest's jsdom environment.
- Happy path: creating a custom concept, appending notes (both via concept button and selection toolbar flow), verifying resulting concept order and state logs.
- Persistence/import path: serialize via exporter/save-load, ensure restore/import preserves custom concepts without curriculum indices.
- Negative path: load legacy snapshot lacking concept IDs to confirm migration wraps notes into synthetic concepts.
- Logger spies will assert the planned `[NOTEPAD_CUSTOM_CONCEPTS]` telemetry to ensure instrumentation fires across flows, satisfying validation log checks.

## Implementation Notes (2025-10-01)
- Replaced `Notepad` state with ordered concept groups holding note arrays and curriculum-independent context tracking.
- Added concept-level controls (create, rename, add note) with inline validation logs `[NOTEPAD_CUSTOM_CONCEPTS] concept-created`, `concept-renamed`, and `note-added`.
- Updated HTML exporter/importer and save/load snapshot to operate on the concept hierarchy while preserving legacy imports via migration support.
- Adjusted `index.tsx` and `moduleSelectionHandler.ts` to call `setActiveCurriculumContext` with curriculum titles instead of indices.
- New functional coverage in `__tests__/notepad.test.ts` exercises concept creation, note insertion, persistence round-trip, and legacy migration paths with logger assertions.
- Button copy and sizing refined: header now shows “Add Concept” with unified min-width alongside import/export controls.
- HTML import merges incoming notes into existing concept groups (matching by id or case-insensitive title) instead of duplicating sections.
- Added functional regression checks covering import merge behavior and concept rename fallback.
- Header buttons now display emoji-only glyphs (➕, 📥, 📄) with hover titles; shared styling keeps gradients while allowing natural width.
- Export control now uses 📤 to mirror the import tray icon direction.
- Added defensive timestamp parsing to honor international date formats when restoring or importing notes, ensuring persistence remains functional after HTML merges.
- setActiveCurriculumContext now honors explicit null/undefined semantics so context titles clear correctly; added regression test ensuring null conceptTitle yields a fresh group.

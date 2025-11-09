# Mission State – Selection Sensei Horizontal Scrollbar (2025-11-09T21:37:46Z)

## Scope & Entry Points
- Entry flow starts in `src/index.tsx` when `initializeSelectionSensei` is called once the `message-area` node is resolved.
- Core runtime is encapsulated inside `src/selectionSensei.ts` (SelectionSensei class, toolbar orchestration, modal lifecycle).
- Modal markup lives in `src/index.html` (`#response-modal`, `#selection-sensei-*`), while presentation and overflow behavior are defined in `src/index.css`.
- Hot modules informed by analyzer fan-in/out: `src/ui.ts` (shared UI helpers), `src/selectionSensei.ts` (fan-out 6), `src/index.tsx` (fan-out 19), `src/index.css` (affects modal layout), `src/logger.ts` (fan-in 21).

## Static Execution Trace
1. `initializeSelectionSensei` (src/selectionSensei.ts) clears any existing instance, then instantiates `SelectionSensei` and calls `.initialize()`.
2. `SelectionSensei.initialize` fetches DOM nodes via `getDOMElements`, wires listeners through `attachEventListeners`, primes the composer with `initializeModalComposer`, and calls `resetModalState`.
3. User selection triggers `handleTextSelection`, which inspects the DOM tree for Sensei contexts and invokes `createAndShowSelectionToolbar`.
4. Toolbar button clicks route through `handleToolbarAction`, which logs context, calls `resetModalState`, displays the modal via `showResponseModalWithLoading`, disables the composer, hides the toolbar, and orchestrates prompt construction plus Gemini chat calls.
5. While waiting for AI, `showResponseModalWithLoading` clears previous DOM content, sets the spinner, centers the modal, and ensures DOM references via `ensureDOMElementsValid`.
6. When content arrives, `updateResponseModalContentAndTitle` sanitizes markdown using `sanitizeMarkdownFences`/`parseSanitizedMarkdown`, rebuilds the modal body, normalizes Mermaid blocks, reapplies copy/highlight helpers, and re-enables the composer.
7. `setModalFullscreen`, `handleDragStart/Move/End`, and `handleOutsidePointerDown` maintain placement; CSS for `#response-modal` and `#response-modal-drag-zone` ultimately governs overflow, making it the prime suspect for the horizontal scrollbar.

## Dependency & Side-Effect Table
| Function | Key Dependencies | Side Effects | Risk |
| --- | --- | --- | --- |
| `initializeSelectionSensei` | `SelectionSensei` ctor, `SelectionSensei.cleanup`, `message-area` lookup | Global singleton reset, modal cleanup | Medium (global state) |
| `SelectionSensei.initialize` | `getDOMElements`, `attachEventListeners`, `initializeModalComposer`, `resetModalState` | Registers DOM listeners, resets modal tokens | Medium |
| `SelectionSensei.getDOMElements` | `document.getElementById`, modal/composer IDs | Rebinds cached DOM refs | Low |
| `SelectionSensei.attachEventListeners` | `messageArea`, `document` | Adds mouse/touch/pointer listeners | Medium (dup listeners if mismanaged) |
| `SelectionSensei.initializeModalComposer` | `setupTextareaAutosize`, composer DOM nodes | Attaches keydown/click handlers, sets dataset flags | Low |
| `SelectionSensei.resetModalState` | `ensureDOMElementsValid`, `setModalFullscreen`, `createMessageRegistry`, `clearModalRegistry`, `setComposerEnabled` | Clears transcript, spinner, title, composer input, tokens | Medium-High |
| `SelectionSensei.showResponseModalWithLoading` | `ensureDOMElementsValid`, `setComposerEnabled`, DOM nodes | Clears modal body, toggles spinner, centers modal (`style.left/top/transform`, `display:flex`) | Medium |
| `SelectionSensei.updateResponseModalContentAndTitle` | `sanitizeMarkdownFences`, `parseSanitizedMarkdown`, `normalizeMermaidCodeBlocks`, `addLanguageDisplayToCodeBlocks`, `addCopyButtonsToCodeBlocks` | Full DOM rewrite, spinner toggles, composer re-enable | High (rich text rendering) |
| `SelectionSensei.handleToolbarAction` | `SENSEI_*` prompt helpers, `ensureSelectionChat`, `resetModalState`, `showResponseModalWithLoading`, `updateResponseModalContentAndTitle`, `logger` | AI calls, modal lifecycle orchestration, composer gating | High |
| `SelectionSensei.ensureDOMElementsValid` | `getDOMElements`, `initializeModalComposer`, modal buttons/drag zone | Re-fetches nodes and rebinds modal listeners when DOM rebuilt | Medium |
| `SelectionSensei.createAndShowSelectionToolbar` | `TOOLBAR_ACTIONS`, DOM selection API, `handleToolbarAction`, `activateAskMode`, `handleAddToNotepad` | Dynamically builds toolbar DOM, attaches per-button listeners | Medium |
| `SelectionSensei.handleTextSelection` | `window.getSelection`, DOM traversal utilities | Shows/hides toolbar, captures context text | Low |

## Risk Register
- `SelectionSensei.handleToolbarAction` manages async AI calls with conversation tokens; regressions here can leak concurrent responses or stale modal states.
- `SelectionSensei.updateResponseModalContentAndTitle` rebuilds modal DOM wholesale; CSS tweaks must preserve width constraints to avoid new overflow regressions.
- `SelectionSensei.setModalFullscreen` and drag handlers depend on CSS (`#response-modal` sizing, `#response-modal-drag-zone` offsets); changing overflow or hit zones can break dragging/fullscreen UX if not revalidated.

## Unknowns Register
| Unknown | Impact | Verification Plan | Owner / Target |
| --- | --- | --- | --- |
| Exact contributor to horizontal overflow (suspects: `#response-modal-drag-zone` negative insets vs container padding) | Medium | Temporarily inspect bounding boxes / toggle CSS in browser after change to confirm overflow disappears and no other element overflows | AI – verify immediately after CSS fix |
| Effect of tightening overflow (e.g., `overflow-x` adjustments or drag-zone bounds) on drag + resize ergonomics | High | Exercise drag, resize, fullscreen toggle, and pointer-down-close flows in the browser after patch | AI – post-fix manual QA |
| Need for horizontal scroll in fullscreen mode for exceptionally wide code blocks | Medium | Render synthetic wide code block and ensure inner transcript handles scroll without relying on container horizontal overflow | AI – manual content check post-fix |

## Coverage Checklist
- `initializeSelectionSensei` lifecycle invoked from `src/index.tsx`.
- `SelectionSensei.initialize` + `getDOMElements` + `attachEventListeners`.
- `SelectionSensei.handleTextSelection` → `createAndShowSelectionToolbar`.
- `SelectionSensei.handleToolbarAction` orchestration path (loading state, AI call, modal update).
- `SelectionSensei.showResponseModalWithLoading` and `updateResponseModalContentAndTitle`.
- CSS selectors `#response-modal`, `#response-modal-content-area`, `#response-modal-drag-zone`.

## Architectural Insights
- The modal is a fixed-position flex column with `resize: both` and `overflow: auto`; any absolutely-positioned child extending past bounds (notably the drag zone with `inset: -12px -24px 0 -24px`) forces horizontal scrollbars even when content fits.
- Vertical scrolling is already constrained to `#selection-sensei-transcript`, so the container can safely clamp horizontal overflow as long as drag affordances remain accessible.

## Triggering Protocol Next
- Proceed to **MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL** (bug workflow), including COMPREHENSIVE IMPACT ANALYSIS ahead of implementation per global directives.

## Test Traceability
- Planned manual UX sweep covering `src/selectionSensei.ts` (toolbar trigger, modal drag/fullscreen, AI response render) and `src/index.css` (`#response-modal`, transcript, drag-zone). Verifies no horizontal scrollbar plus intact drag/fullscreen controls.

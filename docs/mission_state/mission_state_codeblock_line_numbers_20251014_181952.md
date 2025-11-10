# Mission State - Codeblock Line Numbers - 2025-10-14 18:19:52

## Scope & Entry Points
- Primary focus: chat message rendering pipeline via `renderEnhancedMarkdown` (`src/ui.ts:1411`) which hydrates markdown into the main conversation view.
- Secondary surfaces consuming the same helpers: selection modal updates (`src/selectionSensei.ts:934`), wrap-up overlay enhancements (`src/wrapUpAssessment.ts:561`), and debug viewer rendering (`src/debugMode.ts:180`).
- Supporting utilities: code editor modal seeding (`src/codeEditorModal.ts:225`) for the “Edit” button pathway.
- Hot modules (fan-in/out relevance): `src/ui.ts`, `src/selectionSensei.ts`, `src/debugMode.ts`, `src/wrapUpAssessment.ts`; monitor `src/codeEditorModal.ts` due to editor integration.
- User constraints: render manual line numbers in each `<pre><code>` block, color the numbers yellow, and guarantee Monaco edit payloads exclude those numbers.

## Static Execution Trace
1. `renderEnhancedMarkdown` resolves markdown, injects DOM, triggers highlight.js, and calls enhancement helpers.
2. `addLanguageDisplayToCodeBlocks_internal` adds language badges per `<pre><code>` pair.
3. `addCopyButtonsToCodeBlocks_internal` ensures copy/edit controls exist, leveraging `getOrCreateButtonContainer` and `setCodeEditorContentAndOpen`.
4. Downstream consumers (selection sensei, wrap-up, debug) invoke the exported helpers to recreate the same pipeline on their surfaces.
5. Monaco editor path pulls code via the edit button and seeds `setCodeEditorContentAndOpen`, which normalizes newlines before opening the modal.

## Dependency & Side-Effect Analysis
| Function (file:line) | Key Dependencies | Side Effects | Risk Notes |
| --- | --- | --- | --- |
| `renderEnhancedMarkdown` (`src/ui.ts:1411`) | Sanitizers, Highlight.js, Mermaid processor, enhancement helpers | Mutates DOM for chat bubbles, async mermaid handling | High visibility UI path; regression impacts every Sensei response. |
| `addLanguageDisplayToCodeBlocks_internal` (`src/ui.ts:1294`) | DOM APIs on `<pre>` nodes | Inserts/removes language badge elements | Low risk; ensure badge ordering works with new wrappers. |
| `addCopyButtonsToCodeBlocks_internal` (`src/ui.ts:1338`) | Clipboard API, `setCodeEditorContentAndOpen`, button container helper | Adds buttons, clipboard writes, async timers | Medium risk; ensure new line-number structure keeps text extraction intact. |
| `getOrCreateButtonContainer` (`src/ui.ts:1320`) | None outside DOM | Appends overlay container | Low risk; ensure absolute positioning still valid. |
| `addCopyButtonsToDebugCodeBlocks` (`src/debugMode.ts:213`) | Clipboard API | Adds copy control per block | Medium risk on debug UX; must mirror main view behavior. |
| `addLanguageDisplayToDebugCodeBlocks` (`src/debugMode.ts:176`) | DOM APIs on debug pane | Inserts language badges | Low risk; ensure compatibility with new wrappers. |
| `applyCodeBlockEnhancements` (`src/wrapUpAssessment.ts:561`) | Highlight.js, exported helpers | Enhances wrap-up overlay DOM | Medium; wrap-up overlay must gain line numbers without breaking scroll. |
| `SelectionSensei.updateResponseModalContentAndTitle` (`src/selectionSensei.ts:918`) | Highlight.js, exported helpers | Mutates modal DOM, toggles spinner | Medium; ensure modal displays line numbers and keeps editor button logic. |
| `setCodeEditorContentAndOpen` (`src/codeEditorModal.ts:225`) | CodeMirror dispatch | Updates code cache, opens modal | Low; verify seeded string excludes line numbers. |

## Risk Register
| Risk | Impact | Mitigation |
| --- | --- | --- |
| Manual line numbers could contaminate copied/edited code if injected inside `<code>` nodes. | High (broken copy/edit workflows) | Keep numbers in a sibling container marked `aria-hidden`, validate `textContent` during QA. |
| Layout regressions from new wrappers might misalign language badges or buttons. | Medium | Design CSS wrapper with flex/grid compatible with existing absolute-positioned controls; smoke-test main chat, selection modal, debug pane. |
| Performance concerns when rendering very long snippets with manual line spans. | Low | Generate spans only once per render and reuse class guards; spot-check large snippet behavior. |

## Unknowns Register
| Unknown & Rationale | Impact | Verification Plan | Owner / Target |
| --- | --- | --- | --- |
| Do streaming updates re-run enhancements so that newly arriving code maintains correct line numbers? Current streaming path reuses helpers but needs confirmation. | Medium | Validate during implementation by tracing streaming update hooks and manually testing incremental response rendering. | Codex / pre-release manual QA |
| Will CSS scrollbar customizations interact poorly with new line number wrapper overflow constraints? | Low | Inspect computed styles after change; adjust overflow rules if necessary. | Codex / immediately after implementation |

## Coverage Checklist
- Exercise `renderEnhancedMarkdown` via a standard Sensei reply containing multi-line code; confirm copy/edit behavior.
- Trigger selection sensei modal rendering with code snippet to ensure modal view mirrors line numbers.
- Run wrap-up assessment overlay and verify code block formatting.
- Open debug console response containing code to confirm duplication parity.
- Execute edit button to load Monaco modal and ensure payload excludes line numbers.

## Key Architectural Insights
- Code-block enhancements are centralized in `src/ui.ts` and exported for reuse; debug mode still maintains duplicated helper implementations requiring synchronized updates.
- Button containers rely on absolute positioning within `<pre>`; additional structural wrappers must preserve relative offsets.
- Monaco editor seeding draws directly from the `<code>` element’s `textContent`, so any structural changes must leave that node’s textual content untouched.

## Next Protocol
- Prepared protocol: **MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL**. User explicitly requested skipping further protocols; will proceed directly to implementation after this checkpoint.

## Functional Test Traceability
- Manual UI verification spans the modules `src/ui.ts`, `src/selectionSensei.ts`, `src/debugMode.ts`, and `src/wrapUpAssessment.ts`, covering the user-facing chat, modal, debug pane, and wrap-up overlay respectively.
- Edit button validation targets `src/codeEditorModal.ts` to ensure Monaco seeding remains correct.

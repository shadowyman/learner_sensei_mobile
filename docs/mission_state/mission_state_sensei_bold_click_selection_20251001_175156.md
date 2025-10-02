# Mission State – sensei_bold_click_selection (2025-10-01)

## Scope & Entry Points
- Entry point: `ui.ts::displayMessage#29eaa94158d6` renders every chat bubble and stores raw Sensei text for selection workflows.
- Supporting selection pipeline: `selectionSensei.ts::SelectionSensei.attachEventListeners#13f07654ad8c`, `SelectionSensei.handleTextSelection#1229685aee72`, `SelectionSensei.handleSelectionChange#06e0f0dc52ab`, `SelectionSensei.createAndShowSelectionToolbar#d32086677a47`, `SelectionSensei.hideSelectionToolbar#b7b2c25d44dc`, `SelectionSensei.activateAskMode#39ce3fa504ee`, `SelectionSensei.handleToolbarAction#269e15517539`.
- Hot modules from fan-in/out: `ui.ts` (fan-out 8, fan-in 7), `selectionSensei.ts` (fan-out 8), `index.tsx` (fan-out 18 orchestrating initialization).

## Static Execution Trace
1. **Sensei message render** – `displayMessage` creates/updates `.message-bubble`, assigns sanitized Markdown via `marked.parse`, stores raw text in `registry.rawText`, then (post-change) will run a helper to bind bold-element click handlers before syntax highlighting and Mermaid/copy button enrichment.
2. **Selection event binding** – `SelectionSensei.attachEventListeners` hooks `mouseup`/`touchend` on the shared message area plus `selectionchange` on `document`.
3. **Toolbar launch flow** – On pointer release inside a sensei bubble, `SelectionSensei.handleTextSelection` inspects `window.getSelection`; when non-collapsed it calls `createAndShowSelectionToolbar`, which renders the floating toolbar and wires button callbacks to `handleToolbarAction`, `handleAddToNotepad`, or `activateAskMode`.
4. **Toolbar lifecycle** – `SelectionSensei.handleSelectionChange` watches for collapsed selections to trigger `hideSelectionToolbar`, while `activateAskMode` swaps button controls for inline question input when relevant.

## Dependency & Side-Effect Table
| Function (stable id) | Key dependencies | Side effects | Risk |
| --- | --- | --- | --- |
| `ui.ts::displayMessage#29eaa94158d6` | `marked.parse`, `sanitizeCodeFences`, `renderMermaidThumbnailWithTheme`, `runMermaidRecovery`, `addLanguageDisplayToCodeBlocks_internal`, `addCopyButtonsToCodeBlocks_internal`, `renderIcons` | Heavy DOM mutation (bubble creation, dataset, timers), mermaid rendering, enhancement state resets | High |
| `selectionSensei.ts::SelectionSensei.attachEventListeners#13f07654ad8c` | Binds `this.handleTextSelection`, `this.handleSelectionChange`, modal drag handlers | Adds global listeners on `messageArea`, `document`, pointer capture | Medium |
| `selectionSensei.ts::SelectionSensei.handleTextSelection#1229685aee72` | `window.getSelection`, `this.createAndShowSelectionToolbar`, `this.hideSelectionToolbar` | Reads selection, toggles toolbar visibility | Medium |
| `selectionSensei.ts::SelectionSensei.handleSelectionChange#06e0f0dc52ab` | `window.getSelection`, `this.hideSelectionToolbar` | Hides toolbar when selection collapses | Medium |
| `selectionSensei.ts::SelectionSensei.createAndShowSelectionToolbar#d32086677a47` | `TOOLBAR_ACTIONS`, `this.activateAskMode`, `this.handleToolbarAction`, `this.handleAddToNotepad`, `requestAnimationFrame` | Creates toolbar DOM in `document.body`, positions via `getBoundingClientRect`, wires button listeners | Medium-High |
| `selectionSensei.ts::SelectionSensei.hideSelectionToolbar#b7b2c25d44dc` | — | Removes toolbar node, resets internal state flags | Medium |
| `selectionSensei.ts::SelectionSensei.activateAskMode#39ce3fa504ee` | `setupTextareaAutosize`, `this.handleToolbarAction` | Mutates toolbar DOM, enables textarea workflow | Medium |
| `selectionSensei.ts::SelectionSensei.handleToolbarAction#269e15517539` | Prompt templates, Gemini chat client, modal helpers | AI calls, modal state mutations, toolbar dismissal | High |

## Risk Register
| Risk | Impact | Mitigation |
| --- | --- | --- |
| Instrumenting `displayMessage` for bold click handling could regress Markdown rendering, mermaid injection, or reload buttons across all messages. | High | Encapsulate new logic in a post-render helper scoped to `.message-bubble[data-sender="sensei"]`, add unit test to confirm other markup (modules, code fences) remain untouched, run regression manual pass on sensei/user message mix. |
| Programmatic selection of `<strong>` nodes may conflict with existing manual text selection, causing repeated toolbar flashes or wrong ranges. | Medium | Only trigger when selection is collapsed and the event originates from a sensei `.message-text` bold span; verify via automated DOM test plus manual QA. |
| Touch interactions may not generate a usable `Selection` object, leaving the toolbar stuck or never appearing for mobile users. | Medium | Extend handler to resolve touch targets, and manually validate via mobile emulation once implementation lands. |

## Coverage Checklist
- `ui.ts::displayMessage#29eaa94158d6`
- `selectionSensei.ts::SelectionSensei.handleTextSelection#1229685aee72`
- `selectionSensei.ts::SelectionSensei.createAndShowSelectionToolbar#d32086677a47`
- `selectionSensei.ts::SelectionSensei.handleSelectionChange#06e0f0dc52ab`
- `selectionSensei.ts::SelectionSensei.attachEventListeners#13f07654ad8c`

## Unknowns & Assumptions Register
| Unknown / Assumption | Rationale | Impact | Verification Plan | Owner | Target Time |
| --- | --- | --- | --- | --- | --- |
| Markdown-to-HTML bold output shape (single `<strong>` vs multiple adjacent spans) for Sensei responses. | Need accurate block grouping to select “contiguous bold block”. | Medium | Craft sample response with multiple bold runs; inspect DOM via new Jest DOM test after helper is added. | Codex | Before Implementation Step 8 self-review |
| Touch events delivering a valid `Selection` for bold taps. | Mobile UX may differ from desktop pointer events. | Medium | Simulate touch via JSDOM where possible, follow with manual browser devtools device emulation. | Codex | Implementation Step 10 validation |
| Existing selection toolbar for user messages must remain unaffected by bold click logic. | Toolbar should stay Sensei-specific. | Medium | Ensure helper filters on `data-sender="sensei"`; add regression assertion in unit test and manual check. | Codex | Implementation Step 10 validation |

## Key Architectural Insights
- `displayMessage` centralizes all chat rendering; any helper must preserve sequencing with syntax highlighting and mermaid recovery.
- Selection Sensei relies on `registry.rawText` populated during render to supply original text for follow-up prompts.
- The selection workflow hinges on global listeners; minimizing additional global state changes is critical to avoid leaks.

## Next Protocol
- Proceed to **COMPREHENSIVE IMPACT ANALYSIS PROTOCOL** prior to editing existing code.

## Test Traceability Notes
- Planned Jest coverage in `__tests__/senseiBoldClick.spec.ts` importing `ui.ts` to render Sensei message HTML and assert bold span instrumentation.
- Additional Jest coverage in `__tests__/selectionToolbarBold.spec.ts` importing `selectionSensei.ts` to simulate click-driven selection and toolbar launch.
- Manual integrated check in browser build (imports `index.tsx` bundle) to confirm toolbar opens with full bold block selection and closes normally.

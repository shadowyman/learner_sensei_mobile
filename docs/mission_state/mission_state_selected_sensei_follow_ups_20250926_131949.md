# Mission State – Selected Sensei Follow-Ups (2025-09-26 13:19:49)

## Scope & Entry Points
- Primary entry: `selectionSensei.ts::SelectionSensei.handleToolbarAction#L649`
- Supporting modules: `selectionSensei.ts` (modal lifecycle, toolbar, ask mode), `ui.ts` (`displayMessage`, `processMermaidBlocks`, textarea autosize helpers), `index.html` (modal markup), `index.css` (modal + composer styling), `index.tsx` (Selection Sensei initialization + main composer behaviors).
- Hot modules from analyzer: `logger.ts`, `curriculum.ts`, `adaptiveEngine.ts`, `prompts.ts`, `model_usage.ts`, `ui.ts`, `selectionSensei.ts`.

## Static Execution Trace
1. `initializeSelectionSensei` instantiates the singleton and calls `getDOMElements` then `attachEventListeners` to bind selection + modal controls.
2. User text selection triggers `handleTextSelection`, which verifies the selection is inside a Sensei bubble and invokes `createAndShowSelectionToolbar`.
3. Toolbar button clicks (including Ask) flow through `handleToolbarAction`, after optional inline ask input created by `activateAskMode`.
4. `handleToolbarAction` clears/hides the toolbar, calls `showResponseModalWithLoading`, constructs prompts via `SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION` or the ask variant, then invokes `ai.models.generateContent` with `SELECTION_SENSEI_CONFIG`.
5. Returned text is parsed; success paths call `updateResponseModalContentAndTitle` to set modal heading & markdown.
6. `updateResponseModalContentAndTitle` sanitizes markdown, clears modal content, injects rendered HTML, runs code highlighting, copy buttons, and awaits `processMermaidDiagrams` for diagram handling.
7. `processMermaidDiagrams` renders diagrams via `mermaidManager.render`; failures try `runMermaidRecovery` and fallback DOM swaps.
8. Modal close and drag logic relies on `hideResponseModal`, `handleDragStart/Move/End`, and `handleOutsidePointerDown`.
9. Main chat rendering continues to use `ui.ts::displayMessage`, which currently targets the primary `#message-area` and handles markdown, streaming timers, reload/enhance controls, icons, and mermaid phase-two rendering via `processMermaidBlocks`.

## Dependency & Side-Effect Table
| Function (Stable ID) | Key Dependencies | Side Effects | Risk Notes |
| --- | --- | --- | --- |
| `selectionSensei.ts::SelectionSensei.handleToolbarAction#L649` | `logSelectionSenseiValidation`, `showResponseModalWithLoading`, `hideSelectionToolbar`, `SENSEI_*` prompt builders, `this.ai.models.generateContent`, `updateResponseModalContentAndTitle`, `attemptJSONRepair`, `extractContentWithRegex`, `logger` | Triggers external LLM call; drives modal DOM updates through downstream helpers; logs telemetry | High cost external call; synchronous modal state reset must remain atomic to avoid UI flashes |
| `selectionSensei.ts::SelectionSensei.showResponseModalWithLoading#L375` | `ensureDOMElementsValid`, `logSelectionSenseiValidation` | Clears modal nodes, manipulates display/position styles | Medium blast; should clear any future transcript/composer state before display |
| `selectionSensei.ts::SelectionSensei.updateResponseModalContentAndTitle#L408` | `ensureDOMElementsValid`, `sanitizeCodeFences`, `marked`, `addLanguageDisplayToCodeBlocks`, `addCopyButtonsToCodeBlocks`, `processMermaidDiagrams`, `logger` | Rebuilds modal content subtree, hides spinner, post-processes code + diagrams | Medium risk; refactor must avoid double-rendering when transcript replaces direct innerHTML writes |
| `selectionSensei.ts::SelectionSensei.processMermaidDiagrams#L595` | `mermaidManager.render`, `renderMermaidThumbnailWithTheme`, `runMermaidRecovery`, `logger`, `crypto.randomUUID` | Generates/replaces DOM nodes for diagrams; attempts recovery on failure | Medium-high cost; ensure shared mermaid manager remains thread-safe within modal context |
| `selectionSensei.ts::SelectionSensei.createAndShowSelectionToolbar#L203` | `hideSelectionToolbar`, `activateAskMode`, `handleAddToNotepad`, `handleToolbarAction`, `TOOLBAR_ACTIONS` config | Creates floating toolbar, attaches click handlers, positions absolutely | Medium risk; must cooperate with new modal follow-up entry point (likely demote inline ask) |
| `selectionSensei.ts::SelectionSensei.activateAskMode#L291` | `setupTextareaAutosize`, `handleToolbarAction` | Builds inline textarea + send button, disables other toolbar actions | Medium risk; follow-up composer may supersede this UX—decide whether to retire or integrate |
| `selectionSensei.ts::SelectionSensei.handleTextSelection#L168` | `createAndShowSelectionToolbar`, `hideSelectionToolbar` | Toggles toolbar visibility based on selection collapse | Low risk but must reset transcript/composer when new selection begins |
| `selectionSensei.ts::SelectionSensei.ensureDOMElementsValid#L128` | `getDOMElements`, modal close + drag listeners | Refreshes cached DOM refs, rebinds listeners | Medium risk if modal markup changes |
| `ui.ts::displayMessage#L1133` | `document.getElementById`, `resetEnhancementState`, `marked`, `renderMermaidThumbnailWithTheme`, `runMermaidRecovery`, `renderIcons`, `streamingMessagesRawText`, `streamingMessageTimers`, `logger` | Creates/updates chat bubbles, animations, timers, DOM mutations, icon rendering | High blast; refactor must preserve backwards compatibility while allowing alternate container |
| `ui.ts::processMermaidBlocks#L1843` | `mermaidManager.render`, `renderMermaidThumbnailWithTheme`, `runMermaidRecovery`, `replaceMermaidFenceInRaw`, `logger` | Post-display diagram rendering, optional recovery attempts | Medium risk; may need modal-aware skip logic beyond existing `response-modal-sensei-bubble` guard |

## Risk Register
- **R1 – LLM call amplification** (`handleToolbarAction`): Each follow-up will re-hit `ai.models.generateContent`; risk of rate-limit spikes (Cost: High, Blast: Medium). *Mitigation*: Gate composer to lock while awaiting response, reuse `logSelectionSenseiValidation` with distinct event for follow-ups, add validation log to confirm lock/release.
- **R2 – `displayMessage` refactor regression**: Extending it to accept modal containers could break 20+ existing callers if defaults change (Cost: High, Blast: High). *Mitigation*: Default optional parameters, unit smoke via manual regression checklist, validation logs ensuring main chat path still creates bubbles with expected dataset attributes.
- **R3 – DOM state leakage between selections**: Transcript/composer must reset when `showResponseModalWithLoading` runs; failure would leak prior conversation (Cost: Medium, Blast: Medium). *Mitigation*: Central reset helper invoked before each modal open; add validation log verifying cleared transcript count.
- **R4 – CSS layout conflicts**: Reusing `.chat-input-*` classes inside modal may clash with existing global layout (Cost: Medium, Blast: Medium). *Mitigation*: Scope composer wrapper with modal-specific class, rely on existing variables, verify in responsive breakpoints.

## Coverage Checklist
- `selectionSensei.ts::SelectionSensei.ensureDOMElementsValid#L128`
- `selectionSensei.ts::SelectionSensei.handleTextSelection#L168`
- `selectionSensei.ts::SelectionSensei.createAndShowSelectionToolbar#L203`
- `selectionSensei.ts::SelectionSensei.activateAskMode#L291`
- `selectionSensei.ts::SelectionSensei.showResponseModalWithLoading#L375`
- `selectionSensei.ts::SelectionSensei.updateResponseModalContentAndTitle#L408`
- `selectionSensei.ts::SelectionSensei.processMermaidDiagrams#L595`
- `selectionSensei.ts::SelectionSensei.handleToolbarAction#L649`
- `ui.ts::displayMessage#L1133`
- `ui.ts::processMermaidBlocks#L1843`

## Assumptions & Unknowns Register
1. **A1** – `displayMessage` can be extended with an optional container parameter without altering existing behavior (Impact: High). *Verification*: Prototype on feature branch, run manual smoke (initial module greeting, user turn, LLM response) to confirm main chat unaffected.
2. **A2** – Selection Sensei follow-ups can reuse existing `Message` shape and streaming maps if IDs are namespaced (Impact: Medium). *Verification*: Generate test IDs prefixed with `selection-`, confirm no collisions via inspector/logs.
3. **A3** – `SELECTION_SENSEI_CONFIG` remains valid for multi-turn prompts, i.e., same model + system instruction handle follow-ups (Impact: Medium). *Verification*: Inspect `model_usage.ts` config; consider adding prompt context injection to maintain continuity; log payload metadata for first follow-up.
4. **A4** – Existing inline Ask mode may be deprecated or repurposed; need product decision (Impact: Medium). *Verification*: Ask user whether toolbar Ask should open modal with composer or remain; confirm acceptance criteria before changing UX.

## Key Architectural Insights
- Selection Sensei currently performs single-shot rendering via direct DOM mutation; no reuse of `displayMessage`, so transcripts require structural refactor.
- `displayMessage` tightly couples to `#message-area`; breaking this coupling must preserve animation/timer behavior and optional reload/enhance controls.
- Modal markup lives in `index.html`; to add transcript/composer we will likely split content area into scrollable transcript + anchored composer wrapper.
- Logging infrastructure (`logSelectionSenseiValidation`) already tags events; new feature should extend the same channel for observability.

## Next Protocol
Proceed with the **MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL** before implementation.

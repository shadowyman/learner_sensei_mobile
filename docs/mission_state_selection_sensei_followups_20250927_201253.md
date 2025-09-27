# Mission State - Selection Sensei Follow-ups
- Timestamp: 2025-09-27T20:13:27+03:00
- Triggering Protocol: Mandatory Core Analysis Protocol (Step 0)
- Next Protocol: Complete Core Analysis Step 6 (clarifications) then initiate Comprehensive Impact Analysis before design and implementation.

## Scope and Entry Points
- index.tsx::loadCurriculumAndGreet#L1030 initializes Selection Sensei and owns modal lifecycle setup; analyzer shows index.tsx has highest fan-out (18).
- selectionSensei.ts concentrates toolbar logic, modal rendering, and Gemini calls; multiple high side-effect methods (showResponseModalWithLoading, updateResponseModalContentAndTitle).
- ui.ts::displayMessage#L1139 renders chat bubbles, manages timers, and mermaid rendering; reuse is required for modal transcript.
- index.html response modal markup constrains layout; needs structural changes for transcript pane and composer.
- index.css `.message-bubble`, modal glassmorphism classes, and scrollbar rules must stay consistent across main chat and modal.
- prompts.ts and model_usage.ts supply Selection Sensei prompt templates and Gemini config referenced by handleToolbarAction.

## Static Execution Trace
1. index.tsx::loadCurriculumAndGreet#L1030 → initializeSelectionSensei(ai, messageArea).
2. selectionSensei.ts::initializeSelectionSensei#L894 → tears down previous instance and constructs SelectionSensei.
3. selectionSensei.ts::SelectionSensei.initialize#L76 → getDOMElements → attachEventListeners for selection, modal, and drag handlers.
4. selectionSensei.ts::SelectionSensei.handleTextSelection#L168 → createAndShowSelectionToolbar or hideSelectionToolbar based on selection context.
5. selectionSensei.ts::SelectionSensei.createAndShowSelectionToolbar#L203 → builds toolbar buttons, wires action callbacks, positions UI, requestAnimationFrame for reveal.
6. selectionSensei.ts::SelectionSensei.activateAskMode#L291 → injects textarea composer, binds keyboard submit, calls setupTextareaAutosize, defers to handleToolbarAction on submit.
7. selectionSensei.ts::SelectionSensei.handleToolbarAction#L649 → logs telemetry, shows modal loading state, crafts prompt (SENSEI_* templates), calls GoogleGenAI, falls through JSON repair helpers.
8. selectionSensei.ts::SelectionSensei.showResponseModalWithLoading#L375 → ensureDOMElementsValid, clears prior DOM nodes, updates spinner/title, displays modal.
9. selectionSensei.ts::SelectionSensei.updateResponseModalContentAndTitle#L408 → sanitizeCodeFences → marked.parse → DOM replacement → highlight.js → addLanguageDisplayToCodeBlocks → addCopyButtonsToCodeBlocks → processMermaidDiagrams.
10. selectionSensei.ts::SelectionSensei.processMermaidDiagrams#L595 → mermaidManager.render → renderMermaidThumbnailWithTheme with runMermaidRecovery fallback.

## Dependency and Side-Effect Table
| Function (stable id) | Key dependencies | Side effects | Risk (1-5) |
| --- | --- | --- | --- |
| SelectionSensei.handleToolbarAction#L649 | logSelectionSenseiValidation, SelectionSensei.showResponseModalWithLoading, SelectionSensei.hideSelectionToolbar, SENSEI_* prompt factories, GoogleGenAI.models.generateContent, SelectionSensei.updateResponseModalContentAndTitle, SelectionSensei.attemptJSONRepair | Makes network call, toggles modal state, mutates toolbar state, logs structured metadata | 4 |
| SelectionSensei.updateResponseModalContentAndTitle#L408 | SelectionSensei.ensureDOMElementsValid, sanitizeCodeFences, marked.parse, addLanguageDisplayToCodeBlocks, addCopyButtonsToCodeBlocks, hljs.highlightElement, SelectionSensei.processMermaidDiagrams | Replaces modal DOM, hides spinner, triggers mermaid rendering, manipulates copy/highlight controls | 4 |
| SelectionSensei.showResponseModalWithLoading#L375 | SelectionSensei.ensureDOMElementsValid, logSelectionSenseiValidation, logger.error | Clears modal content, sets spinner/title, forces flex display and transforms | 3 |
| SelectionSensei.activateAskMode#L291 | setupTextareaAutosize, SelectionSensei.handleToolbarAction (via inline callbacks) | Generates textarea/button, binds event listeners, locks toolbar buttons, focuses input | 3 |
| SelectionSensei.createAndShowSelectionToolbar#L203 | SelectionSensei.hideSelectionToolbar, SelectionSensei.activateAskMode, SelectionSensei.handleToolbarAction, SelectionSensei.handleAddToNotepad | Creates floating toolbar DOM, binds click handlers, positions with viewport calculations | 3 |
| ui.ts::displayMessage#L1139 | messageArea, marked.parse, sanitizeCodeFences, mermaidManager.render, renderMermaidThumbnailWithTheme, runMermaidRecovery, addLanguageDisplayToCodeBlocks_internal, addCopyButtonsToCodeBlocks_internal, renderIcons | Mutates chat DOM, manages timers/intervals, appends reload/enhance buttons, updates scroll position | 4 |
| selectionSensei.ts::initializeSelectionSensei#L894 | SelectionSensei.cleanup, SelectionSensei.initialize | Tears down previous listeners, instantiates new SelectionSensei, rebinds modal hooks | 2 |

## Risk Register
- High: Altering ui.ts::displayMessage to support alternate containers could break main chat rendering if default behavior changes; must preserve existing call signature and scrolling side effects.
- High: Sharing streamingMessagesRawText timers between modal and main chat risks cross-contamination; modal transcript must isolate IDs and timer lifecycle.
- Medium: Modal reset logic currently only clears DOM; adding composer/transcript state must integrate with initializeSelectionSensei cleanup to avoid stale listeners.
- Medium: Reusing mermaid rendering within modal transcript may impact performance if follow-up exchanges accumulate diagrams; needs guard for skipMermaid when appropriate.

## Coverage Checklist
- selectionSensei.ts::SelectionSensei.initialize#L76
- selectionSensei.ts::SelectionSensei.handleTextSelection#L168
- selectionSensei.ts::SelectionSensei.createAndShowSelectionToolbar#L203
- selectionSensei.ts::SelectionSensei.activateAskMode#L291
- selectionSensei.ts::SelectionSensei.handleToolbarAction#L649
- selectionSensei.ts::SelectionSensei.showResponseModalWithLoading#L375
- selectionSensei.ts::SelectionSensei.updateResponseModalContentAndTitle#L408
- selectionSensei.ts::SelectionSensei.processMermaidDiagrams#L595
- ui.ts::displayMessage#L1139

## Assumptions and Unknowns Register
| Statement | Impact | Verification plan |
| --- | --- | --- |
| Parameterizing ui.ts::displayMessage with an optional target container keeps existing main chat flows untouched when argument omitted | High | Implement defaulted argument, run regression smoke on primary chat sending and Sensei responses |
| Selection Sensei modal should render user and sensei bubbles using existing `.message-bubble` CSS without additional theme adjustments | Medium | Prototype transcript container in modal, verify alignment via manual UI check |
| Resetting Selection Sensei state on new text selections must clear timers, transcript nodes, and composer inputs | Medium | Add explicit reset routine invoked from initializeSelectionSensei and selection triggers, confirm via repeated selection test |

## Key Architectural Insights
- displayMessage currently assumes a singleton messageArea and global timers; follow-up support requires refactoring toward dependency injection while guarding existing scroll behavior.
- Selection Sensei modal manipulates raw DOM without virtual state; transcript handling must manage nodes, ids, and event listeners explicitly.
- currentSelectionSenseiInstance cleanup is the primary gate for avoiding duplicate listeners; any new state (transcript entries, timers) must hook into cleanup to prevent leaks.

## Next Steps
- Proceed with Core Analysis Step 6 to confirm mission objectives and resolve user constraints.
- After clarifications, execute the Comprehensive Impact Analysis Protocol before drafting design approaches.

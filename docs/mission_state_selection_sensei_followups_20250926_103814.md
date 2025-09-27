# Mission State – Selection Sensei Follow-Ups (2025-09-26 10:38:14)

## Entry Points & Scope
- `index.tsx::loadCurriculumAndGreet@41815` – bootstraps Selection Sensei via `initializeSelectionSensei(ai, messageArea)` once curriculum and UI load.
- `selectionSensei.ts` core class methods – event capture (`handleTextSelection`), toolbar orchestration (`createAndShowSelectionToolbar`, `activateAskMode`), Gemini request pipeline (`handleToolbarAction` → `updateResponseModalContentAndTitle`), and modal lifecycle helpers.
- `index.html` Selection Sensei modal markup (`#response-modal`, `#response-modal-content-area`, `#response-modal-text-content`).
- `index.css` glassmorphism styling for modal / bubble.
- `ui.ts::displayMessage@45678` – main chat renderer we must refactor for modal reuse without regressing primary stream.

Hot modules from analyzer summary corroborate scope (`selectionSensei.ts`, `ui.ts`, `index.tsx`, `prompts.ts`).

## Static Execution Trace
1. `index.tsx::loadCurriculumAndGreet` → `selectionSensei.ts::initializeSelectionSensei` (creates new `SelectionSensei` instance with AI + `messageArea`).
2. `SelectionSensei.initialize` → `getDOMElements` (cache modal nodes) → `attachEventListeners` (bind selection/mouse handlers, drag, close).
3. User highlights Sensei bubble text ⇒ `handleTextSelection` either hides toolbar or `createAndShowSelectionToolbar(selectedText, originalMessage)`.
4. Toolbar click `Ask` ⇒ `activateAskMode` injects textarea/send controls into floating toolbar; submit triggers `handleToolbarAction` with `askQuestion`.
5. `handleToolbarAction` pipeline:
   - `showResponseModalWithLoading` (clear + spinner, log).
   - Compose prompt via `SENSEI_*` helpers, call `ai.models.generateContent` (Gemini) with `SELECTION_SENSEI_CONFIG`.
   - Parse LLM JSON, fallback to regex/raw.
   - On success call `updateResponseModalContentAndTitle(title, explanation)`.
6. `updateResponseModalContentAndTitle` sanitizes markdown, uses `marked`, highlights code, `addLanguageDisplayToCodeBlocks`, `addCopyButtonsToCodeBlocks`, and `processMermaidDiagrams` (→ `mermaidManager.render` with recovery fallback).
7. Modal remains interactive until `hideResponseModal` (close button/outside click) resets state.

## Dependency & Side-Effect Table
| Function (File) | Key Dependencies | Side Effects & Risk | Notes |
| --- | --- | --- | --- |
| `loadCurriculumAndGreet` (`index.tsx`) | `initializeSelectionSensei`, `displayMessage`, `setupFullscreenToggle`, curriculum loaders | High blast DOM/global writes (window handler binding, UI state). Risk 3/5: upstream change can break Selection Sensei init if modal DOM IDs change. |
| `initializeSelectionSensei` (`selectionSensei.ts`) | `SelectionSensei.cleanup`, constructor, `initialize` | Mutates module-level singleton. Risk 2/5: ensures single instance; must preserve cleanup semantics before re-init. |
| `SelectionSensei.initialize` | `getDOMElements`, `attachEventListeners` | Registers DOM listeners. Risk 3/5: duplicate listeners if refs not cleared; relies on modal IDs. |
| `SelectionSensei.getDOMElements` | DOM lookups for `#response-modal*` | Medium risk: null refs when markup changes. Must extend for new transcript/composer nodes. |
| `SelectionSensei.attachEventListeners` | `handleTextSelection`, `handleSelectionChange`, drag handlers | Medium-high: attaches document-level listeners (mousemove, pointerdown). Need to avoid leaks when adding new modal events. |
| `SelectionSensei.handleTextSelection` | `createAndShowSelectionToolbar`, `hideSelectionToolbar` | DOM selection reads; risk 2/5 (toolbar flicker) but must reset new modal state when triggered concurrently. |
| `SelectionSensei.createAndShowSelectionToolbar` | `TOOLBAR_ACTIONS`, `hideSelectionToolbar`, `activateAskMode`, `handleToolbarAction`, `handleAddToNotepad` | Creates floating toolbar DOM, binds click listeners per action. Risk 3/5: manual event wiring and dynamic removal; new flow must coordinate with modal follow-up transcript resets. |
| `SelectionSensei.activateAskMode` | `handleToolbarAction`, `setupTextareaAutosize` | Disables toolbar buttons, adds textarea. Risk 3/5: existing inline composer conflicts with upcoming modal composer; will require redesign or reuse logic elsewhere. |
| `SelectionSensei.handleToolbarAction` | `showResponseModalWithLoading`, `logSelectionSenseiValidation`, prompt helpers, Gemini `generateContent`, `updateResponseModalContentAndTitle`, parsing helpers | High risk 5/5: external API call (LLM), asynchronous control, state resets; currently single-turn expectation. Must evolve to manage transcript, error states, and composer disable/enable cycles in modal. |
| `SelectionSensei.showResponseModalWithLoading` | `ensureDOMElementsValid` | Clears modal content, sets spinner, logs. Risk 3/5: must also clear transcript/composer caches to avoid stale data per requirement. |
| `SelectionSensei.updateResponseModalContentAndTitle` | `sanitizeCodeFences`, `marked`, `addLanguageDisplayToCodeBlocks`, `addCopyButtonsToCodeBlocks`, `processMermaidDiagrams` | Medium-high 4/5: heavy DOM writes, async mermaid processing; currently assumes single wrapper div. Need to refactor to target transcript container while preserving enhancements. |
| `SelectionSensei.processMermaidDiagrams` | `mermaidManager.render`, `runMermaidRecovery` | High concurrency cost: async rendering + recovery loops; must ensure per-message container hooking still works when transcript adds multiple bubbles. |
| `SelectionSensei.hideResponseModal` | `hideSelectionToolbar` | Clears modal, resets classes. Risk 2/5 but must flush new conversation state as well. |
| `ui.ts::displayMessage` | `resetEnhancementState`, `marked`, `mermaidManager`, `runMermaidRecovery`, DOM APIs | High risk 5/5: central renderer with large surface area; currently hardcodes `messageArea` along with reload/enhance buttons. Refactor must not break main chat semantics. |

## Risk Register (High-Cost/Blast)
1. `handleToolbarAction`: External Gemini call + modal state transitions; failure leaves modal stuck. Mitigation: introduce robust loading/timeout handling and transcript-aware error fallback.
2. `displayMessage`: Refactor could regress main chat rendering or streaming; requires regression tests plus feature flag-style switch for modal container.
3. `updateResponseModalContentAndTitle` / `processMermaidDiagrams`: Multiple DOM rewrites + async renders; when transcript holds many bubbles risk of orphaned observers. Need container-scoped rendering guards.
4. Toolbar/ask-mode vs modal composer: parallel input UIs can conflict (double submissions). Need single source of truth after redesign.

## Coverage Checklist (Functions to exercise post-implementation)
- `index.tsx::loadCurriculumAndGreet@41815`
- `selectionSensei.ts::initializeSelectionSensei@39158`
- `selectionSensei.ts::SelectionSensei.initialize@3241`
- `selectionSensei.ts::SelectionSensei.attachEventListeners@6789`
- `selectionSensei.ts::SelectionSensei.handleTextSelection@7682`
- `selectionSensei.ts::SelectionSensei.createAndShowSelectionToolbar@9247`
- `selectionSensei.ts::SelectionSensei.activateAskMode@12829`
- `selectionSensei.ts::SelectionSensei.handleToolbarAction@27888`
- `selectionSensei.ts::SelectionSensei.showResponseModalWithLoading@16182`
- `selectionSensei.ts::SelectionSensei.updateResponseModalContentAndTitle@17736`
- `selectionSensei.ts::SelectionSensei.processMermaidDiagrams@25188`
- `selectionSensei.ts::SelectionSensei.hideResponseModal@21319`
- `ui.ts::displayMessage@45678`

## Assumptions & Unknowns Register
| Statement | Impact | Verification Plan |
| --- | --- | --- |
| `displayMessage` can be parameterized (container, alignment) without breaking main chat animation/streaming. | High | Prototype refactor with dependency injection; run regression on main chat + selection transcript in browser. |
| Modal DOM can be restructured into `{transcript, composer}` zones while keeping Selection Sensei drag/resize stable. | Medium | Adjust `getDOMElements` to grab new nodes; verify drag, resize, and CSS breakpoints manually. |
| Existing Gemini prompt shape remains valid for multi-turn follow-ups (JSON schema). | High | Dry-run API call with extended conversation context; adjust prompt if necessary. |
| Toolbar ask-mode should be deprecated once modal composer exists; need confirmation whether floating toolbar still requires inline input. | Medium | Clarify UX intent with stakeholder/user; decide whether to keep or remove toolbar ask mode. |

## Architectural Insights
- Selection Sensei is a single-instance controller hanging off global `messageArea`; modal content is presently monolithic (`#response-modal-text-content`) and assumes single Sensei bubble.
- `displayMessage` couples message DOM creation with main chat container/location; to reuse it we need a composition-friendly adapter (container + options for alignment, icon buttons, timestamp).
- Glassmorphism modal styling already separates header/content; adding transcript/composer should follow existing `code-editor` modal layout patterns (flex column, sticky footer) to maintain consistency.
- Analyzer fan-out shows `selectionSensei.ts` touches `ui.ts`, `prompts.ts`, `mermaidManager`—confirming need for modular surface to avoid duplicating bubble markup.

## Next Protocol
Proceed to **MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL** with focus on introducing modal transcript/composer while refactoring `displayMessage` for multi-context rendering.

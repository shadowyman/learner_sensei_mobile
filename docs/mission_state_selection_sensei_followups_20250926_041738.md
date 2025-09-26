# Mission State Checkpoint - Selection Sensei Followups

- Timestamp: 20250926_041738
- Analysis Scope & Entry Points:
  * `SelectionSensei.handleTextSelection` reacts to highlighted text inside `#message-area` and decides when to surface the toolbar.
  * `SelectionSensei.createAndShowSelectionToolbar` materializes the floating toolbar and wires action buttons, including Ask.
  * `SelectionSensei.activateAskMode` injects the temporary question input and routes follow-up submissions into the handler.
  * Supporting layout and styling live in `index.html`, `index.css`, and bubble rendering helpers in `ui.ts` provide reference behavior for parity with main Sensei.

- Static Execution Trace:
  1. `SelectionSensei.handleTextSelection`
  2. `SelectionSensei.createAndShowSelectionToolbar`
  3. `SelectionSensei.activateAskMode`
  4. `SelectionSensei.handleToolbarAction`
  5. `SelectionSensei.showResponseModalWithLoading`
  6. `GoogleGenAI.models.generateContent`
  7. `SelectionSensei.updateResponseModalContentAndTitle`
  8. `SelectionSensei.processMermaidDiagrams`

- Dependency & Side-Effect Analysis:

| Function | Key Dependencies | Side Effects |
| --- | --- | --- |
| `handleTextSelection` | DOM selection API, `.message-bubble[data-sender="sensei"]` structure | Toggles selection toolbar visibility |
| `createAndShowSelectionToolbar` | `TOOLBAR_ACTIONS`, `document.body` | Creates/destroys toolbar DOM nodes, positions UI |
| `activateAskMode` | `setupTextareaAutosize`, toolbar buttons | Disables other actions, injects textarea+send control, focus management |
| `handleToolbarAction` | `logger`, prompt builders, `SELECTION_SENSEI_CONFIG`, `showResponseModalWithLoading`, `this.ai.models.generateContent` | Emits logs, hides toolbar, triggers network call, updates modal state |
| `showResponseModalWithLoading` | Modal DOM refs, `ensureDOMElementsValid` | Clears previous content, shows spinner, displays modal |
| `updateResponseModalContentAndTitle` | `sanitizeCodeFences`, `marked`, `hljs`, `addLanguageDisplayToCodeBlocks`, `addCopyButtonsToCodeBlocks`, `processMermaidDiagrams` | Renders markdown, applies syntax highlighting, manipulates modal DOM |
| `processMermaidDiagrams` | `mermaidManager`, `renderMermaidThumbnailWithTheme`, `runMermaidRecovery` | Converts Mermaid blocks to SVG, injects thumbnails, logs failures |

- Key Architectural Insights:
  * Selection Sensei currently treats each request as a single-turn exchange; the modal owns one Sensei bubble and no persistent history container.
  * Follow-up support will require a reusable message rendering pattern that mirrors main Sensei bubbles while fitting inside the modal glassmorphism aesthetic.
  * The existing ask workflow destroys the toolbar on submit, so new follow-up inputs must live inside the modal rather than the transient toolbar lifecycle.

- Next Protocol: MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL

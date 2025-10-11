# Mission State – Selection Sensei Mermaid Disable (2025-10-11)

## Scope & Entry Points
- Focus: Disable Mermaid diagram generation and rendering inside the Selection Sensei modal pipeline while keeping the rest of the workflow intact.
- Primary modules: `src/selectionSensei.ts`, `src/prompts.ts`, `src/model_usage.ts`, `src/ui.ts`.
- Entry points: `initializeSelectionSensei` → `SelectionSensei.initialize` → selection toolbar actions (`handleToolbarAction`, follow-up handlers).
- Supporting dependencies: `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION`, `SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION`, `SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION`, `SELECTION_SENSEI_CONFIG`, `displayMessage`, `sanitizeCodeFences`, `highlight.js`, `addLanguageDisplayToCodeBlocks`, `addCopyButtonsToCodeBlocks`, `mermaidManager`, `runMermaidRecovery`, `renderMermaidThumbnailWithTheme`.
- Analyzer snapshot refreshed via `npm run analysis:run` (2025-10-11T12:52:16Z).

## Static Execution Trace
1. `initializeSelectionSensei` tears down any prior instance, instantiates `SelectionSensei`, and calls `initialize`.
2. `SelectionSensei.initialize` acquires modal DOM references, binds selection listeners, and prepares composer controls.
3. User selection triggers `handleTextSelection` → `createAndShowSelectionToolbar`, exposing action buttons (explain, analogy, example, ask question, add to notepad).
4. Toolbar button invokes `handleToolbarAction`, which builds the prompt via `SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION` (or `SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION`), ensures a chat via `ensureSelectionChat` (injecting `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION` & `SELECTION_SENSEI_CONFIG`), and sends the LLM request.
5. LLM response text is stored in `modalMessageRegistry.rawText` and parsed via `extractContentWithRegex`; content selection decides between parsed JSON, explanation-only, or raw fallback.
6. `updateResponseModalContentAndTitle` clears/rewrites modal DOM, applies Markdown parsing (`marked.parse`), highlights code blocks (`hljs`), adds language pills/copy buttons, then delegates Mermaid handling to `processMermaidDiagrams`.
7. `processMermaidDiagrams` searches `pre code.language-mermaid`, renders thumbnails with `mermaidManager.render` and `renderMermaidThumbnailWithTheme`; on failure it replaces blocks with recovery UI and calls `runMermaidRecovery` (LLM-backed) before falling back to text placeholders.
8. Follow-up flow (`handleFollowupSubmit` → `dispatchFollowupToAI` → `appendModalMessage`) reuses the same append path, skipping global Mermaid rendering and re-invoking `processMermaidDiagrams`.

## Dependency & Side-Effect Table
| Function | Key Dependencies | Side Effects / Cost | Risk |
| --- | --- | --- | --- |
| `SelectionSensei.handleToolbarAction` | Prompt templates, `ensureSelectionChat`, `chat.sendMessage`, `updateResponseModalContentAndTitle`, logging utilities | High-cost Gemini request, modal state resets, DOM mutations, composer enable/disable | High |
| `SelectionSensei.updateResponseModalContentAndTitle` | `sanitizeCodeFences`, `marked`, `hljs.highlightElement`, `addLanguageDisplayToCodeBlocks`, `addCopyButtonsToCodeBlocks`, `processMermaidDiagrams`, `setComposerEnabled` | Rebuilds modal DOM subtree, toggles spinner/title, triggers async post-processing | High |
| `SelectionSensei.processMermaidDiagrams` | `mermaidManager.render`, `renderMermaidThumbnailWithTheme`, `runMermaidRecovery`, `updateModalMermaidFence`, DOM APIs | Mermaid thumbnail injection, recovery spinner lifecycle, potential extra LLM call, raw markdown mutation | High |
| `SelectionSensei.appendModalMessage` | `displayMessage`, `processMermaidDiagrams`, `modalMessageRegistry` | Appends DOM nodes to transcript, skips global Mermaid rendering, may trigger recovery path | Medium |
| `SelectionSensei.ensureSelectionChat` | `SELECTION_SENSEI_CONFIG`, `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION`, `ai.chats.create` | Builds cached Gemini chat with system instruction embedding Mermaid mandate | Medium |
| `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION` (constant) | `MERMAID_GENERATION_GUIDELINES`, persona text | Drives LLM toward Mermaid output; conflicts with desired disablement | High |

## Risk Register
- **R1 – Mermaid Mandate Drift (High):** `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION` imports `MERMAID_GENERATION_GUIDELINES`, so the LLM will continue emitting Mermaid diagrams unless the instruction or association is removed. *Plan:* excise Mermaid directives from the constant or stop passing the constant entirely.
- **R2 – Dead Mermaid Pipeline (High):** Removing rendering without clearing imports leaves `processMermaidDiagrams` referencing `mermaidManager`/`runMermaidRecovery`, causing runtime errors or unused bundle weight. *Plan:* eliminate Mermaid-specific processing code paths and sanitize imports.
- **R3 – Plain-Code Display Regression (Medium):** Once Mermaid rendering is removed, `language-mermaid` blocks may bypass syntax highlighting and copy buttons. *Plan:* convert Mermaid fences to a standard language class (e.g., `language-plaintext`) during modal post-processing; verify highlight behavior.
- **R4 – Follow-up Consistency (Medium):** Follow-up responses rely on `appendModalMessage` + `processMermaidDiagrams`; removing Mermaid handling must preserve transcript storage (`modalMessageRegistry`) and notepad export fidelity. *Plan:* ensure raw markdown persists and add regression checklist for follow-up actions.

## Coverage Checklist
- Exercise `SelectionSensei.handleToolbarAction` with sample responses containing standard Markdown and code fences to confirm modal rendering sans Mermaid helpers.
- Verify follow-up path (`handleFollowupSubmit` → `dispatchFollowupToAI`) still appends responses and respects composer enable/disable state after Mermaid removal.
- Confirm `updateResponseModalContentAndTitle` converts former Mermaid fences into highlighted static code blocks (language reassignment + copy buttons intact).
- Static check: ensure `selectionSensei.ts` no longer imports `mermaidManager`, `renderMermaidThumbnailWithTheme`, or `runMermaidRecovery`. ✅ Completed.
- Grep for residual references to `MERMAID_GENERATION_GUIDELINES` within Selection Sensei scope after edits. ✅ Completed.
- Jest guard `__tests__/selectionSensei.prompts.test.ts` ensures Selection Sensei prompt surfaces omit Mermaid directives. ✅ Added & passing (2025-10-11).
- KaTeX rendering smoke: `__tests__/markdown.math.test.ts` drives a Node subprocess to validate inline and display math render with KaTeX markup. ✅ Added & passing (2025-10-11).

## Unknowns & Verification Plans
- **U1 (Medium impact):** How should `language-mermaid` blocks be transformed for consistent highlighting once rendering is gone? *Verification:* adjust modal post-processing to remap class to `language-plaintext`; validate visually or via DOM inspection script after implementation.
- **U2 (Low impact):** Does any other runtime path depend on `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION` retaining Mermaid guidance (e.g., `index.tsx` imports)? *Verification:* repo-wide search post-change; remove unused imports; ensure no build errors.
- **U3 (Medium impact):** Will notepad exports or saved transcripts rely on Mermaid thumbnails? *Verification:* inspect notepad serialization after disabling Mermaid to ensure plain code persists; add manual QA step if automation unavailable.
- **Resolution Update (2025-10-11):** U1 addressed via `normalizeMermaidCodeBlocks` helper; class rewrite and highlight re-run confirmed. U2 verified by analyzer search—no external dependency on Mermaid directives. U3 deemed non-blocking; Selection Sensei remains isolated from notepad/save-load (confirmed by code search).
- **Math Rendering (2025-10-11):** Inline and block math now flow through KaTeX; styling aligns with Sensei code formatting (`src/index.css`). Additional manual QA recommended for complex formulas.

## Key Architectural Insights
- Selection Sensei maintains its own Gemini chat with a dedicated system instruction; adjusting that hook is sufficient to stop Mermaid guidance at the source.
- Modal rendering pipeline is layered: Markdown render → highlight/copy enhancements → Mermaid post-processor. Removing Mermaid logic requires filling the gap so highlight/copy still operate on former Mermaid blocks.
- Mermaid recovery introduces additional Gemini calls; disabling it will reduce latency and API usage but demands careful handling so failures degrade gracefully to plain text.

## Next Protocol
- Proceed to **COMPREHENSIVE IMPACT ANALYSIS PROTOCOL** before modifying existing code paths.

## Test Traceability
- Candidate regression test: add DOM-level assertion (unit or integration harness) ensuring Selection Sensei modal content swaps `language-mermaid` classes to `language-plaintext` and avoids Mermaid thumbnail containers post-change.
- Jest prompt guard implemented (`__tests__/selectionSensei.prompts.test.ts`) verifying Mermaid instructions absence; manual DOM validation still pending for future automation.

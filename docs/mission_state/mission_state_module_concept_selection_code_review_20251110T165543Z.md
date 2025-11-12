# Mission State – Module Concept Selection Code Review (Core Analysis)

## Scope & Entry Points
- Primary trigger: `ModuleSelectionHandler.handleConceptSelection` (src/moduleSelectionHandler.ts:245) when a learner selects a concept bubble.
- Orchestrator: `ModuleSelectionHandler.executePhaseSelection` (src/moduleSelectionHandler.ts:282) which owns loader UI, planner/jump execution, KeyTakeaway enhancer wiring, and state resets.
- Rendering surface: `displayMessage`, markdown sanitizers, and mermaid processing in `src/ui.ts` own every bubble, enhancement button, and icon injection touched by the change.
- Supporting modules: `KeyTakeawayEnhancerController` (intro enhancer), `sendSystemSocraticMessage`, and `updateKCProgressBar` bridge LLM streaming, Socratic transitions, and learner progress UI.

## Static Execution Trace (Depth ≤ 4)
1. `ModuleSelectionHandler.handleConceptSelection` → validates module + concept, updates pending selection state, emits the learner bubble through `displayMessage`, clears concept/phase bubbles, and awaits `executePhaseSelection`.
2. `ModuleSelectionHandler.executePhaseSelection` → disables previous phase buttons, shows loader bubble (`displayMessage`), spins dot/message intervals, calls `jumpToPhase`, and for IntroIllustrate builds `introContext`, arms `KeyTakeawayEnhancerController`, streams via `streamModuleIntroduction`, updates history, and invokes `processMermaidBlocks`.
3. `displayMessage` → sanitizes markdown (`sanitizeMarkdownFences` → `parseSanitizedMarkdown`), maintains raw-text registries, manages timers, renders icons, attaches language badges, copy/edit buttons, and bold-selection handlers before queueing `processMermaidBlocks`.
4. `processMermaidBlocks` → walks `<pre><code class="language-mermaid">` blocks and replaces them via `mermaidManager.render`, falling back to `runMermaidRecovery` and `replaceMermaidFenceInRaw` for broken diagrams.
5. Post-phase orchestration → `updateCurriculumDisplay` refreshes status headers and arrows, `logModuleSelectionValidation` captures telemetry, `sendSystemSocraticMessage` (if needed) streams a system bubble with reload metadata, and `updateKCProgressBar` syncs mastery visuals.

## Dependency & Side-Effect Table
| Function (file:line) | Key Dependencies / Inputs | Side Effects / Observations | Risk |
| --- | --- | --- | --- |
| `sanitizeCodeFences` (src/ui.ts:109) | Pure regex helper used by `sanitizeMarkdownFences`. | Removes leading whitespace before backtick fences so markdown stays valid. | Low |
| `sanitizeClosingBackticksOnly` (src/ui.ts:114) | Operates inside sanitize pipeline. | Strips indentation on closing fences only, preventing premature fence closure. | Low |
| `escapePipesInInlineCode` (src/ui.ts:162) | Uses `replaceInlinePipesInCodeSpans`, tracks header rows. | Injects placeholders so inline `|` characters don’t break tables. | Low |
| `sanitizeIndentedListItems` (src/ui.ts:228) | Runs immediately after fence closures. | Normalizes list markers following code fences by removing stray indentation. | Low |
| `ensureBlankLineAfterHtmlBlocks` (src/ui.ts:263) | Consumes sanitized lines from prior helpers. | Adds blank lines after `<h#>` blocks when the next line would otherwise glue to HTML. | Low |
| `sanitizeMarkdownFences` (src/ui.ts:308) | Composes the previous helpers. | Single entrypoint used before parsing Sensei markdown. | Low |
| `restoreInlinePipePlaceholders` (src/ui.ts:313) | Called by `parseSanitizedMarkdown`. | Swaps placeholder tokens back into literal pipes after parsing. | Low |
| `parseSanitizedMarkdown` (src/ui.ts:318) | Calls `marked.parse`. | Produces HTML; relies on upstream sanitizers to block XSS vectors. | Medium |
| `parseSenseiMarkdown` (src/ui.ts:329) | Wraps sanitize → parse pipeline. | Primary renderer for Sensei-authored markdown snippets. | Medium |
| `escapeHtml` (src/ui.ts:333) | Utility for user messages. | Escapes raw text outside code fences. | Low |
| `replaceMermaidFenceInRaw` (src/ui.ts:335) | Uses `streamingMessagesRawText`. | Mutates stored markdown when mermaid recovery succeeds/fails to keep reloads consistent. | Medium |
| `renderUserMessageHtml` (src/ui.ts:347) | Builds on `parseSenseiMarkdown` + `escapeHtml`. | Splits text into code vs prose to keep user bubbles safe. | Medium |
| `getPhaseDisplayName` (src/ui.ts:816) | Simple mapping. | No side effects beyond returning localized labels. | Low |
| `updateCurriculumDisplay` (src/ui.ts:825) | Needs curriculum item/state + optional learner model. | Writes DOM, shimmer animations, and calls `window.updateKCProgressBar` if available. | Medium/High |
| `updateConceptNavigationArrowsUI` (src/ui.ts:921) | Reads DOM buttons and curriculum state. | Shows/hides concept + chunk navigation arrows and disables invalid transitions. | Medium |
| `addLanguageDisplayToCodeBlocks_internal` (src/ui.ts:1482) | Traverses `<pre><code>` nodes. | Inserts language badges above code blocks each render. | Low |
| `addCopyButtonsToCodeBlocks_internal` (src/ui.ts:1535) | Uses clipboard API + message metadata. | Adds Copy/Edit actions, handles async clipboard feedback, may expose errors in unsupported browsers. | Medium |
| `attachSenseiBoldInteractions` (src/ui.ts:1800) | Pointer/touch/mouse events on `<strong>`. | Adds selection handlers with synthetic mouseup events to support Sensei Bold UX. | Medium |
| `displayMessage` (src/ui.ts:1892) | Depends on logger, registries, markdown pipeline, icon renderer, `processMermaidBlocks`, code-block enhancers. | Central bubble renderer managing DOM lifecycle, timers, dataset flags, and concept selection payloads. | High |
| `renderIcons` (src/ui.ts:2473) | ICONS constant. | Injects trusted inline SVG for `.icon-placeholder` elements via `innerHTML`. | Medium |
| `processMermaidBlocks` (src/ui.ts:2895) | `mermaidManager`, `runMermaidRecovery`, DOM selectors. | Async mermaid rendering/recovery; replaces DOM nodes and raw markdown snapshots. | High |
| `hasKeyTakeawayEnhancerCacheEntry` (src/keyTakeawayEnhancerController.ts:20) | Shared in-memory cache. | Simple cache lookup; no state mutation. | Low |
| `computeKeyTakeawayEnhancerPromptHash` (src/keyTakeawayEnhancerController.ts:24) | FNV-like hash loop. | Deterministic prompt hashing for cache keys. | Low |
| `KeyTakeawayEnhancerController.start` (src/keyTakeawayEnhancerController.ts:65) | Google GenAI chats + cache + `updateMessageStream`. | Launches enhancer request, updates cache, resolves/rejects promise, may update live stream asynchronously. | High |
| `logModuleSelectionValidation` (src/moduleSelectionHandler.ts:64) | `logger.info`. | Emits structured telemetry for selection validation. | Low |
| `ModuleSelectionHandler.handleConceptSelection` (src/moduleSelectionHandler.ts:245) | State object, `displayMessage`, bubble cleanup helpers, `executePhaseSelection`. | Validates module/concept choice, bumps message ID, emits learner bubble, updates pending selection state. | High |
| `ModuleSelectionHandler.executePhaseSelection` (src/moduleSelectionHandler.ts:282) | DOM APIs, `displayMessage`, `jumpToPhase`, KeyTakeaway enhancer, `streamModuleIntroduction`, `updateCurriculumDisplay`, `processMermaidBlocks`, `updateResponseHistory`. | Drives loader UI, LLM planning, intro streaming, reload metadata, state resets, and spinner cleanup. | Critical |
| `ModuleSelectionHandler.clearConceptSelectionBubble` (src/moduleSelectionHandler.ts:669) | `document.getElementById`. | Removes previously rendered concept bubble + clears pending id. | Medium |
| `ModuleSelectionHandler.removePhaseSelectionBubble` (src/moduleSelectionHandler.ts:680) | DOM query selectors. | Deletes residual phase selector bubble when concept confirmed. | Medium |
| `ModuleSelectionHandler.showWrapUpAssessmentApology` (src/moduleSelectionHandler.ts:740) | `displayMessage`, `unlockWrapUpChatControls`. | Sends apology bubble + re-enables wrap-up controls when overlay missing. | Medium |
| `ModuleSelectionHandler.sendSystemSocraticMessage` (src/moduleSelectionHandler.ts:755) | `buildSocraticConceptReference`, dynamic `import('./interactionHelpers.js')`, `displayMessage`, `processMermaidBlocks`. | Streams system Socratic response, stores reload metadata, updates history, processes mermaid content. | High |
| `ModuleSelectionHandler.updateResponseHistory` (src/moduleSelectionHandler.ts:821) | Internal arrays. | Maintains rolling list of recent Sensei responses (max 3). | Low |
| `ModuleSelectionHandler.buildSocraticConceptReference` (src/moduleSelectionHandler.ts:828) | Reads curriculum + state. | Generates textual concept recap for Socratic prompts. | Low |
| `ModuleSelectionHandler.updateKCProgressBar` (src/moduleSelectionHandler.ts:858) | DOM lookups, timers, logger. | Updates KC progress fill/text, toggles attributes, plays celebration animation via timeout. | Medium |

## Risk Register
| Function | Risk Driver | Blast Radius / Notes | Mitigation |
| --- | --- | --- | --- |
| `ModuleSelectionHandler.executePhaseSelection` | Heavy orchestration of DOM, teaching-plan generation, KeyTakeaway enhancer, loader intervals, and reload metadata. | Breakages freeze concept selection entirely or leave loaders pinned. | Regression-test concept selection → Intro flow, verify `cleanupPhaseBubble` clears timers, and assert jump-to-phase error handling surfaces user-facing fallback. |
| `displayMessage` | Central renderer for every chat bubble, registry timer owner, and concept payload carrier. | Any regression corrupts chat UI globally (duplicate IDs, stuck timers, wrong payloads). | Exercise user + sensei bubble rendering (loading + final), confirm timers cleared, and inspect dataset cleanup when bubbles are reused. |
| `processMermaidBlocks` | Async mermaid rendering plus recovery swaps DOM and raw markdown. | Failure yields missing diagrams or broken reload markdown across the session. | Test valid + intentionally broken diagrams with/without `window.ai`, ensuring fallback text insertion and raw-text replacement behave. |
| `KeyTakeawayEnhancerController.start` | Background LLM streaming + caching modifies live intro bubbles. | Errors or stale cache can inject outdated enhancer text or leave placeholders. | Verify cache-hit vs fresh-run code paths, ensure `updateMessageStream` promise rejections are logged, and confirm `removePlaceholder` fires on timeout. |
| `ModuleSelectionHandler.sendSystemSocraticMessage` | Dynamic import, LLM streaming, reload metadata, mermaid reprocessing. | Failures block Socratic entry and leave reload buttons inconsistent. | Run Socratic entry scenario, confirm reloadContext JSON stored, and monitor mermaid post-processing logs. |

## Unknowns Register
| Unknown & Rationale | Impact | Verification Plan | Owner / Target |
| --- | --- | --- | --- |
| `window.updateKCProgressBar` is invoked inside `updateCurriculumDisplay`, but only `ModuleSelectionHandler.updateKCProgressBar` is defined. Need proof the method is ever bound globally; otherwise KC bar never updates from curriculum status widget. | Medium | Search code for the binding and, if absent, run Intro flow to confirm KC widget updates; instrument fallback logging if `window.updateKCProgressBar` is undefined. | Gene / before code-review verdict |
| `displayMessage` reuses bubbles when the same message id is passed. Concept selection cleanup depends on `clearConceptSelectionBubble` + `removePhaseSelectionBubble`; we need to ensure no stale `data-concept-selection-payload` lingers when a bubble is reused quickly. | Medium | Reproduce repeated concept selection events and inspect DOM datasets to confirm payload removal, or add defensive `delete bubble.dataset.conceptSelectionPayload` before reuse. | Gene / before code-review verdict |
| `processMermaidBlocks` recovery path calls `runMermaidRecovery` with `window.ai || null`. Unsure whether recovery handles `null` without throwing, especially in offline reviewer sandboxes. | Medium | Force a malformed mermaid block while `window.ai` is undefined and observe logs/DOM to confirm graceful degradation. | Gene / before code-review verdict |

## Coverage Checklist
- src/ui.ts::sanitizeCodeFences#42ba3e227886
- src/ui.ts::sanitizeClosingBackticksOnly#9cc277339a2a
- src/ui.ts::escapePipesInInlineCode#81e8f3b59f23
- src/ui.ts::sanitizeIndentedListItems#254497e526a9
- src/ui.ts::ensureBlankLineAfterHtmlBlocks#16f31de18ffb
- src/ui.ts::sanitizeMarkdownFences#f0929ca087a3
- src/ui.ts::restoreInlinePipePlaceholders#db5c18eff3e9
- src/ui.ts::parseSanitizedMarkdown#fc7367ed997d
- src/ui.ts::parseSenseiMarkdown#412d336347e4
- src/ui.ts::escapeHtml#e05319e21df3
- src/ui.ts::replaceMermaidFenceInRaw#0a2c5b106a57
- src/ui.ts::renderUserMessageHtml#ad19dde61972
- src/ui.ts::getPhaseDisplayName#e61269a155ea
- src/ui.ts::updateCurriculumDisplay#11f129028112
- src/ui.ts::updateConceptNavigationArrowsUI#a56c6beb0d10
- src/ui.ts::addLanguageDisplayToCodeBlocks_internal#7da5ca4bdcb4
- src/ui.ts::addCopyButtonsToCodeBlocks_internal#0152b6bab2e8
- src/ui.ts::attachSenseiBoldInteractions#73e126b188f7
- src/ui.ts::displayMessage#9d7373648649
- src/ui.ts::renderIcons#d5df6bb81af3
- src/ui.ts::processMermaidBlocks#9b36bec3a60b
- src/keyTakeawayEnhancerController.ts::hasKeyTakeawayEnhancerCacheEntry#42e404feb7ea
- src/keyTakeawayEnhancerController.ts::computeKeyTakeawayEnhancerPromptHash#8ce8aeefafc9
- src/keyTakeawayEnhancerController.ts::KeyTakeawayEnhancerController.start#9de07b776cae
- src/moduleSelectionHandler.ts::logModuleSelectionValidation#8b65fac358e2
- src/moduleSelectionHandler.ts::ModuleSelectionHandler.handleConceptSelection#197b6cc490da
- src/moduleSelectionHandler.ts::ModuleSelectionHandler.executePhaseSelection#5522b7820b8d
- src/moduleSelectionHandler.ts::ModuleSelectionHandler.clearConceptSelectionBubble#bda96f682469
- src/moduleSelectionHandler.ts::ModuleSelectionHandler.removePhaseSelectionBubble#eab1440da1f4
- src/moduleSelectionHandler.ts::ModuleSelectionHandler.showWrapUpAssessmentApology#fb7611f5f885
- src/moduleSelectionHandler.ts::ModuleSelectionHandler.sendSystemSocraticMessage#b4db656944bc
- src/moduleSelectionHandler.ts::ModuleSelectionHandler.updateResponseHistory#3e5a86261428
- src/moduleSelectionHandler.ts::ModuleSelectionHandler.buildSocraticConceptReference#967db0c0fe06
- src/moduleSelectionHandler.ts::ModuleSelectionHandler.updateKCProgressBar#3da7c8da0d0f

## Key Architectural Insights
- Message rendering, enhancement, and diagram handling are centralized inside `displayMessage` + `processMermaidBlocks`, so any concept selection change must respect their lifecycle hooks (timers, registry maps, dataset cleanup).
- Module selection flow multiplexes LLM interactions: `streamModuleIntroduction` for Intro, KeyTakeaway enhancer for cached highlight insertion, and `sendSystemSocraticMessage` for the Socratic transition—each updates response history and reload metadata.
- Curriculum status widgets (`updateCurriculumDisplay`, navigation arrows, KC bar) depend on both curriculum state and global hooks, so concept-selection bugs often manifest in UI status mismatches rather than exceptions.

## Next Protocol
Proceed with the code-review workflow for `code_review/review_module_concept_selection_flow_codex_v3.html` under `code_review_policy` (no additional feature/bug/architecture protocols).

## Functional Test Traceability
No new automated tests are planned for this review-only mission. Manual validation should exercise concept selection → Intro streaming → Socratic transition, covering the functions enumerated in the coverage checklist. No new production modules or imports are introduced beyond those already listed.


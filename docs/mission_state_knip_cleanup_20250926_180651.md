# Mission State: knip cleanup

**Timestamp:** 2025-09-26T18:06:51Z
**Triggering Protocol:** Mandatory Architectural Synthesis Protocol

## Entry Points & Scope
- `index.tsx`: application bootstrap driving curriculum loading, UI init, and AI integration.
- `codeEditorModal.ts`: CodeMirror-based modal sourcing unlisted dependencies.
- `debugMode.ts`, `enhancementManager.ts`, `geminiService.ts`, `moduleSelectionHandler.ts`, `selectionSensei.ts`, `ui.ts`, `notepad.ts`: consumers of @google/genai, marked, mermaid, etc.
- `package.json`: dependency declarations flagged by knip.

## Static Execution Trace (excerpt)
1. `index.tsx::loadCurriculumAndGreet` → initializes UI (`ui.ts::initializeUI`), code editor (`codeEditorModal.ts::initializeCodeEditorModal`), enhancements, save/load flows, Google AI setup, selection sensei, notepad, curriculum fetch.
2. `index.tsx::initializeGoogleAI` → configures global AI client, updates UI, logs failures, delegates to `debugMode.ts::initializeDebugMode` and downstream Gemini helpers.
3. `geminiService.ts::getAnalysisFromGemini` → orchestrates prompt assembly via `prompts.ts`, posts to `@google/genai` client, returns structured responses to curriculum + adaptive engine.
4. `codeEditorModal.ts::initializeCodeEditorModal` → instantiates CodeMirror view, registers handlers and DOM observers relying on `@codemirror/*` packages.
5. `debugMode.ts::initializeDebugMode` → wires debug panel, uses `marked`, `jszip`, `@google/genai` exports for transcript capture.

## Dependency & Side-Effect Table
| Function | Key Dependencies | Side Effects | Risk Notes |
| --- | --- | --- | --- |
| `index.tsx::loadCurriculumAndGreet` | `ui.initializeUI`, `codeEditorModal.initialize`, `enhancementManager.initialize`, `fetch`, `selectionSensei.initialize`, `notepad.initialize` | Multiple DOM mutations, network fetch for curriculum, save/load timers | High coordination complexity; failure cascades block UI startup |
| `index.tsx::initializeGoogleAI` | `@google/genai` client creation, `debugMode.initializeDebugMode` | Writes to global `window.ai`, UI updates, logs | Medium blast; incorrect dependency config prevents AI features |
| `geminiService.ts::getAnalysisFromGemini` | `@google/genai`, `prompts.ts`, `model_usage.ts` | External LLM call | High cost network; requires API availability |
| `codeEditorModal.ts::initializeCodeEditorModal` | `@codemirror/*` modules, DOM APIs | Creates CodeMirror DOM nodes, event listeners | Medium DOM risk; missing deps break editor |
| `debugMode.ts::initializeDebugMode` | `marked`, `jszip`, `@google/genai`, DOM elements | Renders debug UI, writes files via `jszip` | Medium state/IO risk; absent deps disables tooling |

## Risk Register
- Missing npm dependencies (`@google/genai`, `@codemirror/*`, `marked`, `mermaid`, `jszip`, `@google/generative-ai`) will break runtime initialization paths identified above. Risk: High. Mitigation: add to `package.json` with correct versions.
- Unused runtime deps (`react`, `react-dom`) inflate bundle and misrepresent stack. Risk: Medium. Mitigation: remove or justify usage.
- Unused exports (33 functions + 25 types) indicate dead code impacting maintainability. Risk: Medium. Mitigation: verify real usage before removal to avoid regressions.
- Duplicated export alias in `prompts.ts` risks module resolution confusion. Risk: Medium. Mitigation: consolidate export names post-clarification.

## Coverage Checklist
- `index.tsx`: `loadCurriculumAndGreet`, `initializeGoogleAI`, `generateNextSenseiResponse`.
- `codeEditorModal.ts`: `initializeCodeEditorModal`, disposal helpers.
- `debugMode.ts`: `initializeDebugMode`, transcript export routines.
- `geminiService.ts`: `getAnalysisFromGemini`, `llmExtractAndPlanTeachingOrder`.
- `moduleSelectionHandler.ts`: initialization flow bridging UI state.

## Assumptions & Unknowns
- Assumed `@google/genai` usage should depend on official npm package; need confirmation on correct package name vs `@google/generative-ai` variant.
- CodeMirror helper functions (`lineNumbers`, `highlightSpecialChars`) presumed provided by imports; verify bundler handles tree-shaking.
- Logger callbacks rely on external injection; review before altering imports.

## Architectural Insights
- System follows centralized orchestrator pattern in `index.tsx`, coordinating specialized modules (UI, curriculum, notepad, AI).
- Extensive global side effects and DOM manipulation demand precise dependency management; missing packages cascade into runtime failures.
- Separation between prompts/model usage vs UI modules suggests dependency segregation could simplify knip cleanup by grouping AI vs UI concerns.

## Next Steps
Proceed to **Mandatory Architectural Synthesis Protocol** before any implementation changes.

## User Clarifications (2025-09-26)
- Remove all unused dependency declarations flagged by knip when confirmed unused.
- Retain both `@google/genai` and `@google/generative-ai` packages as currently referenced.
- Investigate additional knip flags/modes and evaluate whether repository-specific configuration adjustments are required before remediation.

# Mission State: Wrap-Up Assessment Overlay

## 1. Scope & Entry Points
- `index.tsx`: `handleUserInput`, `generateNextSenseiResponse`, curriculum advancement helpers, KC progress utilities.
- `ui.ts`: `displayMessage`, `updateMessageStream`, `processMermaidBlocks`, UI state helpers (`showLoading`, registry handling).
- `interactionHelpers.ts`: `streamMainSenseiResponse` (LLM streaming) and message stream updates.
- `moduleSelectionHandler.ts`: `handleInitialModuleSelectionInternal`, `handlePhaseSelection`, module/phase prompts.
- `geminiService.ts`: `getAnalysisFromGemini`, directive generation, JSON parsing helpers.
- `prompts.ts`: comprehensive analysis prompt for learner state, future test prompt hooks.
- Supporting modules surfaced by analyzer fan-out: `pedagogicalProfiler.ts`, `notepad.ts`, `curriculum.ts` (phase state + plan caching).

## 2. Static Execution Trace (Current Flow)
1. `handleUserInput` creates a user bubble via `displayMessage`, streams markdown with `processMermaidBlocks`, and hands control to `generateNextSenseiResponse`.
2. `generateNextSenseiResponse` updates module selection handler state, ensures teaching plans, obtains learner analysis via `getAnalysisFromGemini`, updates learner model + curriculum, refreshes UI (`updateCurriculumDisplay`, `updateKCProgressBar`), then crafts the system prompt and posts a loading Sensei bubble.
3. `streamMainSenseiResponse` streams chunks from Gemini chat, repeatedly invoking `updateMessageStream` for DOM updates, syntax highlighting, and enhancement hooks.
4. Upon completion, `generateNextSenseiResponse` finalizes the Sensei bubble, logs Socratic completion, and triggers mermaid processing / history updates.
5. Module or phase changes use `ModuleSelectionHandler.handlePhaseSelection`, which replaces phase selector UI with loading content, calls `jumpToPhase`, and rehydrates curriculum display through the same message pipeline.

## 3. Dependency & Side-Effect Summary
| Function | Key Dependencies | Side Effects / Observations | Risk |
| --- | --- | --- | --- |
| `handleUserInput` (`index.tsx`) | `displayMessage`, `processMermaidBlocks`, `generateNextSenseiResponse`, curriculum getters | DOM bubble creation, user input clearing, potential recursive call when module selection intercepts | Medium |
| `generateNextSenseiResponse` (`index.tsx`) | `moduleSelectionHandler.updateState`, `getAnalysisFromGemini`, `advanceCurriculumState`, `updateCurriculumDisplay`, `streamMainSenseiResponse` | Writes to `learnerModel`, `curriculumState`, DOM updates, multiple async LLM calls | High |
| `displayMessage` (`ui.ts`) | `marked`, `hljs`, `renderMermaidThumbnailWithTheme`, `runMermaidRecovery` | Creates/removes DOM nodes, timers, attaches event handlers | Medium |
| `updateMessageStream` (`ui.ts`) | `marked`, `hljs`, code enhancement helpers | Frequent DOM rewrites during streaming; assumes markdown structure | High |
| `ModuleSelectionHandler.handlePhaseSelection` | `document.querySelectorAll`, `jumpToPhase`, `displayMessage`, `llmExtractAndPlanTeachingOrder` | Manipulates existing bubbles, timers, spawns LLM call for teaching plan | Medium |
| `streamMainSenseiResponse` (`interactionHelpers.ts`) | `chat.sendMessageStream`, `updateMessageStream` | Network IO to Gemini, incremental DOM streaming | High |

## 4. Risk Register
- **R1 (High)**: Adding assessment overlays to the streaming message pipeline could conflict with `updateMessageStream` assumptions (entire bubble innerHTML replaced). Mitigation: introduce dedicated container & guard logic to prevent overwrites.
- **R2 (High)**: New AI prompts (test generation, remediation) increase call volume; need rate limiting/error handling similar to existing Gemini flows.
- **R3 (Medium)**: JSON parsing of AI responses for tests/remediation may fail; requires schema validation and defensive fallbacks.
- **R4 (Medium)**: Overlay UI needs to coexist with existing phase/mermaid async updates; risk of race conditions when multiple async updates operate on same bubble.

## 5. Coverage Checklist
- `index.tsx`: `handleUserInput`, `generateNextSenseiResponse`, new assessment orchestration helpers.
- `ui.ts`: `displayMessage`, `updateMessageStream`, any new overlay renderer utilities.
- `interactionHelpers.ts`: ensure `streamMainSenseiResponse` interop with overlay updates.
- `moduleSelectionHandler.ts`: confirm phase selection still works alongside new overlay injection.
- JSON parsing/validation utilities for assessment + remediation payloads (new module TBD).

## 6. Unknowns & Assumptions
| Item | Impact | Notes |
| --- | --- | --- |
| Trigger for assessment (command vs. automatic) | High | Need explicit UX trigger to request the 20-question test. |
| AI response schema for tests/remediation | High | Fields, nesting, ids, explanation structure not finalized. |
| User answer capture & scoring logic | High | How we store selections, compute pass/fail, and drive remediation bubble. |
| Overlay interaction patterns | Medium | Need guidance on navigation, scrolling, ability to exit/retry. |
| Persistence/analytics requirements | Medium | Should results persist across sessions? |

## 7. Architectural Insights
- Message pipeline is stream-first; overlays should likely render via `displayMessage` extensions or parallel containers to avoid interfering with streaming text.
- Curriculum advancement + learner model updates happen before Sensei reply; assessment workflow must decide whether to pause advancement.
- Existing phase selection loading patterns can inform assessment overlay animations and reuse message registry for timers.

## 8. Next Protocol
- Proceed with **Functional Specification Protocol** per user instruction.

## 9. Test Traceability Notes
- UI snapshot or DOM-based tests should mount the overlay renderer alongside existing transcript bubbles.
- JSON parsing tests must map to production modules handling AI payloads to ensure coverage of failure paths.
- Integration tests (manual or automated) should simulate full flow: trigger assessment → render overlay → submit answers → generate remediation bubble.

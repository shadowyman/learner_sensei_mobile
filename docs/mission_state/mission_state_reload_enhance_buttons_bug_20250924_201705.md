# Mission State: Reload/Enhance Buttons Missing After Phase Switch (20250924_201705)

## Scope & Entry Points
- `ui.ts` `displayMessage` gates reload and enhance controls based on `message.isReloadable` and `message.reloadContext`.
- `index.tsx` `generateNextSenseiResponse` and `handleReloadSenseiMessage` construct reload contexts for streamed responses.
- `moduleSelectionHandler.ts` `handlePhaseSelection` drives phase transitions and seeds module intro metadata.
- `interactionHelpers.ts` `streamMainSenseiResponse` and `streamModuleIntroduction` stream AI output into active bubbles.

## Static Execution Trace
1. Phase selection intro: `ModuleSelectionHandler.handlePhaseSelection` -> `displayMessage` (phase loader) -> `jumpToPhase` -> `displayMessage` (intro loading bubble) -> `streamModuleIntroduction` -> `displayMessage` (final intro text) -> `processMermaidBlocks`.
2. User turn response: `handleUserInput` -> `generateNextSenseiResponse` -> `displayMessage` (loading bubble) -> `streamMainSenseiResponse` -> `displayMessage` (final response) -> `processMermaidBlocks`.
3. Reload path: `handleReloadSenseiMessage` -> `displayMessage` (loading state) -> `streamMainSenseiResponse` or `streamModuleIntroduction` -> `displayMessage` (final) -> `processMermaidBlocks`.

## Dependency & Side-Effect Table
| Function | Dependencies | Side Effects |
| --- | --- | --- |
| `ModuleSelectionHandler.handlePhaseSelection` | `jumpToPhase`, `displayMessage`, `llmExtractAndPlanTeachingOrder`, `streamModuleIntroduction`, `processMermaidBlocks`, DOM access | Replaces phase prompt bubble contents, updates `curriculumState`, resets notepad indices, manages learner model state, clears pending selections |
| `displayMessage` | `resetEnhancementState`, `mermaidManager`, `renderMermaidThumbnailWithTheme`, `runMermaidRecovery`, `renderIcons`, code block helpers, DOM APIs | Builds message bubbles, attaches reload/enhance listeners, manages timers, mutates dataset flags and bubble classes |
| `streamModuleIntroduction` | `chat.sendMessageStream`, `updateMessageStream` | Streams intro text, updates bubble incrementally, logs prompt validation |
| `handleUserInput` | `displayMessage`, `processMermaidBlocks`, `generateNextSenseiResponse`, `advanceCurriculumState`, `createLLMPlannerCallback` | Queues user message bubbles, mutates `userInputHistory`, toggles loading state, handles skip command side effects |
| `generateNextSenseiResponse` | `buildSenseiDynamicSystemInstruction`, `buildSocraticExecutionInstruction`, `streamMainSenseiResponse`, `displayMessage`, `processMermaidBlocks`, `checkForSocraticCompletion`, `advanceCurriculumState` | Increments message ids, pushes reloadable sensei responses, updates `lastSenseiResponses`, logs adaptive events, toggles loading |
| `streamMainSenseiResponse` | `chat.sendMessageStream`, `updateMessageStream` | Streams AI output chunks, tracks latency metrics, updates bubble content |
| `handleReloadSenseiMessage` | `displayMessage`, `streamMainSenseiResponse`, `streamModuleIntroduction` | Resets targeted bubble to loading state, replaces response text, syncs `lastSenseiResponses`, clears streaming maps |

## Architectural Insights
- Reload and enhance controls materialize only when both `isReloadable` and a populated `reloadContext` reach `displayMessage`, so any upstream omission suppresses the buttons.
- Phase selection reuses the existing prompt bubble for loaders but relies on new messages with explicit metadata for intros; missed metadata at this stage would prevent controls in subsequent turns.
- Socratic system warm-up intentionally sets `isReloadable` false, which narrows the bug surface to main responses where we expect true metadata regardless of phase.

## Next Protocol
- Proceed with **MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL**.

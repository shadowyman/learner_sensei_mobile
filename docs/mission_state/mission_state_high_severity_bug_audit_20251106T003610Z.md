Mission: High/Medium-High Severity Bug Audit (Core Analysis Checkpoint)

Scope and Entry Points
- Entry: src/index.tsx (web app orchestration)
- Hot modules (by analyzer):
  - Top fan-in: src/logger.ts, src/model_usage.ts, src/adaptiveEngine.ts, src/curriculum.ts, src/ui.ts, src/prompts.ts, src/geminiService.ts
  - Top fan-out: src/index.tsx, src/moduleSelectionHandler.ts, src/ui.ts, src/curriculum.ts, src/selectionSensei.ts, src/saveloadProgressManager.ts

Static Execution Trace (primary user input flow)
- submit form → index.tsx::handleUserInput
- index.tsx::generateNextSenseiResponse
  - curriculum/getCurrentCurriculumItem, ensureTeachingPlanExists → curriculum::generateTeachingPlanForPhase (via geminiService::llmExtractAndPlanTeachingOrder)
  - geminiService::getAnalysisFromGemini → GoogleGenAI network call
  - adaptiveEngine::updateLearnerModel (state mutation)
  - curriculum::advanceCurriculumState (phase/progression)
  - interactionHelpers::buildSenseiDynamicSystemInstruction
  - interactionHelpers::streamMainSenseiResponse (LLM streaming)
  - ui::displayMessage → DOM writes, then ui::processMermaidBlocks

Dependency & Side-Effect Highlights
- Network: geminiService (generateContent for plans, analysis, enhancement)
- State: adaptiveEngine (KCs, misconceptions), curriculum state (teachingPlanForPhase, chunk indices)
- DOM: ui::displayMessage, selectionSensei modal, wrapUpAssessment overlay
- Storage: ChatWindowController (localStorage preference), SaveLoadProgressManager (download/upload JSON)

Risk Register (selected)
- API key handling in index.tsx (hardcoded key, process.env in browser) → credential leakage / runtime ReferenceError
- Window autoResizeEnabled getter uses logical OR → false coerced to true
- KC progress bar denominator duplicated literal (0.65) → drift vs constants

Coverage Checklist (functions to validate during fixes)
- index.tsx::initializeGoogleAI, loadCurriculumAndGreet, generateNextSenseiResponse
- moduleSelectionHandler.ts::handlePhaseSelection, updateKCProgressBar
- geminiService.ts::llmExtractAndPlanTeachingOrder, getAnalysisFromGemini
- ui.ts::displayMessage, processMermaidBlocks
- adaptiveEngine.ts::updateLearnerModel

Assumptions & Unknowns
- Production bundling of process.env for browser not configured in server/vite.config.ts (assume no define)
- Index HTML does not currently include a script tag for index.tsx; assume Vite injects during dev

Next Protocol
- Proceed to bug audit and remediation planning based on this checkpoint


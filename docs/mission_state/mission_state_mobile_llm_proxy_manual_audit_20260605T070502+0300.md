# Mobile LLM Proxy Phase 1 Manual Audit

Timestamp: 2026-06-05T07:05:02+0300

Purpose: Manual repo-wide audit for prompt-building logic, prompt flags, and direct LLM calls under `src/`, `core/`, and `bff/`, compared against `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`.

Protocol boundary: Per user instruction, this audit runs manual scanning first. Core Analysis may be used only after manual scanning as a confirmation pass. No other protocol is executed for this task.

AGENTS status: `/Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh/AGENTS.md` was read completely before work began. Repository-specific instructions govern the session, with the user's explicit protocol override applied.

Compaction bootstrap rule: After every context compaction or resumed continuation, the agent must begin by reading this live document end to end before doing more discovery or reporting. The continuation point must be derived from this document first, not from memory alone.

## Source Of Truth Documents

- `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`: read completely, lines 1-657.

## Scan Scope

Required directories:

- `src/`
- `core/`
- `bff/`

Explicit exclusion:

- Debug mode button and calls/prompts related to debug mode are excluded from migration-gap findings. The debug source may still be noted as scanned.

## Working Definitions

- Direct LLM call: code that invokes a provider/gateway/client capable of sending prompts or chat messages to an LLM, including browser Gemini access, BFF Gemini gateway access, Core LLM client injection, or provider-specific SDK calls.
- Prompt-building logic: code that constructs instructions, user prompts, model request messages, prompt envelopes, tool schema payloads, or feature flags controlling prompt variants outside the migrated prompt modules in `src/prompts.ts` and `core/prompts/*`.
- Migrated prompt module: prompt logic that lives in `core/prompts/*` or `src/prompts.ts` compatibility exports and is called through Core/BFF/mobile routing intended by the master plan.

## Master Plan Coverage Extraction

The master document defines Phase 1 as a narrow mobile LLM execution migration, not a broad business-logic move. Only prompt bodies/builders, provider execution, tool/schema definitions, response parsing, and normalization move into Core/BFF. DOM rendering, transcript rendering, teaching progression, selection UI, toolbar state, markdown insertion, caches, and teaching-state mutations remain in WebView/RN unless a helper is pure LLM response parsing.

Mandatory ownership rules extracted from the document:

- Canonical prompt bodies must live under `core/prompts/<capability>.ts`.
- `src/prompts.ts` is allowed only as a compatibility facade for migrated prompts.
- BFF must call Core capabilities and must not own prompt bodies.
- Mobile WebView must not call provider SDKs directly for migrated capabilities and must not send finished prompt strings as authoritative migrated runtime inputs.
- Desktop web may keep direct provider execution during Phase 1 if migrated capability behavior goes through Core/browser-client compatibility.

Master-plan completed scoped migrations:

- Wrap-up assessment planner: `src/index.tsx:createLLMPlannerCallback` -> `generateWrapUpAssessment`; legacy `src/geminiService.ts:generateWrapUpAssessment`; Core prompt `core/prompts/wrapUpAssessment.ts`; Core capability `core/wrapUpAssessment.ts:generateWrapUpAssessment`; BFF/mobile route exists.
- Teaching plan generation: `src/geminiService.ts:llmExtractAndPlanTeachingOrder`; mobile `requestTeachingPlan`; Core prompt `core/prompts/teachingPlan.ts`; Core capability `core/teachingPlan.ts:extractAndPlanTeachingOrder`; BFF/mobile route exists.
- Learner analysis: `src/geminiService.ts:getAnalysisFromGemini`; mobile `requestLearnerAnalysis`; Core prompt `core/prompts/learnerAnalysis.ts`; Core capability `core/learnerAnalysis.ts:getComprehensiveAnalysis`; BFF/mobile route exists.
- Module introduction stream: `src/interactionHelpers.ts:streamModuleIntroduction`; Core prompt `core/prompts/moduleIntroduction.ts`; Core capability/prompt builder `core/moduleIntroduction.ts:buildModuleIntroductionPrompt`; BFF stream route and RN/WebView stream bridge exist.
- Main Sensei response stream: `src/interactionHelpers.ts:streamMainSenseiResponse`; Core prompt `core/prompts/mainSenseiResponse.ts`; Core capability/prompt builder `core/mainSenseiResponse.ts:buildMainSenseiResponsePrompt`; BFF stream route and RN/WebView stream bridge exist.
- Mermaid error repair: `src/mermaidErrorRecovery.ts:attemptMermaidFix`; Core prompt `core/prompts/mermaidRepair.ts`; Core capability `core/mermaidErrorRecovery.ts:attemptMermaidFix`; BFF/mobile route exists.

Master-plan remaining backlog capabilities:

- Selection Sensei follow-up: `src/selectionSensei.ts:dispatchFollowupToAI`; prompt builders and response parser need Core ownership; new BFF follow-up route and mobile bridge route needed.
- Selection Sensei toolbar action: `src/selectionSensei.ts:handleToolbarAction`; toolbar prompt builders and response parser need Core ownership; new BFF toolbar route and mobile bridge route needed.
- Enhancement request: `src/enhancementManager.ts:toggleEnhancement` -> `src/geminiService.ts:requestSenseiEnhancement`; enhancement prompt builder, JSON fence stripping, parser, and normalization need Core ownership; new BFF/mobile route needed.
- Key takeaway enhancement: `src/keyTakeawayEnhancerController.ts:KeyTakeawayEnhancerController.start`; prompt construction and provider execution need Core/BFF ownership; mobile bridge route needed.
- Pedagogical directive generation: `src/pedagogicalProfiler.ts:PedagogicalProfiler.getDirective` -> `src/geminiService.ts:generateDirectiveFromMetaPrompt`; directive prompt builder and provider execution need Core/BFF ownership; new BFF/mobile route needed.
- Meta-prompt directive wrapper: `src/geminiService.ts:generateDirectiveFromMetaPrompt`; same pedagogical directive route.
- Sensei enhancement wrapper: `src/geminiService.ts:requestSenseiEnhancement`; same enhancement route.

Master-plan helper classification:

- Direct provider calls or chat creation move mobile execution to BFF through Core. Examples include `chat.sendMessage`, `chat.sendMessageStream`, `ai.models.generateContent`, `ensureSelectionChat`, and `KeyTakeawayEnhancerController.start`.
- Prompt fragments move into `core/prompts/<capability>.ts`.
- Pure LLM response parsers/normalizers move to Core with the capability.
- UI, DOM, modal, cache, stream application, and teaching-state side effects remain in WebView/RN.

Potential audit focus after master read:

- Verify the completed rows actually have no duplicate prompt bodies in `src/`, `bff/`, or inline Core capability files beyond compatibility delegates.
- Verify the backlog rows are all present and identify their exact function dependency chains.
- Search for any direct LLM/provider call or prompt builder not named in the master backlog, excluding debug-mode-only paths.

## Scanned Files

Last updated: 2026-06-05T08:55:00+0300

Status key:

- Complete manual read: file or named line ranges were opened and inspected directly.
- Search-confirmed: file appeared in repo-wide searches and the matched lines were inspected, but the whole file or all relevant regions may not yet be fully exhausted.
- Pending full pass: file remains in scope for the final exhaustive source sweep.

Scope inventory:

- `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`: complete manual read, lines 1-657.
- `src/`, `core/`, and `bff/`: source inventory listed with generated/dependency trees excluded from authoritative scan: `bff/node_modules/**` and `core/dist/**`.
- `SenseiMobile/src/mobile/**`: not part of the user's explicit `src/core/bff` scan scope, but inspected where needed to verify whether BFF/mobile prompt routes are reachable from the RN bridge.

Complete manual read or line-range inspection so far:

- `src/geminiService.ts`: direct provider wrappers and Core delegations inspected for teaching plan, learner analysis, wrap-up, pedagogical directive wrapper, and enhancement request.
- `src/model_usage.ts`: complete line-range inspection lines 1-137; active prompt/model flags extracted.
- `src/interactionHelpers.ts`: module-introduction stream and main Sensei stream inspected; both use native LLM stream bridge on mobile when an LLM stream request exists, and browser chat stream fallback otherwise.
- `src/mobile/webviewMessageRouter.ts`: bridge request/resolver flow inspected for teaching plan, learner analysis, LLM stream, and Mermaid recovery.
- `src/teachingPlanRouting.ts`, `src/learnerAnalysisRouting.ts`, `src/wrapUpAssessmentRouting.ts`: mobile bridge versus desktop local routing inspected.
- `src/mermaidErrorRecovery.ts`: confirmed as Core re-export.
- `src/ui.ts`: Mermaid recovery path inspected at search-hit level; mobile uses BFF bridge, desktop uses Core browser LLM client.
- `src/index.tsx`: inspected startup AI initialization lines 413-435; main turn generation and pedagogical/key-takeaway logic lines 760-990; reload path lines 1174-1248; app startup/test-suite/Selection Sensei initialization lines 1486-1516.
- `src/moduleSelectionHandler.ts`: inspected module introduction and intro key-takeaway logic lines 560-688; concept selection text lines 706-735; Socratic system initialization lines 836-883.
- `src/keyTakeawayEnhancerController.ts`: inspected lines 1-140, including chat creation and `sendMessage` call.
- `src/selectionSensei.ts`: inspected selection chat creation and follow-up path lines 905-1128; toolbar action prompt construction and `sendMessage` path lines 1603-1678.
- `src/prompts.ts`: inspected prompt exports for Selection Sensei, key-takeaway, enhancement, and dormant consolidation prompt text.
- `src/pedagogicalProfiler.ts`: inspected active item-specific meta-prompt construction and direct directive call path; also noted a second unified meta-prompt template that appears unreferenced.
- `src/enhancementManager.ts`: inspected lines 246-292; `toggleEnhancement` calls `requestSenseiEnhancement` after stripping Mermaid blocks and counting words.
- `src/test.ts`: inspected lines 1-220, including enabled test-suite config, provider SDK construction, prompt template loading, prompt substitution, and `generateContent` calls.
- `src/testPrompt1.txt`: complete line-range inspection lines 1-31; standalone archetype-classification prompt asset for `src/test.ts`.
- `src/testPrompt2.txt`: complete line-range inspection lines 1-112; standalone instructional-architect/archetype prompt asset for `src/test.ts`.
- `src/teachingPlanCache.ts`: inspected lines 1-125; cache entries include `TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED` so prompt-variant changes invalidate cached teaching plans.
- `src/curriculum.ts`: inspected prompt-relevant ranges lines 150-190, 1084-1093, and 1435-1475; curriculum content extraction and primary-action prompt-template selection are Core-backed or flag-controlled.
- `bff/src/integration/senseiCoreAdapter.js`: inspected lines 1-56, including legacy inline `buildPrompt` and migrated `buildCapabilityPrompt`.
- `bff/src/integration/geminiGateway.js`: inspected lines 1-279; provider SDK import/client creation, `callText`, `callWithTools`, and `streamMainResponse` are centralized gateway execution paths.
- `bff/src/integration/coreLlmAdapter.js`: inspected lines 1-20; delegates Core LLM calls into the BFF Gemini gateway.
- `bff/src/services/streamingService.js`: inspected lines 1-330, including legacy `/stream` prompt path and migrated `/llm-stream` capability path.
- `bff/src/services/teachingPlanService.js`: inspected lines 1-42; delegates teaching-plan generation to Core through `CoreLlmAdapter`.
- `bff/src/services/analysisService.js`: inspected lines 1-35; delegates learner analysis to Core through `CoreLlmAdapter`.
- `bff/src/services/wrapUpService.js`: inspected lines 1-66; delegates wrap-up generation to Core through `CoreLlmAdapter`.
- `bff/src/services/mermaidService.js`: inspected lines 1-55; deterministic repair first, then Core Mermaid repair through `CoreLlmAdapter`.
- `bff/src/controllers/sessionController.js`: inspected lines 240-347, including `submitTurn` and `submitLlmStream`.
- `bff/src/controllers/sessionController.js`: inspected lines 1-220; schemas confirm migrated `llm-stream` accepts structured `moduleIntroduction` and `mainSenseiResponse` payloads, bounds conversation history, and does not accept old raw prompt-string payload fields as authoritative fields.
- `bff/src/controllers/analysisController.js`: inspected lines 1-52; validates structured learner-analysis payload then calls service.
- `bff/src/controllers/teachingPlanController.js`: inspected lines 1-53; validates structured teaching-plan payload then calls service.
- `bff/src/controllers/wrapUpController.js`: inspected lines 1-55; validates structured wrap-up prompt context then calls service.
- `bff/src/controllers/mermaidController.js`: inspected lines 1-32; validates Mermaid recovery payload then calls service.
- `bff/src/routes/sessions.js`: inspected lines 1-11; confirms both legacy `/turns` and migrated `/llm-stream` session routes are registered.
- `bff/src/routes/analysis.js`, `bff/src/routes/teachingPlan.js`, `bff/src/routes/wrapUp.js`, `bff/src/routes/mermaid.js`: inspected; routes are structured BFF endpoints for master-covered capabilities.
- `bff/src/config/index.js`: inspected lines 1-118; BFF owns env-controlled teaching-plan item prompt flag, main-response prompt option gates, Gemini model selection, timeout, temperature, and API key fallback.
- `bff/src/config/modelUsage.js`: inspected lines 1-75; BFF model configs mirror/use Core timeouts and prompt options but do not contain prompt bodies.
- `bff/src/stream/streamServer.js`: inspected lines 1-60, including legacy `/sessions/:id/stream` and migrated `/sessions/:id/llm-stream` WebSocket routing.
- `core/` source inventory: complete file list taken excluding `core/dist/**`.
- `core/browserLlmClient.ts`: inspected lines 1-62; desktop/browser Core LLM adapter calls `ai.models.generateContent`.
- `core/modelUsage.ts`: inspected lines 1-55; Core model configs and main-response prompt options.
- `core/promptEnvelope.ts`: inspected lines 1-76; shared capability prompt envelope outside `core/prompts/*`.
- `core/moduleIntroduction.ts`: inspected lines 1-51; prompt builder composes Core prompt-module template plus main-response dynamic instruction and envelope.
- `core/mainSenseiResponse.ts`: inspected lines 1-119; prompt builder composes prompt-module dynamic instruction plus user line and envelope.
- `core/teachingPlan.ts`: inspected lines 145-195; prompt selection delegates to `core/prompts/teachingPlan.ts`.
- `core/prompts/index.ts`: inspected lines 1-7; exports all canonical prompt modules.
- `core/prompts/baseSensei.ts`: inspected lines 1-220; owns base Sensei persona, teaching invariants, and Mermaid-generation guidelines used by main response prompts.
- `core/prompts/moduleIntroduction.ts`: inspected lines 1-12; owns module-introduction task template.
- `core/prompts/mermaidRepair.ts`: inspected lines 1-36; owns Mermaid repair prompt template.
- `core/prompts/learnerAnalysis.ts`: inspected lines 1-120; owns phase-specific learner-analysis prompt builder and schema text.
- `core/prompts/wrapUpAssessment.ts`: inspected lines 1-69; owns wrap-up assessment tool schema and prompt builder.
- `core/prompts/teachingPlan.ts`: inspected lines 1-306; owns archetype, item-based, and Socratic teaching-plan prompts.
- `core/prompts/mainSenseiResponse.ts`: inspected lines 1-601; owns main-response focus prompt templates, mandatory teaching structure, standard dynamic instruction builder, and Socratic execution instruction builder.
- `core/wrapUpAssessment.ts`: inspected lines 1-363; owns wrap-up parsers/normalizers/retry flow and delegates prompt body to `core/prompts/wrapUpAssessment.ts`.
- `core/learnerAnalysis.ts`: inspected lines 1-106; owns learner-analysis parsing and delegates prompt body to `core/prompts/learnerAnalysis.ts`.
- `src/mobile/network/BffClient.ts`: inspected lines 1-2; it is a shim re-exporting `SenseiMobile/src/mobile/network/BffClient`.
- `src/mobile/network/types.ts`: inspected line 1; it is a shim re-exporting `SenseiMobile/src/mobile/network/types`.
- `src/mobile/bridge/contracts.ts`: inspected line 1; it is a shim re-exporting `SenseiMobile/src/mobile/bridge/contracts`.
- `SenseiMobile/src/mobile/network/BffClient.ts`: inspected lines 153-198 to confirm `submitTurn` still exists and posts to `/turns`; inspected as reachability context.
- `SenseiMobile/src/mobile/MainScreen.tsx`: inspected lines 689-735 to confirm active WebView LLM stream bridge uses `submitLlmStream`.
- `src/saveloadProgressManager.ts`: inspected lines 391-415; recreates `mainSenseiChat` with saved history and system instruction, but does not send a prompt by itself.

Search-confirmed source areas still needing final pass before manual scan is declared complete:

- Core prompt files have been manually scanned for canonical ownership.
- Remaining BFF utility/infra/services without provider/prompt search hits are negatively classified for this audit unless Core Analysis surfaces a missed edge.
- Remaining `src/*.ts` and `src/mobile/**/*.ts` provider/prompt matches have been classified as canonical Core usage, active backlog, not-master test path, bridge routing, debug-mode excluded, curriculum/display text, or non-runtime metadata.
- Curriculum/content files such as `src/Modules.txt` are classified as curriculum content, not runtime prompt-building code for Phase 1 migration.
- Manual scan phase is complete as of 2026-06-05T08:36:00+0300. Core Analysis confirmation may now begin per user instruction.
- Analyzer confirmation artifacts inspected after manual scan: `tmp/analysis/brief.md`, `tmp/analysis/summary.json`, `tmp/analysis/brief.json`, `tmp/analysis/functions.json`, `tmp/analysis/calls.json`, `tmp/analysis/imports.json`, `tmp/analysis/fan_in.json`, and `tmp/analysis/fan_out.json`.

## Findings

Last updated: 2026-06-05T08:55:00+0300

### Migrated or Master-Covered Completed Paths

- Teaching plan generation is master-covered and appears migrated at the inspected source level: `src/geminiService.ts:llmExtractAndPlanTeachingOrder` delegates to Core with a Core browser LLM client on desktop, while mobile routing uses `requestTeachingPlanViaBridge`.
- Learner analysis is master-covered and appears migrated at the inspected source level: `src/geminiService.ts:getAnalysisFromGemini` delegates to Core with a Core browser LLM client on desktop, while mobile routing uses `requestLearnerAnalysisViaBridge`.
- Wrap-up assessment generation is master-covered and appears migrated at the inspected source level: `src/geminiService.ts:generateWrapUpAssessment` delegates to Core; mobile uses the BFF route described by the master plan.
- Module introduction streaming is master-covered and appears migrated for mobile execution: `src/moduleSelectionHandler.ts` builds a structured `ModuleIntroductionPromptRequest`, `src/interactionHelpers.ts:streamModuleIntroduction` sends that through the native LLM stream bridge on mobile, and BFF `handleLlmStreamConnection` builds the prompt through Core.
- Main Sensei response streaming is master-covered and appears migrated for mobile execution: `src/index.tsx` and `src/moduleSelectionHandler.ts` build `MainSenseiResponsePromptRequest`; `src/interactionHelpers.ts:streamMainSenseiResponse` sends that through the native LLM stream bridge on mobile; BFF `handleLlmStreamConnection` builds the prompt through Core.
- Socratic system initialization is part of the main Sensei response stream path: `src/moduleSelectionHandler.ts:sendSystemSocraticMessage` builds a Socratic request object and sends it through `streamMainSenseiResponse`.
- Mermaid error repair is master-covered and appears migrated: `src/mermaidErrorRecovery.ts` re-exports Core, and inspected UI/mobile bridge paths route mobile repair through BFF.

### Active Backlog Paths Already Covered By The Master Plan

- Pedagogical directive generation remains active source-owned prompt/provider logic and is covered by the master backlog: `src/index.tsx:generateNextSenseiResponse` calls `profiler.getDirective`; `src/pedagogicalProfiler.ts:PedagogicalProfiler.getDirective` builds the item-specific meta-prompt; `src/geminiService.ts:generateDirectiveFromMetaPrompt` calls the provider.
- Selection Sensei follow-up remains active direct WebView LLM chat logic and is covered by the master backlog: `src/selectionSensei.ts:ensureSelectionChat` creates the Gemini chat with `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION`; `src/selectionSensei.ts:dispatchFollowupToAI` sends the follow-up question through `chat.sendMessage`.
- Selection Sensei toolbar action remains active prompt/provider logic and is covered by the master backlog: `src/selectionSensei.ts:handleToolbarAction` builds action-specific instructions, calls `SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION` or `SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION`, then sends the prompt through `chat.sendMessage`.
- Enhancement request remains active direct provider logic and is covered by the master backlog: `src/enhancementManager.ts:toggleEnhancement` calls `src/geminiService.ts:requestSenseiEnhancement`, which uses `buildSenseiEnhancementPrompt`, calls the provider, strips JSON fences, and normalizes response entries.
- Key-takeaway enhancement remains active direct WebView chat logic and is covered by the master backlog: both `src/index.tsx:generateNextSenseiResponse` and `src/moduleSelectionHandler.ts` build `${KEY_TAKEAWAY_PROMPT_PREFIX}\n\n${primaryActionBlock}` and instantiate `KeyTakeawayEnhancerController`; `src/keyTakeawayEnhancerController.ts:KeyTakeawayEnhancerController.start` creates a chat and sends the prompt.

### Findings Not Clearly Covered By The Master Plan

- `src/test.ts` contains a non-debug test-suite LLM path not mentioned in the master plan. It imports `GoogleGenerativeAI`, constructs `new GoogleGenerativeAI(apiKey)`, loads `testPrompt1.txt` and `testPrompt2.txt`, substitutes concept text into each prompt, and calls `model.generateContent` twice per concept. `src/index.tsx` imports `runTestSuite` and calls it during startup when `API_KEY` exists; `TEST_SUITE_CONFIG.enabled` is currently `true` while the individual subtests shown are false. This path needs final classification as dormant/disabled-by-subflags versus migration backlog.
- `src/testPrompt1.txt` and `src/testPrompt2.txt` are standalone prompt assets consumed by `src/test.ts`. They are outside `src/prompts.ts` and `core/prompts/*`, not mentioned in the master plan, and should be classified as test-only prompt assets unless `runTestSuite` is considered startup-active enough to migrate or remove.
- `bff/src/integration/senseiCoreAdapter.js:buildPrompt` contains a legacy inline prompt body in BFF: `You are Recursive Sensei. Respond helpfully to: ${input}`. `bff/src/services/streamingService.js:handleConnection` uses it for the older `/sessions/:sessionId/stream?turnId=...` route and sends it through `geminiGateway.streamMainResponse`. The active RN/WebView LLM stream bridge uses `/llm-stream`, but the legacy `/turns` plus `/stream` route is still exposed and `SenseiMobile/src/mobile/network/BffClient.ts:submitTurn` still exists. This appears not covered by the master document.
- Dormant or apparently unreferenced prompt text remains in source and is not clearly called out by the master plan: `src/prompts.ts:TARGETED_CONSOLIDATION_PROMPT_TEMPLATE`, `src/consolidationManager.ts:getConsolidationFocusInstruction`, and `src/pedagogicalProfiler.ts:UNIFIED_PEDAGOGICAL_META_PROMPT_TEMPLATE`. These require final call-site confirmation before being labeled active migration gaps.
- `core/promptEnvelope.ts:buildCapabilityPromptEnvelope` contains shared prompt wrapper text outside `core/prompts/*`. This is Core-owned, shared by migrated BFF capability prompts, and likely intentional infrastructure, but it is technically a prompt body outside the master plan's stated `core/prompts/<capability>.ts` location rule. Final report should call it out as a Core-internal exception, not a mobile-direct LLM gap.
- `src/saveloadProgressManager.ts:recreateChatSession` recreates `mainSenseiChat` using `chatSession.systemInstruction`. It does not call `sendMessage` or build a new prompt, but it can restore prior source-built system instructions into browser chat state. Classification so far: chat state restoration, not a separate migrated capability.

### Prompt Flags And Controls Identified

- `src/model_usage.ts:21` defines `TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED = false`; `src/geminiService.ts:80-89` passes it into Core for desktop/local teaching-plan generation.
- `src/teachingPlanCache.ts:82-105` stores and compares `TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED` to invalidate stale plans when prompt variant changes.
- `src/curriculum.ts:174-181` changes the source text assembled for IntroIllustrate teaching-plan generation when `TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED` is true, and `src/curriculum.ts:1084-1093` changes phase advancement behavior for that same flag.
- `src/model_usage.ts:36-54` defines chat model configs for module introduction and main Sensei response. These are still used by browser `chat.sendMessageStream` fallback paths and initial chat creation.
- `src/model_usage.ts:56-69` defines key-takeaway enhancer model config, enables `ENABLE_KEY_TAKEAWAY_ENHANCER = true`, sets placeholder token, and sets the post-stream grace window. This gates active direct provider logic from both normal user turns and module-introduction startup.
- `src/model_usage.ts:88-91` defines pedagogical directive model config; `src/geminiService.ts:170-176` uses it in the direct `ai.models.generateContent` directive wrapper.
- `src/model_usage.ts:98-104` defines Selection Sensei model config and JSON response mode; `src/selectionSensei.ts:905-915` uses it when creating the selection chat.
- `src/model_usage.ts:119-125` defines enhancement request model config; `src/geminiService.ts:264-289` uses it when generating enhancement JSON.
- `src/model_usage.ts:132-137` defines archetype comparison test model config; `src/test.ts:160-174` uses it in the non-master test-suite provider calls.
- `core/modelUsage.ts:52-55` defines Core-owned main-response prompt options. `src/model_usage.ts:63-65` re-exports those options for desktop/source compatibility.
- `bff/src/config/index.js:68-80` makes BFF the mobile owner for `teachingPlanItemBasedPromptEnabled` and main Sensei prompt option gates. `bff/src/integration/senseiCoreAdapter.js:18-41` injects those server-owned options into Core prompt builders for migrated `/llm-stream` requests.
- `bff/src/config/index.js:83-92` owns Gemini model/timeout/temperature selection for BFF provider execution. `bff/src/config/index.js:84` includes an API key fallback literal; that is not prompt logic, but it is provider-execution configuration.

### Test-Only And Non-Runtime Classifications

- `bff/tests/llmStream.deterministic.int.test.js` intentionally captures Core-built prompts and verifies old prompt-string payload fragments are rejected for `/llm-stream`; this supports the migrated route rather than adding runtime prompt logic.
- `bff/tests/teachingPlanService.config.test.js` intentionally asserts item-based prompt flag behavior by inspecting generated prompts; test-only.
- `bff/tests/geminiGatewayFallback.test.js` stubs gateway streaming and asserts fallback behavior; test-only.
- `src/wrapUpAssessment.ts` uses `question.prompt` as the learner-facing assessment question stem, not as an LLM prompt builder.
- `src/Modules.txt` contains curriculum text with teaching instructions and the word "prompts"; current classification is curriculum content, not runtime prompt-building code for Phase 1 migration.
- `src/metadata.json` contains an empty `"prompt"` field; current classification is non-runtime metadata.

### Mobile Shim And Reachability Notes

- `src/mobile/network/BffClient.ts`, `src/mobile/network/types.ts`, and `src/mobile/bridge/contracts.ts` are shim re-exports into `SenseiMobile/src/mobile/**`; prompt/provider reachability must be evaluated against the actual `SenseiMobile` files when bridge behavior matters.
- `bff/src/controllers/sessionController.js:30-42` limits migrated LLM stream capabilities to `moduleIntroduction` and `mainSenseiResponse`.
- `bff/src/controllers/sessionController.js:114-175` defines structured payloads for migrated module introduction, standard main response, and Socratic main response. Old prompt-string fields are not part of those schemas.

### Analyzer-Confirmed LLM Call Function Map

- Analyzer automatic `network` side-effect classification did not report LLM SDK calls, so sideEffects are not sufficient for this audit. Confirmation therefore used analyzer function/call/import artifacts plus direct source search for `generateContent`, `generateContentStream`, `sendMessage`, `sendMessageStream`, `callText`, `callWithTools`, `streamMainResponse`, `new GoogleGenAI`, and `new GoogleGenerativeAI`.
- Provider creation/execution functions found by source search and partly by analyzer: `src/index.tsx:initializeGoogleAI` creates the browser `GoogleGenAI`; `core/browserLlmClient.ts:createBrowserCoreLlmClient` adapts desktop Core calls to `ai.models.generateContent`; `bff/src/integration/geminiGateway.js:GeminiGateway.#createClient`, `callText`, `callWithTools`, and `streamMainResponse` own BFF provider execution.
- Core LLM capability functions confirmed: `core/teachingPlan.ts:extractAndPlanTeachingOrder` calls `llm.callText`; `core/learnerAnalysis.ts:getComprehensiveAnalysis` calls `llm.callText`; `core/wrapUpAssessment.ts:generateWrapUpAssessment` calls `llm.callWithTools`; `core/mermaidErrorRecovery.ts:attemptMermaidFix` calls Core LLM via the Mermaid prompt. These are migrated Core-owned paths.
- BFF adapter/gateway chain confirmed: BFF services call Core capabilities through `bff/src/integration/coreLlmAdapter.js`, which forwards `callText`/`callWithTools` into `bff/src/integration/geminiGateway.js`.
- BFF stream paths confirmed: `bff/src/services/streamingService.js:handleLlmStreamConnection` calls `senseiCoreAdapter.buildCapabilityPrompt` then `geminiGateway.streamMainResponse`; `bff/src/services/streamingService.js:handleConnection` calls legacy `senseiCoreAdapter.buildPrompt` then `geminiGateway.streamMainResponse`.
- Browser stream fallback functions confirmed: `src/interactionHelpers.ts:streamModuleIntroduction` and `src/interactionHelpers.ts:streamMainSenseiResponse` call `requestLlmStreamViaBridge` on mobile when structured requests exist, otherwise call `chat.sendMessageStream` for desktop/browser fallback.
- Active WebView direct call functions confirmed by source search and manual scan but not fully modeled as function records in analyzer: `src/selectionSensei.ts:ensureSelectionChat`, `src/selectionSensei.ts:dispatchFollowupToAI`, `src/selectionSensei.ts:handleToolbarAction`, and `src/keyTakeawayEnhancerController.ts:KeyTakeawayEnhancerController.start`.
- Active WebView direct generateContent functions confirmed: `src/geminiService.ts:generateDirectiveFromMetaPrompt` and `src/geminiService.ts:requestSenseiEnhancement`.
- Non-master test provider path confirmed: `src/test.ts:ArchetypeComparisonTest.constructor` creates `GoogleGenerativeAI`; `loadPromptTemplates` reads `testPrompt1.txt` and `testPrompt2.txt`; `testConcept` calls `model.generateContent` for both prompts.
- Analyzer call graph specifically confirmed key-takeaway reachability from module introduction: `src/moduleSelectionHandler.ts:ModuleSelectionHandler.executePhaseSelection` calls `KeyTakeawayEnhancerController.start`; `src/interactionHelpers.ts:streamModuleIntroduction` and `streamMainSenseiResponse` call key-takeaway `onChunk`, `finalize`, and `getLatestText`.
- Analyzer boundary APIs confirmed migrated Core entry points: `core/browserLlmClient.ts:createBrowserCoreLlmClient`, `core/wrapUpAssessment.ts:generateWrapUpAssessment`, `core/prompts/mainSenseiResponse.ts:buildSocraticExecutionInstruction`, `core/prompts/mainSenseiResponse.ts:buildCurriculumFocusInstruction`, `core/prompts/mainSenseiResponse.ts:MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION`, `core/prompts/moduleIntroduction.ts:MODULE_INTRODUCTION_TASK_TEMPLATE`, and `core/promptEnvelope.ts:sanitizeConversationHistory`.
- Analyzer `brief.md` highlighted bridge/risk files aligned with the manual scan: `src/geminiService.ts`, `src/curriculum.ts`, `src/moduleSelectionHandler.ts`, `bff/src/services/mermaidService.js`, `src/index.tsx`, `src/prompts.ts`, `src/interactionHelpers.ts`, `src/ui.ts`, `bff/src/integration/senseiCoreAdapter.js`, and `src/wrapUpAssessment.ts`.
- Analyzer did not surface a new production prompt/provider path beyond the manual findings. Its limitations are documented above, so the manual source search remains authoritative for class-heavy WebView modules.

### Canonical Core Prompt Map

- `core/prompts/baseSensei.ts` owns shared base persona, teaching invariants, and Mermaid-generation guidelines. `src/prompts.ts` re-exports these for desktop/source compatibility, and `core/promptEnvelope.ts` includes the base system instruction when requested.
- `core/prompts/teachingPlan.ts` owns the archetype-based, item-based, and Socratic teaching-plan prompt builders. `core/teachingPlan.ts:145-195` chooses one based on phase and item-based flag.
- `core/prompts/learnerAnalysis.ts` owns phase-specific learner-analysis prompt builders. `core/learnerAnalysis.ts:96-105` builds the prompt and calls `llm.callText`.
- `core/prompts/wrapUpAssessment.ts` owns the wrap-up assessment prompt and `WRAP_UP_ASSESSMENT_TOOLS`. `core/wrapUpAssessment.ts:292-335` builds the prompt, calls `llm.callWithTools`, and normalizes/validates output.
- `core/prompts/moduleIntroduction.ts` owns the module-introduction task template. `core/moduleIntroduction.ts:23-50` combines it with main-response dynamic instruction and the shared prompt envelope.
- `core/prompts/mainSenseiResponse.ts` owns the main-response focus templates, mandatory teaching structure, standard dynamic instruction builder, and Socratic execution instruction builder. `core/mainSenseiResponse.ts:104-119` wraps the resulting task prompt for provider dispatch.
- `core/prompts/mermaidRepair.ts` owns the Mermaid repair prompt. `core/mermaidErrorRecovery.ts` builds and sends it through the Core LLM client.
- `core/promptEnvelope.ts` is a shared Core prompt-wrapper module outside `core/prompts/*`; already classified above as an intentional Core-internal exception to the strict location wording.

### Lifecycle Trace Notes From Current Manual Scan

- App startup: `src/index.tsx:initializeGoogleAI` creates `GoogleGenAI`, creates persistent `mainSenseiChat` with the base Sensei system instruction, exposes `window.ai`, constructs `PedagogicalProfiler`, then later initializes Selection Sensei.
- Module selection: `src/moduleSelectionHandler.ts` updates curriculum state, ensures teaching plan availability, then either streams a module introduction or calls the Socratic system-initialization path. IntroIllustrate also arms key-takeaway enhancement if enabled.
- User teaching turn: `src/index.tsx:handleUserInputText` calls `generateNextSenseiResponse`; that obtains pedagogical directive guidance, builds either Socratic execution instruction or standard dynamic instruction, builds a structured main-response request, optionally arms key-takeaway enhancement, and streams the main response.
- Reload: `src/index.tsx:handleReloadSenseiMessage` reuses stored reload context and may restart key-takeaway enhancement before calling `streamMainSenseiResponse` or `streamModuleIntroduction`.
- Selection Sensei: initialized after AI startup; toolbar actions and follow-up questions still use source-owned prompt builders/chat calls and do not use the migrated mobile BFF routes yet.
- BFF streaming: migrated `/llm-stream` route delegates prompt building to Core capability builders; legacy `/stream` route still uses BFF inline prompt building and gateway streaming.

## Lifecycle Trace Notes

Living summary is now maintained under `Findings` so discoveries and lifecycle notes stay in one up-to-date continuation section.

## Master Plan Comparison

### Covered By The Master Document

- Completed/migrated rows: teaching plan generation, learner analysis, wrap-up assessment, module-introduction stream, main Sensei response stream including Socratic execution, and Mermaid repair.
- Remaining active backlog rows: pedagogical directive generation, Selection Sensei follow-up, Selection Sensei toolbar action, enhancement request, key-takeaway enhancement, `generateDirectiveFromMetaPrompt`, and `requestSenseiEnhancement`.

### Details Worth Adding To The Master Document

- Dormant prompt text cleanup note: `src/prompts.ts:TARGETED_CONSOLIDATION_PROMPT_TEMPLATE`, `src/consolidationManager.ts:getConsolidationFocusInstruction`, and `src/pedagogicalProfiler.ts:UNIFIED_PEDAGOGICAL_META_PROMPT_TEMPLATE` appear dormant/unreferenced. They should be listed as cleanup candidates or explicitly excluded from Phase 1 runtime backlog unless revived.
- Pedagogical directive backlog details: include `src/pedagogicalProfiler.ts:ITEM_SPECIFIC_PEDAGOGICAL_META_PROMPT_TEMPLATE`, `PedagogicalProfiler.getDirective`, `_identifyActiveFlags`, and `src/geminiService.ts:generateDirectiveFromMetaPrompt` as the active prompt/provider chain. Note that the unified template is currently dormant.
- Selection Sensei backlog details: include `ensureSelectionChat` as the shared chat creation dependency; include `SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION`, `SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION`, `SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION`, `dispatchFollowupToAI`, `handleToolbarAction`, `formatFollowupAnswer`, and `extractContentWithRegex`. Prompt construction and response parsing are migration candidates; modal/UI state stays WebView.
- Enhancement backlog details: include `src/enhancementManager.ts:toggleEnhancement`, `src/geminiService.ts:requestSenseiEnhancement`, `buildSenseiEnhancementPrompt`, `stripJsonFence`, and `normalizeEnhancementEntries`. Provider execution and parser/normalizer move with the capability; markdown application functions stay WebView.
- Key-takeaway backlog details: include both prompt construction sites, `src/index.tsx:generateNextSenseiResponse` and `src/moduleSelectionHandler.ts:executePhaseSelection`, plus `KEY_TAKEAWAY_PROMPT_PREFIX`, `buildPrimaryActionBlockForKeyTakeaway`, `computeKeyTakeawayEnhancerPromptHash`, `hasKeyTakeawayEnhancerCacheEntry`, and `KeyTakeawayEnhancerController.start`. Provider execution and prompt ownership move; cache/placeholder insertion methods stay WebView.
- Prompt/model flag details worth preserving: `ENABLE_KEY_TAKEAWAY_ENHANCER`, `KEY_TAKEAWAY_ENHANCER_CONFIG`, `SELECTION_SENSEI_CONFIG`, `ENHANCEMENT_REQUEST_CONFIG`, `PEDAGOGICAL_DIRECTIVE_GENERATION_CONFIG`, and the BFF-owned migrated prompt options under `bff/src/config/index.js`.

### Not Mentioned Or Not Clearly Covered By The Master Document

- `src/test.ts` plus `src/testPrompt1.txt` and `src/testPrompt2.txt`: non-debug direct LLM test harness imported and conditionally invoked during app startup. It is disabled by individual subflags in the current config, but the top-level suite flag is true and the path is not called out in the master plan.
- Legacy BFF `/sessions/:sessionId/turns` plus `/sessions/:sessionId/stream` path: `bff/src/integration/senseiCoreAdapter.js:buildPrompt` still owns an inline prompt body in BFF and `bff/src/services/streamingService.js:handleConnection` still streams it through the Gemini gateway. The active RN/WebView LLM migration path uses `/llm-stream`, but the legacy route remains registered/exposed.
- Dormant legacy prompt text: `src/prompts.ts:TARGETED_CONSOLIDATION_PROMPT_TEMPLATE`, `src/consolidationManager.ts:getConsolidationFocusInstruction`, and `src/pedagogicalProfiler.ts:UNIFIED_PEDAGOGICAL_META_PROMPT_TEMPLATE`. Current evidence says these are unreferenced/dormant, not active runtime gaps.
- `core/promptEnvelope.ts:buildCapabilityPromptEnvelope`: Core-owned prompt wrapper text outside `core/prompts/*`. This is an intentional-looking Core infrastructure exception, not a WebView/BFF direct-provider migration gap, but it is outside the strict location wording.

### `docs/llm_entry_exit_traces.md` Follow-Up

- `docs/llm_entry_exit_traces.md` was read after the user follow-up. It is explicitly older/subordinate where it conflicts with the master plan, and its proposed `src/llmGateway.ts` section is superseded by the Phase 1 Core/BFF direction.
- The active trace entries are covered by the manual audit: `createLLMPlannerCallback`, `requestTeachingPlan`, `generateNextSenseiResponse`/`requestLearnerAnalysis`, `executePhaseSelection`, `createSolidifyTeachingPlan`, `streamModuleIntroduction`, `streamMainSenseiResponse`, `dispatchFollowupToAI`, `handleToolbarAction`, `toggleEnhancement`/`requestSenseiEnhancement`, `KeyTakeawayEnhancerController.start`, Mermaid recovery, `llmExtractAndPlanTeachingOrder`, `getAnalysisFromGemini`, `generateDirectiveFromMetaPrompt`, `generateWrapUpAssessment`, and `PedagogicalProfiler.getDirective`.
- Not every pure exit/helper named in the trace was written as a separate line item in the live document during the first pass. The audit did inspect or classify the important dependencies for migration ownership: Selection formatting/parsing helpers, enhancement JSON cleanup/normalization, key-takeaway chunk/finalize/cache helpers, and Core prompt/parsing helpers. UI/DOM/state exit helpers remain WebView-owned under the master plan's helper classification.

## Core Analysis Confirmation

Started 2026-06-05T08:40:00+0300 after manual scan completion.

- Protocol read completely: `docs/protocols/MANDATORY_CORE_ANALYSIS_PROTOCOL_STEP_0.md`.
- Scope: confirmation pass only, per user instruction. No other protocol is selected or executed.
- Analyzer wrapper attempt failed once before running because `zsh` reserves `status` as a read-only variable.
- Analyzer run succeeded: `npm run analysis:run` exit status 0. It refreshed `tmp/analysis/*` and wrote 149 entries to `src/file-manifest.json`.
- `tmp/analysis/brief.md` read after the analyzer run. Highlights matched manual scan: top fan-out included `src/moduleSelectionHandler.ts`, `src/interactionHelpers.ts`, BFF session/streaming/gateway files, and Core prompt builders; bridge files included `src/geminiService.ts`, `src/prompts.ts`, `src/interactionHelpers.ts`, `bff/src/integration/senseiCoreAdapter.js`, and Core/BFF LLM boundary modules.
- `tmp/analysis/summary.json` inspected: entry candidates were `bff/src/controllers/sessionController.js`, `bff/src/integration/geminiGateway.js`, `bff/src/services/streamingService.js`, and `src/moduleSelectionHandler.ts`, which aligns with the app lifecycle and BFF stream boundary manual trace.
- `tmp/analysis/brief.json` inspected for boundary APIs and risk. It confirmed Core prompt/capability boundary APIs and flagged `src/moduleSelectionHandler.ts`, `bff/src/services/streamingService.js`, `bff/src/integration/geminiGateway.js`, and `src/interactionHelpers.ts` as risk/hotspot files.
- `tmp/analysis/functions.json`, `calls.json`, `imports.json`, `fan_in.json`, and `fan_out.json` inspected around LLM-call helpers. Analyzer confirmed BFF gateway/streaming functions and selected Core/browser boundary calls, but it did not fully catalog several class-heavy WebView functions such as Selection Sensei and KeyTakeaway methods as simple function records. Direct source search and manual line-range reads cover those gaps.
- Core Analysis confirmation result: no additional active production LLM/provider or prompt-builder path was found beyond the manual findings. Analyzer confirmation strengthens the two non-master findings: `src/test.ts` direct test LLM path and legacy BFF `/turns` + `/stream` inline prompt path.

## Open Questions / Caveats

- The analyzer does not reliably classify Gemini SDK calls as `network` side effects and does not fully expose some class-heavy TypeScript methods in simple function queries. This audit compensates with direct source search and manual reads; final confidence is based on combined evidence.
- `src/test.ts` is currently effectively disabled by individual test subflags, but the top-level `TEST_SUITE_CONFIG.enabled` is true and startup still calls `runTestSuite(API_KEY)`. Final migration policy should decide whether to remove, isolate, or migrate this harness.
- The legacy BFF `/stream` route may be intentionally retained for earlier integration tests or fallback clients, but it violates the Phase 1 ownership rule if considered part of the mobile LLM surface.

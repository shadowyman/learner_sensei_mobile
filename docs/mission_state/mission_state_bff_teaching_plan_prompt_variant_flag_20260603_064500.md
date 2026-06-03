# Mission State: BFF Teaching Plan Prompt Variant Flag

## Scope

Move the mobile teaching-plan prompt variant decision from WebView payloads to BFF-owned configuration.

## Analyzer Evidence

- Full analyzer run completed with TypeChecker enabled.
- Focused trace from `core/teachingPlan.ts::extractAndPlanTeachingOrder` shows prompt selection flows through `GET_ITEM_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION` or the archetype prompt builder based on `itemBasedPromptEnabled`.
- Relevant hot modules are `src/moduleSelectionHandler.ts`, `src/index.tsx`, `src/teachingPlanRouting.ts`, `src/mobile/webviewMessageRouter.ts`, `SenseiMobile/src/mobile/MainScreen.tsx`, `SenseiMobile/src/mobile/network/BffClient.ts`, `bff/src/services/teachingPlanService.js`, `bff/src/config/index.js`, and `core/teachingPlan.ts`.

## Impact Analysis

- Classification: configuration and interface refinement.
- Risk: medium, because the change crosses WebView, React Native bridge types, BFF validation, and Core capability invocation.
- Security impact: positive, because shipped mobile bundles stop controlling the mobile prompt variant.
- Operational impact: positive, because BFF can later tune the mobile teaching-plan prompt variant through server config.
- UX impact: no intended visible behavior change while the BFF flag defaults to false.

## Static Execution Trace

Mobile teaching-plan flow remains:

WebView teaching-plan caller -> `requestTeachingPlan` -> `requestTeachingPlanViaBridge` -> React Native `BffClient.generateTeachingPlan` -> BFF `/sessions/:sessionId/teaching-plan` -> `TeachingPlanService.generateTeachingPlan` -> `core/teachingPlan.ts:extractAndPlanTeachingOrder` -> `core/prompts/teachingPlan.ts`.

Desktop teaching-plan flow remains:

Web caller -> `requestTeachingPlan` local branch -> `src/geminiService.ts:llmExtractAndPlanTeachingOrder` -> browser Core client -> `core/teachingPlan.ts`.

## Dependency And Side Effects

- `requestTeachingPlan` has no side effects except invoking either bridge or local callback.
- `TeachingPlanService.generateTeachingPlan` calls Core through `CoreLlmAdapter` and logs request status.
- `core/teachingPlan.ts:extractAndPlanTeachingOrder` selects prompt builder, calls the injected LLM client, parses JSON, and normalizes teaching points.
- WebView DOM and curriculum side effects remain in `src/moduleSelectionHandler.ts` and `src/index.tsx`.

## Validation Plan

- Add/adjust deterministic tests so WebView bridge payloads no longer require `itemBasedPromptEnabled`.
- Add BFF service coverage proving payload-provided `itemBasedPromptEnabled` is ignored and BFF config decides the Core prompt variant.
- Run targeted teaching-plan routing tests.
- Run targeted BFF tests for teaching-plan config behavior.
- Run `npm run webview:bundle` after WebView source/type changes.

## Backup

`backup/sensei_backup_bff_teaching_plan_prompt_variant_flag_20260603_064427.zip`

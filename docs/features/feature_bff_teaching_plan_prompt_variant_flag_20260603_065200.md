# BFF Teaching Plan Prompt Variant Flag

## Summary

The teaching-plan prompt variant switch is now owned by the BFF for mobile/WebView teaching-plan requests. Mobile no longer sends `itemBasedPromptEnabled` through the WebView bridge or RN network contract. The BFF decides whether Core receives `itemBasedPromptEnabled` by reading server-side environment configuration.

Desktop web behavior remains unchanged: browser-local teaching-plan generation can still use `TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED` from `src/model_usage.ts` when it falls back to direct/local Core execution.

## Rationale

Phase 1 mobile LLM migration requires prompts and LLM-routing decisions to be tunable on the server side without shipping a new mobile app. Keeping this flag in the mobile payload would make the mobile bundle an authority over prompt variant selection. Moving the authority to BFF lets future deployments toggle the teaching-plan prompt variant by changing server configuration and restarting or redeploying the BFF.

## Key Code Changes

- `bff/src/config/index.js:12` adds boolean environment parsing.
- `bff/src/config/index.js:67` reads `BFF_TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED`, with `TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED` as a compatibility fallback, defaulting to `false`.
- `bff/src/container.js:32` passes config into `TeachingPlanService`.
- `bff/src/services/teachingPlanService.js:10` stores the server-owned flag.
- `bff/src/services/teachingPlanService.js:23` passes the server-owned flag to `extractAndPlanTeachingOrder`.
- `src/teachingPlanRouting.ts:8`, `src/mobile/webviewMessageRouter.ts:62`, `SenseiMobile/src/mobile/bridge/contracts.ts:68`, and `SenseiMobile/src/mobile/network/types.ts:63` remove the mobile/WebView request field.
- `src/index.tsx:152` and the teaching-plan request payload remove the browser flag from mobile bridge requests.
- `src/moduleSelectionHandler.ts:34` and the module-selection teaching-plan request payload use the same structured mobile BFF route without sending the flag.
- `bff/tests/teachingPlanService.config.test.js:41` proves BFF config overrides any request payload value.
- `bff/tests/teachingPlan.int.test.js:24` keeps the integration request domain-only.

## Operation

Set `BFF_TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED=true` in the BFF environment to enable the item-based teaching-plan prompt for mobile BFF requests. Set it to `false` or leave it unset to preserve the current archetype/default prompt path.

Accepted true values are `1`, `true`, `yes`, and `on`. Accepted false values are `0`, `false`, `no`, and `off`.

## Behavioral Impact

Mobile/WebView teaching-plan generation sends structured teaching-plan inputs to RN and BFF, not prompt-variant configuration. The BFF consumes those structured inputs, calls Core through `TeachingPlanService`, and injects the server-side flag into Core's `extractAndPlanTeachingOrder` call.

Desktop web still uses the existing local flag from `src/model_usage.ts` for local browser execution and cache behavior. Core remains neutral: it still accepts `itemBasedPromptEnabled`, but the mobile path receives that value from BFF config instead of the mobile bundle.

## Validation Evidence

- `npm run analysis:run` passed before editing and regenerated analyzer artifacts.
- `npm run analysis:run -- --entry core/teachingPlan.ts::extractAndPlanTeachingOrder --maxDepth 4` confirmed the Core prompt branch controlled by `itemBasedPromptEnabled`.
- `node bff/tests/teachingPlanService.config.test.js` passed.
- `npm run webview:bundle` passed after web source changes.
- `npm test` from `bff/` passed outside the sandbox after local server binding was allowed.
- `git diff --check` passed.
- `rg -n "itemBasedPromptEnabled|TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED|BFF_TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED" bff src SenseiMobile/src/mobile core __tests__` showed no remaining mobile/WebView request-contract ownership of the flag.

## Known Validation Limits

- Root Jest commands for browser-side tests were blocked by a local dependency issue: `node_modules/jsdom/lib/jsdom/virtual-console.js` is missing while `node_modules/jsdom/lib/api.js` exists.
- `npx tsc --noEmit` still reports broad pre-existing project errors outside this focused change.

## Protocol Artifacts

- Backup: `backup/sensei_backup_bff_teaching_plan_prompt_variant_flag_20260603_064427.zip`
- Mission state: `docs/mission_state/mission_state_bff_teaching_plan_prompt_variant_flag_20260603_064500.md`
- Review artifact: not generated in this pass because the RCI manifest command would stage mixed files that already contain pre-existing unrelated work. Preserving those boundaries was prioritized over creating a review artifact for this focused flag change.

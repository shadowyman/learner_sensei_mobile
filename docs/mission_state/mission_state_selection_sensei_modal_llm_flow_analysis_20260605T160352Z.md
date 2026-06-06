# Mission State: Selection Sensei Modal LLM Flow Core Analysis

Timestamp: 2026-06-05T16:03:52Z

Status: Planning checkpoint only. No implementation, commit, push, backup, or WebView bundle was performed.

## Trigger

The user expanded the Selection Sensei toolbar-action backlog planning task to include the adjacent modal follow-up path as one Selection Sensei modal LLM flow. The user also explicitly allowed `npm run analysis:run` as part of Core Analysis Protocol.

## Governing Protocols

- `AGENTS.md`
- `docs/protocols/PLAN.md`
- `.codex/skills/llm-migration-compliance/SKILL.md`
- `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`
- `docs/protocols/MANDATORY_CORE_ANALYSIS_PROTOCOL_STEP_0.md`

The live ExecPlan is `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`.

## Objective Clarified

Migrate the Selection Sensei modal LLM flow as one unit:

- initial toolbar action: `src/selectionSensei.ts:handleToolbarAction`
- modal follow-up: `src/selectionSensei.ts:dispatchFollowupToAI`

Target ownership:

- Core owns prompts, toolbar and follow-up prompt builders, parser/normalizer, request/result types, and LLM capability.
- BFF owns provider execution, secrets, model config, validation, rate limiting, route responses, and server telemetry.
- React Native owns bridge transport from embedded `WKWebView` to BFF and back.
- WebView owns selection capture, toolbar UI, ask UI, modal state, bounded transcript collection, composer, markdown rendering, copy/share, and Add to Notepad.

No further clarification is required before the implementation agent starts from the ExecPlan.

## Analyzer Commands

Baseline analyzer:

```bash
npm run analysis:run
```

Result: exit 0. The run refreshed `tmp/analysis/*` and regenerated `src/file-manifest.json`.

Focused toolbar trace:

```bash
npm run analysis:run -- --include selectionSensei.ts,selectionSenseiResponseParser.ts,src/prompts.ts,src/model_usage.ts,src/mobile/webviewMessageRouter.ts,src/mobile/webviewBridge.ts,SenseiMobile/src/mobile/bridge/contracts.ts,SenseiMobile/src/mobile/MainScreen.tsx,SenseiMobile/src/mobile/network/BffClient.ts,SenseiMobile/src/mobile/network/types.ts,bff/src,core --entry src/selectionSensei.ts::SelectionSensei.handleToolbarAction --maxDepth 5
```

Result: exit 0.

Focused follow-up trace:

```bash
npm run analysis:run -- --include selectionSensei.ts,selectionSenseiResponseParser.ts,src/prompts.ts,src/model_usage.ts,src/mobile/webviewMessageRouter.ts,src/mobile/webviewBridge.ts,SenseiMobile/src/mobile/bridge/contracts.ts,SenseiMobile/src/mobile/MainScreen.tsx,SenseiMobile/src/mobile/network/BffClient.ts,SenseiMobile/src/mobile/network/types.ts,bff/src,core --entry src/selectionSensei.ts::SelectionSensei.dispatchFollowupToAI --maxDepth 5
```

Result: exit 0.

Command-wrapper issues:

- A first analyzer wrapper failed because `status` is a read-only variable in zsh. This was not an analyzer failure.
- One `jq` drilldown assumed the wrong `brief.json` shape and failed. The follow-up structured artifact queries were narrowed before updating the ExecPlan.
- One function-catalog `jq` query had a parenthesis typo and failed. The call-edge and focused trace evidence succeeded.

## Static Execution Trace

Toolbar action trace:

- `SelectionSensei.handleToolbarAction`
- `logSelectionSenseiValidation`
- `resetModalState`
- `showResponseModalWithLoading`
- `setComposerEnabled`
- `hideSelectionToolbar`
- `updateResponseModalContentAndTitle`
- `SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION`
- `SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION`
- `ensureSelectionChat`
- `extractContentWithRegex`
- parser helpers through `parseSelectionSenseiResponsePayload`

Follow-up trace:

- `SelectionSensei.dispatchFollowupToAI`
- `generateModalMessageId`
- `appendModalMessage`
- `setComposerEnabled`
- `ensureSelectionChat`
- `formatFollowupAnswer`
- `extractContentWithRegex`
- parser helpers through `parseSelectionSenseiResponsePayload`

Both entries currently converge on `ensureSelectionChat` and direct provider chat usage.

## Dependency and Side-Effect Table

| Function | Key dependencies | Side effects / risk |
|---|---|---|
| `SelectionSensei.handleToolbarAction` | Selection prompt builders, `ensureSelectionChat`, parser wrapper, modal reset/loading/update helpers | Provider call, prompt assembly, modal token use, modal loading and update behavior |
| `SelectionSensei.dispatchFollowupToAI` | `ensureSelectionChat`, `formatFollowupAnswer`, `appendModalMessage`, `setComposerEnabled` | Provider call, `followupInFlight`, modal message append, composer toggles |
| `SelectionSensei.ensureSelectionChat` | `GoogleGenAI`, system instruction, model config | Creates and stores provider chat; hidden provider history currently joins toolbar and follow-up |
| `SelectionSensei.resetModalState` | DOM validation, modal helpers, composer state | Clears modal state, increments token, resets `selectionChat`, resets follow-up flags |
| `SelectionSensei.handleFollowupSubmit` | Composer DOM, `dispatchFollowupToAI` | Duplicate-submit guard, user input clear, composer disable/enable |

## Risk Register

- High: toolbar and follow-up share hidden provider chat history. The migration must replace this with explicit bounded modal context or a documented BFF-owned modal state model.
- High: prompt custody spans exported prompt builders, inline toolbar action instruction text, and implicit follow-up prompt construction. Core parity tests must cover each.
- High: mobile bridge missing behavior currently can silently fail through `sendToNative`; Selection Sensei modal routing must fail closed without browser provider fallback.
- Medium: `selectionSenseiResponseParser.ts` uses `json5`; Core dependency handling must be decided while preserving parser parity.
- Medium: modal duplicate/in-flight behavior depends on `modalConversationToken` and `followupInFlight`; tests must prove stale results and duplicate submissions are handled.

## Coverage Checklist

- Manual source investigation completed before analyzer usage.
- Baseline analyzer run completed.
- Focused toolbar trace completed.
- Focused follow-up trace completed.
- Direct provider sweep was completed in the ExecPlan authoring pass with generated WebView bundle and reports excluded.
- LLM Migration Compliance Block in the ExecPlan was updated for toolbar action and follow-up.
- Protocol Coverage Ledger in the ExecPlan was updated for the expanded modal-flow scope.
- Implementation remains not started.

## Current Architectural Decision

The planned migration unit is a single Selection Sensei modal-message capability:

- Core/BFF task: `selection_sensei_modal`
- BFF route: `POST /sessions/:sessionId/selection-sensei/modal-message`
- Bridge request: `selectionSensei:modalMessageRequest`
- Bridge result: `selectionSensei:modalMessageResult`
- Request union: `SelectionSenseiModalMessageRequest = SelectionSenseiToolbarActionRequest | SelectionSenseiFollowUpRequest`

The preferred context model is stateless explicit modal context sent with each follow-up request. A future implementation may choose BFF-owned modal state only after updating the ExecPlan with session binding, expiration, state caps, validation, and stale-modal behavior.

## Next Action

Future implementation should begin at Milestone 0 in the ExecPlan, create the required non-doc backup before source edits, read the test protocol before adding/modifying tests, rerun scoped analysis if source drift or scope changes, then execute the Core/BFF/RN/WebView milestones in order.

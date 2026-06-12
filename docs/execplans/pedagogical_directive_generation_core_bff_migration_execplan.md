# Pedagogical Directive Generation Core/BFF Mobile Migration ExecPlan

This ExecPlan is a living document. It must be updated before and after every meaningful discovery, design decision, code change, failed command, validation result, review finding, scope adjustment, stopping point, or handoff. A future agent must be able to resume from this file and the current working tree without chat history.

This plan is written to be saved as:

    docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md

This plan is subordinate to `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`. If this ExecPlan conflicts with the master plan, the master plan wins and this ExecPlan must be revised before implementation continues. This plan also follows `docs/protocols/PLAN.md`, `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`, the repo-local LLM migration compliance skill, and the implementation patterns proven by the completed module-introduction/main-response streaming migration and Selection Sensei modal migration.

## Purpose / Big Picture

The goal is to migrate the Pedagogical Directive Generation engine from a WebView-owned direct Gemini call into the Phase 1 Core/BFF/mobile bridge architecture while preserving existing teaching behavior.

Today, the pedagogy engine runs inside the main Sensei response workflow. After learner-model updates, curriculum advancement, focus-strategy selection, and before the final Sensei response prompt is built, `generateNextSenseiResponse` asks `PedagogicalProfiler.getDirective(...)` for a short teaching directive unless `skipPedagogicalIntervention` is true. That directive changes how the next main Sensei response is built.

In standard mode, the returned directive currently becomes `pedagogicalGuidanceDirective` and is rendered into the Core-owned `mainSenseiResponse` prompt. In Socratic mode, the returned directive currently becomes either `pedagogicalGuidance.directive` or, if it starts with `MUST_OBEY`, `pedagogicalGuidance.metaPrompt`. If the directive starts with `MUST_OBEY`, key-takeaway enhancement is intentionally disabled for that response. If pedagogical intervention is skipped, the main response still streams, but without directive guidance. The migration may replace mobile client authority over those raw fields with server-issued directive references, but it must preserve these exact standard/Socratic server-side Core input semantics after BFF resolves the reference.

After this migration, mobile must not build the final directive prompt, must not call Gemini/browser provider code for this capability, and must not be able to inject arbitrary directive text into the migrated main-response BFF route. Mobile will send structured pedagogical context through WebView -> React Native -> BffClient -> BFF -> Core. Core will own directive prompt construction, directive fallback normalization, request/result types, allowed active-flag vocabulary, sanitizer helpers, provider-envelope parity, and provider-agnostic execution through an injected `CoreLlmClient`. BFF will own server-side provider execution, validation, caps, rate limiting, timeout policy, directive provenance storage or sealing, telemetry/logging, and the HTTP route. React Native will own transport. WebView will keep learner-model inspection, active-flag condition evaluation, recent-history selection, orchestration timing, and applying the returned directive classification to the existing main Sensei response workflow.

The user-visible result should be unchanged. Sensei should continue receiving the same kind of pedagogical directive before composing its response, including the existing safe fallback directive when the directive LLM returns empty text or fails. The architectural result changes: mobile server-owns both directive generation and directive consumption by the migrated main-response route.

## Implementation Status

Status: NOT_STARTED.

No implementation code may be edited until the Scope Lock, Capability x Mode x Lifecycle Matrix, Direct Provider Authority Sweep, Prompt Custody Ledger, Parser/Normalizer Ledger, Boundary Invariant Ledger, Trust-Boundary Schema Plan, Runtime Routing Plan, Directive Provenance Plan, Red-Test Gate, Provider Envelope Parity Plan, Rate Limit Parity Plan, Mobile No-Key Full-Turn Plan, and Boundary Contract Audit are filled with current-source evidence.

## Required Authority Reads Before Code Edits

The implementing agent must read these in order and record the read in `Progress` with timestamp, branch, and commit SHA:

1. `AGENTS.md`
2. `docs/protocols/PLAN.md`
3. `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`
4. `.codex/skills/llm-migration-compliance/SKILL.md`
5. `docs/templates/llm_migration_compliance_block.md`
6. `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`
7. `docs/llm_entry_exit_traces.md`
8. `docs/execplans/module_intro_main_sensei_streaming_core_bff_migration_execplan.md`
9. `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`
10. Current source files listed in this plan’s Source Map
11. Existing tests around `PedagogicalProfiler`, main Sensei response routing, bridge routing, BffClient, BFF route validation, BFF cap validation, SessionStore/idempotency behavior, and Core prompt parity

Do not rely on this plan as a substitute for rereading the current source. If source drift is found, update this ExecPlan before implementing.

When recording command state, record branch/SHA, staged state, and only unexpected or out-of-scope changed files. Do not paste full `git status` or full `git diff` output into this ExecPlan.

## Audit Checks Executed While Authoring This Plan

This plan was produced after auditing the earlier plan against current source and prior migration failure evidence.

Checks executed:

- Rechecked `docs/protocols/PLAN.md` requirements for self-contained living ExecPlans and mobile routing gates.
- Rechecked the master LLM migration plan for the exact `Pedagogical directive generation` and `Meta-prompt directive wrapper` rows.
- Rechecked the main/module streaming ExecPlan to identify PR #1 failure classes.
- Rechecked the Selection Sensei modal ExecPlan to identify PR #3 workflow and remediation patterns.
- Rechecked PR #1 review threads for failures around history loss, prompt ownership leakage, timeouts, caps, socket lifecycle, generated bundle, and BffClient error propagation.
- Rechecked PR #3 review threads for failures around field mapping, dropped context, stale bundle, rate limiting, timeout alignment, cap policy, stale modal state, dependency graph, and unwired tests.
- Reinspected current source for `src/index.tsx`, `src/moduleSelectionHandler.ts`, `src/pedagogicalProfiler.ts`, `src/geminiService.ts`, `src/model_usage.ts`, `src/mobile/webviewMessageRouter.ts`, `SenseiMobile/src/mobile/bridge/contracts.ts`, `SenseiMobile/src/mobile/network/BffClient.ts`, `SenseiMobile/src/mobile/network/types.ts`, `SenseiMobile/src/mobile/MainScreen.tsx`, `core/modelUsage.ts`, `core/llmTypes.ts`, `core/llmCapPolicy.ts`, `bff/src/config/index.js`, `bff/src/config/modelUsage.js`, `bff/src/config/llmCapPolicy.js`, `bff/src/validation/llmCapValidation.js`, `bff/src/integration/coreLlmAdapter.js`, `bff/src/integration/geminiGateway.js`, `bff/src/infra/sessionStore.js`, `bff/src/server.js`, `bff/src/container.js`, `bff/src/controllers/sessionController.js`, and `bff/src/controllers/selectionSenseiController.js`.
- Identified a pedagogy-specific security gap: server-generated directive text must not become arbitrary client-supplied main-response prompt guidance after migration.
- Identified a pedagogy-specific rate-limit gap: a normal mobile teaching turn may issue both a directive request and a main-response stream request, so limiter design must not self-throttle ordinary learning.
- Identified a no-browser-key mobile startup gap: current source can skip AI/profiler setup before BFF-backed mobile routes have a chance to run.
- Identified a provider-envelope parity risk: the old directive provider call sends one text prompt in `contents` and does not use a separate system instruction; the new route must preserve that envelope unless a deliberate design change is approved.
- Added concrete directive provenance, shared cap-policy reuse, paired-history shape, main-response sibling schema, BFF-only dependency validation, no-browser-key full-turn coverage, stale-result cleanup tests, and rate-limit parity requirements.

## Source Map And Current Workflow

### Current Trigger Path

Primary trigger:

1. User input enters the main teaching loop.
2. `src/index.tsx:handleUserInputText` displays the user message and eventually calls the main response flow.
3. The main response flow performs learner analysis and curriculum advancement.
4. `generateNextSenseiResponse` computes `focusStrategy`, including `focusPoints` and `upcomingActionItems`.
5. Unless `skipPedagogicalIntervention` is true, `generateNextSenseiResponse` calls:

       profiler!.getDirective(learnerModel, {
         upcomingActionItems,
         lastThreeUserResponses: userInputHistory.slice(-3),
         lastThreeSenseiResponses: lastSenseiResponses.slice(0, 3)
       });

6. The returned string becomes `guidanceText`.
7. `isMustObey = guidanceText.startsWith('MUST_OBEY')`.
8. Standard response mode uses `guidanceText` as `pedagogicalGuidanceDirective`.
9. Socratic response mode maps `guidanceText` into `pedagogicalGuidance.metaPrompt` when `MUST_OBEY`, otherwise `pedagogicalGuidance.directive`.
10. Key-takeaway enhancement is eligible only when `!guidanceText.startsWith('MUST_OBEY')`.
11. Main response streaming then uses the existing migrated `mainSenseiResponse` mobile route or desktop compatibility path.

### Current Prompt/Provider Path

Current direct provider chain:

1. `src/pedagogicalProfiler.ts:PedagogicalProfiler.getDirective`
2. `_identifyActiveFlags(model)` computes active flag strings from `LearnerModel`.
3. `getDirective` formats the active item-specific directive prompt by replacing these placeholders:
   - `{sensei_response_1}`
   - `{user_response_1}`
   - `{sensei_response_2}`
   - `{user_response_2}`
   - `{sensei_response_3}`
   - `{user_response_3}`
   - `{active_flags}`
   - `{action_items}`
4. `getDirective` calls `src/geminiService.ts:generateDirectiveFromMetaPrompt(this.ai, metaPrompt)`.
5. `generateDirectiveFromMetaPrompt` calls `ai.models.generateContent(...)`.
6. It returns `response.text.trim()` when non-empty.
7. On empty provider response or thrown provider error, it logs and returns:

       Gently guide the learner through the next logical step in the curriculum plan with a neutral, supportive tone.

### Current Owners That Must Change

Move to Core:

- Active directive prompt template.
- Prompt builder and placeholder rendering.
- Allowed pedagogical active-flag vocabulary.
- Request/result types.
- Sanitizer and prompt-rendered cap helper for directive context.
- Provider-agnostic directive execution through injected `CoreLlmClient`.
- Output trim/fallback normalization.
- Safe fallback directive constant.
- Provider-envelope task defaults.

Move to BFF:

- Mobile endpoint.
- Server provider adapter construction.
- Server-side model/task config.
- Validation and caps through shared cap-policy surfaces.
- Route-appropriate rate limiting.
- Directive provenance storage or sealing.
- Structured errors.
- Logging/telemetry without full prompt or raw learner payload leakage.
- Resolution of server-issued directive references when the mobile main-response route consumes a directive.

Keep in WebView:

- Learner-model inspection.
- `_identifyActiveFlags` condition logic.
- Recent user/Sensei response selection timing.
- `skipPedagogicalIntervention` decision.
- Whether returned guidance is `MUST_OBEY`.
- Standard vs Socratic placement of the directive classification in the local control flow.
- Key-takeaway eligibility check.
- Main response reload/stream orchestration.
- Teaching-state mutation and UI rendering.

Do not migrate in this PR unless a current live call site is proven:

- `src/pedagogicalProfiler.ts:UNIFIED_PEDAGOGICAL_META_PROMPT_TEMPLATE`
- `src/prompts.ts:TARGETED_CONSOLIDATION_PROMPT_TEMPLATE`
- `src/consolidationManager.ts:getConsolidationFocusInstruction`
- Enhancement request migration
- Key-takeaway enhancement provider migration
- Legacy generic BFF `/sessions/:sessionId/turns` plus `/sessions/:sessionId/stream`

## Pedagogy-Specific Workflow Invariants

These invariants are specific to the pedagogy engine and must be tested or explicitly recorded as N/A. They are not copied from prior PRs.

The directive must run after the current source’s learner analysis, curriculum advancement, focus-strategy calculation, and `ensureTeachingPlanExists` behavior, not before them. It must use `upcomingActionItems` from `calculateFocusStrategy`, not the whole curriculum or stale module state. If source drift changes this order, update the plan before coding.

The directive must be skipped when `skipPedagogicalIntervention` is true. Skip mode must not call WebView provider, Core browser client, BFF directive route, or BFF provider. The existing empty-guidance behavior must remain.

The directive must preserve old history semantics, but the migrated structured shape must remove the brittle two-array boundary. The WebView should convert the current `lastThreeUserResponses` and `lastThreeSenseiResponses` into chronological paired turns before sending them across mobile boundaries. Current user responses are passed oldest-to-newest. Current Sensei responses are passed newest-first and then reversed before prompt rendering. The new request shape should be:

    recentTurns: [
      { senseiResponse: "...", userResponse: "..." },
      { senseiResponse: "...", userResponse: "..." },
      { senseiResponse: "...", userResponse: "..." }
    ]

Each pair must be chronological. Tests must use unique turn markers so they prove Turn 1 Sensei maps to Turn 1 User, Turn 2 Sensei maps to Turn 2 User, and Turn 3 Sensei maps to Turn 3 User.

The directive must preserve empty-slot behavior. If history has fewer than three turns, the prompt must include the exact placeholder text currently used:

    [SYSTEM: Turn slot empty - conversation shorter than 3 turns]

The directive must preserve quote escaping behavior. Do not “improve” escaping or JSON formatting during migration. Prompt parity tests must include quotes in action items, user responses, and Sensei responses.

The directive must preserve `MUST_OBEY` semantics. The returned string is not parsed into a separate enum today; the current caller checks `startsWith('MUST_OBEY')`. The migration must not trim or wrap returned text in a way that changes this classification.

The directive must preserve standard/Socratic placement. Standard mode uses the directive as `pedagogicalGuidanceDirective`. Socratic mode maps `MUST_OBEY` guidance to `pedagogicalGuidance.metaPrompt` and ordinary guidance to `pedagogicalGuidance.directive`. Mobile clients must not send these raw fields after migration; BFF may only create them internally after resolving a server-issued directive reference. Tests must prove all three cases.

The directive must preserve key-takeaway gating. Key-takeaway enhancement remains a separate backlog item. This migration must not migrate, remove, or silently alter key-takeaway provider execution. It may only preserve the existing eligibility rule where `MUST_OBEY` disables key-takeaway enhancement. In mobile no-browser-key mode, key-takeaway may remain disabled because it still depends on browser `ai`; the main response must still complete. In mobile bridge-present mode with a browser `ai` object available, the implementation must either explicitly gate key-takeaway off for mobile or classify the remaining key-takeaway direct-provider path as a separate backlog item; do not claim a repo-wide mobile no-provider sweep while that path can still execute.

The directive must preserve safe fallback behavior. Existing provider empty/error paths return a generic fallback directive and main response generation continues. The mobile BFF path must not turn a recoverable directive provider failure into a stuck loading bubble or a failed main Sensei response.

The directive must not move learner-model state to BFF. Mobile sends active flags and recent context, not the full `LearnerModel`.

The directive must not create new curriculum/content authority. Curriculum content and module flow stay WebView-owned in Phase 1.

## Scope Lock

| Field | Required Answer |
|---|---|
| Backlog row | `Pedagogical directive generation` plus the paired `Meta-prompt directive wrapper` row from the master plan |
| Current direct provider entry | `src/geminiService.ts:generateDirectiveFromMetaPrompt` |
| Current prompt owner | `src/pedagogicalProfiler.ts:ITEM_SPECIFIC_PEDAGOGICAL_META_PROMPT_TEMPLATE` |
| Current orchestration owner | `src/pedagogicalProfiler.ts:PedagogicalProfiler.getDirective` and `src/index.tsx:generateNextSenseiResponse` |
| Prompt owner after migration | `core/prompts/pedagogicalDirective.ts` |
| Core capability after migration | `core/pedagogicalDirective.ts` |
| BFF owner | New route/controller/service: `bff/src/routes/pedagogicalDirective.js`, `bff/src/controllers/pedagogicalDirectiveController.js`, `bff/src/services/pedagogicalDirectiveService.js`; registered through `bff/src/server.js` and `bff/src/container.js` |
| Directive provenance owner | BFF session infrastructure, preferably `bff/src/infra/sessionStore.js` plus `SessionService` helpers, or a signed/sealed BFF-only token if session storage is rejected in the Decision Log |
| Main response sibling owner | Existing `/sessions/:sessionId/llm-stream` validation and BFF Core-adapter path must be updated so mobile main-response payloads resolve server-issued directive references instead of trusting raw directive text |
| RN bridge owner | `SenseiMobile/src/mobile/bridge/contracts.ts`, `SenseiMobile/src/mobile/MainScreen.tsx`, `SenseiMobile/src/mobile/network/BffClient.ts`, `SenseiMobile/src/mobile/network/types.ts` |
| WebView owner | `src/pedagogicalProfiler.ts`, new `src/pedagogicalDirectiveRouting.ts`, `src/mobile/webviewMessageRouter.ts`, `src/mobile/bridge/contracts.ts` shim if present, and `src/index.tsx` initialization/gating where required |
| Parser/normalizer owner | Core: trim directive text, classify empty response, return fallback directive, and expose deterministic normalization helpers |
| Desktop compatibility path | Browser Core client path using `createBrowserCoreLlmClient(ai)`; no duplicated prompt body or direct provider call in `generateDirectiveFromMetaPrompt` |
| Mobile path | Structured bridge request `pedagogicalDirective:request` -> RN `BffClient.runPedagogicalDirective` -> `POST /sessions/:sessionId/pedagogical-directive` -> Core capability -> BFF stores/returns server-issued directive reference -> WebView uses directive classification locally -> mobile `mainSenseiResponse` stream sends directive reference, not raw directive prompt text |
| Reload/retry path | Existing main-response reload should continue using stored reload context and not regenerate a new directive unless current source already does. If any reload path regenerates the directive, it must use the migrated route and provenance mechanism. Unknown-session retry belongs in BffClient. Duplicate directive request replay must return the same directive reference or avoid duplicate provider work. |
| Cache/placeholder path | Key-takeaway enhancer remains WebView-owned/separate backlog. Its eligibility still depends on `!guidanceText.startsWith('MUST_OBEY')`; do not change key-takeaway prompt/provider behavior in this PR. |
| Explicitly out of scope | Enhancement request migration, key-takeaway enhancement provider migration, Selection Sensei, legacy generic BFF turn-stream retirement, dormant prompt cleanup unless a live call site is proven |
| Stop condition | Stop if the implementation would require moving learner model state, curriculum progression, DOM rendering, chat transcript rendering, or main response streaming wholesale into BFF. That is outside Phase 1. |
| Stop condition | Stop if mobile can still send arbitrary directive prompt text into a migrated main-response BFF prompt after the pedagogy row is marked complete. |
| Stop condition | Stop if WebView production routing is implemented before BFF route, BffClient, and RN bridge transport exist and have passing tests. |

## Directive Provenance Plan

This section is mandatory. The implementation is incomplete without it.

Problem: Today the mobile main-response BFF payload accepts raw directive-shaped fields such as `pedagogicalGuidanceDirective`, `cleanPedagogicalGuidance`, `isMustObey`, and Socratic `pedagogicalGuidance`. That was acceptable only as a temporary state before the pedagogy engine migration. Once the directive generator is migrated, those raw fields become a client prompt-control backdoor unless the BFF can prove they came from the server-owned directive capability.

Preferred design:

1. WebView sends structured directive context to the new directive route.
2. BFF validates, rate-limits, and calls Core.
3. BFF stores the directive result in a server-owned session directive store and returns:

       {
         success: true,
         directiveId: "pdir_...",
         directive: "...",
         isMustObey: false,
         isFallback: false,
         expiresAt: 1234567890
       }

4. WebView may use `directive` and `isMustObey` for local control decisions only.
5. For mobile `mainSenseiResponse` stream payloads, WebView sends:

       pedagogicalDirectiveRef: {
         directiveId: "pdir_..."
       }

   or, if the directive route failed before a server directive could be issued but the main stream route is still available:

       pedagogicalDirectiveFallback: {
         kind: "safeDefault"
       }

6. BFF `/llm-stream` resolves `directiveId` to the server-stored directive for the same session before building the Core main-response prompt.
7. BFF rejects raw mobile directive fields once the migrated directive path is active:
   - `pedagogicalGuidanceDirective`
   - `cleanPedagogicalGuidance`
   - `isMustObey`
   - `pedagogicalGuidance.metaPrompt`
   - `pedagogicalGuidance.directive`
   - `metaPrompt`
   - `prompt`
   - `promptText`
   - `finalPrompt`
   - `systemInstruction`
   - `instruction`
8. BFF may convert the resolved directive into the current Core `mainSenseiResponse` input shape internally. That internal transformation is server-owned and tested.
9. For desktop WebView compatibility, local prompt construction may still use directive text directly because desktop direct-provider compatibility is allowed during Phase 1. This does not permit mobile BFF payloads to trust raw directive text.

If the executor chooses a signed/sealed token instead of session storage, the Decision Log must explain why. The token must be generated by BFF, verified by BFF before main-response prompt construction, scoped to the session, and protected from client tampering. A plain unsigned directive ID or plain directive text is not sufficient.

Directive records must include enough data for safe resolution:

- `directiveId`
- `sessionId`
- `directive`
- `isMustObey`
- `isFallback`
- `createdAt`
- `expiresAt`
- `clientDirectiveRequestId`
- required `contextHash` over sanitized directive request input
- optional `source: "pedagogical_directive"`

Directive records must expire. Use the existing session TTL/idempotency patterns unless source drift suggests a better existing owner. Deleting a session must delete directive records for that session.

Duplicate/replay behavior must be deterministic. A repeated directive request with the same `clientDirectiveRequestId` and the same sanitized `contextHash` in the same session should return the same directive record while it is still valid, not call the provider again and create a conflicting directive. A repeated `clientDirectiveRequestId` with a different `contextHash` must fail closed with a structured `409 CONFLICT` or `400 BAD_REQUEST` before provider execution; it must not reuse a stale directive for changed active flags, recent turns, action items, or context metadata.

## Rate Limit Parity Plan

Pedagogical directive generation is not a standalone learner action. It is an internal part of one normal main Sensei turn. A normal mobile turn can make two provider-backed calls:

1. `POST /sessions/:sessionId/pedagogical-directive`
2. `POST /sessions/:sessionId/llm-stream` plus WebSocket provider stream for `mainSenseiResponse`

Therefore, this migration must not consume the exact same tiny quota bucket in a way that makes one ordinary turn count as two ordinary user turns. The implementation must choose one of these two designs and record the choice in the Decision Log before BFF code is written.

Preferred design: add a dedicated `pedagogicalDirectiveRateLimit` profile.

Default profile:

    windowMs: 60_000
    limit: 6

Rationale: existing conversational main route defaults to 3 requests per 60 seconds. A dedicated directive limit of 6 per 60 seconds means directive generation will not be the bottleneck for the existing main-response limit. The main-response route still controls the user-visible chat rate. The directive route remains protected from runaway direct calls.

Required BFF test:

- Create one session.
- Submit two complete normal mobile turn sequences, each with one directive request and one main stream request using the returned directive reference.
- Expect no 429 from the directive route or the main stream route.
- Create a second session behind the same IP/User-Agent and prove it does not share the first session's directive quota.
- Then exceed the directive route directly and assert `429 RATE_LIMITED` before provider execution.
- Then exceed the main-response route according to its own policy and assert main route limiting remains independent.

Alternative design: shared logical main-turn budget.

This is allowed only if the implementation can prove directive + main stream are counted as one logical user turn and duplicate/retry behavior cannot bypass quota. If chosen, document exact mechanics and tests. Do not handwave this as “same provider-backed limiter.”

The route must apply rate limiting after session lookup, schema validation, cap validation, and idempotency replay lookup, but before provider execution. Replayed idempotent directive requests should not consume new quota or call the provider again. Until user-account-scoped quota exists, the limiter key must use the shared `buildSessionLimiterKey(sessionId, req.ip, req.get('User-Agent'))` pattern already accepted for Main and Selection provider-backed routes. Tests must prove separate sessions behind the same IP/User-Agent do not share quota, and one session is still rate-limited after exceeding the route profile.

## Provider Envelope Parity Plan

The old directive execution sends one rendered prompt in provider `contents` with `PEDAGOGICAL_DIRECTIVE_GENERATION_CONFIG.config`. It does not use a separate provider `systemInstruction`, JSON response MIME type, tool declaration, prompt wrapper, or base Sensei system instruction.

The migration must preserve that envelope unless the user explicitly approves a behavior change.

Required tests:

- Core prompt parity proves the provider-bound prompt string equals the old rendered prompt.
- BFF service/provider-capture test proves `CoreLlmClient.callText` receives:
  - `prompt` equal to the Core-rendered directive prompt
  - `options.task === 'pedagogical_directive'`
  - no `systemInstruction` unless old config already had one
- Gemini gateway task config test proves the directive task uses the model/temperature from the old `PEDAGOGICAL_DIRECTIVE_GENERATION_CONFIG`.
- No new wrapper marker, base persona envelope, JSON MIME type, or tool config is introduced.

## Mobile No-Browser-Key Full-Turn Plan

A profiler-only mobile no-key test is insufficient. The full mobile turn must work without browser `GoogleGenAI`.

Required behavior in native bridge mode when browser `API_KEY` is absent:

- `initializeGoogleAI` must not permanently skip PedagogicalProfiler construction.
- The main response path must not return early solely because `ai` is null.
- Teaching plan generation must use its already-migrated BFF path when needed.
- Learner analysis must use its already-migrated BFF path.
- Pedagogical directive generation must use the new BFF path.
- Main response streaming must use the already-migrated `mainSenseiResponse` BFF path.
- Key-takeaway enhancer may remain disabled because it is a separate direct-provider backlog path.
- No browser `mainSenseiChat` is required for mobile migrated main response streaming.

Required test:

- Run a mobile-mode main turn through `handleUserInputText` or a public harness with:
  - no browser API key
  - native bridge present
  - BFF-backed teaching plan/analysis/directive/main stream fakes
- Assert the turn reaches the directive route and main stream route.
- Assert no browser provider call, browser Core client, or `mainSenseiChat.sendMessageStream` is called.
- Assert loading clears and a Sensei response is displayed.
- Assert key-takeaway enhancer does not start in no-key mode, and this is classified as separate key-takeaway backlog rather than a regression in this migration.

## Shared Cap Policy Plan

This migration must use the same cap-policy architecture already used by Main and Selection Sensei.

Required files unless source drift changes ownership:

- `core/llmCapPolicy.ts`
- `bff/src/config/llmCapPolicy.js`
- `bff/src/validation/llmCapValidation.js`
- `bff/tests/llmCapValidation.test.js`

Required Core defaults:

    PEDAGOGICAL_DIRECTIVE_RECENT_TURNS_MAX = 3
    PEDAGOGICAL_DIRECTIVE_USER_RESPONSE_MAX_CHARS = 8000
    PEDAGOGICAL_DIRECTIVE_SENSEI_RESPONSE_MAX_CHARS = 200000
    PEDAGOGICAL_DIRECTIVE_ACTION_ITEMS_MAX = 40
    PEDAGOGICAL_DIRECTIVE_ACTION_ITEM_MAX_CHARS = 2000
    PEDAGOGICAL_DIRECTIVE_METADATA_MAX_CHARS = 240
    PEDAGOGICAL_DIRECTIVE_STRUCTURED_CONTEXT_MAX_CHARS = 750000

Required Core render/sanitizer defaults:

    PEDAGOGICAL_DIRECTIVE_RENDERED_USER_RESPONSE_MAX_CHARS = 4000
    PEDAGOGICAL_DIRECTIVE_RENDERED_SENSEI_RESPONSE_MAX_CHARS = 12000
    PEDAGOGICAL_DIRECTIVE_RENDERED_ACTION_ITEM_MAX_CHARS = 1000

Rationale: BFF trust-boundary caps accept normal long Sensei-authored tutoring responses without rejecting common sessions, while Core prompt-rendering sanitizers prevent huge text from being rendered into the actual provider prompt. This mirrors the PR #1 lesson that long raw history should be accepted at the boundary when appropriate, then sanitized before prompt construction.

BFF Zod validates shape/enums and required fields. Shared cap validation validates numeric LLM caps. Do not create one-off controller-only cap checks unless they call the shared helpers.

Required tests:

- BFF cap policy env override test.
- Shared validation rejects user response above 8000 chars.
- Shared validation accepts Sensei response above 4000 chars but below 200000 chars.
- Core prompt rendering truncates long Sensei response to rendered max.
- Aggregate overflow rejects before provider execution.
- Action item count and item length caps are enforced.
- Metadata caps are enforced.

## Timeout Layering Plan

Exact constants must be added. Do not use hard-coded local numbers.

Core/BFF provider budget:

    PEDAGOGICAL_DIRECTIVE_TIMEOUT_MS = 180_000

Protocol constants:

    PEDAGOGICAL_DIRECTIVE_RN_TIMEOUT_MS = 200_000
    PEDAGOGICAL_DIRECTIVE_BRIDGE_TIMEOUT_MS = 205_000

Required behavior:

- BFF/Gemini task timeout is 180 seconds.
- RN BffClient aborts the HTTP request at 200 seconds.
- WebView bridge resolver times out at 205 seconds.
- WebView should remain pending at 90 seconds and 180 seconds if no result has arrived.
- RN should abort before WebView’s bridge-only timeout.
- If RN returns an error before 205 seconds, WebView handles that error and clears the resolver.
- A late RN result after WebView timeout must be ignored and must not mutate a newer turn.

Required tests:

- Core/BFF model config exposes `PEDAGOGICAL_DIRECTIVE_TIMEOUT_MS`.
- RN fake-timer test aborts at 200 seconds.
- WebView fake-timer test remains pending at 90 and 180 seconds, rejects only at 205 seconds if no native result arrives.
- Late result test proves an old timed-out directive result cannot mutate the current/newer turn.

## Capability x Mode x Lifecycle Matrix

Every row must have either a passing test, a documented N/A rationale, or a user-approved deferral. Do not mark the migration complete while any required row is untested.

| Capability | Mode / Invocation | Runtime | Required Behavior | Forbidden Behavior | Required Test |
|---|---|---|---|---|---|
| Pedagogical directive | Standard main response, non-navigation input | Desktop | WebView computes active flags/recent context, Core builds prompt through browser client, returns same directive/fallback string shape | Direct prompt body remains in `src/`; duplicated direct provider/fallback logic | Core prompt parity + desktop wrapper test |
| Pedagogical directive | Standard main response, non-navigation input | Mobile bridge present | WebView sends structured context only; RN calls BFF; BFF validates and calls Core; BFF stores/returns directive reference; main stream payload sends reference; BFF resolves it into Core `pedagogicalGuidanceDirective` | Browser `ai.models.generateContent`, browser `CoreLlmClient`, final `metaPrompt`, raw directive prompt text in main stream payload | WebView routing sentinel + BFF directive-reference test + main stream rejection test |
| Pedagogical directive | Socratic main response after prior discussion | Mobile bridge present | Same structured directive route; returned reference is resolved server-side into Core `pedagogicalGuidance.directive` or `pedagogicalGuidance.metaPrompt` based on `MUST_OBEY` before prompt build | Losing recent user/Sensei context; wrong order; forcing standard mode; trusting mobile raw Socratic guidance | WebView/profiler test with Socratic context + BFF prompt-capture test |
| Pedagogical directive | `skipPedagogicalIntervention === true` / arrow navigation | Desktop and mobile | Do not call Core/BFF/provider; guidance remains empty and main response continues existing navigation behavior | Calling BFF/provider unnecessarily; generating directive during skip | Focused main-flow or profiler routing test |
| Pedagogical directive | Mobile bridge missing | Mobile | Fail closed at bridge boundary; no browser provider call; use safe fallback locally only if main BFF route can receive structured fallback marker, otherwise return structured failure caught by caller | Falling back to browser Gemini or browser Core client | Bridge-missing fail-closed sentinel |
| Pedagogical directive | Browser API key absent but native bridge present | Mobile | Full main turn reaches BFF teaching plan/analysis/directive/main stream routes without browser `ai` or `mainSenseiChat` | `profiler` remains null, `handleUserInputText` returns early, `ai!` crash, `mainSenseiChat!` crash | Mobile no-key full-turn test |
| Pedagogical directive + key-takeaway enhancer | Browser API key present and native bridge present | Mobile | Either key-takeaway enhancer is explicitly gated off for mobile, or final evidence classifies it as a separate direct-provider backlog path that remains outside this PR | Claiming all mobile provider paths are migrated while key-takeaway can still call browser provider | Mobile key-takeaway eligibility classification test/static sweep |
| Pedagogical directive | Desktop provider success | Desktop | Local path uses Core capability/browser client and returns trimmed provider text | Direct `ai.models.generateContent` remains in production wrapper | Desktop compatibility test + provider sweep |
| Pedagogical directive | Provider empty text | Desktop and mobile | Core returns existing safe fallback directive and BFF stores fallback directive reference for mobile | Empty directive string; thrown unhandled error; raw provider text | Core fallback test + BFF service test |
| Pedagogical directive | Provider error / quota / network | Desktop and mobile normal runtime | Core returns existing safe fallback directive; BFF returns success with fallback directive reference; main response can proceed | Unhandled 500 in normal runtime for recoverable provider failure; learner-text echo | Core provider-error test + BFF provider-error test |
| Pedagogical directive | Malformed mobile payload | Mobile/BFF | BFF rejects with structured `400 BAD_REQUEST`; does not call provider | Passing malformed payload into Core/provider | BFF validation negative test |
| Pedagogical directive | Old final-prompt payload | Mobile/BFF | BFF rejects fields such as `metaPrompt`, `prompt`, `promptText`, `finalPrompt`, `systemInstruction`, `instruction` | Accepting finished prompt text from mobile | BFF forbidden-field negative test |
| Pedagogical directive | Arbitrary prompt-control values | Mobile/BFF | BFF rejects active flags outside the Core-owned allowed flag set and rejects unknown mode/control fields | Client invents active flags or prompt modes | BFF enum/discriminant negative test |
| Pedagogical directive | Raw directive consumed by main stream | Mobile/BFF `/llm-stream` | BFF rejects mobile raw directive guidance and accepts only server-issued directive reference or structured safe fallback marker | Client supplies arbitrary `pedagogicalGuidanceDirective` / Socratic guidance | Main stream schema negative tests |
| Pedagogical directive | Directive reference consumed by main stream | Mobile/BFF `/llm-stream` | BFF resolves directiveId for the same session and injects directive server-side | Cross-session directive ID reuse; expired directive reuse; missing directive silently ignored | BFF directive-ref resolution tests |
| Pedagogical directive | Reused directive request ID with changed context | Mobile/BFF | BFF rejects same `clientDirectiveRequestId` with a different `contextHash` before provider execution | Returning stale directive for changed flags/history/action items | BFF idempotency conflict test |
| Pedagogical directive | Paired history | Core/BFF/WebView | WebView sends chronological paired `recentTurns`, and Core renders Turn N Sensei beside Turn N User | Independent arrays drift or mispair turns | Unique marker paired-turn prompt parity test |
| Pedagogical directive | Oversized prompt-rendered fields | Mobile/BFF/Core | BFF validates caps through shared cap policy; Core sanitizes before rendering; normal long prior Sensei responses are truncated/sanitized rather than rejected too early | Multi-megabyte payload reaches Core/provider; schema rejects normal long response before sanitizer when policy says sanitize | BFF cap tests + Core sanitizer tests |
| Pedagogical directive | Rate limiting | Mobile/BFF | Dedicated directive limiter or logical-turn limiter protects route without blocking two normal directive+main stream turns | No rate limit; sharing a tiny main stream bucket so normal turns are blocked; rate limit before schema tests | BFF rate-limit tests including two normal turns |
| Pedagogical directive | Unknown session | RN/BffClient | BffClient retries once after clearing session, matching other migrated routes | Permanent failure on stale session without retry | BffClient retry test |
| Pedagogical directive | Non-OK BFF response | RN/BffClient | Parse JSON body for every non-OK status and preserve BFF code/message in thrown error | Throwing only `status` and dropping actionable BFF message | BffClient non-OK body test |
| Pedagogical directive | Timeout | WebView/RN/BFF/provider | Exact timeout constants: BFF 180s, RN 200s, WebView bridge 205s | Hard-coded 90s bridge timeout; RN shorter than BFF; valid slow response dropped | Timeout constants + fake timer tests |
| Pedagogical directive | Late result after timeout/newer turn | WebView | Late old result is ignored and cannot mutate a later turn | Stale directive result changes new `guidanceText` or main stream payload | stale-result resolver test |
| Pedagogical directive | Abandoned/superseded request | WebView/RN/BFF | RN aborts on timeout and WebView ignores superseded results; if explicit bridge cancellation is unavailable, BFF timeout/abort limitation is documented with stale-result protection | Abandoned provider work mutates UI or silently burns quota beyond timeout | RN AbortController test + superseded-result test |
| Pedagogical directive | Generated mobile bundle | Mobile iOS WKWebView | `npm run webview:bundle` regenerates checked-out WebView assets; static generated bundle check finds `pedagogicalDirective:request` and directive ref fields | Source updated but shipped WebView bundle stale | Bundle command + static grep |
| Pedagogical directive | BFF-only dependency graph | BFF-only install/run | `cd bff && node -e "require('@sensei/core/pedagogicalDirective')"` succeeds | Core runtime dependency missing from BFF graph | BFF-only require test |
| Pedagogical directive | Test inclusion | BFF/default scripts | New deterministic BFF validation/service/cap tests are wired into `bff/package.json` test script or documented if full default is blocked by existing Mermaid live test | New tests pass only manually and are skipped by default | package script check |
| Pedagogical directive | Trace/master status | Docs | `docs/llm_entry_exit_traces.md` updated after implementation evidence; master status updated only after review/merge or marked PR-stage | Marking complete before review; no trace replacement path | Trace/status diff check |

## Direct Provider Authority Sweep

Run before implementation, after each major milestone, before PR, and after review remediation:

    rg -n "GoogleGenAI|new GoogleGenAI|Chat\\b|chats\\.create|sendMessageStream|sendMessage\\(|generateContent|generateContentStream|CoreLlmClient|GeminiGateway" src core bff SenseiMobile __tests__ -g '!SenseiMobile/app_web/webview_dist/**' -g '!__tests__/reports/**' -g '!**/node_modules/**'

Classify every hit:

| Hit | File | Classification | Required Action |
|---|---|---|---|
| `src/geminiService.ts:generateDirectiveFromMetaPrompt` direct `ai.models.generateContent` | `src/geminiService.ts` | must-fix | Replace with structured Core-backed desktop compatibility or remove if no current callers remain |
| `src/pedagogicalProfiler.ts` import `GoogleGenAI` | `src/pedagogicalProfiler.ts` | must-fix / desktop-compat only | Refactor so mobile profiler does not require browser provider; desktop may receive browser client executor |
| `src/index.tsx` AI/profiler initialization | `src/index.tsx` | must-fix if mobile no-key path blocked | Instantiate mobile-safe profiler and allow mobile BFF main response path without browser API key |
| `src/index.tsx` / `src/moduleSelectionHandler.ts` key-takeaway provider use | source direct-provider backlog | separate backlog | Classify honestly; do not claim fixed; ensure migration does not newly enable it in no-key mobile |
| `bff/src/controllers/sessionController.js` raw main-response guidance fields | `bff/src/controllers/sessionController.js` | must-fix sibling path | Replace mobile raw directive guidance with server-issued directive reference resolution |
| Core browser client provider usage | `core/browserLlmClient.ts` | desktop-only | Keep allowed for desktop Core-backed compatibility; sentinel must prove mobile does not reach it |
| BFF Gemini gateway usage | `bff/src/integration/geminiGateway.js` | server-owned | Allowed; add `pedagogical_directive` task config |
| Tests/mocks | `__tests__`, `bff/tests` | test-only | Allowed if asserting boundaries |
| Enhancement/debug/test-suite paths | various | separate backlog / debug / test-only | Do not modify in this PR unless direct regression appears |

Stop if a migrated mobile pedagogical directive request can reach browser provider code, browser `CoreLlmClient`, `generateDirectiveFromMetaPrompt` direct provider logic, or arbitrary raw directive guidance in the mobile main-response BFF route.

## Prompt Custody Ledger

Before moving prompt text, capture old runtime outputs using representative fixtures. Do not hash raw template source unless it exactly matches the runtime provider prompt. The old runtime output should be captured through the current public path or a targeted fake provider that records the prompt sent by `generateDirectiveFromMetaPrompt`.

| Prompt Symbol / Builder | Old File | Required Fixture | Old Runtime Length | Old SHA-256 | New File | New Runtime Length | New SHA-256 | Parity Test | Status |
|---|---|---|---:|---|---|---:|---|---|---|
| Active item-specific pedagogical directive prompt | `src/pedagogicalProfiler.ts:ITEM_SPECIFIC_PEDAGOGICAL_META_PROMPT_TEMPLATE` rendered by `PedagogicalProfiler.getDirective` | Fixture with 3 user responses, 3 Sensei responses, multiple action items, active flags including at least one Path A trigger and one Path B flag, embedded quotes in inputs | TBD | TBD | `core/prompts/pedagogicalDirective.ts:buildPedagogicalDirectivePrompt` | TBD | TBD | `__tests__/pedagogicalDirective.prompts.test.ts` | NOT_STARTED |
| Paired-turn directive prompt | same | Fixture with unique markers: `S1/U1`, `S2/U2`, `S3/U3` | TBD | TBD | same using `recentTurns` | TBD | TBD | same | NOT_STARTED |
| Empty-slot directive prompt | same | Fixture with fewer than 3 turns and empty action items | TBD | TBD | same | TBD | TBD | same | NOT_STARTED |
| Quote/escaping parity | same | Fixture with quotes in action items, user responses, and Sensei responses | TBD | TBD | same | TBD | TBD | same | NOT_STARTED |
| Dormant unified template | `src/pedagogicalProfiler.ts:UNIFIED_PEDAGOGICAL_META_PROMPT_TEMPLATE` | Call-site search only | N/A | N/A | Not migrated unless live call site proven | N/A | N/A | `rg "UNIFIED_PEDAGOGICAL_META_PROMPT_TEMPLATE"` evidence | NOT_STARTED |

Rules:

1. Move active prompt body verbatim first.
2. Do not rewrite, “improve,” compress, rename semantics, or alter prompt wording during migration.
3. Core prompt file owns prompt body and prompt rendering.
4. `src/pedagogicalProfiler.ts` must not retain the active prompt body after migration.
5. BFF must never import prompt files or contain prompt bodies.
6. Mobile must never send `metaPrompt` or final prompt text.
7. If the dormant unified template remains, label it as dormant/unreferenced with source-search evidence in this plan; do not silently migrate it as active behavior.

## Parser / Normalizer Custody Ledger

This capability has no JSON parser, but it does have output normalization and fallback behavior. That behavior is LLM-facing and must be Core-owned.

| Parser / Normalizer | Old File | Current Behavior | Core Destination | Input Fixture | Output Fixture | Parity Test | Status |
|---|---|---|---|---|---|---|---|
| Directive text normalization | `src/geminiService.ts:generateDirectiveFromMetaPrompt` | `response.text.trim()` | `core/pedagogicalDirective.ts:normalizePedagogicalDirectiveText` | `"  Action_Item_Direct_Instruction: guide...  "` | `"Action_Item_Direct_Instruction: guide..."` | `__tests__/pedagogicalDirectiveCore.test.ts` | NOT_STARTED |
| Empty response fallback | `src/geminiService.ts:generateDirectiveFromMetaPrompt` | Throw internally and return safe fallback | `core/pedagogicalDirective.ts` | `""` / whitespace | Existing safe fallback directive | same | NOT_STARTED |
| Provider error fallback | `src/geminiService.ts:generateDirectiveFromMetaPrompt` | Catch, log, return safe fallback | `core/pedagogicalDirective.ts` | fake client throws | Existing safe fallback directive | same + BFF service test | NOT_STARTED |
| `MUST_OBEY` classification | `src/index.tsx` | `guidanceText.startsWith('MUST_OBEY')` | Stays WebView; Core may return `isMustObey` metadata but source behavior remains string-prefix-based | directive starts with `MUST_OBEY` | `isMustObey === true` in existing caller | WebView/main-flow test | NOT_STARTED |

Stop if fallback behavior is duplicated between `src/`, Core, and BFF. `src/` may call Core and use the returned string, but it must not own a separate fallback constant or provider-error fallback implementation for this capability after migration.

## Boundary Invariant Ledger

| Invariant | Applies To | Forbidden Behavior | Positive Test | Negative Test | Status |
|---|---|---|---|---|---|
| Core owns prompt construction | Core/WebView/BFF | Prompt body or rendered meta-prompt remains in active `src/` path or BFF | Core prompt parity | BFF rejects `metaPrompt`/`promptText` | NOT_STARTED |
| Core owns active flag vocabulary | Core/WebView/BFF | WebView and BFF maintain independent string lists that drift | WebView imports Core flag constants | BFF rejects fake flag; static custody check | NOT_STARTED |
| Mobile sends structured directive inputs only | WebView/RN/BFF | Mobile sends final prompt, prompt fragments, systemInstruction, provider config, or raw directive authority | Mobile bridge payload test | BFF forbidden-field test | NOT_STARTED |
| Mobile main stream consumes server-issued directive only | BFF `/llm-stream` | Raw mobile directive guidance reaches prompt | BFF resolves directiveId | raw directive fields rejected | NOT_STARTED |
| Mobile no direct provider | WebView | Mobile calls `ai.models.generateContent`, browser Core client, or direct wrapper | Bridge-present route test | Bridge-missing no-provider sentinel | NOT_STARTED |
| Mobile no API-key dependency | WebView | `profiler` remains null in native bridge mode and main response cannot run without browser API key | Mobile no-key full-turn test | Existing no-key regression sentinel | NOT_STARTED |
| Prompt-rendered fields capped and sanitized | BFF/Core | Oversized payload reaches prompt/provider; normal long Sensei context rejected before sanitizer | Cap acceptance/sanitization test | Aggregate/per-field overflow tests | NOT_STARTED |
| Field names preserved across boundaries | WebView/RN/BffClient/BFF/Core | Field renamed/dropped, rendering `undefined` | Boundary contract audit test | Prompt-capture missing-field test | NOT_STARTED |
| Recent turn pairing preserved | WebView/Core | Turn N Sensei maps to wrong user response | Unique-marker paired prompt test | wrong-pair regression | NOT_STARTED |
| Safe fallback preserved | Core/BFF/WebView | Empty/provider error breaks main response or echoes learner payload | Provider error fallback test | No raw learner text in error/log assertion | NOT_STARTED |
| Timeout budgets exact | WebView/RN/BFF/provider | WebView/RN timeout expires before BFF/provider budget | Fake timer test | 90s stale-timeout regression test | NOT_STARTED |
| Route limiter is task-appropriate | BFF | No rate limit, or limiter profile blocks normal directive+main stream turns | two normal turns pass | over-limit request returns 429 before provider | NOT_STARTED |
| Unknown session retry preserved | BffClient | Stale session fails permanently | retry test | no retry after second failure | NOT_STARTED |
| Non-OK BFF errors preserve body | BffClient/RN/WebView | Error body/code/message discarded | 413/429 body test | status-only regression | NOT_STARTED |
| Stale/late directive result ignored | WebView | Late old result mutates later turn | late-result test | stale resolver regression | NOT_STARTED |
| Generated bundle current | Mobile app | WKWebView loads stale direct-provider path | bundle static grep | source-only diff rejected | NOT_STARTED |
| BFF-only dependency works | BFF | `require('@sensei/core/pedagogicalDirective')` fails from `bff/` | BFF-only require check | dependency omission | NOT_STARTED |
| Tests wired | BFF/package | New BFF tests not in default script | package script check | omission regression | NOT_STARTED |
| Documentation updated only at correct time | docs | Master marked complete before review passes | trace PR-stage update | stale status scan | NOT_STARTED |

No invariant may be marked `GREEN` unless both required behavior and forbidden behavior have test/evidence.

## Trust-Boundary Schema Plan

Mobile/BFF payload must be structured. It must not include a final prompt string. BFF validates shape and caps before calling Core. Core also sanitizes before rendering so normal long prior Sensei messages do not fail before the sanitizer.

Proposed WebView-to-BFF directive request payload:

    {
      clientDirectiveRequestId: "ped-dir-...",
      activeFlags: string[],
      recentTurns: [
        { senseiResponse: "...", userResponse: "..." }
      ],
      upcomingActionItems: string[],
      contextMetadata?: {
        phase?: "IntroIllustrate" | "Socratic" | "Solidify" | "Unknown",
        currentTaskId?: string,
        source?: "mainSenseiResponse",
        mainMessageId?: string
      }
    }

Proposed BFF-to-WebView directive response:

    {
      success: true,
      directiveId: "pdir_...",
      directive: "...",
      isMustObey: false,
      isFallback: false,
      expiresAt: 1234567890
    }

Proposed mobile main-response BFF payload addition:

    {
      pedagogicalDirectiveRef: {
        directiveId: "pdir_..."
      }
    }

or, only when the directive route failed before issuing a directive and the implementation chooses to preserve the old safe fallback through the main stream route:

    {
      pedagogicalDirectiveFallback: {
        kind: "safeDefault"
      }
    }

Fields:

| Field | Prompt Rendered? | Controls Prompt Behavior? | Type | Limit Plan | Required? | Sanitized? | Test |
|---|---|---|---|---|---|---|---|
| `clientDirectiveRequestId` | No | idempotency | string | capped; unique enough; no prompt rendering | yes for mobile | trim | replay test |
| `activeFlags` | Yes | Yes | array of enum strings | max 64 flags; each must be Core-owned allowed flag; aggregate counted | yes | enum validation; preserve order from WebView | valid/invalid flags |
| `recentTurns` | Yes | No | array of paired turn slot objects | exactly 0-3 chronological slots; Core renders missing slots with the old placeholder | yes | trim/truncate in Core; validate aggregate in BFF | count/ordering/oversized/missing-slot parity |
| `recentTurns[].userResponse` | Yes | No | string | transport cap 8000; rendered cap 4000 | required when slot is present; empty string renders old placeholder | trim/truncate in Core | oversized/empty/half-turn |
| `recentTurns[].senseiResponse` | Yes | No | string | transport cap 200000; rendered cap 12000 | required when slot is present; empty string renders old placeholder | trim/truncate in Core | normal long accepted/render-truncated/half-turn |
| `upcomingActionItems` | Yes | No | string[] | max 40 items; item cap 2000; rendered cap 1000 | yes | trim/truncate in Core; validate in BFF | oversized item/count |
| `contextMetadata.phase` | No or diagnostics only | no | enum | strict enum | optional | not rendered unless explicit future change | invalid phase |
| `contextMetadata.currentTaskId` | No or diagnostics only | no | string | capped at 240 | optional | trim | oversized metadata |
| `contextMetadata.mainMessageId` | No | id/logging only | string | capped at 240 | optional | trim | oversized metadata |
| `directiveId` | No | server reference | string | BFF-issued only | required for ref path | same-session lookup | cross-session/expired ref tests |
| `pedagogicalDirectiveFallback.kind` | No | safe fallback control | enum only: `safeDefault` | strict enum | optional | BFF resolves constant | invalid fallback kind |
| `metaPrompt` / `prompt` / `promptText` / `finalPrompt` / `systemInstruction` / `instruction` | Forbidden | Forbidden | forbidden fields | reject | no | N/A | forbidden-field negative |
| `pedagogicalGuidanceDirective` / `cleanPedagogicalGuidance` / `pedagogicalGuidance` in mobile BFF stream payload | Forbidden after migration unless BFF-internal | Forbidden as client authority | forbidden in mobile `/llm-stream` payload | reject or strip only after server resolution | no | N/A | main-stream forbidden-field negative |

Cap policy requirements:

1. Add pedagogical directive capability limits to `core/llmCapPolicy.ts`.
2. Add BFF env-backed policy in `bff/src/config/llmCapPolicy.js`.
3. Add reusable validators in `bff/src/validation/llmCapValidation.js`.
4. Do not bury one-off caps only in `pedagogicalDirectiveController.js`.
5. Use role-aware limits so prior Sensei responses are not rejected solely because they are normal long tutoring answers.
6. Use per-field, array-length, and aggregate caps.
7. BFF validates before service execution.
8. Core sanitizes/truncates before prompt rendering.
9. BFF logs issue paths and sizes, never full prompt, full learner payload, full directive text, full provider response, full action items, or full recent turns.
10. BFF returns `400 BAD_REQUEST` for malformed shape, `413 PAYLOAD_TOO_LARGE` for cap overflow, and `429 RATE_LIMITED` for valid-but-over-limit request frequency.

## Runtime Routing Plan

| Runtime | Bridge Present? | Structured Request Present? | Expected Path | Forbidden Path | Required Test |
|---|---|---|---|---|---|
| Desktop web | no | yes | `PedagogicalProfiler` -> local Core capability via browser `CoreLlmClient`; desktop main response may consume directive text locally | active prompt body in `src`; duplicated direct provider wrapper | desktop compatibility test |
| Mobile WebView | yes | yes | `PedagogicalProfiler` -> `requestPedagogicalDirectiveViaBridge` -> RN -> BffClient -> BFF -> Core -> directive reference -> main stream sends reference -> BFF resolves reference | browser provider SDK, browser Core client, final prompt string, raw directive text to BFF main stream | bridge-present sentinel |
| Mobile WebView | no | yes | bridge helper fails closed; no browser provider; use safe fallback locally only if main stream can send structured fallback marker | browser provider fallback | bridge-missing sentinel |
| Mobile WebView | yes | old final prompt payload | BFF rejects before provider | Core/provider execution | BFF forbidden payload test |
| Mobile WebView | yes | provider failure | BFF/Core issues fallback directive reference; main stream resolves it | unhandled main response failure or learner-text echo | provider failure test |
| Mobile no browser API key | yes | yes | full main turn reaches BFF-backed teaching plan/analysis/directive/main stream paths | early return because `ai`/`mainSenseiChat` missing | mobile no-key full-turn regression |
| Test/local fake | explicit fake | yes | deterministic fake provider through Core/BFF | silent fallback unless test expects fallback | deterministic BFF service test |

## Boundary Contract Audit

Before final acceptance, trace every source field through the actual implementation. Do not rely on route existence, type names, or worker summaries.

| Boundary | Source Field / Behavior | Destination Field / Behavior | Required Transformation | Forbidden Drift | Evidence/Test | Status |
|---|---|---|---|---|---|---|
| WebView learner model -> active flags | `LearnerModel` fields through `_identifyActiveFlags` | `activeFlags: PedagogicalDirectiveFlag[]` | WebView computes known flag names using Core-exported constants | arbitrary or stale flag vocabulary | profiler active-flag test | NOT_STARTED |
| WebView history -> paired turns | `userInputHistory.slice(-3)`, `lastSenseiResponses.slice(0, 3)` | `recentTurns` chronological pairs | preserve old final prompt order while pairing turns explicitly | lost, reversed, duplicated, or undefined history | paired marker parity test | NOT_STARTED |
| WebView -> RN bridge | `PedagogicalDirectiveRequestPayload` | `pedagogicalDirective:request` with `requestId` | add request ID, no final prompt | prompt/metaPrompt field sent | WebView bridge test | NOT_STARTED |
| RN bridge -> BffClient | contract payload | BffClient method input | pass payload unchanged, preserve arrays/flags/client request ID | dropped field or renamed key | MainScreen bridge test | NOT_STARTED |
| BffClient -> BFF | POST body | BFF schema | JSON body exactly structured; parse all error bodies; retry unknown session once | status-only errors; no retry | BffClient tests | NOT_STARTED |
| BFF controller -> Core request | validated payload | Core `PedagogicalDirectiveRequest` | map field names exactly; sanitize/cap; no prompt text | `{ text }` / `{ content }` style mismatch; undefined in prompt | BFF prompt-capture test | NOT_STARTED |
| Core capability -> provider | Core-built prompt | `CoreLlmClient.callText(prompt, { task: "pedagogical_directive" })` | task set; no `systemInstruction`; no wrapper markers; old config preserved | BFF prompt body; mobile prompt | Core/BFF service provider-envelope test | NOT_STARTED |
| Provider response -> Core normalizer | raw string or throw | directive string/fallback | trim; fallback on empty/error | empty string, raw error, learner echo | Core normalization tests | NOT_STARTED |
| BFF directive result -> session directive store | directive result | directive record | same-session, TTL, idempotency, required context hash, fallback metadata | cross-session reuse; duplicate provider call on replay; stale directive returned for changed context | BFF directive store tests | NOT_STARTED |
| WebView directive result -> main stream payload | `directiveId`, `directive`, `isMustObey` | `pedagogicalDirectiveRef` only for mobile BFF payload | use text locally; send reference to BFF | sending raw directive fields | WebView main-payload test | NOT_STARTED |
| BFF main stream -> Core main response | directive ref | Core prompt request | resolve directive server-side and internally map standard directives to `pedagogicalGuidanceDirective`, Socratic ordinary directives to `pedagogicalGuidance.directive`, and Socratic `MUST_OBEY` directives to `pedagogicalGuidance.metaPrompt` | trusting client raw directive; rejecting BFF-internal resolved guidance fields | deterministic BFF prompt-capture test | NOT_STARTED |
| Core/BFF/RN -> WebView | directive result or structured error | `guidanceText` string/classification | success returns directive; failure uses fallback or structured failure caught into fallback | stale pending resolver; late success mutates later turn | WebView resolver timeout/stale tests | NOT_STARTED |
| `guidanceText` -> main response prompt | string/ref classification | existing `isMustObey`, standard/Socratic prompt building, key-takeaway eligibility | preserve current semantics exactly | changing `MUST_OBEY` handling or key-takeaway gating | main-flow regression | NOT_STARTED |

## Prior PR Failure Classes This Plan Must Prevent

This migration must explicitly prevent mistakes that appeared in PR #1 and PR #3, while also preventing new pedagogy-specific backdoors.

### PR #1 Classes

1. Missing sibling reload path.
   - Pedagogy gate: verify whether reload regenerates directive. If it does, it must use the migrated route and provenance mechanism; if it does not, document that reload uses stored dynamic context and no provider call occurs.

2. Lost conversation context.
   - Pedagogy gate: prompt parity must prove recent user/Sensei responses are paired and ordered.

3. Missing prompt parity.
   - Pedagogy gate: prompt body must move verbatim, with runtime length/SHA parity.

4. Client prompt-string leakage.
   - Pedagogy gate: BFF rejects `metaPrompt`, raw directive fields, and final-prompt fields.

5. Insufficient field caps and late/early sanitization.
   - Pedagogy gate: role-aware caps plus Core sanitizer before rendering, and tests for normal long Sensei text.

6. Timeout mismatch.
   - Pedagogy gate: protocol-owned timeout constants and fake-timer tests across WebView/RN/BFF.

7. Duplicate request/provider work.
   - Pedagogy gate: `clientDirectiveRequestId` idempotency or equivalent directive replay behavior.

8. Provider work after disconnect or abandoned client path.
   - Pedagogy gate: `llm-stream` already aborts provider work on WebSocket close. The non-streaming directive route must use RN `AbortController` timeout and stale/superseded-result guards. If explicit WebView-to-RN cancellation is unavailable, record the limitation and prove late results cannot mutate a newer turn.

9. Error body loss.
   - Pedagogy gate: parse every non-OK error body in BffClient.

10. Generated bundle staleness.
   - Pedagogy gate: run bundle and statically verify checked-out generated WebView assets.

### PR #3 Classes

1. Boundary field mismatch.
   - Pedagogy gate: Boundary Contract Audit and BFF prompt-capture tests must prove no `undefined` and exact field mapping.

2. Dropped context field.
   - Pedagogy gate: all semantic fields used by old prompt must be explicitly listed and carried or intentionally kept WebView-owned.

3. Timeout mismatch between bridge and BFF.
   - Pedagogy gate: add timeout constants to `protocol/timeouts.ts`, import them instead of hard-coding.

4. Missing rate limiting on new BFF route.
   - Pedagogy gate: route must use provider-backed limiter after validation and before service execution.

5. Wrong limiter profile blocked normal usage.
   - Pedagogy gate: use a route-appropriate profile that does not block normal directive-plus-main-response turns.

6. Redundant raw content caused cap rejections.
   - Pedagogy gate: mobile sends only structured fields needed for prompt construction and a directive reference, never redundant prompt text.

7. Count-only transcript limits rejected normal long answers.
   - Pedagogy gate: role-aware caps and aggregate budget.

8. Stale UI state after local validation failure.
   - Pedagogy gate: directive route failure must not leave the main Sensei response loading state stuck.

9. Required context omitted by schema.
   - Pedagogy gate: BFF schema must require every field the Core prompt builder needs; optional fields must have explicit defaults matching old behavior.

10. Runtime dependency missing in BFF-only install.
    - Pedagogy gate: run BFF-only `require('@sensei/core/pedagogicalDirective')` and update dependency metadata if needed.

11. New tests not wired into default test scripts.
    - Pedagogy gate: update BFF `npm test` script or record explicit rationale.

## Progress

- [ ] Authority stack read and recorded with current branch/SHA.
- [ ] Existing source workflow revalidated from current checkout.
- [ ] Backup created before non-doc implementation edits, per repo protocol.
- [ ] Direct provider authority sweep run and classified.
- [ ] Prompt runtime SHA/length baselines captured.
- [ ] Red/golden tests added and observed failing for expected reasons.
- [ ] Core prompt/capability/flag-vocabulary implementation completed by parity.
- [ ] Shared cap-policy implementation completed.
- [ ] Directive provenance store or signed-token implementation completed.
- [ ] BFF route/service/controller/config/rate-limit implementation completed.
- [ ] BffClient method implemented.
- [ ] RN bridge implemented.
- [ ] `/llm-stream` main-response sibling schema updated to consume directive references and reject raw mobile directive text.
- [ ] WebView/profiler/main-flow/no-browser-key integration completed.
- [ ] Full deterministic validation completed.
- [ ] Live provider smoke completed or provider/quota blocker recorded.
- [ ] Generated WebView bundle updated and statically verified.
- [ ] Trace/status docs updated at the correct time.
- [ ] Final direct-provider sweep and boundary contract audit completed.
- [ ] PR review remediation, if any, completed with sibling sweeps and regression tests.

## Surprises & Discoveries

Record discoveries here immediately. This section must never be reconstructed from memory later.

Known pre-implementation discoveries:

- `PedagogicalProfiler` currently receives `GoogleGenAI` directly. This is not acceptable for the migrated mobile path because mobile should be able to use server-owned LLM execution without a browser API key.
- `initializeGoogleAI` currently returns early in mobile bridge mode when no API key is present, before constructing `PedagogicalProfiler`. This plan must fix the mobile no-browser-key route instead of leaving the pedagogy engine unreachable.
- `generateNextSenseiResponse` calls the pedagogy engine before building `mainSenseiResponse` requests, so a failed or missing directive route can affect standard, Socratic, key-takeaway eligibility, and main-response streaming.
- `lastThreeUserResponses` and `lastThreeSenseiResponses` currently have different order conventions. The migration must replace that brittle boundary with paired `recentTurns` while preserving the old rendered prompt.
- The active directive prompt is item-specific. The unified pedagogical prompt template appears dormant and must not be silently revived or migrated as active runtime behavior.
- Existing safe fallback behavior returns a generic directive rather than failing the whole main response. The migrated path must preserve this behavior.
- The existing main-response BFF schema accepts raw directive guidance fields. This must be treated as a sibling path of this migration, because completing the pedagogy migration without closing this consumption backdoor would leave mobile prompt-control authority in the client.
- Key-takeaway enhancement remains a nearby direct-provider backlog path. The final sweep must classify it honestly and must not claim it is fixed by this migration.

## Decision Log

Record every decision with rationale and date. Initial decisions:

- Decision: Migrate only the pedagogical directive generation and paired meta-prompt wrapper rows in this PR.
  Rationale: Master plan identifies these as not implemented. Enhancement, key-takeaway enhancement, and legacy BFF turn-stream retirement are separate backlog rows.
  Date/Author: 2026-06-06 / planning agent.

- Decision: Keep `PedagogicalProfiler` as WebView orchestration owner.
  Rationale: Master plan says learner-model inspection, active-flag selection, recent-conversation selection, and orchestration stay in WebView. Only prompt/provider/normalization move.
  Date/Author: 2026-06-06 / planning agent.

- Decision: Mobile sends active flags and recent turns as structured fields, not `metaPrompt`.
  Rationale: Mobile migrated runtime must not send final prompt strings or prompt fragments.
  Date/Author: 2026-06-06 / planning agent.

- Decision: Use chronological paired `recentTurns` across the boundary.
  Rationale: Separate user/Sensei arrays are brittle and can mispair history. Paired turns preserve intent and are easier to audit.
  Date/Author: 2026-06-06 / planning agent.

- Decision: Mobile main-response streams consume a server-issued directive reference, not raw directive text.
  Rationale: Without provenance, mobile could still inject arbitrary prompt guidance after the directive generator itself is migrated. Server ownership must cover both generation and consumption.
  Date/Author: 2026-06-06 / planning agent.

- Decision: Normal runtime provider error preserves existing fallback directive.
  Rationale: Current `generateDirectiveFromMetaPrompt` catches provider errors and returns the safe fallback. Changing that would alter user-visible main-response behavior.
  Date/Author: 2026-06-06 / planning agent.

- Decision: `UNIFIED_PEDAGOGICAL_META_PROMPT_TEMPLATE` is not part of active migration unless a live call site is proven by source search.
  Rationale: Master plan explicitly classifies it as dormant/unreferenced.
  Date/Author: 2026-06-06 / planning agent.

- Decision: Add protocol-owned timeout constants for pedagogical directive instead of hard-coding.
  Rationale: PR #3 showed timeout drift between WebView, RN, and BFF can drop valid responses.
  Date/Author: 2026-06-06 / planning agent.

- Decision: Use a dedicated pedagogical directive limiter profile unless a logical-turn limiter is deliberately designed.
  Rationale: A normal mobile teaching turn may make both a directive request and a main-response stream request. The route limiter must not cause the migration to self-throttle ordinary learning.
  Date/Author: 2026-06-06 / planning agent.

- Decision: Remove production final-prompt wrapper usage.
  Rationale: A production `generateDirectiveFromMetaPrompt(metaPrompt)` path keeps a final-prompt execution API alive after migration and weakens the ownership boundary.
  Date/Author: 2026-06-06 / planning agent.

## Implementation Plan

The order matters. Production WebView routing must not land before BFF route/service/config, BffClient transport, and RN bridge handling exist and pass focused tests. This prevents a half-migrated mobile path where WebView emits a request the native layer cannot satisfy.

### Milestone 0 — Pre-Implementation Gates

Do not edit production source before this milestone is complete.

1. Read the authority stack and record it in `Progress`.
2. Run current source status and record branch/SHA, staged state, and unexpected/out-of-scope files only.
3. Create the required backup before non-doc edits.
4. Run the Direct Provider Authority Sweep and classify every hit.
5. Inspect current call sites:
   - `src/index.tsx:initializeGoogleAI`
   - `src/index.tsx:generateNextSenseiResponse`
   - `src/index.tsx:handleUserInputText`
   - main-response reload handling in `src/index.tsx`
   - `src/moduleSelectionHandler.ts` to confirm module-intro paths are not accidentally included
   - `src/pedagogicalProfiler.ts`
   - `src/geminiService.ts:generateDirectiveFromMetaPrompt`
   - `src/model_usage.ts:PEDAGOGICAL_DIRECTIVE_GENERATION_CONFIG`
   - existing mobile bridge routes in `src/mobile/webviewMessageRouter.ts`
   - RN handling in `SenseiMobile/src/mobile/MainScreen.tsx`
   - BffClient request patterns
   - BFF controller/service/route patterns
   - `bff/src/controllers/sessionController.js` main-response schemas
   - `bff/src/infra/sessionStore.js` and `SessionService` for directive provenance storage
6. Confirm whether main-response reload regenerates the directive or uses stored dynamic context.
7. Confirm whether any live call site references `UNIFIED_PEDAGOGICAL_META_PROMPT_TEMPLATE`.
8. Update this ExecPlan with findings before adding tests.

Stop if source drift changes the current workflow, if the exact backlog row is unclear, or if directive provenance cannot be implemented without a user-approved design decision.

### Milestone 1 — Red / Golden Tests Before Implementation

Add tests before moving code. They should fail for expected reasons.

Required tests:

1. `__tests__/pedagogicalDirective.prompts.test.ts`
   - Capture current runtime prompt through `PedagogicalProfiler.getDirective` with a fake provider that records the prompt.
   - Fixture 1: normal standard context with 3 paired user/Sensei turns, action items, active flags.
   - Fixture 2: empty histories and empty action items.
   - Fixture 3: quotes and special characters.
   - Fixture 4: unique paired markers `S1/U1`, `S2/U2`, `S3/U3`.
   - Fixture 5: missing or empty per-slot fields render the exact old empty-slot placeholder rather than `undefined`.
   - Lock old prompt length and SHA-256.
   - Future assertion: Core prompt builder produces exact same prompt from paired `recentTurns`.

2. `__tests__/pedagogicalDirectiveCore.test.ts`
   - Initially red for missing `@sensei/core/pedagogicalDirective`.
   - Later covers text trim, empty response fallback, provider error fallback, allowed flags, sanitizer behavior, and `isMustObey` metadata.

3. `__tests__/pedagogicalDirective.mobileRoutingGate.red.test.ts`
   - Initially red for missing routing helper/bridge route.
   - Mobile bridge present: expects structured `pedagogicalDirective:request`.
   - Mobile bridge missing: expects no browser provider call and fallback/structured failure.
   - Mobile no-browser-key: expects the full main-turn harness can still reach route seams.

4. `__tests__/pedagogicalDirectiveRouting.test.ts`
   - Desktop calls local Core-backed path.
   - Mobile calls bridge path.
   - Mobile does not call local provider when bridge path is selected.
   - Skip mode does not call either route.

5. `__tests__/BffClient.test.ts`
   - Add expected-red tests for `runPedagogicalDirective`.
   - Unknown session retries once.
   - Non-OK body preserves BFF code/message.
   - RN timeout aborts request.
   - RN timeout or abort path prevents the WebView from waiting beyond the 205s bridge budget.
   - `clientDirectiveRequestId` is preserved.

6. `__tests__/MainScreen.pedagogicalDirectiveBridge.test.ts`
   - Expected red until RN bridge handler exists.
   - WebToRN request calls BffClient and returns RNToWeb result with same requestId.
   - Failure returns structured error without raw learner payload.

7. `bff/tests/pedagogicalDirective.validation.red.test.js`
   - Expected red with 404 until route exists.
   - Rejects old final prompt payload fields.
   - Rejects arbitrary active flag.
   - Rejects oversized fields/count/aggregate.
   - Accepts normal long Sensei response and verifies sanitization later.
   - Verifies schema requires `clientDirectiveRequestId`.

8. `bff/tests/pedagogicalDirective.service.test.js`
   - Expected red until service exists.
   - Captures Core/provider prompt.
   - Verifies provider-envelope parity.
   - Verifies fallback behavior.
   - Verifies rate limiting prevents provider call after allowed limit.
   - Verifies duplicate `clientDirectiveRequestId` plus same `contextHash` returns existing directive record without duplicate provider call.
   - Verifies duplicate `clientDirectiveRequestId` plus different `contextHash` returns structured conflict/invalid-request error without provider call.

9. `bff/tests/pedagogicalDirectiveRef.llmStream.test.js` or extension to existing deterministic LLM stream test
   - Expected red until `/llm-stream` resolves directive references.
   - Rejects raw mobile directive fields.
   - Accepts `pedagogicalDirectiveRef`.
   - Rejects expired/missing/cross-session directive IDs.
   - Accepts structured safe fallback marker and injects Core fallback server-side.
   - Proves BFF-internal resolved guidance can still reach Core standard/Socratic fields while equivalent client-supplied raw fields are rejected.

10. Main-flow regression test
   - Proves returned `MUST_OBEY` still sets `isMustObey` and disables key-takeaway enhancer eligibility.
   - Proves non-`MUST_OBEY` directive enters standard/Socratic flow as before.
   - Proves mobile main stream payload sends directive reference, not directive text.
   - Proves failed/timeout directive request clears loading and does not mutate a later turn with late results.
   - Proves mobile bridge-present key-takeaway behavior is either gated off for mobile or classified as a separate direct-provider backlog path without being counted as migrated.

Record each red command, exit code, and expected failure reason. Do not proceed to implementation if a test passes unexpectedly or fails for an unrelated reason.

### Milestone 2 — Core Prompt, Capability, Vocabulary, Provider Envelope, And Shared Policy

Files likely touched:

- `core/prompts/pedagogicalDirective.ts`
- `core/pedagogicalDirective.ts`
- `core/prompts/index.ts`
- `core/index.ts`
- `core/package.json`
- `core/modelUsage.ts`
- `core/llmCapPolicy.ts`
- root `package-lock.json` if package metadata changes
- `__tests__/pedagogicalDirective.prompts.test.ts`
- `__tests__/pedagogicalDirectiveCore.test.ts`

Implementation requirements:

1. Create `core/prompts/pedagogicalDirective.ts`.
2. Move `ITEM_SPECIFIC_PEDAGOGICAL_META_PROMPT_TEMPLATE` verbatim.
3. Export a builder such as `buildPedagogicalDirectivePrompt(request)`.
4. Use `recentTurns` as Core input, not two independent arrays.
5. Preserve old placeholder behavior exactly:
   - Sensei/User pairs render in chronological order.
   - Empty slots use the exact old system placeholder.
   - Action items are rendered as the same JSON-like quoted array string.
   - Quotes are escaped exactly as before.
6. Export the safe fallback directive constant from Core.
7. Export allowed active flag constants and a `PedagogicalDirectiveFlag` type from Core. WebView condition definitions must import these constants rather than maintaining unrelated string literals.
8. Add Core request/result types:
   - `PedagogicalDirectiveRequest`
   - `PedagogicalDirectiveResult`
   - `PedagogicalDirectiveFlag`
   - `PedagogicalDirectiveRecentTurn`
   - `PedagogicalDirectiveContextMetadata`
9. Add sanitizer/cap helper in Core or shared policy owner:
   - max 3 recent turns
   - max action item count
   - per-field caps
   - aggregate cap
   - normal long Sensei responses should be accepted at transport cap and truncated at render cap
10. Add pedagogical directive constants to `core/llmCapPolicy.ts`.
11. Add Core capability `generatePedagogicalDirective(llmClient, request, options?)`.
12. Use `llmClient.callText(prompt, { task: 'pedagogical_directive' })`.
13. Preserve old model behavior: plain text generation, no JSON response MIME type unless current source proves otherwise, temperature from existing pedagogical directive config, and no separate system instruction.
14. Normalize output in Core:
   - trim non-empty response
   - fallback on empty response
   - fallback on provider error
   - return `directive`, `isFallback`, `isMustObey`, and optional `fallbackReason`
15. Add `PEDAGOGICAL_DIRECTIVE_GENERATION_CONFIG` and `PEDAGOGICAL_DIRECTIVE_TIMEOUT_MS = 180_000` to `core/modelUsage.ts`.
16. Export through Core package entry points.
17. Run:
   - `npm run core:build`
   - focused prompt/Core tests
   - `git diff --check`

Stop if prompt length/SHA parity fails or provider-envelope parity changes without approval.

### Milestone 3 — Directive Provenance Storage Or Sealing

Files likely touched:

- `bff/src/infra/sessionStore.js`
- `bff/src/services/sessionService.js` if this is the current session API owner
- `bff/tests/pedagogicalDirective.service.test.js`
- any new directive-store test

Implementation requirements:

1. Add a server-owned directive record mechanism.
2. Preferred: extend session storage with directive records scoped by session ID.
3. Required methods or equivalents:
   - `createOrGetDirective(sessionId, clientDirectiveRequestId, directiveRecordFactory)`
   - `getDirective(sessionId, directiveId)`
   - `deleteSession` removes directives
4. Records must expire.
5. Records must include a required sanitized `contextHash`.
6. Duplicate `clientDirectiveRequestId` inside the same session with the same `contextHash` must return the same directive record without duplicate provider work.
7. Duplicate `clientDirectiveRequestId` inside the same session with a different `contextHash` must fail before provider execution.
8. Cross-session lookup must fail.
9. Expired lookup must fail.
10. Store only sanitized directive context hash for context evidence; do not store full prompt unless needed and approved.
11. If signed/sealed token is chosen instead, record the decision and add verification tests for tampering, expiry, session mismatch, and context-hash mismatch.

Stop if the only “provenance” is mobile sending directive text back to BFF.

### Milestone 4 — BFF Route, Validation, Service, Config, Rate Limit, And Shared Caps

Files likely touched:

- `bff/src/routes/pedagogicalDirective.js`
- `bff/src/controllers/pedagogicalDirectiveController.js`
- `bff/src/services/pedagogicalDirectiveService.js`
- `bff/src/config/modelUsage.js`
- `bff/src/config/index.js`
- `bff/src/config/llmCapPolicy.js`
- `bff/src/validation/llmCapValidation.js`
- `bff/src/integration/geminiGateway.js`
- `bff/src/server.js`
- `bff/src/container.js`
- `bff/package.json`
- `bff/package-lock.json`
- BFF tests

Implementation requirements:

1. Add BFF model config:
   - use Core defaults for model/temperature
   - add `PEDAGOGICAL_DIRECTIVE_GENERATION_CONFIG`
   - add timeout
   - add safety settings consistent with other text-generation routes
   - add `pedagogical_directive` case in `GeminiGateway.getTaskConfig`
   - add `pedagogical_directive` case in `GeminiGateway.getTaskModelName`
   - add env override if current BFF model config pattern supports it
2. Add BFF route:

       POST /sessions/:sessionId/pedagogical-directive

3. Controller order:
   - session lookup
   - strict schema parse
   - idempotency replay lookup if it can avoid unnecessary work safely
   - shared cap validation/sanitization
   - rate limit
   - service execution
   - directive record storage/replay
   - structured response
4. Schema must be `.strict()` and reject:
   - `metaPrompt`
   - `prompt`
   - `promptText`
   - `finalPrompt`
   - `systemInstruction`
   - `instruction`
   - arbitrary prompt options/control fields
   - unknown active flags
5. Validate every prompt-rendered field with shared per-field, array, and aggregate caps.
6. Accept normal long prior Sensei responses and sanitize/truncate through Core before prompt rendering.
7. Rate limiting:
   - add `pedagogicalDirectiveRateLimiter` defaulting to 6 per 60 seconds
   - key it with `buildSessionLimiterKey(sessionId, req.ip, req.get('User-Agent'))` unless user-account quota is implemented in the same packet
   - apply after session lookup and validation, before provider execution
   - do not consume main-response stream quota
   - return structured `429 RATE_LIMITED` with `Retry-After`
8. Service should use `CoreLlmAdapter` or equivalent server adapter to call Core.
9. BFF must not import prompt text or build prompts directly.
10. BFF must not log full prompt, full learner history, full action items, full directive text, full provider response, or API keys.
11. Error behavior:
    - normal provider empty/error should preserve safe fallback behavior and return a fallback directive reference
    - malformed payload and cap errors should return structured non-echoing errors
    - unknown session returns `400 BAD_REQUEST` for BffClient retry compatibility
12. Register route in `bff/src/server.js`.
13. Register service/rate limiter/config in `bff/src/container.js`.
14. Add tests and wire them into `bff/package.json` test script if appropriate.
15. Run:
    - `node --check` on changed BFF files
    - BFF validation test
    - BFF service test
    - `cd bff && node -e "require('@sensei/core/pedagogicalDirective')"`
    - `cd bff && npm test` if feasible; if blocked by existing Mermaid live test, record blocker and run direct new tests

Stop if BFF contains prompt bodies, accepts final prompt strings, misses route-appropriate rate limiting, duplicates provider work on replay, or does not cap/sanitize prompt-rendered fields.

### Milestone 5 — BffClient Transport

Files likely touched:

- `SenseiMobile/src/mobile/network/types.ts`
- `SenseiMobile/src/mobile/network/BffClient.ts`
- BffClient tests

Implementation requirements:

1. Add typed payload/result aliases based on Core or shared protocol types.
2. Add BffClient method, such as `runPedagogicalDirective(payload)`.
3. Use `AbortController` with `PEDAGOGICAL_DIRECTIVE_RN_TIMEOUT_MS = 200_000`.
4. Retry once on unknown session.
5. Parse all non-OK JSON bodies and preserve code/message.
6. Preserve `clientDirectiveRequestId`.
7. Do not expose API key, final prompt, provider request, or provider config to WebView.
8. Run BffClient tests.

Stop if the BffClient method can submit a final prompt or drops actionable BFF errors.

### Milestone 6 — React Native Bridge

Files likely touched:

- `SenseiMobile/src/mobile/bridge/contracts.ts`
- `SenseiMobile/src/mobile/MainScreen.tsx`
- `__tests__/MainScreen.pedagogicalDirectiveBridge.test.ts`

Implementation requirements:

1. Add WebToRN message:
   - `pedagogicalDirective:request`
   - includes `requestId` and structured payload.
2. Add RNToWeb message:
   - `pedagogicalDirective:result`
   - success includes directive result.
   - failure includes structured error.
3. Add MainScreen handler:
   - receives `pedagogicalDirective:request`
   - calls BffClient
   - enqueues `pedagogicalDirective:result`
   - preserves requestId
   - forwards failure without raw learner payload
4. No stream throttling is needed because this capability is non-streaming.
5. Run MainScreen bridge tests.

Stop if request/result field names drift between WebView contracts, RN contracts, BffClient, BFF schema, and Core request.

### Milestone 7 — Main Sensei `/llm-stream` Sibling Update

Files likely touched:

- `bff/src/controllers/sessionController.js`
- `bff/src/services/streamingService.js`
- `bff/src/integration/senseiCoreAdapter.js`
- `core/mainSenseiResponse.ts` only if type support is needed
- `bff/tests/llmStream.deterministic.int.test.js` or new focused test
- `src/index.tsx`
- `src/moduleSelectionHandler.ts` only if search proves module-intro raw directive fields are relevant

Implementation requirements:

1. Update BFF `mainSenseiResponse` mobile payload schemas to accept server-issued directive reference/fallback marker.
2. Reject raw mobile directive fields for migrated main responses once the new path exists.
3. Resolve directive records server-side before Core main-response prompt construction.
4. Preserve standard mode semantics.
5. Preserve Socratic mode semantics.
6. Reject cross-session, missing, and expired directive references.
7. Accept no directive when `skipPedagogicalIntervention` was true.
8. Support `pedagogicalDirectiveFallback: { kind: 'safeDefault' }` by resolving the Core safe fallback constant server-side.
9. Audit `moduleIntroduction` schema fields `pedagogicalGuidanceDirective`, `cleanPedagogicalGuidance`, and `isMustObey`. If no current module-intro path needs them, remove or reject them in mobile schema. If a sibling path needs them, convert to server-issued reference too. Do not leave unused arbitrary guidance fields as a prompt backdoor.
10. Add deterministic prompt-capture tests proving resolved directive text reaches the provider prompt through the exact server-side Core fields: `pedagogicalGuidanceDirective` in standard mode, `pedagogicalGuidance.directive` for ordinary Socratic mode, and `pedagogicalGuidance.metaPrompt` for `MUST_OBEY` Socratic mode. Equivalent client-supplied raw fields must be rejected.
11. Ensure existing completed main/module stream tests still pass.

Stop if the main-response BFF route still trusts mobile raw directive guidance.

### Milestone 8 — WebView Profiler, Routing, Main Flow, No-Key Integration

Files likely touched:

- `src/pedagogicalProfiler.ts`
- `src/pedagogicalDirectiveRouting.ts`
- `src/geminiService.ts`
- `src/model_usage.ts`
- `src/index.tsx`
- `src/mobile/webviewMessageRouter.ts`
- `src/mobile/bridge/contracts.ts` shim if present
- focused tests

Implementation requirements:

1. Add `src/pedagogicalDirectiveRouting.ts` following the route selector pattern used by teaching plan routing:
   - desktop/local uses Core-backed browser path
   - mobile uses bridge path
   - no third path
2. Refactor `PedagogicalProfiler` so it no longer owns the active prompt body or direct provider call.
3. Prefer constructor injection:

       new PedagogicalProfiler({
         requestDirective: async (payload) => ...
       })

   rather than passing `GoogleGenAI` into the profiler.
4. Keep `_identifyActiveFlags` condition logic in `PedagogicalProfiler`, but import flag-name constants from Core.
5. `PedagogicalProfiler.getDirective` should create structured request input:
   - `clientDirectiveRequestId`
   - `activeFlags`
   - `recentTurns`
   - `upcomingActionItems`
   - optional context metadata
6. On desktop, call Core through browser `CoreLlmClient`.
7. On mobile, call `requestPedagogicalDirectiveViaBridge`.
8. On mobile bridge-missing or bridge failure, do not call browser provider. Use Core safe fallback locally and, if a main BFF stream is still attempted, use structured `pedagogicalDirectiveFallback: { kind: 'safeDefault' }` instead of sending fallback directive text as raw guidance.
9. Remove production runtime dependency on `generateDirectiveFromMetaPrompt(metaPrompt)`. If retained at all, it must be test-only/deprecated and provider sweep must prove no production runtime imports it.
10. Update `src/model_usage.ts` to re-export Core-owned `PEDAGOGICAL_DIRECTIVE_GENERATION_CONFIG`.
11. Fix mobile no-browser-key initialization:
    - In native bridge mode, `PedagogicalProfiler` must be constructible without browser `ai`.
    - `handleUserInputText` and the main response path must not return early solely because `ai` is null when mobile bridge execution is available.
    - The existing `if (!ai)` branch before `streamMainSenseiResponse` must be changed so mobile can proceed when `mainSenseiLlmStreamRequest` and native bridge path are available.
    - Key-takeaway enhancer remains disabled when it requires browser `ai`; do not migrate key-takeaway in this PR.
    - Main response streaming must still use the already-migrated `mainSenseiResponse` BFF path on mobile.
12. Add `requestPedagogicalDirectiveViaBridge` to `src/mobile/webviewMessageRouter.ts`.
13. Add resolver map, request ID generation, timeout, success handling, structured error handling, and stale/late-result ignore behavior.
14. Add timeout constants to `protocol/timeouts.ts` and import them. Do not hard-code 90s.
15. Ensure `createWebviewMessageHandler` handles `pedagogicalDirective:result`.
16. Update mobile main-response payload construction:
    - use directive text locally for `isMustObey` and key-takeaway eligibility.
    - send `pedagogicalDirectiveRef` to mobile BFF main stream.
    - do not send raw directive fields to mobile BFF main stream.
17. Run focused WebView/routing tests and `npm run protocol:build`.
18. If a newer main turn supersedes a pending directive request, clear or ignore the stale pending resolver so a late result cannot mutate the newer `guidanceText` or main stream payload.

Stop if mobile can still reach browser provider code, if no-API-key mobile mode cannot reach a mobile-safe profiler, or if mobile main stream still sends raw directive text.

### Milestone 9 — Generated Bundle, Trace, Status, Final Validation

1. Run protocol/build commands:
   - `npm run core:build`
   - `npm run protocol:build`
2. Run focused root Jest:
   - `__tests__/pedagogicalDirective.prompts.test.ts`
   - `__tests__/pedagogicalDirectiveCore.test.ts`
   - `__tests__/pedagogicalDirectiveRouting.test.ts`
   - `__tests__/pedagogicalDirective.mobileRoutingGate.red.test.ts`
   - `__tests__/BffClient.test.ts`
   - `__tests__/MainScreen.pedagogicalDirectiveBridge.test.ts`
   - any updated main-flow tests
3. Run BFF tests:
   - `cd bff && node tests/pedagogicalDirective.validation.red.test.js`
   - `cd bff && node tests/pedagogicalDirective.service.test.js`
   - `cd bff && node tests/pedagogicalDirectiveRef.llmStream.test.js`
   - shared cap-policy tests
   - `cd bff && node -e "require('@sensei/core/pedagogicalDirective')"`
   - `cd bff && npm test` if possible; if blocked by existing Mermaid live integration, record the exact blocker and prove new tests pass directly
4. Run mobile tests:
   - `cd SenseiMobile && npm test -- --runInBand`
5. Run WebView bundle:
   - `npm run webview:bundle`
6. Static generated bundle check:
   - verify `SenseiMobile/app_web/webview_dist/index.js` includes `pedagogicalDirective:request`
   - verify it includes directive reference fields and not a stale mobile direct-provider-only path
   - if the generated files are ignored and no tracked diff appears, stop and record whether the repo expects force-adding generated bundle artifacts for mobile PRs
7. Run analyzer:
   - `npm run analysis:run -- --include src/pedagogicalProfiler,src/pedagogicalDirectiveRouting,src/mobile/webviewMessageRouter,src/index.tsx,SenseiMobile/src/mobile/MainScreen,SenseiMobile/src/mobile/network/BffClient,bff/src/controllers/pedagogicalDirectiveController.js,bff/src/services/pedagogicalDirectiveService.js,bff/src/controllers/sessionController.js,bff/src/integration/senseiCoreAdapter.js,core/pedagogicalDirective.ts,core/prompts/pedagogicalDirective.ts`
8. Run final direct-provider sweep.
9. Run final key-takeaway classification:
   - classify key-takeaway provider execution as separate backlog.
   - prove this migration did not newly enable key-takeaway direct provider execution in mobile no-key mode.
10. Run `git diff --check`.
11. Run `git diff --cached --check` only if staging is authorized or already present.
12. Update `docs/llm_entry_exit_traces.md`.
13. Update the master plan status only after review passes or mark it explicitly as PR-stage evidence.
14. Add Final Migration Evidence block to this ExecPlan and PR body.

## Required Tests By Layer

### Core

- Prompt parity length/SHA for active item-specific prompt.
- Empty history/action items prompt parity.
- Quote escaping parity.
- Paired-turn marker parity.
- Active flag enum/vocabulary test.
- Static flag custody test proving WebView imports Core constants.
- Sanitizer tests for:
  - 3 recent turns max
  - each present turn slot requires both `senseiResponse` and `userResponse`, with explicit placeholder rendering for empty/missing content
  - long normal Sensei response accepted and render-truncated
  - aggregate budget
  - action item count/length
- Provider success returns trimmed directive.
- Empty provider response returns safe fallback.
- Provider throw returns safe fallback.
- `isMustObey` metadata matches string prefix.
- Provider-envelope parity: no system instruction, no wrapper marker, text prompt in `contents`.
- No prompt body outside `core/prompts/pedagogicalDirective.ts`.

### WebView

- `PedagogicalProfiler` computes active flags and structured `recentTurns` without building final mobile prompt.
- Mobile bridge-present path sends `pedagogicalDirective:request`.
- Mobile bridge-missing path does not call browser provider.
- Mobile no-browser-key full main turn reaches BFF-backed routes.
- `skipPedagogicalIntervention` calls no directive provider/route.
- `MUST_OBEY` behavior preserved.
- Socratic mapping preserved.
- Key-takeaway eligibility preserved and mobile direct-provider status explicitly gated or classified as separate backlog.
- Failed directive request clears loading or falls back safely.
- Late directive result cannot mutate a newer turn.
- Reload behavior classified and tested.
- Mobile main-response BFF payload sends directive reference, not raw directive text.

### React Native / BffClient

- BffClient posts to `/sessions/:sessionId/pedagogical-directive`.
- Unknown session retry.
- Non-OK body preservation.
- Timeout abort at 200 seconds.
- MainScreen request/result bridge.
- Failure result bridge.
- `clientDirectiveRequestId` preservation.
- No prompt/provider fields in RN contracts.

### BFF

- Schema accepts valid structured payload.
- Schema rejects final prompt fields.
- Schema rejects arbitrary active flags.
- Schema rejects unknown fields.
- Caps reject oversized user/action/aggregate payloads.
- Normal long Sensei response accepted and sanitized.
- Dedicated directive rate limit blocks direct overuse without blocking two normal directive+main-stream turns.
- Dedicated directive rate limit uses the shared session-scoped key; separate sessions behind one IP/User-Agent do not share quota, while one session can still be throttled.
- Duplicate `clientDirectiveRequestId` avoids duplicate provider call.
- Duplicate `clientDirectiveRequestId` with changed context hash is rejected before provider call.
- Provider success returns directive reference.
- Empty/provider error returns fallback directive reference.
- Directive reference resolves in `/llm-stream`.
- Raw mobile directive guidance is rejected by `/llm-stream`.
- Expired/missing/cross-session directive references are rejected.
- Logs/errors do not echo raw learner text or full prompt.
- Logs/errors do not echo full directive text, full provider response, full action items, or full recent turns.
- BFF-only `require('@sensei/core/pedagogicalDirective')` succeeds.
- Tests wired into package script.

### Integration / Docs

- Full source provider sweep passes classification.
- Generated bundle contains new route.
- Trace updated.
- Master status update timing obeys review/PR-stage rule.
- Live provider smoke run or blocker recorded.

## Validation Commands

Use exact commands when possible. Record exit codes and relevant output.

    npm run core:build

    npm run protocol:build

    npm test -- --runTestsByPath __tests__/pedagogicalDirective.prompts.test.ts __tests__/pedagogicalDirectiveCore.test.ts __tests__/pedagogicalDirectiveRouting.test.ts __tests__/pedagogicalDirective.mobileRoutingGate.red.test.ts __tests__/BffClient.test.ts __tests__/MainScreen.pedagogicalDirectiveBridge.test.ts --silent --bail --noStackTrace

    cd bff && node tests/pedagogicalDirective.validation.red.test.js

    cd bff && node tests/pedagogicalDirective.service.test.js

    cd bff && node tests/pedagogicalDirectiveRef.llmStream.test.js

    cd bff && node -e "require('@sensei/core/pedagogicalDirective')"

    cd bff && npm test

    cd SenseiMobile && npm test -- --runInBand

    npm run webview:bundle

    npm run analysis:run -- --include src/pedagogicalProfiler,src/pedagogicalDirectiveRouting,src/mobile/webviewMessageRouter,src/index.tsx,SenseiMobile/src/mobile/MainScreen,SenseiMobile/src/mobile/network/BffClient,bff/src/controllers/pedagogicalDirectiveController.js,bff/src/services/pedagogicalDirectiveService.js,bff/src/controllers/sessionController.js,bff/src/integration/senseiCoreAdapter.js,core/pedagogicalDirective.ts,core/prompts/pedagogicalDirective.ts

    rg -n "GoogleGenAI|new GoogleGenAI|Chat\\b|chats\\.create|sendMessageStream|sendMessage\\(|generateContent|generateContentStream|CoreLlmClient|GeminiGateway" src core bff SenseiMobile __tests__ -g '!SenseiMobile/app_web/webview_dist/**' -g '!__tests__/reports/**' -g '!**/node_modules/**'

    git diff --check

Live provider smoke command must be added after route implementation. It must prove BFF-to-provider execution through `/pedagogical-directive` and must not treat deterministic fallback as proof of live provider success. If provider quota or credentials fail, record the exact provider/quota blocker and leave deterministic tests as correctness proof.

## Review Remediation Rules

When a review finding arrives:

1. Fetch all review threads.
2. Ignore outdated findings already fixed by later commits only after proving the later diff covers the issue.
3. Classify the finding under a Boundary Invariant.
4. Add the invariant if missing.
5. Sweep sibling paths:
   - standard mode
   - Socratic mode
   - skip mode
   - mobile bridge present
   - mobile bridge missing
   - desktop compatibility
   - no-browser-key mobile
   - provider success
   - provider empty response
   - provider error
   - unknown session retry
   - oversized payload
   - directive reference resolution
   - raw directive rejection
   - generated bundle
   - key-takeaway backlog classification
6. Add or strengthen a regression test.
7. Patch all affected siblings, not just the commented line.
8. Update this ExecPlan before returning.
9. Run targeted validation and any full validation required by risk.
10. Reply to review with commit hash, files changed, test evidence, and sibling sweep.
11. Do not resolve the thread until the pushed fix exists.

## Outcomes & Retrospective

To be filled after implementation.

Required final content:

- What changed.
- What behavior stayed the same.
- Which files own prompt, Core capability, BFF route, directive provenance, RN bridge, and WebView orchestration.
- Prompt SHA/length evidence.
- Parser/normalizer fallback parity evidence.
- Provider-envelope parity evidence.
- Mobile no-direct-provider evidence.
- Mobile no-browser-key full-turn evidence.
- Structured-payload rejection evidence.
- Directive-reference evidence.
- Raw mobile directive rejection evidence.
- Cap/rate-limit/timeout evidence.
- Generated bundle evidence.
- BFF-only dependency evidence.
- Live provider smoke result or blocker.
- Key-takeaway backlog classification.
- Known deferrals with user approval.

## Final Migration Evidence

Do not fill this until implementation is complete.

Backlog row:

Old entry point:

Core prompt file:

Core capability file:

BFF route:

Directive provenance owner:

Main-response directive consumption path:

RN bridge method:

WebView compatibility wrapper:

Desktop path:

Mobile path:

Prompt custody:

- prompt symbol -> old SHA/length -> new SHA/length -> test

Parser / normalizer custody:

- normalizer/fallback -> old fixture -> Core fixture -> test

Boundary invariants:

- mobile no direct provider:
- mobile no final prompt:
- mobile no raw directive main-stream injection:
- mobile directive reference resolution:
- mobile no browser API key dependency:
- paired history parity:
- bridge missing fail closed:
- BFF rejects old prompt string:
- BFF rejects arbitrary active flags:
- BFF caps prompt fields:
- provider envelope parity:
- provider failure fallback:
- rate limit parity:
- timeout layering:
- stale result behavior:
- skip behavior:
- standard/Socratic guidance behavior:
- reload behavior:
- generated bundle:
- BFF-only dependency:
- key-takeaway classification:

Boundary contract audit:

- WebView learner model -> active flags:
- WebView history -> paired turns:
- WebView context -> bridge payload:
- RN bridge -> BffClient:
- BffClient -> BFF:
- BFF -> Core:
- Core -> provider:
- provider -> Core normalizer:
- BFF directive store -> BFF main stream:
- Core/BFF/RN -> WebView:
- WebView guidance -> mainSenseiResponse:
- timeout/rate-limit/config parity:
- state-continuity paths:

Validation:

- core build:
- protocol build:
- focused root tests:
- BFF deterministic tests:
- BFF default tests:
- WebView bundle:
- mobile tests:
- analyzer:
- direct provider sweep:
- diff check:
- live provider smoke:

Known deferrals:

- item:
- reason:
- user approval:

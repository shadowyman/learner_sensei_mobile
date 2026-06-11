# Enhancement Core/BFF Mobile Migration ExecPlan

This ExecPlan is a living document. It must be updated before and after every meaningful discovery, design decision, code change, failed command, validation result, review finding, scope adjustment, stopping point, or handoff. A future agent must be able to resume from this file and the current working tree without chat history.

This plan is saved as:

    docs/execplans/enhancement_core_bff_migration_execplan.md

This plan is subordinate to `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`. If this ExecPlan conflicts with the master migration plan, the master plan wins and this ExecPlan must be revised before implementation continues. This plan must also follow `docs/protocols/PLAN.md`, `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`, `.codex/skills/llm-migration-compliance/SKILL.md`, `docs/templates/llm_migration_compliance_block.md`, and `docs/llm_entry_exit_traces.md`.

The peer run that created this initial draft used the Codex Thread Peer Execution Protocol at `docs/protocols/codex_thread_peer_execution_protocol.md`. Harry Potter (Agent A) and Hermione Granger (Agent B) are coordination handles only.

## Purpose / Big Picture

The goal is to migrate the standard Sensei message enhancement feature from a WebView-owned direct Gemini call into the Phase 1 Core/BFF/mobile bridge architecture while preserving existing Enhance button behavior.

Today, a user can tap or click an Enhance control on a Sensei message. The WebView gets the current message markdown, strips Mermaid blocks before asking the model for additions, calls a direct provider wrapper, receives a JSON payload of keyed insertions, applies those insertions to the original markdown, and re-renders the message. That user-visible behavior should remain unchanged: enhancement can be applied, removed, skipped for Mermaid-only content, and abandoned cleanly when the message content drifts.

After this migration, mobile must not obtain a browser `GoogleGenAI` client or use browser provider execution for this capability. Mobile will send structured enhancement context through WebView -> React Native -> BffClient -> BFF -> Core. Core will own the canonical prompt builder, request/result types, JSON fence handling, response parsing, normalization, and provider-agnostic execution through an injected `CoreLlmClient`. BFF will own server-side provider execution, validation, caps, rate limiting, timeout policy, telemetry/logging, and the mobile route. React Native will own transport only. WebView will keep UI state, duplicate-click prevention, Mermaid stripping, word counting, markdown application, render behavior, and per-message enhancement state.

The architectural result is that shipped mobile apps do not own prompt text or provider execution for the migrated enhancement capability. The observable result is that the Enhance button still behaves the same for users.

## Implementation Status

Status: NOT_STARTED.

No implementation code may be edited until the Scope Lock, Capability x Mode x Lifecycle Matrix, Direct Provider Authority Sweep, Prompt Custody Ledger, Parser / Normalizer Custody Ledger, Boundary Invariant Ledger, Trust-Boundary Schema Plan, Runtime Routing Plan, Red-Test Gate, Test Gate Ledger, and Boundary Contract Audit are filled with current-source evidence.

This initial draft is a planning artifact only. It does not authorize code changes, trace completion claims, master-plan completion claims, staging, committing, or pushing.

## LLM Migration Compliance Block

Allowed statuses: `NOT_STARTED`, `RED_TEST_ADDED`, `IMPLEMENTED`, `GREEN`, `DEFERRED_USER_APPROVED`, `BLOCKED`.

### Mode

- Mode: Full Migration Mode
- Backlog row: `Enhancement request` plus the paired `Sensei enhancement wrapper` row from `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`
- Status: PR_STAGE_DETERMINISTIC_EVIDENCE

### Scope Lock

| Field | Required Answer | Status |
|---|---|---|
| Backlog row | `Enhancement request` and `Sensei enhancement wrapper` | PR_STAGE_DETERMINISTIC_EVIDENCE |
| Current direct provider entry | Historical entry was `src/enhancementManager.ts:toggleEnhancement` calling `getAI()` and passing the client into `requestSenseiEnhancement`; deterministic evidence now proves mobile `toggleEnhancement` does not call `getAI()`, while desktop compatibility remains explicit. `src/geminiService.ts:requestSenseiEnhancement` now uses Core prompt/parser plus browser Core client task `sensei_enhancement`. | PR_STAGE_UPDATED |
| Prompt owner after migration | `core/prompts/enhancement.ts` | GREEN |
| Core capability after migration | `core/enhancement.ts` | GREEN |
| BFF owner | `POST /sessions/:sessionId/enhancement` through `bff/src/routes/enhancement.js`, `bff/src/controllers/enhancementController.js`, and `bff/src/services/enhancementService.js` | GREEN |
| RN bridge owner | `SenseiMobile/src/mobile/bridge/contracts.ts`, `SenseiMobile/src/mobile/network/BffClient.ts`, `SenseiMobile/src/mobile/network/types.ts`, and `SenseiMobile/src/mobile/MainScreen.tsx` carry `enhancement:request` / `enhancement:result` structured transport | GREEN |
| WebView owner | `src/enhancementManager.ts:toggleEnhancement`, `applyEnhancementSequence`, `applyEnhancements`, `removeEnhancements`, `stripMermaidBlocks`, `countWords`, loading/active state, per-message state, content-drift checks, and markdown render/application behavior remain WebView-owned | GREEN |
| Parser/normalizer owner | Core: JSON fence handling, JSON parse handling, `normalizeEnhancementEntries` behavior, `EnhancementPayload` result semantics | GREEN |
| Desktop compatibility path | Browser compatibility wrapper uses Core-owned prompt/parser logic and a browser Core client task `sensei_enhancement` | GREEN |
| Mobile path | Structured WebView -> RN -> BffClient -> BFF -> Core -> provider route | GREEN_DETERMINISTIC; live mobile runtime smoke deferred |
| Reload/retry path | Enhancement has toggle/apply/remove behavior and content-drift checks, not a known reload stream path. Duplicate/loading state remains WebView-owned; mobile route must not fall back to browser provider execution. | GREEN_FOR_COVERED_PATHS |
| Cache/placeholder path | Key-takeaway enhancer cache and placeholder behavior are out of scope. Enhancement per-message state remains WebView-owned. | OUT_OF_SCOPE |
| Explicitly out of scope | Key-takeaway enhancement, pedagogical directive generation, legacy generic BFF turn stream retirement, Selection Sensei, broad WebView business-logic migration, generic frontend LLM gateway, prompt-quality rewriting | OUT_OF_SCOPE |

### Capability x Mode x Lifecycle Matrix

| Capability | Mode | Invocation | Runtime | Required Behavior | Forbidden Behavior | Test | Status |
|---|---|---|---|---|---|---|---|
| Enhancement request | normal invocation | Enhance control calls `toggleEnhancement(messageId)` | desktop and mobile | Preserve existing apply behavior; mobile routes structured context to BFF/Core | mobile browser provider execution | manager/routing, RN, BFF, Core, and wrapper tests | GREEN_DETERMINISTIC |
| Enhancement request | remove invocation | current state is `applied`; `toggleEnhancement` calls `removeEnhancements` | desktop and mobile | Restore original markdown and state without provider call | provider call on removal | existing WebView behavior preserved; no source change to remove path | PRESERVED |
| Enhancement request | duplicate/in-flight request | current state is `loading` | desktop and mobile | Return early and avoid duplicate provider work | duplicate provider requests for same message | existing WebView loading guard preserved; no new provider route before guard | PRESERVED |
| Enhancement request | bridge present | WebView has mobile bridge route | mobile | WebView -> RN -> BffClient -> BFF -> Core -> provider | browser SDK or browser `CoreLlmClient` | manager/routing and BffClient/MainScreen tests | GREEN_DETERMINISTIC |
| Enhancement request | bridge missing | mobile build lacks required bridge | mobile | fail closed with structured enhancement failure and reset loading state | browser provider fallback | manager/routing tests | GREEN_DETERMINISTIC |
| Enhancement request | desktop web | browser app uses compatibility path | desktop | Core-owned prompt/parser with browser provider client | mobile route assumptions | focused `geminiService` tests | GREEN_DETERMINISTIC |
| Enhancement request | Mermaid-only source | `stripMermaidBlocks(originalMarkdown)` is empty | desktop and mobile | skip request, reset loading/active state | provider call with empty prompt source | existing WebView behavior preserved through manager integration | PRESERVED |
| Enhancement request | Mermaid/code source | prompt input uses stripped source; application targets original markdown | desktop and mobile | do not alter code or Mermaid blocks; apply only matched text additions | derive from or rewrite code/Mermaid blocks | TBD after fixture design | NOT_STARTED |
| Enhancement request | content drift | baseline markdown changes before apply/remove completes | desktop and mobile | abort apply/remove and reset state consistently | partial stale insertion | TBD after test inventory | NOT_STARTED |
| Sensei enhancement wrapper | provider success | provider returns JSON or fenced JSON | desktop and BFF/Core | Core parses and normalizes payload | parser duplicated in `src/` or BFF | TBD after parser parity fixture | NOT_STARTED |
| Sensei enhancement wrapper | provider failure | provider throws | desktop and mobile | normalized null/failure result that leaves UI state consistent | echo raw learner content or prompt | TBD after service test design | NOT_STARTED |
| Sensei enhancement wrapper | malformed provider output | invalid JSON or invalid entry shapes | desktop and mobile | Core rejects/normalizes without partial UI mutation | raw parse failure escaping Core | TBD after parser fixture | NOT_STARTED |
| Sensei enhancement wrapper | empty enhancements | payload contains no usable entries | desktop and mobile | reset loading/active state; no markdown mutation | partial apply | TBD after test inventory | NOT_STARTED |
| Sensei enhancement wrapper | malformed client payload | invalid structured request to BFF | mobile | BFF rejects before provider call | provider call | Add BFF validation red test following `bff/tests/selectionSenseiModal.validation.red.test.js` pattern | NOT_STARTED |
| Sensei enhancement wrapper | oversized prompt-rendered field | large `originalMarkdown` or aggregate payload | mobile | BFF rejects before prompt/provider | prompt construction/provider call | Add enhancement cap policy and BFF validation tests; exact constants do not exist yet | NOT_STARTED |
| Sensei enhancement wrapper | old prompt-string payload | client sends prompt/finalPrompt/promptText-like fields | mobile | BFF rejects | Core/provider accepts prompt string | Add BFF validation red test with `prompt`, `finalPrompt`, `promptText`, `instruction`, model/config/provider option payloads | NOT_STARTED |
| Sensei enhancement wrapper | arbitrary prompt-control field | client sends model/config/control override | mobile | BFF rejects or ignores according to validated schema | client controls model/config/prompt behavior | Add BFF validation red test with arbitrary prompt-control/provider fields | NOT_STARTED |
| Sensei enhancement wrapper | mobile direct-provider sentinel | mobile build path for enhancement | mobile | no `GoogleGenAI`, browser `CoreLlmClient`, or browser provider call | browser provider execution | TBD after sentinel test design | NOT_STARTED |

### Direct Provider Authority Sweep

Search command:

    rg "GoogleGenAI|new GoogleGenAI|Chat\\b|chats\\.create|sendMessageStream|sendMessage\\(|generateContent|generateContentStream|CoreLlmClient|GeminiGateway" src core bff SenseiMobile __tests__

When filling the sweep ledger, exclude generated output such as `SenseiMobile/app_web/webview_dist/**` from source-ownership conclusions, or classify those hits separately as generated-bundle evidence. Source ownership must be determined from `src/`, `core/`, `bff/`, `SenseiMobile/src/mobile/`, and tests.

| Hit | File | Classification | Action | Status |
|---|---|---|---|---|
| `GoogleGenAI` dependency and `getAI()` use in enhancement manager | `src/enhancementManager.ts` | verified must-fix for migrated mobile enhancement route; desktop compatibility may remain through a Core browser client path | Replace mobile path with structured route and fail closed when bridge is missing; preserve WebView state behavior | NOT_STARTED |
| `requestSenseiEnhancement` direct `ai.models.generateContent(...)` | `src/geminiService.ts` | verified must-fix for paired wrapper row | Move provider execution behind Core/BFF for mobile; make wrapper a desktop compatibility path around Core-owned logic | NOT_STARTED |
| Generated WebView bundle provider hits | `SenseiMobile/app_web/webview_dist/index.js`, `SenseiMobile/app_web/webview_dist/index.js.map` | generated-bundle evidence only, not source ownership | Use only to validate shipped bundle after source changes; do not infer source custody from generated hits | NOT_STARTED |
| Existing Core `CoreLlmClient` capability files | `core/mermaidErrorRecovery.ts`, `core/wrapUpAssessment.ts`, `core/teachingPlan.ts`, `core/learnerAnalysis.ts`, `core/selectionSensei.ts`, `core/browserLlmClient.ts` | expected Core capability or desktop compatibility infrastructure; not enhancement-owned | Use as naming/shape precedent for `core/enhancement.ts`; do not change for this row except where shared exports require new enhancement module | NOT_STARTED |
| BFF `GeminiGateway` provider execution | `bff/src/integration/geminiGateway.js`, `bff/src/container.js`, BFF tests | allowed server-side provider execution | Enhancement BFF service should call Core through `CoreLlmAdapter`/`GeminiGateway` pattern and keep provider SDK out of WebView/RN | NOT_STARTED |
| Sibling direct-provider backlog hits | `src/keyTakeawayEnhancerController.ts`, `src/pedagogicalProfiler.ts`, Selection Sensei legacy paths, generic main-stream paths | sibling backlog or already-scoped rows, not enhancement implementation scope | Keep out of this migration except as direct-provider sweep evidence; do not mark complete here | NOT_STARTED |
| Test-only provider hits | `__tests__/**/*.test.ts`, `bff/tests/**/*.test.js` | test fakes or existing sibling coverage | Reuse patterns for red tests; do not classify as source custody | NOT_STARTED |

### Prompt Custody Ledger

| Prompt Symbol / Builder | Old File | Old Runtime Length | Old SHA-256 | New File | New Runtime Length | New SHA-256 | Parity Test | Status |
|---|---|---:|---|---|---:|---|---|---|
| `buildSenseiEnhancementPrompt(originalMarkdown)` | `src/prompts.ts` | 2316 for first red-test fixture | `4cc63e3b241f0397f8d5e078bd973671150f6facd672d4f8882ac19b77c008e9` for first red-test fixture | `core/prompts/enhancement.ts` | 2316 for first parity fixture | `4cc63e3b241f0397f8d5e078bd973671150f6facd672d4f8882ac19b77c008e9` for first parity fixture | `__tests__/corePromptParity.test.ts` passed after Core build in slice 1 | CORE_GREEN |

### Parser / Normalizer Custody Ledger

| Parser / Normalizer | Old File | Core Destination | Input Fixture | Output Fixture | Parity Test | Status |
|---|---|---|---|---|---|---|
| JSON fence stripping used by enhancement response path | `src/geminiService.ts:stripJsonFence` | `core/enhancement.ts` internal helper | fenced JSON, unfenced JSON, non-fenced text | cleaned JSON text or normalized failure | `__tests__/enhancementCoreParser.test.ts` passed after Core build in slice 1 | CORE_GREEN |
| Enhancement response JSON parse behavior | `src/geminiService.ts:requestSenseiEnhancement` | `core/enhancement.ts:parseSenseiEnhancementResponse` | valid JSON, malformed JSON, empty response text | normalized payload or null/failure result | `__tests__/enhancementCoreParser.test.ts` passed after Core build in slice 1 | CORE_GREEN |
| Enhancement entry normalization | `src/geminiService.ts:normalizeEnhancementEntries` | `core/enhancement.ts` internal helper | valid entries, invalid entries, missing fields, metadata object | `EnhancementPayload` with only usable entries and metadata behavior preserved | `__tests__/enhancementCoreParser.test.ts` passed after Core build in slice 1 | CORE_GREEN |

### Boundary Invariant Ledger

| Invariant | Applies To | Forbidden Behavior | Positive Test | Negative Test | Status |
|---|---|---|---|---|---|
| Mobile migrated runtime does not call provider directly | Mobile enhancement route | `GoogleGenAI`, browser SDK, or browser `CoreLlmClient` from mobile route | TBD | TBD | NOT_STARTED |
| Mobile migrated runtime does not send final prompt strings | WebView/RN/BFF request | prompt/finalPrompt/promptText payload accepted | TBD | TBD | NOT_STARTED |
| Mobile structured request fails closed when bridge is unavailable | WebView enhancement route | browser provider fallback | TBD | TBD | NOT_STARTED |
| Core owns prompt construction | Enhancement prompt | prompt body remains in `src/` or BFF | TBD | TBD | NOT_STARTED |
| BFF owns provider execution | Mobile route | WebView provider execution | Existing pattern: `SelectionSenseiService` calls Core through `CoreLlmAdapter`, which delegates to BFF `GeminiGateway`; enhancement service should follow that server-owned provider pattern | test fails if WebView/RN directly passes a provider client or prompt to provider | NOT_STARTED |
| BFF rejects old prompt-string payloads | BFF validation | provider call with prompt string | Add strict Zod schema in enhancement controller and BFF red test following `selectionSenseiModal.validation.red.test.js` | test fails if `prompt`, `finalPrompt`, `promptText`, `instruction`, or raw provider history reaches Core/provider | NOT_STARTED |
| BFF rejects arbitrary prompt-control values | BFF validation | client model/config override | Add strict schema and negative BFF tests for model/config/temperature/providerOptions/promptControl | test fails if client controls model/config/prompt behavior | NOT_STARTED |
| BFF caps every prompt-rendered string | `originalMarkdown` and any structured text fields | provider call with oversized text | Add enhancement policy constants in Core/BFF cap policy or justify reuse; current cap policy has main/selection entries only | test fails if oversized `originalMarkdown` reaches Core/provider | NOT_STARTED |
| BFF caps arrays and aggregate structured payload size | BFF validation | oversized arrays or aggregate payload | Add aggregate cap validation if enhancement request gains arrays/metadata beyond `originalMarkdown`; current enhancement payload shape is not implemented | test fails if aggregate oversized request reaches Core/provider | NOT_STARTED |
| Parser behavior is Core-owned and parity-tested | JSON fence/parse/normalizer path | parser duplicated in WebView or BFF | TBD | TBD | NOT_STARTED |
| Desktop compatibility still works | Desktop web wrapper | desktop route broken by mobile migration | Existing `__tests__/prompts.test.ts` covers only prompt scaffold; add desktop compatibility coverage after Core wrapper exists | test fails if desktop Enhance cannot use Core-owned prompt/parser path | NOT_STARTED |
| UI/state mutation remains in WebView | `toggleEnhancement`, apply/remove behavior | BFF or Core mutates UI/render state | Add WebView-side tests for `toggleEnhancement`, `applyEnhancementSequence`, `applyEnhancements`, and `removeEnhancements` once exports/test seams are chosen | test fails if Core/BFF returns rendered markdown or mutates UI/render state | NOT_STARTED |
| Reload/retry paths use the migrated route | Duplicate/in-flight/toggle paths | retry falls back to browser provider on mobile | Add duplicate/in-flight test proving `loading` state returns early without provider work | test fails on duplicate provider call for same message | NOT_STARTED |
| Provider failure does not echo learner text | BFF/Core errors and logs | raw prompt, API key, or learner payload in response/logs | Follow existing controllers: log request ids/lengths/status but return generic structured error such as Selection Sensei's `Unable to generate Selection Sensei response` | test fails if raw prompt/provider payload appears in response | NOT_STARTED |
| Cache key and prompt-hash behavior is preserved | Not a cache-backed enhancement path in current source; per-message state remains WebView-owned | key-takeaway cache accidentally migrated here | TBD | TBD | NOT_STARTED |
| No generic frontend LLM gateway is introduced | WebView | `src/llmGateway.ts` generic abstraction as substitute for BFF route | TBD | TBD | NOT_STARTED |
| No prompt body is introduced in BFF | BFF route/service | prompt text in BFF | TBD | TBD | NOT_STARTED |
| No second prompt copy remains in `src/` after migration | `src/prompts.ts` | duplicate migrated prompt body | TBD | TBD | NOT_STARTED |
| Logs avoid secrets, full prompts, API keys, and raw learner payloads | WebView/BFF/Core logs | leaking raw prompt/provider payload | TBD | TBD | NOT_STARTED |
| Duplicate request cannot duplicate provider work | Loading/in-flight state and server idempotency if needed | duplicate provider call for same message | Current source returns early when `state.status === 'loading'`; add regression coverage before migration | test fails if second toggle during loading reaches provider/mobile route | NOT_STARTED |
| Client disconnect/abort stops provider work | BFF route, if applicable to non-stream request | provider work continues unnecessarily | Existing non-stream BffClient methods use `AbortController` with RN timeout constants; add enhancement RN timeout before mobile transport closes | TBD whether BFF abort signal is available in current Express path | NOT_STARTED |
| Terminal completion/error events are deterministic | Non-stream result path and bridge response | hanging loading state | Add request/result bridge pair like `selectionSensei:modalMessageRequest` / `selectionSensei:modalMessageResult` with success/failure response | test fails if loading hangs on bridge/provider failure | NOT_STARTED |
| Chunk order is preserved | Not applicable to this non-stream enhancement route unless implementation introduces streaming | streaming-specific assertion treated as required without design basis | N/A unless route streams | N/A unless route streams | NOT_STARTED |
| Timeout behavior matches provider/task duration | BFF route and client transport | unrelated shorter timeout aborts normal enhancement | Add enhancement timeout constants to `protocol/timeouts.ts` or justify reuse of an existing non-stream timeout; current protocol timeouts cover Mermaid, wrap-up, teaching-plan, analysis, and Selection Sensei only | test fails if bridge timeout is shorter than RN/provider budget | NOT_STARTED |
| Sanitized source and original application remain split | WebView apply path | Core/BFF applies insertions against sanitized source or mutates Mermaid/code blocks | Current source strips Mermaid before request but applies returned entries to original markdown; add fixture proving both behaviors | test fails if Mermaid/code block text is altered or used as derivation source | NOT_STARTED |
| Key matching remains WebView-owned | WebView apply path | Core/BFF rewrites message markdown or applies insertions directly | Current source applies normalized entries via `applyEnhancementSequence`; add WebView test before route change | test fails if Core/BFF returns rendered markdown instead of normalized entries | NOT_STARTED |
| Null/failure result clears loading state without partial apply | WebView response handling | provider failure, parse failure, or empty result leaves active/loading state stuck or applies partial markdown | Current source resets loading/active state on null payload, empty enhancements, no applied entries, render failure, and content drift; add regression coverage | test fails on stuck loading, active state, or mutated markdown after failure | NOT_STARTED |
| Generated bundle is validation evidence, not source custody | WebView bundle validation | generated bundle direct-provider hits are classified as source owners | source sweep excludes or separately classifies generated output | test/review fails if source ownership is inferred from `webview_dist` | NOT_STARTED |

### Trust-Boundary Schema Plan

| Field | Prompt Rendered? | Controls Prompt Behavior? | Type | Max Length | Enum/Union? | Required? | Sanitized? | Test | Status |
|---|---|---|---|---:|---|---|---|---|---|
| `originalMarkdown` or renamed structured source field | yes | indirectly, as content to enhance | string | TBD; no enhancement-specific cap exists yet in `core/llmCapPolicy.ts` or `bff/src/config/llmCapPolicy.js` | no | yes | BFF must validate length; WebView strips Mermaid before sending according to current behavior | BFF oversized-field validation red test | NOT_STARTED |
| `wordCount` | no, verified current source logs it but does not render it into the prompt | no based on current source evidence; keep as telemetry/context if retained | number | TBD | no | no, unless retained for telemetry/context | numeric validation if retained | TBD | NOT_STARTED |
| message/session identity fields | no | no | strings/ids | verified route convention carries `sessionId` in path; message identity is TBD based on WebView state needs | no | yes for mobile request context | route/session validation | unknown-session and malformed message-id tests if message id is included | NOT_STARTED |
| prompt/model/config overrides | n/a | forbidden | n/a | n/a | n/a | no | reject if present | TBD | NOT_STARTED |

### Runtime Routing Plan

| Runtime | Bridge Present? | Structured Request Present? | Expected Path | Forbidden Path | Test | Status |
|---|---|---|---|---|---|---|
| Desktop web | no | optional | desktop compatibility wrapper/Core browser client | mobile route assumptions | TBD | NOT_STARTED |
| Mobile WebView | yes | yes | WebView -> RN `WebToRNMessage` -> `BffClient` -> `POST /sessions/:sessionId/enhancement` candidate route -> BFF controller/service -> Core -> provider | browser provider SDK or browser `CoreLlmClient` | Bridge/BffClient/BFF tests after exact message names are added | NOT_STARTED |
| Mobile WebView | no | yes | fail closed with structured error and loading-state cleanup; `sendToNative` returns false when `ReactNativeWebView.postMessage` is unavailable | browser provider SDK or browser `CoreLlmClient` | WebView bridge-missing sentinel | NOT_STARTED |
| Mobile WebView | yes | old prompt-string payload | BFF strict schema rejects | Core/provider call | BFF validation red test | NOT_STARTED |
| Test/local | explicit fake | yes | deterministic fake provider/Core client | silent fallback unless test expects it | TBD | NOT_STARTED |

### Boundary Contract Audit

| Boundary | Source field/behavior | Destination field/behavior | Required transformation | Forbidden drift | Evidence/Test | Status |
|---|---|---|---|---|---|---|
| WebView UI/state -> React Native bridge | sanitized source, word count if retained, message/session context | structured enhancement request | no prompt string, no provider client | sending final prompt or raw provider config | TBD | NOT_STARTED |
| React Native bridge -> BffClient | bridge event payload | BffClient method payload | transport only | prompt construction in RN | Verified pattern: `MainScreen.tsx` handles `selectionSensei:modalMessageRequest` by calling `bffClient.runSelectionSenseiModalMessage` and enqueuing a result message; enhancement should add analogous request/result messages | NOT_STARTED |
| BffClient -> BFF route/controller | structured request | HTTP request | session creation/retry, JSON request, timeout, error mapping | browser/provider fallback | Verified pattern: `BffClient` posts to `/sessions/${sessionId}/selection-sensei/modal-message`, `/wrapup`, `/teaching-plan`, and `/analysis`; candidate enhancement route should follow `/sessions/${sessionId}/enhancement` unless peers revise with evidence | NOT_STARTED |
| BFF controller/service -> Core capability request | validated request | Core request type | strict schema, cap-checked prompt-rendered fields, rate limit if applicable | BFF prompt body | Verified pattern: `SelectionSenseiController` uses strict Zod schemas, cap validation, session lookup, rate limit, `toCoreRequest`, and service call | NOT_STARTED |
| Core capability -> prompt/provider request | Core request and prompt builder | provider request via injected `CoreLlmClient` | canonical prompt, model/task defaults not controlled by mobile | duplicate prompt in `src` or BFF | Core has capability modules for selection/teaching/analysis/wrap-up but no `core/enhancement.ts`; add exported enhancement module and package export | NOT_STARTED |
| provider response -> Core parser/normalizer | provider text | normalized enhancement payload or null/failure | JSON fence removal, parse, entry normalization | raw parse failure or partial unvalidated entries | Core parser fixture tests must cover fenced/unfenced/malformed/empty/invalid entries before route work | NOT_STARTED |
| Core/BFF response -> React Native/WebView UI state | normalized payload/failure | WebView apply/reset behavior | deterministic success/failure shape | hanging loading state or partial apply | Use request/result bridge pair with success boolean and generic error string, then WebView applies/resets state | NOT_STARTED |
| Timeout budget parity | provider task duration | BFF/client timeout | route-specific timeout | unrelated shorter timeout | Existing timeout pattern lives in `protocol/timeouts.ts` and `BffClient`; no enhancement timeout constants exist yet | NOT_STARTED |
| BFF route operational parity | service config/logging/rate limits | enhancement route behavior | server-owned provider execution | missing rate limit/config/logging/failure behavior | Existing BFF routes are mounted in `bff/src/server.js`; enhancement needs route/controller/service/container wiring and either new or justified reused rate limit/config | NOT_STARTED |
| State continuity paths | message state, original/enhanced markdown, content drift | apply/remove behavior | preserve WebView state machine | dropped original markdown or stale insertion | TBD | NOT_STARTED |

### Red-Test Gate

| Red Test | Expected Old Failure | Added? | Status |
|---|---|---|---|
| Prompt parity | prompt moves without proof of exact runtime text | yes, first batch | EXPECTED_RED_CONFIRMED: missing Core enhancement prompt export |
| Parser parity | parser moved/changed without fixture proof | yes, first batch | EXPECTED_RED_CONFIRMED: missing Core enhancement module |
| Mobile direct-provider negative test | mobile path can call browser provider | yes, first batch | EXPECTED_RED_CONFIRMED: missing candidate routing module |
| Mobile bridge-missing fail-closed test | mobile route falls back to browser provider or hangs | yes, first batch | EXPECTED_RED_CONFIRMED: missing candidate routing module |
| BFF rejects old prompt-string payload | BFF accepts final prompt text | yes, first batch | EXPECTED_RED_CONFIRMED: missing enhancement route returns 404 |
| BFF rejects arbitrary prompt-control field | BFF accepts model/config/prompt controls from mobile | yes, first batch | EXPECTED_RED_CONFIRMED: missing enhancement route returns 404 |
| BFF rejects oversized prompt-rendered fields | oversized input reaches prompt/provider | yes, first batch | EXPECTED_RED_CONFIRMED: missing enhancement route returns 404 |
| Duplicate/in-flight enhancement test | duplicate click can duplicate provider work | no | NOT_STARTED |
| Mermaid-stripped source/original application test | code/Mermaid blocks are altered or sent as derivation source | no | NOT_STARTED |
| Malformed provider output is normalized by Core | malformed JSON leaks raw parse failure or partially applies | no | NOT_STARTED |
| Desktop compatibility still works | desktop Enhance breaks after mobile migration | no | NOT_STARTED |
| Key matching stays WebView-owned | Core/BFF returns rendered markdown or applies insertions instead of normalized entries | no | NOT_STARTED |
| Failure path clears loading and avoids partial apply | provider failure, parse failure, empty enhancements, or invalid entries leaves stuck loading/active state or mutates markdown | no | NOT_STARTED |
| Generated bundle not used as source authority | provider sweep treats `SenseiMobile/app_web/webview_dist/**` as source ownership instead of generated evidence | no | NOT_STARTED |

### Test Gate Ledger

| Gate | Required Evidence | Status |
|---|---|---|
| Prompt parity | SHA/length test passes for representative enhancement prompt outputs; expected-red test added to `__tests__/corePromptParity.test.ts` | CORE_GREEN: `cd core && npm run build` passed; root Core prompt/parser Jest command passed |
| Parser parity | JSON fence/parse/normalizer fixture tests pass for fenced, unfenced, malformed, empty, and all-invalid provider outputs; expected-red test added to `__tests__/enhancementCoreParser.test.ts` | CORE_GREEN: `cd core && npm run build` passed; root Core prompt/parser Jest command passed |
| Mobile routing | WebView/RN/BffClient route test passes; existing route/sentinel examples include `__tests__/BffClient.test.ts`, `__tests__/learnerAnalysis.mobileRoutingGate.sentinel.test.ts`, and `__tests__/teachingPlan.mobileRoutingGate.sentinel.test.ts`; first expected-red WebView routing test is `__tests__/enhancementRouting.mobileRoutingGate.red.test.ts` | GREEN: WebView manager/routing Jest command passed; BffClient/MainScreen Jest command passed |
| No browser provider on mobile | fail-closed sentinel passes; first expected-red coverage asserts mobile uses bridge, bridge-missing fails closed, and local/browser provider callback is not called | GREEN: `__tests__/enhancementManager.mobileRouting.test.ts` proves mobile `toggleEnhancement` does not call `getAI()` and bridge failure clears loading/active state without rendering |
| RN bridge message/result contract | `__tests__/MainScreen.enhancementBridge.test.ts` proves `enhancement:request` dispatches through BffClient and `enhancement:result` returns normalized success or fixed safe failure without prompt/provider ownership in MainScreen | GREEN: root BffClient/MainScreen Jest command passed |
| BffClient enhancement transport | `__tests__/BffClient.test.ts` proves candidate `runSenseiEnhancement` posts structured payloads to `/sessions/:sessionId/enhancement`, rejects prompt-control fields through BFF error mapping, preserves unknown-session retry, and uses `ENHANCEMENT_RN_TIMEOUT_MS` | GREEN: root BffClient/MainScreen Jest command passed |
| BFF rejects prompt strings | deterministic negative test added in `bff/tests/enhancement.validation.red.test.js`; first run stops at route-missing 404 | GREEN: BFF enhancement validation script passed |
| BFF caps prompt fields | oversized-field test added in `bff/tests/enhancement.validation.red.test.js`; first run stops at route-missing 404 before cap validation exists | GREEN: BFF enhancement validation script passed |
| BFF validates control fields | arbitrary prompt-control rejection test added in `bff/tests/enhancement.validation.red.test.js`; first run stops at route-missing 404 | GREEN: BFF enhancement validation script passed |
| BFF enhancement service/controller | `bff/tests/enhancement.service.test.js` proves service/controller keep provider execution server-owned, call candidate task `sensei_enhancement`, return normalized entries/metadata, enforce rate limit, and emit generic provider failures without raw prompt/provider leakage | GREEN: BFF enhancement service/model routing script passed |
| Desktop compatibility | wrapper tests pass | GREEN: focused `__tests__/geminiService.test.ts` coverage passed and proves the desktop wrapper uses Core prompt/parser plus browser Core client task `sensei_enhancement` |
| Duplicate/in-flight path | no current dedicated test found; add duplicate click/in-flight regression before route work | NOT_STARTED |
| Mermaid/source application path | no current dedicated test found; add Mermaid-stripped-source/original-application regression before route work | NOT_STARTED |
| Provider failure | non-echo normalized failure test passes | GREEN: desktop wrapper provider failure returns `null`; BFF service/controller tests verify generic provider failures without raw prompt/provider leakage |
| Deterministic BFF integration | route/service test passes | GREEN: BFF enhancement service/model routing script and BFF validation script passed |
| Live provider smoke | passes or provider/quota blocker recorded; not a deterministic correctness substitute | DEFERRED: not run in this docs/status step; trace/master wording is PR-stage deterministic evidence only |
| WebView bundle | `npm run webview:bundle` passes if `src/` changed | GREEN: `npm run webview:bundle` passed after WebView `src/` edits; generated trailing-whitespace caveat remains generated output, not source blocker |
| Analyzer | scoped analyzer completed if risk/trace evidence is needed | NOT_STARTED |
| Diff hygiene | `git diff --check` passes | GREEN_FOR_SOURCE_TEST_DOCS: touched source/test/doc hygiene passed; generated bundle whitespace caveat accepted as generated output |
| Trace update | `docs/llm_entry_exit_traces.md` updated only with evidence or PR-stage label | PR_STAGE_UPDATED: trace doc updated with deterministic migration evidence and runtime smoke deferred; no runtime-complete wording |
| Master status | updated only after review/merge evidence or marked PR-stage; never during draft-only planning | PR_STAGE_UPDATED: master plan rows updated with PR-stage deterministic evidence and runtime smoke pending; no runtime-complete wording |

### Review Remediation Ledger

| Review Finding | Invariant | Sibling Sweep | Regression Test | Fix Commit | Reply/Resolve Status |
|---|---|---|---|---|---|
| PR #4 inline: add enhancement BFF tests to runner | BFF enhancement service/validation tests must be reachable through the package test command, not only ad hoc focused commands | Checked `bff/package.json` runner and root Jest ignore behavior | Focused enhancement scripts passed; `cd bff && npm test` now includes enhancement tests but local run still stops earlier at existing `mermaidRecover.int.test.js` live/LLM assertion | Pending remediation commit | Pending pushed reply/resolve |
| PR #4 inline: remove `messageId` from base validation payload | BFF enhancement request payload is strictly `{ originalMarkdown, wordCount? }`; transport/UI correlation must not enter BFF payload | Checked BFF validation fixture and WebView/RN payload contract | `cd bff && node tests/enhancement.validation.red.test.js` exited `0` | Pending remediation commit | Pending pushed reply/resolve |
| PR #4 inline: preserve migrated enhancement temperature | Core/BFF/browser task config must preserve legacy enhancement desktop temperature unless intentionally revised | Checked `src/model_usage.ts`, Core model config, BFF fallback config, and desktop wrapper test | Focused wrapper/prompt/parser Jest exited `0` and asserts `temperature: 0.3` | Pending remediation commit | Pending pushed reply/resolve |
| PR #4 inline: regenerate manifests for new enhancement sources | Analyzer/backup manifests must include newly added BFF enhancement files | Checked source and backup manifest generation scripts | `npm run manifest:sync` wrote 167 source entries; backup manifest sync wrote 623 backup entries and includes BFF enhancement files/tests | Pending remediation commit | Pending pushed reply/resolve |
| PR #4 inline: cap enhancement provider output | Provider-rendered enhancement entries must have per-field, array-count, metadata, and aggregate output caps before BFF/desktop return | Checked Core parser, BFF service, desktop wrapper path, and generated bundle classification | Focused parser Jest and BFF service script exited `0`; targeted enhancement sweep classified expected Core/BFF/provider hits only | Pending remediation commit | Pending pushed reply/resolve |
| PR #4 inline: add prompt-pack skill frontmatter | Repo-local skills must be discoverable through YAML frontmatter | Checked `.codex/skills/thread-peer-prompt-pack/SKILL.md` | Source inspection and `git diff --check` exited `0` | Pending remediation commit | Pending pushed reply/resolve |

### Final Migration Evidence

Backlog row: `Enhancement request` plus `Sensei enhancement wrapper`.

Old entry point: `src/enhancementManager.ts:toggleEnhancement` -> `src/geminiService.ts:requestSenseiEnhancement`.

Core prompt file: `core/prompts/enhancement.ts`.

Core capability file: `core/enhancement.ts`.

BFF route: Candidate from protocol shape and current session-scoped BFF route conventions: `POST /sessions/:sessionId/enhancement`. No current enhancement route/controller/service file exists yet.

RN bridge method: TBD during red-test/code slice. Current verified bridge contracts live in `SenseiMobile/src/mobile/bridge/contracts.ts` and are re-exported by `src/mobile/bridge/contracts.ts`; no current enhancement request/result message exists yet.

RN BffClient method: TBD during red-test/code slice. Current verified transport methods live in `SenseiMobile/src/mobile/network/BffClient.ts` and `SenseiMobile/src/mobile/network/types.ts`; no current enhancement method exists yet.

WebView compatibility wrapper: TBD during Core wrapper implementation. It must use Core-owned prompt/parser logic and must not keep duplicate prompt/parser bodies in `src/`.

Desktop path: Core-owned prompt/parser with browser provider client compatibility.

Mobile path: WebView -> RN -> BffClient -> BFF -> Core -> provider, with fail-closed bridge-missing behavior.

Prompt custody:

- `buildSenseiEnhancementPrompt` -> old SHA/length TBD -> new SHA/length TBD -> parity test TBD.

Parser custody:

- JSON fence stripping, JSON parse, entry normalization -> old fixtures TBD -> Core fixtures TBD -> tests TBD.

Boundary invariants:

- mobile no direct provider: NOT_STARTED
- mobile no final prompt: NOT_STARTED
- bridge missing fail closed: NOT_STARTED
- BFF rejects old prompt string: NOT_STARTED
- BFF caps prompt fields: NOT_STARTED
- provider failure behavior: NOT_STARTED
- duplicate/in-flight behavior: NOT_STARTED
- Mermaid/code preservation behavior: NOT_STARTED

Boundary contract audit:

- WebView -> RN: NOT_STARTED
- RN -> BffClient: NOT_STARTED
- BffClient -> BFF: NOT_STARTED
- BFF -> Core: NOT_STARTED
- Core -> provider: NOT_STARTED
- provider -> Core parser: NOT_STARTED
- Core/BFF -> UI: NOT_STARTED
- timeout/rate-limit/config parity: NOT_STARTED
- state-continuity paths: NOT_STARTED

Validation:

- No validation has been run for implementation because no implementation exists. This initial ExecPlan draft is ready for peer document review, not for code execution.

## Progress

- [x] (2026-06-11) Harry Potter (Agent A) and Hermione Granger (Agent B) completed independent-first Step 1 framing with corrective gate/gap closure. Scope was converged to `Enhancement request` plus `Sensei enhancement wrapper`; WebView orchestration stays in WebView; prompt/provider/parser/normalizer custody moves behind Core/BFF.
- [x] (2026-06-11) Harry Potter and Hermione Granger completed Step 2 artifact architecture convergence. The agreed order places the LLM Migration Compliance Block near the top, followed by concise living sections, with no duplicate standalone Scope Lock table.
- [x] (2026-06-11) Harry Potter created this initial ExecPlan draft as first editor after Step 2 closure. No implementation code was changed.
- [x] (2026-06-11) Hermione Granger (Agent B) provided substantive Step 3 coauthoring content: milestone-order replacement text, generated-bundle sweep addendum, boundary invariant additions, red-test additions, and validation acceptance additions. Step 3 remains active until these corrections are applied or explicitly rejected with rationale and both peers run the gate/gap closure pass.
- [x] (2026-06-11) Hermione Granger (Agent B) reviewed the updated Step 3 artifact directly after Harry applied the coauthoring content. The applied artifact now contains the BFF/RN-before-Mobile-Routing milestone order, generated-bundle source-custody guardrail, added invariant rows, added red-test rows, validation acceptance additions, and the provisional-scaffold decision. Step 3 remains active until Harry triad-checks this Hermione-owned artifact update and both peers record the final Step 3 closure decision.
- [x] (2026-06-11) Harry Potter (Agent A) triad-checked Hermione Granger's direct artifact update, accepted the non-hierarchical coauthoring correction, found no remaining Step 3 artifact blocker, and closed `Initial ExecPlan draft creation` for final convergence/handoff.
- [x] (2026-06-11 19:30Z) Harry Potter (Agent A) and Hermione Granger (Agent B) closed the implementation kickoff step. Branch `codex/enhancement-core-bff-execplan`, HEAD `9e6c27ef98c20d0eb3eecf264ac2ba02a770c535`, and `git status --short` was clean on both sides. This authorizes only evidence refresh and ExecPlan compliance-ledger updates, not source/test/config code edits.
- [ ] (2026-06-11 19:30Z) Evidence refresh and compliance-ledger fill before code edits is active. Harry Potter (Agent A) completed the first WebView-side evidence pass and patched this ExecPlan with current source anchors. Hermione Granger (Agent B) reviewed that patch, added Core/BFF/RN/provider evidence directly to this ExecPlan, and left the step active pending Harry Potter's document diff review and shared gate/gap closure.
- [ ] (2026-06-11 19:45Z) Harry Potter (Agent A) reviewed Hermione Granger's Core/BFF/RN/provider evidence patch, verified its main claims against current BFF, Core, RN, and test anchors, and completed the sibling ExecPlan required-read check. Harry Potter accepted Hermione's patch with no document correction beyond this review/read-record update. The evidence-refresh step remains active until Hermione Granger reviews this Harry-owned update and both peers close the gate/gap pass.
- [x] (2026-06-11) Hermione Granger (Agent B) reviewed Harry Potter's evidence-refresh review/read-record update, accepted the targeted sibling ExecPlan read decision, found no remaining evidence-refresh blocker, and closed `Evidence refresh and compliance-ledger fill before code edits` from Agent B's side. This closure authorizes only the candidate next shared step handshake for red/golden test-slice design; it does not authorize source/test/config edits by itself.
- [x] (2026-06-11) Harry Potter (Agent A) and Hermione Granger (Agent B) closed `First red/golden test slice design before implementation code edits`. The agreed first patch batch is `__tests__/corePromptParity.test.ts`, `__tests__/enhancementCoreParser.test.ts`, `bff/tests/enhancement.validation.red.test.js`, and `__tests__/enhancementRouting.mobileRoutingGate.red.test.ts`; BffClient, MainScreen bridge, and BFF service tests are deferred to the second batch.
- [ ] (2026-06-11) `Patch first red/golden test slice and record expected-red results` is active. Harry Potter (Agent A) added the WebView routing expected-red test `__tests__/enhancementRouting.mobileRoutingGate.red.test.ts` for candidate `src/enhancementRouting.ts`. The expected first failure is missing module/export until the routing seam exists; syntax or unrelated harness failures are wrong-red blockers.
- [ ] (2026-06-11) Harry Potter (Agent A) ran the Harry-owned focused routing red test. Command: `npm test -- --runTestsByPath __tests__/enhancementRouting.mobileRoutingGate.red.test.ts --silent --bail --noStackTrace`. Exit: `1`. Classification: expected red; all three tests fail because `../src/enhancementRouting` does not exist yet. A first wrapper attempt used `status=$?`, which is read-only in zsh and was rerun with `cmd_status=$?`; that wrapper error is not a test result.
- [ ] (2026-06-11) Hermione Granger (Agent B) added first-batch Core/BFF expected-red tests: enhancement prompt parity in `__tests__/corePromptParity.test.ts`, Core parser/normalizer custody in `__tests__/enhancementCoreParser.test.ts`, and BFF strict validation in `bff/tests/enhancement.validation.red.test.js`. No production source/config files were changed.
- [ ] (2026-06-11) Hermione Granger (Agent B) ran expected-red validation. Combined root command with `--bail` exited `1` and stopped at Harry's expected missing `../src/enhancementRouting` seam. Core parser command exited `1` with expected missing `@sensei/core/enhancement`. Prompt parity command exited `1` with expected missing `@sensei/core/prompts/enhancement` after confirming old WebView prompt fixture length `2316` and SHA `4cc63e3b241f0397f8d5e078bd973671150f6facd672d4f8882ac19b77c008e9`. BFF validation command exited `1` with expected route-missing 404 for `POST /sessions/:sessionId/enhancement`.
- [ ] (2026-06-11) Harry Potter (Agent A) reviewed Hermione Granger's first-batch Core/BFF test/doc diff and accepted it. Focused reruns confirmed the prompt parity test exits `1` on missing `@sensei/core/prompts/enhancement`, the Core parser test exits `1` on missing `@sensei/core/enhancement`, and the BFF validation script exits `1` on route-missing 404 for `POST /sessions/:sessionId/enhancement`. Classification: expected red for first pre-implementation run. Architectural Distance Pass: test/doc-only changes define intended Core/BFF/WebView boundary contracts and do not change production behavior; placement matches agreed custody boundaries; propagation impact is future implementation guidance only until production code changes land.
- [ ] (2026-06-11) Hermione Granger (Agent B) reviewed Harry Potter's reciprocal first-batch test/doc review and accepts the expected-red classifications and Architectural Distance Pass. Closure remains blocked by a process correction: `AGENTS.md` requires `npm run backup:create -- --feature "<feature_slug>" --context "<custom context>"` before modifying non-doc production/test/config code during major implementation work, and the first-batch test edits were made after the peer step had incorrectly classified backup as not applicable for test/doc-only changes. Before any further source/test/config edit, the peers must either run and record the backup checkpoint as remediation or obtain an explicit user override.
- [ ] (2026-06-11) Harry Potter (Agent A) remediated the missed backup gate before any further source/test/config edit. Command: `npm run backup:create -- --feature "enhancement_core_bff_migration" --context "First expected-red Enhancement Core/BFF migration tests have been added; next work will implement Core prompt/parser custody and related migration boundaries."` Exit: `0`. Backup artifact: `backup/sensei_backup_enhancement_core_bff_migration_20260611_230727.zip`. Dirty-state impact: `src/file-manifest.json` and `src/backup-file-manifest.json` were regenerated by the backup script in addition to the agreed first-batch test/doc files. This remediates the `AGENTS.md` backup precondition for subsequent implementation/test edits in this migration run unless the user directs otherwise.
- [x] (2026-06-11) Hermione Granger (Agent B) triad-checked and accepted Harry Potter's backup-gate remediation. The backup artifact exists, the manifest side effects are expected for the backup script, and no additional production source/config feature files were changed. `Patch first red/golden test slice and record expected-red results` is closed from Agent B's side with first-batch expected-red tests, peer diff review, Architectural Distance Pass, and backup remediation recorded.
- [x] (2026-06-11) Harry Potter (Agent A) triad-checked Hermione Granger's backup-remediation closure packet against the current ExecPlan, backup artifact, manifest side effects, and dirty worktree. Result: accepted with no further correction. `Patch first red/golden test slice and record expected-red results` is closed from both peer sides. The next authorized peer step is the design-only handshake `Implementation slice 1 design: Core prompt/parser custody`; no production source/config edits are authorized by this closure entry.
- [x] (2026-06-11) Harry Potter (Agent A) and Hermione Granger (Agent B) completed the design-only handshake for `Implementation slice 1 design: Core prompt/parser custody`. Accepted Core API/export design: add `core/prompts/enhancement.ts` exporting `buildSenseiEnhancementPrompt(originalMarkdown: string)`, add `core/enhancement.ts` exporting enhancement entry/payload types and `parseSenseiEnhancementResponse(text)`, wire `core/prompts/index.ts`, `core/index.ts`, and `core/package.json` exports, keep parser helpers internal, preserve only non-null non-array object metadata, use strict `JSON.parse`, defer provider execution/BFF/RN/WebView routing, run `cd core && npm run build` before root Jest because package exports resolve through generated `core/dist`, and do not hand-edit `core/dist`.
- [x] (2026-06-11) Hermione Granger (Agent B) triad-checked and accepted Harry Potter's design convergence record, then applied one bounded Plan-of-Work correction so Milestone 3 matches the converged Core-only slice: Core prompt/parser custody, Core source/package exports, Core build, and Core prompt/parser tests only; provider execution, desktop compatibility wrappers, BFF/RN/WebView routing, and duplicate WebView prompt/parser cleanup remain deferred. `Implementation slice 1 design: Core prompt/parser custody` is closed from Agent B's side.
- [x] (2026-06-11) Harry Potter (Agent A) triad-checked Hermione Granger's design-step closure and bounded Milestone 3 correction. Result: accepted. `Implementation slice 1 design: Core prompt/parser custody` is closed from both peer sides, and the next shared step `Implement Core prompt/parser custody and turn Core red tests green` is authorized with the agreed Core-only file-change boundary.
- [ ] (2026-06-11) `Implement Core prompt/parser custody and turn Core red tests green` is active. Harry Potter (Agent A) patched the prompt half of the Core-only slice: added `core/prompts/enhancement.ts` with the verbatim current `buildSenseiEnhancementPrompt(originalMarkdown: string)` body and exported it from `core/prompts/index.ts`. Validation is deferred until Hermione Granger (Agent B) patches the parser/package-export half and the Core build can generate the package export targets.
- [ ] (2026-06-11) Hermione Granger (Agent B) reviewed Harry Potter's prompt half and accepted it, then patched the parser/package-export half: added `core/enhancement.ts`, exported it from `core/index.ts`, and added `./enhancement` plus `./prompts/enhancement` package exports in `core/package.json`. Validation run: `cd core && npm run build` exited `0`; `npm test -- --runTestsByPath __tests__/corePromptParity.test.ts __tests__/enhancementCoreParser.test.ts --silent --bail --noStackTrace` exited `0` with 2 suites and 19 tests passing; deferred WebView routing command still exits `1` on missing `../src/enhancementRouting`; deferred BFF validation still exits `1` on route-missing 404 for `POST /sessions/:sessionId/enhancement`. `core/dist/enhancement.*` and `core/dist/prompts/enhancement.*` were generated by the Core build and are not tracked by git.
- [x] (2026-06-11) Harry Potter (Agent A) reviewed Hermione Granger's parser/package-export contribution and accepted it. Harry reran `cd core && npm run build` with exit `0`, reran `npm test -- --runTestsByPath __tests__/corePromptParity.test.ts __tests__/enhancementCoreParser.test.ts --silent --bail --noStackTrace` with exit `0` and 2 suites / 19 tests passing, confirmed the WebView routing red gate still exits `1` on missing `../src/enhancementRouting`, and confirmed the BFF validation red gate still exits `1` on route-missing 404. Architectural Distance Pass accepted: system-affecting by authority boundary; prompt custody is now in `core/prompts/enhancement.ts`, parser custody is now in `core/enhancement.ts`, package exports are wired through generated `core/dist`, Core parity tests are green, and WebView/BFF/RN/provider-routing gates remain intentionally deferred. Current blocker before shared-step closure: Hermione Granger must triad-check this Agent A review/closure record and either accept or revise final closure.
- [x] (2026-06-11) Hermione Granger (Agent B) triad-checked Harry Potter's review/validation record and accepts closure of `Implement Core prompt/parser custody and turn Core red tests green`. Core prompt/parser custody is green after Core build and package-import Jest; generated `core/dist/**` remains ignored output; WebView routing and BFF validation gates remain expected-red on their deferred missing seams. This shared step is closed from Agent B's side.
- [x] (2026-06-11) Harry Potter (Agent A) triad-checked Hermione Granger's Core implementation closure confirmation against the visible completed peer turn, current dirty state, and this ExecPlan. Result: accepted. `Implement Core prompt/parser custody and turn Core red tests green` is closed from both peer sides. No BFF/RN/WebView/provider-routing implementation is authorized by this closure record; the accepted next shared step is design-only `Second red/golden transport/service test design`.
- [x] (2026-06-11) Harry Potter (Agent A) and Hermione Granger (Agent B) completed the design-only `Second red/golden transport/service test design` step from Agent A's side, pending Agent B closure confirmation. Accepted second-batch test scope: extend `__tests__/BffClient.test.ts`, add `__tests__/MainScreen.enhancementBridge.test.ts`, add `bff/tests/enhancement.service.test.js`, and update this ExecPlan during the test edit step. Candidate names remain `runSenseiEnhancement`, `enhancement:request`, `enhancement:result`, `/sessions/:sessionId/enhancement`, `ENHANCEMENT_RN_TIMEOUT_MS`, and service task label `sensei_enhancement`; `ENHANCEMENT_BRIDGE_TIMEOUT_MS` is deferred to the WebView routing/bridge-timeout slice. Request payload is `originalMarkdown` plus optional telemetry `wordCount`; no `messageId` in BFF payload for this batch. Success returns normalized enhancement entries/metadata only; failure uses fixed safe strings and generic structured BFF errors. The next step is test-only unless both peers revise the scope.
- [x] (2026-06-11) Hermione Granger (Agent B) triad-checked Harry Potter's design convergence record and accepts closure of `Second red/golden transport/service test design`. The next shared step is authorized as test-only: patch `__tests__/BffClient.test.ts`, add `__tests__/MainScreen.enhancementBridge.test.ts`, add `bff/tests/enhancement.service.test.js`, and update this ExecPlan. No production source/config implementation, BFF route/service source, RN bridge/BffClient implementation, WebView routing helper, timeout constants, or first-batch tests are authorized unless the next step is explicitly revised.
- [ ] (2026-06-11) `Patch second-batch red/golden transport/service tests and record expected-red results` is active. Harry Potter (Agent A) triad-checked Hermione Granger's design-step closure confirmation, accepted the closed design state, and patched the Harry-owned RN/MainScreen bridge expected-red test `__tests__/MainScreen.enhancementBridge.test.ts`. The test records candidate bridge contracts for `enhancement:request` / `enhancement:result`, candidate `runSenseiEnhancement` dispatch, normalized result-only success, fixed safe failure string `Sensei enhancement unavailable`, and no prompt/provider ownership in MainScreen. This step remains active pending validation, Hermione's BffClient/BFF service test contribution, reciprocal diff review, Architectural Distance Pass, and shared gap closure.
- [ ] (2026-06-11) Harry Potter (Agent A) ran the focused MainScreen Enhancement bridge red test. Command: `npm test -- --runTestsByPath __tests__/MainScreen.enhancementBridge.test.ts --silent --bail --noStackTrace`. Exit: `1`. Classification: expected red; the contract test fails on missing `SenseiEnhancementRequestPayload` / `SenseiEnhancementResult` bridge-owned types, and the MainScreen tests fail on missing `enhancement:request` branch. Hygiene: `git diff --check -- docs/execplans/enhancement_core_bff_migration_execplan.md` exited `0`; `git diff --no-index --check /dev/null __tests__/MainScreen.enhancementBridge.test.ts` emitted no whitespace errors, with exit `1` expected for a new untracked file compared to `/dev/null`.
- [ ] (2026-06-11) Hermione Granger (Agent B) reviewed Harry Potter's MainScreen bridge expected-red test and accepts it as source-inspection coverage for the candidate RN bridge contracts and MainScreen branch. Hermione patched her owned second-batch tests: extended `__tests__/BffClient.test.ts` with candidate `runSenseiEnhancement` route, prompt-control rejection, unknown-session retry, and `ENHANCEMENT_RN_TIMEOUT_MS` timeout assertions; added `bff/tests/enhancement.service.test.js` for candidate Enhancement service/controller/GeminiGateway task behavior, normalized result/failure shape, prompt-control exclusion, rate-limit enforcement, and generic provider errors. No production source/config implementation files were edited.
- [ ] (2026-06-11) Hermione Granger (Agent B) ran focused second-batch expected-red validation. Combined root command `npm test -- --runTestsByPath __tests__/BffClient.test.ts __tests__/MainScreen.enhancementBridge.test.ts --silent --bail --noStackTrace` exited `1` and stopped at Harry's already-expected MainScreen bridge red gate. Focused BffClient command `npm test -- --runTestsByPath __tests__/BffClient.test.ts --silent --bail --noStackTrace` exited `1`; classification: expected red because `client.runSenseiEnhancement` is not implemented yet. BFF service command `cd bff && node tests/enhancement.service.test.js` exited `1`; classification: expected red because `../src/services/enhancementService` does not exist yet. Hygiene remains pending final shared diff checks after Harry reviews Hermione's patch.
- [ ] (2026-06-11) Harry Potter (Agent A) reviewed Hermione Granger's second-batch BffClient/BFF service test and ExecPlan diff. Result: accepted. Focused reruns confirmed `__tests__/BffClient.test.ts` exits `1` with 9 existing tests passing and the four new enhancement tests failing on missing `client.runSenseiEnhancement`; `bff/tests/enhancement.service.test.js` exits `1` on missing candidate module `../src/services/enhancementService`; combined root second-batch command exits `1` on the already-expected MainScreen bridge red gate before BffClient classification. Architectural Distance Pass: test/doc-only changes, system-affecting by transport/service contract intent, no production behavior changed, placement follows local BffClient/MainScreen/BFF service precedents, and failures are expected-red on agreed missing seams rather than wrong-red blockers. Current closure blocker: Hermione must triad-check this Agent A reciprocal review and closure proposal.
- [x] (2026-06-11) Hermione Granger (Agent B) triad-checked Harry Potter's reciprocal second-batch review and accepts closure of `Patch second-batch red/golden transport/service tests and record expected-red results`. The three agreed second-batch test surfaces are present, expected-red classifications are confirmed, peer diff review and Architectural Distance Pass are recorded, and no production source/config implementation files were edited. The next shared step is design-only `Implementation slice 2 design: BFF enhancement route/service and RN transport`; it does not authorize implementation edits by itself.
- [x] (2026-06-11) Harry Potter (Agent A) and Hermione Granger (Agent B) completed design convergence for `Implementation slice 2 design: BFF enhancement route/service and RN transport` from Agent A's side, pending Agent B closure confirmation. Accepted next implementation slice shape: BFF+RN transport foundation, not WebView routing. Required green targets for the next implementation slice are `__tests__/BffClient.test.ts` plus `__tests__/MainScreen.enhancementBridge.test.ts`, `bff/tests/enhancement.service.test.js`, and `bff/tests/enhancement.validation.red.test.js`. The WebView routing gate `__tests__/enhancementRouting.mobileRoutingGate.red.test.ts` must remain expected-red until the later WebView routing helper slice. Accepted design decisions: add dedicated enhancement caps, explicit `enhancementRateLimit` wiring, `sensei_enhancement` model config/task routing, `ENHANCEMENT_RN_TIMEOUT_MS`, bridge-owned `enhancement:request` / `enhancement:result` contracts, and service-owned use of Core prompt/parser plus injected provider adapter. No implementation edits are authorized until the next shared step is explicitly opened.
- [x] (2026-06-11) Hermione Granger (Agent B) triad-checked Harry Potter's design-convergence entry and accepts closure of `Implementation slice 2 design: BFF enhancement route/service and RN transport`. The next shared step may open as implementation, with file changes limited to the agreed BFF/RN/Core config surfaces and this ExecPlan; WebView routing helper, `toggleEnhancement`, browser wrapper cleanup, WebView bundle output, and trace/master completion updates remain out of scope.
- [ ] (2026-06-11) `Implement BFF/RN enhancement transport foundation and turn BFF/RN transport/service tests green` is active. Harry Potter (Agent A) patched the RN/protocol transport half: added `ENHANCEMENT_RN_TIMEOUT_MS`, bridge-owned `SenseiEnhancementRequestPayload` / `SenseiEnhancementResult` contracts, `enhancement:request` / `enhancement:result` message variants, `BffClientLike.runSenseiEnhancement`, `BffClient.runSenseiEnhancement` with session route `/sessions/:sessionId/enhancement`, unknown-session retry, abort timeout, safe HTTP error prefix, and MainScreen `enhancement:request` handling with fixed safe failure string. No WebView `src` routing/helper files, BFF source files, Core config files, or tests were edited by Harry in this contribution. This step remains active pending validation, Hermione's BFF/Core config implementation contribution, reciprocal diff review, Architectural Distance Pass, and shared closure.
- [ ] (2026-06-11) Hermione Granger (Agent B) reviewed Harry Potter's RN/protocol transport half and accepts it as scoped to transport-only ownership: RN carries structured enhancement payloads and normalized results, adds `ENHANCEMENT_RN_TIMEOUT_MS`, and returns a fixed safe failure string without prompt construction, provider execution, parser ownership, WebView state mutation, or browser-provider fallback. Hermione patched the BFF/Core config half: added enhancement Core model/cap constants, BFF enhancement model config and `sensei_enhancement` GeminiGateway routing, dedicated enhancement cap policy and `validateEnhancementCaps`, explicit `enhancementRateLimit`, BFF route/controller/service, container/server wiring, and safe service/controller result/failure handling. No WebView `src` files, WebView bundle output, trace/master completion files, or first-batch tests were edited by Hermione.
- [ ] (2026-06-11) Hermione Granger (Agent B) ran the agreed BFF/RN foundation validations. `cd core && npm run build` exited `0`. `npm test -- --runTestsByPath __tests__/BffClient.test.ts __tests__/MainScreen.enhancementBridge.test.ts --silent --bail --noStackTrace` exited `0` with 2 suites and 16 tests passing. `cd bff && node tests/enhancement.service.test.js` exited `0`. `cd bff && node tests/enhancement.validation.red.test.js` exited `0`. `npm test -- --runTestsByPath __tests__/corePromptParity.test.ts __tests__/enhancementCoreParser.test.ts --silent --bail --noStackTrace` exited `0` with 2 suites and 19 tests passing. Deferred WebView routing command `npm test -- --runTestsByPath __tests__/enhancementRouting.mobileRoutingGate.red.test.ts --silent --bail --noStackTrace` exited `1`; classification remains expected-red because `../src/enhancementRouting` is intentionally missing until the later WebView routing helper slice. Diff hygiene passed for touched tracked files and no-index checks for new BFF source files emitted no whitespace errors.
- [ ] (2026-06-11) Harry Potter (Agent A) ran validation for the RN/protocol transport half. `npm test -- --runTestsByPath __tests__/BffClient.test.ts __tests__/MainScreen.enhancementBridge.test.ts --silent --bail --noStackTrace` exited `0` with 2 suites and 16 tests passing. `npm test -- --runTestsByPath __tests__/enhancementRouting.mobileRoutingGate.red.test.ts --silent --bail --noStackTrace` exited `1` as expected on missing `../src/enhancementRouting`, which remains deferred. `cd bff && node tests/enhancement.service.test.js` exited `1` as expected on missing `../src/services/enhancementService`; `cd bff && node tests/enhancement.validation.red.test.js` exited `1` as expected on route-missing 404 for `/sessions/:sessionId/enhancement`. `git diff --check -- protocol/timeouts.ts SenseiMobile/src/mobile/bridge/contracts.ts SenseiMobile/src/mobile/network/types.ts SenseiMobile/src/mobile/network/BffClient.ts SenseiMobile/src/mobile/MainScreen.tsx docs/execplans/enhancement_core_bff_migration_execplan.md` exited `0`.
- [ ] (2026-06-12) Harry Potter (Agent A) reviewed Hermione Granger's BFF/Core config/source diff and ExecPlan updates. Result: accepted. Reruns: `cd core && npm run build` exited `0`; `npm test -- --runTestsByPath __tests__/BffClient.test.ts __tests__/MainScreen.enhancementBridge.test.ts --silent --bail --noStackTrace` exited `0` with 2 suites and 16 tests passing; `cd bff && node tests/enhancement.service.test.js` exited `0` with `enhancement service/model routing test passed`; `cd bff && node tests/enhancement.validation.red.test.js` exited `0` with `enhancement validation red test passed`; `npm test -- --runTestsByPath __tests__/corePromptParity.test.ts __tests__/enhancementCoreParser.test.ts --silent --bail --noStackTrace` exited `0` with 2 suites and 19 tests passing; `npm test -- --runTestsByPath __tests__/enhancementRouting.mobileRoutingGate.red.test.ts --silent --bail --noStackTrace` exited `1` as expected on missing WebView routing helper. `git diff --check` exited `0`; no-index whitespace checks for new BFF service/controller/route files emitted no errors. Architectural Distance Pass accepted: system-affecting BFF/RN transport and server-provider boundary implementation; Core owns prompt/parser and config defaults, BFF owns provider execution/validation/caps/rate limiting/task dispatch, RN transports structured request/result only, and WebView routing/UI state remain untouched. Current closure blocker: Hermione must triad-check this Agent A reciprocal review and closure proposal.
- [x] (2026-06-12) Hermione Granger (Agent B) triad-checked Harry Potter's reciprocal BFF/RN implementation review and accepts closure of `Implement BFF/RN enhancement transport foundation and turn BFF/RN transport/service tests green`. The agreed BFF/RN/Core surfaces are patched, BFF/RN transport/service/validation and Core regression checks are green, the WebView routing gate remains expected-red on the deliberately missing helper, peer diff review and Architectural Distance Pass are recorded, and no WebView `src` production files or WebView bundle output were edited. The next shared step is design-only `WebView routing helper design for src/enhancementRouting.ts and later toggleEnhancement integration`.
- [x] (2026-06-12) Harry Potter (Agent A) reviewed Hermione Granger's WebView routing helper design revisions and accepts closure of `WebView routing helper design for src/enhancementRouting.ts and later toggleEnhancement integration` from Agent A's side, pending Agent B triad-check. Accepted next implementation boundary: helper-only WebView routing, with `src/enhancementRouting.ts`, `src/mobile/webviewMessageRouter.ts`, `protocol/timeouts.ts`, the routing test fixture correction, and this ExecPlan as the only authorized files. The next slice must remove `messageId` from the routing test fixture because the BFF/RN payload is `originalMarkdown` plus optional `wordCount`; add `ENHANCEMENT_BRIDGE_TIMEOUT_MS = 205_000`; keep bridge request/result mechanics in `webviewMessageRouter.ts`; keep `requestSenseiEnhancementViaRoute` provider-agnostic with injected bridge/local callbacks; run WebView bundle after `src/` edits; and leave `toggleEnhancement`, WebView prompt/parser cleanup, BFF/RN/Core changes, trace/master completion updates, and hand-edited bundle output out of scope.
- [x] (2026-06-12) Hermione Granger (Agent B) triad-checked Harry Potter's WebView routing helper design-closure record and accepts closure of `WebView routing helper design for src/enhancementRouting.ts and later toggleEnhancement integration` from Agent B's side. The next shared step may open as helper-only implementation with file changes limited to `src/enhancementRouting.ts`, `src/mobile/webviewMessageRouter.ts`, `protocol/timeouts.ts`, `__tests__/enhancementRouting.mobileRoutingGate.red.test.ts`, and this ExecPlan. The accepted implementation must remove `messageId` from the routing fixture payload, add `ENHANCEMENT_BRIDGE_TIMEOUT_MS = 205_000`, keep bridge mechanics in `webviewMessageRouter.ts`, keep the routing helper provider-agnostic, run WebView bundle after `src/` edits, and defer `toggleEnhancement` integration and trace/master completion updates.
- [ ] (2026-06-12) `Implement WebView enhancement routing helper and bridge request/result support` is active. Harry Potter (Agent A) patched the helper-only WebView slice: added `src/enhancementRouting.ts`, updated `src/mobile/webviewMessageRouter.ts` with enhancement bridge request/result resolver support, added `ENHANCEMENT_BRIDGE_TIMEOUT_MS = 205_000` in `protocol/timeouts.ts`, removed `messageId` from the routing test fixture payload, and updated this ExecPlan. Validation run by Harry: routing gate `npm test -- --runTestsByPath __tests__/enhancementRouting.mobileRoutingGate.red.test.ts --silent --bail --noStackTrace` exited `0` with 3 tests passing; BffClient/MainScreen regression exited `0` with 2 suites and 16 tests passing; BFF service and validation scripts exited `0`; Core prompt/parser regression exited `0` with 2 suites and 19 tests passing; `npm run webview:bundle` exited `0` and regenerated `SenseiMobile/app_web/webview_dist/index.js`, `index.js.map`, `index.css`, and `index.html`. Source/test/doc diff hygiene for the helper slice exited `0`; `git diff --check` including generated `webview_dist` reports trailing whitespace emitted by generated/copied bundle content, so the generated-bundle hygiene caveat remains pending peer review rather than being hand-edited. No `toggleEnhancement`, BFF/RN/Core implementation, trace/master completion, or hand-edited bundle changes were made by Harry. This step remains active pending Hermione's review, Architectural Distance Pass, and shared gap closure.
- [ ] (2026-06-12) Hermione Granger (Agent B) reviewed Harry Potter's helper-only WebView routing diff and accepts it with no code correction. Reviewed files: `src/enhancementRouting.ts`, `src/mobile/webviewMessageRouter.ts`, `protocol/timeouts.ts`, `__tests__/enhancementRouting.mobileRoutingGate.red.test.ts`, generated WebView bundle status, and this ExecPlan. Hermione reran the routing gate with exit `0` and 3 tests passing, reran BffClient/MainScreen with exit `0` and 16 tests passing, reran BFF service and BFF validation scripts with exit `0`, and reran Core prompt/parser regression with exit `0` and 19 tests passing. Source/test/doc diff hygiene passed; no-index whitespace check for new `src/enhancementRouting.ts` emitted no errors. `git diff --check` on generated `SenseiMobile/app_web/webview_dist/**` still reports generated trailing whitespace, accepted as generated bundle output from `npm run webview:bundle` rather than a hand-edit blocker. Architectural Distance Pass from Hermione: system-affecting WebView routing/bridge foundation; route selection belongs in `src/enhancementRouting.ts`, bridge resolver mechanics in `src/mobile/webviewMessageRouter.ts`, timeout constant in `protocol/timeouts.ts`, UI state/application remains in `toggleEnhancement` for a later slice, mobile path has no browser-provider fallback, BFF/RN/Core regressions remain green, and runtime migration is not complete until `toggleEnhancement` integration lands.
- [x] (2026-06-12) Harry Potter (Agent A) triad-checked Hermione Granger's helper-only WebView routing reciprocal review and accepts closure of `Implement WebView enhancement routing helper and bridge request/result support`. Hermione accepted the helper/router/test/timeout/doc diff, reran the agreed routing, BFF/RN, BFF service/validation, and Core prompt/parser checks successfully, accepted the generated-bundle trailing-whitespace caveat as generated output from the required `npm run webview:bundle`, and recorded Architectural Distance Pass. Shared gap check: Harry's implementation was reviewed by Hermione, Hermione's reciprocal review was reviewed by Harry, file-change rationale is satisfied, no unresolved disagreement remains for this helper-only slice, and no `toggleEnhancement`, WebView prompt/parser cleanup, trace/master completion, or hand-edited bundle changes were made. This shared step is closed from Agent A's side; the next shared step should be design-only `toggleEnhancement` mobile routing integration and desktop compatibility cleanup`.
- [x] (2026-06-12) Hermione Granger (Agent B) triad-checked Harry Potter's helper-only WebView routing closure confirmation and accepts closure of `Implement WebView enhancement routing helper and bridge request/result support` from Agent B's side. The helper-only slice is closed from both peers if Harry's state remains unchanged: routing helper, bridge request/result support, enhancement bridge timeout, routing fixture correction, WebView bundle generation, peer diff review, generated-bundle caveat decision, and Architectural Distance Pass are recorded. Carry-forward work remains `toggleEnhancement` mobile routing integration, desktop compatibility cleanup, WebView prompt/parser duplicate cleanup, final direct-provider sweep, runtime validation, and trace/master status updates after migrated runtime evidence.
- [x] (2026-06-12) Harry Potter (Agent A) reviewed Hermione Granger's `toggleEnhancement` integration design response and accepts the test-scope revision from Agent A's side, pending Agent B triad-check. The next implementation step should update `src/enhancementManager.ts`, add `__tests__/enhancementManager.mobileRouting.test.ts`, update this ExecPlan, and regenerate the WebView bundle through `npm run webview:bundle`. Accepted test target: mobile build path must not call injected `getAI()`, route payload must be sanitized markdown plus `wordCount`, bridge rejection must clear loading/active state without markdown mutation, and desktop compatibility must still call `getAI()` only through the route helper's local generator. Route rejection should be treated as fail-closed cleanup equivalent to the current null/failure cleanup. The slice must not edit `src/geminiService.ts`, `src/prompts.ts`, BFF/RN/Core implementation files, trace/master completion files, or generated bundle output by hand.
- [x] (2026-06-12) Hermione Granger (Agent B) triad-checked Harry Potter's `toggleEnhancement` integration design-convergence entry and accepts closure of `Design toggleEnhancement mobile routing integration and desktop compatibility cleanup` from Agent B's side. The next shared step may open as implementation with file changes limited to `src/enhancementManager.ts`, `__tests__/enhancementManager.mobileRouting.test.ts`, this ExecPlan, and generated WebView bundle output through `npm run webview:bundle`. The accepted slice must move `getAI()` into the desktop-only local generator, route the mobile path through `requestSenseiEnhancementViaRoute`, preserve WebView loading/active/apply/remove/content-drift behavior, treat route rejection as fail-closed cleanup, add the focused public-seam manager test, run provider-leak/source classification, and defer `src/geminiService.ts` / `src/prompts.ts` cleanup plus trace/master completion.
- [ ] (2026-06-12) `Implement toggleEnhancement mobile routing integration and preserve WebView state behavior` is active. Harry Potter (Agent A) patched `src/enhancementManager.ts` so `toggleEnhancement` builds the sanitized `{ originalMarkdown, wordCount }` request, calls `requestSenseiEnhancementViaRoute`, routes mobile through `requestSenseiEnhancementViaBridge`, and moves `getAI()` plus `requestSenseiEnhancement(ai, request)` into the desktop-only `generateLocal` callback. Route rejection now performs fail-closed cleanup: state returns to idle, loading and active state are cleared, a safe error is logged, and markdown is not rendered or mutated. Harry added `__tests__/enhancementManager.mobileRouting.test.ts` proving mobile `toggleEnhancement` does not call injected `getAI()`, sends sanitized payload and `wordCount`, clears loading/active state without rendering on bridge failure, and still calls `getAI()` through the desktop local route callback. Validation run by Harry: focused manager/routing command exited `0` with 2 suites and 6 tests passing; BffClient/MainScreen regression exited `0` with 2 suites and 16 tests passing; BFF service and BFF validation scripts exited `0`; Core prompt/parser regression exited `0` with 2 suites and 19 tests passing; `npm run webview:bundle` exited `0` and regenerated WebView bundle output. Provider/source classification: `src/enhancementRouting.ts` and `src/mobile/webviewMessageRouter.ts` remain clean of provider/prompt-control terms; `src/enhancementManager.ts` still contains desktop-compatibility `GoogleGenAI`, `getAI`, and `requestSenseiEnhancement` references, but the new public-seam test proves mobile `toggleEnhancement` does not call that path. Source/test/doc hygiene exited `0`; generated `webview_dist` diff-check still reports generated/copied trailing whitespace and remains a generated-output caveat. This step remains active pending Hermione review, Architectural Distance Pass, and shared gap closure.
- [ ] (2026-06-12) Hermione Granger (Agent B) reviewed Harry Potter's `toggleEnhancement` integration diff and accepts it with no code correction. Reviewed files: `src/enhancementManager.ts`, `__tests__/enhancementManager.mobileRouting.test.ts`, generated WebView bundle status, provider/source classification, and this ExecPlan. Hermione reran the focused manager/routing command with exit `0` and 6 tests passing, BffClient/MainScreen regression with exit `0` and 16 tests passing, BFF service and BFF validation scripts with exit `0`, and Core prompt/parser regression with exit `0` and 19 tests passing. Source/test/doc hygiene passed, and no-index whitespace check for the new manager test emitted no errors. Generated `webview_dist` diff-check still reports generated trailing whitespace and remains accepted as generated bundle output from `npm run webview:bundle`. Process caveat: this implementation slice did not use the user's preferred parallel split because Harry patched both `src/enhancementManager.ts` and the focused manager test before Hermione could patch her owned test file; this is not a code blocker for the completed diff, but future implementation slices should split editable files before either peer starts. Architectural Distance Pass from Hermione: system-affecting WebView runtime routing integration; `toggleEnhancement` remains WebView owner for state, Mermaid stripping, word count, apply/remove, content drift, and render cleanup; route selection and bridge mechanics remain in their dedicated helpers; mobile `toggleEnhancement` no longer calls `getAI()` or browser provider; desktop compatibility remains explicit; BFF/RN/Core regressions remain green; duplicate WebView prompt/parser cleanup and trace/master completion remain deferred.
- [x] (2026-06-12) Harry Potter (Agent A) triad-checked Hermione Granger's `toggleEnhancement` integration reciprocal review and accepts closure of `Implement toggleEnhancement mobile routing integration and preserve WebView state behavior`. Hermione accepted the WebView integration/test/doc/bundle diff, reran focused manager/routing, BFF/RN, BFF service/validation, and Core prompt/parser checks successfully, accepted the provider/source classification and generated-bundle whitespace caveat, and recorded Architectural Distance Pass. Harry accepts Hermione's process caveat: this completed slice is not blocked, but future implementation slices should split editable files before either peer starts when a safe same-step split exists. Shared gap check: Harry's implementation was reviewed by Hermione, Hermione's reciprocal review was reviewed by Harry, file-change rationale is satisfied for this completed diff, no unresolved disagreement remains for this integration slice, and no WebView prompt/parser cleanup, final provider sweep, trace/master completion, or final migration closure was performed. This shared step is closed from Agent A's side; the next shared step should be design-only `WebView desktop compatibility cleanup and final direct-provider sweep`.
- [x] (2026-06-12) Hermione Granger (Agent B) triad-checked Harry Potter's `toggleEnhancement` integration closure confirmation and accepts closure of `Implement toggleEnhancement mobile routing integration and preserve WebView state behavior` from Agent B's side. This integration slice is closed from both peers if Harry's state remains unchanged: mobile `toggleEnhancement` routes through the BFF/RN bridge path without calling `getAI()`, desktop compatibility remains explicit through the local generator, focused manager/routing and BFF/RN/Core regressions are green, WebView bundle output was regenerated with the accepted generated-whitespace caveat, peer diff review and Architectural Distance Pass are recorded, and no WebView prompt/parser cleanup, final provider sweep, trace/master completion, or final migration closure was performed. Future implementation slices should split editable files before either peer starts when a safe same-step split exists.
- [x] (2026-06-12) Harry Potter (Agent A) triad-checked Hermione Granger's `Design WebView desktop compatibility cleanup and final direct-provider sweep` closure response and accepts closure from Agent A's side. Accepted next implementation split: Harry owns `src/prompts.ts`, `src/geminiService.ts`, and Harry-owned ExecPlan records; Hermione owns `core/browserLlmClient.ts`, `__tests__/geminiService.test.ts`, and Hermione-owned ExecPlan records. Accepted cleanup target: `src/prompts.ts` keeps a compatibility re-export for `buildSenseiEnhancementPrompt`, `src/geminiService.ts:requestSenseiEnhancement` remains a desktop wrapper but delegates prompt construction/parser behavior to Core and provider calling through the browser Core client with task `sensei_enhancement`, and `core/browserLlmClient.ts` maps that task to `SENSEI_ENHANCEMENT_CONFIG`. Trace/master completion remains deferred until final sweep/runtime evidence and peer agreement.
- [ ] (2026-06-12) `Implement WebView desktop compatibility cleanup and provider sweep preparation` is active. Harry Potter (Agent A) patched only his agreed scope: `src/prompts.ts` now re-exports `buildSenseiEnhancementPrompt` from `@sensei/core/prompts/enhancement` instead of owning the enhancement prompt body, and `src/geminiService.ts:requestSenseiEnhancement` now creates a browser Core LLM client, builds the prompt with Core, calls `llmClient.callText(prompt, { task: 'sensei_enhancement' })`, parses with `parseSenseiEnhancementResponse`, returns `null` for missing AI, unavailable Core browser client, parser-null, and provider failure, and logs safe failure metadata without raw provider text or raw exception objects. Harry removed enhancement-local `stripJsonFence`, `normalizeEnhancementEntries`, local enhancement request config, and direct `ai.models.generateContent(...)` from the enhancement wrapper slice only; unrelated provider calls for other backlog rows remain untouched and classified. Validation run by Harry: the first bounded root command used zsh variable name `status` and exited before tests; rerun with `rc` exited `0` for `npm test -- --runTestsByPath __tests__/geminiService.test.ts __tests__/prompts.test.ts __tests__/corePromptParity.test.ts __tests__/enhancementCoreParser.test.ts --silent --bail --noStackTrace`, passing 4 suites with 26 tests and 1 todo. `npm run webview:bundle` exited `0`, rebuilding Core/protocol and regenerating WebView bundle output. Current blocker before closure: Hermione must patch/review her agreed `core/browserLlmClient.ts` and `__tests__/geminiService.test.ts` half, then both peers must run the full agreed regressions, provider/prompt-control sweeps, generated-bundle classification, peer diff review, and Architectural Distance Pass.
- [ ] (2026-06-12) Hermione Granger (Agent B) reviewed Harry Potter's WebView wrapper/prompt re-export cleanup and accepts it pending final shared validation. Hermione patched her agreed implementation half: `core/browserLlmClient.ts` now maps task `sensei_enhancement` to `SENSEI_ENHANCEMENT_CONFIG`, and `__tests__/geminiService.test.ts` adds focused desktop compatibility coverage for `requestSenseiEnhancement`: missing provider returns `null`, valid fenced JSON uses the enhancement JSON config and parses normalized Core-shaped entries/metadata, malformed provider text returns `null`, and provider generation failure returns `null`. This keeps the next closure blocked until full agreed validation, provider/prompt-control sweeps, generated-bundle classification, peer diff review, and Architectural Distance Pass are complete.
- [ ] (2026-06-12) Harry Potter (Agent A) reviewed Hermione Granger's browser-client/test/doc diff and accepts it with no code correction. Reviewed files: `core/browserLlmClient.ts`, `__tests__/geminiService.test.ts`, this ExecPlan, generated WebView bundle status, and sweep outputs. Harry reran `cd core && npm run build` with exit `0`; focused wrapper/prompt/Core parser Jest with exit `0`, 4 suites passing, 30 tests passing, and 1 todo; WebView manager/routing Jest with exit `0`, 2 suites and 6 tests passing; BffClient/MainScreen Jest with exit `0`, 2 suites and 16 tests passing; BFF service and validation scripts with exit `0`; and `npm run webview:bundle` with exit `0`. Source/test/doc diff hygiene exited `0`; generated `webview_dist` diff-check still reports trailing whitespace in generated/copied bundle output and remains accepted as generated output, not source authority. Provider/prompt-control sweeps are accepted: `src/prompts.ts` contains only the Core re-export, `src/geminiService.ts:requestSenseiEnhancement` uses Core prompt/parser plus browser Core client task `sensei_enhancement`, `core/browserLlmClient.ts` maps that task to `SENSEI_ENHANCEMENT_CONFIG`, Core/BFF hits are expected migrated/provider surfaces, generated bundle hits are generated evidence, and unrelated sibling provider hits remain other backlog evidence. Architectural Distance Pass from Harry: system-affecting desktop compatibility cleanup; Core owns enhancement prompt/parser/config, BFF owns mobile provider execution, RN owns transport, WebView owns UI/state/routing, and the desktop wrapper is now a compatibility path around Core-owned logic. Current closure blocker: Hermione must triad-check this Agent A reciprocal review and either close the step or name a remaining blocker.
- [x] (2026-06-12) Hermione Granger (Agent B) triad-checked Harry Potter's reciprocal cleanup review and accepts closure of `Implement WebView desktop compatibility cleanup and provider sweep preparation` from Agent B's side. Harry accepted Hermione's `core/browserLlmClient.ts` task mapping and `__tests__/geminiService.test.ts` desktop wrapper tests, reran the full agreed validation set successfully, accepted provider/prompt-control sweep classifications, accepted the generated WebView bundle trailing-whitespace caveat as generated output, and recorded Architectural Distance Pass. Shared gap check: Harry's source cleanup was reviewed by Hermione, Hermione's browser-client/test contribution was reviewed by Harry, both peers changed only agreed files plus generated bundle output through `npm run webview:bundle`, no unresolved disagreement remains, and trace/master completion, unrelated provider migrations, final migration closure, and generated bundle hand-editing remain deferred to a separately agreed step.
- [x] (2026-06-12) Harry Potter (Agent A) reviewed Hermione Granger's `Design final enhancement migration evidence, runtime smoke, and trace/master status update boundary` response and accepts closure from Agent A's side, pending Agent B triad-check. The next edit step is docs/status only and should be named `Final enhancement migration evidence audit and PR-stage trace/master update` unless runtime smoke becomes immediately available and both peers revise scope. Accepted status boundary: deterministic tests and sweeps support PR-stage deterministic migration evidence, not full runtime completion; trace/master wording must not use `complete`, `runtime complete`, or `live verified` unless mobile runtime smoke is recorded. The next step may update this ExecPlan, `docs/llm_entry_exit_traces.md`, and only evidence-safe wording in `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`; no production source/test/config edits, generated bundle hand edits, unrelated provider migrations, or broad sibling-row completion updates are authorized.
- [x] (2026-06-12) Hermione Granger (Agent B) triad-checked Harry Potter's final-evidence design closure and accepts closure of `Design final enhancement migration evidence, runtime smoke, and trace/master status update boundary` from Agent B's side. The next shared step is `Final enhancement migration evidence audit and PR-stage trace/master update`: docs/status only, deterministic evidence may support PR-stage wording, runtime completion wording requires recorded mobile runtime smoke, generated bundle output remains evidence not source authority, and no source/test/config edits, generated bundle hand edits, unrelated provider migrations, broad sibling-row completion updates, or final migration closure are authorized unless both peers revise the step.
- [ ] (2026-06-12) Hermione Granger (Agent B) reviewed Harry Potter's `Final enhancement migration evidence audit and PR-stage trace/master update` docs/status diff and accepts it with no correction. Reviewed files: `docs/execplans/enhancement_core_bff_migration_execplan.md`, `docs/llm_entry_exit_traces.md`, and `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`. Hermione accepts the deterministic validation reruns, final provider/prompt-control sweep classifications, runtime smoke deferral with scope confidence, generated-bundle source-authority separation, and PR-stage trace/master status wording. Targeted stale/overclaim grep found only intended PR-stage lines and historical ExecPlan context; no current trace/master row claims runtime-complete or live-verified status. This step is ready to close pending Harry's triad-check of this reciprocal review.
- [ ] (2026-06-12) `Final enhancement migration evidence audit and PR-stage trace/master update` is active. Harry Potter (Agent A) reran the final deterministic validation set and patched only authorized docs/status surfaces. Validation reruns: `cd core && npm run build` exited `0`; wrapper/prompt/Core parser Jest exited `0` with 4 suites passed, 30 tests passed, and 1 todo; WebView manager/routing Jest exited `0` with 2 suites and 6 tests passed; BffClient/MainScreen Jest exited `0` with 2 suites and 16 tests passed; BFF service script exited `0`; BFF validation script exited `0`. Final sweeps were rerun and classified: generated `webview_dist/**` hits are generated bundle evidence only; Core owns enhancement prompt/parser/config; BFF owns server provider execution for `sensei_enhancement`; RN owns structured transport; `src/prompts.ts` is only the Core prompt re-export; `src/geminiService.ts:requestSenseiEnhancement` uses Core prompt/parser and browser Core client task `sensei_enhancement`; remaining `generateContent` in `src/geminiService.ts` is `generateDirectiveFromMetaPrompt`, a sibling backlog row not enhancement-reachable from mobile. Runtime smoke status: deferred. Environment: no BFF/Metro/iOS simulator/live provider smoke was started in this docs/status step. Evidence classification: deterministic-only; scope confidence covers prompt/parser custody, BFF/RN/WebView routing contracts, desktop wrapper behavior, source sweep classification, and bundle freshness, but not live provider credentials or full end-to-end mobile UI behavior. Impact on trace/master: PR-stage deterministic evidence only; no runtime-complete wording. Follow-up owner: release/runtime validation owner must run or unblock live mobile smoke before final runtime completion.
- [x] (2026-06-12) Harry Potter (Agent A) triad-checked Hermione Granger's reciprocal review and accepts closure of `Final enhancement migration evidence audit and PR-stage trace/master update` from Agent A's side. Hermione accepted the three-doc PR-stage status diff, deterministic validation reruns, provider/prompt-control sweep classifications, generated-bundle source-authority separation, runtime-smoke deferred status with scope confidence, and no-runtime-complete wording. Shared gap check: Harry's docs/status contribution was reviewed by Hermione, Hermione's reciprocal review was reviewed by Harry, file-change rationale is satisfied, no unresolved disagreement remains, and no runtime smoke, source/test/config edits, generated bundle hand edits, unrelated provider migrations, broad sibling-row completion updates, final migration closure, commit, or push were performed.
- [x] (2026-06-12) Hermione Granger (Agent B) triad-checked Harry Potter's docs/status closure and accepts closure of `Final enhancement migration evidence audit and PR-stage trace/master update` from Agent B's side. This PR-stage evidence step is closed from both peers if Harry's state remains unchanged: trace/master docs use deterministic-evidence wording only, runtime smoke remains deferred with scope confidence, generated WebView bundle output is separated from source authority, sibling provider backlog rows remain out of scope, and no runtime smoke, source/test/config edits, generated bundle hand edits, final migration closure, commit, or push were performed.
- [ ] Mobile Routing Gate: implement and validate BFF-backed mobile enhancement routing, gate desktop-only local SDK paths with `window.__SENSEI_MOBILE_BUILD__`, and add a sentinel test proving mobile cannot use a browser `CoreLlmClient` or browser provider SDK for enhancement.
- [ ] Fill all compliance ledgers with current-source evidence before implementation. Current status: WebView-side and Core/BFF/RN/provider evidence are recorded for this pre-code gate; exact enhancement route/bridge/BffClient/test/script/timeout/rate-limit names, prompt SHA/length fixtures, parser fixture inventory, and mobile failure response shape remain open for the red/golden test design slice.
- [ ] Add red/golden parity tests before route work.
- [ ] Implement Core prompt/capability, BFF route/service, RN/BffClient/bridge transport, and WebView routing changes.
- [ ] Run deterministic validation, update traces/status with evidence, and complete final peer convergence.

## Surprises & Discoveries

- Observation: `toggleEnhancement` is listed in the master inventory because it is the current feature entry point, not because the whole function should move to Core/BFF.
  Evidence: `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md` says to keep `toggleEnhancement`, loading/active state, `applyEnhancementSequence`, `applyEnhancements`, markdown re-rendering, and per-message enhancement state in WebView.

- Observation: The current source passes a browser provider client from `toggleEnhancement` into `requestSenseiEnhancement`.
  Evidence: `src/enhancementManager.ts:toggleEnhancement` calls `const ai = getAI()` and then `requestSenseiEnhancement(ai, ...)`.

- Observation: The direct provider wrapper currently owns more than provider execution.
  Evidence: `src/geminiService.ts:requestSenseiEnhancement` builds the prompt, calls `ai.models.generateContent`, strips JSON fences, parses JSON, and calls `normalizeEnhancementEntries`.

- Observation: Implementation evidence refresh started from a clean branch and confirmed the planned Core enhancement files do not yet exist.
  Evidence: On 2026-06-11 19:30Z, branch `codex/enhancement-core-bff-execplan` at HEAD `9e6c27ef98c20d0eb3eecf264ac2ba02a770c535` had clean `git status --short`. `test -f core/prompts/enhancement.ts` and `test -f core/enhancement.ts` both exited nonzero, while `find core/prompts -maxdepth 1 -type f` showed existing prompt modules for other migrated capabilities but no enhancement prompt module.

- Observation: `wordCount` is currently telemetry/context for the WebView-side wrapper call, not prompt-control.
  Evidence: `src/enhancementManager.ts:toggleEnhancement` passes `wordCount: countWords(sanitizedSource)` to `requestSenseiEnhancement`, and `src/geminiService.ts:requestSenseiEnhancement` logs `wordCount` in `[ENHANCE] Enhancement request started` but builds the prompt only from `request.originalMarkdown`.

- Observation: There is no dedicated current test file for `toggleEnhancement`, `applyEnhancementSequence`, or `requestSenseiEnhancement`.
  Evidence: `rg` found `__tests__/prompts.test.ts` covering only the enhancement prompt scaffold and `__tests__/geminiService.test.ts` covering generic parse and teaching-plan extraction. `rg "requestSenseiEnhancement|enhancement|Enhancement" __tests__/geminiService.test.ts __tests__/moduleSelectionHandler.enhancer.test.ts` returned no matches.

- Observation: The direct provider sweep includes generated WebView bundle hits, so source-custody conclusions must exclude or separately classify `SenseiMobile/app_web/webview_dist/**`.
  Evidence: The provider sweep command returned real source hits in `src/enhancementManager.ts`, `src/geminiService.ts`, Core/BFF provider infrastructure, and sibling backlog files, then also returned generated `SenseiMobile/app_web/webview_dist/index.js` and `.map` hits. Generated hits are validation evidence only, not source authority.

- Observation: Current Core/BFF/RN surfaces have migration precedents but no enhancement-specific route, bridge message, BffClient method, timeout constant, cap policy, or Core enhancement export.
  Evidence: Existing non-stream BFF patterns include `bff/src/routes/selectionSensei.js`, `bff/src/controllers/selectionSenseiController.js`, `bff/src/services/selectionSenseiService.js`, and `bff/src/server.js` mounting. RN patterns include `SenseiMobile/src/mobile/bridge/contracts.ts`, `SenseiMobile/src/mobile/network/BffClient.ts`, `SenseiMobile/src/mobile/network/types.ts`, and `SenseiMobile/src/mobile/MainScreen.tsx`. `core/index.ts`, `core/prompts/index.ts`, `core/package.json`, `protocol/timeouts.ts`, `core/llmCapPolicy.ts`, `bff/src/config/llmCapPolicy.js`, and `bff/src/validation/llmCapValidation.js` have no enhancement-specific entries yet.

- Observation: The candidate enhancement route is consistent with current BFF conventions but remains a candidate until code/test slices name it.
  Evidence: BffClient already posts session-scoped non-stream requests to paths such as `/sessions/${sessionId}/selection-sensei/modal-message`, `/sessions/${sessionId}/wrapup`, `/sessions/${sessionId}/teaching-plan`, and `/sessions/${sessionId}/analysis`; the compliance protocol candidate shape is `POST /sessions/:sessionId/enhancement`.

- Observation: The sibling ExecPlans confirm the implementation-order guardrail for this enhancement migration.
  Evidence: `docs/execplans/module_intro_main_sensei_streaming_core_bff_migration_execplan.md` records the PR #1 lessons around prompt ownership, structured mobile payloads, timeout alignment, generated-bundle validation, and BFF default-test caveats. `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md` is the closest route precedent: red/golden tests first, then Core prompt/parser/capability, BFF route/service, BffClient, RN bridge, WebView routing/provider removal, bundle/final sweep. `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md` reinforces that sibling direct-provider paths must be classified honestly and that raw prompt/guidance fields cannot remain mobile-controlled after migration.

- Observation: Hermione Granger's Core/BFF/RN/provider evidence patch matches current source anchors.
  Evidence: Harry Potter rechecked the BFF session-scoped route/controller/service shape, server-side `CoreLlmAdapter` -> `GeminiGateway` provider pattern, RN `selectionSensei:modalMessageRequest` / `selectionSensei:modalMessageResult` bridge precedent, non-stream `BffClient` timeout/AbortController patterns, explicit Core export/package surfaces, strict BFF validation red-test precedent, and Core prompt parity test layout. The recheck found no mismatch requiring correction before the first red/golden test design slice.

## Decision Log

- Decision: Scope this ExecPlan to the paired master rows `Enhancement request` and `Sensei enhancement wrapper`.
  Rationale: The master inventory tracks the feature entry path and the direct-provider wrapper as separate but coupled obligations. Migrating only one risks either an unwired feature route or a leftover direct-provider fallback.
  Date/Author: 2026-06-11, Harry Potter (Agent A) and Hermione Granger (Agent B).

- Decision: Keep `toggleEnhancement` and UI/application behavior in WebView.
  Rationale: Phase 1 moves only prompt/provider/parser/normalizer and LLM-facing contracts. UI state, DOM/render behavior, Mermaid stripping, word counting, and per-message enhancement application are WebView orchestration.
  Date/Author: 2026-06-11, Harry Potter (Agent A) and Hermione Granger (Agent B).

- Decision: Place the complete LLM Migration Compliance Block before `Progress`.
  Rationale: The hard-stop gates must remain visible before the living checklist grows. PLAN.md living sections still remain near the top immediately after the compliance block.
  Date/Author: 2026-06-11, Harry Potter (Agent A) and Hermione Granger (Agent B).

- Decision: Do not duplicate the Scope Lock as a second full table outside the compliance block.
  Rationale: Duplicate authority tables drift. Novice-facing explanation belongs in prose sections; the authoritative Scope Lock table remains inside the compliance block.
  Date/Author: 2026-06-11, Harry Potter (Agent A) and Hermione Granger (Agent B).

- Decision: Use `TBD after current-source verification` for exact route, bridge, BffClient, test, script, timeout, and rate-limit names that have not been verified in current source.
  Rationale: The user explicitly rejected made-up APIs. Candidate names must be labeled as candidates with their source, and verified names require current-source evidence.
  Date/Author: 2026-06-11, Harry Potter (Agent A) and Hermione Granger (Agent B).

- Decision: Treat Harry Potter's initial ExecPlan draft as a provisional scaffold, not a completed peer-converged artifact.
  Rationale: The user clarified that collision control cannot collapse coauthoring into one peer writing the whole file while the other only reviews. Step 3 requires Hermione Granger-owned substantive content and reciprocal gate/gap review before closure.
  Date/Author: 2026-06-11, Harry Potter (Agent A) and Hermione Granger (Agent B).

- Decision: After collision risk is cleared, the non-first editor should patch bounded document corrections directly when they own the correction and have artifact access.
  Rationale: The peer protocol uses ownership for collision control, not hierarchy. Asking the first editor to apply every safe document correction turns the second peer into a reviewer instead of a coauthor.
  Date/Author: 2026-06-11, Hermione Granger (Agent B).

## Outcomes & Retrospective

No implementation outcome exists yet. This draft records the converged planning architecture and coauthored Step 3 artifact corrections, and is ready for final peer convergence/handoff before future implementation work starts.

## Required Authority Reads Before Code Edits

The implementing agent must read these in order and record the read in `Progress` with timestamp, branch, commit SHA, and any dirty-state concerns:

1. `AGENTS.md`
2. `docs/protocols/PLAN.md`
3. `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`
4. `.codex/skills/llm-migration-compliance/SKILL.md`
5. `docs/templates/llm_migration_compliance_block.md`
6. `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`
7. `docs/llm_entry_exit_traces.md`
8. `docs/execplans/module_intro_main_sensei_streaming_core_bff_migration_execplan.md`
9. `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`
10. `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md`
11. Current source files listed in this plan's Source Map
12. Existing tests around enhancement manager behavior, Gemini service wrappers, Core prompt parity, BFF validation/service routing, RN BffClient/bridge transport, and WebView message routing after test filenames are verified

Do not rely on this plan as a substitute for rereading current source. If source drift is found, update this ExecPlan before implementing.

When recording command state, record branch/SHA, staged state, and only unexpected or out-of-scope changed files. Do not paste full `git status` or full `git diff` output into this ExecPlan.

Implementation evidence-refresh read record:

- 2026-06-11 19:30Z, Harry Potter (Agent A), branch `codex/enhancement-core-bff-execplan`, HEAD `9e6c27ef98c20d0eb3eecf264ac2ba02a770c535`, dirty state clean. Read or re-read for the current implementation run: `AGENTS.md` from the user-provided repository instructions, `docs/protocols/codex_thread_peer_execution_protocol.md`, `.codex/skills/thread-peer-execplan/SKILL.md`, `.codex/skills/llm-migration-compliance/SKILL.md`, `docs/protocols/PLAN.md`, targeted enhancement rows in `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`, targeted enhancement traces in `docs/llm_entry_exit_traces.md`, targeted enhancement section in `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md`, targeted template context in `docs/templates/llm_migration_compliance_block.md`, and current source/test anchors listed in the WebView evidence-refresh notes. Required reads for the sibling ExecPlans listed above remain pending for the full evidence-refresh closure unless Hermione Granger (Agent B) records them or the peers agree they are not needed for this enhancement implementation slice.
- 2026-06-11, Hermione Granger (Agent B), branch `codex/enhancement-core-bff-execplan`, HEAD `9e6c27ef98c20d0eb3eecf264ac2ba02a770c535`, dirty state contained Harry Potter's existing modification to this ExecPlan only. Read or re-read for this evidence contribution: current peer protocol LLM Run Card and shared-step rules, targeted `docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md` and `docs/templates/llm_migration_compliance_block.md` sections, targeted enhancement rows in `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`, targeted traces in `docs/llm_entry_exit_traces.md`, Core prompt/capability export surfaces, BFF route/controller/service/provider/cap-policy surfaces, RN bridge/BffClient/MainScreen transport surfaces, protocol timeout constants, current relevant test inventories, and a direct-provider sweep excluding generated bundles. Required sibling ExecPlan reads remain pending unless the peers agree they are not needed before opening the first red-test slice.
- 2026-06-11 19:45Z, Harry Potter (Agent A), branch `codex/enhancement-core-bff-execplan`, HEAD `9e6c27ef98c20d0eb3eecf264ac2ba02a770c535`, dirty state contained only this ExecPlan modification. Read targeted implementation-order and failure-class sections from `docs/execplans/module_intro_main_sensei_streaming_core_bff_migration_execplan.md`, `docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md`, and `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md`. The sibling reads are now sufficient for the first red/golden test design slice; future implementation slices must still reread exact current source and the active sibling sections if they touch shared routing, prompt-control, timeout, cap, provider, or generated-bundle behavior.

## Peer Protocol Record

The user requested a real peer protocol run with Hermione Granger (Agent B) and explicitly required independent-first brainstorming.

Step 1, `Independent-first task framing for an enhancement feature ExecPlan`, was initially closed too quickly. The user corrected the process. Harry Potter (Agent A) and Hermione Granger (Agent B) then adopted a reusable closure template requiring a step objective, closure gates, paired contributions, reciprocal feedback, gate-by-gate assessment, explicit gap identification, a joint closure decision, and only then a candidate next step.

Step 1 closed after both peers agreed that the scope is `Enhancement request` plus `Sensei enhancement wrapper`; `toggleEnhancement` remains WebView orchestration; prompt/provider/parser/normalizer custody moves behind Core/BFF; and key-takeaway, pedagogical directive, and legacy generic stream work remain sibling backlog or out of scope.

Step 2, `Converged artifact architecture`, closed after both peers agreed that this ExecPlan uses the section order in this document, places the LLM Migration Compliance Block near the top, avoids duplicate Scope Lock tables, records unverified exact names as `TBD after current-source verification`, and lets Harry Potter (Agent A) create the initial draft as single first editor. Hermione Granger (Agent B) owns compliance/gate review and exact correction proposals after this draft exists.

Future peer steps for this plan must use the gate/gap closure template above.

## Context and Orientation

The enhancement feature lets users expand a Sensei teaching message with additional explanatory material. The current source entry point is `src/enhancementManager.ts:toggleEnhancement(messageId)`.

`toggleEnhancement` is WebView orchestration. It reads dependencies registered by `initializeEnhancementManager`, checks the current per-message enhancement state, obtains the latest markdown from `streamingMap`, strips Mermaid blocks from the source sent to the model, computes a word count, toggles loading state, calls `requestSenseiEnhancement`, and applies or removes enhancement markdown. It also handles no-source, Mermaid-only, loading, applied, content-drift, render-failure, empty-payload, and no-payload paths.

`src/geminiService.ts:requestSenseiEnhancement` is the current LLM-facing wrapper. It receives a `GoogleGenAI | null` client, builds the prompt with `buildSenseiEnhancementPrompt`, calls `ai.models.generateContent`, strips JSON fences, parses JSON, normalizes enhancement entries, logs request outcomes, and returns an `EnhancementPayload | null`.

`src/prompts.ts:buildSenseiEnhancementPrompt` is the current prompt owner. Its text must move verbatim to `core/prompts/enhancement.ts` before prompt-quality changes are considered.

Core means the environment-neutral TypeScript library under `core/`. BFF means the backend-for-frontend server under `bff/`. React Native means the native shell under `SenseiMobile/`, including bridge contracts and `BffClient`. WebView means the browser app under `src/` when loaded inside the mobile shell.

The migration must split the mixed feature path. Prompt text, provider execution, response parsing, and normalization move into Core/BFF ownership. UI state and markdown application stay in WebView.

## Source Map And Current Workflow

Current trigger path:

1. The user activates the Enhance control for a Sensei message.
2. `src/index.tsx` exposes the Enhance handler and calls `toggleEnhancement(messageId)`.
3. `src/enhancementManager.ts:toggleEnhancement` reads the current markdown from `streamingMap`.
4. If an enhancement is already applied, `toggleEnhancement` calls `removeEnhancements(messageId)`.
5. If an enhancement is loading, it returns early.
6. Otherwise, it strips Mermaid blocks with `stripMermaidBlocks(originalMarkdown)`.
7. If the stripped source is empty, it resets loading/active state and returns without provider work.
8. It currently calls `const ai = getAI()` and passes that provider client into `requestSenseiEnhancement(ai, { originalMarkdown: sanitizedSource, wordCount })`.
9. `src/geminiService.ts:requestSenseiEnhancement` builds the prompt and calls Gemini directly.
10. The normalized payload returns to WebView.
11. `applyEnhancements(messageId, originalMarkdown, payload)` applies keyed insertions against the original markdown and calls the injected renderer with `skipMermaidProcessing: true`.
12. Per-message enhancement state is updated to `applied`, or reset on failure/no additions.

Initial trace document anchors from `docs/llm_entry_exit_traces.md` identified:

- `toggleEnhancement` -> `requestSenseiEnhancement` -> `applyEnhancementSequence/applyEnhancements` -> `toggleEnhancement`
- `requestSenseiEnhancement` -> `stripJsonFence` -> `normalizeEnhancementEntries` -> `requestSenseiEnhancement`

The final PR-stage trace update now records the route helper, BFF/RN mobile path, and Core-owned prompt/parser custody. The original owner changes were:

- Prompt builder `buildSenseiEnhancementPrompt` moves from `src/prompts.ts` to `core/prompts/enhancement.ts`.
- Provider execution moves out of WebView/mobile and behind BFF/Core for mobile.
- JSON fence handling, parse behavior, and `normalizeEnhancementEntries` move to Core.
- The desktop compatibility wrapper must use Core-owned prompt/parser logic rather than owning duplicate prompt/parser bodies.

Current owners that must stay:

- `toggleEnhancement`
- `stripMermaidBlocks`
- `countWords`, unless it is later proven to belong in structured Core input
- `applyEnhancementSequence`
- `applyEnhancements`
- `removeEnhancements`
- per-message enhancement state and content-drift checks
- markdown rendering and UI active/loading state

Evidence refresh notes from 2026-06-11:

- `src/index.tsx` exposes `senseiWindow.handleEnhanceSenseiMessage = (messageId) => toggleEnhancement(messageId).catch(...)`.
- `src/enhancementManager.ts` imports `GoogleGenAI` and accepts `getAI: () => GoogleGenAI | null` in `EnhancementManagerDeps`.
- `toggleEnhancement` returns early when current per-message status is `loading`, calls `removeEnhancements` when status is `applied`, obtains `latestMarkdown` from `streamingMap`, calls `const ai = getAI()`, sets loading state, strips Mermaid blocks, skips provider work when stripped source is empty, and currently calls `requestSenseiEnhancement(ai, { originalMarkdown: sanitizedSource, wordCount: countWords(sanitizedSource) })`.
- `applyEnhancements` applies normalized entries to the original markdown, not the Mermaid-stripped source. It aborts on content drift when `streamingMap.get(messageId)` differs from the original markdown, resets loading/active state on render failure, and calls `renderMarkdown(..., { skipMermaidProcessing: true })` after insertion.
- `removeEnhancements` is provider-free. It restores `state.originalMarkdown`, checks drift against `state.enhancedMarkdown`, and resets active/loading state.
- Core has prompt/capability precedents and package exports, but no enhancement prompt or capability files. Implementation must add `core/prompts/enhancement.ts`, `core/enhancement.ts`, `core/prompts/index.ts` export, `core/index.ts` export, and `core/package.json` export entries as needed by existing Core package conventions.
- BFF should follow the existing non-stream strict-schema route pattern: route file mounted in `bff/src/server.js`, controller validation with strict Zod schemas, session lookup, cap validation, optional rate limit, service call, generic error response, and provider execution through `CoreLlmAdapter`/`GeminiGateway`.
- RN bridge/BffClient should follow existing request/result transport patterns. `SenseiMobile/src/mobile/MainScreen.tsx` handles `selectionSensei:modalMessageRequest` by calling `bffClient.runSelectionSenseiModalMessage` and enqueuing a result message; WebView routing helpers in `src/mobile/webviewMessageRouter.ts` fail closed when `sendToNative` cannot post to `ReactNativeWebView`.

## Enhancement-Specific Workflow Invariants

The enhancement prompt must be moved verbatim before any prompt-quality edits. The migration must not rewrite, improve, shorten, or reorganize prompt text while moving custody.

The key matching and insertion behavior stays in WebView. Core normalizes enhancement entries, but WebView remains responsible for matching `key` sentences against the original markdown and applying inserts without rewriting existing content.

The sanitized-source/original-application split must be preserved. The model input uses Mermaid-stripped markdown. The apply path targets the original markdown. Tests must prove code and Mermaid blocks are not used as derivation source and are not altered by enhancement application.

Mermaid-only source must skip provider work. If stripping Mermaid blocks leaves no source text, the function resets loading/active state and returns without mobile route or provider execution.

Content drift must remain protected. If the current markdown changes between request start and apply/remove completion, the operation must abort rather than applying stale insertions.

Duplicate clicks and in-flight requests must not duplicate provider work. The current loading state returns early; the migrated mobile path must preserve or strengthen this behavior.

Null, empty, malformed, and invalid payload behavior must leave UI state consistent. Provider failure, parse failure, empty enhancements, and invalid entries must not partially apply UI changes or leave a stuck loading state.

Desktop compatibility must keep Enhance usable in the browser app. Desktop may use a browser provider client during Phase 1, but migrated prompt/parser logic must be canonical in Core.

Mobile bridge-missing behavior must fail closed. A mobile build without the enhancement bridge must not call browser provider code, browser `CoreLlmClient`, or direct provider SDKs.

Trace/status updates must reflect evidence. `docs/llm_entry_exit_traces.md` may be updated with PR-stage evidence during implementation. The master plan must not mark the row complete before review/merge-level evidence.

## Target Architecture

Core will own `core/prompts/enhancement.ts` and `core/enhancement.ts`. These files do not exist yet. The implementation must also expose them through current Core export/package conventions instead of relying on private deep imports.

`core/prompts/enhancement.ts` should export the canonical enhancement prompt builder. It must initially reproduce the old runtime prompt output exactly for representative inputs.

`core/enhancement.ts` should define the provider-agnostic request/result types, call the prompt builder, execute through an injected `CoreLlmClient`, strip JSON fences, parse JSON, normalize entries, and return a deterministic success/failure shape. The exact function names are TBD after current Core naming conventions are verified.

BFF will expose a mobile enhancement route. Candidate route from the compliance protocol shape and current session-scoped BFF conventions is `POST /sessions/:sessionId/enhancement`; exact route/controller/service names remain candidate until the red-test/code slice names them. The BFF route must validate the structured request, apply caps to prompt-rendered fields, reject old prompt-string payloads and arbitrary prompt-control fields, construct the server-side provider adapter, call Core, and return a normalized response without leaking prompts, secrets, or raw learner payloads.

React Native will own transport. Exact bridge event names, BffClient method names, and types remain candidate until the red-test/code slice names them. RN must not build prompts or own provider logic.

WebView will keep `toggleEnhancement` as the feature entry point. Desktop uses a compatibility path backed by Core-owned prompt/parser logic. Mobile uses the structured bridge route and fails closed when the route is unavailable.

## Plan of Work

Milestone 1 fills the evidence gates. Read the required authorities, inspect the current source and tests, run the direct provider authority sweep, and update every compliance table from `NOT_STARTED` or `TBD after current-source verification` to concrete current-source facts. This milestone ends when the Scope Lock, capability matrix, provider sweep, prompt custody ledger, parser ledger, trust-boundary schema, runtime routing plan, boundary audit, and red-test plan are filled enough to safely edit code.

Milestone 2 adds red and parity tests. Add prompt parity fixtures for `buildSenseiEnhancementPrompt`, parser/normalizer fixtures for fenced/unfenced/malformed/empty/invalid response shapes, and negative tests for mobile provider fallback, bridge-missing fail-closed behavior, prompt-string rejection, arbitrary prompt-control rejection, and oversized field rejection. These tests should fail before the migration where they guard old behavior.

Milestone 3 moves Core prompt/parser custody. Create or update `core/prompts/enhancement.ts` and `core/enhancement.ts`. Move prompt text verbatim, move parser/normalizer behavior, wire Core source/package exports, run the Core build, and turn the Core prompt/parser red tests green. Provider-agnostic execution, desktop compatibility wrappers, and duplicate prompt/parser body removal in `src/` are deferred to later slices after the Core exports are green.

Milestone 4 adds BFF and React Native transport. Add the BFF schema, service/controller, route wiring, request validation, caps, timeout/rate-limit/logging behavior, and deterministic BFF positive and negative tests. Then add the RN bridge and BffClient transport. Exact filenames and method names must come from current-source conventions, not from this draft's candidate names.

Milestone 5 is the Mobile Routing Gate. Wire the mobile WebView build to the verified BFF-backed enhancement path. Gate desktop-only local SDK paths with `window.__SENSEI_MOBILE_BUILD__` where applicable. Add bridge-present and bridge-missing tests, including a sentinel test that fails if mobile enhancement uses a browser `CoreLlmClient`, `GoogleGenAI`, or other browser provider path.

Milestone 6 preserves WebView behavior. Update `toggleEnhancement` around the verified mobile route while preserving existing loading/active state, Mermaid stripping, word count semantics, content-drift checks, apply/remove behavior, empty result behavior, and render failure behavior. Confirm duplicate-click, Mermaid-only, provider-failure, parse-failure, and content-drift tests still cover the WebView state machine.

Milestone 7 completes validation and documentation. Run targeted tests, required builds, WebView bundle if `src/` changed, scoped analyzer if risk evidence is needed, and `git diff --check`. Update `docs/llm_entry_exit_traces.md` with evidence or PR-stage status. Do not mark the master plan complete until review/merge evidence supports completion.

## Concrete Steps

All commands run from:

    /Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh

Before implementation, record branch/SHA and dirty-state boundary:

    git status --short
    git rev-parse --abbrev-ref HEAD
    git rev-parse HEAD

For setup, install, build, test, lint, typecheck, validation, or progress-style commands, keep output token-bounded without terminating commands early:

    COMMAND > /tmp/cmd.log 2>&1; rc=$?; tail -c 12000 /tmp/cmd.log; exit $rc

Run the direct provider authority sweep before implementation and before final handoff:

    rg "GoogleGenAI|new GoogleGenAI|Chat\\b|chats\\.create|sendMessageStream|sendMessage\\(|generateContent|generateContentStream|CoreLlmClient|GeminiGateway" src core bff SenseiMobile __tests__

Inspect current route and bridge conventions before naming APIs:

    rg -n "BffClient|bridge|request|selectionSensei|llmStream|wrap|mermaid|analysis|teaching" SenseiMobile/src/mobile src/mobile bff/src core __tests__

Inspect current enhancement tests and source anchors:

    rg -n "toggleEnhancement|requestSenseiEnhancement|buildSenseiEnhancementPrompt|normalizeEnhancementEntries|enhancement" src core bff SenseiMobile __tests__ docs/llm_entry_exit_traces.md docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md

Do not run broad analyzer until candidate scope is narrowed. If analyzer evidence is needed for source impact, read `docs/tooling/analyzer_reference.md` and prefer scoped runs such as:

    npm run analysis:run -- --include src/enhancementManager.ts --include src/geminiService.ts --include src/prompts.ts --include core --include bff --include SenseiMobile/src/mobile

Validation commands are TBD after current package scripts and test filenames are verified. Candidate validation categories are:

- focused Core prompt/parser tests
- focused WebView enhancement manager tests
- BFF validation/service tests
- RN bridge/BffClient tests
- root focused Jest aggregate if existing patterns support it
- `npm run webview:bundle` after any `src/` change
- `git diff --check`

## Validation and Acceptance

Acceptance is behavior-based. After implementation:

1. Desktop web Enhance still works through the compatibility path and uses Core-owned prompt/parser logic.
2. Mobile Enhance with bridge present sends structured context through RN/BFF/Core and returns normalized enhancement payloads.
3. Mobile Enhance with bridge missing fails closed and resets UI loading state without browser provider fallback.
4. Mobile direct-provider sentinel proves no browser `GoogleGenAI`, browser provider SDK, or browser `CoreLlmClient` is used for migrated enhancement.
5. Prompt parity proves `buildSenseiEnhancementPrompt` moved verbatim for representative inputs.
6. Parser/normalizer parity proves fenced JSON, unfenced JSON, invalid entries, empty enhancements, metadata behavior, and malformed JSON preserve intended behavior.
7. BFF rejects prompt strings, arbitrary prompt-control fields, oversized prompt-rendered fields, invalid arrays, and aggregate oversized payloads before provider execution.
8. Mermaid/code preservation tests prove prompt source stripping and original markdown application do not mutate Mermaid or code blocks.
9. Duplicate-click/in-flight tests prove provider work is not duplicated and UI state is not corrupted.
10. Provider failure and parse failure tests prove no partial UI apply, no stuck loading state, and no raw prompt/learner payload leakage.

The implementation is not acceptable unless Core/BFF returns normalized enhancement entries or a normalized failure shape, not final rendered markdown. WebView must remain the only owner of matching keys against original markdown and applying insertions.

The implementation is not acceptable unless source-custody validation distinguishes source files from generated bundle output. Generated WebView bundle checks may prove the shipped bundle is current, but they must not be used to prove source ownership of prompt or provider logic.

The implementation is not acceptable unless failure-path tests cover provider failure, malformed JSON, empty enhancement arrays, all-invalid entries, bridge-missing mobile routing, and content drift without leaving loading state stuck or applying partial markdown.

Live provider smoke may be useful after deterministic validation, but it is not deterministic correctness proof and may be blocked by credentials, quota, network, or provider safety behavior. If smoke is unavailable, record the blocker and do not substitute it for unit/integration tests.

## Idempotence and Recovery

The migration should be additive until tests prove the new path. Add Core prompt/capability code and tests before removing old prompt/parser ownership from `src/`.

If prompt parity fails, stop and inspect whether the prompt text changed. Do not "fix" parity by updating the expected fixture unless the user explicitly approves a prompt change.

If mobile routing tests fail, do not fall back to browser provider execution. Preserve fail-closed behavior and update this ExecPlan with the failed boundary.

If generated WebView bundle output changes after `npm run webview:bundle`, inspect the diff and record whether it is expected. Do not treat `SenseiMobile/app_web/webview_dist/` as source of truth.

If unrelated dirty files exist, leave them untouched. This plan currently observes unrelated untracked files under `docs/execplans/`; they are outside this artifact's scope.

## Artifacts and Notes

Current key evidence from planning:

- Master plan row `Enhancement request`: `src/enhancementManager.ts:toggleEnhancement` -> `src/geminiService.ts:requestSenseiEnhancement`; remaining work is moving prompt builder, JSON fence stripping, and payload normalization to Core; adding BFF and mobile bridge route; keeping `applyEnhancementSequence` and `applyEnhancements` in WebView.
- Master plan row `Sensei enhancement wrapper`: `src/geminiService.ts:requestSenseiEnhancement`; remaining work is replacing direct provider/parsing ownership with a compatibility wrapper around `core/enhancement.ts` for desktop and routing mobile through the enhancement BFF path.
- Trace doc identifies `toggleEnhancement` as the feature entry path and `requestSenseiEnhancement` as the LLM-facing wrapper path.
- Current source shows `toggleEnhancement` obtains `getAI()` and calls `requestSenseiEnhancement(ai, ...)`.
- Current source shows `requestSenseiEnhancement` calls `ai.models.generateContent(...)`.

Trace/status policy:

- `docs/llm_entry_exit_traces.md` may be updated during implementation only with concrete evidence or an explicit PR-stage label.
- `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md` must not mark the enhancement rows complete during draft-only planning or before review/merge evidence.

Prompt hash policy:

- Compute hashes from runtime prompt outputs, not partial template fragments.
- Use representative fixtures including ordinary teaching markdown, code/Mermaid-heavy markdown, quote-heavy content, and a no-useful-enhancement scenario where applicable.

## Interfaces and Dependencies

Final names must be verified from current source before implementation. Candidate names below are design placeholders, not source-verified APIs unless explicitly marked verified.

Core prompt module:

    core/prompts/enhancement.ts

Expected responsibility: export the canonical enhancement prompt builder previously owned by `src/prompts.ts:buildSenseiEnhancementPrompt`.

Core capability module:

    core/enhancement.ts

Expected responsibility: define enhancement request/result types, normalize provider responses, execute through injected `CoreLlmClient`, and expose helper functions for deterministic parser tests.

BFF route:

    Candidate: POST /sessions/:sessionId/enhancement

This candidate is derived from the migration compliance route shape and is consistent with current session-scoped BFF route conventions. The final route/controller/service names must be agreed in the red-test/code slice and implemented through current BFF mounting conventions.

React Native transport:

    TBD after current-source verification

Expected responsibility: bridge structured WebView enhancement requests to BffClient and return normalized success/failure results. Current bridge and BffClient conventions are verified, but exact enhancement message and method names are still TBD. RN must not build prompts or own provider execution.

WebView routing:

    src/enhancementManager.ts

Expected responsibility: keep `toggleEnhancement` as orchestration, choose desktop compatibility or mobile structured route based on runtime, fail closed when mobile bridge is missing, and apply normalized payloads through existing WebView behavior.

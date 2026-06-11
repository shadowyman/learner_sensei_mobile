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
- Status: NOT_STARTED

### Scope Lock

| Field | Required Answer | Status |
|---|---|---|
| Backlog row | `Enhancement request` and `Sensei enhancement wrapper` | NOT_STARTED |
| Current direct provider entry | `src/geminiService.ts:requestSenseiEnhancement` calls `ai.models.generateContent(...)`; `src/enhancementManager.ts:toggleEnhancement` currently obtains `getAI()` and passes the provider client into that wrapper | NOT_STARTED |
| Prompt owner after migration | `core/prompts/enhancement.ts` | NOT_STARTED |
| Core capability after migration | `core/enhancement.ts` | NOT_STARTED |
| BFF owner | Candidate: `POST /sessions/:sessionId/enhancement`, candidate from the LLM migration compliance protocol shape; exact route/controller/service names are TBD after current-source verification | NOT_STARTED |
| RN bridge owner | TBD after current-source verification of existing bridge event and BffClient naming conventions | NOT_STARTED |
| WebView owner | `src/enhancementManager.ts:toggleEnhancement`, `applyEnhancementSequence`, `applyEnhancements`, `removeEnhancements`, `stripMermaidBlocks`, `countWords`, loading/active state, per-message state, markdown render/application behavior | NOT_STARTED |
| Parser/normalizer owner | Core: JSON fence handling, JSON parse handling, `normalizeEnhancementEntries` behavior, `EnhancementPayload` result semantics | NOT_STARTED |
| Desktop compatibility path | Browser compatibility wrapper using Core-owned prompt/parser logic and a browser `CoreLlmClient`; exact wrapper shape TBD after source verification | NOT_STARTED |
| Mobile path | Structured WebView -> RN -> BffClient -> BFF -> Core -> provider route; exact event/method names TBD after source verification | NOT_STARTED |
| Reload/retry path | Enhancement has toggle/apply/remove behavior and content-drift checks, not a known reload stream path. Any retry or duplicate-click path must remain migrated on mobile and must not fall back to browser provider execution. | NOT_STARTED |
| Cache/placeholder path | Key-takeaway enhancer cache and placeholder behavior are out of scope. Enhancement per-message state remains WebView-owned. | NOT_STARTED |
| Explicitly out of scope | Key-takeaway enhancement, pedagogical directive generation, legacy generic BFF turn stream retirement, Selection Sensei, broad WebView business-logic migration, generic frontend LLM gateway, prompt-quality rewriting | NOT_STARTED |

### Capability x Mode x Lifecycle Matrix

| Capability | Mode | Invocation | Runtime | Required Behavior | Forbidden Behavior | Test | Status |
|---|---|---|---|---|---|---|---|
| Enhancement request | normal invocation | Enhance control calls `toggleEnhancement(messageId)` | desktop and mobile | Preserve existing apply behavior; mobile routes structured context to BFF/Core | mobile browser provider execution | TBD after test inventory | NOT_STARTED |
| Enhancement request | remove invocation | current state is `applied`; `toggleEnhancement` calls `removeEnhancements` | desktop and mobile | Restore original markdown and state without provider call | provider call on removal | TBD after test inventory | NOT_STARTED |
| Enhancement request | duplicate/in-flight request | current state is `loading` | desktop and mobile | Return early and avoid duplicate provider work | duplicate provider requests for same message | TBD after test inventory | NOT_STARTED |
| Enhancement request | bridge present | WebView has mobile bridge route | mobile | WebView -> RN -> BffClient -> BFF -> Core -> provider | browser SDK or browser `CoreLlmClient` | TBD after bridge source verification | NOT_STARTED |
| Enhancement request | bridge missing | mobile build lacks required bridge | mobile | fail closed with structured enhancement failure and reset loading state | browser provider fallback | TBD after bridge source verification | NOT_STARTED |
| Enhancement request | desktop web | browser app uses compatibility path | desktop | Core-owned prompt/parser with browser provider client | mobile route assumptions | TBD after source verification | NOT_STARTED |
| Enhancement request | Mermaid-only source | `stripMermaidBlocks(originalMarkdown)` is empty | desktop and mobile | skip request, reset loading/active state | provider call with empty prompt source | TBD after test inventory | NOT_STARTED |
| Enhancement request | Mermaid/code source | prompt input uses stripped source; application targets original markdown | desktop and mobile | do not alter code or Mermaid blocks; apply only matched text additions | derive from or rewrite code/Mermaid blocks | TBD after fixture design | NOT_STARTED |
| Enhancement request | content drift | baseline markdown changes before apply/remove completes | desktop and mobile | abort apply/remove and reset state consistently | partial stale insertion | TBD after test inventory | NOT_STARTED |
| Sensei enhancement wrapper | provider success | provider returns JSON or fenced JSON | desktop and BFF/Core | Core parses and normalizes payload | parser duplicated in `src/` or BFF | TBD after parser parity fixture | NOT_STARTED |
| Sensei enhancement wrapper | provider failure | provider throws | desktop and mobile | normalized null/failure result that leaves UI state consistent | echo raw learner content or prompt | TBD after service test design | NOT_STARTED |
| Sensei enhancement wrapper | malformed provider output | invalid JSON or invalid entry shapes | desktop and mobile | Core rejects/normalizes without partial UI mutation | raw parse failure escaping Core | TBD after parser fixture | NOT_STARTED |
| Sensei enhancement wrapper | empty enhancements | payload contains no usable entries | desktop and mobile | reset loading/active state; no markdown mutation | partial apply | TBD after test inventory | NOT_STARTED |
| Sensei enhancement wrapper | malformed client payload | invalid structured request to BFF | mobile | BFF rejects before provider call | provider call | TBD after BFF validation tests | NOT_STARTED |
| Sensei enhancement wrapper | oversized prompt-rendered field | large `originalMarkdown` or aggregate payload | mobile | BFF rejects before prompt/provider | prompt construction/provider call | TBD after cap policy verification | NOT_STARTED |
| Sensei enhancement wrapper | old prompt-string payload | client sends prompt/finalPrompt/promptText-like fields | mobile | BFF rejects | Core/provider accepts prompt string | TBD after BFF validation tests | NOT_STARTED |
| Sensei enhancement wrapper | arbitrary prompt-control field | client sends model/config/control override | mobile | BFF rejects or ignores according to validated schema | client controls model/config/prompt behavior | TBD after BFF validation tests | NOT_STARTED |
| Sensei enhancement wrapper | mobile direct-provider sentinel | mobile build path for enhancement | mobile | no `GoogleGenAI`, browser `CoreLlmClient`, or browser provider call | browser provider execution | TBD after sentinel test design | NOT_STARTED |

### Direct Provider Authority Sweep

Search command:

    rg "GoogleGenAI|new GoogleGenAI|Chat\\b|chats\\.create|sendMessageStream|sendMessage\\(|generateContent|generateContentStream|CoreLlmClient|GeminiGateway" src core bff SenseiMobile __tests__

When filling the sweep ledger, exclude generated output such as `SenseiMobile/app_web/webview_dist/**` from source-ownership conclusions, or classify those hits separately as generated-bundle evidence. Source ownership must be determined from `src/`, `core/`, `bff/`, `SenseiMobile/src/mobile/`, and tests.

| Hit | File | Classification | Action | Status |
|---|---|---|---|---|
| `GoogleGenAI` dependency and `getAI()` use in enhancement manager | `src/enhancementManager.ts` | must-fix for migrated mobile enhancement route; desktop compatibility may remain through a Core browser client path | Replace mobile path with structured route and fail closed when bridge is missing; preserve WebView state behavior | NOT_STARTED |
| `requestSenseiEnhancement` direct `ai.models.generateContent(...)` | `src/geminiService.ts` | must-fix for paired wrapper row | Move provider execution behind Core/BFF for mobile; make wrapper a desktop compatibility path around Core-owned logic | NOT_STARTED |
| Other provider hits | `src`, `core`, `bff`, `SenseiMobile`, `__tests__` | TBD after full sweep | Classify as desktop-only, unmigrated sibling backlog, test-only, BFF server provider execution, or must-fix | NOT_STARTED |

### Prompt Custody Ledger

| Prompt Symbol / Builder | Old File | Old Runtime Length | Old SHA-256 | New File | New Runtime Length | New SHA-256 | Parity Test | Status |
|---|---|---:|---|---|---:|---|---|---|
| `buildSenseiEnhancementPrompt(originalMarkdown)` | `src/prompts.ts` | TBD after runtime fixture generation | TBD after runtime fixture generation | `core/prompts/enhancement.ts` | TBD after migration | TBD after migration | TBD after current test layout verification | NOT_STARTED |

### Parser / Normalizer Custody Ledger

| Parser / Normalizer | Old File | Core Destination | Input Fixture | Output Fixture | Parity Test | Status |
|---|---|---|---|---|---|---|
| JSON fence stripping used by enhancement response path | `src/geminiService.ts:stripJsonFence` | `core/enhancement.ts` or a Core helper imported by it | fenced JSON, unfenced JSON, non-fenced text | cleaned JSON text or normalized failure | TBD after test inventory | NOT_STARTED |
| Enhancement response JSON parse behavior | `src/geminiService.ts:requestSenseiEnhancement` | `core/enhancement.ts` | valid JSON, malformed JSON, empty response text | normalized payload or null/failure result | TBD after test inventory | NOT_STARTED |
| Enhancement entry normalization | `src/geminiService.ts:normalizeEnhancementEntries` | `core/enhancement.ts` | valid entries, invalid entries, missing fields, metadata object | `EnhancementPayload` with only usable entries and metadata behavior preserved | TBD after test inventory | NOT_STARTED |

### Boundary Invariant Ledger

| Invariant | Applies To | Forbidden Behavior | Positive Test | Negative Test | Status |
|---|---|---|---|---|---|
| Mobile migrated runtime does not call provider directly | Mobile enhancement route | `GoogleGenAI`, browser SDK, or browser `CoreLlmClient` from mobile route | TBD | TBD | NOT_STARTED |
| Mobile migrated runtime does not send final prompt strings | WebView/RN/BFF request | prompt/finalPrompt/promptText payload accepted | TBD | TBD | NOT_STARTED |
| Mobile structured request fails closed when bridge is unavailable | WebView enhancement route | browser provider fallback | TBD | TBD | NOT_STARTED |
| Core owns prompt construction | Enhancement prompt | prompt body remains in `src/` or BFF | TBD | TBD | NOT_STARTED |
| BFF owns provider execution | Mobile route | WebView provider execution | TBD | TBD | NOT_STARTED |
| BFF rejects old prompt-string payloads | BFF validation | provider call with prompt string | TBD | TBD | NOT_STARTED |
| BFF rejects arbitrary prompt-control values | BFF validation | client model/config override | TBD | TBD | NOT_STARTED |
| BFF caps every prompt-rendered string | `originalMarkdown` and any structured text fields | provider call with oversized text | TBD | TBD | NOT_STARTED |
| BFF caps arrays and aggregate structured payload size | BFF validation | oversized arrays or aggregate payload | TBD | TBD | NOT_STARTED |
| Parser behavior is Core-owned and parity-tested | JSON fence/parse/normalizer path | parser duplicated in WebView or BFF | TBD | TBD | NOT_STARTED |
| Desktop compatibility still works | Desktop web wrapper | desktop route broken by mobile migration | TBD | TBD | NOT_STARTED |
| UI/state mutation remains in WebView | `toggleEnhancement`, apply/remove behavior | BFF or Core mutates UI/render state | TBD | TBD | NOT_STARTED |
| Reload/retry paths use the migrated route | Duplicate/in-flight/toggle paths | retry falls back to browser provider on mobile | TBD | TBD | NOT_STARTED |
| Provider failure does not echo learner text | BFF/Core errors and logs | raw prompt, API key, or learner payload in response/logs | TBD | TBD | NOT_STARTED |
| Cache key and prompt-hash behavior is preserved | Not a cache-backed enhancement path in current source; per-message state remains WebView-owned | key-takeaway cache accidentally migrated here | TBD | TBD | NOT_STARTED |
| No generic frontend LLM gateway is introduced | WebView | `src/llmGateway.ts` generic abstraction as substitute for BFF route | TBD | TBD | NOT_STARTED |
| No prompt body is introduced in BFF | BFF route/service | prompt text in BFF | TBD | TBD | NOT_STARTED |
| No second prompt copy remains in `src/` after migration | `src/prompts.ts` | duplicate migrated prompt body | TBD | TBD | NOT_STARTED |
| Logs avoid secrets, full prompts, API keys, and raw learner payloads | WebView/BFF/Core logs | leaking raw prompt/provider payload | TBD | TBD | NOT_STARTED |
| Duplicate request cannot duplicate provider work | Loading/in-flight state and server idempotency if needed | duplicate provider call for same message | TBD | TBD | NOT_STARTED |
| Client disconnect/abort stops provider work | BFF route, if applicable to non-stream request | provider work continues unnecessarily | TBD | TBD | NOT_STARTED |
| Terminal completion/error events are deterministic | Non-stream result path and bridge response | hanging loading state | TBD | TBD | NOT_STARTED |
| Chunk order is preserved | Not applicable to this non-stream enhancement route unless implementation introduces streaming | streaming-specific assertion treated as required without design basis | N/A unless route streams | N/A unless route streams | NOT_STARTED |
| Timeout behavior matches provider/task duration | BFF route and client transport | unrelated shorter timeout aborts normal enhancement | TBD | TBD | NOT_STARTED |
| Sanitized source and original application remain split | WebView apply path | Core/BFF applies insertions against sanitized source or mutates Mermaid/code blocks | prompt fixture proves Mermaid-stripped source is sent; WebView test proves original markdown application preserves Mermaid/code | test fails if Mermaid/code block text is altered or used as derivation source | NOT_STARTED |
| Key matching remains WebView-owned | WebView apply path | Core/BFF rewrites message markdown or applies insertions directly | WebView applies normalized entries to original markdown | test fails if Core/BFF returns rendered markdown instead of normalized entries | NOT_STARTED |
| Null/failure result clears loading state without partial apply | WebView response handling | provider failure, parse failure, or empty result leaves active/loading state stuck or applies partial markdown | WebView failure-path test resets loading/active state | test fails on stuck loading, active state, or mutated markdown after failure | NOT_STARTED |
| Generated bundle is validation evidence, not source custody | WebView bundle validation | generated bundle direct-provider hits are classified as source owners | source sweep excludes or separately classifies generated output | test/review fails if source ownership is inferred from `webview_dist` | NOT_STARTED |

### Trust-Boundary Schema Plan

| Field | Prompt Rendered? | Controls Prompt Behavior? | Type | Max Length | Enum/Union? | Required? | Sanitized? | Test | Status |
|---|---|---|---|---:|---|---|---|---|---|
| `originalMarkdown` or renamed structured source field | yes | indirectly, as content to enhance | string | TBD after cap policy verification | no | yes | BFF must validate length; WebView strips Mermaid before sending according to current behavior | TBD | NOT_STARTED |
| `wordCount` | no, based on current source use as logging/metadata only | no unless source verification finds otherwise | number | TBD | no | no, unless retained for telemetry/context | numeric validation if retained | TBD | NOT_STARTED |
| message/session identity fields | no | no | strings/ids | TBD after route conventions verified | no | yes for mobile request context | route/session validation | TBD | NOT_STARTED |
| prompt/model/config overrides | n/a | forbidden | n/a | n/a | n/a | no | reject if present | TBD | NOT_STARTED |

### Runtime Routing Plan

| Runtime | Bridge Present? | Structured Request Present? | Expected Path | Forbidden Path | Test | Status |
|---|---|---|---|---|---|---|
| Desktop web | no | optional | desktop compatibility wrapper/Core browser client | mobile route assumptions | TBD | NOT_STARTED |
| Mobile WebView | yes | yes | WebView -> RN -> BffClient -> BFF -> Core -> provider | browser provider SDK or browser `CoreLlmClient` | TBD | NOT_STARTED |
| Mobile WebView | no | yes | fail closed with structured error and loading-state cleanup | browser provider SDK or browser `CoreLlmClient` | TBD | NOT_STARTED |
| Mobile WebView | yes | old prompt-string payload | BFF rejects | Core/provider call | TBD | NOT_STARTED |
| Test/local | explicit fake | yes | deterministic fake provider/Core client | silent fallback unless test expects it | TBD | NOT_STARTED |

### Boundary Contract Audit

| Boundary | Source field/behavior | Destination field/behavior | Required transformation | Forbidden drift | Evidence/Test | Status |
|---|---|---|---|---|---|---|
| WebView UI/state -> React Native bridge | sanitized source, word count if retained, message/session context | structured enhancement request | no prompt string, no provider client | sending final prompt or raw provider config | TBD | NOT_STARTED |
| React Native bridge -> BffClient | bridge event payload | BffClient method payload | transport only | prompt construction in RN | TBD | NOT_STARTED |
| BffClient -> BFF route/controller | structured request | HTTP request | auth/session/caps/error mapping | browser/provider fallback | TBD | NOT_STARTED |
| BFF controller/service -> Core capability request | validated request | Core request type | cap-checked prompt-rendered fields | BFF prompt body | TBD | NOT_STARTED |
| Core capability -> prompt/provider request | Core request and prompt builder | provider request via injected `CoreLlmClient` | canonical prompt, model/task defaults not controlled by mobile | duplicate prompt in `src` or BFF | TBD | NOT_STARTED |
| provider response -> Core parser/normalizer | provider text | normalized enhancement payload or null/failure | JSON fence removal, parse, entry normalization | raw parse failure or partial unvalidated entries | TBD | NOT_STARTED |
| Core/BFF response -> React Native/WebView UI state | normalized payload/failure | WebView apply/reset behavior | deterministic success/failure shape | hanging loading state or partial apply | TBD | NOT_STARTED |
| Timeout budget parity | provider task duration | BFF/client timeout | route-specific timeout | unrelated shorter timeout | TBD | NOT_STARTED |
| BFF route operational parity | service config/logging/rate limits | enhancement route behavior | server-owned provider execution | missing rate limit/config/logging/failure behavior | TBD | NOT_STARTED |
| State continuity paths | message state, original/enhanced markdown, content drift | apply/remove behavior | preserve WebView state machine | dropped original markdown or stale insertion | TBD | NOT_STARTED |

### Red-Test Gate

| Red Test | Expected Old Failure | Added? | Status |
|---|---|---|---|
| Prompt parity | prompt moves without proof of exact runtime text | no | NOT_STARTED |
| Parser parity | parser moved/changed without fixture proof | no | NOT_STARTED |
| Mobile direct-provider negative test | mobile path can call browser provider | no | NOT_STARTED |
| Mobile bridge-missing fail-closed test | mobile route falls back to browser provider or hangs | no | NOT_STARTED |
| BFF rejects old prompt-string payload | BFF accepts final prompt text | no | NOT_STARTED |
| BFF rejects arbitrary prompt-control field | BFF accepts model/config/prompt controls from mobile | no | NOT_STARTED |
| BFF rejects oversized prompt-rendered fields | oversized input reaches prompt/provider | no | NOT_STARTED |
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
| Prompt parity | SHA/length test passes for representative enhancement prompt outputs | NOT_STARTED |
| Parser parity | JSON fence/parse/normalizer fixture tests pass | NOT_STARTED |
| Mobile routing | WebView/RN/BffClient route test passes | NOT_STARTED |
| No browser provider on mobile | fail-closed sentinel passes | NOT_STARTED |
| BFF rejects prompt strings | deterministic negative test passes | NOT_STARTED |
| BFF caps prompt fields | oversized-field tests pass | NOT_STARTED |
| BFF validates control fields | arbitrary prompt-control rejection test passes | NOT_STARTED |
| Desktop compatibility | wrapper tests pass | NOT_STARTED |
| Duplicate/in-flight path | duplicate click/in-flight test passes | NOT_STARTED |
| Mermaid/source application path | Mermaid-stripped-source/original-application test passes | NOT_STARTED |
| Provider failure | non-echo normalized failure test passes | NOT_STARTED |
| Deterministic BFF integration | route/service test passes | NOT_STARTED |
| Live provider smoke | passes or provider/quota blocker recorded; not a deterministic correctness substitute | NOT_STARTED |
| WebView bundle | `npm run webview:bundle` passes if `src/` changed | NOT_STARTED |
| Analyzer | scoped analyzer completed if risk/trace evidence is needed | NOT_STARTED |
| Diff hygiene | `git diff --check` passes | NOT_STARTED |
| Trace update | `docs/llm_entry_exit_traces.md` updated only with evidence or PR-stage label | NOT_STARTED |
| Master status | updated only after review/merge evidence or marked PR-stage; never during draft-only planning | NOT_STARTED |

### Review Remediation Ledger

| Review Finding | Invariant | Sibling Sweep | Regression Test | Fix Commit | Reply/Resolve Status |
|---|---|---|---|---|---|
| None yet | n/a | n/a | n/a | n/a | n/a |

### Final Migration Evidence

Backlog row: `Enhancement request` plus `Sensei enhancement wrapper`.

Old entry point: `src/enhancementManager.ts:toggleEnhancement` -> `src/geminiService.ts:requestSenseiEnhancement`.

Core prompt file: `core/prompts/enhancement.ts`.

Core capability file: `core/enhancement.ts`.

BFF route: TBD after current-source route naming verification. Candidate from protocol shape: `POST /sessions/:sessionId/enhancement`.

RN bridge method: TBD after current-source verification.

WebView compatibility wrapper: TBD after current-source verification.

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
- [ ] Mobile Routing Gate: implement and validate BFF-backed mobile enhancement routing, gate desktop-only local SDK paths with `window.__SENSEI_MOBILE_BUILD__`, and add a sentinel test proving mobile cannot use a browser `CoreLlmClient` or browser provider SDK for enhancement.
- [ ] Fill all compliance ledgers with current-source evidence before implementation.
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

Trace document anchors from `docs/llm_entry_exit_traces.md` currently identify:

- `toggleEnhancement` -> `requestSenseiEnhancement` -> `applyEnhancementSequence/applyEnhancements` -> `toggleEnhancement`
- `requestSenseiEnhancement` -> `stripJsonFence` -> `normalizeEnhancementEntries` -> `requestSenseiEnhancement`

Current owners that must change:

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

Core will own `core/prompts/enhancement.ts` and `core/enhancement.ts`.

`core/prompts/enhancement.ts` should export the canonical enhancement prompt builder. It must initially reproduce the old runtime prompt output exactly for representative inputs.

`core/enhancement.ts` should define the provider-agnostic request/result types, call the prompt builder, execute through an injected `CoreLlmClient`, strip JSON fences, parse JSON, normalize entries, and return a deterministic success/failure shape. The exact function names are TBD after current Core naming conventions are verified.

BFF will expose a mobile enhancement route. Candidate route from the compliance protocol shape is `POST /sessions/:sessionId/enhancement`; exact route/controller/service names are TBD after current-source verification. The BFF route must validate the structured request, apply caps to prompt-rendered fields, reject old prompt-string payloads and arbitrary prompt-control fields, construct the server-side provider adapter, call Core, and return a normalized response without leaking prompts, secrets, or raw learner payloads.

React Native will own transport. Exact bridge event names, BffClient method names, and types are TBD after current-source verification. RN must not build prompts or own provider logic.

WebView will keep `toggleEnhancement` as the feature entry point. Desktop uses a compatibility path backed by Core-owned prompt/parser logic. Mobile uses the structured bridge route and fails closed when the route is unavailable.

## Plan of Work

Milestone 1 fills the evidence gates. Read the required authorities, inspect the current source and tests, run the direct provider authority sweep, and update every compliance table from `NOT_STARTED` or `TBD after current-source verification` to concrete current-source facts. This milestone ends when the Scope Lock, capability matrix, provider sweep, prompt custody ledger, parser ledger, trust-boundary schema, runtime routing plan, boundary audit, and red-test plan are filled enough to safely edit code.

Milestone 2 adds red and parity tests. Add prompt parity fixtures for `buildSenseiEnhancementPrompt`, parser/normalizer fixtures for fenced/unfenced/malformed/empty/invalid response shapes, and negative tests for mobile provider fallback, bridge-missing fail-closed behavior, prompt-string rejection, arbitrary prompt-control rejection, and oversized field rejection. These tests should fail before the migration where they guard old behavior.

Milestone 3 moves Core custody. Create or update `core/prompts/enhancement.ts` and `core/enhancement.ts`. Move prompt text verbatim, move parser/normalizer behavior, and expose provider-agnostic capability execution through an injected Core client. Update desktop compatibility wrappers without leaving duplicate prompt/parser bodies in `src/`.

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

This candidate is derived from the migration compliance route shape, not yet verified against current BFF route conventions. The final route/controller/service names must be verified before code edits.

React Native transport:

    TBD after current-source verification

Expected responsibility: bridge structured WebView enhancement requests to BffClient and return normalized success/failure results. RN must not build prompts or own provider execution.

WebView routing:

    src/enhancementManager.ts

Expected responsibility: keep `toggleEnhancement` as orchestration, choose desktop compatibility or mobile structured route based on runtime, fail closed when mobile bridge is missing, and apply normalized payloads through existing WebView behavior.

# LLM Migration Compliance Protocol

This protocol is the detailed reference for the repo-local
`llm-migration-compliance` skill. The skill stays compact so it is likely to be
followed; this document carries the expanded gates, ledgers, and backlog-specific
instructions.

The master plan remains the authority:
`docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`.

## Core Rule

Mobile migrated runtime must not own prompt text or provider execution.

Core owns migrated prompt construction, prompt-control vocabulary, pure response
parsers, response normalizers, provider-agnostic capability types, and tool or
schema descriptions that shape provider output. BFF owns server-side provider
execution, server secrets, runtime validation, rate limiting, fallback policy,
telemetry, and mobile HTTP/WebSocket routes. React Native owns transport only.
WebView owns UI rendering, selection/transcript state, DOM insertion, overlays,
placeholders, cache coordination when UI-owned, and teaching-state
orchestration.

Desktop fallback and mobile fallback are separate. Preserving desktop direct
Gemini or browser compatibility never permits mobile migrated structured
requests to fall back to browser provider execution.

## Non-Negotiable Rules

- Prompt text moves verbatim first.
- Prompt cleanup, paraphrase, formatting improvement, or prompt-quality change
  is not part of a migration unless the user explicitly approves it.
- Every migrated prompt body lives in `core/prompts/<capability>.ts`.
- `src/prompts.ts` may re-export or delegate, but it must not keep a second
  migrated prompt body.
- BFF must never contain prompt bodies.
- Mobile sends structured domain inputs, not final prompt strings or large
  prompt fragments under alternate field names.
- Mobile migrated runtime must not call provider SDKs, browser Gemini chats,
  browser `CoreLlmClient`, or `chat.sendMessageStream`.
- Mobile bridge missing means fail closed with a structured error.
- BFF must validate prompt-rendered size and prompt-control semantics before
  storing or passing payloads to Core.
- Positive happy-path tests are insufficient. Every migration needs negative
  tests for forbidden behavior.
- Review remediation must sweep sibling paths and sibling modes.

## Required Authority Stack

Before Full Migration Mode code changes, read:

1. `AGENTS.md`
2. `docs/protocols/PLAN.md`
3. `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`
4. `docs/llm_entry_exit_traces.md`
5. the active backlog-specific ExecPlan, or create one if absent
6. existing tests around the old direct LLM path
7. `docs/templates/llm_migration_compliance_block.md`

## ExecPlan Compliance Block

Create or update an "LLM Migration Compliance Block" near the top of the active
ExecPlan, before the long append-only progress log. Keep unresolved gates
visible.

Required block sections:

1. Scope Lock
2. Capability x Mode x Lifecycle Matrix
3. Direct Provider Authority Sweep
4. Prompt Custody Ledger
5. Parser / Normalizer Custody Ledger
6. Boundary Invariant Ledger
7. Trust-Boundary Schema Plan
8. Runtime Routing Plan
9. Red-Test Gate
10. Test Gate Ledger
11. Boundary Contract Audit
12. Review Remediation Ledger
13. Final Migration Evidence Block

Allowed row statuses:

- `NOT_STARTED`
- `RED_TEST_ADDED`
- `IMPLEMENTED`
- `GREEN`
- `DEFERRED_USER_APPROVED`
- `BLOCKED`

No implementation code may be edited until Scope Lock, Capability Matrix,
Direct Provider Authority Sweep, Prompt Custody Ledger, Parser/Normalizer
Ledger, Boundary Invariant Ledger, Trust-Boundary Schema Plan, and Runtime
Routing Plan are filled.

## Phase 0: Activation

Before touching code:

1. Read the required authority stack.
2. Identify the exact master-plan backlog row.
3. Search the repo for the current entry point and related direct provider
   calls.
4. Create or update the backlog-specific ExecPlan.
5. Add the active compliance block near the top.
6. Stop if the master-plan row cannot be identified.

The first implementation report must state the selected backlog item, current
source entry point, required Core prompt file, required Core capability file,
required BFF route, required RN bridge method, WebView UI/state code that stays
in WebView, parser/normalizer code that moves to Core, and related direct LLM
paths explicitly out of scope.

## Phase 1: Scope Lock

Fill this table completely before code edits.

| Field | Required Answer |
|---|---|
| Backlog row | Exact row from master plan |
| Current direct provider entry | Exact function/file |
| Prompt owner after migration | `core/prompts/<capability>.ts` |
| Core capability after migration | `core/<capability>.ts` |
| BFF owner | Endpoint/service/controller |
| RN bridge owner | Bridge contract and `BffClient` method |
| WebView owner | UI/orchestration functions that remain |
| Parser/normalizer owner | Core file/function |
| Desktop compatibility path | Browser Core client or existing wrapper |
| Mobile path | Structured BFF route |
| Reload/retry path | How it stays migrated |
| Cache/placeholder path | What remains WebView-owned |
| Explicitly out of scope | Related direct LLM calls not migrated in this PR |

Stop if any cell is unknown.

## Phase 2: Capability x Mode x Lifecycle Matrix

Enumerate every invocation path. Do not use a one-row capability table.

| Capability | Mode | Invocation | Runtime | Required Behavior | Forbidden Behavior | Test |
|---|---|---|---|---|---|---|
| | | | | | | |

Include applicable rows for normal invocation, reload or retry, bridge present,
bridge missing, desktop web, provider success, provider failure, malformed
provider output, malformed client payload, duplicate or in-flight request, cache
hit, cache miss, UI insertion/rendering path, parser failure, oversized
prompt-rendered field, old prompt-string payload, mobile direct-provider
sentinel, duplicate stream request, client disconnect or abort, deterministic
terminal completion/error, chunk ordering, and timeout behavior.

## Phase 3: Direct Provider Authority Sweep

Run before implementation and again before final commit, then record every hit.

```bash
rg "GoogleGenAI|new GoogleGenAI|Chat\\b|chats\\.create|sendMessageStream|sendMessage\\(|generateContent|generateContentStream|CoreLlmClient|GeminiGateway" src core bff SenseiMobile __tests__
```

Classify every hit:

| Hit | File | Classification | Action |
|---|---|---|---|
| | | desktop-only / unmigrated backlog / test-only / must-fix | |

Stop if a migrated mobile path can still reach direct provider execution.

## Phase 4: Prompt Custody Ledger

Before moving prompt text, compute runtime-exported old prompt hashes. Do not
hash partial raw template bodies unless that exact raw body is the actual
provider input.

| Prompt Symbol / Builder | Old File | Old Runtime Length | Old SHA-256 | New File | New Runtime Length | New SHA-256 | Parity Test | Status |
|---|---|---:|---|---|---:|---|---|---|
| | | | | | | | | |

Rules:

- compute hashes from representative runtime outputs
- use exact old input fixtures
- move prompt text verbatim first
- do not improve prompts in the same migration
- make `src/prompts.ts` a facade after migration
- add a golden parity test before route work

Stop if SHA cannot be computed or old prompt ownership is unclear.

## Phase 5: Parser / Normalizer Custody Ledger

Move pure LLM response parsing and normalization to Core. Keep UI formatting,
modal rendering, DOM insertion, and application side effects in WebView.

| Parser / Normalizer | Old File | Core Destination | Input Fixture | Output Fixture | Parity Test | Status |
|---|---|---|---|---|---|---|
| | | | | | | |

Stop if parser behavior is still duplicated between `src/` and Core after
migration.

## Phase 6: Boundary Invariant Ledger

This ledger is the main protection against review churn.

| Invariant | Applies To | Forbidden Behavior | Positive Test | Negative Test | Status |
|---|---|---|---|---|---|
| | | | | | |

Required invariants for every migration:

1. Mobile migrated runtime does not call provider directly.
2. Mobile migrated runtime does not send final prompt strings.
3. Mobile structured request fails closed when bridge is unavailable.
4. Core owns prompt construction.
5. BFF owns provider execution.
6. BFF rejects old prompt-string payloads.
7. BFF rejects arbitrary prompt-control values.
8. BFF caps every prompt-rendered string.
9. BFF caps arrays and aggregate structured payload size.
10. Parser behavior is Core-owned and parity-tested.
11. Desktop compatibility still works.
12. UI/state mutation remains in WebView.
13. Reload/retry paths use the migrated route.
14. Provider failure does not echo learner text.
15. Cache key and prompt-hash behavior is preserved.
16. No generic frontend LLM gateway is introduced.
17. No prompt body is introduced in BFF.
18. No second prompt copy remains in `src/` after migration.
19. Logs do not leak secrets, full prompts, API keys, or raw learner payloads
    unnecessarily.
20. Trace/master status is updated only after review passes, or explicitly
    labeled as PR-stage evidence.
21. Duplicate request cannot duplicate provider work.
22. Client disconnect/abort stops provider work.
23. Terminal completion/error events are deterministic.
24. Chunk order is preserved.
25. Timeout behavior matches provider/task duration, not an unrelated short
    default.
26. Duplicate click/in-flight behavior is preserved or guarded.
27. Timeout/error UI receives a structured failure, not raw provider text.
28. Malformed provider output returns normalized Core error/fallback shape.

Stop if any invariant lacks a negative test or an approved deferral.

### Boundary Contract Audit

Before final migration acceptance, trace every migrated capability through the
actual source boundaries. Do not rely on route existence, type names, or worker
summaries.

| Boundary | Source field/behavior | Destination field/behavior | Required transformation | Forbidden drift | Evidence/Test | Status |
|---|---|---|---|---|---|---|
| WebView UI/state -> React Native bridge | | | | | | |
| React Native bridge -> BffClient | | | | | | |
| BffClient -> BFF route/controller | | | | | | |
| BFF controller/service -> Core capability request | | | | | | |
| Core capability -> prompt/provider request | | | | | | |
| provider response -> Core parser/normalizer | | | | | | |
| Core/BFF response -> React Native/WebView UI state | | | | | | |

Required checks:

- field names and shapes match across each boundary
- required, optional, and defaulted fields preserve old runtime behavior
- action/mode discriminants cannot silently collapse to a generic path
- transcript, history, original user intent, selected context, retry/cache, and
  provider-context fields are preserved where applicable
- timeout budgets align across client, BFF, Core, and provider layers
- provider-backed BFF routes preserve required sibling-route operational
  controls, including rate limiting, validation, config, telemetry/logging, and
  structured failure behavior
- provider failure, malformed output, bridge-missing, duplicate/in-flight,
  reload, retry, and follow-up paths preserve required state or have
  user-approved deferral

Stop if any migrated boundary drops, renames, or reshapes a required field or
runtime behavior without a test or explicit user-approved deferral.

## Phase 7: Trust-Boundary Schema Plan

Before writing BFF endpoints, list every client-provided field Core will render
into a prompt or use to control prompt behavior.

| Field | Prompt Rendered? | Controls Prompt Behavior? | Type | Max Length | Enum/Union? | Required? | Sanitized? | Test |
|---|---|---|---|---:|---|---|---|---|
| | | | | | | | | |

Rules:

- prompt-rendered fields must have max lengths
- prompt-control fields must be enums or discriminated unions
- mode-specific shapes must use discriminated unions
- prompt-rendered arrays need item length, array length, and aggregate caps
- free text from user, selection, transcript, or provider context needs
  per-field and aggregate budgets
- BFF must validate before storing or passing to Core
- validation limits should live in a shared Core/BFF validation owner when
  practical to avoid drift

Stop if BFF only validates shape but not prompt-rendered size/control semantics.

## Phase 8: Runtime Routing Plan

Fill this table before code edits.

| Runtime | Bridge Present? | Structured Request Present? | Expected Path | Forbidden Path | Test |
|---|---|---|---|---|---|
| Desktop web | no | optional | desktop compatibility wrapper/Core browser client | none | |
| Mobile WebView | yes | yes | WebView -> RN -> BffClient -> BFF -> Core -> provider | browser provider SDK | |
| Mobile WebView | no | yes | fail closed with structured error | browser provider SDK | |
| Mobile WebView | yes | old prompt-string payload | BFF rejects | Core/provider | |
| Test/local | explicit fake | yes | deterministic fake provider | silent fallback unless test expects it | |

Stop if the bridge-missing row is untested.

## Phase 9: Red-Test Gate

Before implementation, add tests that fail on the old behavior. If a red test
is impossible before a specific layer exists, record why and add it immediately
when that layer is created.

Required red tests:

- prompt parity test for old and Core prompt output
- parser parity test for old and Core parser/normalizer output
- mobile direct-provider negative test
- mobile bridge-missing fail-closed test
- BFF rejects old prompt-string payload
- BFF rejects arbitrary prompt-control field
- BFF rejects oversized prompt-rendered fields
- reload/retry path uses migrated route
- malformed provider output is normalized by Core
- desktop compatibility still calls compatibility path successfully

Do not proceed to implementation until these tests are failing for the expected
reason or explicitly deferred in the ExecPlan with user approval.

## Phase 10: Implementation Order

Use this order unless the ExecPlan records a justified deviation:

1. Fill Scope Lock.
2. Fill Capability Matrix.
3. Fill Direct Provider Authority Sweep.
4. Fill Prompt Custody Ledger.
5. Add prompt parity/golden tests.
6. Move prompt text verbatim to `core/prompts/<capability>.ts`.
7. Make old WebView prompt exports delegate/re-export from Core.
8. Fill Parser/Normalizer Ledger.
9. Add parser parity tests.
10. Move parser/normalizer to Core.
11. Add Core capability with structured request types and provider boundary.
12. Preserve desktop wrapper through Core.
13. Fill Trust-Boundary Schema Plan.
14. Add BFF schema, service/controller, route.
15. Add BFF negative tests.
16. Add deterministic BFF positive integration test.
17. Add RN `BffClient` method and bridge contracts.
18. Add WebView mobile routing.
19. Add mobile bridge-present test.
20. Add mobile bridge-missing fail-closed test.
21. Add reload/retry/cache/duplicate-click tests.
22. Add provider failure tests.
23. Add live provider smoke when the capability uses a remote provider.
24. Run WebView bundle if `src/` changed.
25. Run full validation.
26. Update `docs/llm_entry_exit_traces.md`.
27. Update master status only after review passes or explicitly label it as
    PR-stage evidence.
28. Add Final Migration Evidence Block to ExecPlan and PR body.

Do not implement route wiring before prompt custody and parser custody are
defined.

## Backlog-Specific Instructions

### Selection Sensei

Scope includes:

- `src/selectionSensei.ts:dispatchFollowupToAI`
- `src/selectionSensei.ts:handleToolbarAction`
- `src/selectionSenseiResponseParser.ts`

Core destinations:

- `core/prompts/selectionSensei.ts`
- `core/selectionSensei.ts`

Move to Core: selection system prompt, follow-up prompt builder,
toolbar-action prompt builders, and pure parser/normalizer logic.

Keep in WebView: selected text capture, DOM geometry, toolbar rendering, modal
transcript state, modal insertion, Notepad insertion, selection overlay
behavior, and UI side effects.

Required modes: follow-up mode, toolbar action mode, desktop mode, mobile
bridge-present mode, mobile bridge-missing mode, parser malformed-output mode,
and provider failure mode.

Candidate BFF routes:

- `POST /sessions/:sessionId/selection-sensei`
- `POST /sessions/:sessionId/selection-sensei/follow-up`
- `POST /sessions/:sessionId/selection-sensei/toolbar-action`

Required negative tests: old prompt-string payload rejected, arbitrary toolbar
action rejected, oversized selected text rejected, oversized modal transcript
rejected, malformed provider response normalized by Core, mobile bridge missing
fails closed for follow-up and toolbar action, and mobile structured request
does not call Selection Sensei browser chat.

### Enhancement Request

Scope includes:

- `src/enhancementManager.ts:toggleEnhancement`
- `src/geminiService.ts:requestSenseiEnhancement`

Core destinations:

- `core/prompts/enhancement.ts`
- `core/enhancement.ts`

Move to Core: `buildSenseiEnhancementPrompt`, JSON format instructions, JSON
fence stripping, JSON parse handling, and `normalizeEnhancementEntries`.

Keep in WebView: `toggleEnhancement`, loading/active state, markdown
re-rendering, `applyEnhancementSequence`, `applyEnhancements`, and
message-level UI state.

Candidate BFF route:

- `POST /sessions/:sessionId/enhancement`

Required negative tests: malformed JSON, fenced JSON, unfenced JSON, oversized
source message, oversized enhancement mode/instructions, old prompt-string
payload rejected, provider failure returns normalized error, mobile bridge
missing fails closed, and desktop wrapper still works.

### Key-Takeaway Enhancement

Scope includes:

- `src/keyTakeawayEnhancerController.ts:KeyTakeawayEnhancerController.start`

Core destinations:

- `core/prompts/keyTakeawayEnhancement.ts`
- `core/keyTakeawayEnhancement.ts`

Move to Core/BFF: key-takeaway prompt construction, provider execution, and
pure model-output normalization.

Keep in WebView: placeholder detection, `onChunk`, `finalize`,
`getLatestText`, `handleEnhancerReady`, `findPlaceholderIndex`, insertion
behavior, cache coordination if UI/prompt-hash driven, and prompt-hash
ownership unless explicitly moved with parity.

Candidate BFF route:

- `POST /sessions/:sessionId/key-takeaway-enhancement`

Required negative tests: mobile bridge missing fails closed, cache hit does not
call BFF if WebView cache remains owner, provider failure does not echo learner
prompt, provider failure does not leave raw `key_takeaway_placeholder`
permanently if existing behavior had cleanup/fallback, old built prompt string
rejected, oversized source response rejected, and placeholder lifecycle parity
tested.

### Pedagogical Directive Generation

Scope includes:

- `src/pedagogicalProfiler.ts:PedagogicalProfiler.getDirective`
- `src/geminiService.ts:generateDirectiveFromMetaPrompt`

Core destinations:

- `core/prompts/pedagogicalDirective.ts`
- `core/pedagogicalDirective.ts`

Move to Core/BFF: active directive prompt construction, provider execution,
directive normalization, and fallback directive behavior if LLM-facing.

Keep in WebView: learner-model inspection, active flag selection, recent
conversation selection, context assembly, profiler orchestration, and fallback
decision timing if tied to learner-model state.

Do not migrate dormant prompt templates unless a live call site is proven.

Candidate BFF route:

- `POST /sessions/:sessionId/pedagogical-directive`

Required negative tests: empty provider response, provider error, oversized
learner context, arbitrary directive mode rejected, old final meta-prompt
payload rejected, mobile bridge missing fails closed, desktop wrapper still
works, and fallback behavior parity.

### Legacy Generic BFF Turn Stream Retirement

This is not a normal migration.

Scope includes:

- `bff/src/controllers/sessionController.js:submitTurn`
- `bff/src/services/streamingService.js:handleConnection`
- `bff/src/integration/senseiCoreAdapter.js:buildPrompt`

Rules:

- do not add a Core prompt for the generic legacy route
- do not preserve `senseiCoreAdapter.buildPrompt` as a production prompt owner
- identify all current callers
- disable/remove only if no production mobile caller remains
- if kept temporarily, mark explicitly as scaffold/test-only/deprecated
- do not let migrated mobile capabilities fall back to it
- update tests to prove migrated mobile paths use capability-specific routes

Required invariant: BFF must not retain a generic inline prompt route as a
mobile LLM fallback.

## Test Gate Ledger

Before commit, fill this table:

| Gate | Required Evidence | Status |
|---|---|---|
| Prompt parity | SHA/length test passes | |
| Parser parity | fixture test passes | |
| Mobile routing | bridge/BffClient test passes | |
| No browser provider on mobile | fail-closed sentinel passes | |
| BFF rejects prompt strings | deterministic negative test passes | |
| BFF caps prompt fields | oversized-field tests pass | |
| BFF validates control fields | enum/discriminated-union tests pass | |
| Desktop compatibility | wrapper tests pass | |
| Reload/retry/cache path | path-specific test passes | |
| Provider failure | non-echo normalized failure test passes | |
| Deterministic BFF integration | route/service test passes | |
| Live provider smoke | passes or provider/quota blocker recorded | |
| WebView bundle | `npm run webview:bundle` passes if `src/` changed | |
| Analyzer | scoped analyzer completed | |
| Diff hygiene | `git diff --check` passes | |
| Trace update | `docs/llm_entry_exit_traces.md` updated | |
| Master status | updated only after review/merge or marked PR-stage | |

No commit if any required gate is missing unless the user explicitly approves
deferral and the ExecPlan records why.

## Review Remediation Mode

When a PR review comment arrives:

1. Fetch all PR review threads and comments.
2. Classify the comment under an existing invariant.
3. If no invariant exists, add one.
4. Search for sibling paths and sibling modes.
5. Add a regression test that fails before the fix where practical.
6. Fix all sibling paths, not only the commented line.
7. Update the Capability Matrix and Invariant Ledger.
8. Run targeted validation.
9. Run relevant full validation if the touched surface is high-risk.
10. Commit and push only if instructed.
11. Reply with commit hash, changed files, test evidence, and sibling-path
    sweep.
12. Do not resolve the thread until the pushed fix exists.

A review finding must never be treated as a one-line patch unless the
sibling-path sweep proves it is isolated.

## Final Migration Evidence Block

At the end of the ExecPlan and in the PR body, add:

```md
## Final Migration Evidence

Backlog row:
Old entry point:
Core prompt file:
Core capability file:
BFF route:
RN bridge method:
WebView compatibility wrapper:
Desktop path:
Mobile path:

Prompt custody:
- prompt symbol -> old SHA/length -> new SHA/length -> test

Parser custody:
- parser -> old fixture -> Core fixture -> test

Boundary invariants:
- mobile no direct provider:
- mobile no final prompt:
- bridge missing fail closed:
- BFF rejects old prompt string:
- BFF caps prompt fields:
- provider failure behavior:
- reload/retry/cache behavior:

Boundary contract audit:
- WebView -> RN:
- RN -> BffClient:
- BffClient -> BFF:
- BFF -> Core:
- Core -> provider:
- provider -> Core parser:
- Core/BFF -> UI:
- timeout/rate-limit/config parity:
- state-continuity paths:

Validation:
- core build:
- focused tests:
- BFF deterministic:
- WebView bundle:
- mobile tests:
- analyzer:
- diff check:
- live provider smoke:

Known deferrals:
- item:
- reason:
- user approval:
```

No PR should be marked ready for review without this block.

## Stop Conditions

Stop and ask for direction or record a blocker if any of these occur:

- prompt SHA cannot be computed
- old prompt owner is unclear
- parser ownership is unclear
- a migrated mobile structured request can still call browser provider
- mobile bridge-missing behavior is untested
- BFF accepts final prompt strings or prompt fragments
- BFF accepts arbitrary prompt-control values
- prompt-rendered fields lack caps
- Core and `src/` both retain the same prompt body
- BFF contains prompt bodies
- review remediation has not swept sibling paths
- the capability matrix has untested rows
- the ExecPlan active compliance block is stale
- a live provider smoke fails for reasons that may be application routing rather
  than quota/provider availability

## Output Contract

Report progress in terms of gates, not only files.

Good status:

```text
Prompt custody gate filled for Selection Sensei: old WebView facade and new
Core export have length N and SHA X. Mobile payload rejection for old prompt text
is covered by test Y.
```

Bad status:

```text
Moved the prompt into Core and tests pass.
```

Completion requires filled gates and tests proving both required behavior and
forbidden behavior.

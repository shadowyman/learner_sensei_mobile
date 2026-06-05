# LLM Migration Compliance Block

Copy this block near the top of the active ExecPlan for any Full Migration Mode
LLM backlog migration. Keep unresolved gates visible until they are green or
explicitly deferred with user approval.

Allowed statuses: `NOT_STARTED`, `RED_TEST_ADDED`, `IMPLEMENTED`, `GREEN`,
`DEFERRED_USER_APPROVED`, `BLOCKED`.

## Mode

- Mode:
- Backlog row:
- Status:

## Scope Lock

| Field | Required Answer | Status |
|---|---|---|
| Backlog row | Exact row from master plan | |
| Current direct provider entry | Exact function/file | |
| Prompt owner after migration | `core/prompts/<capability>.ts` | |
| Core capability after migration | `core/<capability>.ts` | |
| BFF owner | Endpoint/service/controller | |
| RN bridge owner | Bridge contract and `BffClient` method | |
| WebView owner | UI/orchestration functions that remain | |
| Parser/normalizer owner | Core file/function | |
| Desktop compatibility path | Browser Core client or existing wrapper | |
| Mobile path | Structured BFF route | |
| Reload/retry path | How it stays migrated | |
| Cache/placeholder path | What remains WebView-owned | |
| Explicitly out of scope | Related direct LLM calls not migrated in this PR | |

## Capability x Mode x Lifecycle Matrix

| Capability | Mode | Invocation | Runtime | Required Behavior | Forbidden Behavior | Test | Status |
|---|---|---|---|---|---|---|---|
| | normal invocation | | | | | | |
| | reload or retry | | | | | | |
| | bridge present | | mobile | WebView -> RN -> BFF -> Core -> provider | browser provider execution | | |
| | bridge missing | | mobile | fail closed | browser provider execution | | |
| | desktop web | | desktop | compatibility path | mobile route assumptions | | |
| | provider success | | | structured success | prompt leak | | |
| | provider failure | | | normalized failure | echo learner input | | |
| | malformed provider output | | | Core-normalized error | raw parse failure | | |
| | malformed client payload | | | BFF rejects | provider call | | |
| | duplicate/in-flight request | | | one provider claim | duplicate provider work | | |
| | cache hit | | | preserved cache behavior | unexpected provider call | | |
| | cache miss | | | migrated route | direct provider path | | |
| | parser failure | | | normalized Core result | UI-owned parser duplication | | |
| | oversized prompt-rendered field | | | BFF rejects | prompt construction | | |
| | old prompt-string payload | | | BFF rejects | provider call | | |
| | mobile direct-provider sentinel | | mobile | no provider call | `chat.sendMessageStream` | | |

## Direct Provider Authority Sweep

Search command:

```bash
rg "GoogleGenAI|new GoogleGenAI|Chat\\b|chats\\.create|sendMessageStream|sendMessage\\(|generateContent|generateContentStream|CoreLlmClient|GeminiGateway" src core bff SenseiMobile __tests__
```

| Hit | File | Classification | Action | Status |
|---|---|---|---|---|
| | | desktop-only / unmigrated backlog / test-only / must-fix | | |

## Prompt Custody Ledger

| Prompt Symbol / Builder | Old File | Old Runtime Length | Old SHA-256 | New File | New Runtime Length | New SHA-256 | Parity Test | Status |
|---|---|---:|---|---|---:|---|---|---|
| | | | | | | | | |

## Parser / Normalizer Custody Ledger

| Parser / Normalizer | Old File | Core Destination | Input Fixture | Output Fixture | Parity Test | Status |
|---|---|---|---|---|---|---|
| | | | | | | |

## Boundary Invariant Ledger

| Invariant | Applies To | Forbidden Behavior | Positive Test | Negative Test | Status |
|---|---|---|---|---|---|
| Mobile migrated runtime does not call provider directly | | | | | |
| Mobile migrated runtime does not send final prompt strings | | | | | |
| Mobile structured request fails closed when bridge is unavailable | | | | | |
| Core owns prompt construction | | | | | |
| BFF owns provider execution | | | | | |
| BFF rejects old prompt-string payloads | | | | | |
| BFF rejects arbitrary prompt-control values | | | | | |
| BFF caps every prompt-rendered string | | | | | |
| BFF caps arrays and aggregate structured payload size | | | | | |
| Parser behavior is Core-owned and parity-tested | | | | | |
| Desktop compatibility still works | | | | | |
| UI/state mutation remains in WebView | | | | | |
| Reload/retry paths use the migrated route | | | | | |
| Provider failure does not echo learner text | | | | | |
| Cache key and prompt-hash behavior is preserved | | | | | |
| No generic frontend LLM gateway is introduced | | | | | |
| No prompt body is introduced in BFF | | | | | |
| No second prompt copy remains in `src/` after migration | | | | | |
| Logs avoid secrets, full prompts, API keys, and raw learner payloads | | | | | |
| Duplicate request cannot duplicate provider work | | | | | |
| Client disconnect/abort stops provider work | | | | | |
| Terminal completion/error events are deterministic | | | | | |
| Chunk order is preserved | | | | | |
| Timeout behavior matches provider/task duration | | | | | |

## Trust-Boundary Schema Plan

| Field | Prompt Rendered? | Controls Prompt Behavior? | Type | Max Length | Enum/Union? | Required? | Sanitized? | Test | Status |
|---|---|---|---|---:|---|---|---|---|---|
| | | | | | | | | | |

## Runtime Routing Plan

| Runtime | Bridge Present? | Structured Request Present? | Expected Path | Forbidden Path | Test | Status |
|---|---|---|---|---|---|---|
| Desktop web | no | optional | desktop compatibility wrapper/Core browser client | none | | |
| Mobile WebView | yes | yes | WebView -> RN -> BffClient -> BFF -> Core -> provider | browser provider SDK | | |
| Mobile WebView | no | yes | fail closed with structured error | browser provider SDK | | |
| Mobile WebView | yes | old prompt-string payload | BFF rejects | Core/provider | | |
| Test/local | explicit fake | yes | deterministic fake provider | silent fallback unless test expects it | | |

## Boundary Contract Audit

| Boundary | Source field/behavior | Destination field/behavior | Required transformation | Forbidden drift | Evidence/Test | Status |
|---|---|---|---|---|---|---|
| WebView UI/state -> React Native bridge | | | | | | |
| React Native bridge -> BffClient | | | | | | |
| BffClient -> BFF route/controller | | | | | | |
| BFF controller/service -> Core capability request | | | | | | |
| Core capability -> prompt/provider request | | | | | | |
| provider response -> Core parser/normalizer | | | | | | |
| Core/BFF response -> React Native/WebView UI state | | | | | | |
| Timeout budget parity | | | | unrelated shorter timeout | | |
| BFF route operational parity | | | | missing rate limit/config/logging/failure behavior | | |
| State continuity paths | | | | dropped transcript/history/original intent/retry state | | |

## Red-Test Gate

| Red Test | Expected Old Failure | Added? | Status |
|---|---|---|---|
| Prompt parity | | | |
| Parser parity | | | |
| Mobile direct-provider negative test | | | |
| Mobile bridge-missing fail-closed test | | | |
| BFF rejects old prompt-string payload | | | |
| BFF rejects arbitrary prompt-control field | | | |
| BFF rejects oversized prompt-rendered fields | | | |
| Reload/retry path uses migrated route | | | |
| Malformed provider output is normalized by Core | | | |
| Desktop compatibility still works | | | |

## Test Gate Ledger

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

## Review Remediation Ledger

| Review Finding | Invariant | Sibling Sweep | Regression Test | Fix Commit | Reply/Resolve Status |
|---|---|---|---|---|---|
| | | | | | |

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

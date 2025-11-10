# Mission State – Selection Sensei Mermaid Truncation (2025-10-10)

## Scope & Entry Points
- Focus: Selection Sensei modal post-processing path when rendering Mermaid diagrams after LLM responses.
- Primary modules: `src/selectionSensei.ts`, `src/mermaidErrorRecovery.ts`, `src/mermaidManager.ts`.
- Entry points: `SelectionSensei.handleToolbarAction` ➜ `updateResponseModalContentAndTitle` ➜ `processMermaidDiagrams`.
- Supporting functions: `extractContentWithRegex`, `extractStringField`, `runMermaidRecovery`, `applyUniversalQuoteFix`, `applyBacktickFix`, `attemptMermaidFix`, `mermaidManager.render`, `renderMermaidThumbnailWithTheme`, `sanitizeCodeFences`, `marked.parse`.
- Analyzer note: `npm run analysis:run` produced empty call/fan-in artifacts for `src/*`; manual inspection used after confirming analyzer limitation.

## Static Execution Trace
1. User action triggers `SelectionSensei.handleToolbarAction`, issuing Gemini request.
2. Response text parsed via `extractContentWithRegex` → `extractStringField` fallback when JSON invalid.
3. Parsed explanation rendered through `updateResponseModalContentAndTitle` (`sanitizeCodeFences`, `marked.parse`, DOM rewrite).
4. `processMermaidDiagrams` iterates `pre code.language-mermaid`, calls `mermaidManager.render`.
5. On render failure, logs `[SEL_MERMAID_RECOVERY] recovery-start`, replaces block with spinner, invokes `runMermaidRecovery`.
6. `runMermaidRecovery` applies rule-based fixes (`applyBacktickFix`, `applyUniversalQuoteFix`) then retry via `renderAttempt`; if still failing, calls `attemptMermaidFix` (Gemini) before exhausting attempts and logging `[MERMAID_FAILOVER]`.
7. Successful recovery updates modal registry via `updateModalMermaidFence`.

## Dependency & Side-Effect Table
| Function | Dependencies | Side Effects | Risk |
| --- | --- | --- | --- |
| `SelectionSensei.handleToolbarAction` | `this.ai`, `chat.sendMessage`, `updateResponseModalContentAndTitle`, modal state helpers | Network call to Gemini; modal/show state mutations; composer enable/disable | High |
| `SelectionSensei.updateResponseModalContentAndTitle` | `sanitizeCodeFences`, `marked.parse`, `hljs.highlightElement`, DOM APIs, `processMermaidDiagrams` | Rebuilds modal DOM subtree, toggles spinner/title, asynchronously processes diagrams | High |
| `SelectionSensei.processMermaidDiagrams` | `mermaidManager.render`, `runMermaidRecovery`, `renderMermaidThumbnailWithTheme`, `updateModalMermaidFence`, DOM APIs | Replaces `<pre>` blocks, logs recovery, performs async rendering/recovery, mutates raw markdown registry | High |
| `SelectionSensei.extractContentWithRegex` / `extractStringField` | String scanning utilities, `normalizeJsonPayload`, `repairLooseJson`, `logger` | Data parsing only; logs debug on parse failure | High – fallback truncates content on unescaped quotes |
| `runMermaidRecovery` | `applyBacktickFix`, `applyUniversalQuoteFix`, `attemptMermaidFix`, supplied `renderAttempt` | Network LLM call, repeated mermaid renders, logs failures | High |
| `attemptMermaidFix` | `MERMAID_FIX_PROMPT_TEMPLATE`, Gemini API, rule-based helpers | Additional LLM call; JSON parsing of response; logs parse failures when DEBUG flag set | Medium |

## Risk Register
- **R1 (High):** `extractStringField` stops at first unescaped `"` inside explanation payload. Any Mermaid node label with quotes leads to truncated diagrams passed to rendering/recovery. Verified via reproduction script mirroring implementation.
- **R2 (High):** `processMermaidDiagrams` assumes intact raw markdown; truncation propagates to recovery, yielding malformed diagrams and degraded UX despite “mermaidProcessed: true” telemetry.
- **R3 (Medium):** Analyzer blind spot for `src/` files complicates automated dependency tracking; manual inspection required until tooling adjusted.

## Coverage Checklist
- Confirm LLM responses containing Mermaid diagrams with embedded quotes reproduce truncation (`extractStringField` unit harness or jest mock).
- Validate logs show `[SEL_MERMAID_RECOVERY] recovery-start` with truncated diagram alongside `[MERMAID_FAILOVER]` fallback.
- Exercise `runMermaidRecovery` path with intact diagram to ensure recovery success once parsing fixed.
- Re-run `node` reproduction snippet (captured during analysis) to confirm parser fix.

## Unknowns & Verification Plans
- Outstanding unknowns: **None** – root cause isolated to fallback parser truncation in `extractStringField`. Planned verification via targeted unit test once fix devised.

## Key Architectural Insights
- Fallback regex parser is critical path whenever Gemini emits invalid JSON; its current naive string scanning compromises downstream features (Mermaid, code fences, structured HTML).
- Modal maintains raw markdown per `messageId` via `modalMessageRegistry`; truncation at capture stage persists through recovery attempts, corrupting stored markdown and notepad exports.
- Recovery logging demonstrates intact diagrams only when fallback parser succeeds (e.g., `[MERMAID_FAILOVER]` dump), underscoring dependency on accurate extraction prior to DOM rendering.

## Next Protocol
- Proceed with **MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL** to formalize bug investigation and plan remediation steps.

## Test Traceability
- Candidate automated coverage: add Jest spec around `extractContentWithRegex` / `extractStringField` ensuring diagrams with unescaped quotes remain intact; tie to selection sensei workflow tests that simulate modal rendering.


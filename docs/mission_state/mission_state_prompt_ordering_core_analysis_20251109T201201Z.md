# Mission State — prompt ordering core analysis (2025-11-09T20:12:01Z)

## Scope & Entry Points
- Feature request: reorder Sensei turn prompt so task-specific payload (Primary Action, user input, teaching directives) precedes static structure/constraints while preserving all content.
- Entry functions identified via analyzer snapshot (`npm run analysis:run`):  
  - `buildSenseiDynamicSystemInstruction` and `streamMainSenseiResponse` in `src/interactionHelpers.ts`.  
  - `MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION` in `src/prompts.ts`.  
  - `buildContextualInstruction`/`buildSupportingContextBlock` in `src/curriculum.ts`, plus consolidation variant in `src/consolidationManager.ts`.

## Static Execution Trace
1. `buildSenseiDynamicSystemInstruction` parses optional MUST_OBEY directives, logs evaluation, then calls `MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION` to assemble the dynamic system prompt body.
2. `getCurriculumFocusInstruction` → `getCurriculumFocusInstructionImpl` → `buildPrimaryActionInstruction` → `buildContextualInstruction` (→ `buildSupportingContextBlock`) supply the curriculum block injected into the template.
3. `streamMainSenseiResponse` receives the assembled context, logs request metadata, appends `"User: <input>"`, streams via `chat.sendMessageStream`, and updates UI with `updateMessageStream`.

## Dependency & Side-Effect Summary
| Function | Key Dependencies | Side Effects / Risk |
| --- | --- | --- |
| `buildSenseiDynamicSystemInstruction` (interactionHelpers.ts) | `logger`, curriculum block string, `MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION` | Logging only; pure string assembly otherwise (Low risk). |
| `MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION` (prompts.ts) | Uses `curriculumFocusInstruction`, `MANDATORY_TEACHING_STRUCTURE`, `executionDirective` constants | Pure string concatenation. Reordering could alter implied references (Medium risk if wording mismatched). |
| `buildContextualInstruction` / `buildSupportingContextBlock` (curriculum.ts) | Curriculum state, teaching plan | Pure assembly; risk of misordered sections impacting downstream parsing (Medium). |
| `streamMainSenseiResponse` (interactionHelpers.ts) | Chat API, UI update | Sends LLM request + UI streaming (High cost). Must ensure placeholder substitution occurs before streaming to avoid leaking markers. |

**Risk Register**
1. **Placeholder omission** — If new user-input placeholder is not replaced, literal marker leaks into prompt, possibly confusing the LLM. *Mitigation:* ensure replacement occurs centrally in `streamMainSenseiResponse`, add guard (test/validation) to confirm placeholder not present post-assembly.
2. **Directive wording drift** — Execution Directive currently says “provided below”; after reordering it must say “provided in this prompt” to avoid contradictory instructions. *Mitigation:* update copy simultaneously.

**Coverage Checklist**
- `buildSenseiDynamicSystemInstruction` (prompt assembly order + placeholder injection point)
- `MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION`
- `buildContextualInstruction` + consolidation variant
- `streamMainSenseiResponse` (placeholder replacement + final message)

**Unknowns & Verification Plan**
1. Do other builders (e.g., Socratic mode) use the same `[[USER_LAST_INPUT_HERE]]` sentinel? *Plan:* After implementation, `rg` for the sentinel to ensure single producer.
2. Does MUST_OBEY path skip curriculum block entirely? *Plan:* Verify logic path to ensure placeholder injection only occurs when curriculum block present; otherwise guard insertion.

**Key Architectural Insights**
- Prompt is composed of modular sections; adjusting section ordering only requires reordering pushes in `buildContextualInstruction` & `MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION`.
- User input currently appended at very end; placeholder injection will allow deterministic placement without altering other call sites.

**Next Protocol**
- Proceed to **COMPREHENSIVE IMPACT ANALYSIS PROTOCOL** leveraging this mission-state snapshot.

**Traceability for Upcoming Tests**
- Planned validations will exercise prompt assembly functions in `src/interactionHelpers.ts`, `src/prompts.ts`, `src/curriculum.ts`, and `src/consolidationManager.ts` to ensure final prompt text order and placeholder behavior.

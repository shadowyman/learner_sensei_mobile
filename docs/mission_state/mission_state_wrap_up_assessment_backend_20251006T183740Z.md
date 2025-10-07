# Mission State: Wrap Up Assessment Backend Integration — Core Analysis

## Scope & Entry Points
- `index.tsx::handlePhaseSelection` — updates ModuleSelectionHandler state and dispatches Solidify, Socratic, or Intro flows.
- `moduleSelectionHandler.ts::ModuleSelectionHandler.handlePhaseSelection` — Solidify branch currently bypasses curriculum planning and calls `showWrapUpAssessmentOverlay`; other phases drive spinner + Gemini planning (`jumpToPhase`).
- `wrapUpAssessment.ts::showWrapUpAssessmentOverlay` — injects overlay DOM into `#message-area`, seeds questions from local constant, locks chat input, and handles reveal UX.
- Supporting modules we must coordinate with: `curriculum.ts` (module metadata, solidify content), `prompts.ts` (new wrap-up prompt), `geminiService.ts` (Gemini Pro client), `model_usage.ts` (model config), `logger.ts`, `notepad.ts`, `ui.ts` transcript helpers, and Solidify-related state transitions in `curriculum.advance`.

## Static Execution Trace (Solidify Phase Selection)
1. `index.tsx::handlePhaseSelection` synchronizes handler state references (curriculum, learner model, chat, AI) and forwards the phase string.
2. `ModuleSelectionHandler.handlePhaseSelection`:
   - Validates readiness, finds the phase button bubble, clears spinner timers if Solidify.
   - **Current Solidify branch**: removes the button bubble, calls `showWrapUpAssessmentOverlay()`, resets `pendingModuleSelection` and exits before `jumpToPhase`.
   - **Other phases**: installs spinner timers (`setInterval`), calls `jumpToPhase` with callback that invokes `geminiService.llmExtractAndPlanTeachingOrder`, then streams intros / updates notepad + UI.
3. `wrapUpAssessment.showWrapUpAssessmentOverlay` builds overlay container (`#wrap-up-assessment-overlay`), hydrates cards from `QUESTIONS`, attaches handlers, locks chat controls, and runs syntax highlighting via `hljs`, `addLanguageDisplayToCodeBlocks`, and `addCopyButtonsToCodeBlocks`.
4. Submission path (`revealAnswers`) traverses cached DOM references to mark correctness, annotate statuses, and update the footer copy. No backend interactions exist yet.

## Dependency & Side-Effect Analysis
| Function | Key Dependencies | Side Effects | Risk |
| --- | --- | --- | --- |
| `index.tsx::handlePhaseSelection` | ModuleSelectionHandler API | None directly; marshals state | Low |
| `ModuleSelectionHandler.handlePhaseSelection` | DOM query/manipulation, `jumpToPhase`, `geminiService.llmExtractAndPlanTeachingOrder`, `showWrapUpAssessmentOverlay`, `displayMessage`, `getCurriculumItem`, `Notepad.setActiveCurriculumContext`, timers | DOM removal/insertion, interval timers, learner model / notepad sync, AI planning | **High** — incorrect branching will trigger legacy LLM plan or leak timers |
| `wrapUpAssessment.showWrapUpAssessmentOverlay` | Document APIs, `sanitizeCodeFences`, `marked`, highlight.js (`hljs`), `addLanguageDisplayToCodeBlocks`, `addCopyButtonsToCodeBlocks` | Injects overlay DOM, locks chat controls, registers click handlers | **High** — must avoid duplicate overlays, ensure proper teardown and state handoff |
| `wrapUpAssessment.disableChatControls` | DOM IDs for input, send, code editor buttons | Disables inputs; sets placeholders/data attributes | Medium — ensure re-enable occurs when assessment completes |
| `wrapUpAssessment.applyCodeBlockEnhancements` | `hljs`, UI helpers | Syntax highlighting + copy buttons | Low |
| *(To add)* `wrapUpAssessment.fetchWrapUpAssessment` | `geminiService`, new prompt builder, logger | Network call to Gemini Pro, error handling, question normalization | **High** — must guarantee schema correctness, retries, fallbacks |

## Risk Register
1. **R1 – Legacy flow interference**: Failing to gate the Solidify branch before `jumpToPhase` triggers unnecessary Gemini planning, mutating curriculum state. *Mitigation:* maintain early return, ensure backend fetch stays within wrap-up module.
2. **R2 – Spinner interval leaks**: Creating or leaving spinner timers active when the overlay short-circuits can leave orphaned intervals. *Mitigation:* keep current Solidify branch before spinner setup; if we ever refactor, explicitly clear intervals.
3. **R3 – Overlay DOM isolation**: Overlay must sit outside `.message-bubble` nodes so streaming updates do not clobber markup. *Mitigation:* continue mounting under `#message-area` with unique ID, guard duplicate insertion.
4. **R4 – State synchronization gaps**: After overlay shows, curriculum/notepad state remains at module selection stage. Need to define when to update state post-assessment to avoid divergence. *Mitigation:* plan handshake for when backend remediation integrates; document interim behavior.
5. **R5 – AI schema drift**: Gemini response must include `type` plus all required fields; invalid payload breaks rendering. *Mitigation:* implement strict JSON parsing + validation before rendering, fallback apology bubble per spec.
6. **R6 – Chat control locking**: Inputs are disabled but never re-enabled. As remediation step is out of scope, plan to re-enable once backend triggers overlay completion. *Mitigation:* design completion handler now even if remediation is deferred.

## Unknowns / Questions
| ID | Unknown | Impact | Plan |
| --- | --- | --- | --- |
| U1 | Exact module metadata to surface in overlay header (title, phase descriptor). | Medium | Pull from `ModuleSelectionHandler` state when launching overlay; confirm desired copy with user. |
| U2 | Should curriculum/notepad state advance before or after assessment completion? | High | Align with user during clarification (Step 6). |
| U3 | Required prompt context for Gemini (module goal, concepts, solidify text, learner performance?). | Medium | Inspect `curriculum` data; design prompt referencing spec; confirm with user. |
| U4 | Post-assessment unlock/cleanup responsibilities. | Medium | Decide interim strategy (re-enable chat, maybe keep overlay persistent per spec). |
| U5 | Handling autonomous transitions into Solidify (not only manual module selection). | Medium | Review advancement flow after clarification; may need hook when curriculum state updates to Solidify. |

## Coverage Checklist / Validation Targets
- `index.tsx::handlePhaseSelection` Solidify branch gating.
- `ModuleSelectionHandler.handlePhaseSelection` path ensures no `jumpToPhase` call when overlay-driven.
- New Gemini request function validates payload schema (15 questions, 5 snippet types, field presence, `type` classification).
- Overlay rendering handles dynamic module title/copy, populates cards from fetched data.
- Error handling: double-attempt on Gemini failure, fallback apology bubble as per spec.
- Chat controls lock/unlock flow verified (input, send, code editor button).
- Ensure overlay mount/resume works for repeated Solidify entries (no stale overlay).

## Next Protocol
Proceed to **MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL** after clarifications.


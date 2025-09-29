# Mission State - Selection Sensei Modal Close Bug (2025-09-28)

**Status**: Core analysis complete. Root cause identified; proceeding under the MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL.

## Scope & Entry Points
- Primary entry: selectionSensei.ts::SelectionSensei.handleToolbarAction (triggered by toolbar button handlers and helper sendMessage).
- Supporting path: selectionSensei.ts::SelectionSensei.createAndShowSelectionToolbar__anon3__anon10 wiring handles action invocation.
- Modal lifecycle functions within selectionSensei.ts: resetModalState, showResponseModalWithLoading, updateResponseModalContentAndTitle, hideResponseModal, ensureSelectionChat, appendModalMessage, dispatchFollowupToAI, handleOutsidePointerDown.
- Hot modules based on analyzer: selectionSensei.ts (fan-out 8), ui.ts (fan-out 8), moduleSelectionHandler.ts (fan-out 8), index.tsx (fan-in/out hub), logger.ts, prompts.ts, mermaidManager.ts, model_usage.ts.

## Static Execution Trace
1. User action binds through SelectionSensei.createAndShowSelectionToolbar -> handleToolbarAction(selectedText, actionType, ...).
2. handleToolbarAction increments modalConversationToken via resetModalState, disables composer, hides toolbar, and invokes showResponseModalWithLoading to display loading state.
3. handleToolbarAction ensures chat via ensureSelectionChat, builds prompt using prompts.ts helpers, and calls chat.sendMessage (async) against Gemini.
4. While awaiting the response, the user may dismiss the modal via hideResponseModal (close button or outside pointer) which hides DOM but leaves modalConversationToken unchanged.
5. When the async response resolves, handleToolbarAction processes text with extractContentWithRegex and passes it to updateResponseModalContentAndTitle.
6. updateResponseModalContentAndTitle clears and rewrites modal DOM, sets display="flex", reenables composer, and logs post-processing; this reopens the modal even if the user previously hid it.
7. Follow-up flows (handleFollowupSubmit -> dispatchFollowupToAI) reuse the same modalConversationToken and message registry, so they would also replay if the modal was closed mid-flight.

## Dependency & Side-Effect Table
| Function | Key Dependencies | Side Effects | Risk |
| --- | --- | --- | --- |
| SelectionSensei.handleToolbarAction | resetModalState, showResponseModalWithLoading, setComposerEnabled, hideSelectionToolbar, ensureSelectionChat, prompts helpers, chat.sendMessage, extractContentWithRegex, updateResponseModalContentAndTitle, logger | Indirect DOM mutations via called methods; triggers external network call; controls modalConversationToken lifecycle | High |
| SelectionSensei.resetModalState | ensureDOMElementsValid, clearModalRegistry, createMessageRegistry, setComposerEnabled | Increments modalConversationToken, clears transcript elements, resets timers and flags, nulls selectionChat | Medium-High |
| SelectionSensei.showResponseModalWithLoading | ensureDOMElementsValid, setComposerEnabled, logSelectionSenseiValidation | Clears modal content, sets spinner visible, forces modal display flex | Medium |
| SelectionSensei.updateResponseModalContentAndTitle | ensureDOMElementsValid, sanitizeCodeFences, marked.parse, highlight.js, addCopyButtonsToCodeBlocks, processMermaidDiagrams | Rebuilds modal DOM, toggles spinner, forces display flex, runs syntax highlighting and mermaid rendering | High |
| SelectionSensei.hideResponseModal | ensureDOMElementsValid, hideSelectionToolbar | Sets display="none", empties content and title, hides toolbar | Medium |
| SelectionSensei.ensureSelectionChat | ai.chats.create | Initializes and caches selectionChat instance | Medium |
| SelectionSensei.appendModalMessage | displayMessage helper, modalMessageRegistry | Mutates transcript DOM, appends loading and user bubbles | Medium |
| SelectionSensei.dispatchFollowupToAI | ensureSelectionChat, appendModalMessage, chat.sendMessage | Schedules loading bubble, sends network request, writes follow-up answer | Medium-High |
| SelectionSensei.handleOutsidePointerDown | hideResponseModal | Detects outside clicks and hides modal | Medium |

## Risk Register
- Stale AI responses reopen the modal after users explicitly close it; user intent overridden and UX regresses. Mitigation: guard async completions with modalConversationToken and/or explicit cancellation state.
- Closing during follow-up leaves followupInFlight true until async resolves, potentially blocking new interactions. Mitigation: ensure close pathways clear followup state and advance token.
- Extensive DOM rewriting in updateResponseModalContentAndTitle assumes nodes remain attached; mitigation: keep ensureDOMElementsValid calls before mutations.

## Coverage Checklist
- selectionSensei.ts::SelectionSensei.handleToolbarAction#1758843a19fa
- selectionSensei.ts::SelectionSensei.resetModalState#49928a3ddc21
- selectionSensei.ts::SelectionSensei.showResponseModalWithLoading#237340707e31
- selectionSensei.ts::SelectionSensei.updateResponseModalContentAndTitle#ba668ebe3d5a
- selectionSensei.ts::SelectionSensei.hideResponseModal#ffe61b20bfac
- selectionSensei.ts::SelectionSensei.appendModalMessage#006cf6d99569
- selectionSensei.ts::SelectionSensei.dispatchFollowupToAI#4594c0fac896
- selectionSensei.ts::SelectionSensei.ensureSelectionChat#8977ac6be5db
- selectionSensei.ts::SelectionSensei.handleOutsidePointerDown#039b6abad515

## Unknowns Register
- Does closing the modal during a follow-up request currently allow a new follow-up immediately? Risk: Medium-High. Verification pending after remediation to ensure cancellation resets followupInFlight.
- Confirm whether helper sendMessage path captures conversation token for follow-ups. Risk: Medium. Verify during implementation review.

## Key Architectural Insights
- modalConversationToken is the intended cancellation primitive but is not advanced when the modal closes, so primary request lacks guard.
- Response handlers explicitly set modal display styles; without a cancellation check they override user-driven state.
- Event wiring uses instance-bound methods, so guards must be placed inside the class methods themselves.

## Root Cause Statement
- Primary response handler lacks a modalConversationToken guard, so async completions reopen the modal after user closes it. Confidence 92%. Discovered during hypothesis Cycle 1 and reinforced in Cycle 2 comparison.

## Phased To-Do Plan (Strategy B)
1. Instrument modal closure paths to advance modalConversationToken and clear follow-up state: update hideResponseModal and any explicit close handlers, capturing rationale logs (temporary) with tag `[SEL_MODAL_CANCEL]`.
2. Ensure every new request captures current modalConversationToken locally and revalidates before applying DOM updates; modify handleToolbarAction and showResponseModalWithLoading/updateResponseModalContentAndTitle as needed.
3. Guard follow-up pathways consistently by reusing token checks and clearing followupInFlight on close; verify dispatchFollowupToAI and related flows respect updated token logic.
4. Add temporary debug logs with tag `[SEL_MODAL_DEBUG]` covering request start, close, and async completion to confirm cancellation behaviour; plan removal post-validation.
5. Execute targeted manual tests following coverage checklist (simple explain, follow-up, cancel mid-flight) once implementation complete.

## Next Steps
- Execute Strategy B per phased plan once backup requirements are satisfied.


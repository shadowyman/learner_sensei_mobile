# Bug Fix Documentation

## Bug Fix #1

**Issue**: Initial message after Socratic phase selection appeared "odd" and didn't follow Socratic teaching methodology, while subsequent user interactions worked correctly.

**Root Cause**: The system had dual execution paths for message generation. Initial messages used `streamModuleIntroduction()` with generic `MODULE_INTRODUCTION_TASK_TEMPLATE`, while subsequent messages used `buildSocraticExecutionInstruction()` with proper Socratic methodology. This architectural flaw meant Socratic phases never received appropriate initial instruction building.

**Discovery Method**: Cycle 2 (Direct Dependencies) + Cycle 6 (Meta-System Architecture) revealed the execution path divergence through systematic code analysis.

**Fix Applied**: 
1. Replaced dual execution paths with unified system message approach for Socratic phases
2. Created `sendSystemSocraticMessage()` function for proper system initialization 
3. Renamed parameter `isFirstTurn` → `isSystemInitialization` in `buildSocraticExecutionInstruction()`
4. Implemented correct turn counting model where system initialization doesn't count as a turn
5. Preserved existing logic for IntroIllustrate and Solidify phases

**Related Files**: 
- `index.tsx:924-987, 1035-1042, 343-401` - Turn counter initialization and phase routing
- `interactionHelpers.ts:89-110` - Parameter rename and instruction building logic

**Keywords for Future Reference**: socratic phase, dual execution paths, instruction building, system initialization, turn counting, message generation, teaching methodology

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## Bug Fix #2

**Issue**: Loading a saved session failed to restore notepad notes, leaving the notepad empty after import.

**Root Cause**: The `Notepad` singleton never exposed the `getAllNotes`/`restoreNotes` APIs that `SaveLoadProgressManager` calls during serialization and hydration, so the save pipeline captured an empty array and the load pipeline skipped restoration. (`notepad.ts:481-664`, `saveloadProgressManager.ts:7-238`)

**Discovery Method**: Cycle 1 – Current Component Scope (Systematic Hypothesis Space Expansion).

**Fix Applied**:
1. Added defensive `getAllNotes()` and normalization-driven `restoreNotes()` implementations with deep cloning and timestamp hydration (`notepad.ts:481-664`).
2. Introduced shared helpers to cleanse incoming note payloads and preserve Quill deltas across round-trips (`notepad.ts:578-664`).
3. Instrumented save/load to log captured and restored note counts, ensuring validation evidence for persistence (`saveloadProgressManager.ts:7-238`).

**Related Files**:
- `notepad.ts:481-664`
- `saveloadProgressManager.ts:7-238`

**Backup Artifact**: `backup/sensei_backup_fix_notepad_restoration_bug_20250928_000354.zip`

**Review Artifact**: `code_review/review_notepad_restore_bug.html`

**Keywords for Future Reference**: notepad persistence, save/load, window.notepad, session restore, quill delta, note normalization

## Bug Fix #3: Mermaid Diagram Vertical Alignment Issue

**Issue**: When Sensei displays mermaid diagrams, vertical diagrams (height > width) appeared left-aligned instead of centered, while horizontal diagrams displayed correctly in the center of the message bubble.

**Root Cause**: The CSS class `.mermaid-thumbnail--vertical` used `display: inline-grid` which behaves like an inline element. Inline elements cannot be centered using `margin: auto` because they don't expand to fill their container width. The horizontal variant worked because it had explicit `margin-left: auto; margin-right: auto` declarations.

**Fix Applied**: Changed `display: inline-grid` to `display: grid` and added `width: fit-content` to make the container shrink to its content size, allowing the auto margins to properly center the element. This ensures consistent centering behavior for both vertical and horizontal mermaid diagrams.

**Related Files**: 
- `index.css:1893-1900` (mermaid-thumbnail--vertical class)
- `mermaid-theme-integration.js:59-66` (orientation detection logic)

**Keywords for Future Reference**: mermaid, diagram, centering, alignment, inline-grid, display, fit-content, vertical orientation

## Bug Fix #4: Chunk Navigation Triggered False Praise

**Issue**: Switching chunks from the meditation overlay caused Sensei to open the next teaching turn by congratulating the learner on answering "Let's Check Your Understanding" questions, even though no user response was provided.

**Root Cause**: `window.switchToChunk` called `generateNextSenseiResponse('', true)`, which submitted an empty user message to the persistent chat without any system hint. The LLM interpreted the silence as a successful learner answer because the system prompt still contained the prior "Let's Check" section.

**Fix Applied**: Detected navigation turns without user input and appended a navigation context block to the system prompt explaining that the learner switched chunks without responding, ensuring the next response restarts instruction instead of assuming mastery.

**Related Files**:
- `index.tsx:462`
- `interactionHelpers.ts:62`
- `interactionHelpers.ts:108`

**Keywords for Future Reference**: chunk navigation, meditation overlay, navigation context, empty input, false praise

## Bug Fix #5: Mermaid Caption Overlapped Instruction Text

**Issue**: After narrowing mermaid caption widths, the italic annotation beneath diagrams appeared underneath Sensei's instructional paragraphs, making the caption unreadable.

**Root Cause**: Dedicated `.mermaid-figure` and `.mermaid-annotation` styles were removed, so the wrapper inherited the thumbnail's orientation classes (`display: grid`, `width: fit-content`). The caption and subsequent paragraphs then occupied the same horizontal space, letting later text overlap the annotation.

**Fix Applied**: Reintroduced scoped CSS that centers the figure as a flex column with controlled width while keeping the caption full-width inside the container. Verified via temporary `[MERMAID_FIX]` logs before removing the instrumentation.

**Related Files**:
- `index.css:2188`
- `mermaid-theme-integration.js:102`
- `docs/features/feature_mermaid_annotation_alignment_20250920_015950.md:22`

**Keywords for Future Reference**: mermaid, caption, overlap, flex layout, annotation, figure wrapper

## Bug Fix #6: Code Editor Modal Lacked Scrollbar

**Issue**: The in-chat code editor modal could not scroll when code exceeded the visible viewport. Users were forced to select text to reveal hidden content, and in some cases could not scroll at all.

**Root Cause**: The modal instantiated CodeMirror while the dialog was still hidden, so the editor measured zero height. Additionally, the surrounding layout did not reserve vertical space, causing the editor to collapse even after content was inserted.

**Fix Applied**: Delayed CodeMirror initialization until after the modal becomes visible (`requestAnimationFrame` inside `openCodeEditorModal`) and restructured the modal body as a flex column with explicit height clamps. The `#code-editor-root`, `.cm-editor`, and `.cm-scroller` layers now propagate flex sizing with `min-height: 0`, ensuring the scroll container maintains usable height.

**Related Files**:
- `codeEditorModal.ts:352`
- `index.css:1735`

**Keywords for Future Reference**: codemirror, modal, scrollbar, flex layout, initialization timing, overflow

## Bug Fix #7: Mermaid Caption Rendered as Code Block

**Issue**: Diagram annotations occasionally appeared inside a styled code block rather than as italic text beneath the mermaid figure, confusing readers and breaking layout continuity.

**Root Cause**: When the AI output placed the annotation immediately after the closing ```mermaid fence, `marked` wrapped the caption as `<pre><code>…</code></pre>`. Our post-processing in `renderMermaidThumbnailWithTheme` only relocates captions that arrive as `<p><em>…</em></p>`, so the fenced caption stayed untouched and rendered like code.

**Fix Applied**: Expanded `renderMermaidThumbnailWithTheme` to detect caption-like `<pre><code>` siblings (single-line, non-code heuristics). These blocks are converted into italic paragraphs and appended to the `.mermaid-figure`, keeping captions styled consistently while ignoring real code samples.

**Related Files**:
- `mermaid-theme-integration.js:137`
- `docs/mission_state_mermaid_annotation_bug_20250924_014731.md`

**Keywords for Future Reference**: mermaid, caption, annotation, markdown fence, sanitize, thumbnail wrapper

## Bug Fix #8: Socratic Intro Missing Reload/Enhance Controls

**Issue**: When launching a module directly into the Socratic phase, the introductory Sensei message never showed the reload or enhance buttons, so users could not regenerate or expand that response.

**Root Cause**: `sendSystemSocraticMessage` streamed the intro into a bubble created in loading mode but never made the follow-up `displayMessage` call with `isLoading: false` and a `reloadContext`. The bubble stayed flagged as loading and non-reloadable, which suppresses button rendering in `displayMessage`.

**Fix Applied**: After streaming, capture the final text, build a `ReloadContext`, and rerun `displayMessage` with reload metadata so the bubble finalizes like other phases. Preserve dataset attributes for replays and rely on existing enhancement reset logic.

**Related Files**:
- `moduleSelectionHandler.ts:489`
- `moduleSelectionHandler.ts:506`

**Keywords for Future Reference**: socratic phase, reload button, enhance button, displayMessage, reloadContext, isLoading

## Bug Fix #9: Socratic Completion Didn’t Advance Phase

**Issue**: After Sensei emitted the Socratic completion trigger (e.g., `[SOCRATIC_COMPLETION_TRIGGERED: …]`), the system sometimes stayed in the Socratic phase instead of advancing to the next pedagogical phase. Users remained stuck despite seeing a completion acknowledgement.

**Root Cause**: The completion path set `socraticCompletionPending` and awarded mastery but returned control to normal advancement, which relies on chunk-completion gating. Socratic phases do not mark chunk coverage, so `advanceCurriculumState` never reached `handlePhaseCompletion`. Additionally, the Socratic completion handler returned `false` and did not call `determinePhaseTransition` or initialize the next phase, leaving the state unchanged.

**Fix Applied**: Centralized completion handling in `processSocraticPendingCompletion(...)` to immediately finish the phase. The function now awards phase KC, logs completion, clears Socratic state, calls `cleanupCompletedPhase(...)`, performs `determinePhaseTransition(...)`, and initializes the next phase via `initializeNewPhaseState(...)`, returning `true` to signal advancement in the same turn. Also updated KC telemetry to timestamp the mastery award.

**Related Files**:
- `curriculum.ts:932`
- `curriculum.ts:945`
- `curriculum.ts:989`
- `index.tsx:714-724`

**Keywords for Future Reference**: socratic completion, phase transition, chunk gating, immediate advance, KCMasteryLastUpdated, determinePhaseTransition, initializeNewPhaseState

## Bug Fix #10: Mermaid Recovery Leaked Raw Diagram; Save Didn’t Persist Outcome

**Issue**: After five failed Mermaid recovery attempts, Sensei’s message showed the raw Mermaid codeblock to the user. Additionally, when recovery succeeded or failed, the saved transcript did not reflect the on-screen outcome (it kept the original faulty fence).

**Root Cause**: Failure branches in the UI injected `<pre><code>` with the original diagram into the DOM, and the save system persisted `streamingMessagesRawText` (the original LLM output) without normalization after recovery.

**Fix Applied**: Removed raw code exposure and standardized the red error box content. Added a debug log that records the full failed diagram code. Implemented save normalization: on recovery success, replace the original Mermaid fence in the in-memory raw text with the corrected diagram; on recovery exhaustion, replace the fence with a single bracketed error line so saves/restores match the UI.

**Related Files**:
- `ui.ts:1415`
- `ui.ts:1433-1440`
- `ui.ts:1873`
- `ui.ts:1890-1897`
- `selectionSensei.ts:638`

**Backup**: `backup/sensei_backup_bugfix_mermaid_recovery_hide_failed_code_20250925_230504.zip`

**Review Artifact**: `code_review/review_bugfix_mermaid_recovery_hide_failed_code_v2.html`

**Keywords for Future Reference**: mermaid, recovery, code leak, save normalization, streamingMessagesRawText, debug log, error box

## Bug Fix #11: Selection Sensei Modal Jumps on First Drag Move

**Issue**: When dragging the Selection Sensei response modal, the window “snaps” to align under the cursor on the first mousemove, then drags smoothly afterward.

**Root Cause**: The modal was initially centered using CSS transform. At drag start, code only cleared the transform conditionally and computed offsets against the current rect. On the first mousemove, the modal state changed (transform cleared, left/top applied) causing a mismatch between the mousedown rect and the move computation, producing a visual snap under the cursor.

**Fix Applied**: Always ground the modal at drag start by clearing transform and seeding `left`/`top` from `getBoundingClientRect()`. Compute `offsetX/offsetY` immediately after grounding, and clamp position within the viewport during drag. This mirrors the proven debug modal behavior and prevents the jump.

**Related Files**:
- `selectionSensei.ts:827`
- `selectionSensei.ts:843`

**Backup**: `backup/sensei_backup_bugfix_selection_sensei_drag_offset_20250926_011733.zip`

**Review Artifact**: `code_review/review_bugfix_selection_sensei_drag_offset_v3.html`

**Keywords for Future Reference**: modal drag, transform, offset, snap, clamp, viewport, Selection Sensei

## Bug Fix #12: Enhancement Toggle Blocked by Mermaid Recovery

**Issue**: Enhancing a Sensei message with a previously failed Mermaid diagram left the toggle in a loading state while the UI displayed the "Attempting to fix diagram…" spinner until recovery finished.

**Root Cause**: `renderEnhancedMarkdown` always awaited `processMermaidBlocks`, and that routine immediately invoked the multi-attempt `runMermaidRecovery` whenever a render failed. Because `applyEnhancements` awaited the injected renderer promise, the enhancement toggle could not resolve until the recovery loop exhausted its attempts.

**Discovery Method**: Adaptive Root Cause Analysis — Cycle 2 (Direct Dependencies) identified unconditional Mermaid recovery as the blocking dependency.

**Fix Applied**: Threaded an optional `skipMermaidProcessing` flag through the enhancement render dependency so both enhancement apply and removal call `renderEnhancedMarkdown(..., { skipMermaidProcessing: true })`. The renderer now passes `{ skipRecovery: true }` to `processMermaidBlocks`, which renders once and, on failure, swaps in the existing error block without starting recovery, allowing the enhancement toggle to finish promptly.

**Related Files**:
- `enhancementManager.ts:194`
- `enhancementManager.ts:231`
- `ui.ts:902`
- `ui.ts:1843`

**Backup**: `backup/sensei_backup_mermaid_enhance_decouple_20250926_065230.zip`

**Review Artifact**: `code_review/review_mermaid_enhance_decouple.html`

**Keywords for Future Reference**: enhancement toggle, mermaid recovery, skipMermaidProcessing, processMermaidBlocks, runMermaidRecovery

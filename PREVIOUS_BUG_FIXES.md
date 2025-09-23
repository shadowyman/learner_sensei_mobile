# Previous Bug Fixes

## Bug #1: Mermaid Diagram Vertical Alignment Issue

**Issue**: When Sensei displays mermaid diagrams, vertical diagrams (height > width) appeared left-aligned instead of centered, while horizontal diagrams displayed correctly in the center of the message bubble.

**Root Cause**: The CSS class `.mermaid-thumbnail--vertical` used `display: inline-grid` which behaves like an inline element. Inline elements cannot be centered using `margin: auto` because they don't expand to fill their container width. The horizontal variant worked because it had explicit `margin-left: auto; margin-right: auto` declarations.

**Fix Applied**: Changed `display: inline-grid` to `display: grid` and added `width: fit-content` to make the container shrink to its content size, allowing the auto margins to properly center the element. This ensures consistent centering behavior for both vertical and horizontal mermaid diagrams.

**Related Files**: 
- `index.css:1893-1900` (mermaid-thumbnail--vertical class)
- `mermaid-theme-integration.js:59-66` (orientation detection logic)

**Keywords for Future Reference**: mermaid, diagram, centering, alignment, inline-grid, display, fit-content, vertical orientation
## Bug #2: Chunk Navigation Triggered False Praise

**Issue**: Switching chunks from the meditation overlay caused Sensei to open the next teaching turn by congratulating the learner on answering "Let's Check Your Understanding" questions, even though no user response was provided.

**Root Cause**: `window.switchToChunk` called `generateNextSenseiResponse('', true)`, which submitted an empty user message to the persistent chat without any system hint. The LLM interpreted the silence as a successful learner answer because the system prompt still contained the prior "Let's Check" section.

**Fix Applied**: Detected navigation turns without user input and appended a navigation context block to the system prompt explaining that the learner switched chunks without responding, ensuring the next response restarts instruction instead of assuming mastery.

**Related Files**:
- `index.tsx:462`
- `interactionHelpers.ts:62`
- `interactionHelpers.ts:108`

**Keywords for Future Reference**: chunk navigation, meditation overlay, navigation context, empty input, false praise

## Bug #3: Mermaid Caption Overlapped Instruction Text

**Issue**: After narrowing mermaid caption widths, the italic annotation beneath diagrams appeared underneath Sensei's instructional paragraphs, making the caption unreadable.

**Root Cause**: Dedicated `.mermaid-figure` and `.mermaid-annotation` styles were removed, so the wrapper inherited the thumbnail's orientation classes (`display: grid`, `width: fit-content`). The caption and subsequent paragraphs then occupied the same horizontal space, letting later text overlap the annotation.

**Fix Applied**: Reintroduced scoped CSS that centers the figure as a flex column with controlled width while keeping the caption full-width inside the container. Verified via temporary `[MERMAID_FIX]` logs before removing the instrumentation.

**Related Files**:
- `index.css:2188`
- `mermaid-theme-integration.js:102`
- `docs/features/feature_mermaid_annotation_alignment_20250920_015950.md:22`

**Keywords for Future Reference**: mermaid, caption, overlap, flex layout, annotation, figure wrapper

## Bug #4: Code Editor Modal Lacked Scrollbar

**Issue**: The in-chat code editor modal could not scroll when code exceeded the visible viewport. Users were forced to select text to reveal hidden content, and in some cases could not scroll at all.

**Root Cause**: The modal instantiated CodeMirror while the dialog was still hidden, so the editor measured zero height. Additionally, the surrounding layout did not reserve vertical space, causing the editor to collapse even after content was inserted.

**Fix Applied**: Delayed CodeMirror initialization until after the modal becomes visible (`requestAnimationFrame` inside `openCodeEditorModal`) and restructured the modal body as a flex column with explicit height clamps. The `#code-editor-root`, `.cm-editor`, and `.cm-scroller` layers now propagate flex sizing with `min-height: 0`, ensuring the scroll container maintains usable height.

**Related Files**:
- `codeEditorModal.ts:352`
- `index.css:1735`

**Keywords for Future Reference**: codemirror, modal, scrollbar, flex layout, initialization timing, overflow

## Bug #5: Mermaid Caption Rendered as Code Block

**Issue**: Diagram annotations occasionally appeared inside a styled code block rather than as italic text beneath the mermaid figure, confusing readers and breaking layout continuity.

**Root Cause**: When the AI output placed the annotation immediately after the closing ```mermaid fence, `marked` wrapped the caption as `<pre><code>…</code></pre>`. Our post-processing in `renderMermaidThumbnailWithTheme` only relocates captions that arrive as `<p><em>…</em></p>`, so the fenced caption stayed untouched and rendered like code.

**Fix Applied**: Expanded `renderMermaidThumbnailWithTheme` to detect caption-like `<pre><code>` siblings (single-line, non-code heuristics). These blocks are converted into italic paragraphs and appended to the `.mermaid-figure`, keeping captions styled consistently while ignoring real code samples.

**Related Files**:
- `mermaid-theme-integration.js:137`
- `docs/mission_state_mermaid_annotation_bug_20250924_014731.md`

**Keywords for Future Reference**: mermaid, caption, annotation, markdown fence, sanitize, thumbnail wrapper

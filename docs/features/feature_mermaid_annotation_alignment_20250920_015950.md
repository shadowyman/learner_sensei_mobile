# Mermaid Annotation Alignment — 2025-09-20 01:59:50

## Summary
- Scoped Mermaid diagrams and captions into `.mermaid-figure` blocks so annotation width tracks the graphic and remains centered (`mermaid-theme-integration.js:4-112`, `index.css:2088-2105`).
- Softened caption tone with off-white color and slightly narrower rail (`index.css:2088-2111`).
- Strengthened prompt guidance to require multi-sentence, flow-focused Mermaid annotations (`prompts.ts:10-25`).

## Rationale
- Prevent annotations from stretching across the full Sensei bubble and colliding with surrounding content.
- Ensure captions read as supportive metadata rather than primary narrative by toning down color and enforcing concise, descriptive copy.

## Key Details
- Wraps thumbnails plus italic paragraph in a shared container and emits a single success log the first time a caption is attached (`mermaid-theme-integration.js:4-112`).
- CSS constrains the figure width to `min(68%, 520px)` and centers the caption, which now renders in `rgba(236, 244, 255, 0.78)` (`index.css:2088-2111`).
- Prompt instructions now explicitly demand entry-point identification, node roles, transition explanation, and branch callouts in the annotation (`prompts.ts:10-25`).

## Validation
- During validation pass, `logs/console_logs.log` (exported at 2025-09-20 01:52:50) captured `[MERMAID_ANNOTATION] Wrapped figure orientation: horizontal` and `[MERMAID_ANNOTATION] Annotation heuristics sentences: 4`, confirming wrapper and caption heuristics prior to trimming debug logs; instrumentation now leaves only a single success entry per session.
- Manual UI verification against user-provided screenshot confirmed caption now aligns beneath the diagram without overlapping neighboring text.

## 2025-09-20 05:51 Update — Caption Overlap Regression
- Restored dedicated figure container rules so Sensei captions stay centered within the bubble without being overrun by instructional paragraphs (`index.css:2188`).
- Reconfirmed annotation relocation logic while temporarily instrumenting the renderer; logs show `[MERMAID_FIX]` figure class and width clamp before removal, proving the wrapper receives the expected sizing (`logs/console_logs.log:94`).
- Removed validation instrumentation post-check so only `[MERMAID_ANNOTATION] Caption aligned with diagram` remains in production logging (`mermaid-theme-integration.js:102`).

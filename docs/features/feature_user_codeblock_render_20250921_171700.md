# Feature: User Codeblock Rendering
- **Timestamp:** 2025-09-21 17:17:00
- **Summary:** User chat bubbles now preserve original whitespace and render fenced code blocks with the same syntax-highlighted presentation used for Sensei responses.

## Rationale
- Responses with formatted examples often require leading spaces or aligned columns that were previously collapsed. Users also expect their pasted code to receive consistent highlighting.

## Key Changes
- `index.tsx:752` now feeds the raw textarea content into the message pipeline while still guarding against empty submissions.
- `ui.ts:68` adds `escapeHtml` and `renderUserMessageHtml`, ensuring plain text segments stay literal while fenced fragments go through the Markdown/highlight stack.
- `index.css:892` configures user message bodies with `white-space: pre-wrap` so indentation and blank lines persist.

## Behavior Notes
- Mixed content messages (text + ``` fences) retain exact spacing around the code block, and the block gains language badges and copy controls automatically.
- Single-line and trailing whitespace are visible in the bubble, matching the user's input.

## Validation
- Manual run confirmed `[USR_CODEBLOCK]` instrumentation during development; logs were removed after verification.
- `npm exec -- tsc --noEmit` could not be executed due to restricted network dependency resolution; no TypeScript errors observed prior to the network failure.

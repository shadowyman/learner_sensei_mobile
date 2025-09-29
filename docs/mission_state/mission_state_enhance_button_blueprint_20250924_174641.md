# Mission Blueprint – Sensei Enhance Button (2025-09-24 17:46:41 UTC)

## Selected Architecture – Dedicated Enhancement Manager (Approach B)

### Components & File Changes
- **New File:** `enhancementManager.ts`
  - Exports `initializeEnhancementManager(deps)` to configure Gemini client access and shared state references (e.g., `streamingMessagesRawText`).
  - Exports `toggleEnhancement(messageId: string)` returning a promise that handles the tri-state toggle (apply → remove → reapply).
  - Maintains an internal `Map<string, EnhancementState>` storing:
    - `status`: `idle` | `loading` | `applied`
    - `originalMarkdown`: canonical Sensei markdown captured before any enhancement
    - `enhancedMarkdown`: last enhanced markdown applied to DOM (used when removing)
    - `payload`: last enhancement payload from Gemini (for telemetry, not reused on reapply)

- **`index.tsx` Updates**
  - Import `initializeEnhancementManager` and `toggleEnhancement`.
  - During startup, call `initializeEnhancementManager({ ai, streamingMessagesRawText, logger })`.
  - Expose `window.handleEnhanceSenseiMessage = (messageId: string) => toggleEnhancement(messageId)` so UI buttons can trigger the manager.
  - Provide helper access for the manager to refresh `streamingMessagesRawText` entries after DOM rewrites.

- **`ui.ts` Updates**
  - When rendering a reloadable Sensei bubble, append an Enhance button next to the existing reload control.
  - Button configuration:
    - `class="enhance-button"`, `aria-label="Enhance this Sensei response"`, `aria-pressed` toggled by manager updates.
    - Click handler delegates to `window.handleEnhanceSenseiMessage(message.id)` and displays loading state while awaiting completion.
  - Export DOM helpers consumed by the manager:
    - `renderEnhancedMarkdown(messageId: string, markdown: string): void` – re-renders the bubble’s contents from markdown using existing `marked` pipeline, highlights code, reruns mermaid as needed, and updates `streamingMessagesRawText`.
    - `setEnhanceLoadingState(messageId: string, isLoading: boolean): void` – toggles visual state on the button (spinner/disabled).
    - `setEnhanceActiveState(messageId: string, isActive: boolean): void` – updates `aria-pressed` and CSS modifier class once enhancements are applied or removed.

- **`model_usage.ts` / `geminiService.ts` Updates**
  - Add `ENHANCEMENT_REQUEST_CONFIG` targeting `gemini-2.5-flash` with `responseMimeType: "application/json"` and temperature ~0.4 for deterministic elaborations.
  - Implement `requestSenseiEnhancement(ai, request: EnhancementRequest): Promise<EnhancementPayload>` where
    - `EnhancementRequest = { originalMarkdown: string, wordCount: number }` (word count logged for telemetry)
    - Payload schema described below.

- **`index.css` Updates**
  - `.enhance-button` styling aligned with reload button (flex row, spacing 8px, shared hover/active states) plus active-state highlight.

### Gemini Prompt & Request Handling
1. **Prompt Construction**
   - Manager builds a system/user prompt pair:
     - **System role:** explains task: “You expand a Sensei teaching message. Return JSON only.”
     - **User role content:**
       - Original Sensei markdown wrapped in triple quotes to preserve formatting.
       - Explicit schema instructions:
         ```json
         {
           "enhancements": [
             {
               "key": "Exact sentence copied from the original message",
               "value": "Additional sentence or sentences to append",
               "insertType": "append" | "paragraph",
               "ordering": optional integer for disambiguation
             }
           ],
           "metadata": { "notes": optional string }
         }
         ```
       - Additional rules: keys must match the source text verbatim (ignoring leading/trailing whitespace); paragraph entries must represent full paragraphs to insert after the paragraph containing `key`; keep JSON compact; no rephrasing or deletions.
   - Prompt reminds Gemini to limit elaborations to clarifications, examples, or deeper explanations that extend the same idea.

2. **Request Lifecycle**
   - Manager calls `requestSenseiEnhancement` with the prompt plus `ENHANCEMENT_REQUEST_CONFIG`.
   - Response text is trimmed, code fences dropped, and JSON parsed. Any parsing failure triggers `[ENHANCE] parse-error` log and surfaces an inline toast to the user.
   - Each enhancement entry is validated:
     - `key`/`value` non-empty strings.
     - `insertType` in {`append`, `paragraph`}.
     - `ordering` optional integer.
   - Invalid entries are dropped with warning logs; if the list becomes empty, the manager reports “No enhancements returned” and leaves state idle.

3. **Caching & Telemetry**
   - `payload` and Gemini latency are stored in `EnhancementState` for metrics and debugging.
   - Manager logs start, success, and failure with `[ENHANCE]` prefix and relevant metadata (messageId, itemCount, latency, truncated preview).

### Enhancement Application Algorithm
1. **Source Text Retrieval**
   - `originalMarkdown` is sourced from `streamingMessagesRawText.get(messageId)`. On first toggle, the manager stores this string in state to ensure we always revert to the pristine original.

2. **Markdown Mutation Strategy**
   - Enhancements are applied to markdown, not directly to DOM, to preserve formatting and simplify persistence.
   - For each entry (processed in array order, sorted by `ordering` when provided):
     - Locate the first occurrence of `key` within the working markdown string using `indexOf` starting from a moving cursor so repeated keys map sequentially.
     - If not found, log `[ENHANCE] key-miss` and skip.
     - When `insertType === 'append'`: insert ` value` (prefixed with a space if the key ends with punctuation; otherwise use `. ` heuristic) immediately after the `key` substring.
     - When `insertType === 'paragraph'`: insert `\n\n${value}\n\n` immediately after the paragraph containing `key`. Paragraph boundaries detected via `\n\n` splits from the original markdown; algorithm rebuilds the string by concatenating segments.
   - The mutation maintains a list of indices already used to avoid overlapping inserts; additional occurrences of the same `key` use subsequent matches.

3. **DOM Refresh**
   - After all inserts, the manager calls `renderEnhancedMarkdown(messageId, enhancedMarkdown)`.
   - `ui.ts` re-parses markdown using existing logic (`marked.parse`, syntax highlighting, mermaid rendering). This guarantees enhancements respect existing formatting workflows.
   - `renderEnhancedMarkdown` updates `streamingMessagesRawText` with `enhancedMarkdown` and notifies the manager for state tracking.

4. **Removal / Reapply**
   - Removal simply calls `renderEnhancedMarkdown(messageId, originalMarkdown)` from cached state and resets `status` to `idle` with no payload.
   - Reapply obtains fresh enhancements: state resets to `idle` and the next click fetches a new payload from Gemini (no reuse of prior payloads to encourage variety).

### Data Flow Summary
1. **Initialization**: `index.tsx` installs manager with AI client, logger, raw-text map.
2. **Button Click**: `ui.ts` delegates to manager; button enters loading state.
3. **Enhancement Fetch** (when `status` is `idle`):
   - Manager requests payload from Gemini.
   - Valid payload yields `enhancedMarkdown` via mutation algorithm.
   - `ui.ts` re-renders markdown; state becomes `applied` and button toggles to active.
4. **Toggle Off** (`status` = `applied`):
   - Manager restores `originalMarkdown`, updates DOM and raw-text map, sets state to `idle`.
5. **Toggle On Again**: repeats step 3 to fetch a fresh payload.

### API Contracts
- `initializeEnhancementManager({ ai, streamingMessagesRawText, logger }: EnhancementDeps): void`
- `toggleEnhancement(messageId: string): Promise<void>`
- `requestSenseiEnhancement(ai: GoogleGenAI, request: EnhancementRequest): Promise<EnhancementPayload>`
  - `EnhancementPayload = { enhancements: Array<{ key: string; value: string; insertType: 'append' | 'paragraph'; ordering?: number }> }`
- `renderEnhancedMarkdown(messageId: string, markdown: string): Promise<void>`
- `setEnhanceLoadingState(messageId: string, isLoading: boolean): void`
- `setEnhanceActiveState(messageId: string, isActive: boolean): void`

### Logging, Errors, UX
- Loading state: button disabled with spinner and `aria-busy="true"` while Gemini request in flight.
- Success: `[ENHANCE] applied` log plus subtle glow animation on bubble to indicate new content.
- Failure cases:
  - Network / Gemini error → user toast + log; bubble remains unchanged; state returns to `idle`.
  - Key lookup failure for all entries → inline balloon message appended under bubble indicating enhancement skipped.

### Cross-Cutting Concerns
- **Persistence:** Because we always update `streamingMessagesRawText` whenever markdown changes, the save/load pipeline inherently captures whichever version is visible at the time of save.
- **Accessibility:** Enhance button uses `aria-pressed`, `aria-busy`, and accessible text for state feedback.
- **Performance:** Operations are string-based; enhancements typically small. We process entries sequentially to avoid race conditions and throttle concurrent requests per message.
- **Extensibility:** Future enhancement modes (e.g., “Summarize”) can reuse the manager by adding new request types without bloating `ui.ts` or `index.tsx`.


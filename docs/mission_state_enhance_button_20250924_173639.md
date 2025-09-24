# Mission State – Sensei Enhance Button Core Analysis (2025-09-24 17:36:39 UTC)

## Scope & Entry Points
- `ui.ts:displayMessage` – renders Sensei message bubbles, attaches reload controls, maintains `streamingMessagesRawText` map.
- `index.tsx:handleReloadSenseiMessage` – reference pathway for button-driven Sensei actions; informs Enhance handler structure and global exposure via `window`.
- `geminiService.ts` & `model_usage.ts` – LLM integration points for structured JSON requests (Flash model configurations).
- `saveloadProgressManager.ts` – saves restored chat state using `streamingMessagesRawText`; enhancements must sync with this map to persist.

## Static Execution Trace (Target Flow)
1. User clicks Enhance button injected by `displayMessage` for a specific Sensei bubble.
2. Handler `handleEnhanceSenseiMessage` (to add in `index.tsx`) inspects per-bubble enhancement state and toggles between remove/apply modes.
3. When a fresh enhancement is required, the handler calls a new Gemini Flash helper (`requestSenseiEnhancementJson`) that formats the prompt and uses `model_usage` Flash config to request JSON expansions.
4. Successful responses feed a DOM utility (planned in `ui.ts`) that maps each `{ key, value, insertType }` entry onto the existing bubble, appending inline sentences or inserting new paragraphs.
5. The DOM utility updates `streamingMessagesRawText` and bubble dataset flags so save/load flows capture the augmented teaching; repeat toggles remove or refresh enhancements accordingly.

## Dependency & Side-Effect Matrix
| Function | Dependencies | Side Effects |
| --- | --- | --- |
| `displayMessage` (`ui.ts`) | DOM APIs, `marked`, `hljs`, `streamingMessagesRawText`, icon rendering | Rebuilds message bubble DOM, attaches button listeners, updates raw-text map, manages timers/animations. |
| `handleReloadSenseiMessage` (`index.tsx`) | `displayMessage`, `streamMainSenseiResponse`, `streamModuleIntroduction`, `logger`, `processMermaidBlocks` | Switches bubble to loading state, re-streams Sensei text, mutates `lastSenseiResponses`, updates DOM. |
| `handleEnhanceSenseiMessage` (planned `index.tsx`) | `streamingMessagesRawText`, new Gemini helper, UI enhancement utilities, `logger` | Tracks enhancement state per message, calls Gemini, toggles DOM augmentations, updates raw-text persistence. |
| `requestSenseiEnhancementJson` (planned `geminiService.ts`) | `GoogleGenAI`, `model_usage` Flash config, `logger` | Issues Gemini Flash request, parses JSON, reports failures; no direct UI mutation. |
| `applyEnhancementsToBubble` (planned `ui.ts`) | DOM APIs, existing message markup, enhancement payload, `streamingMessagesRawText` | Inserts inline/paragraph additions, records enhancement metadata for toggling and persistence. |

## Architectural Insights
- Enhance control should follow reload pattern: button rendered in `displayMessage`, handler exposed via `window` from `index.tsx` for reuse across reloads and saves.
- `streamingMessagesRawText` is authoritative for persistence/export; enhancements must keep it synchronized whenever the bubble content mutates.
- Toggling requires deterministic state (likely per-bubble dataset or map) so repeated clicks can remove or refresh without re-rendering the whole message.
- Gemini JSON contract must tolerate fenced responses; parser should strip code fences similarly to existing helpers.

## Next Protocol
Proceed with **MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL** (Steps 1-7 pending).


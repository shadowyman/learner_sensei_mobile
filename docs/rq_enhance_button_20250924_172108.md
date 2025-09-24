# Sensei Enhance Button Requirements

## Feature Summary
- Add Enhance button adjacent to reload control on Sensei teaching bubbles.
- Trigger Gemini Flash through model_usage utility to expand the most recent Sensei teaching text.
- Gemini response must map original sentences to added content using key/value pairs and support inserting new paragraphs.
- UI must hotplug enhancements into the existing teaching without reloading or deleting prior text.
- Repeated Enhance presses should toggle enhancements off and on, requesting fresh elaborations when re-enabled.

## Core Objectives
- Provide richer explanations that clarify ambiguous statements and supply missing insights.
- Maintain original Sensei messaging while appending supplemental sentences or paragraphs.
- Ensure predictable formatting so UI can place enhancements accurately.

## Input Details
- Source text: full Sensei teaching message currently displayed.
- Prompting: instruct Gemini Flash to return JSON with structure `{ "enhancements": [ { "key": <original sentence>, "value": <additional sentence>, "insertType": "append"|"paragraph", "ordering": <optional integer> } ] }` (exact schema to be finalized during design).

## Output Expectations
- Append `value` strings after matching `key` sentences.
- Insert standalone paragraphs when `insertType` indicates paragraph placement; location rules to be defined during implementation.

## Toggle Behavior
1. First click submits request and applies enhancements inline.
2. Second click removes all previously applied enhancements, restoring original message.
3. Third click re-runs Gemini request to fetch new enhancements.

## Constraints & Considerations
- Preserve original text ordering; no deletions or rephrasing.
- Avoid duplicate enhancements when re-requesting; clear prior additions before applying new ones.
- Handle latency gracefully with loading indicator and error fallback.
- Ensure JSON parsing resilience and log unexpected formats.

## Open Questions
- Should enhancements persist across reloads or message history navigation?
- How to handle multiple Sensei messages if several are visible simultaneously?
- What UX feedback indicates enhancement mode is active?


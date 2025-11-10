# Mission State: Selection Sensei Modal Resizing (Core Analysis)

- Timestamp: 2025-10-08T19:09:00Z (UTC)
- Analyst: Gene (Apollo Flight Director persona)

## Step 4 Declaration
Core analysis complete. I have mapped the current Selection Sensei modal drag/resize pipeline and identified all dependencies and side effects. I am now ready for follow-on protocols once authorized.

## Scope & Entry Points
- `selectionSensei.ts::SelectionSensei.attachEventListeners`
- `selectionSensei.ts::SelectionSensei.ensureDOMElementsValid`
- `selectionSensei.ts::SelectionSensei.handleDragStart`
- `selectionSensei.ts::SelectionSensei.handleDragMove`
- `selectionSensei.ts::SelectionSensei.handleDragEnd`
- `index.css::#response-modal` rule (includes `resize: both` and padding/overflow settings)
- `index.html::#response-modal` structure (header, drag zone, transcript, composer)

## Static Execution Trace
1. `SelectionSensei.initialize` → `getDOMElements` → `attachEventListeners` registers modal drag listeners on header/drag zone plus global `mousemove`/`mouseup` handlers.
2. When the modal must be rehydrated (e.g., after save/load), `ensureDOMElementsValid` re-fetches DOM nodes and reattaches drag listeners, ensuring the modal keeps working.
3. User pointer down on the header or overlay triggers `handleDragStart`, which captures offsets, removes the translate transform, and locks user-select.
4. Document-level `mousemove` invokes `handleDragMove`, clamping the modal within the viewport while updating inline `left`/`top` coordinates.
5. Document-level `mouseup` runs `handleDragEnd`, clearing the drag flag and restoring `userSelect`.
6. CSS rule `#response-modal { resize: both; overflow: auto; }` exposes the browser’s default resize affordance (bottom-right corner only). No JS currently reacts to the resize event, so size changes rely solely on native browser behavior.

## Dependency & Side-Effect Table
| Function / Rule | Dependencies | Side Effects & Risk | Notes |
| --- | --- | --- | --- |
| `SelectionSensei.attachEventListeners` | `messageArea`, `responseModalHeader`, `responseModalDragZone`, `document` | Adds global `mousemove`, `mouseup`, and `pointerdown` listeners; hooks modal drag start on two elements. Risk: Medium-High (global listeners persist for session; misconfiguration affects whole app). |
| `SelectionSensei.ensureDOMElementsValid` | `getDOMElements`, `initializeModalComposer` | Re-fetches modal nodes, rebinds drag listeners, reinitializes composer input. Risk: Medium (reruns on save/load; failure leaves modal inert). |
| `SelectionSensei.handleDragStart` | `responseModal`, `document` event context | Mutates inline `transform`, `left`, `top`, and `userSelect` to begin manual drag. Risk: Medium (incorrect offsets cause jumpy modal; interacts with CSS translate). |
| `SelectionSensei.handleDragMove` | `window.innerWidth/Height`, `responseModal.offsetWidth/Height` | Continuously writes inline `left`/`top` while clamping to viewport. Risk: Medium (tight coupling to viewport; needs sync with future resize math). |
| `SelectionSensei.handleDragEnd` | `responseModal` | Clears drag flag and `userSelect`. Risk: Low. |
| CSS `#response-modal` rule | Browser resize implementation | Enables `resize: both` (bottom-right grip) with `overflow: auto`; sets padding and min/max dimensions. Risk: Medium (browser-specific grips; padding reduces hit area for potential custom handles). |

## Risk Register
- **R1 (Medium-High)**: Global document listeners for drag are always active; introducing additional resize handles must avoid duplicate pointer capture or leaks when modal is hidden.
- **R2 (Medium)**: Inline `left`/`top` overrides the default `transform`-centered layout. Any resizing that relies on width/height changes must keep coordinate systems consistent with drag offsets.
- **R3 (Medium)**: CSS `resize: both` currently depends on browser-native grips. Replacing or augmenting it with custom edge handles may require preventing default resizing to avoid conflicting behaviors.
- **R4 (Low-Medium)**: Modal padding and rounded corners may reduce available area for edge handles; we need to ensure hit targets remain accessible for accessibility and touch input.

## Coverage Checklist
- Verify `SelectionSensei.attachEventListeners` fires exactly once per modal lifecycle and continues to register drag (and future resize) handlers after dynamic reattachment.
- Exercise `SelectionSensei.ensureDOMElementsValid` (e.g., via save/load path) to confirm drag/resize listeners persist.
- Validate `handleDragStart`, `handleDragMove`, `handleDragEnd` interplay when the modal is resized away from its initial dimensions.
- Confirm CSS adjustments to `#response-modal` (and any added handles) render correctly across min/max width/height constraints.

## Unknowns Register
| Item | Impact | Verification Plan | Owner |
| --- | --- | --- | --- |
| How will additional edge/top/bottom resize handles interact with existing `resize: both`? | Medium | Prototype updated modal with custom handles; observe for conflicting native grips; disable `resize` if necessary. | Gene |
| Do we need to persist modal size between sessions (save/load)? | Low | Review requirements with stakeholders; currently no persistence logic. | Gene |
| Accessibility expectations for new resize affordances (keyboard, screen reader cues)? | Medium | Consult UX/accessibility guidance; ensure ARIA roles/instructions accompany custom handles. | Gene |

## Architectural Insights
- Dragging relies on switching from the centered `transform` approach to explicit `left`/`top` coordinates; resizing logic must operate in the same coordinate space to avoid layout snaps.
- Selection Sensei modal already mirrors some debug modal behavior (drag, compose). Any shared resize implementation could live in a small helper to keep behaviors consistent across modals.

## Next Steps
- Await authorization to proceed with impact analysis and implementation once user confirms scope or requests adjustments.

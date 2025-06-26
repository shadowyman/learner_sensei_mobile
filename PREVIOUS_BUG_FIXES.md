# Previous Bug Fixes

## Bug #1: Mermaid Diagram Vertical Alignment Issue

**Issue**: When Sensei displays mermaid diagrams, vertical diagrams (height > width) appeared left-aligned instead of centered, while horizontal diagrams displayed correctly in the center of the message bubble.

**Root Cause**: The CSS class `.mermaid-thumbnail--vertical` used `display: inline-grid` which behaves like an inline element. Inline elements cannot be centered using `margin: auto` because they don't expand to fill their container width. The horizontal variant worked because it had explicit `margin-left: auto; margin-right: auto` declarations.

**Fix Applied**: Changed `display: inline-grid` to `display: grid` and added `width: fit-content` to make the container shrink to its content size, allowing the auto margins to properly center the element. This ensures consistent centering behavior for both vertical and horizontal mermaid diagrams.

**Related Files**: 
- `index.css:1893-1900` (mermaid-thumbnail--vertical class)
- `mermaid-theme-integration.js:59-66` (orientation detection logic)

**Keywords for Future Reference**: mermaid, diagram, centering, alignment, inline-grid, display, fit-content, vertical orientation
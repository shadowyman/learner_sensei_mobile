# Bug: "Check Understanding" Section Appearing in Socratic Phase Introduction

## Issue Summary
The "Check Understanding" section was unexpectedly appearing in the first message of Socratic phases, which seemed inconsistent with the Socratic teaching methodology that should be entirely dialogue-based.

## Root Cause Analysis

### The Key Discovery
The first message users see when entering a Socratic phase is **NOT** the first Socratic turn - it's actually the module/phase introduction message that happens **BEFORE** the Socratic dialogue begins.

### Detailed Flow Analysis

1. **Phase Selection** (index.tsx:959-966)
   When a user selects the Socratic phase:
   ```typescript
   const initialInstructionForSensei = getCurriculumFocusInstruction(curriculum, currentItem, curriculumState, false);
   
   const introContext = `${MODULE_INTRODUCTION_TASK_TEMPLATE(selectedModule.title, conceptTitle, phaseDisplayName, `Phase: ${phaseDisplayName}`)}
   ${initialInstructionForSensei}`;
   ```

2. **Curriculum Instruction Generation** (curriculum.ts:872-873)
   The curriculum instruction uses `TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE` with `includeCheck: true`
   - This explicitly adds: "Include: Check Understanding Section"

3. **Teaching Invariant Activation** (prompts.ts:188-193)
   The system's teaching invariants respond to this instruction:
   ```
   **Include: Check Understanding Section** instruction: When present, indicates you should add Socratic questions at the end
   - When instructed, include: ### 🧠 Let's Check Your Understanding
   ```

4. **Result**: The introduction message includes the "Check Understanding" section because it received an explicit instruction to do so from the curriculum system.

### Why Subsequent Turns Don't Have This Issue

After the introduction message, when the user responds (e.g., types "continue"):
- The system switches to `buildSocraticExecutionInstruction`
- This uses a restrictive checklist format that doesn't include curriculum instructions
- Therefore, no "Include: Check Understanding Section" directive is sent
- Result: No "Check Understanding" section appears in subsequent turns

## Timeline of Events

1. **User selects Socratic phase** → Introduction message WITH curriculum instructions (includes "Check Understanding")
2. **User types response** → First actual Socratic turn WITHOUT curriculum instructions  
3. **All subsequent messages** → Continue Socratic dialogue WITHOUT curriculum instructions

## Why This Was Confusing

The confusion arose because what appears to be the "first Socratic response" is actually the module/phase introduction that precedes the Socratic dialogue proper. This introduction message follows standard teaching protocols (which include check understanding sections), while the actual Socratic dialogue follows a different, more restrictive protocol.

## Potential Solutions

1. **Modify Phase Introduction for Socratic**: Create a special introduction template for Socratic phases that doesn't include the check understanding directive
2. **Conditional Check Understanding**: Make the `includeCheck` parameter conditional based on the phase type
3. **Separate Introduction Types**: Clearly differentiate between phase introductions and phase execution

## Related Files
- `/Users/aligunes/Documents/sensei_files_20250615_204052/index.tsx:959-966` - Phase selection and introduction generation
- `/Users/aligunes/Documents/sensei_files_20250615_204052/curriculum.ts:872-873` - Curriculum instruction generation
- `/Users/aligunes/Documents/sensei_files_20250615_204052/prompts.ts:188-193` - Teaching invariants
- `/Users/aligunes/Documents/sensei_files_20250615_204052/interactionHelpers.ts` - Socratic execution instruction building

## Keywords for Future Reference
- Socratic phase introduction
- Check Understanding section
- Teaching invariants
- Phase introduction vs execution
- Curriculum instructions
- buildSocraticExecutionInstruction
- TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE
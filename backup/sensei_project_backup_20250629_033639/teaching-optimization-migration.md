# Teaching Instructions Optimization Migration Guide

## Overview

This document describes the optimization implemented to reduce token usage in the Recursive Sensei by moving static teaching requirements from per-turn instructions to base system instructions.

## What Changed

### 1. New Teaching Invariants Constant
- **File**: `prompts.ts`
- **Addition**: `RECURSIVE_SENSEI_TEACHING_INVARIANTS` constant
- **Content**: Contains all static teaching requirements that apply to every interaction
- **Location**: Added to base system instruction via `SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS`

### 2. Optimized Curriculum Instructions
- **File**: `curriculum.ts`
- **Changes**:
  - Original function renamed to `getLegacyCurriculumFocusInstruction`
  - New `getOptimizedCurriculumFocusInstruction` returns minimal dynamic content
  - Feature flag `USE_OPTIMIZED_INSTRUCTIONS` controls which version is used
  - Main export `getCurriculumFocusInstruction` switches based on flag

### 3. Token Savings
- **Per turn**: ~500 tokens (2,000 characters)
- **30-turn conversation**: ~15,000 tokens saved
- **Reduction**: ~60-70% of curriculum instruction size

## Migration Steps

### Phase 1: Testing (Current)
```bash
# Enable optimized instructions
export USE_OPTIMIZED_INSTRUCTIONS=true

# Run the application and test various scenarios
```

### Phase 2: Gradual Rollout
1. Deploy with feature flag disabled (default)
2. Enable for small percentage of users
3. Monitor quality metrics
4. Gradually increase percentage

### Phase 3: Full Deployment
1. Set `USE_OPTIMIZED_INSTRUCTIONS=true` as default
2. Monitor for 1-2 weeks
3. Remove legacy code if stable

## Validation

Run validation tests by opening the console and executing:
```javascript
validateTeachingOptimization()
```

This will verify:
1. Token reduction is achieved
2. All dynamic content is preserved
3. Teaching invariants contain required elements

## Rollback Plan

If issues arise:

1. **Immediate**: Set `USE_OPTIMIZED_INSTRUCTIONS=false`
2. **Code revert**: The legacy function is preserved and can be restored
3. **Monitoring**: Check for:
   - Missing teaching requirements in responses
   - Reduced explanation quality
   - User complaints about depth

## What Moved to Base Instructions

### Static Elements (Now in TEACHING_INVARIANTS):
- Teaching point requirements (5 mandatory elements)
- Quality standards ("immense depth and thoroughness")
- Knowledge base requirements
- Structural formatting rules
- Check Understanding section format

### Dynamic Elements (Still Per-Turn):
- Current module name
- Current phase and chunk number
- Specific teaching points
- Concept details
- Primary action type

## Benefits

1. **Efficiency**: 500 tokens saved per turn
2. **Clarity**: Per-turn instructions focus on WHAT to teach
3. **Consistency**: Teaching standards enforced at system level
4. **Cost**: Reduced API usage costs

## Risks & Mitigations

### Risk 1: Instruction Adherence Decay
- **Mitigation**: Strong preamble using "MANDATORY" and "INVARIANTS" framing
- **Monitoring**: Track teaching quality metrics

### Risk 2: Missing Requirements
- **Mitigation**: Comprehensive testing before rollout
- **Monitoring**: User feedback and response analysis

### Risk 3: Context Confusion
- **Mitigation**: Clear separation of static vs dynamic content
- **Monitoring**: Check for responses missing key elements

## Technical Details

### Old Format (Per-Turn)
```
[RecursiveSensei Curriculum Focus for this turn:
- Current Module: [DYNAMIC]
- Current Pedagogical Phase: [DYNAMIC]

== ⭐ PRIMARY ACTION FOR THIS TURN: [TYPE] ⭐ ==
For each teaching point, you MUST:
- Clearly define the core idea... [STATIC - 600 chars]
- Provide examples... [STATIC]
- Anticipate confusion... [STATIC]
...
[2000+ characters total]
```

### New Format (Per-Turn)
```
[CURRICULUM FOCUS]
Module: [DYNAMIC]
Phase: [DYNAMIC]

PRIMARY ACTION: [TYPE]
Teaching Points:
- [DYNAMIC LIST]

Context:
- Module Goal: [DYNAMIC]
[~500 characters total]
```

### Base Instructions Addition
All static requirements moved to `RECURSIVE_SENSEI_TEACHING_INVARIANTS` in system prompt.

## Monitoring Success

Track these metrics:
1. Average response quality scores
2. User satisfaction ratings
3. Token usage per conversation
4. Response completeness (all required elements present)

## Contact

For questions or issues with this optimization, consult the development team or review the git history for these changes.
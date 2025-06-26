# Socratic Teaching Plan Implementation Design (v4 - Autonomous Sensei with Per-Turn Pedagogical Guidance)

## Executive Summary

This document presents a refined approach that combines structured teaching plan generation with autonomous Sensei execution. The key innovation is that while we require the LLM to plan with explicit turn expectations (8-20 turns), we give Sensei full autonomy to manage the conversation flow naturally, without turn-by-turn micromanagement.

**v4 Update**: This version adds per-turn pedagogical guidance integration, matching the pattern used in IntroIllustrate phase. Sensei receives both the Socratic teaching plan AND dynamic pedagogical guidance each turn, with explicit instructions on how to integrate them.

### Core Principles:
1. **Structured Planning**: LLM generates detailed plans with `expectedTurns` to ensure thoughtful design
2. **Autonomous Execution**: Sensei receives the full plan once and manages the entire dialogue
3. **Natural Progression**: No forced turn advancement; Sensei decides pacing based on learner needs
4. **Flag-Based Completion**: Sensei signals when learning objectives are met
5. **Full Pipeline Integration**: All existing systems (learner model, pedagogical profiler) remain active
6. **Per-Turn Guidance** (NEW): Pedagogical profiler provides HOW-to-teach guidance each turn

---

## Part 1: The Master Categorization Prompt

### The Gold Standard Prompt for Socratic Plan Generation

This prompt forces the LLM to create a well-structured plan while knowing that execution will be flexible and autonomous.

```typescript
export function GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT(
    socraticSectionContent: string,
    moduleTitle: string,
    moduleGoal: string,
    conceptsSummary: string
): string {
    return `You are a world-class Socratic Teaching Plan Architect. Your task is to analyze the given Socratic section and generate ONE comprehensive teaching plan that will guide multi-turn interactive dialogue.

CRITICAL: You must FIRST categorize the Socratic content, THEN generate an appropriate plan.

MODULE CONTEXT:
Title: ${moduleTitle}
Goal: ${moduleGoal}
Concepts Covered: ${conceptsSummary}

SOCRATIC SECTION TO ANALYZE:
${socraticSectionContent}

STEP 1: CATEGORIZE THE SOCRATIC TYPE
Analyze the content and identify which primary type this Socratic section represents:

A) LEETCODE_PROBLEM_BASED: Contains specific LeetCode problems (LC ###) with collaborative solving focus
   - Indicators: Multiple "LC ###" references, problem-specific questions, data flow exploration
   - Example markers: "LC 700", "collaborative solving", "problem-specific guidance"

B) CONCEPT_EXPLORATION: Focuses on understanding concepts in new domains/scenarios
   - Indicators: "new domains", "novel scenarios", "explain in your own words", domain transfer
   - Example markers: "Can you explain X for [new domain]?", "self-similarity", "Leap of Faith"

C) COMPARATIVE_ANALYSIS: Explicitly contrasts different approaches or concepts
   - Indicators: "contrast", "vs", "difference between", parallel examples
   - Example markers: "computational vs generative", "approach A vs approach B"

D) EXECUTION_TRACING: Step-by-step execution analysis and stack tracing
   - Indicators: "trace", "stack", "exact values", "frames", execution flow
   - Example markers: "What goes onto the stack?", "trace through", "return flow"

E) PATTERN_RECOGNITION: Identifying patterns from problems or statements
   - Indicators: "pattern", "recognize", "clues", "signals", meta-analysis
   - Example markers: "pattern identification", "keyword analysis", "hypothesis formation"

STEP 2: GENERATE THE TEACHING PLAN
Based on your categorization, generate a teaching plan following these STRICT RULES:

1. OUTPUT FORMAT: Return ONLY a valid JSON object with this structure:
{
  "detected_category": "LEETCODE_PROBLEM_BASED" | "CONCEPT_EXPLORATION" | "COMPARATIVE_ANALYSIS" | "EXECUTION_TRACING" | "PATTERN_RECOGNITION",
  "category_justification": "Brief explanation of why this category was chosen",
  "teaching_plan": [[{
    "text": "SOCRATIC_INTENT: [comprehensive multi-paragraph guidance]",
    "kcValue": 0.65,
    "isSocraticIntent": true,
    "interactionGuidance": {
      "expectedTurns": [number 8-20],
      "turnManagement": "[specific turn-by-turn guidance]",
      "completionTriggers": ["list of specific completion conditions"]
    }
  }]]
}

2. INTERACTION GUIDANCE RULES:
- Include EXPLICIT turn management instructions
- Specify WHEN to wait for responses
- Define CLEAR completion triggers
- Include FALLBACK completion after N turns

3. CATEGORY-SPECIFIC TEMPLATES:

FOR LEETCODE_PROBLEM_BASED:
- Structure: Intro → Problem-by-problem exploration → Pattern synthesis
- Turn management: "After each question, WAIT for response before proceeding"
- Include: "For each problem: ASK exploratory question → WAIT → Guide based on response → WAIT → Solve collaboratively"

FOR CONCEPT_EXPLORATION:
- Structure: Opening probe → Domain exploration → Concept reinforcement
- Turn management: "Each numbered section requires learner response before moving forward"
- Include: "NEVER provide answers; only ask guiding questions"

FOR COMPARATIVE_ANALYSIS:
- Structure: Setup contrasts → Explore differences → Synthesize understanding
- Turn management: "Present one contrast at a time, wait for analysis"
- Include: "Build comparison incrementally over multiple turns"

FOR EXECUTION_TRACING:
- Structure: Prediction → Step-by-step trace → Insight extraction
- Turn management: "Each trace step is one turn - wait for learner to complete"
- Include: "Guide through ONE frame at a time"

FOR PATTERN_RECOGNITION:
- Structure: Present examples → Extract patterns → Practice recognition
- Turn management: "One problem at a time for pattern identification"
- Include: "Confirm pattern understanding before presenting next example"

4. CRITICAL INSTRUCTIONS FOR MULTI-TURN EXECUTION:
Your teaching plan must include explicit instructions like:
- "Begin with: [exact opening question]. WAIT for response."
- "Based on their answer to question 1, proceed to..."
- "Do NOT move to next problem until current one is understood"
- "If confusion detected, add scaffolding questions"
- "Complete when: [specific conditions] OR after [N] turns"

REMEMBER: The plan should guide a conversation over 8-20 turns, not be executed in one response.`;
}
```

### What This Prompt Achieves:
- **Forces Structure**: The `expectedTurns` requirement makes the LLM think through the entire dialogue arc
- **Provides Flexibility**: Turn management instructions guide without constraining
- **Ensures Interactivity**: Explicit WAIT instructions prevent content dumping
- **Enables Completion**: Multiple trigger types allow natural conversation endings

---

## Part 2: Socratic Phase Initialization and Execution

### 2A: One-Time Sensei Initialization for Socratic Phase

Instead of micromanaging Sensei with per-turn instructions, we initialize Sensei once at the beginning of the Socratic phase with the complete teaching plan and let it manage the entire dialogue autonomously.

```typescript
function buildSocraticInitialInstruction(
    teachingPlan: any
): string {
    const intent = teachingPlan[0][0]; // The single Socratic intent
    const guidance = intent.interactionGuidance;
    
    return `You are now entering SOCRATIC DIALOGUE MODE. You will autonomously manage this entire teaching session.

TEACHING PLAN OVERVIEW:
- Expected conversation length: ${guidance.expectedTurns} turns
- Your role: Guide the learner through discovery using the Socratic method
- Completion triggers: ${JSON.stringify(guidance.completionTriggers)}

YOUR SOCRATIC TEACHING PLAN:
${intent.text}

TURN MANAGEMENT GUIDANCE:
${guidance.turnManagement}

CRITICAL EXECUTION RULES:

1. AUTONOMOUS MANAGEMENT:
   - You are responsible for the entire dialogue flow
   - Track progress internally through the teaching plan
   - Adapt pacing based on learner responses
   - Add scaffolding when needed, skip ahead if learner demonstrates mastery

2. SOCRATIC PRINCIPLES:
   - Guide discovery through questions, don't lecture
   - One main question or concept per exchange
   - Build on learner's previous responses
   - If they struggle, provide hints rather than answers

3. COMPLETION MONITORING:
   Throughout the conversation, monitor for these completion conditions:
   ${guidance.completionTriggers.map(t => `- ${t}`).join('\n   ')}
   
   When you determine that a completion trigger has been genuinely met:
   - Continue your current response naturally
   - At the END of your response, add this EXACT flag on a new line:
   [SOCRATIC_COMPLETION_TRIGGERED: <trigger_description>]
   
   Example:
   "Excellent! You've identified the key difference between passing data down through parameters versus returning values up the call stack. This understanding is fundamental to designing effective recursive solutions.
   
   [SOCRATIC_COMPLETION_TRIGGERED: learner articulated data flow patterns clearly]"

4. NATURAL CONVERSATION FLOW:
   - Don't rush toward completion triggers
   - Allow tangential explorations if pedagogically valuable
   - Consider the expectedTurns as a guide, not a hard limit
   - Signal completion when learning objectives are truly met

5. DYNAMIC ADAPTATION:
   - You will receive learner state updates with each interaction
   - Use pedagogical flags to adjust your approach
   - If high confusion/frustration detected, provide more support
   - If high confidence/engagement detected, increase challenge

EXECUTION DIRECTIVE:
Execute the Socratic dialogue according to your teaching plan. Guide the learner through discovery using questions. Respond to their input while maintaining the Socratic method.`;
}
```

### 2B: Per-Turn Socratic Execution with Pedagogical Guidance (NEW in v4)

After the initial turn, Sensei receives structured guidance each turn that tells it HOW to execute the Socratic plan based on the current learner state.

```typescript
function buildSocraticExecutionInstruction(
    teachingPlan: any,
    pedagogicalGuidance: any,
    isFirstTurn: boolean = false
): string {
    const intent = teachingPlan[0][0]; // The single Socratic intent
    const guidance = intent.interactionGuidance;
    
    // For first turn, include full teaching plan
    if (isFirstTurn) {
        return buildSocraticInitialInstruction(teachingPlan);
    }
    
    // Check if MUST_OBEY
    const isMustObey = pedagogicalGuidance.metaPrompt && 
                       pedagogicalGuidance.metaPrompt.includes('MUST_OBEY');
    
    if (isMustObey) {
        // Critical override - ONLY execute MUST_OBEY, ignore Socratic plan this turn
        return `[RecursiveSensei CRITICAL OVERRIDE for THIS TURN:
A high-priority situation has been detected. For this turn, you MUST IGNORE the standard Socratic dialogue plan provided below.
Your SOLE TASK is to execute the following high-priority directive with immense detail, empathy, and care. This directive takes absolute precedence.

High-Priority Directive: ${pedagogicalGuidance.metaPrompt}

(The standard Socratic dialogue plan, which you will ignore for this turn, is:
${intent.text}

You will continue with this plan in the next turn after addressing the current critical situation.)
]`;
    }
    
    // Normal Socratic turn with pedagogical guidance
    return `[RecursiveSensei Task & Checklist for THIS TURN:
Your task is to generate a response by following this prioritized checklist. You MUST evaluate and execute these steps in order.

**Your Response Checklist:**
1.  **Execute Socratic Plan:** Continue your Socratic dialogue according to your teaching plan.
2.  **Integrate Guidance Strategy:** You MUST use the methods, tone, and style from the \`PedagogicalGuidance\` to facilitate the Socratic dialogue. For example, if the guidance suggests using simpler language, adjust your questions accordingly.

---
**Inputs for your checklist:**

- **PedagogicalGuidance:** ${pedagogicalGuidance.directive || 'Continue with standard Socratic questioning approach'}
- **SocraticContext:** You are executing a Socratic dialogue. Expected length: ~${guidance.expectedTurns} turns. Monitor for completion triggers: ${JSON.stringify(guidance.completionTriggers)}

---

COMPLETION MONITORING: If any completion trigger is met, add [SOCRATIC_COMPLETION_TRIGGERED: <trigger>] at the END of your response.]`;
}
```

### What This Approach Changes:
- **One-Time Setup**: Sensei receives full context at phase start, not per-turn instructions
- **Internal Management**: Sensei tracks its own progress through the teaching plan
- **Natural Pacing**: No forced progression to "turn N" content
- **Adaptive Flow**: Sensei can speed up, slow down, or diverge based on learner needs
- **Maintained Structure**: The teaching plan still provides clear guidance and expectations
- **Per-Turn Adaptation** (NEW): Pedagogical guidance tells HOW to execute the plan each turn

---

## Part 3: Integration with Existing Systems

### The Complete Response Flow

Here's how the Socratic phase integrates with the existing pipeline while maintaining Sensei's autonomy:

```typescript
async function generateNextSenseiResponse(
    userInput: string,
    curriculumState: CurriculumState,
    learnerModel: LearnerModel,
    // ... other params
): Promise<SenseiResponse> {
    
    if (curriculumState.currentPhase === 'Socratic') {
        // Track turns internally for monitoring (not for instruction)
        if (!curriculumState.socraticTurnCount) {
            curriculumState.socraticTurnCount = 0;
        }
        curriculumState.socraticTurnCount++;
        
        // Run the full analysis pipeline (unchanged)
        const analysis = await getAnalysisFromGemini(
            userInput,
            learnerModel,
            curriculumState
        );
        
        // Update learner model (unchanged)
        const updatedLearnerModel = updateLearnerModel(
            userInput,
            analysis,
            learnerModel,
            expectedContentPoints,
            curriculumState
        );
        
        // Get pedagogical guidance (unchanged)
        const pedagogicalGuidance = pedagogicalProfiler.analyze(
            updatedLearnerModel,
            curriculumState
        );
        
        // Build Socratic execution instruction with pedagogical guidance (NEW in v4)
        const socraticInstruction = buildSocraticExecutionInstruction(
            curriculumState.teachingPlanForPhase,
            pedagogicalGuidance,
            curriculumState.socraticTurnCount === 1
        );
        
        // Sensei responds with full context
        const response = await senseiRespond(socraticInstruction, userInput);
        
        // Check for completion flag
        const completion = checkForSocraticCompletion(response.text);
        
        if (completion.triggered) {
            logger.info(`[SOCRATIC] Completion triggered at turn ${curriculumState.socraticTurnCount}: ${completion.trigger}`);
            
            // Mark for advancement after response is displayed
            schedulePhaseAdvancement(curriculumState, completion.trigger);
        }
        
        // Return clean response (without the flag)
        return {
            ...response,
            text: completion.cleanResponse,
            metadata: {
                turnCount: curriculumState.socraticTurnCount,
                expectedTurns: socraticPlan[0][0].interactionGuidance.expectedTurns
            }
        };
    }
    
    // ... handle other phases
}
```

### What Remains Active:
1. **Learner Analysis**: Full analysis pipeline runs every turn
2. **Model Updates**: Learner model tracks understanding and affect
3. **Pedagogical Profiling**: Flags like high confusion still influence responses
4. **Dynamic Context**: Sensei receives updated learner state each turn
5. **Turn Tracking**: Internal counting for logging/monitoring (not for control)

### What Changes:
1. **No Turn-Specific Instructions**: Removed "Execute turn N" commands
2. **Single Initialization**: Teaching plan provided once at phase start
3. **Autonomous Progress**: Sensei decides when to move between teaching plan sections
4. **Natural Adaptation**: Pedagogical context influences but doesn't override Sensei's plan
5. **Structured Guidance** (NEW): Per-turn checklist tells HOW to apply pedagogical guidance

---

## Part 4: Dynamic System Instruction Building

### Modified to Support Autonomous Execution

The dynamic system instruction is no longer used for Socratic phase, as the per-turn instructions are now handled by `buildSocraticExecutionInstruction`. This function remains for other phases:

```typescript
function buildSenseiDynamicSystemInstruction(
    baseInstruction: string,           // Either base persona or Socratic plan
    pedagogicalGuidance: any,          // Current pedagogical state
    learnerModel: LearnerModel,        // Current learner state
    includeExecutionControl: boolean = true  // False for Socratic phase
): string {
    
    // Note: For Socratic phase, this function is bypassed in favor of 
    // buildSocraticExecutionInstruction which handles both normal and MUST_OBEY cases
    
    let instruction = baseInstruction;
    
    // Check if we have a MUST_OBEY prompt
    if (pedagogicalGuidance.metaPrompt && pedagogicalGuidance.metaPrompt.includes('MUST_OBEY')) {
        // For non-Socratic phases, use MUST_OBEY as-is
        instruction = pedagogicalGuidance.metaPrompt;
        return instruction;
    }
    
    // Normal flow continues here...
    // Add learner state context (always included)
    instruction += `\n\nCURRENT LEARNER STATE:
- Confidence: ${learnerModel.AffectiveState.Confidence}
- Confusion: ${learnerModel.AffectiveState.Confusion}
- Engagement: ${learnerModel.AffectiveState.Engagement}
- Recent Performance: ${learnerModel.LearningTrajectory.RecentPerformanceTrend}`;
    
    // Add pedagogical flags if present
    if (pedagogicalGuidance.flags && pedagogicalGuidance.flags.length > 0) {
        instruction += `\n\nPEDAGOGICAL ALERTS:`;
        pedagogicalGuidance.flags.forEach(flag => {
            instruction += `\n- ${flag}`;
        });
    }
    
    // Add meta-prompt if provided
    if (pedagogicalGuidance.metaPrompt) {
        instruction += `\n\nADAPTATION GUIDANCE:\n${pedagogicalGuidance.metaPrompt}`;
    }
    
    // For non-Socratic phases, add execution control
    if (includeExecutionControl) {
        instruction += `\n\nEXECUTION DIRECTIVE:
Respond to the user's input while considering the above context.`;
    }
    
    return instruction;
}
```

### Key Differences:
- **Socratic Bypasses This**: Socratic phase uses `buildSocraticExecutionInstruction` instead
- **Maintains Compatibility**: Other phases continue to work as before
- **Clear Separation**: Each phase has its own instruction building logic

---

## Part 5: Completion Detection and Phase Advancement

### Flag-Based Completion System (Unchanged)

The completion detection mechanism remains exactly as designed:

```typescript
interface SocraticCompletionResult {
    triggered: boolean;
    trigger?: string;
    cleanResponse: string;
}

function checkForSocraticCompletion(senseiResponse: string): SocraticCompletionResult {
    // Check for completion flag using regex
    const completionRegex = /\[SOCRATIC_COMPLETION_TRIGGERED:\s*(.+?)\]/;
    const match = senseiResponse.match(completionRegex);
    
    if (match) {
        return {
            triggered: true,
            trigger: match[1].trim(),
            cleanResponse: senseiResponse.replace(completionRegex, '').trim()
        };
    }
    
    return {
        triggered: false,
        cleanResponse: senseiResponse
    };
}
```

### Post-Response Advancement Check

After displaying Sensei's response:

```typescript
// In the main interaction loop, after displaying Sensei's response:
if (curriculumState.socraticCompletionPending?.triggered) {
    logger.info('[SOCRATIC] Processing pending completion');
    logger.info(`[SOCRATIC] Completed after ${curriculumState.socraticTurnCount} turns`);
    
    // Award full phase KC
    const phaseKCId = currentItem.curriculumPathId;
    updateKC(learnerModel, phaseKCId, 0.65, true);
    
    // Log completion details
    logger.log(`[SOCRATIC] Phase completed. Trigger: ${curriculumState.socraticCompletionPending.trigger}`);
    logger.log(`[SOCRATIC] Turn efficiency: ${curriculumState.socraticTurnCount}/${expectedTurns} turns`);
    
    // Clear the pending flag and reset turn count
    curriculumState.socraticCompletionPending = null;
    curriculumState.socraticTurnCount = 0;
    curriculumState.socraticBaseInstruction = null;
    
    // Advance curriculum
    await advanceCurriculumState(
        curriculum,
        curriculumState,
        learnerModel,
        llmPlanner
    );
    
    // Update UI for new phase
    updateCurriculumDisplay(/* ... */);
}
```

### What This Achieves:
- **Natural Completion**: Based on learning objectives, not turn count
- **Efficiency Tracking**: Logs actual vs expected turns for analysis
- **Clean State Reset**: Prepares for next phase
- **Full KC Award**: 0.65 points for completing Socratic phase

---

## Part 6: Example Teaching Plans with Autonomous Execution

### Example 1: LeetCode Problem-Based (Module 3)

Note how the plan provides detailed structure while allowing flexible execution:

```json
{
  "detected_category": "LEETCODE_PROBLEM_BASED",
  "category_justification": "Contains 7 general questions followed by 5 LC problems with collaborative solving focus",
  "teaching_plan": [[{
    "text": "SOCRATIC_INTENT: Guide learner through 7 foundational questions about recursion contracts, then apply insights to 5 LeetCode problems.\n\nPHASE 1 - GENERAL FOUNDATIONS (Expected: Turns 1-7):\nWork through these questions sequentially, but adapt based on responses:\n\n1. 'What exactly should a recursive function promise to do?' - Explore function contracts\n2. 'Is the goal Computational or Generative?' - Distinguish return types\n3. 'What information must be passed down?' - Parameter design\n4. 'What are valid subproblems?' - Problem decomposition\n5. 'Which parts stay invariant?' - Identifying constants\n6. 'How do return values compose?' - Building solutions\n7. 'Where does state accumulate?' - State management patterns\n\nIMPORTANT: Don't rush. If learner struggles with contracts (Q1), spend extra time before moving on. If they grasp concepts quickly, you can combine related questions.\n\nPHASE 2 - LEETCODE APPLICATIONS (Expected: Turns 8-18):\nApply foundations to problems in this order:\n\na. LC 700 (BST Search) - Simple parameter passing\nb. LC 129 (Sum Root-to-Leaf) - State accumulation\nc. LC 437 (Path Sum III) - Complex state tracking\nd. LC 112 (Path Sum) - Boolean computation\ne. LC 235 (LCA in BST) - Leveraging constraints\n\nFor each problem:\n- Start with 'What does this problem ask for?'\n- Connect to relevant foundation questions\n- Guide toward solution collaboratively\n- Confirm understanding before moving on\n\nADAPTATION NOTES:\n- If learner excels, explore edge cases deeply\n- If learner struggles, focus on first 3 problems thoroughly\n- Always ensure LC 700 and 129 are well understood (core patterns)\n\nCOMPLETION READINESS:\nLook for evidence that learner can:\n- Distinguish when to pass parameters vs return values\n- Explain accumulator pattern\n- Apply patterns to new problems independently",
    "kcValue": 0.65,
    "isSocraticIntent": true,
    "interactionGuidance": {
      "expectedTurns": 18,
      "turnManagement": "Phase 1 should be ~1 turn per question but adapt to learner needs. Phase 2 should be 2-3 turns per problem. Never present multiple questions without waiting for response.",
      "completionTriggers": [
        "All 7 foundation questions explored AND at least 3 LC problems understood",
        "Learner articulates parameter passing vs return value patterns clearly",
        "Learner successfully applies patterns to a new problem independently",
        "18+ turns with solid understanding demonstrated",
        "Learner explicitly requests to move forward after demonstrating competence"
      ]
    }
  }]]
}
```

### What Makes This Plan Autonomous-Friendly:
1. **Phases as Guides**: "Expected: Turns 1-7" suggests pacing without enforcing it
2. **Adaptation Instructions**: "If learner struggles... If they grasp quickly..."
3. **Priority Guidance**: "Always ensure LC 700 and 129 are well understood"
4. **Flexible Completion**: Multiple triggers allow natural endpoints
5. **Clear Objectives**: "Look for evidence that learner can..."

### Example 2: Concept Exploration (Module 1)

Shows how conceptual exploration works with autonomous management:

```json
{
  "detected_category": "CONCEPT_EXPLORATION",
  "teaching_plan": [[{
    "text": "SOCRATIC_INTENT: Explore recursion through self-similarity in multiple domains, building toward the Leap of Faith concept.\n\nOPENING EXPLORATION:\nBegin: 'Can you think of something in everyday life that exhibits self-similarity - where the whole resembles its parts?'\n\nBased on their example, explore:\n- What makes it self-similar?\n- What would be the 'base case' in their example?\n- How do smaller versions contribute to the whole?\n\nDOMAIN PROGRESSION:\nIntroduce new domains based on their engagement level:\n\nBASIC SET (if struggling):\n- Russian nesting dolls\n- Family trees\n- Folder structures\n\nSTANDARD SET (typical path):\n- Fractals in nature (coastlines, ferns)\n- Organizational hierarchies\n- Recursive acronyms (GNU)\n\nADVANCED SET (if excelling):\n- Economic market behaviors\n- Consciousness and self-awareness\n- Mathematical induction\n\nLEAP OF FAITH EXPLORATION:\nWhen ready (not before 3-4 examples), introduce:\n'In recursion, we trust that smaller subproblems will be solved correctly. Why might this feel uncomfortable at first?'\n\nExplore:\n- The discomfort of not tracking everything\n- Why the trust is justified\n- Connection to mathematical induction\n\nEDGE CASE DISCOVERY:\n'What would happen in your [first example] if there was no smallest version?'\nLet them discover infinite recursion/stack overflow.\n\nADAPTIVE GUIDELINES:\n- Use simpler examples if confusion > medium\n- Add philosophical depth if engagement = high\n- Always return to their initial example for connections\n- Spend more time on Leap of Faith if this is their first exposure",
    "kcValue": 0.65,
    "isSocraticIntent": true,
    "interactionGuidance": {
      "expectedTurns": 12,
      "turnManagement": "Opening exploration: 2-3 turns. Each domain: 1-2 turns. Leap of Faith: 3-4 turns. Edge cases: 2 turns. Adapt based on engagement.",
      "completionTriggers": [
        "Learner explains self-similarity in their own words using 2+ examples",
        "Learner articulates why the Leap of Faith works",
        "Learner identifies base case necessity through edge case exploration",
        "12+ turns with key concepts understood",
        "High confidence expressed about recursion concept"
      ]
    }
  }]]
}
```

---

## Part 7: Special Cases and Pedagogical Overrides

### Handling High Frustration/Confusion

The autonomous approach handles struggling learners better:

```typescript
// In pedagogicalProfiler output
if (flags.includes('Flag:High_Frustration') || flags.includes('Flag:High_Confusion')) {
    metaPrompt = `CRITICAL: Learner showing high frustration/confusion. 
    - Slow down significantly
    - Provide more scaffolding
    - Consider simpler examples
    - Acknowledge their struggle explicitly
    - Don't advance to new concepts until stability returns`;
}

// Sensei receives this in dynamic context and adapts accordingly
// No need to block completion - Sensei won't signal completion while learner struggles
```

### Benefits of Autonomous Handling:
1. **Natural Support**: Sensei provides help within conversation flow
2. **No Jarring Overrides**: No sudden system interventions
3. **Contextual Decisions**: Sensei judges when learner is ready
4. **Maintained Rapport**: Continuous relationship through difficulties

---

## Part 8: Implementation Advantages

### 1. **Natural Conversation Flow**
- No artificial turn boundaries
- Sensei can spend 5 turns on one concept if needed
- Quick learners can progress faster
- Natural tangents are allowed

### 2. **Better Pedagogical Outcomes**
- Sensei responds to actual understanding, not turn count
- Completion based on learning objectives
- Flexible pacing matches learner needs
- Maintains engagement through autonomy

### 3. **Simpler System Design**
- One initialization instead of per-turn management
- No complex turn-state synchronization
- Clear separation of planning and execution
- Easier to debug and maintain

### 4. **Enhanced Sensei Capabilities**
- Full context from start enables better planning
- Can reference future content when relevant
- Can revisit earlier concepts naturally
- Better narrative arc through entire phase

### 5. **Robust Error Handling**
- If Sensei doesn't signal completion, fallback at 2x expectedTurns
- Pedagogical overrides still available for extreme cases
- Turn tracking available for analytics
- Clean phase transitions

### 6. **Consistent Pattern Across Phases** (NEW in v4)
- All phases now use the same checklist pattern
- Clear separation of WHAT (curriculum/plan) and HOW (pedagogical guidance)
- MUST_OBEY handling is consistent but phase-appropriate

---

## Part 9: Metrics and Monitoring

### What We Track

Even with autonomous execution, we monitor:

```typescript
interface SocraticPhaseMetrics {
    actualTurns: number;              // How many turns actually taken
    expectedTurns: number;            // What was planned
    completionTrigger: string;        // Which trigger ended the phase
    timeSpent: number;                // Total time in phase
    learnerStateProgression: {        // How learner state evolved
        confidenceStart: string;
        confidenceEnd: string;
        understandingGained: number;  // KC points accumulated
    };
    pedagogicalInterventions: number; // How many high-flag states occurred
}
```

### Benefits for Iteration:
- Compare actual vs expected turns to refine prompts
- Identify which completion triggers are most common
- Track learning efficiency across different content types
- Improve teaching plans based on outcomes

---

## Summary: The Autonomous Approach with Per-Turn Guidance

This v4 design achieves the best of all worlds:

### From Structured Planning:
- ✅ Forces LLM to think through entire dialogue arc
- ✅ Provides clear learning objectives
- ✅ Ensures comprehensive content coverage
- ✅ Sets reasonable expectations (8-20 turns)

### From Autonomous Execution:
- ✅ Natural conversation flow
- ✅ Adaptive pacing based on learner needs
- ✅ No forced progression or artificial boundaries
- ✅ Sensei maintains teaching relationship

### From Per-Turn Guidance (NEW in v4):
- ✅ Consistent with IntroIllustrate pattern
- ✅ Clear HOW-to-teach instructions each turn
- ✅ Seamless MUST_OBEY integration
- ✅ Maintains Socratic autonomy while providing support

### Key Innovation:
**Planning Structure + Autonomous Execution + Dynamic Guidance**

We require structured plans to ensure quality, give Sensei full autonomy to execute those plans naturally, AND provide per-turn pedagogical guidance on HOW to adapt the execution based on learner state. The flag-based completion system allows graceful phase transitions based on actual learning rather than mechanical turn counting.

This approach treats Sensei as a skilled teacher who receives a lesson plan, has full authority to adapt it based on their students' needs, and gets ongoing coaching on pedagogical best practices - exactly how human teachers operate effectively with mentorship.
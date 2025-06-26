# Socratic Teaching Plan Implementation Design (v2 - Flag-Based)

## Executive Summary

This document provides the implementation design for generating and executing Socratic teaching plans using a flag-based completion system rather than turn tracking. Sensei monitors for completion triggers and raises a flag when ready to advance.

---

## Part 1: The Master Categorization Prompt

### The Gold Standard Prompt for Socratic Plan Generation

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
    "completionTriggers": {
      "understanding": ["learner can explain X", "learner demonstrates Y"],
      "exhaustion": ["learner requests to move on", "learner shows fatigue"],
      "coverage": ["all problems discussed", "key concepts explored"],
      "synthesis": ["learner makes connections between concepts", "pattern recognized"]
    }
  }]]
}

2. COMPLETION TRIGGER RULES:
- Include 3-5 specific, observable completion triggers
- Mix different types: understanding-based, coverage-based, synthesis-based
- Include at least one "escape hatch" trigger (fatigue, explicit request)
- Make triggers specific to the content, not generic

3. CATEGORY-SPECIFIC TEMPLATES:

FOR LEETCODE_PROBLEM_BASED:
- Structure: Intro → Problem-by-problem exploration → Pattern synthesis
- Completion triggers: "solved N problems with understanding", "identified common patterns", "can explain data flow choices"
- Include: "For each problem: ASK exploratory question → WAIT for response → Guide based on response → Solve collaboratively"

FOR CONCEPT_EXPLORATION:
- Structure: Opening probe → Domain exploration → Concept reinforcement
- Completion triggers: "explained concept in own words", "applied to 2+ new domains", "identified edge cases"
- Include: "NEVER provide answers; only ask guiding questions"

FOR COMPARATIVE_ANALYSIS:
- Structure: Setup contrasts → Explore differences → Synthesize understanding
- Completion triggers: "articulated key differences", "chose appropriate approach for scenario", "created comparison framework"
- Include: "Build comparison incrementally through dialogue"

FOR EXECUTION_TRACING:
- Structure: Prediction → Step-by-step trace → Insight extraction
- Completion triggers: "correctly traced full execution", "predicted behavior accurately", "explained stack mechanics"
- Include: "Guide through ONE frame at a time"

FOR PATTERN_RECOGNITION:
- Structure: Present examples → Extract patterns → Practice recognition
- Completion triggers: "identified pattern correctly", "explained recognition criteria", "applied to new problem"
- Include: "Confirm pattern understanding before presenting next"

REMEMBER: The plan guides a natural conversation. Sensei will monitor for these triggers and signal when met.`;
}
```

---

## Part 2: Sensei Execution with Completion Monitoring

### The Sensei Execution Instruction

```typescript
function buildSocraticExecutionInstruction(
    teachingPlan: any,
    userInputHistory: string[] // Keep track of conversation for trigger detection
): string {
    const intent = teachingPlan[0][0]; // The single Socratic intent
    const triggers = intent.completionTriggers;
    
    return `You are executing a SOCRATIC DIALOGUE PLAN. Critical rules:

1. SOCRATIC MODE: You are having a natural Socratic conversation guided by this plan.

2. YOUR TEACHING PLAN:
${intent.text}

3. COMPLETION MONITORING:
You must monitor for these completion triggers throughout the conversation:
${JSON.stringify(triggers, null, 2)}

4. WHEN A TRIGGER IS MET:
- Continue the current response naturally
- At the END of your response, add this EXACT flag on a new line:
[SOCRATIC_COMPLETION_TRIGGERED: <trigger_description>]

Example:
"Great job! You've correctly identified that both problems use the same data flow pattern. This understanding of when to pass by reference versus by value is crucial for recursive design.

[SOCRATIC_COMPLETION_TRIGGERED: learner identified common patterns]"

5. IMPORTANT RULES:
- Only signal completion when you're confident a trigger is genuinely met
- Don't force or rush toward triggers
- Let the conversation flow naturally
- If multiple triggers are met, signal the most significant one
- NEVER signal completion in the middle of a response

6. SOCRATIC PRINCIPLES:
- Guide discovery through questions
- Build on learner responses
- Add scaffolding if they struggle
- Celebrate insights when they occur`;
}
```

### Completion Detection in System

```typescript
interface SocraticCompletionResult {
    triggered: boolean;
    trigger?: string;
    cleanResponse: string;
}

function checkForSocraticCompletion(senseiResponse: string): SocraticCompletionResult {
    // Check for completion flag
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

---

## Part 3: Integration with Curriculum System

### Modified Response Flow

```typescript
async function generateNextSenseiResponse(
    userInput: string,
    curriculumState: CurriculumState,
    // ... other params
): Promise<SenseiResponse> {
    
    if (curriculumState.currentPhase === 'Socratic') {
        // Build Socratic execution instruction
        const socraticPlan = curriculumState.teachingPlanForPhase;
        const instruction = buildSocraticExecutionInstruction(
            socraticPlan,
            userInputHistory
        );
        
        // Get Sensei's response
        const response = await senseiRespond(instruction, userInput);
        
        // Check for completion flag
        const completion = checkForSocraticCompletion(response.text);
        
        if (completion.triggered) {
            logger.info('[SOCRATIC] Completion triggered:', completion.trigger);
            
            // Mark for advancement after response is displayed
            schedulePhaseAdvancement(curriculumState, completion.trigger);
        }
        
        // Return clean response (without the flag)
        return {
            ...response,
            text: completion.cleanResponse
        };
    }
    
    // ... handle other phases
}

function schedulePhaseAdvancement(
    state: CurriculumState,
    trigger: string
): void {
    // Set a flag that will be checked after the response is displayed
    state.socraticCompletionPending = {
        triggered: true,
        trigger: trigger,
        timestamp: Date.now()
    };
}
```

### Post-Response Advancement Check

```typescript
// In the main interaction loop, after displaying Sensei's response:
if (curriculumState.socraticCompletionPending?.triggered) {
    logger.info('[SOCRATIC] Processing pending completion');
    
    // Award full phase KC
    const phaseKCId = currentItem.curriculumPathId;
    updateKC(learnerModel, phaseKCId, 0.65, true);
    
    // Log completion
    logger.log(`[SOCRATIC] Phase completed. Trigger: ${curriculumState.socraticCompletionPending.trigger}`);
    
    // Clear the pending flag
    curriculumState.socraticCompletionPending = null;
    
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

---

## Part 4: Example Teaching Plans with Triggers

### Example 1: LeetCode Problem-Based

```json
{
  "detected_category": "LEETCODE_PROBLEM_BASED",
  "teaching_plan": [[{
    "text": "SOCRATIC_INTENT: Guide learner through 2 BST problems exploring data flow patterns.\n\nSTART: 'Let's explore LC 700 (BST Search). What information needs to flow down?'\n\nAFTER RESPONSE: Build on their answer. If they mention the target value, ask about return values. If stuck, hint: 'What do we need to know at each node?'\n\nWHEN LC 700 UNDERSTOOD: 'Now LC 129 (Sum Root to Leaf). This is different - we need to maintain state. Why?'\n\nGUIDE DISCOVERY: Help them see the accumulator pattern through questions.\n\nSYNTHESIS: Once both solved, ask them to compare the data flow patterns.\n\nREMEMBER: Guide through questions, don't lecture. Let them discover the patterns.",
    "kcValue": 0.65,
    "isSocraticIntent": true,
    "completionTriggers": {
      "understanding": [
        "learner explains difference between passing down vs returning up",
        "learner correctly implements both solutions"
      ],
      "synthesis": [
        "learner identifies when to use each data flow pattern",
        "learner creates comparison framework"
      ],
      "coverage": [
        "both problems solved and understood"
      ],
      "exhaustion": [
        "learner explicitly asks to move on",
        "learner shows frustration with problems"
      ]
    }
  }]]
}
```

### Example 2: Concept Exploration

```json
{
  "detected_category": "CONCEPT_EXPLORATION",
  "teaching_plan": [[{
    "text": "SOCRATIC_INTENT: Explore recursion in new domains.\n\nOPENING: 'Can you think of something in nature that exhibits self-similarity?'\n\nBUILD ON THEIR EXAMPLE: Whatever they suggest, explore its recursive properties. Ask about base cases, recursive steps.\n\nNEW DOMAINS: After their example, introduce others - file systems, fractals, organizational hierarchies.\n\nLEAP OF FAITH: 'When we trust a recursive call will work, what are we really trusting?'\n\nEDGE CASES: 'What happens without base cases?' Let them discover stack overflow.\n\nADAPT: If struggling, use simpler examples. If excelling, add complexity.",
    "kcValue": 0.65,
    "isSocraticIntent": true,
    "completionTriggers": {
      "understanding": [
        "learner explains self-similarity in their own example",
        "learner identifies base cases in novel domain",
        "learner articulates the Leap of Faith concept"
      ],
      "coverage": [
        "explored 3+ different domains",
        "discussed edge cases and consequences"
      ],
      "exhaustion": [
        "learner requests next topic",
        "conversation naturally concludes"
      ]
    }
  }]]
}
```

---

## Part 5: Advantages of Flag-Based Approach

### 1. **Natural Conversation Flow**
- No artificial turn counting
- Sensei responds to actual understanding, not arbitrary limits
- Conversations can be shorter or longer as needed

### 2. **Better Pedagogical Alignment**
- Completion based on learning outcomes, not time
- Sensei can extend discussion if needed
- Can complete early if learner demonstrates mastery

### 3. **Simpler Implementation**
- No turn state to track
- No synchronization issues
- Clear signal when ready to advance

### 4. **Flexible Triggers**
- Mix of understanding, coverage, and escape triggers
- Sensei judges when triggers are genuinely met
- Can adapt to different learner paces

### 5. **Clean Separation of Concerns**
- Sensei focuses on teaching
- System focuses on curriculum progression
- Clear interface through completion flag

---

## Part 6: Special Cases and Edge Handling

### Pedagogical Overrides

If high frustration or confusion is detected, the system can:
1. Ignore completion flags temporarily
2. Inject supportive interventions
3. Resume normal Socratic flow when stable

```typescript
// Don't advance if critical flags present
if (pedagogicalFlags.includes('Flag:High_Frustration') && 
    curriculumState.socraticCompletionPending) {
    logger.info('[SOCRATIC] Delaying advancement due to high frustration');
    curriculumState.socraticCompletionPending = null; // Clear the flag
    // Continue with support instead
}
```

### Timeout Fallback

As a safety net, we can still have a maximum exchange limit:

```typescript
// In teaching plan generation
"completionTriggers": {
    // ... other triggers ...
    "fallback": [
        "20 exchanges have occurred without other triggers"
    ]
}
```

### Module-Specific Adjustments

For Module 3's 7 general questions before problems:

```json
"completionTriggers": {
    "coverage": [
        "all 7 general questions explored",
        "at least 3 LeetCode problems understood"
    ],
    // ... other triggers
}
```

---

## Summary

This flag-based approach:
- ✅ Eliminates turn tracking complexity
- ✅ Allows natural conversation length
- ✅ Bases completion on actual learning
- ✅ Maintains clean separation between teaching and system
- ✅ Provides clear, deterministic advancement signals

The key insight: Let Sensei be the judge of when learning objectives are met, not an arbitrary turn counter.
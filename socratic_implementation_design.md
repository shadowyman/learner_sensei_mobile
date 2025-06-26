# Socratic Teaching Plan Implementation Design

## Executive Summary

This document provides the complete implementation design for generating and executing Socratic teaching plans, addressing:
1. Automatic categorization of Socratic content
2. Generation of appropriate teaching plans
3. Ensuring interactive multi-turn execution
4. Turn management and completion criteria

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

---

## Part 2: Example Outputs for Each Category

### Example 1: LeetCode Problem-Based (Module 3)

**Input Socratic Section:**
```
General questions for this Module:
- "What exactly should this function promise?"
- "Is the goal Computational or Generative?"
- "What information must be passed down?"

Specific Problems:
a. LC 700: Search in BST
   - "What key information do we need to pass down?"
   - "How does BST property help?"
b. LC 129: Sum Root to Leaf
   - "What state do we maintain going down?"
   - "When do we use the accumulated sum?"
```

**Generated Output:**
```json
{
  "detected_category": "LEETCODE_PROBLEM_BASED",
  "category_justification": "Contains multiple LC problems (700, 129) with specific questions for collaborative solving and data flow exploration",
  "teaching_plan": [[{
    "text": "SOCRATIC_INTENT: Guide learner through collaborative exploration of data flow patterns using 2 LeetCode problems, starting with general concepts then applying to specific problems.\n\nPHASE 1 - GENERAL FOUNDATION (Turns 1-3):\nBEGIN with: 'Before we dive into specific problems, let's think about function contracts. When you design a recursive function, what exactly should it promise to do?'\nWAIT for response.\nThen ask: 'Is the primary goal here Computational (returning one result) or Generative (creating many results)?'\nWAIT for response.\nFollow with: 'What information absolutely must be passed down via parameters to solve a subproblem?'\nWAIT for response.\n\nPHASE 2 - LC 700 EXPLORATION (Turns 4-7):\nTransition: 'Great! Let's apply these ideas to LC 700: Search in a BST. Can you describe what this problem asks for?'\nWAIT for response.\nGuide: 'What key piece of information do we need to pass down at each recursive step?'\nWAIT for response.\nProbe deeper: 'How does the BST property help us decide whether to go left or right?'\nWAIT for response.\nSynthesize: 'Let's code this together. What would our base case be?'\nWAIT and build solution interactively.\n\nPHASE 3 - LC 129 CONTRAST (Turns 8-11):\nTransition: 'Now LC 129: Sum Root to Leaf Numbers. This feels different. What state do we need to maintain as we go down?'\nWAIT for response.\nExplore: 'Why do we need to track the sum as we descend, unlike in BST search?'\nWAIT for response.\nKey insight: 'When exactly do we USE this accumulated sum?'\nWAIT for response.\nImplement: 'Show me how you'd update the state when moving from parent to child.'\nWAIT and guide implementation.\n\nPHASE 4 - PATTERN SYNTHESIS (Turns 12-15):\nReflect: 'Looking at both problems, what different data flow patterns did we use?'\nWAIT for response.\nGeneralize: 'When would you choose to pass information down vs. return it up?'\nWAIT for response.\nConclude: 'Can you create a simple decision framework for data flow choices?'\nWAIT for final synthesis.\n\nCOMPLETION TRIGGERS:\n- Learner articulates clear distinction between parameter passing patterns\n- Both problems solved with understanding\n- 15 turns reached\n- Learner demonstrates fatigue or requests to move on",
    "kcValue": 0.65,
    "isSocraticIntent": true,
    "interactionGuidance": {
      "expectedTurns": 15,
      "turnManagement": "Each question marked with WAIT requires a full turn. Never ask multiple questions without waiting. If answer is superficial, ask follow-up before moving on.",
      "completionTriggers": [
        "Learner explains data flow patterns clearly",
        "Both problems understood and implemented", 
        "15 turns elapsed",
        "Explicit request to continue"
      ]
    }
  }]]
}
```

### Example 2: Concept Exploration (Module 1)

**Generated Output Structure:**
```json
{
  "detected_category": "CONCEPT_EXPLORATION",
  "teaching_plan": [[{
    "text": "SOCRATIC_INTENT: Explore recursion concepts through new domains...\n\nTURN 1: 'Can you think of something in everyday life that exhibits self-similarity?' WAIT.\nTURN 2-3: Based on their example, explore its recursive nature...\nTURN 4-5: Present new scenario and identify base cases...\n[continues with explicit turn guidance]",
    "interactionGuidance": {
      "expectedTurns": 12,
      "turnManagement": "One concept per turn. Adapt follow-ups based on response depth.",
      "completionTriggers": ["Explains Leap of Faith clearly", "12 turns reached"]
    }
  }]]
}
```

---

## Part 3: Ensuring Interactive Execution

### The Sensei Execution Instruction

When Sensei receives a Socratic teaching plan, we modify the system instruction:

```typescript
function buildSocraticExecutionInstruction(
    teachingPlan: any,
    currentTurn: number
): string {
    const intent = teachingPlan[0][0]; // The single Socratic intent
    const guidance = intent.interactionGuidance;
    
    return `You are executing a SOCRATIC DIALOGUE PLAN. Critical rules:

1. CURRENT TURN: ${currentTurn} of ~${guidance.expectedTurns}

2. INTERACTION MODE: You are in turn ${currentTurn}. The teaching plan provides guidance for the ENTIRE conversation, but you must execute ONLY the current turn.

3. TURN MANAGEMENT RULES:
   - Read the plan to understand the full journey
   - Identify what should happen in turn ${currentTurn}
   - Execute ONLY that portion
   - ALWAYS end your response with a question or prompt for the learner
   - NEVER jump ahead to future turns
   - NEVER answer your own questions

4. SOCRATIC PRINCIPLES:
   - Guide discovery, don't lecture
   - One main question per turn
   - Build on their previous responses
   - If they struggle, add scaffolding rather than giving answers

5. COMPLETION CHECK:
   Completion triggers: ${JSON.stringify(guidance.completionTriggers)}
   Check if any trigger is met. If yes, prepare to wrap up in next 1-2 turns.

TEACHING PLAN FOR REFERENCE:
${intent.text}

EXECUTE TURN ${currentTurn} NOW. End with a clear question or prompt.`;
}
```

### Turn-by-Turn Execution Example

**Turn 1:**
```
Sensei: "Before we dive into specific problems, let's think about function contracts. When you design a recursive function, what exactly should it promise to do?"
```

**Turn 2 (after user response):**
```
Sensei: "Good thinking! You mentioned [reference their answer]. Now, is the primary goal here Computational (returning one result) or Generative (creating many results)? What's the difference?"
```

**Critical: Sensei STOPS and waits after each question.**

---

## Part 4: Completion and Advancement Logic

### Simple Completion Tracking

```typescript
interface SocraticPhaseState {
    turnCount: number;
    teachingPlan: any;
    completionTriggered: boolean;
    triggerReason?: string;
}

function checkSocraticCompletion(
    state: SocraticPhaseState,
    learnerResponse: string,
    analysis: any
): { shouldComplete: boolean; reason: string } {
    
    const triggers = state.teachingPlan[0][0].interactionGuidance.completionTriggers;
    
    // Check each trigger
    for (const trigger of triggers) {
        switch (trigger) {
            case "Learner explains data flow patterns clearly":
                if (analysis.understanding_score > 0.8 && 
                    learnerResponse.includes("pass") && 
                    learnerResponse.includes("return")) {
                    return { shouldComplete: true, reason: trigger };
                }
                break;
                
            case "15 turns elapsed":
                if (state.turnCount >= 15) {
                    return { shouldComplete: true, reason: trigger };
                }
                break;
                
            case "Explicit request to continue":
                if (learnerResponse.match(/move on|next|continue|enough/i)) {
                    return { shouldComplete: true, reason: trigger };
                }
                break;
        }
    }
    
    // Minimum turns before completion
    if (state.turnCount < 8) {
        return { shouldComplete: false, reason: "Minimum turns not reached" };
    }
    
    return { shouldComplete: false, reason: "No triggers met" };
}
```

### Advancement Decision

```typescript
function advanceSocraticPhase(
    state: CurriculumState,
    socraticState: SocraticPhaseState,
    pedagogicalFlags: string[]
): boolean {
    
    // Critical flags block advancement
    if (pedagogicalFlags.includes('Flag:High_Confusion') || 
        pedagogicalFlags.includes('Flag:High_Frustration')) {
        return false; // Continue supporting
    }
    
    // Check completion
    const completion = checkSocraticCompletion(
        socraticState,
        lastUserResponse,
        lastAnalysis
    );
    
    if (completion.shouldComplete) {
        // Award full phase KC
        awardKC(0.65);
        logCompletion(completion.reason);
        return true; // Advance to next phase
    }
    
    return false; // Continue Socratic dialogue
}
```

---

## Part 5: Handling Module-Specific Patterns

### Module 3's Special Case: General Questions + LeetCode

Module 3 has 7 general questions BEFORE the LeetCode problems. The teaching plan handles this:

```json
{
  "teaching_plan": [[{
    "text": "SOCRATIC_INTENT: This module requires exploring 7 general questions about data flow before applying to 5 specific problems.\n\nPHASE 1 - GENERAL QUESTIONS (Turns 1-7):\nWork through one question per turn:\nTURN 1: 'Let's start with Function Contracts. What exactly should a recursive function promise?' WAIT.\nTURN 2: 'Is the primary goal Computational or Generative? How does that influence our thinking?' WAIT.\n[... continues for all 7 questions ...]\n\nPHASE 2 - LEETCODE APPLICATION (Turns 8-18):\nNow apply these concepts to problems...\n\nIMPORTANT: Do not rush through Phase 1. Each question builds foundation for the problems.",
    "interactionGuidance": {
      "expectedTurns": 18,
      "turnManagement": "Strict one-question-per-turn for first 7 turns. Then 2-3 turns per LeetCode problem.",
      "completionTriggers": ["All 7 general questions explored", "At least 3 LC problems understood", "18 turns reached"]
    }
  }]]
}
```

---

## Part 6: The Complete Implementation Flow

### 1. Generate Teaching Plan
```typescript
const socraticPlan = await generateSocraticTeachingPlan(
    socraticContent,
    moduleInfo
);
// Returns categorized plan with turn management
```

### 2. Initialize Socratic State
```typescript
const socraticState = {
    turnCount: 0,
    currentPhase: determineSocraticPhase(socraticPlan),
    expectedTurns: socraticPlan[0][0].interactionGuidance.expectedTurns,
    completionTriggered: false
};
```

### 3. Each Turn Execution
```typescript
// In main interaction loop
if (currentPhase === 'Socratic') {
    socraticState.turnCount++;
    
    // Build turn-specific instruction
    const instruction = buildSocraticExecutionInstruction(
        socraticPlan,
        socraticState.turnCount
    );
    
    // Sensei executes ONLY current turn
    const response = await senseiRespond(instruction, userInput);
    
    // Check completion
    if (checkSocraticCompletion(socraticState, userInput, analysis).shouldComplete) {
        socraticState.completionTriggered = true;
        // Prepare for phase transition
    }
}
```

### 4. Natural Completion
When completion is triggered:
- Sensei provides a brief synthesis
- Awards full phase KC (0.65)
- Advances to next phase

---

## Summary: The Gold Standard Approach

1. **One Prompt to Rule Them All**: The master categorization prompt handles ALL Socratic types
2. **Turn-by-Turn Execution**: Teaching plan provides full journey, but execution is strictly turn-by-turn
3. **Multiple Completion Triggers**: Understanding-based, turn-based, or request-based
4. **Simple State Tracking**: Just track turns and check triggers
5. **Natural Conversation Flow**: No artificial chunking, just guided dialogue

This approach ensures:
- ✅ Correct categorization of Socratic content
- ✅ Appropriate teaching plans for each type
- ✅ Interactive multi-turn execution (no content dumping)
- ✅ Clear completion and advancement criteria
- ✅ Natural, pedagogically sound conversations
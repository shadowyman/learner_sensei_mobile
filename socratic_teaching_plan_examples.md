# Socratic Teaching Plan Examples - Simplified Hybrid Approach

## Overview

In the simplified hybrid approach, each Socratic phase generates ONE comprehensive teaching plan item that gives Sensei full context and guidance for the entire conversational phase.

---

## Example 1: LeetCode Problem-Based Socratic (Module 3)

**Original Socratic Content:**
```
- LC 700: BST search (parameter passing, return values)
- LC 129: Sum root to leaf (state maintenance, leaf processing)  
- LC 102: Level order traversal (accumulator by reference)
- LC 230: Kth smallest in BST (counter management)
- LC 687: Longest univalue path (dual information challenge)
```

**Generated Teaching Plan:**
```json
{
  "teaching_plan": [[{
    "text": "SOCRATIC_INTENT: Guide the learner through collaborative problem-solving of 5 LeetCode problems that illuminate data flow patterns in recursion.\n\nPROBLEM SEQUENCE AND FOCUS:\n1. Start with LC 700 (BST Search) - Use this to explore: What information needs to flow down? What comes back up? Why is the return value sufficient here?\n\n2. Progress to LC 129 (Sum Root to Leaf) - Contrast with previous: Now we need state maintenance. Ask: 'What's different about the information flow here? Why do we need to track the current sum as we go down?'\n\n3. LC 102 (Level Order Traversal) - Introduce accumulator pattern. Key questions: 'Why pass by reference here? What happens if we don't? How does this differ from returning values?'\n\n4. LC 230 (Kth Smallest in BST) - Explore counter management. 'Should the counter be passed by value or reference? Why? What are the trade-offs?'\n\n5. LC 687 (Longest Univalue Path) - The dual information challenge. 'This problem needs two different pieces of information. How do we manage that? What are our options?'\n\nAPPROACH:\n- For each problem, start by having them attempt a solution\n- When they get stuck, guide with questions, don't give answers\n- After solving, always ask: 'What data flow pattern did we use here?'\n- Build a comparison table together as you progress\n- If learner struggles with a problem, simplify it first\n- If learner breezes through, ask about edge cases and optimizations\n\nCOMPLETION: When learner can articulate the different data flow patterns and when to use each, or after ~15-20 exchanges.",
    "kcValue": 0.65,
    "isSocraticIntent": true
  }]]
}
```

---

## Example 2: Concept Exploration Socratic (Module 1)

**Original Socratic Content:**
```
- Probe understanding ("Can you explain self-similarity for [new domain]?")
- Identify base cases/recursive steps in new simple scenarios
- Discuss the "Leap of Faith" concept
- Reinforce understanding of consequences
```

**Generated Teaching Plan:**
```json
{
  "teaching_plan": [[{
    "text": "SOCRATIC_INTENT: Guide learner to deeply understand recursion fundamentals by exploring new domains and scenarios.\n\nEXPLORATION SEQUENCE:\n1. OPENING: 'We've learned about recursion with factorials and lists. Can you think of something in nature or everyday life that exhibits self-similarity?'\n\n2. DOMAIN TRANSFER: Based on their example, probe deeper:\n- 'What would be the smallest/simplest version of [their example]?'\n- 'How does the bigger version contain smaller versions of itself?'\n- 'Could we write a recursive function to model this? What would it look like?'\n\n3. NEW SCENARIOS: Present novel problems:\n- 'Here's a problem: counting handshakes at a party where everyone shakes hands once. Do you see recursion here?'\n- 'What about finding all possible ways to climb stairs taking 1 or 2 steps at a time?'\n- For each: 'What's the base case? What's the recursive step?'\n\n4. LEAP OF FAITH: This is crucial to explore:\n- 'When writing factorial(n), we call factorial(n-1). Why can we trust that call will work?'\n- 'What would happen to your thinking if you tried to trace every single recursive call?'\n- 'How is this similar to trusting that someone else will do their part of a group project?'\n\n5. CONSEQUENCES: Explore what happens when things go wrong:\n- 'What if we forgot the base case in our stair-climbing function?'\n- 'Can you create a recursive function that would crash? Why does it crash?'\n- 'How do base cases serve as safety nets?'\n\nADAPTATION NOTES:\n- If learner gives shallow examples, push for deeper ones\n- If struggling with Leap of Faith, use more concrete analogies\n- If doing well, challenge with trickier scenarios\n\nCOMPLETION: When learner can identify recursive patterns in novel domains and explain the Leap of Faith concept clearly.",
    "kcValue": 0.65,
    "isSocraticIntent": true
  }]]
}
```

---

## Example 3: Comparative Analysis Socratic (Module 1.5)

**Original Socratic Content:**
```
- Use simple generative scenarios (passwords, combinations, maze paths)
- Explicitly contrast with Module 1 computational concepts
- Ask about choices vs decomposition, state flow vs return values
- Guide understanding of Generative Leap of Faith
```

**Generated Teaching Plan:**
```json
{
  "teaching_plan": [[{
    "text": "SOCRATIC_INTENT: Help learner discover the fundamental difference between computational and generative recursion through contrasting examples.\n\nCONTRAST EXPLORATION:\n1. SETUP TWO PARALLEL PROBLEMS:\n- Computational: 'Calculate the sum of numbers 1 to N'\n- Generative: 'Generate all possible 3-character passwords using A, B, C'\n\n2. EXPLORE EACH:\nFor sum problem: 'How do we break this down? What do we return?'\nFor password problem: 'What are our choices at each step? What do we DO vs RETURN?'\n\n3. KEY CONTRASTS TO SURFACE:\n- 'In sum, we WAIT for an answer to come back. In passwords, what are we waiting for?'\n- 'Sum builds an answer going UP the call stack. Where do passwords get generated?'\n- 'What flows DOWN in each approach? What comes back UP?'\n- 'In sum, the base case returns 0. In passwords, what does the base case do?'\n\n4. MORE EXAMPLES:\n- Computational: 'Find max element in array' vs Generative: 'Print all elements'\n- Computational: 'Count nodes in tree' vs Generative: 'Generate all paths to leaves'\n- For each pair: 'What's the fundamental difference in how these work?'\n\n5. THE GENERATIVE LEAP OF FAITH:\n- 'In computational, we trust the recursive call will return the right answer.'\n- 'In generative, what are we trusting the recursive call to do?'\n- 'How is the faith different when we're exploring vs calculating?'\n\n6. SYNTHESIS:\n- 'Can you now explain when we use each approach?'\n- 'What keywords in a problem suggest computational vs generative?'\n- 'Could some problems be solved either way? What are the trade-offs?'\n\nADAPT BASED ON:\n- Confusion: Use simpler examples, more visual representations\n- Quick understanding: Add hybrid problems that mix both approaches\n\nCOMPLETION: When learner can clearly articulate the difference and identify which approach fits a new problem.",
    "kcValue": 0.65,
    "isSocraticIntent": true
  }]]
}
```

---

## Example 4: Execution Tracing Socratic (Module 2)

**Original Socratic Content:**
```
- Prompt for exact stack state descriptions
- Query specific frame values and variables
- Trace return value flow and execution continuation
- Solidify understanding of scope and lifecycles
```

**Generated Teaching Plan:**
```json
{
  "teaching_plan": [[{
    "text": "SOCRATIC_INTENT: Guide learner to deeply understand recursive execution through hands-on tracing exercises.\n\nTRACING JOURNEY:\n1. START SIMPLE:\n- 'Let's trace factorial(3) together. Before we start, predict: How many function calls will there be?'\n- 'Draw what you think the call stack will look like at its deepest point.'\n\n2. STEP-BY-STEP EXPLORATION:\n- 'factorial(3) is called. What goes on the stack? Be specific about the return address.'\n- 'When we hit factorial(2), what's the state of the factorial(3) frame?'\n- 'At factorial(0), how many frames exist? What's in each one?'\n\n3. RETURN PATH:\n- 'factorial(0) returns 1. Where exactly does this 1 go?'\n- 'In factorial(1), we compute 1 * 1. Where does this result go next?'\n- 'Trace the return values all the way back. What pattern do you see?'\n\n4. VARIABLE SCOPE:\n- 'If each frame has a variable n, how many different n variables exist at the deepest point?'\n- 'Why don't these variables interfere with each other?'\n- 'What would happen if n was a global variable instead?'\n\n5. MORE COMPLEX TRACES:\n- Binary recursion: 'Let's trace fib(4). How is this different?'\n- 'At the deepest point, how many frames? Why so many more than factorial?'\n- Tree recursion: 'Trace a simple tree traversal. What's unique about the stack here?'\n\n6. EXECUTION INSIGHTS:\n- 'Based on our traces, why does recursion use more memory than loops?'\n- 'What determines the maximum stack depth?'\n- 'When would we hit a stack overflow? Can you create an example?'\n\nADJUSTMENTS:\n- If struggling: Use visual tools, draw frames as boxes\n- If excelling: Add mutual recursion or more complex traces\n\nCOMPLETION: When learner can accurately predict and trace recursive execution without assistance.",
    "kcValue": 0.65,
    "isSocraticIntent": true
  }]]
}
```

---

## Example 5: Pattern Recognition Socratic (Module 6.5)

**Original Socratic Content:**
```
- Analyze problem statements for pattern clues
- Keyword and constraint analysis  
- Input/output type examination
- Pattern hypothesis formation
```

**Generated Teaching Plan:**
```json
{
  "teaching_plan": [[{
    "text": "SOCRATIC_INTENT: Develop learner's ability to recognize recursive patterns from problem statements before coding.\n\nPATTERN DETECTIVE TRAINING:\n1. KEYWORD INVESTIGATION:\n- 'Here's a problem: \"Find all possible combinations...\" What word jumps out?'\n- 'Another: \"Divide the array into two equal parts...\" What pattern does this suggest?'\n- 'And: \"Each node can have multiple children...\" What structure are we dealing with?'\n\n2. CONSTRAINT ANALYSIS:\n- 'Problem says: \"You can take 1, 2, or 3 steps.\" What does having choices suggest?'\n- 'Another mentions: \"Process elements in order.\" How does this limit our approach?'\n- 'This one says: \"Return the optimal solution.\" Does this hint at any specific technique?'\n\n3. INPUT/OUTPUT PATTERNS:\n- 'Input: array, Output: single value. What patterns commonly do this?'\n- 'Input: string, Output: list of strings. What kind of problem is this likely to be?'\n- 'Input: tree, Output: boolean. What are we probably checking?'\n\n4. PRACTICE RECOGNITION:\nPresent problems without labels:\n- 'Generate all valid parentheses combinations of length n'\n- 'Find the maximum sum path in a binary tree'\n- 'Count islands in a 2D grid'\n- 'Merge two sorted arrays'\nFor each: 'What pattern do you recognize? What clues led you there?'\n\n5. FALSE PATTERNS:\n- 'This problem looks like backtracking but isn't. Can you see why?'\n- 'When might divide-and-conquer actually be the wrong choice?'\n- 'What makes you second-guess your pattern identification?'\n\n6. PATTERN COMBINING:\n- 'Some problems use multiple patterns. Can you think of examples?'\n- 'How do you decide which pattern is primary vs secondary?'\n\nMETA-DISCUSSION:\n- 'What's your personal checklist for pattern recognition now?'\n- 'Which clues are most reliable? Which are misleading?'\n- 'How would you teach someone else to recognize patterns?'\n\nCOMPLETION: When learner can correctly identify patterns for 8/10 new problems.",
    "kcValue": 0.65,
    "isSocraticIntent": true
  }]]
}
```

---

## Key Principles for Converting Socratic Content to Teaching Plans

### 1. **Structure Without Rigidity**
- Provide a clear sequence but allow natural flow
- Include "ADAPTATION NOTES" for different student responses
- Suggest transitions between topics

### 2. **Question Banks vs Scripts**
- Don't script every question
- Provide question types and examples
- Trust Sensei to formulate contextual follow-ups

### 3. **Explicit Completion Criteria**
- Clear end conditions (understanding demonstrated OR time elapsed)
- Usually 10-20 exchanges depending on complexity
- Can complete early if breakthrough moment occurs

### 4. **Contextual Guidance**
- Include the "why" behind each exploration
- Explain what insights we're trying to surface
- Guide emotional tone (encouraging, challenging, patient)

### 5. **LeetCode vs Conceptual Differences**

**For LeetCode Sections:**
- Include problem numbers and brief descriptions
- Emphasize collaborative solving, not testing
- Focus on patterns across problems
- Include simplification options for struggling students

**For Conceptual Sections:**
- Use analogies and real-world connections
- Build from concrete to abstract
- Include multiple domain transfers
- Emphasize "aha!" moment discovery

**For Comparison Sections:**
- Set up clear contrasts
- Use parallel examples
- Build comparison tables/frameworks
- Focus on decision criteria

### 6. **Single KC Value**
- Always 0.65 for the entire phase
- Awarded when phase completes
- No micro-tracking of individual questions

This approach maintains the pedagogical richness of Socratic dialogue while keeping implementation dead simple.
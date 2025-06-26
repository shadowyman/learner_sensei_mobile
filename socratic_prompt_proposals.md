# Comprehensive Socratic Teaching Plan Prompt Proposals

## Executive Summary

This document presents comprehensive approaches for generating Socratic teaching plans that cover ALL modules in the Sensei system. Each approach contains multiple archetypes that collectively address the diverse Socratic requirements across modules 1 through 8. Unlike standard teaching plans that deliver information, these Socratic plans generate questioning sequences that guide discovery, diagnose understanding, and build problem-solving skills through chunk-based progression.

---

## Approach 1: Progressive Inquiry Framework

**Core Philosophy**: This approach views Socratic teaching as a journey from conceptual understanding to practical mastery, with each archetype representing a different stage of inquiry depth. The framework ensures complete coverage by providing archetypes for concept exploration, mechanical understanding, problem-solving, and reflective analysis.

### Archetypes and Module Coverage:

#### 1.1 Conceptual Discovery Archetype
**Purpose**: Guide students to discover and understand fundamental concepts through exploration of examples and counterexamples.

**Module Coverage**:
- **Module 1**: Exploring self-similarity, base cases, and recursive steps in novel domains
- **Module 1.5**: Discovering the distinction between computational and generative recursion
- **Module 6.5**: Uncovering pattern clues in problem statements

**Blueprint**:
```
Foundation Setting → Domain Exploration → Principle Extraction → Edge Case Analysis → Synthesis
```

**Chunk Structure** (4-5 chunks):
- **Chunk 1 - Foundation Setting**: 
  - "Consider this simple example: [concrete example]. What do you notice about how the problem breaks down?"
  - "If you were to solve a smaller version of this, what would that look like?"
  - "What's the relationship between the whole and its parts here?"

- **Chunk 2 - Domain Exploration**:
  - "Now let's apply this to [new domain]. How does self-similarity manifest here?"
  - "Can you identify what would be the 'smallest' or 'simplest' case in this context?"
  - "What patterns do you see across these different examples?"

- **Chunk 3 - Principle Extraction**:
  - "Based on what we've explored, can you articulate the general principle?"
  - "What makes this approach 'recursive' rather than just repetitive?"
  - "How would you explain this concept to someone who's never seen it?"

- **Chunk 4 - Edge Case Analysis**:
  - "What happens if we forget to handle the base case?"
  - "Can you think of a scenario where this principle might break down?"
  - "What constraints or conditions are necessary for this to work?"

- **Chunk 5 - Synthesis** (optional based on complexity):
  - "How does this concept connect to what you already know about [related topic]?"
  - "What are the key takeaways from our exploration?"
  - "When would you choose to use this approach?"

#### 1.2 Mechanical Tracing Archetype
**Purpose**: Build deep understanding of execution mechanics through guided step-by-step analysis.

**Module Coverage**:
- **Module 2**: Call stack execution and frame management
- **Module 3**: Data flow tracking through recursive calls
- **Module 7**: Performance analysis through execution trace

**Blueprint**:
```
Setup Visualization → Step-by-Step Execution → State Tracking → Flow Analysis → Performance Insights
```

**Chunk Structure** (4-6 chunks):
- **Chunk 1 - Setup Visualization**:
  - "Let's trace through [function] with input [value]. Draw/imagine the initial state."
  - "What information needs to be stored when we make the first call?"
  - "How would you represent the call stack at this moment?"

- **Chunk 2 - Step-by-Step Execution**:
  - "What happens when we reach the recursive call? What goes on the stack?"
  - "Where does execution go after this line completes?"
  - "What are the exact values of all variables in frame #2?"

- **Chunk 3 - State Tracking**:
  - "As we go deeper, what changes in each frame? What stays the same?"
  - "How does information flow from one frame to another?"
  - "When frame N returns value X, where does X go and how is it used?"

- **Chunk 4 - Flow Analysis**:
  - "Trace the path of [specific variable] through all the calls."
  - "At what point does the solution start 'building up'?"
  - "How many frames exist simultaneously at the deepest point?"

- **Chunk 5 - Performance Insights** (for Module 7):
  - "How many times is each subproblem solved?"
  - "Can you identify any redundant calculations?"
  - "What's the relationship between input size and stack depth?"

- **Chunk 6 - Optimization Discovery** (for Module 7):
  - "If we wanted to avoid redundant work, what information would we need to store?"
  - "How would memoization change our execution trace?"
  - "What's the trade-off between time and space here?"

#### 1.3 Problem Decomposition Archetype
**Purpose**: Guide systematic problem-solving from understanding requirements to implementing solutions.

**Module Coverage**:
- **Module 3**: Information flow design for specific problems
- **Module 4**: Architectural decisions and solution design
- **Module 5**: Base case identification and validation
- **Module 6**: Pattern recognition through problem solving

**Blueprint**:
```
Problem Analysis → State Design → Solution Architecture → Implementation Details → Validation
```

**Chunk Structure** (5-7 chunks):
- **Chunk 1 - Problem Analysis**:
  - "What exactly is this problem asking for? Can you restate it in your own words?"
  - "What are the inputs and expected outputs?"
  - "Is this a computational problem (finding one answer) or generative (finding all/many answers)?"

- **Chunk 2 - State Design**:
  - "What information defines the 'state' of a subproblem?"
  - "What parameters would our recursive function need?"
  - "Should we pass information down, return it up, or both?"

- **Chunk 3 - Solution Architecture**:
  - "Assuming the recursive call works perfectly for smaller inputs, how do we use its result?"
  - "Do we need a helper function? What would be its purpose?"
  - "How do we combine results from multiple recursive calls?"

- **Chunk 4 - Base Case Design**:
  - "What's the simplest input this function might receive?"
  - "What should we return for each base case to make the recursion work?"
  - "Are there multiple stopping conditions? What order should we check them?"

- **Chunk 5 - Implementation Details**:
  - "Should we use an accumulator? Pass by value or reference?"
  - "Where in the recursion should we process the current element (pre/in/post-order)?"
  - "How do we handle edge cases like null pointers or empty collections?"

- **Chunk 6 - Pattern Recognition** (for Module 6):
  - "Looking at our solution structure, what pattern emerges?"
  - "Have we seen this 'divide-combine' or 'choose-explore-unchoose' structure before?"
  - "What category would you place this problem in?"

- **Chunk 7 - Validation**:
  - "Let's trace through with a small example. Does it work?"
  - "What happens with edge cases?"
  - "Can you think of any inputs that might break our solution?"

#### 1.4 Comparative Analysis Archetype
**Purpose**: Deepen understanding through systematic comparison of approaches, patterns, and solutions.

**Module Coverage**:
- **Module 1.5**: Contrasting computational vs generative recursion
- **Module 6**: Comparing different recursive patterns
- **Module 8**: Synthesizing multiple approaches for complex problems

**Blueprint**:
```
Setup Scenarios → Identify Differences → Analyze Trade-offs → Context Mapping → Strategic Selection
```

**Chunk Structure** (4-5 chunks):
- **Chunk 1 - Setup Scenarios**:
  - "Consider approach A: [description] versus approach B: [description]"
  - "What's fundamentally different about how these work?"
  - "Can you trace through a simple example with each approach?"

- **Chunk 2 - Identify Differences**:
  - "How does data flow differ between these approaches?"
  - "What are the base cases for each? How do they differ?"
  - "Which approach makes more recursive calls? Why?"

- **Chunk 3 - Analyze Trade-offs**:
  - "What are the time/space complexity implications of each?"
  - "Which is easier to understand? Which is more efficient?"
  - "Are there cases where one approach fails but the other succeeds?"

- **Chunk 4 - Context Mapping**:
  - "Given constraints [X, Y, Z], which approach fits better?"
  - "What problem characteristics favor each approach?"
  - "Can you formulate rules for when to use each?"

- **Chunk 5 - Strategic Selection**:
  - "For this specific problem, which approach would you choose? Why?"
  - "Could we combine elements from both approaches?"
  - "What would you do differently next time you see a similar problem?"

### Archetype Distribution Analysis for Approach 1:

**Module Coverage Matrix**:
- Module 1: Conceptual Discovery (primary), Problem Decomposition (secondary)
- Module 1.5: Conceptual Discovery (primary), Comparative Analysis (primary)
- Module 2: Mechanical Tracing (primary)
- Module 3: Mechanical Tracing (secondary), Problem Decomposition (primary)
- Module 4: Problem Decomposition (primary)
- Module 5: Problem Decomposition (primary - base case focus)
- Module 6: Problem Decomposition (primary), Comparative Analysis (secondary)
- Module 6.5: Conceptual Discovery (primary)
- Module 7: Mechanical Tracing (performance focus), Problem Decomposition (optimization)
- Module 8: All archetypes in synthesis

**Rationale**: This approach provides comprehensive coverage by matching archetype strengths to module needs. Early modules use Conceptual Discovery for foundation building, middle modules leverage Problem Decomposition for skill development, and later modules combine multiple archetypes for advanced synthesis.

---

## Approach 2: Problem-Centric Mastery Framework

**Core Philosophy**: This approach centers on using problems as the primary vehicle for learning, with different archetypes representing different aspects of problem-solving mastery. Every module's concepts are explored through carefully selected problems that illuminate the key ideas.

### Archetypes and Module Coverage:

#### 2.1 Guided Problem Exploration Archetype
**Purpose**: Use carefully crafted problems to help students discover concepts organically.

**Module Coverage**:
- **Module 1**: Simple problems revealing self-similarity and base cases
- **Module 1.5**: Problems showcasing generative vs computational differences
- **Module 2**: Problems requiring execution trace understanding

**Blueprint**:
```
Problem Introduction → Initial Attempt → Guided Discovery → Concept Extraction → Generalization
```

**Chunk Structure** (5-6 chunks):
- **Chunk 1 - Problem Introduction**:
  - "Here's a problem: [statement]. What's your first instinct on how to approach it?"
  - "What makes this problem feel 'recursive'?"
  - "Can you solve a simpler version first?"

- **Chunk 2 - Initial Attempt**:
  - "Try to outline a solution. What challenges do you encounter?"
  - "What information do you need to track?"
  - "Where do you get stuck?"

- **Chunk 3 - Guided Discovery**:
  - "What if we think about it this way: [hint towards recursive insight]?"
  - "Notice how [pattern] appears at different scales?"
  - "How does solving for n-1 help us solve for n?"

- **Chunk 4 - Concept Extraction**:
  - "What principle did we just use?"
  - "Can you name the key components of our solution?"
  - "Why did this approach work?"

- **Chunk 5 - Generalization**:
  - "Where else might we see this pattern?"
  - "Can you think of other problems with similar structure?"
  - "What's the general strategy we discovered?"

- **Chunk 6 - Reinforcement** (optional):
  - "Let's try a variation: [modified problem]"
  - "How does our approach adapt?"
  - "What stays the same? What changes?"

#### 2.2 Collaborative Solution Building Archetype
**Purpose**: Work together through medium-complexity problems, focusing on design decisions and trade-offs.

**Module Coverage**:
- **Module 3**: Data flow design through problem solving
- **Module 4**: Architecture and logic development
- **Module 5**: Base case mastery through problem examples
- **Module 6**: Pattern emergence through problem solving

**Blueprint**:
```
Problem Setup → Design Dialogue → Implementation Planning → Solution Refinement → Pattern Recognition
```

**Chunk Structure** (6-8 chunks):
- **Chunk 1 - Problem Setup**:
  - "Let's tackle [LeetCode problem]. First, what's the function contract?"
  - "What should our function promise to do?"
  - "What are we optimizing for - clarity, efficiency, or both?"

- **Chunk 2 - Design Dialogue**:
  - "What information must flow down through parameters?"
  - "What should each recursive call return?"
  - "Do we need helper functions? Why or why not?"

- **Chunk 3 - State Management**:
  - "How do we define the state of a subproblem?"
  - "Should we use accumulators? Pass by reference?"
  - "What's the relationship between parent and child states?"

- **Chunk 4 - Base Case Design**:
  - "What are ALL the ways recursion could/should stop?"
  - "What should each base case return?"
  - "How do we ensure every path hits a base case?"

- **Chunk 5 - Implementation Planning**:
  - "Let's outline the code structure together"
  - "Where should we process the current element?"
  - "How do we combine results from recursive calls?"

- **Chunk 6 - Solution Refinement**:
  - "Walk through the solution with example [X]. Any issues?"
  - "What edge cases might break this?"
  - "How can we make the solution more robust?"

- **Chunk 7 - Pattern Recognition**:
  - "What pattern does our solution follow?"
  - "Is this divide-and-conquer, backtracking, or something else?"
  - "How would you categorize this problem type?"

- **Chunk 8 - Optimization** (for complex problems):
  - "Are we solving any subproblems multiple times?"
  - "Could memoization help? Where?"
  - "What's the time/space complexity?"

#### 2.3 Problem Pattern Analysis Archetype
**Purpose**: After solving problems, analyze them to extract reusable patterns and strategies.

**Module Coverage**:
- **Module 6**: Formal pattern recognition and categorization
- **Module 6.5**: Pattern selection heuristics
- **Module 7**: Performance patterns and optimization strategies
- **Module 8**: Multi-pattern synthesis

**Blueprint**:
```
Solution Review → Structure Analysis → Pattern Identification → Strategy Extraction → Application Practice
```

**Chunk Structure** (5-6 chunks):
- **Chunk 1 - Solution Review**:
  - "Let's review the problems we've solved: [list]. What do you notice?"
  - "What common structures appear across solutions?"
  - "How did we approach each problem?"

- **Chunk 2 - Structure Analysis**:
  - "Map out the recursion tree for each solution"
  - "How many recursive calls does each make?"
  - "What's the branching factor? The depth?"

- **Chunk 3 - Pattern Identification**:
  - "These solutions follow the [pattern name] pattern because..."
  - "What are the key characteristics of this pattern?"
  - "When is this pattern most useful?"

- **Chunk 4 - Strategy Extraction**:
  - "What's the general template for this pattern?"
  - "What are the essential components?"
  - "How do we recognize when to use it?"

- **Chunk 5 - Application Practice**:
  - "Here's a new problem: [statement]. What pattern might work?"
  - "What clues in the problem statement suggest this?"
  - "How would you adapt the pattern template?"

- **Chunk 6 - Performance Analysis** (for Module 7):
  - "What's the complexity of this pattern?"
  - "Where might inefficiencies arise?"
  - "How could we optimize while keeping the pattern?"

#### 2.4 Diagnostic Problem Solving Archetype
**Purpose**: Use problems to diagnose and correct misconceptions or gaps in understanding.

**Module Coverage**:
- **All modules**: As a supplementary archetype for addressing confusion
- **Primary in Module 2**: For execution understanding
- **Primary in Module 5**: For base case correctness

**Blueprint**:
```
Error Introduction → Root Cause Analysis → Misconception Correction → Correct Approach → Verification
```

**Chunk Structure** (4-5 chunks):
- **Chunk 1 - Error Introduction**:
  - "Here's a solution with a bug: [code]. What happens with input [X]?"
  - "Can you spot the issue?"
  - "Why might someone write it this way?"

- **Chunk 2 - Root Cause Analysis**:
  - "Let's trace through execution. Where does it go wrong?"
  - "What assumption does this code make?"
  - "Why is that assumption incorrect?"

- **Chunk 3 - Misconception Correction**:
  - "The key misunderstanding here is..."
  - "Let's clarify: [correct concept explanation]"
  - "How does this change our approach?"

- **Chunk 4 - Correct Approach**:
  - "Now, how would we fix this?"
  - "What needs to change in our logic?"
  - "Let's implement the correction together"

- **Chunk 5 - Verification**:
  - "Test the fixed version with the same input"
  - "Try these edge cases: [list]"
  - "What did we learn from this debugging exercise?"

### Archetype Distribution Analysis for Approach 2:

**Module Coverage Matrix**:
- Module 1: Guided Problem Exploration (primary)
- Module 1.5: Guided Problem Exploration (primary), Diagnostic Problem Solving (secondary)
- Module 2: Guided Problem Exploration (execution focus), Diagnostic Problem Solving (primary)
- Module 3: Collaborative Solution Building (primary)
- Module 4: Collaborative Solution Building (primary)
- Module 5: Collaborative Solution Building (base case focus), Diagnostic Problem Solving (primary)
- Module 6: Collaborative Solution Building (primary), Problem Pattern Analysis (primary)
- Module 6.5: Problem Pattern Analysis (primary)
- Module 7: Problem Pattern Analysis (performance focus), Collaborative Solution Building (optimization)
- Module 8: All archetypes working together

**Rationale**: This approach leverages the power of problem-based learning, which aligns perfectly with the heavy use of LeetCode problems throughout the modules. Each archetype serves a specific purpose in the problem-solving journey, from initial exploration to pattern mastery.

---

## Approach 3: Cognitive Development Framework

**Core Philosophy**: This approach is structured around cognitive skill development, with archetypes representing different levels of thinking skills from basic comprehension to advanced synthesis. It ensures comprehensive coverage by systematically developing all necessary cognitive abilities for recursive mastery.

### Archetypes and Module Coverage:

#### 3.1 Comprehension Building Archetype
**Purpose**: Develop basic understanding and ability to explain concepts in own words.

**Module Coverage**:
- **Module 1**: Understanding self-similarity, base cases, recursive steps
- **Module 1.5**: Comprehending generative vs computational differences
- **Module 2**: Understanding execution mechanics

**Blueprint**:
```
Concept Introduction → Explanation Request → Clarification → Application Check → Synthesis
```

**Chunk Structure** (4-5 chunks):
- **Chunk 1 - Concept Introduction**:
  - "We've learned about [concept]. Can you explain it in your own words?"
  - "What's the core idea behind [concept]?"
  - "How would you teach this to someone else?"

- **Chunk 2 - Explanation Request**:
  - "Give me an example that demonstrates [concept]"
  - "What makes your example recursive rather than just repetitive?"
  - "What are the essential components in your example?"

- **Chunk 3 - Clarification**:
  - "You mentioned [X]. Can you elaborate on that?"
  - "What's the difference between [concept A] and [concept B]?"
  - "Why is [aspect] important?"

- **Chunk 4 - Application Check**:
  - "How would [concept] apply in this scenario: [new context]?"
  - "What would happen if we removed [component]?"
  - "Can you identify [concept] in this code?"

- **Chunk 5 - Synthesis**:
  - "How does [concept] relate to what we learned about [previous topic]?"
  - "What are the key takeaways?"
  - "When would you use this?"

#### 3.2 Analytical Thinking Archetype
**Purpose**: Develop ability to break down problems, trace execution, and analyze approaches.

**Module Coverage**:
- **Module 2**: Analyzing execution flow
- **Module 3**: Analyzing data flow patterns
- **Module 4**: Analyzing design decisions
- **Module 7**: Analyzing performance characteristics

**Blueprint**:
```
Decomposition Task → Systematic Analysis → Relationship Mapping → Insight Extraction → Prediction
```

**Chunk Structure** (5-6 chunks):
- **Chunk 1 - Decomposition Task**:
  - "Break down this [problem/function/approach] into its components"
  - "What are the individual steps involved?"
  - "How do these pieces work together?"

- **Chunk 2 - Systematic Analysis**:
  - "Let's analyze each component. Starting with [first component]..."
  - "What role does this play in the overall solution?"
  - "How does it interact with other components?"

- **Chunk 3 - Relationship Mapping**:
  - "Draw/describe the relationships between components"
  - "What depends on what?"
  - "Where does information flow?"

- **Chunk 4 - Insight Extraction**:
  - "What patterns do you see in this analysis?"
  - "What's the critical path through the system?"
  - "Where are the potential bottlenecks?"

- **Chunk 5 - Prediction**:
  - "Based on your analysis, what would happen if [change]?"
  - "How would this behave with input [X]?"
  - "What's the complexity? Why?"

- **Chunk 6 - Optimization** (for Module 7):
  - "Where do you see inefficiencies?"
  - "What could be improved?"
  - "How would optimization change the structure?"

#### 3.3 Evaluative Reasoning Archetype
**Purpose**: Develop judgment skills for selecting approaches, validating solutions, and making design decisions.

**Module Coverage**:
- **Module 4**: Evaluating design choices
- **Module 5**: Evaluating base case completeness
- **Module 6**: Evaluating pattern fit
- **Module 6.5**: Evaluating pattern selection

**Blueprint**:
```
Option Presentation → Criteria Development → Systematic Evaluation → Decision Making → Justification
```

**Chunk Structure** (5-6 chunks):
- **Chunk 1 - Option Presentation**:
  - "Here are different approaches: [A, B, C]. Let's evaluate them"
  - "What are the key differences?"
  - "What factors should we consider?"

- **Chunk 2 - Criteria Development**:
  - "What makes a 'good' solution for this problem?"
  - "What constraints do we have?"
  - "How do we prioritize: correctness, efficiency, clarity?"

- **Chunk 3 - Systematic Evaluation**:
  - "Evaluate approach A against our criteria"
  - "What are its strengths and weaknesses?"
  - "How does it compare to approach B?"

- **Chunk 4 - Decision Making**:
  - "Which approach best meets our needs?"
  - "What trade-offs are we accepting?"
  - "Could we combine approaches?"

- **Chunk 5 - Justification**:
  - "Explain why you chose this approach"
  - "What scenarios would make you reconsider?"
  - "How confident are you in this choice?"

- **Chunk 6 - Validation** (for Module 5):
  - "How do we verify our choice is correct?"
  - "What tests would confirm this?"
  - "What edge cases should we check?"

#### 3.4 Creative Synthesis Archetype
**Purpose**: Develop ability to combine concepts, create novel solutions, and synthesize learning.

**Module Coverage**:
- **Module 6**: Synthesizing patterns from problems
- **Module 8**: Synthesizing multiple techniques
- **All modules**: For connecting concepts across modules

**Blueprint**:
```
Component Review → Connection Discovery → Novel Application → Integration → Reflection
```

**Chunk Structure** (5-6 chunks):
- **Chunk 1 - Component Review**:
  - "We've learned [A], [B], and [C]. Let's review each briefly"
  - "What's the core strength of each?"
  - "Where have we used each one?"

- **Chunk 2 - Connection Discovery**:
  - "How might these concepts work together?"
  - "What connections do you see?"
  - "Could one enhance another?"

- **Chunk 3 - Novel Application**:
  - "Here's a new problem requiring multiple concepts: [problem]"
  - "Which concepts might help?"
  - "How would you combine them?"

- **Chunk 4 - Integration**:
  - "Design a solution using multiple concepts"
  - "How do they complement each other?"
  - "What new possibilities does this create?"

- **Chunk 5 - Reflection**:
  - "What did you learn from this synthesis?"
  - "What patterns emerged?"
  - "How does this change your problem-solving toolkit?"

- **Chunk 6 - Extension** (for Module 8):
  - "Can you think of real-world applications?"
  - "What other combinations might be powerful?"
  - "What would you explore next?"

### Archetype Distribution Analysis for Approach 3:

**Module Coverage Matrix**:
- Module 1: Comprehension Building (primary), Analytical Thinking (secondary)
- Module 1.5: Comprehension Building (primary), Evaluative Reasoning (comparing patterns)
- Module 2: Analytical Thinking (primary), Comprehension Building (secondary)
- Module 3: Analytical Thinking (primary), Evaluative Reasoning (design choices)
- Module 4: Evaluative Reasoning (primary), Analytical Thinking (secondary)
- Module 5: Evaluative Reasoning (primary), Analytical Thinking (verification)
- Module 6: Creative Synthesis (primary), Analytical Thinking (pattern analysis)
- Module 6.5: Evaluative Reasoning (primary)
- Module 7: Analytical Thinking (primary), Evaluative Reasoning (optimization choices)
- Module 8: Creative Synthesis (primary), all others in support

**Rationale**: This cognitive development approach ensures students build a complete set of thinking skills. It progresses naturally from basic understanding to advanced synthesis, with each module focusing on the cognitive skills most relevant to its content. The framework is based on Bloom's Taxonomy adapted for recursive problem-solving.

---

## Approach 4: Scaffolded Discovery Framework

**Core Philosophy**: This approach uses carefully scaffolded questioning to lead students from their current understanding to new insights. Each archetype represents a different scaffolding strategy, ensuring all students can progress regardless of their starting point.

### Archetypes and Module Coverage:

#### 4.1 Incremental Concept Building Archetype
**Purpose**: Build understanding step-by-step from simple to complex.

**Module Coverage**:
- **Module 1**: Building up recursive concepts from simple examples
- **Module 1.5**: Incrementally distinguishing computational from generative
- **Module 2**: Step-by-step execution understanding
- **Module 3**: Gradual data flow complexity

**Blueprint**:
```
Simple Foundation → Add Complexity → Add More Complexity → Full Concept → Mastery Check
```

**Chunk Structure** (5-6 chunks):
- **Chunk 1 - Simple Foundation**:
  - "Let's start with the simplest possible case: [minimal example]"
  - "What do you observe?"
  - "Can you solve this tiny version?"

- **Chunk 2 - Add Complexity**:
  - "Now let's make it slightly harder: [extended example]"
  - "What changed? What stayed the same?"
  - "How does your approach adapt?"

- **Chunk 3 - Add More Complexity**:
  - "Let's add another layer: [more complex example]"
  - "Do you see a pattern emerging?"
  - "What's the relationship between solutions?"

- **Chunk 4 - Full Concept**:
  - "Now the complete version: [full complexity]"
  - "How do all the pieces fit together?"
  - "Can you state the general principle?"

- **Chunk 5 - Mastery Check**:
  - "Apply what you learned to this new situation: [transfer task]"
  - "Explain your reasoning"
  - "What made this possible?"

- **Chunk 6 - Extension** (optional):
  - "How far can we push this concept?"
  - "What are its limits?"
  - "Where else might this apply?"

#### 4.2 Guided Problem Progression Archetype
**Purpose**: Lead through increasingly complex problems with decreasing support.

**Module Coverage**:
- **Module 3**: Progressive data flow problems
- **Module 4**: Design problems of increasing complexity
- **Module 5**: Base case scenarios from simple to complex
- **Module 6**: Pattern recognition through problem sequences

**Blueprint**:
```
Worked Example → Partially Guided → Minimal Hints → Independent Attempt → Reflection
```

**Chunk Structure** (5-7 chunks):
- **Chunk 1 - Worked Example**:
  - "Let me show you how to approach this problem: [detailed walkthrough]"
  - "Notice how I [key technique]"
  - "The crucial insight is..."

- **Chunk 2 - Partially Guided**:
  - "Now you try this similar problem. I'll help at key points"
  - "Start by identifying... Good! Now what?"
  - "You're stuck at [X]. Consider [hint]"

- **Chunk 3 - Minimal Hints**:
  - "Try this next problem with minimal help"
  - "If you get stuck, remember [principle]"
  - "Check your base cases"

- **Chunk 4 - Independent Attempt**:
  - "Now solve this problem on your own"
  - "Take your time and think it through"
  - "I'll check your solution when ready"

- **Chunk 5 - Solution Review**:
  - "Walk me through your solution"
  - "Why did you make this choice?"
  - "What alternatives did you consider?"

- **Chunk 6 - Pattern Recognition**:
  - "What's common across all these problems?"
  - "Can you categorize them?"
  - "What strategy worked best?"

- **Chunk 7 - Reflection**:
  - "What was hardest? What clicked?"
  - "How has your approach evolved?"
  - "What would you do differently?"

#### 4.3 Comparison Scaffolding Archetype
**Purpose**: Build understanding by systematically comparing and contrasting approaches.

**Module Coverage**:
- **Module 1.5**: Comparing computational vs generative through examples
- **Module 6**: Comparing patterns through parallel examples
- **Module 6.5**: Comparing pattern selection criteria
- **Module 7**: Comparing optimization strategies

**Blueprint**:
```
Parallel Examples → Difference Identification → Deep Comparison → Criteria Extraction → Application
```

**Chunk Structure** (5-6 chunks):
- **Chunk 1 - Parallel Examples**:
  - "Here's how we solve problem A with approach 1: [example]"
  - "Here's the same problem with approach 2: [example]"
  - "What do you notice?"

- **Chunk 2 - Difference Identification**:
  - "List all the differences you see"
  - "Which differences are superficial? Which are fundamental?"
  - "How do the base cases differ?"

- **Chunk 3 - Deep Comparison**:
  - "Let's trace through both approaches step by step"
  - "Where do they diverge?"
  - "What are the implications of each choice?"

- **Chunk 4 - Criteria Extraction**:
  - "When would approach 1 be better?"
  - "When would approach 2 be better?"
  - "Can you formulate decision criteria?"

- **Chunk 5 - Application**:
  - "Here's a new problem. Which approach fits better?"
  - "Apply your criteria"
  - "Justify your choice"

- **Chunk 6 - Synthesis** (optional):
  - "Could we create a hybrid approach?"
  - "What would that look like?"
  - "When might it be useful?"

#### 4.4 Error-Based Scaffolding Archetype
**Purpose**: Use common errors and misconceptions as teaching opportunities.

**Module Coverage**:
- **Module 2**: Common execution misunderstandings
- **Module 5**: Common base case errors
- **Module 7**: Common efficiency mistakes
- **All modules**: For addressing specific confusions

**Blueprint**:
```
Error Presentation → Diagnosis Guidance → Root Cause → Correction Path → Prevention Strategy
```

**Chunk Structure** (5-6 chunks):
- **Chunk 1 - Error Presentation**:
  - "A common mistake is: [example]. Can you spot the issue?"
  - "What would happen with input [X]?"
  - "Where does it fail?"

- **Chunk 2 - Diagnosis Guidance**:
  - "Let's trace through systematically"
  - "At what point does reality diverge from expectation?"
  - "What assumption is being violated?"

- **Chunk 3 - Root Cause**:
  - "The fundamental issue is..."
  - "This happens because..."
  - "Many people make this mistake when..."

- **Chunk 4 - Correction Path**:
  - "To fix this, we need to..."
  - "The correct approach considers..."
  - "Let's implement the fix together"

- **Chunk 5 - Prevention Strategy**:
  - "How can we avoid this mistake?"
  - "What should we always check?"
  - "What's the mental model to remember?"

- **Chunk 6 - Practice** (optional):
  - "Here are variations of this error. Spot and fix them"
  - "Create a test case that would catch this error"
  - "Explain to someone else why this matters"

### Archetype Distribution Analysis for Approach 4:

**Module Coverage Matrix**:
- Module 1: Incremental Concept Building (primary)
- Module 1.5: Comparison Scaffolding (primary), Incremental Concept Building (secondary)
- Module 2: Incremental Concept Building (primary), Error-Based Scaffolding (secondary)
- Module 3: Guided Problem Progression (primary), Incremental Concept Building (secondary)
- Module 4: Guided Problem Progression (primary)
- Module 5: Guided Problem Progression (primary), Error-Based Scaffolding (primary)
- Module 6: Guided Problem Progression (primary), Comparison Scaffolding (secondary)
- Module 6.5: Comparison Scaffolding (primary)
- Module 7: Comparison Scaffolding (optimization), Error-Based Scaffolding (efficiency)
- Module 8: All archetypes for complex synthesis

**Rationale**: This scaffolded approach ensures every student can progress from their current level. The scaffolding can be adjusted based on student responses, making it highly adaptive. It's particularly effective for building confidence while maintaining appropriate challenge levels.

---

## Approach 5: Dialectical Inquiry Framework

**Core Philosophy**: This approach uses dialectical questioning - thesis, antithesis, synthesis - to develop deep understanding through exploring tensions, contradictions, and resolutions. Each archetype represents a different dialectical strategy.

### Archetypes and Module Coverage:

#### 5.1 Conceptual Dialectic Archetype
**Purpose**: Explore concepts through examining apparent contradictions and finding resolutions.

**Module Coverage**:
- **Module 1**: Recursion as both breaking down AND building up
- **Module 1.5**: Computational returning values vs generative performing actions
- **Module 8**: Synthesizing seemingly opposing techniques

**Blueprint**:
```
Thesis Presentation → Antithesis Introduction → Tension Exploration → Synthesis Discovery → Integration
```

**Chunk Structure** (5-6 chunks):
- **Chunk 1 - Thesis Presentation**:
  - "Consider this principle: 'Recursion breaks problems into smaller pieces'"
  - "How do you understand this?"
  - "Can you give examples?"

- **Chunk 2 - Antithesis Introduction**:
  - "But wait - recursion also builds solutions from pieces. Isn't that the opposite?"
  - "How can it both break down AND build up?"
  - "Do these contradict each other?"

- **Chunk 3 - Tension Exploration**:
  - "Let's explore this apparent contradiction"
  - "When does recursion 'break down'? When does it 'build up'?"
  - "Are these happening at the same time or different times?"

- **Chunk 4 - Synthesis Discovery**:
  - "Can you resolve this tension?"
  - "How do both perspectives fit together?"
  - "What's the complete picture?"

- **Chunk 5 - Integration**:
  - "How does this unified view help us?"
  - "What insights does it provide?"
  - "How does it change your mental model?"

- **Chunk 6 - Application** (optional):
  - "Apply this synthesis to solve: [problem]"
  - "How do both aspects manifest?"
  - "What new possibilities emerge?"

#### 5.2 Problem-Solution Dialectic Archetype
**Purpose**: Develop solutions by exploring problem constraints and their implications.

**Module Coverage**:
- **Module 3**: Balancing what goes down vs what comes up
- **Module 4**: Balancing simplicity vs completeness in design
- **Module 5**: Balancing edge cases vs general cases
- **Module 7**: Balancing time vs space efficiency

**Blueprint**:
```
Constraint Identification → Implication Analysis → Conflict Recognition → Resolution Strategy → Optimization
```

**Chunk Structure** (5-7 chunks):
- **Chunk 1 - Constraint Identification**:
  - "This problem has constraint X. What does that require?"
  - "But it also has constraint Y. What does THAT require?"
  - "Do these requirements conflict?"

- **Chunk 2 - Implication Analysis**:
  - "If we satisfy X, what happens to Y?"
  - "Can we satisfy both fully?"
  - "What trade-offs emerge?"

- **Chunk 3 - Conflict Recognition**:
  - "Where exactly do these constraints clash?"
  - "What's the core tension?"
  - "Why can't we have both?"

- **Chunk 4 - Resolution Strategy**:
  - "How might we resolve or manage this tension?"
  - "What creative solutions exist?"
  - "Can we reframe the problem?"

- **Chunk 5 - Implementation**:
  - "Let's implement our resolution strategy"
  - "How well does it balance the constraints?"
  - "What did we sacrifice? What did we gain?"

- **Chunk 6 - Optimization**:
  - "Can we improve the balance?"
  - "What if we relaxed constraint X slightly?"
  - "Is there a sweet spot?"

- **Chunk 7 - Reflection**:
  - "What principle did we discover?"
  - "How does this apply elsewhere?"
  - "What's the general lesson?"

#### 5.3 Pattern-Antipattern Dialectic Archetype
**Purpose**: Learn patterns by understanding both what to do and what not to do.

**Module Coverage**:
- **Module 2**: Correct vs incorrect execution understanding
- **Module 5**: Complete vs incomplete base cases
- **Module 6**: When patterns apply vs when they don't
- **Module 6.5**: Pattern selection vs misapplication

**Blueprint**:
```
Pattern Presentation → Antipattern Contrast → Boundary Exploration → Discrimination Criteria → Mastery
```

**Chunk Structure** (5-6 chunks):
- **Chunk 1 - Pattern Presentation**:
  - "Here's a good pattern: [example]. Why does it work?"
  - "What makes this elegant/efficient/correct?"
  - "When have we seen this succeed?"

- **Chunk 2 - Antipattern Contrast**:
  - "Here's what NOT to do: [antipattern]. Why does this fail?"
  - "What makes this problematic?"
  - "When have we seen this cause issues?"

- **Chunk 3 - Boundary Exploration**:
  - "Where's the line between pattern and antipattern?"
  - "Can you find edge cases?"
  - "When does good become bad?"

- **Chunk 4 - Discrimination Criteria**:
  - "How do we recognize which situation we're in?"
  - "What are the warning signs?"
  - "What questions should we ask?"

- **Chunk 5 - Mastery Check**:
  - "Classify these examples: pattern or antipattern?"
  - "Fix these antipattern instances"
  - "Create your own examples of each"

- **Chunk 6 - Synthesis**:
  - "What's the deeper principle?"
  - "Why does the pattern work and antipattern fail?"
  - "How does this inform design decisions?"

#### 5.4 Evolution Dialectic Archetype
**Purpose**: Show how solutions evolve from naive to sophisticated through dialectical refinement.

**Module Coverage**:
- **Module 4**: Evolution of design approaches
- **Module 6**: Evolution from brute force to elegant patterns
- **Module 7**: Evolution from inefficient to optimized
- **Module 8**: Evolution to advanced techniques

**Blueprint**:
```
Naive Approach → Limitation Discovery → Improved Approach → New Limitations → Optimal Resolution
```

**Chunk Structure** (6-7 chunks):
- **Chunk 1 - Naive Approach**:
  - "The most straightforward approach is: [naive solution]"
  - "Why is this the natural first attempt?"
  - "What works about it?"

- **Chunk 2 - Limitation Discovery**:
  - "But this approach fails when: [problematic cases]"
  - "What's the fundamental limitation?"
  - "Why didn't we see this initially?"

- **Chunk 3 - Improved Approach**:
  - "To address this, we could: [better solution]"
  - "How does this solve the previous issue?"
  - "What's the key insight?"

- **Chunk 4 - New Limitations**:
  - "However, this creates new problems: [new issues]"
  - "What trade-offs did we make?"
  - "Are we actually better off?"

- **Chunk 5 - Optimal Resolution**:
  - "The mature solution considers: [optimal approach]"
  - "How does this balance all concerns?"
  - "What makes this 'optimal'?"

- **Chunk 6 - Evolutionary Principles**:
  - "What drove each evolution step?"
  - "Could we have skipped directly to optimal?"
  - "What's the value of this journey?"

- **Chunk 7 - Application**:
  - "Apply this evolutionary thinking to: [new problem]"
  - "What would be your naive approach?"
  - "How would you evolve it?"

### Archetype Distribution Analysis for Approach 5:

**Module Coverage Matrix**:
- Module 1: Conceptual Dialectic (primary)
- Module 1.5: Conceptual Dialectic (primary), Pattern-Antipattern Dialectic (secondary)
- Module 2: Pattern-Antipattern Dialectic (execution correctness)
- Module 3: Problem-Solution Dialectic (primary)
- Module 4: Problem-Solution Dialectic (design trade-offs), Evolution Dialectic (secondary)
- Module 5: Pattern-Antipattern Dialectic (base case completeness)
- Module 6: Evolution Dialectic (pattern development), Pattern-Antipattern Dialectic (pattern recognition)
- Module 6.5: Pattern-Antipattern Dialectic (pattern selection)
- Module 7: Problem-Solution Dialectic (efficiency trade-offs), Evolution Dialectic (optimization)
- Module 8: All archetypes for advanced synthesis

**Rationale**: The dialectical approach is powerful for developing nuanced understanding. By exploring tensions and contradictions, students develop sophisticated mental models that can handle complexity. This approach is particularly effective for advanced topics and synthesis, while still being accessible through careful scaffolding.

---

## Comparative Analysis of All Approaches

### Approach Strengths and Best Use Cases:

1. **Progressive Inquiry Framework**
   - Strengths: Natural progression, comprehensive coverage, clear structure
   - Best for: Systematic curriculum delivery, mixed skill levels
   - Trade-offs: May be too structured for advanced students

2. **Problem-Centric Mastery Framework**
   - Strengths: Highly engaging, practical focus, immediate application
   - Best for: Interview preparation, practical skill building
   - Trade-offs: May miss theoretical nuances without careful design

3. **Cognitive Development Framework**
   - Strengths: Builds complete thinking skills, pedagogically sound
   - Best for: Long-term skill development, academic settings
   - Trade-offs: May feel abstract without enough concrete examples

4. **Scaffolded Discovery Framework**
   - Strengths: Highly adaptive, supports all levels, builds confidence
   - Best for: Diverse student populations, self-paced learning
   - Trade-offs: Requires careful calibration of support levels

5. **Dialectical Inquiry Framework**
   - Strengths: Develops deep understanding, handles complexity well
   - Best for: Advanced students, conceptual mastery
   - Trade-offs: May be challenging for beginners

### Recommendation:

For the Sensei system, I recommend **Approach 2: Problem-Centric Mastery Framework** as the primary approach, with elements from Approach 4 (Scaffolded Discovery) for adaptivity.

**Rationale**:
1. Aligns with heavy use of LeetCode problems throughout modules
2. Provides immediate practical value
3. Naturally engaging and motivating
4. Supports the transition from learning to interview readiness
5. Can incorporate scaffolding for different skill levels
6. Archetypes cover all modules comprehensively

### Implementation Notes:

1. **Chunk Generation Logic**: Each archetype's blueprint provides a template for chunk generation. The actual questions should be dynamically generated based on:
   - Module content
   - Specific problems mentioned
   - Student's current understanding level
   - Previous responses

2. **Dynamic Adaptation**: The system should:
   - Start with the primary archetype for each module
   - Switch to diagnostic archetype if confusion detected
   - Adjust chunk count based on complexity
   - Modify question difficulty based on responses

3. **Quality Assurance**: Generated chunks should:
   - Always end with questions, not statements
   - Build progressively within each chunk sequence
   - Reference specific examples from module content
   - Include metacognitive questions ("Why did you think that?")
   - Provide appropriate wait points for student responses

This comprehensive framework ensures that regardless of which approach is chosen, all modules receive appropriate Socratic treatment that guides students from understanding to mastery through carefully crafted questioning sequences.
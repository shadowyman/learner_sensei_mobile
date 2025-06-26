# Five Blueprint Approaches for Socratic Teaching Archetypes

## Overview

This document presents 5 different blueprint approaches for the same set of content-based archetypes. Each approach uses a distinct pedagogical philosophy while maintaining consistency with the archetype structure. All approaches cover the same 5 archetypes:

1. **LeetCode Problem Sequence Archetype** (Dynamic: 1 + 2n + 1 chunks)
2. **Concept Exploration Archetype** (Fixed: 3 chunks)
3. **Execution Trace Archetype** (Fixed: 3 chunks)
4. **Comparative Analysis Archetype** (Fixed: 3 chunks)
5. **Pattern Meta-Analysis Archetype** (Fixed: 3 chunks)

---

## Approach 1: Discovery-First Blueprint

**Philosophy**: Students discover patterns and solutions through exploration before receiving guidance. Questions lead from open exploration to guided insights.

### 1.1 LeetCode Problem Sequence Archetype

**Chunk Structure**: 1 intro + (2 × problems) + 1 synthesis

**Introduction Chunk**:
- "We're going to explore [n] problems today. Before I tell you what they are, what kinds of recursive problems have you found most challenging?"
- "Here are the problems: [list]. What's your initial reaction? Which seems most approachable?"
- "Take a moment to think about what these problems might have in common."

**Per Problem - Discovery Chunk (1st of 2)**:
- "Let's explore [problem]. What's your first instinct about how to approach this?"
- "What patterns do you see in the problem structure?"
- "Before we design a solution, what challenges do you anticipate?"
- "What would happen if you tried [naive approach]? Walk me through it."
- "What's breaking down in that approach? What insight are we missing?"

**Per Problem - Implementation Chunk (2nd of 2)**:
- "Based on your exploration, let's refine the approach. What state do we need to track?"
- "How would you implement this? Start with the function signature."
- "What edge cases did you discover during exploration?"
- "Common interview pitfall: [specific pitfall]. How does our solution avoid this?"
- "Variation question: What if [constraint changed]? How would your approach adapt?"

**Synthesis Chunk**:
- "Looking at all [n] problems we solved, what patterns emerged from your exploration?"
- "Which discoveries surprised you the most?"
- "Create your own problem that would fit this pattern. What makes it similar?"
- "What exploration strategy worked best across these problems?"

### 1.2 Concept Exploration Archetype

**Chunk 1 - Open Exploration**:
- "We've learned about [concept]. Can you think of a real-world scenario where this applies?"
- "What makes [concept] different from simple repetition?"
- "Explore this example: [novel domain]. Where do you see [concept] hiding?"

**Chunk 2 - Guided Discovery**:
- "You mentioned [student's example]. Let's dig deeper. What's the self-similar structure?"
- "What would happen if we removed [key component]? Predict the outcome."
- "Can you discover the 'smallest' version of this problem in your example?"

**Chunk 3 - Insight Synthesis**:
- "What did you discover about [concept] through your exploration?"
- "How would you explain this to someone using your own discovered examples?"
- "What questions does your exploration raise about [next concept]?"

### 1.3 Execution Trace Archetype

**Chunk 1 - Predictive Exploration**:
- "Before we trace, predict: what do you think happens when we call f(3)?"
- "Draw what you imagine the call stack looks like. Don't worry about being perfect."
- "What values do you think will be important to track?"

**Chunk 2 - Discovery Through Tracing**:
- "Let's trace it together. What surprised you compared to your prediction?"
- "At this point in execution, what patterns do you notice?"
- "Why do you think the stack grows this way? What controls it?"

**Chunk 3 - Insight Extraction**:
- "Based on your trace, what did you discover about recursive execution?"
- "What misconceptions did the tracing reveal?"
- "How would this trace change with input n=10? What stays the same?"

### 1.4 Comparative Analysis Archetype

**Chunk 1 - Independent Exploration**:
- "Here are two approaches: [A] and [B]. Explore each one. What do you notice?"
- "Try to solve [simple example] using both approaches. What happens?"
- "Which approach feels more natural to you? Why?"

**Chunk 2 - Guided Comparison**:
- "You discovered [difference]. Why do you think this difference exists?"
- "What trade-offs did you uncover through your exploration?"
- "Can you find a case where approach A fails but B succeeds?"

**Chunk 3 - Principle Discovery**:
- "Based on your exploration, when would you choose each approach?"
- "What general principle can you extract from this comparison?"
- "Design a problem where the choice between A and B is obvious. What makes it obvious?"

### 1.5 Pattern Meta-Analysis Archetype

**Chunk 1 - Pattern Hunting**:
- "Look at these problem statements: [list]. What patterns do you see?"
- "Without solving them, which ones feel similar? Why?"
- "What keywords or structures caught your attention?"

**Chunk 2 - Pattern Validation**:
- "You identified [pattern]. Let's test your hypothesis. Does it hold for [example]?"
- "What variations of this pattern might exist?"
- "Can you find a problem that looks like this pattern but isn't?"

**Chunk 3 - Pattern Mastery**:
- "How would you teach someone to recognize this pattern?"
- "What's your personal 'recognition checklist' based on your discoveries?"
- "Create a problem statement that clearly signals this pattern."

---

## Approach 2: Problem-First Blueprint

**Philosophy**: Start with concrete problems and examples, then extract principles. Build understanding from specific to general.

### 2.1 LeetCode Problem Sequence Archetype

**Introduction Chunk**:
- "Let's dive into these problems: [list with full descriptions]"
- "I'll solve the first one partially to show the process: [partial solution]"
- "Notice how I'm thinking about [key aspect]. This will be crucial."

**Per Problem - Solution Building Chunk (1st of 2)**:
- "For [problem], let's start with concrete input: [example]. What should happen?"
- "Walk through this specific case step by step. What operations occur?"
- "Now let's build the solution. What's our base case for this specific problem?"
- "For this exact input, trace what our function should do."
- "Does our solution handle this edge case: [specific case]?"

**Per Problem - Generalization Chunk (2nd of 2)**:
- "Our solution works. What general principle did we apply?"
- "Here's how an interviewer might extend this: [variation]. How do we adapt?"
- "Common mistake with this problem type: [specific error with example]"
- "The key insight for this problem family is: [principle]. Do you see why?"
- "Quick optimization: [specific technique]. When would this matter?"

**Synthesis Chunk**:
- "We solved [problems]. Let's extract the common patterns."
- "Here's a decision tree for choosing approaches: [concrete framework]"
- "Match these new problems to our patterns: [practice problems]"
- "Which specific techniques transferred across problems?"

### 2.2 Concept Exploration Archetype

**Chunk 1 - Concrete Examples**:
- "Let's see [concept] in action: factorial(5). What happens at each step?"
- "Here's another example: [different domain]. Same concept, different look."
- "In this code: [snippet], where exactly is [concept] happening?"

**Chunk 2 - Pattern Extraction**:
- "What's common between factorial(5) and [other example]?"
- "From these specific examples, what general rule emerges?"
- "If we change [specific aspect], how does the pattern adapt?"

**Chunk 3 - Application Practice**:
- "Apply what we extracted to this new problem: [concrete scenario]"
- "Show me [concept] in this code. Where exactly does it occur?"
- "Fix this broken example: [specific broken code]. What's missing?"

### 2.3 Execution Trace Archetype

**Chunk 1 - Concrete Execution**:
- "Let's trace factorial(4) completely. Stack frame 1 contains: [exact values]"
- "When we hit line 3, the stack looks like: [diagram]"
- "At the deepest point, we have exactly [n] frames because..."

**Chunk 2 - Mechanical Analysis**:
- "In frame 3, variable n=2. What happens when we return 2?"
- "The return value goes to line [x] in frame 2. Then what?"
- "Count the operations: how many multiplications occur for factorial(4)?"

**Chunk 3 - Performance Insights**:
- "For factorial(n), we use exactly [n] stack frames. Why?"
- "What's the maximum memory used during execution?"
- "If n=1000, what specific problem would we encounter?"

### 2.4 Comparative Analysis Archetype

**Chunk 1 - Side-by-Side Examples**:
- "Solve 'count nodes' iteratively: [solution]. Now recursively: [solution]"
- "For input [specific tree], trace both approaches step by step."
- "Count exact operations: iterative does [x], recursive does [y]."

**Chunk 2 - Concrete Differences**:
- "The iterative version uses [specific structure]. The recursive uses [what]?"
- "For this specific edge case: [example], which approach is cleaner?"
- "Memory usage for n=100: iterative uses [x], recursive uses [y]."

**Chunk 3 - Decision Framework**:
- "Use iterative when: [specific conditions with examples]"
- "Use recursive when: [specific conditions with examples]"
- "For this specific problem: [problem], I'd choose [approach] because..."

### 2.5 Pattern Meta-Analysis Archetype

**Chunk 1 - Problem Examination**:
- "Read this problem: [full text]. The key phrases are: [highlight]"
- "This constraint: '[specific constraint]' suggests [pattern] because..."
- "Similar problem you've seen: [reference]. Notice the parallel?"

**Chunk 2 - Pattern Confirmation**:
- "Let's verify: does [pattern] actually work here? Try it: [walkthrough]"
- "This part of the problem: [aspect] confirms we need [technique]"
- "Counter-example: this similar-looking problem actually needs [different pattern]"

**Chunk 3 - Recognition Practice**:
- "Categorize these problems: [list]. Which pattern for each?"
- "This problem has a twist: [description]. How does that change the pattern?"
- "Write a problem statement that clearly requires [pattern]."

---

## Approach 3: Contrast-Driven Blueprint

**Philosophy**: Learning through systematic comparison and contrast. Every concept is understood in relation to its alternatives or opposites.

### 3.1 LeetCode Problem Sequence Archetype

**Introduction Chunk**:
- "We'll solve [n] problems using different approaches to see the contrasts."
- "For each problem, we'll consider: what we could do vs. what we should do."
- "Key question throughout: why is one approach better than another?"

**Per Problem - Contrast Exploration Chunk (1st of 2)**:
- "For [problem], what's the brute force approach? What's the elegant approach?"
- "Contrast: solving with/without helper function. What changes?"
- "If we pass state down vs. return it up, how does the solution differ?"
- "What if we used global state vs. parameters? Compare the implications."
- "Iterative version would look like: [outline]. Why choose recursive instead?"

**Per Problem - Optimal Resolution Chunk (2nd of 2)**:
- "Given our contrasts, the optimal approach uses [technique] because..."
- "Implementation with commentary on alternatives not taken: [code]"
- "Interview insight: defenders might prefer [A], but [B] is better because..."
- "What if the constraint was [different]? Would our choice change?"
- "Anti-pattern to avoid: [specific anti-pattern]. Here's why it's tempting but wrong."

**Synthesis Chunk**:
- "Across all problems, when did passing down win vs. returning up?"
- "Create a comparison table: [approach A vs B vs C] across our problems"
- "Which contrasts were most revealing? Why?"
- "Universal principle: choose [X] over [Y] when [conditions]."

### 3.2 Concept Exploration Archetype

**Chunk 1 - Concept vs. Non-Concept**:
- "Here's recursion: [example]. Here's iteration doing the same: [example]. What's different?"
- "This is self-similarity: [example]. This isn't: [counter-example]. Why?"
- "With base case: [code]. Without base case: [code]. What happens?"

**Chunk 2 - Internal Contrasts**:
- "Base case that returns vs. base case that acts. When do we use each?"
- "Single base case vs. multiple base cases. What necessitates multiple?"
- "Tail recursion vs. head recursion. How do they differ in [concept]?"

**Chunk 3 - Synthesis Through Opposition**:
- "From our contrasts, what's the essence of [concept]?"
- "Which contrast was most illuminating for understanding [concept]?"
- "Create your own contrast pair that highlights [concept]."

### 3.3 Execution Trace Archetype

**Chunk 1 - Trace Comparison Setup**:
- "Let's trace f(4) vs. f(3). What's different in the execution?"
- "Tail recursive version: [trace]. Regular version: [trace]. Compare stacks."
- "With optimization: [trace]. Without: [trace]. What changes?"

**Chunk 2 - Divergence Analysis**:
- "At what point do the traces diverge? Why there?"
- "Stack depth for approach A: [n]. For approach B: [log n]. Why the difference?"
- "Which approach returns values faster? Which uses more memory?"

**Chunk 3 - Performance Contrasts**:
- "Time complexity comparison: [analysis]. Space: [analysis]."
- "Best case vs. worst case execution. What causes the difference?"
- "When would you choose the 'worse' approach? What might justify it?"

### 3.4 Comparative Analysis Archetype

**Chunk 1 - Direct Opposition**:
- "Computational recursion: returns values. Generative: performs actions. Examples?"
- "Top-down thinking vs. bottom-up thinking in recursion. When each?"
- "Mutable state approach vs. immutable approach. Trade-offs?"

**Chunk 2 - Nuanced Differences**:
- "These approaches seem similar but: [subtle difference]. Why does it matter?"
- "In theory, equivalent. In practice: [practical difference]. Real impact?"
- "Language A encourages [approach]. Language B encourages [other]. Why?"

**Chunk 3 - Unified Understanding**:
- "Despite contrasts, what unifies these approaches?"
- "When do the contrasts matter most? When can we ignore them?"
- "Create a decision flowchart based on our contrasts."

### 3.5 Pattern Meta-Analysis Archetype

**Chunk 1 - Pattern vs. Anti-Pattern**:
- "This signals backtracking: [clues]. This signals DP: [different clues]. See the contrast?"
- "Problem that looks like divide-conquer but isn't: [example]. Why not?"
- "Keywords suggesting pattern A vs. pattern B: [comparative list]"

**Chunk 2 - Boundary Cases**:
- "When patterns overlap: [example problem]. Which dominates?"
- "Pattern breaks down when: [conditions]. Alternative pattern: [which one]"
- "Hybrid approach needed when: [specific signals]. Example?"

**Chunk 3 - Selection Mastery**:
- "Pattern selection flowchart based on contrasts: [visual/description]"
- "Most commonly confused patterns: [A vs B]. Disambiguation key?"
- "Create two problems: one clearly pattern A, one clearly pattern B."

---

## Approach 4: Debug-First Blueprint

**Philosophy**: Learning through errors and debugging. Understanding comes from fixing what's broken and learning why it was wrong.

### 4.1 LeetCode Problem Sequence Archetype

**Introduction Chunk**:
- "I'll show you [n] broken solutions. Your job: find and fix the bugs."
- "Each bug teaches a crucial lesson about recursive problem-solving."
- "Remember: the bug isn't just the error—it's the thinking that caused it."

**Per Problem - Debug Discovery Chunk (1st of 2)**:
- "Here's a solution for [problem]: [buggy code]. It fails on input [X]. Why?"
- "Trace through the failure case. Where does reality diverge from expectation?"
- "What assumption does this code make that's invalid?"
- "Before we fix it, predict: what other inputs would break this?"
- "Common misconception leading to this bug: [explanation]"

**Per Problem - Correct Implementation Chunk (2nd of 2)**:
- "To fix this, we need to: [explain fix]. Here's why: [reasoning]"
- "Corrected solution with bug prevention comments: [code]"
- "Interview tip: mention this edge case proactively because [reason]"
- "Related bugs to watch for: [list with examples]"
- "How to test for this category of bugs: [testing strategy]"

**Synthesis Chunk**:
- "Across all problems, what categories of bugs did we encounter?"
- "Create a debugging checklist for recursive problems based on our fixes."
- "Which bug pattern is most dangerous in interviews? Why?"
- "Design a test suite that would catch all the bugs we found."

### 4.2 Concept Exploration Archetype

**Chunk 1 - Broken Understanding**:
- "Common misconception: 'Recursion is just loops.' Here's why that breaks: [example]"
- "This code tries to implement [concept] but fails: [code]. What's wrong?"
- "Student often think [misconception]. Let's see why that doesn't work: [demo]"

**Chunk 2 - Debugging Concepts**:
- "The error in thinking was: [explanation]. Here's the correct mental model:"
- "Why does [misconception] seem logical but fail in practice?"
- "Fix this conceptual error: [broken example]. What needs to change?"

**Chunk 3 - Solidified Understanding**:
- "Now that we've debugged the concept, explain it correctly."
- "What warning would you give someone to avoid this misconception?"
- "Create an example that would break if someone held the misconception."

### 4.3 Execution Trace Archetype

**Chunk 1 - Trace the Bug**:
- "This recursive function crashes with stack overflow on input 10. Trace and find why."
- "Expected behavior: [description]. Actual: [crash]. Where's the divergence?"
- "At which recursive call does the error become inevitable?"

**Chunk 2 - Fix the Execution**:
- "The stack overflow happens because: [reason]. Fix: [solution]"
- "Here's the corrected trace: [walkthrough]. See the difference?"
- "What other execution errors might occur with recursion?"

**Chunk 3 - Execution Debugging Skills**:
- "Warning signs in a trace that indicate bugs: [list]"
- "How to instrument recursive code for debugging: [techniques]"
- "Create a function with a subtle execution bug for others to find."

### 4.4 Comparative Analysis Archetype

**Chunk 1 - Flawed Comparisons**:
- "Claim: 'Approach A is always better than B.' Here's a counterexample: [example]"
- "This comparison is unfair because: [biased setup]. Fair comparison: [proper setup]"
- "Common mistake: comparing [wrong metrics]. What should we compare instead?"

**Chunk 2 - Debugging the Analysis**:
- "The flaw in the comparison was: [explanation]. Correct analysis shows:"
- "Why do people make this comparison error? What's the appeal?"
- "Redo the comparison correctly. What changes in the conclusion?"

**Chunk 3 - Robust Comparison Skills**:
- "Checklist for fair comparisons: [items based on our debugging]"
- "How to avoid comparison pitfalls in technical interviews"
- "Design a comparison that could mislead. Then fix it."

### 4.5 Pattern Meta-Analysis Archetype

**Chunk 1 - Misidentified Patterns**:
- "This problem looks like [pattern A] but it's actually [pattern B]. Here's why: [analysis]"
- "Common trap: seeing [keyword] and assuming [pattern]. Counterexample: [problem]"
- "Let's debug this pattern selection: why did it seem right but fail?"

**Chunk 2 - Pattern Debugging Process**:
- "The misidentification happened because: [reason]. Correct identification process:"
- "Red flags that your pattern choice is wrong: [indicators from our example]"
- "How to verify pattern choice before committing to implementation"

**Chunk 3 - Pattern Selection Mastery**:
- "Debugging checklist for pattern selection: [items]"
- "Most dangerous pattern confusion: [A vs B]. How to avoid?"
- "Create a problem that intentionally misleads toward wrong pattern."

---

## Approach 5: Incremental Construction Blueprint

**Philosophy**: Building understanding step by step, where each chunk adds one precise layer of complexity. Perfect scaffolding from simple to complex.

### 5.1 LeetCode Problem Sequence Archetype

**Introduction Chunk**:
- "We'll build solutions incrementally for [n] problems."
- "Step 1 is always the simplest possible version."
- "Each refinement will add exactly one new consideration."

**Per Problem - Foundation Chunk (1st of 2)**:
- "Simplest version of [problem]: assume [constraints removed]. Solution: [basic code]"
- "This works for input: [simple case]. Trace through it."
- "What's the core recursive insight in this simplified version?"
- "Add one complexity: [specific addition]. How must our solution change?"
- "With this addition, what new edge case appears?"

**Per Problem - Complete Solution Chunk (2nd of 2)**:
- "Full version with all constraints: [complete solution]"
- "See how each piece we added serves a purpose: [mapping]"
- "Interview approach: start simple like we did, then add complexity"
- "Common mistake: trying to handle everything at once. Our incremental approach avoids this."
- "Challenge: what's the next level of complexity we could add?"

**Synthesis Chunk**:
- "Across all problems, what was our consistent building pattern?"
- "Which incremental steps appeared in multiple problems?"
- "Create an 'incremental template' for approaching new problems."
- "What's the optimal order for adding complexity?"

### 5.2 Concept Exploration Archetype

**Chunk 1 - Minimal Concept**:
- "Simplest possible [concept]: [minimal example]. Nothing extra."
- "This is the bare minimum for [concept] to exist. Less would break it."
- "What single element could we add to make it more realistic?"

**Chunk 2 - Concept Development**:
- "Adding [element]: now we have [expanded example]. What changed?"
- "This addition reveals: [new aspect of concept]"
- "Next layer: [another addition]. How does this build on what we have?"

**Chunk 3 - Complete Concept**:
- "Full concept with all nuances: [complete explanation]"
- "See how each layer was necessary? Remove any and [consequence]"
- "In what order would you teach these layers to someone else?"

### 5.3 Execution Trace Archetype

**Chunk 1 - Single-Level Trace**:
- "Simplest trace: function with no recursion. f(1) = base case. That's it."
- "One level deeper: f(2) calls f(1). Two frames total. Trace this."
- "What's the minimal mental model for these two frames?"

**Chunk 2 - Multi-Level Building**:
- "f(3) calls f(2) calls f(1). Three frames. What pattern emerges?"
- "At each level, what's constant? What changes?"
- "Add one more level. Predict before tracing."

**Chunk 3 - Complex Execution**:
- "Full trace of f(n) for arbitrary n. Generic pattern: [description]"
- "From our incremental building, derive the space complexity formula."
- "What execution patterns became clear through incremental analysis?"

### 5.4 Comparative Analysis Archetype

**Chunk 1 - Binary Comparison**:
- "Start simple: approach A vs B for the minimal case: [example]"
- "In this simple case, A does [X], B does [Y]. Minimal difference: [what]"
- "Add one complexity. How do A and B diverge further?"

**Chunk 2 - Expanded Comparison**:
- "With more complexity: A handles it by [method], B by [different method]"
- "The divergence teaches us: [principle]"
- "Add final complexity layer. Which approach scales better?"

**Chunk 3 - Complete Analysis**:
- "Full comparison across all complexity levels: [summary]"
- "At what complexity level did the winner become clear?"
- "Could we have predicted the outcome from the simple case?"

### 5.5 Pattern Meta-Analysis Archetype

**Chunk 1 - Single Pattern Focus**:
- "Simplest possible [pattern] problem: [minimal example]"
- "Core characteristic that makes this [pattern]: [identification]"
- "Add one twist. Still the same pattern? How can you tell?"

**Chunk 2 - Pattern Variations**:
- "Pattern with variation A: [example]. What adjusted?"
- "Pattern with variation B: [example]. Different adjustment."
- "Despite variations, the constant is: [pattern essence]"

**Chunk 3 - Pattern Mastery**:
- "Full pattern recognition framework built from our increments: [framework]"
- "Minimum features needed to identify [pattern]: [list]"
- "Each additional feature suggests: [variations/optimizations]"

---

## Comparative Analysis of Approaches

### Approach Characteristics:

1. **Discovery-First**: Maximum student agency, exploration-based, requires strong facilitation
2. **Problem-First**: Concrete and practical, immediate applicability, may miss conceptual depth
3. **Contrast-Driven**: Builds nuanced understanding, excellent for distinctions, can be overwhelming
4. **Debug-First**: Highly engaging, prevents common mistakes, requires error inventory
5. **Incremental Construction**: Perfect scaffolding, clear progression, may feel slow for advanced students

### Selection Criteria:

- **For beginners**: Incremental Construction or Problem-First
- **For interview prep**: Problem-First or Debug-First
- **For conceptual mastery**: Discovery-First or Contrast-Driven
- **For error prevention**: Debug-First
- **For nuanced understanding**: Contrast-Driven

### Implementation Notes:

1. **Chunk Discipline**: Each approach maintains strict chunk counts except for LeetCode problems
2. **Question Generation**: Each blueprint provides question templates that can be instantiated with specific content
3. **Adaptation Points**: While blueprints are fixed, specific questions can be adjusted based on module content
4. **Module Coverage**: All approaches can handle all modules, but some naturally fit better:
   - Modules 1, 1.5: Discovery-First or Contrast-Driven excel
   - Modules 3-6: Problem-First or Debug-First are natural fits
   - Module 2, 7: Incremental Construction or Contrast-Driven work well
   - Module 8: Any approach works, Contrast-Driven might synthesize best

### Recommendation:

For the Sensei system, **Problem-First** or **Debug-First** approaches align best with the heavy use of LeetCode problems while maintaining pedagogical effectiveness. Problem-First is more traditional and comfortable, while Debug-First is more engaging and prevents common interview mistakes.

The blueprint templates in each approach provide clear structure for the LLM to generate appropriate Socratic questions while maintaining consistency with the chunk-based delivery system.
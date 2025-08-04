# REVISED MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL

## PROTOCOL REPLACEMENT FOR CLAUDE.md

**Replace the existing `MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL` with this enhanced version that addresses confirmation bias and hypothesis space limitations.**

---

## ====MANDATORY ADAPTIVE ROOT CAUSE ANALYSIS & REMEDIATION PROTOCOL====

### <initial_action>
Upon receiving a bug report, your FIRST action is to use your `todowrite` tool to create a to-do list containing all steps of this protocol (Steps 1-14). You will then execute this list step-by-step, announcing each phase and step as you begin. This is non-negotiable.
</initial_action>

### <step number="0">
**Step 0: Core Analysis**
*   **Action:** Execute the **MANDATORY CORE ANALYSIS PROTOCOL (STEP 0)**. Upon completion, proceed to Step 1 of this protocol.
</step>

## Phase 1: Enhanced Root Cause Discovery (The "Why")

### <step number="1">
**Evidence-First Symptom Mapping**:
*   **Action**: Collect ALL observable symptoms without any explanation attempts. Document exactly what you see, not what you think it means.
*   **Action**: For each symptom, ask: "What are 5 completely different technical mechanisms that could cause this exact symptom?"
*   **Action**: Document any evidence patterns that seem contradictory, unexpected, or don't fit obvious explanations.
*   **Output**: Present a clean symptom list with multiple potential mechanisms for each.
</step>

### <step number="2">
**Systematic Hypothesis Space Expansion**:
Execute 6 mandatory discovery cycles, generating at least 2 new hypotheses per cycle:

*   **Cycle 1 - Current Component Scope**: Focus only on the immediately affected component/function. What could be wrong within its boundaries?
*   **Cycle 2 - Direct Dependencies**: Expand to components that directly interact. What if the problem is in a dependency?
*   **Cycle 3 - System Interactions**: Consider cross-component interactions, data flow between modules. What if it's an integration issue?
*   **Cycle 4 - External Factors**: Environment, timing, concurrency, user input variations. What if it's context-dependent?
*   **Cycle 5 - Historical/Temporal**: Recent changes, deployment issues, state corruption over time. What if it's a temporal issue?
*   **Cycle 6 - Meta-System**: Build process, configuration, deployment pipeline, infrastructure. What if the problem is outside the code entirely?

*   **Action**: For EACH cycle, systematically examine that scope and generate hypotheses WITHOUT filtering for likelihood.
*   **Output**: Present hypothesis set organized by discovery cycle (should have 12+ hypotheses total).
</step>

### <step number="3">
**Contrarian Hypothesis Injection**:
*   **Action**: Generate "mental model breaker" hypotheses by asking:
    *   "What if my entire understanding of how this system works is wrong?"
    *   "What would cause these symptoms if the obvious explanations are all false?"
    *   "What bug would be so weird/unusual that I'd never think of it in normal analysis?"
*   **Action**: Systematically go through EVERY major system component (even ones that seem unrelated) and ask: "Could this component somehow cause these symptoms?"
*   **Action**: Don't rely on intuition for elimination - check components you're "sure" aren't involved.
*   **Output**: Add 3-5 "contrarian" hypotheses to your set.
</step>

### <step number="4">
**Fresh Perspective Reset**:
*   **Action**: Without looking at your existing hypothesis list, pretend you just joined this investigation for the first time.
*   **Action**: Generate a completely fresh set of 3-5 hypotheses based purely on the symptoms.
*   **Action**: Compare fresh vs. original hypothesis sets. What did you miss initially? What new angles emerged?
*   **Output**: Document any hypotheses that emerged only in the fresh perspective analysis.
</step>

### <step number="5">
**Evidence-Arbitrated Investigation Loop**:
Now begin systematic evidence gathering for your expanded hypothesis set:
*   **5a. Hypothesis Prioritization**: Rank all hypotheses by "evidence accessibility" (how quickly can you gather decisive evidence), not by intuitive likelihood.
*   **5b. Evidence Collection**: For the top-ranked hypothesis, define the single most decisive piece of evidence that would prove or disprove it.
*   **5c. Evidence Gathering**: Execute the minimal action needed to gather this evidence.
*   **5d. Evidence Scoring**: Score the evidence as:
    *   Supporting Evidence Strength (0-10)
    *   Contradictory Evidence Strength (0-10)
    *   Evidence Quality/Reliability (0-10)
*   **5e. Hypothesis Set Update**: Update probability scores for ALL hypotheses based on new evidence. Remove definitively disproven hypotheses.
*   **5f. Stopping Condition Check**: 
    *   Stop if one hypothesis reaches >90% confidence with strong supporting evidence
    *   Stop if evidence gathering hits diminishing returns (3 cycles with no decisive evidence)
    *   Continue if multiple viable hypotheses remain
*   **5g. Repeat**: Return to 5a with updated hypothesis set.
</step>

### <step number="6">
**Declare Root Cause**: 
*   **Action**: Once the loop concludes, formally declare the confirmed root cause with final confidence score.
*   **Action**: Document which discovery cycle (Step 2) or analysis phase (Steps 3-4) revealed the winning hypothesis.
*   **Action**: State whether the root cause was in your initial hypothesis set or discovered through systematic expansion.
*   **Output**: "Root cause identified: [description] (Confidence: X%, Discovered in: [cycle/phase])"
</step>

## Phase 2: Principled Remediation & Validation (The "How")

### <step number="7">
**Propose Remediation Strategies**: Define at least two distinct strategies for the fix:
*   **A) The Quick Patch**: The most direct, minimal change to fix the symptom.
*   **B) The Robust Fix**: The ideal architectural solution that addresses the root cause and improves system health. Proceed with Robust Fix.
</step>

### <step number="8">
**Create Remediation Trade-off Matrix**: Create a report to evaluate the strategies. You MUST get my approval on a strategy before proceeding. Present in readable list format:

**Strategy Evaluation Matrix:**
- **A: Quick Patch**
  - Description: [specific minimal change]
  - Technical Debt: High/Medium/Low
  - Risk of Regression: High/Medium/Low  
  - Long-term Maintainability: High/Medium/Low
  - Recommendation: [your assessment]

- **B: Robust Fix**
  - Description: [architectural solution]
  - Technical Debt: High/Medium/Low
  - Risk of Regression: High/Medium/Low
  - Long-term Maintainability: High/Medium/Low
  - Recommendation: **[Recommended/Not Recommended]**
</step>

### <step number="9">
**Generate Phased To-Do List**: Once I approve a strategy, convert it into a detailed to-do list, including steps for adding temporary debug logs for validation.
</step>

### <step number="10">
**Execute Fix with Logging**: Do not add comments. Implement the fix according to the plan, adding descriptive debug logs `logger.[log|warn|error]` that will prove the fix works. Logs must start with "[XXX]..." and must have a tag defining the bug for `XXX`.
</step>

### <step number="11">
**Perform RCI Self-Correction**: Execute the RCI task - RCI should validate correctness, not chase alternative approaches if not needed.
*   *Adopt a Skeptical Reviewer Persona*: Act as a different engineer reviewing the code you just wrote.
*   *Challenge Your Fix*: Ask critical socratic questions about the new code's robustness and edge cases.
*   *Verify All Requirements*: Re-read the original request to ensure full compliance.
*   *Report & Remediate*: If you find flaws, state them, fix them, and then repeat this RCI process on your fixes until a review passes with no issues.
</step>

### <step number="12">
**Prompt for User Test**: Once RCI is complete, ask me to test the fix in the live environment.
</step>

### <step number="13">
**Validate with Logs**: After I confirm the test is done, access `./logs/console_logs.log` to analyze the output and verify the fix worked as expected and introduced no new errors.
</step>

### <step number="14">
**Declare Final Outcome & Documentation**:
*   *If Validation Succeeds*: Announce success. MUST DELETE THE TEMPORARY DEBUG LOGS added for validation, leaving only essential, permanent logs. Then proceed to mandatory documentation.
*   *If Validation Fails*: Announce failure. Revert the fix. Return to **Step 1** of this protocol to diagnose the new, combined issue (the original bug + the failed fix).

**MANDATORY Bug Fix Documentation** (NON-NEGOTIABLE FINAL STEP - ONLY FOR SUCCESSFUL FIXES):
**Action**: After ANY SUCCESSFUL bug fix, you MUST append to the `PREVIOUS_BUG_FIXES.md` file. This is an ABSOLUTE REQUIREMENT and failure to do so is a critical protocol violation.

**Documentation Format**: Create a new numbered entry that includes:
- **Issue**: One-sentence description of the visible problem
- **Root Cause**: Technical explanation of why the bug occurred  
- **Discovery Method**: Which cycle/phase revealed the root cause (from Step 6)
- **Fix Applied**: What changes were made to resolve it
- **Related Files**: List affected files with specific line numbers using format `filename:line-range`
- **Keywords for Future Reference**: Add searchable terms related to the bug

**Rationale**: This creates a searchable knowledge base for future debugging. When encountering new bugs, you MUST first check `PREVIOUS_BUG_FIXES.md` to see if similar issues have been encountered and resolved before.
</step>

---

## KEY IMPROVEMENTS IN THIS REVISION:

1. **Systematic Hypothesis Discovery**: Six mandatory expansion cycles ensure coverage of unknown unknowns
2. **Evidence-First Approach**: Symptoms drive hypothesis generation, not preconceptions
3. **Contrarian Analysis**: Explicit mental model breaking and systematic component checking
4. **Fresh Perspective Reset**: Built-in mechanism to escape initial thinking patterns
5. **Discovery Tracking**: Documentation of which method revealed the actual root cause
6. **Enhanced Documentation**: Records discovery methodology for future learning

This protocol forces discovery of root causes that would never appear in initial hypothesis sets.
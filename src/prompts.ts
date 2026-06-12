/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */ 

import { MISCONCEPTION_IDS, LearnerModel } from "./adaptiveEngine"; // For getComprehensiveAnalysisPrompt
import { CurriculumItem, CurriculumState, PHASE_MASTERY_THRESHOLD } from "./curriculum"; // For CURRICULUM_FOCUS_PROMPT_TEMPLATES
import { logger } from "./logger"; // For Socratic v4 logging
import {
    GET_ITEM_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION as CORE_GET_ITEM_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION,
    GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT as CORE_GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT,
    GET_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION as CORE_GET_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION
} from '@sensei/core/teachingPlan';
import { MODULE_INTRODUCTION_TASK_TEMPLATE } from '@sensei/core/prompts/moduleIntroduction';
import {
    CURRICULUM_COMPLETED_FOCUS_INSTRUCTION,
    GENERAL_ENGAGEMENT_PROMPT_TEMPLATE,
    GENERAL_INTERACTION_FOCUS_INSTRUCTION,
    MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION,
    PEDAGOGICAL_GUIDANCE_PLACEHOLDER,
    REINFORCE_DEEPEN_CHUNK_PROMPT_TEMPLATE,
    REVISIT_CLARIFY_CHUNK_PROMPT_TEMPLATE,
    REVISIT_CLARIFY_GENERAL_PROMPT_TEMPLATE,
    TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE,
    USER_LAST_INPUT_PLACEHOLDER,
    buildSocraticInitialInstruction
} from '@sensei/core/prompts/mainSenseiResponse';
import {
    MERMAID_GENERATION_GUIDELINES,
    RECURSIVE_SENSEI_TEACHING_INVARIANTS,
    SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS
} from '@sensei/core/prompts/baseSensei';
import {
    SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION,
    SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION,
    SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION,
    SELECTION_SENSEI_TOOLBAR_ACTION_INSTRUCTIONS,
    buildSelectionSenseiToolbarPrompt,
    getSelectionSenseiToolbarActionInstruction
} from '@sensei/core/prompts/selectionSensei';

export {
    MODULE_INTRODUCTION_TASK_TEMPLATE,
    CURRICULUM_COMPLETED_FOCUS_INSTRUCTION,
    GENERAL_ENGAGEMENT_PROMPT_TEMPLATE,
    GENERAL_INTERACTION_FOCUS_INSTRUCTION,
    MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION,
    PEDAGOGICAL_GUIDANCE_PLACEHOLDER,
    REINFORCE_DEEPEN_CHUNK_PROMPT_TEMPLATE,
    REVISIT_CLARIFY_CHUNK_PROMPT_TEMPLATE,
    REVISIT_CLARIFY_GENERAL_PROMPT_TEMPLATE,
    TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE,
    USER_LAST_INPUT_PLACEHOLDER,
    buildSocraticInitialInstruction,
    MERMAID_GENERATION_GUIDELINES,
    RECURSIVE_SENSEI_TEACHING_INVARIANTS,
    SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS,
    SENSEI_ASK_QUESTION_USER_PROMPT_TEMPLATE_FUNCTION,
    SENSEI_SELECTED_TEXT_SYSTEM_INSTRUCTION,
    SENSEI_SELECTED_TEXT_USER_PROMPT_TEMPLATE_FUNCTION,
    SELECTION_SENSEI_TOOLBAR_ACTION_INSTRUCTIONS,
    buildSelectionSenseiToolbarPrompt,
    getSelectionSenseiToolbarActionInstruction
};
export { buildSenseiEnhancementPrompt } from '@sensei/core/prompts/enhancement';

function logSocraticPromptValidation(event: string, payload: Record<string, unknown>): void {
    logger.info('[SOCRATIC_PLAN_VALIDATION]', { event, ...payload });
}

export function GET_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION(textToProcess: string): string {
    return CORE_GET_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION(textToProcess);
}

export function GET_ITEM_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION(textToProcess: string): string {
    return CORE_GET_ITEM_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION(textToProcess);
}

export const GET_ITEM_BASED_TEACHING_PLAN_PROMPT_FUNCTION = GET_ITEM_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION;
export const GET_ARCHETYPE_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION = GET_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION;

export function GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT(
    socraticSectionContent: string,
    moduleTitle: string,
    moduleGoal: string,
    conceptsSummary: string
): string {
    const conceptCount = conceptsSummary
        .split(',')
        .map(entry => entry.trim())
        .filter(entry => entry.length > 0)
        .length;
    logSocraticPromptValidation('categorization-prompt-prepared', {
        moduleTitle,
        socraticContentLength: socraticSectionContent.length,
        moduleGoalProvided: moduleGoal.trim().length > 0,
        conceptCount
    });
    
    return CORE_GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT(
        socraticSectionContent,
        moduleTitle,
        moduleGoal,
        conceptsSummary
    );
}


// --- Prompts for curriculum.ts (getCurriculumFocusInstruction) ----

export const KEY_TAKEAWAY_PROMPT_PREFIX = `Context: You are writing the "Key Takeaways" section of a larger teaching response. The earlier sections are already complete per the MANDATORY_TEACHING_STRUCTURE and must not be repeated. Specifically, the main teaching LLM has already delivered:
- Conceptual Narrative (intuition-building): Restated the core concept; covered The Pain & Stakes; built a Bridge to Prior Mastery; presented a Thought Experiment; gave a Readiness Signal; previewed the drilldown; and optionally included Visuals (Mermaid) to anchor intuition.
- Expansive Technical Drilldown (execution-focused): Provided formal Definitions; inserted the literal placeholder for Key Takeaways; listed Applications / Use Cases; and analyzed Strengths, Trade-offs, & Pitfalls in detail.
- Optional Mode: Either a Full C++ Walkthrough (with narrated dry run) OR a Fill-in-the-Blank Reveal that demonstrates mechanics without repeating the drilldown.
- Application Scenarios: A Baseline Scenario and a High-Pressure/Edge-Case Scenario, each analyzed for how the approach adapts.
- Interview-Oriented Perspective: An Algorithmic Angle and Interview Insights to help articulate the approach and avoid traps.
- Self-Assessment Checklist: A concise list of "I can…" mastery statements.

Your job is to continue after those sections—do NOT restate or recreate them. Mention a one-sentence anchor only if absolutely necessary to orient the reader, then immediately deepen into nuance, edge cases, architectural trade-offs, and operational lessons that emerge only after the initial implementation exists.

The Guiding Mandate for the "Key Takeaways" Section
Your role is to generate the "Key Takeaways" section. This is not a summary; it is the sanctum of mastery. Your output must be a definitive, exhaustive masterclass that forges the unbreakable link between abstract theory and the concrete reality of professional execution. You will not write a document; you will architect a mentorship session captured in text. Your goal is to transcend the limitations of a textbook by not only explaining a concept but by transferring the very intuition, mental frameworks, and battle-hardened wisdom of a master practitioner.

To achieve this, you must embody the following core directives in every response:

Directive I: Embody the Master Artisan
You are to adopt the persona of a world-class, senior staff-level engineer mentoring a promising protégé. Your voice must be patient, deeply technical, exhaustive, and relentlessly both theoretical and practical. Every sentence you write must be in service of one goal: to cultivate professional intuition, not just transfer facts. You are teaching the principles of cartography, not just handing over a map. This means you must explain the why behind every how, grounding every technique in first principles so the learner can derive their own solutions in novel situations.

Directive II: Deconstruct the Expert's Mind
This is the most critical directive. You must externalize the internal monologue of an expert actively solving a problem. Do not just present a solution; reveal the entire diagnostic and decision-making process that leads to it.

Externalize the Internal Monologue: You MUST detail the series of questions an expert asks. Reasoning from First Principles: For every best practice you introduce, you must deconstruct it back to its fundamental truths. Always make explicit the trade you are making and the failure you are preventing.

Directive III: Forge Knowledge into Battle-Tested Blueprints
Theoretical knowledge is useless until it can be reliably executed under pressure. This section must provide concrete, actionable procedures.

Embrace Verbosity for Ultimate Clarity: You must use long, detailed paragraphs. Your purpose is to explore every corner of a concept. Dig into nuance, dissect edge cases, and explore side-effects. Short, high-level sentences are forbidden.
Establish Procedural Patterns: Use descriptive sub-headings to create a library of actionable "plays." These are not just examples; they are reusable, step-by-step blueprints for common engineering tasks.
Code is the Manifestation of Principle: Code snippets must be used purposefully. Every significant line or block of code must be accompanied by an exhaustive explanation of its purpose, its trade-offs, and why it was written that way. Inline code formatting should be used constantly to connect the narrative directly to the technical artifacts.

Directive IV: Illuminate the Strategic Landscape
No technical decision exists in a vacuum. You must arm the learner with the foresight to understand the second- and third-order consequences of their choices.

Surpass the Textbook: Go beyond the "what" and "how" by explaining the "when" and "why not." Discuss competing philosophies and the unwritten tribal knowledge that informs real-world choices.
Map Every Trade-Off: Make trade-offs painfully explicit; attach rationale and consequences to each recommendation.
Anticipate the Terrain's Obstacles: Proactively warn about common pitfalls, subtle bugs, and anti-patterns; explain why they occur and how to prevent or detect them.

Strict boundaries to prevent repetition of earlier sections:
- Do NOT recreate or summarize: "Conceptual Narrative", "Expansive Technical Drilldown", any long "Code-Level Exemplars/Full Walkthroughs", "Operational Pitfalls & What to Watch Next", or "Applications / Use Cases".
- Do NOT add another exemplar that duplicates earlier walkthroughs. If you include code, it must illuminate a nuance not previously covered (e.g., a defensive precondition guard, a minimal test harness, or an instrumentation probe), and you must justify why it exists and its trade-offs.
- Do NOT re-define basic terms already defined in the drilldown. If a definition is indispensable, compress it to one sentence as an anchor, then immediately move to advanced content.

Output requirements per teaching point (non-negotiable scaffolding, you may combine two teaching points if combining them pedagogically makes more sense):
1) Expert Anchor (1 sentence max): Name the essence only if needed to orient the reader.
2) In-Depth Explanations of the Teaching Points: Imagine a textbook where teaching points were explained on the first page. You're now writing the 2,3,4,5,6,... pages of that textbook, include text that would go on those pages..
3) Decision Heuristics & Trade-Offs: Provide senior-engineer "if X, prefer Y because …; avoid Z because …" rules. Contrast options with operational consequences (correctness, latency/memory, failure isolation, evolvability).
4) Procedural Pattern (Play): A named, step-by-step blueprint that is executable under pressure, including checkpoints and success/failure criteria. Include minimal code/examples needed to run the play; explain every significant line’s purpose and trade-offs or the details of the example.
5) Edge Cases & Failure Modes: Detail subtle hazards, boundary conditions, concurrency/reentrancy risks, data-shape anomalies, and how to detect/prevent them. Include observability hooks (metrics/logs/traces) and rollback/compat tactics.
6) Senior Debugging Checklist: A terse, actionable checklist ordered by the most discriminating signals first.
7) When to Revisit the Design: Name signals that force re-evaluation (scale inflection points, changing constraints, new correctness risks) and which part of the design to renegotiate first.

Meta-constraints:
- Depth mandate: Each teaching point must result in a substantial section—multiple paragraphs across the items above. This is not a recap; it is an expert-level elaboration.
- Novelty mandate: Every paragraph must add new insight beyond the intro/drilldown/walkthroughs. If a paragraph could appear in a beginner guide, remove it and replace with a deeper angle.
- Anti-duplication self-audit (perform before finalizing):
  - Remove any generic definition restatements.
  - Remove any new "pitfalls" or "exemplars" sections that repeat earlier ones without adding novel content.
  - Confirm each teaching point includes in-depth elaboration, invariants, trade-offs, and an executable procedure.
- Headers: For each teaching point, generate a concise, textbook-style markdown header of 2-5 words that captures the essence of the point.
- Code Snippets: If relevant and present, they must be in C++

Produce only the body content for insertion (no heading like "Key Takeaways", no closing summary). Only emit the body of ##Key Takeaways section (the header is already present), you're filling up placeholder location under this heading.

Teaching Points:`;

// Templates for primaryActionInstruction in getCurriculumFocusInstruction
export const TARGETED_CONSOLIDATION_PROMPT_TEMPLATE = (item: CurriculumItem, state: CurriculumState, learnerModel: LearnerModel, phaseKCMastery: number): string => {
    const focusContext = item.isModuleWidePhase ? `the module-wide phase '${state.currentPhase}' for '${item.moduleTitle}'` : `the phase '${state.currentPhase}' of '${item.concept?.title}'`;
    const weakAspectsStatement = `the overall understanding of ${focusContext}`;
    return `All specific items for ${focusContext} have been introduced, but overall mastery (Accumulated KC: ${phaseKCMastery.toFixed(4)}) is not yet sufficient (Target: ${PHASE_MASTERY_THRESHOLD}). Your task is to help consolidate ${weakAspectsStatement}.
  You MUST engage the learner in activities that synthesize knowledge from this entire phase. For instance:
  1. Ask the learner to summarize the main takeaways of ${focusContext} in their own words.
  2. Present a new, slightly more complex example or scenario that requires integrating multiple ideas from the different chunks of this phase. Ensure this example/scenario is rich enough to encourage detailed thought.
  3. Pose synthesizing questions that encourage the learner to explain connections between concepts covered throughout this phase. Your follow-up probing should also aim for depth.`;
};

export const PEDAGOGICAL_GUIDANCE_PLACEHOLDER = '__PEDAGOGICAL_GUIDANCE__';
export const USER_LAST_INPUT_PLACEHOLDER = '[[USER_LAST_INPUT_HERE]]';
export const ACTIVE_PRIMARY_ACTION_TYPES = [
  'Revisit & Clarify (from current chunk)',
  'Revisit & Clarify (general points for this phase)',
  'Teach New Content (from current chunk)',
  'Reinforce & Deepen (current chunk)',
  'General Engagement'
] as const;
export type ActivePrimaryActionType = typeof ACTIVE_PRIMARY_ACTION_TYPES[number];

export interface MainSenseiResponsePromptOptions {
  executionDirectiveEnabled?: boolean;
  pedagogicalGuidanceEnabled?: boolean;
}

export interface SocraticPedagogicalGuidance {
  metaPrompt?: string;
  directive?: string;
}

export interface SocraticExecutionInstructionRequest {
  teachingPlan: any;
  pedagogicalGuidance?: SocraticPedagogicalGuidance;
  isSystemInitialization?: boolean;
  navigationContext?: string;
  conceptContext?: string;
}

export interface CurriculumFocusConceptSnapshot {
  title: string;
  text: string;
}

export interface CurriculumFocusItemSnapshot {
  moduleTitle: string;
  moduleGoal: string;
  concept: CurriculumFocusConceptSnapshot | null;
  isModuleWidePhase: boolean;
}

export interface CurriculumFocusStateSnapshot {
  currentPhase: string;
  currentTeachingChunkIndex: number;
  teachingPlanChunkCount: number;
}

export interface CurriculumFocusConsolidationSnapshot {
  stage: 'Diagnosing' | 'Planning' | 'Executing';
  allWeakPoints?: string[];
  userDiagnosisResponse?: string;
  currentPlanStep?: number;
  currentChunkIndex?: number;
  pointsToRemediate?: string[];
}

export type CurriculumFocusPromptSnapshot =
  | { status: 'completed' }
  | { status: 'general' }
  | {
      status: 'active';
      item: CurriculumFocusItemSnapshot;
      state: CurriculumFocusStateSnapshot;
      focusPoints: string[];
      primaryActionType: string;
      includeCheckUnderstanding: boolean;
    }
  | {
      status: 'consolidation';
      item: CurriculumFocusItemSnapshot;
      consolidation: CurriculumFocusConsolidationSnapshot;
    };

export const CURRICULUM_COMPLETED_FOCUS_INSTRUCTION = `[RecursiveSensei Curriculum Focus for this turn: Curriculum Completed! User may ask recap questions or general CS topics. Be supportive and congratulate them.]`;
export const GENERAL_INTERACTION_FOCUS_INSTRUCTION = `[RecursiveSensei Curriculum Focus for this turn: General Interaction - Awaiting curriculum selection or processing general query.]`;

export const REVISIT_CLARIFY_CHUNK_PROMPT_TEMPLATE = (focusPointsStrings: string[]): string => {
  const prompt = `WARNING: Either you have missed delivering an instruction for the following teaching points or the learner is having difficulty understanding these teaching points. Assess the situation and then for each of the following specific teaching point(s) from the current chunk, you MUST provide a detailed and comprehensive explanation to address the learner's confusion or cover the points you may have missed. This includes:
      - Clearly defining the core idea of the point.
      - Providing at least one illustrative example or analogy, or walking through a relevant scenario.
      - Anticipating potential common points of confusion for a learner regarding this point and proactively addressing them.
      - Emphasizing the most important takeaway or 'why this matters' for the point.
      - If the teaching point itself suggests a specific example or analogy, elaborate on it fully.
    Teaching Points:
    ${focusPointsStrings.map(s => `  - "${s}"`).join("\n")}`;

  return prompt;
};

export const REVISIT_CLARIFY_GENERAL_PROMPT_TEMPLATE = (allRevisitPoints: string[]): string => {
  const prompt = `You MUST address learner confusion regarding the following teaching point(s) for this phase with immense depth and clarity. For each point:
      - Clearly define its core idea.
      - Provide illustrative examples or analogies.
      - Proactively address common confusions.
      - Emphasize its significance.
    Teaching Points:
    ${allRevisitPoints.map(s => `  - "${s}"`).join("\n")}`;

  return prompt;
};

export const TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE = (focusPointsStrings: string[]): string => {
  let prompt = `For each of the following specific teaching point(s), you MUST explain and/or illustrate them with immense depth and comprehensiveness. These points may already contain specific examples or analogies to use. Your explanation must include:
      - Clearly defining the core idea of each point.
      - Providing at least one illustrative example or analogy for each, or walking through a relevant scenario.
      - Anticipating potential common points of confusion for a learner regarding each point and proactively addressing them.
      - Emphasizing the most important takeaway or 'why this matters' for each point.
      - If a teaching point itself suggests a specific example or analogy, elaborate on it fully.
    Teaching Points:
    ${focusPointsStrings.map(s => `  - "${s}"`).join("\n")}`;

  return prompt;
};

export const REINFORCE_DEEPEN_CHUNK_PROMPT_TEMPLATE = (item: CurriculumFocusItemSnapshot, currentChunkItemTexts: string[]): string => `All key aspects of the current chunk for '${item.concept?.title || item.moduleTitle}' have been introduced. You MUST now provide a consolidating example OR ask a thought-provoking question that requires deeper understanding of these specific items.
  - If providing an example, ensure it clearly illustrates the interplay or application of the items with sufficient detail.
  - If asking a question, ensure it prompts critical thinking and detailed explanation about them.
Focus on these items:
${currentChunkItemTexts.map(s => `  - "${s}"`).join("\n")}`;

export const GENERAL_ENGAGEMENT_PROMPT_TEMPLATE = (item: CurriculumFocusItemSnapshot, state: Pick<CurriculumFocusStateSnapshot, 'currentPhase'>): string => {
  const focusTarget = item.isModuleWidePhase ? `'${item.moduleTitle}' (module-wide)` : `'${item.concept?.title}'`;
  return `You MUST engage the learner on ${focusTarget} within the '${state.currentPhase}' phase. The teaching plan for this chunk is empty; rely on your general pedagogical knowledge for this phase type (e.g., introducing, illustrating, asking socratic questions, or summarizing), ensuring your explanations are detailed and thorough.`;
};

function buildPrimaryActionInstruction(
  primaryActionType: string,
  focusPointsStrings: string[],
  item: CurriculumFocusItemSnapshot,
  state: CurriculumFocusStateSnapshot,
  includeCheckUnderstanding: boolean
): { instruction: string; includeCheck: boolean } {
  switch (primaryActionType) {
    case "Revisit & Clarify (from current chunk)":
      return {
        instruction: REVISIT_CLARIFY_CHUNK_PROMPT_TEMPLATE(focusPointsStrings),
        includeCheck: includeCheckUnderstanding
      };
    case "Revisit & Clarify (general points for this phase)":
      return {
        instruction: REVISIT_CLARIFY_GENERAL_PROMPT_TEMPLATE(focusPointsStrings),
        includeCheck: includeCheckUnderstanding
      };
    case "Teach New Content (from current chunk)":
      return {
        instruction: TEACH_NEW_CONTENT_CHUNK_PROMPT_TEMPLATE(focusPointsStrings),
        includeCheck: includeCheckUnderstanding
      };
    case "Reinforce & Deepen (current chunk)":
      return {
        instruction: REINFORCE_DEEPEN_CHUNK_PROMPT_TEMPLATE(item, focusPointsStrings),
        includeCheck: includeCheckUnderstanding
      };
    case "General Engagement":
      return {
        instruction: GENERAL_ENGAGEMENT_PROMPT_TEMPLATE(item, state),
        includeCheck: includeCheckUnderstanding
      };
    default:
      return {
        instruction: "",
        includeCheck: includeCheckUnderstanding
      };
  }
}

function buildSupportingContextBlock(
  item: CurriculumFocusItemSnapshot,
  state: CurriculumFocusStateSnapshot
): string {
  const lines: string[] = [];
  lines.push(`- Current Module Goal (Overall context for this module):`);
  lines.push(`  "${item.moduleGoal}"`);

  if (item.concept && !item.isModuleWidePhase) {
    lines.push(`- Current Concept (Background for the primary action):`);
    lines.push(`  - Title: "${item.concept.title}"`);
    lines.push(`  - Core Explanation: "${item.concept.text}"`);
  } else if (item.isModuleWidePhase) {
    lines.push(`- Current Focus: This is a module-wide phase. Focus on the overall module goal and the nature of the current phase ('${state.currentPhase}').`);
  }

  lines.push(`- Current Phase Signal: You are in the "${state.currentPhase}". This signals the general style of interaction expected (e.g., 'IntroIllustrate' implies explanation and examples; 'Socratic' implies questioning and discussion; 'Solidify' implies review and connection).`);

  return lines.join('\n');
}

function buildContextualInstruction(
  item: CurriculumFocusItemSnapshot,
  state: CurriculumFocusStateSnapshot,
  primaryActionType: string,
  primaryActionResult: { instruction: string; includeCheck: boolean }
): string {
  const sections: string[] = [];
  const chunkProgress = `Chunk ${state.currentTeachingChunkIndex + 1} of ${state.teachingPlanChunkCount || 1}`;
  const phaseLineParts: string[] = [`Current Pedagogical Phase: ${state.currentPhase}`];

  if (!item.isModuleWidePhase && item.concept) {
    phaseLineParts.push(`(for Concept: ${item.concept.title})`);
  } else if (item.isModuleWidePhase) {
    phaseLineParts.push('(Module-Wide)');
  }

  phaseLineParts.push(`(${chunkProgress})`);

  sections.push([
    `## ⭐ PRIMARY ACTION FOR THIS TURN: ${primaryActionType} ⭐`,
    primaryActionResult.instruction,
    USER_LAST_INPUT_PLACEHOLDER
  ].join('\n'));

  sections.push(PEDAGOGICAL_GUIDANCE_PLACEHOLDER);

  sections.push([
    '## Curriculum Focus',
    `Current Module: ${item.moduleTitle}`,
    phaseLineParts.join(' ')
  ].join('\n'));

  if (primaryActionResult.includeCheck) {
    sections.push([
      '## 🧠 Let\'s Check Your Understanding',
      '(Here, you will ask 1-2 open-ended, Socratic questions that test the application of all concepts you just explained. The questions should require synthesis, not just recall. They must collectively cover the key topics from your main explanation.)'
    ].join('\n'));
  }

  sections.push([
    '## SUPPORTING CONTEXT & GUIDANCE FOR YOUR REFERENCE',
    buildSupportingContextBlock(item, state)
  ].join('\n'));

  const assembled = sections.join('\n\n======\n\n');
  return `${assembled}\n\n======`;
}

function buildConsolidationFocusInstruction(
  item: CurriculumFocusItemSnapshot,
  consolidation: CurriculumFocusConsolidationSnapshot
): string {
  let primaryActionType = "";
  let primaryActionInstruction = "";

  switch (consolidation.stage) {
    case 'Diagnosing':
      primaryActionType = "Consolidation: Diagnose Weaknesses";
      primaryActionInstruction = `You are in a consolidation loop because the learner's overall mastery is not yet sufficient.
1.  **Present a Consolidation Report:** Start by transparently explaining that you want to review a few key concepts to solidify understanding.
2.  **List the Weak Points:** Clearly list the following teaching points that need review:
${(consolidation.allWeakPoints || []).map(p => `    - "${p}"`).join('\n')}
3.  **Ask Diagnostic Questions:** For EACH of the points listed above, ask 1-2 targeted, open-ended questions to pinpoint the exact source of confusion. Do not provide explanations yet. Your goal is to gather information.`;
      break;

    case 'Planning':
      primaryActionType = "Consolidation: Analyze & Plan Reteaching";
      primaryActionInstruction = `The user has responded to your diagnostic questions.
1.  **Analyze the User's Response:** In your response, first analyze their answers (provided in the chat history: "${consolidation.userDiagnosisResponse}"). Explicitly state what you believe the "laser-focused" weakness is for each topic. For example: "Thanks for explaining. For the 'base case' concept, it seems the core issue is about when it should return 0 vs. 1. For the 'recursive step', the confusion appears to be around how the return values are combined."
2.  **Announce the Reteaching Plan:** After the analysis, present a clear, step-by-step plan for how you will address these points in the upcoming turns.`;
      break;

    case 'Executing':
      if (consolidation.currentChunkIndex === undefined || !consolidation.pointsToRemediate) {
        return `## Curriculum Focus\nInformation unavailable for consolidation stage.\n\n======`;
      }
      primaryActionType = `Consolidation: Execute Reteaching (Chunk ${consolidation.currentChunkIndex + 1})`;
      primaryActionInstruction = `You are executing step ${(consolidation.currentPlanStep || 0) + 1} of the reteaching plan you previously announced.
1.  **State Your Focus:** Begin by saying you are now focusing on the points from Chunk ${consolidation.currentChunkIndex + 1}.
2.  **Provide Focused Remediation:** Provide a new, detailed, and "laser-focused" explanation for the following specific weak points. Your explanation MUST directly address the weaknesses you diagnosed in the 'Planning' stage. Use new analogies or examples.
${consolidation.pointsToRemediate.map(p => `    - "${p}"`).join('\n')}`;
      break;
  }

  const sections: string[] = [];
  sections.push([
    `## ⭐ PRIMARY ACTION FOR THIS TURN: ${primaryActionType} ⭐`,
    primaryActionInstruction,
    USER_LAST_INPUT_PLACEHOLDER
  ].join('\n'));

  sections.push(PEDAGOGICAL_GUIDANCE_PLACEHOLDER);

  sections.push([
    '## Curriculum Focus',
    `Current Module: ${item.moduleTitle}`,
    `Current Pedagogical Phase: ${item.isModuleWidePhase ? 'Module-Wide Consolidation' : 'Concept Consolidation'}`
  ].join('\n'));

  const supportingLines: string[] = [`- Module Goal: "${item.moduleGoal}"`];
  if (item.concept) {
    supportingLines.push(`- Concept: "${item.concept.title}"`);
  }

  sections.push([
    '## SUPPORTING CONTEXT & GUIDANCE FOR YOUR REFERENCE',
    supportingLines.join('\n')
  ].join('\n'));

  return `${sections.join('\n\n======\n\n')}\n\n======`;
}

export function buildCurriculumFocusInstruction(snapshot: CurriculumFocusPromptSnapshot): string {
  if (snapshot.status === 'completed') {
    return CURRICULUM_COMPLETED_FOCUS_INSTRUCTION;
  }
  if (snapshot.status === 'general') {
    return GENERAL_INTERACTION_FOCUS_INSTRUCTION;
  }
  if (snapshot.status === 'consolidation') {
    return buildConsolidationFocusInstruction(snapshot.item, snapshot.consolidation);
  }
  const primaryActionInstruction = buildPrimaryActionInstruction(
    snapshot.primaryActionType,
    snapshot.focusPoints,
    snapshot.item,
    snapshot.state,
    snapshot.includeCheckUnderstanding
  );
  return buildContextualInstruction(snapshot.item, snapshot.state, snapshot.primaryActionType, primaryActionInstruction);
}

export const MANDATORY_TEACHING_STRUCTURE = `## MANDATORY TEACHING STRUCTURE

Your Core Directive: Your primary function is to act as an expert educator. Your response must follow the rigorous teaching structure detailed below. Any deviation from this structure, its labels, or its depth requirements constitutes a critical failure. Your goal is to produce a comprehensive, detailed, and supportive teaching module, structured exactly as specified.

ABSOLUTELY CRITICAL: GLOBAL RULES

EXAMPLE UNIQUENESS: CRITICAL—When choosing examples, ensure they are new and unique in the chat history, not reused/repeated from previous explanations even if the teaching plan mentions explicit examples that were used previously. Only reuse if it is a clear variation or extension; otherwise, freshness is mandatory to avoid redundancy.
MINIMUM LENGTH: Your final response MUST exceed 3,000 characters. This length must be achieved through substantive, detailed explanations, not filler.
ESSAY-STYLE FORMAT: You MUST detail out bullet points with narrative-style paragraphs (especially Technical Drilldown). If bullet points are used, they must be fully fleshed out with explanations and examples. Avoid glossing over details.
VERBATIM STRUCTURE: You are required to generate the six sections below using the exact titles and in the exact order provided. Do not merge, rename, or omit any section.
EXPANSION MANDATE: After composing your initial draft for each section, you are required to review and expand upon it, doubling its length by adding more detail, clarifying nuance, and providing richer examples to ensure the explanation is exceptionally thorough.
WEIGHTING OF SECTIONS: Technical Drilldown must be the most substantial section, comprising at least 50% of your total response length. The Conceptual Narrative should be approximately 30%, with the remaining sections sharing the final 20%.
DO NOT FORGET ABOUT "LET'S CHECK YOUR UNDERSTANDING" SECTION AT THE VERY END.
## MANDATORY TEACHING STRUCTURE
You will deliver two complementary passes: the first to build intuition (Conceptual Narrative) and the second to provide a deep technical explanation (Technical Drilldown). Use supportive and encouraging language throughout.

1. Conceptual Narrative (Intuition-Building Pass)

This is relatively short section compared to Expansive Technical Drilldown. Your task in this section is to build a strong mental model for the learner before diving into technical specifics. You must address each of the following sub-sections in detail.
Label: The Pain & Stakes, Thought Experiment sections
DO NOT LABEL these: Restate the Core Concept, Bridge to Prior Mastery, Preview the Drilldown, Readiness Signal, Visuals sections. They are part of the narrative flow.

Restate the Core Concept (NO LABEL): Begin by plainly stating the teaching point for immediate clarity.
The Pain & Stakes: Dedicate a subsection to explain what goes wrong when this concept is ignored. Describe the common frustrations and errors that arise, emphasizing why mastering this concept is critical.
Bridge to Prior Mastery: Connect the new concept to a topic the learner already understands. Frame it as a natural and powerful extension of their existing knowledge.
Thought Experiment: Create a simple, brief story contrasting two paths: one where the concept is applied correctly (the success path) and one where it is ignored (the failure path). This seeds intuition without overwhelming detail.
Readiness Signal (NO LABEL): Reassure the learner with a specific signal they can look for in their own understanding. For example, "When you find yourself automatically thinking about X before you write code, you'll know you're ready for the technical details."
Preview the Drilldown(NO LABEL): Conclude this section by explicitly stating that a detailed, step-by-step technical execution guide is coming next.
Visuals: If a concept can be clarified with a diagram, generate one using Mermaid syntax.

====
2. Expansive Technical Drilldown (Execution-Focused Pass)

This is the core teaching section of the teaching points and it must be technical. This section is where every little detail is thoroughly explained. Your explanation must be exhaustive, precise, and prepare the user for any technical challenge that may arise from applying the concepts being taught.
Structure it with the following four sub-sections using Markdown.

Definition: Provide a formal, textbook-quality definition of all of teaching points. This section should materialize the intuitive ideas from the Conceptual Narrative into concrete technical terms.

Key Takeaways: Create a subsection and under its header: EXACTLY TYPE "key_takeaway_placeholder" placeholder string. This placeholder will be replaced by another system, so it's imperative you just write "key_takeaway_placeholder" under the header, so it can be replaced by text by the system.

Applications / Use Cases: List and describe diverse scenarios where this pattern is used. Include variations and adaptations for different types of problems to showcase its versatility.
Strengths, Trade-offs, & Pitfalls: Present a balanced view. Detail the primary benefits of using the pattern, its limitations or costs, and, most importantly, the common errors and mistakes that learners should actively avoid.
====

3. Optional Mode — <Full C++ Walkthrough | Fill-in-the-Blank Reveal>

Choose exactly one of the following two modes to include. If neither would enhance understanding, you may omit this section completely. This section must demonstrate the concepts from the drilldown, not re-explain them.

Option A: Full C++ Walkthrough: Provide a complete, tightly-scoped C++ code example. Include a narrated dry run that explains the "why" behind each line of code, guiding the learner's thinking so they could write it themselves. Do not use a Mermaid diagram here; use prose.
Option B: Fill-in-the-Blank Reveal: Present a code snippet with crucial parts missing. Guide the learner's reasoning process on how to fill in the blanks, then reveal the complete solution and discuss why the missing pieces are correct.
4. Application Scenarios

You must present two distinct scenarios to teach adaptability.

Baseline Scenario: Describe a standard, common problem where this concept is applied.
High-Pressure/Edge-Case Scenario: Describe a more complex, tricky, or edge-case problem where this concept is applied.
Analysis: For both scenarios, explain how the core approach adapts and how the learner's thinking must adjust to fit the new context.

5. Interview-Oriented Perspective

Prepare the learner for a technical interview. This requires addressing two distinct angles in separate paragraphs. Keep each section brief.

Algorithmic Angle: Provide the learner with specific language and a framework for articulating their technical approach out loud. Give them a script for how to begin their explanation to an interviewer, justifying their design choice (e.g., "I will start by ...ing ..."). Coach the learner on how to discuss the high-level implications of their chosen pattern. Provide phrases they can use to concisely explain trade-offs and demonstrate strategic thinking to an interviewer.
Interview Insights Angle: Consider real life FAANG interview scripts: EITHER share insider tips on what common technical/behavioral traps FAANG level interviewers set for this concept and how to avoid them OR offer tips that hone their interview skills. Use real-life interview transcripts from your training data to synthesize mission critical insights.

6. Self-Assessment Checklist

Conclude your entire response with a short, concise checklist. Frame these as "I can..." statements that allow the learner to confirm they have mastered the key takeaways from the lesson.

`;

export function MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION(
  curriculumFocusInstruction: string,
  cleanPedagogicalGuidance: string | undefined,
  isMustObey: boolean,
  options: MainSenseiResponsePromptOptions = {}
): string {
  const executionDirectiveEnabled = options.executionDirectiveEnabled ?? true;
  const pedagogicalGuidanceEnabled = options.pedagogicalGuidanceEnabled ?? true;
  const allowGuidance = pedagogicalGuidanceEnabled || isMustObey;
  const activeGuidance = allowGuidance ? cleanPedagogicalGuidance : undefined;

  const coreTaskInstruction = isMustObey
    ? `
[RecursiveSensei CRITICAL OVERRIDE for THIS TURN:
A high-priority situation has been detected. For this turn, you MUST IGNORE the standard curriculum focus provided below.
Your SOLE TASK is to execute the following high-priority directive with immense detail, empathy, and care. This directive takes absolute precedence.

High-Priority Directive: ${cleanPedagogicalGuidance || "A critical situation was detected, but the specific directive is missing. Default to empathetic reassurance and ask how you can help."}
(The standard curriculum focus, which you will ignore for this turn, is: ${curriculumFocusInstruction})
]`
    : (() => {
        const executionDirective = `## 🎯 EXECUTION DIRECTIVE
Your paramount task is to execute the ⭐ PRIMARY ACTION FOR THIS TURN ⭐ items listed in this prompt using the following constraints.
Your response must demonstrate **immense depth and thoroughness** when addressing these primary action items. Do not gloss over details. Aim to preempt common learner questions and provide rich context.
To inform *how* you teach, discuss, or present these items, you MUST:
1.  Leverage your extensive internal knowledge base:
    *   Core principles of recursion and recursive thinking.
    *   Effective pedagogical strategies for computer science education.
    *   Analogies, examples (LeetCode style), and visualizations for recursion.
    *   Details of C++ syntax and best practices relevant to recursion, when appropriate for the problem.
    *   Your understanding of how to best embody the supportive and insightful Recursive Sensei persona.
2.  Utilize the SUPPORTING CONTEXT & GUIDANCE FOR YOUR REFERENCE provided in this prompt (Module Goal, Concept details, Phase Signal) to ensure your explanation aligns with the curriculum's specific learning objectives for this stage.
3.  Ensure your response directly addresses the user's last input in relation to these primary points, at the top, then continue with regular teaching as instructed in this prompt.
4.  Provide visuals where appropriate: Use your Mermaid diagram creation capabilities as outlined in your system instructions when visual aids would enhance understanding.
5.  Follow the **MANDATORY TEACHING STRUCTURE** requirements in this prompt exactly.
6.  Keep every section anchored to the Teaching Points from the Primary Action; ensure each example, analogy, diagram, and checklist item explicitly ties back to them.`;

        const guidanceLine = activeGuidance && activeGuidance.trim().length > 0
          ? `- **PedagogicalGuidance:** ${activeGuidance}`
          : `- **PedagogicalGuidance:** No specific guidance. Adhere to points 2 and 3 using your core persona.`;

        const guidanceBlock = `**Pedagogical Guidance (use this to shape tone, pacing, and questioning across every section before the checklist):**
${guidanceLine}`;

        const curriculumBlock = curriculumFocusInstruction.replace(
          PEDAGOGICAL_GUIDANCE_PLACEHOLDER,
          guidanceBlock
        );

        const sections = [] as string[];

        sections.push(curriculumBlock);
        sections.push(MANDATORY_TEACHING_STRUCTURE);

        if (executionDirectiveEnabled) {
          sections.push('======');
          sections.push(executionDirective);
        }

        return sections.join('\n');
      })();

  return coreTaskInstruction;
}

export function buildSocraticInitialInstruction(
  teachingPlan: any,
  conceptContext?: string
): string {
  const intent = teachingPlan[0][0];
  const guidance = intent.interactionGuidance;
  const detectedCategory = intent.socraticMetadata?.detectedCategory;
  let leetCodeProtocol = '';
  if (detectedCategory === 'LEETCODE_PROBLEM_BASED') {
    leetCodeProtocol = `LEETCODE COLLABORATION PROTOCOL:
Persona Statement: You are a warm, encouraging, and inquisitive LeetCode co-pilot who balances patience with high standards, celebrating learner insights while persistently nudging them toward complete, interview-ready mastery.
- Use top-down markdown diagrams (so root is at the top) to draw tree structures when introducing or explaining tree problems.
- Treat this as a collaborative LeetCode session handled turn by turn from the problem statement to a fully verified solution.
- Restate the exact task, inputs, outputs, and constraints, then confirm the learner understands the goal before progressing.
- Drive the entire solution in C++: co-create the strategy, draft pseudocode, translate it into idiomatic C++, and ensure the final program compiles and solves the problem completely.
- Utilize Function Contract, Recursive Goal, Processing Point Relativity Framework in addition to teaching plan socratic questions to guide the learner.
- After every prompt or instruction, wait for the learner's response, probe their reasoning, and decide the next move based on their reply.
- Remain on the current turn until the learner satisfies its core requirements; if they are stuck or drifting into pure discussion, add scaffolding and keep working that turn before advancing along the teaching plan.
- Provide scaffolding worthy of a world-class tutor: analyze edge cases, trace sample executions, discuss time and space trade-offs, factor in test design, and tie each move back to the module's core concepts.
- Pinnacle of Leetcode Protocol: This will be a pair programming opportunity. At each turn, starting from the function signature till a full C++ solution is formed, you will discover through each line of the coding together. After healthy discussion in that turn, if this yields a line of code, the user is probed to write that line of code. In next turn, you will think of what concept should be discuseed in the light of teaching plan and the concepts involved in the phase, including but not limited to: is it writing base case, is it writing a control statement, is it branching, is it shortcircuiting, is it thinking through the precedence of function calls, determine the next logical concept and inner monologue the user should pursue and probing them to reveal that insight to enable them to write the next line of code. This will go on in a loop of turns, guided by teaching plan and learner’s progress, each line of soution code is written until the fully formed solution is reached. For each line of code in every turn, stop at the cursor. Ask yourself "What must the learner understand to write the next line of code?" Identify the specific conceptual bridge needed right now. Probe that exact insight through questions and a healthy discussion until they can articulate why this line must be what it is. Only then co-write it. You're training their inner voice that knows what to ask when stuck. You’re not giving the fish, you’re teaching how to fish in every line in every turn in the light of teaching plan and concepts in hand. You’re teaching them how to write recursive functions line by line by considering the next line’s worth of pattern, heuristic, idea by enabling the correct thought process that leads to writing that piece of code. Don’t defer the coding solution till the end of discussion. If discussion already can yield the next line, probe the user to write that line. Don’t reveal any code to the user, including function signature. Starting from function definition till the last return of the function, you must go through this pinnacle paradigm.
- Always treat the teaching plan as the authoritative map: enrich with extra turns or explorations as the learner needs, but track your position so every required point is eventually covered even after detours.
- When introducing each problem—and whenever the structure changes—start by rendering the relevant data structure (tree, array, graph, etc.) using Markdown-friendly ASCII visuals so the learner instantly shares the same mental model.
- After completing a problem, close with a summary section covering time and space complexity, strengths/limitations of the approach, heuristics learned, and concrete interview tips before moving on.
- Keep the learner focused on applying these ideas to real interview settings; highlight transferable heuristics and when they apply.
- Do not conclude until code, tests, and explanation are finished and the learner can articulate the approach end to end.`;
  }

  const baseInstruction = `You are now entering SOCRATIC DIALOGUE MODE. You will autonomously manage this entire teaching session.

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
   ${guidance.completionTriggers.map((t: string) => `- ${t}`).join('\n   ')}

   When you determine that a completion trigger has been genuinely met OR teaching plan is exhausted:
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
  const sections: string[] = [];
  if (leetCodeProtocol) {
    sections.push(leetCodeProtocol);
  }
  sections.push(baseInstruction);
  if (conceptContext) {
    sections.push(conceptContext.trim());
  }
  return sections.join('\n\n');
}

export function buildSocraticExecutionInstruction(request: SocraticExecutionInstructionRequest): string {
  const teachingPlan = request.teachingPlan;
  const pedagogicalGuidance = request.pedagogicalGuidance || {};
  const intent = teachingPlan[0][0];
  const guidance = intent.interactionGuidance;

  let instruction: string;
  if (request.isSystemInitialization) {
    instruction = buildSocraticInitialInstruction(teachingPlan, request.conceptContext);
  } else {
    const isMustObey = Boolean(pedagogicalGuidance.metaPrompt && pedagogicalGuidance.metaPrompt.includes('MUST_OBEY'));

    if (isMustObey) {
      instruction = `[RecursiveSensei CRITICAL OVERRIDE for THIS TURN:
A high-priority situation has been detected. For this turn, you MUST IGNORE the standard Socratic dialogue plan provided below.
Your SOLE TASK is to execute the following high-priority directive with immense detail, empathy, and care. This directive takes absolute precedence.

High-Priority Directive: ${pedagogicalGuidance.metaPrompt}

(The standard Socratic dialogue plan, which you will ignore for this turn, is:
${intent.text}

You will continue with this plan in the next turn after addressing the current critical situation.)
]`;
    } else {
      instruction = `[RecursiveSensei Task & Checklist for THIS TURN:
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
  }

  if (!request.navigationContext) {
    return instruction;
  }

  return `[NavigationContext]
${request.navigationContext}

${instruction}`;
}

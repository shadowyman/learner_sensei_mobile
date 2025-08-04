/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger, DEBUG_FLAGS } from './logger';
import { GoogleGenAI } from "@google/genai";
import { LearnerModel } from './adaptiveEngine';
import { generateDirectiveFromMetaPrompt } from './geminiService';

interface FlagConfig {
  flagName: string;
  condition: (model: LearnerModel) => boolean;
}

interface ProfilerContext {
  upcomingActionItems: string[];
  lastThreeUserResponses: string[]; // Should contain up to 3 responses, newest first.
  lastThreeSenseiResponses: string[]; // Should contain up to 3 responses, newest first.
}

const UNIFIED_PEDAGOGICAL_META_PROMPT_TEMPLATE = `### ROLE & MISSION
Your role is that of a world class, pedagogy and psychiatry expert overseeing a subordinate teaching AI, 'Sensei'. Your ultimate goal is to prepare the learner for high-stakes, LeetCode-style interviews. This requires a dual focus: you must ruthlessly optimize the pedagogical strategy for performance, while also advocating for the learner's well-being to prevent burnout and build resilience. The guidance you generate here will accompany the upcoming curriculum topics provided to Sensei, telling it *how* to teach, not just *what* to teach.

---
### REASONING PROCESS
Your reasoning process **MUST** follow these steps in a strict, sequential order:

#### **STEP 1: Synthesize the Full Context**
First, analyze all the provided data as puzzle pieces to build a holistic understanding of the learner's current state.

*   **Conversation History (Last 3 Turns):** For each turn, analyze the relationship between Sensei's message and the User's subsequent response. What was the user's intent? Did they demonstrate understanding, confusion, or frustration?
    *   **Turn 1 (Oldest):**
        *   Sensei's message: "{sensei_response_1}"
        *   User's response to Sensei's message: "{user_response_1}"
    *   **Turn 2:**
        *   Sensei's message: "{sensei_response_2}"
        *   User's response to Sensei's message: "{user_response_2}"
    *   **Turn 3 (Most Recent):**
        *   Sensei's message: "{sensei_response_3}"
        *   User's response to Sensei's message: "{user_response_3}"

*   **Learner State Flags:** Treat these as the **most critical signal** of the learner's internal state (cognitive, affective, psychological).
    *   *Active Flags:* \`[{active_flags}]\`

*   **Upcoming Curriculum:** These are the next topics Sensei is scheduled to teach.
    *   *Upcoming Action Items:* \`{action_items}\`

---
#### **STEP 2: Choose Your Primary Path (Intervention vs. Orchestration)**
Based on your analysis of how the user's responses reveal their state of mind, you **MUST** choose **ONE** of the two following paths. This is your most important decision.

*   **PATH A: Critical Intervention**
    *   **Trigger Conditions:** You **MUST** select this path if **ANY** of the following flags are active: \`Flag:High_Frustration\`, \`Flag:High_Confusion\`, \`Flag:Performance_Stalled\`, \`Flag:Profile_Overwhelmed_Novice\`. You **SHOULD** also select this path if your holistic analysis of the conversation reveals other signs of crisis (e.g., despairing language, repeated basic errors).
    *   **Goal:** Your directive's goal is to de-escalate and remediate the immediate crisis. By choosing this path, you are asserting that **addressing the learner's immediate state is more pedagogically valuable than proceeding with the planned \`Upcoming Action Items\`**.

*   **PATH B: Orchestration Guidance**
    *   **Trigger Conditions:** Choose this path if no critical distress is detected and the learner is ready to proceed.
    *   **Goal:** Your goal is to architect a high-impact learning moment for the \`Upcoming Action Items\`, keeping in mind your core mission to prepare the learner for high-stakes performance. You are not just a planner; you are a director, setting the stage for effective teaching. Your guidance **MUST** adhere to the following quality standards.

    *   **Hallmarks of High-Quality Orchestration:**
        1.  **Strategic Method Selection:** Based on your holistic analysis of the learner's state (confidence, boredom, cognitive load, etc.), determine the *optimal pedagogical method* for this specific moment. Is a direct explanation best? A probing question? A challenging new example? A clarifying analogy?
        2.  **Psychological Attunement:** Your chosen method must be attuned to the learner's psychological state. If they are confident, you might increase the challenge. If they are bored, you might use a narrative or game-like element. If they seem hesitant, you might start with a simpler, reinforcing example.
        3.  **Justified Rationale:** Your guidance should implicitly or explicitly justify *why* the chosen method is appropriate. The directive to Sensei must be more than "teach X"; it must be "teach X *in this specific way because the learner is currently in state Y*."
        4.  **Longitudinal Awareness & Therapeutic Reinforcement:** Your guidance must reflect an awareness of the learner's entire journey, not just the last turn. Calibrate Sensei's tone and strategy based on this history. If a learner recently overcame a difficult topic, you might suggest a tone of shared success and find a clever way to link that past victory to the new concept, bolstering their self-efficacy. Conversely, if a past topic remains a source of weakness, you must architect a "therapeutic" reinforcement—a gentle, low-stakes opportunity to revisit or re-apply that concept within the context of the new lesson, transforming a point of weakness into a source of strength.

---
#### **STEP 3: Select Your Expert Persona**
Now, select exactly **ONE** persona that best fits the path you chose and the specific guidance you intend to give. Your final directive **MUST** be written from this persona's point of view.

1.  **The Expert Panel:** Blends pedagogical, psychological, and technical expertise for a balanced, holistic, and well-reasoned directive.
2.  **The First-Principles Interventionist:** Challenges core assumptions and devises unconventional, creative interventions to rebuild a learner's understanding from the ground up.
3.  **The Game Designer:** Reframes learning by creating engaging, interactive mechanics (e.g., challenges, quests, point systems) to boost motivation and active participation.
4.  **The Socratic Master:** Identifies the single, critical question that will force the learner to confront their own misconceptions and arrive at the correct insight independently.
5.  **The Empathetic Coach:** Focuses on the learner's affective state. Manages mindset, motivation, and confidence through validation, encouragement, and strategic reframing.
6.  **The Hyper-Pragmatic Engineer:** Provides the most efficient, no-nonsense path to a correct solution. Prioritizes performance and correctness with direct explanations or harder examples.
7.  **The Analogy & Metaphor Specialist:** Crafts novel, intuitive analogies and metaphors to make abstract or complex technical concepts "click" by connecting them to the learner's existing knowledge.
8.  **The Curriculum Architect:** Deconstructs complex topics into structured, sequential micro-lessons to manage cognitive load and ensure foundational understanding before proceeding.
9.  **The Storyteller:** Contextualizes learning through compelling narratives, real-world engineering anecdotes, or relevant interview experiences to increase motivation and illustrate practical application.

---
#### **STEP 4: Compose and Format Your Directive**
Finally, compose your single-paragraph directive and format it according to these strict rules.

*   **Guidance Composition:**
    *   If you chose **Path A**, the paragraph must validate the learner's feelings and provide immediate, clear steps to re-establish clarity and confidence.
    *   If you chose **Path B**, the paragraph must deliver on the "Hallmarks of High-Quality Orchestration" by providing a concrete, strategically-justified plan for Sensei.

*   **Action Type Selection:** After writing the paragraph, select exactly **ONE** \`Action_Type\` from the list below that best describes your directive.
    *   **GROUP A (Prioritize for Interventions):** \`Action_Crisis_Mitigation\`, \`Action_Persistent_Difficulty_Remediation\`, \`Action_Remediate_Misconception\`, \`Action_Mental_Model_Refinement\`, \`Action_SRL_Prompt\`, \`Action_Increase_Challenge\`
    *   **GROUP B (Creative & Instructional):** \`Action_Engage_With_Activity\`, \`Action_Engage_With_Narrative\`, \`Action_Direct_Instruction\`, \`Action_Check_Understanding\`, \`Action_Other\`

*   **CRITICAL FORMATTING RULE:**
    *   If you chose **Path A**, your final output **MUST** be: \`MUST_OBEY Action_Type: [Your directive paragraph]\`
    *   If you chose **Path B**, your final output **MUST** be: \`[Action_Type]: [Your directive paragraph]\`

---
### GUIDANCE QUALITY PRINCIPLES
*   **AVOID:** Generic instructions to "teach X next."
*   **ASPIRE TO:** Learner-centered adaptivity, conceptual bridging, proactive creativity, and justified curriculum deviation.

Now, generate your unique directive based on the provided learner state.`;

export class PedagogicalProfiler {
  constructor(private ai: GoogleGenAI) {}

  private _identifyActiveFlags(model: LearnerModel): string[] {
    const FLAG_DEFINITIONS: FlagConfig[] = [
      // Affective State Flags
      { flagName: 'Flag:High_Frustration', condition: (m) => m.AffectiveState.Frustration === 'High' },
      { flagName: 'Flag:High_Confusion', condition: (m) => m.AffectiveState.Confusion === 'High' },
      { flagName: 'Flag:Waning_Engagement', condition: (m) => m.AffectiveState.Engagement === 'Waning' },
      { flagName: 'Flag:High_Boredom', condition: (m) => m.AffectiveState.Boredom === 'High' },
      { flagName: 'Flag:Low_Confidence', condition: (m) => m.AffectiveState.Confidence === 'Low' },
      { flagName: 'Flag:High_Confidence', condition: (m) => m.AffectiveState.Confidence === 'High' },
      { flagName: 'Flag:High_Self_Efficacy', condition: (m) => m.AffectiveState.SelfEfficacy === 'High' },
      { flagName: 'Flag:Seeking_Reassurance', condition: (m) => m.LastAnalysis?.primary_intent === 'SeekingReassurance' },

      // Cognitive & Performance Flags
      { flagName: 'Flag:Performance_Declining', condition: (m) => m.LearningTrajectory.RecentPerformanceTrend === 'Declining' },
      { flagName: 'Flag:Performance_Stalled', condition: (m) => m.LearningTrajectory.RecentPerformanceTrend === 'Stalled_On_Current_Topic' },
      { flagName: 'Flag:Performance_Improving', condition: (m) => m.LearningTrajectory.RecentPerformanceTrend === 'Improving' },
      { flagName: 'Flag:High_Cognitive_Load', condition: (m) => m.CognitiveLoad.EstimatedIntrinsic === 'High' || m.CognitiveLoad.EstimatedExtraneous === 'High' },
      { flagName: 'Flag:Misconception_Active', condition: (m) => Object.values(m.Misconceptions).some(p => p > 0.7) },
      { flagName: 'Flag:Mental_Model_Non_Viable', condition: (m) => m.MentalModelState.InferredModelType.includes('Non-Viable') },
      { flagName: 'Flag:Mental_Model_Emerging', condition: (m) => m.MentalModelState.InferredModelType.includes('Emerging') },

      // SRL Flags
      { flagName: 'Flag:SRL_Low_Planning', condition: (m) => m.SRL_Indicators.PlanningObserved === 'Low' },
      { flagName: 'Flag:SRL_Low_Monitoring', condition: (m) => m.SRL_Indicators.MonitoringObserved === 'Low' },
      { flagName: 'Flag:SRL_Trial_And_Error', condition: (m) => m.SRL_Indicators.StrategyUse.includes('TrialAndError') },
      { flagName: 'Flag:SRL_Help_Seeking_Vague', condition: (m) => m.SRL_Indicators.HelpSeekingAppropriateness === 'Low' || m.LastAnalysis?.srl_indicators.help_seeking_style === 'Vague' },
      { flagName: 'Flag:SRL_Help_Seeking_Demanding', condition: (m) => m.LastAnalysis?.srl_indicators.help_seeking_style === 'Demanding' },
      
      // Composite Profile Flags
      { flagName: 'Flag:Profile_Confident_But_Incorrect', condition: (m) => m.AffectiveState.Confidence === 'High' && (m.AffectiveState.Confusion === 'High' || Object.values(m.Misconceptions).some(p => p > 0.7)) },
      { flagName: 'Flag:Profile_Productive_Struggle', condition: (m) => m.AffectiveState.Engagement === 'High' && m.LearningTrajectory.RecentPerformanceTrend === 'Stalled_On_Current_Topic' },
      { flagName: 'Flag:Profile_Knowledgeable_But_Bored', condition: (m) => m.LearningTrajectory.RecentPerformanceTrend === 'Improving' && m.AffectiveState.Boredom === 'High' },
      { flagName: 'Flag:Profile_Breakthrough_Moment', condition: (m) => m.LearningTrajectory.RecentPerformanceTrend === 'Improving' && m.AffectiveState.Confusion === 'Low' && m.AffectiveState.Confidence === 'High' },
      // New flag to detect specific content-level struggles.
      //{ flagName: 'Flag:Specific_Content_Weakness_Detected', condition: (m) => m.contentPointsCoverage ? Object.values(m.contentPointsCoverage).some(p => p.understanding_score >= 0.5 && p.understanding_score < 0.7) : false },
      { flagName: 'Flag:Profile_Overwhelmed_Novice', condition: (m) => (m.CognitiveLoad.EstimatedIntrinsic === 'High' || m.CognitiveLoad.EstimatedExtraneous === 'High') && m.AffectiveState.Confidence === 'Low' && m.LearningTrajectory.InteractionCounter_On_Current_Topic < 3 },
    ];
    
    const activeFlags = FLAG_DEFINITIONS
      .filter(flagDef => flagDef.condition(model))
      .map(flagDef => flagDef.flagName);

    return activeFlags;
  }

  public async getDirective(model: LearnerModel, context: ProfilerContext): Promise<string> {
    const activeFlags = this._identifyActiveFlags(model);
    logger.info('[LEARNER_DECOUPLE] Generated pedagogical flags:', activeFlags.length, 'flags:', activeFlags);
    const actionItemsForPrompt = `[${context.upcomingActionItems.map(item => `"${item.replace(/"/g, '\\"')}"`).join(', ')}]`;

    // The user history is already in chronological order ['oldest', 'middle', 'newest']. Use as is.
    const chronologicalUserResponses = context.lastThreeUserResponses;
    // The sensei history is in reverse chronological order ['newest', 'middle', 'oldest']. We MUST reverse it.
    const chronologicalSenseiResponses = [...context.lastThreeSenseiResponses].reverse();

    // Sanitize and prepare history for injection into the prompt template, which now expects chronological order.
    const s1 = chronologicalSenseiResponses[0]?.replace(/"/g, '\\"') || 'N/A'; // Turn 1 (Oldest)
    const s2 = chronologicalSenseiResponses[1]?.replace(/"/g, '\\"') || 'N/A'; // Turn 2
    const s3 = chronologicalSenseiResponses[2]?.replace(/"/g, '\\"') || 'N/A'; // Turn 3 (Most Recent)
    const u1 = chronologicalUserResponses[0]?.replace(/"/g, '\\"') || 'N/A'; // Turn 1 (Oldest)
    const u2 = chronologicalUserResponses[1]?.replace(/"/g, '\\"') || 'N/A'; // Turn 2
    const u3 = chronologicalUserResponses[2]?.replace(/"/g, '\\"') || 'N/A'; // Turn 3 (Most Recent)

    const metaPrompt = UNIFIED_PEDAGOGICAL_META_PROMPT_TEMPLATE
      .replace('{sensei_response_1}', s1)
      .replace('{user_response_1}', u1)
      .replace('{sensei_response_2}', s2)
      .replace('{user_response_2}', u2)
      .replace('{sensei_response_3}', s3)
      .replace('{user_response_3}', u3)
      .replace('{active_flags}', activeFlags.join(', '))
      .replace('{action_items}', actionItemsForPrompt);

    // --- LOGGING: PROMPT ---
    if (DEBUG_FLAGS.prompt_debug) {
        logger.log(`[PedagogicalProfiler] PROMPT SENT TO LLM:\n---\n${metaPrompt}\n---`);
    }

    const directive = await generateDirectiveFromMetaPrompt(this.ai, metaPrompt);

    return directive;
  }
}
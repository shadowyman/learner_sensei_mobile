/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from './logger';
import { LearnerModel } from "./adaptiveEngine";
import { TeachingPoint, CurriculumItem, CurriculumState, PHASE_MASTERY_THRESHOLD } from "./curriculum"; // Changed import for TeachingPoint
import {
    CURRICULUM_FOCUS_HEADER_BASE,
    CURRICULUM_FOCUS_PRIMARY_ACTION_HEADER_TEMPLATE,
    CURRICULUM_FOCUS_SUPPORTING_CONTEXT_HEADER,
    CURRICULUM_FOCUS_EXECUTION_DIRECTIVE_HEADER,
    CURRICULUM_FOCUS_EXECUTION_DIRECTIVE_BODY
} from "./prompts";

/**
 * Defines the state of an active consolidation session.
 * This object is the single source of truth for the multi-stage remediation loop.
 */
export interface ConsolidationState {
    stage: 'Diagnosing' | 'Planning' | 'Executing';
    // The plan maps the original chunk index to the list of weak points from that chunk.
    plan: Map<number, TeachingPoint[]>;
    // The ordered list of chunk indices to be remediated.
    planOrder: number[];
    // The current step in the planOrder array.
    currentPlanStep: number;
    // Stores the user's response to the diagnostic questions.
    userDiagnosisResponse?: string;
}

/**
 * Initiates a new consolidation session.
 * This is the entry point into the consolidation loop.
 * @param learnerModel - The current state of the learner.
 * @param teachingPlanForPhase - The full teaching plan for the current phase.
 * @returns A new ConsolidationState object, or null if no remediation is needed.
 */
function logConsolidationValidator(event: string, payload: Record<string, unknown>): void {
    logger.info('[CONSOLIDATION_VALIDATION]', { event, ...payload });
}

export function initiateConsolidation(
    learnerModel: LearnerModel,
    teachingPlanForPhase: TeachingPoint[][]
): ConsolidationState | null {
    const WEAKNESS_THRESHOLD = 0.7; // Points with scores below this are candidates for remediation.
    const MAX_POINTS_TO_REMEDIATE = 4;

    const allPointsWithScores = teachingPlanForPhase
        .flatMap((chunk, chunkIndex) =>
            chunk.map(point => { // point here is TeachingPoint {text, kcValue}
                const foundScore = learnerModel.contentPointsCoverage?.[point.text]?.understanding_score;
                const isFound = foundScore !== undefined;
                const finalScore = foundScore ?? WEAKNESS_THRESHOLD;

                return {
                    ...point, // Spread text and kcValue
                    chunkIndex,
                    score: finalScore,
                    wasFound: isFound
                };
            })
        );

    let weakPoints = allPointsWithScores
        .filter(point => point.score < WEAKNESS_THRESHOLD)
        .sort((a, b) => a.score - b.score) // Sort by score to get weakest first
        .slice(0, MAX_POINTS_TO_REMEDIATE);
    let selectionStrategy: 'threshold' | 'lowest-scores' = 'threshold';

    if (weakPoints.length === 0 && allPointsWithScores.length > 0) {
        selectionStrategy = 'lowest-scores';
        const lowestScoringPoints = allPointsWithScores
            .sort((a, b) => a.score - b.score)
            .slice(0, MAX_POINTS_TO_REMEDIATE);
        weakPoints = lowestScoringPoints; // Assign directly
    }
    
    if (weakPoints.length === 0) return null; // No points to remediate.

    // Group the weak points by their original chunk index.
    const plan = new Map<number, TeachingPoint[]>();
    for (const point of weakPoints) { // point here includes text, kcValue, chunkIndex, score
        if (!plan.has(point.chunkIndex)) {
            plan.set(point.chunkIndex, []);
        }
        // Construct a TeachingPoint for the plan
        plan.get(point.chunkIndex)!.push({ text: point.text, kcValue: point.kcValue });
    }
    
    const planOrder = Array.from(plan.keys()).sort((a, b) => a - b);

    const initialState: ConsolidationState = {
        stage: 'Diagnosing',
        plan: plan,
        planOrder: planOrder,
        currentPlanStep: 0,
    };

    logConsolidationValidator('session-started', {
        totalChunksInPhase: teachingPlanForPhase.length,
        weakPointCount: weakPoints.length,
        selectionStrategy,
        planChunks: planOrder.length,
        weakPoints: weakPoints.map(wp => ({
            chunkIndex: wp.chunkIndex,
            score: Number(wp.score.toFixed(2)),
            wasFound: wp.wasFound
        }))
    });

    return initialState;
}

/**
 * Advances the consolidation state to the next stage.
 * @param state - The current consolidation state.
 * @param userInput - The user's last input.
 * @param learnerModel - The learner model to check for mastery.
 * @param currentPhaseKCId - The KC ID for the current phase.
 * @returns true if consolidation should exit due to mastery, false otherwise.
 */
export function advanceConsolidationStage(
    state: ConsolidationState,
    userInput: string,
    learnerModel?: LearnerModel,
    currentPhaseKCId?: string
): boolean {
    const oldStage = state.stage;
    switch (state.stage) {
        case 'Diagnosing':
            state.stage = 'Planning';
            state.userDiagnosisResponse = userInput;
            break;
        case 'Planning':
            state.stage = 'Executing';
            break;
        case 'Executing':
            if (state.currentPlanStep < state.planOrder.length - 1) {
                state.currentPlanStep++;
            } else {
                // Before looping back, check if mastery has been achieved
                if (learnerModel && currentPhaseKCId) {
                    const phaseKCMastery = learnerModel.KCs[currentPhaseKCId] || 0;
                    const KC_TOLERANCE = 0.001;

                    if (phaseKCMastery >= (PHASE_MASTERY_THRESHOLD - KC_TOLERANCE)) {
                        logConsolidationValidator('mastery-achieved', {
                            phaseKCId: currentPhaseKCId,
                            mastery: Number(phaseKCMastery.toFixed(4))
                        });
                        return true; // Signal to exit consolidation
                    }
                }

                // The plan is complete but mastery not achieved. Loop back for re-diagnosis.
                state.stage = 'Diagnosing';
                state.currentPlanStep = 0;
            }
            break;
    }
    logConsolidationValidator('stage-transition', {
        from: oldStage,
        to: state.stage,
        currentPlanStep: state.currentPlanStep
    });
    return false; // Continue consolidation
}

/**
 * Generates the specific curriculum focus instruction for the current consolidation stage.
 * @param item - The current curriculum item.
 * @param state - The current consolidation state.
 * @returns A string containing the detailed prompt for the Sensei.
 */
export function getConsolidationFocusInstruction(
    item: CurriculumItem,
    state: ConsolidationState
): string {
    let primaryActionType = "";
    let primaryActionInstruction = "";

    switch (state.stage) {
        case 'Diagnosing':
            primaryActionType = "Consolidation: Diagnose Weaknesses";
            const allWeakPoints = Array.from(state.plan.values()).flat().map(p => p.text);
            primaryActionInstruction = `You are in a consolidation loop because the learner's overall mastery is not yet sufficient.
1.  **Present a Consolidation Report:** Start by transparently explaining that you want to review a few key concepts to solidify understanding.
2.  **List the Weak Points:** Clearly list the following teaching points that need review:
${allWeakPoints.map(p => `    - "${p}"`).join('\n')}
3.  **Ask Diagnostic Questions:** For EACH of the points listed above, ask 1-2 targeted, open-ended questions to pinpoint the exact source of confusion. Do not provide explanations yet. Your goal is to gather information.`;
            break;

        case 'Planning':
            primaryActionType = "Consolidation: Analyze & Plan Reteaching";
            primaryActionInstruction = `The user has responded to your diagnostic questions.
1.  **Analyze the User's Response:** In your response, first analyze their answers (provided in the chat history: "${state.userDiagnosisResponse}"). Explicitly state what you believe the "laser-focused" weakness is for each topic. For example: "Thanks for explaining. For the 'base case' concept, it seems the core issue is about when it should return 0 vs. 1. For the 'recursive step', the confusion appears to be around how the return values are combined."
2.  **Announce the Reteaching Plan:** After the analysis, present a clear, step-by-step plan for how you will address these points in the upcoming turns.`;
            break;

        case 'Executing':
            const currentChunkIndex = state.planOrder[state.currentPlanStep];
            const pointsToRemediate = state.plan.get(currentChunkIndex)!; // pointsToRemediate is TeachingPoint[]
            primaryActionType = `Consolidation: Execute Reteaching (Chunk ${currentChunkIndex + 1})`;
            primaryActionInstruction = `You are executing step ${state.currentPlanStep + 1} of the reteaching plan you previously announced.
1.  **State Your Focus:** Begin by saying you are now focusing on the points from Chunk ${currentChunkIndex + 1}.
2.  **Provide Focused Remediation:** Provide a new, detailed, and "laser-focused" explanation for the following specific weak points. Your explanation MUST directly address the weaknesses you diagnosed in the 'Planning' stage. Use new analogies or examples.
${pointsToRemediate.map(p => `    - "${p.text}"`).join('\n')}`; // Access p.text, which is valid for TeachingPoint
            break;
    }

    // This constructs the full prompt structure, similar to the main getCurriculumFocusInstruction function.
    return `${CURRICULUM_FOCUS_HEADER_BASE}
- Current Module: ${item.moduleTitle}
- Current Pedagogical Phase: ${item.isModuleWidePhase ? 'Module-Wide Consolidation' : 'Concept Consolidation'}

${CURRICULUM_FOCUS_PRIMARY_ACTION_HEADER_TEMPLATE(primaryActionType)}
${primaryActionInstruction}

${CURRICULUM_FOCUS_SUPPORTING_CONTEXT_HEADER}
- Module Goal: "${item.moduleGoal}"
${item.concept ? `- Concept: "${item.concept.title}"` : ''}

${CURRICULUM_FOCUS_EXECUTION_DIRECTIVE_HEADER}
${CURRICULUM_FOCUS_EXECUTION_DIRECTIVE_BODY}
]`;
}

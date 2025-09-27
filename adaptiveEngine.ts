/**
 * @license
 * SPDX-License-Identifier: Apache-2.1
 */

import { logger } from './logger';
// Based on Section I-B: The Recursive Sensei's Adaptive Teaching Engine - Operational Mechanisms (Version 2.1)
import { CurriculumState, PHASE_MASTERY_THRESHOLD, CurriculumItem } from "./curriculum"; 
import type { TeachingPoint as CurriculumTeachingPoint } from "./curriculum"; // For clarity when dealing with teachingPlanForPhase

function logAdaptiveValidation(event: string, payload?: Record<string, unknown>): void {
    if (payload && Object.keys(payload).length > 0) {
        logger.info('[ADAPTIVE_VALIDATION]', { event, ...payload });
    } else {
        logger.info('[ADAPTIVE_VALIDATION]', { event });
    }
}

// --- INTERFACES ---

export interface AffectiveStateAnalysis {
    confidence: 'Low' | 'Medium' | 'High' | 'Uncertain';
    engagement: 'Waning' | 'Low' | 'Medium' | 'High' | 'Uncertain';
    frustration: 'Low' | 'Medium' | 'High' | 'Uncertain';
    confusion: 'Low' | 'Medium' | 'High' | 'Uncertain';
    boredom: 'Low' | 'Medium' | 'High' | 'Uncertain';
    self_efficacy: 'Low' | 'Medium' | 'High' | 'Uncertain';
}

export interface CognitiveLoadIndicatorsAnalysis {
    perceived_intrinsic_difficulty: 'Low' | 'Medium' | 'High' | 'Uncertain';
    extraneous_load_signals: 'Low' | 'Medium' | 'High' | 'Uncertain';
}

export interface SRLIndicatorsAnalysis {
    planning_observed: 'Low' | 'Medium' | 'High' | 'Uncertain';
    monitoring_observed: 'Low' | 'Medium' | 'High' | 'Uncertain';
    help_seeking_style: 'Appropriate' | 'Vague' | 'Demanding' | 'None' | 'Uncertain';
    strategy_hint: string[]; 
}

export interface MisconceptionHint {
    id: string; 
    likelihood: 'Low' | 'Medium' | 'High' | 'Uncertain';
}

export interface KnowledgeComponentReference {
    kc_id: string; 
    understanding_signal: 'Positive' | 'Negative' | 'Neutral' | 'Uncertain';
}

export interface TopicInteractionAnalysis {
    continues_current_topic: boolean | 'Uncertain';
    signals_topic_resolution: boolean | 'Uncertain';
}

export interface KeyContentPointAssessment {
    point_id: string; // This is the text of the teaching point, used as an ID
    coverage: 'NotAddressed' | 'ImplicitlyAddressed' | 'ExplicitlyAddressed';
    understanding_score: number; 
}
export type KEY_CONTENT_POINT_ASSESSMENT_TYPE = KeyContentPointAssessment; 
// Removed: export type TeachingPoint = KeyContentPointAssessment;


export interface ComprehensiveAnalysisResultType {
    affective_state: AffectiveStateAnalysis;
    cognitive_load_indicators: CognitiveLoadIndicatorsAnalysis;
    srl_indicators: SRLIndicatorsAnalysis;
    misconception_hints: MisconceptionHint[];
    knowledge_component_references: KnowledgeComponentReference[];
    primary_intent: 'AskingQuestion' | 'AnsweringQuestion' | 'ExpressingConfusion' | 'ExpressingUnderstanding' | 'ProvidingFeedback' | 'SeekingReassurance' | "RequestingCurriculumStart" | 'Other' | 'Uncertain';
    topic_interaction: TopicInteractionAnalysis;
    key_content_point_assessment?: KeyContentPointAssessment[]; 
}


export interface KnowledgeComponents {
    [key: string]: number; 
}

export interface KCMasteryLastUpdated {
    [key: string]: string; 
}

export interface Misconceptions {
    [key: string]: number; 
}
export const MISCONCEPTION_IDS = [ 
    "Misconception_LoopingModel", "Misconception_MagicModel", "Misconception_BaseCaseOffByOne",
    "Misconception_StackOrderError", "Misconception_ParametersDontChange", "Misconception_ReturnValuesLost"
];


export interface MentalModelState {
    InferredModelType: string; 
    Consistency: 'Low' | 'Medium' | 'High';
}

export interface CognitiveLoad {
    EstimatedIntrinsic: 'Low' | 'Medium' | 'High' | 'Very High';
    EstimatedExtraneous: 'Low' | 'Medium' | 'High' | 'Very High';
    EstimatedGermane: 'Low' | 'Medium' | 'High';
}

export interface AffectiveState {
    Confidence: 'Low' | 'Medium' | 'High';
    Engagement: 'Waning' | 'Low' | 'Medium' | 'High';
    Frustration: 'Low' | 'Medium' | 'High';
    Confusion: 'Low' | 'Medium' | 'High';
    Boredom: 'Low' | 'Medium' | 'High';
    SelfEfficacy: 'Low' | 'Medium' | 'High';
}

export type SRLStrategy = "TrialAndError" | "PlanningAhead" | "SelfExplaining" | "SystematicDebugging" | "SeekingClarification" | "Other" | "None";

export interface SRL_Indicators {
    PlanningObserved: 'Low' | 'Medium' | 'High' | 'Uncertain';
    MonitoringObserved: 'Low' | 'Medium' | 'High' | 'Uncertain';
    HelpSeekingAppropriateness: 'Low' | 'Medium' | 'High' | "None";
    StrategyUse: SRLStrategy[];
}

export interface LearningTrajectory {
    RecentPerformanceTrend: 'Declining' | 'Stable' | 'Improving' | 'Stalled_On_Current_Topic';
    PersistentDifficulties: string[]; 
    TotalTimeOnTask: string;
    SessionProgress: string;
    InteractionCounter_On_Current_Topic: number; 
    LastMasteryCheckTimestamp: string;
    totalInteractions?: number;
}

export interface CurrentTask {
    ID: string; 
    TargetKCs: string[]; 
    EstimatedIntrinsicLoad: 'Low' | 'Medium' | 'High';
}

export interface ZPD_Estimate {
    NextComplexity: 'Slightly Lower' | 'Same' | 'Slightly Higher' | 'Significantly Higher';
    ScaffoldingNeed: 'Low' | 'Medium' | 'High' | 'Very High';
}

export interface LearnerModel {
    KCs: KnowledgeComponents;
    KCMasteryLastUpdated: KCMasteryLastUpdated;
    Misconceptions: Misconceptions;
    MentalModelState: MentalModelState;
    CognitiveLoad: CognitiveLoad;
    AffectiveState: AffectiveState;
    SRL_Indicators: SRL_Indicators;
    LearningTrajectory: LearningTrajectory;
    CurrentTask: CurrentTask;
    ZPD_Estimate: ZPD_Estimate;
    LastUserInput: string;
    SessionStartTime: number; 
    LastAnalysis: ComprehensiveAnalysisResultType | null; 
    contentPointsCoverage?: { 
        [pointId: string]: { 
            coverage: 'NotAddressed' | 'ImplicitlyAddressed' | 'ExplicitlyAddressed';
            understanding_score: number; // Changed from categorical user_understanding
            last_addressed_turn_id?: string; 
        } 
    };
    awardedKcForPhasePoints: Set<string>; // Tracks TEXT of phase teaching points whose kcValue has been awarded
}

// --- INITIALIZATION ---

export function initializeLearnerModel(): LearnerModel {
    const now = new Date().toISOString();
    const initialKCs: KnowledgeComponents = {
        "KC_GeneralRecursionDefinition": 0.05 
    };

    const initialKCMasteryLastUpdated: KCMasteryLastUpdated = {
        "KC_GeneralRecursionDefinition": now
    };

    const initialMisconceptions: Misconceptions = {};
    MISCONCEPTION_IDS.forEach(mc => initialMisconceptions[mc] = 0.1);


    return {
        KCs: initialKCs,
        KCMasteryLastUpdated: initialKCMasteryLastUpdated,
        Misconceptions: initialMisconceptions,
        MentalModelState: {
            InferredModelType: "Initial/Unknown",
            Consistency: 'Low',
        },
        CognitiveLoad: {
            EstimatedIntrinsic: 'Medium',
            EstimatedExtraneous: 'Low',
            EstimatedGermane: 'Low',
        },
        AffectiveState: {
            Confidence: 'Medium',
            Engagement: 'Medium',
            Frustration: 'Low',
            Confusion: 'Low',
            Boredom: 'Low',
            SelfEfficacy: 'Medium',
        },
        SRL_Indicators: {
            PlanningObserved: 'Uncertain',
            MonitoringObserved: 'Uncertain',
            HelpSeekingAppropriateness: 'Medium',
            StrategyUse: [],
        },
        LearningTrajectory: {
            RecentPerformanceTrend: 'Stable',
            PersistentDifficulties: [],
            TotalTimeOnTask: "0 minutes",
            SessionProgress: "Getting Started",
            InteractionCounter_On_Current_Topic: 0,
            LastMasteryCheckTimestamp: now,
        },
        CurrentTask: {
            ID: "General_Introduction_To_Recursion", 
            TargetKCs: ["KC_GeneralRecursionDefinition"], 
            EstimatedIntrinsicLoad: 'Medium',
        },
        ZPD_Estimate: {
            NextComplexity: 'Same',
            ScaffoldingNeed: 'Medium',
        },
        LastUserInput: "",
        SessionStartTime: Date.now(),
        LastAnalysis: null,
        contentPointsCoverage: {}, 
        awardedKcForPhasePoints: new Set<string>(), // Initialize set for awarded KCs
    };
}

// --- START: Stateful Update Logic ---

// Maps for converting categorical states to numbers for weighted calculations.
const THREE_LEVEL_MAP: { [key: string]: number } = { 'Low': 0, 'Medium': 1, 'High': 2 };
const REVERSE_THREE_LEVEL_MAP: ('Low' | 'Medium' | 'High')[] = ['Low', 'Medium', 'High'];

const FOUR_LEVEL_MAP: { [key: string]: number } = { 'Low': 0, 'Medium': 1, 'High': 2, 'Very High': 3 };
const REVERSE_FOUR_LEVEL_MAP: ('Low' | 'Medium' | 'High' | 'Very High')[] = ['Low', 'Medium', 'High', 'Very High'];

const ENGAGEMENT_MAP: { [key: string]: number } = { 'Waning': 0, 'Low': 1, 'Medium': 2, 'High': 3 };
const REVERSE_ENGAGEMENT_MAP: ('Waning' | 'Low' | 'Medium' | 'High')[] = ['Waning', 'Low', 'Medium', 'High'];

const HELP_SEEKING_MAP: { [key: string]: number } = { 'None': 0, 'Low': 1, 'Medium': 2, 'High': 3 };
const REVERSE_HELP_SEEKING_MAP: ('None' | 'Low' | 'Medium' | 'High')[] = ['None', 'Low', 'Medium', 'High'];

/**
 * Implements an asymmetrical weighted average to dynamically update a categorical state.
 * This logic makes the state more "sticky" when declining and more responsive when improving.
 * Uses TypeScript generics to ensure type safety.
 * @param previousValue The existing value from the learner model.
 * @param newValue The new value from the analysis.
 * @param valueToNumberMap The map to convert the state string to a number.
 * @param numberToValueMap The array to convert the calculated number back to a state string.
 * @returns The new, smoothed state, guaranteed to be of the same type as the input.
 */
function dynamicCategoricalUpdate<T extends string>(
    previousValue: T,
    newValue: T,
    valueToNumberMap: { [key: string]: number },
    numberToValueMap: T[]
): T {
    const previousNum = valueToNumberMap[previousValue];
    const newNum = valueToNumberMap[newValue];

    if (previousNum === undefined || newNum === undefined) {
        return newValue; // Fallback if a value is invalid
    }

    // Asymmetrical weighted average
    const resultNum = (newNum > previousNum)
        ? (0.4 * previousNum) + (0.6 * newNum)  // Improving: favor the new state
        : (0.7 * previousNum) + (0.3 * newNum); // Declining or same: favor the previous state

    const roundedIndex = Math.round(resultNum);
    const clampedIndex = Math.max(0, Math.min(roundedIndex, numberToValueMap.length - 1));
    
    const candidate = numberToValueMap[clampedIndex];
    return candidate === undefined ? newValue : candidate;
}
// --- UPDATE LOGIC ---

function updateKC(model: LearnerModel, kcName: string, change: number, isPhaseKc: boolean = false) {
    if (!model.KCs[kcName] && change > 0) { 
        model.KCs[kcName] = 0;
    }
    if (model.KCs[kcName] !== undefined) {
        if (isPhaseKc) { // For phase KCs, we are summing up, ensure it doesn't exceed a practical max like 1.0 from summation
            model.KCs[kcName] = Math.min(1.0, model.KCs[kcName] + change);
        } else { // For other KCs, standard update
            model.KCs[kcName] = Math.min(1.0, Math.max(0.0, model.KCs[kcName] + change));
        }
        model.KCMasteryLastUpdated[kcName] = new Date().toISOString();
    } else if (change > 0) { 
        model.KCs[kcName] = Math.min(1.0, Math.max(0.0, change)); // Initial assignment can be direct for positive change
        model.KCMasteryLastUpdated[kcName] = new Date().toISOString();
    }
}

function updateMisconception(model: LearnerModel, mcName: string, change: number) {
    if (model.Misconceptions[mcName] !== undefined) {
        model.Misconceptions[mcName] = Math.min(1.0, Math.max(0.0, model.Misconceptions[mcName] + change));
    }
}

function mapAnalysisValue<T extends string>(value: T | 'Uncertain', defaultValue: T): T {
    return value === 'Uncertain' ? defaultValue : value;
}

function normalizeContentPointText(text: string): string {
    // Removes markdown characters like *, _, `, " and trims whitespace.
    // Also normalizes multiple spaces to single spaces to handle formatting inconsistencies from the LLM.
    return text.replace(/[*_`"]/g, '').replace(/\s+/g, ' ').trim();
}

function findBestMatchingContentPoint(assessmentPointId: string, expectedPoints: string[]): { match: string | null, isFuzzy: boolean, similarity?: number } {
    const normalizedAssessment = normalizeContentPointText(assessmentPointId);
    
    // First try exact match
    for (const point of expectedPoints) {
        if (normalizeContentPointText(point) === normalizedAssessment) {
            return { match: point, isFuzzy: false };
        }
    }
    
    // Then try fuzzy matching (high threshold to avoid false positives)
    const fuzzyThreshold = 0.9;
    let bestMatch: string | null = null;
    let bestScore = 0;
    
    for (const point of expectedPoints) {
        const normalizedPoint = normalizeContentPointText(point);
        const similarity = calculateStringSimilarity(normalizedAssessment, normalizedPoint);
        if (similarity > fuzzyThreshold && similarity > bestScore) {
            bestScore = similarity;
            bestMatch = point;
        }
    }
    
    return { match: bestMatch, isFuzzy: true, similarity: bestScore };
}

function calculateStringSimilarity(str1: string, str2: string): number {
    // Simple character-level similarity using Jaccard index
    const set1 = new Set(str1.toLowerCase().split(''));
    const set2 = new Set(str2.toLowerCase().split(''));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
}


export function updateLearnerModel(
    userInput: string,
    analysis: ComprehensiveAnalysisResultType | null,
    currentModel: LearnerModel,
    expectedContentPointTextsForCurrentChunk: string[], // Renamed for clarity, stores TEXT of points
    curriculumState?: CurriculumState | null
): LearnerModel {

    const modelAsPlainObject = JSON.parse(JSON.stringify(currentModel));
    const newAwardedKcForPhasePoints = new Set<string>(currentModel.awardedKcForPhasePoints || []);

    const model: LearnerModel = {
        ...modelAsPlainObject,
        awardedKcForPhasePoints: newAwardedKcForPhasePoints
    };

    model.LastUserInput = userInput;
    model.LastAnalysis = analysis;

    const timeDiffMinutes = Math.round((Date.now() - model.SessionStartTime) / (1000 * 60));
    model.LearningTrajectory.TotalTimeOnTask = `${timeDiffMinutes} minutes`;

    if (analysis) {
        // 1. Affective State (Stateful Update)
        const newConfidence = mapAnalysisValue(analysis.affective_state.confidence, model.AffectiveState.Confidence);
        model.AffectiveState.Confidence = dynamicCategoricalUpdate(model.AffectiveState.Confidence, newConfidence, THREE_LEVEL_MAP, REVERSE_THREE_LEVEL_MAP);

        const newEngagement = mapAnalysisValue(analysis.affective_state.engagement, model.AffectiveState.Engagement);
        model.AffectiveState.Engagement = dynamicCategoricalUpdate(model.AffectiveState.Engagement, newEngagement, ENGAGEMENT_MAP, REVERSE_ENGAGEMENT_MAP);

        const newFrustration = mapAnalysisValue(analysis.affective_state.frustration, model.AffectiveState.Frustration);
        model.AffectiveState.Frustration = dynamicCategoricalUpdate(model.AffectiveState.Frustration, newFrustration, THREE_LEVEL_MAP, REVERSE_THREE_LEVEL_MAP);

        const newConfusion = mapAnalysisValue(analysis.affective_state.confusion, model.AffectiveState.Confusion);
        model.AffectiveState.Confusion = dynamicCategoricalUpdate(model.AffectiveState.Confusion, newConfusion, THREE_LEVEL_MAP, REVERSE_THREE_LEVEL_MAP);

        const newBoredom = mapAnalysisValue(analysis.affective_state.boredom, model.AffectiveState.Boredom);
        model.AffectiveState.Boredom = dynamicCategoricalUpdate(model.AffectiveState.Boredom, newBoredom, THREE_LEVEL_MAP, REVERSE_THREE_LEVEL_MAP);

        const newSelfEfficacy = mapAnalysisValue(analysis.affective_state.self_efficacy, model.AffectiveState.SelfEfficacy);
        model.AffectiveState.SelfEfficacy = dynamicCategoricalUpdate(model.AffectiveState.SelfEfficacy, newSelfEfficacy, THREE_LEVEL_MAP, REVERSE_THREE_LEVEL_MAP);

        if (curriculumState?.currentPhase === 'Socratic') {
        }

        // 2. Cognitive Load (Stateful Update)
        const newIntrinsicLoad = mapAnalysisValue(analysis.cognitive_load_indicators.perceived_intrinsic_difficulty, model.CognitiveLoad.EstimatedIntrinsic);
        model.CognitiveLoad.EstimatedIntrinsic = dynamicCategoricalUpdate(model.CognitiveLoad.EstimatedIntrinsic, newIntrinsicLoad, FOUR_LEVEL_MAP, REVERSE_FOUR_LEVEL_MAP);

        const newExtraneousLoad = mapAnalysisValue(analysis.cognitive_load_indicators.extraneous_load_signals, model.CognitiveLoad.EstimatedExtraneous);
        model.CognitiveLoad.EstimatedExtraneous = dynamicCategoricalUpdate(model.CognitiveLoad.EstimatedExtraneous, newExtraneousLoad, FOUR_LEVEL_MAP, REVERSE_FOUR_LEVEL_MAP);

        if (analysis.primary_intent === 'ExpressingUnderstanding' && model.AffectiveState.Confusion === 'Low' && model.AffectiveState.Frustration === 'Low') {
            model.CognitiveLoad.EstimatedGermane = 'High';
        } else if (model.AffectiveState.Confusion === 'High' || model.AffectiveState.Frustration === 'High') {
            model.CognitiveLoad.EstimatedGermane = 'Low';
        } else {
            model.CognitiveLoad.EstimatedGermane = 'Medium';
        }

        // 3. SRL Indicators (Stateful Update)
        const srlIndicators = analysis.srl_indicators;
        if (srlIndicators) {
            const newPlanningObserved = mapAnalysisValue(srlIndicators.planning_observed ?? 'Uncertain', model.SRL_Indicators.PlanningObserved);
            model.SRL_Indicators.PlanningObserved = dynamicCategoricalUpdate(model.SRL_Indicators.PlanningObserved, newPlanningObserved, THREE_LEVEL_MAP, REVERSE_THREE_LEVEL_MAP);

            const newMonitoringObserved = mapAnalysisValue(srlIndicators.monitoring_observed ?? 'Uncertain', model.SRL_Indicators.MonitoringObserved);
            model.SRL_Indicators.MonitoringObserved = dynamicCategoricalUpdate(model.SRL_Indicators.MonitoringObserved, newMonitoringObserved, THREE_LEVEL_MAP, REVERSE_THREE_LEVEL_MAP);

            const newHelpSeeking = mapAnalysisValue((srlIndicators.help_seeking_style as 'Low' | 'Medium' | 'High' | 'None' | 'Uncertain') ?? 'Uncertain', model.SRL_Indicators.HelpSeekingAppropriateness);
            model.SRL_Indicators.HelpSeekingAppropriateness = dynamicCategoricalUpdate(model.SRL_Indicators.HelpSeekingAppropriateness, newHelpSeeking, HELP_SEEKING_MAP, REVERSE_HELP_SEEKING_MAP);
            const strategyHints = srlIndicators.strategy_hint ?? [];
            model.SRL_Indicators.StrategyUse = strategyHints.filter(s => s !== "None" && s !== "Uncertain") as SRLStrategy[];
        }


        // 4. Misconceptions (standard update logic)
        analysis.misconception_hints.forEach(hint => {
            if (MISCONCEPTION_IDS.includes(hint.id)) { 
                const existingMisconception = model.Misconceptions[hint.id];
                if (existingMisconception === undefined) {
                    logger.warn('[MISCONCEPTION_STATE] Missing misconception entry', { hintId: hint.id });
                    return;
                }
                let change = 0;
                if (hint.likelihood === 'High') change = 0.3;
                else if (hint.likelihood === 'Medium') change = 0.15;
                else if (hint.likelihood === 'Low' && existingMisconception > 0.05) change = -0.05;
                updateMisconception(model, hint.id, change);

                if (hint.id === "Misconception_LoopingModel" && (hint.likelihood === 'High' || hint.likelihood === 'Medium')) {
                    model.MentalModelState.InferredModelType = "Non-Viable Looping Model";
                    model.MentalModelState.Consistency = hint.likelihood === 'High' ? 'High' : 'Medium';
                } else if (model.MentalModelState.InferredModelType === "Non-Viable Looping Model" && hint.id === "Misconception_LoopingModel" && hint.likelihood === 'Low') {
                     model.MentalModelState.InferredModelType = "Emerging Recursive Model";
                }
            }
        });

        // 5. Knowledge Components (Non-Phase Specific)
        analysis.knowledge_component_references.forEach(ref => {
            if (ref.kc_id !== model.CurrentTask.ID) { 
                let change = 0;
                if (ref.understanding_signal === 'Positive') change = 0.12;
                else if (ref.understanding_signal === 'Negative') change = -0.07;
                updateKC(model, ref.kc_id, change); 
            }
        });
        if (analysis.primary_intent === 'ExpressingUnderstanding' && model.AffectiveState.Confusion === 'Low') {
             model.CurrentTask.TargetKCs.forEach(kc => {
                if (kc !== model.CurrentTask.ID) {
                    updateKC(model, kc, 0.12);
                }
            });
        }

        // 5b. Update LearnerModel.contentPointsCoverage
        if (!model.contentPointsCoverage) model.contentPointsCoverage = {};
        if (expectedContentPointTextsForCurrentChunk) {
            expectedContentPointTextsForCurrentChunk.forEach(pointText => {
                if (!model.contentPointsCoverage![pointText]) {
                    model.contentPointsCoverage![pointText] = {
                        coverage: 'NotAddressed',
                        understanding_score: 0.0 // Default to 0.0
                    };
                }
            });
        }

        // 5c. Update CurriculumState's coverage sets AND Award KC values
        const phaseKCId = model.CurrentTask.ID;
        if (!model.KCs[phaseKCId] && curriculumState) {
            model.KCs[phaseKCId] = 0;
            model.KCMasteryLastUpdated[phaseKCId] = new Date().toISOString();
            model.awardedKcForPhasePoints = new Set<string>();
        }


        if (curriculumState && analysis.key_content_point_assessment && expectedContentPointTextsForCurrentChunk && curriculumState.currentPhase !== 'Socratic') {
            const isConfidentUnderstanding = analysis.primary_intent === 'ExpressingUnderstanding' &&
                                             model.AffectiveState.Confidence === 'High' &&
                                             model.AffectiveState.Confusion === 'Low';

            if (!curriculumState.pointsToRevisitInCurrentChunk) { 
                curriculumState.pointsToRevisitInCurrentChunk = new Set<string>();
            }

            const kcAssessmentSummary = {
                processed: 0,
                fuzzyMatches: [] as Array<{ pointId: string; similarity: number }>,
                awarded: [] as Array<{ pointId: string; delta: number }>,
                coverage: {
                    covered: [] as string[],
                    revisit: [] as string[]
                }
            };

            analysis.key_content_point_assessment.forEach(assessment => { // assessment is KeyContentPointAssessment
                const matchResult = findBestMatchingContentPoint(assessment.point_id, expectedContentPointTextsForCurrentChunk);
                const verbatimPointText = matchResult.match;
                kcAssessmentSummary.processed += 1;

                if (verbatimPointText) { // verbatimPointText is string
                    if (matchResult.isFuzzy) {
                        const similarity = typeof matchResult.similarity === 'number' ? Number(matchResult.similarity.toFixed(3)) : 0;
                        kcAssessmentSummary.fuzzyMatches.push({ pointId: assessment.point_id, similarity });
                    }
                    // *** HIGH-WATER MARK LOGIC START ***
                    const newAnalysisScore = (typeof assessment.understanding_score === 'number' && !isNaN(assessment.understanding_score))
                        ? Math.max(0.0, Math.min(1.0, assessment.understanding_score))
                        : 0.0;

                    const previousScore = model.contentPointsCoverage?.[verbatimPointText]?.understanding_score || 0.0;
                    const effectiveScore = Math.max(newAnalysisScore, previousScore);

                    const currentChunkTeachingPoints: CurriculumTeachingPoint[] = curriculumState.teachingPlanForPhase?.[curriculumState.currentTeachingChunkIndex] ?? [];
                    const teachingPointObject = currentChunkTeachingPoints.find(tp => tp.text === verbatimPointText);


                    if (teachingPointObject && teachingPointObject.kcValue > 0 && effectiveScore > previousScore) {
                        const awardedKc = (effectiveScore - previousScore) * teachingPointObject.kcValue;
                        updateKC(model, phaseKCId, awardedKc, true);
                        kcAssessmentSummary.awarded.push({ pointId: assessment.point_id, delta: Number(awardedKc.toFixed(4)) });
                    } else {
                        // Update KC progress bar with new mastery level
                        const updatedKCMastery = model.KCs[phaseKCId];
                        // Update KC progress bar with new mastery level
                        if (typeof (window as any).updateKCProgressBar === 'function') {
                            (window as any).updateKCProgressBar(updatedKCMastery);
                        }
                    }

                    // Determine if the point is "covered" for progression purposes
                    if (effectiveScore >= 0.7) { // Use effective score for progression
                        curriculumState.coveredPointsInCurrentChunk.add(verbatimPointText); // verbatimPointText is string
                        curriculumState.pointsToRevisitInCurrentChunk!.delete(verbatimPointText); // verbatimPointText is string
                        kcAssessmentSummary.coverage.covered.push(assessment.point_id);
                    } else {
                        curriculumState.coveredPointsInCurrentChunk.delete(verbatimPointText); // Ensure it's not marked as covered if below threshold
                        curriculumState.pointsToRevisitInCurrentChunk!.add(verbatimPointText); // verbatimPointText is string
                        kcAssessmentSummary.coverage.revisit.push(assessment.point_id);
                    }

                    model.contentPointsCoverage![verbatimPointText] = { // verbatimPointText is string
                        coverage: assessment.coverage,
                        understanding_score: effectiveScore, // Store the new high-water mark
                    };
                    // *** HIGH-WATER MARK LOGIC END ***
                } else {
                    const bestSimilarity = matchResult.similarity || 0;
                    logger.warn(`Could not match assessment point_id "${assessment.point_id}" to any expected content point in the current chunk. Best similarity was ${bestSimilarity.toFixed(3)} (threshold: 0.9). Expected points: ${JSON.stringify(expectedContentPointTextsForCurrentChunk)}`);
                }
            });

            if (kcAssessmentSummary.processed > 0) {
                const payload: Record<string, unknown> = {
                    chunkIndex: curriculumState.currentTeachingChunkIndex,
                    totalAssessments: kcAssessmentSummary.processed
                };
                if (kcAssessmentSummary.fuzzyMatches.length > 0) {
                    payload.fuzzyMatches = kcAssessmentSummary.fuzzyMatches;
                }
                if (kcAssessmentSummary.awarded.length > 0) {
                    payload.awarded = kcAssessmentSummary.awarded;
                }
                const coveragePayload: Record<string, string[]> = {};
                if (kcAssessmentSummary.coverage.covered.length > 0) {
                    coveragePayload.covered = Array.from(new Set(kcAssessmentSummary.coverage.covered));
                }
                if (kcAssessmentSummary.coverage.revisit.length > 0) {
                    coveragePayload.revisit = Array.from(new Set(kcAssessmentSummary.coverage.revisit));
                }
                if (Object.keys(coveragePayload).length > 0) {
                    payload.coverage = coveragePayload;
                }
                logAdaptiveValidation('kc-assessment-summary', payload);
            }

        } else if (curriculumState && curriculumState.currentPhase === 'Socratic') {
        }


        // 6. Learning Trajectory
 
        let positiveKCSignals = analysis.knowledge_component_references.filter(ref => ref.understanding_signal === 'Positive').length;
        let negativeKCSignals = analysis.knowledge_component_references.filter(ref => ref.understanding_signal === 'Negative').length;

        if (positiveKCSignals > negativeKCSignals && model.AffectiveState.Confidence !== 'Low' && model.AffectiveState.Confusion === 'Low') {
            model.LearningTrajectory.RecentPerformanceTrend = 'Improving';
        } else if (analysis.primary_intent === 'ExpressingConfusion' || model.AffectiveState.Confusion === 'High' || model.AffectiveState.Frustration === 'High' || negativeKCSignals > positiveKCSignals) {
            if (model.LearningTrajectory.InteractionCounter_On_Current_Topic > 0) { 
                model.LearningTrajectory.RecentPerformanceTrend = 'Stalled_On_Current_Topic';
            } else {
                model.LearningTrajectory.RecentPerformanceTrend = 'Declining';
            }
        } else {
            model.LearningTrajectory.RecentPerformanceTrend = 'Stable';
        }
    } else {
 
        const inputLower = userInput.toLowerCase();
        if (inputLower.includes("stuck") || inputLower.includes("confused") || inputLower.includes("don't understand")) {
            model.AffectiveState.Confusion = 'High';
            model.AffectiveState.Confidence = 'Low';
            model.AffectiveState.Frustration = 'Medium';
        } else if (inputLower.includes("got it") || inputLower.includes("makes sense") || inputLower.includes("clear now")) {
            model.AffectiveState.Confusion = 'Low';
            model.AffectiveState.Confidence = 'High';
            model.LearningTrajectory.RecentPerformanceTrend = 'Improving';
        }
    }

    // ZPD Estimate
    if (model.LearningTrajectory.RecentPerformanceTrend === 'Improving' && model.AffectiveState.Confidence === 'High') {
        model.ZPD_Estimate.NextComplexity = 'Slightly Higher';
        model.ZPD_Estimate.ScaffoldingNeed = 'Low';
    } else if (model.LearningTrajectory.RecentPerformanceTrend === 'Stalled_On_Current_Topic' || model.AffectiveState.Frustration === 'High') {
        model.ZPD_Estimate.NextComplexity = 'Slightly Lower';
        model.ZPD_Estimate.ScaffoldingNeed = 'Very High';
    } else if (model.AffectiveState.Confusion === 'High' || model.AffectiveState.Confidence === 'Low') {
        model.ZPD_Estimate.NextComplexity = 'Same';
        model.ZPD_Estimate.ScaffoldingNeed = 'High';
    } else {
        model.ZPD_Estimate.NextComplexity = 'Same';
        model.ZPD_Estimate.ScaffoldingNeed = 'Medium';
    }


    return model;
}

export function overrideChunkUnderstanding(
    learnerModel: LearnerModel,
    curriculumState: CurriculumState,
    curriculumItem: CurriculumItem,
    chunkIndex: number,
    understood: boolean
): { kcDelta: number } {
    if (!curriculumState.teachingPlanForPhase || chunkIndex < 0 || chunkIndex >= curriculumState.teachingPlanForPhase.length) {
        logger.warn('[CHUNK_CHECK] Invalid chunk override request', { chunkIndex });
        return { kcDelta: 0 };
    }
    const chunkPoints = curriculumState.teachingPlanForPhase[chunkIndex];
    if (!chunkPoints) {
        logger.warn('[CHUNK_CHECK] Missing chunk points for override', { chunkIndex });
        return { kcDelta: 0 };
    }
    if (!learnerModel.contentPointsCoverage) {
        learnerModel.contentPointsCoverage = {};
    }
    if (!(learnerModel.awardedKcForPhasePoints instanceof Set)) {
        learnerModel.awardedKcForPhasePoints = new Set<string>();
    }
    const phaseKCId = curriculumItem.curriculumPathId;
    const currentMastery = learnerModel.KCs[phaseKCId] || 0;
    let totalDelta = 0;
    chunkPoints.forEach(point => {
        const previousScore = learnerModel.contentPointsCoverage?.[point.text]?.understanding_score || 0;
        const targetScore = understood ? 1 : 0;
        if (!learnerModel.contentPointsCoverage![point.text]) {
            learnerModel.contentPointsCoverage![point.text] = {
                coverage: 'NotAddressed',
                understanding_score: 0
            };
        }
        const scoreDelta = targetScore - previousScore;
        if (scoreDelta !== 0 && point.kcValue > 0) {
            totalDelta += scoreDelta * point.kcValue;
        }
        learnerModel.contentPointsCoverage![point.text] = {
            coverage: understood ? 'ExplicitlyAddressed' : 'NotAddressed',
            understanding_score: targetScore
        };
        if (understood) {
            learnerModel.awardedKcForPhasePoints.add(point.text);
        } else {
            learnerModel.awardedKcForPhasePoints.delete(point.text);
        }
    });
    const updatedMastery = Math.max(0, Math.min(1, currentMastery + totalDelta));
    const appliedDelta = updatedMastery - currentMastery;
    learnerModel.KCs[phaseKCId] = updatedMastery;
    learnerModel.KCMasteryLastUpdated[phaseKCId] = new Date().toISOString();
    if (curriculumState.currentTeachingChunkIndex === chunkIndex) {
        if (understood) {
            curriculumState.coveredPointsInCurrentChunk = new Set(chunkPoints.map(point => point.text));
            if (!curriculumState.pointsToRevisitInCurrentChunk) {
                curriculumState.pointsToRevisitInCurrentChunk = new Set<string>();
            }
            chunkPoints.forEach(point => curriculumState.pointsToRevisitInCurrentChunk!.delete(point.text));
        } else {
            curriculumState.coveredPointsInCurrentChunk = new Set<string>();
            if (!curriculumState.pointsToRevisitInCurrentChunk) {
                curriculumState.pointsToRevisitInCurrentChunk = new Set<string>();
            }
            chunkPoints.forEach(point => curriculumState.pointsToRevisitInCurrentChunk!.add(point.text));
        }
    }
    return { kcDelta: appliedDelta };
}

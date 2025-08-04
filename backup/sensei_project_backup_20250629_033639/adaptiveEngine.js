/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { logger, DEBUG_FLAGS } from './logger';
export const MISCONCEPTION_IDS = [
    "Misconception_LoopingModel", "Misconception_MagicModel", "Misconception_BaseCaseOffByOne",
    "Misconception_StackOrderError", "Misconception_ParametersDontChange", "Misconception_ReturnValuesLost"
];
// --- INITIALIZATION ---
export function initializeLearnerModel() {
    const now = new Date().toISOString();
    const initialKCs = {
        "KC_GeneralRecursionDefinition": 0.05
    };
    const initialKCMasteryLastUpdated = {
        "KC_GeneralRecursionDefinition": now
    };
    const initialMisconceptions = {};
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
        awardedKcForPhasePoints: new Set(), // Initialize set for awarded KCs
    };
}
// --- START: Stateful Update Logic ---
// Maps for converting categorical states to numbers for weighted calculations.
const THREE_LEVEL_MAP = { 'Low': 0, 'Medium': 1, 'High': 2 };
const REVERSE_THREE_LEVEL_MAP = ['Low', 'Medium', 'High'];
const FOUR_LEVEL_MAP = { 'Low': 0, 'Medium': 1, 'High': 2, 'Very High': 3 };
const REVERSE_FOUR_LEVEL_MAP = ['Low', 'Medium', 'High', 'Very High'];
const ENGAGEMENT_MAP = { 'Waning': 0, 'Low': 1, 'Medium': 2, 'High': 3 };
const REVERSE_ENGAGEMENT_MAP = ['Waning', 'Low', 'Medium', 'High'];
const HELP_SEEKING_MAP = { 'None': 0, 'Low': 1, 'Medium': 2, 'High': 3 };
const REVERSE_HELP_SEEKING_MAP = ['None', 'Low', 'Medium', 'High'];
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
function dynamicCategoricalUpdate(previousValue, newValue, valueToNumberMap, numberToValueMap) {
    const previousNum = valueToNumberMap[previousValue];
    const newNum = valueToNumberMap[newValue];
    if (previousNum === undefined || newNum === undefined) {
        return newValue; // Fallback if a value is invalid
    }
    // Asymmetrical weighted average
    const resultNum = (newNum > previousNum)
        ? (0.4 * previousNum) + (0.6 * newNum) // Improving: favor the new state
        : (0.7 * previousNum) + (0.3 * newNum); // Declining or same: favor the previous state
    const roundedIndex = Math.round(resultNum);
    const clampedIndex = Math.max(0, Math.min(roundedIndex, numberToValueMap.length - 1));
    return numberToValueMap[clampedIndex];
}
// --- UPDATE LOGIC ---
function updateKC(model, kcName, change, isPhaseKc = false) {
    if (!model.KCs[kcName] && change > 0) {
        model.KCs[kcName] = 0;
    }
    if (model.KCs[kcName] !== undefined) {
        if (isPhaseKc) { // For phase KCs, we are summing up, ensure it doesn't exceed a practical max like 1.0 from summation
            model.KCs[kcName] = Math.min(1.0, model.KCs[kcName] + change);
        }
        else { // For other KCs, standard update
            model.KCs[kcName] = Math.min(1.0, Math.max(0.0, model.KCs[kcName] + change));
        }
        model.KCMasteryLastUpdated[kcName] = new Date().toISOString();
    }
    else if (change > 0) {
        model.KCs[kcName] = Math.min(1.0, Math.max(0.0, change)); // Initial assignment can be direct for positive change
        model.KCMasteryLastUpdated[kcName] = new Date().toISOString();
    }
}
function updateMisconception(model, mcName, change) {
    if (model.Misconceptions[mcName] !== undefined) {
        model.Misconceptions[mcName] = Math.min(1.0, Math.max(0.0, model.Misconceptions[mcName] + change));
    }
}
function mapAnalysisValue(value, defaultValue) {
    return value === 'Uncertain' ? defaultValue : value;
}
function normalizeContentPointText(text) {
    // Removes markdown characters like *, _, `, " and trims whitespace.
    // This makes the comparison robust to formatting inconsistencies from the LLM.
    return text.replace(/[*_`"]/g, '').trim();
}
export function updateLearnerModel(userInput, analysis, currentModel, expectedContentPointTextsForCurrentChunk, // Renamed for clarity, stores TEXT of points
curriculumState) {
    const modelAsPlainObject = JSON.parse(JSON.stringify(currentModel));
    const newAwardedKcForPhasePoints = new Set(currentModel.awardedKcForPhasePoints || []);
    const model = {
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
        // 2. Cognitive Load (Stateful Update)
        const newIntrinsicLoad = mapAnalysisValue(analysis.cognitive_load_indicators.perceived_intrinsic_difficulty, model.CognitiveLoad.EstimatedIntrinsic);
        model.CognitiveLoad.EstimatedIntrinsic = dynamicCategoricalUpdate(model.CognitiveLoad.EstimatedIntrinsic, newIntrinsicLoad, FOUR_LEVEL_MAP, REVERSE_FOUR_LEVEL_MAP);
        const newExtraneousLoad = mapAnalysisValue(analysis.cognitive_load_indicators.extraneous_load_signals, model.CognitiveLoad.EstimatedExtraneous);
        model.CognitiveLoad.EstimatedExtraneous = dynamicCategoricalUpdate(model.CognitiveLoad.EstimatedExtraneous, newExtraneousLoad, FOUR_LEVEL_MAP, REVERSE_FOUR_LEVEL_MAP);
        if (analysis.primary_intent === 'ExpressingUnderstanding' && model.AffectiveState.Confusion === 'Low' && model.AffectiveState.Frustration === 'Low') {
            model.CognitiveLoad.EstimatedGermane = 'High';
        }
        else if (model.AffectiveState.Confusion === 'High' || model.AffectiveState.Frustration === 'High') {
            model.CognitiveLoad.EstimatedGermane = 'Low';
        }
        else {
            model.CognitiveLoad.EstimatedGermane = 'Medium';
        }
        // 3. SRL Indicators (Stateful Update)
        const newPlanningObserved = mapAnalysisValue(analysis.srl_indicators.planning_observed, model.SRL_Indicators.PlanningObserved);
        model.SRL_Indicators.PlanningObserved = dynamicCategoricalUpdate(model.SRL_Indicators.PlanningObserved, newPlanningObserved, THREE_LEVEL_MAP, REVERSE_THREE_LEVEL_MAP);
        const newMonitoringObserved = mapAnalysisValue(analysis.srl_indicators.monitoring_observed, model.SRL_Indicators.MonitoringObserved);
        model.SRL_Indicators.MonitoringObserved = dynamicCategoricalUpdate(model.SRL_Indicators.MonitoringObserved, newMonitoringObserved, THREE_LEVEL_MAP, REVERSE_THREE_LEVEL_MAP);
        const newHelpSeeking = mapAnalysisValue(analysis.srl_indicators.help_seeking_style, model.SRL_Indicators.HelpSeekingAppropriateness);
        model.SRL_Indicators.HelpSeekingAppropriateness = dynamicCategoricalUpdate(model.SRL_Indicators.HelpSeekingAppropriateness, newHelpSeeking, HELP_SEEKING_MAP, REVERSE_HELP_SEEKING_MAP);
        model.SRL_Indicators.StrategyUse = analysis.srl_indicators.strategy_hint.filter(s => s !== "None" && s !== "Uncertain");
        // 4. Misconceptions (standard update logic)
        analysis.misconception_hints.forEach(hint => {
            if (MISCONCEPTION_IDS.includes(hint.id)) {
                let change = 0;
                if (hint.likelihood === 'High')
                    change = 0.3;
                else if (hint.likelihood === 'Medium')
                    change = 0.15;
                else if (hint.likelihood === 'Low' && model.Misconceptions[hint.id] > 0.05)
                    change = -0.05;
                updateMisconception(model, hint.id, change);
                if (hint.id === "Misconception_LoopingModel" && (hint.likelihood === 'High' || hint.likelihood === 'Medium')) {
                    model.MentalModelState.InferredModelType = "Non-Viable Looping Model";
                    model.MentalModelState.Consistency = hint.likelihood === 'High' ? 'High' : 'Medium';
                }
                else if (model.MentalModelState.InferredModelType === "Non-Viable Looping Model" && hint.id === "Misconception_LoopingModel" && hint.likelihood === 'Low') {
                    model.MentalModelState.InferredModelType = "Emerging Recursive Model";
                }
            }
        });
        // 5. Knowledge Components (Non-Phase Specific)
        analysis.knowledge_component_references.forEach(ref => {
            if (ref.kc_id !== model.CurrentTask.ID) {
                let change = 0;
                if (ref.understanding_signal === 'Positive')
                    change = 0.12;
                else if (ref.understanding_signal === 'Negative')
                    change = -0.07;
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
        if (!model.contentPointsCoverage)
            model.contentPointsCoverage = {};
        if (expectedContentPointTextsForCurrentChunk) {
            expectedContentPointTextsForCurrentChunk.forEach(pointText => {
                if (!model.contentPointsCoverage[pointText]) {
                    model.contentPointsCoverage[pointText] = {
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
            model.awardedKcForPhasePoints = new Set();
        }
        if (curriculumState && analysis.key_content_point_assessment && expectedContentPointTextsForCurrentChunk) {
            const isConfidentUnderstanding = analysis.primary_intent === 'ExpressingUnderstanding' &&
                model.AffectiveState.Confidence === 'High' &&
                model.AffectiveState.Confusion === 'Low';
            if (!curriculumState.pointsToRevisitInCurrentChunk) {
                curriculumState.pointsToRevisitInCurrentChunk = new Set();
            }
            analysis.key_content_point_assessment.forEach(assessment => {
                const normalizedAssessmentPointId = normalizeContentPointText(assessment.point_id);
                const verbatimPointText = expectedContentPointTextsForCurrentChunk.find(expectedText => normalizeContentPointText(expectedText) === normalizedAssessmentPointId);
                if (verbatimPointText) { // verbatimPointText is string
                    // *** HIGH-WATER MARK LOGIC START ***
                    const newAnalysisScore = (typeof assessment.understanding_score === 'number' && !isNaN(assessment.understanding_score))
                        ? Math.max(0.0, Math.min(1.0, assessment.understanding_score))
                        : 0.0;
                    const previousScore = model.contentPointsCoverage?.[verbatimPointText]?.understanding_score || 0.0;
                    const effectiveScore = Math.max(newAnalysisScore, previousScore);
                    const currentChunkTeachingPoints = (curriculumState.teachingPlanForPhase && curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex])
                        ? curriculumState.teachingPlanForPhase[curriculumState.currentTeachingChunkIndex]
                        : [];
                    const teachingPointObject = currentChunkTeachingPoints.find(tp => tp.text === verbatimPointText);
                    if (teachingPointObject && teachingPointObject.kcValue > 0 && effectiveScore > previousScore) {
                        const awardedKc = (effectiveScore - previousScore) * teachingPointObject.kcValue;
                        updateKC(model, phaseKCId, awardedKc, true);
                        if (DEBUG_FLAGS.learner_analysis_debug) {
                            logger.warn(`Phase KC Update: Awarded ${awardedKc.toFixed(4)} for improving from ${previousScore.toFixed(2)} to ${effectiveScore.toFixed(2)} on "${verbatimPointText}". New '${phaseKCId}' mastery: ${model.KCs[phaseKCId].toFixed(4)}`);
                        }
                        // Update KC progress bar with new mastery level
                        const updatedKCMastery = model.KCs[phaseKCId];
                        // Update KC progress bar with new mastery level
                        if (typeof window.updateKCProgressBar === 'function') {
                            window.updateKCProgressBar(updatedKCMastery);
                        }
                    }
                    // Determine if the point is "covered" for progression purposes
                    if (effectiveScore >= 0.7) { // Use effective score for progression
                        curriculumState.coveredPointsInCurrentChunk.add(verbatimPointText); // verbatimPointText is string
                        curriculumState.pointsToRevisitInCurrentChunk.delete(verbatimPointText); // verbatimPointText is string
                    }
                    else {
                        curriculumState.coveredPointsInCurrentChunk.delete(verbatimPointText); // Ensure it's not marked as covered if below threshold
                        curriculumState.pointsToRevisitInCurrentChunk.add(verbatimPointText); // verbatimPointText is string
                    }
                    model.contentPointsCoverage[verbatimPointText] = {
                        coverage: assessment.coverage,
                        understanding_score: effectiveScore, // Store the new high-water mark
                    };
                    // *** HIGH-WATER MARK LOGIC END ***
                }
                else {
                    logger.warn(`Could not match assessment point_id "${assessment.point_id}" to any expected content point in the current chunk.`);
                }
            });
        }
        // 6. Learning Trajectory 
        let positiveKCSignals = analysis.knowledge_component_references.filter(ref => ref.understanding_signal === 'Positive').length;
        let negativeKCSignals = analysis.knowledge_component_references.filter(ref => ref.understanding_signal === 'Negative').length;
        if (positiveKCSignals > negativeKCSignals && model.AffectiveState.Confidence !== 'Low' && model.AffectiveState.Confusion === 'Low') {
            model.LearningTrajectory.RecentPerformanceTrend = 'Improving';
        }
        else if (analysis.primary_intent === 'ExpressingConfusion' || model.AffectiveState.Confusion === 'High' || model.AffectiveState.Frustration === 'High' || negativeKCSignals > positiveKCSignals) {
            if (model.LearningTrajectory.InteractionCounter_On_Current_Topic > 0) {
                model.LearningTrajectory.RecentPerformanceTrend = 'Stalled_On_Current_Topic';
            }
            else {
                model.LearningTrajectory.RecentPerformanceTrend = 'Declining';
            }
        }
        else {
            model.LearningTrajectory.RecentPerformanceTrend = 'Stable';
        }
    }
    else {
        const inputLower = userInput.toLowerCase();
        if (inputLower.includes("stuck") || inputLower.includes("confused") || inputLower.includes("don't understand")) {
            model.AffectiveState.Confusion = 'High';
            model.AffectiveState.Confidence = 'Low';
            model.AffectiveState.Frustration = 'Medium';
        }
        else if (inputLower.includes("got it") || inputLower.includes("makes sense") || inputLower.includes("clear now")) {
            model.AffectiveState.Confusion = 'Low';
            model.AffectiveState.Confidence = 'High';
            model.LearningTrajectory.RecentPerformanceTrend = 'Improving';
        }
    }
    // ZPD Estimate
    if (model.LearningTrajectory.RecentPerformanceTrend === 'Improving' && model.AffectiveState.Confidence === 'High') {
        model.ZPD_Estimate.NextComplexity = 'Slightly Higher';
        model.ZPD_Estimate.ScaffoldingNeed = 'Low';
    }
    else if (model.LearningTrajectory.RecentPerformanceTrend === 'Stalled_On_Current_Topic' || model.AffectiveState.Frustration === 'High') {
        model.ZPD_Estimate.NextComplexity = 'Slightly Lower';
        model.ZPD_Estimate.ScaffoldingNeed = 'Very High';
    }
    else if (model.AffectiveState.Confusion === 'High' || model.AffectiveState.Confidence === 'Low') {
        model.ZPD_Estimate.NextComplexity = 'Same';
        model.ZPD_Estimate.ScaffoldingNeed = 'High';
    }
    else {
        model.ZPD_Estimate.NextComplexity = 'Same';
        model.ZPD_Estimate.ScaffoldingNeed = 'Medium';
    }
    return model;
}

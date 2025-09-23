/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from './logger';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ComprehensiveAnalysisResultType, MISCONCEPTION_IDS } from "./adaptiveEngine";
import { TeachingPoint, PHASE_KC_TOTAL, Phase } from "./curriculum";
import {
    GET_ARCHETYPE_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION,
    GET_COMPREHENSIVE_ANALYSIS_PROMPT_FUNCTION,
    GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT
} from "./prompts";
import { 
    TEACHING_PLAN_GENERATION_CONFIG,
    COMPREHENSIVE_ANALYSIS_CONFIG,
    PEDAGOGICAL_DIRECTIVE_GENERATION_CONFIG
} from './model_usage';

function logTeachingPlanRequest(event: string, payload: Record<string, unknown>): void {
    logger.info('[TEACHING_PLAN_VALIDATION]', { event, ...payload });
}

function logSocraticPlanValidation(event: string, payload: Record<string, unknown>): void {
    logger.info('[SOCRATIC_PLAN_VALIDATION]', { event, ...payload });
}

export function parseGeminiJsonResponse(jsonString: string): ComprehensiveAnalysisResultType | null {
    let cleanedJsonString = jsonString.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = cleanedJsonString.match(fenceRegex);
    if (match && match[2]) {
        cleanedJsonString = match[2].trim();
    }

    try {
        const parsed = JSON.parse(cleanedJsonString);
        return parsed as ComprehensiveAnalysisResultType;
    } catch (error) {
        logger.error("Failed to parse JSON response from Gemini for Analysis:", error);
        logger.error("Original string that failed parsing (Analysis):", jsonString);
        return null;
    }
}

export async function llmExtractAndPlanTeachingOrder(
    ai: GoogleGenAI,
    textToProcess: string,
    phase: Phase,
    moduleTitle?: string,
    moduleGoal?: string,
    conceptsSummary?: string
): Promise<TeachingPoint[][] | null> {
    if (!ai) {
        logger.error("GoogleGenAI instance not provided to llmExtractAndPlanTeachingOrder.");
        return null;
    }

    if (phase === 'Socratic') {
        logSocraticPlanValidation('phase-detected', {
            moduleTitleProvided: !!moduleTitle,
            moduleGoalProvided: !!moduleGoal,
            conceptsProvided: !!conceptsSummary
        });
    }

    let prompt: string;
    if (phase === 'Socratic') {
        // Extract module info from the combined text if not provided as parameters
        let extractedTitle = moduleTitle;
        let extractedGoal = moduleGoal;
        let extractedConcepts = conceptsSummary;
        
        if (!extractedTitle || !extractedGoal || !extractedConcepts) {
            // Extract from combined text
            const titleMatch = textToProcess.match(/Module Title: (.+?)(?:\n|$)/);
            const goalMatch = textToProcess.match(/Module Goal:\n(.+?)(?:\n\n|$)/s);
            const conceptsMatch = textToProcess.match(/All Module Concepts:\n([\s\S]+?)(?:\nSocratic Instructions|$)/);
            
            const parsedTitle = titleMatch?.[1]?.trim();
            if (parsedTitle) {
                extractedTitle = parsedTitle;
            }
            const parsedGoal = goalMatch?.[1]?.trim();
            if (parsedGoal) {
                extractedGoal = parsedGoal;
            }
            const conceptsSection = conceptsMatch?.[1];
            if (conceptsSection) {
                // Extract concept titles from the concepts section
                const conceptTitles = Array.from(conceptsSection.matchAll(/Concept \d+: (.+?)(?:\n|$)/g))
                    .map(match => match[1]?.trim())
                    .filter((title): title is string => Boolean(title && title.length > 0));
                if (conceptTitles.length > 0) {
                    extractedConcepts = conceptTitles.join(', ');
                }
            }
            const goalPreview = extractedGoal ? extractedGoal.substring(0, 120) : '';
            const conceptCount = extractedConcepts ? extractedConcepts.split(',').filter(item => item.trim().length > 0).length : 0;
            logSocraticPlanValidation('metadata-extracted', {
                title: extractedTitle || '',
                goalPreview,
                conceptCount
            });
        }
        
        prompt = GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT(textToProcess, extractedTitle || '', extractedGoal || '', extractedConcepts || '');
    } else {
        prompt = GET_ARCHETYPE_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION(textToProcess);
    }

    try {
        const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: TEACHING_PLAN_GENERATION_CONFIG.modelName, 
            contents: [{ parts: [{ text: prompt }] }],
            config: TEACHING_PLAN_GENERATION_CONFIG.config
        });
        const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const durationMs = endTime - startTime;
        logTeachingPlanRequest('generation-complete', {
            durationMs: Number(durationMs.toFixed(2)),
            model: TEACHING_PLAN_GENERATION_CONFIG.modelName,
            isSocraticContent: phase === 'Socratic',
            promptLength: prompt.length
        });
        const jsonText = response.text;

        let cleanedJsonString = jsonText.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = cleanedJsonString.match(fenceRegex);
        if (match && match[2]) {
            cleanedJsonString = match[2].trim();
        }
        const parsed = JSON.parse(cleanedJsonString);

        // Handle Socratic response structure
        if (phase === 'Socratic' && parsed && parsed.detected_category && parsed.teaching_plan) {
            // Extract the teaching plan with Socratic metadata
            const socraticPlan = parsed.teaching_plan;
            if (Array.isArray(socraticPlan) && socraticPlan.length > 0 && 
                Array.isArray(socraticPlan[0]) && socraticPlan[0].length > 0) {
                
                const socraticItem = socraticPlan[0][0];
                const guidance = socraticItem.interactionGuidance;
                const completionTriggers = Array.isArray(guidance?.completionTriggers) ? guidance!.completionTriggers.length : 0;
                logSocraticPlanValidation('response-metadata', {
                    category: parsed.detected_category || 'unknown',
                    expectedTurns: guidance?.expectedTurns ?? null,
                    completionTriggerCount: completionTriggers
                });
                
                // Transform Socratic plan to standard TeachingPoint format
                // The plan already has kcValue from the prompt (0.65)
                const detectedCategory = typeof parsed.detected_category === 'string' ? parsed.detected_category : undefined;
                const transformedPlan: TeachingPoint[][] = socraticPlan.map((chunk: any[]) =>
                    chunk.map((item: any) => {
                        const point: TeachingPoint = {
                            text: item.text,
                            kcValue: item.kcValue || 0.65,
                            isSocraticIntent: item.isSocraticIntent,
                            interactionGuidance: item.interactionGuidance
                        };
                        if (detectedCategory) {
                            point.socraticMetadata = { detectedCategory };
                        }
                        return point;
                    })
                );
                
                return transformedPlan;
            } else {
                logger.error('Sensei:[SOCRATIC_V4] Invalid Socratic teaching plan structure:', parsed);
                return null;
            }
        }
        
        // Handle standard teaching plan response
        if (parsed && Array.isArray(parsed.teaching_plan)) {
            
            // Validate structure: array of arrays of objects with text only (no kc_value)
            const isValidPlan = parsed.teaching_plan.every((chunk: any) =>
                Array.isArray(chunk) && 
                chunk.length >= 1 && // Remove chunk size constraint, just ensure not empty
                chunk.every((item: any) =>
                    typeof item === 'object' && item !== null &&
                    typeof item.text === 'string'
                    // No longer expect kc_value from LLM
                )
            );

            if (isValidPlan) {
                // Calculate total teaching points for uniform KC distribution
                const totalNumChunks = parsed.teaching_plan.length;
                const totalNumPoints = parsed.teaching_plan.reduce((sum: number, chunk: any[]) => sum + chunk.length, 0);
                // SECURITY: Validate bounds to prevent division by zero and extreme values (CWE-369)
                if (totalNumPoints <= 0) {
                    logger.error('Invalid teaching plan - zero or negative teaching points:', totalNumPoints);
                    return null;
                }
                // [SEMANTIC_FIX] Check chunks, not teaching points - this was the bug!
                if (totalNumChunks > 10) {
                    logger.error(`Suspiciously large teaching plan detected: ${totalNumChunks} CHUNKS exceeds limit of 10 chunks`);
                    return null;
                }
                
                const uniformKcValue = PHASE_KC_TOTAL / totalNumPoints;

                // Transform to TeachingPoint[][] with calculated kcValue
                const transformedPlan: TeachingPoint[][] = parsed.teaching_plan.map((chunk: any[]) =>
                    chunk.map((item: any) => ({
                        text: item.text,
                        kcValue: uniformKcValue // Calculated uniform KC value
                    }))
                );

                // OPTION 2 FIX: Redistribute KC to exclude titles (first item in each chunk)
                // The first teaching point in each chunk is the concept title by design
                // Titles should not contribute to KC since they're duplicated across chunks

                // Count non-title items (all items except first in each chunk)
                const numTitles = totalNumChunks; // One title per chunk
                const numNonTitlePoints = totalNumPoints - numTitles;

                if (numNonTitlePoints > 0) {
                    // Calculate new KC value for non-title items
                    const adjustedKcValue = PHASE_KC_TOTAL / numNonTitlePoints;

                    // Apply the redistribution
                    transformedPlan.forEach((chunk, chunkIndex) => {
                        chunk.forEach((item, itemIndex) => {
                            if (itemIndex === 0) {
                                // First item is the title - gets no KC
                                item.kcValue = 0;
                            } else {
                                // Non-title items get the adjusted KC value
                                item.kcValue = adjustedKcValue;
                            }
                        });
                    });
                }

                return transformedPlan;
            } else {
                 logger.error("Parsed teaching_plan does not have the expected structure (items with text only):", parsed.teaching_plan);
                 return null;
            }
        }
        logger.error("Parsed JSON for teaching_plan does not match expected structure (not an array or missing 'teaching_plan' key):", parsed);
        return null;
    } catch (error) {
        if (phase === 'Socratic') {
            logger.error('Sensei:[SOCRATIC_V4] Failed to parse teaching plan:', error);
        }
        logger.error("Error getting or parsing teaching_plan from Gemini:", error);
        logger.error("Original text sent to Gemini for teaching_plan:", textToProcess);
        return null;
    }
}


export async function getAnalysisFromGemini(
    ai: GoogleGenAI,
    userInputText: string,
    lastSenseiMsg: string | null,
    currentTaskIdForAnalysis: string,
    expectedContentPointsForCurrentChunk: string[]
): Promise<ComprehensiveAnalysisResultType | null> {
    if (!ai) {
        logger.error("GoogleGenAI instance not provided to getAnalysisFromGemini.");
        return null;
    }

    const analysisPrompt = GET_COMPREHENSIVE_ANALYSIS_PROMPT_FUNCTION(
        userInputText,
        lastSenseiMsg,
        currentTaskIdForAnalysis,
        expectedContentPointsForCurrentChunk
    );

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: COMPREHENSIVE_ANALYSIS_CONFIG.modelName,
            contents: [{ parts: [{ text: analysisPrompt }] }],
            config: COMPREHENSIVE_ANALYSIS_CONFIG.config
        });
        const jsonText = response.text;

        const parsedResult = parseGeminiJsonResponse(jsonText);

        return parsedResult;
    } catch (error) {
        logger.error("Error getting analysis from Gemini:", error);
        return null;
    }
}

export async function generateDirectiveFromMetaPrompt(ai: GoogleGenAI, metaPrompt: string): Promise<string> {
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: PEDAGOGICAL_DIRECTIVE_GENERATION_CONFIG.modelName,
            contents: [{ parts: [{ text: metaPrompt }] }],
            config: PEDAGOGICAL_DIRECTIVE_GENERATION_CONFIG.config
        });

        const directiveText = response.text.trim();
        if (directiveText) {
            return directiveText;
        } else {
            throw new Error("Meta-prompt LLM returned an empty response.");
        }
    } catch (error) {
        logger.error("Error generating directive from meta-prompt:", error);
        // Return a safe, generic fallback directive
        return "Gently guide the learner through the next logical step in the curriculum plan with a neutral, supportive tone.";
    }
}

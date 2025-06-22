/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from './logger';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ComprehensiveAnalysisResultType, MISCONCEPTION_IDS } from "./adaptiveEngine";
import { TeachingPoint, PHASE_KC_TOTAL } from "./curriculum";
import { 
    GET_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION,
    GET_COMPREHENSIVE_ANALYSIS_PROMPT_FUNCTION
} from "./prompts";
import { 
    TEACHING_PLAN_GENERATION_CONFIG,
    COMPREHENSIVE_ANALYSIS_CONFIG,
    PEDAGOGICAL_DIRECTIVE_GENERATION_CONFIG
} from './model_usage';

const debug = false; // Set to false to turn off llmExtractAndPlanTeachingOrder logs
const debugTeachingPlanPrompt = true; // Set to true to show only teaching plan prompt logging

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

export async function llmExtractAndPlanTeachingOrder(ai: GoogleGenAI, textToProcess: string): Promise<TeachingPoint[][] | null> {
    if (!ai) {
        logger.error("GoogleGenAI instance not provided to llmExtractAndPlanTeachingOrder.");
        return null;
    }

    const prompt = GET_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION(textToProcess);

    if (debug) {
        logger.log("DEBUG: llmExtractAndPlanTeachingOrder - Text sent to LLM for planning:", {textToProcess});
        logger.log("DEBUG: llmExtractAndPlanTeachingOrder - Prompt sent to LLM:", prompt);
    }
    
    if (debugTeachingPlanPrompt) {
        logger.log("DEBUG: Teaching Plan Original Prompt:", prompt);
    }

    try {
        logger.log(`[${new Date().toISOString()}] Starting expensive call to generate teaching plan...`);
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: TEACHING_PLAN_GENERATION_CONFIG.modelName, 
            contents: [{ parts: [{ text: prompt }] }],
            config: TEACHING_PLAN_GENERATION_CONFIG.config
        });
        logger.log(`[${new Date().toISOString()}] Finished call to generate teaching plan.`);
        const jsonText = response.text;

        if (debug) {
            logger.log("DEBUG: llmExtractAndPlanTeachingOrder - Raw JSON response from LLM:", jsonText);
        }

        let cleanedJsonString = jsonText.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = cleanedJsonString.match(fenceRegex);
        if (match && match[2]) {
            cleanedJsonString = match[2].trim();
        }
        const parsed = JSON.parse(cleanedJsonString);

        if (debug) {
            logger.log("DEBUG: llmExtractAndPlanTeachingOrder - Parsed teaching_plan object:", parsed);
        }

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
                const totalPoints = parsed.teaching_plan.reduce((sum: number, chunk: any[]) => sum + chunk.length, 0);
                // SECURITY: Validate bounds to prevent division by zero and extreme values (CWE-369)
                if (totalPoints <= 0) {
                    logger.error('Invalid teaching plan - zero or negative teaching points:', totalPoints);
                    return null;
                }
                if (totalPoints > 200) {
                    logger.error('Suspiciously large teaching plan detected:', totalPoints);
                    return null;
                }
                
                const uniformKcValue = PHASE_KC_TOTAL / totalPoints;
                
                
                // Transform to TeachingPoint[][] with calculated kcValue
                const transformedPlan: TeachingPoint[][] = parsed.teaching_plan.map((chunk: any[]) =>
                    chunk.map((item: any) => ({
                        text: item.text,
                        kcValue: uniformKcValue // Calculated uniform KC value
                    }))
                );

                // Validation logging for deterministic KC calculation
                const calculatedTotalKc = transformedPlan.reduce((sum: number, chunk: TeachingPoint[]) => 
                    sum + chunk.reduce((cSum: number, tp: TeachingPoint) => cSum + tp.kcValue, 0), 0);
                
                
                if (debug) {
                    logger.log(`DEBUG: llmExtractAndPlanTeachingOrder - Validated and transformed teaching_plan. Total points: ${totalPoints}`, transformedPlan);
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
        logger.error("Error getting or parsing teaching_plan from Gemini:", error);
        logger.error("Original text sent to Gemini for teaching_plan:", textToProcess);
        if (debug) {
            logger.error("Prompt sent to Gemini for teaching_plan:", prompt);
        }
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
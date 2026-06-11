/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from './logger';
import { GoogleGenAI, GenerateContentResponse, FunctionCall } from "@google/genai";
import type { ComprehensiveAnalysisResultType } from "./adaptiveEngine";
import { TeachingPoint, Phase } from "./curriculum";
import { createBrowserCoreLlmClient } from '@sensei/core';
import { parseSenseiEnhancementResponse, type EnhancementEntry, type EnhancementInsertType, type EnhancementPayload } from '@sensei/core/enhancement';
import { getComprehensiveAnalysis, parseComprehensiveAnalysisJson, type LearnerAnalysisPhase } from '@sensei/core/learnerAnalysis';
import { buildSenseiEnhancementPrompt } from '@sensei/core/prompts/enhancement';
import { generateWrapUpAssessment as coreGenerateWrapUpAssessment, type WrapUpAssessmentPromptContext, type WrapUpAssessmentGenerationResult } from '@sensei/core/wrapUpAssessment';
import { extractAndPlanTeachingOrder } from '@sensei/core/teachingPlan';
import {
    PEDAGOGICAL_DIRECTIVE_GENERATION_CONFIG,
    TEACHING_PLAN_GENERATION_CONFIG,
    TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED
} from './model_usage';

export type { EnhancementEntry, EnhancementInsertType, EnhancementPayload };

export interface EnhancementRequest {
    originalMarkdown: string;
    wordCount: number;
}

function logTeachingPlanRequest(event: string, payload: Record<string, unknown>): void {
    logger.info('[TEACHING_PLAN_VALIDATION]', { event, ...payload });
}

function logSocraticPlanValidation(event: string, payload: Record<string, unknown>): void {
    logger.info('[SOCRATIC_PLAN_VALIDATION]', { event, ...payload });
}

export function parseGeminiJsonResponse(jsonString: string): ComprehensiveAnalysisResultType | null {
    const parsed = parseComprehensiveAnalysisJson(jsonString);
    if (!parsed) {
        logger.error("Failed to parse JSON response from Gemini for Analysis:");
        logger.error("Original string that failed parsing (Analysis):", jsonString);
    }
    return parsed;
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

    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const llmClient = createBrowserCoreLlmClient(ai);
    const result = await extractAndPlanTeachingOrder(llmClient, {
        textToProcess,
        phase,
        moduleTitle,
        moduleGoal,
        conceptsSummary,
        itemBasedPromptEnabled: TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED
    });
    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const durationMs = endTime - startTime;

    logTeachingPlanRequest('generation-complete', {
        durationMs: Number(durationMs.toFixed(2)),
        model: TEACHING_PLAN_GENERATION_CONFIG.modelName,
        isSocraticContent: phase === 'Socratic',
        inputLength: textToProcess.length,
        itemBasedPromptEnabled: TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED,
        chunkCount: Array.isArray(result) ? result.length : 0
    });

    if (phase === 'Socratic' && Array.isArray(result) && result.length > 0 && Array.isArray(result[0]) && result[0].length > 0) {
        const firstPoint = result[0][0];
        const guidance = firstPoint?.interactionGuidance;
        const completionTriggerCount = Array.isArray(guidance?.completionTriggers) ? guidance.completionTriggers.length : 0;
        logSocraticPlanValidation('response-metadata', {
            category: firstPoint?.socraticMetadata?.detectedCategory || 'unknown',
            expectedTurns: guidance?.expectedTurns ?? null,
            completionTriggerCount
        });
    }

    return result;
}

function extractApiErrorDetails(error: unknown): Record<string, unknown> | null {
    if (error && typeof error === 'object') {
        const maybeResponse = (error as any).response;
        if (maybeResponse && typeof maybeResponse === 'object') {
            const errorObj = (maybeResponse as any).error ?? maybeResponse;
            if (errorObj && typeof errorObj === 'object') {
                const { code, status, message, details } = errorObj;
                return { code, status, message, details };
            }
        }
        const status = (error as any).status ?? (error as any).code;
        const message = (error as any).message ?? String(error);
        if (status || message) {
            return { status, message };
        }
    }
    return null;
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
    try {
        const llmClient = createBrowserCoreLlmClient(ai);
        if (!llmClient) {
            logger.error("CoreLlmClient not available in browser for getAnalysisFromGemini.");
            return null;
        }
        const rawPhase = (window as any).curriculumState?.currentPhase || 'Unknown';
        const phase: LearnerAnalysisPhase =
            rawPhase === 'Socratic' || rawPhase === 'IntroIllustrate' || rawPhase === 'Solidify' ? rawPhase : 'Unknown';
        const analysisResult = await getComprehensiveAnalysis(llmClient, {
            userInputText,
            lastSenseiMsg,
            currentTaskIdForAnalysis,
            expectedContentPointsForCurrentChunk,
            phase
        });
        return analysisResult;
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

export async function generateWrapUpAssessment(
    ai: GoogleGenAI,
    moduleId: string,
    promptContext: WrapUpAssessmentPromptContext
): Promise<WrapUpAssessmentGenerationResult | null> {
    if (!ai) {
        logger.error('[WRAP_UP_ASSESSMENT] request-fail', { moduleId, reason: 'GoogleGenAI instance missing' });
        return null;
    }

    const llmClient = createBrowserCoreLlmClient(ai);
    return coreGenerateWrapUpAssessment(llmClient, moduleId, promptContext);
}

type GeminiFunctionCallPayload = {
    name?: string;
    args?: unknown;
};

function extractFunctionCall(response: GenerateContentResponse): GeminiFunctionCallPayload | null {
    const calls = response.functionCalls as FunctionCall[] | undefined;
    if (Array.isArray(calls) && calls.length > 0) {
        return calls[0] ?? null;
    }
    return null;
}

export async function requestSenseiEnhancement(
    ai: GoogleGenAI | null,
    request: EnhancementRequest
): Promise<EnhancementPayload | null> {
    if (!ai) {
        logger.error('[ENHANCE] Enhancement request aborted: AI not initialized');
        return null;
    }

    const llmClient = createBrowserCoreLlmClient(ai);
    if (!llmClient) {
        logger.error('[ENHANCE] Enhancement request aborted: Core browser LLM client unavailable');
        return null;
    }

    const prompt = buildSenseiEnhancementPrompt(request.originalMarkdown);

    logger.info('[ENHANCE] Enhancement request started', {
        wordCount: request.wordCount
    });

    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

    try {
        const text = await llmClient.callText(prompt, {
            task: 'sensei_enhancement'
        });

        const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const latencyMs = Number((end - start).toFixed(2));
        const payload = parseSenseiEnhancementResponse(text);

        if (!payload) {
            logger.error('[ENHANCE] Enhancement response parsing failed');
            return null;
        }

        if (payload.enhancements.length === 0) {
            logger.info('[ENHANCE] Enhancement request returned no additions', {
                latencyMs
            });
        } else {
            logger.info('[ENHANCE] Enhancement request succeeded', {
                latencyMs,
                additions: payload.enhancements.length
            });
        }

        return payload;
    } catch (error) {
        logger.error('[ENHANCE] Enhancement request failed', {
            errorName: error instanceof Error ? error.name : typeof error
        });
        return null;
    }
}

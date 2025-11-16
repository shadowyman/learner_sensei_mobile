/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const WRAP_UP_ASSESSMENT_DEBUG_DEFAULT = false;
const WRAP_UP_ASSESSMENT_DEBUG_FLAG = false;

import { logger } from './logger';
import { GoogleGenAI, GenerateContentResponse, FunctionCall } from "@google/genai";
import { ComprehensiveAnalysisResultType, MISCONCEPTION_IDS } from "./adaptiveEngine";
import { TeachingPoint, PHASE_KC_TOTAL, Phase } from "./curriculum";
import {
    GET_ARCHETYPE_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION,
    GET_COMPREHENSIVE_ANALYSIS_PROMPT_FUNCTION,
    GET_ITEM_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION,
    GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT,
    buildSenseiEnhancementPrompt,
    buildWrapUpAssessmentPrompt,
    WrapUpAssessmentPromptContext
} from "./prompts";
import {
    TEACHING_PLAN_GENERATION_CONFIG,
    COMPREHENSIVE_ANALYSIS_CONFIG,
    PEDAGOGICAL_DIRECTIVE_GENERATION_CONFIG,
    TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED,
    WRAP_UP_ASSESSMENT_GENERATION_CONFIG,
    WRAP_UP_ASSESSMENT_TOOLS
} from './model_usage';
import * as ModelUsage from './model_usage';

export type EnhancementInsertType = 'append' | 'paragraph';

export interface EnhancementEntry {
    key: string;
    value: string;
    insertType: EnhancementInsertType;
    ordering?: number;
}

export interface EnhancementPayload {
    enhancements: EnhancementEntry[];
    metadata?: Record<string, unknown>;
}

export interface EnhancementRequest {
    originalMarkdown: string;
    wordCount: number;
}

export type WrapUpAssessmentQuestionType = 'snippet' | 'concept';

export interface WrapUpAssessmentQuestion {
    id: string;
    type: WrapUpAssessmentQuestionType;
    prompt: string;
    code?: string;
    choices: string[];
    correct_choice: string;
    explanation: string;
    interviewer_insight: string;
}

export interface WrapUpAssessmentGenerationResult {
    questions: WrapUpAssessmentQuestion[];
}

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
        
        prompt = GET_SOCRATIC_TEACHING_PLAN_GENERATION_PROMPT(
            textToProcess,
            extractedTitle || '',
            extractedGoal || '',
            extractedConcepts || ''
        );
    } else {
        prompt = TEACHING_PLAN_ITEM_BASED_PROMPT_ENABLED
            ? GET_ITEM_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION(textToProcess)
            : GET_ARCHETYPE_BASED_TEACHING_PLAN_GENERATION_PROMPT_FUNCTION(textToProcess);
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
                        kcValue: uniformKcValue
                    }))
                );

                return transformedPlan;
            } else {
                 logger.error("Parsed teaching_plan does not have the expected structure (items with text only):", parsed.teaching_plan);
                 return null;
            }
        }
        logger.error("Parsed JSON for teaching_plan does not match expected structure (not an array or missing 'teaching_plan' key):", parsed);
        return null;
    } catch (error) {
        const apiErrorDetails = extractApiErrorDetails(error);
        if (phase === 'Socratic') {
            logger.error('Sensei:[SOCRATIC_V4] Failed to parse teaching plan:', apiErrorDetails ?? error);
        }
        logger.error("Error getting or parsing teaching_plan from Gemini:", apiErrorDetails ?? error);
        logger.error("Original text sent to Gemini for teaching_plan:", textToProcess);
        return null;
    }
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

function coerceString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeWrapUpAssessmentQuestions(raw: unknown): WrapUpAssessmentQuestion[] {
    const sourceArray = Array.isArray((raw as any)?.questions)
        ? (raw as any).questions
        : Array.isArray(raw) ? raw : [];

    return sourceArray.map((entry: any, index: number) => {
        const prompt = coerceString(entry?.prompt);
        const choicesArray = Array.isArray(entry?.choices) ? entry.choices : [];
        const choices = choicesArray.map((choice: any) => coerceString(choice));
        const typeRaw = coerceString(entry?.type).toLowerCase();
        const question: WrapUpAssessmentQuestion = {
            id: coerceString(entry?.id) || `q${index + 1}`,
            type: typeRaw === 'snippet' ? 'snippet' : 'concept',
            prompt,
            choices,
            correct_choice: coerceString(entry?.correct_choice),
            explanation: coerceString(entry?.explanation),
            interviewer_insight: coerceString(entry?.interviewer_insight)
        };
        const code = coerceString(entry?.code);
        if (code) {
            question.code = code;
        }
        return question;
    });
}

function isWrapUpDebugEnabled(): boolean {
    if (typeof window !== 'undefined') {
        if ((window as any).__WRAP_UP_DEBUG === true) {
            return true;
        }
        if ((window as any).__WRAP_UP_DEBUG === false) {
            return false;
        }
    }
    return WRAP_UP_ASSESSMENT_DEBUG_FLAG ?? WRAP_UP_ASSESSMENT_DEBUG_DEFAULT;
}

function buildDebugAssessment(moduleTitle: string): WrapUpAssessmentGenerationResult {
    const snippetQuestions = Array.from({ length: 5 }, (_, idx) => {
        const correctMarkdown = '**Correct:** It recomputes overlapping subproblems without memoization so runtime is exponential.';
        const basePrompt = `**Debug Snippet ${idx + 1}** for _${moduleTitle}_`;
        const demoAppendix = '\n\n> Blockquote demo\n\n1. Ordered item\n2. _Italic item_\n\n- Bullet with `inline` code\n- ![Alt text](https://dummyimage.com/120x60/0f172a/ffffff&text=Img)';
        const prompt = idx === 0 ? `${basePrompt}${demoAppendix}` : basePrompt;
        return {
        id: `debug-snippet-${idx + 1}`,
        type: 'snippet' as const,
        prompt,
        code: 'int fib(int n) {\n    if (n <= 1) return n;\n    return fib(n - 1) + fib(n - 2);\n}',
        choices: [
            correctMarkdown,
            '_Incorrect_: It returns incorrect values for `n < 2` because the base case should return -1.',
            'It uses tail recursion so stack depth remains constant.',
            'It leaks memory because the recursion never hits a base case.'
        ],
        correct_choice: correctMarkdown,
        explanation: 'The classic recursive Fibonacci implementation re-explores states; memoization or iteration eliminates exponential blowup.',
        interviewer_insight: 'Interviewers expect you to contrast naive recursion with memoized or iterative variants.'
    }; });

    const conceptQuestions = Array.from({ length: 10 }, (_, idx) => {
        const correctMarkdown = '**Answer:** It lets each branch restore shared state before siblings explore.';
        return {
        id: `debug-concept-${idx + 1}`,
        type: 'concept' as const,
        prompt: `Debug Concept ${idx + 1}: Why does **post-order** processing matter?`,
        choices: [
            correctMarkdown,
            'It guarantees logarithmic complexity in balanced trees.',
            'It converts recursion into iteration automatically.',
            'It memoizes subproblems without extra storage.'
        ],
        correct_choice: correctMarkdown,
        explanation: 'Post-order ensures temporary state is cleaned up, so other branches see a pristine context.',
        interviewer_insight: 'This checks whether you can articulate branch-local state management under recursion.'
    }; });

    return { questions: [...snippetQuestions, ...conceptQuestions] };
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

    if (isWrapUpDebugEnabled()) {
        const debugPayload = buildDebugAssessment(promptContext.moduleTitle);
        logger.info('[WRAP_UP_ASSESSMENT] request-debug-skip', {
            moduleId,
            moduleTitle: promptContext.moduleTitle,
            questionCount: debugPayload.questions.length
        });
        return debugPayload;
    }

    const prompt = buildWrapUpAssessmentPrompt(promptContext);
    logger.info('[WRAP_UP_ASSESSMENT] request-start', {
        moduleId,
        moduleTitle: promptContext.moduleTitle
    });

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
        logger.info('[WRAP_UP_ASSESSMENT] request-attempt', {
            moduleId,
            moduleTitle: promptContext.moduleTitle,
            attempt
        });
        try {
            const response = await ai.models.generateContent({
                model: WRAP_UP_ASSESSMENT_GENERATION_CONFIG.modelName,
                contents: prompt,
                config: {
                    ...WRAP_UP_ASSESSMENT_GENERATION_CONFIG.config,
                    tools: WRAP_UP_ASSESSMENT_TOOLS
                }
            });

            const functionCall = extractFunctionCall(response);
            let normalizedFromTool: WrapUpAssessmentQuestion[] | null = null;
            if (functionCall && functionCall.args) {
                logger.info('[WRAP_UP_ASSESSMENT] function-call-received', {
                    moduleId,
                    moduleTitle: promptContext.moduleTitle,
                    attempt,
                    functionName: functionCall.name
                });
                normalizedFromTool = normalizeWrapUpAssessmentQuestions(functionCall.args);
            } else {
                normalizedFromTool = extractQuestionsFromToolCode(response.text ?? '');
            }

            if (!normalizedFromTool || normalizedFromTool.length === 0) {
                throw new Error('Model returned no function call payload');
            }

            const orderedQuestions = reorderWrapUpAssessmentQuestions(normalizedFromTool);
            const questionCount = orderedQuestions.length;
            const snippetCount = orderedQuestions.filter(q => q.type === 'snippet').length;

            logger.info('[WRAP_UP_ASSESSMENT] request-success', {
                moduleId,
                moduleTitle: promptContext.moduleTitle,
                questionCount,
                snippetCount
            });

            return { questions: orderedQuestions };
        } catch (error) {
            lastError = error;
            logger.error('[WRAP_UP_ASSESSMENT] request-fail', {
                moduleId,
                moduleTitle: promptContext.moduleTitle,
                attempt,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    if (lastError) {
        logger.error('[WRAP_UP_ASSESSMENT] exhausted-retries', {
            moduleId,
            moduleTitle: promptContext.moduleTitle,
            error: lastError instanceof Error ? lastError.message : String(lastError)
        });
    }

    return null;
}

function stripJsonFence(text: string): string {
    const trimmed = text.trim();
    if (!trimmed.startsWith('```')) {
        return trimmed;
    }
    const fenceMatch = trimmed.match(/^```(?:\w+)?\s*\n?([\s\S]*?)\n?```$/);
    if (fenceMatch && fenceMatch[1]) {
        return fenceMatch[1].trim();
    }
    return trimmed;
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

function extractQuestionsFromToolCode(raw: string): WrapUpAssessmentQuestion[] | null {
    const trimmed = raw.trim();
    if (!trimmed) {
        return null;
    }

    try {
        const parsed = JSON.parse(trimmed) as { tool_code?: string | null };
        const toolCode = typeof parsed?.tool_code === 'string' ? parsed.tool_code : null;
        if (!toolCode) {
            return null;
        }

        const questionsIndex = toolCode.indexOf('questions=');
        if (questionsIndex === -1) {
            return null;
        }
        const arrayStart = toolCode.indexOf('[', questionsIndex);
        if (arrayStart === -1) {
            return null;
        }
        let depth = 0;
        let arrayEnd = -1;
        for (let i = arrayStart; i < toolCode.length; i += 1) {
            const char = toolCode[i];
            if (char === '[') {
                depth += 1;
            } else if (char === ']') {
                depth -= 1;
                if (depth === 0) {
                    arrayEnd = i;
                    break;
                }
            }
        }
        if (arrayEnd === -1) {
            return null;
        }

        const arrayJson = toolCode.slice(arrayStart, arrayEnd + 1);
        const parsedQuestions = JSON.parse(arrayJson);
        return normalizeWrapUpAssessmentQuestions(parsedQuestions);
    } catch (error) {
        logger.warn('[WRAP_UP_ASSESSMENT] tool-code-parse-fail', {
            error: error instanceof Error ? error.message : String(error)
        });
        return null;
    }
}

function reorderWrapUpAssessmentQuestions(
    questions: WrapUpAssessmentQuestion[]
): WrapUpAssessmentQuestion[] {
    const concepts = questions.filter(question => question.type === 'concept');
    const snippets = questions.filter(question => question.type === 'snippet');
    return [...concepts, ...snippets];
}

function normalizeEnhancementEntries(raw: any): EnhancementPayload {
    const enhancements: EnhancementEntry[] = Array.isArray(raw?.enhancements) ? raw.enhancements : [];
    const normalized: EnhancementEntry[] = [];
    for (const entry of enhancements) {
        if (!entry || typeof entry !== 'object') {
            continue;
        }
        const key = typeof entry.key === 'string' ? entry.key.trim() : '';
        const value = typeof entry.value === 'string' ? entry.value.trim() : '';
        const insertType = entry.insertType === 'append' || entry.insertType === 'paragraph' ? entry.insertType : null;
        const ordering = typeof entry.ordering === 'number' ? entry.ordering : undefined;
        if (!key || !value || !insertType) {
            continue;
        }
        if (ordering !== undefined) {
            normalized.push({ key, value, insertType, ordering });
        } else {
            normalized.push({ key, value, insertType });
        }
    }
    return {
        enhancements: normalized,
        metadata: raw && typeof raw.metadata === 'object' ? raw.metadata : undefined,
    };
}

const DEFAULT_ENHANCEMENT_REQUEST_CONFIG = {
    modelName: 'gemini-2.5-flash',
    config: {
        responseMimeType: "application/json",
        temperature: 0.4,
    },
} as const;

const ENHANCEMENT_REQUEST_CONFIG: typeof DEFAULT_ENHANCEMENT_REQUEST_CONFIG =
    (ModelUsage as { ENHANCEMENT_REQUEST_CONFIG?: typeof DEFAULT_ENHANCEMENT_REQUEST_CONFIG }).ENHANCEMENT_REQUEST_CONFIG
        ?? DEFAULT_ENHANCEMENT_REQUEST_CONFIG;

export async function requestSenseiEnhancement(
    ai: GoogleGenAI | null,
    request: EnhancementRequest
): Promise<EnhancementPayload | null> {
    if (!ai) {
        logger.error('[ENHANCE] Enhancement request aborted: AI not initialized');
        return null;
    }

    const prompt = buildSenseiEnhancementPrompt(request.originalMarkdown);

    logger.info('[ENHANCE] Enhancement request started', {
        wordCount: request.wordCount
    });

    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: ENHANCEMENT_REQUEST_CONFIG.modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: ENHANCEMENT_REQUEST_CONFIG.config
        });

        const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const latencyMs = Number((end - start).toFixed(2));
        const cleaned = stripJsonFence(response.text ?? '');

        let parsed: any;
        try {
            parsed = cleaned ? JSON.parse(cleaned) : { enhancements: [] };
        } catch (error) {
            logger.error('[ENHANCE] Enhancement response JSON parse failed', { error, raw: cleaned });
            return null;
        }

        const payload = normalizeEnhancementEntries(parsed);

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
        logger.error('[ENHANCE] Enhancement request failed', { error });
        return null;
    }
}

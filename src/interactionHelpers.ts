/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { LearnerModel } from "./adaptiveEngine";
import { updateMessageStream } from './ui';
import { MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION, USER_LAST_INPUT_PLACEHOLDER } from './prompts';
import { logger } from './logger';
import { KeyTakeawayEnhancerController } from './keyTakeawayEnhancerController';
import { requestLlmStreamViaBridge } from './mobile/webviewMessageRouter';
import { buildSocraticExecutionInstruction as buildCoreSocraticExecutionInstruction } from '@sensei/core/prompts/mainSenseiResponse';
import type { ModuleIntroductionPromptRequest } from '@sensei/core/moduleIntroduction';
import type { MainSenseiResponsePromptRequest } from '@sensei/core/mainSenseiResponse';

function logSenseiPromptValidation(event: string, payload: Record<string, unknown>): void {
    const normalizedPayload: Record<string, unknown> = { ...payload };
    if (typeof normalizedPayload.prompt === 'string') {
        normalizedPayload.promptLines = normalizedPayload.prompt.split('\n');
        delete normalizedPayload.prompt;
    }
    logger.info('[SENSEI_PROMPT_VALIDATION]', { event, ...normalizedPayload });
}
import { 
    MODULE_INTRODUCTION_CHAT_MODEL_CONFIG,
    MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG,
    MAIN_SENSEI_RESPONSE_PROMPT_OPTIONS
} from './model_usage';

function canUseNativeLlmStream(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    const channel = (window as any).ReactNativeWebView;
    return Boolean(channel && typeof channel.postMessage === 'function');
}

/**
 * Streams the introductory module message from Sensei.
 * @param chat - The persistent Chat instance.
 * @param introContext - The dynamic context for the introduction.
 * @param moduleTitleForPrompt - The title of the module to include in the initial message.
 * @param senseiMessageId - The ID of the message bubble to update.
 * @returns A promise that resolves to the full response text.
 * @throws Re-throws errors from the AI call.
 */
export async function streamModuleIntroduction(
    chat: Chat,
    introContext: string,
    moduleTitleForPrompt: string,
    senseiMessageId: string,
    options?: { enhancerController?: KeyTakeawayEnhancerController; llmStreamRequest?: ModuleIntroductionPromptRequest }
): Promise<string> {
    let fullResponseText = "";
    const enhancerController = options?.enhancerController;

    if (options?.llmStreamRequest && canUseNativeLlmStream()) {
        let nativeRequestId = '';
        const nativeText = await requestLlmStreamViaBridge({
            capability: 'moduleIntroduction',
            messageId: senseiMessageId,
            body: options.llmStreamRequest as unknown as Record<string, unknown>,
            onRequestId: (requestId) => {
                nativeRequestId = requestId;
                logger.info('[LLM_STREAM_MIGRATION] webview-mobile-stream-start', {
                    requestId,
                    capability: 'moduleIntroduction',
                    messageId: senseiMessageId
                });
            },
            onText: async (text) => {
                fullResponseText = text;
                if (enhancerController) {
                    fullResponseText = await enhancerController.onChunk(fullResponseText);
                }
                updateMessageStream(senseiMessageId, fullResponseText);
            }
        });
        logger.info('[LLM_STREAM_MIGRATION] webview-mobile-stream-complete', {
            requestId: nativeRequestId,
            capability: 'moduleIntroduction',
            messageId: senseiMessageId
        });
        if (enhancerController) {
            await enhancerController.finalize();
            return enhancerController.getLatestText();
        }
        return nativeText;
    }
    
    // Combine context with module start message
    const messageWithContext = `${introContext}

Let's begin ${moduleTitleForPrompt}.`;

    logSenseiPromptValidation('module-introduction', {
        moduleTitle: moduleTitleForPrompt,
        promptLength: messageWithContext.length
    });

    logSenseiPromptValidation('module-introduction-full-prompt', {
        prompt: messageWithContext
    });
    
    const stream = await chat.sendMessageStream({ message: messageWithContext });
    for await (const chunk of stream) {
        const chunkText = chunk.text;
        if (chunkText) {
            fullResponseText += chunkText;
            if (enhancerController) {
                fullResponseText = await enhancerController.onChunk(fullResponseText);
            }
            updateMessageStream(senseiMessageId, fullResponseText);
        }
    }
    if (enhancerController) {
        await enhancerController.finalize();
        return enhancerController.getLatestText();
    }
    return fullResponseText;
}

/**
 * Builds the complete dynamic context for Sensei's turn.
 * @returns The complete dynamic context string.
 */
export function buildSenseiDynamicSystemInstruction(
    curriculumFocusInstruction: string,
    pedagogicalGuidanceDirective: string | undefined,
    navigationContext?: string
): string {
    let isMustObey = false;
    let proseDirective = pedagogicalGuidanceDirective; // Default to the full string if parsing fails
    let tempDirective = pedagogicalGuidanceDirective || ""; // Use a non-null string for parsing

    // Step 1: Check for and strip the MUST_OBEY prefix.
    if (tempDirective.startsWith('MUST_OBEY ')) {
        isMustObey = true;
        logSenseiPromptValidation('standard-guidance-evaluated', {
            mustObey: true,
            directive: tempDirective
        });
        tempDirective = tempDirective.substring('MUST_OBEY '.length);
    }

    // Step 2: Find the first colon to separate the Action_Type from the prose.
    const colonIndex = tempDirective.indexOf(':');
    if (colonIndex !== -1) {
        // The "proseDirective" is the part *after* the first colon.
        proseDirective = tempDirective.substring(colonIndex + 1).trim();
    } else {
        // Fallback: if no colon, use the whole (partially cleaned) string as the prose.
        proseDirective = tempDirective.trim();
    }

    // Step 3: Ensure we don't pass an empty string where undefined is more semantic.
    if (!proseDirective) {
        proseDirective = undefined;
    }

    const coreInstruction = MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION(
        curriculumFocusInstruction,
        proseDirective,
        isMustObey,
        MAIN_SENSEI_RESPONSE_PROMPT_OPTIONS
    );

    if (!navigationContext) {
        return coreInstruction;
    }

    return `[NavigationContext]
${navigationContext}

${coreInstruction}`;
}

export function buildSocraticExecutionInstruction(
    teachingPlan: any,
    pedagogicalGuidance: any,
    isSystemInitialization: boolean = false,
    navigationContext?: string,
    conceptContext?: string
): string {
    const intent = teachingPlan[0][0]; // The single Socratic intent
    const guidance = intent.interactionGuidance;
    logSenseiPromptValidation('socratic-instruction-build', {
        buildType: isSystemInitialization ? 'system_initialization' : 'user_response',
        teachingPlanLength: intent.text?.length || 0,
        expectedTurns: guidance.expectedTurns,
        completionTriggerCount: guidance.completionTriggers?.length || 0
    });
    
    if (isSystemInitialization) {
        const initialInstruction = buildCoreSocraticExecutionInstruction({
            teachingPlan,
            pedagogicalGuidance,
            isSystemInitialization,
            navigationContext,
            conceptContext
        });
        logSenseiPromptValidation('socratic-initial-instruction-ready', {
            instructionLength: initialInstruction.length
        });
        return initialInstruction;
    }
    
    const isMustObey = pedagogicalGuidance.metaPrompt && 
                       pedagogicalGuidance.metaPrompt.includes('MUST_OBEY');
    logSenseiPromptValidation('socratic-guidance-evaluated', {
        mustObey: !!isMustObey
    });
    
    const subsequentTurnInstruction = buildCoreSocraticExecutionInstruction({
        teachingPlan,
        pedagogicalGuidance,
        isSystemInitialization,
        navigationContext,
        conceptContext
    });
    logSenseiPromptValidation('socratic-subsequent-instruction-ready', {
        instructionLength: subsequentTurnInstruction.length,
        mustObey: !!isMustObey
    });
    return subsequentTurnInstruction;
}

/**
 * Streams the main Sensei response to the user's input.
 * @param chat - The persistent Chat instance.
 * @param dynamicContext - The dynamic context for this turn.
 * @param currentUserInput - The user's current message text.
 * @param senseiMessageId - The ID of the message bubble to update.
 * @returns A promise that resolves to the full response text.
 * @throws Re-throws errors from the AI call.
 */
export async function streamMainSenseiResponse(
    chat: Chat,
    dynamicContext: string,
    currentUserInput: string,
    senseiMessageId: string,
    options?: { enhancerController?: KeyTakeawayEnhancerController; llmStreamRequest?: MainSenseiResponsePromptRequest }
): Promise<string> {
    let fullResponseText = "";
    const enhancerController = options?.enhancerController;

    if (options?.llmStreamRequest && canUseNativeLlmStream()) {
        let nativeRequestId = '';
        const nativeText = await requestLlmStreamViaBridge({
            capability: 'mainSenseiResponse',
            messageId: senseiMessageId,
            body: options.llmStreamRequest as unknown as Record<string, unknown>,
            onRequestId: (requestId) => {
                nativeRequestId = requestId;
                logger.info('[LLM_STREAM_MIGRATION] webview-mobile-stream-start', {
                    requestId,
                    capability: 'mainSenseiResponse',
                    messageId: senseiMessageId
                });
            },
            onText: async (text) => {
                fullResponseText = text;
                if (enhancerController) {
                    fullResponseText = await enhancerController.onChunk(fullResponseText);
                }
                updateMessageStream(senseiMessageId, fullResponseText);
            }
        });
        logger.info('[LLM_STREAM_MIGRATION] webview-mobile-stream-complete', {
            requestId: nativeRequestId,
            capability: 'mainSenseiResponse',
            messageId: senseiMessageId
        });
        if (enhancerController) {
            await enhancerController.finalize();
            return enhancerController.getLatestText();
        }
        return nativeText;
    }

    const userLine = `User: ${currentUserInput}`;
    const messageWithContext = dynamicContext.includes(USER_LAST_INPUT_PLACEHOLDER)
        ? dynamicContext.replace(USER_LAST_INPUT_PLACEHOLDER, userLine)
        : `${dynamicContext}

${userLine}`;

    logSenseiPromptValidation('main-response-requested', {
        userInputLength: currentUserInput.length,
        dynamicContextLength: dynamicContext.length
    });

    logSenseiPromptValidation('main-response-full-prompt', {
        prompt: messageWithContext
    });

    // Start streaming from LLM
    const stream = await chat.sendMessageStream({ message: messageWithContext });
    let chunkCount = 0;
    const streamStart = performance.now();
    let firstChunkLatencyMs: number | null = null;

    for await (const chunk of stream) { // chunk type is GenerateContentResponse
        const chunkText = chunk.text;
        if (chunkText) {
            if (chunkCount === 0) {
                firstChunkLatencyMs = performance.now() - streamStart;
            }
            chunkCount++;
            fullResponseText += chunkText;
            if (enhancerController) {
                fullResponseText = await enhancerController.onChunk(fullResponseText);
            }
            updateMessageStream(senseiMessageId, fullResponseText);
        }
    }
    logSenseiPromptValidation('main-response-streamed', {
        chunks: chunkCount,
        firstChunkLatencyMs,
        responseLength: fullResponseText.length
    });

    if (enhancerController) {
        await enhancerController.finalize();
        return enhancerController.getLatestText();
    }

    return fullResponseText;
}

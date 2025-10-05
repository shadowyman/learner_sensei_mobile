/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { LearnerModel } from "./adaptiveEngine";
import { updateMessageStream } from './ui';
import { MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION, buildSocraticInitialInstruction } from './prompts';
import { logger } from './logger';

function logSenseiPromptValidation(event: string, payload: Record<string, unknown>): void {
    logger.info('[SENSEI_PROMPT_VALIDATION]', { event, ...payload });
}
import { 
    MODULE_INTRODUCTION_CHAT_MODEL_CONFIG,
    MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG
} from './model_usage';

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
    senseiMessageId: string
): Promise<string> {
    let fullResponseText = "";
    
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
            updateMessageStream(senseiMessageId, fullResponseText);
        }
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
        isMustObey
    );

    if (!navigationContext) {
        return coreInstruction;
    }

    return `${coreInstruction}

[NavigationContext]
${navigationContext}`;
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
    
    // For system initialization, include full teaching plan
    if (isSystemInitialization) {
        const initialInstruction = buildSocraticInitialInstruction(teachingPlan, conceptContext);
        logSenseiPromptValidation('socratic-initial-instruction-ready', {
            instructionLength: initialInstruction.length
        });
        
        if (!navigationContext) {
            return initialInstruction;
        }

        return `${initialInstruction}

[NavigationContext]
${navigationContext}`;
    }
    
    // Check if MUST_OBEY
    const isMustObey = pedagogicalGuidance.metaPrompt && 
                       pedagogicalGuidance.metaPrompt.includes('MUST_OBEY');
    logSenseiPromptValidation('socratic-guidance-evaluated', {
        mustObey: !!isMustObey
    });
    
    if (isMustObey) {
        // Critical override - ONLY execute MUST_OBEY, ignore Socratic plan this turn
        const overrideInstruction = `[RecursiveSensei CRITICAL OVERRIDE for THIS TURN:
A high-priority situation has been detected. For this turn, you MUST IGNORE the standard Socratic dialogue plan provided below.
Your SOLE TASK is to execute the following high-priority directive with immense detail, empathy, and care. This directive takes absolute precedence.

High-Priority Directive: ${pedagogicalGuidance.metaPrompt}

(The standard Socratic dialogue plan, which you will ignore for this turn, is:
${intent.text}

You will continue with this plan in the next turn after addressing the current critical situation.)
]`;

        if (!navigationContext) {
            return overrideInstruction;
        }

        return `${overrideInstruction}

[NavigationContext]
${navigationContext}`;
    }

    // Normal Socratic turn with pedagogical guidance
    const subsequentTurnInstruction = `[RecursiveSensei Task & Checklist for THIS TURN:
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
    logSenseiPromptValidation('socratic-subsequent-instruction-ready', {
        instructionLength: subsequentTurnInstruction.length,
        mustObey: false
    });
    
    if (!navigationContext) {
        return subsequentTurnInstruction;
    }

    return `${subsequentTurnInstruction}

[NavigationContext]
${navigationContext}`;
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
    senseiMessageId: string
): Promise<string> {
    let fullResponseText = "";

    // Combine context with user input in the message
    const messageWithContext = `${dynamicContext}

User: ${currentUserInput}`;

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
            updateMessageStream(senseiMessageId, fullResponseText);
        }
    }
    logSenseiPromptValidation('main-response-streamed', {
        chunks: chunkCount,
        firstChunkLatencyMs,
        responseLength: fullResponseText.length
    });

    return fullResponseText;
}

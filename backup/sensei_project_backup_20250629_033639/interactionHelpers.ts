/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { LearnerModel } from "./adaptiveEngine";
import { updateMessageStream } from './ui';
import { MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION, buildSocraticInitialInstruction } from './prompts';
import { logger, DEBUG_FLAGS } from './logger';
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
    
    if (DEBUG_FLAGS.curriculum_debug) {
        logger.warn(`[CURRICULUM] Initial teaching prompt:`, messageWithContext);
    }
    
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
    pedagogicalGuidanceDirective: string | undefined
): string {
    let isMustObey = false;
    let proseDirective = pedagogicalGuidanceDirective; // Default to the full string if parsing fails
    let tempDirective = pedagogicalGuidanceDirective || ""; // Use a non-null string for parsing

    // Step 1: Check for and strip the MUST_OBEY prefix.
    if (tempDirective.startsWith('MUST_OBEY ')) {
        isMustObey = true;
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

    return MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION(
        curriculumFocusInstruction,
        proseDirective,
        isMustObey
    );
}

export function buildSocraticExecutionInstruction(
    teachingPlan: any,
    pedagogicalGuidance: any,
    isSystemInitialization: boolean = false
): string {
    const intent = teachingPlan[0][0]; // The single Socratic intent
    const guidance = intent.interactionGuidance;
    
    logger.info('Sensei:[SOCRATIC_V4] Building execution instruction, type:', isSystemInitialization ? 'system_initialization' : 'user_response');
    logger.info('Sensei:[SOCRATIC_V4] Teaching plan text length:', intent.text?.length || 0);
    logger.info('Sensei:[SOCRATIC_V4] Expected turns:', guidance.expectedTurns);
    logger.info('Sensei:[SOCRATIC_V4] Completion triggers count:', guidance.completionTriggers?.length || 0);
    
    // For system initialization, include full teaching plan
    if (isSystemInitialization) {
        logger.info('Sensei:[SOCRATIC_V4] System initialization - using initial instruction');
        const initialInstruction = buildSocraticInitialInstruction(teachingPlan);
        
        // Log the complete instruction being sent
        logger.info('Sensei:[SOCRATIC_V4] Complete system initialization instruction:', initialInstruction);
        
        return initialInstruction;
    }
    
    // Check if MUST_OBEY
    const isMustObey = pedagogicalGuidance.metaPrompt && 
                       pedagogicalGuidance.metaPrompt.includes('MUST_OBEY');
    
    if (isMustObey) {
        logger.info('Sensei:[SOCRATIC_V4] MUST_OBEY detected:', isMustObey);
    }
    
    if (isMustObey) {
        // Critical override - ONLY execute MUST_OBEY, ignore Socratic plan this turn
        return `[RecursiveSensei CRITICAL OVERRIDE for THIS TURN:
A high-priority situation has been detected. For this turn, you MUST IGNORE the standard Socratic dialogue plan provided below.
Your SOLE TASK is to execute the following high-priority directive with immense detail, empathy, and care. This directive takes absolute precedence.

High-Priority Directive: ${pedagogicalGuidance.metaPrompt}

(The standard Socratic dialogue plan, which you will ignore for this turn, is:
${intent.text}

You will continue with this plan in the next turn after addressing the current critical situation.)
]`;
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
    
    logger.info('Sensei:[SOCRATIC_V4] Subsequent turn instruction:', subsequentTurnInstruction);
    
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
    senseiMessageId: string
): Promise<string> {
    let fullResponseText = "";
    
    // Combine context with user input in the message
    const messageWithContext = `${dynamicContext}

User: ${currentUserInput}`;
    
    if (DEBUG_FLAGS.curriculum_debug) {
        logger.warn(`[CURRICULUM] User interaction prompt:`, messageWithContext);
    }
    
    const stream = await chat.sendMessageStream({ message: messageWithContext });
    
    for await (const chunk of stream) { // chunk type is GenerateContentResponse
        const chunkText = chunk.text;
        if (chunkText) {
            fullResponseText += chunkText;
            updateMessageStream(senseiMessageId, fullResponseText);
        }
    }
    return fullResponseText;
}
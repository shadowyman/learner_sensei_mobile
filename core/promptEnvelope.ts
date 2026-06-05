import { SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS } from './prompts/baseSensei';

export type ConversationHistoryRole = 'user' | 'sensei';

export interface ConversationHistoryEntry {
  role: ConversationHistoryRole;
  content: string;
}

export interface CapabilityPromptEnvelopeRequest {
  taskPrompt: string;
  includeBaseSystemInstruction?: boolean;
  conversationHistory?: ConversationHistoryEntry[];
}

function cleanContent(value: string): string {
  return value.replace(/\s+\n/g, '\n').trim();
}

export function buildCapabilityPromptEnvelope(request: CapabilityPromptEnvelopeRequest): string {
  const history = (request.conversationHistory || [])
    .filter((entry) => entry && typeof entry.content === 'string' && entry.content.trim().length > 0)
    .slice(-8);
  if (!request.includeBaseSystemInstruction && history.length === 0) {
    return request.taskPrompt;
  }
  const taskPrompt = cleanContent(request.taskPrompt);

  const sections: string[] = [];
  if (request.includeBaseSystemInstruction) {
    sections.push(`[RecursiveSensei Base System Instruction]
${SENSEI_SYSTEM_INSTRUCTION_BASE_PERSONA_AND_COMMITMENTS.trim()}
[/RecursiveSensei Base System Instruction]`);
  }
  if (history.length > 0) {
    const formattedHistory = history
      .map((entry, index) => `${index + 1}. ${entry.role === 'sensei' ? 'Sensei' : 'User'}: ${cleanContent(entry.content)}`)
      .join('\n\n');
    sections.push(`[Recent Conversation History]
Use this bounded transcript for continuity, pronoun resolution, example freshness, and learner-state awareness. Do not repeat prior examples unless you are explicitly extending or correcting them.

${formattedHistory}
[/Recent Conversation History]`);
  }
  sections.push(`[Current Capability Task]
${taskPrompt}
[/Current Capability Task]`);
  return sections.join('\n\n');
}

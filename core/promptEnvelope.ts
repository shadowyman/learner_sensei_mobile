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

export const MAX_CONVERSATION_HISTORY_ENTRIES = 8;
export const MAX_CONVERSATION_HISTORY_ENTRY_CHARS = 1000;
export const MAX_CONVERSATION_HISTORY_TOTAL_CHARS = 4000;

function cleanContent(value: string): string {
  return value.replace(/\s+\n/g, '\n').trim();
}

export function sanitizeConversationHistory(entries?: ConversationHistoryEntry[]): ConversationHistoryEntry[] {
  const sanitized = (entries || [])
    .filter((entry) => entry && (entry.role === 'user' || entry.role === 'sensei') && typeof entry.content === 'string')
    .map((entry) => ({
      role: entry.role,
      content: cleanContent(entry.content).slice(0, MAX_CONVERSATION_HISTORY_ENTRY_CHARS)
    }))
    .filter((entry) => entry.content.length > 0)
    .slice(-MAX_CONVERSATION_HISTORY_ENTRIES);
  const bounded: ConversationHistoryEntry[] = [];
  let remaining = MAX_CONVERSATION_HISTORY_TOTAL_CHARS;
  for (let index = sanitized.length - 1; index >= 0 && remaining > 0; index--) {
    const entry = sanitized[index];
    const content = entry.content.slice(0, remaining);
    if (content.length > 0) {
      bounded.unshift({
        role: entry.role,
        content
      });
      remaining -= content.length;
    }
  }
  return bounded;
}

export function buildCapabilityPromptEnvelope(request: CapabilityPromptEnvelopeRequest): string {
  const history = sanitizeConversationHistory(request.conversationHistory);
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

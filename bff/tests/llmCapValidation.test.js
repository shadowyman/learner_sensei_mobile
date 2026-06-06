const {
  buildSessionLimiterKey,
  validateMainSenseiCaps,
  validateSelectionSenseiCaps
} = require('../src/validation/llmCapValidation');
const config = require('../src/config');

const assertAccepted = (result, label) => {
  if (!result.success) {
    throw new Error(`${label}: expected accepted cap result, got ${JSON.stringify(result)}`);
  }
};

const assertRejected = (result, label) => {
  if (result.success || result.status !== 413 || result.code !== 'PAYLOAD_TOO_LARGE') {
    throw new Error(`${label}: expected 413 cap rejection, got ${JSON.stringify(result)}`);
  }
};

;(async () => {
  const mainPolicy = config.llmCapPolicy.capabilities.mainSensei;
  const selectionPolicy = config.llmCapPolicy.capabilities.selectionSensei;

  assertRejected(validateMainSenseiCaps({
    capability: 'mainSenseiResponse',
    payload: {
      curriculumFocus: { status: 'general' },
      currentUserInput: 'Explain recursion.',
      conversationHistory: [
        { role: 'user', content: 'u'.repeat(mainPolicy.userMessageMaxChars + 1) }
      ]
    },
    policy: mainPolicy
  }), 'main user history over cap');

  assertAccepted(validateMainSenseiCaps({
    capability: 'mainSenseiResponse',
    payload: {
      curriculumFocus: { status: 'general' },
      currentUserInput: 'Explain recursion.',
      conversationHistory: [
        { role: 'sensei', content: 's'.repeat(mainPolicy.senseiEntryMaxChars) }
      ]
    },
    policy: mainPolicy
  }), 'main long sensei history');

  assertRejected(validateSelectionSenseiCaps({
    mode: 'followUp',
    selectedText: 'base case',
    originalSenseiMessageText: 'Original context',
    initialActionType: 'explainSimpler',
    initialActionLabel: 'Simpler',
    initialResponse: { explanation: 'A base case stops recursion.' },
    modalTranscript: [
      { role: 'user', text: 'u'.repeat(selectionPolicy.userMessageMaxChars + 1) }
    ],
    question: 'Can you continue?'
  }, selectionPolicy), 'selection user transcript over cap');

  assertAccepted(validateSelectionSenseiCaps({
    mode: 'followUp',
    selectedText: 'base case',
    originalSenseiMessageText: 'Original context',
    initialActionType: 'explainSimpler',
    initialActionLabel: 'Simpler',
    initialResponse: { explanation: 'A base case stops recursion.' },
    modalTranscript: [
      { role: 'sensei', text: 's'.repeat(selectionPolicy.senseiEntryMaxChars) }
    ],
    question: 'Can you continue?'
  }, selectionPolicy), 'selection long sensei transcript');

  assertRejected(validateSelectionSenseiCaps({
    mode: 'followUp',
    selectedText: 'base case',
    originalSenseiMessageText: 'Original context',
    initialActionType: 'explainSimpler',
    initialActionLabel: 'Simpler',
    initialResponse: { explanation: 'A base case stops recursion.' },
    modalTranscript: Array.from({ length: selectionPolicy.transcriptMaxEntries + 1 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'sensei',
      text: `entry ${index}`
    })),
    question: 'Can you continue?'
  }, selectionPolicy), 'selection transcript entry count');

  const aggregateSelectionPolicy = {
    ...selectionPolicy,
    senseiEntryMaxChars: 900000
  };
  const aggregateMainPolicy = {
    ...mainPolicy,
    senseiEntryMaxChars: 900000
  };
  const aggregateEntries = [
    { role: 'sensei', text: 'a'.repeat(290000) },
    { role: 'sensei', text: 'b'.repeat(290000) },
    { role: 'sensei', text: 'c'.repeat(290000) }
  ];

  assertRejected(validateSelectionSenseiCaps({
    mode: 'followUp',
    selectedText: 'base case',
    originalSenseiMessageText: 'Original context',
    initialActionType: 'explainSimpler',
    initialActionLabel: 'Simpler',
    initialResponse: { explanation: 'A base case stops recursion.' },
    modalTranscript: aggregateEntries,
    question: 'Can you continue?'
  }, aggregateSelectionPolicy), 'selection aggregate cap');

  assertAccepted(validateMainSenseiCaps({
    capability: 'mainSenseiResponse',
    payload: {
      curriculumFocus: { status: 'general' },
      currentUserInput: 'Explain recursion.',
      conversationHistory: aggregateEntries.map((entry) => ({ role: 'sensei', content: entry.text }))
    },
    policy: aggregateMainPolicy
  }), 'main aggregate cap is higher than selection cap');

  const key = buildSessionLimiterKey('session-a', '127.0.0.1', 'agent-a');
  if (key !== 'session-a::127.0.0.1::agent-a') {
    throw new Error(`Unexpected session limiter key: ${key}`);
  }

  console.log('llm cap validation test passed');
})();

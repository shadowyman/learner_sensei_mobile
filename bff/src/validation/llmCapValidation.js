const { llmCapPolicy } = require('../config');

const CAP_VALIDATION_CODE = 'PAYLOAD_TOO_LARGE';

const defaultMainPolicy = () => llmCapPolicy.capabilities?.mainSensei || llmCapPolicy.mainSensei;
const defaultSelectionPolicy = () => llmCapPolicy.capabilities?.selectionSensei || llmCapPolicy.selectionSensei;
const defaultEnhancementPolicy = () => llmCapPolicy.capabilities?.senseiEnhancement || llmCapPolicy.senseiEnhancement;

const buildSessionLimiterKey = (sessionId, ip, userAgent) => `${sessionId || 'unknown'}::${ip || 'unknown'}::${userAgent || 'unknown'}`;

const measureStructuredText = (value) => {
  if (typeof value === 'string') {
    return value.length;
  }
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + measureStructuredText(item), 0);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((total, item) => total + measureStructuredText(item), 0);
  }
  return 0;
};

const ok = (payload) => ({ success: true, payload });

const fail = (issues, message = 'Request exceeds LLM cap policy') => ({
  success: false,
  status: 413,
  code: CAP_VALIDATION_CODE,
  message,
  issues
});

const addStringCapIssue = (issues, { capability, path, maximum, actual, role }) => {
  issues.push({
    capability,
    path,
    role,
    maximum,
    actual,
    message: `${path} exceeds ${maximum} characters.`
  });
};

const validateRoleText = ({ capability, role, field, text, policy, issues }) => {
  if (typeof text !== 'string') {
    return;
  }
  const maximum = role === 'sensei' || role === 'assistant'
    ? policy.senseiEntryMaxChars
    : policy.userMessageMaxChars;
  if (text.length > maximum) {
    addStringCapIssue(issues, {
      capability,
      path: field,
      role,
      maximum,
      actual: text.length
    });
  }
};

const validateEntries = ({ capability, entries, maxEntries, roleField, textField, policy, issues, path }) => {
  if (!Array.isArray(entries)) {
    return;
  }
  if (entries.length > maxEntries) {
    issues.push({
      capability,
      path,
      maximum: maxEntries,
      actual: entries.length,
      message: `${path} exceeds ${maxEntries} entries.`
    });
  }
  entries.forEach((entry, index) => {
    validateRoleText({
      capability,
      role: entry?.[roleField],
      field: `${path}.${index}.${textField}`,
      text: entry?.[textField],
      policy,
      issues
    });
  });
};

const assertAggregateWithinLimit = ({ capability, value, max, path, issues }) => {
  const actual = measureStructuredText(value);
  if (actual > max) {
    issues.push({
      capability,
      path,
      maximum: max,
      actual,
      message: `${path} exceeds ${max} total characters.`
    });
  }
};

const toMainHistoryLimits = (policy = defaultMainPolicy()) => ({
  maxEntries: policy.historyMaxEntries,
  userEntryChars: policy.userMessageMaxChars,
  senseiEntryChars: policy.senseiEntryMaxChars,
  totalChars: policy.aggregateMaxChars
});

const toSelectionTranscriptLimits = (policy = defaultSelectionPolicy()) => ({
  maxEntries: policy.transcriptMaxEntries,
  userEntryChars: policy.userMessageMaxChars,
  senseiEntryChars: policy.senseiEntryMaxChars,
  totalChars: policy.aggregateMaxChars
});

const validateMainTurnCaps = (text, policy = defaultMainPolicy()) => {
  const issues = [];
  validateRoleText({
    capability: 'mainSensei',
    role: 'user',
    field: 'input.text',
    text,
    policy,
    issues
  });
  return issues.length > 0 ? fail(issues, 'Main Sensei user input exceeds LLM cap policy') : ok(text);
};

const getMainLearnerInputText = (capability, payload) => {
  if (capability === 'moduleIntroduction') {
    return payload.userInputText || '';
  }
  if (capability === 'mainSenseiResponse') {
    return payload.currentUserInput || '';
  }
  return '';
};

const validateMainSenseiCaps = ({ capability, payload, policy = defaultMainPolicy() }) => {
  const issues = [];
  validateRoleText({
    capability: 'mainSensei',
    role: 'user',
    field: capability === 'moduleIntroduction' ? 'payload.userInputText' : 'payload.currentUserInput',
    text: getMainLearnerInputText(capability, payload),
    policy,
    issues
  });
  validateEntries({
    capability: 'mainSensei',
    entries: payload.conversationHistory,
    maxEntries: policy.historyMaxEntries,
    roleField: 'role',
    textField: 'content',
    policy,
    issues,
    path: 'payload.conversationHistory'
  });
  assertAggregateWithinLimit({
    capability: 'mainSensei',
    value: payload,
    max: policy.aggregateMaxChars,
    path: 'payload',
    issues
  });
  return issues.length > 0 ? fail(issues, 'Main Sensei request exceeds LLM cap policy') : ok(payload);
};

const validateStringCap = ({ capability, path, text, maximum, issues }) => {
  if (typeof text === 'string' && text.length > maximum) {
    addStringCapIssue(issues, {
      capability,
      path,
      maximum,
      actual: text.length
    });
  }
};

const validateSelectionSenseiCaps = (payload, policy = defaultSelectionPolicy()) => {
  const issues = [];
  validateStringCap({
    capability: 'selectionSensei',
    path: 'selectedText',
    text: payload.selectedText,
    maximum: policy.selectedTextMaxChars,
    issues
  });
  validateStringCap({
    capability: 'selectionSensei',
    path: 'originalSenseiMessageText',
    text: payload.originalSenseiMessageText,
    maximum: policy.originalSenseiMessageMaxChars,
    issues
  });

  if (payload.mode === 'toolbarAction') {
    validateStringCap({
      capability: 'selectionSensei',
      path: 'actionLabel',
      text: payload.actionLabel,
      maximum: policy.actionLabelMaxChars,
      issues
    });
    validateRoleText({
      capability: 'selectionSensei',
      role: 'user',
      field: 'userQuestion',
      text: payload.userQuestion,
      policy,
      issues
    });
  }

  if (payload.mode === 'followUp') {
    validateStringCap({
      capability: 'selectionSensei',
      path: 'modalConversationId',
      text: payload.modalConversationId,
      maximum: policy.modalConversationIdMaxChars,
      issues
    });
    validateStringCap({
      capability: 'selectionSensei',
      path: 'initialActionLabel',
      text: payload.initialActionLabel,
      maximum: policy.actionLabelMaxChars,
      issues
    });
    validateRoleText({
      capability: 'selectionSensei',
      role: 'user',
      field: 'initialActionUserQuestion',
      text: payload.initialActionUserQuestion,
      policy,
      issues
    });
    validateStringCap({
      capability: 'selectionSensei',
      path: 'initialResponse.suggestedTitle',
      text: payload.initialResponse?.suggestedTitle,
      maximum: policy.initialResponseTitleMaxChars,
      issues
    });
    validateRoleText({
      capability: 'selectionSensei',
      role: 'sensei',
      field: 'initialResponse.explanation',
      text: payload.initialResponse?.explanation,
      policy,
      issues
    });
    validateRoleText({
      capability: 'selectionSensei',
      role: 'sensei',
      field: 'initialResponse.rawText',
      text: payload.initialResponse?.rawText,
      policy,
      issues
    });
    validateEntries({
      capability: 'selectionSensei',
      entries: payload.modalTranscript,
      maxEntries: policy.transcriptMaxEntries,
      roleField: 'role',
      textField: 'text',
      policy,
      issues,
      path: 'modalTranscript'
    });
    validateRoleText({
      capability: 'selectionSensei',
      role: 'user',
      field: 'question',
      text: payload.question,
      policy,
      issues
    });
  }

  assertAggregateWithinLimit({
    capability: 'selectionSensei',
    value: payload,
    max: policy.aggregateMaxChars,
    path: 'payload',
    issues
  });
  return issues.length > 0 ? fail(issues, 'Selection Sensei request exceeds LLM cap policy') : ok(payload);
};

const validateEnhancementCaps = (payload, policy = defaultEnhancementPolicy()) => {
  const issues = [];
  validateStringCap({
    capability: 'senseiEnhancement',
    path: 'originalMarkdown',
    text: payload.originalMarkdown,
    maximum: policy.originalMarkdownMaxChars,
    issues
  });
  assertAggregateWithinLimit({
    capability: 'senseiEnhancement',
    value: payload,
    max: policy.aggregateMaxChars,
    path: 'payload',
    issues
  });
  return issues.length > 0 ? fail(issues, 'Sensei enhancement request exceeds LLM cap policy') : ok(payload);
};

module.exports = {
  CAP_VALIDATION_CODE,
  buildSessionLimiterKey,
  measureStructuredText,
  validateRoleText,
  validateEntries,
  assertAggregateWithinLimit,
  validateMainTurnCaps,
  validateMainSenseiCaps,
  validateSelectionSenseiCaps,
  validateEnhancementCaps,
  toMainHistoryLimits,
  toSelectionTranscriptLimits
};

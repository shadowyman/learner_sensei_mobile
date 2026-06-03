const assert = require('assert');
const TeachingPlanService = require('../src/services/teachingPlanService');

const logger = {
  info() {},
  error() {}
};

const createServiceHarness = (enabled) => {
  const calls = [];
  const geminiGateway = {
    async callText(prompt, options) {
      calls.push({ prompt, options });
      return JSON.stringify({
        teaching_plan: [
          [
            { text: 'Define the base case' }
          ]
        ]
      });
    }
  };
  const service = new TeachingPlanService({
    logger,
    geminiGateway,
    config: {
      teachingPlanItemBasedPromptEnabled: enabled
    }
  });
  return { service, calls };
};

const basePayload = {
  phase: 'IntroIllustrate',
  textToProcess: 'Concepts:\n1. Base cases\n2. Recursive steps',
  moduleTitle: 'Recursion',
  moduleGoal: 'Understand recursion',
  conceptsSummary: 'Base cases, recursive steps'
};

;(async () => {
  {
    const { service, calls } = createServiceHarness(true);
    const result = await service.generateTeachingPlan({
      session: { id: 'session-item' },
      payload: {
        ...basePayload,
        itemBasedPromptEnabled: false
      }
    });
    assert(Array.isArray(result));
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].options.task, 'teaching_plan');
    assert(calls[0].prompt.includes('Numbered Concepts as Teaching Units'));
    assert(!calls[0].prompt.includes('Topic Archetype'));
  }

  {
    const { service, calls } = createServiceHarness(false);
    const result = await service.generateTeachingPlan({
      session: { id: 'session-archetype' },
      payload: {
        ...basePayload,
        itemBasedPromptEnabled: true
      }
    });
    assert(Array.isArray(result));
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].options.task, 'teaching_plan');
    assert(calls[0].prompt.includes('Topic Archetype'));
    assert(!calls[0].prompt.includes('Numbered Concepts as Teaching Units'));
  }

  console.log('teaching plan service config test passed');
})();

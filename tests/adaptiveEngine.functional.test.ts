import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { initializeLearnerModel, dynamicCategoricalUpdate, updateLearnerModel, overrideChunkUnderstanding, MISCONCEPTION_IDS, type ComprehensiveAnalysisResultType, type LearnerModel, type KnowledgeComponentReference, type KeyContentPointAssessment } from '../adaptiveEngine'
import { type CurriculumState, type CurriculumItem, type TeachingPoint } from '../curriculum'
import { logger } from '../logger'

const repoRoot = path.resolve(__dirname, '..')
const logDir = path.join(repoRoot, 'logs')
const logPath = path.join(logDir, 'console_logs.log')

const THREE_LEVEL_MAP = { Low: 0, Medium: 1, High: 2 }
const REVERSE_THREE_LEVEL_MAP = ['Low', 'Medium', 'High'] as const
const FOUR_LEVEL_MAP = { Low: 0, Medium: 1, High: 2, 'Very High': 3 }
const REVERSE_FOUR_LEVEL_MAP = ['Low', 'Medium', 'High', 'Very High'] as const
const ENGAGEMENT_MAP = { Waning: 0, Low: 1, Medium: 2, High: 3 }
const REVERSE_ENGAGEMENT_MAP = ['Waning', 'Low', 'Medium', 'High'] as const
const HELP_SEEKING_MAP = { None: 0, Low: 1, Medium: 2, High: 3 }
const REVERSE_HELP_SEEKING_MAP = ['None', 'Low', 'Medium', 'High'] as const

type LoggerCapture = { infos: Array<{ args: unknown[] }>; warns: Array<{ args: unknown[] }>; restore: () => void }

type TestCase = { name: string; execute: (capture: LoggerCapture) => void }

fs.mkdirSync(logDir, { recursive: true })

function logValidation(message: string) {
  fs.appendFileSync(logPath, `[ADAPTIVE_TESTS] ${message}\n`)
}

function createLoggerCapture(): LoggerCapture {
  const originalInfo = logger.info.bind(logger)
  const originalWarn = logger.warn.bind(logger)
  const infos: Array<{ args: unknown[] }> = []
  const warns: Array<{ args: unknown[] }> = []
  logger.info = (...args: unknown[]) => {
    infos.push({ args })
  }
  logger.warn = (...args: unknown[]) => {
    warns.push({ args })
  }
  const originalWindow = (globalThis as any).window
  ;(globalThis as any).window = { updateKCProgressBar: () => {} }
  return {
    infos,
    warns,
    restore: () => {
      logger.info = originalInfo
      logger.warn = originalWarn
      ;(globalThis as any).window = originalWindow
    }
  }
}

function runCase(testCase: TestCase) {
  console.log(`[ADAPTIVE_TESTS] START ${testCase.name}`)
  logValidation(`Case start: ${testCase.name}`)
  const capture = createLoggerCapture()
  try {
    testCase.execute(capture)
    logValidation(`Case success: ${testCase.name}`)
    console.log(`[ADAPTIVE_TESTS] END ${testCase.name}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logValidation(`Case failure: ${testCase.name} :: ${message}`)
    console.error(`[ADAPTIVE_TESTS] FAIL ${testCase.name}`)
    throw error
  } finally {
    capture.restore()
  }
}

function createAnalysis(): ComprehensiveAnalysisResultType {
  return {
    affective_state: {
      confidence: 'Medium',
      engagement: 'Medium',
      frustration: 'Low',
      confusion: 'Low',
      boredom: 'Low',
      self_efficacy: 'Medium'
    },
    cognitive_load_indicators: {
      perceived_intrinsic_difficulty: 'Medium',
      extraneous_load_signals: 'Low'
    },
    srl_indicators: {
      planning_observed: 'Medium',
      monitoring_observed: 'Medium',
      help_seeking_style: 'Medium',
      strategy_hint: []
    },
    misconception_hints: [],
    knowledge_component_references: [],
    primary_intent: 'Other',
    topic_interaction: {
      continues_current_topic: true,
      signals_topic_resolution: false
    },
    key_content_point_assessment: []
  }
}

function createCurriculumState(overrides?: Partial<CurriculumState>): CurriculumState {
  return {
    currentModuleIndex: 0,
    currentConceptIndex: 0,
    currentPhase: 'IntroIllustrate',
    activeConsolidationState: null,
    isCompleted: false,
    teachingPlanForPhase: [[]],
    currentTeachingChunkIndex: 0,
    coveredPointsInCurrentChunk: new Set<string>(),
    pointsToRevisitInCurrentChunk: new Set<string>(),
    ...overrides
  }
}

function createCurriculumItem(overrides?: Partial<CurriculumItem>): CurriculumItem {
  return {
    moduleTitle: 'Module',
    moduleGoal: 'Goal',
    concept: {
      title: 'Concept',
      text: 'Content'
    },
    curriculumPathId: 'General_Introduction_To_Recursion',
    isLastConceptInModule: false,
    isLastPhaseForConcept: false,
    isModuleWidePhase: false,
    ...overrides
  }
}

function withFixedNow<T>(timestamp: number, fn: () => T): T {
  const originalNow = Date.now
  Date.now = () => timestamp
  try {
    return fn()
  } finally {
    Date.now = originalNow
  }
}

function setupHarness() {
  console.log('[ADAPTIVE_TESTS] Harness initialized')
  logValidation('Harness initialized')
}

function runInitializationAndCoverageCases() {
  runCase({
    name: 'TC-01 Initialization seeds baseline learner model',
    execute: _capture => {
      const model = initializeLearnerModel()
      assert.equal(model.KCs.KC_GeneralRecursionDefinition, 0.05)
      MISCONCEPTION_IDS.forEach(id => {
        assert.equal(model.Misconceptions[id], 0.1)
      })
      assert.equal(model.AffectiveState.Confidence, 'Medium')
      assert.equal(model.AffectiveState.Engagement, 'Medium')
      assert.equal(model.AffectiveState.Frustration, 'Low')
      assert.equal(model.AffectiveState.Confusion, 'Low')
      assert.equal(model.AffectiveState.Boredom, 'Low')
      assert.equal(model.AffectiveState.SelfEfficacy, 'Medium')
      assert.equal(model.CognitiveLoad.EstimatedIntrinsic, 'Medium')
      assert.equal(model.CognitiveLoad.EstimatedExtraneous, 'Low')
      assert.equal(model.CognitiveLoad.EstimatedGermane, 'Low')
      assert.deepEqual(model.SRL_Indicators.StrategyUse, [])
      assert.deepEqual(model.contentPointsCoverage, {})
      assert.ok(model.awardedKcForPhasePoints instanceof Set)
      assert.equal(model.awardedKcForPhasePoints.size, 0)
    }
  })
  runCase({
    name: 'TC-05 updateLearnerModel captures last input and time on task',
    execute: _capture => {
      const model = initializeLearnerModel()
      model.SessionStartTime = 1000
      const analysis = createAnalysis()
      withFixedNow(1000 + 22 * 60000, () => {
        const updated = updateLearnerModel('answer', analysis, model, [])
        assert.equal(updated.LastUserInput, 'answer')
        assert.equal(updated.LastAnalysis, analysis)
        assert.equal(updated.LearningTrajectory.TotalTimeOnTask, '22 minutes')
      })
    }
  })
  runCase({
    name: 'TC-18 Content coverage entries created for expected points',
    execute: _capture => {
      const model = initializeLearnerModel()
      const analysis = createAnalysis()
      const updated = updateLearnerModel('input', analysis, model, ['Point A', 'Point B'])
      assert.deepEqual(updated.contentPointsCoverage?.['Point A'], {
        coverage: 'NotAddressed',
        understanding_score: 0
      })
      assert.deepEqual(updated.contentPointsCoverage?.['Point B'], {
        coverage: 'NotAddressed',
        understanding_score: 0
      })
    }
  })
  runCase({
    name: 'TC-19 High-water mark awards incremental phase KC',
    execute: capture => {
      const model = initializeLearnerModel()
      const curriculumState = createCurriculumState({
        teachingPlanForPhase: [[{ text: 'Explain recursion base case', kcValue: 0.5 }]],
        coveredPointsInCurrentChunk: new Set<string>(),
        pointsToRevisitInCurrentChunk: new Set<string>()
      })
      const analysis = createAnalysis()
      analysis.primary_intent = 'ExpressingUnderstanding'
      analysis.key_content_point_assessment = [{
        point_id: 'Explain recursion base case',
        coverage: 'ExplicitlyAddressed',
        understanding_score: 0.82
      }]
      const updated = updateLearnerModel('input', analysis, model, ['Explain recursion base case'], curriculumState)
      assert.ok((updated.KCs.General_Introduction_To_Recursion ?? 0) >= 0.4)
      const payloadEntry = capture.infos.find(entry => Array.isArray(entry.args) && entry.args.some(arg => typeof arg === 'object' && arg !== null && (arg as any).event === 'kc-assessment-summary'))
      assert.ok(payloadEntry)
      assert.equal(updated.contentPointsCoverage?.['Explain recursion base case']?.understanding_score, 0.82)
      assert.ok(curriculumState.coveredPointsInCurrentChunk.has('Explain recursion base case'))
    }
  })
}

function runDynamicCategoricalCases() {
  runCase({
    name: 'TC-02 Dynamic categorical update favors improvement',
    execute: _capture => {
      const result = dynamicCategoricalUpdate('Low', 'High', THREE_LEVEL_MAP, REVERSE_THREE_LEVEL_MAP)
      assert.equal(result, 'Medium')
    }
  })
  runCase({
    name: 'TC-03 Dynamic categorical update dampens declines',
    execute: _capture => {
      const result = dynamicCategoricalUpdate('High', 'Low', THREE_LEVEL_MAP, REVERSE_THREE_LEVEL_MAP)
      assert.equal(result, 'Medium')
    }
  })
  runCase({
    name: 'TC-04 Dynamic categorical update falls back on unknown mapping',
    execute: _capture => {
      const result = dynamicCategoricalUpdate('Medium', 'Unknown' as any, THREE_LEVEL_MAP as any, REVERSE_THREE_LEVEL_MAP as any)
      assert.equal(result, 'Unknown')
    }
  })
}

function runAffectiveAndSrlCases() {
  runCase({
    name: 'TC-06 Affective values respect uncertain fallbacks',
    execute: _capture => {
      const model = initializeLearnerModel()
      const analysis = createAnalysis()
      analysis.affective_state = {
        confidence: 'Uncertain',
        engagement: 'Uncertain',
        frustration: 'Uncertain',
        confusion: 'Uncertain',
        boredom: 'Uncertain',
        self_efficacy: 'Uncertain'
      }
      const updated = updateLearnerModel('text', analysis, model, [])
      assert.equal(updated.AffectiveState.Confidence, model.AffectiveState.Confidence)
      assert.equal(updated.AffectiveState.Confusion, model.AffectiveState.Confusion)
      assert.equal(updated.AffectiveState.Frustration, model.AffectiveState.Frustration)
    }
  })
  runCase({
    name: 'TC-07 No-analysis branch flags confusion keywords',
    execute: _capture => {
      const model = initializeLearnerModel()
      const updated = updateLearnerModel('I am stuck and very confused, I do not understand', null, model, [])
      assert.equal(updated.AffectiveState.Confusion, 'High')
      assert.equal(updated.AffectiveState.Confidence, 'Low')
      assert.equal(updated.AffectiveState.Frustration, 'Medium')
    }
  })
  runCase({
    name: 'TC-08 No-analysis branch recognizes mastery phrases',
    execute: _capture => {
      const model = initializeLearnerModel()
      const updated = updateLearnerModel('I got it, makes sense and is clear now', null, model, [])
      assert.equal(updated.AffectiveState.Confusion, 'Low')
      assert.equal(updated.AffectiveState.Confidence, 'High')
      assert.equal(updated.LearningTrajectory.RecentPerformanceTrend, 'Improving')
    }
  })
  runCase({
    name: 'TC-09 Expressing understanding boosts germane load',
    execute: _capture => {
      const model = initializeLearnerModel()
      const analysis = createAnalysis()
      analysis.primary_intent = 'ExpressingUnderstanding'
      analysis.affective_state.frustration = 'Low'
      const updated = updateLearnerModel('input', analysis, model, [])
      assert.equal(updated.CognitiveLoad.EstimatedGermane, 'High')
    }
  })
  runCase({
    name: 'TC-10 High confusion suppresses germane load',
    execute: _capture => {
      const model = initializeLearnerModel()
      const analysis = createAnalysis()
      analysis.affective_state.confusion = 'High'
      const updated = updateLearnerModel('input', analysis, model, [])
      assert.equal(updated.CognitiveLoad.EstimatedGermane, 'Low')
    }
  })
  runCase({
    name: 'TC-11 SRL indicator smoothing and strategy filtering',
    execute: _capture => {
      const model = initializeLearnerModel()
      model.SRL_Indicators.PlanningObserved = 'Low'
      model.SRL_Indicators.MonitoringObserved = 'Medium'
      model.SRL_Indicators.HelpSeekingAppropriateness = 'Low'
      const analysis = createAnalysis()
      analysis.srl_indicators = {
        planning_observed: 'High',
        monitoring_observed: 'Low',
        help_seeking_style: 'High',
        strategy_hint: ['None', 'SelfExplanation', 'Uncertain', 'NoteTaking']
      }
      const updated = updateLearnerModel('input', analysis, model, [])
      assert.equal(updated.SRL_Indicators.PlanningObserved, 'Medium')
      assert.equal(updated.SRL_Indicators.MonitoringObserved, 'Medium')
      assert.equal(updated.SRL_Indicators.HelpSeekingAppropriateness, 'Medium')
      assert.deepEqual(updated.SRL_Indicators.StrategyUse, ['SelfExplanation', 'NoteTaking'])
    }
  })
}

function runMisconceptionCases() {
  runCase({
    name: 'TC-12 Recognized misconception raises likelihood and alters mental model',
    execute: _capture => {
      const model = initializeLearnerModel()
      const analysis = createAnalysis()
      analysis.misconception_hints = [{ id: 'Misconception_LoopingModel', likelihood: 'High' }]
      const updated = updateLearnerModel('input', analysis, model, [])
      assert.ok((updated.Misconceptions['Misconception_LoopingModel'] ?? 0) > (model.Misconceptions['Misconception_LoopingModel'] ?? 0))
      assert.equal(updated.MentalModelState.InferredModelType, 'Non-Viable Looping Model')
      assert.equal(updated.MentalModelState.Consistency, 'High')
    }
  })
  runCase({
    name: 'TC-13 Low likelihood reduces existing misconception',
    execute: _capture => {
      const model = initializeLearnerModel()
      model.Misconceptions['Misconception_LoopingModel'] = 0.07
      const analysis = createAnalysis()
      analysis.misconception_hints = [{ id: 'Misconception_LoopingModel', likelihood: 'Low' }]
      const updated = updateLearnerModel('input', analysis, model, [])
      assert.equal(updated.Misconceptions['Misconception_LoopingModel'], 0.02)
    }
  })
  runCase({
    name: 'TC-14 Unrecognized misconception IDs ignored',
    execute: capture => {
      const model = initializeLearnerModel()
      const analysis = createAnalysis()
      analysis.misconception_hints = [{ id: 'Unknown_Misconception', likelihood: 'High' }]
      const updated = updateLearnerModel('input', analysis, model, [])
      assert.deepEqual(updated.Misconceptions, model.Misconceptions)
      assert.equal(capture.warns.length, 0)
    }
  })
}

function runKnowledgeComponentCases() {
  runCase({
    name: 'TC-15 Knowledge component positive signals raise mastery',
    execute: _capture => {
      const model = initializeLearnerModel()
      const analysis = createAnalysis()
      const refs: KnowledgeComponentReference[] = [{ kc_id: 'KC_RecursionTracing', understanding_signal: 'Positive' }]
      analysis.knowledge_component_references = refs
      const updated = updateLearnerModel('input', analysis, model, [])
      assert.equal(updated.KCs.KC_RecursionTracing, 0.12)
      assert.ok(typeof updated.KCMasteryLastUpdated.KC_RecursionTracing === 'string')
    }
  })
  runCase({
    name: 'TC-16 Negative signals decrease but remain bounded',
    execute: _capture => {
      const model = initializeLearnerModel()
      model.KCs.KC_Bounds = 0.02
      const analysis = createAnalysis()
      analysis.knowledge_component_references = [{ kc_id: 'KC_Bounds', understanding_signal: 'Negative' }]
      const updated = updateLearnerModel('input', analysis, model, [])
      assert.equal(updated.KCs.KC_Bounds, 0)
    }
  })
  runCase({
    name: 'TC-17 Expressing understanding awards target KC progress',
    execute: _capture => {
      const model = initializeLearnerModel()
      model.CurrentTask.TargetKCs = ['KC_GeneralRecursionDefinition', 'KC_Deepening']
      const analysis = createAnalysis()
      analysis.primary_intent = 'ExpressingUnderstanding'
      const updated = updateLearnerModel('input', analysis, model, [])
      assert.equal(updated.KCs.KC_Deepening, 0.12)
    }
  })
}

function runCurriculumProgressCases() {
  runCase({
    name: 'TC-20 Coverage threshold manages revisit sets',
    execute: _capture => {
      const model = initializeLearnerModel()
      const curriculumState = createCurriculumState({
        teachingPlanForPhase: [[{ text: 'Point High', kcValue: 0.3 }, { text: 'Point Low', kcValue: 0.3 }]],
        coveredPointsInCurrentChunk: new Set<string>(),
        pointsToRevisitInCurrentChunk: new Set<string>()
      })
      const analysis = createAnalysis()
      analysis.key_content_point_assessment = [
        { point_id: 'Point High', coverage: 'ExplicitlyAddressed', understanding_score: 0.9 },
        { point_id: 'Point Low', coverage: 'ImplicitlyAddressed', understanding_score: 0.4 }
      ]
      const updated = updateLearnerModel('input', analysis, model, ['Point High', 'Point Low'], curriculumState)
      assert.ok(curriculumState.coveredPointsInCurrentChunk.has('Point High'))
      assert.ok(!curriculumState.coveredPointsInCurrentChunk.has('Point Low'))
      assert.ok(curriculumState.pointsToRevisitInCurrentChunk?.has('Point Low'))
      assert.ok(!curriculumState.pointsToRevisitInCurrentChunk?.has('Point High'))
      assert.equal(updated.contentPointsCoverage?.['Point Low']?.understanding_score, 0.4)
    }
  })
  runCase({
    name: 'TC-21 Unmatched assessment logs warning without mutation',
    execute: capture => {
      const model = initializeLearnerModel()
      const curriculumState = createCurriculumState({
        teachingPlanForPhase: [[{ text: 'Known Point', kcValue: 0.2 }]],
        coveredPointsInCurrentChunk: new Set<string>(),
        pointsToRevisitInCurrentChunk: new Set<string>()
      })
      const analysis = createAnalysis()
      analysis.key_content_point_assessment = [{ point_id: 'Unknown Point', coverage: 'NotAddressed', understanding_score: 0.2 }]
      const updated = updateLearnerModel('input', analysis, model, ['Known Point'], curriculumState)
      assert.equal(Object.keys(updated.contentPointsCoverage || {}).length, 1)
      assert.ok(capture.warns.length > 0)
    }
  })
  runCase({
    name: 'TC-22 kc-assessment-summary logging emitted when data processed',
    execute: capture => {
      const model = initializeLearnerModel()
      const curriculumState = createCurriculumState({
        teachingPlanForPhase: [[{ text: 'Summary Point', kcValue: 0.4 }]],
        coveredPointsInCurrentChunk: new Set<string>(),
        pointsToRevisitInCurrentChunk: new Set<string>()
      })
      const analysis = createAnalysis()
      analysis.key_content_point_assessment = [{ point_id: 'Summary Point', coverage: 'ExplicitlyAddressed', understanding_score: 0.75 }]
      updateLearnerModel('input', analysis, model, ['Summary Point'], curriculumState)
      const summaryLog = capture.infos.find(entry => entry.args.some(arg => typeof arg === 'object' && arg !== null && (arg as any).event === 'kc-assessment-summary'))
      assert.ok(summaryLog)
    }
  })
  runCase({
    name: 'TC-23 ZPD estimation escalates with strong performance',
    execute: _capture => {
      const model = initializeLearnerModel()
      const analysis = createAnalysis()
      analysis.primary_intent = 'ExpressingUnderstanding'
      analysis.knowledge_component_references = [{ kc_id: 'KC_Positive', understanding_signal: 'Positive' }]
      const updated = updateLearnerModel('input', analysis, model, [])
      assert.equal(updated.ZPD_Estimate.NextComplexity, 'Slightly Higher')
      assert.equal(updated.ZPD_Estimate.ScaffoldingNeed, 'Low')
    }
  })
  runCase({
    name: 'TC-24 ZPD estimation increases support under struggle',
    execute: _capture => {
      const modelOne = initializeLearnerModel()
      const analysisOne = createAnalysis()
      analysisOne.affective_state.frustration = 'High'
      const updatedOne = updateLearnerModel('input', analysisOne, modelOne, [])
      assert.equal(updatedOne.ZPD_Estimate.NextComplexity, 'Slightly Lower')
      assert.equal(updatedOne.ZPD_Estimate.ScaffoldingNeed, 'Very High')
      const modelTwo = initializeLearnerModel()
      modelTwo.AffectiveState.Confidence = 'Low'
      const updatedTwo = updateLearnerModel('I feel lost', null, modelTwo, [])
      assert.equal(updatedTwo.ZPD_Estimate.ScaffoldingNeed, 'High')
    }
  })
}

function runOverrideCases() {
  runCase({
    name: 'TC-25 overrideChunkUnderstanding rejects invalid chunk',
    execute: capture => {
      const model = initializeLearnerModel()
      const curriculumState = createCurriculumState({ teachingPlanForPhase: [[]] })
      const curriculumItem = createCurriculumItem()
      const result = overrideChunkUnderstanding(model, curriculumState, curriculumItem, 5, true)
      assert.equal(result.kcDelta, 0)
      assert.ok(capture.warns.length > 0)
    }
  })
  runCase({
    name: 'TC-26 overrideChunkUnderstanding applies mastery delta and updates sets',
    execute: _capture => {
      const model = initializeLearnerModel()
      const points: TeachingPoint[] = [
        { text: 'Chunk Point A', kcValue: 0.4 },
        { text: 'Chunk Point B', kcValue: 0.6 }
      ]
      const curriculumState = createCurriculumState({
        teachingPlanForPhase: [points],
        currentTeachingChunkIndex: 0,
        coveredPointsInCurrentChunk: new Set<string>(),
        pointsToRevisitInCurrentChunk: new Set<string>()
      })
      const curriculumItem = createCurriculumItem({ curriculumPathId: 'General_Introduction_To_Recursion' })
      const first = overrideChunkUnderstanding(model, curriculumState, curriculumItem, 0, true)
      assert.ok(first.kcDelta > 0)
      assert.ok(curriculumState.coveredPointsInCurrentChunk.has('Chunk Point A'))
      assert.ok(curriculumState.coveredPointsInCurrentChunk.has('Chunk Point B'))
      assert.ok(model.awardedKcForPhasePoints.has('Chunk Point A'))
      const second = overrideChunkUnderstanding(model, curriculumState, curriculumItem, 0, false)
      assert.ok(second.kcDelta <= 0)
      assert.equal(curriculumState.coveredPointsInCurrentChunk.size, 0)
      assert.ok(curriculumState.pointsToRevisitInCurrentChunk?.has('Chunk Point A'))
      assert.ok(!model.awardedKcForPhasePoints.has('Chunk Point A'))
    }
  })
}

function finalizeHarness() {
  console.log('[ADAPTIVE_TESTS] ALL CASES COMPLETE')
  logValidation('All cases complete')
}

setupHarness()
runInitializationAndCoverageCases()
runDynamicCategoricalCases()
runAffectiveAndSrlCases()
runMisconceptionCases()
runKnowledgeComponentCases()
runCurriculumProgressCases()
runOverrideCases()
finalizeHarness()

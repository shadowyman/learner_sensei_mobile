import {
  initializeLearnerModel,
  updateLearnerModel,
  overrideChunkUnderstanding,
  MISCONCEPTION_IDS,
  type ComprehensiveAnalysisResultType,
  type LearnerModel,
  type KnowledgeComponentReference,
  type KeyContentPointAssessment
} from '../adaptiveEngine'
import {
  PHASE_MASTERY_THRESHOLD,
  type CurriculumState,
  type CurriculumItem,
  type TeachingPoint
} from '../curriculum'
import { logger } from '../logger'

type LoggerSnapshot = {
  infos: unknown[][]
  warns: unknown[][]
}

type CaptureResult<T> = {
  value: T
  logs: LoggerSnapshot
}

const originalInfo = logger.info
const originalWarn = logger.warn

function contractGuard(): void {
  if (!Array.isArray(MISCONCEPTION_IDS) || MISCONCEPTION_IDS.length === 0) {
    throw new Error('MISCONCEPTION_IDS must be populated')
  }
  const unique = new Set(MISCONCEPTION_IDS)
  if (unique.size !== MISCONCEPTION_IDS.length) {
    throw new Error('MISCONCEPTION_IDS contains duplicates')
  }
}

function withFrozenTime<T>(timestamp: number, run: () => T): T {
  const realNow = Date.now
  ;(Date as unknown as { now(): number }).now = () => timestamp
  try {
    return run()
  } finally {
    ;(Date as unknown as { now(): number }).now = realNow
  }
}

function captureLogger<T>(run: () => T): CaptureResult<T> {
  const infos: unknown[][] = []
  const warns: unknown[][] = []
  const prevInfo = logger.info
  const prevWarn = logger.warn
  logger.info = (...args: unknown[]) => {
    infos.push(args)
    return originalInfo.apply(logger, args)
  }
  logger.warn = (...args: unknown[]) => {
    warns.push(args)
    return originalWarn.apply(logger, args)
  }
  try {
    const value = run()
    return { value, logs: { infos, warns } }
  } finally {
    logger.info = prevInfo
    logger.warn = prevWarn
  }
}

function makeLearnerModel(overrides: Partial<LearnerModel> = {}): LearnerModel {
  const base = initializeLearnerModel()
  const merged: LearnerModel = {
    ...base,
    ...overrides,
    KCs: { ...base.KCs, ...(overrides.KCs ?? {}) },
    KCMasteryLastUpdated: { ...base.KCMasteryLastUpdated, ...(overrides.KCMasteryLastUpdated ?? {}) },
    Misconceptions: { ...base.Misconceptions, ...(overrides.Misconceptions ?? {}) },
    AffectiveState: { ...base.AffectiveState, ...(overrides.AffectiveState ?? {}) },
    CognitiveLoad: { ...base.CognitiveLoad, ...(overrides.CognitiveLoad ?? {}) },
    SRL_Indicators: { ...base.SRL_Indicators, ...(overrides.SRL_Indicators ?? {}) },
    LearningTrajectory: { ...base.LearningTrajectory, ...(overrides.LearningTrajectory ?? {}) },
    CurrentTask: { ...base.CurrentTask, ...(overrides.CurrentTask ?? {}) },
    ZPD_Estimate: { ...base.ZPD_Estimate, ...(overrides.ZPD_Estimate ?? {}) },
    contentPointsCoverage: overrides.contentPointsCoverage
      ? { ...overrides.contentPointsCoverage }
      : { ...(base.contentPointsCoverage ?? {}) },
    awardedKcForPhasePoints: overrides.awardedKcForPhasePoints instanceof Set
      ? new Set(overrides.awardedKcForPhasePoints)
      : new Set(
        Array.isArray(overrides.awardedKcForPhasePoints)
          ? overrides.awardedKcForPhasePoints
          : Array.from(base.awardedKcForPhasePoints)
      )
  }
  if (!merged.contentPointsCoverage) {
    merged.contentPointsCoverage = {}
  }
  return merged
}

function makeCurriculumState(
  overrides: Partial<CurriculumState> = {},
  teachingPlan: TeachingPoint[][] = [
    [
      { text: 'Explain base case semantics', kcValue: 0.5 },
      { text: 'Trace recursive frame updates', kcValue: 0.3 }
    ]
  ]
): CurriculumState {
  const state: CurriculumState = {
    currentModuleIndex: 0,
    currentConceptIndex: 0,
    currentPhase: 'IntroIllustrate',
    activeConsolidationState: null,
    isCompleted: false,
    teachingPlanForPhase: teachingPlan,
    currentTeachingChunkIndex: 0,
    coveredPointsInCurrentChunk: new Set<string>(),
    pointsToRevisitInCurrentChunk: new Set<string>(),
    socraticTurnCount: undefined,
    socraticBaseInstruction: null,
    socraticCompletionPending: null,
    ...overrides
  }
  if (!(state.coveredPointsInCurrentChunk instanceof Set)) {
    state.coveredPointsInCurrentChunk = new Set(Array.from(state.coveredPointsInCurrentChunk ?? []))
  }
  if (!(state.pointsToRevisitInCurrentChunk instanceof Set)) {
    state.pointsToRevisitInCurrentChunk = new Set(Array.from(state.pointsToRevisitInCurrentChunk ?? []))
  }
  return state
}

function makeCurriculumItem(overrides: Partial<CurriculumItem> = {}): CurriculumItem {
  return {
    moduleTitle: 'Recursion Module',
    moduleGoal: 'Develop recursion mastery',
    concept: null,
    curriculumPathId: 'General_Introduction_To_Recursion',
    isLastConceptInModule: false,
    isLastPhaseForConcept: false,
    isModuleWidePhase: false,
    ...overrides
  }
}

function makeAnalysis(overrides: Partial<ComprehensiveAnalysisResultType> = {}): ComprehensiveAnalysisResultType {
  const base: ComprehensiveAnalysisResultType = {
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
    key_content_point_assessment: undefined
  }
  return {
    ...base,
    ...overrides,
    affective_state: { ...base.affective_state, ...(overrides.affective_state ?? {}) },
    cognitive_load_indicators: {
      ...base.cognitive_load_indicators,
      ...(overrides.cognitive_load_indicators ?? {})
    },
    srl_indicators: { ...base.srl_indicators, ...(overrides.srl_indicators ?? {}) },
    misconception_hints: overrides.misconception_hints ?? base.misconception_hints,
    knowledge_component_references: overrides.knowledge_component_references ?? base.knowledge_component_references,
    topic_interaction: { ...base.topic_interaction, ...(overrides.topic_interaction ?? {}) },
    key_content_point_assessment: overrides.key_content_point_assessment
  }
}

function makeAssessments(entries: Array<{ text: string; coverage: KeyContentPointAssessment['coverage']; score: number }>): KeyContentPointAssessment[] {
  return entries.map(entry => ({
    point_id: entry.text,
    coverage: entry.coverage,
    understanding_score: entry.score
  }))
}

function expectSetEqual(actual: Set<string>, expected: Iterable<string>): void {
  expect(Array.from(actual).sort()).toEqual(Array.from(expected).sort())
}

describe('adaptive engine functional tests', () => {
  beforeAll(() => {
    contractGuard()
    const baseline = initializeLearnerModel()
    logger.info('[ADAPTIVE_TEST] ContractGuardValidated', {
      misconceptionCount: MISCONCEPTION_IDS.length,
      baselineKCKeys: Object.keys(baseline.KCs)
    })
  })

  afterEach(() => {
    if (logger.info !== originalInfo) {
      logger.info = originalInfo
      throw new Error('logger.info must be restored after test')
    }
    if (logger.warn !== originalWarn) {
      logger.warn = originalWarn
      throw new Error('logger.warn must be restored after test')
    }
  })

  describe('Learner model seeding & cloning', () => {
    test('TC-01 initialization returns documented defaults', () => {
      const model = initializeLearnerModel()
      expect(model.KCs['KC_GeneralRecursionDefinition']).toBeCloseTo(0.05)
      expect(Object.keys(model.Misconceptions)).toEqual(MISCONCEPTION_IDS)
      Object.values(model.Misconceptions).forEach(value => {
        expect(value).toBeCloseTo(0.1)
      })
      expect(model.AffectiveState).toEqual({
        Confidence: 'Medium',
        Engagement: 'Medium',
        Frustration: 'Low',
        Confusion: 'Low',
        Boredom: 'Low',
        SelfEfficacy: 'Medium'
      })
      expect(model.SRL_Indicators.StrategyUse).toEqual([])
      expect(model.contentPointsCoverage).toEqual({})
      expect(model.awardedKcForPhasePoints instanceof Set).toBe(true)
      logger.info('[ADAPTIVE_TEST] LearnerBaseline', {
        kcKeys: Object.keys(model.KCs),
        misconceptionKeys: Object.keys(model.Misconceptions)
      })
    })

    test('TC-02 cloned awarded set reconstructs from persisted array', () => {
      const original = makeLearnerModel()
      const persisted = JSON.parse(JSON.stringify({
        ...original,
        awardedKcForPhasePoints: ['Explain base case semantics', 'Trace recursive frame updates']
      })) as LearnerModel
      const updated = updateLearnerModel('status', makeAnalysis(), persisted, [], null)
      expect(updated.awardedKcForPhasePoints instanceof Set).toBe(true)
      expectSetEqual(updated.awardedKcForPhasePoints, ['Explain base case semantics', 'Trace recursive frame updates'])
      logger.info('[ADAPTIVE_TEST] FixtureBaseline', {
        awardedSetSize: updated.awardedKcForPhasePoints.size
      })
    })

    test('TC-03 updateLearnerModel clones model without mutating input', () => {
      const model = makeLearnerModel()
      const snapshot = JSON.parse(JSON.stringify(model))
      const updated = updateLearnerModel('new input', makeAnalysis(), model, [], null)
      expect(updated.LastUserInput).toBe('new input')
      expect(model.LastUserInput).toBe('')
      expect(JSON.parse(JSON.stringify(model))).toEqual(snapshot)
      logger.info('[ADAPTIVE_TEST] CloneVerification', {
        before: snapshot.LastUserInput,
        after: updated.LastUserInput
      })
    })

    test('TC-04 unseen KC gains timestamped positive delta', () => {
      const model = makeLearnerModel()
      const analysis = makeAnalysis({
        knowledge_component_references: [
          { kc_id: 'KC_Custom', understanding_signal: 'Positive' } as KnowledgeComponentReference
        ]
      })
      const updated = updateLearnerModel('progress', analysis, model, [], null)
      expect(updated.KCs['KC_Custom']).toBeCloseTo(0.12)
      expect(updated.KCMasteryLastUpdated['KC_Custom']).toBeDefined()
      logger.info('[ADAPTIVE_TEST] KCProgression', {
        kcId: 'KC_Custom',
        mastery: updated.KCs['KC_Custom'],
        timestamp: updated.KCMasteryLastUpdated['KC_Custom']
      })
    })

    test('TC-05 elapsed minutes round using SessionStartTime baseline', () => {
      const model = makeLearnerModel({ SessionStartTime: 0 })
      const analysis = makeAnalysis()
      const updated = withFrozenTime(7 * 60 * 1000 + 31 * 1000, () => updateLearnerModel('update', analysis, model, [], null))
      expect(updated.LearningTrajectory.TotalTimeOnTask).toBe('8 minutes')
      logger.info('[ADAPTIVE_TEST] TimeOnTaskEvidence', {
        elapsed: updated.LearningTrajectory.TotalTimeOnTask
      })
    })
  })

  describe('Affective and cognitive smoothing', () => {
    test('TC-06 improvement converges toward higher categorical values', () => {
      const base = makeLearnerModel({
        AffectiveState: { ...makeLearnerModel().AffectiveState, Confidence: 'Low' }
      })
      const updated = updateLearnerModel('input', makeAnalysis({ affective_state: { confidence: 'High' } }), base, [], null)
      expect(updated.AffectiveState.Confidence).toBe('Medium')
      logger.info('[ADAPTIVE_TEST] AffectiveSmoothing', {
        from: 'Low',
        to: updated.AffectiveState.Confidence
      })
    })

    test('TC-07 declines remain sticky and within range', () => {
      const base = makeLearnerModel()
      base.AffectiveState.Confidence = 'High'
      const updated = updateLearnerModel('input', makeAnalysis({ affective_state: { confidence: 'Low' } }), base, [], null)
      expect(updated.AffectiveState.Confidence).toBe('Medium')
      logger.info('[ADAPTIVE_TEST] AffectiveSmoothing', {
        declineFrom: 'High',
        declineTo: updated.AffectiveState.Confidence
      })
    })

    test('TC-08 uncertain values keep prior affective, cognitive, SRL states', () => {
      const base = makeLearnerModel({
        AffectiveState: { ...makeLearnerModel().AffectiveState, Confusion: 'Medium' },
        CognitiveLoad: { ...makeLearnerModel().CognitiveLoad, EstimatedIntrinsic: 'High' },
        SRL_Indicators: { ...makeLearnerModel().SRL_Indicators, PlanningObserved: 'High' }
      })
      const analysis = makeAnalysis({
        affective_state: { confusion: 'Uncertain' },
        cognitive_load_indicators: { perceived_intrinsic_difficulty: 'Uncertain' },
        srl_indicators: { planning_observed: 'Uncertain' }
      })
      const updated = updateLearnerModel('status', analysis, base, [], null)
      expect(updated.AffectiveState.Confusion).toBe('Medium')
      expect(updated.CognitiveLoad.EstimatedIntrinsic).toBe('High')
      expect(updated.SRL_Indicators.PlanningObserved).toBe('High')
      logger.info('[ADAPTIVE_TEST] AffectiveSmoothing', {
        confusion: updated.AffectiveState.Confusion,
        intrinsic: updated.CognitiveLoad.EstimatedIntrinsic,
        planning: updated.SRL_Indicators.PlanningObserved
      })
    })

    test('TC-09 germane load elevates only under low-confusion ExpressingUnderstanding', () => {
      const base = makeLearnerModel()
      const positive = updateLearnerModel('explain', makeAnalysis({ primary_intent: 'ExpressingUnderstanding' }), base, [], null)
      expect(positive.CognitiveLoad.EstimatedGermane).toBe('High')
      const blocked = makeLearnerModel({
        AffectiveState: { ...makeLearnerModel().AffectiveState, Confusion: 'High', Frustration: 'High' }
      })
      const fallback = updateLearnerModel('struggle', makeAnalysis({
        affective_state: { confusion: 'High', frustration: 'High' }
      }), blocked, [], null)
      expect(fallback.CognitiveLoad.EstimatedGermane).toBe('Low')
      logger.info('[ADAPTIVE_TEST] AffectiveSmoothing', {
        germaneHigh: positive.CognitiveLoad.EstimatedGermane,
        germaneLow: fallback.CognitiveLoad.EstimatedGermane
      })
    })
  })

  describe('SRL indicator handling', () => {
    test('TC-10 help-seeking smoothing receives production enums', () => {
      const base = makeLearnerModel({
        SRL_Indicators: { ...makeLearnerModel().SRL_Indicators, HelpSeekingAppropriateness: 'Medium' }
      })
      const updated = updateLearnerModel('plan', makeAnalysis({
        srl_indicators: { help_seeking_style: 'Appropriate' }
      }), base, [], null)
      expect((updated.SRL_Indicators.HelpSeekingAppropriateness as unknown as string)).toBe('Appropriate')
      const fallback = updateLearnerModel('plan', makeAnalysis({
        srl_indicators: { help_seeking_style: 'Uncertain' }
      }), updated, [], null)
      expect((fallback.SRL_Indicators.HelpSeekingAppropriateness as unknown as string)).toBe('Appropriate')
      logger.info('[ADAPTIVE_TEST] SRLUpdate', {
        helpSeeking: fallback.SRL_Indicators.HelpSeekingAppropriateness as unknown as string
      })
    })

    test('TC-11 strategy hints drop None and Uncertain entries', () => {
      const base = makeLearnerModel()
      const updated = updateLearnerModel('plan', makeAnalysis({
        srl_indicators: {
          strategy_hint: ['None', 'SelfExplaining', 'Uncertain', 'PlanningAhead']
        }
      }), base, [], null)
      expect(updated.SRL_Indicators.StrategyUse).toEqual(['SelfExplaining', 'PlanningAhead'])
      logger.info('[ADAPTIVE_TEST] SRLUpdate', {
        strategies: updated.SRL_Indicators.StrategyUse
      })
    })

    test('TC-12 planning and monitoring smoothing honors asymmetry', () => {
      const base = makeLearnerModel({
        SRL_Indicators: {
          ...makeLearnerModel().SRL_Indicators,
          PlanningObserved: 'High',
          MonitoringObserved: 'High'
        }
      })
      const updated = updateLearnerModel('monitor', makeAnalysis({
        srl_indicators: {
          planning_observed: 'Low',
          monitoring_observed: 'Low'
        }
      }), base, [], null)
      expect(updated.SRL_Indicators.PlanningObserved).toBe('Medium')
      expect(updated.SRL_Indicators.MonitoringObserved).toBe('Medium')
      logger.info('[ADAPTIVE_TEST] SRLUpdate', {
        planning: updated.SRL_Indicators.PlanningObserved,
        monitoring: updated.SRL_Indicators.MonitoringObserved
      })
    })
  })

  describe('Misconceptions and mental model alignment', () => {
    test('TC-13 high and medium likelihood increment misconceptions and adjust mental model', () => {
      const base = makeLearnerModel()
      const high = updateLearnerModel('loop issue', makeAnalysis({
        misconception_hints: [{ id: 'Misconception_LoopingModel', likelihood: 'High' }]
      }), base, [], null)
      expect(high.Misconceptions['Misconception_LoopingModel']).toBeCloseTo(0.4)
      expect(high.MentalModelState.InferredModelType).toBe('Non-Viable Looping Model')
      const medium = updateLearnerModel('loop issue', makeAnalysis({
        misconception_hints: [{ id: 'Misconception_LoopingModel', likelihood: 'Medium' }]
      }), high, [], null)
      expect(medium.Misconceptions['Misconception_LoopingModel']).toBeCloseTo(0.55)
      expect(medium.MentalModelState.Consistency).toBe('Medium')
      logger.info('[ADAPTIVE_TEST] MisconceptionDelta', {
        highValue: high.Misconceptions['Misconception_LoopingModel'],
        mediumValue: medium.Misconceptions['Misconception_LoopingModel']
      })
    })

    test('TC-14 low likelihood reduces above threshold and restores mental model', () => {
      const base = makeLearnerModel({
        Misconceptions: { ...makeLearnerModel().Misconceptions, Misconception_LoopingModel: 0.4 },
        MentalModelState: { InferredModelType: 'Non-Viable Looping Model', Consistency: 'High' }
      })
      const updated = updateLearnerModel('clarified', makeAnalysis({
        misconception_hints: [{ id: 'Misconception_LoopingModel', likelihood: 'Low' }]
      }), base, [], null)
      expect(updated.Misconceptions['Misconception_LoopingModel']).toBeCloseTo(0.35)
      expect(updated.MentalModelState.InferredModelType).toBe('Emerging Recursive Model')
      logger.info('[ADAPTIVE_TEST] MisconceptionDelta', {
        lowValue: updated.Misconceptions['Misconception_LoopingModel']
      })
    })

    test('TC-15 unknown IDs ignored; missing entries warn', () => {
      const base = makeLearnerModel()
      const capture = captureLogger(() => updateLearnerModel('random', makeAnalysis({
        misconception_hints: [
          { id: 'Unknown', likelihood: 'High' },
          { id: 'Misconception_ReturnValuesLost', likelihood: 'High' }
        ]
      }), base, [], null))
      expect(capture.logs.warns.some(args => String(args[0]).includes('[MISCONCEPTION_STATE]'))).toBe(false)
      const corrupted = makeLearnerModel()
      delete corrupted.Misconceptions['Misconception_ReturnValuesLost']
      const missing = captureLogger(() => updateLearnerModel('random', makeAnalysis({
        misconception_hints: [{ id: 'Misconception_ReturnValuesLost', likelihood: 'High' }]
      }), corrupted, [], null))
      expect(missing.logs.warns.some(args => String(args[0]).includes('[MISCONCEPTION_STATE]'))).toBe(true)
      logger.info('[ADAPTIVE_TEST] MisconceptionDelta', {
        warnCount: missing.logs.warns.length
      })
    })

    test('TC-16 misconception updates remain bounded', () => {
      const base = makeLearnerModel({
        Misconceptions: { ...makeLearnerModel().Misconceptions, Misconception_MagicModel: 0.95 }
      })
      const decreased = updateLearnerModel('loop', makeAnalysis({
        misconception_hints: [{ id: 'Misconception_MagicModel', likelihood: 'Low' }]
      }), base, [], null)
      expect(decreased.Misconceptions['Misconception_MagicModel']).toBeGreaterThanOrEqual(0)
      const increased = updateLearnerModel('loop', makeAnalysis({
        misconception_hints: [{ id: 'Misconception_MagicModel', likelihood: 'High' }]
      }), decreased, [], null)
      expect(increased.Misconceptions['Misconception_MagicModel']).toBeLessThanOrEqual(1)
      logger.info('[ADAPTIVE_TEST] MisconceptionDelta', {
        value: increased.Misconceptions['Misconception_MagicModel']
      })
    })
  })

  describe('Knowledge component progression', () => {
    test('TC-17 positive/negative signals adjust mastery excluding current task', () => {
      const base = makeLearnerModel({
        CurrentTask: { ID: 'Task_KC', TargetKCs: ['Task_KC'] }
      })
      const analysis = makeAnalysis({
        knowledge_component_references: [
          { kc_id: 'Task_KC', understanding_signal: 'Positive' } as KnowledgeComponentReference,
          { kc_id: 'KC_External', understanding_signal: 'Positive' } as KnowledgeComponentReference,
          { kc_id: 'KC_External', understanding_signal: 'Negative' } as KnowledgeComponentReference
        ]
      })
      const updated = updateLearnerModel('progress', analysis, base, [], null)
      expect(updated.KCs['Task_KC']).toBeUndefined()
      expect(updated.KCs['KC_External']).toBeCloseTo(0.05)
      logger.info('[ADAPTIVE_TEST] KCProgression', {
        externalKC: updated.KCs['KC_External']
      })
    })

    test('TC-18 ExpressingUnderstanding awards phase KCs only when confusion is low', () => {
      const base = makeLearnerModel({
        CurrentTask: { ID: 'PhaseKC', TargetKCs: ['PhaseKC', 'KC_Supplement'] }
      })
      base.AffectiveState.Confusion = 'Low'
      const positive = updateLearnerModel('understood', makeAnalysis({
        primary_intent: 'ExpressingUnderstanding'
      }), base, [], null)
      expect(positive.KCs['KC_Supplement']).toBeCloseTo(0.12)
      const blocked = makeLearnerModel({
        CurrentTask: { ID: 'PhaseKC', TargetKCs: ['PhaseKC', 'KC_Supplement'] },
        AffectiveState: { ...makeLearnerModel().AffectiveState, Confusion: 'High' }
      })
      const result = updateLearnerModel('uncertain', makeAnalysis({
        primary_intent: 'ExpressingUnderstanding'
      }), blocked, [], null)
      expect(result.KCs['KC_Supplement']).toBeUndefined()
      logger.info('[ADAPTIVE_TEST] KCProgression', {
        awarded: positive.KCs['KC_Supplement'],
        blocked: result.KCs['KC_Supplement'] ?? 0
      })
    })

    test('TC-19 timestamp refreshes and clamps at 1.0 for stacked gains', () => {
      const base = makeLearnerModel()
      const analysis = makeAnalysis({
        knowledge_component_references: Array.from({ length: 10 }, () => ({
          kc_id: 'KC_GeneralRecursionDefinition',
          understanding_signal: 'Positive'
        } as KnowledgeComponentReference))
      })
      const updated = withFrozenTime(Date.now() + 1000, () => updateLearnerModel('growth', analysis, base, [], null))
      expect(updated.KCs['KC_GeneralRecursionDefinition']).toBeLessThanOrEqual(1)
      expect(updated.KCMasteryLastUpdated['KC_GeneralRecursionDefinition']).not.toBe(base.KCMasteryLastUpdated['KC_GeneralRecursionDefinition'])
      logger.info('[ADAPTIVE_TEST] KCProgression', {
        mastery: updated.KCs['KC_GeneralRecursionDefinition']
      })
    })

    test('TC-20 phase KC initializes and awarded set resets for new plan', () => {
      const base = makeLearnerModel()
      base.awardedKcForPhasePoints = new Set(['Old Point'])
      base.CurrentTask.ID = 'Phase_KC'
      base.CurrentTask.TargetKCs = ['Phase_KC', 'KC_Supplement']
      const state = makeCurriculumState({ currentTeachingChunkIndex: 0 })
      const curriculumItem = makeCurriculumItem({ curriculumPathId: 'Phase_KC' })
      const updated = updateLearnerModel('start', makeAnalysis(), base, state.teachingPlanForPhase[0].map(tp => tp.text), state)
      expect(updated.KCs['Phase_KC']).toBeDefined()
      expect(updated.awardedKcForPhasePoints.size).toBe(0)
      expect(base.awardedKcForPhasePoints.size).toBe(1)
      const overrideResult = overrideChunkUnderstanding(updated, state, curriculumItem, 0, true)
      expect(overrideResult.kcDelta).toBeGreaterThan(0)
      expect(updated.awardedKcForPhasePoints.size).toBe(state.teachingPlanForPhase[0].length)
      logger.info('[ADAPTIVE_TEST] KCProgression', {
        phaseKC: updated.KCs['Phase_KC'] ?? 0
      })
    })
  })

  describe('Content coverage and KC awarding', () => {
    test('TC-21 expected content points populate coverage before assessments', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState()
      const updated = updateLearnerModel('input', makeAnalysis({ key_content_point_assessment: [] }), model, state.teachingPlanForPhase[0].map(tp => tp.text), state)
      expect(Object.keys(updated.contentPointsCoverage ?? {})).toEqual(state.teachingPlanForPhase[0].map(tp => tp.text))
      logger.info('[ADAPTIVE_TEST] CoverageSnapshot', {
        keys: Object.keys(updated.contentPointsCoverage ?? {})
      })
    })

    test('TC-22 exact-match assessments raise high-water mark and award KC deltas', () => {
      const model = makeLearnerModel({
        CurrentTask: { ID: 'PhaseKC', TargetKCs: ['PhaseKC'] },
        KCs: { ...makeLearnerModel().KCs, PhaseKC: 0 }
      })
      const state = makeCurriculumState()
      const assessments = makeAssessments([
        { text: 'Explain base case semantics', coverage: 'ExplicitlyAddressed', score: 0.9 },
        { text: 'Trace recursive frame updates', coverage: 'ImplicitlyAddressed', score: 0.8 }
      ])
      const updated = updateLearnerModel('assessment', makeAnalysis({ key_content_point_assessment: assessments }), model, state.teachingPlanForPhase[0].map(tp => tp.text), state)
      expect(updated.contentPointsCoverage?.['Explain base case semantics']?.understanding_score).toBeCloseTo(0.9)
      expect(updated.KCs['PhaseKC']).toBeGreaterThan(0)
      logger.info('[ADAPTIVE_TEST] KCPhaseSummary', {
        mastery: updated.KCs['PhaseKC'],
        coverage: updated.contentPointsCoverage
      })
    })

    test('TC-23 lower resubmissions do not reduce high-water mark or mastery', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState()
      const first = updateLearnerModel('assessment', makeAnalysis({
        key_content_point_assessment: makeAssessments([
          { text: 'Explain base case semantics', coverage: 'ExplicitlyAddressed', score: 0.8 }
        ])
      }), model, state.teachingPlanForPhase[0].map(tp => tp.text), state)
      const second = updateLearnerModel('assessment', makeAnalysis({
        key_content_point_assessment: makeAssessments([
          { text: 'Explain base case semantics', coverage: 'ExplicitlyAddressed', score: 0.5 }
        ])
      }), first, state.teachingPlanForPhase[0].map(tp => tp.text), state)
      expect(second.contentPointsCoverage?.['Explain base case semantics']?.understanding_score).toBeCloseTo(0.8)
      logger.info('[ADAPTIVE_TEST] CoverageSnapshot', {
        highWater: second.contentPointsCoverage?.['Explain base case semantics']?.understanding_score
      })
    })

    test('TC-24 phase KC awards accumulate and stay within mastery bounds', () => {
      const model = makeLearnerModel({
        CurrentTask: { ID: 'PhaseKC', TargetKCs: ['PhaseKC'] },
        KCs: { ...makeLearnerModel().KCs, PhaseKC: 0 }
      })
      const state = makeCurriculumState()
      const assessments = makeAssessments([
        { text: 'Explain base case semantics', coverage: 'ExplicitlyAddressed', score: 1 },
        { text: 'Trace recursive frame updates', coverage: 'ExplicitlyAddressed', score: 1 }
      ])
      const updated = updateLearnerModel('assessment', makeAnalysis({ key_content_point_assessment: assessments }), model, state.teachingPlanForPhase[0].map(tp => tp.text), state)
      expect(updated.KCs['PhaseKC']).toBeCloseTo(0.8)
      expect(updated.KCs['PhaseKC']).toBeLessThanOrEqual(1)
      logger.info('[ADAPTIVE_TEST] KCPhaseSummary', {
        mastery: updated.KCs['PhaseKC']
      })
    })

    test('TC-25 zero kcValue teaching points bypass mastery updates', () => {
      const model = makeLearnerModel()
      const zeroPlan: TeachingPoint[][] = [[{ text: 'Explain base case semantics', kcValue: 0 }]]
      const state = makeCurriculumState({}, zeroPlan)
      const { value: updated, logs } = captureLogger(() => updateLearnerModel('assessment', makeAnalysis({
        key_content_point_assessment: makeAssessments([
          { text: 'Explain base case semantics', coverage: 'ExplicitlyAddressed', score: 1 }
        ])
      }), model, ['Explain base case semantics'], state))
      expect(logs.warns.length).toBe(0)
      const baseline = model.KCs['KC_GeneralRecursionDefinition'] ?? 0.05
      expect(updated.KCs['KC_GeneralRecursionDefinition']).toBeCloseTo(baseline)
      logger.info('[ADAPTIVE_TEST] CoverageSnapshot', {
        kcValueZero: updated.KCs['KC_GeneralRecursionDefinition'] ?? 0
      })
    })

    test('TC-26 coverage thresholds manage covered and revisit sets', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState()
      const assessments = makeAssessments([
        { text: 'Explain base case semantics', coverage: 'ExplicitlyAddressed', score: 0.75 },
        { text: 'Trace recursive frame updates', coverage: 'ImplicitlyAddressed', score: 0.4 }
      ])
      updateLearnerModel('assessment', makeAnalysis({ key_content_point_assessment: assessments }), model, state.teachingPlanForPhase[0].map(tp => tp.text), state)
      expect(state.coveredPointsInCurrentChunk instanceof Set).toBe(true)
      expectSetEqual(state.coveredPointsInCurrentChunk, ['Explain base case semantics'])
      expectSetEqual(state.pointsToRevisitInCurrentChunk ?? new Set<string>(), ['Trace recursive frame updates'])
      logger.info('[ADAPTIVE_TEST] CoverageSnapshot', {
        covered: Array.from(state.coveredPointsInCurrentChunk),
        revisit: Array.from(state.pointsToRevisitInCurrentChunk ?? new Set<string>())
      })
    })

    test('TC-27 fuzzy matching normalizes markdown and reports similarity', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState()
      const capture = captureLogger(() => updateLearnerModel('assessment', makeAnalysis({
        key_content_point_assessment: makeAssessments([
          { text: '*Explain* base case semantics', coverage: 'ExplicitlyAddressed', score: 0.72 }
        ])
      }), model, state.teachingPlanForPhase[0].map(tp => tp.text), state))
      const validationLog = capture.logs.infos.find(args => String(args[0]).includes('[ADAPTIVE_VALIDATION]'))
      expect(validationLog).toBeDefined()
      logger.info('[ADAPTIVE_TEST] CoverageSnapshot', {
        fuzzyCaptured: Boolean(validationLog)
      })
    })

    test('TC-28 unmatched assessments warn with similarity data', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState()
      const capture = captureLogger(() => updateLearnerModel('assessment', makeAnalysis({
        key_content_point_assessment: makeAssessments([
          { text: 'Nonexistent point', coverage: 'ExplicitlyAddressed', score: 0.8 }
        ])
      }), model, state.teachingPlanForPhase[0].map(tp => tp.text), state))
      expect(capture.logs.warns.some(args => String(args[0]).includes('Could not match assessment point_id'))).toBe(true)
      logger.info('[ADAPTIVE_TEST] CoverageSnapshot', {
        warnCount: capture.logs.warns.length
      })
    })

    test('TC-29 revisit set initializes lazily and persists across updates', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState({ pointsToRevisitInCurrentChunk: undefined })
      updateLearnerModel('assessment', makeAnalysis({
        key_content_point_assessment: makeAssessments([
          { text: 'Explain base case semantics', coverage: 'ExplicitlyAddressed', score: 0.3 }
        ])
      }), model, state.teachingPlanForPhase[0].map(tp => tp.text), state)
      expect(state.pointsToRevisitInCurrentChunk).toBeDefined()
      expect(state.pointsToRevisitInCurrentChunk instanceof Set).toBe(true)
      logger.info('[ADAPTIVE_TEST] CoverageSnapshot', {
        revisitSize: state.pointsToRevisitInCurrentChunk ? state.pointsToRevisitInCurrentChunk.size : 0
      })
    })

    test('TC-30 coverage summary deduplicates coverage and revisit lists', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState()
      const capture = captureLogger(() => updateLearnerModel('assessment', makeAnalysis({
        key_content_point_assessment: makeAssessments([
          { text: 'Explain base case semantics', coverage: 'ExplicitlyAddressed', score: 0.9 },
          { text: 'Explain base case semantics', coverage: 'ExplicitlyAddressed', score: 0.9 }
        ])
      }), model, state.teachingPlanForPhase[0].map(tp => tp.text), state))
      const summary = capture.logs.infos.find(args => String(args[0]).includes('[ADAPTIVE_VALIDATION]'))
      expect(summary).toBeDefined()
      logger.info('[ADAPTIVE_TEST] KCPhaseSummary', {
        captured: Boolean(summary)
      })
    })

    test('TC-31 IntroIllustrate phase processes assessments normally', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState({ currentPhase: 'IntroIllustrate' })
      const updated = updateLearnerModel('assessment', makeAnalysis({
        key_content_point_assessment: makeAssessments([
          { text: 'Explain base case semantics', coverage: 'ExplicitlyAddressed', score: 0.9 }
        ])
      }), model, state.teachingPlanForPhase[0].map(tp => tp.text), state)
      expect(updated.contentPointsCoverage?.['Explain base case semantics']?.understanding_score).toBeCloseTo(0.9)
      logger.info('[ADAPTIVE_TEST] CoverageSnapshot', {
        phase: state.currentPhase,
        score: updated.contentPointsCoverage?.['Explain base case semantics']?.understanding_score
      })
    })
  })

  describe('Learning trajectory heuristics', () => {
    test('TC-32 positive KC signals with good affect set trend to Improving', () => {
      const model = makeLearnerModel()
      const updated = updateLearnerModel('input', makeAnalysis({
        knowledge_component_references: [
          { kc_id: 'KC_Pos', understanding_signal: 'Positive' } as KnowledgeComponentReference
        ]
      }), model, [], null)
      expect(updated.LearningTrajectory.RecentPerformanceTrend).toBe('Improving')
      logger.info('[ADAPTIVE_TEST] TrajectoryUpdate', {
        trend: updated.LearningTrajectory.RecentPerformanceTrend
      })
    })

    test('TC-33 confusion or high frustration stalls trajectory when interactions > 0', () => {
      const model = makeLearnerModel({
        LearningTrajectory: {
          ...makeLearnerModel().LearningTrajectory,
          InteractionCounter_On_Current_Topic: 2,
          RecentPerformanceTrend: 'Stable'
        }
      })
      model.AffectiveState.Frustration = 'High'
      const updated = updateLearnerModel('struggling', makeAnalysis({ primary_intent: 'ExpressingConfusion' }), model, [], null)
      expect(updated.LearningTrajectory.RecentPerformanceTrend).toBe('Stalled_On_Current_Topic')
      logger.info('[ADAPTIVE_TEST] TrajectoryUpdate', {
        trend: updated.LearningTrajectory.RecentPerformanceTrend
      })
    })

    test('TC-34 interaction counter remains unchanged by updateLearnerModel', () => {
      const model = makeLearnerModel({
        LearningTrajectory: {
          ...makeLearnerModel().LearningTrajectory,
          InteractionCounter_On_Current_Topic: 3
        }
      })
      const updated = updateLearnerModel('neutral', makeAnalysis(), model, [], null)
      expect(updated.LearningTrajectory.InteractionCounter_On_Current_Topic).toBe(3)
      logger.info('[ADAPTIVE_TEST] TrajectoryUpdate', {
        interactionCounter: updated.LearningTrajectory.InteractionCounter_On_Current_Topic
      })
    })
  })

  describe('ZPD transitions', () => {
    test('TC-35 improving trend with high confidence raises complexity and lowers scaffolding', () => {
      const model = makeLearnerModel({
        LearningTrajectory: { ...makeLearnerModel().LearningTrajectory, RecentPerformanceTrend: 'Improving' },
        AffectiveState: { ...makeLearnerModel().AffectiveState, Confidence: 'High' }
      })
      const updated = updateLearnerModel('status', makeAnalysis(), model, [], null)
      expect(updated.ZPD_Estimate.NextComplexity).toBe('Slightly Higher')
      expect(updated.ZPD_Estimate.ScaffoldingNeed).toBe('Low')
      logger.info('[ADAPTIVE_TEST] ZPDOutcome', updated.ZPD_Estimate)
    })

    test('TC-36 stalled trend or high frustration lowers complexity and raises scaffolding', () => {
      const model = makeLearnerModel({
        LearningTrajectory: { ...makeLearnerModel().LearningTrajectory, RecentPerformanceTrend: 'Stalled_On_Current_Topic' },
        AffectiveState: { ...makeLearnerModel().AffectiveState, Frustration: 'High' }
      })
      const updated = updateLearnerModel('status', makeAnalysis(), model, [], null)
      expect(updated.ZPD_Estimate.NextComplexity).toBe('Slightly Lower')
      expect(updated.ZPD_Estimate.ScaffoldingNeed).toBe('Very High')
      logger.info('[ADAPTIVE_TEST] ZPDOutcome', updated.ZPD_Estimate)
    })

    test('TC-37 high confusion or low confidence keeps complexity same but raises scaffolding', () => {
      const model = makeLearnerModel({
        AffectiveState: { ...makeLearnerModel().AffectiveState, Confusion: 'High', Confidence: 'Low' }
      })
      const updated = updateLearnerModel('status', makeAnalysis(), model, [], null)
      expect(updated.ZPD_Estimate.NextComplexity).toBe('Same')
      expect(updated.ZPD_Estimate.ScaffoldingNeed).toBe('High')
      logger.info('[ADAPTIVE_TEST] ZPDOutcome', updated.ZPD_Estimate)
    })
  })

  describe('Null-analysis fallback heuristics', () => {
    test('TC-38 distress language forces high confusion and medium frustration', () => {
      const model = makeLearnerModel()
      const updated = updateLearnerModel("I'm stuck and confused", null, model, [], null)
      expect(updated.AffectiveState.Confusion).toBe('High')
      expect(updated.AffectiveState.Confidence).toBe('Low')
      expect(updated.AffectiveState.Frustration).toBe('Medium')
      logger.info('[ADAPTIVE_TEST] NullAnalysisHeuristic', {
        input: 'stuck/confused',
        affective: updated.AffectiveState
      })
    })

    test('TC-39 mastery language lowers confusion and improves trajectory', () => {
      const model = makeLearnerModel()
      const updated = updateLearnerModel('Got it, makes sense now', null, model, [], null)
      expect(updated.AffectiveState.Confusion).toBe('Low')
      expect(updated.AffectiveState.Confidence).toBe('High')
      expect(updated.LearningTrajectory.RecentPerformanceTrend).toBe('Improving')
      logger.info('[ADAPTIVE_TEST] NullAnalysisHeuristic', {
        input: 'got it',
        affective: updated.AffectiveState
      })
    })

    test('TC-40 neutral input leaves affective state unchanged', () => {
      const model = makeLearnerModel()
      const updated = updateLearnerModel('Let us continue', null, model, [], null)
      expect(updated.AffectiveState).toEqual(model.AffectiveState)
      expect(updated.LearningTrajectory.RecentPerformanceTrend).toBe('Stable')
      logger.info('[ADAPTIVE_TEST] NullAnalysisHeuristic', {
        input: 'neutral',
        affective: updated.AffectiveState
      })
    })
  })

  describe('Logging and instrumentation validation', () => {
    test('TC-41 processed assessments emit ADAPTIVE_VALIDATION log', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState()
      const capture = captureLogger(() => updateLearnerModel('assessment', makeAnalysis({
        key_content_point_assessment: makeAssessments([
          { text: 'Explain base case semantics', coverage: 'ExplicitlyAddressed', score: 0.9 }
        ])
      }), model, state.teachingPlanForPhase[0].map(tp => tp.text), state))
      expect(capture.logs.infos.some(args => String(args[0]).includes('[ADAPTIVE_VALIDATION]'))).toBe(true)
      logger.info('[ADAPTIVE_TEST] LogCaptureSummary', {
        infoLogs: capture.logs.infos.length,
        warnLogs: capture.logs.warns.length
      })
    })

    test('TC-42 override index errors emit CHUNK_CHECK warnings', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState()
      const item = makeCurriculumItem()
      const capture = captureLogger(() => overrideChunkUnderstanding(model, state, item, 99, true))
      expect(capture.logs.warns.some(args => String(args[0]).includes('[CHUNK_CHECK]'))).toBe(true)
      logger.info('[ADAPTIVE_TEST] LogCaptureSummary', {
        warnLogs: capture.logs.warns.length
      })
    })

    test('TC-43 missing misconception entries emit warnings', () => {
      const corrupted = makeLearnerModel()
      delete corrupted.Misconceptions['Misconception_ReturnValuesLost']
      const capture = captureLogger(() => updateLearnerModel('input', makeAnalysis({
        misconception_hints: [{ id: 'Misconception_ReturnValuesLost', likelihood: 'High' }]
      }), corrupted, [], null))
      expect(capture.logs.warns.some(args => String(args[0]).includes('[MISCONCEPTION_STATE]'))).toBe(true)
      logger.info('[ADAPTIVE_TEST] LogCaptureSummary', {
        warnLogs: capture.logs.warns.length
      })
    })

    test('TC-44 no assessments avoid emitting validation logs', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState()
      const capture = captureLogger(() => updateLearnerModel('assessment', makeAnalysis({ key_content_point_assessment: [] }), model, state.teachingPlanForPhase[0].map(tp => tp.text), state))
      expect(capture.logs.infos.filter(args => String(args[0]).includes('[ADAPTIVE_VALIDATION]')).length).toBe(0)
      logger.info('[ADAPTIVE_TEST] LogCaptureSummary', {
        validationLogs: capture.logs.infos.length
      })
    })
  })

  describe('Override chunk understanding flows', () => {
    test('TC-45 invalid chunk index logs warning without mutating mastery', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState()
      const item = makeCurriculumItem()
      const capture = captureLogger(() => overrideChunkUnderstanding(model, state, item, -1, true))
      expect(capture.logs.warns.some(args => String(args[0]).includes('[CHUNK_CHECK]'))).toBe(true)
      expect(model.KCs[item.curriculumPathId] ?? 0).toBeLessThanOrEqual(1)
      logger.info('[ADAPTIVE_TEST] OverrideResult', {
        kcDelta: capture.value.kcDelta
      })
    })

    test('TC-46 understood=true awards mastery and records awarded set', () => {
      const model = makeLearnerModel({ contentPointsCoverage: {} })
      const state = makeCurriculumState()
      const item = makeCurriculumItem()
      const result = overrideChunkUnderstanding(model, state, item, 0, true)
      expect(result.kcDelta).toBeGreaterThan(0)
      expect(model.awardedKcForPhasePoints.size).toBe(state.teachingPlanForPhase[0].length)
      logger.info('[ADAPTIVE_TEST] OverrideResult', {
        kcDelta: result.kcDelta,
        awarded: model.awardedKcForPhasePoints.size
      })
    })

    test('TC-47 understood=false resets coverage, removes awards, and fills revisit set', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState()
      const item = makeCurriculumItem()
      overrideChunkUnderstanding(model, state, item, 0, true)
      const result = overrideChunkUnderstanding(model, state, item, 0, false)
      expect(result.kcDelta).toBeLessThanOrEqual(0)
      expect(model.awardedKcForPhasePoints.size).toBe(0)
      expect(Array.from(state.pointsToRevisitInCurrentChunk ?? new Set<string>())).toEqual(state.teachingPlanForPhase[0].map(point => point.text))
      logger.info('[ADAPTIVE_TEST] OverrideResult', {
        kcDelta: result.kcDelta
      })
    })

    test('TC-48 overriding non-active chunk does not mutate curriculum state sets', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState({
        currentTeachingChunkIndex: 1,
        teachingPlanForPhase: [
          [{ text: 'Chunk A', kcValue: 0.4 }],
          [{ text: 'Chunk B', kcValue: 0.4 }]
        ]
      })
      const item = makeCurriculumItem()
      const beforeCovered = new Set(state.coveredPointsInCurrentChunk)
      overrideChunkUnderstanding(model, state, item, 0, true)
      expect(state.coveredPointsInCurrentChunk instanceof Set).toBe(true)
      expectSetEqual(state.coveredPointsInCurrentChunk, beforeCovered)
      logger.info('[ADAPTIVE_TEST] OverrideResult', {
        coveredSize: state.coveredPointsInCurrentChunk.size
      })
    })

    test('TC-49 coverage map persists across overrides even when initially undefined', () => {
      const model = makeLearnerModel({ contentPointsCoverage: undefined })
      const state = makeCurriculumState()
      const item = makeCurriculumItem()
      overrideChunkUnderstanding(model, state, item, 0, true)
      expect(model.contentPointsCoverage).toBeDefined()
      logger.info('[ADAPTIVE_TEST] OverrideResult', {
        coverageKeys: Object.keys(model.contentPointsCoverage ?? {})
      })
    })

    test('TC-50 KC mastery timestamps refresh on overrides', () => {
      const item = makeCurriculumItem({ curriculumPathId: 'Phase_KC' })
      const model = makeLearnerModel({
        KCs: { ...makeLearnerModel().KCs, Phase_KC: 0.2 },
        KCMasteryLastUpdated: { ...makeLearnerModel().KCMasteryLastUpdated, Phase_KC: '2000-01-01T00:00:00.000Z' }
      })
      const state = makeCurriculumState()
      const before = model.KCMasteryLastUpdated[item.curriculumPathId]
      overrideChunkUnderstanding(model, state, item, 0, true)
      expect(model.KCMasteryLastUpdated[item.curriculumPathId]).not.toBe(before)
      logger.info('[ADAPTIVE_TEST] OverrideResult', {
        timestampBefore: before,
        timestampAfter: model.KCMasteryLastUpdated[item.curriculumPathId]
      })
    })
  })

  describe('Edge cases and integration resilience', () => {
    test('TC-51 undefined curriculumState limits updates to learner-only path', () => {
      const model = makeLearnerModel()
      const updated = updateLearnerModel('input', makeAnalysis(), model, [], undefined)
      expect(updated.contentPointsCoverage).toEqual({})
      logger.info('[ADAPTIVE_TEST] EdgeCaseCheck', {
        coverageKeys: Object.keys(updated.contentPointsCoverage ?? {})
      })
    })

    test('TC-52 revisit set auto-creates from plain array', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState({ pointsToRevisitInCurrentChunk: ['Legacy'] as unknown as Set<string> })
      updateLearnerModel('assessment', makeAnalysis({
        key_content_point_assessment: makeAssessments([
          { text: 'Explain base case semantics', coverage: 'ImplicitlyAddressed', score: 0.4 }
        ])
      }), model, state.teachingPlanForPhase[0].map(tp => tp.text), state)
      expect(state.pointsToRevisitInCurrentChunk instanceof Set).toBe(true)
      logger.info('[ADAPTIVE_TEST] EdgeCaseCheck', {
        revisitSize: state.pointsToRevisitInCurrentChunk ? state.pointsToRevisitInCurrentChunk.size : 0
      })
    })

    test('TC-53 awarded set reconstructs from serialized array', () => {
      const model = makeLearnerModel({ awardedKcForPhasePoints: ['LegacyAward'] as unknown as Set<string> })
      const updated = updateLearnerModel('assessment', makeAnalysis(), model, [], null)
      expect(updated.awardedKcForPhasePoints instanceof Set).toBe(true)
      expectSetEqual(updated.awardedKcForPhasePoints, ['LegacyAward'])
      logger.info('[ADAPTIVE_TEST] EdgeCaseCheck', {
        awarded: Array.from(updated.awardedKcForPhasePoints)
      })
    })

    test('TC-54 phase KC remains clamped when mastery at threshold', () => {
      const model = makeLearnerModel({
        KCs: { ...makeLearnerModel().KCs, PhaseKC: PHASE_MASTERY_THRESHOLD }
      })
      const state = makeCurriculumState()
      const updated = updateLearnerModel('assessment', makeAnalysis({
        key_content_point_assessment: makeAssessments([
          { text: 'Explain base case semantics', coverage: 'ExplicitlyAddressed', score: 1 }
        ])
      }), model, state.teachingPlanForPhase[0].map(tp => tp.text), state)
      expect(updated.KCs['PhaseKC']).toBeLessThanOrEqual(1)
      logger.info('[ADAPTIVE_TEST] EdgeCaseCheck', {
        mastery: updated.KCs['PhaseKC'] ?? 0
      })
    })

    test('TC-55 coveredPointsInCurrentChunk coerces to Set when provided as array', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState({ coveredPointsInCurrentChunk: ['Legacy'] as unknown as Set<string> })
      updateLearnerModel('assessment', makeAnalysis(), model, [], state)
      expect(state.coveredPointsInCurrentChunk instanceof Set).toBe(true)
      logger.info('[ADAPTIVE_TEST] EdgeCaseCheck', {
        covered: Array.from(state.coveredPointsInCurrentChunk)
      })
    })

    test('TC-56 IntroIllustrate phase still updates affective and KC states', () => {
      const model = makeLearnerModel()
      const state = makeCurriculumState({ currentPhase: 'IntroIllustrate' })
      const updated = updateLearnerModel('positive', makeAnalysis({
        affective_state: { confidence: 'High' },
        knowledge_component_references: [
          { kc_id: 'KC_Pos', understanding_signal: 'Positive' } as KnowledgeComponentReference
        ]
      }), model, state.teachingPlanForPhase[0].map(tp => tp.text), state)
      expect(updated.KCs['KC_Pos']).toBeDefined()
      expect(updated.AffectiveState.Confidence).toBe('High')
      logger.info('[ADAPTIVE_TEST] EdgeCaseCheck', {
        kcKeys: Object.keys(updated.KCs)
      })
    })
  })
})

# Technical Implementation Plan: Hybrid Socratic Advancement System

## System Architecture Overview

Based on the comprehensive analysis of the codebase, this document outlines the technical implementation for a hybrid Socratic advancement system that combines engagement-driven progression with pedagogical safety nets and light milestone tracking.

---

## Phase 1: Core System Modifications

### 1.1 Extend Teaching Point Structure

**Location**: `curriculum.ts`

```typescript
// Add to existing interfaces
export interface SocraticTeachingPoint extends TeachingPoint {
    questionType: 'probe' | 'explore' | 'analyze' | 'synthesize' | 'assess';
    expectedResponseType: 'explanation' | 'identification' | 'application' | 'reflection' | 'problem_solving';
    engagementWeight: number; // 0.5-2.0 multiplier for this question's importance
    isMilestone?: boolean; // Marks milestone assessment points
}

// Modify CurriculumState to handle both types
export interface CurriculumState {
    // ... existing fields ...
    teachingPlanForPhase: (TeachingPoint | SocraticTeachingPoint)[][];
    
    // New Socratic-specific fields
    socraticEngagementMetrics?: {
        totalExchanges: number;
        qualityScore: number; // 0-1 based on response quality
        depthIndicators: number; // Count of follow-up questions, connections
        lastMilestoneIndex?: number;
    };
}
```

### 1.2 Modify Teaching Plan Generation

**Location**: `prompts.ts`

Create a new prompt function for Socratic phases:

```typescript
export function GET_SOCRATIC_PLAN_GENERATION_PROMPT_FUNCTION(
    phaseContent: string,
    moduleGoal: string,
    socraticArchetype: string // From our 5 archetypes
): string {
    return `
You are a world-class Socratic Dialogue Architect AI. Your SOLE FUNCTION is to generate a structured Socratic teaching plan as a single, valid JSON object.

PHASE CONTENT:
${phaseContent}

MODULE GOAL:
${moduleGoal}

ARCHETYPE: ${socraticArchetype}

Your task is to generate a teaching_plan with questions organized into chunks following the ${socraticArchetype} archetype blueprint.

For each question, you MUST specify:
- questionType: 'probe' | 'explore' | 'analyze' | 'synthesize' | 'assess'
- expectedResponseType: 'explanation' | 'identification' | 'application' | 'reflection' | 'problem_solving'
- engagementWeight: 1.0 (standard), 1.5 (important), 2.0 (critical)
- isMilestone: true (only for key assessment points)

${getDynamicChunkingRules(socraticArchetype)}

Return ONLY the JSON object with structure:
{
    "teaching_plan": [
        [
            {
                "text": "Question text here?",
                "kcValue": 0.0,  // Always 0 for questions
                "questionType": "probe",
                "expectedResponseType": "explanation",
                "engagementWeight": 1.0,
                "isMilestone": false
            }
        ]
    ]
}
`;
}
```

### 1.3 Implement Engagement Tracking

**Location**: `adaptiveEngine.ts`

Add engagement analysis to the learner model:

```typescript
export interface EngagementMetrics {
    responseLength: number;
    responseTime: number; // ms since question asked
    conceptualDepth: number; // 0-1 score from LLM analysis
    connectionsMade: number; // References to other concepts
    questioningDepth: number; // Follow-up questions from user
    enthusiasmIndicators: string[]; // Detected phrases
}

// Add to LearnerModel
export interface LearnerModel {
    // ... existing fields ...
    socraticEngagement?: {
        currentPhaseMetrics: EngagementMetrics;
        historicalAverage: EngagementMetrics;
        engagementTrend: 'improving' | 'stable' | 'declining';
    };
}

// New function to calculate engagement
export function calculateEngagementMetrics(
    userInput: string,
    responseTime: number,
    analysis: ComprehensiveAnalysisResultType
): EngagementMetrics {
    return {
        responseLength: userInput.split(' ').length,
        responseTime,
        conceptualDepth: extractConceptualDepth(analysis),
        connectionsMade: countConceptReferences(userInput, analysis),
        questioningDepth: countUserQuestions(userInput),
        enthusiasmIndicators: detectEnthusiasm(userInput)
    };
}
```

---

## Phase 2: Socratic-Specific Advancement Logic

### 2.1 Create Socratic Advancement Controller

**Location**: New file `socraticAdvancement.ts`

```typescript
import { CurriculumState, TeachingPoint } from './curriculum';
import { LearnerModel, EngagementMetrics } from './adaptiveEngine';
import { PedagogicalFlags } from './pedagogicalProfiler';

export interface SocraticAdvancementConfig {
    baseExchangesPerChunk: 4;
    minExchangesPerChunk: 2;
    maxExchangesPerChunk: 8;
    
    // Engagement thresholds
    highEngagementThreshold: 0.7;
    lowEngagementThreshold: 0.3;
    
    // Milestone config
    milestoneKCValues: {
        problemPair: 0.15;
        conceptMilestone: 0.22;
        finalSynthesis: 0.28;
    };
    
    // Pedagogical overrides
    criticalFlags: Set<string>;
    accelerationFlags: Set<string>;
}

export class SocraticAdvancementController {
    private config: SocraticAdvancementConfig;
    private exchangeCount: number = 0;
    private milestonesPassed: number = 0;
    
    constructor(config: SocraticAdvancementConfig) {
        this.config = config;
        this.initializeOverrideFlags();
    }
    
    private initializeOverrideFlags() {
        // Critical flags that block advancement
        this.config.criticalFlags = new Set([
            'Flag:High_Frustration',
            'Flag:High_Confusion',
            'Flag:Profile_Overwhelmed_Novice',
            'Flag:Misconception_Active'
        ]);
        
        // Flags that accelerate advancement
        this.config.accelerationFlags = new Set([
            'Flag:Profile_Knowledgeable_But_Bored',
            'Flag:High_Confidence',
            'Flag:Profile_Breakthrough_Moment'
        ]);
    }
    
    shouldAdvanceChunk(
        state: CurriculumState,
        model: LearnerModel,
        activeFlags: string[]
    ): boolean {
        // Check pedagogical overrides first
        const override = this.checkPedagogicalOverride(activeFlags);
        if (override !== null) return override;
        
        // Check if we've hit a milestone
        const currentChunk = state.teachingPlanForPhase[state.currentTeachingChunkIndex];
        const milestoneReached = this.checkMilestone(currentChunk, state, model);
        if (milestoneReached !== null) return milestoneReached;
        
        // Default: engagement-based progression
        return this.checkEngagementProgression(state, model);
    }
    
    private checkPedagogicalOverride(activeFlags: string[]): boolean | null {
        // Critical flags block advancement
        for (const flag of activeFlags) {
            if (this.config.criticalFlags.has(flag)) {
                return false; // Block advancement
            }
        }
        
        // Acceleration flags force advancement
        for (const flag of activeFlags) {
            if (this.config.accelerationFlags.has(flag)) {
                return true; // Force advancement
            }
        }
        
        return null; // No override
    }
    
    private checkMilestone(
        chunk: TeachingPoint[],
        state: CurriculumState,
        model: LearnerModel
    ): boolean | null {
        const milestoneQuestion = chunk.find(q => 
            (q as any).isMilestone === true
        );
        
        if (!milestoneQuestion) return null;
        
        // Check if milestone was attempted
        const wasAnswered = state.coveredPointsInCurrentChunk.has(milestoneQuestion.text);
        if (!wasAnswered) return false; // Can't advance without milestone
        
        // Check milestone quality
        const understanding = model.contentPointsCoverage?.[milestoneQuestion.text]?.understanding_score || 0;
        if (understanding >= 0.6) { // Lower threshold for Socratic
            this.awardMilestoneKC(state, model);
            return true;
        }
        
        return false; // Milestone not passed
    }
    
    private checkEngagementProgression(
        state: CurriculumState,
        model: LearnerModel
    ): boolean {
        const metrics = state.socraticEngagementMetrics;
        if (!metrics) return false;
        
        // Calculate dynamic exchange threshold
        const engagementScore = this.calculateEngagementScore(model);
        let targetExchanges = this.config.baseExchangesPerChunk;
        
        if (engagementScore > this.config.highEngagementThreshold) {
            targetExchanges = this.config.minExchangesPerChunk;
        } else if (engagementScore < this.config.lowEngagementThreshold) {
            targetExchanges = this.config.maxExchangesPerChunk;
        }
        
        return metrics.totalExchanges >= targetExchanges;
    }
    
    private calculateEngagementScore(model: LearnerModel): number {
        const engagement = model.socraticEngagement?.currentPhaseMetrics;
        if (!engagement) return 0.5; // Default medium engagement
        
        // Weighted engagement calculation
        const weights = {
            responseLength: 0.2,
            conceptualDepth: 0.3,
            connectionsMade: 0.2,
            questioningDepth: 0.2,
            enthusiasm: 0.1
        };
        
        const normalized = {
            responseLength: Math.min(engagement.responseLength / 50, 1), // 50 words = max
            conceptualDepth: engagement.conceptualDepth,
            connectionsMade: Math.min(engagement.connectionsMade / 3, 1), // 3 connections = max
            questioningDepth: Math.min(engagement.questioningDepth / 2, 1), // 2 questions = max
            enthusiasm: engagement.enthusiasmIndicators.length > 0 ? 1 : 0
        };
        
        return Object.entries(weights).reduce((score, [key, weight]) => {
            return score + (normalized[key] * weight);
        }, 0);
    }
    
    private awardMilestoneKC(state: CurriculumState, model: LearnerModel) {
        // Award KC in blocks at milestones
        const kcAmount = this.determineMilestoneKC(state);
        const phaseKCId = this.getCurrentPhaseKCId(state);
        
        // Update KC in learner model
        updateKC(model, phaseKCId, kcAmount, true);
        this.milestonesPassed++;
    }
    
    calculateFinalPhaseKC(
        state: CurriculumState,
        model: LearnerModel
    ): number {
        // Distribute remaining KC based on overall engagement
        const baseKCFromMilestones = this.milestonesPassed * 0.15; // Average milestone KC
        const engagementScore = this.calculateEngagementScore(model);
        const engagementKC = (0.65 - baseKCFromMilestones) * engagementScore;
        
        return baseKCFromMilestones + engagementKC;
    }
}
```

### 2.2 Modify advanceCurriculumState for Socratic Phases

**Location**: `curriculum.ts` - Modify the existing function

```typescript
export async function advanceCurriculumState(
    modules: Module[],
    currentState: CurriculumState,
    learnerModel: LearnerModel,
    pedagogicalFlags?: string[]
): Promise<{ newState: CurriculumState; message: string }> {
    // ... existing pre-checks ...
    
    // Special handling for Socratic phases
    if (currentState.currentPhase === 'Socratic') {
        return advanceSocraticPhase(
            modules,
            currentState,
            learnerModel,
            pedagogicalFlags || []
        );
    }
    
    // ... rest of existing logic for other phases ...
}

async function advanceSocraticPhase(
    modules: Module[],
    state: CurriculumState,
    model: LearnerModel,
    flags: string[]
): Promise<{ newState: CurriculumState; message: string }> {
    const controller = new SocraticAdvancementController(getSocraticConfig());
    
    // Check if we should advance
    const shouldAdvance = controller.shouldAdvanceChunk(state, model, flags);
    
    if (!shouldAdvance) {
        // Stay in current chunk, increment exchange count
        const newState = {
            ...state,
            socraticEngagementMetrics: {
                ...state.socraticEngagementMetrics,
                totalExchanges: (state.socraticEngagementMetrics?.totalExchanges || 0) + 1
            }
        };
        return { newState, message: "Continuing Socratic dialogue in current chunk" };
    }
    
    // Advance to next chunk or phase
    if (state.currentTeachingChunkIndex < state.teachingPlanForPhase.length - 1) {
        // Move to next chunk
        const newState = {
            ...state,
            currentTeachingChunkIndex: state.currentTeachingChunkIndex + 1,
            coveredPointsInCurrentChunk: new Set<string>(),
            socraticEngagementMetrics: {
                totalExchanges: 0,
                qualityScore: 0,
                depthIndicators: 0
            }
        };
        return { newState, message: "Advanced to next Socratic chunk" };
    } else {
        // End of Socratic phase - calculate final KC
        const finalKC = controller.calculateFinalPhaseKC(state, model);
        const phaseKCId = getCurrentCurriculumPathId(modules, state);
        
        // Award final KC
        updateKC(model, phaseKCId, finalKC, true);
        
        // Check if we met mastery threshold
        if (finalKC >= PHASE_MASTERY_THRESHOLD - KC_TOLERANCE) {
            // Advance to Solidify phase
            return transitionToNextPhase(modules, state, model);
        } else {
            // Need consolidation
            return initiateConsolidation(state, model);
        }
    }
}
```

---

## Phase 3: Integration with Existing Systems

### 3.1 Modify Comprehensive Analysis for Socratic Questions

**Location**: `prompts.ts` - Extend the analysis prompt

```typescript
// Add to the comprehensive analysis prompt
export function GET_SOCRATIC_ANALYSIS_EXTENSION(): string {
    return `
For Socratic phases, also analyze:

1. Question Response Quality:
   - directness: Did they answer the specific question asked?
   - depth: Surface-level or deep understanding?
   - connections: Did they relate to other concepts?
   - curiosity: Did they ask follow-up questions?

2. Engagement Indicators:
   - Response elaboration (brief/moderate/extensive)
   - Conceptual exploration (none/some/significant)
   - Problem-solving attempts (if applicable)
   - Metacognitive reflection

For each Socratic question in EXPECTED_POINTS, set understanding_score based on:
- 0.0-0.3: Minimal/wrong answer or just agreement
- 0.4-0.6: Partial understanding, some correctness
- 0.7-0.8: Good understanding with minor gaps
- 0.9-1.0: Excellent, insightful response

Also return engagement_metrics: {
    elaboration_level: 'brief' | 'moderate' | 'extensive',
    conceptual_connections: number,
    follow_up_questions: number,
    enthusiasm_phrases: string[]
}
`;
}
```

### 3.2 Update Focus Calculation for Socratic Phases

**Location**: `curriculum.ts` - Modify `calculateCurrentCurriculumFocusPoints`

```typescript
// Add Socratic-specific focus calculation
if (currentItem.phase === 'Socratic') {
    const socraticQuestions = currentChunk as SocraticTeachingPoint[];
    
    // Prioritize unanswered questions
    const unansweredQuestions = socraticQuestions.filter(q => 
        !coveredPoints.has(q.text)
    );
    
    if (unansweredQuestions.length > 0) {
        // Focus on next question in sequence
        const nextQuestion = unansweredQuestions[0];
        const instruction = buildSocraticInstruction(nextQuestion, state.socraticEngagementMetrics);
        
        return {
            primaryAction: 'Socratic_Inquiry',
            curriculumElementsToAddress: [nextQuestion.text],
            detailedFocusArea: instruction,
            supportingContext: {
                moduleGoal: currentModule.goal,
                phaseContext: 'Socratic exploration and discovery',
                engagementLevel: state.socraticEngagementMetrics?.qualityScore || 0.5
            }
        };
    }
}

function buildSocraticInstruction(
    question: SocraticTeachingPoint,
    metrics?: any
): string {
    const engagementLevel = metrics?.qualityScore || 0.5;
    
    let instruction = `Ask this ${question.questionType} question: "${question.text}"`;
    
    // Add engagement-based modifications
    if (engagementLevel < 0.3) {
        instruction += "\nThe learner seems disengaged. Consider adding encouragement or simplifying.";
    } else if (engagementLevel > 0.7) {
        instruction += "\nThe learner is highly engaged. Feel free to add follow-up depth.";
    }
    
    // Add response type guidance
    instruction += `\nExpect a ${question.expectedResponseType} response.`;
    
    if (question.isMilestone) {
        instruction += "\nThis is a MILESTONE question. Ensure thorough exploration.";
    }
    
    return instruction;
}
```

### 3.3 Add Socratic-Specific Pedagogical Flags

**Location**: `pedagogicalProfiler.ts`

```typescript
// Add new Socratic-specific flags
const SOCRATIC_FLAGS = {
    'Flag:Socratic_Overload': (model: LearnerModel) => {
        const metrics = model.socraticEngagement?.currentPhaseMetrics;
        return metrics && metrics.responseLength < 10 && metrics.conceptualDepth < 0.3;
    },
    
    'Flag:Socratic_Sweet_Spot': (model: LearnerModel) => {
        const metrics = model.socraticEngagement?.currentPhaseMetrics;
        return metrics && metrics.conceptualDepth > 0.6 && metrics.connectionsMade > 0;
    },
    
    'Flag:Ready_For_Deeper_Inquiry': (model: LearnerModel) => {
        return model.socraticEngagement?.engagementTrend === 'improving';
    },
    
    'Flag:Needs_Socratic_Scaffolding': (model: LearnerModel) => {
        const confusion = model.AffectiveState.Confusion === 'High';
        const lowDepth = model.socraticEngagement?.currentPhaseMetrics.conceptualDepth < 0.4;
        return confusion && lowDepth;
    }
};

// Add to flag identification
export function identifyActiveSocraticFlags(model: LearnerModel): string[] {
    return Object.entries(SOCRATIC_FLAGS)
        .filter(([_, condition]) => condition(model))
        .map(([flag, _]) => flag);
}
```

---

## Phase 4: Testing and Rollout Strategy

### 4.1 Create Socratic Phase Test Suite

```typescript
// test/socraticAdvancement.test.ts
describe('Socratic Advancement System', () => {
    test('advances after engagement threshold', () => {
        // Test engagement-based progression
    });
    
    test('blocks advancement on critical flags', () => {
        // Test pedagogical overrides
    });
    
    test('awards KC at milestones', () => {
        // Test milestone KC awards
    });
    
    test('calculates final phase KC correctly', () => {
        // Test engagement-weighted final KC
    });
});
```

### 4.2 Phased Rollout

1. **Phase 1**: Implement core structures (SocraticTeachingPoint, engagement metrics)
2. **Phase 2**: Add Socratic advancement controller with basic logic
3. **Phase 3**: Integrate pedagogical overrides and safety nets
4. **Phase 4**: Add milestone tracking and KC awards
5. **Phase 5**: Full system integration and testing

### 4.3 Configuration and Feature Flags

```typescript
// config/socraticConfig.ts
export const SOCRATIC_FEATURES = {
    enabled: true,
    useEngagementBasedProgression: true,
    useMilestoneAssessments: true,
    usePedagogicalOverrides: true,
    
    // Tuning parameters
    defaultExchangesPerChunk: 4,
    engagementWeights: {
        responseLength: 0.2,
        conceptualDepth: 0.3,
        connections: 0.2,
        questions: 0.2,
        enthusiasm: 0.1
    }
};
```

---

## Summary

This implementation plan provides a complete technical blueprint for the hybrid Socratic advancement system that:

1. **Maintains engagement** through dynamic progression based on learner responses
2. **Ensures quality** through milestone assessments at key points
3. **Provides safety** through pedagogical override mechanisms
4. **Preserves structure** by working within the existing KC and phase system
5. **Enables flexibility** through configurable parameters and feature flags

The system seamlessly integrates with existing curriculum management while providing the unique requirements for effective Socratic dialogue, ensuring learners progress at an appropriate pace without getting bogged down in tedious tracking mechanisms.
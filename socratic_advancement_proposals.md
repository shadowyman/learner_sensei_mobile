# Three Approaches for Socratic Phase Advancement

## Context & Challenge

The current system tracks curriculum advancement through KC (Knowledge Component) values assigned to teaching points, with advancement occurring when:
- Individual points reach understanding score ≥ 0.7
- Phase KC mastery reaches ≥ 0.65

For Socratic phases, this creates challenges:
- Questions don't have the same "coverage" meaning as teaching statements
- Tracking every question's KC value could become tedious
- Users may get bored if advancement is too granular

---

## Approach 1: Chunk-Based Progression with Pedagogical Override

**Philosophy**: Advance by chunks automatically unless pedagogical concerns arise. Questions serve as engagement tools rather than assessment gates.

### Implementation:

1. **Default Advancement**:
   - Each Socratic chunk automatically advances after completion
   - No individual question tracking or KC calculations
   - Chunks are time/interaction based (e.g., 3-5 exchanges per chunk)

2. **Pedagogical Circuit Breaker**:
   ```typescript
   interface SocraticChunkState {
     chunkId: string;
     exchangeCount: number;
     maxExchanges: 5;
     pedagogicalFlags: Set<string>;
     mustStayInChunk: boolean;
   }
   ```

3. **Override Triggers** (from pedagogical profiler):
   - `Flag:High_Confusion` → Add clarification questions, extend chunk
   - `Flag:Active_Misconception` → MUST_OBEY: Address before advancing
   - `Flag:Performance_Declining` → Add easier questions
   - `Flag:Knowledgeable_But_Bored` → Skip to next chunk immediately

4. **Advancement Logic**:
   ```typescript
   function shouldAdvanceSocraticChunk(state: SocraticChunkState): boolean {
     if (state.mustStayInChunk) return false;
     if (state.pedagogicalFlags.has('Skip_Ahead')) return true;
     return state.exchangeCount >= state.maxExchanges;
   }
   ```

5. **Benefits**:
   - Fast progression by default
   - Intervention only when needed
   - No tedious point tracking
   - Responsive to learner state

---

## Approach 2: Milestone-Based Assessment

**Philosophy**: Track progress at key milestones rather than every question. Similar to video game checkpoints.

### Implementation:

1. **Milestone Structure**:
   ```typescript
   interface SocraticMilestone {
     id: string;
     triggerAfterChunks: number[];  // e.g., [2, 4, 6]
     assessmentType: 'problem_solving' | 'concept_explanation' | 'pattern_recognition';
     passThreshold: 0.6;  // Lower than teaching (0.7) for conversational flow
   }
   ```

2. **For LeetCode Problems** (dynamic chunks):
   - Milestone after every 2 problems solved
   - Quick assessment: "What pattern connected those problems?"
   - Pass = advance, Struggle = one more problem before next milestone

3. **For Concept/Comparison Archetypes** (3 chunks):
   - Single milestone after chunk 2
   - Assessment through natural dialogue
   - No explicit "testing" feel

4. **Flexible KC Assignment**:
   ```typescript
   // Award KC in larger blocks at milestones
   const MILESTONE_KC_VALUES = {
     'problem_pair': 0.15,      // After 2 problems
     'concept_milestone': 0.22,  // After concept exploration
     'final_synthesis': 0.28     // After synthesis chunk
   };
   // Total still sums to ~0.65 for phase
   ```

5. **Benefits**:
   - Natural assessment points
   - Maintains conversational flow
   - Less granular tracking
   - Clear progress indicators

---

## Approach 3: Engagement-Driven Progression

**Philosophy**: Use engagement metrics and response quality as implicit advancement signals. No explicit assessment.

### Implementation:

1. **Engagement Signals**:
   ```typescript
   interface EngagementMetrics {
     responseLength: number;        // Longer = more engaged
     responseTime: number;          // Too fast = not thinking
     questionDepth: number;         // Follow-up questions asked
     conceptConnections: number;    // References to other concepts
     enthusiasmMarkers: string[];   // "Oh!", "I see!", "That makes sense!"
   }
   ```

2. **Automatic Advancement Rules**:
   - **Quick advance**: High engagement + correct understanding
   - **Normal advance**: Moderate engagement, reasonable responses
   - **Extended engagement**: Low response quality but trying
   - **Skip ahead**: Demonstrating mastery through responses

3. **Dynamic Chunk Sizing**:
   ```typescript
   function calculateChunkExchanges(engagement: EngagementMetrics): number {
     if (engagement.responseLength < 20) return 6;  // Need more engagement
     if (engagement.conceptConnections > 2) return 3;  // Already making connections
     return 4;  // Default
   }
   ```

4. **Implicit KC Award**:
   - Award full phase KC (0.65) distributed based on engagement
   - High engagement throughout = full KC
   - Low engagement = 0.4-0.5 KC (may trigger consolidation)
   - No per-question tracking

5. **LeetCode Problem Handling**:
   - If solving problems correctly → fast advance
   - If struggling but engaged → more scaffolding questions
   - If disengaged → switch to different problem type

6. **Benefits**:
   - No explicit assessment feels
   - Rewards engagement over perfection
   - Natural conversation flow
   - Adapts to learner style

---

## Recommendation: Hybrid Approach

**Combine the best of all three**:

1. **Base System**: Engagement-Driven (Approach 3)
   - Natural conversation flow
   - Implicit progress tracking

2. **Safety Net**: Pedagogical Override (Approach 1)
   - MUST_OBEY for critical issues
   - Prevents harmful progression

3. **Progress Markers**: Light Milestones (Approach 2)
   - After problem sets or major concepts
   - Provides clear progress feedback

### Implementation Strategy:

```typescript
interface SocraticProgressionConfig {
  // Base progression
  defaultExchangesPerChunk: 4;
  engagementMultiplier: 0.5 to 2.0;  // Modifies exchange count
  
  // Milestone checks (light touch)
  milestoneAfterChunks: [2, 4];  // For longer sequences
  
  // Pedagogical overrides
  criticalFlags: Set<string>;  // Blocks advancement
  boostFlags: Set<string>;     // Accelerates advancement
  
  // KC award strategy
  kcDistribution: 'uniform' | 'engagement_weighted' | 'milestone_based';
}
```

### Benefits of Hybrid:
- Maintains fast, natural progression
- Provides safety mechanisms for struggling learners
- Clear progress indicators without tedium
- Flexible enough for all module types
- Respects the conversational nature of Socratic dialogue

This hybrid approach ensures learners stay engaged while still maintaining pedagogical integrity and the ability to track overall phase mastery for curriculum progression.
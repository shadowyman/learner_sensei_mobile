# Prompt Size Optimization Strategy

## Executive Summary
Current prompts total **38.4KB** for a 14-character input ("i dont get it"), resulting in 61+ seconds of processing. This document outlines specific strategies to reduce prompt sizes by **70-80%** while maintaining functionality.

---

## Current State Analysis

### 1. Analysis Prompt: 15KB → Target: 3KB (80% reduction)
**File**: `prompts.ts:779-893`
**Current Issues**:
- Full instruction block repeated every call (2KB)
- Complete JSON schema embedded (1.5KB)
- All misconception IDs included always (1KB)
- All expected points included verbatim (varies, ~2-5KB)
- Extensive chain-of-thought instructions (2KB)
- Redundant examples and edge cases (1KB)

### 2. Pedagogical Prompt: 16.5KB → Target: 2KB (88% reduction)
**File**: `pedagogicalProfiler.ts:22-102`
**Current Issues**:
- Full conversation history (last 3 turns, ~8-10KB)
- Massive instruction template (2.8KB)
- 9 persona descriptions (1.5KB)
- Extensive decision tree explanations (2KB)
- Formatting rules repeated (0.5KB)

### 3. Response Prompt: 6.9KB → Target: 2KB (71% reduction)
**File**: Likely in `interactionHelpers.ts` and `prompts.ts`
**Current Issues**:
- Full Mermaid guidelines (1.5KB+)
- All curriculum context (2-3KB)
- Phase-specific instructions (1-2KB)

---

## Optimization Strategies

### Strategy 1: Dynamic Prompt Assembly (Immediate Impact)

#### A. Context-Aware Inclusion
```javascript
// Instead of always including everything:
function getOptimizedAnalysisPrompt(userInput: string, context: AnalysisContext) {
    // Base prompt: 200 chars
    let prompt = `Analyze user input and return JSON per schema.`;

    // Only add misconception check if relevant keywords detected
    if (hasRecursionKeywords(userInput)) {
        prompt += `\nCheck misconceptions: ${RELEVANT_MISCONCEPTIONS}`;
    }

    // Only include expected points if teaching new content
    if (context.isTeachingPhase) {
        prompt += `\nAssess understanding of: ${context.currentPoints}`;
    }

    // Add minimal schema reference
    prompt += `\nReturn format: ComprehensiveAnalysis JSON`;

    return prompt;
}
```

**Savings**: 10-12KB per analysis call

#### B. Reference-Based Instructions
Instead of embedding full instructions, use references:
```javascript
// OLD: 2.8KB instruction block
const FULL_INSTRUCTIONS = `[2800 characters of instructions]`;

// NEW: 100 chars reference
const INSTRUCTION_REF = `Follow pedagogical_guidance_v3 protocol. Focus: ${activeFlags.join(',')}`;
```

**Savings**: 2.5KB per pedagogical call

---

### Strategy 2: Conversation History Compression

#### A. Summary Instead of Full History
```javascript
// OLD: Include full 3 turns (8-10KB)
const history = {
    turn1: { sensei: fullMessage1, user: fullResponse1 },
    turn2: { sensei: fullMessage2, user: fullResponse2 },
    turn3: { sensei: fullMessage3, user: fullResponse3 }
};

// NEW: Compressed summary (500 chars)
const historySummary = {
    recentPattern: "explanation->confusion->clarification",
    keyPoints: ["recursion base case", "stack overflow concern"],
    emotionalTrend: "frustrated->confused->engaging",
    lastUserIntent: "seeking_clarification"
};
```

**Savings**: 7-9KB per guidance call

#### B. Delta-Only Updates
```javascript
// Track what changed since last analysis
const deltaContext = {
    newFlags: ["High_Confusion"], // Only new flags
    removedFlags: ["High_Confidence"],
    intentChange: "understanding->confusion",
    topicProgression: 0.2 // How much progress on current topic
};
```

**Savings**: 5-6KB when state hasn't changed much

---

### Strategy 3: Schema Externalization

#### A. Use Schema IDs Instead of Full Schemas
```javascript
// OLD: Embed full schema (1.5KB)
const prompt = `Return this exact JSON structure:
{
  "affective_state": {
    "confidence": "'Low' | 'Medium' | 'High'",
    // ... 20 more fields
  }
}`;

// NEW: Reference schema (50 chars)
const prompt = `Return JSON matching schema: ANALYSIS_SCHEMA_V2`;
```

**Savings**: 1.4KB per call

#### B. Selective Field Requirements
```javascript
// Only request fields relevant to current context
function getRequiredFields(userInput: string) {
    const fields = ['primary_intent']; // Always needed

    if (isQuestion(userInput)) {
        fields.push('affective_state.confusion');
    }
    if (isAnswer(userInput)) {
        fields.push('key_content_point_assessment');
    }

    return fields;
}
```

**Savings**: 1-2KB by omitting unused fields

---

### Strategy 4: Instruction Caching & Versioning

#### A. System-Level Instruction Caching
```javascript
// Pre-load instructions at session start
const INSTRUCTION_CACHE = {
    analysis_v2: "hashA1B2C3",
    pedagogical_v3: "hashD4E5F6",
    response_v1: "hashG7H8I9"
};

// Reference by hash in prompts
const prompt = `Use instruction set: ${INSTRUCTION_CACHE.analysis_v2}`;
```

**Savings**: 2-3KB per call after first load

#### B. Incremental Instructions
```javascript
// Base instruction + modifications
const prompt = `
Base: standard_analysis
Modifications:
- Focus on confusion signals
- Skip misconception check
- Emphasize affective state
`;
```

**Savings**: 1-2KB vs full instructions

---

### Strategy 5: Smart Defaults & Inference

#### A. Implicit Understanding Rules
```javascript
// OLD: Explicit 500+ char rules for understanding scores
const rules = `If Check Understanding questions exist, analyze...
If multiple questions were asked...
A score of 1.0 is for perfect...`;

// NEW: Simple heuristic (50 chars)
const rules = `Score 0-1 based on answer quality vs questions asked`;
```

**Savings**: 450 chars per assessment

#### B. Context-Aware Defaults
```javascript
// Don't send obvious context
if (userInput === "ok" || userInput === "got it") {
    // Skip analysis entirely, use defaults
    return DEFAULT_ACKNOWLEDGMENT_ANALYSIS;
}
```

**Savings**: 15KB for simple acknowledgments

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)
1. **Remove redundant instructions** (prompts.ts)
   - Extract static instructions to constants
   - Use references instead of embedding
   - **Impact**: 5-6KB reduction immediately

2. **Compress conversation history** (pedagogicalProfiler.ts)
   - Summarize instead of full text
   - **Impact**: 7-9KB reduction

3. **Skip analysis for simple inputs**
   - Pattern match common acknowledgments
   - **Impact**: 15KB savings on 30% of inputs

### Phase 2: Structural Changes (3-5 days)
1. **Dynamic prompt assembly**
   - Context-aware field inclusion
   - **Impact**: 10-12KB reduction

2. **Schema externalization**
   - Reference schemas by ID
   - **Impact**: 2-3KB reduction

3. **Delta-based updates**
   - Only send changes
   - **Impact**: 5-6KB for subsequent calls

### Phase 3: Advanced Optimization (1 week)
1. **Instruction caching system**
   - Session-level instruction storage
   - **Impact**: 3-4KB after warm-up

2. **Compression algorithms**
   - LZ-string for history compression
   - **Impact**: 40-50% size reduction

3. **Smart batching**
   - Combine related queries
   - **Impact**: Eliminate redundant calls

---

## Expected Results

### Performance Improvements
| Metric | Current | Optimized | Improvement |
|--------|---------|-----------|-------------|
| Analysis Prompt | 15KB | 3KB | 80% reduction |
| Pedagogical Prompt | 16.5KB | 2KB | 88% reduction |
| Response Prompt | 6.9KB | 2KB | 71% reduction |
| **Total Prompt Size** | **38.4KB** | **7KB** | **82% reduction** |

### Time Savings (Estimated)
- Analysis: 11.77s → 3s (prompt reduction + faster API)
- Guidance: 25.47s → 5s (smaller prompt + caching)
- Response: 24.07s → 8s (streamlined instructions)
- **Total: 61.33s → 16s** (74% faster)

---

## Specific Code Changes Needed

### 1. `prompts.ts` Changes
```javascript
// Add prompt optimization functions
export function getOptimizedAnalysisPrompt(
    userInput: string,
    lastSenseiMsg: string | null,
    taskId: string,
    options: AnalysisOptions = {}
): string {
    const base = `Analyze input, return JSON.`;
    const context = options.includeHistory ?
        summarizeContext(lastSenseiMsg) : '';
    const schema = options.fullSchema ?
        FULL_SCHEMA : 'Use ANALYSIS_SCHEMA_V2';

    return `${base}\nInput: ${userInput}\n${context}\n${schema}`;
}
```

### 2. `pedagogicalProfiler.ts` Changes
```javascript
// Replace full history with summaries
private summarizeHistory(
    userResponses: string[],
    senseiResponses: string[]
): HistorySummary {
    return {
        patterns: this.detectPatterns(userResponses),
        trajectory: this.analyzeTrajectory(userResponses),
        keyTopics: this.extractKeyTopics(senseiResponses),
        totalChars: 500 // Cap at 500 chars
    };
}
```

### 3. `geminiService.ts` Changes
```javascript
// Add caching layer
const promptCache = new Map<string, string>();

export async function getCachedAnalysis(
    cacheKey: string,
    generator: () => string
): Promise<AnalysisResult> {
    if (!promptCache.has(cacheKey)) {
        promptCache.set(cacheKey, generator());
    }
    return runAnalysis(promptCache.get(cacheKey));
}
```

---

## Risk Mitigation

### Potential Issues & Solutions

1. **Loss of Context**
   - Risk: Compressed history might miss nuances
   - Solution: Keep full history for critical flags (High_Frustration)

2. **Schema Mismatch**
   - Risk: Referenced schemas might not sync
   - Solution: Version schemas and validate responses

3. **Reduced Analysis Quality**
   - Risk: Shorter prompts might reduce accuracy
   - Solution: A/B test with quality metrics

4. **Caching Staleness**
   - Risk: Cached prompts might be outdated
   - Solution: TTL-based cache invalidation

---

## Validation Plan

### Metrics to Track
1. **Prompt size reduction** (bytes)
2. **Response time improvement** (seconds)
3. **Analysis accuracy** (compare outputs)
4. **User experience** (perceived speed)

### Testing Approach
1. **Baseline**: Capture current outputs for test inputs
2. **A/B Testing**: Run both versions in parallel
3. **Quality Check**: Ensure outputs remain equivalent
4. **Performance Validation**: Measure actual time savings

---

## Next Steps

1. **Immediate Action**: Implement Phase 1 optimizations
2. **Measurement**: Add prompt size logging
3. **Iteration**: Refine based on actual results
4. **Documentation**: Update prompt engineering guidelines

The optimization can begin with the highest-impact, lowest-risk changes (removing redundant instructions and compressing history) before moving to more complex structural changes.
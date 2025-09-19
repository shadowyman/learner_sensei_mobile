# Performance Logging Test Guide

## Overview
This document provides instructions for testing the comprehensive performance logging system that has been added to track execution times across the Sensei teaching flow.

## Performance Logging Coverage

The following critical functions now have performance logging:

### 1. User Input Flow
- **handleUserInput** - Tracks overall input processing time
  - Initial setup
  - Input history management
  - Message creation and display
  - Mermaid processing
  - Special command handling (mskip)
  - Module selection
  - Response generation trigger

### 2. Response Generation Flow
- **generateNextSenseiResponse** - Main orchestration function
  - Initialization
  - Curriculum item retrieval
  - Teaching plan ensuring
  - Gemini analysis
  - Learner model update
  - Curriculum advancement
  - Pedagogical guidance
  - System instruction building
  - Response streaming

### 3. AI Analysis
- **getAnalysisFromGemini** - LLM-based learner analysis
  - Prompt generation
  - LLM API call timing
  - JSON response parsing

### 4. Learner Model
- **updateLearnerModel** - Complex state updates
  - Model cloning
  - Affective state updates
  - Cognitive load calculations
  - SRL indicators
  - Misconception tracking
  - Knowledge component updates
  - Content coverage
  - Learning trajectory
  - ZPD estimation

### 5. Curriculum Management
- **advanceCurriculumState** - Curriculum progression logic
  - Socratic phase handling
  - Chunk completion checking
  - Phase completion handling
  - Teaching plan generation

### 6. LLM Streaming
- **streamMainSenseiResponse** - Response streaming from LLM
  - Prompt preparation
  - Stream initiation
  - Chunk counting
  - First chunk timing

## Testing Instructions

### 1. Enable Performance Logging
Performance logging is enabled by default via `DEBUG_FLAGS.performance_debug = true` in `logger.ts`.

### 2. Start the Application
```bash
npm run dev
```

### 3. Open Debug Console
1. Click the debug icon in the UI (usually in the bottom right)
2. Navigate to the "Console" tab
3. You should see performance logs appearing with `[PERF-START]` and `[PERF-END]` tags

### 4. Test User Interactions
Perform these actions to trigger performance logging:

#### Basic Interaction Test
1. Select a module
2. Type a response to Sensei
3. Submit your response
4. Watch the console for performance logs

Expected logs:
```
[PERF-START] 2025-09-18T10:30:45.123Z | handleUserInput:TOTAL | Starting performance measurement
[PERF-START] 2025-09-18T10:30:45.124Z | generateResponse:TOTAL | Starting performance measurement
[PERF-START] 2025-09-18T10:30:45.125Z | geminiAnalysis:TOTAL | Starting performance measurement
[PERF-END] 2025-09-18T10:30:46.456Z | geminiAnalysis:TOTAL | Duration: 1.33s
[PERF-START] 2025-09-18T10:30:46.457Z | updateLearnerModel:TOTAL | Starting performance measurement
[PERF-END] 2025-09-18T10:30:46.478Z | updateLearnerModel:TOTAL | Duration: 21.00ms
...
```

#### Special Command Test (mskip)
1. Type "mskip" and submit
2. This triggers a different code path with specific performance tracking

#### Module Selection Test
1. Reset the application state
2. Select a new module
3. This triggers module selection performance tracking

### 5. View Performance Summary
Click the **"⏱️ Perf Summary"** button in the debug console to see aggregated statistics:

```
[PERF-SUMMARY] Performance Statistics:
============================================================
[PERF-STATS] handleUserInput:TOTAL:
  - Count: 5
  - Average: 2450.34ms
  - Min: 1200.45ms
  - Max: 3800.67ms
  - Total: 12251.70ms
[PERF-STATS] geminiAnalysis:llm-call:
  - Count: 5
  - Average: 1250.23ms
  - Min: 980.34ms
  - Max: 1680.45ms
  - Total: 6251.15ms
...
============================================================
```

### 6. Clear Performance Metrics
Click the **"🗑️ Clear Perf"** button to reset all performance metrics and start fresh.

### 7. Download Logs
Click the **"💾 Download Logs"** button to save all logs (including performance logs) to a file.

## Performance Metrics Interpretation

### Key Metrics to Monitor

1. **handleUserInput:TOTAL** - Overall time from user input to response generation start
   - Expected: < 100ms for UI operations
   - Concern if: > 500ms

2. **geminiAnalysis:llm-call** - Time for AI analysis API call
   - Expected: 500-2000ms
   - Concern if: > 3000ms

3. **updateLearnerModel:TOTAL** - Learner model update processing
   - Expected: < 50ms
   - Concern if: > 200ms

4. **streamSenseiResponse:llm-stream** - Time to stream full response
   - Expected: 1000-5000ms depending on response length
   - Monitor: First chunk time (should be < 1000ms)

5. **advanceCurriculum:TOTAL** - Curriculum state advancement
   - Expected: < 100ms without teaching plan generation
   - With teaching plan: 500-2000ms

### Performance Bottlenecks to Watch

1. **LLM API Calls** - Usually the slowest operations
   - `geminiAnalysis:llm-call`
   - `streamSenseiResponse:llm-stream`

2. **Teaching Plan Generation** - Can be slow on phase transitions
   - Look for `initializeNewPhase:generate-teaching-plan`

3. **Complex State Updates** - Multiple nested operations
   - `updateLearnerModel:content-point-assessment`

## Troubleshooting

### No Performance Logs Appearing
1. Check that `DEBUG_FLAGS.performance_debug = true` in `logger.ts`
2. Ensure the console tab is active in debug mode
3. Check browser console for any errors

### Performance Summary Not Working
1. Ensure you've performed some interactions first
2. Check that the performance buttons are visible in the debug console
3. Look for errors in the browser console

### Metrics Seem Incorrect
1. Clear metrics with "Clear Perf" button
2. Perform fresh interactions
3. Check for overlapping timer labels (they should be unique)

## Advanced Analysis

### Export for External Analysis
1. Let the application run for several interactions
2. Click "Perf Summary" to log statistics
3. Click "Download Logs" to export
4. Import into spreadsheet or analysis tool
5. Look for patterns in performance over time

### Identifying Performance Regressions
1. Establish baseline metrics with current code
2. After code changes, run same test scenarios
3. Compare average times for key operations
4. Look for operations that increased by > 20%

## Next Steps for Performance Optimization

Based on the metrics collected, consider:

1. **Caching Strategies**
   - Cache teaching plans
   - Cache analysis results for similar inputs

2. **Parallel Processing**
   - Run independent operations concurrently
   - Batch UI updates

3. **Debouncing/Throttling**
   - Debounce rapid user inputs
   - Throttle expensive operations

4. **Code Splitting**
   - Lazy load heavy components
   - Defer non-critical operations

## Conclusion

The performance logging system provides comprehensive visibility into the Sensei teaching system's performance characteristics. Use these metrics to:
- Identify bottlenecks
- Track performance over time
- Validate optimization efforts
- Ensure consistent user experience

Regular monitoring of these metrics will help maintain and improve system performance.
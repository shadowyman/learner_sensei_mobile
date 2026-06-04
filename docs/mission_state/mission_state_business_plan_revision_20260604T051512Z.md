# Mission State: Business Plan Revision

Timestamp: 20260604T051512Z

## Scope

Revise `tmp/recursive_sensei_business_plan_roadmap_campaigns.md` from a mechanically line-numbered list into a comprehensive analyst-grade business guide for Recursive Sensei.

## Core Analysis Snapshot

Analyzer command: `npm run analysis:run`

Analyzer brief confirmed the product surface is concentrated in `src`, `core`, `bff`, and `SenseiMobile`.

Top fan-out files:

- `src/index.tsx`
- `src/moduleSelectionHandler.ts`
- `src/ui.ts`
- `src/geminiService.ts`
- `SenseiMobile/src/mobile/MainScreen.tsx`
- `src/curriculum.ts`
- `src/selectionSensei.ts`
- `src/saveloadProgressManager.ts`
- `src/mobile/webviewMessageRouter.ts`
- `src/interactionHelpers.ts`

Top fan-in files:

- `src/logger.ts`
- `SenseiMobile/src/logger.ts`
- `src/model_usage.ts`
- `src/adaptiveEngine.ts`
- `src/curriculum.ts`
- `SenseiMobile/src/mobile/bridge/contracts.ts`
- `core/wrapUpAssessment.ts`
- `core/teachingPlan.ts`
- `core/learnerAnalysis.ts`
- `src/mobile/bridge/contracts.ts`

## Business-Relevant Product Understanding

Recursive Sensei should be described as a React Native iOS app with embedded WebView and native bridge plus a complete web learning runtime, not as SwiftUI and not as a recursion-only prototype.

The business plan must treat `Modules.txt` as the subject expansion unit and the `/src` capabilities as the product basis:

- Curriculum parsing and module/concept/phase progression.
- Teaching-plan generation and normalization.
- Adaptive learner model with mastery, affect, cognitive load, misconceptions, and revisit points.
- Pedagogical profiler directives.
- Selection Sensei contextual micro-tutoring.
- Anchored enhancement and key takeaway insertion.
- Concept-aware notepad and export/import.
- Wrap-up assessments.
- Code editor.
- Mermaid diagrams and recovery.
- Save/load continuity.
- Web-to-mobile bridge and BFF routing.

## Risk Register

- Product-positioning risk: overclaiming "any subject" before multi-subject QA.
- Commercial risk: broad AI tutor language collapses differentiation against generic chat.
- Margin risk: teaching plans, learner analysis, Selection Sensei, enhancement, and wrap-up all imply model-cost exposure.
- Trust risk: academic integrity and factual-subject safety require explicit framing.
- Execution risk: B2B and creator platform work can distract from first paid retention proof.

## Coverage Checklist For Rewrite

- Business thesis.
- Valuation logic.
- Product positioning.
- Roadmap.
- Subject strategy.
- Audience profiles.
- Campaign architecture.
- Paid ad targets.
- Trade show and partnership strategy.
- Sales motion.
- Metrics and KPI system.
- Financial model.
- Operating plan.
- Risks and tradeoffs.
- Expansion opportunities.
- 30/60/90/180-day plan.

## Unknowns

- Real user retention is unknown until beta cohorts run.
- AI cost per completed learning loop is unknown until production instrumentation is active.
- Subject pack conversion beyond recursion is internally promising but commercially unproven.
- App Store subscription economics and funnel performance are unknown until launch tests run.

## Next Protocol

No additional implementation protocol is needed because this task rewrites a planning artifact rather than production code. The next step is to revise the document using the analyzer, valuation report, repo evidence, and current public market/channel sources.

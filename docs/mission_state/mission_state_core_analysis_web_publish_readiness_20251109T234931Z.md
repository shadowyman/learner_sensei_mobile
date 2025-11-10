Title: Core Analysis – Web Publish Readiness (repo‑wide)
Date: 2025-11-09T23:49:31Z
Triggering Request: Run core analysis to assess frontend/backend and feasibility of publishing on the web

Scope & Entry Points
- Primary entry point: `src/index.tsx` (browser SPA orchestrating curriculum, UI, and LLM flows).
- Supporting orchestrators: `src/ui.ts`, `src/moduleSelectionHandler.ts`, `src/geminiService.ts`, `src/interactionHelpers.ts`, `src/saveloadProgressManager.ts`, `src/curriculum.ts`, `src/adaptiveEngine.ts`, `src/logger.ts`.
- No active server/API implementation present. Folder `server/` only contains Vite config and package scaffolding; no API routes.
- Frontend resources: `src/index.html`, `src/index.css`, large DOM/Markdown/Mermaid utilities in `src/ui.ts` and friends.

Hot Modules (from analyzer)
- Top fan-in: `src/logger.ts (21)`, `src/model_usage.ts (11)`, `src/adaptiveEngine.ts (10)`, `src/curriculum.ts (10)`, `src/ui.ts (8)`, `src/prompts.ts (7)`, `src/geminiService.ts (5)`.
- Top fan-out: `src/index.tsx (19)`, `src/moduleSelectionHandler.ts (9)`, `src/ui.ts (8)`, `src/curriculum.ts (6)`, `src/selectionSensei.ts (6)`, `src/saveloadProgressManager.ts (6)`, `src/geminiService.ts (5)`.

Static Execution Trace (high level)
1) App bootstrap
   - `index.html` loads styles, CDN libraries, import maps; initializes Mermaid manager.
   - `src/index.tsx` initializes UI (`initializeUI`), event handlers, and calls `initializeGoogleAI` → constructs `GoogleGenAI` and persistent chat; exposes `window.ai`.
2) User interaction cycle
   - On submit: `generateNextSenseiResponse` → `getCurrentCurriculumItem` → `getAnalysisFromGemini` (LLM JSON analysis) → `updateLearnerModel` → build dynamic instruction → `streamMainSenseiResponse` (LLM streaming) → `displayMessage`/`processMermaidBlocks` → `advanceCurriculumState`.
3) Module selection
   - `ModuleSelectionHandler.handleInitialModuleSelectionInternal` and `.handleClickedModuleSelection` produce phase-selection UI; may call `streamModuleIntroduction`.
4) Wrap‑Up assessment
   - `createLLMPlannerCallback` (Solidify phase) → `generateWrapUpAssessment` (LLM JSON/tool-calls) → `validateWrapUpAssessmentQuestions` → overlay UI.
5) Save/Load session
   - `SaveLoadProgressManager.saveProgress` collects state and downloads JSON; `.loadProgress` restores from JSON and rehydrates chat/UI; reinitializes Selection Sensei.

Dependency & Side‑Effect Summary (selected functions)
- src/index.tsx::initializeGoogleAI#2c32a66bda0a
  - Depends: `GoogleGenAI`, `MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG`, UI setters.
  - Side effects: Creates persistent chat; sets `window.ai`; logs; writes UI state. Risk: High (network credentials), Medium (global state).

- src/index.tsx::generateNextSenseiResponse#6d82a88a2f68
  - Depends: curriculum selectors, `geminiService.getAnalysisFromGemini`, `interactionHelpers.streamMainSenseiResponse`.
  - Side effects: Network LLM calls; UI streaming updates; learner model mutation; curriculum advancement. Risk: High (network), Medium (state consistency under errors/concurrency).

- src/geminiService.ts::getAnalysisFromGemini#7e56f02c9909
  - Depends: `COMPREHENSIVE_ANALYSIS_CONFIG` (Gemini Flash), prompt builders.
  - Side effects: Network call; JSON parsing; logs. Risk: High (LLM dependency), Medium (parse failures).

- src/geminiService.ts::llmExtractAndPlanTeachingOrder#884c8df6a9df
  - Depends: teaching plan prompt fns; phase conditions.
  - Side effects: Network call; logs. Risk: High.

- src/interactionHelpers.ts::streamMainSenseiResponse#83c382dafa6d
  - Depends: `Chat.sendMessageStream`, `updateMessageStream`.
  - Side effects: Long‑lived streaming; frequent DOM writes. Risk: Medium (backpressure/tearing), Low (UI jank mitigations needed).

- src/saveloadProgressManager.ts::SaveLoadProgressManager.saveProgress#ab1e01a237e0 / #65c666c3fcd2
  - Depends: serializers; window‑exposed app state; Blob/URL APIs.
  - Side effects: File download; clipboard/URL usage; async waits for active streams. Risk: Medium (state drift; large file sizes), Low (permissions).

- src/ui.ts::displayMessage#7a6d45d0bd75
  - Depends: DOM, Markdown/KaTeX/highlight, mermaid manager.
  - Side effects: Heavy DOM innerHTML updates; event binding; accessibility roles. Risk: Medium (XSS via markdown; performance with large payloads).

Risk Register (high‑impact/high‑blast)
- Client‑side LLM key exposure: `src/index.tsx` embeds a dev API key for localhost and relies on `process.env.API_KEY` for prod, but there is no bundler or backend to inject/guard it. High risk of key exfiltration, quota abuse, compliance issues.
- No backend/proxy: All LLM calls go directly from browser to Google APIs. High risk for billing security and limited control (rate limits, observability, CORS, retries).
- Build pipeline gaps: `server/vite.config.ts` doesn’t set `root` to `src/`; current `index.html` imports `.ts` modules directly and relies on CDN import maps. Not production‑robust. High risk for broken builds and inconsistent environments.
- Third‑party CDN reliance without SRI/CSP: highlight.js, anime.js, esm.sh imports lack Subresource Integrity and CSP headers. High supply‑chain risk.
- Markdown rendering surface: `marked` with KaTeX and Mermaid can render arbitrary content. Without a sanitizer, XSS is possible via user/LLM content. High risk.
- Observability gaps: Logs only in memory/console and downloadable files; no remote telemetry, no error reporting pipeline. Medium operational risk.
- Performance hotspots: Single huge `src/ui.ts` doing heavy DOM updates and Markdown processing; Mermaid renders can stall main thread. Medium UX risk on mid‑range devices.
- State concurrency: Streaming + save/load restoring + module switching may race. Medium consistency risk without transactional guards.

Unknowns Register (with verification plans)
- Deployment target/platform? (static hosting vs. serverless vs. container). Plan: confirm target to shape build (Vite) + API proxy.
- Data policy/compliance needs (PII, retention, geography)? Plan: decide retention and add server/store policy; set Gemini safety config.
- Browser support matrix? Plan: run Lighthouse + Browserstack on a Vite build; polyfill only as needed.
- Expected traffic and rate limits? Plan: load test proxy endpoints; configure quotas and backoff.
- Authentication/authorization required? Plan: if multi‑tenant, add auth (OIDC) and per‑user rate limiting.

Coverage Checklist (functions to validate with logs/tests)
- `src/index.tsx::initializeGoogleAI#2c32a66bda0a`
- `src/index.tsx::generateNextSenseiResponse#6d82a88a2f68`
- `src/interactionHelpers.ts::streamMainSenseiResponse#83c382dafa6d`
- `src/interactionHelpers.ts::streamModuleIntroduction#a30221feb981`
- `src/interactionHelpers.ts::buildSenseiDynamicSystemInstruction#a7178d22e0be`
- `src/geminiService.ts::getAnalysisFromGemini#7e56f02c9909`
- `src/geminiService.ts::llmExtractAndPlanTeachingOrder#884c8df6a9df`
- `src/geminiService.ts::generateWrapUpAssessment#e5c9a027f9e4`
- `src/saveloadProgressManager.ts::SaveLoadProgressManager.saveProgress#ab1e01a237e0`
- `src/saveloadProgressManager.ts::SaveLoadProgressManager.loadProgress#65c666c3fcd2`
- `src/ui.ts::displayMessage#7a6d45d0bd75`
- `src/moduleSelectionHandler.ts::ModuleSelectionHandler.handleInitialModuleSelectionInternal#7e7e71da3b48`
- `src/moduleSelectionHandler.ts::ModuleSelectionHandler.handleClickedModuleSelection#75de233f311e`

Key Architectural Insights
- The application is a browser‑only SPA with no backend. All persistence is client‑side (localStorage + downloadable JSON). LLM calls run directly in the browser.
- The `server/` folder is not wired to the app; Vite config lacks a `root` pointing to `src/` and no API routes are defined.
- Production readiness hinges on adding a minimal backend (serverless proxy) and a real build pipeline (Vite) that bundles TS/JS and injects env vars.
- Security hard stop: remove the embedded dev API key and prevent client‑side exposure in production.

Initial Recommendation (feasibility)
- Not ready to “publish as is.” Minimal changes required:
  1) Introduce a serverless/edge API proxy for Gemini; store API keys server‑side; add auth and rate limiting.
  2) Convert to a Vite build with `root: src`, bundle dependencies, drop import‑map CDNs, and inject `API_KEY` via server‑only endpoints (not client). Replace `process.env.API_KEY` reads with proxy usage.
  3) Add CSP + SRI and sanitize Markdown rendering; limit Mermaid/KaTeX attack surface.
  4) Add telemetry (error reporting + performance traces) and production logging.
  5) Stabilize streaming and state transitions; test save/load while a stream is active.

DOM/Handler Snapshot (from analyzer)
- ~160 selectors indexed; 98 handlers detected. Prioritize testing for: message stream updates, phase selection buttons, theme toggles, copy‑to‑clipboard, save/load controls.

Triggering Protocol Next
- Proceed to: MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL (to design the production web architecture and proxy), followed by COMPREHENSIVE IMPACT ANALYSIS PROTOCOL before edits.


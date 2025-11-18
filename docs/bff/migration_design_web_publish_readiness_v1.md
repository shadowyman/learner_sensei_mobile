# Web Publish Migration Design (v1 – Approaches + Trade‑offs)

Date: 2025-11-10
Owner: Sensei Engineering
Status: Draft – awaiting architectural approach approval (Protocol Step 4 gate)

## 1. Background and Current State (from Core Analysis)
- App type: Browser‑only SPA orchestrated by `src/index.tsx`; heavy client logic in `src/ui.ts`, curriculum/engine modules, and `geminiService.ts` for LLM calls.
- No backend. Folder `server/` only has `vite.config.ts`; no runtime API.
- LLM usage: Direct, client‑side via `@google/genai` (persistent chat + generateContent). A localhost dev API key is hardcoded for local use; prod path reads `process.env.API_KEY` (not injected in current build).
- Packaging: `index.html` uses CDN import maps and references `.ts` modules directly; not a production bundle. 
- DOM surface: Markdown/KaTeX/Mermaid rendering; many event handlers; blob/file downloads for save/load.
- Analyzer highlights: top fan‑in `src/logger.ts`, `src/model_usage.ts`, `src/adaptiveEngine.ts`, `src/curriculum.ts`; top fan‑out `src/index.tsx`, `src/moduleSelectionHandler.ts`, `src/ui.ts`.

Implication: Publishing “as is” would expose secrets, lack CSP/SRI, and have limited observability. A migration is required.

## 2. Goals and Non‑Goals
### Goals
- Protect LLM secrets; terminate all model requests server‑side.
- Deliver a reproducible production build (bundled assets, cache‑safe, hashed filenames) with Vite.
- Keep UX: streaming responses, module selection UI, save/load, Markdown and Mermaid rendering.
- Add essential security controls: CSP, SRI (if any external), sanitization for Markdown.
- Introduce minimal observability (errors, performance, usage metrics) and operational guardrails (rate limiting, quotas).

### Non‑Goals
- Full re‑platform to a different UI framework.
- Major pedagogy/feature redesign.
- Deep multi‑tenant identity/permissions (can be phased in later).

## 3. Constraints and Assumptions
- Hosting target: modern static + serverless/edge runtime (e.g., Vercel/Cloudflare/Netlify) or equivalent containerized infra. 
- No secrets in the browser bundle. 
- Backwards compatibility with current SPA structure is preferred to minimize refactors.
- Latency is important (streaming desirable), but correctness and safety take precedence.

## 4. Non‑Functional Requirements (NFRs)
- Security: no client‑side API keys; sanitize all untrusted HTML; explicit CSP; SRI where applicable.
- Performance: First interaction ≤ 3s on mid‑range laptop, streaming TTFB for LLM chunks ≤ 2s p95; avoid long tasks > 200ms during render bursts.
- Observability: error reporting, key request metrics, and rate‑limit counters.
- Reliability: graceful degradation when LLM unavailable; user feedback and retry policies.

## 5. Guiding Principles (Protocol Step 2)
- Principle of Least Privilege: secrets only server‑side; proxy whitelists required operations.
- Secure by Default: CSP/SRI/sanitization with safe defaults; zero trust for LLM text.
- KISS and Incremental Change: keep SPA and add a minimal proxy before any large rewrites.
- Separation of Concerns: UX rendering in client; model orchestration and billing control in proxy.
- Observability First: add logs/metrics with clear IDs for curriculum phases and streaming events.
- DRY/Single Source of Config: model configs centralized (server) with a small, typed client wrapper.

## 6. Patterns and Anti‑Patterns (Protocol Step 3)
Applicable patterns
- Facade (client SDK wrapper around proxy endpoints).
- Gateway/Proxy (serverless API mediates LLM access, auth, rate limiting, retries).
- Stream Adapter (server transforms upstream streaming to client‑friendly SSE/ReadableStream).

Anti‑patterns to avoid
- God Object: reduce `src/ui.ts` responsibilities over time (follow‑up refactor).
- Secret-in-Client: eliminate direct `GoogleGenAI` construction in browser builds.
- Spaghetti Streaming: centralize streaming handling and backpressure via a minimal client wrapper.

## 7. Architectural Approaches (Protocol Step 4 – STOP after trade‑offs)

### Approach A — SPA + Serverless/Edge Proxy (Recommended if approved)
Summary: Keep current SPA; add serverless endpoints for model actions; migrate to Vite build. Browser talks only to `/api/*`.
- Security: Excellent (no secrets client‑side). 
- Complexity: Low‑Medium (add proxy + rewire calls). 
- Migration cost: Low (minimal code movement, mostly integration and build).
- Performance: Good (edge proximity; streaming via SSE/streams).
- Observability: Good (centralized logs at proxy).

### Approach B — Full‑stack SSR App (e.g., Next.js/Remix)
Summary: Move SPA into SSR framework; use server routes for LLM. Potentially better SEO and asset pipeline.
- Security: Excellent.
- Complexity: High (project restructure, routing, module boundaries).
- Migration cost: High (rewrites, page/componentization).
- Performance: Very good; tuning needed for streaming and hydration.
- Observability: Very good via server framework integrations.

### Approach C — SPA + Ephemeral Client Tokens (Direct to Provider)
Summary: Key server issues short‑lived tokens to client which call provider directly.
- Security: Medium (reduced blast radius but still client calls to provider; token abuse risk).
- Complexity: Medium (token minting + validation). 
- Migration cost: Medium.
- Performance: Very good (fewer hops), but observability fragmented.
- Observability: Medium (provider logs + partial server visibility).

#### Trade‑off Matrix (High=3, Med=2, Low=1)
| Criterion                | A: SPA+Proxy | B: Full‑stack SSR | C: Ephemeral Tokens |
|-------------------------|--------------|-------------------|---------------------|
| Secrets Safety          | 3            | 3                 | 2                   |
| Dev/Migration Complexity| 2            | 1                 | 2                   |
| Time‑to‑Ship            | 3            | 1                 | 2                   |
| Perf/Latency (p95)      | 2‑3          | 2‑3               | 3                   |
| Maintainability         | 3            | 2‑3               | 2                   |
| Observability           | 3            | 3                 | 2                   |
| Compatibility (current) | 3            | 1‑2               | 2                   |

Result: Approach A leads overall for safety, speed to production, and minimal disruption. 

> Protocol Gate: Per the Architectural Synthesis Protocol, STOP here and request approval of the approach before drafting the blueprint.

## 9. Detailed Evaluation per Approach (NFR-centric)

Below expands the trade‑off matrix with concrete implications against the NFRs.

### A) SPA + Serverless/Edge Proxy
- Security
  - Secrets never ship to browser; proxy enforces allow‑listed operations and model choices.
  - Strong CSP feasible (connect-src limited to same-origin `/api/*`); SRI on any residual CDNs.
  - Sanitization pipeline can remain fully client‑side with a vetted sanitizer; proxy also applies input length guards and basic validation.
- Performance
  - Edge runtimes reduce LLM TTFB relative to central regions; streaming supported via SSE/ReadableStream.
  - Minimal added hop (client→edge→provider) usually outweighed by security and observability gains.
- Observability
  - Centralized request logs and metrics at the proxy; correlation IDs stitched client↔server.
- Maintainability
  - Lowest disruption to current SPA; limits refactors to an HTTP facade and build wiring.
- Risks
  - Requires careful streaming adaptation (provider→edge→client); ensure backpressure and abort semantics.
  - Rate‑limit and abuse‑prevention correctness becomes part of the proxy’s responsibility.

### B) Full‑stack SSR
- Security
  - Equivalent secret safety to A; stronger holistic controls (headers, middleware, auth) out‑of‑the‑box.
- Performance
  - Server rendering can improve initial paint, but app still streams model output; overall perf depends on hydration and page architecture changes.
- Observability
  - Deep integration with framework observability; simpler distributed tracing.
- Maintainability
  - Higher team learning curve and code movement; more moving parts.
- Risks
  - Scope creep due to natural temptation to re‑architect UI; longer timeline.

### C) SPA + Ephemeral Client Tokens
- Security
  - Better than shipping long‑lived keys; still exposes a call surface directly to provider and complicates abuse response.
- Performance
  - Best raw latency (fewer hops), but operational risk if token mint/validation is mis‑tuned.
- Observability
  - Fragmented between client and provider; fewer server‑side levers.
- Maintainability
  - Token lifecycle and revocation add complexity to a thin server; partial benefit vs proxy.
- Risks
  - Token replay/abuse windows; provider‑side throttles become your primary defense.

## 10. Security Controls Catalog (Pre‑Blueprint)

Controls we will apply regardless of approach (depth varies by choice):
- Secrets Handling
  - No API keys in client code or build artifacts; keys stored in serverless secrets manager or environment‑scoped vault.
  - Allowed models and feature flags enforced server‑side.
- Content Security Policy (CSP)
  - Baseline: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`.
  - Tighten `connect-src` to same‑origin; if any third‑party remains, add with SRI and explicit origins.
- Subresource Integrity (SRI)
  - If any external scripts/styles remain (ideally none), pin with SRI and version‑locked URLs.
- Markdown/Mermaid/KaTeX Sanitization
  - Run a robust sanitizer (e.g., DOMPurify) on all LLM‑originated HTML output before insertion.
  - Disable or strip unsafe protocols (`javascript:`, `data:` in links) and unsafe tags/attributes; sanitize Mermaid output if rendered from untrusted content.
  - Prefer server‑side URL validation for any external fetches initiated by content.
- Request Validation & Size Limits
  - Enforce maximum input size (characters/tokens), max concurrent streams, and timeouts.
- Rate Limiting & Abuse Mitigation
  - Per‑IP and per‑user token buckets; global concurrency caps; circuit‑breaker on elevated 5xx rates.
- Dependency Hygiene
  - Lockfile integrity checking; periodic vulnerability scans; minimal CDNs in production.

## 11. Observability Baseline (Pre‑Blueprint)
- Logging Schema (server edge)
  - Fields: `ts`, `req_id`, `user_id` (if any), `ip_hash`, `route`, `phase` (Socratic/Solidify/etc.), `model`, `latency_ms`, `status`, `err_code`, `rate_limited`.
  - Redactions: user text and model output omitted by default or truncated; toggleable diagnostic sampling in non‑prod.
- Metrics
  - Counters: requests_total, errors_total{code}, rate_limited_total, streams_started_total, streams_aborted_total.
  - Histograms: ttfb_ms, stream_duration_ms, upstream_latency_ms, response_size_bytes.
  - Gauges: active_streams, token_quota_remaining (if exposed).
- Tracing
  - Correlation ID propagated via `X-Request-ID`; client includes it on retries.

## 12. Performance Baseline for SPA
- Bundling
  - Vite build with code‑splitting; lazy‑load heavy modules (Mermaid, KaTeX) on demand; tree‑shake unused exports.
  - Target `es2020+`; compress with Brotli; long‑term hashed assets and immutable cache headers.
- Runtime
  - Streaming rendering with chunk coalescing; avoid layout thrash in `displayMessage`; consider scheduling long Markdown/KaTeX work via `requestIdleCallback` or Web Worker if needed.
- Metrics Targets
  - First Interaction ≤ 3s p95; TTFB for first chunk ≤ 2s p95; Long tasks > 200ms fewer than 5 per user session; Lighthouse ≥ 85 desktop.

## 13. Rollout & Environments (Outline – subject to approach selection)
- Environments: `dev` (open), `staging` (prod parity, locked), `prod` (guarded).
- Feature Flags: proxy enablement, streaming path, sanitization strict mode, telemetry sampling.
- Phases
  1) Build hardening: Vite build, remove client key usage, wire CSP in static hosting.
  2) Introduce proxy with read‑only endpoints and shadow logging.
  3) Cut traffic to proxy (10%→50%→100%); monitor error/latency; rollback plan prepared.
  4) Enforce strict CSP; remove legacy CDN paths; finalize observability dashboards.

## 14. Risk Register (Expanded)
- Key Exposure (Current) — Severity: Critical
  - Mitigation: eliminate client key; proxy only.
- XSS via Markdown/Mermaid — Severity: High
  - Mitigation: sanitize HTML; restrict Mermaid; strict CSP; test payloads.
- Streaming Instability — Severity: Medium
  - Mitigation: streaming adapter with abort signals; backpressure; client timeout UI.
- Rate‑limit Evasion/Abuse — Severity: Medium
  - Mitigation: token buckets per IP/user; CAPTCHA or email‑verified accounts for high usage; circuit breakers.
- Build Regressions — Severity: Medium
  - Mitigation: e2e smoke tests on staging; Lighthouse budgets; canary deploy.

## 15. Open Questions (Updated)
- Hosting preference (Vercel/Cloudflare/Netlify/AWS) and region strategy?
- Anonymous demo allowed, or require soft auth (email magic link/OAuth)?
- Log retention policy and PII rules (default: minimize, redact, short TTL)?
- Mobile support level and minimum device capabilities?

## 8. (Placeholder) Architectural Blueprint – To Be Completed After Approval (Protocol Step 5)
If Approach A is approved, this section will include:
1) Component deltas (new serverless routes, client LLM facade, Vite config and build pipeline).
2) Data flow diagrams (textual): user input → client → `/api/chat/*` → provider → stream adapter → client renderer; wrap‑up generation → `/api/wrapup/generate`.
3) API contracts (request/response bodies; streaming protocol; error model; rate‑limit headers).
4) Security controls: CSP policy, SRI usage, Markdown sanitization policy, secrets handling.
5) Observability: logs/metrics schema; correlation IDs; dashboards.
6) Migration plan with phases, rollback, and validation gates.

Appendix A: Open Questions
- Hosting provider preference? (Vercel/CF/Netlify/AWS)
- Auth needs now vs later? (anonymous demo vs sign‑in)
- Data retention policy for logs/analysis traces?

Appendix B: Acceptance Criteria (initial)
- No direct calls from client to provider; all traffic via `/api/*`.
- Production build emits hashed assets; Lighthouse perf ≥ 85 desktop, security checks pass.
- CSP enforced; sanitization blocks script injection; SRI on any external resource.
- Streaming responses flow end‑to‑end via proxy.

# System-Wide RCA and Delivery Toolkit

Purpose: Provide reusable tools and methods that accelerate root-cause analysis (RCA) and feature delivery across domains (UI, backend, data, performance, infra). This complements the analyzer by adding observability, reproducibility, and decision frameworks.

Contents
- Observability & Tracing
- Record/Replay & Time Travel
- Deterministic Reproducer Automation
- Contracts & Schemas
- Testing & CI Strategy Upgrades
- Performance & Concurrency
- Deployment Safety Nets
- Data Quality & Pipelines
- Static & Dynamic Analysis (beyond the analyzer)
- Developer Workflow Accelerators
- Decision Guide (When to use what)
- Top 5 to Implement Next

## Observability & Tracing
- Structured logging with correlation
  - Emit JSON logs with `requestId`, `userId`, `messageId`, `featureFlag`, `stage` (ingress→domain→egress).
  - Outcome: One grep by correlation ties multi-module flows together; hypothesis confirmation becomes trivial.
- Distributed tracing (OpenTelemetry)
  - Spans for UI→API→workers; child spans for DB/LLM calls. Export to Grafana/Jaeger/Datadog.
  - Outcome: Pinpoints slow/failing segments; perfect for perf and integration bugs.
- Live sampling & shadow logs
  - Deep logs for 1–5% of requests and sanitized payload capture on error.
  - Outcome: Rare issues still come with evidence.

## Record/Replay & Time Travel
- HTTP/LLM record–replay (Polly.js/Nock/VCR-style)
  - Capture externals and replay in tests/RCAs.
- UI time-travel snapshot
  - On “report bug,” persist DOM, app state, and last N actions into an artifact the team can load.

## Deterministic Reproducer Automation
- Harness generator (`mk:harness`)
  - CLI scaffolds a Node harness for any export, stubs externals, writes `input.json` and `output.*` artifacts.
  - Outcome: Deterministic suspects get proven (or falsified) in minutes, not hours.
- Delta-reducer (minimal failing example)
  - Iteratively shrinks failing inputs (markdown/json/api payloads) to the smallest reproducer.
- Property-based fuzz harness
  - For parsers/serializers/solvers: explore unusual inputs and assert invariants.

## Contracts & Schemas
- Consumer-driven contracts (Pact) or OpenAPI contract tests.
- Runtime schema validation at boundaries (Zod/AJV).
  - Outcome: Moves failure to the edge with precise errors; blocks entire classes of integration bugs.

## Testing & CI Strategy Upgrades
- Differential oracles
  - Run ours vs. a reference implementation; diff semantics (not bytes).
- Golden corpus & conformance tests
  - Curate “inputs→outputs” for tricky domains and regressions; gate merges on goldens.
- Snapshot/contract tests
  - Lock down structural shape (HTML/JSON/proto) instead of brittle whitespace or pixels.

## Performance & Concurrency
- Continuous profiling (clinic.js/0x)
  - CPU/heap/async hooks with flamegraphs in staging/CI.
- Load testing (k6/Locust)
  - Nightly scenarios with SLO budgets and alerting.
- Concurrency stressors/fault injection
  - Inject timeouts/partial responses/race amplification to expose heisenbugs.

## Deployment Safety Nets
- Feature flags & kill switches (LaunchDarkly/Unleash)
  - Decouple deploy from release; instant disable without rollback.
- Progressive delivery & canaries
  - 1%→10%→100% rollout with automatic rollback on SLO breaches.

## Data Quality & Pipelines
- Expectations checks (Great Expectations-like)
  - Assert ranges/uniqueness/completeness on inbound/outbound data.
- Drift monitors
  - Watch feature/output distributions; flag input drift versus code faults.

## Static & Dynamic Analysis (Beyond the Analyzer)
- Semgrep/CodeQL/SAST rules tuned to repo patterns (e.g., block raw HTML sinks).
- Dependency health & supply chain (Dependabot/Snyk, SBOM, lockfile diffs).

## Developer Workflow Accelerators
- mk:harness generator (generic)
  - Converts deterministic suspects into a policy-driven repro step.
- Incident snapshot pack
  - One command to zip logs, inputs, traces, env versions for RCA handoff.
- Runbooks + ADRs templates
  - Standardize incident steps and design decisions.

## Decision Guide (When to use what)
- Pure/deterministic suspect → mk:harness → delta-reducer → property tests → goldens → differential oracle.
- Integration/timing suspect → Playwright/JS-DOM parity + record/replay + OTel tracing.
- Data shape/contract suspect → runtime schema validation + CDC + conformance tests.
- Perf/leak suspect → continuous profiling + load tests + event-loop/heap monitors.
- Risky rollout → feature flags + canary + SLO guardrails.

## Top 5 to Implement Next
1) Generic `mk:harness` CLI and docs.
2) OpenTelemetry traces + correlation IDs end-to-end.
3) Pact/OpenAPI-based consumer-driven contracts where applicable.
4) Playwright parity tests for at least one core UX flow.
5) Continuous profiling in staging and a k6 smoke scenario with budgets.

## Acceptance Signals
- RCA velocity: time-to-first-repro trends down; incidents include harness artifacts.
- Flake reduction: integration tests with record/replay become stable.
- Perf and SLO regressions are caught pre-release by budgeted alerts.


# Pedagogical Directive Generation ExecPlan Peer Audit Report

Audit target: `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md`

Protocol: Codex Thread Peer Execution Protocol with Harry Potter as Agent A and Hermione Granger as Agent B.

Status: converged Harry Potter / Hermione Granger report. Hermione Granger's peer thread was created as `019eb620-6705-7030-9cc8-98f4cce25e65`. Harry Potter triad-checked Hermione's completed response, accepted Hermione's `Mobile Routing Gate` and `Idempotence and Recovery` findings, and accepted Hermione's correction to reject the weaker prior-context/self-containment candidate because the audited plan's references to checked-in prior plans are allowed by `PLAN.md` and the PR-thread references were not proven to be required execution inputs.

## Scope And Evidence Standard

This was a read-only audit of the ExecPlan as an execution artifact. The standard used was material execution risk: an issue must have an evidence anchor in the audited plan or `docs/protocols/PLAN.md`, and must explain how it can affect a future implementer executing the plan.

## Findings

### P1: Required Mobile Routing Gate Is Not Explicitly Represented As A Gate

Evidence:

- `docs/protocols/PLAN.md:45` requires any ExecPlan that migrates or introduces an LLM tool to include an explicit "Mobile Routing Gate" milestone in both `Progress` and `Plan of Work`, covering mobile WebView wiring to BFF, `window.__SENSEI_MOBILE_BUILD__` gating of desktop-only local SDK paths, and a sentinel test that fails if mobile uses a browser `CoreLlmClient`.
- The audited ExecPlan is an LLM migration plan: `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:13-21`.
- The audited ExecPlan has mobile routing content spread across `Mobile No-Browser-Key Full-Turn Plan`, `Runtime Routing Plan`, milestones, and tests, but its headings do not include a `Mobile Routing Gate`; the work plan section is named `Implementation Plan`, and the `Progress` checklist does not contain an explicit Mobile Routing Gate item. See headings at `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:341`, `635`, `738-759`, `820`, and `1172-1228`.
- The audited plan does include a test named `__tests__/pedagogicalDirective.mobileRoutingGate.red.test.ts` at `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:873-878` and final validation references at `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:1238-1239`, but this does not make the required gate explicit in `Progress` and the work plan.

Execution impact:

The plan contains many mobile-routing requirements, so this is not a missing-design issue. The material problem is gate discoverability and closure semantics. A future executor can complete scattered tests and milestones without ever recording the required PLAN.md gate as a named stop/go checkpoint. That weakens the fail-closed requirement around the exact risk PLAN.md singles out: accidentally letting mobile use desktop/browser LLM paths during an LLM migration.

Recommended correction:

Add an explicit `Mobile Routing Gate` progress item and a matching milestone or subsection in the work plan. It should cite the existing relevant requirements rather than duplicate the whole plan, and it must explicitly cover BFF-backed mobile WebView routing, `window.__SENSEI_MOBILE_BUILD__` gating of desktop-only local SDK paths, and the sentinel test that fails if mobile uses browser `CoreLlmClient`.

### P2: Recovery Guidance Is Distributed But There Is No Dedicated Idempotence And Recovery Section

Evidence:

- `docs/protocols/PLAN.md:69` requires ExecPlans to state safe repeatability and how to retry or adapt after partial failure.
- The PLAN.md skeleton also includes `## Idempotence and Recovery` as the expected location for this material at `docs/protocols/PLAN.md:153`.
- The audited ExecPlan has many local safety rules, such as duplicate directive request handling at `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:288-290`, stop conditions at `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:851`, `988`, `1016`, `1093`, `1142`, `1170`, and `1228`, plus review remediation rules at `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:1381-1411`.
- The audited ExecPlan headings do not include `Idempotence and Recovery`, `Recovery`, or an equivalent dedicated section. Its top-level headings run through `Validation Commands`, `Review Remediation Rules`, `Outcomes & Retrospective`, and `Final Migration Evidence` without a consolidated recovery section.

Execution impact:

The missing section makes recovery dependent on reading and synthesizing scattered local rules across a long plan. This is material because the plan explicitly spans Core, BFF, RN, WebView, generated bundle output, provider route work, tests, and documentation updates. A future implementer who hits a half-completed BFF route, stale directive reference store, generated-bundle mismatch, failed red test, or interrupted mobile bridge change has no single recovery checklist explaining what can be rerun safely, what state must be cleaned, and what must not be retried without updating the plan.

Recommended correction:

Add a concise `Idempotence and Recovery` section. It should cover safe reruns for tests/builds/bundle/analyzer, retry behavior for red-test and implementation milestones, how to handle partially created directive records or session-store changes in tests, what to do after a failed `npm run webview:bundle`, how to recover from BFF route or bridge half-wiring, and when the ExecPlan must be updated before retrying.

## Non-Findings

- The plan is not missing validation coverage in general. It contains detailed validation commands and layer-specific tests at `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:1230-1379`.
- The plan is not missing directive provenance, raw mobile directive rejection, provider-envelope parity, rate-limit parity, or no-browser-key concerns. Those are covered with concrete plans and tests at `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:223-365`, `325-339`, `438-470`, and `647-665`.
- The plan is not implementation-ready in the sense of completed evidence, but it accurately labels itself `NOT_STARTED` at `docs/execplans/pedagogical_directive_generation_core_bff_migration_execplan.md:23-27`; incomplete evidence tables are expected before execution.
- Harry's initial self-containment concern about prior migration and PR-thread references is not included as a material finding. Hermione correctly challenged it: `PLAN.md` allows checked-in prior plans by reference, and this audit did not prove that the PR-thread references are unavailable execution dependencies rather than authoring evidence and summarized historical failure classes.

## Peer Protocol State

Harry Potter created Hermione Granger's peer thread and supplied the collaborative frame, evidence standard, scope, and ownership split. Hermione accepted the read-only audit posture, loaded the peer protocol and local skill, inspected the audited ExecPlan against PLAN.md, and returned two material findings plus one rejection of Harry's weaker candidate issue.

Current closure state: complete peer convergence on two material findings:

1. The required explicit `Mobile Routing Gate` milestone is missing from `Progress` and the work plan.
2. The operational `Idempotence and Recovery` section is missing.

Changed file: this report only. No source files, tests, staged changes, commits, or new ExecPlans were created.

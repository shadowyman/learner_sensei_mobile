# Codex Thread Peer Event Skill Architecture

This document proposes a future decomposition of the Codex Thread Peer Execution Protocol into event-triggered skills. It is an engineering design note, not runtime authority.

Runtime authority remains `docs/protocols/codex_thread_peer_execution_protocol.md`. The supporting workflow remains `tmp/thread_peer_execplan_workflow.md` for deeper gate interpretation. If this document conflicts with the runtime protocol, the runtime protocol wins.

## Problem

The runtime protocol is now compact enough for ordinary use, but some context pressure remains. Agents may still over-summarize, skip peer-turn inspection, omit diff review, or treat packet fields as checklist theater when the full protocol is not active in context.

The next evolution is to move operational rule bodies into event-triggered skills and keep the main protocol as a small router:

- the main protocol says which skill to load and when;
- each skill contains the verbatim rules for one runtime event or gate;
- peer handoff prompts name the relevant event skill;
- convergence treats missing required event-skill evidence as protocol drift.

This improves token economics without weakening the protocol, provided the split follows runtime events rather than arbitrary sections.

## Constraint

Skills are instruction wrappers, not a hard enforcement engine. They improve adherence only when the agent recognizes the trigger, loads the skill, and follows the output contract. True mechanical enforcement would require product support such as structured peer state, lifecycle triggers, or validators.

Therefore the skill architecture must be explicit enough that an agent can reliably decide:

- what event is happening;
- which skill applies;
- what evidence must be inspected;
- what output must be produced;
- what counts as drift.

## Design Alternatives

### Lifecycle Skills

Example split: startup, handshake, normal cycle, correction, final.

Pros:

- easy to understand;
- fewer skills;
- low trigger confusion.

Cons:

- code gates, triad, and artifact-correction rules can become buried;
- agents may load a broad cycle skill and skip specialized gates.

Verdict: too coarse as the full design.

### Gate Skills

Example split: triad, no-use, diff review, Architectural Distance Pass, correction path, closure, drift.

Pros:

- precise enforcement;
- hard gates are isolated and easier to audit.

Cons:

- too many skills may need to load in one turn;
- agents may miss a required gate because there is no lifecycle wrapper.

Verdict: strong but risky under context pressure.

### Artifact-Type Skills

Example split: ExecPlan, code implementation, document coauthoring, audit/review, brainstorming.

Pros:

- intuitive to users;
- each skill can be domain-shaped.

Cons:

- recreates mode taxonomy bloat;
- many tasks cross artifact types;
- review/audit work may still need code gates.

Verdict: not ideal as the main structure.

### Event Plus Gate Hybrid

Use runtime event skills for when things happen, with specialized gate skills for code, correction, drift, and convergence.

Pros:

- matches actual peer runtime;
- limits active skill load;
- keeps hard gates explicit;
- supports token economy through triggered loading.

Cons:

- requires a small router document;
- skills must cross-reference each other carefully.

Verdict: recommended.

## Recommended Router Model

The main protocol can eventually become a thin runtime router containing:

1. Authority and canonical peer names.
2. No-use and collapse criteria.
3. Always-active invariants.
4. Runtime event map.
5. Conflict rule: runtime router wins over skills.
6. Drift rule: missing required event-skill evidence is protocol drift.

Example router map:

| Runtime event | Skill |
|---|---|
| Starting peer work | `thread-peer-startup` |
| First Harry/Hermione exchange | `thread-peer-initialization-handshake` |
| Peer response received | `thread-peer-triad` |
| Normal handoff or closure claim | `thread-peer-handoff` |
| Equality or role drift risk | `thread-peer-equality` |
| Code-related claim | `thread-peer-code-gates` |
| Code correction required | `thread-peer-correction-path` |
| Non-code artifact correction required | `thread-peer-artifact-correction` |
| New user instruction | `thread-peer-user-interruption` |
| Protocol drift detected | `thread-peer-drift-recovery` |
| Final handoff or convergence | `thread-peer-final-convergence` |
| Context pressure or token reduction | `thread-peer-token-economy` |

## Skill File Format

Each event skill should use this format:

```md
# Skill Name

Use when:
- exact runtime trigger;
- examples;
- negative trigger if not applicable.

Authority:
- runtime router path;
- supporting workflow path only if needed;
- task ExecPlan / PLAN.md only when ExecPlan-governed work exists.

Required inputs:
- message/thread/artifact/diff/state to inspect.

Rules:
- verbatim protocol rules for this event.

Output contract:
- required fields the agent must produce.

Failure/drift:
- what counts as failed application;
- what skill to trigger next if failure occurs.
```

## Proposed Skills

### `thread-peer-startup`

Trigger when:

- the user asks for Harry/Hermione peer work;
- a peer run is about to start;
- no Agent B thread id exists;
- the task frame has not been agreed.

Contains:

- no-use check;
- Hermione creation/request rule;
- canonical names;
- collaboration shape and inspection tactic;
- first shared task frame;
- initialization packet requirements.

Output contract:

- collapse reason; or
- initialized peer run with task frame, ownership split, artifacts, risks, and first handoff.

### `thread-peer-initialization-handshake`

Trigger when:

- Harry is sending the first message to Hermione;
- Hermione receives the first peer packet;
- a task frame is not yet authoritative.

Contains:

- Agent-A-to-Agent-B initialization packet;
- Agent-B response contract;
- first-turn frame-agreement rule;
- no final findings or final text before frame agreement unless explicit Independent-first.

Output contract:

- triad evidence;
- critique;
- concrete contribution;
- no-use or peer-justification decision;
- accepted or revised frame;
- first milestone and ownership split.

### `thread-peer-triad`

Trigger when:

- a peer response arrives;
- an agent is about to accept a peer claim, convergence update, artifact change, or correction;
- a delegated message is being relied on;
- `read_thread` shows active/in-progress.

Contains:

- received message / completed visible turn / durable artifact rule;
- one 10-second recheck;
- no continuous polling;
- inspection mismatch behavior;
- durable-artifact fallback.

Output contract:

- triad complete;
- triad mismatch;
- durable-artifact-only acceptance;
- corrected handoff required.

### `thread-peer-handoff`

Trigger when:

- a peer sends or receives a recurring handoff;
- a peer is about to request critique/contribution;
- a current-step closure claim is being made.

Contains:

- recurring handoff packet;
- compact non-code handoff;
- current-step closure before next focus;
- name-plus-role ownership;
- critique plus concrete contribution;
- candidate next focus is not an assignment.

Output contract:

- handoff packet; or
- closure accepted/rejected with contribution and unresolved state.

### `thread-peer-equality`

Trigger when:

- one peer repeatedly frames while the other edits;
- one peer only reviews or summarizes;
- one peer proposes next work without contributing;
- peer work starts looking like boss/worker, reviewer/subordinate, or agenda-setter/artifact-worker.

Contains:

- role symmetry;
- initiative reciprocity;
- substantive turn definition;
- brief-turn exception;
- peer contribution requirement;
- atomic-work/no-use/access exceptions.

Output contract:

- symmetry preserved;
- exception recorded;
- drift correction requested.

### `thread-peer-code-gates`

Trigger when:

- any code-related claim appears;
- code edits are planned;
- code diff is ready;
- code closure is requested;
- validation of code behavior is claimed.

Contains:

- pre-edit structural classification;
- peer diff review;
- narrow diff-review waiver;
- Architectural Distance Pass;
- validation freshness;
- dirty-state boundary.

Output contract:

- classification;
- peer diff review evidence;
- Architectural Distance Pass evidence;
- closure impact.

### `thread-peer-correction-path`

Trigger when:

- critique blocks closure and requires code correction;
- a peer proposes a corrective code edit;
- a peer wants to patch the other peer's code slice.

Contains:

- correction-path agreement;
- failed claim/evidence;
- corrective edit owner;
- correction reviewer;
- invalidated validation/diff/Architectural Distance Pass claims;
- narrow mechanical exception.

Output contract:

- agreed correction path; or
- explicit mechanical exception; or
- unresolved disagreement.

### `thread-peer-artifact-correction`

Trigger when:

- a peer requests correction to an ExecPlan, protocol, prompt, skill spec, design doc, audit report, or final answer;
- a peer finds a bounded non-code issue;
- a peer is about to apply another peer's artifact suggestion.

Contains:

- accept/revise/reject rationale;
- issue-identifying peer should usually patch bounded safe non-code corrections;
- conditions where original editor should patch instead;
- artifact-correction drift rule.

Output contract:

- correction patched by identifying peer and sent for review; or
- correction request accepted/revised/rejected with rationale.

### `thread-peer-user-interruption`

Trigger when:

- the user sends a new instruction during peer work;
- the user asks for status;
- the user changes scope, process, validation, stop condition, priority, artifact path, or no-edit boundary;
- peer packets may now be stale.

Contains:

- newest-user-instruction priority;
- stale packet detection;
- interruption packet;
- impact on scope, ownership, validation/review, synchronization, and durable artifacts.

Output contract:

- stale state marked;
- revised handoff sent or requested;
- durable impact record.

### `thread-peer-drift-recovery`

Trigger when:

- triad is missing;
- message-only trust occurs;
- continuous polling occurs;
- next focus advances before closure;
- diff review or Architectural Distance Pass is skipped;
- boss/worker behavior appears;
- artifact correction occurs without rationale;
- Collaborative work becomes parallel merge;
- the same gate fails repeatedly.

Contains:

- drift list;
- freeze affected convergence;
- one correction turn;
- collapse/escalate after repeated drift.

Output contract:

- drift named;
- affected surface frozen;
- correction request;
- collapse/escalation decision if repeated.

### `thread-peer-final-convergence`

Trigger when:

- a peer run is about to end;
- a final report, answer, or handoff is being prepared;
- staging, commit, or handoff readiness is being claimed;
- a milestone is being declared complete.

Contains:

- five closure claims;
- final handoff packet;
- collaboration-shape claim;
- protocol acceptance evidence;
- validation/review completed, substituted, or skipped;
- dirty-state boundary;
- residual risks and unresolved disagreements.

Output contract:

- convergence accepted; or
- smallest failed claim for one correction cycle.

### `thread-peer-token-economy`

Trigger when:

- context pressure appears;
- handoffs are becoming verbose;
- a peer asks to reduce tokens;
- the task is non-code, read-only, design, advisory, or document-only and full handoff is too heavy.

Contains:

- run-card-first reads;
- claim-scoped triad;
- evidence pointers over excerpts;
- compact non-code handoff;
- triggered deep reads;
- no-use/collapse economics.

Output contract:

- compact handoff mode;
- claim-scoped read plan;
- no-use/collapse recommendation if peer value is low.

## Recommended Implementation Sequence

Start with these nine skills:

1. `thread-peer-startup`
2. `thread-peer-triad`
3. `thread-peer-handoff`
4. `thread-peer-code-gates`
5. `thread-peer-correction-path`
6. `thread-peer-artifact-correction`
7. `thread-peer-user-interruption`
8. `thread-peer-drift-recovery`
9. `thread-peer-final-convergence`

Add these if field use shows the need:

10. `thread-peer-initialization-handshake`
11. `thread-peer-equality`
12. `thread-peer-token-economy`

This keeps the first implementation smaller while preserving the gates most likely to fail under context pressure.

## Runtime Loading Pattern

Typical peer run:

1. Startup: `thread-peer-startup`, optionally `thread-peer-initialization-handshake`.
2. Peer response arrives: `thread-peer-triad`.
3. Normal work loop: `thread-peer-handoff`.
4. Code work: `thread-peer-handoff` plus `thread-peer-code-gates`.
5. Code correction: `thread-peer-correction-path`.
6. Non-code correction: `thread-peer-artifact-correction`.
7. User interrupts: `thread-peer-user-interruption`, then `thread-peer-triad` if older peer state is being considered.
8. Drift: `thread-peer-drift-recovery`.
9. Finish: `thread-peer-final-convergence`.

Agents should rarely need more than two or three skills active at once.

## Recommendation

Use the event plus gate hybrid. Do not split into one skill per small rule, and do not split by broad artifact type such as review/design/code/document. Runtime events are the right trigger surface because they match when agents actually need the rule.

The final target should be:

- a small runtime router protocol;
- event skills containing detailed rule bodies;
- prompt packets that name the relevant event skill;
- final convergence that treats missing event-skill evidence as protocol drift.

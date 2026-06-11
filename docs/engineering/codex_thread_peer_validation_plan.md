# Codex Thread Peer Validation Plan

This document records validation and dry-run methods for testing or evolving the Codex Thread Peer Execution Protocol. It is not required during ordinary peer execution. Use it only when validating, auditing, or changing the protocol. The runtime protocol at `docs/protocols/codex_thread_peer_execution_protocol.md` remains the authority.

## Field-Test Plan

Validation requires a field test or documented dry run using exact prompts against a concrete small scenario. The evidence must include:

- exact prompt used;
- artifact or transcript produced;
- which rule prevented each observed failure mode;
- whether the second agent changed an implementation decision, validation target, plan correction, or risk outcome;
- whether overhead stayed bounded.

A continued two-agent dry run passes only if the evidence shows at least three peer-caused improvements over a plausible single-agent run. A collapse dry run passes when the evidence shows that no-use criteria were evaluated before unnecessary artifact creation, both peers had enough context to challenge the collapse, and the final handoff records why one agent is sufficient.

Concrete dry-run scenario for this first guide:

Scenario: two agents are asked to create a small documentation-only note, such as `docs/engineering/example_peer_run_note.md`, explaining when not to use the peer workflow. The change is intentionally low-risk but not purely mechanical because it tests no-use criteria, task framing, shared artifact creation, and final handoff. The correct dry-run outcome may be a recorded collapse to one agent before creating an ExecPlan if the peers decide the task is too small for the full workflow.

Dry-run steps:

1. Paste the User-to-Agent-A Kickoff prompt with the scenario goal and an Agent B thread id.
2. Agent A sends the Agent-A-to-Agent-B Initialization Packet and waits for the peer reply.
3. The peers decide whether a two-agent workflow is justified. Because the task is small, the expected correct outcome is either collapse to one agent with recorded rationale or a very short peer run that proves no-use criteria are working.
4. If they continue, each peer must contribute one concrete improvement to the note or its acceptance criteria.
5. Use the Convergence and Final Handoff Packet to record changed files, validation, residual risks, and protocol acceptance evidence.

Dry-run evidence record:

```text
Dry-run evidence record

Scenario:
<one sentence goal and whether this is expected to continue or collapse>

Prompt evidence:
- Kickoff prompt used: <thread turn id, artifact path, or pasted excerpt location>
- Initialization packet used: <thread turn id, artifact path, or pasted excerpt location>
- Final handoff packet used, if any: <thread turn id, artifact path, or not applicable because collapse occurred>

Decision point:
- No-use criteria outcome: <continue / collapse>
- Rationale: <smallest concrete reason>
- Authoritative artifact created: <yes/no and path>

Triad evidence:
- Received peer message inspected: <yes/no and pointer>
- Completed peer turn inspected: <yes/no and pointer>
- Durable artifact inspected: <yes/no and pointer>

Peer contribution evidence:
- Agent A critique plus contribution: <one line with pointer>
- Agent B critique plus contribution: <one line with pointer>
- If one side did not contribute, correction or collapse rationale: <one line>

Failure probes:
- Unilateral task framing prevented by: <evidence or not tested>
- Message-only trust prevented by: <evidence or not tested>
- Agenda-setter/artifact-worker asymmetry prevented by: <evidence or not tested>
- Artificial split work prevented by: <evidence or not tested>
- Unowned shared duties prevented by: <evidence or not tested>

Validation result:
- Pass/fail: <pass / fail / partial>
- Why: <one sentence>
- Follow-up required before using the workflow broadly: <none or specific change>
```

The record should stay compact. A probe is satisfied only by a pointer to a thread turn, durable artifact entry, command result, or explicit collapse rationale created during the dry run. Retrospective claims without a pointer do not count. If the correct result is collapse before creating an ExecPlan, the dry run can still pass when the record shows no-use evaluation, triad inspection, and final handoff or collapse rationale.

Passing evidence:

- the exact kickoff and handoff prompts are preserved in the transcript or artifact notes;
- the no-use criteria are explicitly evaluated instead of ignored;
- if the pair continues, at least one peer critique changes the task frame, acceptance criteria, or final wording;
- the final handoff names changed files and validation;
- if the pair collapses to one agent, the reason is recorded and treated as a successful protocol outcome rather than a failure.

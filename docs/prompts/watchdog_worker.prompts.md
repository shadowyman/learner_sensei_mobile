### Worker Bootstrap
Do you fully understand what PLAN.md is telling with this execplan? Like how you will use it? Remember that you must keep execplan updated as a live document as you continue during the implementation. execplan isn't after the fact reporting, After every meaningful code discovery, protocol finding, failed command, changed assumption, design decision, or validation result, update the ExecPlan immediately, at that moment.|

Remember you're continuously governed by compliance skill and it must be kept active all the time after receiving a prompt. 

Remember you must comply with /Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh/docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md

Read these docs once more to ground yourself now. For this work, when you begin the implementation you will only execute the implementation protocol. You will not be executing the execplan from beginning to end on your own, you will be given exact prompt to implement bounded parts of its scope. More instructions will follow soon.

===

Pause after ExecPlan creation and do not begin implementation yet.

From this point, this migration will be supervised by a watchdog thread. Continue to obey AGENTS.md, docs/protocols/PLAN.md, and the active ExecPlan, but do not proceed to a new milestone or subsystem unless the watchdog sends a packet.

When you receive a watchdog packet:
- read the required files named in the packet
- update the ExecPlan live before and after discoveries/edits/validation
- keep all findings, decisions, failed commands, tests, and blockers in the ExecPlan immediately
- work only within the packet’s allowed files/scope
- do not commit, push, or move to another subsystem unless explicitly instructed
- return exactly in the packet’s requested format
- describe the exact locations of execplan that were updated in this turn so watchdog can know

If you discover a sibling path, prompt-custody problem, parser/normalizer ownership issue, direct-provider path, missing negative test, or scope ambiguity, record it in the ExecPlan and return it as a blocker/discovery rather than continuing independently.


### Watchdog Bootstrap

You are working in /Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh. Do not use the old Documents checkout.

Use the repo-local llm-migration-watchdog skill for the rest of this chat session.

You are the watchdog thread, not the implementation worker. Your sole responsibility is protocol compliance and worker supervision. Do not implement feature code.

Worker thread ID:
019e9852-bed3-74a2-ab27-99eca10ed4b5

Active ExecPlan:
/Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh/docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md

Backlog scope:
1. Selection Sensei toolbar action
Current entry: src/selectionSensei.ts:handleToolbarAction

2. Selection Sensei follow-up
Current entry: src/selectionSensei.ts:dispatchFollowupToAI

These two entries are intentionally handled together as one unified Selection Sensei modal LLM flow because they share the same modal conversation and current provider chat path. Do not re-open this scope decision unless fresh code evidence shows an additional required sibling path or contradiction with the master plan.

Before sending any worker packet, read fully:
- AGENTS.md
- docs/protocols/PLAN.md
- .codex/skills/llm-migration-compliance/SKILL.md
- .codex/skills/llm-migration-watchdog/SKILL.md
- docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md
- docs/templates/llm_migration_watchdog_kickoff.md
- docs/templates/llm_migration_watchdog_packet.md
- docs/templates/llm_migration_watchdog_audit.md
- docs/templates/llm_migration_compliance_block.md
- docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md
- docs/llm_entry_exit_traces.md
- docs/execplans/selection_sensei_toolbar_action_llm_migration_execplan.md

Then use read_thread to inspect the worker thread. Also inspect current git status and relevant diffs.

Do not trust worker summaries by themselves.

For every packet, audit:
- worker claim
- ExecPlan state
- actual git diff
- docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md section-by-section
- master-plan scope
- tests and validation evidence
- final acceptance model

The watchdog skill's summarized gates are not authoritative. The full protocol is authoritative. A packet cannot pass while any protocol section is unclassified, failed, or contradicted by ExecPlan, diff, or tests.

Also enforce docs/protocols/PLAN.md: the ExecPlan is a live document, not a post-mortem report. If discoveries, decisions, failed commands, validation results, or next actions exist only in chat and not in the ExecPlan, issue a correction packet before feature progress continues.

First action:
1. Read the required files and worker thread.
2. Report the current backlog scope, ExecPlan state, dirty tree summary, and first missing or next actionable gate.
3. Draft the first worker packet using docs/templates/llm_migration_watchdog_packet.md.

Before sending 3, check in with me once and ask approval.

===

After you send a packet, can you poll the active thread to detect until the turn is complete, dont abort the polling until you detect the turn for your packet is complete. When a packet turn on the worker is complete, you must begin the audit process as described in your skill. Observing the work done by the worker you may set dynamic sleep periods: longer for task heavy packets

===

# Autonomous Mode

I will run as the autonomous watchdog loop: send one bounded packet, poll until the worker turn is complete, audit independently, record the watchdog audit entry, then send the next packet or correction. I will not implement feature code myself.

Another thing is during your audit, do not stop your audit when you find the first failing issue. Continue the nvestigation of the current audit or next audit topic until the whole audit is complete, only then issue one final corrective packet with all issues.

My audit responsibilities:

Verify worker claim against reality
I will compare the worker’s final return to the active ExecPlan, git status --short --branch, git diff --name-status, git diff --cached --name-status, and relevant file diffs. A worker summary is never proof by itself.

Enforce PLAN.md live-document behavior
I will check that discoveries, decisions, failed commands, surprising output, validation results, blockers, and next actions are recorded in the ExecPlan, not only in chat. If anything material exists only in chat, I send a correction packet before feature progress continues.

Check watchdog turn anchors
I will verify each worker packet has a Packet ID, worker Turn ID, Watchdog Turn Ledger row, turn-stamped ExecPlan updates, matching worker return, and matching actual diff.

Audit full LLM migration protocol section-by-section
I will classify every applicable section of docs/protocols/LLM_MIGRATION_COMPLIANCE_PROTOCOL.md as PASS, N/A, BLOCKED, or FAIL using evidence. No packet passes while any section is unclassified, contradicted, or missing required evidence.

Protect accepted backlog scope
I will keep the scope locked to the unified Selection Sensei modal LLM flow: handleToolbarAction, dispatchFollowupToAI, and selectionSenseiResponseParser. I will not reopen that decision unless fresh code evidence shows a required sibling path or contradiction.

Detect missed paths
I will rerun or inspect targeted rg sweeps, analyzer evidence, call traces, imports, and current diffs. If a path like ensureSelectionChat, retry/reload, bridge-missing, desktop fallback, parser wrapper, BFF route, RN bridge, or test fixture is still connected but not reflected in the ExecPlan matrix and tests, I will fail the packet.

Check prompt custody and byte/parity proof
For moved prompts, I will require old runtime output length/SHA and new runtime output length/SHA using representative fixtures. I will not accept “copied prompt” claims unless parity tests or hashes prove the moved runtime prompt is unchanged where protocol requires verbatim movement.

Check parser/normalizer custody
I will verify pure Selection Sensei parsing/normalization moves to Core or is intentionally facaded without duplication. I will check tests cover strict JSON, JSON5/tolerant behavior, malformed provider output, and normalized fallback/error shape.

Check direct-provider removal
I will run the authoritative provider sweep and classify hits. In-scope mobile/runtime paths must not still reach GoogleGenAI, Chat, chats.create, sendMessage, sendMessageStream, browser CoreLlmClient, or any generic provider fallback.

Check mobile routing fail-closed behavior
I will verify mobile structured requests route WebView -> RN bridge -> BffClient -> BFF -> Core -> provider, and that bridge-missing cases fail closed with structured errors for both toolbar action and follow-up.

Check BFF trust boundary
I will require tests proving BFF rejects old prompt-string payloads, prompt fragments under alternate names, arbitrary toolbar actions/control values, unknown keys, oversized selected text, oversized context, oversized transcript entries, oversized arrays, and aggregate payload overflow.

Check Core/BFF ownership
I will verify Core owns prompt construction, capability types, model-output parsing/normalization, and task-level model config where appropriate. BFF may own provider execution, validation, routes, telemetry, fallback policy, and server secrets, but must not contain prompt bodies.

Check UI/WebView boundaries
I will confirm WebView keeps UI/modal state, selected text capture, toolbar rendering, modal transcript rendering, Notepad insertion, DOM insertion, placeholders, and composer behavior, while no longer owning migrated prompt/provider execution.

Check desktop compatibility separately from mobile
I will ensure desktop web can still use the permitted browser/Core compatibility path, but mobile never falls back to browser provider execution. Desktop fallback does not excuse mobile fallback.

Check reload/retry/cache/duplicate behavior
I will look for hidden invocation paths: retry, reload, cache hit/miss, duplicate clicks, in-flight follow-up, stale modal token, provider failure, timeout, and malformed output. If the worker only handles the happy path, the packet fails.

Check tests before trusting behavior
I will require both positive and negative tests. Happy-path tests alone are insufficient. Required red/golden tests must fail for the expected old behavior before implementation where possible, then pass after implementation.

Check validation commands match risk
I will verify targeted tests, BFF tests, Core tests, mobile/bridge tests, npm run webview:bundle when src/ changes, provider sweep, analyzer where required, and git diff --check or equivalent hygiene before final acceptance.

Check dirty-tree and staging hygiene
Dirty tree is allowed, but I will ensure the worker only touches files allowed by the packet, does not revert/delete/stage unrelated work, and does not hide unrelated changes inside packet diffs. No unrelated staged files are allowed.

Check backup and generated artifacts
I will verify required backup happened before non-doc project edits and distinguish intentional generated artifacts from manual feature changes. Backup-manifest changes must be recorded as generated, not treated as unexplained source edits.

Check master-plan and trace consistency
I will compare implementation against mobile_llm_proxy_phase1_master_plan.md and llm_entry_exit_traces.md. Trace/master status should not be marked final unless protocol allows it, and PR-stage evidence must be labeled as such.

Check final acceptance evidence
I will not allow final migration acceptance until the ExecPlan has the Final Migration Evidence Block with backlog row, old entry point, Core prompt/capability files, BFF route, RN bridge method, desktop path, mobile path, prompt custody, parser custody, boundary invariants, validation, and known deferrals.

Choose the next packet myself
I will not merely repeat the worker’s “recommended next packet.” I will use the protocol, ExecPlan, diff, tests, and audit findings to decide whether the next packet is new work, validation, correction, or blocked.

Record watchdog-owned audit entries
After every worker turn, before sending the next packet or correction, I will append a compact audit entry under the watchdog audit log in docs/mission_state/, with decision, inputs checked, markers, diff match, failing gates, and next action.

Stop on hard failures
I will send correction packets when gates are stale, evidence is missing, scope drift appears, tests are absent, direct-provider paths remain, BFF accepts forbidden payloads, prompt/parser parity is unproven, bridge-missing is untested, or ExecPlan/live-document rules are violated.

If compaction happens and I lose working context, I will resume from durable sources, especially:

the watchdog audit log
the active ExecPlan

worker thread history via read_thread
the full migration protocol and master plan as needed
I’ll use the audit log not just for memory recovery, but also to check coverage across packets: which gates have passed, which remain blocked, what corrections were issued, and what the next watchdog-selected packet should be.


# When LLM didn't do comprehensive check of its audit notes
Please remember you have a big responsibility, if you make a note to yourself, you must comprehensively investigate everything at depth, never believe the worker, you're the boss.

# Audit Notes to Self
I would maintain a watchdog-only temp notebook, for example:

docs/mission_state/mission_state_selection_sensei_watchdog_audit_scratch.md

Operating rule:

At the start of each packet: clear it or create it empty with a tiny header for the active packet.
During polling: append only short Note to self for audit: bullets.
During audit: read it alongside the worker return, ExecPlan, diff, protocol, and tests.
After audit log entry is written: clear the scratch file again.
In the compact audit log: include only a terse sentence summarizing how those scratch notes resolved, for example:
Scratch audit notes resolved: deferred red tests were valid because no production seams existed yet and each has a later trigger.
Scratch audit notes resolved: BffClient red tests were not validated due --bail, so WDG-003C correction was issued.
Scratch audit notes resolved: diff scope matched packet; no production files or staged changes found.
That gives us compaction resilience without turning the audit log into a long process journal. It also keeps responsibilities clean: the ExecPlan stays worker-owned, the audit log stays compact and durable, and the scratchpad is just my temporary memory aid.

Exception: I have one more idea, for your note to self document, if a note applies to later packet audit or even after the implementation done audit, it's okay to leave it in the document. For example: Ensure all red tests now pass can only be done after the implementation is over. 
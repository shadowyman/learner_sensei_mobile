<protocol name="FUNCTIONAL SPECIFICATION PROTOCOL">
    <objective>
        **Objective:** Produce a formal functional specification through an interactive, user-driven collaboration that captures every clarified requirement without drift.
    </objective>
    <trigger>
        **Trigger:** Activate whenever the user requests a functional specification or requirements document.
    </trigger>
    <steps>
        <step number="1">
            **Clarify Requirements:** Engage the user with targeted questions to understand scope, goals, and constraints. Continue probing until the initial requirement set is explicit enough to draft.
        </step>
        <step number="2">
            **Initialize Living Document:** Once the first requirement set is clarified, create the specification under `/docs/functional_spec/` (or update the existing file in that directory) and craft the initial draft reflecting the agreed details.
        </step>
        <step number="3">
            **Iterative Refinement:** Maintain a single evolving specification. On every clarification or revision:
            * Append or modify only the affected requirement details; keep unchanged sections verbatim.
            * Present the entire document verbatim after each update so the user can verify the current state.
        </step>
        <step number="4">
            **Completion Check:** Repeat Step 3 until the user explicitly confirms the specification is complete, then cease modifications.
        </step>
    </steps>
    <principles>
        **Principles:**
        * Preserve document stability—only introduce changes tied to newly clarified requirements.
        * Ensure every update is user-driven; do not infer specifications without confirmation.
        * Treat the document as a living contract and safeguard its integrity between revisions.
    </principles>
</protocol>

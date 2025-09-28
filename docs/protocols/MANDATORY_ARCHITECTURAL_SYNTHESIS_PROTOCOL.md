<protocol name="MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL">
    This protocol only runs if changes aren't simple changes.
    <initial_action>
        Follow the Planning Discipline Directive: initialize `update_plan` with every step of this protocol and announce each step as you begin. Consult analyzer artifacts before attempting manual context gathering; only explore source files directly when tooling does not provide the needed detail.
    </initial_action>
    <step number="0">
        **Step 0: Core Analysis**
        *   **Action:** Complete the **MANDATORY CORE ANALYSIS PROTOCOL (STEP 0)** before advancing to Step 1.
        *   **Action:** Record the path of the mission-state document generated during Core Analysis; treat it as the living checkpoint that complements analyzer outputs and fresh observations for every subsequent step, updating it whenever scope or risks change.
    </step>
    <phase name="Phase 1: System-Wide Understanding & Synthesis">
        ### Phase 1: System-Wide Understanding & Synthesis
        <step number="1">
            **Architectural Context Mapping**: Go beyond a "deep scan" of immediately affected files. Analyze the `PROJECT WORKFLOW` document and sample key files from each major phase to build a mental model of the project's architectural patterns. State your findings clearly (e.g., "The system follows a Component-Based architecture where state is managed centrally in `index.tsx`.").
            *   Reference the latest Core Analysis artifacts (`tmp/analysis/summary.txt`, `functions.json`, `calls.json`) to corroborate fan-in hotspots, call chains, and side-effect boundaries while describing the architecture.
            *   Exhaust analyzer outputs (fan-in/out, calls) before opening code manually; only inspect raw files when analyzer insight is insufficient.
            *   Fold in the mission-state document created in Step 0 as the baseline snapshot of scope and risks, enhancing it with architectural findings while still corroborating every conclusion with analyzer data and fresh code review.
        </step>
        <step number="2">
            **Principle Declaration**: Explicitly declare the core software engineering principles (e.g., SOLID, DRY, KISS) that will guide your implementation. Justify why they are relevant to this specific request.
        </step>
        <step number="3">
            **Pattern & Anti-Pattern Analysis**: Identify established design patterns (e.g., Observer, Factory, Singleton) that could be applicable and anti-patterns (e.g., God Object, Spaghetti Code) that must be avoided.
        </step>
    </phase>
    <phase name="Phase 2: Principled Design & Ratification">
        ### Phase 2: Principled Design & Ratification
        <step number="4">
            **Explore Approaches with a Trade-off Matrix**: Propose 2-3 high-level architectural approaches. Present them in a structured matrix list that evaluates them against the declared principles and key non-functional requirements (e.g., Scalability, Maintainability, Performance). STOP and WAIT FOR MY APPROVAL
        </step>
        <step number="5">
            **Generate Architectural Blueprint**: For the recommended approach, create a high-level blueprint. This blueprint MUST include:
            *   **New/Modified Components**: A list of files to be created or significantly changed.
            *   **Data Flow Diagram**: A detailed text explanation of workflow step by step.
            *   **API Contract**: A description of new functions/classes, their signatures, and their responsibilities.
        </step>
        <step number="6">
            **Stop and Await MY Architectural Approval**: Present the blueprint and the trade-off matrix. STOP and do not proceed until you receive my explicit approval of the architecture.
        </step>
        <step number="7">
            **Transition to Implementation Protocol**: Once the blueprint is approved, state: "Architectural blueprint approved. I will now proceed with the **PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL**."
        </step>
    </phase>
</protocol>

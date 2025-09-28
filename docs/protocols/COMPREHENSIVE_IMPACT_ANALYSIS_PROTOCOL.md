<protocol name="COMPREHENSIVE IMPACT ANALYSIS PROTOCOL">
    # ====COMPREHENSIVE IMPACT ANALYSIS PROTOCOL====
    <trigger>Execute before ANY modification to existing codebase</trigger>
    <step number="1">
        **Change Classification & Risk Stratification**:
        * Classify change type: Data/Control/Interface/State/Configuration
        * Assign risk level (1-5) based on scope and criticality
        * Determine required analysis depth based on classification
        * Log classification rationale with evidence
        * Source evidence from analyzer outputs before supplementing with manual inspection; only escalate to direct file review if the artifacts lack required detail.
        * Use the latest `fan_in.json` / `fan_out.json` metrics to flag modules with the widest blast radius so you can focus manual scrutiny where it matters most.
    </step>
    <step number="2">
        **Multi-Dimensional Impact Mapping**:
        * **Technical Dimension**: Dependencies, performance, architecture alignment
        * **Business Dimension**: User experience, feature requirements, compliance
        * **Security Dimension**: Vulnerabilities, permissions, data exposure risks
        * **Operational Dimension**: Monitoring, logging, deployment implications
        * **Maintenance Dimension**: Code clarity, documentation, future developer experience
        * Create impact score for each dimension (1-10)
        * Use analyzer dependency graphs and reports before exploring files manually; fall back to manual context only when tooling does not surface the needed insight.
    </step>
    <step number="3">
        **Stakeholder Cascade Analysis**:
        * Map direct code consumers (functions, modules, tests)
        * Identify system integrators (APIs, databases, external services)
        * Analyze end-user impact (UX flows, performance, accessibility)
        * Consider operations impact (debugging, monitoring, deployment)
        * Document future developer implications (patterns, maintainability)
        * Query analyzer call graphs and fan-in/out data first; perform manual chaining only if analyzer coverage is insufficient.
    </step>
    <step number="4">
        **Temporal Ripple Effect Analysis**:
        * **Immediate**: Will this compile? Will tests pass? Will deployment succeed?
        * **Short-term**: How will this affect integration? User experience? Performance?
        * **Medium-term**: Technical debt implications? Maintenance burden? Scalability?
        * **Long-term**: Architecture evolution? Migration compatibility? Team knowledge transfer?
        * Derive supporting signals from analyzer outputs prior to manual exploration; inspect code directly only when tools cannot answer timeline impacts.
    </step>
    <step number="5">
        **Context-Aware Validation Plan**:
        * Based on classification and impact analysis, create validation requirements
        * Define specific evidence needed to prove safety (logs, tests, metrics)
        * Establish rollback plan and monitoring requirements
        * Set success criteria for each affected dimension
        * Lean on analyzer artifacts (functions.json, calls.json) when selecting validation targets; supplement manually only if the tooling is silent, and reconcile open unknowns before finalizing the plan.
    </step>
    <step number="6">
        **Execute with Comprehensive Monitoring**:
        * Implement change with dimensional validation logging
        * Monitor all identified stakeholder touchpoints
        * Validate against temporal impact predictions
        * Document actual vs predicted impacts for learning
    </step>
</protocol>

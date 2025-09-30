# Functional Test Implementation Protocol

## Mission
Align every functional test with the production code path it represents so regressions surface as test failures, not silent drift—regardless of domain (curriculum, adaptive engine, UI state machines, etc.).

## Normative Principles
- **Exercise real seams.** Import the live modules under test (TypeScript or compiled output) and call exported functions exactly as production code does. Never reimplement or stub internal logic.
- **Model authentic data.** Build inputs by invoking the same loaders/initializers production uses (parsers, state factories, repository fetchers). When tailoring scenarios, start from those objects and mutate only through documented fields or sanctioned transitions.
- **Honor ownership boundaries.** Mock only external systems (LLMs, third-party services, infrastructure). Internal collaborators stay real, or use official adapters.
- **Protect contracts.** Import shared enums, types, and schema definitions from their canonical sources. Add guard tests when new contract fields appear.
- **Prefer accurate failures.** When the system currently misbehaves (e.g., missing sections only log warnings), author tests that capture the desired behavior and allow them to fail to surface the gap. Document these expected failures.

## Implementation Checklist
1. **Source System Data**
   - Load canonical fixtures via production loaders (parsers, repositories, service clients). Avoid bespoke builders unless they wrap production loaders.
   - When tailoring fixtures (e.g., removing entries, toggling flags), clone the production object and adjust through documented fields.
2. **Initialize State**
   - Use exported initializers or transitions (e.g., state factories, controllers, reducers) to reach the required scenario. Capture returned state/services for inspection.
   - Avoid constructing complex state objects by hand except for controlled mutations (e.g., toggling `isCompleted`, injecting flags) after initialization.
3. **Inject Collaborators**
   - Provide deterministic collaborators via dependency injection (planner callbacks, data fetchers, external API mocks). Throw when simulating upstream failure.
4. **Interact Through Public APIs**
   - Call the production function under test (service method, reducer, controller action) with prepared data. Assert outputs, state mutations, side effects (logs, events).
5. **Verify Logging & Errors**
   - Spy on `logger` for expected validation entries (`[TEACHING_PLAN_INVALID]`, `[PHASE_VALIDATION]`, etc.). Assert exact payload fields for high-risk paths.
6. **Edge-Case Coverage**
   - Pair each happy path with malformed input tests: empty payloads, invalid values, missing sections, collaborator exceptions, concurrency scenarios.
   - Ensure tests that intentionally fail (highlighting current gaps) include documentation in mission notes and remain visible in CI.
7. **Reset Isolation**
   - Use `beforeEach` to clear module caches (`jest.isolateModules`, `jest.clearAllMocks`) so tests run order-independently.

## Validation Gates
- **Seam Verification**: Confirm tests never rely on shadow helpers that replicate production logic. Searches (e.g., `rg createFoo`) should surface only sanctioned fixtures.
- **State Consistency**: After initialization, assert key invariants (indices, lengths, flags) to ensure production setup executed.
- **Failure Expectations**: Document intentional failures in mission notes and share with owning teams; keep failure messages stable.
- **Flake Audit**: Ensure collaborator stubs and time-dependent logic are deterministic. Avoid randomness or system time without controlled overrides.

## Review Checklist for Future Changes
- Does every new test call a production export to set up and execute behavior?
- Are negative cases asserting on real error types/messages emitted by production code?
- Are logger spies verifying high-value telemetry without over-specifying incidental fields?
- Do tests cover both progression and regression scenarios (success paths and guard rails)?
- Have expected failures been recorded in mission state and communicated to backend owners?
- Did we run the suite (`npm test -- __tests__/... --runTestsByPath`) and capture current pass/fail status?

Maintain this protocol alongside mission state updates. Any deviation requires explicit approval and documentation.

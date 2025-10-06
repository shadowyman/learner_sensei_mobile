# Mission State: Save & Load Progress Functional Tests

## Analysis Scope & Entry Points
- Primary modules: `saveloadProgressManager.ts`, `saveloadSerialization.ts`.
- Entry points: `SaveLoadProgressManager.saveProgress` (save flow) and `SaveLoadProgressManager.loadProgress` (load flow).
- Supporting helpers in scope: `collectSessionData`, `collectUIState`, `extractChatHistory`, `generateMetadata`, `downloadSaveFile`, `restoreSessionData`, `recreateChatSession`, `restoreUIState`, `handlePendingOperations`, `updateAllDisplays`, serialization helpers for curriculum/learner/consolidation, JSON replacer/reviver.

## Static Execution Trace Mapping
**Save Flow**
1. `saveProgress`
2. `hasActiveStreamingMessages` → conditional wait
3. `waitForStreamingCompletion`
4. `collectSessionData`
   - `extractChatHistory`
   - `collectUIState`
   - `serializeCurriculumState`
   - `serializeLearnerModel`
   - `getCurrentSystemInstruction`
   - `getModelConfig`
   - `serializeConsolidation`
5. `validateSerializedData`
6. `generateMetadata` → `generateCurriculumChecksum`
7. `serializeForSave`
8. `downloadSaveFile`

**Load Flow**
1. `loadProgress`
2. `readFile` (FileReader)
3. `JSON.parse(..., deserializeFromSave)`
4. `checkCompatibility`
5. `restoreSessionData`
   - `deserializeCurriculumState`
   - `deserializeLearnerModel`
   - `recreateChatSession`
   - `restoreUIState`
   - `handlePendingOperations` → `deserializeConsolidation`
   - `updateAllDisplays`
6. `setTimeout` reinitializes SelectionSensei after DOM rebuild

## Dependency & Side-Effect Table
| Function | Key Dependencies | Side Effects | Risk |
| --- | --- | --- | --- |
| `saveProgress` | window streaming timers, serialization helpers, `Date` | Awaits streaming completion, builds JSON, triggers download | High (I/O, async timing)
| `waitForStreamingCompletion` | `hasActiveStreamingMessages`, `setTimeout` | Polling loop can hang test if timers unchecked | Medium
| `collectSessionData` | `window` globals, `logger`, serialization helpers | Reads DOM & window state, logs notepad info | Medium
| `extractChatHistory` | DOM `.message-bubble`, `window.streamingMessagesRawText`, chat SDK | DOM traversal, merges streaming chunks | High (DOM + chat fallback)
| `collectUIState` | DOM selectors, `window.streamingMessagesRawText` Map | Reads DOM, clones Map | Medium
| `generateMetadata` | `window.curriculum`, `navigator.userAgent` | Accesses global curriculum, computes checksum | Medium
| `downloadSaveFile` | `Blob`, `document.body`, `URL.createObjectURL` | Creates anchor, clicks, revokes URL | High (DOM mutation, object URLs)
| `loadProgress` | FileReader, `JSON.parse`, `restoreSessionData` | Sets `isRestoring`, schedules SelectionSensei reinit | High
| `readFile` | `FileReader` | Async file I/O | Medium
| `checkCompatibility` | `SAVE_VERSION` | None (pure) | Low
| `restoreSessionData` | `window` globals, deserializers, notepad | Writes global state, calls async UI restores | High
| `recreateChatSession` | `window.ai`, `MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG` | Calls SDK to create chat session | High (external API)
| `restoreUIState` | DOM, dynamic import `./ui.js`, `displayMessage`, `processMermaidBlocks` | Clears/rebuilds message area, mutates Map, runs mermaid | High
| `handlePendingOperations` | `displayPhaseSelectionMessage`, consolidation helpers | Restores consolidation Map, triggers UI message | Medium
| `updateAllDisplays` | `updateFooter`, `updateCurriculumDisplay`, DOM fallback | Mutates footer/curriculum DOM, focuses textarea | Medium
| `serializeForSave` | Set/Map/Date detection | Wraps complex types for JSON | Low
| `serializeCurriculumState` | Curriculum state object | Converts Sets/Maps to arrays, ensures ledger | Medium
| `serializeLearnerModel` | Learner model | Converts Set to array | Low
| `serializeConsolidation` | consolidation plan Map | Map → array | Low
| `deserializeFromSave` | Reviver | Restores Set/Map/Date | Low
| `deserializeCurriculumState` | Serialized curriculum state | Restores Sets/Maps | Medium
| `deserializeLearnerModel` | Serialized learner model | Restores Set | Low
| `deserializeConsolidation` | Serialized consolidation plan | Array → Map | Low
| `generateCurriculumChecksum` | `JSON.stringify` | Deterministic hash, no external effects | Low

## Risk Register (High Cost/Blast)
- `saveProgress` / `downloadSaveFile`: DOM mutation + file download; ensure tests stub anchor creation & URL APIs.
- `loadProgress`: toggles `isRestoring`, depends on FileReader and dynamic import; failure leaves system locked; verify finally block.
- `restoreSessionData` / `restoreUIState`: heavy DOM reconstruction, must ensure Map & mermaid hooks restored.
- `recreateChatSession`: Relies on `window.ai.chats.create` with config; wrong stub breaks replay.
- `extractChatHistory`: DOM vs SDK fallback; improper stubbing may hide streaming merge bug.
- `waitForStreamingCompletion`: Timer polling; needs fake timers to avoid hangs.

## Coverage Checklist (Function Stable IDs)
**Save Flow**
- `SaveLoadProgressManager.saveProgress#d88563068f49`
- `SaveLoadProgressManager.collectSessionData#a4cea650f6f8`
- `SaveLoadProgressManager.extractChatHistory#9b302ed3d274`
- `SaveLoadProgressManager.collectUIState#908ceeb8a477`
- `SaveLoadProgressManager.generateMetadata#b1bb70e4dbef`
- `SaveLoadProgressManager.hasActiveStreamingMessages#4ddd2ff8e853`
- `SaveLoadProgressManager.waitForStreamingCompletion#2ad2063c0253`
- `SaveLoadProgressManager.downloadSaveFile#ccc508ef4614`
- `SaveLoadProgressManager.generateCurriculumChecksum#887f75311a9d`
- `SaveLoadProgressManager.serializeConsolidation#c390532e5b0f`
- `serializeForSave#fce6fecbab8b`
- `serializeCurriculumState#867bf47b7ca4`
- `serializeLearnerModel#2318dac4be53`
- `validateSerializedData#b3087ee3bd90`

**Load Flow** (captured from prior focused trace)
- `SaveLoadProgressManager.loadProgress#baec8b06ef3d`
- `SaveLoadProgressManager.readFile#eec71658445f`
- `deserializeFromSave#6db44ea37f62`
- `SaveLoadProgressManager.checkCompatibility#c20d962b8d80`
- `SaveLoadProgressManager.restoreSessionData#4861519304cc`
- `deserializeCurriculumState#c56f42ea3be1`
- `deserializeLearnerModel#187b4fc038dd`
- `SaveLoadProgressManager.recreateChatSession#341521453768`
- `SaveLoadProgressManager.restoreUIState#2702edc8b145`
- `SaveLoadProgressManager.handlePendingOperations#1450673d6d02`
- `SaveLoadProgressManager.updateAllDisplays#276bdbfe723f`
- `SaveLoadProgressManager.deserializeConsolidation#6a83ebcc6b10`

## Assumptions & Unknowns Register
| Item | Rationale | Impact | Verification Plan |
| --- | --- | --- | --- |
| Mocking `window.ai.chats.create` | SDK not available in Jest | High | Provide stub returning spy; assert called with trimmed history & config.
| Handling `import('./selectionSensei.js')` | Dynamic import executed via `setTimeout` | Medium | Mock `globalThis.importModule` equivalent using jest.spyOn on `import` resolver (via jest.mock) and flush fake timers.
| `window.streamingMessageTimers` lifecycle | Map contents cleared via timers | High | Use modern fake timers, seed Map, ensure `waitForStreamingCompletion` observes changes.
| `FileReader` async behavior | Node lacks FileReader | Medium | Implement mock FileReader class for tests; validate load path uses reviver.
| DOM mermaid processing | `processMermaidBlocks` asynchronous | Medium | Stub to record invocations and resolve promises to avoid hanging tests.

## Key Architectural Insights
- Save/load relies on global `window` state; tests must construct representative globals (curriculumState, learnerModel, chat, notepad, streaming timers).
- Chat restoration trims to 100 messages and reuses `MAIN_SENSEI_RESPONSE_CHAT_MODEL_CONFIG`; ensuring config parity is essential.
- UI restoration splits between inline `displayMessage` and dynamic import fallback; tests must handle both code paths.
- Serialization helpers convert Sets/Maps/Date and guard missing ledgers; JSON replacer & reviver maintain type fidelity.

## Next Protocol
- Proceed to **Comprehensive Impact Analysis Protocol** before implementing tests.
- Subsequent protocols anticipated: **Mandatory Principle-Driven Feature Implementation Protocol** (for test creation).

## Test Traceability
Planned functional tests will import and exercise:
- `saveloadProgressManager.ts` (primary orchestration)
- `saveloadSerialization.ts` (serialization helpers)
- Supporting config/constants accessed indirectly: `model_usage.ts`, `logger.ts` (stubbed), `ui.ts` (via mocked `displayMessage`), DOM APIs simulated via JSDOM.


## Comprehensive Impact Analysis

### Step 1 – Change Classification & Risk
- Change type: Hybrid **Control/State validation** via new Jest functional test suite (`__tests__/saveLoadProgress.test.ts`) exercising orchestration and serialization paths.
- Risk level: **3 (Medium)**. Although we only add tests, the suite drives high-blast singletons (`SaveLoadProgressManager`, DOM globals) and must faithfully mock `window.ai`, timers, DOM, and file APIs. Fan-out metrics show `saveloadProgressManager.ts` touches 6 downstream modules (analysis summary) while `saveloadSerialization.ts` has inbound usage, so fragile mocks could mask regressions or destabilize existing suites.
- Evidence: Analyzer `summary.txt` lists `saveloadProgressManager.ts` among top fan-out files (6), confirming wide interaction surface; `fan_in.json` shows serialization helpers consumed by the manager, so test harness must mirror real integrations.

### Step 2 – Multi-Dimensional Impact Mapping
- Technical (8/10): Functional suite must emulate DOM, timers, `window.ai`, FileReader, and serialization interplay. Analyzer call graphs show save/load spans 15+ helper calls, so mocks must preserve sequencing to avoid false positives.
- Business (7/10): Save/load guarantees learners can resume sessions; failing or flaky tests risk regressions reaching production, directly impacting tutoring continuity.
- Security (3/10): Tests handle in-memory fixtures only; no new data flows beyond existing serialization logic. Maintain vigilance over Blob/URL mocks but exposure is limited.
- Operational (6/10): Suite will gate CI for regression detection. Needs deterministic fake timers (per plan) to keep pipelines reliable.
- Maintenance (7/10): Comprehensive fixtures and shared mocks reduce ad-hoc harness duplication. Must document mock usage per `mocks/` conventions to remain approachable for future contributors.

### Step 3 – Stakeholder Cascade Analysis
- Direct code consumers: `index.tsx` wiring (focused trace shows `initializeSaveLoadUI` -> `saveProgress`), notepad integrations (`logger`, notepad capture). Tests must stub `logger` to avoid noisy output.
- System integrators: Google AI SDK via `window.ai.chats.create`, DOM APIs (`document`, `Blob`, `FileReader`), `navigator.userAgent`, timer queue.
- End-user impact: Ensures chat, curriculum, notepad, consolidation states persist; regression would surface as lost progress or broken UI restoration.
- Operations impact: CI runs will now assert serialization/deserialization symmetry; flakiness could slow deployment. Need deterministic fake timers and controlled random values (timestamps).
- Future developer implications: Centralized mocks in `mocks/` let other suites reuse FileReader, Blob, window stubs; documentation required to prevent divergent ad-hoc mocks.

### Step 4 – Temporal Ripple Effect Analysis
- Immediate: Need deterministic mocks so suite passes locally & in CI. Must ensure coverage of asynchronous branches (fake timers for streaming wait & SelectionSensei reinit) to prevent hanging tests.
- Short-term: Developers gain confidence editing `SaveLoadProgressManager`; failing tests will block regressions. Potential time cost maintaining large fixtures.
- Medium-term: Fixture rot risk if curriculum/learner structures evolve; plan to centralize fixture builders so updates propagate.
- Long-term: Suite forms foundation for future persistence features (e.g., cloud sync). Maintaining mocks in `mocks/` keeps knowledge transferable.

### Step 5 – Context-Aware Validation Plan
- Required evidence:
  - New Jest functional suite covering scenarios SAV-001 → LOD-010 & DAT/DAT/LOD cases with deterministic fixtures.
  - Mocks under `mocks/` for DOM, timers, FileReader, Blob, window.ai; reuse or extend existing modules to keep shared behavior.
  - Assert calls against `SaveLoadProgressManager` helpers (using spies) align with coverage checklist stable IDs.
- Rollback/mitigation: If tests destabilize CI, isolate via Jest `describe.only` locally, then adjust fixtures; revert test file only (no prod impact) if necessary.
- Success criteria:
  - All planned cases implemented with clear naming mirroring plan IDs.
  - Suite passes under `npm test` with modern fake timers.
  - No leakage of global state after each test (reset mocks, JSDOM cleanup).
  - Documentation in mission state referencing mock additions for future reuse.

### Phase 1 – Feature Blueprint

#### Step 1 – Goals & Requirements
- Functional Requirements:
  1. Implement Jest functional suite at `__tests__/saveLoadProgress.test.ts` covering scenarios SAV-001 through LOD-010 and DAT-001 through DAT-005 plus D-series edge cases from the supplied plan.
  2. Ensure test harness exercises real exports (`SaveLoadProgressManager`, `saveloadSerialization`) without re-implementing logic, using DOM + window mocks positioned under `__mocks__/` per policy.
  3. Validate serialization/deserialization (Maps/Sets/Dates) and UI restoration behaviors through assertions tied to coverage checklist stable IDs.
- Non-Functional Requirements:
  - Deterministic execution via Jest modern fake timers; no reliance on system time beyond controlled overrides.
  - Reusable mocks adhering to `__mocks__/` conventions to minimize duplication across future suites.
  - Traceable test names referencing plan IDs for maintenance.
- Evidence: Aligned with mission-state execution trace and DSE table; targeted functions include `SaveLoadProgressManager.saveProgress`, `.loadProgress`, `.collectSessionData`, `.restoreSessionData`, serialization helpers (`serializeForSave`, `deserializeFromSave`, etc.) per analyzer outputs (`functions.json`, `focused_trace`).

#### Step 2 – Architectural Checkpoint
- No new runtime modules or architectural shifts. Tests consume existing exports; therefore Architectural Synthesis Protocol is not required.

#### Step 3 – Approaches Trade-off Matrix
| Approach | Description | Maintainability | Determinism | Coverage | Feasibility (/100) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| A. Integrated DOM Harness | Use JSDOM with manual DOM tree setup per scenario, mocks for `window.ai`, FileReader, Blob under `__mocks__/`. Each test seeds DOM via template helpers before invoking manager methods. | Medium – DOM scaffolding verbose but explicit. | High – full control using fake timers and deterministic data. | High – exercises both DOM-first and SDK fallback paths in single suite. | 82 | Aligns closely with production; risk of bulky fixtures. |
| B. Modular Fixture Builders | Create reusable builders in `__mocks__/saveLoadFixtures.ts` generating curriculum/learner/chat DOM states; tests compose builders for each case. | High – shared builders reduce duplication. | High – builders encapsulate deterministic data/time. | High – ensures consistent data across scenarios; easier updates if curriculum schema changes. | 90 | Requires upfront fixture design but scales best. |
| C. Serialization-Focused Isolation | Split suite: one file for serialization helpers (pure data), second for manager orchestrations with heavy mocking of DOM interactions via spies. DOM coverage handled through mocks verifying calls. | Medium-Low – two suites increase maintenance overhead; mocks risk diverging from real DOM. | High – pure functions simple; orchestrator tests rely on spies. | Medium – risks missing DOM integration faults due to spy reliance. | 68 | Lower redundancy but weaker assurance on UI reconstruction.

#### Step 4 – Risks & Mitigations (Approach B)
1. **Fixture Drift** – Curriculum/learner schema changes could desync builder outputs.
   - *Mitigation*: Centralize source data in `__mocks__/saveLoadFixtures.ts` using cloning helpers that reference real modules/types; document update procedure in fixture file header.
2. **Global State Leakage** – Window/DOM mocks might persist across tests, causing flakiness.
   - *Mitigation*: Implement `resetTestEnvironment()` utility in mocks that clears globals, Maps, and jest timers in `afterEach`.
3. **Timer Deadlocks** – Misconfigured fake timers could leave pending timeouts (e.g., streaming wait loop) and hang tests.
   - *Mitigation*: Use modern fake timers with explicit `advanceTimersByTime`/`runOnlyPendingTimers`, and include guard assertions verifying `Date.now` overrides restored.

#### Step 5 – Implementation & Validation Plan (Approach B)
☑ **Task 1**: Create fixture builders & environment controls in `__mocks__/saveLoadFixtures.ts`.
  * *Validation Evidence*: Verified via Jest assertions that helpers populate DOM, streaming maps, and global state; no runtime logging required.
  * *Implementation Details*: Export helpers to seed curriculum, learner model, chat DOM, streaming maps, notepad notes, and provide `resetEnvironment()` utilities sourcing types from production modules.

☑ **Task 2**: Provide shared mocks for external APIs in `__mocks__/saveLoadMocks.ts`.
  * *Validation Evidence*: Unit assertions confirm mocks intercept FileReader, download, and AI chat creation paths during tests.
  * *Implementation Details*: Implement deterministic FileReader, download, and AI mocks with queue-based control so negative-path scenarios can drive failures deterministically.

☑ **Task 3**: Author Save flow Jest suite sections (SAV-001…SAV-011) in `__tests__/saveLoadProgress.test.ts` using builders.
  * *Validation Evidence*: Scenario-specific assertions and Jest timer controls cover wait loops, metadata, validation failures, and download fallbacks.
  * *Implementation Details*: Use modern fake timers, assert wait loop behavior, metadata assembly, download fallback, and validation errors per plan; reuse spies from mocks.

☑ **Task 4**: Author Load flow sections (LOD-001…LOD-010).
  * *Validation Evidence*: End-to-end assertions confirm compatibility guards, restoration flows, SDK replay, SelectionSensei reinitialization, and error paths without relying on console logging.
  * *Implementation Details*: Drive FileReader mock, ensure compatibility guard, rehydration of Maps/Sets, mermaid processing, SelectionSensei timer flush, error recovery resets `isRestoring`.

☑ **Task 5**: Author Data fidelity & helper tests (DAT-001…DAT-005 + edge cases).
  * *Validation Evidence*: Serialization round-trip assertions cover Sets, Maps, Dates, deep clones, consolidation helpers, and checksum determinism.
  * *Implementation Details*: Validate symmetry of serialization helpers, deepClone integrity, checksum determinism; cover negative validations (missing fields) per D-series.

☑ **Task 6**: Ensure Jest isolation & teardown.
  * *Validation Evidence*: AfterEach hooks reset globals, timers, and spies; confirmed by absence of cross-test state leaks under repeated runs.
  * *Implementation Details*: Configure `beforeEach/afterEach` to call `resetEnvironment`, clear jest modules, restore timers; assert no residual DOM nodes or timers remain post-test.

☑ **Task 7**: Update mission state with test coverage mapping & prep backup command plan.
  * *Validation Evidence*: Mission-state document records coverage checklist and backup path without additional runtime logging.
  * *Implementation Details*: Document final coverage checklist fulfillment, note `npm run backup:create -- --feature "save_load_functional_tests" ...` prior to code edits, track removal of validation logs post Step 9.

#### Step 5.5 – Functional Test Policy Alignment
- **Data Sourcing**: Builders pull curriculum/learner structures from production modules and clone via documented fields, avoiding hand-rolled schemas.
- **Coverage Breadth**: Test matrix covers all save (SAV), load (LOD), data (DAT), and edge (D) scenarios from plan, mapping to coverage checklist stable IDs.
- **Determinism**: Use `jest.useFakeTimers('modern')`, fixed timestamps, and seeded Maps/Sets to eliminate randomness; reset environment each test.
- **Negative Paths**: Include validation failure (SAV-009), version mismatch (LOD-001), corrupted payload (DAT/D cases) ensuring guards enforced.
- **Traceability**: Test names match plan IDs (e.g., `SAV-001 waits before collectSessionData`); logs tagged `[SAVE_LOAD_TEST]` associate execution evidence.
- **Contract Mapping**: Assert against production types (e.g., `CurriculumState`, `LearnerModel`) and ensure serialization helpers round-trip native structures.

### Implementation Coverage Mapping
- SAV-001 → `SaveLoadProgressManager.waitForStreamingCompletion#2ad2063c0253`
- SAV-002 → `SaveLoadProgressManager.waitForStreamingCompletion#2ad2063c0253`
- SAV-003 → `SaveLoadProgressManager.collectSessionData#a4cea650f6f8`
- SAV-004 → `SaveLoadProgressManager.extractChatHistory#9b302ed3d274`
- SAV-005 → `SaveLoadProgressManager.extractChatHistory#9b302ed3d274`
- SAV-006 → `SaveLoadProgressManager.collectUIState#908ceeb8a477`
- SAV-007 → `SaveLoadProgressManager.generateMetadata#b1bb70e4dbef`
- SAV-008 → `serializeForSave#fce6fecbab8b`, `deserializeFromSave#6db44ea37f62`
- SAV-009 → `validateSerializedData#b3087ee3bd90`
- SAV-010 → `SaveLoadProgressManager.downloadSaveFile#ccc508ef4614`
- SAV-011 → `SaveLoadProgressManager.downloadSaveFile#ccc508ef4614`
- LOD-001 → `SaveLoadProgressManager.checkCompatibility#c20d962b8d80`
- LOD-002 → `SaveLoadProgressManager.restoreSessionData#4861519304cc`
- LOD-003 → `SaveLoadProgressManager.recreateChatSession#341521453768`
- LOD-004 → `SaveLoadProgressManager.restoreUIState#2702edc8b145`
- LOD-005 → `SaveLoadProgressManager.updateAllDisplays#276bdbfe723f`
- LOD-006 → `SaveLoadProgressManager.handlePendingOperations#1450673d6d02`
- LOD-007 → `SaveLoadProgressManager.deserializeConsolidation#6a83ebcc6b10`
- LOD-008 → `SaveLoadProgressManager.loadProgress#baec8b06ef3d`
- LOD-009 → `SaveLoadProgressManager.restoreSessionData#4861519304cc`
- LOD-010 → `SaveLoadProgressManager.readFile#eec71658445f`
- DAT-001 → `serializeCurriculumState#867bf47b7ca4`, `deserializeCurriculumState#c56f42ea3be1`
- DAT-002 → `serializeLearnerModel#2318dac4be53`, `deserializeLearnerModel#187b4fc038dd`
- DAT-003 → `deepCloneState#7bf1d58a32f9`
- DAT-004 → `serializeConsolidation#c390532e5b0f`, `deserializeConsolidation#6a83ebcc6b10`
- DAT-005 → `generateCurriculumChecksum#887f75311a9d`
- ERR-001 → `validateSerializedData#b3087ee3bd90`
- ERR-002 → `validateSerializedData#b3087ee3bd90`
- ERR-003 → `SaveLoadProgressManager.readFile#eec71658445f`
- ERR-004 → `SaveLoadProgressManager.updateAllDisplays#276bdbfe723f`
- ERR-005 → `SaveLoadProgressManager.loadProgress#baec8b06ef3d`
- ERR-006 → `SaveLoadProgressManager.restoreUIState#2702edc8b145`

### Backup Reference
- Created `backup/sensei_backup_save_load_functional_tests_20251002_190112.zip` prior to implementation.

### Validation Evidence
- `npm test -- --runTestsByPath __tests__/saveLoadProgress.test.ts`
- `npx tsc --noEmit`
- `npx eslint --config config/eslint.config.cjs __tests__/saveLoadProgress.test.ts __mocks__/saveLoadMocks.ts`

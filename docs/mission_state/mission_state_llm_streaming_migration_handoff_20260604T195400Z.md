# LLM Streaming Migration Handoff

Timestamp: 2026-06-04T19:54:00Z

Fresh repo location: `/Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh`

Old problematic repo location: `/Users/aligunes/Documents/Recursive_Sensei_Mobile`

## Purpose

This document hands off the LLM streaming migration work from a prior Codex session that ran mostly against the old `Documents` checkout. The next agent should work only in the fresh checkout at `/Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh`.

The migration scope is intentionally narrow: move the mobile LLM execution path for `streamModuleIntroduction` and `streamMainSenseiResponse` behind Core and BFF while preserving the existing WebView streaming UI behavior.

## Critical Starting Instructions For The Next Agent

Start in:

    /Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh

Read these first:

1. `AGENTS.md`
2. `docs/execplans/module_intro_main_sensei_streaming_core_bff_migration_execplan.md`
3. `docs/protocols/PLAN.md` if executing or revising the ExecPlan

Before implementation, follow the repo protocols from `AGENTS.md`. This is architecture and feature work, so the likely sequence is:

1. MANDATORY CORE ANALYSIS PROTOCOL
2. COMPREHENSIVE IMPACT ANALYSIS PROTOCOL
3. MANDATORY ARCHITECTURAL SYNTHESIS PROTOCOL
4. MANDATORY PRINCIPLE-DRIVEN FEATURE IMPLEMENTATION PROTOCOL

Do not continue implementation from the old `Documents` checkout. That checkout showed iCloud/File Provider dependency problems.

## ExecPlan Created

The implementation plan has already been written here:

    docs/execplans/module_intro_main_sensei_streaming_core_bff_migration_execplan.md

That ExecPlan is the canonical plan for the next session. It records the agreed API shape, transport decision, file touch points, required Mobile Routing Gate, test expectations, and validation steps.

## Why This Migration Exists

The mobile LLM proxy Phase 1 master plan requires migrated mobile LLM capabilities to be server-owned:

- Mobile must not call provider SDKs directly for migrated capabilities.
- Mobile must not rely on bundled prompt bodies for migrated capabilities.
- Core should own prompt text, prompt builders, capability request types, and provider-agnostic logic.
- BFF should own server-side provider transport, API keys, request validation, rate limiting, and streaming delivery.
- React Native should own native transport and bridge wiring.
- WebView should keep teaching state, DOM rendering, transcript state, stream chunk application, and user-facing UI behavior.

This pass focuses only on two remaining LLM-facing streaming functions:

- `src/interactionHelpers.ts::streamModuleIntroduction`
- `src/interactionHelpers.ts::streamMainSenseiResponse`

Other LLM-facing backlog items remain out of scope for this pass:

- Selection Sensei follow-up/toolbar actions
- Enhancement request
- Key-takeaway enhancement internals
- Pedagogical directive generation

## Scoped Function Behavior Found In Prior Analysis

### `streamModuleIntroduction`

Current location:

    src/interactionHelpers.ts

Current behavior:

- Accepts a Gemini chat object, `introContext`, module title, Sensei message id, and optional enhancer controller.
- Builds final message by appending:

    Let's begin ${moduleTitleForPrompt}.

- Calls:

    chat.sendMessageStream({ message: messageWithContext })

- Iterates streamed chunks.
- Accumulates full response text.
- Calls `enhancerController.onChunk` when present.
- Calls `updateMessageStream` per chunk so the visible Sensei bubble updates progressively.
- On completion, calls `enhancerController.finalize` and `enhancerController.getLatestText` when present.
- Returns final accumulated/generated text.

Important finding: this function does not only send "Let's begin ...". The larger prompt is built upstream as `introContext`.

Upstream module-introduction prompt construction currently involves:

- `src/moduleSelectionHandler.ts`
- `src/curriculum.ts`
- `src/prompts.ts`
- `src/interactionHelpers.ts::buildSenseiDynamicSystemInstruction`

### `streamMainSenseiResponse`

Current location:

    src/interactionHelpers.ts

Current behavior:

- Accepts a Gemini chat object, `dynamicContext`, current user input, Sensei message id, and optional enhancer controller.
- Creates:

    User: ${currentUserInput}

- If `dynamicContext` contains `USER_LAST_INPUT_PLACEHOLDER`, replaces that placeholder with the user line.
- Otherwise appends the user line to the context.
- Calls:

    chat.sendMessageStream({ message })

- Tracks chunk count and first chunk latency.
- Accumulates full response text.
- Calls `enhancerController.onChunk` when present.
- Calls `updateMessageStream` per chunk.
- On completion, calls `enhancerController.finalize` and `enhancerController.getLatestText` when present.
- Returns final accumulated/generated text.

Important finding: this function receives a prebuilt prompt context. Moving only the final `sendMessageStream` call would not satisfy the master plan because WebView would still own final prompt wording for mobile.

## Prompt Builder Surface Identified

Prompt constants and functions in scope for analysis/migration include:

- `MODULE_INTRODUCTION_TASK_TEMPLATE`
- `MAIN_SENSEI_RESPONSE_SYSTEM_INSTRUCTION_TEMPLATE_FUNCTION`
- `MANDATORY_TEACHING_STRUCTURE`
- `PEDAGOGICAL_GUIDANCE_PLACEHOLDER`
- `USER_LAST_INPUT_PLACEHOLDER`
- `buildSenseiDynamicSystemInstruction`
- `buildSocraticExecutionInstruction`
- `buildEarlyReturnInstruction`
- `getCurriculumFocusInstruction`
- `calculateFocusPoints`
- `resolveFocusPoints`
- `buildPrimaryActionInstruction`
- `buildSupportingContextBlock`
- `buildContextualInstruction`

The expected destination is Core prompt/capability modules, likely:

- `core/prompts/moduleIntroduction.ts`
- `core/prompts/mainSenseiResponse.ts`
- `core/moduleIntroduction.ts`
- `core/mainSenseiResponse.ts`

`core/index.ts` will likely need exports for the new capabilities.

Important nuance: not all curriculum logic necessarily moves. WebView can keep curriculum state and focus calculations. Core should own prompt wording. If a current function mixes state derivation and prompt-language generation, split it so WebView sends structured data and Core turns that structure into provider prompt text.

## Transport Decision

Use WebSocket streaming for mobile.

Do not use RN HTTP `fetch` streaming for Phase 1.

Prior session tested a temporary RN fetch streaming probe. Result:

- Server successfully streamed real Gemini chunks over HTTP NDJSON.
- React Native received HTTP status `200`.
- React Native reported `hasBody: false`.
- React Native reported `hasGetReader: "undefined"`.
- React Native only reported after the server completed.

Conclusion: the iOS React Native runtime did not expose browser-style `response.body.getReader()`, so HTTP `fetch` streaming cannot preserve progressive chunk delivery without adding a native streaming/SSE library.

WebSocket is the selected transport because:

- React Native has built-in WebSocket support.
- The existing mobile client already has a WebSocket async-iterator helper.
- The BFF already has a WebSocket stream scaffold, though it is currently shaped around generic `turnId` semantics.

## Selected BFF API Shape

Use a two-step flow:

1. React Native/BFF client posts structured request data:

    POST /sessions/:sessionId/llm-stream

2. BFF validates, rate-limits, stores a short-lived request by `requestId`, and returns:

    {
      "requestId": "llmreq_...",
      "streamUrl": "ws://host/sessions/:sessionId/llm-stream?requestId=llmreq_..."
    }

3. React Native opens the returned WebSocket URL.

4. BFF streams lifecycle and chunk events over WebSocket.

Request body shape should be capability-based:

    {
      "capability": "moduleIntroduction" | "mainSenseiResponse",
      "messageId": "msg-...",
      "payload": { structured capability-specific data },
      "metadata": { "source": "mobile", "appVersion": "..." }
    }

WebSocket event shape should be simple:

    { "type": "status", "phase": "started", "requestId": "...", "messageId": "...", "capability": "..." }
    { "type": "chunk", "requestId": "...", "messageId": "...", "capability": "...", "text": "..." }
    { "type": "status", "phase": "completed", "requestId": "...", "messageId": "...", "capability": "..." }
    { "type": "error", "requestId": "...", "messageId": "...", "capability": "...", "code": "...", "message": "..." }

Do not put the full structured payload into query parameters. The `POST` is the right place for large JSON context, validation, rate limiting, and request creation.

## Existing BFF Stream Scaffold

The current scaffold uses:

- `bff/src/routes/sessions.js`
- `bff/src/controllers/sessionController.js`
- `bff/src/stream/streamServer.js`
- `bff/src/services/streamingService.js`
- `bff/src/integration/senseiCoreAdapter.js`
- `bff/src/integration/geminiGateway.js`

Current shape:

    POST /sessions/:sessionId/turns
    -> returns /sessions/:sessionId/stream?turnId=...
    -> StreamingService looks up turnId
    -> SenseiCoreAdapter.buildPrompt(context)
    -> GeminiGateway.streamMainResponse(prompt)

Decision: reuse/refactor the WebSocket server/service pattern, but do not force these capabilities into the old `/turns` abstraction.

Reason:

- Module introduction is not really a user chat turn.
- Main Sensei response needs richer structured context than `{ input.text }`.
- `SenseiCoreAdapter.buildPrompt` is currently stub-like and should not become the long-term capability prompt home.

Expected new files:

- `bff/src/routes/llmStream.js`
- `bff/src/controllers/llmStreamController.js`
- `bff/src/services/llmStreamRequestStore.js`

Expected modified files:

- `bff/src/server.js`
- `bff/src/container.js`
- `bff/src/stream/streamServer.js`
- `bff/src/services/streamingService.js`
- `bff/src/integration/geminiGateway.js`
- possibly `bff/src/integration/senseiCoreAdapter.js`

## React Native Work Expected

Likely touched files:

- `SenseiMobile/src/mobile/network/BffClient.ts`
- `SenseiMobile/src/mobile/network/types.ts`
- `SenseiMobile/src/mobile/bridge/contracts.ts`
- `SenseiMobile/src/mobile/MainScreen.tsx`

Expected approach:

- Add one transport-level method, likely `submitLlmStream(payload)`.
- It should call `POST /sessions/:sessionId/llm-stream`.
- It should open the returned `streamUrl`.
- It should reuse the existing WebSocket async-queue pattern.
- It should yield `status`, `chunk`, and `error` events with `requestId`, `messageId`, and `capability`.

Do not remove existing `submitTurn` unless fresh impact analysis proves it is unused and safe to retire.

## WebView Work Expected

Likely touched files:

- `src/interactionHelpers.ts`
- `src/moduleSelectionHandler.ts`
- `src/index.tsx`
- `src/curriculum.ts`
- `src/prompts.ts`
- `src/mobile/webviewMessageRouter.ts`

Expected approach:

- Keep `streamModuleIntroduction` and `streamMainSenseiResponse` as exported UI-facing wrappers.
- On mobile, route through native bridge/BFF stream instead of `chat.sendMessageStream`.
- On desktop web, keep the current direct stream path for Phase 1 unless a later plan explicitly migrates desktop transport.
- Preserve:
  - `updateMessageStream`
  - `enhancerController.onChunk`
  - `enhancerController.finalize`
  - `enhancerController.getLatestText`
  - final text return behavior

The WebView should not send final prompt bodies to BFF for migrated mobile capabilities. It should send structured capability payloads.

## Key-Takeaway Enhancer Decision

Do not migrate enhancer internals in this pass.

Preserve hooks inside the two scoped stream functions:

- `enhancerController.onChunk`
- `enhancerController.finalize`
- `enhancerController.getLatestText`

The enhancer has its own LLM-facing path and is a separate backlog row. Do not disable it and do not make it a direct-call production concern in this pass.

## Required Mobile Routing Gate

`docs/protocols/PLAN.md` requires any ExecPlan that migrates or introduces an LLM tool to include a Mobile Routing Gate.

For this migration, the gate must prove:

- Mobile WebView build routes `streamModuleIntroduction` and `streamMainSenseiResponse` to BFF-backed streaming.
- Desktop-only local SDK paths are gated with `window.__SENSEI_MOBILE_BUILD__`.
- A sentinel test fails if mobile uses a browser `CoreLlmClient`, browser Gemini chat, or `chat.sendMessageStream` for these migrated mobile capabilities.

The ExecPlan already includes this gate. Keep it updated during implementation.

## Validation Expectations

Automated validation should include:

- Core prompt parity tests.
- BFF `llm-stream` route tests.
- BFF WebSocket stream tests with a deterministic stubbed gateway.
- RN `BffClient` WebSocket parsing/unit tests.
- WebView/mobile-routing sentinel tests.
- Existing relevant interaction helper tests.

Manual validation should include:

- Start BFF.
- Start Metro.
- Launch iOS simulator.
- Trigger a module introduction.
- Trigger a normal main Sensei response.
- Confirm chat bubble updates progressively, not only after full response completion.
- Confirm BFF logs show matching `requestId`, started/chunk/completed lifecycle.

## Environment / Repo Migration Notes

The old checkout under `Documents` showed iCloud/File Provider issues:

- `fileproviderd` and `cloudd` used high CPU during copy.
- `node_modules` dependency files such as `bff/node_modules/zod/index.cjs` appeared as `compressed,dataless`.
- `require('zod')` hung.
- BFF tests and SDK imports hung.
- Finder and broad `rsync` copies stalled on dependency/cache folders.

The new checkout under `~/Developer` should avoid those problems. Before implementation, verify BFF imports:

    cd /Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh/bff
    node -e "console.log('zod start'); require('zod'); console.log('zod done')"
    node -e "console.log('server start'); require('./src/server'); console.log('server done')"

Expected:

    zod start
    zod done
    server start
    server done

If this hangs, fix dependencies before touching migration code.

## Suggested New Chat Prompt

Use this in the next Codex chat:

    We are continuing the LLM streaming migration in /Users/aligunes/Developer/Recursive_Sensei_Mobile_Fresh. First read AGENTS.md, then read docs/execplans/module_intro_main_sensei_streaming_core_bff_migration_execplan.md, then follow the repo protocols to begin implementing the ExecPlan. Do not use the old /Users/aligunes/Documents/Recursive_Sensei_Mobile checkout.

## Final State Of Prior Session

No implementation code for the migration was completed in the fresh repo.

Created in fresh repo:

- `docs/execplans/module_intro_main_sensei_streaming_core_bff_migration_execplan.md`
- this handoff document

The next session should treat the ExecPlan as canonical, run fresh analysis in the new checkout, update the ExecPlan if fresh analysis changes anything, and then proceed milestone by milestone.

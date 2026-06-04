# Server-Owned Curriculum Post-Phase-1 Extension

This document records the intended curriculum-content ownership extension after the Mobile LLM Proxy Phase 1 migration completes. It is not part of Phase 1 and must not be used to expand the active Phase 1 LLM migration scope.

Phase 1 remains limited to server-owned mobile LLM execution, prompt ownership, Core capability routing, BFF endpoints, mobile bridge transport, and parity validation for the LLM-facing capabilities listed in `docs/functional_spec/mobile_llm_proxy_phase1_master_plan.md`.

## Intent

Immediately after Phase 1 completes, the project should evaluate moving curriculum content ownership from the shipped mobile bundle to the server. The motivation is the same product-control concern that drives server-owned prompts: curriculum content changes should be deployable server side without requiring already-installed mobile apps to update.

If `Modules.txt` remains only in the app bundle, the product has limited control over curriculum corrections, sequencing changes, and subject-pack updates after release.

## Recommended Approach

The preferred approach is not to send the entire `Modules.txt` file to every client by default and not to parse raw `Modules.txt` on every BFF request.

Instead, the server should own a versioned curriculum source, parse it into structured curriculum data at build time, deploy time, or BFF startup, and serve cached structured slices. The normal server-owned path should not require mobile/WebView to parse raw `Modules.txt`. The canonical raw-text parsing responsibility should move to a server-capable shared curriculum module or server-side curriculum package so the server owns both the curriculum source and the interpretation of that source.

Mobile should first request a lightweight curriculum catalog containing module IDs, titles, summaries, and version metadata. After the user selects a module, mobile should request only that selected module's structured content.

The WebView can then hydrate its existing curriculum/module-flow state from that structured module payload while continuing to own UI rendering, transcript behavior, learner state application, and local teaching orchestration.

## Server-Side Workflow

The recommended workflow is:

1. Store raw `Modules.txt` or its successor authoring format as the server-owned curriculum source.
2. Parse the raw source into a structured `Curriculum` object with modules, summaries, goals, concepts, methodology, Socratic content, and Solidify content.
3. Validate the parsed curriculum before publishing, including required sections, module IDs, module titles, concepts, and duplicate or malformed entries.
4. Publish a versioned structured curriculum snapshot with checksums or equivalent content identifiers.
5. Serve a lightweight catalog endpoint for module discovery.
6. Serve selected-module structured payloads on demand.
7. Cache parsed curriculum snapshots so BFF does not scan or parse raw `Modules.txt` on every user request.

BFF should serve structured catalog and module payloads. It should not become the long-term owner of ad hoc raw-text parsing logic inside route handlers. The parser should be extracted from the current WebView implementation into a shared pure module or server-side curriculum package, then used by the server publish/startup path.

## Published Snapshot Definition

A published curriculum snapshot is the validated, structured server artifact produced from raw `Modules.txt` or its successor authoring format. Publishing a snapshot means:

1. Parse the raw source.
2. Validate the parsed curriculum.
3. Assign a `curriculumId`, `curriculumVersion`, and checksum or equivalent content identifier.
4. Write or store the structured curriculum artifact.
5. Mark that artifact as the current server-served curriculum version for new sessions.

The published snapshot should be structured data, not an unprocessed raw text file. A simple first artifact can be a JSON file containing the full curriculum plus metadata, with derived catalog and module slices either generated ahead of time or computed from the in-memory structured object.

Example artifact shape:

```json
{
  "curriculumId": "c++_recursive_mastery",
  "curriculumVersion": "2026-06-04.1",
  "checksum": "sha256:...",
  "modules": []
}
```

The published snapshot can live in different places depending on operational maturity:

| Location | Appropriate Use |
| --- | --- |
| Repository-generated JSON artifact | Simplest first implementation; generated during build or release. |
| BFF package/container artifact | BFF loads the structured curriculum file on startup. |
| Object storage such as S3, R2, or GCS | Production-friendly versioned artifacts and rollback. |
| Database | Useful after an authoring/publishing product exists. |
| CDN-backed JSON files | Useful when catalogs and selected-module payloads should be edge cached. |

The recommended initial implementation is a repository or build-generated structured JSON artifact loaded by BFF on startup. Object storage, database publishing, or CDN distribution can come later if curriculum authoring, rollout, or scale requirements justify them.

## Initial Caching Model

Initial caching should keep the implementation simple and avoid repeated raw parsing.

At build, deploy, or BFF startup, the server should parse and validate the authoritative curriculum source once, then keep the structured snapshot available for request handling. The initial BFF implementation should keep this simple: load the current structured JSON snapshot once at startup, keep the parsed object in memory, and read catalog or selected-module data from that object during requests.

Lookup maps such as `moduleId -> module` or `curriculumVersion -> curriculum` are optional implementation optimizations, not a required architecture layer. They can be added later if module lookup performance, multiple active versions, or version routing requires them. The first implementation can simply search the loaded `modules` array for the selected `moduleId`.

Request handling should read from the loaded structured snapshot:

1. Catalog requests return module IDs, titles, summaries, and version metadata from the in-memory snapshot.
2. Selected-module requests return one structured module payload from the loaded snapshot, using a simple array search initially.
3. BFF should not parse raw `Modules.txt` during ordinary catalog or selected-module HTTP requests.

The first production cache policy can be:

1. Keep the current published snapshot loaded in BFF memory.
2. Optionally keep the previous published snapshot loaded or available for active sessions pinned to the prior version.
3. Let clients cache catalog and module payloads by `curriculumVersion`, ETag, checksum, or equivalent metadata.
4. Use the bundled curriculum only as a seed or emergency fallback, not as the authoritative source after this extension ships.

Longer-term caching can add CDN response caching, object-storage artifact caching, active-session version pinning, and retention windows for current-plus-previous curriculum versions.

## Mobile Hydration Workflow

In the normal server-owned path, mobile should consume structured curriculum payloads rather than raw `Modules.txt`.

The WebView should hydrate its existing curriculum and module-flow state from server-returned structured data, then continue to own module selection UI, phase/concept flow state, transcript behavior, learner-state application, notepad context, and local rendering.

The bundled `Modules.txt` parser may remain temporarily for development, fallback, tests, or emergency seed behavior, but it should not be the authoritative production path after this extension ships.

## Package And Entitlement-Aware Catalog

Today the app displays the startup module list by parsing bundled `Modules.txt`, building a static Sensei bubble that contains `**Available Modules:**`, and rendering every parsed module as a clickable module button. After curriculum ownership moves server-side, that startup bubble should no longer be built from all modules in a bundled file.

The server-owned curriculum model should support package-level access. A package is a named purchasable grouping of module IDs, such as a foundations package containing Modules 1 through 5, an advanced package containing Modules 7 through 9, or a subject-specific package containing a different curated module selection. Package definitions and user entitlements should live server-side so the mobile app does not decide which paid modules a user can access.

The startup flow should become entitlement-aware:

1. Mobile identifies the user or session to BFF.
2. BFF reads package definitions and the user's purchased entitlements.
3. BFF returns an accessible curriculum catalog containing only modules the user can select, plus optional locked package metadata if the product wants an upsell or store surface.
4. WebView renders the Sensei startup module-selection bubble from that accessible catalog instead of from all raw curriculum modules.
5. When the user selects a module, mobile requests that selected module's structured content.
6. BFF checks entitlement before returning the module payload.

The catalog endpoint should be lightweight and should not send full module content. It should return display and access metadata such as package ID, package title, module ID, module title, summary, access state, curriculum version, and optional purchase/product metadata.

Example catalog shape:

```json
{
  "curriculumId": "c++_recursive_mastery",
  "curriculumVersion": "2026-06-04.1",
  "packages": [
    {
      "packageId": "recursion_foundations_pack",
      "title": "Recursion Foundations",
      "purchased": true,
      "modules": [
        { "id": "Module1", "title": "Module title" },
        { "id": "Module2", "title": "Module title" }
      ]
    },
    {
      "packageId": "advanced_recursion_pack",
      "title": "Advanced Recursion",
      "purchased": false,
      "modules": [
        { "id": "Module7", "title": "Module title", "locked": true }
      ]
    }
  ]
}
```

For the first implementation, the learning UI can show only purchased modules as selectable. Locked package metadata should be returned only if the product has a clear store or upsell surface. Longer term, the current markdown-triggered `**Available Modules:**` rendering can be replaced with a structured module-selection payload so module buttons are rendered from catalog data directly rather than parsed from message text.

## User Entitlement Storage

Package definitions and user purchase ownership should be stored differently.

Package definitions can start as server-side JSON or config because they are product metadata: package ID, title, curriculum ID, module IDs, status, and purchase product ID. This data changes through releases or admin tooling and does not require per-user writes during normal use.

User-to-package ownership should not be stored in a static JSON file except for local development fixtures. Purchases are user-specific, mutable, security-sensitive, and may need refunds, revocations, expiration, audit history, and concurrent updates. The initial production-minded approach should store user entitlements in a server-side database.

Recommended initial data model:

```text
users
  id
  externalAuthId
  createdAt

packages
  id
  curriculumId
  title
  status
  productId

user_entitlements
  id
  userId
  packageId
  source
  status
  purchasedAt
  expiresAt
  providerTransactionId
  createdAt
  updatedAt
```

BFF should resolve the current user, query active entitlements, combine those entitlements with package definitions, and return only accessible modules in the startup catalog. BFF should also check entitlement again before returning selected-module content.

The mobile app must not be the authority for purchase state. For App Store purchases, the app can send the signed transaction or receipt to BFF, but BFF should verify it with Apple before writing or updating an active entitlement. The stored entitlement row is the server's current access state; the provider transaction or receipt is the proof used to create or renew it.

For an early implementation before full payment integration, development or staging environments can seed entitlement rows manually for test users. That is acceptable for building catalog filtering and module access checks, but production access should move to provider-verified entitlement rows before paid packages launch.

## Core Open Questions Before Implementation

Before implementing this extension, answer these core questions:

1. What is the initial user identity model: anonymous device identity, Sign in with Apple, email account, or another account system?
2. Will purchases and progress need to restore across multiple devices?
3. Are curriculum packages one-time purchases, subscriptions, trials, bundles, or a mix?
4. What payment provider is authoritative for the first release, and how will BFF verify purchase transactions before granting entitlements?
5. Should the startup catalog show only purchased modules, or should it also show locked package/module previews for a store or upsell surface?
6. Can one module belong to multiple packages, and can package contents change after a user purchases a package?
7. When a user starts or resumes a module, should the session stay pinned to the curriculum version it started with?
8. How long should old curriculum snapshots remain available for active sessions, saved sessions, rollback, and support/debugging?
9. Where should learner progress live initially: local only, server synced, or hybrid?
10. Should selected module content be cached locally for offline use, and what should happen when the server has a newer module version?

## Long-Term Target

The long-term target is for migrated LLM routes to accept compact structured identifiers such as `curriculumId`, `curriculumVersion`, `moduleId`, `phase`, and optional `conceptId`, rather than trusting large curriculum text assembled on the device.

BFF/Core can then reconstruct LLM-facing curriculum context from the server-owned curriculum store and Core prompt builders. This gives server-side control over both prompt text and curriculum content while keeping Phase 1's boundary intact: WebView applies UI and teaching-state side effects, while BFF/Core own server-controlled LLM inputs and execution.

## Future Work

Future work for this extension should define:

1. Caching and offline fallback.
2. Version pinning.
3. ETag or checksum validation.
4. Catalog and selected-module endpoint contracts.
5. Migration from raw `Modules.txt` parsing to structured curriculum payload hydration.
6. Release behavior when a cached module version differs from the current server version.
7. Extraction or relocation of the canonical `Modules.txt` parser into a server-capable shared curriculum module.
8. Server-side curriculum validation and publish checks.
9. Package definitions, user entitlement checks, and purchase-aware catalog filtering.
10. Replacement of markdown-derived module buttons with structured catalog-driven module-selection UI.
11. Database-backed entitlement storage and provider receipt or transaction verification before granting package access.

The bundled `Modules.txt` may remain as a seed or emergency fallback, but after this extension ships it should not be the authoritative mobile curriculum source.

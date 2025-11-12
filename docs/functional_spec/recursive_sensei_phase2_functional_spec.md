# Recursive Sensei – Functional Specification (Phase 2: Identity, Persistence, Optimization)

Version: 0.4 (Draft)
Date: 2025-11-12
Owner: Product + Engineering

## 1. Purpose & Scope
- Introduce user identity, secure authentication, and topic entitlements.
- Add server‑side persistence (per‑user, per‑topic sessions) with cross‑device resume and cloud export/import.
- Consolidate deferred items from Phase 1: topic catalog, privacy/compliance, notifications, accessibility audit, Android, and performance targets.
 - Formalize the authentication model deferred from Phase 1: all endpoints require JWT‑based auth; clients obtain/refresh tokens via login and refresh flows.

## 1.1 Code Reuse & Packaging Policy (Phase 2)
- Preserve the Phase 1 rule: all shared logic (pedagogy, curriculum state, instruction builders, wrap‑up validation) lives in Sensei Core and is consumed by both BFF and clients.
- Any new capabilities added in Phase 2 (auth flows, server‑side persistence orchestration, topic catalog derivations) should expose pure functions or service APIs so the web app can adopt them without duplication.
- Maintain parity tests to detect divergence between web and mobile clients for golden input cases.

## 1.2 Backend Workflow Conventions (Phase 2)
- Auth required on all endpoints (JWT in headers; WS query param/token). Entitlements checked per topic.
- Idempotency keys:
  - `clientTurnId` on POST /sessions/{id}/turns; duplicates are safe and return the original turn result.
  - `clientSavepointId` on POST /sessions/{id}/savepoints to avoid duplicates.
- State versioning:
  - `sessionVersion` increments on each successful turn; optimistic locking on updates.
  - Conflicts return 409 with server version; clients refetch and retry.
- Streaming lifecycle identical to Phase 1; now authenticated. Keepalive ≤15s.
- Limits and rate limits are enforced per user (TBD thresholds) and per IP.
- Logging & privacy: structured logs; redact user PII; configurable payload truncation; correlate with request IDs.

## 1.3 Parity Test Suite (Comprehensive)
- Define golden tests per feature to guarantee mobile/web parity:
  - Core turn streaming (normal, long input, error)
  - Reload message
  - Selection Sensei actions (all variants)
  - Standard Enhance and Key Takeaway (flag on)
  - Mermaid (render success/failure → recovery)
  - Wrap‑up (question generation, client scoring)
  - Save/Load (server‑side persists in Phase 2)
- Each golden test asserts identical instruction payloads, teaching‑plan outputs, and post‑turn state deltas across clients.

## 2. Functional Requirements
### 2.1 Authentication & Identity
- FR‑AUTH‑1: Login screen with email/password (no in‑app sign‑up; accounts pre‑provisioned).
- FR‑AUTH‑2: Token model: short‑lived Access Token and long‑lived Refresh Token stored in iOS Keychain.
- FR‑AUTH‑3: Auto‑refresh: when access token is expired/near expiry or a request returns 401, the app calls POST /auth/refresh once, updates tokens, and retries the original request once.
- FR‑AUTH‑4: Token lifetimes: Access Token 15 minutes; Refresh Token 14 days (server‑revocable). Support refresh‑token rotation on each refresh.
- FR‑AUTH‑5: Single in‑flight refresh per app instance to prevent thundering herds; queued requests await refresh completion.
- FR‑AUTH‑6: Logout clears tokens; server invalidates refresh token.
- FR‑AUTH‑7: Role set: Learner only (admin/debug remains web‑only behind separate controls).

### 2.2 Topic Catalog & Entitlements
- FR‑TOPIC‑1: GET /topics lists entitled topics; supports search and categories (optional).
- FR‑TOPIC‑2: Entitlements enforce per‑topic access on the server (BFF).

### 2.3 Server‑Side Persistence
- FR‑PERSIST‑1: Creating or resuming a session stores/loads state from Postgres.
- FR‑PERSIST‑2: Exactly one active session per topic per user; server enforces via unique index.
- FR‑PERSIST‑3: Conversation turns appended to conversation_turns; periodic snapshots to learner_state.
- FR‑PERSIST‑4: Cloud export/import: users can export a save bundle to blob storage and import from a signed URL.
- FR‑PERSIST‑5: Cross‑device resume: GET /sessions lists resumable sessions.

### 2.4 Teaching Loop (Parity + Enhancements)
- FR‑LOOP‑1: Same streaming WS endpoint; now requires JWT. Allow mid‑stream cancel/reload (optional) if parity demands.
- FR‑LOOP‑2: Wrap‑up scoring remains client‑side; server records results summary in the session for analytics.

### 2.5 Accessibility (Audit)
- FR‑ACC‑1: Achieve WCAG 2.1 AA‑equivalent behaviors on iOS: VoiceOver labels, focus order, Dynamic Type, sufficient contrast, accessible hit areas.

### 2.6 Privacy & Compliance
- FR‑PRIV‑1: Set default data retention (e.g., 12 months) for conversation/analytics; allow server‑side purge.
- FR‑PRIV‑2: Document GDPR/COPPA/FERPA applicability and data flows; ensure LLM inputs exclude PII per policy.
- FR‑PRIV‑3: Analytics/telemetry opt‑in/out toggle.

### 2.7 Notifications
- FR‑NOTIF‑1: Optional push notifications (resume session reminders). Requires user opt‑in.

### 2.8 Android Client
- FR‑AND‑1: Deliver Android app with feature parity; define min SDK (recommend 24+). Reuse RN codebase with platform adaptors.

## 3. Non‑Functional Requirements
- NFR‑SEC‑1: All endpoints require JWT; BFF verifies entitlements per request.
- NFR‑SEC‑2: Refresh token rotation, revocation, and brute‑force throttling.
- NFR‑PERF‑1: Performance targets: first chunk ≤ 1.5s p50 Wi‑Fi (≤ 2.5s cellular); turn completion ≤ 5s p50.
- NFR‑PERF‑2: Concurrency: BFF must serve at least N concurrent streams (TBD) with horizontal scaling.
- NFR‑REL‑1: Introduce Redis cache for hot sessions; optional message queue for telemetry.
- NFR‑OBS‑1: Metrics/tracing for BFF and LLM proxy; crash reporting on mobile and web.

## 4. Interfaces
### 4.1 Auth REST
- POST /auth/login → { accessToken, refreshToken, expiresIn }
- POST /auth/refresh → { accessToken, refreshToken?, expiresIn } (rotation supported)
- POST /auth/logout → 204

### 4.2 Topics & Sessions REST
- GET /topics → { topics: [...] }
- POST /sessions → { sessionId, state }
- GET /sessions → [ session summaries ]
- GET /sessions/{id} → { state, historyMeta }
- POST /sessions/{id}/turns → { turnId, streamUrl }
- POST /sessions/{id}/savepoints → { savepointId }
- POST /sessions/{id}/export → { downloadUrl }
- POST /sessions/{id}/import → 204

### 4.3 WebSocket
- wss:///sessions/{id}/stream?turnId=… (JWT required)
- client→server control: cancel/reload (optional)

## 5. Data & Schema
- As defined in Phase 1, now persisted per user. Add users, topic_access tables; ensure unique (user_id, topic_id, active=true) for sessions.

## 6. Acceptance Criteria (Samples)
- AC‑AUTH‑1: Valid credentials return tokens; auto‑refresh renews access tokens seamlessly; failure logs out.
- AC‑PERSIST‑1: User resumes a session on another device and sees identical state.
- AC‑ACC‑1: VoiceOver reads key UI elements; Dynamic Type scales fonts without layout breakage.
- AC‑PRIV‑1: Retention policies applied; export/delete data on request.
- AC‑PERF‑1: Meets latency targets at agreed concurrency.

## 7. Phase 2 Deliverables
- Auth & entitlements (JWT/refresh with rotation)
- Server‑side persistence + cloud export/import
- WCAG 2.1 AA audit pass for core flows
- Performance hardening + basic telemetry pipeline
- Android client with parity (if included in Phase 2 scope)

## 8. Notes
- Token lifetimes and the single‑retry rule are normative: refresh once, then retry original request once; further failures logout.
- Wrap‑up scoring remains client‑side for responsiveness; server stores result summary only.

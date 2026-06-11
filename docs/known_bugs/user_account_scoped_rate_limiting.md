# User-Account Scoped Rate Limiting For Provider-Backed BFF Routes

## Status

Open post-PR follow-up. Documented during Selection Sensei modal LLM migration PR review remediation on 2026-06-06.

## Summary

Current provider-backed mobile BFF routes rely on request-origin and session-shaped limiter keys, such as IP, User-Agent, or `sessionId::ip::userAgent`. This is useful as a near-term protection layer, but it is not the durable product-level quota boundary.

The long-term rate limiter should be scoped to a stable learner or user account identity when one is available. IP-based limits can punish unrelated learners behind the same school Wi-Fi, office network, VPN, carrier NAT, home network, or browser profile. Session-based limits avoid that cross-session bleed when `sessionId` is included, but they can be bypassed by creating new sessions.

## Current Behavior

Main turn and LLM stream routes currently use generic IP/User-Agent rate limiting.

Provider-backed route patterns such as wrap-up, teaching plan, and analysis use `sessionId::ip::userAgent` keys. That pattern isolates active app sessions while still binding the limiter to request-origin metadata.

Selection Sensei should match the provider-backed route pattern for the current PR remediation: `sessionId::ip::userAgent`. That is a compatibility and parity fix, not the final user-account rate-limit design.

## Why This Matters

One learner should not consume another learner's quota simply because they share a public IP address or network path.

One learner also should not be able to bypass expensive-provider limits by repeatedly creating fresh app sessions.

Multi-turn learning flows need enough burst allowance for normal conversation. An initial answer followed by immediate clarifying questions should not be treated like abusive traffic, but repeated high-volume provider calls still need protection.

## Desired Future Behavior

Add an authenticated or otherwise stable user-account identity to BFF request context.

Use that identity as the primary quota key for expensive provider-backed calls.

Keep session identity as a fallback only when account identity is unavailable.

Keep IP/User-Agent as secondary abuse-control metadata, such as a broader origin-level cap, rather than the primary learner quota boundary.

## Acceptance Criteria For A Future Fix

- Provider-backed BFF routes use a stable user/account key when available.
- Session-scoped keys remain a fallback only when user/account identity is unavailable.
- IP/User-Agent limiting is retained only as secondary origin-level abuse protection.
- Two users behind the same IP/User-Agent do not share the primary quota.
- One user across multiple sessions shares the primary quota.
- Burst limits still allow normal immediate follow-up turns.
- Over-limit responses remain structured `429 RATE_LIMITED` errors with `Retry-After`.
- Rate-limit errors do not echo selected text, questions, prompt text, provider raw output, or other learner content.

## Related Follow-Up

The immediate Selection Sensei PR remediation should restore session-scoped limiter parity for the modal route. This known bug tracks the broader account-aware limiter design and should not change route behavior by itself.

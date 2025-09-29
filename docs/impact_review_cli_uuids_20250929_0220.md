# Impact Analysis — Review CLI UUIDs

Date: 2025-09-29 02:20 UTC
Protocol: COMPREHENSIVE IMPACT ANALYSIS PROTOCOL

1) Change Classification & Risk
- Type: Interface + State (HTML artifact structure + CLI interface)
- Risk: 2/5 — localized to generator and new CLI; no runtime app impact
- Evidence: Analyzer shows generator isolated; no imports into app runtime

2) Multi‑Dimensional Impact (1–10)
- Technical: 4 — Adds attributes and header text; DOM parsing in CLI
- Business: 6 — Reduces friction for reviews
- Security: 3 — Raw HTML allowed in remarks; limited to local artifacts
- Operational: 3 — No deploy/runtime changes; only developer workflow
- Maintenance: 5 — Code paths are straightforward; documented commands

3) Stakeholder Cascade
- Direct consumers: devs running `review:create` / `review:edit`
- System integrators: none (no network/db)
- End users: none
- Operations: none; artifacts are static files in repo

4) Temporal Ripple
- Immediate: TS compile should pass; filesystem I/O only
- Short‑term: Easier concurrent reviews; potential merge conflicts limited to HTML artifacts
- Medium/Long: Stable IDs improve traceability across regenerations

5) Validation Plan
- Generate a new artifact; confirm uuids in headers and data attributes
- `review:edit list-uuid` prints uuids in top‑down order + example command
- `review:edit show-diff --uuid <id>` prints label + @@ header + diff body
- `review:edit remark --uuid <id> --body "text"` replaces `.review-notes` inner HTML preserving `<h4>`
- Error cases: missing file, legacy artifact (no data-uuid), invalid uuid

6) Monitoring
- Manual verification via commands above; no runtime monitoring required


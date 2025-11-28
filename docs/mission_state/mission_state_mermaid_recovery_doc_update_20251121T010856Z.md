## Mission State – mermaid recovery doc update – 2025-11-21

- Reintroduced graph directive normalization (`ensureGraphDirective`) into core mermaid recovery and BFF service to match prior deterministic behavior.
- Switched mobile contracts to live in `SenseiMobile/src/mobile/bridge/contracts.ts`; web now re-exports from that file to avoid Metro resolver issues.
- Mobile WebView mermaid recovery retries increased to 3 attempts (1 deterministic, 2 LLM via BFF).
- `attemptMermaidFix` now supports `forceLlm` to bypass heuristic short-circuiting for LLM-only retries; BFF honors `mode` and only runs LLM when requested or heuristics made no changes.
- Rebuilt webview bundle after changes.

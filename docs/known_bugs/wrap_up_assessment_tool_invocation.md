# Known Bugs

## Wrap-up Assessment Tool Invocation With Newer Gemini Models

Status: Open before final release.

Context:

The wrap-up assessment capability still defines `submit_wrap_up_assessment` as a tool-shaped output contract, and Core validates the returned assessment strictly: exactly 15 questions with exactly five snippet questions. During review, the old provider-side fix would have been to force Gemini function/tool invocation with `functionCallingConfig` and `allowedFunctionNames`.

Current decision:

Do not restore forced tool invocation right now. The newer Gemini model currently used by the project no longer supports the previous tool invocation behavior reliably enough for this path. The code should remain as-is for now, using the existing Core fallback parsing and validation behavior.

Release risk:

The model may return free text or malformed tool-like output instead of a structured tool invocation. Core may then fail wrap-up generation, retry, or return no assessment overlay.

Before final release:

1. Re-check current Gemini tool/function-calling support for the selected wrap-up model.
2. Decide whether to restore a supported forced-tool contract, switch wrap-up to strict JSON schema output, or keep fallback parsing with stronger retry/repair behavior.
3. Run at least one live Gemini wrap-up smoke test through the BFF/mobile route.
4. Confirm the result still satisfies Core validation: exactly 15 questions and exactly five snippet questions.

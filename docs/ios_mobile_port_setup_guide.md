Title: iOS Mobile Port — WKWebView-First Adapter (Phase 1) Setup Guide

Context and Narrative (read before you start)
1) This port follows the A1 “WebView‑first adapter” architecture: WKWebView renders the entire chat surface (Sensei and user bubbles, wrap‑up, notepad, Selection Sensei dialog content); React Native (RN) provides the native chrome (header/footer/input), native selection toolbox overlay, save/load pickers, telemetry toggle, lifecycle, and the RN↔WebView bridge.
2) Apple review alignment drove several choices: all HTML/CSS/JS assets load from the app bundle (no arbitrary remote HTML/JS), LLM keys remain server‑side behind BFF REST/WS, navigation is locked down, and settings/file‑pickers are native. This keeps us within App Store rules about remote code and avoids “app as a thin browser” rejection risk.
3) The system is contract‑first: RN↔WebView message types and BFF endpoints are defined under docs/engineering/contracts_v1.md and mirrored in TypeScript types (src/mobile/bridge/contracts.ts). Changes must update contracts before code.
4) Web parity naming is preserved. RN component/function names and bridge events mirror the web code to reduce diff‑cognitive load and increase analyzer cross‑reference quality.
5) Selection behavior is bridged, not simulated. The web sends precise rect + viewport data; RN draws a native overlay with pixel‑accurate positioning and actions, and can invoke Selection Sensei back in the WebView.
6) The Save/Load flow preserves filenames (sensei_progress_<ISO>.json) and schemas; the UI for picking files is native; the serialization happens inside the WebView and round‑trips via bridge.
7) Telemetry is opt‑out with a native toggle, respecting user choice and local storage; no telemetry is sent when disabled.
8) Analyzer‑first guardrail remains mandatory: every code change is followed by npm run analysis:run and a check of tmp/analysis/functions.json and calls.json for new/changed edges.
9) Parity sentinels cover the riskiest flows (streaming diff, selection alignment, wrap‑up snapshot, Save/Load round‑trip, mermaid recovery, telemetry opt‑out) and must pass before shipping.
10) FDA triad/go‑no‑go checkpoints apply per surface (BridgeManager, MainScreen, SelectionOverlay, WebView hooks, BFF client, Save/Load, Telemetry) to keep eyes‑wide‑open. If any check fails, stop and fix before proceeding.
11) This guide assumes a clean main; never revert changes that aren’t yours and always create backups per project policy.
12) We treat iOS as the first target; Android is similar but differs in asset URIs and file access flags—keep iOS steps pure here.
13) All critical logs include the prefix [MOBILE_PORT] so runtime evidence is easy to grep in logs/console_logs.log.
14) The RN app is a shell; all critical pedagogy and rendering live in the bundled web code, which keeps a single source of truth across platforms.
15) The setup deliberately avoids remote HTML to satisfy Apple’s guideline against downloading executable code; only data flows across the network via BFF.
16) Selection Sensei’s “start/clear/invoke” lifecycle is unified across web and mobile to keep behavior predictable.
17) Bridge throttling (≤10/s) prevents message storms during streams; dispatch is batched and flushed.
18) Failure modes are observable: bridge dispatch errors, WS reconnects, Save/Load failures, and telemetry state transitions all emit structured logs.
19) The mission state is updated at milestones; re‑read your notes before each major step to avoid complacency.
20) This guide cross‑references three design documents that govern this port: functional spec, engineering spec, and contracts v1. Read them fully before coding.

Design Documents
- Functional Spec: docs/functional_spec/recursive_sensei_mobile_phase1_functional_spec.md
- Engineering Spec: docs/engineering/mobile_phase1_engineering_spec.md
- Contracts v1 (REST/WS/Bridge/Schemas): docs/engineering/contracts_v1.md

Prerequisites
- Xcode (latest stable), CocoaPods, Node 18+, Watchman.
- Ruby env for CocoaPods (Gem, Bundler optional).
- iOS simulator installed (iPhone 15 or similar).

Step 1 — Create the React Native Shell (iOS only)
- Run: npx react-native init SenseiMobile --version latest
- cd SenseiMobile
- Open ios/SenseiMobile.xcworkspace in Xcode once to let it index.

Step 2 — Add Required Packages
- WebView: npm i react-native-webview
- Types and tooling: npm i -D typescript @types/react @types/react-native
- (Optional) File system helper if you prefer building file:// URIs programmatically: npm i react-native-fs; npx pod-install

Step 3 — Bring In App Code and Web Assets
- Copy web code from this repo to your RN app under a new folder app_web/ (the built, static bundle the WebView will load). If you already have a build pipeline, export into app_web/webview_dist with index.html at the root.
- Copy mobile adapters from this repo into your RN app under src/mobile (same structure):
  - src/mobile/bridge/*, src/mobile/network/*, src/mobile/saveLoad/*, src/mobile/telemetry/*, src/mobile/MainScreen.tsx, src/mobile/SelectionOverlay.tsx, src/mobile/webviewBridge.ts.
- Ensure contracts/types match docs/engineering/contracts_v1.md.

Step 4 — Xcode Resource Packaging
- In Xcode, select the iOS target → Build Phases → Copy Bundle Resources → add the app_web/webview_dist folder (Create folder references).
- Verify the index.html is located at: <AppBundle>/app_web/webview_dist/index.html.

Step 5 — Wire WebView to Local Assets (precise, copy‑pasteable)
- Preferred: use `react-native-fs` to build a stable `file://` URI to the bundled index.html.
  - import RNFS from 'react-native-fs';
  - const webAssetUri = `file://${RNFS.MainBundlePath}/app_web/webview_dist/index.html`;
  - <WebView source={{ uri: webAssetUri }} originWhitelist={["file://*"]} onMessage={handleWebViewMessage} />
- Alternative (no dependency): if you added app_web as a Folder Reference in “Copy Bundle Resources”, the bundle path is resolved by iOS as a real folder. Build the URI manually using `NSBundle.mainBundlePath` via a tiny native module or use RNFS as above. Avoid placeholder strings—use one of these two concrete approaches.

Step 6 — RN↔WebView Bridge (exact wiring)
- Web side (already in this repo): `src/mobile/webviewBridge.ts` installs listeners and exposes `sendToNative(message)`.
- RN side: create `BridgeManager` with a sender that posts into the WebView.
  - const bridge = new BridgeManager({ sender: msg => webViewRef.current?.postMessage(JSON.stringify(msg)) });
  - <WebView ref={webViewRef} onMessage={handleWebViewMessage} ... />
- Handshake: in `src/index.tsx` web code calls `initializeWebviewBridge(handleReactNativeMessage);` and logs `[MOBILE_PORT] webview bridge` entries when it receives RN messages.

Step 7 — Native Chrome and Overlays (complete action set)
- Keep header/footer/input as RN components and forward user input through:
  - bridge.enqueue({ type: 'chat:startMessage', messageId, sender: 'user', text })
  - runForwardStream(handle, { bridge, telemetryManager, setFooter, setIsStreaming })
- Selection overlay:
  - RN listens for `{ type: 'selection' | 'selection:clear' }` from WebView and renders a toolbox positioned using `rect` and `viewport.scrollY`.
  - Support all actions: “Simpler”, “Analogy”, “Depth”, “Example”, “Code”, “Ask” (with prompt), “Add to Notepad”, plus “Copy” and “Share”.
  - Post back into WebView with `{ type: 'selectionSensei:invoke', actionId, actionLabel?, userQuestion? }`.

Step 8 — Networking (BFF)
- Configure `BffClient` with your `baseUrl` (HTTPS). Do not embed model keys in the app; the BFF holds secrets.
- On submit:
  - const handle = await bffClient.submitTurn({ text, clientTurnId })
  - await runForwardStream(handle, { bridge, telemetryManager, setFooter, setIsStreaming })
- Streaming semantics (fixed):
  - Forward `chunk` as `{ type: 'chat:update' }`.
  - Forward `status` frames to RN footer via `{ type: 'footer:update' }` and only emit `{ type: 'chat:completeMessage' }` when `phase === 'completed'`.
  - Forward wrap‑ups as `{ type: 'wrapup:show' }`.

Step 9 — Save/Load (failure‑aware contract)
- Use `SaveLoadService` with a platform `NativeFileAdapter` (implement using `UIDocumentPickerViewController` or `react-native-document-picker`).
- Export flow:
  - RN → Web: `{ type: 'saveload:export', requestId }`
  - Web → RN: `{ type: 'saveload:exportResult', requestId, success: boolean, json?, error? }`
  - RN must reject and surface errors when `success === false` (do not write empty files).
- Import flow mirrors export with `{ type: 'saveload:import' }` and `{ type: 'saveload:importResult' }`.
- Filename: `sensei_progress_<ISO>.json`.

Step 10 — Telemetry
- `TelemetryManager` persists opt‑out, records device metadata, and flushes on demand. Do not send any events while disabled.

Step 11 — Analyzer and Parity Sentinels
- Run `npm run analysis:run` in this repo (not the RN app) and confirm `src/mobile/*` entries appear in `tmp/analysis/functions.json` and `calls.json`.
- Run tests in this repo: `npm test`. Required green suites: `MobileParitySentinel`, `MainScreen.forwardStream`, `SaveLoadService`, `SelectionOverlayController`, `BridgeManager`, `BffClient`, `TelemetryManager`.

Step 12 — App Capabilities and Info.plist Hardening (copy exactly)
- WKWebView content is local only. Set a strict whitelist:
  - In RN `<WebView originWhitelist={["file://*"]} />` (avoid `*`).
- ATS (App Transport Security): use HTTPS for BFF to avoid exceptions. If you must set an exception, scope it narrowly to the BFF domain.
- Do not permit arbitrary loads. Do not inject remote JS/HTML.

Step 13 — Build and Run
- `npx pod-install` then `npx react-native run-ios --scheme SenseiMobile`.
- In the simulator, validate:
  - Chat streaming renders incrementally and finalizes only on `status:completed`.
  - Footer updates reflect confidence/confusion/intent.
  - Selection overlay aligns with selected text and actions work (Simpler/Analogy/Depth/Example/Code/Ask/Add to Notepad/Copy/Share).
  - Wrap‑up overlay appears.
  - Save/Load round‑trip succeeds; export failure surfaces an error and does not create a file.
  - Telemetry toggle prevents sends when off.

Step 14 — Apple Review Readiness
- No remote HTML/JS; only data via BFF; native settings and file pickers; WKWebView content is bundled; selection overlay is native.
- Document this in your review notes with the three design docs listed above.

Troubleshooting Checklist
- Blank WebView: confirm file:// URI points to index.html under MainBundle; check Copy Bundle Resources.
- Bridge silent: ensure `initializeWebviewBridge()` runs early; in RN, verify `webViewRef.current?.postMessage(JSON.stringify(msg))` is used by `BridgeManager`. Confirm JSON parse in `onMessage`.
- Selection misaligned: verify devicePixelRatio and viewport data forwarded; ensure safe‑area insets are considered when positioning overlay.
- Streaming stalls: check WS URL, SSL, and background task handling.

Appendix — Xcode “Folder Reference” vs “Group”
- When adding `app_web/webview_dist` to Copy Bundle Resources, choose “Create folder references” so the folder is preserved in the bundle. Using “Create groups” flattens files and breaks relative paths.

Appendix — NativeFileAdapter pointers (iOS)
- Export: `UIDocumentPickerViewController` or `UIActivityViewController` for save/share of the JSON string.
- Import: `UIDocumentPickerViewController` with `.import` mode; read the picked file contents into the bridge call.

Evidence/Logs
- All relevant runtime logs carry the prefix [MOBILE_PORT] and are also mirrored into logs/console_logs.log in this repo when running tests.

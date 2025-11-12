Sensei Mobile BFF (Local Dev)

Endpoints
- POST /sessions → { sessionId }
- POST /sessions/{sessionId}/turns → { turnId, streamUrl }
- WS /stream?turnId=… → emits JSON frames:
  - { type: 'status', phase: 'started'|'keepalive'|'completed', footer? }
  - { type: 'chunk', text }
  - { type: 'wrapUp', payload }
- POST /mermaid/recover → { fixed:boolean, fixedCode? }
- POST /telemetry → 204

Run
```bash
cd bff
npm install
npm start
# => [BFF] listening on http://localhost:8787
```

Configure the RN app
- Set `BFF_BASE_URL = 'http://localhost:8787'` in `SenseiMobile/App.tsx`.
- Add a dev-only ATS exception for `localhost` in iOS Info.plist (Exception Domains → localhost → NSExceptionAllowsInsecureHTTPLoads = YES).

Notes
- This BFF is for development. It keeps secrets out of the app and normalizes streaming.
- Replace the dummy streaming in `index.js` with real vendor calls when credentials are available.


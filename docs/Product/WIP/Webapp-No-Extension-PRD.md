# PRD: Web App Frontend (No Companion Extension)

## Overview
Build a first-class web UI for tldw_server that does not require a browser extension or companion capture tool. The web app provides full access to server features (chat, RAG, media, knowledge, notes, flashcards, settings, admin) while replacing extension-only flows with web-friendly alternatives.

## Problem / Opportunity
The extension is powerful but requires install and browser permissions. Many environments cannot install extensions or prefer a standard web app. A web frontend lowers friction and expands reach, but it must work without content scripts, sidepanel, or tab access.

## Current Implementation Notes (Extension)
- UI entry points are extension pages: `src/entries/options/*` and `src/entries/sidepanel/*`, composed in `src/entries/shared/apps.tsx` with `AppShell` from `src/entries/shared/AppShell.tsx`.
- Routing is split by context using `RouteShell` (`src/routes/app-route.tsx`) with `optionRoutes` and `sidepanelRoutes` defined in `src/routes/route-registry.tsx`.
- API calls are routed through `bgRequest/bgStream/bgUpload` in `src/services/background-proxy.ts`. `bgRequest` has a direct-fetch fallback when `browser.runtime` is unavailable, but `bgStream` and `bgUpload` are extension-only today.
- Many UI flows assume `browser.*` APIs for tabs, navigation, notifications, or runtime URLs (see `src/utils/sidepanel.ts`, `src/utils/action.ts`, `src/libs/get-html.ts`, `src/libs/get-screenshot.ts`, `src/hooks/useTabMentions.ts`).
- Storage is a mix of `@plasmohq/storage` and `chrome.storage` (e.g., `src/utils/safe-storage.ts`, `src/hooks/useLocal.tsx`, `src/db/models.ts`).

## Goals
- G1: Provide a web UI that is a full frontend to tldw_server.
- G2: Reuse as much of the existing React UI as possible.
- G3: Replace extension-only capture and sidepanel flows with web-native alternatives.
- G4: Support streaming, auth, and media workflows entirely in the web.
- G5: Make limitations explicit and avoid dead-end UX in web-only mode.

## Non-Goals
- N1: No DOM capture, screenshot capture, or active tab access.
- N2: No sidepanel or context menu integration.
- N3: No extension-specific permissions, badges, or commands.
- N4: No local machine tool execution (agent stays server-hosted).
- N5: No emulation of extension APIs in production (no runtime mocks).

## In Scope (v1)
- Chat and Playground features powered by tldw_server.
- Knowledge, Review, Media, Notes, Flashcards, Prompt Studio, Evaluations.
- Settings (server config, models, TTS/STT, RAG, system).
- Quick Ingest: URL, file upload, paste text.
- Auth: single-user API key and multi-user login.
- Streaming responses over SSE or WebSocket.

## Out of Scope (v1)
- "Add from open tabs" and tab mentions.
- Sidepanel-specific UI or routing.
- Browser notifications, action icons, commands, and alarms.

## Assumptions and Constraints
- tldw_server is reachable from the browser and configured with CORS for the web origin.
- Streaming endpoints are available over SSE and/or WebSocket from the web origin.
- Server-hosted agent features are used (no local/native execution).
- HTTPS is preferred; mixed-content (https web app -> http server) should be treated as an error.

## Browser and Device Compatibility
- Desktop browsers: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Mobile browsers: iOS Safari 14+, Chrome Android 90+
- Responsive breakpoints: mobile (< 768px), tablet (768-1024px), desktop (> 1024px)
- Support mouse, keyboard, and touch input (including drag-and-drop where supported)

## Accessibility Requirements
- WCAG 2.1 Level AA compliance
- Keyboard navigation for all interactive elements
- Screen reader compatibility (NVDA, JAWS, VoiceOver)
- Focus management for modals and dynamic content
- Sufficient color contrast ratios
- Accessible form labels and error messages

## Internationalization (i18n)
- Use existing i18n infrastructure and translation files
- Support multiple UI languages and locale-aware formatting
- RTL layout support where applicable

## User Stories
- As a user, I can log into tldw_server and chat from a normal web page.
- I can ingest content by URL or file without installing anything, and access all server-backed features in one web UI.
- I understand the limitations for logged-in or dynamic pages when using URL ingestion.

## Experience and UX
- App shell uses top-level navigation instead of sidepanel.
- Chat view is the primary landing page after login.
- Quick Ingest offers three sources only:
  - URL (server fetch)
  - File upload
  - Paste text
- Show a clear notice for URL ingestion:
  - Logged-in pages and dynamic content may not be accessible.
- Hide or disable extension-only actions and hints.
- Replace "open options" links with in-app navigation.
- Provide a dedicated limitations banner the first time a user attempts URL ingest.

## Feature Parity Changes
- Removed:
  - Tab mentions and "Add from open tabs" flows (`useTabMentions`, context tabs UI).
  - Context menu actions (summarize/translate/send to tldw).
  - Sidepanel-only routes and UI affordances.
- Replaced:
  - Notifications -> in-app toasts; optional Web Notifications on demand.
  - Extension TTS (`chrome.tts`) -> Web Speech API + server TTS.
  - Quick ingest background batching -> direct web calls to server.

## Functional Requirements
- FR1: BrowserRouter-based routing for web.
- FR2: Direct API calls to tldw_server with CORS support.
- FR3: Streaming chat and RAG responses in web.
- FR4: STT streaming via direct WebSocket to server (no extension port).
- FR5: TTS via Web Speech API and/or server TTS endpoints.
- FR6: Local persistence for UI settings and drafts without chrome.storage.
- FR7: Server URL configuration UI that supports multi-tenant switching.
- FR8: Graceful offline and misconfiguration states with actionable guidance.
- FR9: Safe fallbacks to non-streaming responses if streaming fails.

## Technical Requirements
- Build target: Vite web build with a dedicated entry (no WXT).
- Storage adapter to replace @plasmohq/storage and chrome.storage:
  - localStorage for small settings
  - IndexedDB (Dexie) for larger caches if needed
- Replace background proxy streaming and upload with direct SSE/WebSocket and fetch clients.
- Replace extension-only URL helpers (browser.runtime.getURL, tabs) with web equivalents.
- Provide a consistent base URL configuration for tldw_server.
- Ensure i18n loading via `src/i18n/index.ts` works in web build.

## Configuration and Auth
- Reuse `tldwConfig` shape from `src/services/tldw/TldwApiClient.ts` (serverUrl, authMode, accessToken, refreshToken, apiKey).
- Support multi-tenant server switching by scoping cached data to base URL.
- Default auth mode: token-based for web unless server provides cookie sessions.
- Detect auth mode via a server capabilities/config endpoint and honor explicit auth mode responses.

## Streaming and Upload
- Chat and RAG streaming should work without extension ports (SSE over fetch or WebSocket).
- Upload flows should post `multipart/form-data` directly to server endpoints.
- If streaming is unavailable, fall back to non-streaming requests with explicit UX notice.
- Authentication for streaming:
  - SSE: include auth headers or rely on cookie sessions.
  - WebSocket: send access token in the handshake query or initial auth message; re-auth on reconnect.

## Capture Alternatives (No Extension)
- URL ingestion: server fetch and parse (best-effort).
- File upload: upload original files or HTML exports.
- Paste text: manual paste or clipboard import.

## Data and Storage
- Server remains the source of truth for chats, media, and knowledge.
- Web app stores local UI state only (drafts, preferences, cached lists).
- Avoid long-term local storage of secrets; prefer session tokens with refresh flow.

## Security
- Enforce CORS policy on tldw_server.
- Use token-based auth or session cookies.
- Avoid storing secrets in logs or query strings.
- Prefer HTTP-only cookies for web auth if available; otherwise short-lived access tokens.
- Content Security Policy (CSP): define strict CSP headers to mitigate XSS risks.
- CSRF protection for state-changing requests when using cookie auth.
- Session management:
  - Access token: 15-minute expiry, stored in memory only.
  - Refresh token: stored in httpOnly cookie or secure storage if cookies are unavailable.
  - Idle timeout: 30 minutes, with logout and redirect to login.
  - Explicit logout: clear tokens and invalidate server session.
- Rate limiting: respect server limits; add client-side throttling for expensive operations.
- Error messages: avoid leaking sensitive information in error responses.

## Success Metrics
- >= 80% of extension feature usage is available in web UI.
- >= 95% streaming requests succeed without fallback.
- Median time-to-first-response within 20% of extension baseline.
- Metrics are collected via client-side telemetry and server logs (see Observability and Monitoring).

## Observability and Monitoring
- Error tracking: capture client-side exceptions and API failures (e.g., Sentry).
- Performance monitoring: track time-to-first-byte, time-to-interactive, and streaming latency.
- Analytics: measure usage and success/error rates for auth, ingest, chat, and streaming.
- Logging: structured client-side logs with levels (error, warn, info, debug).
- Success metrics measurement:
  - Feature availability: automated tests plus feature flag telemetry.
  - Streaming success rate: track initiation success and fallback usage.
  - Response time: p50/p95/p99 via the Performance API.

## Rollout Plan
- Phase 1: Auth, chat, settings, basic ingest.
- Phase 2: Knowledge, media review, prompt studio, evaluations.
- Phase 3: Parity polish and deprecation of extension-only UI paths in web.
- Timeline (rough): Phase 1 = 4 weeks, Phase 2 = 6 weeks, Phase 3 = 4 weeks.
- Feature flags: gate web entry, streaming, and ingest; allow gradual enablement.
- Beta/preview: internal dogfood, then a limited external preview cohort.
- Rollback plan: disable web entry via flags and fall back to extension-only routing.
- Exit criteria: tests pass, no P1 bugs, and success metrics meet thresholds for the phase.

## Implementation Workstreams (Draft)
- Routing and app shell: add a web entry, use BrowserRouter, reuse `RouteShell` with options routes.
- API transport: add web streaming client (SSE/WebSocket) to replace `bgStream`/`bgUpload`.
- Storage abstraction: swap `@plasmohq/storage` usage for web adapters in UI and settings.
- UX cleanup: remove extension-only UI and help text; update Quick Ingest flows.
- Auth and config: update onboarding for server URL + auth in web context.

## Migration Checklist (File Mapping)
| Current file/area | Web treatment | Notes |
| --- | --- | --- |
| `src/entries/options/*` | Reuse as web entry | Serve as main web app routes. |
| `src/entries/sidepanel/*` | Exclude from web build | No sidepanel in web mode. |
| `src/entries/shared/apps.tsx` | Add `WebApp` wrapper | Use BrowserRouter and options routes only. |
| `src/routes/route-registry.tsx` | Filter to options routes | Hide sidepanel routes and nav items. |
| `src/routes/app-route.tsx` | Web-only shell | Use options fallback text and error boundary only. |
| `src/services/background-proxy.ts` | Add web streaming/upload path | `bgRequest` already falls back to fetch; `bgStream`/`bgUpload` need web implementations. |
| `src/entries/background.ts` | No web equivalent | Extension-only background tasks. |
| `src/entries/shared/background-init.ts` | No web equivalent | Context menus, alarms, model warmup. |
| `src/utils/sidepanel.ts` | Remove/replace | Replace with in-app navigation. |
| `src/utils/action.ts` | Remove/replace | No browser action/badge in web. |
| `src/libs/get-html.ts` | Replace with URL ingest | Server-side fetch or paste/upload flow. |
| `src/libs/get-tab-contents.ts` | Replace with URL ingest | Remove tab references. |
| `src/libs/get-screenshot.ts` | Replace with file upload | Optional drag/drop image. |
| `src/parser/google-docs.ts` | Replace with upload | Use exported docs or paste. |
| `src/entries/hf-pull.content.ts` | Drop or server-side variant | No content scripts in web. |
| `src/hooks/useTabMentions.ts` | Remove | Replace with manual attachment flow. |
| `src/hooks/useBackgroundMessage.tsx` | Remove | No background runtime channel. |
| `src/hooks/useTldwStt.ts` | Replace transport | Direct WS to server instead of runtime port. |
| `src/services/native/native-client.ts` | Swap to server agent APIs | No native messaging in web. |
| `src/utils/safe-storage.ts` | Replace storage adapter | Web storage (localStorage/IndexedDB). |
| `src/db/models.ts` and `src/db/index.ts` | Replace chrome.storage usage | Use IndexedDB or server-backed models. |
| `src/services/tldw-server.ts` | Ensure web storage for base URL | Remove dependency on extension storage. |
| Components using `browser.runtime.getURL` | Replace with router links | Audit `src/components/**` and update. |

## Phased Implementation Plan (Detailed)

### Phase 0: Web Build Scaffolding
- `package.json`: add `dev:web`, `build:web`, and `preview:web` scripts (Vite web build).
- `vite.web.config.ts` (new): configure a web-only Vite entry without WXT.
- `src/entries/shared/apps.tsx`: add `WebApp` wrapper that uses BrowserRouter and options routes only.
- `src/routes/route-registry.tsx`: export an options-only route list for web (`webRoutes` or filter helper).
- `src/routes/app-route.tsx`: add a web shell variant (options error boundary only, options fallbacks).

### Phase 1: Core Web Transport, Auth, and Storage
- `src/services/background-proxy.ts`: implement direct web fallbacks for `bgStream` (SSE/WS) and `bgUpload` (FormData fetch). Keep `bgRequest` direct fetch path.
- `src/hooks/useTldwStt.ts`: replace `chrome.runtime.connect` with direct WebSocket to `/api/v1/audio/stream/transcribe`.
- `src/services/tldw/TldwAuth.ts`: confirm refresh flow for token auth in web; avoid extension-only storage.
- `src/utils/safe-storage.ts`: add a web storage adapter (localStorage/IndexedDB) and swap extension storage in web build.
- `src/services/tldw-server.ts`: scope `tldwServerUrl` by tenant and use web storage adapter.
- `src/services/tts.ts` and `src/hooks/useTTS.tsx`: prefer Web Speech API or server TTS in web.

### Phase 2: Web UI Parity (Chat + Ingest + Navigation)
- `src/components/Common/QuickIngestModal.tsx`: remove runtime message bus (`tldw:quick-ingest-batch` and progress events); call server endpoints directly.
- `src/components/Sidepanel/*`: exclude from web build to avoid sidepanel-only routes and UI.
- `src/components/Common/ServerConnectionCard.tsx`: replace `browser.runtime.getURL` and `browser.tabs.create` with router navigation.
- `src/components/Sidepanel/Chat/empty.tsx` and `src/components/Sidepanel/Chat/ControlRow.tsx`: remove or gate extension navigation.
- `src/hooks/useTabMentions.ts`: disable in web; provide manual URL/file attachment UI instead.
- `src/components/Knowledge/ContextTab/AttachedTabs.tsx` and `src/components/Option/Playground/MentionsDropdown.tsx`: hide \"open tabs\" affordances in web.

### Phase 3: Data Layer Cleanup
- `src/db/models.ts` and `src/db/index.ts`: replace `chrome.storage` usage with IndexedDB or server-backed lookups.
- `src/db/dexie/*`: keep Dexie for local caches only; remove extension-only migration paths.
- `src/hooks/useLocal.tsx`: replace with web storage helper or remove usage.

### Phase 4: Polish, Docs, and Tests
- `docs/index.md` and `docs/User_Documentation/*`: document web-only limitations and URL ingest caveats.
- `tests/e2e/*`: add web-specific smoke tests for auth, streaming, and ingest.
- `src/components/Option/Settings/system-settings.tsx`: hide extension-only settings (action icon, context menu, sidepanel toggles) in web.

## Risks and Mitigations
- Risk: CORS and mixed content issues.
  - Mitigation: document server config, provide HTTPS guidance.
- Risk: URL ingestion fails for authenticated pages.
  - Mitigation: show clear UX notice and suggest upload or paste.
- Risk: Streaming errors in some browsers.
  - Mitigation: fall back to non-streaming requests.
- Risk: In-app navigation still references extension URLs.
  - Mitigation: audit `browser.runtime.getURL` usage and replace with router links.

## Acceptance Tests (High-Level)
- Login succeeds with API key and with multi-user auth; tokens refresh as expected.
- Chat streaming works; if streaming fails, non-streaming response is returned.
- Quick Ingest works for URL, file, and paste; URL errors are explained clearly.
- Extension-only actions are not visible or are disabled in web.
- Switching server base URL updates all API calls and cached data scopes.

## Decisions
- Auth mode: token-based auth is the default for web; cookie sessions are supported when offered by the server.
- Multi-tenant support: the web app supports switching between multiple server base URLs in a single session, scoped per URL.
- Extension-only settings: hidden entirely in the web app to avoid confusion.

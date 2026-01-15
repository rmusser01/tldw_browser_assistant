# PRD: Webapp Frontend (No Companion Extension)

## Overview
Build a first-class web UI for tldw_server that does not require a browser extension or companion capture tool. The webapp provides full access to server features (chat, RAG, media, knowledge, notes, flashcards, settings, admin) while replacing extension-only flows with web-friendly alternatives.

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
- HTTPS is preferred; mixed-content (https webapp -> http server) should be treated as an error.

## User Stories
- As a user, I can log into tldw_server and chat from a normal web page.
- As a user, I can ingest content by URL or file without installing anything.
- As a user, I can access all server-backed features in one web UI.
- As a user, I understand limitations for logged-in or dynamic pages.

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

## Streaming and Upload
- Chat and RAG streaming should work without extension ports (SSE over fetch or WebSocket).
- Upload flows should post `multipart/form-data` directly to server endpoints.
- If streaming is unavailable, fall back to non-streaming requests with explicit UX notice.

## Capture Alternatives (No Extension)
- URL ingestion: server fetch and parse (best-effort).
- File upload: upload original files or HTML exports.
- Paste text: manual paste or clipboard import.

## Data and Storage
- Server remains the source of truth for chats, media, and knowledge.
- Webapp stores local UI state only (drafts, preferences, cached lists).
- Avoid long-term local storage of secrets; prefer session tokens with refresh flow.

## Security
- Enforce CORS policy on tldw_server.
- Use token-based auth or session cookies.
- Avoid storing secrets in logs or query strings.
- Prefer HTTP-only cookies for web auth if available; otherwise short-lived access tokens.

## Success Metrics
- >= 80% of extension feature usage is available in web UI.
- >= 95% streaming requests succeed without fallback.
- Median time-to-first-response within 20% of extension baseline.

## Rollout Plan
- Phase 1: Auth, chat, settings, basic ingest.
- Phase 2: Knowledge, media review, prompt studio, evaluations.
- Phase 3: Parity polish and deprecation of extension-only UI paths in web.

## Implementation Workstreams (Draft)
- Routing and app shell: add a web entry, use BrowserRouter, reuse `RouteShell` with options routes.
- API transport: add web streaming client (SSE/WebSocket) to replace `bgStream`/`bgUpload`.
- Storage abstraction: swap `@plasmohq/storage` usage for web adapters in UI and settings.
- UX cleanup: remove extension-only UI and help text; update Quick Ingest flows.
- Auth and config: update onboarding for server URL + auth in web context.

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

## Open Questions
- Should the webapp use cookie sessions or token auth by default? - token auth
- Do we support multi-tenant base URLs in a single web session? - yes
- Should the webapp expose any extension-only settings, or hide them entirely? - hide them entirely

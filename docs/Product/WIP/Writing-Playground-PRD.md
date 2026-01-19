# PRD: Writing Playground (Extension + Server)

## Status
- Status: Draft (aligned with server final plan)
- Owner: TBD
- Last Updated: 2026-01-04

## Summary
Create a Writing Playground page inside extension Options that recreates the mikupad.html feature set without reusing AGPL code. The playground is server-backed via tldw_server, uses OpenAI-compatible chat completions for generation, and persists sessions/templates/themes in the new `/api/v1/writing/*` API surface.

## Goals
- Provide a dedicated Writing Playground UX inside Options with mikupad-equivalent editor controls and workflows.
- Use `/api/v1/chat/completions` for all generation requests with OpenAI-compatible parameters.
- Persist sessions, templates, and themes on the server with schema versioning and soft-delete.
- Gate features based on a server capabilities handshake.

## Non-Goals
- Direct calls to llama.cpp, KoboldCpp, or AI Horde from the extension.
- Reuse of mikupad source code (AGPL).
- Offline-only persistence in the extension.

## Success Metrics
- Session CRUD + restore works for 99% of sessions under normal network conditions.
- Streaming generation works with cancellation and does not block UI for 95th percentile long responses.
- Capabilities gating prevents users from invoking unsupported tokenizer/logprobs features.
- E2E smoke tests pass for session persistence, template/theme CRUD, and streaming.

## Users and Use Cases
- Writers who need a structured editor with prompt controls and token-level insights.
- Users who want to manage and reuse instruct templates and custom themes.
- Users who require session tracking and export/import for long-form writing.

## Functional Requirements
### Editor
- Prompt editor with chunked tokens, overlay highlighting, undo/redo for generations.
- Context menu actions: Predict Here, Fill-In-The-Middle, Insert Template.
- Search and replace widget (plain text + regex modes).
- Markdown preview with scroll sync, using existing markdown components.

### Prompt Processing
- Support `{predict}` and `{fill}` placeholders.
- FIM templates via selected instruct template.
- Chat-mode parsing using instruct templates.

### Context Controls
- Memory block with prefix/text/suffix.
- Author note with prefix/text/suffix and insertion depth.
- World info entries with regex keys and search range.

### Sampling and Constraints
- Temperature + dynatemp.
- Repetition/presence/frequency penalties.
- Top-k, top-p, typical-p, min-p, tfs-z.
- Mirostat, XTC, DRY.
- Stop strings, ignore EOS, grammar, logit bias, banned tokens, seed.

### Token Display
- Token highlight overlay.
- Optional probability tooltip/panel when logprobs are supported.
- Preview tokens and acceptance controls.

### Templates
- CRUD templates with import/export and default re-add.

### Themes
- CRUD themes with import/export and default re-add.
- Themes include class name and CSS text.

### Sessions
- Create/rename/delete/clone/import/export sessions.
- Track the active session and update it on change.

### TTS
- Browser SpeechSynthesis support with streaming text and user-input readout.

## UX + IA
- New Options route: `/writing-playground`.
- Layout: main editor (overlay + textarea) and right sidebar for parameters.
- Modals/widgets for templates, context, grammar, logit bias, themes, and TTS settings.
- Use the existing Option layout and shared UI components.
- Use a dedicated CSS module for editor overlay and per-token highlighting.

## Data Model
### Session
```
{ id, name, payload_json, schema_version, version, version_parent_id, created_at, updated_at, deleted_at }
```

### Template
```
{ name, payload_json, schema_version, version, version_parent_id, is_default, updated_at, deleted_at }
```

### Theme
```
{ name, class_name, css, schema_version, version, version_parent_id, is_default, order, updated_at, deleted_at }
```

## API Contract
- `GET /api/v1/writing/version` -> `{ version: 1 }`
- `GET /api/v1/writing/capabilities` -> server + provider feature support
- `GET /api/v1/writing/sessions` -> list sessions (id, name, updated_at)
- `POST /api/v1/writing/sessions` -> create session
- `GET /api/v1/writing/sessions/{id}` -> session payload
- `PATCH /api/v1/writing/sessions/{id}` -> update session payload/name
- `DELETE /api/v1/writing/sessions/{id}` -> delete session
- `POST /api/v1/writing/sessions/{id}/clone` -> clone session
- `GET /api/v1/writing/templates` + CRUD by name
- `GET /api/v1/writing/themes` + CRUD by name
- `POST /api/v1/writing/tokenize` -> ids + strings (requires `provider` + `model`)
- `POST /api/v1/writing/token-count` -> integer count (requires `provider` + `model`)

## Capabilities Handshake
The client must call `/api/v1/writing/capabilities` at startup and when model/provider changes. The response should include:
- Endpoint support: sessions/templates/themes/tokenize/token-count
- Provider features: logprobs/top_logprobs, grammar, banned_tokens, FIM, etc.
- Tokenizer availability per provider/model

The UI disables features when capabilities are missing.

## LLM Integration
- Use `/api/v1/chat/completions` with OpenAI-compatible params.
- Use `extra_body` for provider-specific fields (logprobs, top_logprobs, grammar, etc.).
- Derive provider + model from server model metadata; pass to tokenizer endpoints.
- If logprobs are unavailable, disable token probability UI.

## Persistence Model
- Server-backed only; no offline-only persistence.
- Session payload includes `schema_version` for migration.
- Delete is final in API surface; server retains soft-delete for audit/migration.

## Security and Privacy
- Require AuthNZ, RBAC, and rate limiting for persistence and tokenizer endpoints.
- Do not log prompts or API keys.
- Sanitize markdown preview HTML by using existing Markdown components.
- Scope theme CSS to `.writing-playground` and sanitize CSS to block `@import` and `url()`.

## CSS Sanitization Policy
- Scope selectors to `.writing-playground`.
- Reject or rewrite selectors not prefixed with `.writing-playground`.
- Strip `@import` and any declaration containing `url()`.
- Disallow resource-loading at-rules (`@font-face`); allow only `@media` and `@keyframes` if required.

## Testing
- Unit tests for persistence serialization, versioning, soft-delete.
- Integration tests for new API endpoints and capabilities payload.
- UI smoke tests for session persistence, template/theme CRUD, and streaming.

## Rollout
- Add as a normal Options nav route.
- Gate features via capabilities handshake.
- Show connection CTAs when server is unavailable.

## Risks and Mitigations
- Provider lacks logprobs: disable token probability UI.
- Tokenizer missing for provider/model: surface warning and disable logit bias/token counts.
- Large session payloads: debounce saves, avoid excessive write frequency.
- CSS injection: enforce sanitization and scoping.
- AGPL contamination: reimplement from scratch and avoid copy-paste.

## Open Questions
- What capabilities schema will `/api/v1/writing/capabilities` return (exact fields)?
- Are templates/themes strictly global per user, or optionally scoped per session?
- Should session export be JSON-only or include assets?

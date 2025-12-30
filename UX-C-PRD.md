# UX-C PRD Addendum: Server Coverage Parity + Implementation Notes

## Status
This document is a non-authoritative addendum. Source of truth: `docs/Product/WIP/UX-D-PRD.md`.
When conflicts exist, UX-D-PRD.md wins.

## Locked Decisions (Apply To UX-D)
- Scope: Options + Playground + Sidepanel.
- Visual overhaul: yes (dark-mode default + new tokens).
- Mode toggle: sidebar only (no header toggle).
- Milestone 1 focus: server coverage parity (no artifacts/threading in M1).

## Purpose
Capture server-coverage parity work, acceptance criteria, and engineering sequencing that must align with UX-D.

## Server Coverage Parity Backlog (Delta)

### P0 (Core Chat Parity)
- Slash commands discovery + injection override.
  - Casual: "/" autocomplete + commands hint in composer.
  - Pro: commands list + injection mode setting in Settings.
  - Endpoint: `GET /api/v1/chat/commands`, request field `slash_command_injection_mode`.
- Tool calling in normal chat.
  - Casual: tools toggle in composer (off by default).
  - Pro: tool picker + approval/trace panel.
  - Endpoint: `POST /api/v1/chat/completions` with `tools` + `tool_choice`.
- JSON response mode.
  - Casual: structured output toggle; JSON rendering with validation state.
  - Pro: response format selector + schema hint.
  - Endpoint: `POST /api/v1/chat/completions` with `response_format`.
- Persistence + conversation binding.
  - Casual: save status icon + tooltip (temporary vs server).
  - Pro: explicit `save_to_db` toggle + conversation id controls.
  - Endpoint: `POST /api/v1/chat/completions` with `save_to_db` + `conversation_id`.
- Prompt templates + history controls (Pro only).
  - Endpoint: `POST /api/v1/chat/completions` with `prompt_template_name`, `history_message_limit`, `history_message_order`.

### P1 (Knowledge + Docs)
- Document generator (chat -> doc).
  - Endpoints: `/api/v1/chat/documents/*`.
- Chatbooks import/export.
  - Endpoints: `/api/v1/chatbooks/*`.
- Dictionary validate + preview.
  - Endpoints: `/api/v1/chat/dictionaries/validate`, `/api/v1/chat/dictionaries/process`.
- Save snippet to Notes/Flashcards.
  - Endpoint: `/api/v1/chat/knowledge/save`.
- Queue status/activity (diagnostics).
  - Endpoints: `/api/v1/chat/queue/status`, `/api/v1/chat/queue/activity`.
- Character completion v2 wiring.
  - Endpoint: `/api/v1/chats/{id}/complete-v2`.

### P2 (Advanced Controls)
- Provider overrides + BYOK hints.
  - Request fields: `api_provider`, `extra_headers`, `extra_body`.
- Advanced sampling + multi-completion.
  - Request fields: `seed`, `logprobs`, `top_logprobs`, `stop`, `n`.
- Tool call inspector/replay.
- Model capability gating + warnings.
- In-chat message search.
  - Endpoint: `/api/v1/chats/{id}/messages/search`.

## Milestones (Parity Acceptance)

### Milestone 1: Core Chat Parity (P0)
- Commands: `/` opens a command list when `GET /api/v1/chat/commands` is available; injection mode is user-configurable.
- Tools: tool toggles are gated by model capabilities and produce tool call logs when used.
- JSON mode: structured output renders as JSON and shows validation state (valid/invalid).
- Persistence: save state visible in Casual mode and configurable in Pro mode.
- Prompt templates/history controls appear only in Pro and are applied to requests.
- Artifacts/threading are out of scope for this milestone.

### Milestone 2: Knowledge + Docs (P1)
- Document generator can create at least one doc type from a conversation with async job support.
- Chatbooks import/export reachable from Settings and handles job status.
- Dictionary validation/preview runs and surfaces errors/warnings.
- Save snippet creates Notes and optional Flashcards.
- Health page shows queue status/activity when available.

### Milestone 3: Advanced Controls (P2)
- Provider overrides and advanced sampling available in Pro with clear defaults.
- Tool call inspector works for tool-enabled chats.
- Model capability badges control UI availability.
- In-chat search is available in both modes with appropriate UI.

## Engineering Sequence (Delta)
1. Foundation (plumbing)
   - Add endpoints to `src/services/tldw/openapi-guard.ts`.
   - Add client wrappers in `src/services/tldw/TldwApiClient.ts`.
   - Extend capability detection in `src/services/tldw/server-capabilities.ts`.
2. Visual Overhaul (tokens + layout)
   - Update tokens in `tailwind.config.js` (dark default).
   - Apply typography/spacing updates across Options, Playground, Sidepanel.
3. Core Chat Wiring (P0)
   - Pass new chat fields through `src/hooks/useMessage.tsx`.
   - Add Casual UI toggles in `src/components/Sidepanel/Chat/form.tsx`.
   - Add Pro controls in `src/components/Option/Playground/PlaygroundForm.tsx`.
   - Add Pro sidebar toggle in `src/components/Sidepanel/Chat/Sidebar.tsx` and `src/components/Option/Sidebar.tsx`.
4. Knowledge + Docs (P1)
   - Add doc generator panel/actions in Playground + chat.
   - Add chatbooks import/export page in Settings.
   - Add dictionary validate/preview actions.
5. Advanced Controls (P2)
   - Add provider override + sampling controls in Pro.
   - Add tool call inspector and in-chat search.
6. Polish + QA
   - Update empty states and capability warnings.
   - Manual smoke tests across chat, tools, and docs.

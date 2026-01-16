# SillyTavern-Style Character Chat Enhancements PRD

## Overview
Bring character chat closer to SillyTavern behavior: deterministic character data, per-conversation greeting control, per-character prompt formatting presets, per-chat greeting inclusion, and author’s note injection.

## Goals
- Make greetings user-controllable, persistent per conversation, and stable across refresh.
- Enable per-character prompt formatting presets (ST-style) using existing character fields + world books.
- Add per-chat toggle to include greeting in prompt context (default on).
- Add author’s note/memory box injected at fixed depth, with optional per-character default.

## Non-Goals
- Full ST UI parity.
- Overhauling world book logic or server APIs.
- New model providers or server schema changes (unless required).



---

## Feature Grouping A: Greeting Picker + Persistence
### Stage A1 (MVP)
- Inline greeting picker shown above the first message when chat is empty and a character is selected.
- “Reroll” selects a new greeting from available variants.
- Persist selected greeting per conversation (historyId or serverChatId); survives refresh.
- Default: auto-select a random greeting on first load.

### Stage A2
- “Pick from list” dropdown of available greetings.
- Show source (character field) and preview length.
- Option to “Use character default” (deterministic first greeting).

### Requirements
- Store selected greeting per conversation (local storage or history metadata).
- Clear selection when character changes or chat is reset.
- Greeting injection uses selected greeting and display-name replacements.
- Persist greeting staleness metadata alongside `persistedGreetingId` or `persistedGreetingIndex`:
  - Maintain `greetingsVersion` (increment on add/edit/delete/reorder) and/or `greetingsChecksum` (hash of concatenated greeting IDs + texts) on any greetings change.
  - On load, compare current `greetingsVersion`/`greetingsChecksum` to persisted values; if they differ, treat the persisted index as stale and re-select:
    - If `useCharacterDefault` is true, pick the deterministic first greeting (by ID or index 0) and persist it.
    - Otherwise re-roll randomly from remaining greetings and persist the new selection.
    - If no greetings remain, hide the greeting picker and skip injection.
  - Ensure greetings edits always update `greetingsVersion`/`greetingsChecksum` so future loads detect staleness.
- Deterministic fallback rules:
  - If no greetings exist, do not auto-select; hide greeting picker and skip greeting injection.
  - If multiple greetings have identical text, treat the first occurrence in source order as the deterministic "first" greeting (persist by stable greeting ID; if IDs are unavailable, use index with a staleness check on load).
  - If a persisted greeting is deleted or missing:
    - If "Use character default" is enabled: fall back to the deterministic first greeting (by ID or index 0).
    - Otherwise: re-roll randomly from remaining greetings and persist the new selection.
    - If no greetings remain: hide greeting picker and skip injection (see above).

---

## Feature Grouping B: Per-Character Prompt Formatting Presets (ST-Style)
### Stage B1 (MVP)
- Per-character preset selection stored with character (local).
- Format uses: name, system prompt, personality, scenario, message_example, post_history_instructions, and world books (already supported).
- Applies to prompt assembly in chat pipeline.

### Stage B2
- Preset editor UI (template tokens list + preview).
- Compatibility presets: “ST default”, “Roleplay (compact)”, “Instructional”.

### Requirements
- Preset applied only when character chat is active.
- Preserve current Actor/World Book injection logic.
- Appendable metadata:
  - Per-text-block boolean field named `appendable`, stored alongside content in preset templates and Actor/World Book records (template/schema metadata + Actor/World Book entry records).
  - UI exposes a checkbox labeled "Appendable".
  - Default when absent: false (treat as non-appendable).
  - Text blocks are concatenated only when both source and target blocks have `appendable=true`.
- Prompt assembly order/precedence:
  - Apply preset template to build the base prompt (system + examples + scenario/personality) first.
  - Apply Actor/World Book injections after preset formatting using existing injection order.
  - Conflict resolution/precedence:
    - "Later injection" means Actor/World Book injections applied after preset template formatting (preset → then Actor/World Book).
    - Scalar parameters (temperature, top_p, penalties, stop strings): later injection overrides earlier values on key conflict.
    - System instructions and other text blocks: later injection replaces earlier values on conflict unless both blocks are `appendable=true`, in which case concatenate.

---

## Feature Grouping C: Greeting Inclusion Toggle + Regenerate Behavior
### Stage C1 (MVP)
- Per-chat toggle: “Include greeting in context” (default on).
- Toggle influences prompt history construction (exclude greeting message when off).
- Regenerate behavior for character chats:
  - Always apply the character's prompt formatting preset (Feature B) and generation settings (Feature H) when regenerating a character response.
  - Respect the current "Include greeting in context" toggle state (Feature C).
  - Include author's note if configured (Feature D).
  - For non-character chats or user messages, use the default/global prompt mode.

### Stage C2
- Toggle surfaced in composer header with tooltip + persistence per chat.
- Visual indicator on greeting message if excluded from context.

---

## Feature Grouping D: Author’s Note / Memory Box
### Stage D1 (MVP)
- Add author’s note input in chat UI (per-chat, persisted).
- Inject at fixed depth (configurable position = “before system” or “depth N”).
- Optional per-character default (editable in character settings).

### Stage D2
- Toggle for GM-only (exclude from prompt).
- Token count indicator + warning if long.

### Requirements
- Author’s note is applied during prompt assembly.
- Per-character default merges into per-chat note (chat overrides character).

---

## Feature Grouping E: Character Card Import/Export (ST v2 PNG/JSON)
### Stage E1 (MVP)
- Import ST v2 JSON and PNG (embedded JSON chunk) into character manager.
- Export current character to ST v2 JSON.
- Map fields: name, avatar, system prompt, personality, scenario, greetings, examples, creator notes, tags.
- Validate PNG/JSON imports against the ST v2 card JSON schema.
- Enforce size limits (max avatar bytes, max prompt length, max file size).
- Verify PNG embedded JSON and avatar integrity before accepting (valid PNG chunks, MIME/type checks, checksum).
- Sanitize/whitelist imported textual fields and treat as untrusted input before any code generation or rendering.
- Define avatar storage strategy and limits (e.g., max 200KB, store in blob store with AV scan + content-type validation, reject oversized).
- Report explicit validation errors and rejection reasons to the user.

### Stage E2
- Export ST v2 PNG with embedded JSON and avatar image.
- Import preview/confirmation hook: show field diffs and validation errors before save.

### Requirements
- Preserve existing character fields and world book links when possible.
- Validate size limits for stored avatars and prompts.
- JSON schema validation is required for import; reject malformed payloads.
- Sanitize/escape imported text fields (system prompt, scenario, personality, greetings, examples, creator notes, tags) and block script/prompt-injection patterns.
- PNG validation must include chunk integrity, MIME/type validation, and checksum verification for embedded JSON and avatar data.
- Avatar storage: enforce max size (e.g., 200KB), store in blob store with AV scan and content-type validation, reject oversized images.
- Surface validation failures with actionable error messaging in the import flow.
- Rate-limit import attempts to mitigate abuse (e.g., 1 import per 5 seconds per
  session, max 20 imports per user per hour; failed validations count).

---

## Feature Grouping F: Lorebook Trigger Diagnostics
### Stage F1 (MVP)
- Add a “Lorebook Debug” view in chat settings to list triggered entries and token cost.
- Show activation reason (keyword, regex, depth) when available.

### Stage F2
- Inline warnings when lorebook entries exceed token budget or conflict.
- Export diagnostic log for a conversation.

### Requirements
- Leverage existing world book data; no server schema changes unless required.

---

## Feature Grouping G: Prompt Assembly Preview / Context Inspector
### Stage G1 (MVP)
- Add a collapsible “Prompt Preview” showing final prompt sections and token counts.
- Highlight which sections are active (system prompt, character preset, author note, greeting, lorebook, actor).
- Surface a warning in Prompt Assembly Preview when overlapping keys or contradictory system directives are detected.
- Include concise examples in the Prompt Assembly Preview:
  - Preset sets temperature=0.7; Actor/World Book sets temperature=0.2 → effective temperature=0.2.
  - Preset system directive: "Speak tersely"; Actor/World Book directive: "Be verbose" → later directive replaces earlier.
  - Preset examples marked appendable + Actor/World Book examples marked appendable → both appended in order.

### Stage G2
- Allow temporary toggles per section (preview-only) to understand impact.
- Include model-specific token limits and budget warnings.

---

## Feature Grouping H: Per-Character Generation Presets
### Stage H1 (MVP)
- Per-character generation settings (temp, top_p, repetition penalty, stop strings).
- Apply automatically when that character is selected.

### Stage H2
- “Quick swap” presets (e.g., Creative/Neutral/Strict) with per-chat override.

### Requirements
- Do not override explicit per-chat model settings unless user opts in.

---

## Feature Grouping I: Group / Multi-Character Chats
### Stage I1 (MVP)
- Allow selecting multiple characters for a chat.
- Turn-taking mode (round robin) with per-character prompt injection.
- Greeting scope control (per chat vs per character) with explicit UI label.
- Preset scope control (per chat override vs per character) with explicit UI label.
- Memory scope control (shared per chat vs per character vs both) with explicit UI label.

### Stage I2
- Directed replies (choose character to respond).
- Per-character memory blocks and greeting control.

### Requirements
- Preserve chat history attribution per character.
- Interaction rules with Features C/H/D:
  - Greeting inclusion (Feature C + I):
    - greetingScope / perCharacterGreeting controls whether greetings are per chat or per character.
    - per chat: a single greeting toggle applies to the whole conversation regardless of speaker.
    - per character: each character's greeting is eligible only on that character's first reply in the chat.
    - Turn-taking: greeting applies on a character's first turn only if perCharacterGreeting is true; otherwise only one greeting is shown for the chat.
    - Directed reply: greeting applies only when a character is selected for their first reply (perCharacterGreeting true); otherwise the chat-level greeting applies once.
  - Preset precedence (Feature H + I):
    - Order of application: per-message override (if any) -> chat-level override preset (if set) -> speaking character preset -> global/default.
    - When presetScope is "chat", the chat-level override applies to every turn until cleared.
    - When presetScope is "character", use the speaking character preset for each turn.
  - Memory ownership (Feature D + I):
    - memoryScope controls whether memory is shared per chat, per character, or both.
    - shared: one author note applies to all turns.
    - per character: only the speaking character memory block is injected for that turn.
    - both: shared note is injected first, then the speaking character memory block.

### Scope Interaction Decision Matrix
Legend:
- Greeting injected assumes greetingEnabled=true and at least one greeting exists; otherwise `none`.
- Preset order abbreviations: PM=per-message override, Chat=chat-level override, Char=character preset, Global=global/default.
- When presetScope=chat, Chat override applies even if the character has no preset; if no Chat override is set, fall back to Global/default.
- Memory truncation: apply the Feature D cap; for `shared->char`, use remaining budget for the character note, truncate character first, then shared if still over.

| greetingScope (perCharacterGreeting) | presetScope | memoryScope | Greeting injected | Preset resolution | Memory injection + truncation |
| --- | --- | --- | --- | --- | --- |
| chat (false) | chat | shared | chat-first | PM -> Chat -> Global | shared (truncate shared) |
| chat (false) | chat | character | chat-first | PM -> Chat -> Global | char (truncate character) |
| chat (false) | chat | both | chat-first | PM -> Chat -> Global | shared -> char (truncate char first) |
| chat (false) | character | shared | chat-first | PM -> Char -> Global | shared (truncate shared) |
| chat (false) | character | character | chat-first | PM -> Char -> Global | char (truncate character) |
| chat (false) | character | both | chat-first | PM -> Char -> Global | shared -> char (truncate char first) |
| character (true) | chat | shared | per-char-first | PM -> Chat -> Global | shared (truncate shared) |
| character (true) | chat | character | per-char-first | PM -> Chat -> Global | char (truncate character) |
| character (true) | chat | both | per-char-first | PM -> Chat -> Global | shared -> char (truncate char first) |
| character (true) | character | shared | per-char-first | PM -> Char -> Global | shared (truncate shared) |
| character (true) | character | character | per-char-first | PM -> Char -> Global | char (truncate character) |
| character (true) | character | both | per-char-first | PM -> Char -> Global | shared -> char (truncate char first) |

### Edge Cases
- Only one active character with per-character greetings: treat as chat-first (single greeting on first reply) to avoid repeated greetings.
- greetingEnabled=false or no eligible greeting available: inject none regardless of scope.

### Fallbacks
- Missing/invalid scope values: fall back to Migration Strategy defaults (greetingScope: chat, presetScope: character, memoryScope: shared).

---

## Feature Grouping J: Message Steering Controls
### Stage J1 (MVP)
- “Continue as user” and “Impersonate user” actions.
- “Force narrate” toggle for a single response.

### Stage J2
- Per-message action macros (e.g., add style prompt snippet before regenerate).

---

## UX Notes
- Greeting picker appears only when no non-greeting messages exist.
- Reroll is explicit; no auto-changes after initial pick.
- Preset selection lives in character edit UI + quick access in chat settings.
- Greeting scope label: "Greeting scope: Per chat / Per character".
- Preset scope label: "Preset scope: Chat override / Per character".
- Memory scope label: "Memory scope: Shared / Per character / Both".

## Data & Persistence
- Storage strategy: Option C (Hybrid). Use local storage for offline-first edits and sync to server history metadata when a serverChatId exists.
- Storage map (per-chat settings, keyed by historyId with optional serverChatId mapping):
  - Feature A greeting selection: `greetingSelectionId` stored locally and synced to server history metadata.
  - Feature C greeting toggle: `greetingEnabled` stored locally and synced to server history metadata.
  - Feature D author's note: shared note stored as `authorNote`; per-character notes stored in `characterMemoryById` map. Both stored locally and synced to server history metadata.
  - Feature H per-chat generation preset: `chatPresetOverrideId` + `presetScope` stored locally and synced to server history metadata.
  - Data model fields:
    - `greetingScope` stored in per-chat settings (local + server metadata).
    - `presetScope` stored in per-chat settings (local + server metadata).
    - `memoryScope` stored in per-chat settings (local + server metadata).
    - `chatPresetOverrideId` stored in per-chat settings (local + server metadata).
    - `characterMemoryById` stored in per-chat settings (local + server metadata).

## Token Budget Allocation
- Total supplemental injection budget: 1200 tokens per prompt across Features A/B/D/F + Actor/World Book.
- Feature A greeting: max 120 tokens (truncate to fit).
- Feature D author's note: max 240 tokens total (shared + active character note combined).
- Feature B per-character presets: max 180 tokens.
- Feature F lorebook entries: max 420 tokens total; cap individual entries at 140 tokens and include highest-score entries until budget is exhausted.
- Actor/World Book injections: max 240 tokens combined (actor up to 160, world up to 80).
- Allocation/overflow strategy:
  - Priority order for retention: presets (B) > author's note (D) > lorebook (F) > actor/world > greeting (A).
  - Apply per-feature caps first; if still over the 1200-token total after capping (tokenization variance), drop or further truncate lowest-priority sections in order.
  - Prompt Preview (Feature G) shows per-section token counts, flags any truncated section, and displays a warning when the total exceeds 90% (caution) or hits the hard cap (error).
  - Prompt assembly enforces caps and total limit; performance tests assert total supplemental tokens never exceed 1200 and record truncation events.

## Migration Strategy (New Fields)
- Legacy characters/chats without new fields receive safe defaults:
  - greetingScope: "chat" (single greeting per conversation, preserves existing behavior).
  - presetScope: "character" (per-character presets, opt-in to chat overrides).
  - memoryScope: "shared" (single author's note per chat).
  - chatPresetOverrideId: null (no override, use character preset).
  - characterMemoryById: {} (empty map, no per-character memory).
- Existing greeting behavior (auto-select random) preserved for legacy chats until user explicitly picks a greeting.
- Existing prompt assembly logic unaffected for non-character chats.
- Data schema version bump required; target schemaVersion = 2. Rollback plan:
  older clients ignore new per-chat settings fields and continue using legacy
  fields; avoid destructive transforms and keep new fields intact for
  re-upgrade.

## Sync & Conflict Resolution
- Reconciliation rule: last-write-wins per field group using `updatedAt` timestamps on the per-chat settings record.
- Tie-breaker when timestamps are missing or equal: server-wins for server-backed chats; local-wins for local-only chats.
- Map merges (e.g., `characterMemoryById`): apply last-write-wins per entry using per-entry timestamps when available, otherwise fall back to record-level `updatedAt`.

## Migration Plan
- Add `schemaVersion` and `updatedAt` to per-chat settings records; default
  `schemaVersion` to 1 for existing data and set new records to 2.
- On upgrade, migrate existing local keys (historyId/serverChatId) into the new per-chat settings record; set `updatedAt` to the local record timestamp.
- For server-backed chats, perform one-time reconciliation:
  - If server metadata is missing, push local record.
  - If both exist, apply last-write-wins and persist the merged result to both local and server.
- Keep a backward-compat read path for one release: if new fields are missing, read legacy locations, migrate, and save once.
- For future schema/format changes, introduce a versioned migration function per schema version and run migrations before sync; if migration fails, fall back to the latest server metadata and preserve the local record as a conflict copy for manual recovery.

## Risks / Open Questions
- How to reconcile server-backed chats vs local histories?
- Performance: cumulative token overhead from preset + author's note + greeting + lorebook + actor/world book injections may exceed model context limits or increase latency. Define token budgets per feature and add warnings in prompt preview (Feature G).
- Performance testing: include load tests for multi-character chats with all features active to measure prompt assembly time and token counts.

## Testing
- Manual: switch characters, reroll greeting, refresh, confirm persistence.
- Greeting fallback: delete persisted greeting and verify fallback to first greeting (default mode) or re-roll (manual mode); delete all greetings and verify picker is hidden.
- Ensure prompt preview reflects preset + author note + greeting toggle.
- Unit tests: scope resolution for greeting/preset/memory in multi-character mode.
- Integration tests: C+I greeting scope, H+I preset precedence, D+I memory merge behavior.
- Unit tests: greeting selection persistence keyed by historyId/serverChatId; preset application logic; author’s note injection, targeting local storage read/write + per-character preset sync modules.
- Integration tests: prompt assembly combining preset + author note + greeting toggle; character switching and multi-character turn-taking across turns.
- E2E tests: full refresh + server sync conflict resolution flows (local vs server metadata), covering persistence keys and preset-sync reconciliation.
- Regression tests: non-character chats and single-character chats remain unchanged (no prompt assembly drift).
- Security tests: Feature E import validation with malformed PNG/JSON, oversized avatars (>200KB), prompt-injection payloads; verify rejection and error messages.
- Rollback tests: downgrade to a v1 client and verify legacy fields still load,
  new fields are ignored, and no data loss occurs when returning to v2.
- Performance tests: multi-character chats with all features active; measure token counts, prompt assembly time, and memory usage under load.





### Extra:
Allow for auto-summarization past a certain threshold, while also allowing for 'pinned' messages to be avoided in compression

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

---

## Feature Grouping C: Greeting Inclusion Toggle + Regenerate Behavior
### Stage C1 (MVP)
- Per-chat toggle: “Include greeting in context” (default on).
- Toggle influences prompt history construction (exclude greeting message when off).
- Regenerate always uses character chat mode for character chats (per message action).

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

### Stage E2
- Export ST v2 PNG with embedded JSON and avatar image.
- Show field mapping diff on import (preview before save).

### Requirements
- Preserve existing character fields and world book links when possible.
- Validate size limits for stored avatars and prompts.

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

### Stage I2
- Directed replies (choose character to respond).
- Per-character memory blocks and greeting control.

### Requirements
- Preserve chat history attribution per character.

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

## Data & Persistence
- Greeting selection: per conversation (local, keyed by historyId/serverChatId).
- Preset selection: per character (local + sync if existing).
- Author’s note: per chat + optional per character.

## Risks / Open Questions
- Where to store per-chat settings (history metadata vs local store)?
- How to reconcile server-backed chats vs local histories?

## Testing
- Manual: switch characters, reroll greeting, refresh, confirm persistence.
- Ensure prompt preview reflects preset + author note + greeting toggle.

# Chat UI Redesign Plan

## Design Goals
1. **Declutter** - Reduce visual noise while maintaining power
2. **Modernize** - Match ChatGPT/Claude.ai visual standards
3. **Add missing features** - Threading, artifacts, better context awareness
4. **Improve discoverability** - Surface features at the right moment
5. **Dual-mode** - Casual ↔ Pro mode toggle
6. **Surface parity** - Main chat, sidepanel, and Settings share the same core capabilities

---

## Core Design Philosophy

### "Progressive Complexity"
Inspired by Linear/Notion: Start minimal, reveal depth on demand.

- **Casual Mode**: Clean, focused, guided experience
- **Pro Mode**: Full keyboard control, dense information, customization

### Surface Parity (Main Chat ↔ Sidepanel ↔ Settings)
Core interaction features must remain in sync across surfaces:
- Composer capabilities (slash commands, tool_choice, model params, context chips)
- Command discovery (Cmd+K + slash menu)
- Feedback UX (thumbs + modal)
- Visual tokens/spacing across chat and Settings surfaces
- Mode toggle placement (left nav footer in Main Chat + Sidepanel)
Any intentional exceptions must be documented with rationale and owner.

---

## Layout Architecture

### New Structure (Inspired by Claude.ai + Discord)

```
┌──────────────────────────────────────────────────────┐
│  ☰  tldw Assistant              [Search] [⚙]  [+]   │  ← Minimal header
├────────────┬─────────────────────────────────────────┤
│            │                                         │
│  Sidebar   │         Main Chat Area                  │
│  (toggle)  │                                         │
│            │  ┌─────────────────────────────────┐    │
│ ★ Pinned   │  │ User message                    │    │
│ ─────────  │  └─────────────────────────────────┘    │
│ Today      │  ┌─────────────────────────────────┐    │
│  Chat 1    │  │ Assistant response              │    │
│  Chat 2    │  │ ───────────────────────────     │    │
│ Yesterday  │  │ [Sources ▼] [Copy] [↻]          │    │
│  Chat 3    │  └─────────────────────────────────┘    │
│            │                                         │
│ [Pro Mode] │  ┌─────────────────────────────────┐    │
│            │  │ 💬 Message...          [@] [📎] │    │
│            │  │ [Model ▼] [Tools ▼]        [➤]  │    │
│            │  └─────────────────────────────────┘    │
└────────────┴─────────────────────────────────────────┘
```

### Key Changes from Current

| Current | Proposed |
|---------|----------|
| Tabs + drawer + timeline | Unified sidebar (collapsible) |
| Fixed bottom form (160px) | Floating composer with context chips |
| Status dot | Ambient status (border color) |
| "More" menu hidden features | Context-aware action buttons |
| Flat message list | Collapsible sections (reasoning, sources) |

---

## Component Redesign

### 1. Header (Simplified)
**Remove:** Tabs, inline search expansion, multiple action buttons

**Keep:** Logo, connection status, settings

**Add:**
- Hamburger → sidebar toggle
- Cmd+K search (modal, not inline)
- Current chat title (editable inline)

### 2. Sidebar (New - Replaces Tabs + Drawer)
**Casual Mode:** Hidden by default, hamburger to reveal

**Pro Mode:** Always visible, resizable

**Content:**
```
┌─────────────────────┐
│ 🔍 Search chats...  │  ← Instant filter
│ [Local | Server | Folders] │ ← Tabs (Main Chat)
├─────────────────────┤
│ ★ Pinned            │  ← New feature
│   📌 Project notes  │
│   📌 Code review    │
├─────────────────────┤
│ Today               │  ← Grouped by time
│   💬 API debugging  │
│      #backend       │  ← Topic labels
│   💬 Feature plan   │
│      ● In Progress  │  ← Conversation state
├─────────────────────┤
│ Yesterday           │
│   💬 Bug fix...     │
│      ✓ Resolved     │
├─────────────────────┤
│ Shortcuts ▾         │  ← Main Chat only
│  📥 Ingest Page      │
│  📚 Media            │
│  🗒 Notes             │
│  🎴 Flashcards        │
│  ✍ Prompts           │
│  ✂ Chunking          │
│  🔬 Multi-Item        │
├─────────────────────┤
│ ⚙ Settings          │
│ 🎚 [Casual|Pro] ●○  │  ← Mode toggle (Main Chat + Sidepanel)
└─────────────────────┘
```

**Conversation Context Menu** (right-click on chat):
```
┌─────────────────────┐
│ 📝 Rename           │
│ 📌 Pin / Unpin      │
│ 🏷️ Add Label...     │
├─────────────────────┤
│ Status:             │
│   ○ In Progress     │
│   ● Resolved        │
│   ○ Backlog         │
│   ○ Non-viable      │
├─────────────────────┤
│ 📤 Export...        │
│   → JSON            │
│   → Markdown        │
├─────────────────────┤
│ 🗑️ Delete           │
└─────────────────────┘
```

### 3. Message Display (Modernized)

**User Messages:**
```
┌──────────────────────────────────────┐
│ 👤  What is the main function here?  │
│     📎 screenshot.png                │  ← Attached context as chips
│     📄 @current-page                 │
└──────────────────────────────────────┘
```

**Assistant Messages:**
```
┌──────────────────────────────────────────────┐
│ 🤖  The main function handles...             │
│                                              │
│     [Reasoning ▼]  ← Collapsed by default    │
│     ┌────────────────────────────────────┐   │
│     │ I analyzed the code structure...   │   │
│     └────────────────────────────────────┘   │
│                                              │
│     [🔧 Tool: search_knowledge ▼]  ← If used │
│     ┌────────────────────────────────────┐   │
│     │ Query: "main function"             │   │
│     │ Results: 3 documents found         │   │
│     └────────────────────────────────────┘   │
│                                              │
│     ```python                                │
│     def main():                              │
│         ...                                  │
│     ```                                      │
│                                              │
│     📚 Sources (3)  ← Inline expandable      │
│     ┌────────────────────────────────────┐   │
│     │ 📄 main.py:42                      │   │
│     │ 📄 utils.py:15                     │   │
│     │ 🌐 docs.example.com                │   │
│     └────────────────────────────────────┘   │
│                                              │
│ [🔊 Play] [📋 Copy] [↻ Regenerate]             │
│ [🔀 Fork] [💬 Reply]                           │
│ ─────────────────────────────────────────────│
│ 127 prompt + 89 completion = 216 tokens      │  ← Pro mode only
└──────────────────────────────────────────────┘
```

**New Features:**
- **Collapsible reasoning** - Show chain-of-thought verbatim on demand
- **Tool call display** - Show function calls and results
- **Inline sources** - No popup, expandable inline
- **Voice playback** - Play action in the message toolbar (TTS)
- **Fork from message** - Create conversation branch
- **Reply/threading** - Create sub-conversations (Pro mode)
- **Token usage** - Show prompt/completion tokens (Pro mode)
- **Chat feedback** - 👍/👎 + detailed modal (see Chat Feedback section)

### 4. Composer (Reimagined)
Applies to both Main Chat (Options/Playground) and Sidepanel with the same behaviors.

**Casual Mode:**
```
┌─────────────────────────────────────────────┐
│ 💬 Ask anything...                     [➤]  │
└─────────────────────────────────────────────┘
```
Single line, expands on focus. Model/tools auto-selected.

**Pro Mode:**
```
┌─────────────────────────────────────────────┐
│ Context: 📄 current-page  📷 1 image   [×]  │  ← Context chips
├─────────────────────────────────────────────┤
│                                             │
│ What does this function do?                 │
│                                             │
├─────────────────────────────────────────────┤
│ [Provider ▼] [Model ▼] [⚙] [Character ▼] [Template ▼] │  ← Row 1: Provider + model & context
│ [🔍 Search] [📚 RAG] [👁 Vision] [JSON] [Tools ▼] [🎙 Mic] │  ← Row 2: Mode toggles
│ [⌨ Cmd+K]                            [➤]   │
└─────────────────────────────────────────────┘
```

**Model Parameters Panel** (click ⚙ next to model):
```
┌─────────────────────────────────────────────┐
│ Model Parameters                        [×] │
├─────────────────────────────────────────────┤
│ Temperature      [─────●─────] 0.7          │
│ Top P            [───────●───] 0.9          │
│ Top K (topk)     [●──────────] 40           │
│ Max Tokens       [────────●──] 4096         │
│ Freq Penalty     [────●──────] 0.0          │
│ Presence Penalty [────●──────] 0.0          │
│ Advanced ▸     Min P, Stop, Seed, Logprobs  │
│               Top logprobs, Logit bias, N   │
│ Guardrails ▸    BYOK + extra headers/body   │
├─────────────────────────────────────────────┤
│ [Reset to Defaults]                         │
└─────────────────────────────────────────────┘
```

**New Features:**
- **Context chips** - Visual representation of attached context
- **@ mentions** - `@page`, `@knowledge:topic`, `@file:path`
- **Slash commands** - `/` triggers command discovery from server
- **Cmd+K command palette** - Quick access to all features
- **Model parameters** - Fine-tune generation settings
- **Provider + BYOK/Guardrails** - Explicit provider selector and guardrails fields
- **Character selector** - Inject character context
- **Prompt templates** - Apply predefined prompts
- **JSON mode** - Request structured output
- **Tools menu + tool_choice** - Select tools; auto/required/none
- **Voice input** - Mic button for STT; playback via message actions

### 5. Slash Command Discovery (New)
Applies to both Main Chat (Options/Playground) and Sidepanel with a shared command list.

**Trigger:** Type `/` in composer

```
┌─────────────────────────────────────────────┐
│ /                                           │
├─────────────────────────────────────────────┤
│ Available Commands                          │
│   /search    Search knowledge base          │
│   /vision    Enable vision mode             │
│   /web       Toggle web search              │
│   /model     Change model                   │
│   /export    Export conversation            │
│   /clear     Clear conversation             │
│   /help      Show all commands              │
├─────────────────────────────────────────────┤
│ ↑↓ Navigate  ↵ Select  Esc Dismiss          │
└─────────────────────────────────────────────┘
```

**Features:**
- Fetches available commands from `GET /api/v1/chat/commands`
- Filters by user permissions
- Fuzzy search as you type (e.g., `/se` matches `/search`)
- Shows command description and shortcuts
- Keyboard navigation (arrow keys + enter)

### 6. Command Palette (New - Inspired by Linear/Raycast)
Global entry point across Main Chat, Sidepanel, and Settings.

**Trigger:** Cmd+K anywhere

```
┌─────────────────────────────────────────────┐
│ 🔍 Type a command...                        │
├─────────────────────────────────────────────┤
│ Recent                                      │
│   ↵ Search knowledge base                   │
│   ↵ Toggle web search                       │
├─────────────────────────────────────────────┤
│ Actions                                     │
│   📚 Search knowledge        ⌘⇧K            │
│   🌐 Toggle web search       ⌘⇧W            │
│   👁 Enable vision mode      ⌘⇧V            │
│   📷 Attach image            ⌘⇧I            │
│   💾 Save to notes           ⌘S             │
├─────────────────────────────────────────────┤
│ Switch chat                                 │
│   💬 API debugging                          │
│   💬 Feature planning                       │
├─────────────────────────────────────────────┤
│ Settings                                    │
│   ⚙ Open settings            ⌘,             │
│   🎚 Toggle Pro mode         ⌘⇧P            │
└─────────────────────────────────────────────┘
```

### 7. Artifacts Panel (New - Inspired by Claude.ai)

When assistant generates code, tables, or complex content:

```
┌────────────────────┬─────────────────────────┐
│                    │  Artifact: main.py      │
│  Chat messages     │  ─────────────────────  │
│                    │  def main():            │
│                    │      config = load()    │
│                    │      process(config)    │
│                    │                         │
│                    │  [Copy] [DL] [Run(N/A)] │
└────────────────────┴─────────────────────────┘
```

**Behavior:**
- Auto-opens when code block > 10 lines
- Can be pinned or dismissed
- Supports: code, tables, diagrams (mermaid)
- Casual mode: Hidden, shows "View code" button
- Pro mode: Auto-opens in split pane
- Run button is a placeholder labeled `Run(N/A)` until sandbox execution is available

### 8. Chat Feedback System (Critical - New)

**Why Critical:** Chat feedback (👍/👎 + detailed reports) is required for quality tracking and future server-side analysis.

#### Quick Feedback (Always Visible)
```
┌──────────────────────────────────────────────┐
│ 🤖  The main function handles...              │
│     ...                                      │
│                                              │
│ [🔊 Play] [📋 Copy] [↻ Regenerate] [🔀 Fork]    │
│                                              │
│ Was this helpful?  [👍] [👎]  [···]            │  ← NEW: Feedback row
└──────────────────────────────────────────────┘
```
Thumbs are the canonical chat ranking; submit to `/api/v1/feedback/explicit` with `feedback_type=helpful` + `helpful=true/false` (include `message_id`, optionally `conversation_id`). Mirror to `chat_rating` (5/1) for conversation metadata where needed.

#### Detailed Feedback Modal (Click 👎 or [···])
```
┌─────────────────────────────────────────────┐
│ Feedback                                [×] │
├─────────────────────────────────────────────┤
│ How would you rate this response?           │
│                                             │
│ [★] [★] [★] [☆] [☆]  3/5                    │
│                                             │
│ What was the issue? (select all that apply) │
│ ┌─────────────────────────────────────────┐ │
│ │ ☐ Incorrect information                 │ │
│ │ ☐ Not relevant to my question           │ │
│ │ ☐ Missing important details             │ │
│ │ ☐ Sources were unhelpful                │ │
│ │ ☐ Too verbose / Too brief               │ │
│ │ ☐ Other                                 │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Additional comments (optional):             │
│ ┌─────────────────────────────────────────┐ │
│ │                                         │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│              [Cancel]  [Submit Feedback]    │
└─────────────────────────────────────────────┘
```
Optional: a 1-5 detail rating can be captured here (send `feedback_type='relevance'` + `relevance_score`), but thumbs remain the primary chat ranking.

#### UI → Feedback Mapping
| UI Action | feedback_type | Payload Notes |
|-----------|---------------|---------------|
| 👍 Thumb | `helpful` | `helpful=true`, include `message_id` |
| 👎 Thumb | `helpful` | `helpful=false`, include `message_id` |
| ★ Rating (modal) | `relevance` | `relevance_score=1-5`, include `message_id` |
| "Report"/issues (modal) | `report` | `issues[]`, `user_notes`, include `message_id` |

#### Source-Level Feedback (Pro Mode)
When sources are expanded, allow per-source feedback:
```
📚 Sources (3)
┌────────────────────────────────────────┐
│ 📄 main.py:42                    [👍👎]│  ← Rate each source
│ 📄 utils.py:15                   [👍👎]│
│ 🌐 docs.example.com              [👍👎]│
└────────────────────────────────────────┘
```

#### Implicit Feedback (Automatic - No UI)
Track user behavior automatically:
- **Click tracking** - When user clicks a source link
- **Expand tracking** - When user expands sources or tool blocks
- **Copy tracking** - When user copies response text
- **Future** - Dwell time + citation usage (requires API support)

#### Server API Integration (Chat)

**Explicit feedback endpoint (chat + RAG):**
`POST /api/v1/feedback/explicit`

```typescript
interface ExplicitFeedbackRequest {
  conversation_id?: string
  message_id?: string
  feedback_type: 'helpful' | 'relevance' | 'report'
  helpful?: boolean
  relevance_score?: number
  document_ids?: string[]
  chunk_ids?: string[]
  corpus?: string
  issues?: string[]
  user_notes?: string
  query?: string
  session_id?: string
  idempotency_key?: string
}
```
If `message_id` is absent, `query` is required. Use `idempotency_key` for modal retries.

**Implicit feedback endpoint (RAG signals):**
`POST /api/v1/rag/feedback/implicit`

```typescript
interface ImplicitFeedbackEvent {
  event_type: 'click' | 'expand' | 'copy' | 'dwell_time' | 'citation_used'
  query?: string
  feedback_id?: string
  doc_id?: string
  chunk_ids?: string[]
  rank?: number
  impression_list?: string[]
  corpus?: string
  user_id?: string
  session_id?: string
  conversation_id?: string
  message_id?: string
  dwell_ms?: number
}
```
Use for source clicks/expands/copy events tied to RAG results. Best-effort only.

**Conversation metadata rating (optional):**
`POST /api/v1/chats/{chat_id}/completions/persist`

```typescript
interface CharacterChatStreamPersistRequest {
  assistant_content: string
  user_message_id?: string
  tool_calls?: Record<string, any>[]
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  chat_rating?: number // 1-5, map 👍 -> 5, 👎 -> 1
  ranking?: number
}
```

**Update rating after the fact:**
`PUT /api/v1/chats/{chat_id}?expected_version=...`

```json
{ "rating": 5 }
```

**Chat-specific implicit feedback (TBD):**
No chat-only implicit endpoint exists today; add one if we need implicit signals beyond RAG source interactions.

#### Feedback States
- **Not rated** - Default state, show 👍👎 buttons
- **Positive** - 👍 highlighted, 👎 dimmed
- **Negative** - 👎 highlighted, opens detailed feedback modal
- **Submitted** - Show "Thanks for your feedback" briefly

#### Feedback UX Guidelines
1. **Thumbs first** - 👍👎 is the primary ranking signal for chat
2. **Details on negative** - Only prompt for details on 👎
3. **Non-blocking** - Feedback submission is async, don't block UI
4. **Persist state** - Show feedback state if user revisits chat
5. **Aggregate view** - In Pro mode, show feedback stats in sidebar

---

## Casual ↔ Pro Mode Differences

| Feature | Casual | Pro |
|---------|--------|-----|
| Sidebar | Hidden, hamburger to reveal | Always visible |
| Composer | Single line, minimal | Multi-line, full toolbar |
| Model selector | Hidden (uses default) | Visible with settings |
| Provider/BYOK/Guardrails | Hidden (defaults only) | Visible in model params panel |
| Tools menu | Hidden (auto) | Visible with tool_choice |
| Keyboard shortcuts | Basic (Enter to send) | Full suite (Cmd+K, etc.) |
| Artifacts panel | Button to view | Auto-opens split pane |
| Message actions | Hover to reveal | Always visible |
| Voice input/playback | Mic + play on hover | Mic + play always visible |
| Reasoning | Hidden | Expandable |
| Threading | Disabled | Enabled |
| Context chips | Simplified | Detailed |
| Chat feedback | 👍👎 only | 👍👎 + source-level + detailed modal |

---

## Visual Design Direction

### Colors (Dark Mode Default)
- **Background:** `#0a0a0a` (near black, like Claude.ai)
- **Surface:** `#171717` (cards, sidebar)
- **Elevated:** `#262626` (modals, dropdowns)
- **Border:** `#333333` (subtle)
- **Accent:** `#3b82f6` (blue) or brand color
- **Text:** `#fafafa` (primary), `#a1a1aa` (secondary)

### Typography
- **Font:** Inter or system-ui (clean, modern)
- **Sizes:** 14px base, 13px secondary, 12px captions
- **Message text:** 15px for readability

### Spacing
- **Base unit:** 4px
- **Component padding:** 12px-16px
- **Message gap:** 16px
- **Sidebar width:** 260px (collapsible)

### Animations
- **Transitions:** 150ms ease-out (fast, responsive)
- **Message entry:** Fade-in + slight slide-up
- **Sidebar:** Slide from left, 200ms
- **Command palette:** Scale + fade, 150ms
- Respect `prefers-reduced-motion`

---

## Missing Features to Add

### High Priority (Core UX)
1. **Chat Feedback System** - 👍👎 + detailed modal + implicit tracking (CRITICAL - explicit endpoint exists; implicit TBD)
2. **Cmd+K Command Palette** - Central discoverability hub
3. **Unified Sidebar** - Replace tabs + drawer
4. **Context Chips** - Visual input context
5. **Collapsible Reasoning** - Show thinking on demand
6. **Mode Toggle** - Casual ↔ Pro switch
7. **Surface parity pass** - Ensure Main Chat + Sidepanel + Settings stay in sync

### Medium Priority (UX Polish)
8. **Artifacts Panel** - Side panel for code/content
9. **Inline Sources** - Replace popup with expandable
10. **Message Threading** - Reply to specific messages
11. **Chat Pinning** - Star important conversations
12. **Search All Chats** - Cmd+K search across history

### API Feature Coverage (Server Capabilities)
13. **Model + Provider Parameters Panel** - Temperature/top_p/max_tokens plus provider/BYOK/guardrails (Pro mode)
14. **Slash Command Discovery** - `/` shows available commands from server
15. **Conversation Forking** - Fork from any message to create branch
16. **Conversation States** - Mark as resolved, backlog, non-viable
17. **Topic Labels** - Tag conversations for organization
18. **Export Conversations** - Export to JSON/Markdown
19. **Citation Style Selector** - APA, MLA, Chicago, IEEE, Harvard
20. **Token Usage Display** - Show prompt/completion tokens after response
21. **Character Context** - Select character for context injection
22. **Chat Dictionaries** - Custom term definitions per conversation
23. **Prompt Templates** - Select/apply prompt templates
24. **Tool/Function Calling UI** - Tools menu + tool_choice + tool call display
25. **Chat Snippet Save** - Save snippets to Notes/Flashcards (`/api/v1/chat/knowledge/save`)
26. **Document Generator** - Create docs from conversations (`/api/v1/chat/documents/*`)
27. **Chatbooks Import/Export** - Portable exports + imports (`/api/v1/chatbooks/*`)
28. **Dictionary Validation/Preview** - Validate + preview transforms (`/api/v1/chat/dictionaries/validate`, `/api/v1/chat/dictionaries/process`)
29. **Chat Queue Diagnostics** - Queue status/activity in Health (`/api/v1/chat/queue/status`, `/api/v1/chat/queue/activity`)
30. **Chat Persistence Controls** - `save_to_db`, `conversation_id`, `history_message_limit/order`, `slash_command_injection_mode`
31. **Character Completion v2** - Wire `/api/v1/chats/{id}/complete-v2` where needed
32. **STT/TTS For Chat** - Voice input + response playback (`/api/v1/audio/transcriptions`, `/api/v1/audio/speech`)
33. **MCP Tool Discovery/Execution** - Tool list + auth gating (`/api/v1/mcp/tools`, `/api/v1/mcp/health`)

### Lower Priority (Nice to Have)
34. **Undo Send** - 3-second cancel window
35. **Voice Mode** - Full-screen voice input
36. **High Contrast Theme** - Accessibility

> **Note:** Quick Reactions (👍/👎) are the primary chat ranking signal.

---

## Implementation Phases

### Phase 0: Chat Feedback System (CRITICAL - Do First)
- [x] Integrate `POST /api/v1/feedback/explicit` for chat feedback; confirm implicit chat endpoint scope
- [x] Create `src/components/Sidepanel/Chat/FeedbackButtons.tsx` - 👍👎 buttons
- [x] Create `src/components/Sidepanel/Chat/FeedbackModal.tsx` - Detailed feedback form
- [x] Create `src/components/Sidepanel/Chat/SourceFeedback.tsx` - Per-source ratings
- [x] Create `src/services/feedback.ts` - API client for chat feedback endpoints
- [x] Wire 👍/👎 to `/api/v1/feedback/explicit` (helpful) and mirror to `chat_rating` on `/api/v1/chats/{chat_id}/completions/persist` + post-hoc `PUT /api/v1/chats/{chat_id}`
- [x] Create `src/hooks/useFeedback.tsx` - Feedback state and submission
- [x] Create `src/hooks/useImplicitFeedback.tsx` - Click, copy, expand tracking
- [x] Add feedback buttons to `PlaygroundMessage.tsx`
- [x] Add feedback state to chat store
- [x] Add locale strings for feedback UI

### Phase 1: Sidebar + Navigation
- [x] Create new layout shell with sidebar + main area
- [x] Build `Sidebar.tsx` component with:
  - Search/filter chats
  - Pinned section
  - Grouped by date (Today, Yesterday, etc.)
  - Mode toggle (Casual/Pro) at bottom (Main Chat + Sidepanel)
- [x] Hamburger toggle for narrow widths (< 400px) with overlay behavior
- [x] Remove old tabs component and drawer
- [x] Migrate chat switching logic to sidebar
- [x] Update header to minimal version (logo, title, settings)

### Phase 2: Visual Foundation
- [x] Update color tokens in Tailwind config (darker backgrounds like Claude.ai)
- [x] Update typography scale
- [x] Apply new spacing system (4px base unit)
- [x] Create consistent component styling (cards, buttons, inputs)
- [x] Implement Casual/Pro mode state store

### Phase 3: Composer Redesign
- [x] Build context chips component (attached images, @mentions) across Main Chat + Sidepanel
- [x] Redesign composer layout:
  - Casual: Single-line, minimal
  - Pro: Multi-line with full toolbar
- [x] Add slash commands parser + menu (`/search`, `/vision`, `/model`) in Main Chat + Sidepanel
- [x] Add Tools menu + tool_choice controls in Pro toolbar (Main Chat + Sidepanel)
- [x] Build Cmd+K command palette modal (global: Main Chat + Sidepanel + Settings)
- [x] Mirror slash commands + tool_choice + Cmd+K in Options/Playground (parity pass)
- [x] Update model/prompt selectors styling

### Phase 3b: Server Parity (P0)
- [x] Wire `tool_choice` through all chat paths (normal/rag/vision + PlaygroundForm)
- [x] Add `save_to_db`, `conversation_id`, `history_message_limit/order` controls to chat requests
- [x] Expose `slash_command_injection_mode` in settings
- [x] Add provider selector + BYOK/guardrails panel (`api_provider`, `extra_headers`, `extra_body`)
- [x] Add "Save to Notes/Flashcard" message actions (`/api/v1/chat/knowledge/save`)
- [x] Add dictionary validation + preview transforms (`/api/v1/chat/dictionaries/validate`, `/process`)
- [x] Add document generator panel + message action (`/api/v1/chat/documents/*`)
- [x] Add chatbooks import/export settings (`/api/v1/chatbooks/*`)
- [x] Add chat queue status/activity to diagnostics (`/api/v1/chat/queue/status`, `/activity`)
- [x] Wire character completion v2 for server-backed chats (`/api/v1/chats/{id}/complete-v2`)
- [x] Add voice input + response playback (`/api/v1/audio/transcriptions`, `/api/v1/audio/speech`, voices catalog)
- [x] Integrate MCP tool discovery + health gating (`/api/v1/mcp/tools`, `/api/v1/mcp/health`)

### Phase 4: Message Display
- [x] Add collapsible reasoning sections to bot messages
- [x] Replace source popups with inline expandable sources
- [x] Redesign message action bar (Copy, Regenerate, etc.)
- [x] Update user/bot message styling
- [x] Add threading support for Pro mode (reply to specific messages)

### Phase 5: Advanced Features + Polish
- [x] Artifacts panel (split view for code blocks)
- [x] Chat pinning functionality
- [x] Animation/transition pass (150ms ease-out)
- [x] Keyboard shortcuts audit
- [x] Accessibility audit (focus rings, ARIA)
- [x] Performance testing (virtual scroll, bundle size)

---

## Current Implementation Status

- **Phase 0 (Chat Feedback):** Complete. Feedback components, API client, hooks/store, i18n, and E2E coverage are implemented.
- **Phase 1 (Sidebar + Navigation):** Mostly complete. Main chat sidebar (search/pins/groups), docked vs overlay behavior, minimal header, and mode toggle are live. Mode toggle is now in the left nav footer for Main Chat and Sidepanel. Remaining: run main chat + sidepanel regression passes (Playwright spec added).
- **Phase 2 (Visual Foundation):** In progress. Tokens/typography and shared component styles now cover Main Chat (Options/Playground), Sidepanel, and Settings surfaces: chat/option sidebars + local/server lists, message/attachment UI, compact messages, edit forms, feedback/status elements, the web UI playground shell (drop overlays + scroll-to-latest + new chat), Media/Review + Notes/Knowledge, onboarding flows (wizard + connect form), core settings pages (general/system/search/SST/TTS/chat/health/tldw/rag/model/evaluations), models list/refresh, flashcards + quiz workspaces, agent UI surfaces (diff viewer, approvals, session history, workspace selector, tool call log, error boundaries), and common settings/prompt/search/share/command palette + button/empty/setting-group/omni-search/connection/quick-chat/keyboard-shortcuts components. Added coverage for Quick Ingest modal, dictionaries/world books/characters workspaces, processed view, the PromptStudio/Evaluations/TTS/Speech playground shells, terminal/codeblock surfaces (CodeBlock, TerminalOutput, eval code previews), and the 4px spacing pass across header/sidebar/messages/composer. Remaining: run a final visual QA pass on edge cases (Playwright spec added).
- **Phase 3 (Composer Redesign):** Complete with surface parity. Context chips, the Casual vs Pro composer split, slash commands, tools menu/tool_choice, Cmd+K palette, and selector styling updates are in place in both Main Chat and Sidepanel. Tool choice is wired through normal/RAG/vision chat paths; model params panel is reachable from composer actions.
- **Phase 3b (Server Parity):** Complete. Requests now honor `save_to_db` + `conversation_id`, history message limit/order, slash command injection mode, provider/BYOK overrides (extra headers/body), and MCP tool discovery with health gating.
- **Phase 4 (Message Display):** Complete. Collapsible reasoning sections, inline sources, action bar redesign, message styling, and Pro mode threading are implemented.
- **Phase 5 (Advanced Features + Polish):** Complete. Artifacts panel split view is implemented for code blocks with auto-open, pin/dismiss, and manual view controls (tables and diagrams now open in the artifacts panel); server chat pinning is now supported in main chat sidebars (including legacy fallback); core UI transitions have been normalized to 150ms ease-out on shared buttons and panels with reduced-motion handling; keyboard shortcuts are documented in `docs/shortcuts.md`, and the accessibility audit is tracked in `docs/a11y-audit.md` (draft); bundle-size reporting is available alongside existing perf suites, and vendor chunking has been added to reduce mega-chunks. QA: `tests/e2e/artifacts-split-view.spec.ts`, `tests/e2e/performance-smoke-lite.spec.ts`.

## Files to Modify

### Core Components
**Main Chat (Options/Playground)**
- `src/components/Option/Playground/PlaygroundForm.tsx` - Composer + slash commands + tool_choice
- `src/components/Common/Playground/Message.tsx` - Message actions + feedback
- `src/components/Common/CommandPalette.tsx` - Cmd+K palette + scoped behavior
- `src/components/Common/ChatSidebar.tsx` - Main chat sidebar (mode toggle in footer)
- `src/components/Option/Sidebar.tsx` - Legacy sidebar fallback (mode toggle in footer)
- `src/hooks/useMessageOption.tsx` - Chat settings + tool_choice state
- `src/models/ChatTldw.ts` - tool_choice propagation to API

**Sidepanel Chat**
- `src/routes/sidepanel-chat.tsx` - Main restructure
- `src/components/Sidepanel/Chat/body.tsx` - Message display
- `src/components/Sidepanel/Chat/form.tsx` - Composer redesign
- `src/components/Sidepanel/Chat/SidepanelHeaderSimple.tsx` - Simplify

### New Components to Create

**Chat Feedback System (Phase 0 - Critical):**
- `src/components/Sidepanel/Chat/FeedbackButtons.tsx` - 👍👎 quick feedback
- `src/components/Sidepanel/Chat/FeedbackModal.tsx` - Detailed feedback form
- `src/components/Sidepanel/Chat/SourceFeedback.tsx` - Per-source ratings
- `src/services/feedback.ts` - Chat feedback API client
- `src/hooks/useFeedback.tsx` - Feedback state management
- `src/hooks/useImplicitFeedback.tsx` - Implicit tracking (clicks, copies, expands)

**UI Components (Phases 1-5):**
- `src/components/Sidepanel/Chat/Sidebar.tsx` - Unified sidebar
- `src/components/Sidepanel/Chat/CommandPalette.tsx` - Cmd+K
- `src/components/Sidepanel/Chat/ContextChips.tsx` - Input context
- `src/components/Sidepanel/Chat/ArtifactsPanel.tsx` - Code viewer
- `src/components/Sidepanel/Chat/ModeToggle.tsx` - Casual/Pro
- `src/components/Sidepanel/Chat/SlashCommandMenu.tsx` - `/` command discovery
- `src/components/Sidepanel/Chat/ModelParamsPanel.tsx` - Model parameters
- `src/components/Sidepanel/Chat/ToolCallBlock.tsx` - Tool call display

### State
- `src/store/ui-mode.tsx` - New store for Casual/Pro state
- `src/store/feedback.tsx` - Feedback state per chat + message (rating, submitted status)

### Styles
- `tailwind.config.js` - New color tokens
- `src/assets/styles/` - Any global style updates

---

## Server API Feature Coverage

### Chat Completions API (`POST /api/v1/chat/completions`)

**Supported in UI:**
| Parameter | UI Location | Mode |
|-----------|-------------|------|
| `model` | Model selector dropdown | Both |
| `stream` | Always enabled | Both |
| `messages` | Chat history | Both |
| `temperature` | Model params panel | Pro |
| `top_p` | Model params panel | Pro |
| `topk` | Model params panel (Top K) | Pro |
| `max_tokens` | Model params panel | Pro |
| `frequency_penalty` | Model params panel | Pro |
| `presence_penalty` | Model params panel | Pro |
| `tools` | Tools menu selection + tool call display | Pro |
| `tool_choice` | Tools menu (auto/required/none) | Pro |
| `response_format` | JSON mode toggle | Pro |
| `save_to_db` | Save status icon + Pro toggle | Both |
| `conversation_id` | Session binding control | Pro |
| `prompt_template_name` | Template dropdown | Pro |
| `history_message_limit` | Advanced context panel | Pro |
| `history_message_order` | Advanced context panel | Pro |
| `slash_command_injection_mode` | Settings injection mode | Pro |
| `api_provider` | Provider selector + BYOK panel | Pro |
| `logit_bias` | Advanced model params | Pro |
| `logprobs` | Advanced model params | Pro |
| `top_logprobs` | Advanced model params | Pro |
| `seed` | Advanced model params | Pro |
| `stop` | Advanced model params | Pro |
| `n` | Advanced model params | Pro |
| `user` | Auto-filled (profile/session) | Both |
| `extra_headers` | Guardrails panel (BYOK) | Pro |
| `extra_body` | Guardrails panel (BYOK) | Pro |
| `minp` | Advanced model params (Min P) | Pro |

**Image Support:**
- Base64 image attachments via context chips
- Vision mode toggle enables image analysis

### RAG API (`POST /api/v1/rag/search`)

**UI Controls:**
| Feature | UI Location | Mode |
|---------|-------------|------|
| `sources` selection | RAG panel (media_db, notes, characters, chats) | Pro |
| `search_mode` | Toggle: FTS / Vector / Hybrid | Pro |
| `top_k` | Results count slider | Pro |
| `enable_citations` | Auto-enabled | Both |
| `citation_style` | Dropdown in settings | Pro |

**Additional Endpoints:**
- `POST /api/v1/rag/search/stream` for streaming results (Pro).
- `POST /api/v1/rag/simple` for minimal RAG (Casual).
- `GET /api/v1/rag/health` and `GET /api/v1/rag/capabilities` to gate UI.

### Audio (STT/TTS) For Chat

**UI Entry Points:**
- Mic button in composer → `POST /api/v1/audio/transcriptions` (voice to text).
- Play button on assistant messages (message action bar) → `POST /api/v1/audio/speech` (text to speech).
- Voice selection + availability → `GET /api/v1/audio/voices/catalog`, `GET /api/v1/audio/providers`, `GET /api/v1/audio/health`.

**TTS Fallback Acceptance Criteria:**
- If `GET /api/v1/audio/voices/catalog` returns empty, hide or disable Play and surface "No voices available".
- If `GET /api/v1/audio/health` is unhealthy, disable Play and show a non-blocking status hint; chat remains usable.
- If `POST /api/v1/audio/speech` fails, show a transient error with a retry option and keep the message text intact.
- If policy/guardrails disable TTS, Play is hidden and Settings shows the reason.

### Conversation Management

**UI Features:**
| Feature | UI Location |
|---------|-------------|
| Create conversation | New chat button |
| List conversations | Sidebar |
| Update title | Inline edit in sidebar/header |
| Delete conversation | Context menu in sidebar |
| Fork conversation | "Fork from here" on any message |
| Conversation states | Status dropdown (in-progress, resolved, backlog) |
| Topic labels | Tag chips in sidebar items |
| Export | Menu action → JSON/Markdown |

### Chat Feedback (Sessions)

**UI Entry Points:**
- Thumbs row under assistant messages
- Detailed feedback modal from [···] or 👎

**Existing Endpoints:**
- `POST /api/v1/feedback/explicit` for thumbs + detailed chat feedback (`ExplicitFeedbackRequest`).
- `POST /api/v1/chats/{chat_id}/completions/persist` with `chat_rating` (map 👍 → 5, 👎 → 1) for conversation metadata.
- `PUT /api/v1/chats/{chat_id}?expected_version=...` with `rating` for post-hoc updates.

**State Handling (Not User-Editable):**
- `message_id` stored on message objects from server responses; used only in `/api/v1/feedback/explicit`.
- `expected_version` stored on chat session objects from chat list/detail; used only in `PUT /api/v1/chats/{chat_id}`.
- Both values remain internal to state; never surfaced in the UI.

**Server Additions Required:**
- Implicit chat feedback endpoint for `ChatImplicitFeedbackEvent` (if we want chat-specific implicit signals).

### Message Features

**UI Presentation:**
| Feature | UI Location |
|---------|-------------|
| User messages | Right-aligned bubbles with context chips |
| Assistant messages | Left-aligned with collapsible reasoning |
| Tool calls | Expandable "Tool: {name}" blocks |
| Sources/citations | Inline expandable section |
| Voice playback | Play button on assistant messages |
| Token usage | Subtle footer on assistant messages |
| Edit message | Edit button → regenerate |
| Branch/fork | Fork button on any message |

### Tools + MCP Integration

**Discovery + Auth:**
- Tool list sourced from `GET /api/v1/mcp/tools` (RBAC-filtered, catalog-aware).
- Health gating via `GET /api/v1/mcp/health` and optional status via `GET /api/v1/mcp/status`.
- Optional direct execution for testing/diagnostics: `POST /api/v1/mcp/tools/execute`.

### Slash Commands

**Discovery UI:**
- Type `/` in composer → dropdown with commands from `GET /api/v1/chat/commands`
- Shows command name, description, required permissions
- Filtered by user's permissions
- Injection mode override (system/preface/replace) is configurable in settings and sent via `slash_command_injection_mode`

### Character & Prompt Context

**UI Controls:**
| Feature | UI Location | Mode |
|---------|-------------|------|
| Character selector | Dropdown in composer toolbar | Pro |
| Prompt template | Dropdown in composer toolbar | Pro |
| Chat dictionaries | Settings panel per conversation | Pro |

### Chat Documents (`/api/v1/chat/documents/*`)

**UI Entry Points:**
- Message action: "Create doc" (Casual + Pro)
- Pro: Docs panel in Playground with async job status + history
- Pro: Doc settings for prompt presets per document type

**Endpoints Represented:**
- Generate: `POST /api/v1/chat/documents/generate` (sync/async)
- Jobs: `GET /api/v1/chat/documents/jobs/{job_id}`, `DELETE /api/v1/chat/documents/jobs/{job_id}`
- List/get/delete: `GET /api/v1/chat/documents`, `GET /api/v1/chat/documents/{document_id}`, `DELETE /api/v1/chat/documents/{document_id}`
- Prompt config: `POST /api/v1/chat/documents/prompts`, `GET /api/v1/chat/documents/prompts/{document_type}`
- Bulk generate: `POST /api/v1/chat/documents/bulk`
- Stats: `GET /api/v1/chat/documents/statistics`

### Chatbooks Import/Export (`/api/v1/chatbooks/*`)

**UI Entry Points:**
- Settings → Chatbooks: export/import chatbooks, view job status, download artifacts

**Endpoints Represented:**
- Health: `GET /api/v1/chatbooks/health`
- Export/import/preview: `POST /api/v1/chatbooks/export`, `POST /api/v1/chatbooks/import`, `POST /api/v1/chatbooks/preview`
- Jobs: `GET /api/v1/chatbooks/export/jobs`, `GET /api/v1/chatbooks/import/jobs`
- Job status: `GET /api/v1/chatbooks/export/jobs/{job_id}`, `GET /api/v1/chatbooks/import/jobs/{job_id}`
- Cancel jobs: `DELETE /api/v1/chatbooks/export/jobs/{job_id}`, `DELETE /api/v1/chatbooks/import/jobs/{job_id}`
- Download: `GET /api/v1/chatbooks/download/{job_id}`
- Cleanup: `POST /api/v1/chatbooks/cleanup`

### Chat Dictionary Validation/Preview

**UI Entry Points:**
- Dictionaries manager: validate JSON, preview transformations before activation
- Endpoints: `/api/v1/chat/dictionaries/validate`, `/api/v1/chat/dictionaries/process`

**Additional Coverage:**
- Import/export: `POST /api/v1/chat/dictionaries/import/json`, `GET /api/v1/chat/dictionaries/{id}/export/json`, `GET /api/v1/chat/dictionaries/{id}/export/markdown`
- Stats: `GET /api/v1/chat/dictionaries/{id}/statistics`
- Entry management: `GET /api/v1/chat/dictionaries/{id}/entries`, `POST /api/v1/chat/dictionaries/{id}/entries`, `PUT /api/v1/chat/dictionaries/entries/{entry_id}`, `DELETE /api/v1/chat/dictionaries/entries/{entry_id}`

### Chat Knowledge Save (`/api/v1/chat/knowledge/save`)

**UI Entry Points:**
- Message actions: "Save to Notes" / "Save to Flashcard"
- Pro: batch save from Playground
- Optional export target selector when connectors are enabled (`export_to`)

### Chat Queue Diagnostics (`/api/v1/chat/queue/status`, `/api/v1/chat/queue/activity`)

**UI Entry Points:**
- Health & diagnostics panel (shows queue status + recent activity)

### Character Completion v2 (`/api/v1/chats/{id}/complete-v2`)

**UI Note:**
- Use `/complete-v2` for server-backed character chats where applicable (internal wiring).

---

## Decisions Made

1. **Narrow sidepanel (< 400px)** - Hamburger toggle opens sidebar as overlay on top of chat
2. **Migration approach** - Complete replacement of existing UI
3. **Platform** - Desktop browser extension only (no mobile/touch considerations)
4. **Existing settings** - Preserved; new UI reads from same stores

## Remaining Questions

1. **Keyboard shortcut conflicts** - Need to audit browser/OS conflicts
2. **Performance budget** - What's acceptable initial load time?

---

## Next Steps

### Immediate: Phase 0 - Chat Feedback System (Do First)
1. Integrate `POST /api/v1/feedback/explicit`; decide implicit chat endpoint scope
2. Create `src/services/feedback.ts` - API client for `/api/v1/feedback/explicit` + rating updates
3. Wire 👍/👎 to `/api/v1/feedback/explicit` (helpful) and mirror to `chat_rating` on `/api/v1/chats/{chat_id}/completions/persist` + post-hoc `PUT /api/v1/chats/{chat_id}`
4. Create `src/hooks/useFeedback.tsx` - Feedback state and submission logic
5. Create `src/components/Sidepanel/Chat/FeedbackButtons.tsx` - 👍👎 UI
6. Add feedback buttons to `src/components/Common/Playground/Message.tsx`
7. Create `src/hooks/useImplicitFeedback.tsx` - Click/copy/expand tracking
8. Create `src/components/Sidepanel/Chat/FeedbackModal.tsx` - Detailed feedback form
9. Add feedback locale strings to `src/assets/locale/`

### Then: Phase 1 - Sidebar + Navigation
1. Create `src/store/ui-mode.tsx` - Casual/Pro mode state store
2. Create `src/components/Sidepanel/Chat/Sidebar.tsx` - New unified sidebar
3. Create `src/components/Sidepanel/Chat/SidebarOverlay.tsx` - Overlay wrapper for narrow widths
4. Modify `src/routes/sidepanel-chat.tsx` - New layout structure with sidebar
5. Remove/deprecate `src/components/Sidepanel/Chat/Tabs.tsx`
6. Simplify `src/components/Sidepanel/Chat/SidepanelHeaderSimple.tsx`

### Then: Phase 2 - Visual Foundation
1. Update `tailwind.config.js` with new color tokens (background/surface/elevated/border/accent)
2. Define typography scale and apply base text sizes for chat, composer, and captions
3. Normalize spacing to a 4px base unit across header, sidebar, messages, composer
4. Create consistent component styles for cards, buttons, inputs, and menus
5. Hook `ui-mode` into layout density and visibility rules (Casual vs Pro)

### Then: Phase 3 - Composer Redesign
1. Build `ContextChips.tsx` for attached files/images/@mentions (Main Chat + Sidepanel)
2. Redesign composer layout for Casual (single-line) and Pro (multi-row toolbar)
3. Implement slash command parsing + `SlashCommandMenu.tsx` in both surfaces
4. Add tools menu + tool_choice controls in Pro toolbar (Main Chat + Sidepanel)
5. Add model params panel for generation controls and provider settings
6. Implement Cmd+K command palette modal and keyboard shortcuts (global)
7. Mirror slash commands + tool_choice + Cmd+K in Options/Playground (parity pass)
8. Update model/prompt selectors to match new visual foundation

### Then: Phase 3b - Server Parity (P0)
1. Wire `tool_choice` through all chat paths (normal/rag/vision + PlaygroundForm)
2. Add `save_to_db`, `conversation_id`, `history_message_limit/order` controls to chat requests
3. Expose `slash_command_injection_mode` in settings and wire to requests
4. Add provider selector + BYOK/guardrails (`api_provider`, `extra_headers`, `extra_body`)
5. Add "Save to Notes/Flashcard" actions (`/api/v1/chat/knowledge/save`)
6. Add dictionary validation + preview transforms (`/api/v1/chat/dictionaries/*`)
7. Add document generator panel + message actions (`/api/v1/chat/documents/*`) ✅
8. Add chatbooks import/export settings + job views (`/api/v1/chatbooks/*`) ✅
9. Add chat queue status/activity to diagnostics (`/api/v1/chat/queue/*`) ✅
10. Wire character completion v2 for server-backed chats (`/api/v1/chats/{id}/complete-v2`) ✅
11. Add voice input + response playback (`/api/v1/audio/*`) ✅
12. Integrate MCP tool discovery + health gating (`/api/v1/mcp/*`) ✅

### Then: Phase 4 - Message Display
1. Add collapsible reasoning sections to assistant messages
2. Replace source popups with inline expandable sources
3. Redesign message action bar (Copy, Regenerate, Fork, Reply, Play)
4. Update user/assistant message styling to match new layout
5. Add threading support in Pro mode (reply to specific messages)

### Then: Phase 5 - Advanced Features + Polish
1. Implement artifacts panel split view for code/tables/diagrams
2. Add chat pinning and pinned section behaviors
3. Run animation/transition pass (150ms ease-out, prefers-reduced-motion)
4. Audit and document keyboard shortcuts (conflict review)
5. Accessibility audit (focus rings, ARIA, contrast)
6. Performance testing (virtual scroll, bundle size, large chat histories)

---

## Acceptance Criteria & QA Checks (Per Phase)

### Phase 0 - Chat Feedback System
- 👍/👎 submits `POST /api/v1/feedback/explicit` with `message_id` and updates UI state without blocking chat.
- 👎 opens the detailed modal; submitting sends rating/issues/user_notes and shows a transient "thanks" state.
- Feedback state persists when revisiting a chat; retries use `idempotency_key`.
- Source-level feedback (Pro) submits per-source ratings and never blocks rendering.
- Implicit events (click/expand/copy) are fire-and-forget; failures do not surface to users.
- Locale strings exist for buttons, modal labels, and error states.

### Phase 1 - Sidebar + Navigation
- Sidebar is hidden by default in Casual and always visible in Pro; toggle works and remembers mode.
- Narrow widths (< 400px) use overlay behavior with correct focus trapping and close affordance.
- Chat switching, pinning, and search filtering work from the sidebar without breaking history state.
- Minimal header renders logo/title/settings and no longer shows legacy tabs/drawer.
- Main chat and sidepanel Playwright smoke suites pass without regressions.
- Main chat left nav shows the Casual/Pro toggle in the footer; switching modes updates density and persists.
- Collapsing the Main Chat sidebar preserves access to the Mode toggle via re-expansion (no mode lockout).

### Phase 2 - Visual Foundation
- New color tokens apply across backgrounds, surfaces, borders, and primary accents.
- Typography scale matches spec (14px base, 15px message text, 12-13px secondary).
- Spacing uses a 4px base unit across header, sidebar, messages, and composer.
- Core components (cards/buttons/inputs/menus) share consistent styling tokens.
- Casual vs Pro density rules apply consistently across layout and spacing.

### Phase 3 - Composer Redesign
- Casual composer is single-line, expands on focus, and auto-selects model/tools.
- Pro composer exposes toolbars, model params, and context chips with remove actions.
- Slash command menu fetches `/api/v1/chat/commands`, supports fuzzy filter and keyboard navigation.
- Cmd+K opens a command palette; Esc closes; shortcuts do not interfere with typing.
- Model params panel updates generation settings and persists per chat/session.
- Slash commands, tool_choice, and Cmd+K behaviors match between Main Chat and Sidepanel.

### Phase 3b - Server Parity (P0)
- Chat requests include `save_to_db`, `conversation_id`, and history limits when configured.
- Provider/BYOK/guardrails map to `api_provider`, `extra_headers`, and `extra_body` correctly.
- Knowledge save, dictionary validation/preview, documents, and chatbooks flows call their endpoints and show success/error states.
- Queue diagnostics surfaces status/activity without blocking core chat.
- Voice input/playback hides or disables when audio endpoints are unhealthy or empty.
- MCP tool discovery honors health gating and permissions.

### Phase 4 - Message Display
- Reasoning and tool blocks are collapsible and default to the correct state per mode.
- Sources render inline with expand/collapse and optional per-source feedback in Pro.
- Action bar includes Copy/Regenerate/Fork/Reply/Play with hover or always-visible rules by mode.
- Threading works in Pro without breaking linear history in Casual.
- Message styling matches the new visual foundation and is accessible via ARIA labels.

### Phase 5 - Advanced Features + Polish
- Artifacts panel auto-opens for large code blocks, can be pinned/dismissed, and does not disrupt chat scroll.
- Pinned chats are visible and persistent across reloads.
- Animation timings follow spec and respect `prefers-reduced-motion`.
- Keyboard shortcut audit documented with any browser/OS conflicts noted.
- Accessibility pass confirms focus rings, contrast, and semantic roles.
- Performance smoke tests cover long histories and virtualized rendering.

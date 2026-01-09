# Chat UI Redesign Plan

## Design Goals
1. **Declutter** - Reduce visual noise while maintaining power
2. **Modernize** - Match ChatGPT/Claude.ai visual standards
3. **Add missing features** - Threading, artifacts, better context awareness
4. **Improve discoverability** - Surface features at the right moment
5. **Dual-mode** - Casual ↔ Pro mode toggle

---

## Core Design Philosophy

### "Progressive Complexity"
Inspired by Linear/Notion: Start minimal, reveal depth on demand.

- **Casual Mode**: Clean, focused, guided experience
- **Pro Mode**: Full keyboard control, dense information, customization

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
│ ⚙ Settings          │
│ 🎚 [Casual|Pro] ●○  │  ← Mode toggle
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
│ [📋 Copy] [↻ Regenerate] [🔀 Fork] [💬 Reply]│
│ ─────────────────────────────────────────────│
│ 127 prompt + 89 completion = 216 tokens      │  ← Pro mode only
└──────────────────────────────────────────────┘
```

**New Features:**
- **Collapsible reasoning** - Show chain-of-thought on demand
- **Tool call display** - Show function calls and results
- **Inline sources** - No popup, expandable inline
- **Fork from message** - Create conversation branch
- **Reply/threading** - Create sub-conversations (Pro mode)
- **Token usage** - Show prompt/completion tokens (Pro mode)
- **Feedback buttons** - 👍/👎 + detailed feedback (see Feedback System section)

### 4. Composer (Reimagined)

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
│ [Model ▼] [⚙] [Character ▼] [Template ▼]   │  ← Row 1: Model & context
│ [🔍 Search] [📚 RAG] [👁 Vision] [JSON]     │  ← Row 2: Mode toggles
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
│ Top K            [●──────────] 40           │
│ Max Tokens       [────────●──] 4096         │
│ Freq Penalty     [────●──────] 0.0          │
│ Presence Penalty [────●──────] 0.0          │
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
- **Character selector** - Inject character context
- **Prompt templates** - Apply predefined prompts
- **JSON mode** - Request structured output

### 5. Slash Command Discovery (New)

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
│                    │  [Copy] [Download] [Run]│
└────────────────────┴─────────────────────────┘
```

**Behavior:**
- Auto-opens when code block > 10 lines
- Can be pinned or dismissed
- Supports: code, tables, diagrams (mermaid)
- Casual mode: Hidden, shows "View code" button
- Pro mode: Auto-opens in split pane

### 8. Feedback System (Critical - New)

**Why Critical:** Server has complete feedback infrastructure ready (`UnifiedFeedbackSystem`) but extension has 0% implementation. Feedback improves RAG quality via feedback-based reranking.

#### Quick Feedback (Always Visible)
```
┌──────────────────────────────────────────────┐
│ 🤖  The main function handles...             │
│     ...                                      │
│                                              │
│ [📋 Copy] [↻ Regenerate] [🔀 Fork] [💬 Reply]│
│                                              │
│ Was this helpful?  [👍] [👎]  [···]          │  ← NEW: Feedback row
└──────────────────────────────────────────────┘
```

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
- **Copy tracking** - When user copies response text
- **Dwell time** - Time spent viewing response before scrolling
- **Citation used** - If user references the response later

#### Server API Integration

**Endpoint:** `POST /api/v1/rag/feedback/implicit`

**Explicit Feedback Payload:**
```typescript
interface FeedbackPayload {
  conversation_id: string
  message_id: string
  feedback_type: 'helpful' | 'relevance' | 'report'
  helpful?: boolean           // true = 👍, false = 👎
  relevance_score?: number    // 1-5 stars
  document_ids?: string[]     // Source documents rated
  chunk_ids?: string[]        // Specific chunks rated
  user_notes?: string         // Free-form comments
  issues?: string[]           // Selected issue categories
}
```

**Implicit Feedback Payload:**
```typescript
interface ImplicitFeedbackEvent {
  event_type: 'click' | 'expand' | 'copy' | 'dwell_time'
  query: string
  doc_id?: string
  rank?: number               // Position in results
  impression_list?: string[]  // All visible docs
  dwell_ms?: number           // Time in milliseconds
  session_id: string
}
```

#### Feedback States
- **Not rated** - Default state, show 👍👎 buttons
- **Positive** - 👍 highlighted, 👎 dimmed
- **Negative** - 👎 highlighted, opens detailed feedback modal
- **Submitted** - Show "Thanks for your feedback" briefly

#### Feedback UX Guidelines
1. **Low friction first** - 👍👎 are single-click, no modal
2. **Details on negative** - Only prompt for details on 👎
3. **Non-blocking** - Feedback submission is async, don't block UI
4. **Persist state** - Show feedback state if user revisits message
5. **Aggregate view** - In Pro mode, show feedback stats in sidebar

---

## Casual ↔ Pro Mode Differences

| Feature | Casual | Pro |
|---------|--------|-----|
| Sidebar | Hidden, hamburger to reveal | Always visible |
| Composer | Single line, minimal | Multi-line, full toolbar |
| Model selector | Hidden (uses default) | Visible with settings |
| Keyboard shortcuts | Basic (Enter to send) | Full suite (Cmd+K, etc.) |
| Artifacts panel | Button to view | Auto-opens split pane |
| Message actions | Hover to reveal | Always visible |
| Reasoning | Hidden | Expandable |
| Threading | Disabled | Enabled |
| Context chips | Simplified | Detailed |
| **Feedback** | 👍👎 only | 👍👎 + source-level + detailed modal |

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
1. **Feedback System** - 👍👎 buttons + detailed modal + implicit tracking (CRITICAL - server ready, extension at 0%)
2. **Cmd+K Command Palette** - Central discoverability hub
3. **Unified Sidebar** - Replace tabs + drawer
4. **Context Chips** - Visual input context
5. **Collapsible Reasoning** - Show thinking on demand
6. **Mode Toggle** - Casual ↔ Pro switch

### Medium Priority (UX Polish)
7. **Artifacts Panel** - Side panel for code/content
8. **Inline Sources** - Replace popup with expandable
9. **Message Threading** - Reply to specific messages
10. **Chat Pinning** - Star important conversations
11. **Search All Chats** - Cmd+K search across history

### API Feature Coverage (Server Capabilities)
12. **Model Parameters Panel** - Temperature, top_p, max_tokens, etc. (Pro mode)
13. **Slash Command Discovery** - `/` shows available commands from server
14. **Conversation Forking** - Fork from any message to create branch
15. **Conversation States** - Mark as resolved, backlog, non-viable
16. **Topic Labels** - Tag conversations for organization
17. **Export Conversations** - Export to JSON/Markdown
18. **Citation Style Selector** - APA, MLA, Chicago, IEEE, Harvard
19. **Token Usage Display** - Show prompt/completion tokens after response
20. **Character Context** - Select character for context injection
21. **Chat Dictionaries** - Custom term definitions per conversation
22. **Prompt Templates** - Select/apply prompt templates
23. **Tool/Function Calling UI** - Display tool calls and results

### Lower Priority (Nice to Have)
24. **Undo Send** - 3-second cancel window
25. **Voice Mode** - Full-screen voice input
26. **High Contrast Theme** - Accessibility

> **Note:** Quick Reactions (👍/👎) moved to High Priority #1 as part of Feedback System

---

## Implementation Phases

### Phase 0: Feedback System (CRITICAL - Do First)
- [ ] Create `src/components/Sidepanel/Chat/FeedbackButtons.tsx` - 👍👎 buttons
- [ ] Create `src/components/Sidepanel/Chat/FeedbackModal.tsx` - Detailed feedback form
- [ ] Create `src/components/Sidepanel/Chat/SourceFeedback.tsx` - Per-source ratings
- [ ] Create `src/services/feedback.ts` - API client for feedback endpoints
- [ ] Create `src/hooks/useFeedback.tsx` - Feedback state and submission
- [ ] Create `src/hooks/useImplicitFeedback.tsx` - Click, copy, dwell tracking
- [ ] Add feedback buttons to `PlaygroundMessage.tsx`
- [ ] Add feedback state to message store
- [ ] Add locale strings for feedback UI

### Phase 1: Sidebar + Navigation
- [ ] Create new layout shell with sidebar + main area
- [ ] Build `Sidebar.tsx` component with:
  - Search/filter chats
  - Pinned section
  - Grouped by date (Today, Yesterday, etc.)
  - Mode toggle (Casual/Pro) at bottom
- [ ] Hamburger toggle for narrow widths (< 400px) with overlay behavior
- [ ] Remove old tabs component and drawer
- [ ] Migrate chat switching logic to sidebar
- [ ] Update header to minimal version (logo, title, settings)

### Phase 2: Visual Foundation
- [ ] Update color tokens in Tailwind config (darker backgrounds like Claude.ai)
- [ ] Update typography scale
- [ ] Apply new spacing system (4px base unit)
- [ ] Create consistent component styling (cards, buttons, inputs)
- [ ] Implement Casual/Pro mode state store

### Phase 3: Composer Redesign
- [ ] Build context chips component (attached images, @mentions)
- [ ] Redesign composer layout:
  - Casual: Single-line, minimal
  - Pro: Multi-line with full toolbar
- [ ] Add slash commands parser (`/search`, `/vision`, `/model`)
- [ ] Build Cmd+K command palette modal
- [ ] Update model/prompt selectors styling

### Phase 4: Message Display
- [ ] Add collapsible reasoning sections to bot messages
- [ ] Replace source popups with inline expandable sources
- [ ] Redesign message action bar (Copy, Regenerate, etc.)
- [ ] Update user/bot message styling
- [ ] Add threading support for Pro mode (reply to specific messages)

### Phase 5: Advanced Features + Polish
- [ ] Artifacts panel (split view for code blocks)
- [ ] Chat pinning functionality
- [ ] Animation/transition pass (150ms ease-out)
- [ ] Keyboard shortcuts audit
- [ ] Accessibility audit (focus rings, ARIA)
- [ ] Performance testing (virtual scroll, bundle size)

---

## Files to Modify

### Core Components
- `src/routes/sidepanel-chat.tsx` - Main restructure
- `src/components/Sidepanel/Chat/body.tsx` - Message display
- `src/components/Sidepanel/Chat/form.tsx` - Composer redesign
- `src/components/Sidepanel/Chat/SidepanelHeaderSimple.tsx` - Simplify

### New Components to Create

**Feedback System (Phase 0 - Critical):**
- `src/components/Sidepanel/Chat/FeedbackButtons.tsx` - 👍👎 quick feedback
- `src/components/Sidepanel/Chat/FeedbackModal.tsx` - Detailed feedback form
- `src/components/Sidepanel/Chat/SourceFeedback.tsx` - Per-source ratings
- `src/services/feedback.ts` - Feedback API client
- `src/hooks/useFeedback.tsx` - Feedback state management
- `src/hooks/useImplicitFeedback.tsx` - Implicit tracking (clicks, copies, dwell)

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
- `src/store/feedback.tsx` - Feedback state per message (rating, submitted status)

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
| `top_k` | Model params panel | Pro |
| `max_tokens` | Model params panel | Pro |
| `frequency_penalty` | Model params panel | Pro |
| `presence_penalty` | Model params panel | Pro |
| `tools` | Tool call display in messages | Pro |
| `response_format` | JSON mode toggle | Pro |

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

### Message Features

**UI Presentation:**
| Feature | UI Location |
|---------|-------------|
| User messages | Right-aligned bubbles with context chips |
| Assistant messages | Left-aligned with collapsible reasoning |
| Tool calls | Expandable "Tool: {name}" blocks |
| Sources/citations | Inline expandable section |
| Token usage | Subtle footer on assistant messages |
| Edit message | Edit button → regenerate |
| Branch/fork | Fork button on any message |

### Slash Commands

**Discovery UI:**
- Type `/` in composer → dropdown with commands from `GET /api/v1/chat/commands`
- Shows command name, description, required permissions
- Filtered by user's permissions

### Character & Prompt Context

**UI Controls:**
| Feature | UI Location | Mode |
|---------|-------------|------|
| Character selector | Dropdown in composer toolbar | Pro |
| Prompt template | Dropdown in composer toolbar | Pro |
| Chat dictionaries | Settings panel per conversation | Pro |

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

### Immediate: Phase 0 - Feedback System (Do First)
1. Create `src/services/feedback.ts` - API client for `POST /api/v1/rag/feedback/implicit`
2. Create `src/hooks/useFeedback.tsx` - Feedback state and submission logic
3. Create `src/components/Sidepanel/Chat/FeedbackButtons.tsx` - 👍👎 UI
4. Add feedback buttons to `src/components/Common/Playground/Message.tsx`
5. Create `src/hooks/useImplicitFeedback.tsx` - Click/copy/dwell tracking
6. Create `src/components/Sidepanel/Chat/FeedbackModal.tsx` - Detailed feedback form
7. Add feedback locale strings to `src/assets/locale/`

### Then: Phase 1 - Sidebar + Navigation
1. Create `src/store/ui-mode.tsx` - Casual/Pro mode state store
2. Create `src/components/Sidepanel/Chat/Sidebar.tsx` - New unified sidebar
3. Create `src/components/Sidepanel/Chat/SidebarOverlay.tsx` - Overlay wrapper for narrow widths
4. Modify `src/routes/sidepanel-chat.tsx` - New layout structure with sidebar
5. Remove/deprecate `src/components/Sidepanel/Chat/Tabs.tsx`
6. Simplify `src/components/Sidepanel/Chat/SidepanelHeaderSimple.tsx`

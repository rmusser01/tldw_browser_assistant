# PRD: Kanban Board Feature

**Document Version:** 2.1
**Date:** 2025-12-29
**Status:** Draft
**Author:** Claude Code
**Changelog:**
- v2.1 - Added undo requirement, XSS note, browser compat, error catalog, deep linking, missing loading states, traceability matrix, clarified delete vs archive
- v2.0 - Addressed data model alignment, added accessibility requirements, search/filter, missing user stories, and technical gaps

---

## Executive Summary

This PRD defines a kanban board feature for the tldw Assistant browser extension. The feature provides task/project management capabilities using a board/list/card paradigm, leveraging the existing tldw_server Kanban API.

**Key Deliverables:**
- Board list view with create/archive/delete
- Board view with draggable lists and cards
- Card detail modal with labels, due dates, checklists, comments
- Search and filter capabilities
- Full keyboard accessibility (WCAG 2.1 AA)

**Scope:** Options page only, no content linking (deferred), 11 implementation phases.

---

## 1. Overview

### 1.1 Summary

Add a kanban board feature to the tldw Assistant browser extension that allows users to organize tasks, ideas, and content using a familiar board/list/card paradigm. This serves as a **placeholder UI** - fully functional but designed to be consistent with eventual UI redesign.

### 1.2 Goals

- Provide task/project management capabilities within the extension
- Leverage the existing tldw_server Kanban API
- Maintain consistency with existing extension UI patterns
- Enable future integration with media/notes (deferred)
- Ensure accessibility compliance (WCAG 2.1 AA)

### 1.3 Non-Goals (This Release)

- Content linking (cards ↔ media/notes) - deferred to redesign phase
- Sidepanel view - options page only for now
- Trello import - API supports it, but UI deferred
- Collaborative features - single-user focus
- Offline-first with sync queue - show offline banner only
- Board templates - defer to future release

### 1.4 Browser Compatibility

| Browser | Version | Manifest | Status |
|---------|---------|----------|--------|
| Chrome | 116+ | MV3 | Supported |
| Edge | 116+ | MV3 | Supported |
| Firefox | 115+ | MV2 | Supported |
| Safari | - | - | Not supported |

---

## 2. User Stories

### 2.1 Board Management

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| U1 | User | View all my boards in a grid | I can quickly find and select a board |
| U2 | User | Create a new board with title/description | I can organize different projects |
| U3 | User | Archive boards | I can hide completed projects without deleting |
| U4 | User | Delete boards | I can remove projects I no longer need |
| U5 | User | View archived boards | I can find and restore old projects |
| U6 | User | Restore archived boards | I can reactivate projects I need again |

### 2.2 List Management

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| U7 | User | Add lists to a board | I can define workflow stages (e.g., Todo, In Progress, Done) |
| U8 | User | Rename lists inline | I can adjust my workflow terminology quickly |
| U9 | User | Reorder lists by dragging | I can arrange my workflow visually |
| U10 | User | Archive lists | I can hide stages without losing cards |
| U11 | User | Delete lists | I can remove stages I no longer need |
| U12 | User | Restore archived lists | I can bring back lists I need again |

### 2.3 Card Management

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| U13 | User | Create cards with quick-add | I can rapidly capture tasks |
| U14 | User | Edit card details (title, description) | I can provide full context for tasks |
| U15 | User | Set due dates on cards | I can track deadlines |
| U16 | User | Set start dates on cards | I can plan when to begin work |
| U17 | User | Set priority levels | I can identify urgent items |
| U18 | User | Drag cards between lists | I can update task status |
| U19 | User | Reorder cards within a list | I can prioritize within a stage |
| U20 | User | Archive cards | I can hide completed tasks without deleting |
| U21 | User | Delete cards | I can remove tasks I no longer need |
| U22 | User | Restore archived cards | I can recover tasks I need again |
| U23 | User | Copy cards | I can duplicate similar tasks |

### 2.4 Labels

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| U24 | User | Create colored labels | I can categorize cards (e.g., bug, feature, docs) |
| U25 | User | Assign multiple labels to cards | I can tag cards with multiple categories |
| U26 | User | Filter board by label | I can focus on specific categories |
| U27 | User | Edit/delete labels | I can maintain my categorization system |

### 2.5 Checklists

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| U28 | User | Add checklists to cards | I can break down tasks into subtasks |
| U29 | User | Check/uncheck items | I can track subtask progress |
| U30 | User | See checklist progress | I can quickly assess completion status |
| U31 | User | Reorder checklist items | I can prioritize subtasks |

### 2.6 Comments

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| U32 | User | Add comments to cards | I can record notes and updates |
| U33 | User | Edit/delete my comments | I can correct mistakes |

### 2.7 Search & Navigation

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| U34 | User | Search cards by title/description | I can find specific items quickly |
| U35 | User | Switch boards without going back | I can navigate efficiently |
| U36 | User | See recent activity on a board | I can track what changed |
| U37 | User | Use keyboard shortcuts | I can work more efficiently |

### 2.8 Data Recovery

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| U38 | User | View all archived items | I can find things I archived |
| U39 | User | Undo accidental actions | I can recover from mistakes quickly |
| U40 | User | Export my board data | I can backup my work |

---

## 3. Functional Requirements

### 3.1 Board List View

| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | Display boards in responsive grid (3-4 cols desktop, 2 cols tablet, 1 col mobile) | P0 |
| F2 | Show board title, description preview (max 2 lines), card count, last updated | P0 |
| F3 | "New board" button opens creation modal | P0 |
| F4 | Click board card to open board view | P0 |
| F5 | Board card menu: archive, delete | P0 |
| F6 | Empty state when no boards exist with CTA | P0 |
| F7 | Show loading skeleton while fetching boards | P0 |
| F8 | "Show archived" toggle to view archived boards | P1 |
| F9 | Archived boards show visual indicator (grayed, badge) | P1 |
| F10 | Restore option on archived boards | P1 |
| F11 | Confirm dialog before deleting boards (deletion is permanent from UI perspective) | P0 |

### 3.2 Board View

| ID | Requirement | Priority |
|----|-------------|----------|
| F12 | Display lists as horizontal scrolling columns (~280px width) | P0 |
| F13 | Board header: back button, board title, board switcher dropdown, actions menu | P0 |
| F14 | "Add another list" pseudo-column at end | P0 |
| F15 | Click list title to edit inline (with Enter to save, Escape to cancel) | P0 |
| F16 | List header menu: archive, delete | P0 |
| F17 | Show card count per list in header | P1 |
| F18 | Confirm dialog before deleting lists | P0 |
| F19 | Show loading skeleton while fetching board data | P0 |
| F20 | Mobile view: vertically stacked lists with collapse/expand | P1 |
| F21 | Empty board state: "Add your first list to get started" with CTA | P1 |
| F22 | Deep linking: URL includes board ID (`/kanban/:boardId`) for refresh persistence | P1 |

### 3.3 Cards

| ID | Requirement | Priority |
|----|-------------|----------|
| F23 | Display cards stacked vertically in lists | P0 |
| F24 | Card shows: title (max 2 lines + ellipsis), labels (max 3 + "+N" overflow), due date badge, priority indicator, checklist progress | P0 |
| F25 | Quick-add card input at bottom of each list (Enter to create) | P0 |
| F26 | Click card to open detail modal | P0 |
| F27 | Due date badge colors: red (overdue), yellow (due within 3 days), gray (future), green (completed) | P1 |
| F28 | Priority indicator: colored left border + icon (urgent=red+AlertTriangle, high=orange+ArrowUp, medium=yellow+Minus, low=gray+ArrowDown) | P1 |
| F29 | Checklist progress shown as "2/5" with mini progress bar | P1 |
| F30 | Empty list placeholder: "No cards yet" with add card prompt | P1 |
| F31 | Card hover state: subtle elevation, shows quick actions (archive) | P1 |

### 3.4 Card Detail Modal

| ID | Requirement | Priority |
|----|-------------|----------|
| F32 | Modal with two-column layout (content left 70%, sidebar right 30%) | P0 |
| F33 | Editable title field (auto-save on blur) | P0 |
| F34 | Description textarea with markdown support, edit/preview toggle, sanitized output | P0 |
| F35 | Label picker (assign/remove labels) with color chips | P0 |
| F36 | Due date picker with calendar UI, displayed in user's locale format | P0 |
| F37 | Start date picker with calendar UI | P1 |
| F38 | Priority selector dropdown (low, medium, high, urgent) with color + icon indicators | P0 |
| F39 | Checklists section with add/edit/delete, reorder via drag-drop | P1 |
| F40 | Comments section with add/edit/delete, markdown support, sanitized output | P1 |
| F41 | Actions sidebar: move to list, copy card, archive, delete | P0 |
| F42 | Show "last updated" timestamp in user's locale | P1 |
| F43 | Confirm dialog before deleting cards | P0 |
| F44 | Warn if closing modal with unsaved description changes (applies to Escape, click outside, and X button) | P1 |
| F45 | Close modal with Escape key (triggers unsaved warning if applicable) or click outside | P0 |
| F46 | Focus trap within modal for accessibility | P0 |
| F47 | Loading skeleton while fetching card details (checklists, comments) | P1 |

### 3.5 Drag and Drop

| ID | Requirement | Priority |
|----|-------------|----------|
| F48 | Drag cards within list to reorder | P0 |
| F49 | Drag cards between lists to move | P0 |
| F50 | Drag lists to reorder | P1 |
| F51 | Visual feedback during drag: placeholder outline, dragged item elevation | P0 |
| F52 | Keyboard drag support: select with Space, move with arrows, drop with Space | P0 |
| F53 | Touch support for drag operations on mobile/tablet | P1 |
| F54 | Respect `prefers-reduced-motion`: disable animations if set | P1 |
| F55 | Optimistic UI update with rollback on API failure | P0 |

### 3.6 Labels

| ID | Requirement | Priority |
|----|-------------|----------|
| F56 | Create labels with name and color (8 colors available) | P0 |
| F57 | Edit label name and color | P1 |
| F58 | Delete label (with confirmation, removes from all cards) | P1 |
| F59 | Filter board view by selected labels (multi-select, AND logic) | P1 |
| F60 | Clear filters button when filters active | P1 |
| F61 | Label colors: red, orange, yellow, green, blue, purple, pink, gray | P0 |
| F62 | Labels in picker show card count using that label | P2 |

### 3.7 Search & Filter

| ID | Requirement | Priority |
|----|-------------|----------|
| F63 | Search input in board header | P1 |
| F64 | Search cards using server-side FTS API for performance | P1 |
| F65 | Highlight matching cards, dim non-matching | P1 |
| F66 | Clear search button (X icon) | P1 |
| F67 | Debounce search input (300ms) to avoid excessive API calls | P1 |
| F68 | Filter by due date: overdue, due today, due this week, no due date | P2 |
| F69 | Filter by priority level | P2 |
| F70 | Filter by has checklist / checklist incomplete | P2 |
| F71 | Show active filter count badge | P2 |

### 3.8 Offline/Demo Handling

| ID | Requirement | Priority |
|----|-------------|----------|
| F72 | Show connection banner when offline (non-demo) with retry button | P0 |
| F73 | Show demo empty state when in demo mode | P0 |
| F74 | Show "API unavailable" state if server lacks kanban endpoints | P0 |
| F75 | Show specific error messages (see Error Catalog below) | P0 |
| F76 | Retry button on failed operations | P0 |
| F77 | Toast notifications for successful actions (created, moved, deleted) | P1 |
| F78 | Undo toast for destructive actions: archive/delete shows "Undo" button for 5 seconds | P1 |

### 3.9 Accessibility

| ID | Requirement | Priority |
|----|-------------|----------|
| F79 | All interactive elements keyboard accessible (Tab navigation) | P0 |
| F80 | Visible focus indicator on all focusable elements | P0 |
| F81 | Modal focus trap: focus stays within modal until closed | P0 |
| F82 | Focus restored to trigger element when modal closes | P0 |
| F83 | ARIA labels on all icon-only buttons | P0 |
| F84 | ARIA live regions for dynamic content updates (card moved, created, etc.) | P1 |
| F85 | Color not sole indicator: icons + text accompany colors (priority, due date, labels show name on hover) | P0 |
| F86 | Screen reader announcements for drag-drop operations | P1 |
| F87 | Skip link to main content area | P2 |
| F88 | Minimum touch target size 44x44px on mobile | P1 |

### 3.10 Data Management

| ID | Requirement | Priority |
|----|-------------|----------|
| F89 | "Archived items" view accessible from board menu | P1 |
| F90 | Filter archived view by type (boards, lists, cards) | P1 |
| F91 | Loading skeleton for archived items view | P1 |
| F92 | Empty state for archived items: "No archived items" | P1 |
| F93 | Bulk restore for archived items | P2 |
| F94 | Export board as JSON (uses API export endpoint) | P2 |
| F95 | Activity log view for board (last 50 activities) | P2 |

---

## 4. Technical Requirements

### 4.1 Architecture

| ID | Requirement |
|----|-------------|
| T1 | Route: `/kanban` and `/kanban/:boardId` in options page (lazy loaded) |
| T2 | State management: Zustand store with persist middleware, includes schema version for migrations |
| T3 | API client: Follow `folder-api.ts` pattern with `bgRequestClient` |
| T4 | Drag-drop library: `@dnd-kit/core` + `@dnd-kit/sortable` (~15KB gzipped) |
| T5 | UI components: Ant Design + TailwindCSS |
| T6 | Server capability: Add `hasKanban` to `server-capabilities.ts` |
| T7 | Markdown rendering: Use existing markdown renderer, sanitize with DOMPurify (via safeInnerHTMLPlugin) |
| T8 | Icons: Use Lucide React icons (already in codebase), not emojis |

### 4.2 API Integration

The extension will consume the tldw_server Kanban API at `/api/v1/`:

```
Boards:
  GET    /boards                     - List boards (with ?include_archived=true)
  POST   /boards                     - Create board
  GET    /boards/{id}                - Get board (with ?include_lists=true&include_cards=true)
  PATCH  /boards/{id}                - Update board
  DELETE /boards/{id}                - Soft-delete board
  POST   /boards/{id}/archive        - Archive board
  POST   /boards/{id}/unarchive      - Unarchive board
  POST   /boards/{id}/restore        - Restore deleted board
  GET    /boards/{id}/activities     - Get activity log
  POST   /boards/{id}/export         - Export board JSON

Lists:
  GET    /boards/{id}/lists          - Get lists for board
  POST   /boards/{id}/lists          - Create list
  POST   /boards/{id}/lists/reorder  - Reorder lists
  PATCH  /lists/{id}                 - Update list
  DELETE /lists/{id}                 - Soft-delete list
  POST   /lists/{id}/archive         - Archive list
  POST   /lists/{id}/unarchive       - Unarchive list
  POST   /lists/{id}/restore         - Restore deleted list

Cards:
  GET    /lists/{id}/cards           - Get cards for list
  POST   /lists/{id}/cards           - Create card
  POST   /lists/{id}/cards/reorder   - Reorder cards in list
  GET    /cards/{id}                 - Get card details
  PATCH  /cards/{id}                 - Update card
  DELETE /cards/{id}                 - Soft-delete card
  POST   /cards/{id}/move            - Move card to another list
  POST   /cards/{id}/copy            - Copy card
  POST   /cards/{id}/archive         - Archive card
  POST   /cards/{id}/unarchive       - Unarchive card
  POST   /cards/{id}/restore         - Restore deleted card

Labels:
  GET    /boards/{id}/labels         - Get labels for board
  POST   /boards/{id}/labels         - Create label
  PATCH  /labels/{id}                - Update label
  DELETE /labels/{id}                - Delete label (hard delete)
  POST   /cards/{id}/labels/{labelId}   - Assign label to card
  DELETE /cards/{id}/labels/{labelId}   - Remove label from card

Checklists:
  GET    /cards/{id}/checklists      - Get checklists for card
  POST   /cards/{id}/checklists      - Create checklist
  PATCH  /checklists/{id}            - Update checklist
  DELETE /checklists/{id}            - Delete checklist
  POST   /checklists/{id}/items      - Create item
  PATCH  /checklist-items/{id}       - Update item
  DELETE /checklist-items/{id}       - Delete item
  POST   /checklist-items/{id}/check - Check item
  POST   /checklist-items/{id}/uncheck - Uncheck item
  POST   /checklists/{id}/items/reorder - Reorder items

Comments:
  GET    /cards/{id}/comments        - Get comments for card
  POST   /cards/{id}/comments        - Create comment
  PATCH  /comments/{id}              - Update comment
  DELETE /comments/{id}              - Delete comment

Search:
  POST   /search                     - Search cards (FTS)
```

### 4.3 Data Models

```typescript
// All models include version for optimistic locking
// Use X-Expected-Version header on updates

interface KanbanBoard {
  id: number
  uuid: string
  name: string
  description?: string
  archived: boolean
  archived_at?: string
  deleted: boolean
  deleted_at?: string
  created_at: string
  updated_at: string
  version: number
  // Nested (optional, based on query params)
  lists?: KanbanList[]
}

interface KanbanList {
  id: number
  uuid: string
  board_id: number
  name: string
  position: number
  archived: boolean
  archived_at?: string
  deleted: boolean
  deleted_at?: string
  created_at: string
  updated_at: string
  version: number
  card_count?: number
  // Nested (optional)
  cards?: KanbanCard[]
}

interface KanbanCard {
  id: number
  uuid: string
  board_id: number
  list_id: number
  title: string
  description?: string
  position: number
  due_date?: string      // ISO 8601 UTC
  due_complete?: boolean
  start_date?: string    // ISO 8601 UTC
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  archived: boolean
  archived_at?: string
  deleted: boolean
  deleted_at?: string
  created_at: string
  updated_at: string
  version: number
  metadata?: Record<string, unknown>
  // Nested (optional)
  labels?: KanbanLabel[]
  checklists?: KanbanChecklist[]
}

interface KanbanLabel {
  id: number
  uuid: string
  board_id: number
  name: string
  color: LabelColor
  created_at: string
  updated_at: string
}

type LabelColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'gray'

interface KanbanChecklist {
  id: number
  uuid: string
  card_id: number
  name: string
  position: number
  created_at: string
  updated_at: string
  items: KanbanChecklistItem[]
}

interface KanbanChecklistItem {
  id: number
  uuid: string
  checklist_id: number
  name: string
  position: number
  checked: boolean
  checked_at?: string
  created_at: string
  updated_at: string
}

interface KanbanComment {
  id: number
  uuid: string
  card_id: number
  user_id?: string
  content: string
  deleted: boolean
  created_at: string
  updated_at: string
}

interface KanbanActivity {
  id: number
  uuid: string
  board_id: number
  list_id?: number
  card_id?: number
  user_id?: string
  action_type: string
  entity_type: string
  entity_id: number
  details?: Record<string, unknown>
  created_at: string
}

// API request helpers
interface CreateCardRequest {
  title: string
  description?: string
  client_id?: string  // For idempotency
  due_date?: string
  start_date?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
}

interface UpdateCardRequest {
  title?: string
  description?: string
  due_date?: string | null
  due_complete?: boolean
  start_date?: string | null
  priority?: 'low' | 'medium' | 'high' | 'urgent' | null
}

interface MoveCardRequest {
  target_list_id: number
  position?: number
}
```

### 4.4 Date & Time Handling

| Aspect | Specification |
|--------|---------------|
| **Storage** | All dates stored in UTC (ISO 8601 format) |
| **Display** | Convert to user's local timezone for display |
| **Format** | Use `Intl.DateTimeFormat` with user's locale |
| **"Overdue" calculation** | Compare UTC due_date against current UTC time |
| **"Due today"** | Due date falls within user's local "today" |

### 4.5 Optimistic Updates & Conflict Resolution

```typescript
// Pattern for optimistic updates with rollback
interface OptimisticUpdate<T> {
  // 1. Store current state
  previousState: T
  // 2. Apply optimistic update to UI immediately
  optimisticState: T
  // 3. Send API request
  // 4a. On success: update with server response (includes new version)
  // 4b. On failure: rollback to previousState, show error toast
}

// Conflict handling
// - All update requests include X-Expected-Version header
// - If version mismatch (409 Conflict):
//   - Fetch latest from server
//   - Show conflict modal: "This item was modified. Reload to see changes?"
//   - Options: "Reload" (discard local), "Overwrite" (force save)
```

### 4.6 State Persistence & Migration

```typescript
// Zustand persist configuration
interface PersistedKanbanState {
  _version: number  // Schema version for migrations
  currentBoardId: number | null
  viewPreferences: {
    collapsedLists: number[]
    labelFilters: number[]
  }
  // Note: Board/list/card data NOT persisted (fetched from server)
}

// Migration example
const migrations = {
  1: (state) => ({ ...state, viewPreferences: { collapsedLists: [], labelFilters: [] } }),
  2: (state) => ({ ...state, /* new fields */ }),
}
```

### 4.7 Field Validation

| Field | Max Length | Validation |
|-------|------------|------------|
| Board name | 200 chars | Required, non-empty, trimmed |
| Board description | 2000 chars | Optional |
| List name | 200 chars | Required, non-empty, trimmed |
| Card title | 500 chars | Required, non-empty, trimmed |
| Card description | 10000 chars | Optional, markdown allowed, sanitized on render |
| Label name | 100 chars | Required, non-empty, trimmed |
| Checklist name | 200 chars | Required, non-empty, trimmed |
| Checklist item name | 500 chars | Required, non-empty, trimmed |
| Comment content | 5000 chars | Required, non-empty, markdown allowed, sanitized on render |

### 4.8 Performance Limits

| Metric | Limit | Handling |
|--------|-------|----------|
| Lists per board | 50 | Soft limit, warn user |
| Cards per list | 100 | Enable virtual scrolling above 50 |
| Labels per board | 20 | Soft limit in UI |
| Checklists per card | 10 | Soft limit in UI |
| Items per checklist | 50 | Soft limit in UI |
| Comments per card | 100 | Paginate (load 20 at a time) |

### 4.9 Rate Limiting Handling

- API has per-action rate limits (10-200 req/min depending on action)
- Client-side debouncing for rapid actions (300ms for search, drag-drop reorder)
- Queue concurrent requests, process sequentially
- On 429 response: show "Too many requests, please wait" toast, retry after delay

### 4.10 Error Catalog

| Error Code | User Message | Action |
|------------|--------------|--------|
| `NETWORK_ERROR` | "Unable to connect. Check your internet connection." | Retry button |
| `SERVER_UNAVAILABLE` | "Server is not responding. Please try again later." | Retry button |
| `API_NOT_AVAILABLE` | "Kanban feature is not available on this server." | Link to diagnostics |
| `AUTH_REQUIRED` | "Please sign in to access your boards." | Link to settings |
| `AUTH_EXPIRED` | "Your session has expired. Please sign in again." | Link to settings |
| `NOT_FOUND` | "This {item} no longer exists." | Navigate back |
| `CONFLICT` | "This {item} was modified by another session." | Reload / Overwrite |
| `VALIDATION_ERROR` | "{field} is required." or "{field} is too long." | Highlight field |
| `RATE_LIMITED` | "Too many requests. Please wait a moment." | Auto-retry after delay |
| `UNKNOWN_ERROR` | "Something went wrong. Please try again." | Retry button |

### 4.11 Dependencies

```json
{
  "@dnd-kit/core": "^6.1.0",
  "@dnd-kit/sortable": "^8.0.0",
  "@dnd-kit/utilities": "^3.2.2"
}
```

**Bundle impact:** ~15KB gzipped for drag-drop functionality. Acceptable for feature value.

---

## 5. UI/UX Specifications

### 5.1 Board List View

```
┌─────────────────────────────────────────────────────────────────┐
│  Kanban Boards                    [Show archived ○]  [+ New]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Project A     ⋮ │  │ Project B     ⋮ │  │ Ideas         ⋮ │ │
│  │                 │  │                 │  │                 │ │
│  │ Working on the  │  │ Q1 planning     │  │ Random ideas    │ │
│  │ new feature...  │  │ and goals       │  │ to explore      │ │
│  │                 │  │                 │  │                 │ │
│  │ 12 cards        │  │ 5 cards         │  │ 23 cards        │ │
│  │ Updated 2h ago  │  │ Updated 1d ago  │  │ Updated 5m ago  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Empty state:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                     [Clipboard icon]                            │
│                                                                 │
│              No kanban boards yet                               │
│                                                                 │
│     Create your first board to organize tasks,                  │
│     track projects, or plan your work.                          │
│                                                                 │
│                  [+ Create Board]                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Board View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back   Project A ▼   🔍 Search...   [Labels ▼] [Filter ▼]   [⋮ Actions]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ To Do (4)  ⋮ │  │ In Progress  │  │ Done (2)   ⋮ │  │                │  │
│  │              │  │ (2)        ⋮ │  │              │  │   + Add list   │  │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  │                │  │
│  │┌────────────┐│  │┌────────────┐│  │┌────────────┐│  └────────────────┘  │
│  ││ Card 1     ││  ││ Card 3     ││  ││ Card 5     ││                      │
│  ││ [Bug]      ││  ││ Dec 31     ││  ││ ✓ Complete ││                      │
│  ││ ⚠ Urgent   ││  ││ ☐ 2/5      ││  │└────────────┘│                      │
│  │└────────────┘│  │└────────────┘│  │┌────────────┐│                      │
│  │┌────────────┐│  │┌────────────┐│  ││ Card 6     ││                      │
│  ││ Card 2     ││  ││ Card 4     ││  ││ ✓ Complete ││                      │
│  ││ [Feature]  ││  ││ ⚠ Overdue  ││  │└────────────┘│                      │
│  │└────────────┘│  │└────────────┘│  │              │                      │
│  │              │  │              │  │              │                      │
│  │ + Add card   │  │ + Add card   │  │ + Add card   │                      │
│  └──────────────┘  └──────────────┘  └──────────────┘                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Empty board state:
┌──────────────────────────────────────────────────────────────┐
│  ← Back   New Project ▼                          [⋮ Actions] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                  [List icon]                                 │
│                                                              │
│           Add your first list to get started                 │
│                                                              │
│     Lists help you organize cards into stages                │
│     like "To Do", "In Progress", and "Done".                 │
│                                                              │
│                    [+ Add List]                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Mobile view (stacked):
┌─────────────────────────┐
│ ← Project A ▼    🔍  ⋮  │
├─────────────────────────┤
│ ▼ To Do (4)             │
│ ┌─────────────────────┐ │
│ │ Card 1              │ │
│ │ [Bug]  ⚠ Urgent     │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ Card 2              │ │
│ │ [Feature]           │ │
│ └─────────────────────┘ │
│ + Add card              │
├─────────────────────────┤
│ ▶ In Progress (2)       │
├─────────────────────────┤
│ ▶ Done (2)              │
└─────────────────────────┘
```

### 5.3 Card Detail Modal

```
┌────────────────────────────────────────────────────────────────────┐
│                                                              [×]   │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────────────┐  │  Labels                  │
│  │ Implement user authentication    │  │  [Bug] [Feature]         │
│  └──────────────────────────────────┘  │  + Add label             │
│                                        │                          │
│  Description                           │  Due Date                │
│  ┌──────────────────────────────────┐  │  Dec 31, 2025           │
│  │ We need to add OAuth support     │  │  [Change] [Remove]      │
│  │ for Google and GitHub login.     │  │                          │
│  │                                  │  │  Start Date              │
│  │ Requirements:                    │  │  Dec 15, 2025           │
│  │ - Google OAuth 2.0               │  │  [Change] [Remove]      │
│  │ - GitHub OAuth                   │  │                          │
│  │ - Token refresh                  │  │  Priority                │
│  │                                  │  │  [⚠ Urgent        ▼]    │
│  │ [Edit] [Preview]                 │  │                          │
│  └──────────────────────────────────┘  │  ─────────────────────   │
│                                        │                          │
│  ☑ Checklist: Implementation (2/4)     │  Actions                 │
│  ├─ ☑ Set up OAuth providers          │  → Move to list...       │
│  ├─ ☑ Create auth endpoints           │  ⧉ Copy card             │
│  ├─ ☐ Add token refresh               │  ▢ Archive               │
│  └─ ☐ Write tests                     │  ✕ Delete                │
│  + Add item                            │                          │
│                                        │  ─────────────────────   │
│  Comments                              │                          │
│  ┌──────────────────────────────────┐  │  Updated 2 hours ago    │
│  │ You · 2h ago                     │  │                          │
│  │ Started working on this today.   │  │                          │
│  │                        [Edit] [×] │  │                          │
│  └──────────────────────────────────┘  │                          │
│  ┌──────────────────────────────────┐  │                          │
│  │ Add a comment...                 │  │                          │
│  │                         [Submit] │  │                          │
│  └──────────────────────────────────┘  │                          │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 5.4 Color Palette (Labels)

| Color | Name | Light Mode | Dark Mode | CSS Variable |
|-------|------|------------|-----------|--------------|
| Red | `red` | `#ef4444` | `#f87171` | `--kanban-label-red` |
| Orange | `orange` | `#f97316` | `#fb923c` | `--kanban-label-orange` |
| Yellow | `yellow` | `#eab308` | `#facc15` | `--kanban-label-yellow` |
| Green | `green` | `#22c55e` | `#4ade80` | `--kanban-label-green` |
| Blue | `blue` | `#3b82f6` | `#60a5fa` | `--kanban-label-blue` |
| Purple | `purple` | `#a855f7` | `#c084fc` | `--kanban-label-purple` |
| Pink | `pink` | `#ec4899` | `#f472b6` | `--kanban-label-pink` |
| Gray | `gray` | `#6b7280` | `#9ca3af` | `--kanban-label-gray` |

### 5.5 Priority Indicators

| Priority | Color | Lucide Icon | Border | Text |
|----------|-------|-------------|--------|------|
| Urgent | Red | `AlertTriangle` | 3px left border red | "Urgent" |
| High | Orange | `ArrowUp` | 3px left border orange | "High" |
| Medium | Yellow | `Minus` | 3px left border yellow | "Medium" |
| Low | Gray | `ArrowDown` | 3px left border gray | "Low" |

### 5.6 Due Date Indicators

| State | Background | Icon | Text Example | Accessible Label |
|-------|------------|------|--------------|------------------|
| Overdue | Red/10% | `AlertCircle` | "Overdue by 2 days" | "Overdue" |
| Due today | Yellow/10% | `Clock` | "Due today" | "Due today" |
| Due within 3 days | None | `Calendar` | "Due Dec 31" | "Due soon" |
| Future | None | `Calendar` | "Due Jan 15" | "Due Jan 15" |
| Completed | Green/10% | `CheckCircle` | "✓ Dec 31" | "Completed" |

### 5.7 Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `n` | New card (focus quick-add of first list) | Board view |
| `l` | New list | Board view |
| `f` or `/` | Focus search | Board view |
| `Escape` | Close modal / Clear search / Cancel edit | Any |
| `Enter` | Save / Submit | Forms |
| `Space` | Toggle checkbox / Start drag | Checklist / Cards |
| `Arrow keys` | Move during drag | During drag |
| `?` | Show keyboard shortcuts modal | Any |
| `g b` | Go to boards list | Any |

### 5.8 Toast Notifications

| Action | Message | Has Undo? | Duration |
|--------|---------|-----------|----------|
| Board created | "Board created" | No | 3s |
| Board archived | "Board archived" | Yes | 5s |
| Board deleted | "Board deleted" | Yes | 5s |
| Card created | "Card created" | No | 3s |
| Card moved | "Card moved to {list}" | Yes | 5s |
| Card archived | "Card archived" | Yes | 5s |
| Card deleted | "Card deleted" | Yes | 5s |
| Error | "{error message}" | No | 5s |

---

## 6. Implementation Phases

| Phase | Description | Deliverables | Est. Complexity |
|-------|-------------|--------------|-----------------|
| 1 | Foundation | Types, API service, Zustand store, route setup, capability check | Medium |
| 2 | Board List | Grid view, create modal, empty states, loading skeletons, i18n | Medium |
| 3 | Board View (Static) | Column layout, cards display, add list/card, inline editing, deep linking | High |
| 4 | Card Detail Modal | Full editing, due/start dates, priority, markdown description | High |
| 5 | Labels | CRUD, assignment, filtering, color picker | Medium |
| 6 | Drag-and-Drop | Card/list reordering with @dnd-kit, optimistic updates, undo toasts | High |
| 7 | Checklists & Comments | Subtasks with progress and drag reorder, comments with markdown | Medium |
| 8 | Search & Filter | Server-side search, filter dropdowns | Medium |
| 9 | Archive & Recovery | Archive views, restore functionality | Low |
| 10 | Accessibility & Polish | Focus management, ARIA, keyboard nav, motion, error handling | Medium |
| 11 | Testing | Unit tests, integration tests, e2e tests | Medium |

---

## 7. Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Feature adoption | >20% of connected users create at least 1 board within 30 days | API analytics (server-side) |
| Task completion | Users can complete full CRUD workflow without errors | E2E test pass rate |
| Performance | Board with 100 cards loads in <2s | Lighthouse CI |
| Accessibility | Passes WCAG 2.1 AA automated checks | axe-core in e2e tests |
| Error rate | <1% of API calls result in unhandled errors | Error tracking |
| User retention | >50% of board creators return within 7 days | API analytics |

---

## 8. Future Considerations

### 8.1 Content Linking (Post-Redesign)
- Link cards to media items from tldw library
- Link cards to notes
- Show linked content previews on cards
- Bidirectional navigation (card → content, content → cards)
- "Add to kanban" from media/notes context menu

### 8.2 Advanced Features
- Board templates (e.g., "Kanban", "Sprint", "Research")
- Card templates
- Due date reminders/notifications (browser notifications)
- Board sharing/export (PDF, image)
- Recurring cards
- Card dependencies (blocked by)
- Time tracking on cards
- Custom fields

### 8.3 Sidepanel Integration
- Compact board view in sidepanel
- Quick card creation from sidepanel
- Context menu: "Add to kanban board"
- "My tasks" view across all boards

### 8.4 Collaboration (If Multi-User)
- Real-time updates via WebSocket
- Card assignments
- @mentions in comments
- Activity feed

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Bundle size increase from @dnd-kit | Medium | Low | Tree-shake unused exports, monitor bundle size |
| Performance with many cards | Medium | Medium | Virtual scrolling for lists >50 cards |
| API rate limiting during heavy use | Low | Medium | Client-side debouncing, request queuing |
| Conflict resolution complexity | Medium | Medium | Simple "last write wins" with reload prompt |
| Accessibility compliance gaps | Medium | High | Automated testing, manual audit before release |
| Mobile drag-drop UX issues | Medium | Medium | Test on real devices, provide alternative actions |
| State migration on schema changes | Low | Medium | Version persisted state, implement migrations |

---

## 10. Internationalization

### 10.1 Scope

- **MVP**: English only (`src/assets/locale/en/kanban.json`)
- **Post-MVP**: Add translations to existing locales as needed

### 10.2 Strings to Translate

- UI labels (buttons, headers, placeholders)
- Error messages (from Error Catalog)
- Empty states
- Toast notifications
- Accessibility labels (ARIA)
- Date/time formatting (use `Intl` API)

---

## 11. Traceability Matrix

| User Story | Functional Requirements |
|------------|------------------------|
| U1 View boards | F1, F2, F4, F7 |
| U2 Create board | F3 |
| U3 Archive board | F5, F8, F9 |
| U4 Delete board | F5, F11 |
| U5 View archived | F8, F9, F89, F91, F92 |
| U6 Restore board | F10 |
| U7 Add list | F14 |
| U8 Rename list | F15 |
| U9 Reorder list | F50 |
| U10 Archive list | F16 |
| U11 Delete list | F16, F18 |
| U12 Restore list | F89, F90 |
| U13 Create card | F25 |
| U14 Edit card | F33, F34 |
| U15 Set due date | F36 |
| U16 Set start date | F37 |
| U17 Set priority | F38 |
| U18 Drag card between lists | F49 |
| U19 Reorder cards | F48 |
| U20 Archive card | F41, F31 |
| U21 Delete card | F41, F43 |
| U22 Restore card | F89, F90 |
| U23 Copy card | F41 |
| U24 Create label | F56 |
| U25 Assign labels | F35 |
| U26 Filter by label | F59, F60 |
| U27 Edit/delete label | F57, F58 |
| U28 Add checklist | F39 |
| U29 Check/uncheck | F39 |
| U30 See progress | F29 |
| U31 Reorder items | F39 |
| U32 Add comment | F40 |
| U33 Edit/delete comment | F40 |
| U34 Search cards | F63, F64, F65 |
| U35 Switch boards | F13 (board switcher) |
| U36 See activity | F95 |
| U37 Keyboard shortcuts | F52, F79, Section 5.7 |
| U38 View archived | F89, F90, F91, F92 |
| U39 Undo actions | F78 |
| U40 Export board | F94 |

---

## 12. Appendix

### 12.1 File Structure

```
src/
├── routes/
│   └── option-kanban.tsx
├── components/Option/Kanban/
│   ├── KanbanWorkspace.tsx          # Main entry with online/offline handling
│   ├── BoardList.tsx                # Board grid with create modal
│   ├── BoardView.tsx                # Column layout with DnD context
│   ├── BoardHeader.tsx              # Header with search, filters, actions
│   ├── KanbanColumn.tsx             # Single list column (droppable)
│   ├── KanbanCard.tsx               # Card component (draggable)
│   ├── CardDetailModal.tsx          # Full card editing modal
│   ├── CardDescription.tsx          # Markdown editor/preview
│   ├── LabelManager.tsx             # Label CRUD modal
│   ├── LabelPicker.tsx              # Label selection for cards
│   ├── LabelFilter.tsx              # Label filter dropdown
│   ├── ChecklistSection.tsx         # Checklist UI in card detail
│   ├── CommentsSection.tsx          # Comments in card detail
│   ├── DueDatePicker.tsx            # Due date selection
│   ├── PrioritySelect.tsx           # Priority dropdown
│   ├── ArchivedItemsView.tsx        # View/restore archived items
│   ├── BoardSwitcher.tsx            # Dropdown to switch boards
│   ├── SearchFilter.tsx             # Search input + filter dropdowns
│   └── UndoToast.tsx                # Toast with undo button
├── services/
│   └── kanban-api.ts                # API client with all endpoints
├── store/
│   └── kanban.tsx                   # Zustand store with persist
├── types/
│   └── kanban.ts                    # TypeScript interfaces
├── hooks/
│   └── useKanbanShortcuts.tsx       # Keyboard shortcuts hook
└── assets/locale/en/
    └── kanban.json                  # i18n strings
```

### 12.2 Reference Files

| File | Purpose |
|------|---------|
| `src/components/Option/Characters/CharactersWorkspace.tsx` | Workspace pattern with online/offline |
| `src/store/folder.tsx` | Zustand store pattern with persist |
| `src/services/folder-api.ts` | API service pattern with bgRequestClient |
| `src/routes/chrome.tsx` | Route registration with lazy loading |
| `src/services/tldw/server-capabilities.ts` | Server capability detection |
| `src/components/Common/PageShell.tsx` | Content wrapper |
| `src/components/Common/FeatureEmptyState.tsx` | Empty state pattern |

### 12.3 Glossary

| Term | Definition |
|------|------------|
| Board | A collection of lists, representing a project or workflow |
| List | A column within a board, representing a stage (e.g., "To Do") |
| Card | An individual task or item within a list |
| Label | A colored tag for categorizing cards |
| Checklist | A list of subtasks within a card |
| Archive | Soft-hide an item (recoverable via Archive view) |
| Delete | Remove an item (recoverable via 5-second undo toast only, then permanent) |
| Optimistic Update | UI updates immediately before API confirms, rolls back on failure |
| FTS | Full-Text Search using SQLite FTS5 |

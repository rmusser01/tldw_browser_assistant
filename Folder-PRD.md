# Product Requirements Document: Folder System & UX Enhancements
## tldw Assistant Browser Extension - Server-Native Folder Organization

**Version:** 2.0
**Date:** December 11, 2025
**Reference Project:** NotebookLM Pro Tree Extension (V17.6)

---

## Executive Summary

This PRD outlines design/UX enhancements adapted from the NotebookLM Pro Tree extension for implementation in the tldw extension. The primary feature is a **folder system using tldw_server's native `keyword_collections` table** to organize items hierarchically, with full sync support across devices.

### Key Discovery: Server Already Supports Folders

The tldw_server already has substantial infrastructure for folders and keywords:

| Server Feature | Database Location | Status |
|----------------|-------------------|--------|
| **Keywords for conversations** | `keywords` + `conversation_keywords` tables | ✅ Exists in DB |
| **Keywords for prompts** | `PromptKeywordsTable` + `PromptKeywordLinks` | ✅ Exists + API |
| **Hierarchical folders** | `keyword_collections` with `parent_id` | ✅ Exists in DB |
| **Folder-keyword links** | `collection_keywords` junction table | ✅ Exists in DB |

**Note:** While the database layer is complete, some API endpoints may need to be exposed.

### Key Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Folder Scope** | All features (chats, prompts, notes) | Unified organization across the extension |
| **Folder Creation** | UI button + API call | Creates real server entity in `keyword_collections` |
| **Multi-folder Assignment** | Yes, items in all assigned folders | Items can be linked to multiple keywords/folders |
| **Sync Strategy** | Server sync via existing infrastructure | Full sync support (versioning, client_id, sync_log) |
| **Nesting** | Native `parent_id` hierarchy | Server handles tree structure properly |
| **Case Sensitivity** | Case-insensitive (server uses `COLLATE NOCASE`) | "Work" and "work" are same folder |

---

## 1. Server Data Architecture

### 1.1 Existing Server Schema (ChaChaNotes_DB.py)

**Keywords Table:**
```sql
CREATE TABLE keywords (
  id            INTEGER PRIMARY KEY,
  keyword       TEXT UNIQUE COLLATE NOCASE,  -- Case-insensitive!
  created_at    DATETIME,
  last_modified DATETIME,
  version       INTEGER,
  client_id     TEXT,
  deleted       BOOLEAN DEFAULT 0
);
```

**Folder Collections Table (keyword_collections):**
```sql
CREATE TABLE keyword_collections (
  id            INTEGER PRIMARY KEY,
  name          TEXT UNIQUE COLLATE NOCASE,
  parent_id     INTEGER REFERENCES keyword_collections(id) ON DELETE SET NULL,
  created_at    DATETIME,
  last_modified DATETIME,
  deleted       BOOLEAN DEFAULT 0,
  client_id     TEXT,
  version       INTEGER
);
```

**Junction Tables:**
```sql
-- Link conversations to keywords
CREATE TABLE conversation_keywords (
  conversation_id TEXT,
  keyword_id      INTEGER REFERENCES keywords(id),
  PRIMARY KEY(conversation_id, keyword_id)
);

-- Link folders to keywords (folders can contain keywords)
CREATE TABLE collection_keywords (
  collection_id INTEGER REFERENCES keyword_collections(id) ON DELETE CASCADE,
  keyword_id    INTEGER REFERENCES keywords(id) ON DELETE CASCADE,
  PRIMARY KEY(collection_id, keyword_id)
);
```

### 1.2 How Folders Work

**Two Organization Systems:**

1. **Keywords (Tags):** Flat labels attached to items
   - Conversations have keywords via `conversation_keywords`
   - Prompts have keywords via `PromptKeywordLinks`

2. **Folders (Collections):** Hierarchical containers
   - `keyword_collections` table with `parent_id` for nesting
   - Folders can contain keywords (organizing keywords into groups)
   - OR folders can directly contain items (via new junction tables if needed)

**Recommended Approach: Folders Contain Keywords**

```
📁 Work (folder/collection)
   └─ keyword: "project-alpha"
   └─ keyword: "project-beta"
   └─ 📁 Archive (nested folder)
       └─ keyword: "2024-completed"

Conversation A has keywords: ["project-alpha", "meeting-notes"]
  → Appears under: Work folder (via project-alpha keyword)
```

**Alternative: Direct Folder-Item Links**

Could add `conversation_collections` junction table if needed:
```sql
CREATE TABLE conversation_collections (
  conversation_id TEXT,
  collection_id   INTEGER REFERENCES keyword_collections(id),
  PRIMARY KEY(conversation_id, collection_id)
);
```

### 1.3 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     tldw_server                              │
│  ┌─────────────┐    ┌────────────────────┐                  │
│  │  keywords   │───▶│ conversation_      │                  │
│  │  (tags)     │    │ keywords           │                  │
│  └─────────────┘    └────────────────────┘                  │
│        │                                                     │
│        ▼                                                     │
│  ┌─────────────────┐                                        │
│  │ collection_     │  (folders can group keywords)          │
│  │ keywords        │                                        │
│  └─────────────────┘                                        │
│        │                                                     │
│        ▼                                                     │
│  ┌─────────────────┐                                        │
│  │ keyword_        │  (hierarchical via parent_id)          │
│  │ collections     │                                        │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ Sync
┌─────────────────────────────────────────────────────────────┐
│                    Extension (Dexie)                         │
│  - Cache folders and keywords locally                        │
│  - Store UI preferences (expand state, colors)               │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 Extension Data Types

**Local Dexie Types:**
```typescript
// Mirror server keyword_collections
type Folder = {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
  last_modified: string;
  version: number;
  deleted: boolean;
};

// Mirror server keywords
type Keyword = {
  id: number;
  keyword: string;
  created_at: string;
  last_modified: string;
  version: number;
  deleted: boolean;
};

// Extend existing HistoryInfo
type HistoryInfo = {
  // ... existing fields
  keyword_ids?: number[];  // Links to server keyword IDs
};
```

**Local UI Preferences (not synced):**
```typescript
interface FolderUIPreferences {
  [folderId: number]: {
    isOpen: boolean;    // Expand/collapse state
    color?: string;     // UI color override
  };
}
```

### 1.5 Core Folder Features

| Feature | Implementation |
|---------|----------------|
| **Create Folder** | POST to `/api/v1/notes/keyword-collections/` → creates `keyword_collections` row |
| **Nested Folders** | Set `parent_id` when creating folder |
| **Folder Colors** | Store locally in `FolderUIPreferences` (or extend server schema) |
| **Expand/Collapse** | Store locally in `FolderUIPreferences` |
| **Assign to Folder** | Add keyword to item, link keyword to folder via `collection_keywords` |
| **Remove from Folder** | Unlink keyword from folder |
| **Bulk Operations** | Local UI only (Expand All / Collapse All) |
| **Folder Ordering** | Use existing `last_modified` or add `order` column to server |
| **Pin Items** | Use existing `is_pinned` field (no changes needed) |

**Empty Folders:** Server supports empty folders (they're real entities). UI can show empty folders unlike the previous keyword-based approach.

---

## 2. UI Components to Implement

### 2.1 Tree View Component

**tldw Implementation:** Use Ant Design `Tree` component (already available in antd v5.18.0)

```tsx
// Build tree from server folders (keyword_collections with parent_id)
const buildTreeData = (folders: Folder[]): TreeDataNode[] => {
  const map = new Map<number, TreeDataNode>();
  const roots: TreeDataNode[] = [];

  // Create nodes
  folders.filter(f => !f.deleted).forEach(folder => {
    map.set(folder.id, {
      key: folder.id,
      title: folder.name,
      children: [],
    });
  });

  // Build hierarchy using parent_id
  folders.filter(f => !f.deleted).forEach(folder => {
    const node = map.get(folder.id)!;
    if (folder.parent_id && map.has(folder.parent_id)) {
      map.get(folder.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

<Tree
  treeData={buildTreeData(folders)}
  draggable
  onDrop={handleMoveFolder}  // PATCH folder's parent_id on server
  titleRender={(node) => <FolderNode folder={node} />}
/>
```

### 2.2 Sidebar Enhancement

**Current tldw Sidebar structure:**
- Search input
- Date-grouped chat list (Today, Yesterday, Last 7 Days, Older)
- Pinned section
- Server chats section

**Enhanced structure:**
```
┌─────────────────────────────────┐
│ [Search] [📁/📅 Toggle]         │
├─────────────────────────────────┤
│ TOOLBAR                         │
│ [+Folder] [Expand] [Collapse]   │
├─────────────────────────────────┤
│ 📌 PINNED                       │
│   └─ Chat 1                     │
│   └─ Chat 2                     │
├─────────────────────────────────┤
│ 📁 FOLDERS (from server)        │
│   └─ 📁 Work                    │  ← keyword_collections.id=1
│       └─ Chat A                 │  ← has keyword linked to "Work"
│       └─ 📁 Projects            │  ← parent_id=1
│           └─ Chat B             │
│   └─ 📁 Personal                │  ← keyword_collections.id=3
│       └─ Chat C                 │
│   └─ 📁 Archive (empty)         │  ← Empty folders visible
├─────────────────────────────────┤
│ UNGROUPED (by date)             │
│   Today                         │
│   └─ Chat D                     │
│   Yesterday                     │
│   └─ Chat E                     │
└─────────────────────────────────┘
```

**Notes:**
- Folders are real server entities from `keyword_collections` table
- Nesting via `parent_id` (proper tree structure)
- Items appear in folders via keyword associations
- Empty folders can exist and be shown
- Toggle switches between folder view and date view

### 2.3 Folder Assignment UI

**Workflow: Add item to folder**
1. User clicks "Add to Folder" on conversation
2. FolderPicker modal shows folder tree
3. On select: link conversation to folder's keyword

```tsx
<Menu.Item
  key="addToFolder"
  icon={<FolderPlus className="w-4 h-4" />}
  onClick={() => showFolderPicker(chat.id)}>
  {t("common:addToFolder")}
</Menu.Item>

<Menu.Item
  key="removeFromFolder"
  icon={<FolderMinus className="w-4 h-4" />}
  onClick={() => showRemoveFolderPicker(chat.id)}>
  {t("common:removeFromFolder")}
</Menu.Item>
```

---

## 3. Future Considerations (Out of Scope for Initial Release)

The following features from NotebookLM Pro Tree are documented for potential future implementation but are **not part of the core folder system**:

### 3.1 Task Panel
Integrated task list with priorities, due dates, and completion tracking. Could integrate with chat notes.

### 3.2 Enhanced Search
- Fuzzy matching with Levenshtein distance
- Search scope indicator showing indexed count
- Content indexing with compression

### 3.3 Focus/Zen Mode
Toggle to hide sidebar and expand chat area full-width.

### 3.4 Export/Import Folder Preferences
Export/import `FolderUIPreferences` (colors, order, expand state) as JSON. Note: Item-to-folder assignments are already synced via keywords.

---

## 4. Technical Implementation Notes

### 4.1 Storage Strategy

| Data Type | Storage Location | Syncs to Server? |
|-----------|------------------|------------------|
| Folders | Dexie `folders` table (cache) | Yes - from `keyword_collections` |
| Keywords | Dexie `keywords` table (cache) | Yes - from server `keywords` table |
| Conversation-keyword links | Server `conversation_keywords` | Yes - server is source of truth |
| Folder UI preferences | Zustand with localStorage persist | No (local only) |

### 4.2 Server API Endpoints

**Existing endpoints (ChaChaNotes_DB.py):**

| Operation | Endpoint | DB Method |
|-----------|----------|-----------|
| List keywords | `GET /api/v1/notes/keywords/` | `fetch_all_keywords()` |
| Create keyword | `POST /api/v1/notes/keywords/` | `add_keyword(keyword_text)` |
| Delete keyword | `DELETE /api/v1/notes/keywords/{id}` | `soft_delete_keyword()` |
| Link conversation to keyword | N/A | `link_conversation_to_keyword()` |
| Unlink conversation from keyword | N/A | `unlink_conversation_from_keyword()` |
| Get keywords for conversation | N/A | `get_keywords_for_conversation()` |

**Endpoints needed (may need to be exposed):**

| Operation | Suggested Endpoint | DB Method (exists) |
|-----------|-------------------|-------------------|
| List folders | `GET /api/v1/notes/collections/` | `list_keyword_collections()` |
| Create folder | `POST /api/v1/notes/collections/` | `add_keyword_collection(name, parent_id)` |
| Update folder | `PATCH /api/v1/notes/collections/{id}` | `update_keyword_collection()` |
| Delete folder | `DELETE /api/v1/notes/collections/{id}` | `soft_delete_keyword_collection()` |
| Link keyword to folder | `POST /api/v1/notes/collections/{id}/keywords` | `link_collection_to_keyword()` |
| Unlink keyword from folder | `DELETE /api/v1/notes/collections/{id}/keywords/{kw_id}` | `unlink_collection_from_keyword()` |

### 4.3 Files to Modify

**Extension files:**

| File | Changes |
|------|---------|
| `src/db/dexie/types.ts` | Add `Folder`, `Keyword` types; add `keyword_ids` to `HistoryInfo` |
| `src/db/dexie/schema.ts` | Add `folders`, `keywords` tables with migrations |
| `src/services/tldw-server.ts` | Add folder/keyword API methods |
| `src/store/folder.tsx` | **New:** Zustand store for folders, keywords, UI prefs |
| `src/components/Folders/` | **New:** FolderTree, FolderPicker, FolderToolbar |
| `src/components/Option/Sidebar.tsx` | Integrate folder tree view |
| `src/assets/locale/*/common.json` | Add i18n strings |

**Server files (tldw_server2):**

| File | Changes |
|------|---------|
| `app/api/v1/endpoints/notes.py` | Expose keyword_collections endpoints |
| `app/api/v1/schemas/notes_schemas.py` | Add CollectionCreate, CollectionResponse schemas |

### 4.4 Extension Service Layer

```typescript
// src/services/folder-api.ts

// Folders (keyword_collections)
export const fetchFolders = () =>
  bgRequest<Folder[]>({ path: '/api/v1/notes/collections/', method: 'GET' });

export const createFolder = (name: string, parentId?: number) =>
  bgRequest<Folder>({
    path: '/api/v1/notes/collections/',
    method: 'POST',
    body: { name, parent_id: parentId }
  });

export const updateFolder = (id: number, data: { name?: string; parent_id?: number }) =>
  bgRequest<Folder>({
    path: `/api/v1/notes/collections/${id}`,
    method: 'PATCH',
    body: data
  });

export const deleteFolder = (id: number) =>
  bgRequest({ path: `/api/v1/notes/collections/${id}`, method: 'DELETE' });

// Keywords
export const fetchKeywords = () =>
  bgRequest<Keyword[]>({ path: '/api/v1/notes/keywords/', method: 'GET' });

export const createKeyword = (keyword: string) =>
  bgRequest<Keyword>({
    path: '/api/v1/notes/keywords/',
    method: 'POST',
    body: { keyword }
  });

// Linking
export const linkConversationToKeyword = (conversationId: string, keywordId: number) =>
  bgRequest({
    path: `/api/v1/notes/conversations/${conversationId}/keywords/${keywordId}`,
    method: 'POST'
  });

export const unlinkConversationFromKeyword = (conversationId: string, keywordId: number) =>
  bgRequest({
    path: `/api/v1/notes/conversations/${conversationId}/keywords/${keywordId}`,
    method: 'DELETE'
  });

export const getKeywordsForConversation = (conversationId: string) =>
  bgRequest<Keyword[]>({
    path: `/api/v1/notes/conversations/${conversationId}/keywords`,
    method: 'GET'
  });
```

### 4.5 Zustand Store

```typescript
// src/store/folder.tsx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FolderState {
  // Server data (cached)
  folders: Folder[];
  keywords: Keyword[];

  // Local UI preferences
  uiPrefs: Record<number, { isOpen: boolean; color?: string }>;

  // Actions
  setFolders: (folders: Folder[]) => void;
  setKeywords: (keywords: Keyword[]) => void;
  toggleFolderOpen: (folderId: number) => void;
  setFolderColor: (folderId: number, color: string) => void;

  // Sync
  refreshFromServer: () => Promise<void>;
}

export const useFolderStore = create<FolderState>()(
  persist(
    (set, get) => ({
      folders: [],
      keywords: [],
      uiPrefs: {},

      setFolders: (folders) => set({ folders }),
      setKeywords: (keywords) => set({ keywords }),

      toggleFolderOpen: (folderId) => set((state) => ({
        uiPrefs: {
          ...state.uiPrefs,
          [folderId]: {
            ...state.uiPrefs[folderId],
            isOpen: !state.uiPrefs[folderId]?.isOpen
          }
        }
      })),

      setFolderColor: (folderId, color) => set((state) => ({
        uiPrefs: {
          ...state.uiPrefs,
          [folderId]: { ...state.uiPrefs[folderId], color }
        }
      })),

      refreshFromServer: async () => {
        const [folders, keywords] = await Promise.all([
          fetchFolders(),
          fetchKeywords()
        ]);
        set({ folders, keywords });
      }
    }),
    {
      name: 'folder-store',
      partialize: (state) => ({ uiPrefs: state.uiPrefs }) // Only persist UI prefs
    }
  )
);
```

---

## 5. UI/UX Guidelines

### 5.1 Styling

**Use existing tldw patterns:**
- Tailwind `dark:` classes for dark mode (no CSS variables needed)
- Ant Design component theming
- Consistent with existing Sidebar styling

### 5.2 Animation Patterns

- Folder expand/collapse: Use Ant Design Tree's built-in animations
- Toast notifications: Use existing Ant Design `message` component
- Modal: Use existing Ant Design `Modal` component

### 5.3 Icons (lucide-react)

Use these icons from the existing `lucide-react` package:
- `Folder`, `FolderPlus`, `FolderOpen` - Folder states
- `FolderInput` - Move to folder action
- `ChevronRight`, `ChevronDown` - Tree expand/collapse
- `Tag` - Regular keyword indicator
- `X` - Remove from folder

---

## 6. Implementation Phases

### Phase 1: Server API (tldw_server2)
1. Expose `keyword_collections` endpoints in `notes.py`:
   - `GET /api/v1/notes/collections/` - list folders
   - `POST /api/v1/notes/collections/` - create folder
   - `PATCH /api/v1/notes/collections/{id}` - update folder
   - `DELETE /api/v1/notes/collections/{id}` - soft delete
2. Expose conversation-keyword linking endpoints:
   - `POST /api/v1/notes/conversations/{id}/keywords/{kw_id}` - link
   - `DELETE /api/v1/notes/conversations/{id}/keywords/{kw_id}` - unlink
   - `GET /api/v1/notes/conversations/{id}/keywords` - get keywords for conversation
3. Add Pydantic schemas for Collection CRUD

### Phase 2: Extension Foundation
1. Add `Folder`, `Keyword` types to `src/db/dexie/types.ts`
2. Add `folders`, `keywords` tables to Dexie schema (as cache)
3. Create `src/services/folder-api.ts` with API methods
4. Create `src/store/folder.tsx` Zustand store
5. Add `keyword_ids` field to `HistoryInfo` type

### Phase 3: Folder UI Components
1. Create `src/components/Folders/` directory:
   - `FolderTree.tsx` - Main tree using Ant Design Tree
   - `FolderPicker.tsx` - Modal for folder assignment
   - `FolderToolbar.tsx` - New Folder, Expand All, Collapse All
2. Integrate folder tree into `Sidebar.tsx`
3. Add folder assignment actions to chat dropdown menu
4. Toggle between folder view and date view

### Phase 4: Prompts & Enhancements
1. Add folder view to Prompts page
2. Folder colors (local UI preference)
3. Drag-and-drop folder reordering (update `parent_id`)
4. Nested folder creation dialog

### Phase 5: Polish
1. Search/filter within folders
2. Keyboard navigation
3. Accessibility (ARIA tree roles)
4. Performance optimization
5. Offline support with optimistic updates

---

## 7. Feature Integration Points

| Feature | Server Support | Extension Integration |
|---------|---------------|----------------------|
| **Chat History** | `conversation_keywords` table exists | Cache keywords, link via API |
| **Prompts** | `PromptKeywordLinks` table exists | Already has keywords, add folder linking |
| **Notes** | `note_keywords` table exists | Same pattern as chats |
| **Folders** | `keyword_collections` table exists | Sync and cache folders |

### 7.1 Shared Components

```
src/components/Folders/
├── FolderTree.tsx          # Ant Design Tree with server data
├── FolderPicker.tsx        # Modal to select folder(s)
├── FolderToolbar.tsx       # New Folder, Expand/Collapse All
├── FolderColorPicker.tsx   # Color selection (local UI)
└── useFolders.ts           # Hook wrapping Zustand store
```

### 7.2 Folder Picker Component

```tsx
<FolderPicker
  itemId={conversation.id}
  itemType="conversation"
  selectedKeywordIds={conversation.keyword_ids}
  onSelect={async (keywordIds) => {
    // Link conversation to keywords via API
    await Promise.all(keywordIds.map(kwId =>
      linkConversationToKeyword(conversation.id, kwId)
    ));
  }}
  allowMultiple={true}
  showCreateNew={true}
/>
```

### 7.3 Multi-Keyword Item Handling

When an item has multiple keywords (and thus appears in multiple folders):
- **Tree view:** Item appears under each folder whose keyword it has
- **Remove from folder:** Unlink specific keyword via API
- **Add to folder:** Link new keyword via API
- **Bulk operations:** Update multiple links in parallel

---

## 8. Design Decisions (Resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Folder storage** | Server `keyword_collections` | Native hierarchy via `parent_id`, full sync support |
| **Empty folders** | Yes, supported | Server stores folders as entities, not derived from items |
| **Folder deletion** | Soft delete on server | Preserves history, can be restored |
| **Case sensitivity** | Case-insensitive (server) | `COLLATE NOCASE` in SQLite handles this |
| **Item-folder linking** | Via keywords | Items have keywords → keywords belong to folders |
| **Offline support** | Optimistic UI with sync queue | Cache locally, sync when connected |

## 9. Open Questions (For Implementation)

1. **API exposure:** Which keyword_collections endpoints are already exposed vs need to be added?

2. **Folder-keyword relationship:** Should each folder have a "default" keyword, or can items be in folders directly?

3. **Bulk operations:** Should we add batch endpoints for linking multiple items to a folder?

4. **Folder ordering:** Add `order` column to `keyword_collections` or use `last_modified`?

---

## Appendix: NotebookLM Pro Tree Feature Reference

### Complete Feature List from V17.6

- [x] Folder creation with nesting
- [x] Folder colors (7 options)
- [x] Folder reordering (up/down)
- [x] Expand/collapse all
- [x] Item pinning
- [x] Move to folder menu
- [x] Eject from folder
- [x] Search with fuzzy matching
- [x] Content indexing with LZ compression
- [x] Task panel with priorities
- [x] Due dates on tasks
- [x] Completed tasks section
- [x] Focus/Zen mode
- [x] Export/import config
- [x] Reset tree
- [x] Custom confirmation modals
- [x] Toast notifications
- [x] Dark mode support
- [x] Select all/deselect all (source panel)
- [x] Bulk folder selection checkboxes
- [x] Health monitoring for selectors

### NotebookLM Files Referenced
- `content.js` - Main logic (~2000 lines)
- `background.js` - Config fetching
- `styles.css` - Theme-aware styling
- `lz-string_min.js` - Compression library

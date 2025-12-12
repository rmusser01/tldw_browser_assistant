# Product Requirements Document: Folder System & UX Enhancements
## tldw Assistant Browser Extension - Keyword-Based Folder Organization

**Version:** 1.0
**Date:** December 11, 2025
**Reference Project:** NotebookLM Pro Tree Extension (V17.6)

---

## Executive Summary

This PRD outlines design/UX enhancements adapted from the NotebookLM Pro Tree extension for implementation in the tldw extension. The primary feature is a **virtual folder system using a special keyword format** (`___folder_name___`) to organize items hierarchically, while maintaining compatibility with the existing flat keyword/tag system.

### Key Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Folder Scope** | All features (chats, prompts, notes) | Unified organization across the extension |
| **Folder Creation** | Both button + manual keyword | Accessible for all users, power-user friendly |
| **Multi-folder Assignment** | Yes, items in all matching folders | Like email labels; flexible organization |
| **Sync Strategy** | Existing keyword system | No server changes needed - folders are client-side interpretation of `___` keywords |
| **Nesting Delimiter** | Slash between keywords | `___parent___/___child___` displays as `parent/child` |

---

## 1. Folder System via Keywords

### 1.1 Keyword Format Specification

**Format:** `___folder_name___`
- Triple underscores as prefix and suffix
- Prevents accidental folder creation (e.g., normal keyword `cakes` vs folder keyword `___cakes___`)
- Nested folders: chain keywords with `/` separator: `___parent___/___child___`

**Examples:**
| Keyword Type | Keyword Value | UI Display |
|--------------|---------------|------------|
| Normal keyword | `recipe` | Tag chip: "recipe" |
| Folder keyword | `___recipes___` | 📁 recipes |
| Nested folder | `___work___/___projects___` | 📁 work / projects |
| Deep nesting | `___work___/___projects___/___2024___` | 📁 work / projects / 2024 |

**How Nesting Works:**
- Each segment is a complete `___name___` keyword
- Segments joined by `/` (no spaces)
- Item with `___work___/___projects___` appears under: work → projects
- The full string `___work___/___projects___` is stored as a single keyword

**Validation Rules:**
- Folder name cannot be empty (reject `______`)
- Individual segment names cannot contain `/`
- Folder names are case-insensitive for matching, preserved for display
- Max nesting depth: 5 levels (configurable)
- Min keyword length: 7 characters (`___` + at least 1 char + `___`)

### 1.2 Data Architecture

**Core Principle:** Folders are a client-side UI interpretation of keywords. The keyword itself (`___name___`) is the source of truth for folder membership. Only UI preferences are stored separately.

**Required Changes to `src/db/dexie/types.ts`:**
```typescript
type HistoryInfo = {
  // ... existing fields
  keywords?: string[];  // NEW: Array of keyword strings (includes folder keywords)
}
```

**Folder UI Preferences (local storage only - not synced):**
```typescript
interface FolderUIPreferences {
  // Keyed by folder keyword (e.g., "___work___")
  [folderKeyword: string]: {
    isOpen: boolean;      // Expand/collapse state
    color?: string;       // Optional folder color (hex)
    order?: number;       // Sort order (for manual reordering)
  }
}

// Stored in localStorage or Zustand with persist
// Example: { "___work___": { isOpen: true, color: "#4285f4" } }
```

**What is NOT stored separately:**
- ❌ Item-to-folder mappings (derived from item keywords)
- ❌ Pinned state (already exists as `is_pinned` on `HistoryInfo`)
- ❌ Folder hierarchy (derived from keyword path parsing)

### 1.3 Core Folder Features

| Feature | Implementation |
|---------|----------------|
| **Create Folder** | "New Folder" button opens dialog → user enters name → adds `___name___` keyword to selected item(s) |
| **Nested Folders** | Parse hierarchy from keyword path: `___parent___/___child___` |
| **Folder Colors** | Store in `FolderUIPreferences`, 7 color options |
| **Expand/Collapse** | Store `isOpen` in `FolderUIPreferences` |
| **Assign to Folder** | Add folder keyword to item's keywords array |
| **Remove from Folder** | Remove specific folder keyword from item (show which folder in context menu) |
| **Bulk Operations** | Expand All / Collapse All buttons in toolbar |
| **Folder Ordering** | Store `order` in `FolderUIPreferences` |
| **Pin Items** | Use existing `is_pinned` field (no changes needed) |

**Important:** Folders only exist when at least one item has the folder keyword. There are no "empty folders" - if you remove the last item from a folder, the folder disappears from the tree.

---

## 2. UI Components to Implement

### 2.1 Tree View Component

**NotebookLM Pattern:** Recursive `buildFolderNode()` creating nested `.plugin-tree-node` divs

**tldw Implementation:** Use Ant Design `Tree` or `DirectoryTree` component (already available in antd v5.18.0)

```tsx
// Conceptual structure
<Tree
  treeData={folderTreeData}
  draggable
  onDrop={handleDragToFolder}
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
│ [Search] [Toggle View]          │
├─────────────────────────────────┤
│ TOOLBAR                         │
│ [+Folder] [Expand] [Collapse]   │
├─────────────────────────────────┤
│ 📌 PINNED                       │
│   └─ Chat 1                     │
│   └─ Chat 2                     │
├─────────────────────────────────┤
│ 📁 FOLDERS                      │
│   └─ 📁 work                    │  ← Items with ___work___
│       └─ Chat A                 │
│       └─ 📁 projects            │  ← Items with ___work___/___projects___
│           └─ Chat B             │
│   └─ 📁 personal                │  ← Items with ___personal___
│       └─ Chat C                 │
├─────────────────────────────────┤
│ UNGROUPED (by date)             │
│   Today                         │
│   └─ Chat D                     │
│   Yesterday                     │
│   └─ Chat E                     │
└─────────────────────────────────┘
```

**Notes:**
- Folder names display without the `___` prefix/suffix
- `___work___/___projects___` displays as nested tree: work → projects
- Items in multiple folders appear in each matching folder
- "UNGROUPED" contains items with no folder keywords

### 2.3 Move-to-Folder Trigger

**NotebookLM Pattern:** Inject `.plugin-move-trigger` button on each row

**tldw Adaptation:** Add "Move to Folder" menu item in existing `Dropdown` actions:
```tsx
<Menu.Item
  key="moveToFolder"
  icon={<FolderIcon className="w-4 h-4" />}
  onClick={() => showFolderPicker(chat.id)}>
  {t("common:moveToFolder")}
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
| Chat keywords (including folder keywords) | Dexie `HistoryInfo.keywords` | **New field** - sync TBD based on server capabilities |
| Prompt keywords | Dexie `Prompt.keywords` | Already exists - uses existing sync if available |
| Folder UI preferences (color, order, isOpen) | localStorage or Zustand persist | No (local only) |

**Note:** `HistoryInfo` currently has no `keywords` field. This PRD adds it. Sync to server depends on whether tldw_server supports keywords on chat histories - if not, keywords will be local-only for chats initially.

### 4.2 Files to Modify

| File | Changes |
|------|---------|
| `src/db/dexie/types.ts` | Add `keywords` field to `HistoryInfo` |
| `src/db/dexie/schema.ts` | Add migration for keywords field, add index |
| `src/db/dexie/helpers.ts` | Add keyword management functions |
| `src/components/Option/Sidebar.tsx` | Add folder tree view, toolbar, folder filtering |
| `src/store/folder.tsx` | **New:** Zustand store for `FolderUIPreferences` |
| `src/components/Folders/` | **New:** Shared folder components |
| `src/utils/folder-keywords.ts` | **New:** Keyword parsing utilities |
| `src/assets/locale/*/common.json` | Add i18n strings for folder UI |
| `src/components/Option/Prompt/index.tsx` | Integrate folder view (prompts already have keywords) |

### 4.3 Keyword Parsing Utilities

```typescript
// src/utils/folder-keywords.ts

const FOLDER_PREFIX = '___';
const FOLDER_SUFFIX = '___';
const PATH_DELIMITER = '/'; // Separates ___parent___/___child___
const MAX_NESTING_DEPTH = 5;
const MIN_SEGMENT_LENGTH = 7; // ___ + 1 char + ___ = 7

// Detect if keyword is a folder (single or nested)
export const isFolderKeyword = (kw: string): boolean => {
  if (!kw || kw.length < MIN_SEGMENT_LENGTH) return false;
  // Check if it starts with ___ and the first segment is valid
  const segments = kw.split(PATH_DELIMITER);
  return segments.every(seg =>
    seg.startsWith(FOLDER_PREFIX) &&
    seg.endsWith(FOLDER_SUFFIX) &&
    seg.length >= MIN_SEGMENT_LENGTH
  );
};

// Parse folder keyword into display segments
// "___work___/___projects___" -> ["work", "projects"]
export const parseFolderSegments = (kw: string): string[] => {
  if (!isFolderKeyword(kw)) return [];
  return kw
    .split(PATH_DELIMITER)
    .map(seg => seg.slice(FOLDER_PREFIX.length, -FOLDER_SUFFIX.length))
    .slice(0, MAX_NESTING_DEPTH);
};

// Get display path (for UI)
// "___work___/___projects___" -> "work / projects"
export const getFolderDisplayPath = (kw: string): string => {
  return parseFolderSegments(kw).join(' / ');
};

// Get leaf folder name (last segment)
export const getFolderDisplayName = (kw: string): string => {
  const segments = parseFolderSegments(kw);
  return segments[segments.length - 1] || '';
};

// Generate folder keyword from display name
// "my folder" -> "___my_folder___"
export const createFolderKeyword = (name: string): string => {
  const sanitized = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  if (!sanitized) return '';
  return `${FOLDER_PREFIX}${sanitized}${FOLDER_SUFFIX}`;
};

// Create nested folder keyword
// ["work", "projects"] -> "___work___/___projects___"
export const createNestedFolderKeyword = (segments: string[]): string => {
  return segments
    .map(createFolderKeyword)
    .filter(Boolean)
    .slice(0, MAX_NESTING_DEPTH)
    .join(PATH_DELIMITER);
};

// Validate folder keyword
export const validateFolderKeyword = (kw: string): { valid: boolean; error?: string } => {
  if (!kw) return { valid: false, error: 'Empty keyword' };
  const segments = kw.split(PATH_DELIMITER);
  if (segments.length > MAX_NESTING_DEPTH) {
    return { valid: false, error: `Max depth is ${MAX_NESTING_DEPTH}` };
  }
  for (const seg of segments) {
    if (!seg.startsWith(FOLDER_PREFIX) || !seg.endsWith(FOLDER_SUFFIX)) {
      return { valid: false, error: 'Invalid segment format' };
    }
    if (seg.length < MIN_SEGMENT_LENGTH) {
      return { valid: false, error: 'Empty folder name' };
    }
  }
  return { valid: true };
};

// Extract all unique folder keywords from items
export const extractFolderKeywords = (items: { keywords?: string[] }[]): string[] => {
  const folders = new Set<string>();
  items.forEach(item => {
    item.keywords?.filter(isFolderKeyword).forEach(kw => folders.add(kw));
  });
  return Array.from(folders);
};

// Build tree structure for Ant Design Tree component
export interface FolderTreeNode {
  key: string;           // Full keyword path
  title: string;         // Display name (leaf segment)
  children: FolderTreeNode[];
  isLeaf?: boolean;
}

export const buildFolderTree = (folderKeywords: string[]): FolderTreeNode[] => {
  const root: FolderTreeNode[] = [];
  const nodeMap = new Map<string, FolderTreeNode>();

  // Sort by depth (shorter paths first) to ensure parents exist before children
  const sorted = [...folderKeywords].sort((a, b) =>
    a.split(PATH_DELIMITER).length - b.split(PATH_DELIMITER).length
  );

  for (const keyword of sorted) {
    const segments = keyword.split(PATH_DELIMITER);
    let currentPath = '';
    let parentChildren = root;

    for (let i = 0; i < segments.length; i++) {
      currentPath = currentPath ? `${currentPath}${PATH_DELIMITER}${segments[i]}` : segments[i];

      let node = nodeMap.get(currentPath);
      if (!node) {
        const displayName = segments[i].slice(FOLDER_PREFIX.length, -FOLDER_SUFFIX.length);
        node = {
          key: currentPath,
          title: displayName,
          children: [],
        };
        nodeMap.set(currentPath, node);
        parentChildren.push(node);
      }
      parentChildren = node.children;
    }
  }

  return root;
};
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

### Phase 1: Foundation
1. Add `keywords` field to `HistoryInfo` type in Dexie
2. Create Dexie schema migration with multi-entry index on keywords
3. Create `src/utils/folder-keywords.ts` with all parsing utilities (including nested folder support)
4. Create `src/store/folder.tsx` Zustand store for `FolderUIPreferences`

### Phase 2: Folder UI Components
1. Create `src/components/Folders/` directory:
   - `FolderTree.tsx` - Main tree using Ant Design Tree (supports nesting from day 1)
   - `FolderPicker.tsx` - Modal/dropdown for folder assignment
   - `FolderToolbar.tsx` - New Folder, Expand All, Collapse All buttons
2. Integrate folder tree into Sidebar.tsx
3. Add "Move to Folder" and "Remove from Folder" actions to chat dropdown menu
4. Multi-folder display: items appear in all matching folders

### Phase 3: Prompts Integration & Enhancements
1. Add folder view to Prompts page (prompts already have keywords)
2. Folder colors (store in `FolderUIPreferences`)
3. Manual folder ordering (up/down buttons in folder context menu)
4. "New Folder" dialog with nested folder creation support

### Phase 4: Polish
1. Search/filter within folders
2. Keyboard navigation (arrow keys, Enter to expand/collapse)
3. Accessibility (ARIA tree roles, focus management)
4. Performance optimization for large folder counts
5. Handle edge cases (special characters in names, very deep nesting)

---

## 7. Feature Integration Points

| Feature | Current State | Folder Integration |
|---------|---------------|-------------------|
| **Chat History** | No `keywords` field | Add `keywords` field to `HistoryInfo` type |
| **Prompts** | Has `keywords`/`tags` field | Already supported - parse `___` keywords from existing field |
| **Notes** | Investigate during implementation | Add same pattern if feature exists |

### 7.1 Shared Components

All folder components are reusable across features:

```
src/components/Folders/
├── FolderTree.tsx          # Main tree component (Ant Design Tree)
├── FolderPicker.tsx        # Modal/dropdown to select folder(s)
├── FolderToolbar.tsx       # New Folder, Expand All, Collapse All buttons
├── FolderColorPicker.tsx   # Color selection popover (Phase 3)
└── useFolders.ts           # Shared hook for folder state & operations
```

### 7.2 Folder Picker Component

Used when assigning items to folders:

```tsx
<FolderPicker
  selectedFolders={item.keywords?.filter(isFolderKeyword)}
  onSelect={(folderKeywords) => updateItemKeywords(item.id, folderKeywords)}
  allowMultiple={true}   // Items can be in multiple folders
  showCreateNew={true}   // "New Folder..." option at bottom
  showNested={true}      // Allow selecting/creating nested folders
/>
```

### 7.3 Multi-Folder Item Handling

When an item is in multiple folders:
- **Tree view:** Item appears in each folder it belongs to
- **Remove from folder:** Context menu shows "Remove from [folder name]" for each folder
- **Move to folder:** Adds keyword (doesn't remove from other folders)
- **Remove all folders:** Separate action to clear all folder keywords

---

## 8. Design Decisions (Resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Default folders** | No | Let users create their own organization |
| **Empty folders** | No | Folders only exist when items have the keyword (simplest model) |
| **Folder deletion** | Remove keyword from all items | With confirmation dialog; most intuitive behavior |
| **Case sensitivity** | Case-insensitive matching | `___Work___` and `___work___` are the same folder; preserve original case for display |
| **Slash in folder names** | Rejected at input | User cannot type `/` in folder name (it's the nesting delimiter) |

## 9. Open Questions (For Implementation)

1. **Notes feature:** Does the Notes feature exist in the codebase? If so, should it support folders?

2. **Server sync for chat keywords:** Does tldw_server support keywords on chat histories? If not, chat keywords will be local-only initially.

3. **Folder icon in tree:** Should folders show item count badge? (e.g., "work (5)")

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

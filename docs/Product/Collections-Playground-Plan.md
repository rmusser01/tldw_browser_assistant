# Collections Playground - Implementation Plan

## Design Decisions
- **Layout**: Reading-Centric Tabs
- **Scope**: Balanced implementation covering all features equally
- **Priority Integrations**: Bulk import (Pocket, Kindle, JSON) and export to formats (MD, HTML, newsletter)

---

## API Capabilities Summary

The tldw_server Collections API provides these main feature areas:

### 1. Reading List (`/reading/*`)
- **CRUD**: Save URLs, list items, get details, update status/tags/notes, delete/archive
- **Search**: Full-text search with BM25 relevance ranking
- **Filtering**: By status (saved/reading/read/archived), tags, domain, date range, favorites
- **Sorting**: By updated/created date, title, relevance
- **Pagination**: Offset/limit up to 200 items per request
- **AI Features**: Summarize with LLM, generate TTS audio
- **Import**: Bulk import from Pocket, Kindle, JSON, etc.

### 2. Highlights (`/reading/highlights/*`)
- Create highlights with quotes, colors, notes
- Anchoring strategies (fuzzy quote or exact offset)
- State tracking (active/stale when content changes)
- Context preservation for re-anchoring

### 3. Output Templates (`/outputs/templates/*`)
- Template types: newsletter_markdown, briefing_markdown, mece_markdown, newsletter_html, tts_audio
- Jinja2 template syntax
- Preview rendering before persistence
- Export to MD, HTML, or MP3

### 4. Prompt Collections (`/prompts/collections/*`)
- Group prompts by collection
- Basic CRUD operations

---

## Tab Structure (Reading-Centric)

```
┌─────────────────────────────────────────────────────────────┐
│ [📚 Reading List] [✨ Highlights] [📝 Templates] [↔️ Import/Export] │
└─────────────────────────────────────────────────────────────┘
```

1. **Reading List** - Main item management (CRUD, search, filters, status)
2. **Highlights** - Browse/manage all highlights across items with notes
3. **Templates** - Output template management and preview
4. **Import/Export** - Bulk import wizard and export functionality

---

## Component Architecture

```
src/
├── routes/
│   └── option-collections.tsx        # Route entry point
├── components/Option/Collections/
│   ├── index.tsx                     # CollectionsPlaygroundPage (tabs)
│   ├── ReadingList/
│   │   ├── ReadingItemsList.tsx      # List view with search/filters
│   │   ├── ReadingItemCard.tsx       # Card in list view
│   │   ├── ReadingItemDetail.tsx     # Full detail drawer/modal
│   │   ├── AddUrlModal.tsx           # Quick add URL
│   │   └── ImportWizard.tsx          # Multi-step import
│   ├── Highlights/
│   │   ├── HighlightsList.tsx        # Browse all highlights
│   │   ├── HighlightCard.tsx         # Individual highlight
│   │   └── HighlightEditor.tsx       # Create/edit highlight
│   ├── Templates/
│   │   ├── TemplatesList.tsx         # List templates
│   │   ├── TemplateEditor.tsx        # Create/edit template
│   │   └── TemplatePreview.tsx       # Preview rendering
│   └── common/
│       ├── StatusBadge.tsx           # saved/reading/read/archived
│       ├── TagSelector.tsx           # Tag management
│       └── FilterPanel.tsx           # Reusable filters
├── store/
│   └── collections.tsx               # Zustand store
├── services/tldw/
│   └── TldwApiClient.ts              # Add collections methods
└── types/
    └── collections.ts                # TypeScript types
```

---

## Key UX Interactions

### 1. Reading List View
```
┌─────────────────────────────────────────────────────────────┐
│ Collections Playground                                       │
├─────────────────────────────────────────────────────────────┤
│ [Reading List] [Highlights] [Templates] [Import/Export]     │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────┐ ┌──────────────────────────────────────┐  │
│ │ + Add URL     │ │ 🔍 Search...              [Filters ▼]│  │
│ └───────────────┘ └──────────────────────────────────────┘  │
│                                                             │
│ Status: [All ▼] Tags: [All ▼] Sort: [Recent ▼]             │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ⭐ Article Title                          saved | 2h ago │ │
│ │    example.com · 5 min read                             │ │
│ │    Summary preview text...                              │ │
│ │    [reading] [tech] [ai]                    [...] [👁]  │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │   Another Article                       reading | 1d ago │ │
│ │    ...                                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Showing 1-20 of 156 items              [< 1 2 3 ... 8 >]   │
└─────────────────────────────────────────────────────────────┘
```

### 2. Item Detail View (Drawer)
```
┌──────────────────────────────────────────────────────────┐
│ Article Title                                    [X]     │
├──────────────────────────────────────────────────────────┤
│ example.com · Published Jan 15, 2026 · 5 min read       │
│ Status: [saved ▼]  ⭐ Favorite  Tags: [+]                │
├──────────────────────────────────────────────────────────┤
│ [Content] [Highlights (3)] [Notes] [Actions]            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   Full article content rendered here...                  │
│                                                          │
│   "Highlighted text appears like this"  📝              │
│                                                          │
│   More content...                                        │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ [🤖 Summarize] [🔊 Generate TTS] [📤 Export] [🗑 Delete] │
└──────────────────────────────────────────────────────────┘
```

### 3. Quick Add URL
```
┌────────────────────────────────────────┐
│ Add to Reading List                [X] │
├────────────────────────────────────────┤
│ URL:                                   │
│ ┌────────────────────────────────────┐ │
│ │ https://example.com/article       │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Title (optional):                      │
│ ┌────────────────────────────────────┐ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
│                                        │
│ Tags:                                  │
│ [reading] [tech] [+]                   │
│                                        │
│ Notes:                                 │
│ ┌────────────────────────────────────┐ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
│                                        │
│            [Cancel] [Save to List]     │
└────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation & Infrastructure
**Files to create:**
- `src/routes/option-collections.tsx` - Route entry
- `src/components/Option/Collections/index.tsx` - Tab container
- `src/store/collections.tsx` - Zustand store
- `src/types/collections.ts` - TypeScript types

**Tasks:**
- [x] Create route and register in router
- [x] Add navigation link to HeaderShortcuts.tsx
- [x] Create tab shell with 4 tabs (skeleton)
- [x] Add Collections API methods to TldwApiClient.ts
- [x] Create Zustand store with state for all 4 tabs

### Phase 2: Reading List Tab (Core)
**Files to create:**
- `src/components/Option/Collections/ReadingList/ReadingItemsList.tsx`
- `src/components/Option/Collections/ReadingList/ReadingItemCard.tsx`
- `src/components/Option/Collections/ReadingList/ReadingItemDetail.tsx`
- `src/components/Option/Collections/ReadingList/AddUrlModal.tsx`
- `src/components/Option/Collections/common/StatusBadge.tsx`
- `src/components/Option/Collections/common/TagSelector.tsx`
- `src/components/Option/Collections/common/FilterPanel.tsx`

**Tasks:**
- [x] List view with search, pagination, status/tag filters
- [x] Add URL modal (title, tags, notes)
- [x] Item detail drawer (view content, metadata)
- [x] Status update (saved → reading → read → archived)
- [x] Toggle favorite, manage tags
- [x] Delete/archive with confirmation
- [x] LLM summarization action

### Phase 3: Highlights Tab
**Files to create:**
- `src/components/Option/Collections/Highlights/HighlightsList.tsx`
- `src/components/Option/Collections/Highlights/HighlightCard.tsx`
- `src/components/Option/Collections/Highlights/HighlightEditor.tsx`

**Tasks:**
- [x] List all highlights across items with filters
- [x] Group by item or show flat list (toggle)
- [x] Create highlight from item detail view
- [x] Edit highlight (color, note)
- [x] Delete highlight with confirmation
- [x] Navigate to source item from highlight

### Phase 4: Templates Tab
**Files to create:**
- `src/components/Option/Collections/Templates/TemplatesList.tsx`
- `src/components/Option/Collections/Templates/TemplateEditor.tsx`
- `src/components/Option/Collections/Templates/TemplatePreview.tsx`

**Tasks:**
- [x] List templates (newsletter, briefing, MECE, TTS)
- [x] Create/edit template (name, type, format, Jinja2 body)
- [x] Preview template with selected items
- [x] Delete template with confirmation
- [x] Generate output from template (renders to MD/HTML/MP3)

### Phase 5: Import/Export Tab
**Files to create:**
- `src/components/Option/Collections/ImportExport/ImportWizard.tsx`
- `src/components/Option/Collections/ImportExport/ExportPanel.tsx`

**Tasks:**
- [x] Import wizard: Source selection (Pocket, Kindle, Instapaper, JSON)
- [x] Import wizard: File upload or API key input
- [x] Import wizard: Preview & confirm import
- [x] Import wizard: Progress tracking
- [x] Export: Select items or filter
- [x] Export: Choose format (JSON, CSV, MD newsletter)
- [x] Export: Download or copy to clipboard

### Phase 6: Polish & Integration
- [x] Add i18n translations (create `src/assets/locale/en/collections.json`)
- [x] Keyboard shortcuts (Ctrl+N for add, etc.)
- [x] Empty states with helpful prompts
- [x] Loading states and error handling
- [x] TTS generation action in item detail

---

## Verification Plan

1. **Manual Testing:**
   - Add a URL, verify it appears in list
   - Change status through all states
   - Create highlight, verify in Highlights tab
   - Create template, preview with items
   - Import sample JSON, verify items appear
   - Export items, verify file contents

2. **E2E Tests (Playwright):**
   - Create `tests/e2e/collections.spec.ts`
   - Test CRUD operations for reading items
   - Test highlight creation
   - Test template preview
   - Test import/export flows

---

## Reference Files

These existing files should be referenced during implementation:

| Purpose | File |
|---------|------|
| Store pattern | `src/store/data-tables.tsx` |
| Page layout | `src/components/Option/DataTables/DataTablesPage.tsx` |
| List view | `src/components/Option/DataTables/DataTablesList.tsx` |
| Detail drawer | `src/components/Option/DataTables/TableDetailModal.tsx` |
| Modal form | `src/components/Option/DataTables/AddColumnModal.tsx` |
| Wizard | `src/components/Option/DataTables/CreateTableWizard.tsx` |
| API client | `src/services/tldw/TldwApiClient.ts` |
| Types | `src/types/data-tables.ts` |
| Route entry | `src/routes/option-data-tables.tsx` |
| Header nav | `src/components/Layouts/HeaderShortcuts.tsx` |

---

## Summary

A 6-phase implementation plan for a Collections Playground with:
- **4 tabs**: Reading List, Highlights, Templates, Import/Export
- **~18 new component files** organized by feature
- **Full CRUD** for reading items, highlights, and templates
- **Bulk import** from Pocket/Kindle/JSON
- **Export** to JSON/CSV/MD formats
- **AI features**: LLM summarization, TTS generation

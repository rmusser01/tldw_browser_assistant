# UX Redesign Plan: "Search & Context" Modal (Full Redesign)

## Decisions
- **Scope**: Full redesign with new component architecture
- **Naming**: "Search & Context"
- **Features**: Expose ALL available RAG capabilities

---

## 1. Current State Analysis

### Files Involved
- `src/components/Sidepanel/Chat/RagSearchBar.tsx` - Current RAG search UI (367 lines)
- `src/components/Option/Playground/PlaygroundForm.tsx` - Modal container (~3700 lines)
- `src/components/Option/Settings/rag.tsx` - RAG settings (will migrate relevant options)
- `src/hooks/chat-modes/ragMode.ts` - RAG chat mode with advanced options
- `src/store/option/slices/rag-slice.ts` - RAG state management
- `src/services/tldw/TldwApiClient.ts` - RAG API methods (lines 878-906)

### Current UX Problems (Senior HCI/UX Perspective)

**1. Information Architecture Issues**
- "Ctx + Media" label is cryptic jargon - unclear to new users
- Modal combines 3 distinct concerns: RAG search, tab context, file uploads
- No clear mental model for how these features relate to each other

**2. Feature Discoverability**
- Many powerful RAG features are hidden in Settings, not accessible during search:
  - Search mode (hybrid/vector/full-text)
  - Re-ranking toggle
  - Citation generation
  - Top-K (number of results)
  - Source filtering
- Users must navigate away from chat to adjust retrieval behavior

**3. Visual Hierarchy & Layout**
- Dense horizontal filter row (media type, date, tags, timeout) feels cluttered
- All filters have equal visual weight - no progressive disclosure
- Results list uses generic List.Item with no visual distinction between content types

**4. Interaction Design**
- No feedback on search quality or relevance scores
- No way to preview full document before inserting
- Actions (Insert/Ask/Open/Copy) are text links - low affordance
- Tag input requires separate "Add" button click - friction

**5. Error States & Edge Cases**
- Timeout handling is reactive only (retry, increase timeout)
- No indication of knowledge base status (empty, indexing, healthy)
- Disconnected state shows generic message - no recovery guidance

---

## 2. RAG Capabilities to Expose (ALL Features)

From `ragMode.ts` and `TldwApiClient.ts`:

### Primary Controls (Always Visible)
| Feature | API Parameter | UI Element |
|---------|---------------|------------|
| Search query | `query` | Full-width input with Enter to search |
| Search mode | `search_mode` | Segmented control: Hybrid / Semantic / Keyword |
| Results count | `top_k` | Dropdown: 5, 10, 15, 25, 50 |

### Filters Section (Collapsible, default open)
| Feature | API Parameter | UI Element |
|---------|---------------|------------|
| Media type | `filters.type` | Multi-select chips: All, HTML, PDF, Doc, Audio, Video |
| Date range | `filters.date_from` | Preset buttons: Any, 7d, 30d, 90d + custom picker |
| Tags | `filters.tags` | Tag input with autocomplete from existing tags |
| Source filter | `ragSources` | Dropdown: All sources, Media DB, Notes, specific media |
| Search within | `ragMediaIds` | Searchable dropdown of ingested media items |

### Advanced Options (Expandable section)
| Feature | API Parameter | UI Element |
|---------|---------------|------------|
| Enable re-ranking | `enable_reranking` | Toggle switch |
| Re-rank top K | `rerank_top_k` | Number input (when re-ranking enabled) |
| Enable citations | `enable_citations` | Toggle switch |
| Citation style | `citation_style` | Dropdown: Inline, Footnote, Numbered |
| Enable cache | `enable_cache` | Toggle switch |
| Timeout | `timeoutMs` | Slider: 5s - 60s |
| Enable generation | `ragEnableGeneration` | Toggle (generates answer from context) |

### Result Actions (Per Result)
| Action | Behavior |
|--------|----------|
| Insert | Add snippet + source URL to message input |
| Ask | Insert + immediately send message |
| Preview | Expand to show full chunk in modal |
| Open source | Open URL in new tab |
| Copy | Copy snippet to clipboard |
| Add to context | Pin this result for multi-turn conversation |

---

## 3. Proposed Redesign

### A. Modal Header
- **Title**: "Search & Context"
- **Subtitle**: "Search your knowledge base and attach context"
- **Status badge**: Connection indicator (green/yellow/red)
- **Actions**: Help (?), Close (X)

### B. Complete Layout Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🔍 SEARCH & CONTEXT                           [●Connected] [?] [X] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌─────────────────────────────────────────────────────┐ ┌────────┐ │
│ │ Search your knowledge base...                       │ │ Search │ │
│ └─────────────────────────────────────────────────────┘ └────────┘ │
│                                                                     │
│ Search Mode: [■ Hybrid] [ Semantic ] [ Keyword ]    Results: [10▼] │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ ▼ FILTERS                                                           │
├─────────────────────────────────────────────────────────────────────┤
│ Type:  [✓All] [HTML] [PDF] [Doc] [Audio] [Video]                   │
│                                                                     │
│ Date:  (●Any) (○7d) (○30d) (○90d) [Custom...]                      │
│                                                                     │
│ Tags:  [tag1 ×] [tag2 ×] [+ Add tag...]                            │
│                                                                     │
│ Sources: [All sources ▼]     Search within: [All media ▼]          │
├─────────────────────────────────────────────────────────────────────┤
│ ▶ ADVANCED OPTIONS                                                  │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│ (Expanded state:)                                                   │
│ Re-ranking: [■ On]  Re-rank K: [5]    Citations: [■ On] Style:[▼]  │
│ Cache results: [□]   Timeout: [──●────] 15s   Generation: [□]      │
├─────────────────────────────────────────────────────────────────────┤
│ RESULTS (8 found)                               Sort: [Relevance▼] │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 📄 PDF  "Machine Learning Fundamentals"           0.94  [+][⋯] │ │
│ │ ──────────────────────────────────────────────────────────────  │ │
│ │ Neural networks are computing systems inspired by biological... │ │
│ │ Source: uploads/ml-book.pdf • Added 3 days ago                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🌐 HTML "Deep Learning Tutorial"                  0.87  [+][⋯] │ │
│ │ ──────────────────────────────────────────────────────────────  │ │
│ │ Convolutional neural networks excel at image recognition...     │ │
│ │ Source: https://example.com/tutorial • Added 1 week ago         │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                        [Load more results...]                       │
├─────────────────────────────────────────────────────────────────────┤
│ ATTACHED CONTEXT (2 items)                          [Clear all]    │
├─────────────────────────────────────────────────────────────────────┤
│ 🗂️ Current tab: "GitHub - tldw-assistant"                     [×] │
│ 📎 File: research-notes.pdf (2.3 MB)                          [×] │
└─────────────────────────────────────────────────────────────────────┘
```

### C. Result Card Actions (Overflow Menu)

```
┌──────────────────┐
│ ➕ Insert        │  ← Primary action (also the [+] button)
│ ❓ Ask           │  ← Insert + send immediately
│ ────────────────│
│ 👁️ Preview full │  ← Expand to full document modal
│ 🔗 Open source  │  ← New tab
│ 📋 Copy         │  ← Clipboard
│ 📌 Pin to context│  ← Keep for multi-turn
└──────────────────┘
```

### D. Empty / Error States

**Empty state (no search yet)**:
```
┌─────────────────────────────────────────────┐
│       🔍                                    │
│   Search your knowledge base                │
│                                             │
│   Try: "machine learning", "API docs",      │
│        "meeting notes from last week"       │
│                                             │
│   [Browse all media →]                      │
└─────────────────────────────────────────────┘
```

**No results**:
```
┌─────────────────────────────────────────────┐
│   No results found for "xyz"                │
│                                             │
│   Suggestions:                              │
│   • Try different keywords                  │
│   • Remove some filters                     │
│   • Switch to Keyword search mode           │
│   • [Check knowledge base status →]         │
└─────────────────────────────────────────────┘
```

**Disconnected state**:
```
┌─────────────────────────────────────────────┐
│   ⚠️ Server disconnected                    │
│                                             │
│   Unable to search knowledge base.          │
│   [Retry connection] [Open settings]        │
└─────────────────────────────────────────────┘
```

### E. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` or `Ctrl+K` | Focus search input |
| `Enter` | Execute search |
| `↑/↓` | Navigate results |
| `Enter` (on result) | Insert selected result |
| `Ctrl+Enter` | Insert + send (Ask) |
| `Escape` | Close modal |
| `Tab` | Cycle through filter sections |

---

## 4. Implementation Steps

### Phase 1: New Component Architecture

**1. Create base components** in `src/components/SearchContext/`
```
src/components/SearchContext/
├── SearchContextModal.tsx       # Main modal container
├── SearchContextHeader.tsx      # Title, status, actions
├── SearchInput.tsx              # Query input + search mode + top-k
├── SearchFilters.tsx            # Collapsible filters section
├── AdvancedOptions.tsx          # Re-ranking, citations, cache, etc.
├── ResultsList.tsx              # Results container with loading states
├── ResultCard.tsx               # Individual result with actions
├── ResultPreviewModal.tsx       # Full document preview
├── AttachedContext.tsx          # Tabs + files section
├── EmptyStates.tsx              # Empty, no-results, error, disconnected
└── index.ts                     # Public exports
```

**2. Create custom hooks** in `src/hooks/`
```
src/hooks/
├── useSearchContext.ts          # Main search state & actions
├── useRagSearch.ts              # API integration with React Query
├── useSearchFilters.ts          # Filter state management
├── useResultNavigation.ts       # Keyboard navigation for results
└── useSearchHistory.ts          # Recent searches (optional)
```

### Phase 2: State Management Updates

**3. Update `src/store/option/slices/rag-slice.ts`**
- Add: `searchMode`, `topK`, `enableReranking`, `rerankTopK`
- Add: `enableCitations`, `citationStyle`, `enableCache`
- Add: `enableGeneration`, `timeout`
- Add: `pinnedResults` (for multi-turn context)
- Add: actions for each setting

**4. Create new search context store** `src/store/search-context.ts`
- `query`, `results`, `isLoading`, `error`
- `filters` (type, date, tags, sources, mediaIds)
- `advancedOptions` (all toggles)
- `attachedContext` (tabs + files + pinned results)
- Persist user preferences to extension storage

### Phase 3: API Integration

**5. Update `src/services/tldw/TldwApiClient.ts`**
- Extend `ragSearch()` to accept all new options
- Add response typing for relevance scores
- Add `ragGetAllTags()` for tag autocomplete
- Add `ragGetMediaList()` for "search within" dropdown

**6. Create `src/hooks/useRagSearch.ts`**
```typescript
export const useRagSearch = (query: string, options: RagSearchOptions) => {
  return useQuery({
    queryKey: ['ragSearch', query, options],
    queryFn: () => tldwClient.ragSearch(query, options),
    enabled: !!query.trim(),
    staleTime: 30_000, // Cache for 30s
  })
}
```

### Phase 4: Component Implementation

**7. Build `SearchContextModal.tsx`** (main container)
- Modal with proper focus trap
- Responsive: drawer on mobile, modal on desktop
- Handle open/close state
- Keyboard shortcut registration

**8. Build `SearchInput.tsx`**
- Search input with debounced query
- Segmented control for search mode
- Dropdown for top-k selection
- Enter to search, Escape to clear

**9. Build `SearchFilters.tsx`**
- Collapsible section (default expanded)
- Media type multi-select chips
- Date range radio buttons + custom picker
- Tag input with autocomplete
- Source and media dropdowns

**10. Build `AdvancedOptions.tsx`**
- Collapsible section (default collapsed)
- Toggle switches for all advanced options
- Conditional inputs (rerank K only when reranking enabled)
- Timeout slider

**11. Build `ResultCard.tsx`**
- Media type icon with color coding
- Title, snippet, metadata
- Relevance score badge
- Primary action button [+]
- Overflow menu for secondary actions
- Hover state with subtle expansion

**12. Build `ResultPreviewModal.tsx`**
- Full document/chunk content
- Highlight search terms
- Actions: Insert, Ask, Copy, Open source

**13. Build `AttachedContext.tsx`**
- List of attached tabs, files, pinned results
- Remove individual items
- Clear all button
- Drop zone for file uploads

**14. Build `EmptyStates.tsx`**
- Initial empty state with suggestions
- No results state with actionable tips
- Error state with retry
- Disconnected state with recovery actions

### Phase 5: Integration

**15. Update `PlaygroundForm.tsx`**
- Replace `RagSearchBar` with new `SearchContextModal`
- Update button label to "Search & Context"
- Pass required callbacks (onInsert, onAsk)

**16. Update sidepanel integration**
- Ensure modal works in both sidepanel and options page
- Handle responsive layout differences

**17. Add keyboard shortcuts**
- Register global shortcuts in background script
- Implement result navigation with arrow keys

### Phase 6: Polish & Testing

**18. Add animations & transitions**
- Collapse/expand animations for sections
- Result list enter/exit animations
- Loading skeleton states

**19. Accessibility audit**
- ARIA labels for all interactive elements
- Screen reader announcements for results
- Focus management
- Color contrast verification

**20. Update i18n**
- Add new translation keys to `src/assets/locale/*/sidepanel.json`
- Update `playground.json` for new labels

**21. Write tests**
- Unit tests for hooks
- Component tests for interactions
- E2E tests: search flow, filter combinations, actions

---

## 5. Verification Plan

### Manual QA Checklist
- [ ] Modal opens/closes correctly from all entry points
- [ ] Search executes on Enter and button click
- [ ] All 3 search modes (Hybrid/Semantic/Keyword) work
- [ ] Top-K selection changes result count
- [ ] All media type filters work correctly
- [ ] Date range filters (including custom) work
- [ ] Tag input with autocomplete functions
- [ ] Source and media dropdowns populate correctly
- [ ] Advanced options toggle correctly
- [ ] Re-ranking toggle enables/disables re-rank K input
- [ ] Citations toggle works with style selection
- [ ] Cache and generation toggles work
- [ ] Timeout slider adjusts request timeout
- [ ] Results display with relevance scores
- [ ] Insert action adds content to message input
- [ ] Ask action inserts + sends message
- [ ] Preview modal shows full content
- [ ] Open source opens new tab
- [ ] Copy action copies to clipboard
- [ ] Pin to context adds to attached context
- [ ] Attached context shows tabs, files, pinned results
- [ ] Clear all removes all attached context
- [ ] Empty states display correctly
- [ ] Error states display correctly with recovery actions
- [ ] Disconnected state displays correctly
- [ ] Keyboard shortcuts work (/, Ctrl+K, arrows, Enter, Escape)
- [ ] Responsive layout on narrow viewports
- [ ] Screen reader navigates correctly

### Automated Testing
1. **Unit tests** (`src/hooks/__tests__/`)
   - `useRagSearch.test.ts` - API integration
   - `useSearchFilters.test.ts` - Filter state
   - `useResultNavigation.test.ts` - Keyboard nav

2. **Component tests** (`src/components/SearchContext/__tests__/`)
   - `SearchInput.test.tsx` - Query, mode, top-k
   - `SearchFilters.test.tsx` - All filter interactions
   - `ResultCard.test.tsx` - Actions, overflow menu
   - `EmptyStates.test.tsx` - All state variations

3. **E2E tests** (`tests/e2e/`)
   - `search-context.spec.ts` - Full search flow
   - Update existing `chatStreaming.spec.ts` to use new modal

### Build Verification
```bash
bun run compile        # TypeScript check
bun run build:chrome   # Production build
bun run test:e2e       # E2E tests
```

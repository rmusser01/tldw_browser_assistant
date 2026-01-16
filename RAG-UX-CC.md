# RAG Modal UX Redesign Plan

## Executive Summary

Redesign the "Ctx + Media" modal (currently `RagSearchBar.tsx` at 3,000+ lines with 193 parameters) into a task-oriented, progressive disclosure interface that serves both power users and general users.

---

## 1. Naming Change

**Current:** "Ctx + Media" (confusing, technical)

**Proposed:** "Knowledge Search"
- Clear purpose (searching your knowledge base)
- Action-oriented
- Avoids jargon ("RAG", "Context")

---

## 2. Core UX Problem

The current modal conflates three distinct workflows in a single scrolling panel:
1. **Search & Insert** - Finding and using knowledge
2. **Configure** - Tuning RAG behavior
3. **Manage Context** - Handling tabs/files/pins

**Solution:** Split into three tabs with progressive disclosure within each.

---

## 3. Proposed Information Architecture

```
+--------------------------------------------------+
| KNOWLEDGE SEARCH                            [X]  |
+--------------------------------------------------+
| [ Search ]  [ Settings ]  [ Context ]            |
+--------------------------------------------------+
```

### Tab 1: Search (Default)
Primary workflow - 80% of use cases

```
+--------------------------------------------------+
| [Search your knowledge...]              [Search] |
| [ ] Use current message                          |
+--------------------------------------------------+
| Quick Filters: [All] [Notes] [Media] [Chats]     |
+--------------------------------------------------+
| RESULTS (8)                    Sort: [Relevance] |
| +----------------------------------------------+ |
| | "Machine Learning Fundamentals"    0.94      | |
| | Neural networks are computing...             | |
| | [Insert] [Ask] [Preview] [Pin]               | |
| +----------------------------------------------+ |
+--------------------------------------------------+
| Pinned: [ML Fundamentals x] [Deep Learning x]    |
+--------------------------------------------------+
```

**Key changes:**
- Query always visible at top
- Source filters as quick chips (not buried in settings)
- Results take maximum space
- Pinned shown as compact chips
- Actions reduced to 4 primary

### Tab 2: Settings
For users who want to tune behavior

```
+--------------------------------------------------+
| Preset: [Balanced v]         [Reset to defaults] |
+--------------------------------------------------+
| How thorough should the search be?               |
|                                                  |
| Fast  [====|=================]  Thorough         |
|                                                  |
| Currently: Balanced (hybrid search, reranking,   |
| 8 results, citations enabled)                    |
+--------------------------------------------------+
| Strategy: (o) Standard  ( ) Agentic              |
+--------------------------------------------------+
| [v] Show advanced options                        |
+--------------------------------------------------+
```

**Progressive disclosure layers:**
1. **Immediate:** Preset dropdown, speed slider
2. **One click:** Core settings (reranking, citations, safety)
3. **"Show advanced":** Retrieval mode, generation, context construction
4. **"Show expert":** All 100+ remaining parameters (searchable)

### Tab 3: Context
Manage attached items

```
+--------------------------------------------------+
| Tabs (2)                            [Refresh]    |
| | GitHub - tldw-assistant              [X]     | |
| | docs.example.com/api                 [X]     | |
| [+ Add from open tabs...]                        |
+--------------------------------------------------+
| Files (1)                           [Add file]   |
| | research-notes.pdf (2.3 MB)          [X]     | |
+--------------------------------------------------+
| Pinned Results (2)                [Clear all]    |
| | Machine Learning Fundamentals        [X]     | |
| | Deep Learning Tutorial               [X]     | |
+--------------------------------------------------+
| These items will be included in your next query  |
+--------------------------------------------------+
```

---

## 4. Progressive Disclosure Strategy

| Layer | Access | Contents |
|-------|--------|----------|
| **1. Immediate** | No clicks | Search, source chips, results, preset dropdown |
| **2. Settings Tab** | 1 click | Speed slider, strategy, core quality settings |
| **3. Advanced** | Toggle | Retrieval mode, generation, context construction, claims |
| **4. Expert** | Toggle + search | All 100+ parameters, organized and searchable |

**Preset-to-slider mapping:**
- Fast (0-25%): FTS only, no reranking, 5 results
- Balanced (50%): Hybrid, FlashRank, 8 results, citations
- Thorough (75-100%): Claims verification, 20 results

---

## 5. Component Structure

Break the 3,000-line monolith into focused components:

```
src/components/Knowledge/
├── KnowledgePanel.tsx            # Container (~150 lines)
├── KnowledgeTabs.tsx             # Tab navigation
├── SearchTab/
│   ├── SearchTab.tsx             # Search orchestration
│   ├── SearchInput.tsx           # Query + actions
│   ├── SourceFilters.tsx         # Quick filter chips
│   ├── ResultsList.tsx           # Results rendering
│   ├── ResultItem.tsx            # Single result + actions
│   └── PinnedChips.tsx           # Compact pins
├── SettingsTab/
│   ├── SettingsTab.tsx           # Settings container
│   ├── PresetSelector.tsx        # Dropdown + reset
│   ├── SpeedSlider.tsx           # Intuitive slider
│   ├── CoreSettings.tsx          # Quality, generation, safety
│   ├── AdvancedSettings.tsx      # Retrieval, context
│   └── ExpertSettings/           # Lazy-loaded expert options
├── ContextTab/
│   ├── ContextTab.tsx            # Context container
│   ├── TabsList.tsx              # Browser tabs
│   ├── FilesList.tsx             # Attached files
│   └── PinnedResultsList.tsx     # Pinned results
├── hooks/
│   ├── useKnowledgeSearch.ts     # Search logic
│   ├── useKnowledgeSettings.ts   # Settings state
│   └── usePinnedResults.ts       # Pinning logic
└── shared/
    ├── SettingsField.tsx         # Reusable form field
    └── SectionCollapse.tsx       # Collapsible section
```

---

## 6. Key Interaction Patterns

### Quick Search Flow (80% of use cases)
1. Click "Knowledge" button
2. Type query (or check "Use current message")
3. Press Enter
4. Click "Insert" on result
5. Done

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Cmd/Ctrl+K` | Open/focus panel |
| `Enter` | Search (in query input) |
| `Arrow Down/Up` | Navigate results |
| `I` | Insert focused result |
| `P` | Pin focused result |
| `Escape` | Close |

---

## 7. Accessibility Requirements

- **ARIA roles:** `tablist`, `search`, `list`, `alert`
- **Live regions:** Announce result count, loading, errors
- **Focus management:** Logical tab order, focus trapping in modals
- **Hit targets:** Minimum 44px
- **Contrast:** WCAG AA (4.5:1)
- **Motion:** Respect `prefers-reduced-motion`

---

## 8. Implementation Phases

### Phase 1: Foundation (Refactoring)
- Create `/components/Knowledge/` structure
- Extract hooks (`useKnowledgeSearch`, `useKnowledgeSettings`)
- Create `KnowledgePanel` container with tabs
- **No user-visible changes**

### Phase 2: Search Tab Redesign
- Implement new search layout
- Create `SourceFilters` chips
- Streamline `ResultItem` actions
- Create `PinnedChips` component

### Phase 3: Settings Tab
- Create separate Settings tab
- Implement `SpeedSlider`
- Group settings into Core/Advanced/Expert
- Add "Show advanced/expert" toggles

### Phase 4: Context Tab
- Create dedicated Context tab
- Unify tabs/files/pins management
- Add contextual help text

### Phase 5: Polish
- Accessibility audit
- Keyboard navigation testing
- Performance optimization (memoization, lazy loading)
- i18n updates

---

## 9. Files to Modify

| File | Action |
|------|--------|
| `src/components/Sidepanel/Chat/RagSearchBar.tsx` | Refactor into new components |
| `src/components/Option/Playground/PlaygroundForm.tsx` | Update to use new `KnowledgePanel` |
| `src/services/rag/unified-rag.ts` | Reuse types and presets |
| `src/store/option/slices/rag-slice.ts` | Keep existing store structure |
| `src/assets/locale/en/sidepanel.json` | Add new translation keys |
| `src/assets/locale/en/playground.json` | Update button labels |

---

## 10. Verification Plan

1. **Visual review:** Compare old vs new layouts
2. **Functional testing:**
   - Search returns same results
   - Settings persist correctly
   - Context management works
3. **Accessibility testing:**
   - Keyboard-only navigation
   - Screen reader announcement
   - Focus management
4. **E2E tests:** Update existing tests in `tests/e2e/`
5. **Manual testing:** Load extension, test all flows

---

## Summary of UX Improvements

| Before | After |
|--------|-------|
| "Ctx + Media" (confusing) | "Knowledge Search" (clear) |
| Single scrolling panel | 3 focused tabs |
| 193 params visible | Progressive disclosure (4 layers) |
| 17+ collapsible sections | 3 main groups + searchable expert |
| 3,000-line component | ~20 focused components |
| Technical organization | Task-based organization |

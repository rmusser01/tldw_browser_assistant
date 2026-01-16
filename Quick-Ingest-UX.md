# RAG Modal UX Redesign Plan (Revised)

## Executive Summary

Redesign the "Ctx + Media" modal (currently `RagSearchBar.tsx` at **4,170 lines**) from a two-tier scrolling panel into a **3-tab architecture** that cleanly separates Search, Settings, and Context workflows.

### Current State Analysis (Updated)
- **File size:** 4,170 lines (grown from 3,000+)
- **Architecture:** Two-tier model (Common sections + Advanced collapse)
- **Search filtering:** `matchesAny()` function filters settings by search term
- **Dependency visibility:** Settings conditionally shown based on related toggles
- **Presets:** Fast/Balanced/Thorough with Custom auto-switch

### Key UX Problems Identified
1. **Mixed workflows in single scroll** - Users searching for knowledge and users configuring settings share the same long-scroll interface
2. **Settings always visible** - Even in "search mode", users see Retrieval, Reranking, Citations sections
3. **Context buried at bottom** - Attached tabs/files/pins appear after 2000+ lines of settings
4. **Cognitive overload** - All 150+ settings visible (even if collapsed), creating visual noise

---

## 1. Naming Change

**Current:** "Ctx + Media" (confusing, technical)

**Proposed:** "Knowledge Search"
- Clear purpose (searching your knowledge base)
- Action-oriented
- Avoids jargon ("RAG", "Context")

---

## 2. Proposed 3-Tab Architecture

### Why 3 Tabs?
The current two-tier model (Common + Advanced collapse) still presents all concerns together. A tab-based approach:
- **Separates workflows** - Users doing quick searches don't see settings
- **Reduces scroll depth** - Each tab is focused and shorter
- **Improves discoverability** - Context management gets equal prominence
- **Enables faster iteration** - Can redesign tabs independently

```
+--------------------------------------------------+
| KNOWLEDGE SEARCH                            [X]  |
+--------------------------------------------------+
| [ Search ]  [ Settings ]  [ Context (3) ]        |
+--------------------------------------------------+
```

---

## 3. Tab 1: Search (Default) - The 80% Use Case

**Goal:** Fast knowledge retrieval with minimal friction

```
+--------------------------------------------------+
| [Search your knowledge...]              [Search] |
| [ ] Use current message                          |
+--------------------------------------------------+
| [All] [Notes] [Media] [Chats]    Preset: [Balanced v] |
+--------------------------------------------------+
| RESULTS (8)                    Sort: [Relevance] |
| +----------------------------------------------+ |
| | "Machine Learning Fundamentals"    0.94      | |
| | video • Jan 15, 2025                         | |
| | Neural networks are computing systems...     | |
| | [Insert] [Ask] [Preview] [Pin]               | |
| +----------------------------------------------+ |
| | "Deep Learning Tutorial"           0.87      | |
| | note • Dec 3, 2024                           | |
| | Convolutional neural networks excel...       | |
| | [Insert] [Ask] [Preview] [Pin]               | |
| +----------------------------------------------+ |
|              (scrollable results)               |
+--------------------------------------------------+
| Pinned: [ML Fundamentals x] [Deep Learning x]    |
+--------------------------------------------------+
```

**What moves OUT of Search tab:**
- Retrieval section (search_mode, fts_level, hybrid_alpha, top_k, min_score)
- Reranking section (all 6 settings)
- Answer & Citations section (all 18 settings)
- Safety & Integrity section (all 8 settings)
- Context Construction section (all 8 settings)
- Quick Wins section (highlight, debug, cost)
- All Advanced collapse sections

**What STAYS in Search tab:**
- Query input + "Use current message"
- Source quick filters (as chips, not dropdown)
- Source chips are multi-select; "All" is default and clears other selections (and vice versa)
- Preset dropdown (Fast/Balanced/Thorough) - quick access
- Results list with actions
- Pinned results chips

**Key UX improvements:**
1. **Source chips instead of multi-select** - Faster filtering
2. **Preset visible** - One-click quality adjustment without leaving search
3. **Results dominate** - Maximum screen real estate for what users came for
4. **Compact pins** - Don't compete with results for attention

---

## 4. Tab 2: Settings - Configuration When Needed

**Goal:** Organized, searchable settings with progressive disclosure

```
+--------------------------------------------------+
| Search settings: [______________]                |
+--------------------------------------------------+
| Preset: [Balanced v]         [Reset to defaults] |
+--------------------------------------------------+

+-- Quality -------------------- [expanded] -------+
| Search mode: (FTS) (Vector) (Hybrid)            |
| Top results: [8]        Min relevance: [0.20]   |
|                                                  |
| Reranking: [x] On       Strategy: [FlashRank v] |
| Rerank top: [20]        Model: [default]        |
+-------------------------------------------------+

+-- Answer Generation ---------- [collapsed] ------+

+-- Citations ------------------ [collapsed] ------+

+-- Safety --------------------- [collapsed] ------+

+-- Context Construction ------- [collapsed] ------+

+-- Advanced ------------------- [collapsed] ------+
| (Query expansion, Caching, VLM, Claims,         |
|  Agentic, Monitoring, Performance, Batch...)    |
+-------------------------------------------------+

+--------------------------------------------------+
|            [Apply]  [Apply & Search]             |
+--------------------------------------------------+
```

**Information hierarchy:**
1. **Search bar at top** - Find any setting quickly (use existing `matchesAny()` logic)
2. **Preset + Reset** - Quick restore
3. **Quality section (expanded by default)** - Most-tuned settings
4. **Answer/Citations/Safety/Context** - Collapsed but one-click access
5. **Advanced section** - All expert settings, fully searchable

**Settings state model (staged until Apply):**
- Changes are staged locally until "Apply" is clicked
- Staged values persist across tab switches and are restored when returning to Settings
- "Apply" (from any tab, if present) commits staged values; "Apply & Search" commits and runs search

**Section groupings (re-organized from current):**

| Section | Contents (from current) |
|---------|------------------------|
| **Quality** | search_mode, fts_level, hybrid_alpha, top_k, min_score, all Reranking settings |
| **Answer Generation** | enable_generation, strict_extractive, generation_model/prompt, max_tokens, abstention settings, synthesis settings |
| **Citations** | enable_citations, citation_style, include_page_numbers, chunk_citations, require_hard_citations |
| **Safety** | security_filter, content_filter, PII settings, sensitivity_level, injection_filter, numeric_fidelity |
| **Context Construction** | chunk_type_filter, parent_expansion, sibling settings, parent_document |
| **Advanced** | Query expansion, Caching, Document processing, VLM, Advanced retrieval, Claims, Guardrails, Post-verification, Agentic, Monitoring, Performance, Resilience, Batch, Feedback |

---

## 5. Tab 3: Context - Unified Attachment Management

**Goal:** Clear visibility and control over what's included in queries

```
+--------------------------------------------------+
| These items will be included in your next query. |
+--------------------------------------------------+

+-- Browser Tabs (2) ----------- [Refresh] --------+
| +----------------------------------------------+ |
| | GitHub - tldw-assistant              [X]     | |
| | docs.example.com/api                 [X]     | |
| +----------------------------------------------+ |
| [+ Add from open tabs...]                        |
+-------------------------------------------------+

+-- Files (1) ------------------ [Add file] -------+
| +----------------------------------------------+ |
| | research-notes.pdf (2.3 MB)          [X]     | |
| +----------------------------------------------+ |
+-------------------------------------------------+

+-- Pinned Results (2) --------- [Clear all] ------+
| +----------------------------------------------+ |
| | "Machine Learning Fundamentals"              | |
| |  video • Pinned from search          [X]    | |
| +----------------------------------------------+ |
| | "Deep Learning Tutorial"                     | |
| |  note • Pinned from search           [X]    | |
| +----------------------------------------------+ |
+-------------------------------------------------+
```

**Improvements over current:**
1. **Dedicated tab** - Not buried after 2000+ lines
2. **Clear explanation** - "These items will be included" at top
3. **Consistent layout** - Each section: header + list + action
4. **Badge on tab** - Show count: "Context (3)" to indicate items attached
5. **De-duplicated counts** - Badge count is the unique union of tabs/files/pins; duplicates appear once with a "+" chip indicator

---

## 6. Component Refactoring Strategy

### Current Pain Points
1. **4,170 lines in one file** - Hard to navigate, maintain, test
2. **Inline render functions** - `renderTextInput`, `renderSelect`, etc. (~500 lines)
3. **Mixed concerns** - Search logic, settings state, UI rendering all interleaved
4. **Repeated patterns** - Same `matchesAny()` + conditional render pattern 50+ times

### Proposed Component Structure

```
src/components/Knowledge/
├── index.ts                      # Re-exports
├── KnowledgePanel.tsx            # Main container + tab state (~200 lines)
├── KnowledgeTabs.tsx             # Tab navigation with badges (~80 lines)
│
├── SearchTab/
│   ├── index.ts
│   ├── SearchTab.tsx             # Container (~100 lines)
│   ├── SearchInput.tsx           # Query input + buttons (~100 lines)
│   ├── SourceChips.tsx           # Quick filter chips (~60 lines)
│   ├── ResultsList.tsx           # Virtualized results (~150 lines)
│   ├── ResultItem.tsx            # Single result + actions (~150 lines)
│   ├── PinnedChips.tsx           # Compact pinned display (~50 lines)
│   └── SearchEmptyState.tsx      # Hint/no-results (~40 lines)
│
├── SettingsTab/
│   ├── index.ts
│   ├── SettingsTab.tsx           # Container + search (~150 lines)
│   ├── PresetSelector.tsx        # Preset dropdown + reset (~80 lines)
│   ├── sections/
│   │   ├── QualitySection.tsx    # Search mode, top_k, reranking (~200 lines)
│   │   ├── GenerationSection.tsx # Generation settings (~150 lines)
│   │   ├── CitationsSection.tsx  # Citation settings (~100 lines)
│   │   ├── SafetySection.tsx     # Security, PII, filters (~150 lines)
│   │   ├── ContextSection.tsx    # Chunk types, expansion (~100 lines)
│   │   └── AdvancedSection.tsx   # All remaining settings (~400 lines)
│   └── shared/
│       ├── SettingField.tsx      # Replaces renderTextInput, etc. (~100 lines)
│       └── CollapsibleSection.tsx # Section wrapper (~50 lines)
│
├── ContextTab/
│   ├── index.ts
│   ├── ContextTab.tsx            # Container (~100 lines)
│   ├── AttachedTabs.tsx          # Browser tabs list (~100 lines)
│   ├── AttachedFiles.tsx         # Files list (~80 lines)
│   └── PinnedResults.tsx         # Pinned results list (~100 lines)
│
├── PreviewModal.tsx              # Result preview (~100 lines)
│
└── hooks/
    ├── useKnowledgeSearch.ts     # Search execution (~150 lines)
    ├── useKnowledgeSettings.ts   # Settings state + persistence (~100 lines)
    ├── useSettingsSearch.ts      # Filter settings by search term (~50 lines)
    └── usePinnedResults.ts       # Pin/unpin logic (~60 lines)
```

**Total estimated lines:** ~2,700 (vs current 4,170)
**Files:** ~25 focused components (vs 1 monolith)

### Key Refactoring Steps

1. **Extract hooks first** - Move search logic to `useKnowledgeSearch`, settings to `useKnowledgeSettings`
2. **Create shared SettingField** - Replace 6 inline render functions with one component
3. **Extract tabs one at a time** - SearchTab first (least coupled), then ContextTab, then SettingsTab
4. **Keep `matchesAny()` logic** - Move to `useSettingsSearch` hook, reuse in SettingsTab

---

## 7. Key Interaction Patterns

### Primary User Flows

**Flow 1: Quick Search (80% of use cases)**
1. Click "Knowledge" button → Opens to Search tab
2. Type query (or check "Use current message")
3. Optionally click source chip to filter (Notes, Media, etc.)
4. Press Enter or click Search
5. Click "Insert" on desired result
6. Continue composing message

**Flow 2: Adjust Quality, Then Search**
1. Open panel → Search tab
2. Change preset from Balanced to Thorough (dropdown in Search tab)
3. Search runs with new preset
4. Results are more comprehensive

**Flow 3: Configure Settings**
1. Open panel → Click Settings tab
2. Expand "Quality" section
3. Change search_mode from Hybrid to Vector
4. Click "Apply & Search" → Switches to Search tab with results

**Flow 4: Review/Manage Context**
1. Open panel → Click Context tab (badge shows "3")
2. See attached tabs, files, pinned results
3. Remove irrelevant items
4. Return to Search tab to query with updated context

### Tab-Switching Behavior

| From | To | Trigger | Behavior |
|------|-----|---------|----------|
| Search | Settings | Tab click | Preserve search query; show staged settings (if any) |
| Settings | Search | "Apply & Search" | Apply settings, run search, show results |
| Settings | Search | Tab click | Just switch (no apply); keep staged settings |
| Any | Context | Tab click | Show context; preserve state and staged settings |

### Keyboard Navigation
| Key | Action |
|-----|--------|
| `Cmd/Ctrl+K` | Open/focus panel |
| `Tab` | Navigate between tabs, then within tab |
| `Enter` | Search (in query input) |
| `Arrow Down/Up` | Navigate results list |
| `1/2/3` | Switch to tab 1/2/3 when panel focused |
| `Escape` | Close panel |

Note: `1/2/3` shortcuts are disabled while focus is inside a text input or textarea.

---

## 8. Accessibility Considerations

### Current State (Good)
- ARIA labels on all form controls ✓
- Keyboard-accessible inputs ✓
- Focus visible states ✓

### Improvements Needed

1. **Tab navigation ARIA**
```tsx
<div role="tablist" aria-label="Knowledge panel sections">
  <button role="tab" aria-selected={activeTab === 'search'}>Search</button>
  <button role="tab" aria-selected={activeTab === 'settings'}>Settings</button>
  <button role="tab" aria-selected={activeTab === 'context'}>Context (3)</button>
</div>
```

2. **Live region for results**
```tsx
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {loading ? "Searching..." : `${results.length} results found`}
</div>
```

3. **Context badge announcement**
- Badge count should be announced: "Context tab, 3 items attached"
- Chips with "+" should include sr-only text (example: "Also attached from other sources")

4. **Focus management**
- When switching tabs, focus first interactive element in new tab
- When search completes, announce result count

---

## 9. Implementation Phases

### Phase 1: Infrastructure (No UI Changes)
**Goal:** Set up component structure and hooks without changing user experience

- [ ] Create `/components/Knowledge/` directory
- [ ] Extract `useKnowledgeSearch` hook from current `runSearch` logic
- [ ] Extract `useKnowledgeSettings` hook from current settings state
- [ ] Create `KnowledgePanel.tsx` shell that wraps current `RagSearchBar`
- [ ] Add tab state (default to "search" tab, show all content for now)

**Verification:** Build succeeds, no visual changes

### Phase 2: Search Tab Extraction
**Goal:** Create focused Search tab experience

- [ ] Create `SearchTab/SearchTab.tsx` with query + results
- [ ] Create `SourceChips.tsx` (extract from Sources & Filters)
- [ ] Move preset dropdown to Search tab header
- [ ] Create `ResultItem.tsx` with 4 actions (Insert, Ask, Preview, Pin)
- [ ] Create `PinnedChips.tsx` for compact pinned display
- [ ] Hide settings sections when on Search tab

**Verification:** Search tab works end-to-end, settings only visible in Settings tab

### Phase 3: Settings Tab Extraction
**Goal:** Organized settings with search

- [ ] Create `SettingsTab/SettingsTab.tsx` container
- [ ] Create `SettingField.tsx` shared component (replaces inline renders)
- [ ] Create section components (Quality, Generation, Citations, Safety, Context, Advanced)
- [ ] Implement settings search using existing `matchesAny()` logic
- [ ] Wire "Apply" and "Apply & Search" buttons

**Verification:** All 150+ settings accessible, searchable, preset changes work

### Phase 4: Context Tab Extraction
**Goal:** Dedicated context management

- [ ] Create `ContextTab/ContextTab.tsx` container
- [ ] Create `AttachedTabs.tsx`, `AttachedFiles.tsx`, `PinnedResults.tsx`
- [ ] Add badge to Context tab showing total count
- [ ] Add contextual help text

**Verification:** Tabs/files/pins manageable from dedicated tab

### Phase 5: Polish & Cleanup
**Goal:** Production-ready quality

- [ ] Delete old code paths from `RagSearchBar.tsx`
- [ ] Accessibility audit and fixes
- [ ] Performance optimization (React.memo, lazy loading Advanced section)
- [ ] Update i18n keys for new UI structure
- [ ] Update E2E tests

---

## 10. Files to Modify

### New Files to Create
| Path | Purpose |
|------|---------|
| `src/components/Knowledge/index.ts` | Barrel exports |
| `src/components/Knowledge/KnowledgePanel.tsx` | Main container |
| `src/components/Knowledge/KnowledgeTabs.tsx` | Tab navigation |
| `src/components/Knowledge/SearchTab/*.tsx` | Search tab components |
| `src/components/Knowledge/SettingsTab/*.tsx` | Settings tab components |
| `src/components/Knowledge/ContextTab/*.tsx` | Context tab components |
| `src/components/Knowledge/hooks/*.ts` | Extracted hooks |

### Files to Modify
| File | Changes |
|------|---------|
| `src/components/Sidepanel/Chat/RagSearchBar.tsx` | Eventually deprecate, redirect to KnowledgePanel |
| `src/components/Option/Playground/PlaygroundForm.tsx` | Import KnowledgePanel instead of RagSearchBar |
| `src/components/Sidepanel/Chat/form.tsx` | Import KnowledgePanel instead of RagSearchBar |
| `src/assets/locale/en/sidepanel.json` | Add tab labels, new section keys |
| `src/assets/locale/en/playground.json` | Update "Ctx + Media" → "Knowledge" |

### Files to Keep (Reuse)
| File | Reuse |
|------|-------|
| `src/services/rag/unified-rag.ts` | Types, defaults, presets |
| `src/store/option/slices/rag-slice.ts` | Store structure unchanged |
| `src/utils/rag-format.ts` | Result formatting |

---

## 11. Verification Plan

### Manual Testing Checklist
- [ ] **Search Tab:** Query executes, results display, Insert/Ask/Preview/Pin work
- [ ] **Source Chips:** Clicking chip filters results correctly
- [ ] **Source Chips (multi-select):** "All" clears other selections; selecting a source deselects "All"
- [ ] **Preset Dropdown:** Changing preset affects search quality
- [ ] **Settings Tab:** All 150+ settings visible and editable
- [ ] **Settings Search:** Typing filters visible settings
- [ ] **Apply & Search:** Persists settings and runs search
- [ ] **Context Tab:** Shows tabs/files/pins with correct counts
- [ ] **Context Badge:** Updates when items added/removed
- [ ] **Context Badge (dedupe):** Count reflects unique items; "+" indicator shows duplicates
- [ ] **Tab Navigation:** Keyboard and mouse both work
- [ ] **Persistence:** Settings survive panel close/reopen

### Build Verification
```bash
bun run compile        # TypeScript check
bun run build:chrome   # Full build
```

### E2E Test Updates
- Update `tests/e2e/` to account for new tab structure
- Test tab switching, settings persistence, search flow

---

## 12. Summary of UX Improvements

| Aspect | Before | After |
|--------|--------|-------|
| **Naming** | "Ctx + Media" (confusing) | "Knowledge Search" (clear) |
| **Architecture** | Single scrolling panel | 3 focused tabs |
| **Settings visibility** | All visible (collapsed) | Hidden until Settings tab |
| **Context visibility** | Buried at bottom | Dedicated tab with badge |
| **Component size** | 4,170 lines | ~2,700 lines across 25 files |
| **Organization** | Technical categories | Task-based workflows |
| **Quick access** | Scroll to find | Source chips + Preset in Search tab |
| **Settings search** | Advanced section only | All settings searchable |

### Key UX Wins
1. **80% use case is now frictionless** - Search tab shows only what's needed
2. **Power users aren't blocked** - Full settings still accessible in Settings tab
3. **Context gets visibility** - Dedicated tab shows what's attached
4. **Maintainable codebase** - 25 focused components vs 1 monolith

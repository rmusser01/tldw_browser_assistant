# PRD: Quick Ingest Tabbed Modal Architecture

## Summary

Split Quick Ingest into Queue, Options, and Results tabs to reduce cognitive load, improve focus, and enhance code maintainability without changing ingestion behavior.

## Problem Statement

The current `QuickIngestModal.tsx` (~4,000 lines) presents everything at once:
- URL input + file upload
- Queued items list
- Common options (analysis, chunking, overwrite)
- Type-specific options (audio language, diarization, OCR, captions)
- Storage mode toggle (local vs remote)
- Review mode toggle
- Advanced options (dynamically loaded from server schema)
- Inspector drawer

This creates a wall of UI that overwhelms first-time users. They may not understand what's required vs optional, leading to abandonment or confusion.

## Goals

- Make the primary "add content" flow obvious and focused
- Reduce scroll and option overload
- Improve code maintainability by splitting the large modal into smaller, focused components
- Keep power users efficient with quick tab switching

## Non-goals

- Changing ingestion logic or defaults
- Introducing new features beyond tab navigation and layout
- Modifying backend behavior

## Users and Jobs

- **New users** who want a simple place to start adding content
- **Power users** who need quick access to options and results
- **Returning users** who have specific workflows (e.g., always use certain options)

## Visual Design

### Tab Navigation
```
+--------------------------------------------------+
| QUICK INGEST (3)                            [X]  |
+--------------------------------------------------+
| [ Queue (3) ]  [ Options ]  [ Results ]          |
+--------------------------------------------------+
```

### Tab 1: Queue (Default View)
```
+--------------------------------------------------+
| [Paste URLs here, one per line...]    [Add URLs] |
| [Drop files here or click to browse]             |
+--------------------------------------------------+
| QUEUED ITEMS (3)                    [Clear all]  |
| +----------------------------------------------+ |
| | https://youtube.com/watch?v=...    VIDEO  [x]| |
| | research-paper.pdf                 PDF    [x]| |
| | https://example.com/article        HTML   [x]| |
| +----------------------------------------------+ |
|                                                  |
| [ Inspector ]              [ Process 3 items → ] |
+--------------------------------------------------+
```

### Tab 2: Options
```
+--------------------------------------------------+
| Preset: [Standard ▼]           [Reset defaults]  |
+--------------------------------------------------+
| +-- Storage ------------------------------------ +|
| | ( ) Process locally    (○) Store on server    ||
| | [ ] Review before storage                     ||
| +----------------------------------------------+ |
| +-- Processing (collapsed) -------------------- +|
| +-- Audio Settings (collapsed) ---------------- +|
| +-- Document Settings (collapsed) ------------- +|
| +-- Video Settings (collapsed) ---------------- +|
| +-- Advanced (collapsed) ---------------------- +|
+--------------------------------------------------+
```

### Tab 3: Results (Appears during/after processing)
```
+--------------------------------------------------+
| PROCESSING                              2 of 3   |
| [████████████████████░░░░░░] 67%    Elapsed: 0:45|
+--------------------------------------------------+
| ✓ youtube.com/watch?v=...           OK          |
| ✓ research-paper.pdf                OK          |
| ○ example.com/article               Processing...|
+--------------------------------------------------+
| [ Retry Failed ]  [ Open in Media ]  [ Done ]    |
+--------------------------------------------------+
```

## Requirements

### Tab Behavior

1. **Default tab is Queue** - Users land on the content input screen every time the modal opens
2. **Auto-switch to Results** only when the user initiates processing (from Queue or Options)
3. **Preserve state** across tab switches - queue, options, and results persist
4. **Process button** available from Queue, Options, and Results tabs
5. **Inspector access** remains available from Queue tab
6. If processing is already active when the modal opens, still land on Queue; the Results tab badge indicates activity

### Tab Badges

| Tab | Badge | Condition |
|-----|-------|-----------|
| Queue | `(3)` | Shows queued item count when > 0 |
| Options | `•` | Shows dot indicator when any option differs from defaults |
| Results | `⟳` | Shows spinner/indicator while processing is active |

#### Options Modified Baseline

The "options modified" badge compares current settings against the **active preset defaults**. If no preset is selected, use server-provided schema defaults. Changing presets resets the baseline.

### Keyboard Navigation

- `1`, `2`, `3` keys switch tabs globally within the modal (except when focus is in a text input/textarea/contenteditable)
- Standard tablist keys: `←`/`→` arrows, `Home`, `End`
- `Escape` closes modal
- `Enter` in URL input adds URLs to queue
- `Tab` key cycles through focusable elements within active tab

### State Management

```typescript
type QuickIngestTab = 'queue' | 'options' | 'results'

const [activeTab, setActiveTab] = useState<QuickIngestTab>('queue')
// Increment in the Process handler to mark user-initiated runs.
const [runNonce, setRunNonce] = useState(0)

// Auto-switch to results only when processing is user-initiated
useEffect(() => {
  if (runNonce > 0) setActiveTab('results')
}, [runNonce])

// Optionally return to queue when processing completes
useEffect(() => {
  if (!running && results.length > 0 && activeTab === 'results') {
    // Stay on results - user can manually switch back
  }
}, [running, results.length])
```

## Component Architecture

### New File Structure
```
src/components/Common/QuickIngestModal.tsx   # Thin re-export to avoid import churn (optional)
src/components/Common/QuickIngest/
├── QuickIngestModal.tsx        # Main container with tab state (~200 lines)
├── QuickIngestTabs.tsx         # Tab navigation with badges (~60 lines)
├── QueueTab/
│   ├── QueueTab.tsx            # Container (~100 lines)
│   ├── UrlInput.tsx            # URL paste area (~80 lines)
│   ├── FileDropZone.tsx        # Drag-drop zone (~100 lines)
│   ├── QueuedItemsList.tsx     # Virtualized list (~120 lines)
│   └── QueuedItemRow.tsx       # Individual row (existing, move here)
├── OptionsTab/
│   ├── OptionsTab.tsx          # Container (~80 lines)
│   ├── PresetSelector.tsx      # Preset dropdown (~60 lines)
│   ├── StorageSection.tsx      # Storage + review mode (~100 lines)
│   └── TypeOptionsSection.tsx  # Audio/Doc/Video options (~150 lines)
├── ResultsTab/
│   ├── ResultsTab.tsx          # Container (~100 lines)
│   ├── ProgressBar.tsx         # Progress display (~60 lines)
│   └── ResultsList.tsx         # Results with actions (~150 lines)
├── shared/
│   └── ProcessButton.tsx       # Shared process/run button
└── hooks/
    ├── useQuickIngestQueue.ts    # Selector wrappers over existing queue state
    ├── useQuickIngestOptions.ts  # Selector wrappers over existing options state
    └── useQuickIngestRun.ts      # Processing orchestration over existing logic
```

### Migration Strategy

1. Create the new folder structure
2. Extract components one at a time, keeping the original working
3. Wire up tabs in the main modal
4. Remove old inline code once tabs are verified
5. Update imports throughout the codebase

## Implementation Notes

- Split `QuickIngestModal.tsx` into small, focused tab components
- Co-locate queue, options, and results components under a Quick Ingest folder
- Keep existing hooks and state stores as the single source of truth; any new hooks must be thin selectors/wrappers
- Consider lazy-loading Options and Results tabs to reduce initial bundle

## Accessibility

- Use proper `role="tablist"`, `role="tab"`, `role="tabpanel"` semantics
- Manage focus: when switching tabs, focus stays on the active tab; `Tab` moves into the panel content
- Tab content must be reachable without mouse
- Badge counts announced to screen readers: "Queue tab, 3 items"
- Results progress announced via `aria-live` region

## Internationalization

All tab labels and badge text should use i18n keys in the options namespace (`src/assets/locale/en/option.json`):
```json
{
  "quickIngest.tabs.queue": "Queue",
  "quickIngest.tabs.options": "Options",
  "quickIngest.tabs.results": "Results",
  "quickIngest.tabs.queueBadge": "{{count}} item(s)",
  "quickIngest.tabs.optionsModified": "Options modified",
  "quickIngest.tabs.processing": "Processing"
}
```

## Dependencies

- Update Quick Ingest E2E tests to reflect tab navigation
- Align options UI with Opportunity C (Presets) if implemented together
- Coordinate with Opportunity E (Onboarding Tour) for tour step targets

## Estimated Effort

**2-3 days** for full refactoring:
- Day 1: Create component structure, extract QueueTab
- Day 2: Extract OptionsTab and ResultsTab, wire up tab navigation
- Day 3: Polish, fix edge cases, update tests

## Risks

| Risk | Mitigation |
|------|------------|
| Refactor could introduce regressions in queue or options wiring | Keep existing code working during migration; extensive testing |
| Important actions may be hidden if tab layout is not clear | Ensure Process button is visible from Queue tab; use clear tab badges |
| Users may not discover Options tab | Options tab badge shows when non-default; onboarding tour highlights it |
| Performance regression from component splitting | Lazy-load tabs; verify bundle size |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/Common/QuickIngestModal.tsx` | Convert to thin re-export (optional) or update imports to new modal |
| `src/components/Common/QuickIngest/` (new) | Create new component folder and files |
| `src/components/Common/QuickIngest/IngestOptionsPanel.tsx` | Move into OptionsTab, possibly split further |
| `src/components/Common/QuickIngest/ResultsPanel.tsx` | Move into ResultsTab |
| `src/assets/locale/en/option.json` | Add i18n keys for tab labels |
| `tests/e2e/quick-ingest.spec.ts` | Update for tab navigation |

## Acceptance Criteria

- [ ] Users can add items without seeing options (Queue tab is default)
- [ ] Users can configure options without seeing queued items (Options tab)
- [ ] Users can view results without scrolling past options (Results tab)
- [ ] Tab badges accurately reflect state (count, modified indicator, processing)
- [ ] Keyboard users can navigate tabs with arrow keys and 1/2/3 shortcuts
- [ ] Processing auto-switches to Results tab
- [ ] No functionality is removed from the existing modal
- [ ] Bundle size does not significantly increase
- [ ] Users can run processing from the Options tab

## Test Plan

### E2E Tests
1. Open modal → verify Queue tab is active and focused
2. Add 3 URLs → verify Queue badge shows "(3)"
3. Switch to Options tab → modify an option → verify Options badge shows indicator
4. Click Process from Queue or Options → verify auto-switch to Results tab
5. Verify results display correctly
6. Switch back to Queue → verify queue state persisted
7. Keyboard navigation: press 1/2/3, arrow keys, Escape

### Component Tests
- `QuickIngestTabs.tsx`: Tab rendering, badge updates, keyboard handling
- `QueueTab.tsx`: URL input, file drop, queue list rendering
- `OptionsTab.tsx`: Option changes, preset selection
- `ResultsTab.tsx`: Progress display, result actions

### Accessibility Tests
- Verify tab semantics with axe-core
- Test screen reader announcements for tab switches
- Verify focus management on tab change

## Related Documents

- `Quick-Ingest-UX-Review.md` - Original UX review with detailed mockups
- `Quick-Ingest-UX-PRD.md` - Parent PRD for Quick Ingest improvements
- `Quick-Ingest-Opportunity-C-Presets-PRD.md` - Presets feature (coordinate with Options tab)
- `Quick-Ingest-Opportunity-E-Onboarding-Tour-PRD.md` - Tour feature (needs tab targets)

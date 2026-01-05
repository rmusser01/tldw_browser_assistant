# Product Requirements Document: Flashcards Advanced Features

**Document Version:** 1.0
**Date:** January 4, 2026
**Author:** Claude Code
**Status:** Draft

---

## 1. Executive Summary

This PRD outlines the requirements for four new features to enhance the flashcards system, plus comprehensive E2E test coverage. These improvements will provide users with better control over their study workflow, deeper insights into their learning progress, and a more scientifically-backed spaced repetition algorithm.

### Features Overview

| Feature | Priority | Effort | Server Changes |
|---------|----------|--------|----------------|
| Undo for Bulk Operations | P1 | Low | None |
| Bulk Edit | P1 | Medium | None |
| Card Statistics Dashboard | P2 | Medium | None |
| FSRS Algorithm | P2 | High | Yes |
| E2E Test Coverage | P1 | Medium | None |

---

## 2. Problem Statement

### Current Pain Points

1. **Irreversible bulk deletions** - Users who accidentally delete multiple cards have no way to recover them, leading to frustration and data loss anxiety.

2. **Tedious multi-card editing** - Users must edit cards one-by-one when they want to move multiple cards to a deck, change templates, or update tags.

3. **No visibility into learning progress** - Users have no way to see overall statistics like retention rate, card maturity, or upcoming review load.

4. **Suboptimal scheduling** - The SM-2 algorithm, while proven, is less accurate than modern alternatives like FSRS at predicting optimal review intervals.

5. **Incomplete test coverage** - New UX components (ReviewProgress, FileDropZone, FlashcardActionsMenu) lack E2E test coverage, risking regressions.

---

## 3. Goals & Success Metrics

### Goals

1. **Reduce user anxiety** around bulk operations with undo capability
2. **Improve efficiency** for users managing large card collections
3. **Increase user engagement** through visible progress metrics
4. **Improve retention outcomes** with better scheduling algorithm
5. **Prevent regressions** with comprehensive test coverage

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Undo usage rate | >30% of bulk deletes | Analytics |
| Bulk edit adoption | >50% of multi-card edits | Analytics |
| Stats tab engagement | >40% of active users view weekly | Analytics |
| FSRS opt-in rate | >60% of users enable | Settings |
| E2E test coverage | 100% of new UX components | Test runs |

---

## 4. Feature Requirements

---

### 4.1 Undo for Bulk Operations

#### 4.1.1 Overview
Implement an 8-second grace period for bulk delete operations, allowing users to undo accidental deletions before they become permanent.

#### 4.1.2 User Stories

- **US-1.1**: As a user, when I bulk delete cards, I want to see an undo option so that I can recover from accidental deletions.
- **US-1.2**: As a user, I want deleted cards to disappear immediately from the UI so that the interface feels responsive.
- **US-1.3**: As a user, when I click undo, I want the cards restored instantly without page refresh.

#### 4.1.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | System SHALL display undo notification for 8 seconds after bulk delete | Must |
| FR-1.2 | System SHALL hide deleted cards immediately (optimistic UI) | Must |
| FR-1.3 | System SHALL restore cards to their original state when undo is clicked | Must |
| FR-1.4 | System SHALL execute actual deletion after grace period expires | Must |
| FR-1.5 | System SHALL execute pending deletions if user navigates away | Must |
| FR-1.6 | System SHALL prevent multiple concurrent bulk operations | Should |

#### 4.1.4 Technical Design

**Pattern**: Follow existing Quiz ManageTab undo implementation

**State Management**:
```typescript
const UNDO_GRACE_PERIOD = 8000 // 8 seconds
const pendingBulkDelete = useRef<{
  items: Flashcard[]
  timeoutId: ReturnType<typeof setTimeout>
} | null>(null)
const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set())
```

**Files to Modify**:
- `src/components/Flashcards/tabs/ManageTab.tsx`

#### 4.1.5 Acceptance Criteria

- [ ] Undo notification appears after bulk delete
- [ ] Cards disappear immediately from list
- [ ] Clicking undo restores all cards
- [ ] Cards are permanently deleted after 8 seconds
- [ ] Navigating away executes pending deletions
- [ ] Works with "select all across results" feature

---

### 4.2 Bulk Edit

#### 4.2.1 Overview
Allow users to edit multiple cards simultaneously, changing their deck, template, or tags in a single operation.

#### 4.2.2 User Stories

- **US-2.1**: As a user, I want to move multiple cards to a different deck at once.
- **US-2.2**: As a user, I want to add tags to multiple cards simultaneously.
- **US-2.3**: As a user, I want to change the template type for multiple cards at once.
- **US-2.4**: As a user, I want to see a progress indicator during bulk operations.

#### 4.2.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | System SHALL provide "Edit selected" option in bulk actions menu | Must |
| FR-2.2 | System SHALL open a drawer with editable fields | Must |
| FR-2.3 | System SHALL allow changing: deck, template, tags | Must |
| FR-2.4 | System SHALL support three tag modes: replace, append, remove | Must |
| FR-2.5 | System SHALL show progress during bulk update | Must |
| FR-2.6 | System SHALL only update fields explicitly enabled by user | Must |
| FR-2.7 | System SHALL handle partial failures gracefully | Should |

#### 4.2.4 UI Design

**BulkEditDrawer Component**:
- Right-side drawer (480px width)
- Alert banner showing affected card count
- Each field has enable checkbox + form control
- Tag mode selector (Replace/Append/Remove)
- Footer: Cancel | Save buttons

**Field Layout**:
```
[ ] Move to deck     [Deck selector v]
[ ] Change template  [Template selector v]
[ ] Modify tags      [Tag input]
                     ( ) Replace all  ( ) Add to existing  ( ) Remove these
```

#### 4.2.5 Technical Design

**Files to Create**:
- `src/components/Flashcards/components/BulkEditDrawer.tsx`

**Files to Modify**:
- `src/components/Flashcards/tabs/ManageTab.tsx`
- `src/components/Flashcards/components/index.ts`

**Update Strategy**: Chunked parallel updates (50 cards per batch)

#### 4.2.6 Acceptance Criteria

- [ ] "Edit selected" option appears in bulk actions menu
- [ ] Drawer opens with all fields disabled by default
- [ ] Only enabled fields are included in update
- [ ] Progress modal shows during update
- [ ] All selected cards are updated correctly
- [ ] Tag modes (replace/append/remove) work correctly

---

### 4.3 Card Statistics Dashboard

#### 4.3.1 Overview
Provide users with visibility into their learning progress through a statistics dashboard that calculates metrics from existing card data.

#### 4.3.2 User Stories

- **US-3.1**: As a user, I want to see how many cards are due today so I can plan my study session.
- **US-3.2**: As a user, I want to see my retention rate so I know how well I'm remembering.
- **US-3.3**: As a user, I want to see card distribution by status (new/learning/mature).
- **US-3.4**: As a user, I want to see upcoming review load for the next 7 days.
- **US-3.5**: As a user, I want to see card counts per deck.

#### 4.3.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | System SHALL display total card count | Must |
| FR-3.2 | System SHALL display cards due today | Must |
| FR-3.3 | System SHALL calculate and display retention rate | Must |
| FR-3.4 | System SHALL display total review count | Must |
| FR-3.5 | System SHALL show card status breakdown (new/learning/mature) | Must |
| FR-3.6 | System SHALL show 7-day review forecast | Should |
| FR-3.7 | System SHALL show card distribution by deck | Should |
| FR-3.8 | System SHALL calculate stats client-side from existing data | Must |

#### 4.3.4 Data Model

**Available Data Points** (from existing `Flashcard` type):
- `ef` - Ease factor (difficulty indicator)
- `interval_days` - Current interval
- `repetitions` - Total successful reviews
- `lapses` - Times forgotten
- `due_at` - Next review date
- `last_reviewed_at` - Most recent review

**Derived Metrics**:
- New cards: `repetitions === 0`
- Learning cards: `repetitions > 0 && interval_days < 21`
- Mature cards: `interval_days >= 21`
- Retention rate: `repetitions / (repetitions + lapses)`

#### 4.3.5 UI Design

**Summary Cards Row**:
```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Total Cards │ │  Due Today  │ │  Retention  │ │   Reviews   │
│    1,234    │ │     42      │ │     87%     │ │    5,678    │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

**Card Status Breakdown**:
- Progress bars showing new/learning/mature distribution

**7-Day Forecast**:
- Bar chart showing reviews due each day

**Cards by Deck**:
- Table with deck name, card count, due count

#### 4.3.6 Technical Design

**Files to Create**:
- `src/components/Flashcards/components/FlashcardStats.tsx`
- `src/components/Flashcards/tabs/StatsTab.tsx`

**Files to Modify**:
- `src/components/Flashcards/FlashcardsPage.tsx` (add Stats tab)
- `src/components/Flashcards/components/index.ts`

#### 4.3.7 Acceptance Criteria

- [ ] Stats tab appears in flashcards page
- [ ] All summary metrics display correctly
- [ ] Card status breakdown shows accurate counts
- [ ] 7-day forecast updates based on due dates
- [ ] Cards by deck table shows all decks
- [ ] Stats update when cards are added/modified/deleted

---

### 4.4 FSRS Algorithm

#### 4.4.1 Overview
Replace the SM-2 spaced repetition algorithm with FSRS (Free Spaced Repetition Scheduler), a modern algorithm that provides better retention prediction through its use of stability, difficulty, and retrievability metrics.

#### 4.4.2 Background

**SM-2 Limitations**:
- Uses simple ease factor with fixed decay
- No individual card difficulty tracking
- Same intervals for all users regardless of performance

**FSRS Advantages**:
- Models memory stability explicitly
- Tracks individual card difficulty
- Calculates retrievability (recall probability)
- Allows configurable desired retention target
- Research-backed with better retention outcomes

#### 4.4.3 User Stories

- **US-4.1**: As a user, I want to enable FSRS to get more accurate review scheduling.
- **US-4.2**: As a user, I want to set my desired retention rate (e.g., 90%).
- **US-4.3**: As a user, I want to see FSRS-calculated intervals on rating buttons.
- **US-4.4**: As a user, I want to migrate my existing SM-2 cards to FSRS.
- **US-4.5**: As a user, I want to be able to disable FSRS and return to SM-2.

#### 4.4.4 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | System SHALL implement FSRS algorithm for interval calculation | Must |
| FR-4.2 | System SHALL allow users to enable/disable FSRS | Must |
| FR-4.3 | System SHALL allow users to set desired retention (0.7-0.99) | Must |
| FR-4.4 | System SHALL display FSRS-calculated intervals on rating buttons | Must |
| FR-4.5 | System SHALL provide one-click migration from SM-2 to FSRS | Must |
| FR-4.6 | System SHALL maintain backward compatibility with SM-2 | Must |
| FR-4.7 | System SHALL store FSRS parameters per card | Must |
| FR-4.8 | System SHALL allow setting maximum interval | Should |

#### 4.4.5 FSRS Algorithm Specification

**Core Parameters**:
- **Stability (S)**: Days until 90% recall probability
- **Difficulty (D)**: Inherent card difficulty (1-10 scale)
- **Retrievability (R)**: Current probability of recall

**Core Formulas**:
```
Constants:
  DECAY = -0.5
  FACTOR = 0.9^(1/DECAY) - 1

Retrievability:
  R(t) = (1 + FACTOR × t / S)^DECAY

Next Interval:
  I = S / FACTOR × (R^(1/DECAY) - 1)
```

**Rating Mapping**:
| Button | SM-2 Rating | FSRS Rating | Effect |
|--------|-------------|-------------|--------|
| Again | 0 | 1 | Reset to learning, decrease stability |
| Hard | 2 | 2 | Reduce stability growth |
| Good | 3 | 3 | Normal stability growth |
| Easy | 5 | 4 | Accelerated stability growth |

#### 4.4.6 Data Model Changes

**New Card Fields**:
```typescript
type FSRSParams = {
  stability: number      // S: days until 90% recall
  difficulty: number     // D: 1-10 scale
  state: 'new' | 'learning' | 'review' | 'relearning'
  scheduled_days: number
  elapsed_days: number
  reps: number
}

type FlashcardFSRS = Flashcard & {
  fsrs?: FSRSParams | null   // null for SM-2 cards
  algorithm?: 'sm2' | 'fsrs'
}
```

**User Settings**:
```typescript
type FSRSUserSettings = {
  enabled: boolean
  desired_retention: number  // 0.7-0.99, default 0.9
  maximum_interval: number   // days, default 36500
}
```

#### 4.4.7 API Changes

**New Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/flashcards/{uuid}/review-fsrs` | Submit FSRS review |
| GET | `/api/v1/flashcards/fsrs-settings` | Get user's FSRS settings |
| PUT | `/api/v1/flashcards/fsrs-settings` | Update FSRS settings |
| POST | `/api/v1/flashcards/migrate-to-fsrs` | Migrate cards to FSRS |

#### 4.4.8 Migration Strategy

**SM-2 to FSRS Mapping**:
```
stability = max(1.0, interval_days × 0.9)
difficulty = max(1, min(10, 11 - (ef / 0.25)))
state =
  repetitions === 0 ? 'new' :
  interval_days < 1 ? 'learning' :
  lapses > 0 && interval_days < 7 ? 'relearning' :
  'review'
```

**Backward Compatibility**:
- Keep existing SM-2 fields (`ef`, `interval_days`, etc.)
- Add `fsrs` object as optional field
- Add `algorithm` field to indicate active algorithm
- Server updates both SM-2 and FSRS fields on review

#### 4.4.9 Technical Design

**Files to Create**:
- `src/components/Flashcards/utils/fsrs.ts`
- `src/components/Flashcards/components/FSRSSettings.tsx`

**Files to Modify**:
- `src/services/flashcards.ts` (types, API functions)
- `src/components/Flashcards/utils/calculateIntervals.ts` (dual algorithm)
- `src/components/Flashcards/hooks/useFlashcardQueries.ts` (FSRS hooks)
- `src/components/Flashcards/tabs/ReviewTab.tsx` (FSRS review logic)

#### 4.4.10 Acceptance Criteria

- [ ] FSRS can be enabled/disabled in settings
- [ ] Desired retention slider works (0.7-0.99)
- [ ] Rating buttons show FSRS intervals when enabled
- [ ] Review submissions use correct algorithm
- [ ] Migration converts existing cards correctly
- [ ] SM-2 fallback works when FSRS disabled
- [ ] Maximum interval setting is respected

---

### 4.5 E2E Test Coverage

#### 4.5.1 Overview
Add comprehensive E2E tests for new UX components and features to prevent regressions.

#### 4.5.2 Test Categories

**A. Existing UX Components (Currently Untested)**:
- ReviewProgress display
- Rating button interval previews
- FileDropZone interactions
- FlashcardActionsMenu
- Smart selection UI
- Collapsible filter panel
- Empty state differentiation

**B. New Features**:
- Undo for bulk delete
- Bulk edit drawer
- Statistics dashboard
- FSRS settings and review

#### 4.5.3 Test Plan

**File**: `tests/e2e/flashcards-ux-components.spec.ts`

```typescript
test.describe("Flashcards UX Components", () => {
  // ReviewProgress
  test("displays remaining cards and estimated time")
  test("updates count after rating a card")
  test("hides when no cards are due")

  // Rating Buttons
  test("shows interval preview under each button")
  test("keyboard shortcuts 1-4 trigger ratings")

  // FileDropZone
  test("accepts CSV file via browse button")
  test("shows error for oversized files")
  test("displays filename after selection")

  // Smart Selection
  test("select all checkbox toggles all items")
  test("shows bulk actions when items selected")
  test("clear link deselects all")

  // Collapsible Filters
  test("filter panel expands on button click")
  test("badge shows when filters active")
  test("clear filters resets all")

  // Empty States
  test("shows 'no cards' message when empty")
  test("shows 'all caught up' when no cards due")

  // Bulk Operations
  test("undo notification appears after bulk delete")
  test("clicking undo restores deleted cards")
  test("bulk edit changes multiple cards")

  // Statistics
  test("stats tab displays all metrics")
  test("stats update after card changes")

  // FSRS (if enabled)
  test("FSRS settings can be toggled")
  test("FSRS intervals differ from SM-2")
})
```

#### 4.5.4 Technical Design

**Files to Create**:
- `tests/e2e/flashcards-ux-components.spec.ts`

**Test Patterns to Follow**:
- Use `data-testid` attributes for element selection
- Use `expect.poll()` for async state changes
- Use `requireRealServerConfig()` for API-dependent tests
- Clean up test data in `finally` blocks

#### 4.5.5 Acceptance Criteria

- [ ] All listed tests are implemented
- [ ] Tests pass on CI
- [ ] Tests use proper fixtures and cleanup
- [ ] Tests cover both happy path and error cases

---

## 5. Implementation Plan

### Phase 1: Undo & Bulk Edit (Week 1-2)
*No server changes required*

1. Implement undo grace period in ManageTab
2. Create BulkEditDrawer component
3. Integrate bulk edit into ManageTab actions
4. Write E2E tests for bulk operations

### Phase 2: Statistics Dashboard (Week 2-3)
*No server changes required*

5. Create FlashcardStats component
6. Create StatsTab
7. Add Stats tab to FlashcardsPage
8. Write E2E tests for statistics

### Phase 3: E2E Test Coverage (Week 3)
*No server changes required*

9. Create flashcards-ux-components.spec.ts
10. Add tests for existing UX components
11. Run full test suite, fix failures

### Phase 4: FSRS Algorithm (Week 4-6)
*Requires server coordination*

12. Coordinate with server team on API endpoints
13. Add FSRS types to flashcards.ts
14. Create fsrs.ts calculator
15. Update calculateIntervals.ts for dual algorithm
16. Add FSRS hooks to useFlashcardQueries.ts
17. Create FSRSSettings component
18. Update ReviewTab for FSRS reviews
19. Write E2E tests for FSRS

---

## 6. Dependencies

### Internal Dependencies
- Server team for FSRS API endpoints
- Existing flashcard service infrastructure

### External Dependencies
- FSRS algorithm specification (open source)
- No new npm packages required

---

## 7. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| FSRS server implementation delayed | High | Medium | Implement client-side preview first; server can follow |
| Bulk operations cause data loss | High | Low | Undo feature provides recovery; type-to-confirm for large deletes |
| Statistics calculation slow for large collections | Medium | Low | Use memoization; consider pagination |
| Migration from SM-2 to FSRS loses scheduling accuracy | Medium | Medium | Preserve SM-2 data; allow rollback |

---

## 8. Open Questions

1. **FSRS Parameter Customization**: Should we expose advanced FSRS weights (w array) to power users?
2. **Statistics Persistence**: Should we cache statistics on server for faster loading?
3. **Undo for Other Operations**: Should undo extend to bulk move/edit operations?
4. **FSRS A/B Testing**: Should we run a trial period comparing SM-2 vs FSRS outcomes?

---

## 9. Appendix

### A. File Change Summary

| Feature | New Files | Modified Files |
|---------|-----------|----------------|
| Undo | - | ManageTab.tsx |
| Bulk Edit | BulkEditDrawer.tsx | ManageTab.tsx, index.ts |
| Statistics | FlashcardStats.tsx, StatsTab.tsx | FlashcardsPage.tsx, index.ts |
| FSRS | fsrs.ts, FSRSSettings.tsx | flashcards.ts, calculateIntervals.ts, useFlashcardQueries.ts, ReviewTab.tsx |
| Tests | flashcards-ux-components.spec.ts | - |

### B. FSRS Algorithm Reference

- [FSRS Wiki](https://github.com/open-spaced-repetition/fsrs4anki/wiki/Algorithm)
- [FSRS-4.5 Paper](https://github.com/open-spaced-repetition/fsrs4anki)

### C. Server-Side Implementation Status

**Location:** `../tldw_server2/`

#### Current Server Capabilities

| Feature | Status | Details |
|---------|--------|---------|
| SM-2 Algorithm | ✅ Implemented | `_srs_sm2_update()` in ChaChaNotes_DB.py |
| Review History | ✅ Implemented | `flashcard_reviews` table stores all reviews |
| FSRS Algorithm | ❌ Not implemented | No stability/difficulty fields |
| FSRS Settings | ❌ Not implemented | No user settings endpoint |

#### Current Database Schema (Schema V12)

```sql
flashcards table:
- uuid, deck_id, front, back, notes, extra
- is_cloze, tags_json, model_type, reverse
- ef (REAL, default 2.5)        -- SM-2 ease factor
- interval_days (INTEGER)        -- Days until next review
- repetitions (INTEGER)          -- Successful review count
- lapses (INTEGER)               -- Failure count
- due_at, last_reviewed_at, created_at, last_modified
- deleted, client_id, version

flashcard_reviews table (history):
- card_id, reviewed_at, rating (0-5)
- answer_time_ms, scheduled_interval_days
- new_ef, new_repetitions, was_lapse
```

#### FSRS Server Changes Required

1. **New database columns** for `flashcards` table:
   ```sql
   ALTER TABLE flashcards ADD COLUMN fsrs_stability REAL;
   ALTER TABLE flashcards ADD COLUMN fsrs_difficulty REAL;
   ALTER TABLE flashcards ADD COLUMN fsrs_state TEXT;
   ALTER TABLE flashcards ADD COLUMN algorithm TEXT DEFAULT 'sm2';
   ```

2. **New user settings table**:
   ```sql
   CREATE TABLE flashcard_settings (
     user_id TEXT PRIMARY KEY,
     fsrs_enabled BOOLEAN DEFAULT FALSE,
     desired_retention REAL DEFAULT 0.9,
     maximum_interval INTEGER DEFAULT 36500
   );
   ```

3. **New API endpoints**:
   - `POST /flashcards/{uuid}/review-fsrs`
   - `GET /flashcards/fsrs-settings`
   - `PUT /flashcards/fsrs-settings`
   - `POST /flashcards/migrate-to-fsrs`

### D. Related Documents

- `docs/flashcards-ux-improvements-plan.md` - Original UX improvements plan (completed)

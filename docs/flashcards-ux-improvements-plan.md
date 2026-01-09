# Flashcards Page UX Improvements Plan

## Overview
Comprehensive UX overhaul of the Flashcards page addressing 9 identified HCI issues across all 4 tabs.

## Files to Modify
- `src/components/Flashcards/hooks/useFlashcardQueries.ts` - Add `useDueCountsQuery` and `useTotalCardsCountQuery` hooks
- `src/components/Flashcards/tabs/ReviewTab.tsx` - Progress indicator, rating UX, empty states
- `src/components/Flashcards/tabs/ManageTab.tsx` - Actions overflow, filter UI, selection UX, edit drawer
- `src/components/Flashcards/tabs/CreateTab.tsx` - Inline deck creation
- `src/components/Flashcards/tabs/ImportExportTab.tsx` - File upload support

## Files to Create
- `src/components/Flashcards/components/FlashcardActionsMenu.tsx` - Overflow menu for card actions
- `src/components/Flashcards/components/FlashcardEditDrawer.tsx` - Drawer replacing edit modal
- `src/components/Flashcards/components/ReviewProgress.tsx` - Session progress indicator
- `src/components/Flashcards/components/FileDropZone.tsx` - Drag-and-drop file upload

---

## Implementation Steps

### 1. Review Progress Indicator (High Priority)
**Goal:** Show users how many cards are due and track session progress.

**Create `ReviewProgress.tsx`:**
```tsx
interface ReviewProgressProps {
  dueCount: number
  reviewedCount: number
  deckName?: string
}

export const ReviewProgress: React.FC<ReviewProgressProps> = ({
  dueCount,
  reviewedCount,
  deckName
}) => {
  const remaining = Math.max(0, dueCount - reviewedCount)
  const avgTimePerCard = 15 // seconds, could be calculated from actual data
  const estimatedMinutes = Math.ceil((remaining * avgTimePerCard) / 60)

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-surface2 mb-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-primary">{remaining}</span>
        <span className="text-sm text-text-muted">cards remaining</span>
      </div>
      <div className="h-8 w-px bg-border" />
      <div className="text-sm text-text-muted">
        <span className="font-medium text-text">{reviewedCount}</span> reviewed
      </div>
      {remaining > 0 && (
        <>
          <div className="h-8 w-px bg-border" />
          <div className="text-sm text-text-muted">
            ~{estimatedMinutes} min left
          </div>
        </>
      )}
      {deckName && (
        <Tag className="ml-auto">{deckName}</Tag>
      )}
    </div>
  )
}
```

**Changes to `ReviewTab.tsx`:**
- Add `reviewedCount` state, increment on successful review
- Add query for due count (or use existing review query metadata)
- Render `<ReviewProgress />` above the card

---

### 2. ManageTab Actions Overflow Menu (High Priority)
**Goal:** Reduce visual clutter by moving secondary actions to overflow menu.

**Create `FlashcardActionsMenu.tsx`:**
```tsx
interface FlashcardActionsMenuProps {
  card: Flashcard
  onEdit: () => void
  onReview: () => void
  onDuplicate: () => void
  onMove: () => void
}

export const FlashcardActionsMenu: React.FC<FlashcardActionsMenuProps> = ({
  card,
  onEdit,
  onReview,
  onDuplicate,
  onMove
}) => {
  const { t } = useTranslation(["option", "common"])

  const menuItems: MenuProps["items"] = [
    {
      key: "review",
      label: t("option:flashcards.review"),
      icon: <PlayCircle className="size-4" />,
      onClick: onReview
    },
    {
      key: "duplicate",
      label: t("option:flashcards.duplicate"),
      icon: <Copy className="size-4" />,
      onClick: onDuplicate
    },
    {
      key: "move",
      label: t("option:flashcards.move"),
      icon: <FolderInput className="size-4" />,
      onClick: onMove
    }
  ]

  return (
    <div className="flex items-center gap-2">
      <Tooltip title={t("common:edit")}>
        <Button size="small" icon={<Pen className="size-4" />} onClick={onEdit} />
      </Tooltip>
      <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
        <Button size="small" icon={<MoreHorizontal className="size-4" />} />
      </Dropdown>
    </div>
  )
}
```

**Changes to `ManageTab.tsx`:**
- Replace the 6 inline action buttons with `<FlashcardActionsMenu />`
- Make list item row clickable to toggle answer preview (remove dedicated button)
- Keep checkbox as separate element

---

### 3. Smarter Selection UI (High Priority)
**Goal:** Simplify the selection controls with contextual actions.

**Changes to `ManageTab.tsx`:**

Replace the 4 selection buttons with a smart selection bar:
```tsx
<div className="mb-2 flex items-center gap-3">
  <Checkbox
    indeterminate={selectedCount > 0 && selectedCount < totalCount}
    checked={selectedCount === totalCount && totalCount > 0}
    onChange={(e) => {
      if (e.target.checked) selectAllAcrossResults()
      else clearSelection()
    }}
  />
  <Text>
    {selectedCount === 0 ? (
      <span className="text-text-muted">
        {totalCount} {t("option:flashcards.cards")}
      </span>
    ) : (
      <>
        <span className="font-medium">{selectedCount}</span>
        <span className="text-text-muted"> selected</span>
        {!selectAllAcross && selectedCount < totalCount && (
          <button
            className="ml-2 text-primary hover:underline"
            onClick={selectAllAcrossResults}
          >
            Select all {totalCount}
          </button>
        )}
        <button
          className="ml-2 text-text-muted hover:text-text"
          onClick={clearSelection}
        >
          Clear
        </button>
      </>
    )}
  </Text>
  {selectedCount > 0 && (
    <Dropdown menu={{ items: bulkMenuItems }}>
      <Button size="small">
        Bulk actions <ChevronDown className="size-3 ml-1" />
      </Button>
    </Dropdown>
  )}
</div>
```

Remove:
- "Select all on page" button
- "Select all across results" button
- "Clear selection" button
- Selection help text paragraph

---

### 4. Collapsible Filter Panel (High Priority)
**Goal:** Reduce visual complexity of filter controls.

**Changes to `ManageTab.tsx`:**

Wrap filters in a collapsible panel:
```tsx
const [filtersExpanded, setFiltersExpanded] = React.useState(false)
const hasActiveFilters = mQuery || mTag || mDeckId != null || mDue !== "all"

<div className="mb-3">
  <div className="flex items-center gap-2 mb-2">
    <Input.Search
      placeholder={t("common:search")}
      allowClear
      value={mQueryInput}
      onChange={(e) => setMQueryInput(e.target.value)}
      onSearch={() => { setMQuery(mQueryInput); setPage(1) }}
      className="max-w-64"
    />
    <Button
      icon={<Filter className="size-4" />}
      onClick={() => setFiltersExpanded(!filtersExpanded)}
    >
      Filters
      {hasActiveFilters && <Badge dot className="ml-1" />}
    </Button>
    {hasActiveFilters && (
      <Button size="small" type="link" onClick={clearAllFilters}>
        Clear filters
      </Button>
    )}
  </div>

  {filtersExpanded && (
    <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-surface2">
      <Select placeholder="Deck" ... />
      <Select placeholder="Due status" ... />
      <Input placeholder="Tag" ... />
    </div>
  )}
</div>
```

---

### 5. Inline Deck Creation (Medium Priority)
**Goal:** Streamline deck creation without modal interruption.

**Changes to `CreateTab.tsx`:**

Add inline creation option in deck selector:
```tsx
const [showInlineCreate, setShowInlineCreate] = React.useState(false)
const [inlineDeckName, setInlineDeckName] = React.useState("")

<div className="flex items-center gap-2 mb-2">
  {!showInlineCreate ? (
    <>
      <Form.Item name="deck_id" label="Deck" className="!mb-0">
        <Select
          placeholder="Select deck"
          allowClear
          loading={decksQuery.isLoading}
          className="min-w-64"
          options={(decksQuery.data || []).map((d) => ({
            label: d.name,
            value: d.id
          }))}
          dropdownRender={(menu) => (
            <>
              {menu}
              <Divider className="my-2" />
              <button
                className="w-full text-left px-3 py-2 text-primary hover:bg-primary/5"
                onClick={() => setShowInlineCreate(true)}
              >
                + Create new deck
              </button>
            </>
          )}
        />
      </Form.Item>
    </>
  ) : (
    <div className="flex items-center gap-2">
      <Input
        placeholder="New deck name"
        value={inlineDeckName}
        onChange={(e) => setInlineDeckName(e.target.value)}
        className="w-64"
        autoFocus
      />
      <Button
        type="primary"
        size="small"
        onClick={handleInlineCreateDeck}
        loading={createDeckMutation.isPending}
      >
        Create
      </Button>
      <Button size="small" onClick={() => setShowInlineCreate(false)}>
        Cancel
      </Button>
    </div>
  )}
</div>
```

Keep the modal as fallback for adding description.

---

### 6. Edit Drawer with Field Grouping (Medium Priority)
**Goal:** Replace cramped edit modal with spacious drawer.

**Create `FlashcardEditDrawer.tsx`:**
```tsx
interface FlashcardEditDrawerProps {
  open: boolean
  onClose: () => void
  card: Flashcard | null
  onSave: (values: FlashcardUpdate) => void
  onDelete: () => void
  isLoading: boolean
  decks: Deck[]
}

export const FlashcardEditDrawer: React.FC<FlashcardEditDrawerProps> = ({ ... }) => {
  const [showPreview, setShowPreview] = React.useState(false)

  return (
    <Drawer
      placement="right"
      width={520}
      open={open}
      onClose={onClose}
      title="Edit Flashcard"
      footer={
        <div className="flex justify-between">
          <Button danger onClick={onDelete}>Delete</Button>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" loading={isLoading} onClick={handleSave}>
              Save
            </Button>
          </Space>
        </div>
      }
    >
      <Form form={form} layout="vertical">
        {/* Section: Organization */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-muted mb-3">Organization</h3>
          <Form.Item name="deck_id" label="Deck">
            <Select ... />
          </Form.Item>
          <Form.Item name="model_type" label="Card Template">
            <Select ... />
          </Form.Item>
          <Form.Item name="tags" label="Tags">
            <Select mode="tags" ... />
          </Form.Item>
        </div>

        {/* Section: Content */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-text-muted">Content</h3>
            <button
              type="button"
              className="text-xs text-primary"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
          </div>
          <Form.Item name="front" label="Front" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          {showPreview && frontPreview && <Preview content={frontPreview} />}

          <Form.Item name="back" label="Back" rules={[{ required: true }]}>
            <Input.TextArea rows={5} />
          </Form.Item>
          {showPreview && backPreview && <Preview content={backPreview} />}
        </div>

        {/* Section: Additional (collapsed) */}
        <Collapse ghost>
          <Collapse.Panel header="Additional fields" key="additional">
            <Form.Item name="extra" label="Extra">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="notes" label="Notes">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Collapse.Panel>
        </Collapse>
      </Form>
    </Drawer>
  )
}
```

**Changes to `ManageTab.tsx`:**
- Remove `reverse` and `is_cloze` form fields (derived from model_type)
- Replace `<Modal>` with `<FlashcardEditDrawer />`

---

### 7. Rating Buttons with Interval Preview (Medium Priority)
**Goal:** Help users understand rating impact on scheduling.

**Changes to `ReviewTab.tsx`:**

Add interval preview to rating options:
```tsx
const ratingOptions = React.useMemo(() => {
  const card = reviewQuery.data
  // Calculate next intervals based on current card state
  const intervals = card ? calculateIntervals(card) : null

  return [
    {
      value: 0,
      key: "1",
      label: t("option:flashcards.ratingAgain"),
      interval: intervals?.again || "< 1 min",
      bgClass: "bg-red-500 hover:bg-red-600"
    },
    {
      value: 2,
      key: "2",
      label: t("option:flashcards.ratingHard"),
      interval: intervals?.hard || "< 10 min",
      bgClass: "bg-orange-500 hover:bg-orange-600"
    },
    {
      value: 3,
      key: "3",
      label: t("option:flashcards.ratingGood"),
      interval: intervals?.good || "1 day",
      bgClass: "bg-green-500 hover:bg-green-600",
      primary: true // Visually emphasize
    },
    {
      value: 5,
      key: "4",
      label: t("option:flashcards.ratingEasy"),
      interval: intervals?.easy || "4 days",
      bgClass: "bg-blue-500 hover:bg-blue-600"
    }
  ]
}, [reviewQuery.data, t])

// Render with interval shown below label
<div className="flex flex-wrap gap-2 justify-center">
  {ratingOptions.map((opt) => (
    <Button
      key={opt.value}
      onClick={() => onSubmitReview(opt.value)}
      className={`!text-white ${opt.bgClass} ${opt.primary ? "!px-6" : ""}`}
    >
      <div className="flex flex-col items-center">
        <span className="font-medium">{opt.label}</span>
        <span className="text-xs opacity-80">{opt.interval}</span>
      </div>
    </Button>
  ))}
</div>
```

---

### 8. File Drop Zone for Import (Medium Priority)
**Goal:** Allow file drag-and-drop instead of just paste.

**Create `FileDropZone.tsx`:**
```tsx
interface FileDropZoneProps {
  onFileContent: (content: string) => void
  accept?: string
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFileContent,
  accept = ".csv,.tsv,.txt"
}) => {
  const [isDragging, setIsDragging] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      const text = await file.text()
      onFileContent(text)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const text = await file.text()
      onFileContent(text)
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-lg p-6 text-center transition-colors
        ${isDragging ? "border-primary bg-primary/5" : "border-border"}
      `}
    >
      <Upload className="size-8 mx-auto mb-2 text-text-muted" />
      <p className="text-sm text-text-muted mb-2">
        Drag and drop a CSV/TSV file here, or
      </p>
      <Button onClick={() => inputRef.current?.click()}>
        Browse files
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
```

**Changes to `ImportExportTab.tsx`:**
```tsx
<FileDropZone onFileContent={setContent} />
<Text type="secondary" className="text-center block my-2">or paste content below</Text>
<Input.TextArea ... />
```

---

### 9. Differentiated Empty States (Low Priority)
**Goal:** Provide clearer guidance based on actual state.

**Changes to `ReviewTab.tsx`:**

```tsx
// Query to check if any cards exist
const hasAnyCards = useHasCardsQuery()

{!reviewQuery.data && (
  <Card>
    <Empty
      description={
        hasAnyCards.data === false
          ? t("option:flashcards.noCardsYet", {
              defaultValue: "No flashcards yet"
            })
          : t("option:flashcards.allCaughtUp", {
              defaultValue: "You're all caught up!"
            })
      }
    >
      {hasAnyCards.data === false ? (
        <Space direction="vertical" align="center">
          <Text type="secondary">
            Create your first flashcard to start studying.
          </Text>
          <Button type="primary" onClick={onNavigateToCreate}>
            Create a flashcard
          </Button>
        </Space>
      ) : (
        <Space direction="vertical" align="center">
          <Text type="secondary">
            No cards are due for review. Great job!
          </Text>
          {nextDueDate && (
            <Text type="secondary">
              Next review: {dayjs(nextDueDate).fromNow()}
            </Text>
          )}
          <Button onClick={onNavigateToCreate}>
            Create more cards
          </Button>
        </Space>
      )}
    </Empty>
  </Card>
)}
```

---

## Implementation Order

1. **FlashcardActionsMenu.tsx** - Create overflow menu component
2. **ReviewProgress.tsx** - Create progress indicator component
3. **Update ReviewTab.tsx** - Add progress, improve rating buttons
4. **Update ManageTab.tsx** - Integrate actions menu, smart selection, collapsible filters
5. **FlashcardEditDrawer.tsx** - Create drawer component
6. **Update ManageTab.tsx** - Replace edit modal with drawer
7. **FileDropZone.tsx** - Create file upload component
8. **Update ImportExportTab.tsx** - Add file upload
9. **Update CreateTab.tsx** - Inline deck creation
10. **Update empty states** across tabs

## Testing Checklist
- [ ] Review flow works with progress indicator
- [ ] Rating buttons show correct intervals
- [ ] ManageTab actions menu works (edit, review, duplicate, move)
- [ ] Smart selection works (select all, clear, bulk actions)
- [ ] Collapsible filters work
- [ ] Edit drawer saves and deletes correctly
- [ ] File drag-and-drop imports correctly
- [ ] Inline deck creation works
- [ ] Empty states show appropriate messages
- [ ] Keyboard shortcuts still work in review
- [ ] All existing e2e tests pass

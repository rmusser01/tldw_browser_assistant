# PRD: Quick Ingest Drag-and-Drop Zone

## Summary

Add a visible drag-and-drop zone for files in the **Queue tab** of the Quick Ingest modal, making batch file ingestion faster, more discoverable, and integrated with the new tab-based architecture.

## Goals

- Make file ingestion obvious without searching for a file picker
- Enable fast multi-file ingestion from desktop/file manager
- Integrate seamlessly with the tab-based modal architecture (Opportunity A)
- Keep accessibility on par with existing file input
- Provide clear visual feedback for all drag states

## Non-Goals

- New file types beyond current support
- Changes to backend ingestion behavior
- Drag-and-drop for URLs (paste remains the URL input method)

## Users and Jobs

| User Type | Job to Be Done |
|-----------|----------------|
| Power users | Batch ingest many local files quickly (PDFs, audio, video) |
| New users | Discover file upload capability without hunting for a button |
| Keyboard-only users | Access the same functionality via click-to-browse fallback |

---

## Architecture Integration (Alignment with Opportunity A)

### Component Placement

The FileDropZone lives inside the **Queue tab** of the new modal architecture:

```
src/components/Common/QuickIngest/
├── QuickIngestModal.tsx        # Main container with tab state
├── QuickIngestTabs.tsx         # Tab navigation
├── QueueTab/
│   ├── QueueTab.tsx            # Container
│   ├── UrlInput.tsx            # URL paste area
│   ├── FileDropZone.tsx        # ← THIS COMPONENT
│   ├── QueuedItemsList.tsx     # Virtualized list
│   └── QueuedItemRow.tsx       # Individual item row
├── OptionsTab/
│   └── ...
└── ResultsTab/
    └── ...
```

### Tab Interaction Behavior

| User Action | Behavior |
|-------------|----------|
| Drag file over Queue tab | Drop zone activates with highlight |
| Drag file over Options/Results tab | No visual change, drop ignored |
| Drop file on non-Queue tab | Drop ignored (no action) |
| Drop while processing | Show disabled state, reject drop with message |
| Drop duplicate file | Show warning toast: "file.pdf is already in queue" |

---

## Visual Design

### Default State

```
+--------------------------------------------------+
|     ┌─────────────────────────────────────┐      |
|     │                                     │      |
|     │    📁 Drop files here               │      |
|     │    or click to browse               │      |
|     │                                     │      |
|     │    PDF, DOCX, MP3, MP4, and more    │      |
|     │    Max 500 MB per file              │      |
|     │                                     │      |
|     └─────────────────────────────────────┘      |
+--------------------------------------------------+
```

- Dashed border (`border-dashed`)
- Muted colors (`text-text-muted`, `border-border`)
- Centered icon and text

### Drag Over (Valid Files)

```
+--------------------------------------------------+
|  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐   |
|  ╎                                           ╎   |
|  ╎    ✨ Release to add 3 files             ╎   |
|  ╎                                           ╎   |
|  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘   |
+--------------------------------------------------+
```

- Primary color border (`border-primary`)
- Light background tint (`bg-primary/5`)
- Dynamic file count in message

### Drag Over (Invalid Files)

```
+--------------------------------------------------+
|  ┌─────────────────────────────────────────────┐ |
|  │                                             │ |
|  │    ❌ Some files not supported             │ |
|  │    .exe files cannot be processed          │ |
|  │                                             │ |
|  └─────────────────────────────────────────────┘ |
+--------------------------------------------------+
```

- Red border (`border-red-500`)
- Light red background (`bg-red-50 dark:bg-red-900/10`)
- Specific rejection reason

### Disabled State (During Processing)

```
+--------------------------------------------------+
|     ┌─────────────────────────────────────┐      |
|     │                                     │      |
|     │    ⏳ Processing in progress...     │      |
|     │    Wait for completion to add more  │      |
|     │                                     │      |
|     └─────────────────────────────────────┘      |
+--------------------------------------------------+
```

- Grayed out (`opacity-50`)
- Cursor not-allowed
- Informative message

### Disabled State (Server Offline)

When `!isOnlineForIngest` (server unreachable or offline mode enabled):

```
+--------------------------------------------------+
|     ┌─────────────────────────────────────┐      |
|     │                                     │      |
|     │    🔌 Server not connected          │      |
|     │    Connect to add files             │      |
|     │                                     │      |
|     └─────────────────────────────────────┘      |
+--------------------------------------------------+
```

- Grayed out (`opacity-50`)
- Shows connection-related message
- Aligns with existing `disabled={running || !isOnlineForIngest}` pattern (line 3321)

---

## Technical Implementation

### Dependency Decision

**Recommendation:** Use native implementation (matching existing codebase pattern).

The codebase already has a working drag-drop implementation in `src/components/Flashcards/components/FileDropZone.tsx` (132 lines) that uses native browser APIs with a drag counter pattern to prevent flickering.

| Approach | Pros | Cons |
|----------|------|------|
| **Native (Recommended)** | No new dependency, matches existing codebase pattern, proven in Flashcards | More code than react-dropzone |
| `react-dropzone` | Battle-tested, good a11y built-in | +15KB bundle, new dependency |

**Reference implementation:** `src/components/Flashcards/components/FileDropZone.tsx`
- Drag counter pattern (prevents flickering on nested elements)
- `isDragging` state for visual feedback
- Size and type validation
- Click-to-browse fallback

### Component Implementation

```typescript
// src/components/Common/QuickIngest/QueueTab/FileDropZone.tsx
import { useDropzone, FileRejection } from 'react-dropzone'
import { cn } from '@/utils/cn'
import { FileIcon } from 'lucide-react'

interface FileDropZoneProps {
  onFilesAdded: (files: File[]) => void
  onFilesRejected?: (rejections: FileRejection[]) => void
  disabled?: boolean
  className?: string
}

// Matches QuickIngestModal.tsx:3296
const ACCEPTED_EXTENSIONS = '.pdf,.txt,.rtf,.doc,.docx,.md,.epub'
const ACCEPTED_MIME_TYPES = 'application/pdf,text/plain,application/rtf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip,audio/*,video/*'

// Combined accept string for file input
const ACCEPT_STRING = `${ACCEPTED_EXTENSIONS},${ACCEPTED_MIME_TYPES}`

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFilesAdded,
  onFilesRejected,
  disabled = false,
  className
}) => {
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    draggedFiles
  } = useDropzone({
    onDrop: onFilesAdded,
    onDropRejected: onFilesRejected,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    disabled,
    multiple: true
  })

  const fileCount = draggedFiles?.length ?? 0

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        !disabled && !isDragActive && 'border-border hover:border-primary/50 hover:bg-primary/5',
        isDragActive && !isDragReject && 'border-primary bg-primary/5',
        isDragReject && 'border-red-500 bg-red-50 dark:bg-red-900/10',
        disabled && 'opacity-50 cursor-not-allowed border-border',
        className
      )}
      data-testid="qi-file-dropzone"
      data-tour="queue-dropzone"
    >
      <input {...getInputProps()} data-testid="qi-file-input" />

      {disabled ? (
        <>
          <span className="text-2xl">⏳</span>
          <p className="mt-2 font-medium">Processing in progress...</p>
          <p className="text-sm text-text-muted">Wait for completion to add more</p>
        </>
      ) : isDragReject ? (
        <>
          <span className="text-2xl">❌</span>
          <p className="mt-2 font-medium text-red-600 dark:text-red-400">
            Some files not supported
          </p>
          <p className="text-sm text-text-muted">
            Check file type and size (max 500 MB)
          </p>
        </>
      ) : isDragActive ? (
        <>
          <span className="text-2xl">✨</span>
          <p className="mt-2 font-medium">
            Release to add {fileCount > 1 ? `${fileCount} files` : 'file'}
          </p>
        </>
      ) : (
        <>
          <FileIcon className="w-8 h-8 mx-auto mb-2 text-text-muted" />
          <p className="font-medium">Drop files here or click to browse</p>
          <p className="text-sm text-text-muted mt-1">
            PDF, DOCX, MP3, MP4, and more • Max 500 MB
          </p>
        </>
      )}
    </div>
  )
}
```

### Rejection Handling

```typescript
// In QueueTab.tsx
const handleFilesRejected = (rejections: FileRejection[]) => {
  const errors = rejections.map(r => {
    const { file, errors } = r
    const reason = errors[0]?.code === 'file-too-large'
      ? `${file.name} exceeds 500 MB limit`
      : errors[0]?.code === 'file-invalid-type'
      ? `${file.name} is not a supported file type`
      : `${file.name} could not be added`
    return reason
  })

  // Show toast or inline error
  toast.error(
    errors.length === 1
      ? errors[0]
      : `${errors.length} files rejected`,
    { description: errors.length > 1 ? errors.slice(0, 3).join('\n') : undefined }
  )
}
```

### Duplicate Detection

**Note:** The existing `addLocalFiles()` function in `QuickIngestModal.tsx:2605-2700` already handles duplicate detection using a file key composed of `name::size::lastModified`. The FileDropZone should call this existing handler rather than reimplementing duplicate logic.

```typescript
// Existing pattern in QuickIngestModal.tsx:161-173
const buildLocalFileKey = (file: File) =>
  `${file.name}::${file.size}::${file.lastModified}`

// FileDropZone simply passes files to the existing handler:
const handleDrop = (acceptedFiles: File[]) => {
  addLocalFiles(acceptedFiles)  // Uses existing dedup logic
}
```

The existing `addLocalFiles()` function handles:
- Duplicate detection via `buildLocalFileKey()` (name + size + lastModified)
- WeakMap-based file identity tracking via `getFileInstanceId()`
- Queue state management
- Type defaults snapshot for each file

---

## Accessibility Requirements

| Requirement | Implementation |
|-------------|----------------|
| Keyboard accessible | Click to open file picker via Enter/Space |
| Screen reader support | `aria-label="File upload zone. Drag and drop files or press Enter to browse"` |
| Focus visible | Focus ring on tab navigation (`focus:ring-2`) |
| Announce state changes | `aria-live="polite"` for drag state announcements |
| Alternative input | File picker button remains accessible |

---

## Requirements Checklist

- [ ] Drop zone accepts same file types as current ingestion
- [ ] Enforce 500 MB size limit per file
- [ ] Show clear error for oversized files
- [ ] Show clear error for unsupported file types
- [ ] Disabled appearance while processing
- [ ] Do not interfere with URL paste input
- [ ] Dropped files added to queue exactly once
- [ ] Duplicate files (same name+size+lastModified) handled by existing `addLocalFiles()`
- [ ] Visual feedback for drag enter/leave
- [ ] Works in Chrome, Firefox, Edge
- [ ] Keyboard accessible via click-to-browse
- [ ] Screen reader announces instructions and states

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Browser drag event flickering | Use drag counter pattern (proven in `Flashcards/FileDropZone.tsx`) |
| Noisy rejection messages for many files | Aggregate errors: "3 files rejected" with expandable details |
| Conflicts with URL input area | Clear visual separation; drop zone has distinct boundaries |
| Large file performance | Server enforces 500MB limit; show size error before upload |
| Mobile/touch devices | Drop zone degrades to click-only (touch drag-drop is rare) |

---

## Acceptance Criteria

1. **Happy Path:** User drags 3 valid files into drop zone → all 3 appear in queue
2. **Mixed Files:** User drags 2 valid + 1 invalid file → 2 added, 1 rejection toast
3. **Oversized File:** User drags 600 MB file → rejection with "exceeds 500 MB limit"
4. **Duplicate File:** User drops file already in queue → handled by existing `addLocalFiles()` dedup logic
5. **During Processing:** User tries to drop files while `running=true` → drop ignored, "Processing" message shown
6. **Server Offline:** User tries to drop files when `!isOnlineForIngest` → drop ignored, "Connect to server" message shown
7. **Keyboard Flow:** User tabs to drop zone → presses Enter → file picker opens
8. **Screen Reader:** Focus on drop zone announces purpose and instructions

---

## Test Plan

### Manual Testing

- [ ] Drag valid files (PDF, TXT, RTF, DOCX, MD, EPUB, audio, video) → verify queued
- [ ] Drag invalid files (.exe, .zip, .csv) → verify rejection message
- [ ] Drag oversized file (>500MB) → verify size limit message
- [ ] Drag duplicate file (same name+size+lastModified) → handled by `addLocalFiles()`
- [ ] Drag during processing (`running=true`) → verify "Processing" disabled state
- [ ] Drag when server offline (`!isOnlineForIngest`) → verify "Connect to server" disabled state
- [ ] Click drop zone → verify file picker opens
- [ ] Tab to drop zone → verify focus ring visible
- [ ] Test in Chrome, Firefox, Edge

### E2E Tests (Playwright)

```typescript
// tests/e2e/quick-ingest-dropzone.spec.ts
test('adds files via file picker', async ({ page }) => {
  await page.click('[data-testid="qi-file-dropzone"]')
  await page.setInputFiles('[data-testid="qi-file-input"]', [
    'tests/fixtures/sample.pdf',
    'tests/fixtures/sample.mp3'
  ])
  await expect(page.locator('[data-testid="queued-item"]')).toHaveCount(2)
})

test('shows disabled state during processing', async ({ page }) => {
  // Start processing
  await page.click('[data-testid="qi-process-button"]')
  // Verify drop zone is disabled
  await expect(page.locator('[data-testid="qi-file-dropzone"]'))
    .toHaveClass(/opacity-50/)
})
```

Note: Playwright doesn't support native drag-and-drop simulation well, so drag behavior should be tested manually or with mocked events.

---

## Existing Code to Integrate With

This enhancement builds on existing code. Key integration points:

| Code Location | Purpose | Integration Notes |
|---------------|---------|-------------------|
| `QuickIngestModal.tsx:2605-2700` | `addLocalFiles()` function | Call this to add files - handles dedup, identity, queue state |
| `QuickIngestModal.tsx:2759-2767` | `handleFileDrop()` handler | Existing drop handler - can be enhanced or replaced |
| `QuickIngestModal.tsx:3305-3334` | Current drop zone div | Replace with new FileDropZone component |
| `QuickIngestModal.tsx:3296` | Accept string for file input | Use same accept string for consistency |
| `QuickIngestModal.tsx:3321` | Disabled condition | Use `running \|\| !isOnlineForIngest` |
| `Flashcards/FileDropZone.tsx` | Reference implementation | Copy drag counter pattern from here |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/Common/QuickIngest/QueueTab/FileDropZone.tsx` | **CREATE** - New component with drag counter pattern |
| `src/components/Common/QuickIngestModal.tsx` | **MODIFY** - Import FileDropZone, replace lines 3305-3334 |
| `src/assets/locale/en/option.json` | **MODIFY** - Add i18n keys for new states (some exist: `qi('dragAndDrop')`) |
| `tests/e2e/quick-ingest-dropzone.spec.ts` | **CREATE** - Add E2E tests for file picker flow |

---

## Estimated Effort

**0.5 - 1 day** (aligned with UX Review estimate)

---

## Design Decisions

1. **Tab drag behavior:** Drop only works on Queue tab. Dragging over Options/Results tabs is ignored (simplest implementation).
2. **Duplicate detection:** Defer to existing `addLocalFiles()` which uses `name::size::lastModified` key via `buildLocalFileKey()`.
3. **Batch rejection UX:** Aggregate errors: "3 files rejected" with expandable details in toast.
4. **Disabled condition:** Must use `running || !isOnlineForIngest` to match existing button behavior (line 3321).

---

## Dependencies

**No new dependencies required** (using native implementation pattern from Flashcards).

Existing dependencies used:
- `lucide-react` - for Upload/FileIcon
- `antd` - for Button component
- Toast system - for rejection/duplicate messages
- `react-i18next` - for i18n

## Scope

- Visible drop zone in the Queue view (Queue tab)
- Drag-over visual feedback and rejection state
- Fallback to click-to-browse file picker
- Clear list of supported file types and size limit

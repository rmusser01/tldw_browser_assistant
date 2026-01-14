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

---

## Technical Implementation

### Dependency Decision

**Recommendation:** Use `react-dropzone` library.

| Approach | Pros | Cons |
|----------|------|------|
| `react-dropzone` | Battle-tested, handles edge cases, good a11y | +15KB bundle |
| Native implementation | No dependency | Browser inconsistencies, more code to maintain |

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

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'audio/*': ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac'],
  'video/*': ['.mp4', '.webm', '.mov', '.mkv', '.avi'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/*': ['.txt', '.md', '.csv'],
  'application/epub+zip': ['.epub']
}

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

```typescript
// In QueueTab.tsx
const handleFilesAdded = (newFiles: File[]) => {
  const duplicates: string[] = []
  const filesToAdd: File[] = []

  for (const file of newFiles) {
    const isDuplicate = queuedItems.some(
      item => item.type === 'file' &&
              item.file.name === file.name &&
              item.file.size === file.size
    )
    if (isDuplicate) {
      duplicates.push(file.name)
    } else {
      filesToAdd.push(file)
    }
  }

  // Add non-duplicate files
  if (filesToAdd.length > 0) {
    addFilesToQueue(filesToAdd)
  }

  // Warn about duplicates
  if (duplicates.length > 0) {
    toast.warning(
      duplicates.length === 1
        ? `${duplicates[0]} is already in queue`
        : `${duplicates.length} files already in queue`,
      { description: duplicates.length > 1 ? duplicates.join(', ') : undefined }
    )
  }
}
```

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
- [ ] Duplicate files (same name+size) show warning toast instead of adding
- [ ] Visual feedback for drag enter/leave
- [ ] Works in Chrome, Firefox, Edge
- [ ] Keyboard accessible via click-to-browse
- [ ] Screen reader announces instructions and states

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Browser drag event inconsistencies | Use react-dropzone (handles edge cases) |
| Noisy rejection messages for many files | Aggregate errors: "3 files rejected" with expandable details |
| Conflicts with URL input area | Clear visual separation; drop zone has distinct boundaries |
| Large file performance | Show upload progress indicator if browser supports it |
| Mobile/touch devices | Drop zone degrades to click-only (touch drag-drop is rare) |

---

## Acceptance Criteria

1. **Happy Path:** User drags 3 valid files into drop zone → all 3 appear in queue
2. **Mixed Files:** User drags 2 valid + 1 invalid file → 2 added, 1 rejection toast
3. **Oversized File:** User drags 600 MB file → rejection with "exceeds 500 MB limit"
4. **Duplicate File:** User drops file already in queue → warning toast "file.pdf is already in queue"
5. **During Processing:** User tries to drop files while processing → drop ignored, message shown
6. **Keyboard Flow:** User tabs to drop zone → presses Enter → file picker opens
7. **Screen Reader:** Focus on drop zone announces purpose and instructions

---

## Test Plan

### Manual Testing

- [ ] Drag valid files (PDF, MP3, MP4, DOCX) → verify queued
- [ ] Drag invalid files (.exe, .zip) → verify rejection message
- [ ] Drag oversized file → verify size limit message
- [ ] Drag duplicate file (same name+size already queued) → verify warning toast
- [ ] Drag during processing → verify disabled state
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

## Files to Create/Modify

| File | Action |
|------|--------|
| `package.json` | Add `react-dropzone` dependency |
| `src/components/Common/QuickIngest/QueueTab/FileDropZone.tsx` | Create new component |
| `src/components/Common/QuickIngest/QueueTab/QueueTab.tsx` | Import and use FileDropZone |
| `src/assets/locale/en/quick-ingest.json` | Add i18n strings for drop zone messages |
| `tests/e2e/quick-ingest-dropzone.spec.ts` | Add E2E tests |

---

## Estimated Effort

**0.5 - 1 day** (aligned with UX Review estimate)

---

## Design Decisions

1. **Tab drag behavior:** Drop only works on Queue tab. Dragging over Options/Results tabs is ignored (simplest implementation).
2. **Duplicate detection:** Show warning toast ("file.pdf is already in queue") when user tries to add a file with matching name+size.
3. **Batch rejection UX:** Aggregate errors: "3 files rejected" with expandable details in toast.

---

## Dependencies

- `react-dropzone` (~15KB gzipped) - handles cross-browser drag-and-drop edge cases
- Existing: `lucide-react` for FileIcon, toast system for notifications

## Scope

- Visible drop zone in the Queue view (Queue tab)
- Drag-over visual feedback and rejection state
- Fallback to click-to-browse file picker
- Clear list of supported file types and size limit

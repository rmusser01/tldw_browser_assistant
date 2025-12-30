# Content Review System - Product Requirements Document

## Document Info

| Field | Value |
|-------|-------|
| **Feature Name** | Content Review System |
| **Status** | Draft |
| **Created** | 2025-12-20 |
| **Author** | Claude Code |

---

## 1. Executive Summary

### Problem Statement

Currently, content ingested through the Quick Ingest feature is sent directly to `tldw_server` for processing and storage with no intermediate review step. Users have no opportunity to:

- Fix transcription errors in audio/video content
- Correct OCR mistakes in PDF/document content
- Remove irrelevant sections (ads, tangents, boilerplate)
- Adjust structural formatting (headings, paragraphs, lists)
- Edit metadata before permanent storage

Once content is stored, users must use the post-hoc version editing system, which is less intuitive and requires navigating to a separate media viewer.

### Proposed Solution

Add an optional **Content Review** step between ETL processing and final storage. When enabled, processed content is saved as local drafts that users can review and edit in a dedicated full-page editor before committing to the server.

### Success Criteria (No Telemetry)

No product analytics or telemetry will be collected for this feature. Success will be evaluated qualitatively via user feedback and internal QA.

---

## 2. User Requirements

### 2.1 Target Users

- Power users who process large volumes of content (transcripts, articles, documents)
- Users who need high-quality, clean content for RAG/knowledge base
- Users working with audio/video content where transcription errors are common

### 2.2 User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-1 | Content curator | Review transcripts before storage | I can fix speech-to-text errors |
| US-2 | Researcher | Filter out irrelevant sections | Only valuable content enters my knowledge base |
| US-3 | Knowledge worker | Edit metadata and keywords | Content is properly categorized |
| US-4 | Bulk importer | Review multiple items in one session | I can efficiently process batches |
| US-5 | Casual user | Skip review when I trust the source | I'm not forced into extra steps |

### 2.3 Confirmed Requirements

Based on user research:

| Requirement | Decision |
|-------------|----------|
| **Edit Types** | Text corrections, structural formatting, content filtering, metadata editing |
| **Workflow** | Optional (per-ingest toggle; last-used value persisted as default) |
| **UI Location** | Dedicated full-page editor (not modal or sidepanel) |
| **Persistence** | Drafts saved to IndexedDB across browser sessions |

---

## 3. Functional Requirements

### 3.1 Core Features

#### FR-1: Review Mode Toggle

- **Location**: QuickIngestModal, visible when "Store Remote" is enabled
- **Behavior**: When enabled, processed content becomes drafts instead of being stored directly; toggle applies to the current ingestion
- **Persistence**: Last-used toggle value saved to extension storage and used as the default for the next ingestion (no separate global setting)
- **Default**: Disabled (preserves current behavior)

#### FR-2: Draft Creation

- **Trigger**: User clicks "Ingest" with review mode enabled
- **Process**:
  1. Content processed using the media-type-specific "process-only" endpoint (no persistence)
     - Audio/video: `/api/v1/media/process-audios` or `/api/v1/media/process-videos` (or `/api/v1/audio/transcriptions` for raw STT)
     - Documents/HTML: `/api/v1/media/process-documents`
     - PDFs: `/api/v1/media/process-pdfs`
  2. Server returns processed content without storing
  3. Extension saves results as `ContentDraft` records in IndexedDB, including source references
     - URLs: store original URL
     - Files: store original file blob when feasible; if storage exceeds the 100 MB cap, warn and store the draft without a source asset
  4. User redirected to Content Review page
- **Batch Support**: Multiple items from single ingestion grouped into a `DraftBatch`

#### FR-3: Content Review Page

- **Layout**: Sidebar (draft list) + Main area (editor)
- **Navigation**: Previous/Next buttons
- **Editor Features**:
  - Markdown plain-text editor (no WYSIWYG); toolbar inserts Markdown syntax
  - Word/character count
  - Auto-save with visual indicator
  - Diff view (original vs edited Markdown)
  - AI-assisted corrections and template formatting tools (on-demand; no auto-commit)
- **Content Format**: Draft content stored as plain text/Markdown; HTML outputs are converted to Markdown before editing
- **Section Filtering**: Checkbox UI to include/exclude content sections
- **Metadata Panel**: Edit title, keywords, custom fields

#### FR-4: Draft Actions

| Action | Behavior |
|--------|----------|
| **Save Draft** | Persist current edits to IndexedDB |
| **Discard** | Delete draft, optionally with confirmation |
| **Mark Reviewed** | Set status to `reviewed`, optionally advance to next item |
| **Commit** | Send edited content + metadata to server (see Commit Flow), mark as committed |
| **Skip** | Move to next item without changing status |
| **Commit All** | Commit all `reviewed` items only; `in_progress` items remain unchanged |

#### FR-5: Edit History

- **Revisions**: Store up to 10 content snapshots per draft, with size-based limits (see 9.1)
- **Undo**: Revert to previous revision
- **Reset**: Restore to original processed content

#### FR-6: Draft Lifecycle

| Status | Description |
|--------|-------------|
| `pending` | Created, not yet reviewed |
| `in_progress` | Currently being edited |
| `reviewed` | User marked as ready for commit |
| `committed` | Successfully sent to server |
| `discarded` | User chose to delete |

- **State transitions**:
  - Create -> `pending`
  - Open/edit -> `in_progress`
  - Mark Reviewed -> `reviewed`
  - Commit -> `committed` (auto-mark `reviewed` if needed)
  - Discard -> `discarded`
  - Skip -> no status change (navigation only)
- **Batch counts**: Derived from `contentDrafts` by status when rendering UI; progress uses `reviewed` (ready-to-submit) / total, and ready-to-submit includes `reviewed` only; no authoritative counters stored on `DraftBatch`

#### FR-7: Auto-Cleanup

- Drafts expire after 30 days (configurable in Settings > Content Review)
- Committed/discarded drafts cleaned up after 7 days
- Empty batches removed after 24 hours
- Enforce a 100 MB storage cap for draft content + source assets; warn if a save would exceed it (non-audio/video can proceed with synthetic text source)

### 3.2 Enhancement Features (In Scope)

| Enhancement | Description | Priority |
|-------------|-------------|----------|
| AI-assisted corrections | Auto-fix transcription errors using LLM | High |
| Template formatting | Apply formatting rules automatically | Medium |
| Section detection | Auto-detect chapters/sections in transcripts | Medium |

- AI-assisted corrections are on-demand and apply edits locally; content remains client-side until commit.
- Template formatting applies a selected rule set with preview/undo support.
- Section detection uses the model described in 4.6.

---

## 4. Technical Architecture

### 4.1 Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INGESTION FLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  QuickIngestModal                                                    │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────┐                                            │
│  │ reviewBeforeStorage │                                            │
│  │      enabled?       │                                            │
│  └─────────────────────┘                                            │
│       │           │                                                  │
│      Yes          No                                                 │
│       │           │                                                  │
│       ▼           ▼                                                  │
│  ┌──────────────┐  ┌──────────────────┐                              │
│  │ process-only │  │ Direct storage   │                              │
│  │ endpoint(s)  │  │ (current flow)   │                              │
│  └──────────────┘  └──────────────────┘                              │
│       │                                                              │
│       ▼                                                              │
│  ┌──────────────────────┐                                           │
│  │ tldw:create-drafts   │                                           │
│  │ Save to IndexedDB    │                                           │
│  └──────────────────────┘                                           │
│       │                                                              │
│       ▼                                                              │
│  ┌──────────────────────┐                                           │
│  │ Navigate to          │                                           │
│  │ /content-review      │                                           │
│  └──────────────────────┘                                           │
│       │                                                              │
│       ▼                                                              │
│  ┌──────────────────────┐                                           │
│  │ User edits content   │◄──────────────────┐                       │
│  └──────────────────────┘                   │                       │
│       │                                     │                       │
│       ▼                                     │                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │                       │
│  │ Discard  │  │  Commit  │  │   Save   │──┘                       │
│  └──────────┘  └──────────┘  │  Draft   │                          │
│       │              │       └──────────┘                           │
│       ▼              ▼                                              │
│  ┌──────────┐  ┌──────────────────┐                                 │
│  │ Delete   │  │ tldw:commit-draft│                                 │
│  │ draft    │  │ POST /media/add  │                                 │
│  └──────────┘  └──────────────────┘                                 │
│                      │                                              │
│                      ▼                                              │
│               ┌──────────────────┐                                  │
│               │ Mark committed   │                                  │
│               │ in IndexedDB     │                                  │
│               └──────────────────┘                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Database Schema

#### New Tables (Dexie v4)

```typescript
// Table: contentDrafts
// Indexes: id, batchId, status, mediaType, createdAt, updatedAt, expiresAt
contentDrafts: 'id, batchId, status, mediaType, createdAt, updatedAt, expiresAt'

// Table: draftBatches
// Indexes: id, createdAt, updatedAt
draftBatches: 'id, createdAt, updatedAt'

// Table: draftAssets
// Indexes: id, draftId, createdAt
draftAssets: 'id, draftId, createdAt'
```

#### Type Definitions

```typescript
type DraftStatus = 'pending' | 'in_progress' | 'reviewed' | 'committed' | 'discarded'

type DraftRevision = {
  id: string
  content: string
  metadata?: Record<string, any>
  timestamp: number
  changeDescription?: string
}

type DraftSection = {
  id: string
  label: string
  kind: 'heading' | 'paragraph' | 'speaker_turn' | 'page' | 'chapter'
  startOffset: number
  endOffset: number
  content: string
  level?: number
  source: 'server' | 'heuristic'
  meta?: Record<string, any>
}

type DraftSource = {
  kind: 'url' | 'file'
  url?: string
  fileName?: string
  mimeType?: string
  sizeBytes?: number
  lastModified?: number
}

type DraftAsset = {
  id: string
  draftId: string
  kind: 'file'
  fileName: string
  mimeType: string
  sizeBytes: number
  blob: Blob
  createdAt: number
}

type ContentDraft = {
  id: string                          // UUID
  batchId: string                     // Parent batch reference

  // Source
  source: DraftSource
  sourceAssetId?: string              // DraftAsset reference for file sources (undefined when asset not stored)
  mediaType: 'html' | 'pdf' | 'document' | 'audio' | 'video'

  // Content (editable)
  title: string
  originalTitle?: string
  content: string
  originalContent: string             // Immutable reference
  contentFormat: 'plain' | 'markdown'
  originalContentFormat?: 'plain' | 'markdown'

  // Metadata
  metadata: Record<string, any>
  originalMetadata?: Record<string, any>
  keywords: string[]

  // Structure
  sections?: DraftSection[]
  excludedSectionIds?: string[]
  sectionStrategy?: 'server' | 'headings' | 'paragraphs' | 'timestamps'

  // Edit history
  revisions: DraftRevision[]          // Max 10 snapshots

  // Processing options (preserved for commit)
  processingOptions: {
    perform_analysis: boolean
    perform_chunking: boolean
    overwrite_existing: boolean
    advancedValues: Record<string, any>
  }

  // Status
  status: DraftStatus
  reviewNotes?: string

  // Timestamps
  createdAt: number
  updatedAt: number
  reviewedAt?: number
  committedAt?: number
  expiresAt?: number
}

type DraftBatch = {
  id: string
  name?: string
  source: 'url_list' | 'file_upload' | 'quick_ingest' | 'manual'
  sourceDetails?: Record<string, any>

  // Statistics (derived at runtime; not stored)
  totalItems?: number
  readyToSubmitCount?: number          // reviewed only
  committedCount?: number
  discardedCount?: number

  // Timestamps
  createdAt: number
  updatedAt: number
  completedAt?: number
}
```

### 4.3 Message Protocol

#### New Message Types

```typescript
// Create drafts from processing results
type TldwCreateDraftsMessage = {
  type: 'tldw:create-drafts'
  payload: {
    results: ProcessingResult[]
    processingOptions: Record<string, any>
  }
}
// Response: { ok: boolean; draftIds: string[]; batchId: string; error?: string }

// Commit a single draft
type TldwCommitDraftMessage = {
  type: 'tldw:commit-draft'
  payload: {
    draftId: string
  }
}
// Response: { ok: boolean; mediaId?: string | number; error?: string }

// Batch commit multiple drafts
type TldwCommitDraftBatchMessage = {
  type: 'tldw:commit-draft-batch'
  payload: {
    draftIds: string[]
  }
}
// Response: { ok: boolean; results: CommitResult[] }

// Progress event during batch commit
type TldwCommitProgressMessage = {
  type: 'tldw:commit-progress'
  payload: {
    draftId: string
    status: 'pending' | 'uploading' | 'ok' | 'error'
    processedCount: number
    totalCount: number
    error?: string
  }
}
```

### 4.4 State Management

#### New Zustand Store: `content-review.tsx`

```typescript
type ContentReviewStore = {
  // Active draft
  activeDraftId: string | null
  setActiveDraftId: (id: string | null) => void

  // Draft data (in-memory working copy)
  draftContent: Partial<ContentDraft> | null
  setDraftContent: (content: Partial<ContentDraft>) => void
  updateDraftField: <K extends keyof ContentDraft>(field: K, value: ContentDraft[K]) => void

  // Editor state
  isEditing: boolean
  setIsEditing: (editing: boolean) => void
  hasUnsavedChanges: boolean
  setHasUnsavedChanges: (dirty: boolean) => void

  // Commit state
  isCommitting: boolean
  setIsCommitting: (committing: boolean) => void
  commitError: string | null
  setCommitError: (error: string | null) => void

  // Batch navigation
  pendingDraftIds: string[]
  setPendingDraftIds: (ids: string[]) => void
  currentBatchIndex: number
  setCurrentBatchIndex: (index: number) => void

  // Actions
  loadDraft: (id: string) => Promise<void>
  saveDraftLocally: () => Promise<void>
  commitDraft: () => Promise<void>
  discardDraft: () => Promise<void>
  navigateToNextDraft: () => void
  navigateToPreviousDraft: () => void

  // Reset
  reset: () => void
}
```

#### Extended Store: `quick-ingest.tsx`

```typescript
// Add to existing store
reviewBeforeStorage: boolean
setReviewBeforeStorage: (enabled: boolean) => void
pendingReviewBatchId: string | null
setPendingReviewBatchId: (id: string | null) => void
```

### 4.5 Commit Flow (Existing APIs, Client-Only)

Commit uses existing server endpoints; no new server fields or routes are required.

#### Step 1: Persist Base Media

Use `POST /api/v1/media/add` with the original source when available:

- URLs: send the original URL.
- Files: send the original file upload.
- Include processing options from the draft (`perform_analysis`, `perform_chunking`, etc.).

Audio/video commits require the original source asset; if missing, block commit and prompt the user to reattach the file.

If the original source asset is missing and the draft is not audio/video, create a synthetic text file from the edited content (use `.md` for Markdown or `.txt` for plain text) and upload it as `media_type=document`. Store the original media type in safe metadata under `original_media_type`.

#### Step 2: Apply Reviewed Edits

After `/media/add` returns a `media_id`:

- `PUT /api/v1/media/{media_id}` with `content`, `title`, `keywords`, `analysis`, and `prompt` from the reviewed draft.
- `PATCH /api/v1/media/{media_id}/metadata` to store custom fields (safe metadata) from the draft.

#### Behavior Notes

- `/media/add` will reprocess the source; the subsequent `PUT` updates the stored content to the reviewed version.
- Chunking/analysis from the initial ingestion may reflect the original extraction; the edited content is authoritative in the Media record and version history.
- `process-*` endpoints are used only for draft creation and do not persist to the Media DB.

### 4.6 Section Detection Model

- Preferred: server includes `sections` in processing results (with offsets) so the client can render the checkbox list directly.
- Client fallback (when no sections provided):
  - Audio/video transcripts: split by speaker turns or timestamped segments; fallback to paragraph breaks.
  - HTML/Markdown: split by heading hierarchy, then paragraph blocks.
  - PDF/document: split by detected page breaks or headings; fallback to paragraph blocks.
- The draft stores sections in `sections` and user selection in `excludedSectionIds`.
- Section filtering composes `content` from selected sections based on `originalContent`. Once a user makes manual edits, section toggles are disabled unless the user resets to the original content.

---

## 5. UI/UX Specifications

### 5.1 Content Review Page Layout

```
+==================================================================+
|  HEADER (from Layout.tsx)                                         |
+================+===+==============================================+
|                |   |                                              |
|  BATCH INFO    | T |  EDITOR HEADER                               |
|  [Progress]    | O |  [<] [>] "Video Title" 3/20  [Copy] [...]   |
|                | G |                                              |
|  FILTERS       | G |  TOOLBAR                                     |
|  [Status]      | L |  [B] [I] [H1] [Link] [List] | [Undo] [Redo] |
|  [Type]        | E |                                              |
|                |   |  CONTENT AREA                                |
|  ITEM LIST     |   |  +----------------------------------------+  |
|  +----------+  |   |  |                                        |  |
|  | Item 1   |  |   |  |  # Welcome                            |  |
|  +----------+  |   |  |                                        |  |
|  | Item 2 * |  |   |  |  This is the main content...          |  |
|  +----------+  |   |  |                                        |  |
|  | Item 3   |  |   |  +----------------------------------------+  |
|  +----------+  |   |  2,450 words | 14,320 chars | Saved 2m ago  |
|                |   |                                              |
|                |   |  METADATA (collapsible)                      |
|                |   |  [v] Title, Keywords, Custom fields          |
|                |   |                                              |
|  BULK ACTIONS  |   |  ACTION BAR                                  |
|  [Commit All]  |   |  [Discard] [Save Draft] [Mark Reviewed ->]  |
+================+===+==============================================+
```

### 5.2 Component Hierarchy

```
src/routes/option-content-review.tsx
  └── OptionLayout
      └── ContentReviewPage
          ├── BatchListSidebar
          │   ├── BatchHeader (progress bar, batch name)
          │   ├── FilterPanel (status, type filters)
          │   ├── ReviewItemList (virtual list)
          │   │   └── ReviewItemCard (per item)
          │   └── BulkActions (commit all, etc.)
          │
          ├── CollapseToggle (sidebar toggle)
          │
          └── EditorPanel
              ├── EditorHeader (navigation, title, actions)
              ├── EditorToolbar (formatting buttons)
              ├── ContentEditor (textarea)
              ├── EditorFooter (word count, save status)
              ├── SectionFilter (optional, for filtering sections)
              ├── MetadataPanel (collapsible)
              │   ├── TitleInput
              │   ├── KeywordTags
              │   └── CustomFields
              └── ActionBar (discard, save, commit)
```

### 5.3 Key Interactions

| Interaction | Behavior |
|-------------|----------|
| **Click item in sidebar** | Load draft into editor, auto-save previous |
| **Edit content** | Mark as dirty, debounced auto-save (2s) |
| **Click Previous/Next** | Navigate previous/next item |
| **Click "Mark Reviewed"** | Mark as reviewed, move to next |
| **Click "Commit"** | Send to server, show success/error toast |
| **Click "Discard"** | Confirmation dialog, then delete |
| **Click "Show Original"** | Toggle diff view |

### 5.4 Empty/Error States

| State | Display |
|-------|---------|
| No drafts | "No content to review. Use Quick Ingest to add content." |
| All committed | "All items reviewed and committed!" with link to Media |
| Load error | Error message with retry button |
| Commit error | Error toast with retry option, draft remains |
| Offline | Warning banner, commit disabled |
| Missing source asset | Warning with reattach flow; audio/video commits disabled until resolved |
| Storage cap exceeded | Warning with option to continue as synthetic text source (non-audio/video) |

---

## 6. Implementation Plan

### Phase 1: Database Layer (Foundation)

**Files to modify:**
- `src/db/dexie/types.ts` - Add ContentDraft, DraftBatch, DraftRevision, DraftSection, DraftAsset types
- `src/db/dexie/schema.ts` - Add version 4 with new tables (`contentDrafts`, `draftBatches`, `draftAssets`)

**Files to create:**
- `src/db/dexie/drafts.ts` - CRUD operations

**Deliverables:**
- [ ] Type definitions added
- [ ] Schema migrated to v4
- [ ] All CRUD operations implemented (including asset blobs)
- [ ] Unit tests for database operations

### Phase 2: State Management

**Files to create:**
- `src/store/content-review.tsx` - New Zustand store

**Files to modify:**
- `src/store/quick-ingest.tsx` - Add reviewBeforeStorage

**Deliverables:**
- [ ] Content review store implemented
- [ ] Quick ingest store extended
- [ ] Store integration tested

### Phase 3: Message Protocol

**Files to modify:**
- `src/entries/background.ts` - Add message handlers

**Deliverables:**
- [ ] `tldw:create-drafts` handler
- [ ] `tldw:commit-draft` handler
- [ ] `tldw:commit-draft-batch` handler
- [ ] Progress events working
- [ ] Commit uses `/media/add` then `PUT /media/{media_id}` and metadata patch

### Phase 4: QuickIngestModal Integration

**Files to modify:**
- `src/components/Common/QuickIngestModal.tsx`

**Deliverables:**
- [ ] "Review before storing" toggle added
- [ ] Toggle visibility logic (only when storeRemote=true)
- [ ] Modified run() to create drafts and redirect
- [ ] Preference persistence

### Phase 5: Content Review Page

**Files to create:**
- `src/routes/option-content-review.tsx`
- `src/components/ContentReview/ContentReviewPage.tsx`
- `src/components/ContentReview/BatchListSidebar.tsx`
- `src/components/ContentReview/DraftEditor.tsx`
- `src/components/ContentReview/MetadataPanel.tsx`
- `src/components/ContentReview/ActionBar.tsx`

**Files to modify:**
- `src/routes/chrome.tsx` - Add route
- `src/routes/firefox.tsx` - Add route

**Deliverables:**
- [ ] Route registered and accessible
- [ ] Sidebar with item list working
- [ ] Editor with toolbar functional
- [ ] Auto-save implemented
- [ ] Commit/discard working
- [ ] Batch operations working

### Phase 6: Navigation & i18n

**Files to modify:**
- `src/components/Layouts/settings-nav.ts`
- `src/assets/locale/en/common.json`
- `src/public/_locales/en/messages.json`

**Deliverables:**
- [ ] Navigation item added
- [ ] All strings translatable
- [ ] English translations complete

---

## 7. Testing Requirements

### 7.1 Unit Tests

- Database operations (create, read, update, delete drafts)
- Store actions and state transitions
- Content diff generation
- Section filtering composition and selection persistence

### 7.2 Integration Tests

- Draft creation from Quick Ingest
- Commit flow (draft → server)
- Batch commit with mixed results
- Commit uses `/media/add` then `PUT /media/{media_id}` and metadata patch
- Audio/video commit requires source asset (error when missing)

### 7.3 E2E Tests

**New test file:** `tests/e2e/content-review.spec.ts`

| Test Case | Description |
|-----------|-------------|
| Review toggle visibility | Toggle shows only when storeRemote enabled |
| Draft creation | Enabling review creates drafts, redirects to page |
| Edit and save | Changes persist across page reload |
| Commit single | Draft commits successfully, status updates |
| Commit batch | Multiple items commit with progress |
| Discard | Draft deleted after confirmation |
| Offline handling | Commits disabled when offline |
| Section filtering | Toggle sections updates content and persists selection |
| Missing source asset | Audio/video commit blocked with reattach prompt |
| Storage cap warning | File(s) exceeding 100 MB show warning; non-audio/video drafts can commit via synthetic text source |
| Large content | Transcripts >500KB handled correctly |

### 7.4 Manual Testing Checklist

- [ ] Enable review mode: warning shows once and preference persists
- [ ] Quick Ingest with review enabled opens Content Review; no server media exists before commit
- [ ] Verify no server writes before commit (media list unchanged; network shows only `process-*` calls)
- [ ] Ready-to-submit count reflects `reviewed` only
- [ ] Edit content/title/keywords; auto-save persists after reload
- [ ] AI-assisted corrections update the draft content and can be undone
- [ ] Template formatting applies selected rules and preserves content on commit
- [ ] Section toggles update content and persist selection
- [ ] Mark Reviewed advances to next item and updates counts
- [ ] Commit single/all respects reviewed-only rule; committed item matches edits on server
- [ ] Audio/video without source blocks commit; reattach succeeds; 100MB cap warning shows
- [ ] No cmd/ctrl keyboard shortcuts are bound

---

## 8. Security Considerations

- **Sensitive local data**: Drafts may include PII/sensitive content; show a warning when enabling review, provide a "Clear drafts" action, and avoid logging draft content
- **Auth header handling**: Commit uses existing `bgRequest` which handles auth safely
- **Content sanitization**: Use existing DOMPurify integration for any HTML rendering
- **No cross-origin risks**: All data flows through background script proxy

### 8.1 Telemetry & Analytics Policy

No telemetry or analytics will be collected for this feature. Draft content and review actions are not logged or reported.

---

## 9. Performance Considerations

### 9.1 Large Content Handling

| Content Size | Strategy |
|--------------|----------|
| < 100 KB | Full revision snapshots |
| 100 KB - 500 KB | Reduced max revisions (5) |
| 500 KB - 2 MB | Reduced max revisions (3) |
| > 2 MB | Single revision only |

### 9.2 Batch Limits

- Recommended batch size: ≤ 50 items
- UI pagination for large batches
- Virtual list for sidebar performance

### 9.3 Storage Management

- Default expiration: 30 days
- Cleanup on extension startup
- Storage usage indicator in settings
- Source asset storage cap: 100 MB total; warn before saving files that would exceed the cap

---

## 10. Future Enhancements (Out of Scope)

| Enhancement | Description | Priority |
|-------------|-------------|----------|
| Collaborative review | Multiple users review same batch | Low |
| External editor | Open in VS Code or preferred editor | Low |
| Review queue badge | Show pending review count in header | Medium |

---

## 11. Dependencies

### Internal Dependencies

- Existing Quick Ingest infrastructure
- Dexie database layer
- Zustand state management
- Background script message passing
- tldw_server `/api/v1/media/add`, `/api/v1/media/{media_id}` (PUT), `/api/v1/media/{media_id}/metadata` (PATCH)

### External Dependencies

None required. All functionality uses existing libraries:
- React 18
- Ant Design components
- TailwindCSS
- Dexie.js

---

## 12. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Large transcript performance | High | Medium | Implement chunking, reduce revisions |
| Data loss on browser crash | High | Low | Frequent auto-save, revision history |
| User confusion with two workflows | Medium | Medium | Clear UI, toggle visibility, onboarding tooltip |
| Storage quota exceeded | Medium | Low | Expiration policy, cleanup, usage indicator |
| Server API changes | Medium | Low | Version fallback schemas already exist |
| Sensitive local draft data | Medium | Medium | Warning on enable, clear drafts action, no telemetry |
| Edited content not re-chunked | Medium | Medium | Accepted limitation; client-only feature with no server changes |

---

## 13. Appendix

### A. File Change Summary

| File | Action | Lines (Est.) |
|------|--------|--------------|
| `src/db/dexie/types.ts` | Modify | +80 |
| `src/db/dexie/schema.ts` | Modify | +30 |
| `src/db/dexie/drafts.ts` | Create | ~300 |
| `src/store/content-review.tsx` | Create | ~150 |
| `src/store/quick-ingest.tsx` | Modify | +15 |
| `src/entries/background.ts` | Modify | +150 |
| `src/components/Common/QuickIngestModal.tsx` | Modify | +50 |
| `src/routes/option-content-review.tsx` | Create | ~30 |
| `src/routes/chrome.tsx` | Modify | +3 |
| `src/routes/firefox.tsx` | Modify | +3 |
| `src/components/ContentReview/*.tsx` | Create | ~800 |
| `src/components/Layouts/settings-nav.ts` | Modify | +5 |
| Locale files | Modify | +30 |
| **Total** | | **~1,650** |

### B. Existing Patterns Reference

| Pattern | Reference File |
|---------|----------------|
| Database CRUD | `src/db/dexie/processed.ts` |
| Zustand store | `src/store/quick-ingest.tsx` |
| Lazy route | `src/routes/chrome.tsx` |
| Content editor | `src/components/Media/ContentEditModal.tsx` |
| Sidebar layout | `src/components/Notes/NotesManagerPage.tsx` |
| Diff view | `src/components/Media/DiffViewModal.tsx` |
| Keyword tags | `src/components/Media/ContentViewer.tsx` |

### C. Related Documentation

- [WXT Framework Docs](https://wxt.dev/)
- [Dexie.js Docs](https://dexie.org/)
- [Zustand Docs](https://docs.pmnd.rs/zustand)
- [Ant Design Components](https://ant.design/components/overview)

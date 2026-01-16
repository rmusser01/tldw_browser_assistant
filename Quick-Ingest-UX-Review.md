# Quick-Ingest UX Review

## Executive Summary

The Quick-Ingest feature is a powerful batch content ingestion tool that allows users to add URLs and files, configure processing options, and send content to tldw_server. While functionally comprehensive, the current UX has opportunities to improve clarity, reduce friction, and increase user confidence.

---

## 1. Top 5 Issues (Severity + Why It Matters + Fix)

### Issue 1: Modal Cognitive Overload (High Severity)

**Problem:** The QuickIngestModal.tsx is ~4,000 lines with many options exposed at once:
- URL input + file upload
- Common options (analysis, chunking, overwrite)
- Type-specific options (audio language, diarization, OCR, captions)
- Storage mode toggle (local vs remote)
- Review mode toggle
- Advanced options (dynamically loaded from server schema)
- Inspector drawer

**Why it matters:** Users facing this modal for the first time see too much surface area. They may not understand what's required vs optional, leading to abandonment or confusion.

**Suggested Fix:**
- Implement progressive disclosure: show URL/file input prominently, collapse all options by default
- Add a "Quick Start" mode that uses smart defaults (already has presets, but they're not prominent)
- Consider a 2-step wizard: (1) Add content, (2) Configure & run
- Show type-specific options ONLY when relevant items are queued

---

### Issue 2: Unclear Entry Point & Purpose (Medium Severity)

**Problem:**
- "Quick Ingest" button label doesn't explain what ingestion means
- Multiple entry points (header button, context menu, keyboard shortcut) but no unified onboarding
- Users from the Knowledge page or Sidepanel may not understand the relationship between ingestion and RAG

**Why it matters:** Users need to know when to use this feature. "Ingest" is jargon that doesn't resonate with non-technical users.

**Suggested Fix:**
- Rename to "Add Content" or "Import Content" for broader appeal
- Add a subtitle/tooltip: "Import URLs, documents, and media to your knowledge base"
- First-time modal should show a 2-3 sentence intro banner (similar to Inspector intro)
- Context menu items ("Send to tldw_server") could be clearer: "Add to Knowledge Base"

---

### Issue 3: Weak First-Run Experience (Medium Severity)

**Problem:**
- Inspector intro exists but requires clicking "Open Inspector" first
- No modal-level onboarding explaining the workflow
- Default options (like OCR enabled) may surprise users
- "Review before storage" warning dialog only appears once, but users may not remember what it means later

**Why it matters:** First impressions determine adoption. Users who don't understand the flow may not trust the tool.

**Suggested Fix:**
- Add modal-level onboarding banner on first open (aligns with the RAG onboarding notes in this review)
- Show inline help icons with tooltips for each major section
- Pre-populate one example URL as a hint (e.g., "Try pasting a YouTube URL here")
- Consider a "Dry run" or "Preview" button that shows what will happen without executing

---

### Issue 4: Confusing Offline/Connection States (High Severity)

**Problem:** There are 5 connection states with overlapping UX:
- `online` - normal
- `offline` - server unreachable (items staged)
- `offlineBypass` - offline mode explicitly enabled
- `unconfigured` - no server URL/API key
- `unknown` - still checking

Each shows different messaging:
- "Ingest unavailable - server offline"
- "Ingest unavailable - offline mode enabled"
- "Ingest unavailable - server not configured"
- "Checking server connection..."

**Why it matters:** Users may not understand why they can't ingest, or what action to take. The "Check connection" vs "Disable offline mode" buttons add complexity.

**Suggested Fix:**
- Consolidate to 3 clear states: Ready, Not Connected, Configuring
- Show a single "Connection Status" indicator with a clickable link to fix
- When not connected, show a prominent inline callout: "Connect to your server to process content" with a single CTA
- Queue visualization should show "Will process when connected" clearly

---

### Issue 5: Results Panel Recovery UX (Medium Severity)

**Problem:**
- After ingestion, results show "OK" or "ERROR" tags per item
- Retry logic exists but is buried
- "Open in Media viewer" only works for stored items
- If review draft creation fails, error message appears but recovery path is unclear

**Why it matters:** Failed ingestions happen (network issues, invalid URLs, server errors). Users need clear paths to fix and retry.

**Suggested Fix:**
- Add "Retry Failed" as a prominent button when any items fail
- Show inline suggestions for common errors (e.g., "URL returned 404 - check the link")
- For partial success, celebrate what worked: "3 of 5 items added successfully"
- Add "Copy failed URLs" button for manual retry

---

## 2. Quick Wins (Low Effort / High Impact)

| Quick Win | Effort | Impact | Location |
|-----------|--------|--------|----------|
| **Improve placeholder text**: "Paste URLs, one per line (YouTube, articles, PDFs...)" | 5 min | High | `QuickIngestModal.tsx:urlInput` |
| **Add tooltip to storage toggle**: "Store on server for RAG search, or process locally for one-time use" | 5 min | Medium | `IngestOptionsPanel.tsx` |
| **Show queued count in modal title**: "Quick Ingest (3 items)" | 10 min | Medium | `QuickIngestModal.tsx` |
| **Add empty state with example**: "No items yet. Try pasting a URL or dropping a file here." | 15 min | High | Queue section |
| **Keyboard shortcut hint**: "Ctrl+V to paste URLs" shown in empty state | 5 min | Low | Queue section |
| **Progress ETA**: Show estimated time remaining based on average per-item time | 30 min | Medium | `IngestOptionsPanel.tsx` |
| **Success animation**: Brief confetti or checkmark animation on completion | 20 min | Low | Results panel |

---

## 3. Bigger Opportunities (Requires Design or Engineering)

### Opportunity A: Tab-Based Modal Architecture

**Current Problem:**
The modal presents everything at once: URL input, file upload, queued items, common options, type-specific options, storage mode, review mode, advanced options, and the Inspector drawer. This creates a wall of UI that overwhelms first-time users.

**Proposed Solution:**
Split the modal into 3 focused tabs:

```
+--------------------------------------------------+
| QUICK INGEST                                [X]  |
+--------------------------------------------------+
| [ Queue (3) ]  [ Options ]  [ Results ]          |
+--------------------------------------------------+
```

**Tab 1: Queue (Default View)**
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

**Tab 2: Options**
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

**Tab 3: Results (Appears during/after processing)**
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

**Implementation Details:**

1. **New Component Structure:**
```
src/components/Common/QuickIngest/
├── QuickIngestModal.tsx      # Main container with tab state (~200 lines)
├── QuickIngestTabs.tsx       # Tab navigation with badges (~60 lines)
├── QueueTab/
│   ├── QueueTab.tsx          # Container (~100 lines)
│   ├── UrlInput.tsx          # URL paste area (~80 lines)
│   ├── FileDropZone.tsx      # Drag-drop zone (~100 lines)
│   ├── QueuedItemsList.tsx   # Virtualized list (~120 lines)
│   └── QueuedItemRow.tsx     # (existing, move here)
├── OptionsTab/
│   ├── OptionsTab.tsx        # Container (~80 lines)
│   ├── PresetSelector.tsx    # Preset dropdown (~60 lines)
│   ├── StorageSection.tsx    # Storage + review mode (~100 lines)
│   └── TypeOptionsSection.tsx # Audio/Doc/Video (~150 lines)
├── ResultsTab/
│   ├── ResultsTab.tsx        # Container (~100 lines)
│   ├── ProgressBar.tsx       # Progress display (~60 lines)
│   └── ResultsList.tsx       # Results with actions (~150 lines)
└── hooks/
    ├── useQuickIngestQueue.ts   # Queue state management
    ├── useQuickIngestOptions.ts # Options state + persistence
    └── useQuickIngestRun.ts     # Processing execution
```

2. **Tab State Management:**
```typescript
type QuickIngestTab = 'queue' | 'options' | 'results'

const [activeTab, setActiveTab] = useState<QuickIngestTab>('queue')

// Auto-switch to results when processing starts
useEffect(() => {
  if (running) setActiveTab('results')
}, [running])
```

3. **Badge Counts:**
- Queue tab: Show count of queued items `[ Queue (3) ]`
- Options tab: Show indicator if non-default options `[ Options • ]`
- Results tab: Show during processing `[ Results ⟳ ]`

4. **Keyboard Navigation:**
- `1/2/3` switches tabs (when not in text input)
- `Escape` closes modal
- `Enter` in URL input adds URLs

**Estimated Effort:** 2-3 days refactoring

**Files to Modify:**
- Create new component structure above
- Update `QuickIngestModal.tsx` to import tabs
- Move existing code into appropriate tab components
- Update E2E tests for tab navigation

---

### Opportunity B: Drag-and-Drop Zone

**Current Problem:**
File upload is done via a hidden `<input type="file">` triggered by a button. Users can't drag files directly into the modal. This is especially limiting when users want to ingest multiple files from Finder/Explorer.

**Proposed Solution:**
Add a visible drop zone with clear visual feedback:

```
+--------------------------------------------------+
|                                                  |
|     ┌─────────────────────────────────────┐     |
|     │                                     │     |
|     │    📁 Drop files here               │     |
|     │    or click to browse               │     |
|     │                                     │     |
|     │    Supports: PDF, DOCX, MP3, MP4... │     |
|     │                                     │     |
|     └─────────────────────────────────────┘     |
|                                                  |
+--------------------------------------------------+

// On dragover:
+--------------------------------------------------+
|  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  |
|  ╎                                           ╎  |
|  ╎    ✨ Release to add files               ╎  |
|  ╎                                           ╎  |
|  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  |
+--------------------------------------------------+
```

**Implementation Details:**

1. **Use react-dropzone:**
```typescript
import { useDropzone } from 'react-dropzone'

const FileDropZone: React.FC<{ onFilesAdded: (files: File[]) => void }> = ({ onFilesAdded }) => {
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop: onFilesAdded,
    accept: {
      'application/pdf': ['.pdf'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.flac'],
      'video/*': ['.mp4', '.webm', '.mov'],
      'application/msword': ['.doc', '.docx'],
      'text/*': ['.txt', '.md']
    },
    maxSize: 500 * 1024 * 1024 // 500MB
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
        isDragActive && 'border-primary bg-primary/5',
        isDragReject && 'border-red-500 bg-red-50'
      )}
    >
      <input {...getInputProps()} data-testid="qi-file-input" />
      {isDragActive ? (
        <p>Release to add files</p>
      ) : (
        <>
          <FileIcon className="w-8 h-8 mx-auto mb-2 text-text-muted" />
          <p>Drop files here or click to browse</p>
          <p className="text-xs text-text-muted mt-1">
            Supports: PDF, DOCX, MP3, MP4, and more
          </p>
        </>
      )}
    </div>
  )
}
```

2. **Visual States:**
- Default: Dashed border, muted colors
- Drag over (valid): Primary color border, light background
- Drag over (invalid): Red border, rejection message
- Processing: Disabled appearance

3. **Accessibility:**
- Keyboard accessible via click
- Screen reader: "File upload zone. Drag and drop files here or press Enter to browse."
- Focus ring on tab navigation

**Estimated Effort:** 0.5 days

**Files to Modify:**
- Add `react-dropzone` to package.json
- Create `src/components/Common/QuickIngest/FileDropZone.tsx`
- Integrate into QueueTab or existing modal

---

### Opportunity C: Batch Templates / Presets

**Current Problem:**
Users must understand and configure multiple options:
- Perform analysis (on/off)
- Perform chunking (on/off)
- Overwrite existing (on/off)
- Storage mode (local/remote)
- Review before storage (on/off)
- Type-specific: audio language, diarization, OCR, captions

New users don't know which combinations are appropriate for their use case.

**Proposed Solution:**
Offer 3-4 named presets that configure everything at once:

```
+--------------------------------------------------+
| Preset: [▼ Standard                            ] |
|         ┌────────────────────────────────────┐   |
|         │ ⚡ Quick                            │   |
|         │    Process fast, no analysis       │   |
|         │ ────────────────────────────────── │   |
|         │ ★ Standard (Recommended)           │   |
|         │    Analyze + chunk, store on server│   |
|         │ ────────────────────────────────── │   |
|         │ 🔬 Deep                             │   |
|         │    All options, review before save │   |
|         │ ────────────────────────────────── │   |
|         │ ⚙️ Custom                           │   |
|         │    Configure manually              │   |
|         └────────────────────────────────────┘   |
+--------------------------------------------------+
```

**Preset Definitions:**

| Option | Quick | Standard | Deep |
|--------|-------|----------|------|
| perform_analysis | ❌ | ✅ | ✅ |
| perform_chunking | ❌ | ✅ | ✅ |
| overwrite_existing | ❌ | ❌ | ✅ |
| storeRemote | ✅ | ✅ | ✅ |
| reviewBeforeStorage | ❌ | ❌ | ✅ |
| audio.diarize | ❌ | ❌ | ✅ |
| document.ocr | ❌ | ✅ | ✅ |
| video.captions | ❌ | ✅ | ✅ |

**Implementation Details:**

1. **Preset Type Definition:**
```typescript
type IngestPreset = 'quick' | 'standard' | 'deep' | 'custom'

interface PresetConfig {
  common: {
    perform_analysis: boolean
    perform_chunking: boolean
    overwrite_existing: boolean
  }
  storeRemote: boolean
  reviewBeforeStorage: boolean
  typeDefaults: TypeDefaults
}

const PRESETS: Record<Exclude<IngestPreset, 'custom'>, PresetConfig> = {
  quick: {
    common: { perform_analysis: false, perform_chunking: false, overwrite_existing: false },
    storeRemote: true,
    reviewBeforeStorage: false,
    typeDefaults: { document: { ocr: false }, audio: { diarize: false }, video: { captions: false } }
  },
  standard: {
    common: { perform_analysis: true, perform_chunking: true, overwrite_existing: false },
    storeRemote: true,
    reviewBeforeStorage: false,
    typeDefaults: { document: { ocr: true }, audio: { diarize: false }, video: { captions: true } }
  },
  deep: {
    common: { perform_analysis: true, perform_chunking: true, overwrite_existing: true },
    storeRemote: true,
    reviewBeforeStorage: true,
    typeDefaults: { document: { ocr: true }, audio: { diarize: true }, video: { captions: true } }
  }
}
```

2. **Auto-Switch to Custom:**
When user changes any individual option, preset auto-switches to "Custom":
```typescript
useEffect(() => {
  if (activePreset !== 'custom' && !matchesPreset(currentConfig, activePreset)) {
    setActivePreset('custom')
  }
}, [currentConfig])
```

3. **Persistence:**
Save last-used preset to storage: `quickIngestPreset: 'standard'`

**Estimated Effort:** 1 day

**Files to Modify:**
- Create `src/components/Common/QuickIngest/PresetSelector.tsx`
- Add preset types to `src/components/Common/QuickIngest/types.ts`
- Update `IngestOptionsPanel.tsx` to use presets
- Add i18n keys for preset labels and descriptions

---

### Opportunity D: Type Preview Before Ingest

**Current Problem:**
When users paste a URL, they see only the raw URL string and a detected type tag (HTML, VIDEO, etc.). They don't know:
- Is the URL valid and reachable?
- What's the actual content title?
- Is it the right content?
- Will it fail due to auth/paywall?

**Proposed Solution:**
Fetch lightweight metadata for each URL after it's added:

```
+--------------------------------------------------+
| QUEUED ITEMS (3)                                 |
| +----------------------------------------------+ |
| | 🎬 Machine Learning Fundamentals             | |
| |    youtube.com • 12:34 • 1.2M views         | |
| |    [VIDEO]                              [x] | |
| +----------------------------------------------+ |
| | 📄 Research Paper on Neural Networks         | |
| |    arxiv.org • PDF • 2.4 MB                 | |
| |    [PDF]                                [x] | |
| +----------------------------------------------+ |
| | ⚠️ https://example.com/private-doc           | |
| |    401 Unauthorized - May require login     | |
| |    [HTML]                               [x] | |
| +----------------------------------------------+ |
+--------------------------------------------------+
```

**Implementation Details:**

1. **Metadata Fetch Hook:**
```typescript
type UrlMetadata = {
  status: 'loading' | 'success' | 'error'
  title?: string
  description?: string
  favicon?: string
  contentType?: string
  contentLength?: number
  duration?: string // For videos
  errorCode?: number
  errorMessage?: string
}

const useUrlMetadata = (url: string): UrlMetadata => {
  const [metadata, setMetadata] = useState<UrlMetadata>({ status: 'loading' })

  useEffect(() => {
    if (!url) return

    const controller = new AbortController()

    fetchMetadata(url, controller.signal)
      .then(setMetadata)
      .catch(err => {
        if (err.name !== 'AbortError') {
          setMetadata({ status: 'error', errorMessage: err.message })
        }
      })

    return () => controller.abort()
  }, [url])

  return metadata
}
```

2. **Backend Endpoint (or Browser Fetch):**
Option A: Add `/api/v1/media/preview` endpoint to tldw_server
Option B: Use browser fetch with HEAD request + oEmbed for YouTube

3. **YouTube-Specific Preview:**
Use YouTube oEmbed API (no auth required):
```typescript
const getYouTubeMetadata = async (videoId: string) => {
  const resp = await fetch(`https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`)
  const data = await resp.json()
  return {
    title: data.title,
    author: data.author_name,
    thumbnail: data.thumbnail_url
  }
}
```

4. **Error Detection:**
- 401/403: "May require login"
- 404: "Page not found"
- Timeout: "Server not responding"
- Content-Type mismatch: "Detected as audio but expected video"

**Estimated Effort:** 2 days

**Files to Modify:**
- Create `src/hooks/useUrlMetadata.ts`
- Create `src/services/url-preview.ts`
- Update `QueuedItemRow.tsx` to display metadata
- Add loading skeleton while fetching

---

### Opportunity E: Onboarding Tour

**Current Problem:**
First-time users see a complex modal with no guidance. The Inspector intro helps but requires clicking "Open Inspector" first. There's no walkthrough of the main workflow.

**Proposed Solution:**
Use a step-by-step tour that highlights each section:

```
Step 1 of 4:
+--------------------------------------------------+
|  ┌─────────────────────────────────────────────┐ |
|  │ 👋 Welcome to Quick Ingest!                 │ |
|  │                                             │ |
|  │ Paste URLs or drop files here to add       │ |
|  │ content to your knowledge base.            │ |
|  │                                             │ |
|  │               [1] [2] [3] [4]    [Next →]  │ |
|  └─────────────────────────────────────────────┘ |
|                        ▼                         |
| ╔══════════════════════════════════════════════╗ |
| ║ [Paste URLs here, one per line...]           ║ |
| ║ [Drop files here or click to browse]         ║ |
| ╚══════════════════════════════════════════════╝ |
+--------------------------------------------------+
```

**Tour Steps:**

| Step | Target Element | Content |
|------|----------------|---------|
| 1 | URL input / drop zone | "Paste URLs or drop files here to add content to your knowledge base." |
| 2 | Storage toggle | "Choose to process locally (one-time) or store on your server for RAG search." |
| 3 | Options section | "Configure processing options. Start with 'Standard' preset for most use cases." |
| 4 | Process button | "Click here to start ingestion. You'll see progress and results here." |

**Implementation Details:**

1. **Use react-joyride:**
```typescript
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride'

const TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="queue-input"]',
    content: 'Paste URLs or drop files here to add content to your knowledge base.',
    placement: 'bottom',
    disableBeacon: true
  },
  {
    target: '[data-tour="storage-toggle"]',
    content: 'Choose to process locally (one-time) or store on your server for RAG search.',
    placement: 'right'
  },
  {
    target: '[data-tour="options-section"]',
    content: "Configure processing options. Start with 'Standard' preset for most use cases.",
    placement: 'left'
  },
  {
    target: '[data-tour="process-button"]',
    content: "Click here to start ingestion. You'll see progress and results here.",
    placement: 'top'
  }
]
```

2. **Tour State Management:**
```typescript
const [showTour, setShowTour] = useStorage<boolean>('quickIngestTourSeen', false)
const [runTour, setRunTour] = useState(false)

// Auto-start tour on first modal open
useEffect(() => {
  if (open && !showTour) {
    setRunTour(true)
  }
}, [open, showTour])

const handleTourCallback = (data: CallBackProps) => {
  if ([STATUS.FINISHED, STATUS.SKIPPED].includes(data.status)) {
    setShowTour(true)
    setRunTour(false)
  }
}
```

3. **Styling:**
Use extension's color variables for tour tooltip:
```typescript
const tourStyles = {
  options: {
    primaryColor: 'var(--color-primary)',
    textColor: 'var(--color-text)',
    backgroundColor: 'var(--color-bg-elevated)',
    arrowColor: 'var(--color-bg-elevated)'
  }
}
```

4. **Reset Tour Option:**
Add to Settings page: "Reset Quick Ingest tour" button

5. **Accessibility:**
- Tour should be keyboard navigable (react-joyride supports this)
- Add skip button for users who want to dismiss
- Announce steps to screen readers

**Estimated Effort:** 1 day

**Files to Modify:**
- Add `react-joyride` to package.json
- Create `src/components/Common/QuickIngest/OnboardingTour.tsx`
- Add `data-tour` attributes to target elements
- Add tour reset to Settings page
- Add i18n keys for tour content

---

## 4. Open Questions / Assumptions

| Question | Assumption | Impact if Wrong |
|----------|------------|-----------------|
| Do users understand "ingest" terminology? | Assumed no - proposed rename to "Add Content" | May confuse existing users if renamed |
| Is offline queuing a common use case? | Assumed rare - suggested simplifying states | Power users may rely on offline queueing |
| Are type-specific options (diarize, OCR) frequently changed? | Assumed rarely - suggested hiding by default | Users may miss important options |
| Is the Inspector drawer valuable or confusing? | Assumed valuable for debugging | Could be removed if low usage |
| Should Review mode be the default? | Assumed no - local drafts add complexity | Some users may prefer review-first workflow |

---

## 5. Accessibility Audit Notes

### Good Practices Already Present:
- ARIA labels on buttons and inputs
- Keyboard-accessible form controls
- Focus management in modal

### Areas for Improvement:

| Issue | Fix |
|-------|-----|
| No live region for progress updates | Add `aria-live="polite"` div announcing "Processing 3 of 5..." |
| Inspector intro dismissal focus | Return focus to trigger button after dismissing intro |
| Type icons lack alt text | Add `aria-label` to Lucide icons (e.g., "Audio file", "Document") |
| Tab order in advanced options | Ensure collapsed sections are skipped in tab order |
| Color contrast on status tags | Verify green/red tags meet WCAG AA (4.5:1) |

---

## 6. Consistency Check vs Rest of Extension

| Pattern | Quick Ingest | Rest of Extension | Action |
|---------|--------------|-------------------|--------|
| Modal size | Large (covers most of screen) | Medium modals for settings | Consider drawer or split-view for consistency |
| Button style | Mix of "primary" and "default" | Consistent primary for main CTA | Audit button hierarchy |
| Progress display | Percentage + elapsed time | Spinner or skeleton | Align with common pattern or enhance elsewhere |
| Error display | Toast + inline | Mostly toasts | Good - inline is clearer for multi-item flows |

---

## 7. Files to Modify for Improvements

| File | Changes |
|------|---------|
| `src/components/Common/QuickIngestModal.tsx` | Add onboarding banner, improve empty state, refactor to tabs |
| `src/components/Common/QuickIngest/IngestOptionsPanel.tsx` | Add tooltips, hide type options when not relevant |
| `src/components/Common/QuickIngest/ResultsPanel.tsx` | Add "Retry Failed" button, improve error messaging |
| `src/components/Common/QuickIngestInspectorDrawer.tsx` | Improve intro content, add inline help |
| `src/components/Layouts/QuickIngestButton.tsx` | Rename label, add tooltip |
| `src/assets/locale/en/*.json` | Update microcopy for clarity |

---

## Recommended Priority

1. **Immediate** (Next sprint):
   - Improve placeholder text and empty states (Quick Wins)
   - Add connection state simplification
   - Add "Retry Failed" button in results

2. **Short-term** (Next month):
   - Implement tab-based modal architecture
   - Add first-run onboarding banner
   - Improve type-specific option visibility

3. **Medium-term** (Backlog):
   - Drag-and-drop zone
   - Batch templates/presets
   - Type preview before ingest

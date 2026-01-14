# PRD: Quick Ingest UX Improvements

## Summary
Improve the Quick Ingest experience to reduce cognitive overload, clarify purpose, simplify connection states, and improve recovery and first-run confidence. This PRD defines baseline UX improvements and references separate PRDs for larger opportunities.

## Goals
- Reduce time to first successful ingestion.
- Increase completion rate for first-time users.
- Reduce confusion around offline and connection states.
- Improve recovery paths for failed items.
- Keep Quick Ingest fast for power users.

## Non-goals
- Changing ingestion backend behavior or server APIs (except when required by Opportunity D).
- Redesigning unrelated extension surfaces.
- New model providers or storage backends.
- New user telemetry or analytics for Quick Ingest.

## Users and Jobs
- New users who need to add URLs or files without understanding "ingest".
- Power users who batch large queues.
- Users with intermittent network conditions.

## Success Metrics
- Increase successful ingestion completion rate.
- Decrease modal abandonment rate.
- Decrease time to first successful ingestion.
- Reduce retries caused by unclear errors.

## Measurement Approach (No Telemetry)
- Validate success metrics via structured usability testing and QA checklists.
- Track completion rate, time-to-first-ingest, and recovery success in manual test runs.

## Top 5 Issues (from UX Review)

### Issue 1: Modal Cognitive Overload (High Severity)
**Problem:** The modal exposes too many options at once:
- URL input + file upload
- Common options (analysis, chunking, overwrite)
- Type-specific options (audio language, diarization, OCR, captions)
- Storage mode toggle (local vs remote)
- Review mode toggle
- Advanced options (dynamically loaded from server schema)
- Inspector drawer

**Why it matters:** Users facing this modal for the first time see too much surface area. They may not understand what's required vs optional, leading to abandonment or confusion.

**Addressed in:** Information Architecture and Clarity requirements

---

### Issue 2: Unclear Entry Point & Purpose (Medium Severity)
**Problem:**
- "Quick Ingest" button label doesn't explain what ingestion means
- Multiple entry points (header button, context menu, keyboard shortcut) but no unified onboarding
- Users from the Knowledge page or Sidepanel may not understand the relationship between ingestion and RAG

**Why it matters:** Users need to know when to use this feature. "Ingest" is jargon that doesn't resonate with non-technical users.

**Addressed in:** Entry Point and Copy requirements

---

### Issue 3: Weak First-Run Experience (Medium Severity)
**Problem:**
- Inspector intro exists but requires clicking "Open Inspector" first
- No modal-level onboarding explaining the workflow
- Default options (like OCR enabled) may surprise users
- "Review before storage" warning dialog only appears once, but users may not remember what it means later

**Why it matters:** First impressions determine adoption. Users who don't understand the flow may not trust the tool.

**Addressed in:** First-run Guidance requirements

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

**Addressed in:** Connection States requirements

---

### Issue 5: Results Panel Recovery UX (Medium Severity)
**Problem:**
- After ingestion, results show "OK" or "ERROR" tags per item
- Retry logic exists but is buried
- "Open in Media viewer" only works for stored items
- If review draft creation fails, error message appears but recovery path is unclear

**Why it matters:** Failed ingestions happen (network issues, invalid URLs, server errors). Users need clear paths to fix and retry.

**Addressed in:** Results and Recovery requirements

## Scope (Phased)
Immediate (next sprint):
- Improve empty states and placeholders.
- Add queue count in modal title.
- Add tooltips to storage mode and other key toggles.
- Add "Retry Failed" and better result summaries.

Short-term (next month):
- Simplify connection states and CTA.
- Add first-run onboarding banner and inline help.
- Keep type-specific options accessible; collapse or disable when not relevant.

Medium-term (backlog):
- Opportunity A: Tabbed modal architecture.
- Opportunity B: Drag-and-drop zone.
- Opportunity C: Presets.
- Opportunity D: URL preview.
- Opportunity E: Onboarding tour.

## Related PRDs
- `Quick-Ingest-Opportunity-A-Tabbed-Modal-PRD.md`
- `Quick-Ingest-Opportunity-B-Drag-Drop-PRD.md`
- `Quick-Ingest-Opportunity-C-Presets-PRD.md`
- `Quick-Ingest-Opportunity-D-Url-Preview-PRD.md`
- `Quick-Ingest-Opportunity-E-Onboarding-Tour-PRD.md`

## Requirements

### Information Architecture and Clarity (Issue 1)
- Default view emphasizes "add content" (URLs and files) and queued items.
- Optional sections are collapsed by default.
- Type-specific options remain reachable even with an empty queue; when no relevant items are queued, keep them collapsed or disabled with helper text rather than hiding.
- Required vs optional actions are visually distinct.
- Show queue count in the modal title.

### Entry Point and Copy (Issue 2)
- Replace or clarify "Quick Ingest" label with a user-friendly phrase.
- Add tooltip or subtitle: "Import URLs, documents, and media to your knowledge base."
- Context menu copy aligns with "Add to Knowledge Base" wording.

### First-run Guidance (Issue 3)
- Show a first-open banner describing the workflow.
- Add inline help for key controls (storage mode, review mode).
- Provide example URL in empty state or placeholder.
- Clarify what "Review before storage" means after the first prompt.

### Connection States (Issue 4)
- Consolidate into three states: Ready, Not Connected, Configuring.
- Use a single prominent call-to-action to resolve connectivity issues.
- Deprecate offline queueing and remove the offline mode toggle; when not connected, disable processing and explain that ingestion requires a connection.
- Copy should explicitly state that processing is disabled until a connection is restored.
- When Not Connected, disable URL/file inputs and prevent adding items to the queue.
- If a connection drops mid-session, keep existing queued items visible but disable adding or processing until reconnected.
- CTA routes to server configuration and connection checks (single entry point).

### Results and Recovery (Issue 5)
- Provide "Retry Failed" action when any item fails.
- Provide "Requeue Failed" to place failed items back into the queue with previous settings.
- Provide "Export Failed List" for both URLs and files (URL list + filenames) for manual retry.
- Summarize results (for example, "3 of 5 items added").
- Provide a way to copy failed URLs for manual retry.
- Ensure "Open in Media" is enabled only for stored items.

### Accessibility
- Add aria-live updates for progress.
- Ensure icon-only controls have labels.
- Keep collapsed sections out of the tab order.
- Verify contrast for status tags and focus states.

### Internationalization
- All new copy is added to `src/assets/locale/*` and synced to `_locales`.

## Out of Scope
- Full redesign of the inspector drawer.
- New ingestion backends or file type support beyond existing capabilities.

## Dependencies
- Any component refactor should avoid regressions in queue handling and options persistence.
- URL preview may require server support or new permissions.

## Decisions
- Offline queueing is deprecated; do not promise queued processing while disconnected.
- Type-specific options must remain reachable before items are queued.
- No new user telemetry is in scope for this PRD.
- When Not Connected, users cannot add items; queueing requires a connection.

## Open Questions
- Should "Quick Ingest" be renamed across the product?
- Should review mode be default for any preset?

## Acceptance Criteria
- A first-time user can add a URL and start processing without expanding options.
- Connection state messaging is singular and includes a clear next action.
- Failed items have an obvious retry path.
- New copy is localized and accessible.

## Test Plan
- Update or add E2E coverage for Quick Ingest open, add URL, and run.
- Manual checks for Ready/Not Connected/Configuring state transitions and CTAs.
- Manual checks that inputs are disabled and queueing is blocked when Not Connected.
- Verify retry, requeue, and export failed list flows for URLs and files.
- Accessibility spot checks for labels and progress updates.
- i18n sync verification for new copy.

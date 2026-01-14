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

## Current Pain Points
- Modal exposes too many options at once and hides the required path.
- Entry points use jargon; relationship to the knowledge base is unclear.
- First-run experience lacks guidance and safe defaults are not explained.
- Connection states are fragmented with unclear actions.
- Results recovery is unclear when items fail.

## Scope (Phased)
Immediate (next sprint):
- Improve empty states and placeholders.
- Add queue count in modal title.
- Add tooltips to storage mode and other key toggles.
- Add "Retry Failed" and better result summaries.

Short-term (next month):
- Simplify connection states and CTA.
- Add first-run onboarding banner and inline help.
- Hide type-specific options until relevant.

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

### Information Architecture and Clarity
- Default view emphasizes "add content" (URLs and files) and queued items.
- Optional sections are collapsed by default.
- Type-specific options remain reachable even with an empty queue; when no relevant items are queued, keep them collapsed or disabled with helper text rather than hiding.
- Required vs optional actions are visually distinct.
- Show queue count in the modal title.

### Entry Point and Copy
- Replace or clarify "Quick Ingest" label with a user-friendly phrase.
- Add tooltip or subtitle: "Import URLs, documents, and media to your knowledge base."
- Context menu copy aligns with "Add to Knowledge Base" wording.

### First-run Guidance
- Show a first-open banner describing the workflow.
- Add inline help for key controls (storage mode, review mode).
- Provide example URL in empty state or placeholder.
- Clarify what "Review before storage" means after the first prompt.

### Connection States
- Consolidate into three states: Ready, Not Connected, Configuring.
- Use a single prominent call-to-action to resolve connectivity issues.
- Deprecate offline queueing and remove the offline mode toggle; when not connected, disable processing and explain that ingestion requires a connection.
- Copy should explicitly state that processing is disabled until a connection is restored.

### Results and Recovery
- Provide "Retry Failed" action when any item fails.
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
- Manual checks for offline and unconfigured states.
- Accessibility spot checks for labels and progress updates.

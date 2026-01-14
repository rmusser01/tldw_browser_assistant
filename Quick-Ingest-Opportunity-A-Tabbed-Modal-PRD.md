# PRD: Quick Ingest Tabbed Modal

## Summary
Split Quick Ingest into Queue, Options, and Results tabs to reduce cognitive load and improve maintainability without changing ingestion behavior.

## Goals
- Make the primary "add content" flow obvious and focused.
- Reduce scroll and option overload.
- Improve code maintainability by splitting the large modal.

## Non-goals
- Changing ingestion logic or defaults.
- Introducing new features beyond tab navigation and layout.

## Users and Jobs
- New users who want a simple place to start.
- Power users who need quick access to results.

## Scope
- New tab navigation with badges.
- Queue tab for URL and file input and queued item list.
- Options tab for presets and advanced options.
- Results tab for progress and recovery actions.
- Auto-switch to Results when processing starts.

## Requirements
- Default tab is Queue.
- Tab badges:
  - Queue shows queued item count.
  - Options shows a non-default indicator when options diverge.
  - Results shows an in-progress indicator while running.
- Keyboard navigation between tabs (1/2/3 and standard tablist keys).
- Process button is available from Queue and Results views.
- Results remain accessible after completion.
- Inspector access remains available from Queue.
- Preserve existing queue and options state across tabs.

## Implementation Notes
- Split `QuickIngestModal.tsx` into small tab components.
- Co-locate queue, options, and results components under a Quick Ingest folder.
- Keep existing hooks and state stores; only rewire UI composition.

## Accessibility
- Use proper tablist semantics and focus management.
- Ensure tab content is reachable without mouse.

## Dependencies
- Update Quick Ingest E2E tests to reflect tab navigation.
- Align options UI with Opportunity C (Presets) if implemented together.

## Risks
- Refactor could introduce regressions in queue or options wiring.
- Important actions may be hidden if tab layout is not clear.

## Acceptance Criteria
- Users can add items, configure options, and view results without scrolling a single long panel.
- No functionality is removed from the existing modal.
- Processing auto-switches to Results.

## Test Plan
- E2E: open modal, add URL, switch tabs, run ingest, verify results tab.
- Component tests for tab state and badge rendering.

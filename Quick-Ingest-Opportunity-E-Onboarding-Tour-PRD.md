# PRD: Quick Ingest Onboarding Tour

## Summary
Provide a short, step-by-step onboarding tour for first-time Quick Ingest users to explain the workflow and key controls.

## Goals
- Reduce first-run confusion.
- Improve understanding of storage mode, options, and process flow.
- Increase first-time completion rate.

## Non-goals
- Full product tour across the extension.
- Long multi-session education flows.

## Users and Jobs
- First-time users opening Quick Ingest.
- Users returning after a long gap.

## Scope
- Four-step tour that highlights queue input, storage mode, options, and process button.
- Tour runs only on first open and can be skipped.
- Option to reset the tour from Settings.

## Requirements
- Tour starts on first modal open and remembers completion.
- Skip and close actions persist and stop future auto-runs.
- Tour steps fail gracefully if a target element is missing.
- Copy is localized via i18n.
- Tour does not block primary actions if the user dismisses it.

## Accessibility
- Keyboard navigation for all tour controls.
- Screen reader announcements for step content.

## Dependencies
- Decide on a library (for example react-joyride) or a small in-house tour.
- Add data attributes for tour targets.

## Risks
- Tour overlays can feel intrusive on small screens.
- Element repositioning can break tour targets if not stable.

## Acceptance Criteria
- First-time user sees the tour and can complete or skip it.
- Tour does not repeat after completion unless reset in settings.
- All steps align with visible elements.

## Test Plan
- Manual: first-run flow, skip flow, reset flow.
- E2E: ensure tour does not block ingestion actions when dismissed.

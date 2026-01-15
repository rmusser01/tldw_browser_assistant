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
- Persist tour state in extension storage (browser.storage.local via WXT/useStorage), including completed, dismissed/skipped, and last seen step.
- Skip and close actions persist and stop future auto-runs.
- Tour steps fail gracefully if a target element is missing.
- Copy is localized via i18n.
- Tour does not block primary actions if the user dismisses it.
- Log tour analytics events: started, step_viewed, completed, skipped, dismissed.
- Tour target selectors must include data attributes and a11y wiring:
  - Each target includes a stable data attribute (e.g., data-tour="queue-input").
  - Targets expose accessible names/roles (aria-label or labeled controls).
  - Tour implementation moves focus to the target (or a focusable wrapper) on each step and restores focus on close.
  - Tooltip content is announced via aria-describedby or equivalent.

## Analytics
- Track first-time completion rate over time (completed / started).
- Track step-level drop-off (step_viewed without completion).
- Track skip vs dismiss rates.

## Accessibility
- Keyboard navigation for all tour controls.
- Screen reader announcements for step content.

## Dependencies
- Short evaluation required before selecting a tour library. Compare options like react-aria-tour, shepherd.js, and a small in-house tour for:
  - React 19 compatibility
  - Accessibility support (focus management, keyboard navigation, ARIA roles)
  - Maintenance activity (recent releases, open issues)
  - Bundle size / CSS footprint
  - Extension environment compatibility
- If react-joyride is chosen, complete this checklist:
  - Verify React 19 compatibility in the extension build.
  - Run keyboard and screen reader tests for each tour step.
  - Document known a11y gaps and add a mitigation plan (fallbacks or constraints).
- Add data attributes for tour targets and ensure ARIA roles + focus behavior meet the requirements above.

## Library Evaluation (Short)
- Document a one-paragraph summary of the chosen approach and why it meets the a11y + React 19 requirements.

## Risks
- Tour overlays can feel intrusive on small screens.
- Element repositioning can break tour targets if not stable.
- A tour library with weak a11y or React 19 support could block rollout.

## Acceptance Criteria
- First-time user sees the tour and can complete or skip it.
- Tour does not repeat after completion unless reset in settings.
- All steps align with visible elements.
- Focus moves to the active tour target and is restored on dismiss/complete.

## Test Plan
- Manual:
  - First-run with all targets visible.
  - First-run with one or more targets missing (graceful failure).
  - Skip at first step vs skip mid-tour.
  - Complete full tour.
  - Reset from settings, then re-run.
  - Small screen/mobile behavior.
  - Interact with target elements during tour (e.g., click Process while highlighted).
- E2E:
  - Tour state persists across sessions.
  - Tour does not re-trigger after completion.
  - Reset flag clears completion state.
  - Keyboard navigation through all steps.
  - Screen reader announcements (if automated a11y testing is available).

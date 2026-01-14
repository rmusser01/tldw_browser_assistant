# PRD: Quick Ingest Drag and Drop Zone

## Summary
Add a visible drag-and-drop zone for files to make batch ingestion faster and more discoverable.

## Goals
- Make file ingestion obvious without searching for a file picker.
- Enable fast multi-file ingestion from the desktop.
- Keep accessibility on par with the existing file input.

## Non-goals
- New file types beyond current support.
- Changes to backend ingestion behavior.

## Users and Jobs
- Users who ingest multiple local files at once.
- Users who expect drag-and-drop as a standard pattern.

## Scope
- Visible drop zone in the Queue view.
- Drag-over visual feedback and rejection state.
- Fallback to click-to-browse file picker.
- Clear list of supported file types and size limit.

## Requirements
- Drop zone accepts the same file types as current ingestion.
- Enforce size limits and show a clear error for oversized or rejected files.
- Disabled appearance while processing if uploads are blocked.
- Do not interfere with URL paste or other inputs in the modal.
- A dropped file is added to the queue exactly once.

## Accessibility
- Drop zone is keyboard-accessible and announces instructions.
- Focus styles match existing controls.

## Dependencies
- Decide between a small internal drop handler or a dependency like react-dropzone.
- If a dependency is added, ensure bundle size impact is acceptable.

## Risks
- Drag events can be inconsistent across browsers and OSs.
- Rejected file messages could be noisy if multiple files fail.

## Acceptance Criteria
- Users can drag multiple files into the modal and see them queued.
- Rejected files display a clear reason.
- File picker remains available for keyboard-only users.

## Test Plan
- Manual: drag valid and invalid files, ensure correct messaging.
- E2E: add files via file picker and verify queue.

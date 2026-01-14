# PRD: Quick Ingest URL Preview

## Summary
Fetch lightweight metadata for queued URLs to show title, type, and error status before ingestion.

## Goals
- Increase user confidence that the right content will be ingested.
- Surface early errors (401, 404, timeouts) before running.
- Reduce failed ingestions due to invalid or inaccessible URLs.

## Non-goals
- Full content scraping or authenticated access handling.
- Bypassing paywalls or login requirements.
- Heavyweight metadata extraction that slows the modal.

## Users and Jobs
- Users who paste multiple URLs and need to verify them quickly.
- Users who ingest from sources with frequent access errors.

## Scope
- Metadata fetch for each queued URL.
- Display title, source host, content type, and size when available.
- Show error messages for common failures.
- Non-blocking behavior (user can run ingestion even if preview fails).

## Requirements
- Fetch metadata after a URL is queued.
- Show loading, success, and error states per item.
- Time out requests and allow cancellation on item removal.
- Cache results per URL for the current modal session.
- Limit concurrency to avoid flooding the network.
- Do not attach auth headers or sensitive tokens to preview requests.

## Error Handling
- 401 or 403: show "May require login" warning.
- 404: show "Page not found" warning.
- Timeout or network error: show "Not reachable" warning.
- Mismatch between detected type and expected type is surfaced.

## Implementation Options
- Server endpoint for URL preview.
- Client-side HEAD or lightweight fetch when permissions allow.
- Optional YouTube oEmbed for video previews.

## Dependencies
- May require server support or additional host permissions.
- i18n for preview labels and error strings.

## Risks
- CORS and permission limitations may block client-side previews.
- Preview requests could reveal URLs to servers; privacy messaging may be needed.

## Acceptance Criteria
- Users see a title or clear error state for most URLs within a few seconds.
- Preview failures do not block ingestion.
- Removing an item cancels any in-flight preview request.

## Test Plan
- Unit: metadata parser and error mapping.
- Manual: add URLs for success, 401, 404, and timeout cases.
- E2E: verify preview state updates do not break ingestion flow.

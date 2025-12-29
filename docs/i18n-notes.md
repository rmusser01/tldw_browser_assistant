# i18n Notes

## Review Copy Duplication (Option vs Content Review)

Some review-related strings are intentionally duplicated in `src/assets/locale/<lang>/option.json`:
- `option.storage.*` (e.g., `storeAfterReview`, `reviewBeforeStorage`, `reviewWarningTitle`)
- `option.contentReview.*` (same wording used in the Content Review workspace)

If the UI should keep the same wording across both contexts, update both blocks together so they stay in sync.

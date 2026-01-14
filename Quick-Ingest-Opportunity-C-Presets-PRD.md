# PRD: Quick Ingest Presets

## Summary
Add named presets that configure all Quick Ingest options to reduce decision fatigue and enable consistent outcomes.

## Goals
- Provide sensible defaults for common use cases.
- Reduce time spent configuring options for new users.
- Allow power users to quickly switch between profiles.

## Non-goals
- User-defined presets (future consideration).
- Backend changes to ingestion behavior.

## Users and Jobs
- New users who want guidance on recommended settings.
- Power users who switch between fast and deep processing.

## Scope
- Preset selector with descriptions.
- Four presets: Quick, Standard (default), Deep, Custom.
- Presets cover common, storage, and type-specific options.
- Persist last-used preset.

## Preset Definitions

| Option | Quick | Standard | Deep |
|--------|-------|----------|------|
| perform_analysis | false | true | true |
| perform_chunking | false | true | true |
| overwrite_existing | false | false | true |
| storeRemote | true | true | true |
| reviewBeforeStorage | false | false | true |
| audio.diarize | false | false | true |
| document.ocr | false | true | true |
| video.captions | false | true | true |

## Requirements
- Selecting a preset applies all related option values.
- If any option is manually changed, preset switches to Custom.
- Preset selection and labels are internationalized.
- Preset state is persisted and restored on next open.
- Preset UI is visible in the Options view (or current options panel).

## Accessibility
- Preset selector is keyboard accessible and labeled.
- Descriptions are readable by screen readers.

## Dependencies
- Should align with Opportunity A tabbed layout if implemented together.
- Requires i18n updates for preset names and descriptions.

## Risks
- Users may not understand what each preset changes without a description.
- Preset changes could overwrite carefully tuned custom settings.

## Acceptance Criteria
- Users can select a preset and see options update instantly.
- Manual changes switch the preset to Custom.
- Last-used preset is restored on next open.

## Test Plan
- Unit: preset matching and custom detection.
- E2E: select preset, confirm option changes, reopen modal and verify persistence.

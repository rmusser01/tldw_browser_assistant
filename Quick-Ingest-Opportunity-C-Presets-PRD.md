# PRD: Quick Ingest Presets

## Summary
Add named presets that configure all Quick Ingest options to reduce decision fatigue and enable consistent outcomes.

## Goals
- Provide sensible defaults for common use cases.
- Reduce time spent configuring options for new users.
- Allow power users to quickly switch between profiles.
- Solve the current gap where common options (analysis, chunking, overwrite) are not persisted across sessions.

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
- Persist last-used preset AND individual option values (for Custom preset recovery).

---

## UI Design

### Preset Dropdown (Closed)
```
+--------------------------------------------------+
| Preset: [Standard ▼]              [Reset defaults]|
+--------------------------------------------------+
```

### Preset Dropdown (Open)
```
+--------------------------------------------------+
| Preset: [▼ Standard                            ] |
|         ┌────────────────────────────────────────┐
|         │ ⚡ Quick                                │
|         │    Process fast, skip analysis         │
|         │ ──────────────────────────────────────│
|         │ ★ Standard (Recommended)               │
|         │    Analyze + chunk for RAG search      │
|         │ ──────────────────────────────────────│
|         │ 🔬 Deep                                │
|         │    All options, review before save     │
|         │ ──────────────────────────────────────│
|         │ ⚙️ Custom                              │
|         │    Your manual configuration           │
|         └────────────────────────────────────────┘
+--------------------------------------------------+
```

### Placement
- Top of Options tab (tabs already implemented via Opportunity A)
- Include "Reset to defaults" link when preset is not Custom
- Prominent position ensures discoverability

---

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

## Preset Descriptions (User-Facing)

| Preset | Label | Description | Icon |
|--------|-------|-------------|------|
| quick | Quick | Process fast, skip analysis | ⚡ |
| standard | Standard | Analyze + chunk for RAG search | ★ |
| deep | Deep | All options, review before save | 🔬 |
| custom | Custom | Your manual configuration | ⚙️ |

---

## Implementation Details

### Type Definitions

```typescript
// src/components/Common/QuickIngest/types.ts

export type IngestPreset = 'quick' | 'standard' | 'deep' | 'custom'

export interface PresetConfig {
  common: {
    perform_analysis: boolean
    perform_chunking: boolean
    overwrite_existing: boolean
  }
  storeRemote: boolean
  reviewBeforeStorage: boolean
  typeDefaults: {
    audio?: { diarize?: boolean }
    document?: { ocr?: boolean }
    video?: { captions?: boolean }
  }
}
```

### Preset Configuration Object

```typescript
// src/components/Common/QuickIngest/presets.ts

import type { IngestPreset, PresetConfig } from './types'

export const PRESETS: Record<Exclude<IngestPreset, 'custom'>, PresetConfig> = {
  quick: {
    common: { perform_analysis: false, perform_chunking: false, overwrite_existing: false },
    storeRemote: true,
    reviewBeforeStorage: false,
    typeDefaults: { audio: { diarize: false }, document: { ocr: false }, video: { captions: false } }
  },
  standard: {
    common: { perform_analysis: true, perform_chunking: true, overwrite_existing: false },
    storeRemote: true,
    reviewBeforeStorage: false,
    typeDefaults: { audio: { diarize: false }, document: { ocr: true }, video: { captions: true } }
  },
  deep: {
    common: { perform_analysis: true, perform_chunking: true, overwrite_existing: true },
    storeRemote: true,
    reviewBeforeStorage: true,
    typeDefaults: { audio: { diarize: true }, document: { ocr: true }, video: { captions: true } }
  }
}

export const PRESET_META: Record<IngestPreset, { label: string; description: string; icon: string }> = {
  quick: { label: 'preset.quick', description: 'preset.quick.description', icon: '⚡' },
  standard: { label: 'preset.standard', description: 'preset.standard.description', icon: '★' },
  deep: { label: 'preset.deep', description: 'preset.deep.description', icon: '🔬' },
  custom: { label: 'preset.custom', description: 'preset.custom.description', icon: '⚙️' }
}
```

### Helper Functions

```typescript
// src/components/Common/QuickIngest/presets.ts (continued)

export function configMatchesPreset(
  config: PresetConfig,
  presetName: Exclude<IngestPreset, 'custom'>
): boolean {
  const preset = PRESETS[presetName]
  return (
    config.common.perform_analysis === preset.common.perform_analysis &&
    config.common.perform_chunking === preset.common.perform_chunking &&
    config.common.overwrite_existing === preset.common.overwrite_existing &&
    config.storeRemote === preset.storeRemote &&
    config.reviewBeforeStorage === preset.reviewBeforeStorage &&
    config.typeDefaults?.audio?.diarize === preset.typeDefaults?.audio?.diarize &&
    config.typeDefaults?.document?.ocr === preset.typeDefaults?.document?.ocr &&
    config.typeDefaults?.video?.captions === preset.typeDefaults?.video?.captions
  )
}

export function detectPreset(config: PresetConfig): IngestPreset {
  for (const name of ['quick', 'standard', 'deep'] as const) {
    if (configMatchesPreset(config, name)) return name
  }
  return 'custom'
}
```

### Auto-Switch to Custom Logic

```typescript
// In QuickIngestModal.tsx or a dedicated hook

const [activePreset, setActivePreset] = useStorage<IngestPreset>('quickIngestPreset', 'standard')

// When any option changes, check if it still matches the active preset
useEffect(() => {
  if (activePreset !== 'custom') {
    const currentConfig = buildCurrentConfig() // Gather all current option values
    if (!configMatchesPreset(currentConfig, activePreset)) {
      setActivePreset('custom')
    }
  }
}, [common, storeRemote, reviewBeforeStorage, typeDefaults])
```

### Persistence Strategy

| Storage Key | Type | Default | Description |
|-------------|------|---------|-------------|
| `quickIngestPreset` | `IngestPreset` | `'standard'` | Currently selected preset |
| `quickIngestCommon` | `ProcessingOptions` | (from preset) | Individual common option values |
| `quickIngestTypeDefaults` | `TypeDefaults` | (existing) | Type-specific defaults |
| `quickIngestStoreRemote` | `boolean` | `true` | Storage destination preference |

When Custom is selected and modal reopens, restore individual option values from storage.
When a named preset is selected and modal reopens, apply that preset's values (not stored individual values).

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/Common/QuickIngest/types.ts` | Add `IngestPreset`, `PresetConfig` types |
| `src/components/Common/QuickIngest/presets.ts` | New file: preset configurations, metadata, and helpers |
| `src/components/Common/QuickIngest/PresetSelector.tsx` | New file: dropdown component with icons and descriptions |
| `src/components/Common/QuickIngest/OptionsTab/OptionsTab.tsx` | Integrate PresetSelector at top of options |
| `src/components/Common/QuickIngest/IngestOptionsPanel.tsx` | Wire up preset application and change detection |
| `src/components/Common/QuickIngestModal.tsx` | Add preset state, useStorage for persistence |
| `src/assets/locale/en/quick-ingest.json` | Add i18n keys for preset labels/descriptions |

---

## Requirements
- Selecting a preset applies all related option values instantly.
- If any option is manually changed, preset switches to Custom silently.
- Preset selection and labels are internationalized.
- Preset state is persisted and restored on next open.
- Individual option values are ALSO persisted (for Custom preset recovery).
- Preset UI is visible at the top of the Options tab.
- "Reset to defaults" link appears when preset is not Custom.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User selects preset while items queued | Apply preset values immediately; existing queued items retain their per-item overrides |
| User changes single option | Switch to Custom preset silently (no toast/notification) |
| User selects Custom preset from dropdown | No option changes; preserves current values |
| Modal reopens with Custom preset saved | Restore last-used individual option values from storage |
| Modal reopens with named preset saved | Apply that preset's values (ignore stored individual values) |
| Preset selected + advanced options changed | Switch to Custom (advanced schema fields count as manual change) |
| User clicks "Reset to defaults" | Revert to Standard preset and apply its values |

---

## Accessibility
- Preset selector is keyboard accessible (arrow keys to navigate, Enter to select).
- Each preset option has an accessible label and description.
- Screen readers announce preset name and description on focus.
- Focus is managed properly when dropdown opens/closes.
- Icon is decorative (hidden from screen readers via aria-hidden).

---

## i18n Keys

Add to `src/assets/locale/{lang}/quick-ingest.json`:

```json
{
  "preset.label": "Preset",
  "preset.quick": "Quick",
  "preset.quick.description": "Process fast, skip analysis",
  "preset.standard": "Standard",
  "preset.standard.description": "Analyze + chunk for RAG search",
  "preset.deep": "Deep",
  "preset.deep.description": "All options, review before save",
  "preset.custom": "Custom",
  "preset.custom.description": "Your manual configuration",
  "preset.reset": "Reset to defaults",
  "preset.recommended": "(Recommended)"
}
```

---

## Dependencies
- Integrates with existing tab-based layout (Opportunity A already implemented).
- Requires i18n updates for preset names and descriptions.
- Uses existing Plasmo `useStorage` hook for persistence.
- Leverages Ant Design `Select` or custom dropdown component.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Users may not understand what each preset changes | Include clear descriptions in dropdown; tooltip on hover shows full option list |
| Preset changes could overwrite carefully tuned custom settings | Auto-switch to Custom when any option changes; persist individual values |
| Discovery: users may not notice the preset dropdown | Place prominently at top of Options tab; include in onboarding tour (Opportunity E) |
| Persistence complexity with dual storage | Clear documentation; single source of truth based on preset type |

---

## Acceptance Criteria
- [ ] Users can select a preset from a dropdown and see all options update instantly.
- [ ] Manual changes to any option switch the preset to Custom.
- [ ] Last-used preset is restored on next modal open.
- [ ] With Custom preset, individual option values are restored on next open.
- [ ] "Reset to defaults" reverts to Standard preset.
- [ ] Preset dropdown is keyboard accessible.
- [ ] Preset labels and descriptions are translated (at least en locale).

---

## Test Plan

### Unit Tests
File: `src/components/Common/QuickIngest/__tests__/presets.test.ts`

- `configMatchesPreset()` returns true when config exactly matches a preset
- `configMatchesPreset()` returns false when any option differs
- `detectPreset()` correctly identifies Quick, Standard, Deep presets
- `detectPreset()` returns 'custom' when no preset matches
- Preset application sets all expected values

### Component Tests
File: `src/components/Common/QuickIngest/__tests__/PresetSelector.test.tsx`

- Renders all four preset options with correct labels
- Displays icons and descriptions
- Calls onChange when preset selected
- Highlights currently selected preset
- Shows "Reset to defaults" when preset is not Custom

### E2E Tests
File: `tests/e2e/quick-ingest-presets.spec.ts`

1. Open modal -> verify default preset is "Standard"
2. Select "Quick" preset -> verify all options update (analysis off, chunking off, OCR off, etc.)
3. Change one option manually -> verify preset switches to "Custom"
4. Select "Deep" preset -> verify reviewBeforeStorage enabled and diarize enabled
5. Close and reopen modal -> verify last-used preset restored
6. With "Custom" selected, modify options, close and reopen -> verify individual options restored
7. Click "Reset to defaults" -> verify Standard preset applied
8. Keyboard navigation: Tab to selector, arrow keys, Enter to select

### Manual Testing Checklist
- [ ] Preset dropdown opens on click
- [ ] Arrow keys navigate between options
- [ ] Enter selects highlighted option
- [ ] Screen reader announces preset names and descriptions
- [ ] Preset persists across browser restart
- [ ] Dark mode styling correct
- [ ] Mobile/narrow viewport displays correctly

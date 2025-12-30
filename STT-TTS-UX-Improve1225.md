# UX Review: Speech Playground (TTS & STT) Unification

**Date**: December 25, 2025
**Status**: Implementation Complete

---

## Executive Summary

This document provides a comprehensive UX review of the TTS and STT playground pages, with recommendations for unifying them into a single "Speech" playground experience. **Update: All planned features have been implemented.**

---

## 1. Current State Analysis

### TTS Playground (`src/components/Option/TTS/TtsPlaygroundPage.tsx` - 902 lines)
- **Providers**: Browser TTS, ElevenLabs, OpenAI, tldw server
- **Features**: Provider selection, model/voice selection, text input with sample text, segment-based audio playback, inline settings
- **Strengths**: Comprehensive provider support, good settings integration
- **Weaknesses**: No audio export, no waveform, uses basic `<audio controls>` element

### STT Playground (`src/components/Option/STT/SttPlaygroundPage.tsx` - 662 lines)
- **Modes**: Short dictation (single clip) vs Long-running (5-second chunked)
- **Features**: Model selection, live transcript, in-memory session history, save-to-notes
- **Strengths**: Dual mode support, live transcript display
- **Weaknesses**: History lost on refresh (in-memory only), no waveform visualization

### Navigation Issue (Critical) - RESOLVED
- **STT**: Accessible via ModeSelector dropdown under "More..." (`src/components/Layouts/ModeSelector.tsx:105-109`)
- **TTS**: Route exists (`/tts`) but was **NOT in ModeSelector** - effectively hidden from users!
- **Resolution**: Unified "Speech" mode now accessible from ModeSelector dropdown

---

## 2. Unified Page Architecture

### Implemented Layout: Tabbed Interface with Shared Context

```text
┌─────────────────────────────────────────────────────────────┐
│  Speech Playground                     [STT: whisper-1 ▼]   │
│                                        [TTS: kokoro   ▼]    │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐  ┌───────────────────┐  ┌──────────┐ │
│  │  🔄 Round-trip    │  │  🎤 Speak (STT)   │  │ 🔊 Listen│ │
│  └───────────────────┘  └───────────────────┘  └──────────┘ │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ╔═══════════════════════════════════════════════════════╗  │
│  ║         [Main Interaction Area - Tab-specific]        ║  │
│  ║                                                       ║  │
│  ║  Round-trip: STT + TTS side-by-side                   ║  │
│  ║  Speak Tab: Mic button + Waveform + Live transcript   ║  │
│  ║  Listen Tab: TextArea + Play + Audio player + Download║  │
│  ╚═══════════════════════════════════════════════════════╝  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Waveform / Audio Visualization Area]                      │
│  ▓▓▓▒▒▒░░▓▓▓▒▒▒░░▓▓▓▒▒▒░░▓▓▓▒▒▒░░ 00:03 / 00:12            │
├─────────────────────────────────────────────────────────────┤
│  History (Persistent)                          [Search 🔍] │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🎤 12/25 14:32 │ "Hello world test..." │ 5.2s │    🗑│   │
│  │ 🔊 12/25 14:30 │ "Sample text output"  │ 3.1s │    🗑│   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Three Core Modes (Implemented)

1. **Round-trip**: Voice → Text → Voice
   - STT and TTS cards displayed side-by-side
   - "Send to TTS" button transfers transcript to TTS input
   - Ideal for translation workflows

2. **Speak (STT)**: Voice → Text
   - Primary action: Record button with waveform
   - Output: Live transcript with lock/unlock editing (editing disabled while recording)
   - Actions: Save to notes, copy (with toast)

3. **Listen (TTS)**: Text → Voice
   - Primary action: Text input area
   - Output: Audio playback with waveform
   - Actions: Download audio, segment navigation

### Provider Context (Header)
- Separate STT model and TTS model/voice selectors (not unified)
- Provider capabilities badge per active tab
- Connection status indicator

---

## 3. Waveform Visualization Design

### Implementation: `src/components/Common/WaveformCanvas.tsx`

| Context | Visualization Type | Behavior |
|---------|-------------------|----------|
| Recording (live) | Real-time levels | Animated waveform showing mic input amplitude |
| Recording (after) | Static waveform | Generated from recorded audio blob (session only) |
| TTS playback | Static waveform | Generated from audio response, with playhead (session only) |

_Note: Waveforms are session-only since audio blobs are not persisted to storage._

### Component Specification

```typescript
interface WaveformCanvasProps {
  stream?: MediaStream | null      // For live recording
  audioRef?: React.RefObject<HTMLAudioElement>  // For playback
  active?: boolean
  label?: string
  height?: number  // default: 72px
}
```

### Implementation Details
- Uses Web Audio API `AnalyserNode` with `fftSize = 2048`
- Canvas-based rendering with device pixel ratio for crisp display
- `requestAnimationFrame` for smooth 60fps animation
- Proper cleanup of audio nodes on unmount

### Accessibility
- `role="img"` and `aria-label` for screen readers
- Green waveform color with good contrast
- Gray idle state line when not active

---

## 4. Audio Export (TTS)

### File Format Handling

TTS providers return audio in specific formats:
- **tldw server**: Configurable (mp3, ogg, wav via `responseFormat` setting; other formats rejected)
- **OpenAI**: MP3
- **ElevenLabs**: MP3
- **Browser TTS**: No file export (system audio only)

**Approach**: Hard-enforce wav/ogg/mp3 at settings/service layer; reject unsupported formats and surface a warning.

### Implementation

```typescript
const downloadMenu = {
  items: [
    { key: "download-active", label: "Download current segment" },
    { key: "download-all", label: "Download all segments" }
  ]
}
```

### Naming Convention
```
speech-tts-{timestamp}-{provider}-part-{n}.{ext}
Example: speech-tts-2025-12-25T14-32-00-kokoro-part-1.mp3
```

### Export Options
- **Single segment**: Download currently selected segment
- **Full audio**: Download all segments (triggers multiple downloads)
- Disabled for Browser TTS (with tooltip explaining why)

---

## 5. History Persistence Design

### Storage Model (Plasmo Extension Storage)

```typescript
type SpeechHistoryItem = {
  id: string              // UUID with timestamp
  type: "stt" | "tts"
  createdAt: string       // ISO 8601
  text: string

  // Metadata
  durationMs?: number
  model?: string
  provider?: string
  language?: string

  // STT-specific
  mode?: "short" | "long"

  // TTS-specific
  voice?: string
  format?: string
}
```

### Storage Implementation
- Uses `@plasmohq/storage/hook` with `useStorage`
- Stored in extension's local storage (not IndexedDB)
- Maximum 100 items with FIFO eviction
- **Retention UX**: Clear “History” action with an explanation of the 100-item limit

### UI Organization

**Default View**: Chronological (newest first)

**Filter Options**:
- Type: All | STT | TTS
- Full-text search on transcript content

### History Card Actions
- **Copy**: Copy text to clipboard (toast confirmation)
- **Save to Notes**: Save STT transcript as a note
- **Use in TTS**: Load text into TTS input
- **Delete**: Remove from history

---

## 6. Usability Issues - RESOLVED

### Critical (All Fixed)

| Issue | Resolution |
|-------|------------|
| TTS route hidden | Unified "Speech" mode in ModeSelector dropdown |
| STT history lost | Persistent storage via Plasmo `useStorage` |
| No audio export | Download dropdown with segment/all options |

### High Priority (All Fixed)

| Issue | Resolution |
|-------|------------|
| No recording feedback | Live `WaveformCanvas` during recording |
| Segment UX confusing | Segment buttons with format indicator |
| Settings fragmented | Inline TTSModeSettings component |

### Medium Priority (All Fixed)

| Issue | Resolution |
|-------|------------|
| Mode toggle unclear | Three-way Segmented control with clear labels |
| Provider/model visibility | Displayed in header with capabilities |
| Route confusion | `/speech`, `/tts`, `/stt` all work |

---

## 7. Route Configuration

### Current Routes

| Route | Behavior |
|-------|----------|
| `/speech` | Unified page, default mode (remembered) |
| `/tts` | Unified page with `initialMode="listen"` and updates stored mode |
| `/stt` | Unified page with `initialMode="speak"` and updates stored mode |

All routes render the same `SpeechPlaygroundPage` component with different initial modes.

---

## 8. Implementation Files

### Core Component
- `src/components/Option/Speech/SpeechPlaygroundPage.tsx`

### Supporting Components
- `src/components/Common/WaveformCanvas.tsx`
- `src/components/Option/Settings/tts-mode.tsx` (TTSModeSettings)

### Routes
- `src/routes/option-speech.tsx`
- `src/routes/option-tts.tsx`
- `src/routes/option-stt.tsx`

### Navigation
- `src/components/Layouts/ModeSelector.tsx` - "Speech" in secondaryModes
- `src/components/Layouts/Header.tsx` - Route detection for speech mode

### i18n
- `src/assets/locale/*/playground.json` - `speech.*` namespace (25+ keys)
- `src/assets/locale/*/option.json` - `header.modeSpeech` entry
- `src/public/_locales/*/messages.json` - Chrome i18n updates for the new keys

---

## 9. Success Criteria Verification

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Export TTS audio in one click | ✅ | Download dropdown with segment/all options |
| Find previous transcriptions days later | ✅ | Persistent storage (100 item limit) |
| See real-time waveform while recording | ✅ | WaveformCanvas with MediaStream |
| Know provider/model at a glance | ✅ | Provider header with capabilities badge |
| Complete all tasks without leaving Speech playground | ✅ | Unified page with all features |
| Quick test voice → transcription → edit → speak back | ✅ | Round-trip mode with "Send to TTS" |
| Automated UX smoke | ✅ | Playwright: mode switching, record→transcribe, lock/unlock, copy toast, download disabled state |

---

## 10. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Audio blob storage | Text only | Smaller storage footprint, faster performance |
| History retention | 100 items | Balanced utility and storage (~2-4 weeks of use) |
| Storage mechanism | Plasmo storage | Simpler than IndexedDB, sufficient for 100 items |
| Round-trip mode | Included | Enables speak→transcribe→edit→synthesize workflow |
| Sidepanel support | Options page only | Simpler implementation, power-user feature |
| Provider unification | Separate STT/TTS | Keep existing provider architecture, unify UI only |

---

## 11. Future Enhancements (Optional)

These were identified during review but not implemented:

1. **Mic permission pre-check**: Button to test microphone access before recording
2. **Chunk boundary visualization**: Show 5-second boundaries in long-running mode waveform
3. **Keyboard shortcuts**: Ctrl+R to record, Space to play
4. **Batch text export**: Export all history as JSON/CSV
5. **Voice preview**: Play sample audio before selecting a voice
6. **Translation workflow**: Automatic translation between transcription and synthesis

---

## Appendix: Key Code References

### SpeechPlaygroundPage Mode Handling
```typescript
// src/components/Option/Speech/SpeechPlaygroundPage.tsx:44
type SpeechMode = "roundtrip" | "speak" | "listen"

// Mode controls which cards are visible:
// - mode !== "listen" renders STT card
// - mode !== "speak" renders TTS card
// - "roundtrip" renders both side-by-side
```

### History Persistence
```typescript
// src/components/Option/Speech/SpeechPlaygroundPage.tsx:123-126
const [historyItems, setHistoryItems] = useStorage<SpeechHistoryItem[]>(
  "speechPlaygroundHistory",
  []
)
```

### Waveform Integration
```typescript
// Recording waveform (line 973-977)
<WaveformCanvas
  stream={recordingStream}
  active={isRecording || isTranscribing}
  label="Live recording waveform"
/>

// Playback waveform (line 1446-1450)
<WaveformCanvas
  audioRef={audioRef}
  active={Boolean(segments.length)}
  label="Playback waveform"
/>
```

### Audio Download
```typescript
// src/components/Option/Speech/SpeechPlaygroundPage.tsx:756-763
const downloadBlob = React.useCallback((blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}, [])
```

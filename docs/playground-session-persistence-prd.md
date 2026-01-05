# PRD: Playground Session Persistence

## Overview

**Feature**: Automatic save and restore of playground chat sessions
**Status**: Proposed
**Author**: Claude
**Date**: 2026-01-04

## Problem Statement

When users navigate away from the playground page (e.g., to settings, knowledge base, or another tab) and return, they lose their current conversation context. This forces users to start fresh or manually reload their chat history, creating a frustrating experience.

## Goals

1. Automatically save the current playground session when users navigate away
2. Restore the full session (messages, settings, mode) when users return
3. Integrate seamlessly with existing chat persistence mechanisms
4. Avoid duplicating already-persisted settings

## Non-Goals

- Cross-device session sync (out of scope)
- Persisting binary file attachments (too large for localStorage)
- Modifying the existing Dexie chat history storage

## User Stories

1. **As a user**, I want my chat conversation to be restored when I navigate back to the playground, so I don't lose my work.
2. **As a user**, I want my RAG settings and chat mode to be remembered, so I don't have to reconfigure them.
3. **As a user**, I want stale sessions (24+ hours) to be automatically cleaned up, so I start fresh when appropriate.

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Playground.tsx                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         usePlaygroundSessionPersistence()            │   │
│  │                                                     │   │
│  │  ┌───────────────┐    ┌────────────────────────┐   │   │
│  │  │ Session Store │◄───│ Debounced Auto-Save    │   │   │
│  │  │ (localStorage)│    │ (1s debounce)          │   │   │
│  │  └───────┬───────┘    └────────────────────────┘   │   │
│  │          │                                          │   │
│  │          ▼                                          │   │
│  │  ┌───────────────┐    ┌────────────────────────┐   │   │
│  │  │ Restore on    │───►│ Fetch messages from    │   │   │
│  │  │ mount         │    │ Dexie via historyId    │   │   │
│  │  └───────────────┘    └────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### State to Persist

| Field | Type | Description |
|-------|------|-------------|
| `historyId` | `string \| null` | ID to restore messages from Dexie |
| `serverChatId` | `string \| null` | Server conversation ID |
| `chatMode` | `"normal" \| "rag"` | Current chat mode |
| `webSearch` | `boolean` | Web search toggle state |
| `compareMode` | `boolean` | Multi-model compare mode |
| `compareSelectedModels` | `string[]` | Models selected for compare |
| `ragMediaIds` | `number[] \| null` | RAG media scope |
| `ragSearchMode` | `string` | RAG search mode |
| `ragTopK` | `number \| null` | RAG top-k setting |
| `ragEnableGeneration` | `boolean` | RAG generation toggle |
| `ragEnableCitations` | `boolean` | RAG citations toggle |
| `lastUpdated` | `number` | Timestamp for staleness check |

### Already Persisted (No Change Needed)

| Field | Mechanism |
|-------|-----------|
| `selectedModel` | `useStorage("selectedModel")` |
| `speechToTextLanguage` | `useStorage("speechToTextLanguage")` |
| Messages | Dexie via `historyId` |
| Draft text | `useDraftPersistence` hook |

### Excluded from Persistence

| Field | Reason |
|-------|--------|
| `messages`, `history` | Restored from Dexie via historyId |
| `streaming`, `isLoading`, `isProcessing` | Runtime state |
| `uploadedFiles` | Binary data too large |
| `temporaryChat` sessions | User explicitly chose not to save |
| `queuedMessages` | Pending operations |
| `documentContext` | Tab-specific context |

## Implementation Plan

### Phase 1: Session Store

**File**: `src/store/playground-session.tsx`

Create a Zustand store with persist middleware:
- Use localStorage for persistence
- Include `partialize` to only persist data fields
- Add `isSessionStale()` method (24-hour threshold)
- Add `saveSession()` and `clearSession()` actions

### Phase 2: Persistence Hook

**File**: `src/hooks/usePlaygroundSessionPersistence.tsx`

Create orchestration hook:
- Debounced save (1s) on state changes
- Restore from Dexie + session store on mount
- Check `temporaryChat` flag before saving
- Export: `restoreSession()`, `clearPersistedSession()`, `hasPersistedSession`

### Phase 3: Playground Integration

**File**: `src/components/Option/Playground/Playground.tsx`

Modify initialization logic:
1. Try session persistence first (exact state from nav-away)
2. Fall back to existing `webUIResumeLastChat` behavior
3. Otherwise start fresh

### Phase 4: Clear on New Chat

**File**: `src/hooks/useMessageOption.tsx`

Add `clearSession()` call to `clearChat` function to reset persisted state when user starts a new conversation.

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Stale session (24+ hours) | Auto-cleanup on mount |
| Temporary chat mode | Skip persistence |
| Firefox private mode | Fallback to memory storage |
| Deleted historyId in Dexie | Graceful fallback, clear session |
| Compare mode active | Persist flag + selected models |
| File attachments | Not persisted; user re-attaches |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Race condition on restore | Restore synchronously from localStorage, async from Dexie |
| Conflict with webUIResumeLastChat | Session persistence takes priority |
| localStorage quota exceeded | Graceful error handling, continue without persistence |

**Note**: Initial concern about "dual message state" (Zustand + Context) was investigated and found to be a non-issue. The Zustand store's `messages`/`setMessages` are dead code - all message state flows through `PageAssistContext`. We will clean up this dead code as part of implementation.

## Testing Strategy

### Unit Tests
- Session store persistence/restore
- Staleness detection
- Session clearing

### Integration Tests (E2E)
- Navigate away and return: verify state restored
- Page refresh: verify session restored
- Clear chat: verify session cleared
- Temporary chat: verify not persisted

### Manual Testing
- Test with compare mode enabled
- Test with RAG mode active
- Test Firefox private mode fallback

## Success Metrics

1. **User retention**: Users return to existing conversations instead of starting fresh
2. **Error rate**: < 0.1% failures on session restore
3. **Performance**: < 100ms for session restore

## Timeline

| Phase | Scope |
|-------|-------|
| 1 | Session store implementation |
| 2 | Persistence hook |
| 3 | Playground integration |
| 4 | Clear on new chat |
| 5 | Testing & polish |

## Appendix: File Changes Summary

| File | Action |
|------|--------|
| `src/store/playground-session.tsx` | CREATE |
| `src/hooks/usePlaygroundSessionPersistence.tsx` | CREATE |
| `src/components/Option/Playground/Playground.tsx` | MODIFY |
| `src/hooks/useMessageOption.tsx` | MODIFY |

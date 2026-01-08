# PRD: Code Review & Technical Debt Remediation
## tldw Assistant Browser Extension

**Document Version:** 1.0
**Date:** 2026-01-07
**Author:** Code Review Analysis
**Status:** Ready for Implementation

---

## 1. Overview

### 1.1 Purpose
This PRD documents the findings from a comprehensive code review of the tldw Assistant browser extension, identifying bugs, architectural issues, performance problems, and areas for improvement. It provides a prioritized action plan for the engineering team.

### 1.2 Background
The codebase was inherited from a prior developer. While the extension is functional and contains many good patterns, technical debt has accumulated in certain areas that need attention to ensure long-term maintainability and performance.

### 1.3 Scope
- Bug fixes (Priority 1)
- Architecture improvements (Priority 2)
- Performance optimizations (Priority 3)
- Error handling improvements (Priority 4)
- TypeScript improvements (Priority 5)

---

## 2. Current State Analysis

### 2.1 Architecture Summary

```
src/
├── entries/              # Browser entry points
│   ├── background.ts     # Service worker (1200+ lines)
│   ├── sidepanel/        # Main chat UI
│   └── options/          # Settings page
├── components/           # React components
├── hooks/                # React hooks
│   └── useMessageOption.tsx  # Main chat hook (1977 lines)
├── store/                # Zustand state stores
│   └── option.tsx        # Main store (434 lines, 44 setters)
├── services/             # API clients
└── ...
```

### 2.2 Strengths (Preserve These Patterns)

| Pattern | Location | Description |
|---------|----------|-------------|
| Resource Cleanup | `useMicStream.ts` | Comprehensive audio stream cleanup with ref nullification |
| AbortController | `background-proxy.ts` | Proper streaming cancellation with cleanup in finally blocks |
| Immutable Updates | `store/feedback.tsx` | Correct spread patterns in Zustand stores |
| Event Listeners | `useDarkmode.tsx` | Proper add/remove in useEffect cleanup |
| Error Throttling | `background-proxy.ts:15-49` | Smart rate-limit error handling |
| Single-flight Promises | `background.ts:487-497` | Token refresh prevents duplicates |
| Lazy Loading | `QuickChatHelperButton.tsx` | Proper code splitting with Suspense |

### 2.3 Technical Debt Summary

| Category | Count | Severity |
|----------|-------|----------|
| Bugs | 1 critical | High |
| Missing Error Boundaries | 1 | High |
| Selector Issues | 9 components | Medium |
| Silent Error Swallowing | ~12 locations | Medium |
| Excessive `any` usage | Multiple files | Low |
| Legacy/Unused Runtime Code | 1 | Medium |
| Hook Dependency Suppressions | 8+ locations | Low |
| `@ts-ignore` Hotspots | 25+ locations | Low |

---

## 3. Priority 1: Critical Bug Fixes

### 3.1 Logic Bug in `setServerChatId()`

**File:** `src/store/option.tsx:332-344`

**Current Code (Buggy):**
```typescript
setServerChatId: (id) =>
  set(() => ({
    serverChatId: id,
    serverChatState: id ? "in-progress" : "in-progress",  // BUG
    serverChatVersion: null,
    serverChatTitle: null,
    serverChatCharacterId: null,
    serverChatMetaLoaded: false,
    serverChatTopic: id ? null : null,      // BUG
    serverChatClusterId: id ? null : null,  // BUG
    serverChatSource: id ? null : null,     // BUG
    serverChatExternalRef: id ? null : null // BUG
  })),
```

**Issues:**
1. Line 335: `serverChatState: id ? "in-progress" : "in-progress"` - Both branches return the same value
2. Lines 340-343: All ternaries return `null` regardless of condition

**Expected Behavior:**
- When `id` is set: State should be `"in-progress"` and metadata should be cleared
- When `id` is cleared (`null`): State should be `"idle"` and metadata should remain `null`

**Proposed Fix:**
```typescript
setServerChatId: (id) =>
  set(() => ({
    serverChatId: id,
    serverChatState: id ? "in-progress" : "idle",
    serverChatVersion: null,
    serverChatTitle: null,
    serverChatCharacterId: null,
    serverChatMetaLoaded: false,
    serverChatTopic: null,
    serverChatClusterId: null,
    serverChatSource: null,
    serverChatExternalRef: null
  })),
```

**Impact:** State machine for server chat synchronization is currently broken. May cause UI inconsistencies.

**Acceptance Criteria:**
- [ ] Ternary logic corrected or simplified
- [ ] State transitions verified with unit test
- [ ] Manual testing confirms chat sync works correctly

### 3.2 Remove Unused CORS Rewrite Runtime (Firefox Listener Bug)

**File:** `src/libs/runtime.ts`

**Issue:**
- `urlRewriteRuntime` is unused (no references found).
- Firefox cleanup uses `removeListener(() => {})`, which never removes the originally added listener.

**Fix:** Remove the unused module entirely.

**Acceptance Criteria:**
- [ ] `src/libs/runtime.ts` removed
- [ ] No references to `urlRewriteRuntime`

---

## 4. Priority 2: Architecture Improvements

### 4.1 Split Monolithic Store

**File:** `src/store/option.tsx`

**Current Problems:**
- 434 lines with 44+ state setters
- Mixes unrelated concerns (chat, RAG, server sync, compare mode)
- Any change risks breaking unrelated features
- Hard to test individual concerns

**Proposed Store Structure:**

```
src/store/
├── option.tsx              # DEPRECATED - re-export from new stores
├── chat/
│   ├── chat-core.tsx       # messages, history, streaming
│   ├── chat-server.tsx     # serverChatId, serverChatTitle, etc.
│   └── chat-model.tsx      # selectedModel, systemPrompt
├── rag-config.tsx          # ragMode, ragKnowledge, ragSources
└── compare-mode.tsx        # compareEnabled, compareSelectionByCluster
```

**Migration Strategy:**
1. Create new focused stores
2. Re-export from `option.tsx` for backwards compatibility
3. Gradually update consumers to import from new locations
4. Remove re-exports once migration is complete

**Estimated Effort:** Medium (3-5 days)

### 4.2 Break Up Large Hook

**File:** `src/hooks/useMessageOption.tsx` (1977 lines)

**Proposed Structure:**
```
src/hooks/
├── useMessageOption.tsx         # Composition of smaller hooks
├── chat/
│   ├── useChatBaseState.ts      # Already exists, good pattern
│   ├── useServerChatLoader.ts   # Extract lines 348-623
│   ├── useCompareMode.ts        # Extract lines 721-807
│   └── useChatActions.ts        # Send, regenerate, edit, branch
```

**Benefits:**
- Each hook can be unit tested independently
- Easier to understand individual concerns
- Smaller bundle size through tree shaking

**Estimated Effort:** Medium-High (5-8 days)

### 4.3 Split Largest Pages (Start with Review + Quick Ingest)

**Targets:**
- `src/components/Review/ReviewPage.tsx`
- `src/components/Common/QuickIngestModal.tsx`

**Approach:**
- Extract reusable prompt dropdown UI + search hook from Review page.
- Extract Quick Ingest inspector drawer into a subcomponent.

**Estimated Effort:** Low-Medium (1-2 days)

### 4.4 UI Library Consolidation Plan

**Current:** AntD + Tailwind + Mantine (forms) + Headless UI (misc) + multiple icon packs.

**Proposed Target:** AntD + Tailwind only.

**Plan:**
1. Inventory Mantine/Headless UI usage and pick replacement components in AntD.
2. Migrate `@mantine/form` usage to AntD `Form` or a single form utility.
3. Remove Mantine + Headless UI dependencies after replacements.
4. Standardize icon usage (prefer Lucide where already used).

**Estimated Effort:** Medium (3-5 days)

---

## 5. Priority 3: Performance Optimizations

### 5.1 Add Zustand Selectors

**Problem:** 9 components use full store destructuring, causing unnecessary re-renders.

**Files to Update:**

| File | Line | Current Usage |
|------|------|---------------|
| `components/Sidepanel/Chat/form.tsx` | 100 | `const { replyTarget, clearReplyTarget } = useStoreMessageOption()` |
| `components/Option/Sidebar.tsx` | 62 | Full store destructuring |
| `components/Option/Settings/tldw.tsx` | - | Full store destructuring |
| `components/Option/Playground/Playground.tsx` | - | Full store destructuring |
| + 5 more files | - | - |

**Fix Pattern:**
```typescript
// Before (BAD)
const { replyTarget, clearReplyTarget } = useStoreMessageOption()

// After (GOOD)
const replyTarget = useStoreMessageOption((s) => s.replyTarget)
const clearReplyTarget = useStoreMessageOption((s) => s.clearReplyTarget)
```

**Reference Implementation:** `src/hooks/useConnectionState.ts` shows the correct pattern.

**Estimated Effort:** Low (1-2 days)

### 5.2 Reduce Prop Drilling in Sidebar

**File:** `src/components/Option/Sidebar.tsx:65-80`

**Current Props (14 total):**
```typescript
type Props = {
  onClose: () => void
  setMessages: (messages: any) => void
  setHistory: (history: any) => void
  setHistoryId: (historyId: string) => void
  setSelectedModel: (model: string) => void
  setSelectedSystemPrompt: (prompt: string) => void
  setSystemPrompt: (prompt: string) => void
  setContext?: (context: UploadedFile[]) => void
  clearChat: () => void
  selectServerChat: (chat: ServerChatSummary) => void
  temporaryChat: boolean
  historyId: string
  history: any
  isOpen: boolean
}
```

**Proposed Refactor:**
- Keep only `isOpen`, `onClose`
- Access other values directly from Zustand store using selectors
- Reduces parent component complexity significantly

**Estimated Effort:** Low (0.5-1 day)

---

## 6. Priority 4: Error Handling

### 6.1 Add Sidepanel Error Boundary

**File:** `src/routes/app-route.tsx:129-143`

**Current Code:**
```typescript
return (
  <div className={...}>
    <React.Suspense fallback={...}>
      {kind === "options" ? (
        <OptionsErrorBoundary onReset={handleOptionsReset}>
          {routesContent}
        </OptionsErrorBoundary>
      ) : (
        routesContent  // No error boundary!
      )}
    </React.Suspense>
  </div>
)
```

**Proposed Fix:**
```typescript
return (
  <div className={...}>
    <React.Suspense fallback={...}>
      {kind === "options" ? (
        <OptionsErrorBoundary onReset={handleOptionsReset}>
          {routesContent}
        </OptionsErrorBoundary>
      ) : (
        <SidepanelErrorBoundary onReset={handleSidepanelReset}>
          {routesContent}
        </SidepanelErrorBoundary>
      )}
    </React.Suspense>
  </div>
)
```

**Note:** Can reuse or extend `AgentErrorBoundary` from `src/components/Agent/AgentErrorBoundary.tsx`.

**Estimated Effort:** Low (2-4 hours)

### 6.2 Add Logging to Empty Catch Blocks

**File:** `src/entries/background.ts`

**Locations Requiring Attention:**

| Line | Current | Suggested |
|------|---------|-----------|
| 251 | `catch { }` | `catch (e) { console.debug('[bg] retry failed:', e) }` |
| 265 | `catch { }` | `catch (e) { console.debug('[bg] message send failed:', e) }` |
| 556-558 | `catch { // Local mirror... }` | Add debug logging |
| 752-754 | `catch { /* no-op */ }` | Add debug logging |
| 814, 841, 855, 860 | `catch { }` | Add WebSocket error logging |

**Recommendation:** Create a utility function:
```typescript
// src/utils/debug-log.ts
export const debugCatch = (context: string, error: unknown) => {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[${context}]`, error)
  }
}
```

**Estimated Effort:** Low (2-4 hours)

### 6.3 Ensure `tldwRequest` Cleanup on Errors

**File:** `src/services/tldw/request-core.ts`

**Issue:** Timeout and abort listeners are not cleaned up when `fetch` throws, causing leaks.

**Fix:** Use `finally` cleanup for timeouts and abort listeners.

**Estimated Effort:** Low (1-2 hours)

---

## 7. Priority 5: TypeScript Improvements

### 7.1 Reduce `any` Usage

**High-Priority Files:**

| File | Issue | Suggested Fix |
|------|-------|---------------|
| `background.ts:135` | `browser as any` | Create typed browser interface |
| `background.ts:405` | `storage.get<any>` | Define `TldwConfig` type |
| `useMessageOption.tsx:412-433` | `(chat as any)?.title` | Define `ServerChat` type |

**Proposed Types:**
```typescript
// src/types/server-chat.ts
interface ServerChat {
  id: string
  title?: string
  character_id?: string
  topic?: string
  cluster_id?: string
  source?: string
  external_ref?: string
}

// src/types/tldw-config.ts
interface TldwConfig {
  serverUrl: string
  apiKey?: string
  // ... other config fields
}
```

**Estimated Effort:** Medium (2-3 days)

### 7.2 Triage `@ts-ignore` Usage

**High-Value Targets:**
| File | Issue | Suggested Fix |
|------|------|---------------|
| `src/utils/human-message.tsx` | `@ts-ignore` on content parts | Add type guards for message content |
| `src/hooks/useSpeechRecognition.tsx` | `@ts-ignore` in event type | Define `SpeechRecognitionErrorEvent` properly |
| `src/components/Sidepanel/Chat/form.tsx` | `@ts-ignore` for `chrome.runtime` | Add runtime guards + types |
| `src/components/Sidepanel/Chat/ConnectionBanner.tsx` | `@ts-ignore` for `chrome.runtime` | Add runtime guards + types |
| `src/components/Sidepanel/Chat/empty.tsx` | `@ts-ignore` for `browser/chrome` | Import `browser` + guard `chrome` |
| `src/components/Common/ServerConnectionCard.tsx` | `@ts-ignore` for `browser/chrome` | Import `browser` + guard `chrome` |
| `src/utils/clean-headers.ts` | `@ts-ignore` check | Remove invalid `{}` comparison |
| `src/db/nickname.ts` | `@ts-ignore` on map values | Add proper record typing |

**Estimated Effort:** Low-Medium (1-2 days)

### 7.3 Reduce Hook Dependency Suppressions

**Targets:** `sidepanel/Chat/form.tsx`, `Option/Knowledge/index.tsx`, `Flashcards/FlashcardsPage.tsx`

**Fix:** Include stable dependencies or guard one-time behavior with refs.

**Estimated Effort:** Low (0.5-1 day)

---

## 8. Implementation Timeline

### Phase 1: Immediate (Week 1)
| Task | Effort | Owner |
|------|--------|-------|
| Fix `setServerChatId()` bug | 2 hours | - |
| Add sidepanel error boundary | 4 hours | - |
| Remove unused CORS rewrite runtime | 1 hour | - |
| Add `tldwRequest` cleanup | 1 hour | - |

### Phase 2: Short-term (Weeks 2-3)
| Task | Effort | Owner |
|------|--------|-------|
| Add selectors to 9 components | 2 days | - |
| Refactor Sidebar props | 1 day | - |
| Add logging to catch blocks | 4 hours | - |
| Triage `@ts-ignore` usage | 1-2 days | - |
| Reduce hook dependency suppressions | 0.5-1 day | - |

### Phase 3: Medium-term (Weeks 4-6)
| Task | Effort | Owner |
|------|--------|-------|
| Split `option.tsx` store | 5 days | - |
| Break up `useMessageOption` hook | 8 days | - |
| UI library consolidation | 3-5 days | - |

### Phase 4: Ongoing
| Task | Effort | Owner |
|------|--------|-------|
| Reduce `any` usage | 3 days | - |
| Documentation updates | 1 day | - |

---

## 9. Success Metrics

### 9.1 Quality Gates
- [ ] `bun run compile` passes with no errors
- [ ] `bun run build:chrome` succeeds
- [ ] `bun run test:e2e` all tests pass
- [ ] No new console errors in production build

### 9.2 Performance Targets
- Reduce unnecessary re-renders by 50%+ (measure with React DevTools)
- No visible UI lag during chat streaming

### 9.3 Maintainability
- No single file > 500 lines
- No single hook > 400 lines
- All stores have <15 state fields each

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Regression in chat functionality | Medium | High | E2E tests, staged rollout |
| Store split breaks existing features | Medium | High | Re-export for compatibility |
| Performance degradation | Low | Medium | Benchmark before/after |

---

## 11. Appendix

### A. Files Referenced

```
src/store/option.tsx
src/hooks/useMessageOption.tsx
src/entries/background.ts
src/routes/app-route.tsx
src/components/Option/Sidebar.tsx
src/components/Sidepanel/Chat/form.tsx
src/hooks/useConnectionState.ts
src/services/background-proxy.ts
src/hooks/useMicStream.ts
src/hooks/useDarkmode.tsx
src/components/Agent/AgentErrorBoundary.tsx
```

### B. Good Patterns to Reference

- **Selectors:** `src/hooks/useConnectionState.ts`
- **Resource Cleanup:** `src/hooks/useMicStream.ts`
- **Error Boundary:** `src/components/Agent/AgentErrorBoundary.tsx`
- **Immutable Updates:** `src/store/quick-chat.tsx`

### C. Testing Checklist

Manual testing before each release:
- [ ] Chat streaming works end-to-end
- [ ] Compare mode (multi-model) responds correctly
- [ ] Server chat sync loads/saves properly
- [ ] RAG mode retrieves and cites sources
- [ ] Error boundary catches and displays errors gracefully
- [ ] No memory leaks after extended use (check DevTools Memory tab)

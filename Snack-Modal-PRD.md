# Contextual Copilot Popup (Snack Modal) — PRD

## Product Name
Contextual Copilot Popup ("Snack Modal")

## Goal
Provide a lightweight, in-page response surface for selected text using an explicit right-click context menu trigger, without opening the sidepanel by default. Preserve streaming responses and enable user-confirmed replacement of selected text.

## Background / Problem
The current copilot response flow opens the sidepanel, which is heavier than necessary for quick contextual actions. Users want a small, on-page popup similar to Firefox’s translate-selection UI for fast answers, while retaining the option to open the full sidepanel for deeper work.

## Objectives
- Reduce friction for quick tasks.
- Keep the response visible and anchored near selected text.
- Maintain a streaming response experience.
- Provide safe, explicit “replace selected text” with preview.

## Non-Goals
- Automatic popup on selection (must be explicit trigger only).
- Full-page translation or bulk replacement.
- Multi-selection or multi-range editing.
- Rich-text replacement (v1 is plain text only).

---

## User Stories

1. **Explicit trigger**
   - As a user, when I select text and right-click, I can open a Copilot popup via a tldw context menu item.

2. **Streaming response**
   - As a user, I see the response appear progressively in the popup as the model streams.

3. **Replace with confirmation**
   - As a user, if the selected text is inside an editable field, I can preview the model output and confirm replacement.

4. **Fallback path**
   - As a user, I can always open the sidepanel for longer or more complex work.

---

## UX / UI Requirements

### Trigger
- Context menu: `tldw > Contextual action` (only shown when selection exists).

### Popup UI
- Appears anchored near the selection bounding box; clamped within viewport.
- Rendered in Shadow DOM to avoid host page CSS conflicts.
- Compact layout (~320–420px width), scrollable response area.
- Primary actions:
  - During streaming: “Stop” and “Open sidepanel”.
  - After completion: “Replace selection” (if applicable), “Copy”, “Open sidepanel”, “Close”.
- Status indicator while streaming (spinner or subtle pulse).
- Safe close: clicking outside closes the popup (unless “pin” is introduced later).

### Replace Confirmation
- After stream completes, show preview box (editable).
- Replace button enabled only when:
  - Selected text is still valid, and
  - Selection target is editable (textarea/input/contenteditable).
- Cancel returns to response view (does not lose streamed text).

### Accessibility
- Keyboard focus trap inside popup.
- Escape closes.
- Buttons have clear labels (not icons only).

---

## Functional Requirements

### FR-1: Context menu trigger
- Add a context menu item under the `tldw` root context menu.
- Visible only when `contexts: ['selection']`.

### FR-2: Popup render
- Content script listens for `{ type: 'tldw:popup:open' }`.
- Creates or reuses a popup container; unmounts on close.

### FR-3: Selection handling
- On open:
  - Capture selected text.
  - Calculate anchor rect for positioning.
  - Detect if selection is in an editable field:
    - `textarea` / `input[type=text|search|url|email|tel|password]`
    - `contenteditable` (closest ancestor)
- If no selection, show error state with “Open sidepanel”.

### FR-4: Streaming
- Request model response via background (reuse existing streaming pipeline).
- Stream updates into popup incrementally.
- Support cancellation via AbortController:
  - Close popup
  - User clicks “Stop”
  - Selection changes significantly (optional v1)

### FR-5: Replace confirmation
- After stream completion:
  - Show preview text box with streamed content.
  - “Replace selection” performs replacement:
    - Inputs/textareas: `setRangeText()`.
    - Contenteditable: delete `Range` contents and insert text node.
- If replacement fails, show error message and keep preview.

### FR-6: Sidepanel fallback
- “Open sidepanel” action always visible after response starts.

---

## Data & API Considerations

- Use existing request pipeline for model calls (tldw server API).
- Pass selection text as prompt input (formatting aligned with existing copilot flow).
- No new backend endpoints required.

---

## State Machine

**Idle → Streaming → Done**
- Idle: popup opened, selection captured.
- Streaming: text streaming in.
- Done: stream finished; preview available if replace-eligible.

**Error states**
- No selection / access denied (iframes): show message + “Open sidepanel”.
- Network error: show error + retry.

---

## Edge Cases

- Selection in cross-origin iframe → no access: show fallback.
- Selection lost mid-stream (user clicks elsewhere) → keep popup visible but disable replace.
- Scrolling moves selection out of view → reposition or keep anchored to last rect.
- Very long outputs → popup scrolls, suggest “Open sidepanel”.

---

## Security / Privacy

- No additional permissions beyond context menu and content scripts.
- Selection text sent only on explicit user action.
- No auto-replacement without confirmation.

---

## Telemetry / Metrics (if available)

**Success metrics**
- % of context menu invocations that complete streaming.
- % of completed streams that trigger “Replace selection”.
- % of users clicking “Open sidepanel” from popup.

**Quality metrics**
- Error rate on stream start.
- Replacement failure rate.

---

## Internationalization

- Add UI strings to `src/assets/locale/{lang}/...` and run `locales:sync`.
- Ensure long strings wrap within popup layout.

---

## Technical Dependencies

- Background script for context menu & message dispatch.
- Content script with React UI.
- Streaming service utilities.
- Tailwind classes consistent with the extension’s styling.

---

## Rollout Plan

### Phase 1 (MVP)
- Context menu trigger
- Popup UI + streaming
- Replace preview + confirm

### Phase 2
- Pinning / persistent popup
- Reposition on scroll/resize improvements
- Shortcut trigger (optional)

---

## QA / Test Plan

**Manual**
- Chrome/Firefox/Edge: context menu availability.
- Editable replacement in:
  - `<textarea>`
  - `<input>`
  - `contenteditable`
- Streaming cancel/close behaviors.
- Cross-origin iframe selection fallback.

**Automated (if applicable)**
- Add unit tests for replacement helpers.
- E2E: selection → popup → stream → replace.

---

## Open Questions

1. Should the popup close automatically after replacement?
2. Should “Copy” be available during streaming (copy partial) or only when done?
3. Do we reuse the existing copilot prompt template or create a shorter one for the popup?

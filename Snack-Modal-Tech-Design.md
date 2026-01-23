# Snack Modal — Technical Design

## Summary
The Snack Modal is a selection-triggered, in-page Copilot popup that streams a response and optionally replaces the selected text after a confirm preview. It is triggered explicitly via a right-click context menu item. The UI is rendered in a Shadow DOM to avoid page CSS conflicts and communicates with the background via message passing.

## Goals
- Explicit trigger only (context menu selection).
- Streaming response in a small anchored popup.
- Confirmed replace flow for editable selections.
- Safe fallback to open the sidepanel.

## Non-Goals
- Auto-popup on selection.
- Multi-range selection support.
- Rich-text replacement.
- Full-page translation.

---

## Architecture

### Components
- **Background**: Adds context menu item; dispatches `tldw:popup:open` to the active tab/frame.
- **Content Script Host**: Listens for open messages; captures selection; mounts/unmounts the popup; positions it.
- **Popup UI**: React component tree rendered in Shadow DOM; manages streaming, preview, replace, and close actions.
- **Streaming Service**: Dedicated `TldwChatService` instance per content script.
- **Selection Replace Helpers**: Utility for inputs/textareas and contenteditable replacement.

### Message Flow
1) User selects text → right-click → `tldw > Contextual action`.
2) Background handles click and calls `tabs.sendMessage` → `{ type: 'tldw:popup:open', payload }`.
3) Content script receives message, captures selection + anchor rect, mounts popup.
4) Popup triggers streaming via `TldwChatService.streamMessage`.
5) On stream completion, popup shows preview and “Replace selection” if applicable.
6) User replaces selection or closes popup. Optional “Open sidepanel.”

---

## Content Script Details

### Selection Capture
- Use `window.getSelection()` and `Range` for anchor rect.
- Capture `selectionText` from `Selection.toString()`.
- Determine replacement target:
  - `textarea` / `input` with a selection range.
  - `contenteditable` ancestor containing the selection range.

### Positioning
- Anchor via `range.getBoundingClientRect()`.
- Clamp to viewport with padding.
- Recompute on `scroll` and `resize` via `requestAnimationFrame` throttling.

### Popup Host
- Inject a single root container per frame.
- Attach Shadow DOM and inject scoped styles.
- Unmount on close and clean event listeners.

---

## Streaming

### Service
- Use `TldwChatService` in content script; do not reuse sidepanel state.
- Read model from storage (`selectedModel` in extension storage).
- Cancel on close, Stop, or new trigger.

### Payload
- Build a single user message containing selected text.
- Optional system prompt: “Respond helpfully to the selected text.”

---

## Replace Confirmation

### Inputs / Textareas
- Use `setRangeText(previewText, start, end, 'end')` to preserve undo.

### Contenteditable
- `range.deleteContents()` + `range.insertNode(document.createTextNode(previewText))`.
- Collapse selection to end.

### Guardrails
- Disable Replace if selection target is invalid or detached.

---

## UI States
- **Idle**: popup opens, no stream started yet (fast transition).
- **Streaming**: incremental text updates, Stop available.
- **Done**: response complete, preview visible if replace-eligible.
- **Error**: stream failure or no model selected.

---

## Files & Ownership

### New Files
- `src/entries/copilot-popup.content.tsx`
- `src/components/CopilotPopup/*` (or colocated in the content script)
- `src/utils/selection-replace.ts`

### Modified Files
- `src/entries/shared/background-init.ts` (menu item)
- `src/entries/background.ts` (menu click handling)
- `src/assets/locale/en/*.json` (strings)

---

## i18n Keys (proposed)
- `contextCopilotPopup` → “Contextual action”
- `popupStop` → “Stop”
- `popupOpenSidepanel` → “Open sidepanel”
- `popupCopy` → “Copy”
- `popupReplace` → “Replace selection”
- `popupCancel` → “Cancel”
- `popupNoSelection` → “No selection found”
- `popupNoModel` → “Select a model to continue”
- `popupStreaming` → “Streaming…”

---

## Risks
- Cross-origin frames may block selection capture → fallback to sidepanel.
- Styling collisions if Shadow DOM isn’t used.
- Replacement correctness in complex `contenteditable` trees.

---

## Testing
- Manual: context menu availability, streaming, replace in input/textarea/contenteditable.
- Unit: selection replacement helper logic.
- E2E (optional): selection → popup → stream → replace.

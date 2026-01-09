PRD — Mindmap Playground (Options Mode)

  Mindmap

  - Notes storage constraints (server):
      - Title max 255 chars.
      - Content max 5 MB.
      - Notes have no dedicated metadata field; only title/content plus optional backlinks (conversation_id, message_id) and keywords. Any structured mindmap metadata must be embedded in content or requires a server schema change.
  - Keywords tokenization:
      - Accepts list or comma-separated string; trims whitespace and drops empty entries.
      - Deduped case-insensitively; max length 100 chars; case-insensitive uniqueness in storage.
  - Sync scope:
      - Sync runs only while the Mindmap UI is open (no background sync in v1).

  1. Purpose & Scope

  - Add a full-screen mindmap playground to the Options UI for creating, editing, and viewing mindmaps.
  - Support multiple named maps with local-first persistence and fast offline editing.
  - Sync maps to Notes as tagged items with keyword `_*_mindmaps_*_`.
  - Import/export formats: Markdown outline, OPML, Mermaid, PNG, and SVG.
  - Core conversions: Markdown/OPML -> Mermaid.
  - Rendering library for v1: React Flow.
  - Do not add a left sidebar settings nav entry.

  2. Target Users & Use Cases

  - Target users
      - Researchers and students organizing study material into hierarchies.
      - Writers and creatives outlining plots, worlds, or character arcs.
      - Product and engineering teams clustering ideas into themes.
      - Power users already using Notes who want a visual structure layer.
  - Key use cases
      - Brainstorm from a note or chat message into a structured map.
      - Reorganize ideas with drag + keyboard, collapse branches, and keep structure clean.
      - Export a map to Markdown/OPML for use in other tools.
      - Save maps into Notes for search and cross-reference.

  3. Navigation & Entry Points

  - Mode selector entry: “Mindmap” routes to `#/mindmap`.
  - Command palette and omni search entries for Mindmap mode.
  - Add a keyboard shortcut for quick navigation.
  - Do not add to settings left sidebar navigation.

  4. Mindmap Playground Page (Layout)

  - Top bar:
      - Map name (rename inline), sync status, New, Import, Export, Undo/Redo.
      - Layout toggle (radial / horizontal / vertical / free).
  - Left in-page panel:
      - Map library with search, sort, pin, create, duplicate, delete.
  - Center canvas (React Flow):
      - Pan/zoom, drag nodes, collapse/expand, fit-to-screen, optional mini-map.
  - Right inspector:
      - Node title, notes, tags, link, color, metadata.
  - Status row:
      - Node count, last saved time, sync errors, keyboard hint.

  5. Editing & Interaction Model

  - Keyboard-first editing:
      - Enter = add sibling, Tab = add child, Shift+Tab = outdent, F2 = rename.
  - Drag to reorder/reparent nodes with live preview.
  - Collapse/expand branches; multi-select; copy/paste subtrees.
  - Undo/redo stack with “Revert to last saved” action.
  - Search and focus: find, next/previous match, spotlight mode.

  6. Data Model & Local Storage

  - Dexie table for mindmaps with indexed lookup by id and updatedAt.
  - MindmapDocument:
      - id, title, rootId, nodes, edges, layout, viewState, noteId, lastSyncedAt, updatedAt.
  - MindmapNode:
      - id, parentId, label, notes, tags, link, color, collapsed, position, sortIndex.
  - UI prefs in `useStorage`:
      - last map id, zoom, layout, panel collapsed state.
  - Save behavior:
      - Debounced saves for typing, immediate saves for structural edits.

  7. Notes Sync (Always-On with Manual Pause)

  - Always-on sync; per-map “Pause sync” toggle in toolbar.
  - Sync runs only while the Mindmap UI is open (no background sync in v1).
  - Tagged note keyword: `_*_mindmaps_*_` (used for search and discovery).
  - Note payload:
      - content: Markdown outline; may include an embedded Mindmap JSON block for full-fidelity round-trips.
      - embedded JSON fields: `mindmap_id`, `mindmap_version`, `layout`, `node_count`, `hash`, plus full document when size allows (see limits below).
  - Search/pull strategy:
      - Use Notes search endpoints with keyword tokens to find tagged notes.
      - Merge into local store; update existing maps by `mindmap_id`.
  - Update behavior:
      - If note id exists, update via PUT; otherwise create via POST and store note id.
  - Conflict handling:
      - If note updated after last sync and local map changed, prompt:
          - Keep local, Keep remote, or Duplicate (creates new map + note).

  7.1 Embedded JSON Size Strategy (in note content)

  - Target max uncompressed JSON in embedded block: 512 KB.
  - If JSON exceeds 512 KB:
      - Store compressed payload in `mindmap_json_compressed` and record
        `mindmap_json_encoding` plus `mindmap_json_bytes`.
  - If compressed JSON exceeds 1 MB:
      - Omit JSON payload; store summary metadata only.
      - Rebuild structure from Markdown outline on load; layout reflows.
  - Ensure `hash` is computed from canonical JSON for conflict detection.
  - Ensure total note content stays under server limit (5 MB).

  7.2 Tagged Notes Open Behavior

  - One note maps to one mindmap; open existing map by `mindmap_id` when present.
  - Loading rules:
      - Note has `mindmap_id` and local map exists: open map.
      - Note has `mindmap_id` but local map missing: import and recreate map.
      - Note lacks `mindmap_id` but has tag: import as new map, stamp id on next sync.
  - Provide “Open as copy” action to duplicate without overwriting.

  7.3 Embedded Mindmap JSON Block Format (v1)

  - Purpose: preserve full-fidelity map data inside note content.
  - Placement: preferred at top of note content; parser should accept any position and use the first valid block.
  - Delimiters:
      - Start: `<!-- tldw:mindmap:v1 -->`
      - End: `<!-- /tldw:mindmap -->`
      - JSON lives inside a fenced code block with language `json`.
  - JSON fields:
      - `schema_version`: `1`
      - `mindmap_id`, `mindmap_version`, `layout`, `node_count`, `hash`
      - `mindmap_json`: full MindmapDocument (uncompressed, see section 6).
      - `mindmap_json_compressed`, `mindmap_json_encoding`, `mindmap_json_bytes` when compressed.
  - If both `mindmap_json` and `mindmap_json_compressed` are present, prefer `mindmap_json`.
  - If no JSON payload is present, use the Markdown outline as the source of truth.
  - Example:
      ```text
      <!-- tldw:mindmap:v1 -->
      ~~~json
      {"schema_version":1,"mindmap_id":"mm_123","mindmap_version":1,"layout":"horizontal","node_count":3,"hash":"...","mindmap_json":{...}}
      ~~~
      <!-- /tldw:mindmap -->
      ```

  8. Import/Export

  - Import:
      - Markdown outline to new map or merge into current.
      - OPML to new map with parent-child order preserved.
      - Markdown/OPML -> Mermaid conversion for preview and export.
  - Export:
      - Markdown and OPML with optional node notes/tags.
      - Mermaid text export (auto-generated from map structure).
      - PNG and SVG with theme and size presets.
  - Round-trip fidelity:
      - Preserve labels, hierarchy, notes, tags, and links for Markdown/OPML.
      - Mermaid is structure-first; tags are optional label suffixes; layout/positions/colors/collapsed are best-effort and may reflow.
  - Quick actions:
      - “Copy as Markdown”, “Copy as OPML”, and “Copy as Mermaid”.

  8.1 Mermaid Format Spec (v1)

  - Diagram type: `mindmap` (Mermaid mindmap syntax).
  - Root node:
      - Required; uses map title if present, otherwise “Mindmap”.
  - Node labels:
      - Use plain text labels; escape quotes and newlines.
      - Do not embed HTML.
  - Edge labeling:
      - No explicit edge labels in v1; hierarchy represents parent-child.
  - Layout defaults:
      - Left-to-right if layout is "horizontal"; otherwise default Mermaid mindmap layout.
      - Use `root((...))` style for the root node only to visually distinguish.
  - Notes/tags:
      - Optional: append tags in brackets `Label [tag1, tag2]` when export option enabled.

  8.2 Mermaid Import (v1)

  - Supported syntax:
      - Only Mermaid `mindmap` blocks are accepted.
      - Ignore other Mermaid diagram types.
  - Root handling:
      - First root in the block becomes the map root.
      - If multiple roots exist, wrap them under a synthetic root labeled “Mindmap”.
  - Labels:
      - Strip Mermaid node markers like `:::` or styling directives.
      - Parse optional tag suffix `Label [tag1, tag2]` into tags when present.
  - Layout:
      - If import includes an explicit left/right indicator, map to horizontal layout.
      - Otherwise use default layout and reflow.
  - Unsupported features:
      - Edge labels, icons, emojis, and HTML are ignored or stripped.
      - Styling directives (classDef/class) are ignored in v1.

  8.3 Markdown Outline Format (v1)

  - Outline uses unordered list items with `-` (export always uses `-`; import may accept `*` or `1.` but normalizes to `-`).
  - Indentation: 2 spaces per depth level.
  - Root handling:
      - First top-level item is the root.
      - If multiple top-level items exist, wrap them under a synthetic root labeled `Mindmap` (preserve order).
  - Node line syntax:
      - `- Label {id=mm_n1; tags=tag1,tag2; link=https://example.com; color=#ff8800; collapsed=0; sort=10}`
  - Metadata suffix:
      - Optional final ` { ... }` block at end of the line.
      - Key/value pairs separated by `;`. Unknown keys are ignored for forward compatibility.
      - Values may be quoted with double quotes to include spaces or commas.
      - Escaping: use `\\{` or `\\}` in labels to avoid metadata parsing; use `\\\\` for literal backslash.
  - Notes:
      - Immediately following blockquote lines belong to the node.
      - Blockquote lines are indented to the node level + 2 spaces and start with `> `.
      - A single `>` line represents a blank line in the note.
  - Example:
      ```markdown
      - Root {id=mm_root; tags=project,plan}
        > Root note line 1
        > Root note line 2
        - Child A {id=mm_a; link=https://example.com}
          > Child note
        - Child B {id=mm_b; collapsed=1; color=#2b6cb0}
      ```

  8.4 OPML Attribute Mapping (v1)

  - Label:
      - Export: `text` attribute.
      - Import: `text` attribute is required; if missing, skip node.
  - Tags:
      - Export: `tldw_tags` as comma-separated list (trimmed, no empty tokens).
      - Import: `tldw_tags` preferred; fallback to `tags` if present.
  - Notes:
      - Export: `tldw_note` with newlines encoded as `\n` and backslashes encoded as `\\`.
      - Import: `tldw_note` preferred; fallback to `_note` or `note`; decode `\\` then `\n`.
  - Links:
      - Export: `tldw_link`.
      - Import: `tldw_link` preferred; fallback to `url` then `htmlUrl`.
  - Unknown attributes are ignored.

  9. Integrations

  - “Send to Mindmap” from chat messages, Notes, and review outputs.
  - “Open in Notes” from Mindmap (opens the synced note).
  - Omni search + command palette entries for recent maps.
  - Optional “Generate mindmap from selection” flow using chat pipeline.

  10. Non-Goals (v1)

  - Real-time multi-user collaboration.
  - Freeform drawing beyond mindmap nodes.
  - Server-side map storage beyond Notes sync.
  - Per-node font control or advanced theming systems.

  11. Implementation Plan

  - Phase 0 — Library + data model:
      - Implement React Flow node/edge model mapping.
      - Define serialization, hashing, and compression helpers.
  - Phase 1 — Route + layout scaffolding:
      - Add `#/mindmap` route and Modes bar entry.
      - Add base layout, empty state, and local persistence.
  - Phase 2 — Editing core:
      - Keyboard actions, drag/reparent, collapse/expand, undo/redo.
      - Map library (list/search/rename/duplicate/delete).
  - Phase 3 — Import/export:
      - Markdown + OPML import/export.
      - Markdown/OPML -> Mermaid conversion and Mermaid export.
      - PNG/SVG exports.
  - Phase 4 — Notes sync:
      - Always-on sync, pause toggle, pull merge, conflict flow.
      - Tagged note integration + open behavior.
  - Phase 5 — UX polish:
      - Search/focus, mini-map, accessibility, i18n, QA.

  12. QA Checklist

  - Create, rename, duplicate, delete maps; verify persistence across reloads.
  - Import/export Markdown, OPML, and Mermaid; round-trip without structural loss.
  - PNG/SVG export renders correctly for small and large maps.
  - Notes sync creates and updates tagged notes; conflict flow works.
  - Pause/resume sync behaves correctly.
  - Modes bar, command palette, and shortcut open Mindmap.

  13. Open Questions

  - Compression method choice (e.g., LZ-string vs alternative) and storage field naming.
  - Maximum PNG/SVG export dimensions for performance limits.

  14. Future (v2)

  - Background sync worker (extension background) to sync mindmaps while the UI is closed, with retry/backoff and offline queueing.

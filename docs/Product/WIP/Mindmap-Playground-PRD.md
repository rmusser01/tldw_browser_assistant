PRD — Mindmap Playground (Options Mode)

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
  - Tagged note keyword: `_*_mindmaps_*_` (used for search and discovery).
  - Note payload:
      - content: Markdown outline.
      - metadata: `keywords`, `mindmap_id`, `mindmap_version`, `layout`, `node_count`, `hash`.
      - metadata also stores JSON when size allows (see limits below).
  - Search/pull strategy:
      - Use Notes search endpoints with keyword tokens to find tagged notes.
      - Merge into local store; update existing maps by `mindmap_id`.
  - Update behavior:
      - If note id exists, update via PUT; otherwise create via POST and store note id.
  - Conflict handling:
      - If note updated after last sync and local map changed, prompt:
          - Keep local, Keep remote, or Duplicate (creates new map + note).

  7.1 Notes Metadata Size Strategy

  - Target max uncompressed JSON in metadata: 512 KB.
  - If JSON exceeds 512 KB:
      - Store compressed payload in `mindmap_json_compressed` and record
        `mindmap_json_encoding` plus `mindmap_json_bytes`.
  - If compressed JSON exceeds 1 MB:
      - Omit JSON payload; store summary metadata only.
      - Rebuild structure from Markdown outline on load; layout reflows.
  - Ensure `hash` is computed from canonical JSON for conflict detection.

  7.2 Tagged Notes Open Behavior

  - One note maps to one mindmap; open existing map by `mindmap_id` when present.
  - Loading rules:
      - Note has `mindmap_id` and local map exists: open map.
      - Note has `mindmap_id` but local map missing: import and recreate map.
      - Note lacks `mindmap_id` but has tag: import as new map, stamp id on next sync.
  - Provide “Open as copy” action to duplicate without overwriting.

  8. Import/Export

  - Import:
      - Markdown outline to new map or merge into current.
      - OPML to new map with parent-child order preserved.
      - Markdown/OPML -> Mermaid conversion for preview and export.
  - Export:
      - Markdown and OPML with optional node notes/tags.
      - Mermaid text export (auto-generated from map structure).
      - PNG and SVG with theme and size presets.
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

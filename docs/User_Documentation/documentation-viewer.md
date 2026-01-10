# Documentation Viewer (Options)

## Overview
The Documentation page is a built-in viewer for project docs. It surfaces two
doc sources inside the extension Options UI:

- tldw browser extension docs: `docs/User_Documentation`
- tldw_server docs: `docs/Published`

Each source is presented as a tab with a searchable list and a Markdown reader.

## Where to find it
- Options UI: Modes menu > Documentation
- Header shortcuts: Administration > Documentation
- Command palette: "Go to Documentation"
- Omni search: type "Documentation" or "docs"

## How it works
- Markdown files are bundled at build time with `import.meta.glob`.
- Titles come from the first H1 (`# Heading`) in the file, falling back to the
  filename when no H1 exists.
- Frontmatter (`---`) is stripped before rendering.
- Search filters the list and highlights matches in the content.

## Adding docs
1. Drop `.md` files in `docs/User_Documentation` for extension docs.
2. Drop `.md` files in `docs/Published` for tldw_server docs.
3. Reload the extension (or restart `bun dev`) to pick up changes.

Note: The viewer renders Markdown only. Avoid MDX-only features for now.

## Troubleshooting
- Empty tab: The source folder has no Markdown files or does not exist.
- Missing content after changes: Rebuild or reload the extension so bundled
  docs are refreshed.

# Accessibility Audit (Draft)

Status: in progress
Last updated: 2025-02-14

## Scope
- Main chat (Options/Playground)
- Sidepanel chat
- Settings surfaces
- Onboarding flows

## Checks
- [x] Focus-visible rings on shared Button/IconButton components.
- [x] Keyboard Shortcuts modal traps focus and restores focus on close.
- [x] Command palette is keyboard navigable (arrow keys + Esc).
- [x] Reduced-motion handling in shared utilities (`motion-reduce`).
- [ ] Icon-only buttons audited for `aria-label` coverage.
- [ ] Form labels and help text audited for proper label/ARIA associations.
- [ ] Contrast ratios validated with automated tooling (WCAG AA).
- [ ] Modal focus traps validated across all modals (not just shortcuts).
- [ ] Screen reader announcements verified for status banners/toasts.

## Notes
- Focus-visible rings are standardized in shared components (`Button`, `IconButton`).
- Keyboard shortcuts behavior is documented in `docs/shortcuts.md`.
- Automated tooling (axe/Lighthouse) has not been run yet for these surfaces.

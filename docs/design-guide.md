# Design Guide

Working guide for consistent UI across the extension (sidebar, options, dialogs). It defines tokens, components, and patterns so new screens stay aligned.

## Brand & Voice
- Personality: calm, precise, privacy-forward, technical but friendly.
- Voice: short sentences, task-first labels, avoid jargon; prefer verbs (“Save to server”, “Enable local parsing”).
- Tone variants: neutral by default; reassuring when blocking (offline/Light-mode limits); crisp in confirmations.

## Color System
CSS variables defined in `src/assets/tailwind.css`. Light theme is default.

```css
:root {
  /* Light theme (default) */
  --color-bg: #f4f2ee;
  --color-surface: #ffffff;
  --color-surface-2: #f0ede7;
  --color-elevated: #fbfaf7;
  --color-primary: #2f6fed;
  --color-primary-strong: #2456c7;
  --color-accent: #1fb59f;
  --color-success: #22a07b;
  --color-warn: #d97706;
  --color-danger: #e0586d;
  --color-muted: #667085;
  --color-border: #e2ddd3;
  --color-border-strong: #cfc8ba;
  --color-text: #1f2328;
  --color-text-muted: #5b6472;
  --color-text-subtle: #8a94a3;
  --color-focus: #1fb59f;
}
.dark {
  --color-bg: #0f1113;
  --color-surface: #171a1f;
  --color-surface-2: #1d2128;
  --color-elevated: #232832;
  --color-primary: #5c8dff;
  --color-primary-strong: #3e6ae0;
  --color-accent: #4fd1b0;
  --color-success: #3bd696;
  --color-warn: #f7b955;
  --color-danger: #ff6b8b;
  --color-muted: #9aa3b2;
  --color-border: #2b313b;
  --color-border-strong: #3b4350;
  --color-text: #e7e9ee;
  --color-text-muted: #b3bac6;
  --color-text-subtle: #9098a6;
  --color-focus: #4fd1b0;
}
```

Usage notes:
- Primary for main actions, accent for highlights/badges, warn/danger for irreversible or destructive actions.
- Maintain minimum contrast (WCAG AA).
- Reserve accent for status (Light/Heavy mode badges, inline links).
- Visual reference: open `docs/design-guide-swatches.html` in a browser to see both palettes and component samples.

## Typography
- Display/headings: `Space Grotesk`, fallback `Inter`, `sans-serif`.
- Body/UI: `Inter`, fallback `system-ui`, `sans-serif`.
- Scale (px): 12 caption / 14 label / 16 body / 18 button / 20 h5 / 24 h4 / 32 h3 / 40 h2.
- Line heights: 1.4 for body, 1.2 for headings. Keep button text uppercase only for destructive; otherwise Title Case.

## Spacing, Radius, Elevation
- Base spacing unit: 4px. Common blocks: 8/12/16/20/24.
- Corner radius: 8px default (cards, inputs); 12px for modals; 9999px for pills.
- Shadows (dark-friendly): `0 10px 30px rgba(0,0,0,0.28)` for modals, `0 6px 18px rgba(0,0,0,0.16)` for cards; in light mode reduce opacity to 0.1.

## Motion
- Durations: 120ms hover, 160ms press, 220ms toggle, 280–320ms panel/dialog entry.
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` for enter/exit; `cubic-bezier(0.33, 1, 0.68, 1)` for emphasis.
- Respect `prefers-reduced-motion`; use opacity/scale fades for mode badges and toasts.

## Components
### Buttons
- Variants: Primary (solid primary), Secondary (ghost on surface), Tertiary (text), Destructive.
- States: hover raise 2px, focus ring `var(--color-focus)` 2px, disabled 60% opacity with no shadow.
```tsx
function Button({ variant = "primary", ...props }) {
  const base = "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--color-focus)] focus-visible:ring-offset-[color:var(--color-surface)] disabled:opacity-60 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-[color:var(--color-primary)] text-[color:var(--color-surface)] hover:bg-[color:var(--color-primary-strong)] shadow-md",
    secondary: "bg-[color:var(--color-surface-2)] text-[color:var(--color-text)] border border-[color:var(--color-border)] hover:border-[color:var(--color-primary)]",
    tertiary: "text-[color:var(--color-text)] hover:text-[color:var(--color-primary)]",
    destructive: "bg-[color:var(--color-danger)] text-white hover:brightness-95"
  };
  return <button className={`${base} ${variants[variant]}`} {...props} />;
}
```

### Inputs
- Label + helper text; inline validation under field.
- Focus ring `var(--color-focus)`, background `var(--color-surface-2)`, border `var(--color-border)`.
```tsx
const field = "w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-muted)] focus:border-[color:var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-focus)]";
```

### Badges
- Use pills for Light/Heavy mode, statuses.
```tsx
const badge = "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-[color:var(--color-surface-2)] text-[color:var(--color-text)] border border-[color:var(--color-border)]";
```
Examples: Light → accent outline; Heavy → primary solid; Offline → warn border with dot.

### Cards & Sections
- Card: padding 16/20, radius 12, subtle shadow, header + body + footer actions. Use for settings groups and sidebar panels.

### Alerts/Toasts
- Inline alert: left icon, bold title, body text; color-coded border (warn/danger/success). Toasts slide from bottom, max 3 stacked.

### Tooltips/Help
- Delay 200ms, max width 260px, background `var(--color-surface-2)`, text `var(--color-text)`, radius 8.

### Toggles / Switches
- Use for binary settings (e.g., Light vs Heavy mode confirmation). Label left, toggle right; helper text below.
- On state uses primary fill + white knob; off state uses surface-2 fill + muted knob.
```tsx
const toggle = "relative inline-flex h-6 w-11 items-center rounded-full transition data-[on=true]:bg-[color:var(--color-primary)] bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)]";
```

### Selection controls
- Checkboxes for multi-select, radios for mutually exclusive options. Keep label click targets at least 40px tall.
- Validation errors inline; avoid only-color indicators.

### Dropdowns / Selects
- Use chevron icon right-aligned; menu max-height with scroll and 8px padding. Hover row uses surface-2 background; selected row uses primary tint + left accent bar.

### Tables / Lists
- Compact row height 44px, roomy 52px. Columns: left align text, right align numbers/actions. Use zebra striping only on dense data; otherwise rely on separators.

## Patterns
- **Sidebar**: top status row with badge for mode + connectivity; sections separated by subtle borders; consistent primary action at bottom or sticky footer.
- **Settings page**: two-column on desktop (nav + content); mobile stacks. Each section uses card pattern with clear primary action and secondary link.
- **Quick Ingest dialogs**: hero action (Process locally/server), secondary text with mode hint, inline errors for offline/Light gating.
- **Empty states**: icon or outlined shape + headline + 1-line helper + primary action. Mirror mode: “Processed on server” badge when Light.
- **Loading**: skeletons using `var(--color-surface-2)` shimmer; avoid spinners unless short operations (<800ms).
- **Error/Offline**: concise cause + retry; in Light mode when offline, block ingest, allow queued chats with badge “Queued until online”.
- **Mode toggle flow**: in Settings and contextual banner; confirmation modal summarizing trade-offs (permissions/bundle size vs offline).
- **Layout**:
  - Sidebar width 360–400px desktop; full-width on mobile.
  - Settings content max-width 1080px; use 12/16/24 spacing ladder between sections.
  - Dialogs width 420–540px; footer actions align right.
- **State cues**:
  - Hover raises or tints, active presses down 1–2px, disabled reduces opacity and removes shadow, loading uses spinner or progress bar inline (not full-screen).

## Accessibility
- Contrast: text/background ≥ 4.5:1; controls ≥ 3:1. Verify primary on surfaces meets AA.
- Focus: visible ring on all interactive elements, not just keyboard.
- Hit targets: minimum 40px height or 32px square.
- Keyboard: tab order, space/enter activation, escape to close dialogs; trap focus in modals.
- Motion: respect reduced-motion; no required hover-only info.

## Tokens in Tailwind
Map CSS variables to Tailwind for consistency.
```js
// tailwind.config.js excerpt
const colors = {
  bg: "var(--color-bg)",
  surface: "var(--color-surface)",
  surface2: "var(--color-surface-2)",
  primary: "var(--color-primary)",
  primaryStrong: "var(--color-primary-strong)",
  accent: "var(--color-accent)",
  success: "var(--color-success)",
  warn: "var(--color-warn)",
  danger: "var(--color-danger)",
  muted: "var(--color-muted)",
  border: "var(--color-border)",
  text: "var(--color-text)",
  textMuted: "var(--color-text-muted)",
  focus: "var(--color-focus)",
};

module.exports = {
  // ...
  theme: {
    extend: {
      colors,
      fontFamily: {
        display: ["Space Grotesk", "Inter", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        pill: "9999px",
      },
      boxShadow: {
        card: "0 6px 18px rgba(0,0,0,0.16)",
        modal: "0 10px 30px rgba(0,0,0,0.28)",
      },
    },
  },
};
```

## Content Style
- Labels: Title Case; error/helper text in sentence case.
- Mode copy examples:
  - Light badge: “Processed on server”
  - Heavy badge: “Local parsing on”
  - Offline warning: “Offline — parsing paused; chats will send when you’re back online.”
- Avoid filler like “please”; keep to 1–2 short sentences.

## Do / Don’t (quick cues)
- Do keep spacing on the 4px grid (8/12/16/24) and align controls; don’t mix arbitrary paddings that break rhythm.
- Do use primary for a single hero action; don’t stack multiple primary-colored buttons in one view.
- Do show inline, concise errors near fields; don’t rely on color alone or bury errors in toasts.
- Do show mode badges (“Processed on server” / “Local parsing on”) near actions; don’t hide mode behind menus when behavior changes.
- Do respect reduced-motion and provide focus rings; don’t gate essential info behind hover-only states.
- Visuals (from `docs/design-guide-swatches.html`):
  - Mode toggle do/don’t: `docs/images/mode-toggle-examples.png`
  - Offline alert do/don’t: `docs/images/offline-alert-examples.png`
  - Empty vs loading: `docs/images/empty-loading-examples.png`

## Iconography & Imagery
- Icons: use a consistent set (outline first) with 1.5–1.75px stroke for dark mode clarity. Standardize on `lucide-react` 20px size and `.icon` utility; avoid mixed sets.
- Status dots: 8–10px; color-coded per palette.
- Illustrations: minimal, geometric shapes; keep shadows soft and colors within palette.

## Implementation Checklist
- [ ] Use self-hosted fonts (`src/assets/fonts`), load via `src/assets/tailwind.css`; no external font CDNs.
- [ ] Extend `tailwind.config.js` with tokens from this guide.
- [ ] Apply button/input/badge/toggle utility classes to shared components (sidebar, options, dialogs).
- [ ] Wire mode badges and offline banners to actual state (Light/Heavy, connectivity).
- [ ] Run accessibility checks: focus traps for modals, badges/alerts announced to screen readers, hit areas ≥40px, reduced-motion respected.

## Component Library

The design system provides reusable UI components in `src/components/ui/`. Import from `@/components/ui`.

### Alert
Inline alerts and banners for feedback messages.
```tsx
import { Alert } from "@/components/ui"

<Alert variant="warning" title="Connection issue">
  Unable to reach server. Retrying...
</Alert>

<Alert
  variant="error"
  action={{ label: "Retry", onClick: handleRetry }}
  dismissible
  onDismiss={() => setDismissed(true)}
>
  Failed to save changes.
</Alert>
```
Variants: `info`, `success`, `warning`, `error`

### Badge
Status indicators, labels, and counts.
```tsx
import { Badge } from "@/components/ui"

<Badge variant="success">Complete</Badge>
<Badge variant="warning" dot>Pending</Badge>
<Badge variant="danger" outline>Error</Badge>
```
Variants: `primary`, `secondary`, `success`, `warning`, `danger`, `info`, `demo`

### EmptyState
Display when there's no content.
```tsx
import { EmptyState } from "@/components/ui"

<EmptyState
  icon={FileText}
  title="No documents"
  description="Upload a document to get started"
  primaryAction={{ label: "Upload", onClick: handleUpload }}
/>
```
Variants: `card` (default), `inline`, `fullPage`

### LoadingState
Unified loading indicators.
```tsx
import { LoadingState } from "@/components/ui"

<LoadingState mode="spinner" label="Loading..." />
<LoadingState mode="skeleton" rows={4} />
<LoadingState
  sources={[
    { key: "local", loading: isLocalLoading, label: "Local" },
    { key: "server", loading: isServerLoading, label: "Server" },
  ]}
  showLabels
>
  <Content />
</LoadingState>
```
Modes: `spinner`, `skeleton`, `dots`, `inline`

### ModalFooter
Standardized modal action buttons.
```tsx
import { ModalFooter } from "@/components/ui"

<Modal footer={null}>
  {/* content */}
  <ModalFooter
    primaryAction={{ label: "Save", onClick: handleSave, loading: isSaving }}
    onCancel={handleClose}
  />
</Modal>
```

## Design Tokens

Import from `@/styles/tokens` for consistent styling:
```tsx
import { spacing, fontSize, statusColors, duration } from "@/styles/tokens"
```

Available token categories:
- `spacing`, `padding`, `margin` - Layout spacing
- `fontSize`, `fontFamily`, `fontWeight` - Typography
- `statusColors`, `bgColor`, `textColor` - Colors
- `duration`, `easing`, `transition` - Motion
- `zIndex`, `container`, `touchTarget` - Layout
- `borderRadius`, `borderWidth` - Borders
- `shadow` - Elevation
- `focusRing` - Accessibility

## Ant Design vs Custom Components

| Use Ant Design | Use Custom (`@/components/ui`) |
|----------------|-------------------------------|
| Modal, Table, Form, Select | Alert, Badge, EmptyState |
| DatePicker, Tabs, Tooltip | LoadingState, ModalFooter |
| Dropdown, ConfigProvider | Button, IconButton (in Common/) |

**Rationale**: Use Ant Design for complex accessibility (focus trap, virtual scroll). Use custom for simple components matching our design tokens.

## Changelog
- v0.2: Added Component Library section, synced colors with tailwind.css, added design tokens reference
- v0.1 (draft): Foundations, tokens, component and pattern guidance for Light/Heavy flows.

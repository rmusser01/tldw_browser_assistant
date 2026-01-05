# PRD: Design System for tldw Assistant

**Status**: Draft
**Author**: Engineering
**Created**: January 2026
**Last Updated**: January 2026

---

## 1. Executive Summary

This PRD outlines the implementation of a comprehensive design system for the tldw Assistant browser extension. The design system will document existing patterns, create new standardized components, and establish clear guidelines for UI development while maintaining the hybrid Ant Design + custom TailwindCSS approach.

### Goals
1. Reduce code duplication by consolidating scattered UI patterns into reusable components
2. Improve consistency across the extension's UI (sidepanel, options page, modals)
3. Make existing design tokens actually usable (currently 0 imports)
4. Sync documentation with implementation (color palettes differ)
5. Establish clear guidelines for when to use Ant Design vs custom components

### Non-Goals
- Complete replacement of Ant Design (we maintain hybrid approach)
- Redesigning existing well-built components (Button, IconButton, etc.)
- Building a full component library from scratch

---

## 2. Background

### Current State Analysis

The codebase was analyzed and the following issues were identified:

| Issue | Evidence | Impact |
|-------|----------|--------|
| **design-tokens.ts unused** | 0 imports found in codebase | Tokens exist but provide no value |
| **Color palette mismatch** | `design-guide.md`: purple (#7c5dff), `tailwind.css`: blue (#2f6fed) | Docs don't match implementation |
| **Scattered alert patterns** | 20+ instances of `bg-{color}/10 border-{color}` across files | Inconsistent, verbose styling |
| **Custom modal footers** | 23 files use `footer={null}` with custom implementations | Repeated boilerplate |
| **Multiple loading patterns** | Mix of Spin, Skeleton, Loader2, UnifiedLoadingState | Inconsistent loading UX |
| **Multiple empty states** | FeatureEmptyState, PlaygroundEmpty, EmptySidePanel | 3+ different patterns |

### Existing Assets

**Well-designed components to preserve** (in `src/components/Common/`):
- `Button.tsx` - Variants, forwardRef, accessibility, motion-reduce support
- `IconButton.tsx` - 44px touch targets, full ARIA support
- `SettingRow.tsx` / `SettingGroup.tsx` - Domain-specific settings UI
- `SaveButton.tsx` - Saving → Saved state machine
- `Markdown.tsx` - Complex rendering with plugins

**Existing design foundations**:
- `src/styles/design-tokens.ts` - Spacing, colors, focus rings, badges (unused)
- `src/assets/tailwind.css` - CSS variables for light/dark themes
- `tailwind.config.js` - Custom color mappings, typography, shadows
- `docs/design-guide.md` - Brand voice, patterns, accessibility guidelines

---

## 3. Requirements

### 3.1 Functional Requirements

#### Component Library

**New components to create**:

| Component | Purpose | Replaces |
|-----------|---------|----------|
| `Alert` | Inline alerts/banners with actions | Scattered `bg-{color}/10 border-{color}` patterns (20+ instances) |
| `Badge` | Extended status badge variants | StatusBadge (only has demo/warning/error) |
| `EmptyState` | Unified empty state | FeatureEmptyState, PlaygroundEmpty, EmptySidePanel |
| `LoadingState` | Unified loading states | UnifiedLoadingState, Spin, Skeleton, Loader2 |
| `ModalFooter` | Standard modal footer layout | Custom footers (23 files) |
| `ConfirmDialog` | Extended confirmation hook | useConfirmDanger (only supports danger) |
| `Card` | Container primitive | Scattered card patterns |
| `Stack` | Flex container helper | Manual flex layouts |

**Component directory structure**:
```
src/components/ui/
  primitives/
    Alert.tsx
    Badge.tsx
    Card.tsx
    index.ts
  feedback/
    EmptyState.tsx
    LoadingState.tsx
    ConfirmDialog.tsx
    index.ts
  layout/
    ModalFooter.tsx
    Stack.tsx
    index.ts
  index.ts
```

#### Design Tokens

**Token reorganization**:
```
src/styles/
  tokens/
    index.ts           # Re-exports all tokens
    colors.ts          # Semantic color tokens
    typography.ts      # Font families, sizes, line heights
    spacing.ts         # Gap, padding, margin tokens
    layout.ts          # Z-index, breakpoints, containers
    motion.ts          # Duration, easing, transitions
    borders.ts         # Radius, widths
    shadows.ts         # Elevation levels
  design-tokens.ts     # Keep for backward compat, re-exports from tokens/
```

**Missing tokens to add**:

Typography (from design-guide.md scale):
- caption: 12px
- label: 11px
- body: 14px
- message: 15px
- h5: 20px
- h4: 24px
- h3: 32px
- h2: 40px

Motion:
- hover: 120ms
- press: 160ms
- toggle: 220ms
- panel: 300ms

Z-index scale:
- dropdown: 10
- sticky: 20
- modal: 50
- tooltip: 50
- toast: 60

#### Documentation

**Updates required**:
- `docs/design-guide.md` - Sync colors to match tailwind.css, add component usage section
- `docs/design-system/patterns.md` (new) - Form, modal, layout, feedback patterns
- `docs/design-system/ant-design-integration.md` (new) - When to use which

### 3.2 Technical Requirements

#### Component API Standards

All new components must follow these patterns (based on existing Button.tsx):

```typescript
// 1. Use forwardRef for DOM elements
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (props, ref) => { ... }
)
Alert.displayName = 'Alert'

// 2. Consistent prop naming
interface AlertProps {
  variant: 'info' | 'success' | 'warning' | 'error'  // Visual variant
  size?: 'sm' | 'md' | 'lg'                          // Size scale
  className?: string                                  // Style override
  'data-testid'?: string                             // Testing
}

// 3. Action object pattern
action?: {
  label: string
  onClick: () => void
  loading?: boolean
  disabled?: boolean
}

// 4. Default props via destructuring
function Alert({ variant = 'info', size = 'md', ...props }: AlertProps) {}

// 5. Motion-reduce support
className="transition-colors duration-150 motion-reduce:transition-none"

// 6. Focus visible styling
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
```

#### Ant Design vs Custom Guidelines

| Use Ant Design | Use Custom |
|----------------|------------|
| Modal, Table, Form, Select, DatePicker, Tabs, Tooltip, Dropdown | Button, IconButton, Badge, Alert, Card, EmptyState, LoadingState |
| Complex accessibility (focus trap, virtual scroll) | Simple presentational components |
| Components requiring extensive configuration | Components matching our design tokens |

### 3.3 Accessibility Requirements

- All interactive elements: visible focus ring
- Touch targets: minimum 44px height (mobile)
- Color contrast: WCAG AA (4.5:1 text, 3:1 controls)
- Motion: respect `prefers-reduced-motion`
- ARIA: proper labels, roles, and states

---

## 4. Design Specifications

### 4.1 Alert Component

**Current pattern** (scattered, inconsistent):
```tsx
// MarkdownErrorBoundary.tsx:49
<div className="flex items-start gap-2 rounded-md border border-warn/30 bg-warn/10 p-3 text-sm text-text">

// QuickChatHelperModal.tsx:80-81
className={isGood
  ? "border-success/30 bg-success/10 text-success"
  : "border-warn/30 bg-warn/10 text-warn"}

// ServerConnectionCard.tsx:756
<div className="mt-1 w-full max-w-md rounded-2xl bg-danger/10 px-3 py-3 text-left text-[11px] text-danger">
```

**Proposed unified component**:
```tsx
interface AlertProps {
  variant: 'info' | 'success' | 'warning' | 'error'
  title?: React.ReactNode
  children: React.ReactNode
  icon?: React.ReactNode
  action?: { label: string; onClick: () => void; loading?: boolean }
  secondaryAction?: { label: string; onClick: () => void }
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
}

// Usage
<Alert variant="warning" title="Connection issue">
  Unable to reach server. Retrying...
</Alert>

<Alert
  variant="error"
  action={{ label: "Retry", onClick: handleRetry, loading: isRetrying }}
  dismissible
  onDismiss={() => setDismissed(true)}
>
  Failed to save changes.
</Alert>
```

### 4.2 Design Tokens Update

**Current** (uses hardcoded Tailwind colors):
```typescript
success: {
  bg: "bg-green-100 dark:bg-green-900/30",
  text: "text-green-600 dark:text-green-400",
  border: "border-green-200 dark:border-green-800"
}
```

**Proposed** (uses semantic CSS variables):
```typescript
success: {
  bg: "bg-success/10",
  text: "text-success",
  border: "border-success/30"
}
```

---

## 5. Implementation Plan

### Phase 1: Foundation (Priority: High)

| Task | Files | Effort |
|------|-------|--------|
| Create `src/components/ui/` directory structure | New directories + index.ts files | S |
| Implement Alert component | `ui/primitives/Alert.tsx` | M |
| Reorganize design tokens | `src/styles/tokens/*.ts` | M |
| Add missing tokens (typography, motion, z-index) | `src/styles/tokens/*.ts` | S |
| Update design-tokens.ts to use semantic colors | `src/styles/design-tokens.ts` | S |

### Phase 2: Components (Priority: High)

| Task | Files | Effort |
|------|-------|--------|
| Implement Badge component (extend StatusBadge) | `ui/primitives/Badge.tsx` | S |
| Implement ModalFooter component | `ui/layout/ModalFooter.tsx` | S |
| Implement Card component | `ui/primitives/Card.tsx` | S |
| Implement EmptyState (consolidate patterns) | `ui/feedback/EmptyState.tsx` | M |
| Implement LoadingState (wrap UnifiedLoadingState) | `ui/feedback/LoadingState.tsx` | M |

### Phase 3: Documentation (Priority: Medium)

| Task | Files | Effort |
|------|-------|--------|
| Sync design-guide.md colors with tailwind.css | `docs/design-guide.md` | S |
| Add component usage section | `docs/design-guide.md` | S |
| Create Ant Design integration guide | `docs/design-system/ant-design-integration.md` | M |
| Create patterns documentation | `docs/design-system/patterns.md` | M |

### Phase 4: Migration (Priority: Low)

| Task | Files | Effort |
|------|-------|--------|
| Migrate 5 alert patterns | Various Common/ files | M |
| Migrate 5 modal footers | Various modal files | M |
| Import tokens in StatusBadge | `StatusBadge.tsx` | S |

### Implementation Order

1. **Alert component** - Highest impact, most scattered pattern (20+ instances)
2. **Design tokens reorganization** - Foundation for consistency
3. **Badge component** - Quick win, extends existing
4. **ModalFooter component** - Standardizes 23 modals
5. **EmptyState component** - Consolidates 3+ implementations
6. **LoadingState component** - Unifies loading patterns
7. **Documentation updates** - Captures decisions
8. **Migration of 3-5 existing usages** per component

---

## 6. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| design-tokens.ts imports | 0 | 10+ |
| Scattered alert patterns | 20+ | 5 (legacy) |
| Custom modal footers | 23 | 10 (legacy) |
| Empty state implementations | 3+ | 1 (unified) |
| Loading state implementations | 4 | 1 (unified) |

---

## 7. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing components | Medium | High | New ui/ directory, don't modify existing Common/ |
| Scope creep | High | Medium | Strict prioritization, Phase 4 migration is optional |
| Inconsistent adoption | Medium | Medium | Clear documentation, lint rules for new code |

---

## 8. Appendix

### A. Files to Modify

- `src/styles/design-tokens.ts` - Extend with missing tokens, fix colors
- `tailwind.config.js` - Add missing typography/motion extensions
- `docs/design-guide.md` - Sync colors, add component usage section

### B. Files to Create

- `src/components/ui/primitives/Alert.tsx`
- `src/components/ui/primitives/Badge.tsx`
- `src/components/ui/primitives/Card.tsx`
- `src/components/ui/feedback/EmptyState.tsx`
- `src/components/ui/feedback/LoadingState.tsx`
- `src/components/ui/layout/ModalFooter.tsx`
- `src/components/ui/layout/Stack.tsx`
- `src/components/ui/index.ts` (barrel export)
- `src/styles/tokens/*.ts` (modular token files)
- `docs/design-system/ant-design-integration.md`
- `docs/design-system/patterns.md`

### C. Reference Components

- `src/components/Common/Button.tsx` - forwardRef, variants, accessibility pattern
- `src/components/Common/FeatureEmptyState.tsx` - empty state pattern
- `src/components/Common/UnifiedLoadingState.tsx` - loading pattern

### D. Alert Migration Targets

Priority files for Alert component migration:
1. `src/components/Common/MarkdownErrorBoundary.tsx:49` - error display
2. `src/components/Common/ServerConnectionCard.tsx:756` - connection errors
3. `src/components/Common/QuickChatHelper/QuickChatHelperModal.tsx:80` - status
4. `src/components/Media/FilterPanel.tsx:113` - filter warnings
5. `src/components/Review/MediaReviewPage.tsx:666` - info banners

### E. Modal Footer Migration Targets

Priority files for ModalFooter component migration:
1. `src/components/Common/ShareModal.tsx`
2. `src/components/Common/QuickIngestModal.tsx`
3. `src/components/Sidepanel/Chat/FeedbackModal.tsx`
4. `src/components/Option/Models/AddUpdateModelSettings.tsx`
5. `src/components/Agent/SessionRestoreDialog.tsx`

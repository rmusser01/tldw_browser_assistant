/**
 * Design Tokens - Shared constants for consistent UX
 *
 * This file centralizes design decisions to ensure visual consistency
 * across the extension. Import and use these tokens instead of
 * hardcoding Tailwind classes.
 */

// =============================================================================
// SPACING TOKENS
// =============================================================================

/**
 * Standard gap values for flex/grid layouts
 * Use these instead of arbitrary gap-* values
 */
export const spacing = {
  /** 4px - Tight spacing for inline elements */
  xs: "gap-1",
  /** 6px - Compact spacing for dense UIs */
  sm: "gap-1.5",
  /** 8px - Default spacing for most layouts */
  md: "gap-2",
  /** 12px - Comfortable spacing for sections */
  lg: "gap-3",
  /** 16px - Spacious layouts */
  xl: "gap-4",
} as const

/**
 * Standard padding values
 */
export const padding = {
  xs: "p-1",
  sm: "p-1.5",
  md: "p-2",
  lg: "p-3",
  xl: "p-4",
} as const

// =============================================================================
// TOUCH TARGETS
// =============================================================================

/**
 * Minimum touch target size for mobile accessibility
 * WCAG 2.1 recommends 44x44px minimum for touch targets
 */
export const touchTarget = {
  /** Minimum size for mobile touch targets */
  min: "min-h-[44px] min-w-[44px]",
  /** Mobile-only minimum (resets on desktop) */
  mobile: "min-h-[44px] sm:min-h-0",
} as const

// =============================================================================
// STATUS COLORS
// =============================================================================

/**
 * Status indicator colors with accessible text labels
 * Always pair colors with text labels for accessibility
 */
export const statusColors = {
  pending: {
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200 dark:border-gray-700",
    label: "Pending",
  },
  running: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    label: "Running",
  },
  success: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-600 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
    label: "Complete",
  },
  error: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    label: "Error",
  },
  warning: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-400",
    border: "border-yellow-200 dark:border-yellow-800",
    label: "Warning",
  },
} as const

export type StatusType = keyof typeof statusColors

// =============================================================================
// FOCUS STYLES
// =============================================================================

/**
 * Standard focus ring for keyboard navigation
 * Apply to all interactive elements
 */
export const focusRing = {
  /** Default pink focus ring matching brand */
  default:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900",
  /** Inset focus ring for elements with borders */
  inset:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink-500",
  /** Subtle focus for less prominent elements */
  subtle:
    "focus:outline-none focus-visible:ring-1 focus-visible:ring-pink-500/50",
} as const

// =============================================================================
// TEMPORARY CHAT INDICATOR
// =============================================================================

/**
 * Unified colors for temporary/ephemeral chat indicator
 * Use purple consistently across all components
 */
export const temporaryChatIndicator = {
  /** Light mode background */
  light: "bg-purple-50",
  /** Dark mode background */
  dark: "dark:bg-purple-900/30",
  /** Combined class for both modes */
  combined: "bg-purple-50 dark:bg-purple-900/30",
  /** Border color to match */
  border: "border-purple-200 dark:border-purple-800",
  /** Text color to match */
  text: "text-purple-700 dark:text-purple-300",
} as const

// =============================================================================
// BUTTON VARIANTS
// =============================================================================

/**
 * Standard button base classes
 */
export const buttonBase =
  "inline-flex items-center justify-center rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"

/**
 * Button size variants
 */
export const buttonSize = {
  sm: "px-2 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-base",
} as const

/**
 * Icon button (square, icon-only)
 */
export const iconButton = {
  sm: "p-1 rounded",
  md: "p-1.5 rounded",
  lg: "p-2 rounded",
} as const

// =============================================================================
// BADGE STYLES
// =============================================================================

/**
 * Notification badge styles for tabs/buttons
 * Use consistently for count indicators
 */
export const badge = {
  /** Primary badge (blue) - for important counts */
  primary: "px-1.5 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
  /** Secondary badge (gray) - for less important counts */
  secondary: "px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  /** Warning badge (yellow) - for pending actions */
  warning: "px-1.5 py-0.5 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300",
  /** Danger badge (red) - for errors/alerts */
  danger: "px-1.5 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300",
} as const

// =============================================================================
// APPROVAL CATEGORIES
// =============================================================================

/**
 * User-friendly labels for approval categories
 * Map internal names to display names
 */
export const approvalCategoryLabels: Record<string, string> = {
  writes: "File Changes",
  deletes: "Deletions",
  git: "Git Operations",
  exec: "Commands",
  read: "File Access",
  notebook: "Notebook Edits",
} as const

// =============================================================================
// CONTRAST-SAFE TEXT COLORS
// =============================================================================

/**
 * Text colors that meet WCAG AA contrast requirements
 * Use instead of arbitrary gray values
 */
export const textColors = {
  /** Primary text - high contrast */
  primary: "text-gray-900 dark:text-gray-100",
  /** Secondary text - medium contrast */
  secondary: "text-gray-700 dark:text-gray-300",
  /** Muted text - still readable but subdued */
  muted: "text-gray-500 dark:text-gray-400",
  /** Placeholder/hint text - minimum contrast */
  hint: "text-gray-400 dark:text-gray-500",
} as const

// =============================================================================
// ICON SIZES
// =============================================================================

/**
 * Standard icon sizes using Tailwind's size utility
 */
export const iconSize = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
  xl: "size-6",
} as const

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get status indicator classes including accessible label
 */
export function getStatusClasses(status: StatusType) {
  return statusColors[status]
}

/**
 * Combine focus ring with other interactive element classes
 */
export function withFocusRing(classes: string, variant: keyof typeof focusRing = "default") {
  return `${classes} ${focusRing[variant]}`
}

/**
 * Color Tokens
 *
 * Semantic color classes that map to CSS variables defined in tailwind.css.
 * These provide consistent theming across light and dark modes.
 *
 * Note: Actual color values are in src/assets/tailwind.css
 */

/**
 * Background colors
 */
export const bgColor = {
  /** Page background */
  base: "bg-bg",
  /** Card/panel surface */
  surface: "bg-surface",
  /** Secondary surface (inputs, hover states) */
  surface2: "bg-surface2",
  /** Elevated elements (popovers, dropdowns) */
  elevated: "bg-elevated",
} as const

/**
 * Text colors meeting WCAG AA contrast requirements
 */
export const textColor = {
  /** Primary text - highest contrast */
  primary: "text-text",
  /** Muted text - secondary information */
  muted: "text-text-muted",
  /** Subtle text - tertiary information */
  subtle: "text-text-subtle",
} as const

/**
 * Border colors
 */
export const borderColor = {
  /** Default border */
  default: "border-border",
  /** Strong/emphasized border */
  strong: "border-borderStrong",
} as const

/**
 * Status colors - use for feedback and state indication
 * Always pair with text labels for accessibility
 */
export const statusColors = {
  pending: {
    bg: "bg-muted/10",
    text: "text-muted",
    border: "border-muted/30",
    label: "Pending",
  },
  running: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/30",
    label: "Running",
  },
  success: {
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/30",
    label: "Complete",
  },
  error: {
    bg: "bg-danger/10",
    text: "text-danger",
    border: "border-danger/30",
    label: "Error",
  },
  warning: {
    bg: "bg-warn/10",
    text: "text-warn",
    border: "border-warn/30",
    label: "Warning",
  },
  info: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/30",
    label: "Info",
  },
} as const

/**
 * Temporary/ephemeral chat indicator colors
 */
export const temporaryChatIndicator = {
  bg: "bg-purple-50 dark:bg-purple-900/30",
  border: "border-purple-200 dark:border-purple-800",
  text: "text-purple-700 dark:text-purple-300",
} as const

export type StatusType = keyof typeof statusColors

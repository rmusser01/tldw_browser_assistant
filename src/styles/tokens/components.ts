/**
 * Component Tokens
 *
 * Pre-composed class combinations for common components.
 * These provide consistent styling patterns.
 */

/**
 * Button base classes
 */
export const buttonBase =
  "inline-flex items-center justify-center rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"

/**
 * Button size variants
 */
export const buttonSize = {
  sm: "px-2 py-1 text-xs min-h-[28px]",
  md: "px-3 py-1.5 text-sm min-h-[36px]",
  lg: "px-4 py-2 text-base min-h-[44px]",
} as const

/**
 * Icon button sizes (square, icon-only)
 */
export const iconButton = {
  sm: "p-1 rounded",
  md: "p-1.5 rounded",
  lg: "p-2 rounded",
} as const

/**
 * Icon sizes
 */
export const iconSize = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
  xl: "size-6",
} as const

/**
 * Badge variants
 */
export const badge = {
  /** Primary badge (uses primary color) */
  primary:
    "px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium",
  /** Secondary badge (muted) */
  secondary:
    "px-1.5 py-0.5 text-xs rounded-full bg-surface2 text-text-muted font-medium",
  /** Success badge */
  success:
    "px-1.5 py-0.5 text-xs rounded-full bg-success/10 text-success font-medium",
  /** Warning badge */
  warning:
    "px-1.5 py-0.5 text-xs rounded-full bg-warn/10 text-warn font-medium",
  /** Danger/error badge */
  danger:
    "px-1.5 py-0.5 text-xs rounded-full bg-danger/10 text-danger font-medium",
  /** Info badge */
  info: "px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium",
} as const

/**
 * Input field base classes
 */
export const inputBase =
  "w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus"

/**
 * Card container classes
 */
export const cardBase =
  "rounded-xl border border-border bg-surface p-4 shadow-card"

export type ButtonSize = keyof typeof buttonSize
export type IconSize = keyof typeof iconSize
export type BadgeVariant = keyof typeof badge

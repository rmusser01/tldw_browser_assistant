/**
 * Border Tokens
 *
 * Border radius, widths, and styles.
 */

/**
 * Border radius values
 */
export const borderRadius = {
  /** No rounding */
  none: "rounded-none",
  /** 2px - Subtle rounding */
  sm: "rounded-sm",
  /** 4px - Default rounding */
  default: "rounded",
  /** 6px - Medium rounding */
  md: "rounded-md",
  /** 8px - Standard for inputs, buttons */
  lg: "rounded-lg",
  /** 12px - Cards, panels */
  xl: "rounded-xl",
  /** 16px - Large cards */
  "2xl": "rounded-2xl",
  /** 24px - Extra large */
  "3xl": "rounded-3xl",
  /** 9999px - Pills, tags */
  full: "rounded-full",
  /** 12px - Alias for cards (from tailwind.config.js) */
  card: "rounded-card",
  /** 9999px - Alias for pills (from tailwind.config.js) */
  pill: "rounded-pill",
} as const

/**
 * Border widths
 */
export const borderWidth = {
  /** No border */
  none: "border-0",
  /** 1px - Default border */
  default: "border",
  /** 2px - Emphasized border */
  2: "border-2",
  /** 4px - Heavy border */
  4: "border-4",
} as const

/**
 * Border styles
 */
export const borderStyle = {
  solid: "border-solid",
  dashed: "border-dashed",
  dotted: "border-dotted",
  none: "border-none",
} as const

export type BorderRadius = keyof typeof borderRadius
export type BorderWidth = keyof typeof borderWidth

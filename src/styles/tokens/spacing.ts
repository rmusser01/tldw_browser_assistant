/**
 * Spacing Tokens
 *
 * Standard spacing values based on a 4px grid system.
 * Use these instead of arbitrary Tailwind values for consistency.
 */

/**
 * Gap values for flex/grid layouts
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
  /** 24px - Major section spacing */
  "2xl": "gap-6",
} as const

/**
 * Padding values
 */
export const padding = {
  xs: "p-1",
  sm: "p-1.5",
  md: "p-2",
  lg: "p-3",
  xl: "p-4",
  "2xl": "p-6",
} as const

/**
 * Padding X (horizontal)
 */
export const paddingX = {
  xs: "px-1",
  sm: "px-1.5",
  md: "px-2",
  lg: "px-3",
  xl: "px-4",
  "2xl": "px-6",
} as const

/**
 * Padding Y (vertical)
 */
export const paddingY = {
  xs: "py-1",
  sm: "py-1.5",
  md: "py-2",
  lg: "py-3",
  xl: "py-4",
  "2xl": "py-6",
} as const

/**
 * Margin values
 */
export const margin = {
  xs: "m-1",
  sm: "m-1.5",
  md: "m-2",
  lg: "m-3",
  xl: "m-4",
  "2xl": "m-6",
} as const

export type SpacingSize = keyof typeof spacing

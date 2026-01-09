/**
 * Shadow Tokens
 *
 * Elevation levels for depth and hierarchy.
 * Custom shadows are defined in tailwind.config.js
 */

/**
 * Shadow/elevation levels
 */
export const shadow = {
  /** No shadow */
  none: "shadow-none",
  /** Subtle shadow for slight elevation */
  sm: "shadow-sm",
  /** Default shadow */
  default: "shadow",
  /** Medium shadow */
  md: "shadow-md",
  /** Large shadow */
  lg: "shadow-lg",
  /** Extra large shadow */
  xl: "shadow-xl",
  /** Card shadow - 0 6px 18px rgba(0,0,0,0.16) */
  card: "shadow-card",
  /** Modal shadow - 0 10px 30px rgba(0,0,0,0.28) */
  modal: "shadow-modal",
} as const

/**
 * Inner shadows (inset)
 */
export const innerShadow = {
  none: "shadow-none",
  default: "shadow-inner",
} as const

export type Shadow = keyof typeof shadow

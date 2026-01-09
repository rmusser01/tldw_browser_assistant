/**
 * Typography Tokens
 *
 * Font families, sizes, and weights for consistent typography.
 * Based on the design-guide.md scale.
 */

/**
 * Font families
 * - display: Space Grotesk - for headings and display text
 * - body: Inter - for body text and UI
 * - ui: Arimo - default UI font
 * - mono: System monospace - for code
 */
export const fontFamily = {
  display: "font-display",
  body: "font-body",
  ui: "font-arimo",
  mono: "font-mono",
} as const

/**
 * Font sizes with appropriate line heights
 * Maps to custom Tailwind classes defined in tailwind.config.js
 */
export const fontSize = {
  /** 11px - Labels, very small text */
  label: "text-label",
  /** 12px - Captions, helper text */
  caption: "text-caption",
  /** 14px - Body text (default) */
  body: "text-body",
  /** 15px - Message text, slightly larger body */
  message: "text-message",
  /** 16px - Large body text */
  lg: "text-base",
  /** 18px - Small heading / button text */
  h5: "text-lg",
  /** 20px - Section heading */
  h4: "text-xl",
  /** 24px - Page section heading */
  h3: "text-2xl",
  /** 32px - Major heading */
  h2: "text-[32px]",
  /** 40px - Page title */
  h1: "text-[40px]",
} as const

/**
 * Font weights
 */
export const fontWeight = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
} as const

/**
 * Line heights
 */
export const lineHeight = {
  tight: "leading-tight",
  snug: "leading-snug",
  normal: "leading-normal",
  relaxed: "leading-relaxed",
} as const

/**
 * Letter spacing
 */
export const letterSpacing = {
  tight: "tracking-tight",
  normal: "tracking-normal",
  wide: "tracking-wide",
  wider: "tracking-wider",
} as const

export type FontSize = keyof typeof fontSize
export type FontWeight = keyof typeof fontWeight

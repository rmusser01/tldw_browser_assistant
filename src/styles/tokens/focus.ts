/**
 * Focus Tokens
 *
 * Focus ring styles for accessibility.
 * All interactive elements should have visible focus indicators.
 */

/**
 * Focus ring variants
 */
export const focusRing = {
  /** Default focus ring - uses --color-focus from CSS variables */
  default:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
  /** Inset focus ring - for elements with borders */
  inset:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus",
  /** Subtle focus ring - for less prominent elements */
  subtle: "focus:outline-none focus-visible:ring-1 focus-visible:ring-focus/50",
  /** Primary color focus ring */
  primary:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
  /** No focus ring (use sparingly, ensure alternative focus indicator) */
  none: "focus:outline-none",
} as const

/**
 * Combine focus ring with other classes
 * @param classes - Base classes
 * @param variant - Focus ring variant (default: "default")
 * @returns Combined class string
 */
export function withFocusRing(
  classes: string,
  variant: keyof typeof focusRing = "default"
): string {
  return `${classes} ${focusRing[variant]}`
}

export type FocusRing = keyof typeof focusRing

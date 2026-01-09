/**
 * Motion Tokens
 *
 * Animation durations, easings, and transitions.
 * Based on design-guide.md motion specifications.
 *
 * All animations should respect prefers-reduced-motion.
 */

/**
 * Duration values for different interaction types
 */
export const duration = {
  /** 0ms - Instant, no animation */
  instant: "duration-0",
  /** 100ms - Very fast micro-interactions */
  fast: "duration-100",
  /** 120ms - Hover effects */
  hover: "duration-[120ms]",
  /** 150ms - Default transitions */
  normal: "duration-150",
  /** 160ms - Press/tap feedback */
  press: "duration-[160ms]",
  /** 200ms - Standard animations */
  default: "duration-200",
  /** 220ms - Toggle switches */
  toggle: "duration-[220ms]",
  /** 300ms - Panel/dialog entry */
  slow: "duration-300",
  /** 500ms - Complex animations */
  slower: "duration-500",
} as const

/**
 * Easing functions
 */
export const easing = {
  /** Default ease-out for most transitions */
  default: "ease-out",
  /** Linear for progress indicators */
  linear: "ease-linear",
  /** Ease-in-out for symmetric animations */
  inOut: "ease-in-out",
  /** Enter/exit animations - smooth deceleration */
  enter: "[transition-timing-function:cubic-bezier(0.4,0,0.2,1)]",
  /** Emphasis animations - more pronounced */
  emphasis: "[transition-timing-function:cubic-bezier(0.33,1,0.68,1)]",
} as const

/**
 * Pre-composed transition classes
 */
export const transition = {
  /** Color transitions (hover states) */
  colors: "transition-colors duration-150 ease-out",
  /** Opacity transitions (fade in/out) */
  opacity: "transition-opacity duration-200 ease-out",
  /** Transform transitions (scale, translate) */
  transform: "transition-transform duration-200 ease-out",
  /** All properties */
  all: "transition-all duration-200 ease-out",
  /** None - disable transitions */
  none: "transition-none",
} as const

/**
 * Reduced motion utilities - use to respect user preferences
 */
export const motionSafe = {
  /** Disable transitions when reduced motion is preferred */
  transition: "motion-reduce:transition-none",
  /** Disable animations when reduced motion is preferred */
  animation: "motion-reduce:animate-none",
} as const

export type Duration = keyof typeof duration
export type Easing = keyof typeof easing

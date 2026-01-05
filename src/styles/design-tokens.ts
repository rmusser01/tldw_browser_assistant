/**
 * Design Tokens - Shared constants for consistent UX
 *
 * This file re-exports from modular token files for backward compatibility.
 * For new code, import directly from "@/styles/tokens" for better tree-shaking.
 *
 * @example
 * ```tsx
 * // Preferred - import from tokens
 * import { spacing, statusColors } from "@/styles/tokens"
 *
 * // Legacy - still works
 * import { spacing, statusColors } from "@/styles/design-tokens"
 * ```
 */

// Re-export everything from modular tokens
export * from "./tokens"

// =============================================================================
// LEGACY EXPORTS (for backward compatibility)
// =============================================================================

// Re-export specific items that may have different names in the new structure
import { statusColors as newStatusColors, type StatusType } from "./tokens"

/**
 * @deprecated Use statusColors from "@/styles/tokens" instead
 */
export const statusColors = newStatusColors
export type { StatusType }

/**
 * Get status indicator classes including accessible label
 * @deprecated Use statusColors directly from "@/styles/tokens"
 */
export function getStatusClasses(status: StatusType) {
  return newStatusColors[status]
}

// =============================================================================
// APPROVAL CATEGORIES (domain-specific, kept here)
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
  other: "Other",
} as const

// =============================================================================
// LEGACY TEXT COLORS (for backward compatibility)
// =============================================================================

/**
 * Text colors that meet WCAG AA contrast requirements
 * @deprecated Use textColor from "@/styles/tokens" instead
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

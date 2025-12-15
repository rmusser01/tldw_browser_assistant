import React, { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/libs/utils"

export interface SettingGroupProps {
  /** Group title */
  title: string
  /** Optional description for the group */
  description?: string
  /** Whether the group is expanded by default */
  defaultExpanded?: boolean
  /** Whether the group can be collapsed */
  collapsible?: boolean
  /** Icon to show before the title */
  icon?: React.ReactNode
  /** Child setting rows */
  children: React.ReactNode
  /** Additional class names */
  className?: string
  /** Number of modified settings in this group (for badge) */
  modifiedCount?: number
}

/**
 * A collapsible group container for related settings.
 * Used to organize settings into logical sections.
 */
export function SettingGroup({
  title,
  description,
  defaultExpanded = true,
  collapsible = true,
  icon,
  children,
  className,
  modifiedCount,
}: SettingGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const handleToggle = () => {
    if (collapsible) {
      setExpanded((prev) => !prev)
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 mb-4",
        className
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={!collapsible}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left",
          collapsible && "hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer",
          !collapsible && "cursor-default",
          expanded && "border-b border-gray-200 dark:border-gray-700"
        )}
        aria-expanded={expanded}
      >
        {/* Collapse indicator */}
        {collapsible && (
          <span className="text-gray-400">
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </span>
        )}

        {/* Icon */}
        {icon && (
          <span className="text-gray-500 dark:text-gray-400">{icon}</span>
        )}

        {/* Title and description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              {title}
            </h3>
            {modifiedCount !== undefined && modifiedCount > 0 && (
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                {modifiedCount} modified
              </span>
            )}
          </div>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {description}
            </p>
          )}
        </div>

        {/* Collapsed indicator */}
        {collapsible && !expanded && (
          <span className="text-xs text-gray-400">
            Click to expand
          </span>
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-4 py-2">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * A simpler inline group without border/card styling.
 * Good for sub-grouping within a SettingGroup.
 */
export function SettingSubgroup({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mt-4 first:mt-0", className)}>
      <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 px-1">
        {title}
      </h4>
      <div>{children}</div>
    </div>
  )
}

export default SettingGroup

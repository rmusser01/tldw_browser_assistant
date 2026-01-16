import React from "react"
import { Tooltip } from "antd"
import { Info, RotateCcw } from "lucide-react"
import { cn } from "@/libs/utils"

export interface SettingRowProps {
  /** Main label for the setting */
  label: React.ReactNode
  /** Description explaining what the setting does */
  description?: string
  /** The control element (Switch, Select, Input, etc.) */
  control: React.ReactNode
  /** Keyboard shortcut hint (e.g., "⌘E") */
  shortcut?: string
  /** Whether this setting has been modified from default */
  modified?: boolean
  /** Callback to reset to default value */
  onReset?: () => void
  /** Additional info shown in tooltip */
  info?: string
  /** Whether the setting is disabled */
  disabled?: boolean
  /** Icon to show before the label */
  icon?: React.ReactNode
  /** Additional class names */
  className?: string
  /** ID for accessibility */
  id?: string
}

/**
 * A unified setting row component with description, shortcut hint,
 * and visual indicator for modified settings.
 */
export function SettingRow({
  label,
  description,
  control,
  shortcut,
  modified,
  onReset,
  info,
  disabled,
  icon,
  className,
  id,
}: SettingRowProps) {
  return (
    <div
      className={cn(
        "group flex items-start justify-between gap-4 py-3 px-1",
        "border-b border-border last:border-0",
        disabled && "opacity-50 pointer-events-none",
        modified && "bg-warn/10 -mx-2 px-3 rounded-lg",
        className
      )}
    >
      {/* Left side: label and description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-text-subtle">{icon}</span>
          )}
          <label
            htmlFor={id}
            className={cn(
              "font-medium text-text",
              disabled && "text-text-subtle"
            )}
          >
            {label}
          </label>
          {modified && (
            <span className="rounded bg-warn/10 px-1.5 py-0.5 text-[10px] font-medium text-warn">
              Modified
            </span>
          )}
          {info && (
            <Tooltip title={info}>
              <Info className="size-3.5 text-text-subtle cursor-help" />
            </Tooltip>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-sm text-text-subtle">
            {description}
          </p>
        )}
      </div>

      {/* Right side: shortcut, reset, and control */}
      <div className="flex items-center gap-3 shrink-0">
        {shortcut && (
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-surface2 px-1.5 py-0.5 text-xs text-text-subtle">
            {shortcut}
          </kbd>
        )}
        {modified && onReset && (
          <Tooltip title="Reset to default">
            <button
              onClick={onReset}
              className="rounded p-1 text-text-subtle opacity-0 transition-opacity hover:bg-surface2 hover:text-text group-hover:opacity-100"
              aria-label="Reset to default"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </Tooltip>
        )}
        <div id={id}>{control}</div>
      </div>
    </div>
  )
}

export default SettingRow

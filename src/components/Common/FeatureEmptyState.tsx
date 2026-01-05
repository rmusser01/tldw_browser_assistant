import React from "react"
import { Button } from "antd"
import type { LucideIcon } from "lucide-react"

type FeatureEmptyStateProps = {
  title: React.ReactNode
  description?: React.ReactNode
  examples?: React.ReactNode[]
  primaryActionLabel?: React.ReactNode
  onPrimaryAction?: () => void
  secondaryActionLabel?: React.ReactNode
  onSecondaryAction?: () => void
  className?: string
  primaryDisabled?: boolean
  secondaryDisabled?: boolean
  /** Optional icon to display above the title for visual interest */
  icon?: LucideIcon
  /** Icon color class (default: text-text-subtle) */
  iconClassName?: string
}

const FeatureEmptyState: React.FC<FeatureEmptyStateProps> = ({
  title,
  description,
  examples,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
  primaryDisabled = false,
  secondaryDisabled = false,
  icon: Icon,
  iconClassName
}) => {
  return (
    <div
      className={
        "mx-auto max-w-xl rounded-3xl border border-border/80 bg-surface/90 p-7 text-sm text-text shadow-card backdrop-blur " +
        (className || "")
      }>
      <div className="space-y-3">
        {Icon && (
          <div className="flex justify-center">
            <div className="rounded-full bg-surface2/80 p-3">
              <Icon
                className={iconClassName || "h-8 w-8 text-text-subtle"}
                aria-hidden="true"
              />
            </div>
          </div>
        )}
        <h2 className={`text-lg font-semibold text-text ${Icon ? "text-center" : ""}`}>
          {title}
        </h2>
        {description && (
          <p className="text-sm text-text-muted">
            {description}
          </p>
        )}
        {examples && examples.length > 0 && (
          <div className="text-xs text-text-muted">
            <ul className="list-disc pl-4 space-y-1">
              {examples.map((example, index) => (
                <li key={index}>{example}</li>
              ))}
            </ul>
          </div>
        )}
        {(primaryActionLabel || secondaryActionLabel) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {primaryActionLabel && (
              <Button
                type="primary"
                size="small"
                onClick={onPrimaryAction}
                title={
                  typeof primaryActionLabel === "string"
                    ? primaryActionLabel
                    : undefined
                }
                className="mr-1 rounded-full px-4 text-[11px] font-semibold uppercase tracking-[0.08em]"
                disabled={primaryDisabled}>
                {primaryActionLabel}
              </Button>
            )}
            {secondaryActionLabel && (
              <Button
                size="small"
                onClick={onSecondaryAction}
                title={
                  typeof secondaryActionLabel === "string"
                    ? secondaryActionLabel
                    : undefined
                }
                className="rounded-full px-4 text-[11px] font-semibold uppercase tracking-[0.08em]"
                disabled={secondaryDisabled}>
                {secondaryActionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default FeatureEmptyState

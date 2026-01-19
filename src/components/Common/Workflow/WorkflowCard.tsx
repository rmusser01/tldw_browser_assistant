import React from "react"
import { Card } from "antd"
import { CheckCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import * as LucideIcons from "lucide-react"
import type { WorkflowDefinition, WorkflowId } from "@/types/workflows"
import { cn } from "@/libs/utils"

interface WorkflowCardProps {
  workflow: WorkflowDefinition
  onSelect: (workflowId: WorkflowId) => void
  isCompleted?: boolean
  disabled?: boolean
}

/**
 * WorkflowCard
 *
 * A clickable card that represents a single workflow option.
 * Used in the landing page to let users select what they want to do.
 */
export const WorkflowCard: React.FC<WorkflowCardProps> = ({
  workflow,
  onSelect,
  isCompleted = false,
  disabled = false
}) => {
  const { t } = useTranslation(["workflows"])

  // Dynamically get the icon component
  const IconComponent = (LucideIcons as unknown as Record<string, React.FC<{ className?: string }>>)[
    workflow.icon
  ] || LucideIcons.HelpCircle

  const handleClick = () => {
    if (!disabled) {
      onSelect(workflow.id)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !disabled) {
      e.preventDefault()
      onSelect(workflow.id)
    }
  }

  return (
    <Card
      hoverable={!disabled}
      className={cn(
        "cursor-pointer transition-all relative",
        "hover:border-primary hover:shadow-md",
        disabled && "opacity-50 cursor-not-allowed hover:border-border hover:shadow-none",
        isCompleted && "border-success/50"
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-disabled={disabled}
      aria-label={t(workflow.labelToken, workflow.id)}
    >
      {/* Completed indicator */}
      {isCompleted && (
        <div className="absolute top-2 right-2">
          <CheckCircle className="h-4 w-4 text-success" />
        </div>
      )}

      <div className="flex flex-col items-center text-center gap-3 py-2">
        {/* Icon */}
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center",
            "bg-primary/10 text-primary"
          )}
        >
          <IconComponent className="h-6 w-6" />
        </div>

        {/* Title */}
        <h3 className="font-medium text-text text-sm">
          {t(workflow.labelToken, workflow.id)}
        </h3>

        {/* Description */}
        <p className="text-xs text-textMuted line-clamp-2">
          {t(workflow.descriptionToken, "")}
        </p>
      </div>
    </Card>
  )
}

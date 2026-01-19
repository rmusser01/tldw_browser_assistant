import React, { useCallback } from "react"
import { Tooltip } from "antd"
import { Wand2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useWorkflowsStore } from "@/store/workflows"

interface WorkflowButtonProps {
  className?: string
}

/**
 * WorkflowButton
 *
 * A button to open the workflow landing page from anywhere in the UI.
 * Typically placed in headers or toolbars.
 */
export const WorkflowButton: React.FC<WorkflowButtonProps> = ({
  className = ""
}) => {
  const { t } = useTranslation(["workflows"])
  const setShowLanding = useWorkflowsStore((s) => s.setShowLanding)

  const handleClick = useCallback(() => {
    setShowLanding(true)
  }, [setShowLanding])

  return (
    <Tooltip title={t("workflows:landing.subtitle", "What would you like to do?")}>
      <button
        type="button"
        onClick={handleClick}
        aria-label={t("workflows:landing.subtitle", "What would you like to do?")}
        className={`rounded-md p-2 text-text-muted hover:bg-surface2 hover:text-text ${className}`}
        data-testid="workflow-button"
      >
        <Wand2 className="size-4" aria-hidden="true" />
      </button>
    </Tooltip>
  )
}

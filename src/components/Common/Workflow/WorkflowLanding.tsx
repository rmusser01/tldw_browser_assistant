import React, { useCallback, useEffect, useRef } from "react"
import { Button, Checkbox } from "antd"
import { X, Sparkles, MessageSquare } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useWorkflowsStore } from "@/store/workflows"
import { WorkflowCard } from "./WorkflowCard"
import {
  ALL_WORKFLOWS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getWorkflowsByCategory
} from "./workflow-definitions"
import type { WorkflowCategory, WorkflowId } from "@/types/workflows"

interface WorkflowLandingProps {
  onClose?: () => void
  onJustChat?: () => void
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const getFocusableElements = (container: HTMLElement | null) => {
  if (!container) return []
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => !el.hasAttribute("aria-hidden"))
}

/**
 * WorkflowLanding
 *
 * A welcoming landing page that appears for new users after first login.
 * Presents available workflows organized by category with a goal-first approach.
 *
 * Features:
 * - Grid of workflow cards organized by category
 * - "Don't show again" checkbox
 * - Quick access to "Just Chat" mode
 */
export const WorkflowLanding: React.FC<WorkflowLandingProps> = ({
  onClose,
  onJustChat
}) => {
  const { t } = useTranslation(["workflows", "common"])

  // Store state
  const showLanding = useWorkflowsStore((s) => s.showLanding)
  const landingConfig = useWorkflowsStore((s) => s.landingConfig)

  // Store actions
  const setShowLanding = useWorkflowsStore((s) => s.setShowLanding)
  const dismissLanding = useWorkflowsStore((s) => s.dismissLanding)
  const startWorkflow = useWorkflowsStore((s) => s.startWorkflow)
  const loadLandingConfig = useWorkflowsStore((s) => s.loadLandingConfig)

  // Load config on mount
  useEffect(() => {
    loadLandingConfig()
  }, [loadLandingConfig])

  const handleSelectWorkflow = useCallback(
    (workflowId: WorkflowId) => {
      startWorkflow(workflowId)
    },
    [startWorkflow]
  )

  const handleDontShowAgain = useCallback(
    (checked: boolean) => {
      if (checked) {
        dismissLanding()
      }
    },
    [dismissLanding]
  )

  const handleClose = useCallback(() => {
    setShowLanding(false)
    onClose?.()
  }, [setShowLanding, onClose])

  const handleJustChat = useCallback(() => {
    setShowLanding(false)
    onJustChat?.()
  }, [setShowLanding, onJustChat])

  // Check if a workflow has been completed before
  const isCompleted = (workflowId: WorkflowId) =>
    landingConfig.completedWorkflows.includes(workflowId)

  if (!showLanding) {
    return null
  }

  return (
    <div className="flex flex-col h-full p-4 overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            id="workflow-landing-title"
            className="text-xl font-semibold text-text flex items-center gap-2"
          >
            <Sparkles className="h-5 w-5 text-primary" />
            {t("workflows:landing.title", "Welcome to tldw Assistant")}
          </h1>
          <p className="text-sm text-textMuted mt-1">
            {t(
              "workflows:landing.subtitle",
              "What would you like to do?"
            )}
          </p>
        </div>
        <Button
          type="text"
          size="small"
          icon={<X className="h-4 w-4" />}
          onClick={handleClose}
          aria-label={t("common:close", "Close")}
        />
      </div>

      {/* Workflow categories */}
      <div className="flex-1 space-y-6 overflow-auto">
        {CATEGORY_ORDER.map((category) => {
          const workflows = getWorkflowsByCategory(category)
          if (workflows.length === 0) return null

          return (
            <div key={category}>
              <h2 className="text-sm font-medium text-textMuted mb-3">
                {t(CATEGORY_LABELS[category], category)}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {workflows.map((workflow) => (
                  <WorkflowCard
                    key={workflow.id}
                    workflow={workflow}
                    onSelect={handleSelectWorkflow}
                    isCompleted={isCompleted(workflow.id)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <Checkbox onChange={(e) => handleDontShowAgain(e.target.checked)}>
            <span className="text-sm text-textMuted">
              {t("workflows:landing.dontShowAgain", "Don't show this again")}
            </span>
          </Checkbox>
          <Button
            type="link"
            icon={<MessageSquare className="h-4 w-4" />}
            onClick={handleJustChat}
          >
            {t("workflows:landing.justChat", "Just Chat")}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * WorkflowLandingModal
 *
 * A modal wrapper for the landing page, used when showing
 * the landing as an overlay on existing content.
 */
export const WorkflowLandingModal: React.FC<WorkflowLandingProps> = (props) => {
  const showLanding = useWorkflowsStore((s) => s.showLanding)
  const setShowLanding = useWorkflowsStore((s) => s.setShowLanding)
  const dialogRef = useRef<HTMLDivElement>(null)
  const lastFocusedElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!showLanding) return

    lastFocusedElementRef.current = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    if (!dialog) return

    const focusable = getFocusableElements(dialog)
    const initialFocus = focusable[0] || dialog
    initialFocus.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        setShowLanding(false)
        props.onClose?.()
        return
      }

      if (event.key !== "Tab") return

      const focusableElements = getFocusableElements(dialog)
      if (focusableElements.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      const active = document.activeElement
      const isShift = event.shiftKey

      if (isShift && (active === first || !dialog.contains(active))) {
        event.preventDefault()
        last.focus()
        return
      }

      if (!isShift && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      lastFocusedElementRef.current?.focus()
    }
  }, [showLanding, setShowLanding, props.onClose])

  if (!showLanding) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workflow-landing-title"
        tabIndex={-1}
        className="bg-bg rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden"
      >
        <WorkflowLanding {...props} />
      </div>
    </div>
  )
}

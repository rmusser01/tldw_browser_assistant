import React, { useCallback } from "react"
import { Card, Button } from "antd"
import { X, ArrowRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import * as LucideIcons from "lucide-react"
import { useWorkflowsStore } from "@/store/workflows"
import { getWorkflowById } from "./workflow-definitions"
import type { ContextualSuggestion as ContextualSuggestionType } from "@/types/workflows"
import { cn } from "@/libs/utils"

interface ContextualSuggestionCardProps {
  suggestion: ContextualSuggestionType
}

/**
 * ContextualSuggestionCard
 *
 * A compact card that appears when the system detects a relevant
 * workflow based on user actions (e.g., uploading a PDF, pasting a URL).
 */
export const ContextualSuggestionCard: React.FC<ContextualSuggestionCardProps> = ({
  suggestion
}) => {
  const { t } = useTranslation(["workflows"])
  const startWorkflow = useWorkflowsStore((s) => s.startWorkflow)
  const dismissSuggestion = useWorkflowsStore((s) => s.dismissSuggestion)

  const workflow = getWorkflowById(suggestion.workflowId)

  const handleAccept = useCallback(() => {
    startWorkflow(suggestion.workflowId)
  }, [startWorkflow, suggestion.workflowId])

  const handleDismiss = useCallback(() => {
    dismissSuggestion(suggestion.id)
  }, [dismissSuggestion, suggestion.id])

  if (!workflow) return null

  // Get icon component
  const IconComponent = (LucideIcons as unknown as Record<string, React.FC<{ className?: string }>>)[
    workflow.icon
  ] || LucideIcons.HelpCircle

  return (
    <Card
      size="small"
      className={cn(
        "border-primary/30 bg-primary/5",
        "animate-in slide-in-from-bottom-2 duration-300"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/20 text-primary flex-shrink-0">
          <IconComponent className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text">
            {t(suggestion.titleToken, workflow.id)}
          </p>
          <p className="text-xs text-textMuted mt-0.5 line-clamp-2">
            {t(suggestion.descriptionToken, "")}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2">
            <Button
              type="primary"
              size="small"
              onClick={handleAccept}
              className="text-xs"
            >
              {t("workflows:suggestion.start", "Start")}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
            <Button
              type="text"
              size="small"
              onClick={handleDismiss}
              className="text-xs text-textMuted"
            >
              {t("workflows:suggestion.dismiss", "Dismiss")}
            </Button>
          </div>
        </div>

        {/* Close button */}
        <Button
          type="text"
          size="small"
          icon={<X className="h-3 w-3" />}
          onClick={handleDismiss}
          className="flex-shrink-0 -mt-1 -mr-1"
          aria-label={t("common:close", "Close")}
        />
      </div>
    </Card>
  )
}

/**
 * ContextualSuggestionList
 *
 * Renders a list of active contextual suggestions.
 * Typically placed at the top of the chat area or sidepanel.
 */
export const ContextualSuggestionList: React.FC = () => {
  const suggestions = useWorkflowsStore((s) => s.suggestions)

  if (suggestions.length === 0) {
    return null
  }

  // Sort by priority
  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  return (
    <div className="space-y-2 mb-4">
      {sortedSuggestions.map((suggestion) => (
        <ContextualSuggestionCard key={suggestion.id} suggestion={suggestion} />
      ))}
    </div>
  )
}

/**
 * ContextualSuggestionToast
 *
 * A toast-style notification for suggestions that appear
 * at the bottom of the screen.
 */
export const ContextualSuggestionToast: React.FC = () => {
  const suggestions = useWorkflowsStore((s) => s.suggestions)

  // Only show the highest priority suggestion as a toast
  const topSuggestion = suggestions
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })[0]

  if (!topSuggestion) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <ContextualSuggestionCard suggestion={topSuggestion} />
    </div>
  )
}

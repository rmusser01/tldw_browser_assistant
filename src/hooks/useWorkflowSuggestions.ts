/**
 * useWorkflowSuggestions
 *
 * A hook for triggering contextual workflow suggestions based on user actions.
 * Use this hook in components that detect relevant user behavior.
 *
 * @example
 * ```tsx
 * const { triggerSuggestion } = useWorkflowSuggestions()
 *
 * // Trigger when user uploads a PDF
 * const handleUpload = (file: File) => {
 *   if (file.type === "application/pdf") {
 *     triggerSuggestion("pdf-uploaded", { filename: file.name })
 *   }
 * }
 * ```
 *
 * Available trigger conditions:
 * - `pdf-uploaded` - When user uploads a PDF file
 * - `youtube-url-pasted` - When YouTube URL is detected
 * - `text-selected` - When substantial text is selected
 * - `summary-viewed` - After viewing a summary
 * - `on-webpage` - When user is on any webpage
 * - `documents-available` - When 3+ docs exist in knowledge base
 */

import { useCallback, useEffect } from "react"
import { useWorkflowsStore } from "@/store/workflows"
import { getWorkflowById } from "@/components/Common/Workflow"
import type {
  WorkflowId,
  ContextualSuggestion,
  SuggestionPriority
} from "@/types/workflows"

type TriggerCondition =
  | "pdf-uploaded"
  | "youtube-url-pasted"
  | "text-selected"
  | "summary-viewed"
  | "on-webpage"
  | "documents-available"

interface TriggerConfig {
  workflowId: WorkflowId
  triggerType: ContextualSuggestion["triggerType"]
  titleToken: string
  descriptionToken: string
  priority: SuggestionPriority
}

// Maps trigger conditions to workflow suggestions
const TRIGGER_MAP: Record<TriggerCondition, TriggerConfig> = {
  "pdf-uploaded": {
    workflowId: "upload-ask",
    triggerType: "content-type",
    titleToken: "workflows:suggestions.pdfUploaded.title",
    descriptionToken: "workflows:suggestions.pdfUploaded.description",
    priority: "high"
  },
  "youtube-url-pasted": {
    workflowId: "transcribe-media",
    triggerType: "content-type",
    titleToken: "workflows:suggestions.youtubeUrl.title",
    descriptionToken: "workflows:suggestions.youtubeUrl.description",
    priority: "high"
  },
  "text-selected": {
    workflowId: "quick-save",
    triggerType: "user-action",
    titleToken: "workflows:suggestions.textSelected.title",
    descriptionToken: "workflows:suggestions.textSelected.description",
    priority: "medium"
  },
  "summary-viewed": {
    workflowId: "create-quiz",
    triggerType: "user-action",
    titleToken: "workflows:suggestions.summaryViewed.title",
    descriptionToken: "workflows:suggestions.summaryViewed.description",
    priority: "low"
  },
  "on-webpage": {
    workflowId: "summarize-page",
    triggerType: "context",
    titleToken: "workflows:suggestions.onWebpage.title",
    descriptionToken: "workflows:suggestions.onWebpage.description",
    priority: "low"
  },
  "documents-available": {
    workflowId: "ask-documents",
    triggerType: "context",
    titleToken: "workflows:suggestions.documentsAvailable.title",
    descriptionToken: "workflows:suggestions.documentsAvailable.description",
    priority: "medium"
  }
}

export interface UseWorkflowSuggestionsReturn {
  /**
   * Trigger a suggestion based on a detected user action/context
   */
  triggerSuggestion: (
    condition: TriggerCondition,
    context?: Record<string, unknown>
  ) => void

  /**
   * Dismiss all current suggestions
   */
  clearSuggestions: () => void

  /**
   * Check if a workflow has been suggested recently
   */
  hasSuggestion: (workflowId: WorkflowId) => boolean

  /**
   * Current active suggestions
   */
  suggestions: ContextualSuggestion[]
}

export const useWorkflowSuggestions = (): UseWorkflowSuggestionsReturn => {
  const suggestions = useWorkflowsStore((s) => s.suggestions)
  const addSuggestion = useWorkflowsStore((s) => s.addSuggestion)
  const clearSuggestions = useWorkflowsStore((s) => s.clearSuggestions)
  const loadDismissedSuggestions = useWorkflowsStore(
    (s) => s.loadDismissedSuggestions
  )

  // Load dismissed suggestions on mount
  useEffect(() => {
    loadDismissedSuggestions()
  }, [loadDismissedSuggestions])

  const triggerSuggestion = useCallback(
    (condition: TriggerCondition, context?: Record<string, unknown>) => {
      const config = TRIGGER_MAP[condition]
      if (!config) return

      const workflow = getWorkflowById(config.workflowId)
      if (!workflow) return

      addSuggestion({
        workflowId: config.workflowId,
        triggerType: config.triggerType,
        titleToken: config.titleToken,
        descriptionToken: config.descriptionToken,
        priority: config.priority,
        context
      })
    },
    [addSuggestion]
  )

  const hasSuggestion = useCallback(
    (workflowId: WorkflowId) => {
      return suggestions.some((s) => s.workflowId === workflowId)
    },
    [suggestions]
  )

  return {
    triggerSuggestion,
    clearSuggestions,
    hasSuggestion,
    suggestions
  }
}

/**
 * Hook to detect and suggest workflows based on clipboard content
 */
export const useClipboardWorkflowDetection = () => {
  const { triggerSuggestion } = useWorkflowSuggestions()

  const checkClipboard = useCallback(
    async (text: string) => {
      // YouTube URL detection
      const youtubeRegex =
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[\w-]+/i
      if (youtubeRegex.test(text)) {
        triggerSuggestion("youtube-url-pasted", { url: text })
        return
      }

      // If text is substantial, suggest quick save
      if (text.length > 100) {
        triggerSuggestion("text-selected", { text: text.slice(0, 500) })
      }
    },
    [triggerSuggestion]
  )

  return { checkClipboard }
}

/**
 * Hook to suggest workflows after certain actions complete
 */
export const usePostActionSuggestions = () => {
  const { triggerSuggestion } = useWorkflowSuggestions()

  const suggestAfterSummary = useCallback(() => {
    triggerSuggestion("summary-viewed")
  }, [triggerSuggestion])

  const suggestForDocuments = useCallback(
    (documentCount: number) => {
      if (documentCount >= 3) {
        triggerSuggestion("documents-available", { count: documentCount })
      }
    },
    [triggerSuggestion]
  )

  return {
    suggestAfterSummary,
    suggestForDocuments
  }
}

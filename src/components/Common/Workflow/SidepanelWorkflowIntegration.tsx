import React, { useEffect } from "react"
import { useWorkflowsStore } from "@/store/workflows"
import { WorkflowLandingModal } from "./WorkflowLanding"
import { WorkflowContainer } from "./WorkflowContainer"
import { ContextualSuggestionList } from "./ContextualSuggestion"

interface SidepanelWorkflowIntegrationProps {
  children: React.ReactNode
}

/**
 * SidepanelWorkflowIntegration
 *
 * A wrapper component that integrates the workflow system into the sidepanel.
 * Includes:
 * - Workflow landing modal (shown for new users)
 * - Workflow container (shown when a workflow is active)
 * - Contextual suggestions layer
 *
 * Usage:
 * ```tsx
 * <SidepanelWorkflowIntegration>
 *   <SidepanelChat />
 * </SidepanelWorkflowIntegration>
 * ```
 */
export const SidepanelWorkflowIntegration: React.FC<
  SidepanelWorkflowIntegrationProps
> = ({ children }) => {
  const isWizardOpen = useWorkflowsStore((s) => s.isWizardOpen)
  const showLanding = useWorkflowsStore((s) => s.showLanding)
  const loadLandingConfig = useWorkflowsStore((s) => s.loadLandingConfig)
  const loadDismissedSuggestions = useWorkflowsStore(
    (s) => s.loadDismissedSuggestions
  )

  // Load workflow state on mount
  useEffect(() => {
    loadLandingConfig()
    loadDismissedSuggestions()
  }, [loadLandingConfig, loadDismissedSuggestions])

  return (
    <>
      {/* Main content (chat interface) */}
      {!isWizardOpen && children}

      {/* Active workflow */}
      {isWizardOpen && <WorkflowContainer />}

      {/* Landing modal (overlays content) */}
      <WorkflowLandingModal />
    </>
  )
}

/**
 * WorkflowSuggestionsBar
 *
 * A component that displays contextual suggestions above the chat.
 * Should be placed inside the chat messages area.
 */
export const WorkflowSuggestionsBar: React.FC = () => {
  return (
    <div className="px-4 pt-2">
      <ContextualSuggestionList />
    </div>
  )
}

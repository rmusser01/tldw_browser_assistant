import React, { Suspense } from "react"
import { Spin } from "antd"
import { useWorkflowsStore } from "@/store/workflows"
import { SummarizePageWorkflow, QuickSaveWorkflow, AnalyzeBookWorkflow } from "./steps"

/**
 * WorkflowContainer
 *
 * Renders the active workflow based on the current workflow ID.
 * Acts as a router/switch for workflow components.
 */
export const WorkflowContainer: React.FC = () => {
  const activeWorkflow = useWorkflowsStore((s) => s.activeWorkflow)
  const isWizardOpen = useWorkflowsStore((s) => s.isWizardOpen)

  if (!isWizardOpen || !activeWorkflow) {
    return null
  }

  const renderWorkflow = () => {
    switch (activeWorkflow.workflowId) {
      case "summarize-page":
        return <SummarizePageWorkflow />
      case "quick-save":
        return <QuickSaveWorkflow />
      case "analyze-book":
        return <AnalyzeBookWorkflow />
      // Add more workflows here as they are implemented
      // case "upload-ask":
      //   return <UploadAskWorkflow />
      // case "transcribe-media":
      //   return <TranscribeMediaWorkflow />
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-textMuted">
              Workflow "{activeWorkflow.workflowId}" not implemented yet.
            </p>
          </div>
        )
    }
  }

  return (
    <div className="h-full p-4 overflow-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <Spin size="large" />
          </div>
        }
      >
        {renderWorkflow()}
      </Suspense>
    </div>
  )
}

/**
 * WorkflowOverlay
 *
 * A full-screen overlay version of the workflow container.
 * Use this when workflows should take over the entire UI.
 */
export const WorkflowOverlay: React.FC = () => {
  const isWizardOpen = useWorkflowsStore((s) => s.isWizardOpen)

  if (!isWizardOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <WorkflowContainer />
    </div>
  )
}

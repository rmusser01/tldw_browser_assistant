/**
 * Workflow Editor Route
 *
 * Full-screen node-based workflow editor for creating
 * and editing visual workflows.
 */

import OptionLayout from "~/components/Layouts/Layout"
import { WorkflowEditor } from "@/components/WorkflowEditor"

const OptionWorkflowEditorRoute = () => {
  return (
    <OptionLayout>
      <div className="h-[calc(100vh-64px)]">
        <WorkflowEditor className="h-full" />
      </div>
    </OptionLayout>
  )
}

export default OptionWorkflowEditorRoute

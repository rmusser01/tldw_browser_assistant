/**
 * Workflow Editor Module
 *
 * Node-based visual workflow editor using React Flow.
 */

// Main component
export { WorkflowEditor } from "./WorkflowEditor"

// Canvas and nodes
export { WorkflowCanvas } from "./WorkflowCanvas"
export { WorkflowNode, workflowNodeTypes } from "./nodes/WorkflowNode"

// Sidebar panels
export { NodePalette } from "./NodePalette"
export { NodeConfigPanel } from "./NodeConfigPanel"
export { ExecutionPanel } from "./ExecutionPanel"

// Step registry
export {
  STEP_REGISTRY,
  STEP_CATEGORIES,
  PORT_COLORS,
  getStepMetadata,
  getStepsByCategory,
  getAllSteps,
  getAddableSteps,
  getCategorizedSteps
} from "./step-registry"

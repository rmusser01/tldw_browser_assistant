/**
 * Workflow UI Kit
 *
 * A guided workflow system for helping new users accomplish
 * common tasks through step-by-step wizards.
 */

// Core Components
export { WizardShell } from "./WizardShell"
export { WorkflowCard } from "./WorkflowCard"
export { WorkflowLanding, WorkflowLandingModal } from "./WorkflowLanding"
export { WorkflowContainer, WorkflowOverlay } from "./WorkflowContainer"
export {
  ContextualSuggestionCard,
  ContextualSuggestionList,
  ContextualSuggestionToast
} from "./ContextualSuggestion"

// Workflow Step Components
export {
  SummarizePageWorkflow,
  QuickSaveWorkflow,
  AnalyzeBookWorkflow
} from "./steps"

// Integration Components
export { WorkflowButton } from "./WorkflowButton"
export {
  SidepanelWorkflowIntegration,
  WorkflowSuggestionsBar
} from "./SidepanelWorkflowIntegration"

// Definitions
export {
  ALL_WORKFLOWS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getWorkflowById,
  getWorkflowsByCategory,
  SUMMARIZE_PAGE_WORKFLOW,
  QUICK_SAVE_WORKFLOW,
  UPLOAD_ASK_WORKFLOW,
  ASK_DOCUMENTS_WORKFLOW,
  TRANSCRIBE_MEDIA_WORKFLOW,
  EXTRACT_TEXT_WORKFLOW,
  CREATE_QUIZ_WORKFLOW,
  MAKE_FLASHCARDS_WORKFLOW
} from "./workflow-definitions"

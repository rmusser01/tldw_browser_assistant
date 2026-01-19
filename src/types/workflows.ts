/**
 * Workflow Types
 * Type definitions for the guided workflow system
 */

import type { ReactNode } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Definition Types
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowCategory =
  | "content-capture"
  | "knowledge-qa"
  | "media-processing"
  | "learning-tools"

export type WorkflowId =
  | "summarize-page"
  | "quick-save"
  | "upload-ask"
  | "ask-documents"
  | "transcribe-media"
  | "extract-text"
  | "create-quiz"
  | "make-flashcards"
  | "analyze-book"

export interface WorkflowDefinition {
  id: WorkflowId
  category: WorkflowCategory
  labelToken: string
  descriptionToken: string
  icon: string // Lucide icon name
  steps: WorkflowStepDefinition[]
  triggers?: WorkflowTrigger[]
}

export interface WorkflowStepDefinition {
  id: string
  labelToken: string
  descriptionToken?: string
  component: string // Component name to render
  isOptional?: boolean
  autoAdvance?: boolean // Auto-advance when step completes
}

export interface WorkflowTrigger {
  type: "user-action" | "context" | "content-type"
  condition: string // e.g., "pdf-uploaded", "youtube-url-pasted"
  suggestionToken: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Instance Types (Runtime State)
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowStatus =
  | "idle"
  | "active"
  | "processing"
  | "completed"
  | "error"
  | "cancelled"

export interface WorkflowInstance {
  id: string // Unique instance ID
  workflowId: WorkflowId
  status: WorkflowStatus
  currentStepIndex: number
  startedAt: number
  completedAt?: number
  error?: string
  data: Record<string, unknown> // Step data accumulator
}

// ─────────────────────────────────────────────────────────────────────────────
// Contextual Suggestion Types
// ─────────────────────────────────────────────────────────────────────────────

export type SuggestionPriority = "high" | "medium" | "low"

export interface ContextualSuggestion {
  id: string
  workflowId: WorkflowId
  triggerType: WorkflowTrigger["type"]
  titleToken: string
  descriptionToken: string
  priority: SuggestionPriority
  dismissedAt?: number
  context?: Record<string, unknown> // Trigger context data
}

// ─────────────────────────────────────────────────────────────────────────────
// Wizard Component Props Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WizardShellProps {
  workflow: WorkflowDefinition
  children: ReactNode
  canAdvance?: boolean
  onComplete?: () => void
}

export interface WizardStepProps {
  workflow: WorkflowDefinition
  stepIndex: number
  data: Record<string, unknown>
  onDataChange: (updates: Record<string, unknown>) => void
  onNext: () => void
  onBack: () => void
  isProcessing: boolean
}

export interface WorkflowCardProps {
  workflow: WorkflowDefinition
  onSelect: (workflowId: WorkflowId) => void
  disabled?: boolean
}

export interface ContextualSuggestionCardProps {
  suggestion: ContextualSuggestion
  onAccept: () => void
  onDismiss: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Landing Page Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowLandingConfig {
  showOnFirstRun: boolean
  dismissedAt?: number
  completedWorkflows: WorkflowId[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Processing/Progress Types
// ─────────────────────────────────────────────────────────────────────────────

export type ProcessingStatus = "idle" | "processing" | "complete" | "error"

export interface ProcessingState {
  status: ProcessingStatus
  progress: number // 0-100
  message?: string
  error?: string
}

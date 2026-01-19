/**
 * Node-Based Workflow Editor Types
 * Type definitions for the visual workflow canvas editor
 */

import type { Node, Edge, XYPosition } from "@xyflow/react"

// ─────────────────────────────────────────────────────────────────────────────
// Step Types (Node Categories)
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowStepType =
  | "prompt"
  | "rag_search"
  | "media_ingest"
  | "branch"
  | "map"
  | "wait_for_human"
  | "webhook"
  | "tts"
  | "stt_transcribe"
  | "delay"
  | "log"
  | "start"
  | "end"

export type StepCategory =
  | "ai"
  | "data"
  | "control"
  | "io"
  | "utility"

// StepTypeMetadata is defined in step-registry.ts to avoid circular deps

// ─────────────────────────────────────────────────────────────────────────────
// Port/Handle Definitions
// ─────────────────────────────────────────────────────────────────────────────

export type PortDataType =
  | "any"
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "file"
  | "audio"
  | "control" // For control flow (branch conditions)

export interface PortDefinition {
  id: string
  label: string
  dataType: PortDataType
  required?: boolean
  multiple?: boolean // Can accept multiple connections
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Configuration Schemas
// ─────────────────────────────────────────────────────────────────────────────

export type ConfigFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "multiselect"
  | "checkbox"
  | "model-picker"
  | "collection-picker"
  | "template-editor"
  | "json-editor"
  | "url"
  | "duration"

export interface ConfigFieldSchema {
  key: string
  type: ConfigFieldType
  label: string
  description?: string
  required?: boolean
  default?: unknown
  options?: Array<{ value: string; label: string }>
  validation?: {
    min?: number
    max?: number
    pattern?: string
    message?: string
  }
  showWhen?: {
    field: string
    value: unknown
  }
}

export type StepConfigSchema = ConfigFieldSchema[]

// ─────────────────────────────────────────────────────────────────────────────
// Node Data (Step Instance Data)
// ─────────────────────────────────────────────────────────────────────────────

export interface BaseStepData {
  label: string
  stepType: WorkflowStepType
  config: Record<string, unknown>
  isExpanded?: boolean
}

// Specific step data types

export interface PromptStepData extends BaseStepData {
  stepType: "prompt"
  config: {
    model?: string
    systemPrompt?: string
    userPromptTemplate?: string
    temperature?: number
    maxTokens?: number
    stopSequences?: string[]
  }
}

export interface RagSearchStepData extends BaseStepData {
  stepType: "rag_search"
  config: {
    collectionId?: string
    queryTemplate?: string
    topK?: number
    minScore?: number
  }
}

export interface MediaIngestStepData extends BaseStepData {
  stepType: "media_ingest"
  config: {
    sourceType?: "url" | "file"
    url?: string
    extractAudio?: boolean
    transcribe?: boolean
    chunkingStrategy?: "sentence" | "paragraph" | "fixed"
  }
}

export interface BranchStepData extends BaseStepData {
  stepType: "branch"
  config: {
    conditions: Array<{
      id: string
      expression: string
      outputId: string
    }>
    defaultOutputId?: string
  }
}

export interface MapStepData extends BaseStepData {
  stepType: "map"
  config: {
    arrayPath?: string
    itemVariable?: string
    maxParallel?: number
  }
}

export interface WaitForHumanStepData extends BaseStepData {
  stepType: "wait_for_human"
  config: {
    promptMessage?: string
    allowEdit?: boolean
    editableFields?: string[]
    timeoutSeconds?: number
    defaultAction?: "approve" | "reject"
  }
}

export interface WebhookStepData extends BaseStepData {
  stepType: "webhook"
  config: {
    url?: string
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    headers?: Record<string, string>
    bodyTemplate?: string
    responseMapping?: string
  }
}

export interface TtsStepData extends BaseStepData {
  stepType: "tts"
  config: {
    voice?: string
    speed?: number
    format?: "mp3" | "wav" | "ogg"
  }
}

export interface SttTranscribeStepData extends BaseStepData {
  stepType: "stt_transcribe"
  config: {
    model?: string
    language?: string
    punctuate?: boolean
  }
}

export interface DelayStepData extends BaseStepData {
  stepType: "delay"
  config: {
    durationSeconds?: number
  }
}

export interface LogStepData extends BaseStepData {
  stepType: "log"
  config: {
    level?: "debug" | "info" | "warn" | "error"
    messageTemplate?: string
  }
}

export interface StartStepData extends BaseStepData {
  stepType: "start"
  config: {
    inputSchema?: Record<string, unknown>
  }
}

export interface EndStepData extends BaseStepData {
  stepType: "end"
  config: {
    outputMapping?: string
  }
}

export type StepData =
  | PromptStepData
  | RagSearchStepData
  | MediaIngestStepData
  | BranchStepData
  | MapStepData
  | WaitForHumanStepData
  | WebhookStepData
  | TtsStepData
  | SttTranscribeStepData
  | DelayStepData
  | LogStepData
  | StartStepData
  | EndStepData

// ─────────────────────────────────────────────────────────────────────────────
// React Flow Node/Edge Types
// ─────────────────────────────────────────────────────────────────────────────

// Use Record<string, unknown> for React Flow compatibility while retaining StepData shape
export interface WorkflowNodeData extends Record<string, unknown> {
  label: string
  stepType: WorkflowStepType
  config: Record<string, unknown>
  isExpanded?: boolean
}

export type WorkflowNode = Node<WorkflowNodeData, WorkflowStepType>
export type WorkflowEdge = Edge<{
  dataType?: PortDataType
  animated?: boolean
}>

// ─────────────────────────────────────────────────────────────────────────────
// Execution State Types
// ─────────────────────────────────────────────────────────────────────────────

export type StepExecutionStatus =
  | "idle"
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "skipped"
  | "waiting_human"
  | "cancelled"

export interface StepExecutionState {
  nodeId: string
  status: StepExecutionStatus
  startedAt?: number
  completedAt?: number
  durationMs?: number
  tokensUsed?: number
  error?: string
  output?: unknown
  streamingOutput?: string // For streaming prompt outputs
  artifacts?: StepArtifact[]
}

export interface StepArtifact {
  id: string
  type: "file" | "audio" | "image" | "text"
  name: string
  url?: string
  data?: string // Base64 or inline data
  mimeType?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Human-in-the-Loop Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HumanApprovalRequest {
  id: string
  nodeId: string
  nodeName: string
  promptMessage: string
  dataToReview: unknown
  editableFields?: string[]
  allowEdit: boolean
  createdAt: number
  timeoutAt?: number
}

export interface HumanApprovalResponse {
  requestId: string
  action: "approve" | "reject"
  editedData?: unknown
  reason?: string
  respondedAt: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Definition (Server Format)
// ─────────────────────────────────────────────────────────────────────────────

export interface ServerWorkflowDefinition {
  id?: string
  name: string
  description?: string
  version?: number
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  metadata?: {
    createdAt?: number
    updatedAt?: number
    createdBy?: string
    tags?: string[]
    thumbnail?: string
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Run State
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowRunStatus =
  | "idle"
  | "running"
  | "paused"
  | "waiting_human"
  | "completed"
  | "failed"
  | "cancelled"

export interface WorkflowRunState {
  runId: string | null
  status: WorkflowRunStatus
  startedAt?: number
  completedAt?: number
  nodeStates: Record<string, StepExecutionState>
  currentNodeId?: string
  pendingApproval?: HumanApprovalRequest
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor UI State
// ─────────────────────────────────────────────────────────────────────────────

export type EditorTool =
  | "select"
  | "pan"
  | "connect"

export type SidebarPanel =
  | "palette"
  | "config"
  | "execution"
  | "templates"
  | null

export interface EditorUIState {
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  activeTool: EditorTool
  sidebarPanel: SidebarPanel
  isMiniMapVisible: boolean
  isGridVisible: boolean
  zoom: number
  panPosition: XYPosition
  isDragging: boolean
  isConnecting: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Undo/Redo History
// ─────────────────────────────────────────────────────────────────────────────

export interface EditorHistoryEntry {
  id: string
  timestamp: number
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export interface EditorHistory {
  past: EditorHistoryEntry[]
  present: EditorHistoryEntry
  future: EditorHistoryEntry[]
  maxHistorySize: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Template
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  thumbnail?: string
  tags: string[]
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  difficulty?: "beginner" | "intermediate" | "advanced"
  estimatedDuration?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Types
// ─────────────────────────────────────────────────────────────────────────────

export type ValidationSeverity = "error" | "warning" | "info"

export interface ValidationIssue {
  id: string
  nodeId?: string
  edgeId?: string
  severity: ValidationSeverity
  message: string
  field?: string
}

export interface WorkflowValidation {
  isValid: boolean
  issues: ValidationIssue[]
}

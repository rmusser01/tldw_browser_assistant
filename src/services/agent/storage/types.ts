/**
 * Storage Types for Session Persistence & Workspace History
 *
 * These types define the structure of data stored in browser extension storage.
 * Note: Truncated fields (arguments, results) are for DISPLAY ONLY - invalid JSON.
 */

import type { AgentStatus, ApprovalTier } from "@/services/agent/types"

/** Current schema version for migrations */
export const CURRENT_SCHEMA_VERSION = 1

/** Statuses that can be restored (user can review pending approvals) */
export type RestorableStatus = "waiting_approval"

/**
 * Stored message in conversation history
 * Note: tool_calls array from AgentMessage is NOT stored (redundant with toolCalls)
 */
export interface StoredAgentMessage {
  role: "user" | "assistant" | "system" | "tool"
  content: string // Truncated if > MAX_MESSAGE_LENGTH
  timestamp: string // ISO string
  toolCallId?: string
}

/**
 * Stored tool call entry
 * Note: arguments may be truncated and invalid JSON - display only
 */
export interface StoredToolCallEntry {
  id: string
  name: string
  arguments: string // Truncated if > MAX_ARGS_LENGTH - DISPLAY ONLY
  result?: string // Truncated if > MAX_TOOL_RESULT_LENGTH
  status: "pending" | "running" | "approved" | "rejected" | "completed" | "error"
  timestamp: string // ISO string
}

/**
 * Stored pending approval with truncated args preview
 */
export interface StoredPendingApproval {
  toolCallId: string
  toolName: string
  argsPreview: string // Truncated args for display (max MAX_ARGS_LENGTH)
  tier: ApprovalTier
  status: "pending" | "approved" | "rejected"
}

/**
 * Stored file diff metadata
 */
export interface StoredFileDiff {
  path: string
  type: "create" | "modify" | "delete"
  linesAdded: number
  linesRemoved: number
  preview?: string // First MAX_DIFF_PREVIEW_LENGTH chars
}

/**
 * Stored command execution result
 */
export interface StoredCommandExecution {
  id: string
  command: string
  exitCode?: number
  outputPreview?: string // First MAX_OUTPUT_PREVIEW_LENGTH chars
  timestamp: string // ISO string
}

/**
 * Full stored agent session
 */
export interface StoredAgentSession {
  schemaVersion: number
  id: string
  workspaceId: string
  task: string
  title: string // First MAX_TITLE_LENGTH chars of task
  status: AgentStatus
  currentStep: number
  messages: StoredAgentMessage[]
  toolCalls: StoredToolCallEntry[]
  pendingApprovals: StoredPendingApproval[]
  diffs: StoredFileDiff[]
  executions: StoredCommandExecution[]
  createdAt: string // ISO string
  updatedAt: string // ISO string
}

/**
 * Reference to active session (stored separately for quick lookup)
 */
export interface ActiveSessionRef {
  sessionId: string
  workspaceId: string
}

/**
 * Workspace history entry for recent workspaces
 */
export interface WorkspaceHistoryEntry {
  workspaceId: string
  name: string
  path: string
  lastUsedAt: string // ISO string
  sessionCount: number
}

/**
 * Metadata-only type for lazy loading session list
 * Avoids loading full message/toolCall arrays
 */
export interface SessionMetadata {
  id: string
  workspaceId: string
  task: string
  title: string
  status: AgentStatus
  currentStep: number
  createdAt: string
  updatedAt: string
  messageCount: number
  toolCallCount: number
}

/**
 * Input type for saving current session from component state
 * Maps component state structure to storage format
 */
export interface SessionSaveInput {
  workspaceId: string
  task: string
  status: AgentStatus
  currentStep: number
  messages: Array<{
    role: string
    content: string
    tool_call_id?: string
  }>
  toolCalls: Array<{
    id: string
    toolCall: {
      id: string
      type: string
      function: {
        name: string
        arguments: string
      }
    }
    status: string
    result?: unknown
    error?: string
    timestamp: Date
  }>
  pendingApprovals: Array<{
    toolCallId: string
    toolName: string
    args: Record<string, unknown>
    tier: ApprovalTier
    status: "pending" | "approved" | "rejected"
  }>
  diffs: Array<{
    path: string
    type: "create" | "modify" | "delete"
    hunks: Array<{
      oldStart: number
      oldLines: number
      newStart: number
      newLines: number
      lines: string[]
    }>
  }>
  executions: Array<{
    id: string
    commandId: string
    status: string
    exitCode?: number
    stdout?: string
    stderr?: string
    timestamp: Date
  }>
}

/**
 * Output type when restoring a session to component state
 */
export interface SessionRestoreOutput {
  task: string
  currentStep: number
  messages: Array<{
    role: "user" | "assistant"
    content: string
  }>
  toolCalls: Array<{
    id: string
    toolCall: {
      id: string
      type: "function"
      function: {
        name: string
        arguments: string
      }
    }
    status: "pending" | "running" | "complete" | "error"
    result?: unknown
    error?: string
    timestamp: Date
  }>
  pendingApprovals: Array<{
    toolCallId: string
    toolName: string
    args: Record<string, unknown>
    tier: ApprovalTier
    status: "pending" | "approved" | "rejected"
  }>
  diffs: Array<{
    path: string
    type: "create" | "modify" | "delete"
    linesAdded: number
    linesRemoved: number
  }>
  executions: Array<{
    id: string
    commandId: string
    status: "pending" | "running" | "complete" | "error" | "timeout"
    exitCode?: number
    stdout?: string
    stderr?: string
    timestamp: Date
  }>
}

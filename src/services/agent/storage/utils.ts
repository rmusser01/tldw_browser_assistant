/**
 * Storage Utilities for Session Persistence & Workspace History
 *
 * Helper functions for truncation, conversion, and data transformation.
 */

import { STORAGE_LIMITS, RESTORABLE_STATUSES, STALE_STATUSES } from "./constants"
import type {
  StoredAgentSession,
  StoredAgentMessage,
  StoredToolCallEntry,
  StoredPendingApproval,
  StoredFileDiff,
  StoredCommandExecution,
  SessionMetadata,
  SessionSaveInput,
  SessionRestoreOutput,
} from "./types"
import { CURRENT_SCHEMA_VERSION } from "./types"
import type { AgentStatus, ApprovalTier } from "@/services/agent/types"

/**
 * Truncate content with suffix indicator
 */
export function truncateContent(str: string | undefined | null, maxLen: number): string {
  if (!str) return ""
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 14) + "...[truncated]"
}

/**
 * Generate a short title from the task (first line, max length)
 */
export function generateTitle(task: string): string {
  const firstLine = task.split("\n")[0].trim()
  if (firstLine.length <= STORAGE_LIMITS.MAX_TITLE_LENGTH) {
    return firstLine
  }
  return firstLine.slice(0, STORAGE_LIMITS.MAX_TITLE_LENGTH - 3) + "..."
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return crypto.randomUUID()
}

/**
 * Convert Date to ISO string
 */
export function dateToISOString(date: Date): string {
  return date.toISOString()
}

/**
 * Convert ISO string to Date
 */
export function isoStringToDate(str: string): Date {
  return new Date(str)
}

/**
 * Check if a session is expired based on MAX_SESSION_AGE_DAYS
 */
export function isSessionExpired(session: StoredAgentSession): boolean {
  const updatedAt = isoStringToDate(session.updatedAt)
  const now = new Date()
  const ageInDays = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
  return ageInDays > STORAGE_LIMITS.MAX_SESSION_AGE_DAYS
}

/**
 * Check if a status is restorable
 */
export function isRestorableStatus(status: AgentStatus): boolean {
  return (RESTORABLE_STATUSES as readonly string[]).includes(status)
}

/**
 * Check if a status indicates a stale/interrupted session
 */
export function isStaleStatus(status: AgentStatus): boolean {
  return (STALE_STATUSES as readonly string[]).includes(status)
}

/**
 * Convert component message to stored format
 */
export function summarizeMessage(msg: {
  role: string
  content: string
  tool_call_id?: string
}): StoredAgentMessage {
  return {
    role: msg.role as StoredAgentMessage["role"],
    content: truncateContent(msg.content, STORAGE_LIMITS.MAX_MESSAGE_LENGTH),
    timestamp: dateToISOString(new Date()),
    toolCallId: msg.tool_call_id,
  }
}

/**
 * Convert component tool call entry to stored format
 */
export function summarizeToolCall(tc: {
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
}): StoredToolCallEntry {
  let resultStr: string | undefined
  if (tc.result !== undefined) {
    try {
      resultStr = truncateContent(
        typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result),
        STORAGE_LIMITS.MAX_TOOL_RESULT_LENGTH
      )
    } catch {
      resultStr = "[Unable to serialize result]"
    }
  }

  return {
    id: tc.id,
    name: tc.toolCall.function.name,
    arguments: truncateContent(tc.toolCall.function.arguments, STORAGE_LIMITS.MAX_ARGS_LENGTH),
    result: resultStr,
    status: tc.status as StoredToolCallEntry["status"],
    timestamp: dateToISOString(tc.timestamp),
  }
}

/**
 * Convert component pending approval to stored format
 */
export function summarizePendingApproval(approval: {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  tier: ApprovalTier
  status: "pending" | "approved" | "rejected"
}): StoredPendingApproval {
  let argsPreview: string
  try {
    argsPreview = truncateContent(JSON.stringify(approval.args), STORAGE_LIMITS.MAX_ARGS_LENGTH)
  } catch {
    argsPreview = "[Unable to serialize args]"
  }

  return {
    toolCallId: approval.toolCallId,
    toolName: approval.toolName,
    argsPreview,
    tier: approval.tier,
    status: approval.status,
  }
}

/**
 * Convert component diff to stored format
 */
export function summarizeDiff(diff: {
  path: string
  type: "create" | "modify" | "delete"
  hunks: Array<{
    oldStart: number
    oldLines: number
    newStart: number
    newLines: number
    lines: string[]
  }>
}): StoredFileDiff {
  // Calculate lines added/removed from hunks
  let linesAdded = 0
  let linesRemoved = 0
  let previewLines: string[] = []

  for (const hunk of diff.hunks) {
    for (const line of hunk.lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        linesAdded++
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        linesRemoved++
      }
    }
    previewLines.push(...hunk.lines)
  }

  const preview = truncateContent(previewLines.join("\n"), STORAGE_LIMITS.MAX_DIFF_PREVIEW_LENGTH)

  return {
    path: diff.path,
    type: diff.type,
    linesAdded,
    linesRemoved,
    preview,
  }
}

/**
 * Convert component execution to stored format
 */
export function summarizeExecution(exec: {
  id: string
  commandId: string
  status: string
  exitCode?: number
  stdout?: string
  stderr?: string
  timestamp: Date
}): StoredCommandExecution {
  const output = [exec.stdout, exec.stderr].filter(Boolean).join("\n")

  return {
    id: exec.id,
    command: exec.commandId,
    exitCode: exec.exitCode,
    outputPreview: truncateContent(output, STORAGE_LIMITS.MAX_OUTPUT_PREVIEW_LENGTH),
    timestamp: dateToISOString(exec.timestamp),
  }
}

/**
 * Extract metadata from a full session for list display
 */
export function extractSessionMetadata(session: StoredAgentSession): SessionMetadata {
  return {
    id: session.id,
    workspaceId: session.workspaceId,
    task: session.task,
    title: session.title,
    status: session.status,
    currentStep: session.currentStep,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: session.messages.length,
    toolCallCount: session.toolCalls.length,
  }
}

/**
 * Create a StoredAgentSession from SessionSaveInput
 */
export function createSessionFromInput(
  input: SessionSaveInput,
  existingId?: string
): StoredAgentSession {
  const now = dateToISOString(new Date())
  const id = existingId || generateSessionId()

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id,
    workspaceId: input.workspaceId,
    task: input.task,
    title: generateTitle(input.task),
    status: input.status,
    currentStep: input.currentStep,
    messages: input.messages.map(summarizeMessage),
    toolCalls: input.toolCalls.map(summarizeToolCall),
    pendingApprovals: input.pendingApprovals.map(summarizePendingApproval),
    diffs: input.diffs.map(summarizeDiff),
    executions: input.executions.map(summarizeExecution),
    createdAt: existingId ? now : now, // Will be updated if existing
    updatedAt: now,
  }
}

/**
 * Convert a stored session back to component-usable format for restore
 * Note: Some data is lossy (truncated) - this is for display/review only
 */
export function sessionToRestoreOutput(session: StoredAgentSession): SessionRestoreOutput {
  return {
    task: session.task,
    currentStep: session.currentStep,
    messages: session.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    toolCalls: session.toolCalls.map((tc) => ({
      id: tc.id,
      toolCall: {
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.name,
          arguments: tc.arguments, // Note: may be truncated/invalid JSON
        },
      },
      status: tc.status === "completed" ? "complete" : tc.status,
      result: tc.result,
      timestamp: isoStringToDate(tc.timestamp),
    })),
    pendingApprovals: session.pendingApprovals.map((pa) => {
      // Try to parse args back, fall back to empty object
      let args: Record<string, unknown> = {}
      try {
        if (!pa.argsPreview.includes("[truncated]")) {
          args = JSON.parse(pa.argsPreview)
        }
      } catch {
        // Keep empty object
      }
      return {
        toolCallId: pa.toolCallId,
        toolName: pa.toolName,
        args,
        tier: pa.tier,
        status: pa.status,
      }
    }),
    diffs: session.diffs.map((d) => ({
      path: d.path,
      type: d.type,
      linesAdded: d.linesAdded,
      linesRemoved: d.linesRemoved,
    })),
    executions: session.executions.map((e) => ({
      id: e.id,
      commandId: e.command,
      status: e.exitCode === 0 ? "complete" : "error",
      exitCode: e.exitCode,
      stdout: e.outputPreview,
      stderr: undefined,
      timestamp: isoStringToDate(e.timestamp),
    })),
  }
}

/**
 * Simple debounce implementation
 * Returns a debounced function with a cancel method
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }) as T & { cancel: () => void }

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return debounced
}

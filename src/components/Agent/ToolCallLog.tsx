/**
 * ToolCallLog - Display stream of tool calls with status indicators
 */

import { FC, useRef, useEffect } from "react"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import {
  FileText,
  Search,
  GitBranch,
  Terminal,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  FolderOpen
} from "lucide-react"
import type { ToolCall } from "@/services/agent/types"

export interface ToolCallEntry {
  id: string
  toolCall: ToolCall
  status: "pending" | "running" | "complete" | "error"
  result?: unknown
  error?: string
  timestamp: Date
}

interface ToolCallLogProps {
  entries: ToolCallEntry[]
  className?: string
  autoScroll?: boolean
  expandedIds?: Set<string>
  onToggleExpand?: (id: string) => void
}

// Map tool names to icons
const TOOL_ICONS: Record<string, FC<{ className?: string }>> = {
  "fs_list": FolderOpen,
  "fs_read": FileText,
  "fs_write": Pencil,
  "fs_apply_patch": Pencil,
  "fs_mkdir": FolderOpen,
  "fs_delete": Trash2,
  "search_grep": Search,
  "search_glob": Search,
  "git_status": GitBranch,
  "git_diff": GitBranch,
  "git_log": GitBranch,
  "git_branch": GitBranch,
  "git_add": GitBranch,
  "git_commit": GitBranch,
  "exec_run": Terminal
}

// Fallback display names for tools (used when no translation is available)
const TOOL_LABEL_FALLBACKS: Record<string, string> = {
  "fs_list": "List Directory",
  "fs_read": "Read File",
  "fs_write": "Write File",
  "fs_apply_patch": "Apply Patch",
  "fs_mkdir": "Create Directory",
  "fs_delete": "Delete",
  "search_grep": "Search Content",
  "search_glob": "Find Files",
  "git_status": "Git Status",
  "git_diff": "Git Diff",
  "git_log": "Git Log",
  "git_branch": "Git Branch",
  "git_add": "Stage Files",
  "git_commit": "Commit",
  "exec_run": "Run Command"
}

// Status info with colors and accessible labels
const STATUS_INFO: Record<ToolCallEntry["status"], { color: string; label: string }> = {
  pending: { color: "text-gray-400", label: "Pending" },
  running: { color: "text-blue-500", label: "Running" },
  complete: { color: "text-green-500", label: "Complete" },
  error: { color: "text-red-500", label: "Error" }
}

// Get status color
const getStatusColor = (status: ToolCallEntry["status"]): string => {
  return STATUS_INFO[status]?.color ?? "text-gray-400"
}

// Get accessible status label
const getStatusLabel = (status: ToolCallEntry["status"], t: TFunction): string => {
  return t(`status.${status}`, {
    defaultValue: STATUS_INFO[status]?.label ?? "Unknown"
  })
}

const isErrorResult = (result: unknown): result is { ok: false; error?: string } => {
  return (
    typeof result === "object" &&
    result !== null &&
    "ok" in result &&
    (result as { ok: unknown }).ok === false
  )
}

const hasDataProperty = (result: unknown): result is { data: Record<string, unknown> } => {
  return typeof result === "object" && result !== null && "data" in result
}

// Get status icon
const StatusIcon: FC<{ status: ToolCallEntry["status"]; className?: string }> = ({
  status,
  className = "size-4"
}) => {
  switch (status) {
    case "pending":
      return <div className={`${className} rounded-full border-2 border-gray-300 dark:border-gray-600`} />
    case "running":
      return <Loader2 className={`${className} animate-spin text-blue-500`} />
    case "complete":
      return <Check className={`${className} text-green-500`} />
    case "error":
      return <X className={`${className} text-red-500`} />
    default:
      return null
  }
}

// Format tool arguments for display
const formatArgs = (toolName: string, argsStr: string): string => {
  try {
    const args = JSON.parse(argsStr || "{}")

    // Special formatting for different tools
    switch (toolName) {
      case "fs_read":
      case "fs_write":
      case "fs_delete":
      case "fs_mkdir":
        return args.path || ""
      case "fs_list":
        return args.path || "."
      case "search_grep":
        return `"${args.pattern}"${args.glob ? ` (${args.glob})` : ""}`
      case "search_glob":
        return args.pattern || ""
      case "git_diff":
        return args.staged ? "(staged)" : ""
      case "git_log":
        return args.path ? `(${args.path})` : ""
      case "git_add":
        return Array.isArray(args.paths) ? args.paths.join(", ") : ""
      case "git_commit":
        return args.message ? `"${args.message.substring(0, 50)}${args.message.length > 50 ? "..." : ""}"` : ""
      case "exec_run":
        return args.command_id || ""
      default:
        return ""
    }
  } catch {
    return ""
  }
}

// Safely format full arguments JSON for expanded view
const formatFullArgs = (
  argsStr: string | undefined,
  invalidFallback: string
): string => {
  if (!argsStr) {
    return "{}"
  }

  try {
    const parsed = JSON.parse(argsStr)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return invalidFallback || argsStr
  }
}

// Format result for display (compact preview)
const formatResult = (result: unknown): string => {
  if (!result) return ""

  try {
    if (typeof result === "string") {
      return result
    }

    // Handle common result structures
    if (isErrorResult(result)) {
      return `Error: ${result.error ?? "Unknown error"}`
    }

    if (hasDataProperty(result)) {
      const data = result.data

      // File listing
      if (Array.isArray(data.entries)) {
        const truncated = data.truncated ? " (truncated)" : ""
        return `${data.entries.length} entries${truncated}`
      }

      // Search results
      if (Array.isArray(data.matches)) {
        const totalMatches =
          typeof data.total_matches === "number"
            ? data.total_matches
            : data.matches.length
        return `${totalMatches} matches`
      }

      // Git status
      if ("branch" in data) {
        const parts = []
        const staged = Array.isArray(data.staged) ? data.staged.length : 0
        const modified = Array.isArray(data.modified) ? data.modified.length : 0
        const untracked = Array.isArray(data.untracked) ? data.untracked.length : 0
        if (staged) parts.push(`${staged} staged`)
        if (modified) parts.push(`${modified} modified`)
        if (untracked) parts.push(`${untracked} untracked`)
        return parts.length ? parts.join(", ") : "Clean"
      }

      // File operations
      if (typeof data.bytes === "number") {
        return `${data.bytes} bytes written`
      }

      if (data.deleted) {
        return "Deleted"
      }

      if (data.created) {
        return "Created"
      }

      // Git operations
      if (typeof data.hash === "string") {
        return `Commit: ${data.hash.substring(0, 7)}`
      }

      if (Array.isArray(data.commits)) {
        return `${data.commits.length} commits`
      }

      // Exec results
      if (typeof data.exit_code === "number") {
        return data.exit_code === 0 ? "Success" : `Exit code: ${data.exit_code}`
      }
    }

    return JSON.stringify(result).substring(0, 100)
  } catch {
    return ""
  }
}

// Safely format full result JSON for expanded view
const formatFullResult = (result: unknown): string => {
  if (result == null) {
    return ""
  }

  try {
    const seen = new WeakSet<object>()
    const serialized = JSON.stringify(
      result,
      (_key, value) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value as object)) {
            return "[Circular]"
          }
          seen.add(value as object)
        }
        if (typeof value === "bigint") {
          return value.toString()
        }
        return value
      },
      2
    )
    return serialized
  } catch {
    try {
      if (typeof result === "string") {
        return result
      }
      return String(result)
    } catch {
      return "[Unserializable result]"
    }
  }
}

const EMPTY_SET = new Set<string>()

export const ToolCallLog: FC<ToolCallLogProps> = ({
  entries,
  className = "",
  autoScroll = true,
  expandedIds = EMPTY_SET,
  onToggleExpand
}) => {
  const { t } = useTranslation("common")
  const scrollRef = useRef<HTMLDivElement>(null)

  // Get human-readable, localized tool name
  const getToolDisplayName = (name: string): string => {
    return t(`tools.${name}`, {
      defaultValue: TOOL_LABEL_FALLBACKS[name] ?? name
    })
  }

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries, autoScroll])

  if (entries.length === 0) {
    return (
      <div className={`flex items-center justify-center h-32 text-gray-400 dark:text-gray-500 ${className}`}>
        <span className="text-sm">{t("noToolCalls", "No tool calls yet")}</span>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className={`space-y-1 overflow-y-auto ${className}`}
    >
      {entries.map((entry) => {
        const Icon = TOOL_ICONS[entry.toolCall.function.name] || Terminal
        const isExpanded = expandedIds.has(entry.id)
        const argsPreview = formatArgs(entry.toolCall.function.name, entry.toolCall.function.arguments)
        const resultPreview = formatResult(entry.result)

        return (
          <div
            key={entry.id}
            className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
          >
            <button
              onClick={() => onToggleExpand?.(entry.id)}
              aria-expanded={onToggleExpand ? isExpanded : undefined}
              aria-label={`${getToolDisplayName(entry.toolCall.function.name)} - ${getStatusLabel(entry.status, t)}`}
              disabled={!onToggleExpand}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {/* Expand/collapse toggle */}
              {onToggleExpand && (
                isExpanded
                  ? <ChevronDown className="size-4 text-gray-400" />
                  : <ChevronRight className="size-4 text-gray-400" />
              )}

              {/* Status indicator with accessible label */}
              <span className="flex items-center gap-1" aria-label={`Status: ${getStatusLabel(entry.status, t)}`}>
                <StatusIcon status={entry.status} />
                <span className={`text-xs ${getStatusColor(entry.status)}`}>
                  {getStatusLabel(entry.status, t)}
                </span>
              </span>

              {/* Tool icon */}
              <Icon className={`size-4 ${getStatusColor(entry.status)}`} />

              {/* Tool name */}
              <span className="font-medium text-sm">
                {getToolDisplayName(entry.toolCall.function.name)}
              </span>

              {/* Arguments preview */}
              {argsPreview && (
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px] md:max-w-[200px] lg:max-w-[300px]">
                  {argsPreview}
                </span>
              )}

              {/* Result preview */}
              {entry.status === "complete" && resultPreview && (
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                  {resultPreview}
                </span>
              )}

              {/* Error indicator */}
              {entry.status === "error" && entry.error && (
                <span className="ml-auto text-xs text-red-500 truncate max-w-[150px] md:max-w-[200px] lg:max-w-[300px]">
                  {entry.error}
                </span>
              )}
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-3 pb-3 pt-1 border-t border-gray-200 dark:border-gray-700">
                {/* Arguments */}
                <div className="mb-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t("arguments", "Arguments")}:
                  </span>
                  <pre className="mt-1 p-2 text-xs bg-gray-100 dark:bg-gray-900 rounded overflow-x-auto">
                    {formatFullArgs(
                      entry.toolCall.function.arguments,
                      t("invalidJson", "Invalid JSON; showing raw value")
                    )}
                  </pre>
                </div>

                {/* Result */}
                {entry.result && (
                  <div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("result", "Result")}:
                    </span>
                    <pre className="mt-1 p-2 text-xs bg-gray-100 dark:bg-gray-900 rounded overflow-x-auto max-h-48">
                      {formatFullResult(entry.result)}
                    </pre>
                  </div>
                )}

                {/* Error details */}
                {entry.error && (
                  <div>
                    <span className="text-xs font-medium text-red-500">
                      {t("error.label", "Error")}:
                    </span>
                    <pre className="mt-1 p-2 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded">
                      {entry.error}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ToolCallLog

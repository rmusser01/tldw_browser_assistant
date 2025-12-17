/**
 * ApprovalBanner - Sticky banner for pending tool approvals
 */

import { FC, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Button, Tooltip } from "antd"
import {
  AlertTriangle,
  FileEdit,
  Terminal,
  GitCommit,
  Trash2,
  Eye,
  Check,
  X,
  ChevronUp
} from "lucide-react"
import type { PendingApproval, ApprovalTier } from "@/services/agent/types"

interface ApprovalBannerProps {
  approvals: PendingApproval[]
  onApprove: (ids: string[]) => void
  onReject: (ids: string[]) => void
  onViewDetails?: () => void
  className?: string
  expanded?: boolean
  onToggleExpanded?: () => void
}

// Categorize approvals by type
interface ApprovalCategory {
  label: string
  icon: FC<{ className?: string }>
  color: string
  tier: ApprovalTier
  approvals: PendingApproval[]
}

// Get icon for tool type
function getToolIcon(toolName: string): FC<{ className?: string }> {
  if (toolName.startsWith("fs.write") || toolName.startsWith("fs.apply_patch")) {
    return FileEdit
  }
  if (toolName.startsWith("fs.delete")) {
    return Trash2
  }
  if (toolName.startsWith("git.")) {
    return GitCommit
  }
  if (toolName.startsWith("exec.")) {
    return Terminal
  }
  return FileEdit
}

// Get category for tool
function getToolCategory(toolName: string): string {
  if (toolName.startsWith("fs.write") || toolName.startsWith("fs.apply_patch") || toolName.startsWith("fs.mkdir")) {
    return "writes"
  }
  if (toolName.startsWith("fs.delete")) {
    return "deletes"
  }
  if (toolName.startsWith("git.")) {
    return "git"
  }
  if (toolName.startsWith("exec.")) {
    return "exec"
  }
  return "other"
}

export const ApprovalBanner: FC<ApprovalBannerProps> = ({
  approvals,
  onApprove,
  onReject,
  onViewDetails,
  className = "",
  expanded = false,
  onToggleExpanded
}) => {
  const { t } = useTranslation("common")

  // Group approvals by category
  const categories = useMemo(() => {
    const groups: Record<string, PendingApproval[]> = {}

    for (const approval of approvals) {
      const category = getToolCategory(approval.toolName)
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(approval)
    }

    const result: ApprovalCategory[] = []

    if (groups.writes?.length) {
      result.push({
        label: t("fileChanges", "File changes"),
        icon: FileEdit,
        color: "text-blue-500",
        tier: "batch",
        approvals: groups.writes
      })
    }
    if (groups.deletes?.length) {
      result.push({
        label: t("deletions", "Deletions"),
        icon: Trash2,
        color: "text-red-500",
        tier: "individual",
        approvals: groups.deletes
      })
    }
    if (groups.git?.length) {
      result.push({
        label: t("gitOperations", "Git operations"),
        icon: GitCommit,
        color: "text-purple-500",
        tier: "batch",
        approvals: groups.git
      })
    }
    if (groups.exec?.length) {
      result.push({
        label: t("commands", "Commands"),
        icon: Terminal,
        color: "text-orange-500",
        tier: "individual",
        approvals: groups.exec
      })
    }

    return result
  }, [approvals, t])

  // Nothing to approve
  if (approvals.length === 0) {
    return null
  }

  const allIds = approvals.map(a => a.toolCallId)
  const pendingCount = approvals.filter(a => a.status === "pending").length

  return (
    <div className={`bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800 ${className}`}>
      {/* Collapsed view */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40">
            <AlertTriangle className="size-4 text-yellow-600 dark:text-yellow-400" />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium text-yellow-800 dark:text-yellow-200">
              {pendingCount} {pendingCount === 1 ? t("actionPending", "action pending") : t("actionsPending", "actions pending")}
            </span>

            {/* Category badges */}
            <div className="flex items-center gap-1.5">
              {categories.map((cat, idx) => {
                const Icon = cat.icon
                return (
                  <Tooltip key={idx} title={`${cat.approvals.length} ${cat.label.toLowerCase()}`}>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 text-xs ${cat.color}`}>
                      <Icon className="size-3" />
                      {cat.approvals.length}
                    </span>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onViewDetails && (
            <Button
              size="small"
              icon={<Eye className="size-3.5" />}
              onClick={onViewDetails}
            >
              {t("viewDetails", "View Details")}
            </Button>
          )}

          <Button
            size="small"
            type="primary"
            icon={<Check className="size-3.5" />}
            onClick={() => onApprove(allIds)}
            className="bg-green-500 hover:bg-green-600 border-green-500"
          >
            {t("approveAll", "Approve All")}
          </Button>

          <Button
            size="small"
            danger
            icon={<X className="size-3.5" />}
            onClick={() => onReject(allIds)}
          >
            {t("rejectAll", "Reject All")}
          </Button>

          {onToggleExpanded && (
            <Button
              size="small"
              type="text"
              onClick={onToggleExpanded}
              icon={<ChevronUp className={`size-4 text-yellow-600 transition-transform ${expanded ? "" : "rotate-180"}`} />}
            />
          )}
        </div>
      </div>

      {/* Expanded view with individual items */}
      {expanded && (
        <div className="border-t border-yellow-200 dark:border-yellow-800 px-4 py-2 space-y-2 max-h-48 overflow-y-auto">
          {approvals.map((approval) => {
            const Icon = getToolIcon(approval.toolName)
            const isRisky = approval.tier === "individual"

            return (
              <div
                key={approval.toolCallId}
                className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                  isRisky
                    ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Icon className={`size-4 flex-shrink-0 ${isRisky ? "text-red-500" : "text-gray-500"}`} />

                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {approval.toolName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {formatApprovalArgs(approval)}
                    </div>
                  </div>

                  {isRisky && (
                    <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                      {t("requiresApproval", "Requires approval")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 ml-2">
                  <Tooltip title={t("approve", "Approve")}>
                    <Button
                      size="small"
                      type="text"
                      onClick={() => onApprove([approval.toolCallId])}
                      aria-label={t("approve", "Approve")}
                      icon={<Check className="size-4 text-green-600" />}
                      className="hover:bg-green-100 dark:hover:bg-green-900/40"
                    />
                  </Tooltip>
                  <Tooltip title={t("reject", "Reject")}>
                    <Button
                      size="small"
                      type="text"
                      onClick={() => onReject([approval.toolCallId])}
                      aria-label={t("reject", "Reject")}
                      icon={<X className="size-4 text-red-600" />}
                      className="hover:bg-red-100 dark:hover:bg-red-900/40"
                    />
                  </Tooltip>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Format approval arguments for display
 */
function formatApprovalArgs(approval: PendingApproval): string {
  const args = approval.args

  switch (approval.toolName) {
    case "fs.write":
      return args.path || ""
    case "fs.apply_patch":
      return "Apply patch"
    case "fs.mkdir":
      return args.path || ""
    case "fs.delete":
      return `${args.path}${args.recursive ? " (recursive)" : ""}`
    case "git.add":
      return Array.isArray(args.paths) ? args.paths.join(", ") : ""
    case "git.commit":
      return args.message ? `"${args.message.substring(0, 40)}${args.message.length > 40 ? "..." : ""}"` : ""
    case "exec.run":
      return args.command_id || ""
    default:
      return JSON.stringify(args).substring(0, 50)
  }
}

export default ApprovalBanner

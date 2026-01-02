/**
 * SessionRestoreDialog - Dialog shown when a restorable session exists
 */

import { FC, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Modal, Button } from "antd"
import {
  RotateCcw,
  Play,
  Clock,
  MessageSquare,
  Wrench,
  AlertTriangle,
  FileEdit,
  Terminal
} from "lucide-react"
import type { StoredAgentSession } from "@/services/agent/storage"
import { formatRelativeTime } from "@/utils/dateFormatters"

interface SessionRestoreDialogProps {
  session: StoredAgentSession | null
  open: boolean
  onRestore: () => void
  onStartFresh: () => void
  onCancel: () => void
}

export const SessionRestoreDialog: FC<SessionRestoreDialogProps> = ({
  session,
  open,
  onRestore,
  onStartFresh,
  onCancel,
}) => {
  const { t } = useTranslation("common")

  // Summarize pending approvals
  const approvalSummary = useMemo(() => {
    if (!session) return null

    const pending = session.pendingApprovals.filter((a) => a.status === "pending")
    if (pending.length === 0) return null

    const fileChangePrefixes = ["fs.write", "fs.apply_patch"]
    const fileChanges = pending.filter((a) =>
      fileChangePrefixes.some((prefix) => a.toolName.startsWith(prefix))
    ).length
    const commands = pending.filter((a) => a.toolName.startsWith("exec.")).length
    const other = pending.length - fileChanges - commands

    return { total: pending.length, fileChanges, commands, other }
  }, [session])

  if (!session) return null

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-warn" />
          <span>{t("sessionFound", "Previous Session Found")}</span>
        </div>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      centered
      width={480}
    >
        <div className="space-y-4 py-2">
        {/* Session info */}
        <div className="rounded-lg bg-surface2 p-4">
          <h4
            className="mb-2 line-clamp-2 font-medium text-text"
            title={session.title || session.task}
          >
            {session.title || session.task}
          </h4>

          <div className="flex items-center gap-4 text-sm text-text-subtle">
            <span className="flex items-center gap-1">
              <Clock className="size-4" />
              {formatRelativeTime(session.updatedAt, t)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="size-4" />
              {t("messageCount", {
                count: session.messages.length,
                defaultValue_one: "{{count}} message",
                defaultValue_other: "{{count}} messages"
              })}
            </span>
            <span className="flex items-center gap-1">
              <Wrench className="size-4" />
              {t("toolCallCount", {
                count: session.toolCalls.length,
                defaultValue_one: "{{count}} tool call",
                defaultValue_other: "{{count}} tool calls"
              })}
            </span>
          </div>
        </div>

        {/* Pending approvals summary */}
        {approvalSummary && (
          <div className="rounded-lg border border-warn/30 bg-warn/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="size-4 text-warn" />
              <span className="font-medium text-warn">
                {approvalSummary.total}{" "}
                {t("pendingApprovals", {
                  count: approvalSummary.total,
                  defaultValue_one: "pending approval",
                  defaultValue_other: "pending approvals"
                })}
              </span>
            </div>

            <div className="flex items-center gap-3 text-sm text-warn">
              {approvalSummary.fileChanges > 0 && (
                <span className="flex items-center gap-1">
                  <FileEdit className="size-3.5" />
                  {approvalSummary.fileChanges}{" "}
                  {t("fileChanges", {
                    count: approvalSummary.fileChanges,
                    defaultValue_one: "file change",
                    defaultValue_other: "file changes"
                  })}
                </span>
              )}
              {approvalSummary.commands > 0 && (
                <span className="flex items-center gap-1">
                  <Terminal className="size-3.5" />
                  {approvalSummary.commands}{" "}
                  {t("commands", {
                    count: approvalSummary.commands,
                    defaultValue_one: "command",
                    defaultValue_other: "commands"
                  })}
                </span>
              )}
              {approvalSummary.other > 0 && (
                <span>
                  {approvalSummary.other} {t("other", "other")}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-text-muted">
          {t(
            "restoreSessionDesc",
            "You have an unfinished session with pending approvals. Would you like to restore it and continue where you left off, or start fresh?"
          )}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            type="primary"
            size="large"
            icon={<RotateCcw className="size-4" />}
            onClick={onRestore}
            className="flex-1"
          >
            {t("restoreSession", "Restore Session")}
          </Button>

          <Button
            size="large"
            icon={<Play className="size-4" />}
            onClick={onStartFresh}
            className="flex-1"
          >
            {t("startFresh", "Start Fresh")}
          </Button>
        </div>

        {/* Notes */}
        <div className="space-y-1 text-center text-xs text-text-subtle">
          <p>
            {t(
              "startFreshNote",
              "Starting fresh will delete the previous session."
            )}
          </p>
          <p>
            {t(
              "restoreDiffNote",
              "Note: Restored sessions show file changes but diff content may not be viewable."
            )}
          </p>
        </div>
      </div>
    </Modal>
  )
}

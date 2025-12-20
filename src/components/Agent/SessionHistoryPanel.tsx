/**
 * SessionHistoryPanel - UI for viewing and managing past sessions
 */

import { FC, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Button, Tooltip, Popconfirm, Empty, Spin } from "antd"
import {
  Clock,
  MessageSquare,
  Wrench,
  Trash2,
  RotateCcw,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pause,
  Loader2
} from "lucide-react"
import type { SessionMetadata } from "@/services/agent/storage"
import type { AgentStatus } from "@/services/agent/types"
import { formatRelativeTime } from "@/utils/dateFormatters"

interface SessionHistoryPanelProps {
  sessions: SessionMetadata[]
  isLoading: boolean
  onRestore: (sessionId: string) => void
  onDelete: (sessionId: string) => void
  onClearAll: () => void
  className?: string
}

// Status badge component
const StatusBadge: FC<{
  status: AgentStatus
  t: (key: string, defaultValue: string) => string
}> = ({ status, t }) => {
  const config: Record<
    AgentStatus,
    {
      icon: FC<{ className?: string }>
      color: string
      labelKey: string
      labelDefault: string
    }
  > = {
    idle: {
      icon: Clock,
      color: "text-gray-500 bg-gray-100 dark:bg-gray-800",
      labelKey: "statusIdle",
      labelDefault: "Idle"
    },
    running: {
      icon: Loader2,
      color: "text-blue-500 bg-blue-100 dark:bg-blue-900/40",
      labelKey: "statusRunning",
      labelDefault: "Running"
    },
    waiting_approval: {
      icon: Pause,
      color: "text-yellow-500 bg-yellow-100 dark:bg-yellow-900/40",
      labelKey: "statusPaused",
      labelDefault: "Paused"
    },
    complete: {
      icon: CheckCircle,
      color: "text-green-500 bg-green-100 dark:bg-green-900/40",
      labelKey: "statusComplete",
      labelDefault: "Complete"
    },
    error: {
      icon: XCircle,
      color: "text-red-500 bg-red-100 dark:bg-red-900/40",
      labelKey: "statusError",
      labelDefault: "Error"
    },
    cancelled: {
      icon: AlertCircle,
      color: "text-orange-500 bg-orange-100 dark:bg-orange-900/40",
      labelKey: "statusCancelled",
      labelDefault: "Cancelled"
    }
  }

  const { icon: Icon, color, labelKey, labelDefault } =
    config[status] || config.idle

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Icon className={`size-3 ${status === "running" ? "animate-spin" : ""}`} />
      {t(labelKey, labelDefault)}
    </span>
  )
}

export const SessionHistoryPanel: FC<SessionHistoryPanelProps> = ({
  sessions,
  isLoading,
  onRestore,
  onDelete,
  onClearAll,
  className = ""
}) => {
  const { t } = useTranslation("common")
  const translateStatus = (key: string, defaultValue: string) => t(key, defaultValue)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Sort sessions by updatedAt descending
  const sortedSessions = useMemo(() => {
    return [...sessions].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }, [sessions])

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Spin size="large" />
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className={`py-8 ${className}`}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("noSessions", "No saved sessions")}
        />
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header with clear all */}
      <div className="flex items-center justify-between px-1 mb-3">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {sessions.length} {sessions.length === 1 ? t("session", "session") : t("sessions", "sessions")}
        </span>
        <Popconfirm
          title={t("clearAllSessions", "Clear all sessions?")}
          description={t("clearAllSessionsDesc", "This action cannot be undone.")}
          onConfirm={onClearAll}
          okText={t("clear", "Clear")}
          cancelText={t("cancel", "Cancel")}
          okButtonProps={{ danger: true }}
        >
          <Button size="small" type="text" danger icon={<Trash2 className="size-3.5" />}>
            {t("clearAll", "Clear All")}
          </Button>
        </Popconfirm>
      </div>

      {/* Session list */}
      <div className="space-y-2">
        {sortedSessions.map((session) => {
          const isExpanded = expandedId === session.id
          const canRestore = session.status === "waiting_approval"

          return (
            <div
              key={session.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800"
            >
              {/* Session header - clickable to expand */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : session.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <ChevronRight
                  className={`size-4 text-gray-400 transition-transform flex-shrink-0 ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">
                      {session.title || session.task.substring(0, 50)}
                    </span>
                    <StatusBadge status={session.status} t={translateStatus} />
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatRelativeTime(session.updatedAt, t)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="size-3" />
                      {session.messageCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Wrench className="size-3" />
                      {session.toolCallCount}
                    </span>
                  </div>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-3 bg-gray-50 dark:bg-gray-900/50">
                  {/* Full task */}
                  <div className="mb-3">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {t("task", "Task")}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                      {session.task}
                    </p>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">{t("created", "Created")}:</span>{" "}
                      <span className="text-gray-700 dark:text-gray-300">
                        {new Date(session.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">{t("step", "Step")}:</span>{" "}
                      <span className="text-gray-700 dark:text-gray-300">{session.currentStep}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {canRestore && (
                      <Tooltip title={t("restoreSessionTip", "Restore this session to review pending approvals")}>
                        <Button
                          size="small"
                          type="primary"
                          icon={<RotateCcw className="size-3.5" />}
                          onClick={(e) => {
                            e.stopPropagation()
                            onRestore(session.id)
                          }}
                        >
                          {t("restore", "Restore")}
                        </Button>
                      </Tooltip>
                    )}

                    <Popconfirm
                      title={t("deleteSession", "Delete this session?")}
                      onConfirm={() => onDelete(session.id)}
                      okText={t("delete", "Delete")}
                      cancelText={t("cancel", "Cancel")}
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        size="small"
                        danger
                        type="text"
                        icon={<Trash2 className="size-3.5" />}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t("delete", "Delete")}
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

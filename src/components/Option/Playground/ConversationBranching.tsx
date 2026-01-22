import React from "react"
import { Tooltip, Popover, Modal, Radio } from "antd"
import { useTranslation } from "react-i18next"
import {
  GitBranch,
  GitFork,
  Copy,
  MessageSquare,
  ChevronRight,
  Trash2,
  History,
  RotateCcw,
  Plus
} from "lucide-react"

type Message = {
  id: string
  role: "user" | "assistant"
  message: string
  isBot: boolean
  name?: string
}

type BranchInfo = {
  messageId: string
  messagePreview: string
  messageIndex: number
  role: "user" | "assistant"
}

type Props = {
  messages: Message[]
  currentMessageIndex?: number
  onBranch: (fromMessageIndex: number) => void
  onFork?: (fromMessageIndex: number, includeResponse: boolean) => void
  className?: string
  compact?: boolean
}

export const ConversationBranching: React.FC<Props> = ({
  messages,
  currentMessageIndex,
  onBranch,
  onFork,
  className,
  compact = false
}) => {
  const { t } = useTranslation(["playground", "common"])
  const [branchModalOpen, setBranchModalOpen] = React.useState(false)
  const [selectedMessageIndex, setSelectedMessageIndex] = React.useState<
    number | null
  >(null)
  const [includeResponse, setIncludeResponse] = React.useState(true)

  const branchableMessages = React.useMemo(() => {
    return messages
      .map((msg, index) => ({
        ...msg,
        index,
        preview:
          msg.message.slice(0, 100) + (msg.message.length > 100 ? "..." : "")
      }))
      .filter((msg) => msg.role === "user" || msg.isBot === false)
  }, [messages])

  const handleBranchFromMessage = (index: number) => {
    onBranch(index)
    setBranchModalOpen(false)
  }

  const handleFork = () => {
    if (selectedMessageIndex !== null && onFork) {
      onFork(selectedMessageIndex, includeResponse)
      setBranchModalOpen(false)
    }
  }

  const renderBranchOptions = () => (
    <div className="space-y-3 text-xs">
      <div className="font-medium">
        {t("playground:branching.title", "Branch Conversation")}
      </div>
      <p className="text-text-muted">
        {t(
          "playground:branching.description",
          "Create a new conversation branch from any point in the chat history."
        )}
      </p>
      <div className="space-y-2">
        <div className="text-[10px] font-medium uppercase tracking-wide text-text-subtle">
          {t("playground:branching.branchFrom", "Branch from")}
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {branchableMessages.length === 0 ? (
            <div className="py-2 text-center text-text-muted">
              {t("playground:branching.noMessages", "No messages to branch from")}
            </div>
          ) : (
            branchableMessages.map((msg) => (
              <button
                key={msg.id}
                type="button"
                onClick={() => handleBranchFromMessage(msg.index)}
                className="flex w-full items-start gap-2 rounded-lg border border-border p-2 text-left transition-colors hover:border-primary/50 hover:bg-surface-hover">
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-[10px] text-text-subtle">
                    <span>#{msg.index + 1}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span className="capitalize">{msg.role}</span>
                  </div>
                  <div className="mt-0.5 truncate text-text">{msg.preview}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )

  if (compact) {
    return (
      <Popover
        content={renderBranchOptions()}
        trigger="click"
        placement="bottomRight">
        <Tooltip
          title={t("playground:branching.title", "Branch Conversation")}
          placement="top">
          <button
            type="button"
            className={`flex items-center justify-center rounded-lg border border-border p-2 text-text-muted transition-colors hover:border-primary/50 hover:bg-surface-hover hover:text-text ${className || ""}`}>
            <GitBranch className="h-4 w-4" />
          </button>
        </Tooltip>
      </Popover>
    )
  }

  return (
    <>
      <Tooltip
        title={t(
          "playground:branching.hint",
          "Create alternative conversation paths"
        )}
        placement="top">
        <button
          type="button"
          onClick={() => setBranchModalOpen(true)}
          className={`flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-primary/50 hover:bg-surface-hover hover:text-text ${className || ""}`}>
          <GitBranch className="h-4 w-4" />
          <span>{t("playground:branching.button", "Branch")}</span>
        </button>
      </Tooltip>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            {t("playground:branching.modalTitle", "Branch Conversation")}
          </div>
        }
        open={branchModalOpen}
        onCancel={() => setBranchModalOpen(false)}
        footer={null}
        width={500}>
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            {t(
              "playground:branching.modalDescription",
              "Select a message to create a new conversation branch. You can explore alternative responses or take the conversation in a different direction."
            )}
          </p>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-text-subtle">
              {t("playground:branching.selectMessage", "Select a message")}
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-2">
              {branchableMessages.length === 0 ? (
                <div className="py-4 text-center text-text-muted">
                  {t(
                    "playground:branching.noMessages",
                    "No messages to branch from"
                  )}
                </div>
              ) : (
                branchableMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      selectedMessageIndex === msg.index
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:border-border hover:bg-surface-hover"
                    }`}
                    onClick={() => setSelectedMessageIndex(msg.index)}>
                    <div
                      className={`mt-0.5 rounded-full p-1.5 ${
                        msg.role === "user"
                          ? "bg-primary/10 text-primary"
                          : "bg-accent/10 text-accent"
                      }`}>
                      <MessageSquare className="h-3 w-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium capitalize">
                          {msg.role === "user"
                            ? t("common:you", "You")
                            : t("common:assistant", "Assistant")}
                        </span>
                        <span className="text-text-subtle">
                          Message #{msg.index + 1}
                        </span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm text-text-muted">
                        {msg.preview}
                      </div>
                    </div>
                    <Radio
                      checked={selectedMessageIndex === msg.index}
                      onChange={() => setSelectedMessageIndex(msg.index)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          {selectedMessageIndex !== null && onFork && (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-text-subtle">
                {t("playground:branching.options", "Branch options")}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeResponse}
                  onChange={(e) => setIncludeResponse(e.target.checked)}
                  className="rounded border-border"
                />
                {t(
                  "playground:branching.includeResponse",
                  "Include the response that follows"
                )}
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setBranchModalOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-hover">
              {t("common:cancel", "Cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedMessageIndex !== null) {
                  if (onFork) {
                    handleFork()
                  } else {
                    handleBranchFromMessage(selectedMessageIndex)
                  }
                }
              }}
              disabled={selectedMessageIndex === null}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-surface disabled:opacity-50 hover:bg-primaryStrong">
              <GitFork className="h-4 w-4" />
              {t("playground:branching.create", "Create Branch")}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

type QuickBranchButtonProps = {
  messageIndex: number
  onBranch: (index: number) => void
  className?: string
}

export const QuickBranchButton: React.FC<QuickBranchButtonProps> = ({
  messageIndex,
  onBranch,
  className
}) => {
  const { t } = useTranslation(["playground"])

  return (
    <Tooltip
      title={t("playground:branching.quickBranch", "Branch from here")}
      placement="top">
      <button
        type="button"
        onClick={() => onBranch(messageIndex)}
        className={`rounded p-1 text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-hover hover:text-text ${className || ""}`}>
        <GitFork className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  )
}

type BranchIndicatorProps = {
  branchCount?: number
  onClick?: () => void
  className?: string
}

export const BranchIndicator: React.FC<BranchIndicatorProps> = ({
  branchCount = 0,
  onClick,
  className
}) => {
  const { t } = useTranslation(["playground"])

  if (branchCount === 0) {
    return null
  }

  return (
    <Tooltip
      title={t("playground:branching.hasBranches", "{{count}} branches", {
        count: branchCount
      })}
      placement="top">
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/20 ${className || ""}`}>
        <GitBranch className="h-3 w-3" />
        {branchCount}
      </button>
    </Tooltip>
  )
}

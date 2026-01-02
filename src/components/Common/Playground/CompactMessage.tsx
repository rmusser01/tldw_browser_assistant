import React, { useState, useMemo } from "react"
import { Tooltip, Collapse, Avatar, message as antdMessage } from "antd"
import {
  Check,
  Copy,
  Edit3,
  RotateCcw,
  Volume2,
  Square,
  GitBranch,
  ChevronDown,
  ChevronRight,
  FileText,
  Clock,
  Loader2,
  AlertCircle,
  CheckCheck,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useTTS } from "@/hooks/useTTS"
import { useUiModeStore } from "@/store/ui-mode"
import { copyToClipboard } from "@/utils/clipboard"
import { removeModelSuffix } from "@/db/dexie/models"
import { parseReasoning } from "@/libs/reasoning"
import { humanizeMilliseconds } from "@/utils/humanize-milliseconds"
import { decodeChatErrorPayload, type ChatErrorPayload } from "@/utils/chat-error-message"
import { highlightText } from "@/utils/text-highlight"
import { cn } from "@/libs/utils"
import { translateMessage } from "@/i18n/translateMessage"
import type { Source, GenerationInfo } from "./types"

const Markdown = React.lazy(() => import("../../Common/Markdown"))

const MAX_PREVIEW_SOURCES = 5

interface CompactMessageProps {
  message: string
  isBot: boolean
  name: string
  modelName?: string
  modelImage?: string
  images?: string[]
  currentMessageIndex: number
  totalMessages: number
  onRegenerate?: () => void
  onEditFormSubmit?: (value: string, isSend: boolean) => void
  isProcessing?: boolean
  isStreaming?: boolean
  sources?: Source[]
  onSourceClick?: (source: Source) => void
  isTTSEnabled?: boolean
  generationInfo?: GenerationInfo
  reasoningTimeTaken?: number
  openReasoning?: boolean
  onNewBranch?: () => void
  onStopStreaming?: () => void
  searchQuery?: string
  /** Message send status for user messages */
  sendStatus?: "sending" | "sent" | "delivered" | "error"
  /** Timestamp of the message */
  timestamp?: number
}

/**
 * Compact message layout for desktop UX redesign.
 * Features:
 * - Full-width layout (no bubbles)
 * - Inline metadata (timestamp, sources)
 * - Hover-reveal actions
 * - Inline source preview
 */
export function CompactMessage({
  message,
  isBot,
  name,
  modelName,
  modelImage,
  images,
  currentMessageIndex,
  totalMessages,
  onRegenerate,
  onEditFormSubmit,
  isProcessing,
  isStreaming,
  sources,
  onSourceClick,
  isTTSEnabled,
  generationInfo,
  reasoningTimeTaken,
  openReasoning,
  onNewBranch,
  onStopStreaming,
  searchQuery,
  sendStatus,
  timestamp,
}: CompactMessageProps) {
  const { t, i18n } = useTranslation(["common", "playground"])
  const [copied, setCopied] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editedText, setEditedText] = useState(message)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showSources, setShowSources] = useState(false)
  const { cancel, isSpeaking, speak } = useTTS()
  const uiMode = useUiModeStore((state) => state.mode)
  const isProMode = uiMode === "pro"
  const actionBarVisibility = isProMode
    ? "opacity-100"
    : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"

  // Keep edited text in sync with message prop when not actively editing
  React.useEffect(() => {
    if (!editMode) {
      setEditedText(message)
    }
  }, [message, editMode])

  const errorPayload = decodeChatErrorPayload(message)
  const displayName = isBot
    ? removeModelSuffix(modelName || name)
    : t("common:you", "You")

  // Parse reasoning blocks
  const parsedContent = useMemo(() => {
    if (!isBot) return [{ type: "text" as const, content: message }]
    return parseReasoning(message)
  }, [message, isBot])

  // Format timestamp
  const formattedTime = useMemo(() => {
    if (!timestamp) return null
    const date = new Date(timestamp)
    return date.toLocaleTimeString(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [timestamp, i18n.language])

  const handleCopy = async () => {
    await copyToClipboard({ text: message, formatted: false })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSpeak = () => {
    if (isSpeaking) {
      cancel()
    } else {
      speak({ utterance: message })
    }
  }

  // Error state
  if (errorPayload) {
    return (
      <div className="group border-b border-border bg-surface2 px-3 py-2">
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-danger text-danger">
            <AlertCircle className="size-3.5 text-danger" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs text-text-subtle">
              <span className="font-medium text-danger">
                {t("common:error", "Error")}
              </span>
              {formattedTime && <span>{formattedTime}</span>}
            </div>
            <div className="text-sm text-danger">
              <p className="font-medium">{errorPayload.summary}</p>
              {errorPayload.hint && (
                <p className="mt-1 text-xs opacity-80">{errorPayload.hint}</p>
              )}
            </div>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="mt-2 flex items-center gap-2 text-xs text-danger hover:underline"
              >
                <RotateCcw className="size-3" />
                {t("common:retry", "Retry")}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "group border-b border-border px-3 py-2 transition-colors",
        "hover:bg-surface2",
        isStreaming && "border-l-2 border-primary bg-surface2"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="shrink-0">
          {isBot ? (
            modelImage ? (
              <Avatar src={modelImage} alt={displayName} className="size-6" />
            ) : (
              <div className="size-6 rounded-full bg-gradient-to-r from-green-300 to-purple-400" />
            )
          ) : (
            <div className="size-6 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row: name + timestamp */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-text">
                {displayName}
              </span>
              {isBot && reasoningTimeTaken != null && (
                <span className="flex items-center gap-1 text-text-subtle">
                  <Clock className="size-2.5" />
                  {humanizeMilliseconds(reasoningTimeTaken)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-subtle">
              {formattedTime && <span>{formattedTime}</span>}
              {/* Send status for user messages */}
              {!isBot && sendStatus && (
                <span className="flex items-center gap-1">
                  {sendStatus === "sending" && <Loader2 className="size-2.5 animate-spin" />}
                  {sendStatus === "sent" && <Check className="size-2.5" />}
                  {sendStatus === "delivered" && <CheckCheck className="size-2.5" />}
                  {sendStatus === "error" && <AlertCircle className="size-2.5 text-danger" />}
                </span>
              )}
            </div>
          </div>

          {/* Images if any */}
          {images && images.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {images.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={
                    translateMessage(
                      t,
                      "playground:attachments.imageLabel",
                      "Attachment {{number}}",
                      { number: idx + 1 }
                    )
                  }
                  className="max-h-32 rounded border border-border"
                />
              ))}
            </div>
          )}

          {/* Message content */}
          {editMode ? (
            <div className="mt-1">
              <textarea
                value={editedText}
                onChange={(e) => {
                  setEditedText(e.target.value)
                  if (saveError) {
                    setSaveError(null)
                  }
                }}
                className="w-full rounded border border-border bg-surface p-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-focus"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={async () => {
                    if (!onEditFormSubmit) {
                      setEditMode(false)
                      return
                    }
                    try {
                      await onEditFormSubmit(editedText, false)
                      setSaveError(null)
                      setEditMode(false)
                    } catch (error) {
                      // eslint-disable-next-line no-console
                      console.error("Failed to save edited message:", error)
                      const errorMessage =
                        error instanceof Error
                          ? error.message
                          : t("common:saveFailed", "Failed to save message")
                      setSaveError(errorMessage)
                      antdMessage.error(errorMessage)
                    }
                  }}
                  className="rounded bg-primary px-3 py-1 text-xs text-surface hover:bg-primaryStrong"
                >
                  {t("common:save", "Save")}
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="rounded px-3 py-1 text-xs text-text-muted hover:bg-surface2 hover:text-text"
                >
                  {t("common:cancel", "Cancel")}
                </button>
              </div>
              {saveError && (
                <div className="mt-1 text-xs text-danger">
                  {saveError}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-text">
              {isBot ? (
                <React.Suspense fallback={<div className="h-4 w-3/4 animate-pulse rounded bg-surface2" />}>
                  {parsedContent.map((block, idx) => {
                    if (block.type === "reasoning") {
                      return (
                        <details
                          key={idx}
                          open={openReasoning}
                          className="mb-2 border-l-2 border-border pl-2 text-xs text-text-muted"
                        >
                          <summary className="cursor-pointer hover:text-text">
                            {isStreaming && block.reasoning_running ? (
                              <span className="italic animate-pulse">
                                {t("common:reasoning.thinking", "Thinking...")}
                              </span>
                            ) : (
                              t("common:reasoning.thought", "Reasoning")
                            )}
                          </summary>
                          <div className="mt-1 whitespace-pre-wrap">{block.content}</div>
                        </details>
                      )
                    }
                    return (
                      <Markdown
                        key={idx}
                        message={block.content}
                        searchQuery={searchQuery}
                      />
                    )
                  })}
                </React.Suspense>
              ) : (
                <p className="whitespace-pre-wrap">
                  {searchQuery ? highlightText(message, searchQuery) : message}
                </p>
              )}
            </div>
          )}

          {/* Inline sources preview */}
          {isBot && sources && sources.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-2 text-xs text-text-muted hover:text-text"
              >
                {showSources ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                <FileText className="size-3" />
                <span>
                  {String(
                    t("playground:sources.count", {
                      defaultValue:
                        sources.length === 1
                          ? "{{count}} source"
                          : "{{count}} sources",
                      count: sources.length
                    })
                  )}
                </span>
              </button>
              {showSources && (
                <div className="mt-2 space-y-2 border-l-2 border-border pl-4">
                  {sources.slice(0, MAX_PREVIEW_SOURCES).map((source, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSourceClick?.(source)}
                      className="block w-full rounded bg-surface2 p-2 text-left text-xs hover:bg-surface"
                    >
                      <div className="truncate font-medium text-text">
                        {source.title ||
                          source.name ||
                          translateMessage(
                            t,
                            "playground:sources.fallbackTitle",
                            "Source {{index}}",
                            { index: idx + 1 }
                          )}
                      </div>
                      {source.snippet && (
                        <div className="mt-1 truncate text-text-muted">
                          {source.snippet}
                        </div>
                      )}
                    </button>
                  ))}
                  {sources.length > MAX_PREVIEW_SOURCES && (
                    <div className="pl-2 text-xs italic text-text-subtle">
                      {t("playground:sources.more", {
                        defaultValue: "+{{count}} more",
                        count: sources.length - MAX_PREVIEW_SOURCES
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action buttons (hover reveal in Casual, always visible in Pro) */}
          <div className={`mt-2 flex items-center gap-1 transition-opacity ${actionBarVisibility}`}>
            {/* Copy */}
            <Tooltip title={copied ? t("common:copied", "Copied!") : t("common:copy", "Copy")}>
              <button
                onClick={handleCopy}
                aria-label={copied ? t("common:copied", "Copied!") : t("common:copy", "Copy")}
                className="rounded p-1 text-text-subtle hover:bg-surface2 hover:text-text"
              >
                {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              </button>
            </Tooltip>

            {/* Edit (user messages only) */}
            {!isBot && onEditFormSubmit && (
              <Tooltip title={t("common:edit", "Edit")}>
                <button
                  onClick={() => {
                    setEditedText(message)
                    setEditMode(true)
                  }}
                  aria-label={t("common:edit", "Edit")}
                  className="rounded p-1 text-text-subtle hover:bg-surface2 hover:text-text"
                >
                  <Edit3 className="size-3.5" />
                </button>
              </Tooltip>
            )}

            {/* Regenerate (bot messages only) */}
            {isBot && onRegenerate && !isStreaming && (
              <Tooltip title={t("common:regenerate", "Regenerate")}>
                <button
                  onClick={onRegenerate}
                  aria-label={t("common:regenerate", "Regenerate")}
                  className="rounded p-1 text-text-subtle hover:bg-surface2 hover:text-text"
                >
                  <RotateCcw className="size-3.5" />
                </button>
              </Tooltip>
            )}

            {/* TTS */}
            {isBot && isTTSEnabled && (
              <Tooltip title={isSpeaking ? t("common:stop", "Stop") : t("common:speak", "Speak")}>
                <button
                  onClick={handleSpeak}
                  aria-label={isSpeaking ? t("common:stop", "Stop") : t("common:speak", "Speak")}
                  className="rounded p-1 text-text-subtle hover:bg-surface2 hover:text-text"
                >
                  {isSpeaking ? <Square className="size-3.5" /> : <Volume2 className="size-3.5" />}
                </button>
              </Tooltip>
            )}

            {/* Branch */}
            {onNewBranch && (
              <Tooltip title={t("common:branch", "Create branch")}>
                <button
                  onClick={onNewBranch}
                  aria-label={t("common:branch", "Create branch")}
                  className="rounded p-1 text-text-subtle hover:bg-surface2 hover:text-text"
                >
                  <GitBranch className="size-3.5" />
                </button>
              </Tooltip>
            )}

            {/* Stop streaming */}
            {isBot && isStreaming && onStopStreaming && (
              <Tooltip title={t("common:stop", "Stop")}>
                <button
                  onClick={onStopStreaming}
                  aria-label={t("common:stop", "Stop")}
                  className="rounded p-1 text-danger hover:bg-surface2"
                >
                  <Square className="size-3.5" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CompactMessage

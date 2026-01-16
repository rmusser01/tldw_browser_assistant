import React from "react"
import { PlaygroundForm } from "./PlaygroundForm"
import { PlaygroundChat } from "./PlaygroundChat"
import { useMessageOption } from "@/hooks/useMessageOption"
import { usePlaygroundSessionPersistence } from "@/hooks/usePlaygroundSessionPersistence"
import { webUIResumeLastChat } from "@/services/app"
import {
  formatToChatHistory,
  formatToMessage,
  getPromptById,
  getRecentChatFromWebUI
} from "@/db/dexie/helpers"
import { useStoreChatModelSettings } from "@/store/model"
import { useSmartScroll } from "@/hooks/useSmartScroll"
import { ChevronDown } from "lucide-react"
import { CHAT_BACKGROUND_IMAGE_SETTING } from "@/services/settings/ui-settings"
import { otherUnsupportedTypes } from "../Knowledge/utils/unsupported-types"
import { useTranslation } from "react-i18next"
import { useStoreMessageOption } from "@/store/option"
import { useArtifactsStore } from "@/store/artifacts"
import { ArtifactsPanel } from "@/components/Sidepanel/Chat/ArtifactsPanel"
import { useSetting } from "@/hooks/useSetting"
import { useStorage } from "@plasmohq/storage/hook"
import { DEFAULT_CHAT_SETTINGS } from "@/types/chat-settings"
import { useLoadLocalConversation } from "@/hooks/useLoadLocalConversation"
import {
  EDIT_MESSAGE_EVENT,
  OPEN_HISTORY_EVENT,
  TIMELINE_ACTION_EVENT,
  type OpenHistoryDetail,
  type TimelineActionDetail
} from "@/utils/timeline-actions"
import { useCharacterGreeting } from "@/hooks/useCharacterGreeting"
export const Playground = () => {
  const drop = React.useRef<HTMLDivElement>(null)
  const [droppedFiles, setDroppedFiles] = React.useState<File[]>([])
  const { t } = useTranslation(["playground", "common"])
  const [chatBackgroundImage] = useSetting(CHAT_BACKGROUND_IMAGE_SETTING)
  const [stickyChatInput] = useStorage(
    "stickyChatInput",
    DEFAULT_CHAT_SETTINGS.stickyChatInput
  )
  const {
    messages,
    history,
    historyId,
    serverChatId,
    isLoading,
    setHistoryId,
    setHistory,
    setMessages,
    setSelectedSystemPrompt,
    setSelectedModel,
    setServerChatId,
    setContextFiles,
    createChatBranch,
    streaming,
    selectedCharacter,
    setSelectedCharacter
  } = useMessageOption()
  const { setSystemPrompt } = useStoreChatModelSettings()
  const { containerRef, isAutoScrollToBottom, autoScrollToBottom } =
    useSmartScroll(messages, streaming, 120)

  const [dropState, setDropState] = React.useState<
    "idle" | "dragging" | "error"
  >("idle")
  const [dropFeedback, setDropFeedback] = React.useState<
    { type: "info" | "error"; message: string } | null
  >(null)
  const [playgroundReady, setPlaygroundReady] = React.useState(false)
  const feedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const timelineActionRetryTimeoutRef = React.useRef<
    ReturnType<typeof setTimeout> | null
  >(null)
  const initializePlaygroundRef = React.useRef(false)

  const showDropFeedback = React.useCallback(
    (feedback: { type: "info" | "error"; message: string }) => {
      setDropFeedback(feedback)
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current)
      }
      feedbackTimerRef.current = setTimeout(() => {
        setDropFeedback(null)
        feedbackTimerRef.current = null
      }, 4000)
    },
    []
  )

  React.useEffect(() => {
    if (!drop.current) {
      return
    }
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      setDropState("idle")

      const files = Array.from(e.dataTransfer?.files || [])

      const hasUnsupportedFiles = files.some((file) =>
        otherUnsupportedTypes.includes(file.type)
      )

      if (hasUnsupportedFiles) {
        setDropState("error")
        showDropFeedback({
          type: "error",
          message: t(
            "playground:drop.unsupported",
            "That file type isn’t supported. Try images or text-based files."
          )
        })
        return
      }

      const newFiles = Array.from(e.dataTransfer?.files || []).slice(0, 5) // Allow multiple files
      if (newFiles.length > 0) {
        setDroppedFiles(newFiles)
        showDropFeedback({
          type: "info",
          message:
            newFiles.length > 1
              ? t("playground:drop.readyMultiple", {
                  count: newFiles.length
                })
              : t("playground:drop.readySingle", {
                  name:
                    newFiles[0]?.name ||
                    t("playground:drop.defaultFileName", "File")
                })
        })
      }
    }
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDropState("dragging")
      showDropFeedback({
        type: "info",
        message: t(
          "playground:drop.hint",
          "Drop files to attach them to your message"
        )
      })
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDropState("idle")
    }

    drop.current.addEventListener("dragover", handleDragOver)
    drop.current.addEventListener("drop", handleDrop)
    drop.current.addEventListener("dragenter", handleDragEnter)
    drop.current.addEventListener("dragleave", handleDragLeave)

    return () => {
      if (drop.current) {
        drop.current.removeEventListener("dragover", handleDragOver)
        drop.current.removeEventListener("drop", handleDrop)
        drop.current.removeEventListener("dragenter", handleDragEnter)
        drop.current.removeEventListener("dragleave", handleDragLeave)
      }
    }
  }, [showDropFeedback, t])

  React.useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current)
      }
      if (timelineActionRetryTimeoutRef.current) {
        clearTimeout(timelineActionRetryTimeoutRef.current)
      }
    }
  }, [])

  // Session persistence for draft restoration
  const { restoreSession, hasPersistedSession } = usePlaygroundSessionPersistence()

  const initializePlayground = React.useCallback(async () => {
    if (serverChatId) {
      return
    }
    // 1. Try session persistence first (restores exact state from nav-away)
    if (hasPersistedSession && messages.length === 0) {
      const restored = await restoreSession()
      if (restored) return
    }

    // 2. Fall back to existing webUIResumeLastChat behavior
    const isEnabled = await webUIResumeLastChat()
    if (!isEnabled) return

    if (messages.length === 0) {
      const recentChat = await getRecentChatFromWebUI()
      if (recentChat) {
        setHistoryId(recentChat.history.id)
        setHistory(formatToChatHistory(recentChat.messages))
        setMessages(formatToMessage(recentChat.messages))

        const lastUsedPrompt = recentChat?.history?.last_used_prompt
        if (lastUsedPrompt) {
          if (lastUsedPrompt.prompt_id) {
            const prompt = await getPromptById(lastUsedPrompt.prompt_id)
            if (prompt) {
              setSelectedSystemPrompt(lastUsedPrompt.prompt_id)
              if (!lastUsedPrompt.prompt_content?.trim()) {
                setSystemPrompt(prompt.content)
              }
            }
          }
          if (lastUsedPrompt.prompt_content?.trim()) {
            setSystemPrompt(lastUsedPrompt.prompt_content)
          }
        }
      }
    }
  }, [
    hasPersistedSession,
    messages.length,
    restoreSession,
    serverChatId,
    setHistory,
    setHistoryId,
    setMessages,
    setSelectedSystemPrompt,
    setSystemPrompt
  ])

  React.useEffect(() => {
    if (initializePlaygroundRef.current) {
      return
    }
    initializePlaygroundRef.current = true
    let cancelled = false
    const run = async () => {
      await initializePlayground()
      if (!cancelled) {
        setPlaygroundReady(true)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [initializePlayground])

  useCharacterGreeting({
    playgroundReady,
    selectedCharacter,
    serverChatId,
    messagesLength: messages.length,
    setMessages,
    setHistory,
    setSelectedCharacter
  })

  const loadLocalConversation = useLoadLocalConversation(
    {
      setServerChatId,
      setHistoryId: (id) => setHistoryId(id, { preserveServerChatId: false }),
      setHistory,
      setMessages,
      setSelectedModel: (id) => setSelectedModel(id),
      setSelectedSystemPrompt: (id) => {
        if (id) {
          setSelectedSystemPrompt(id)
        }
      },
      setSystemPrompt,
      setContextFiles
    },
    {
      t,
      errorLogPrefix: t(
        "playground:errors.loadLocalHistoryPrefix",
        "Failed to load local chat history"
      ),
      errorDefaultMessage: t(
        "playground:errors.loadLocalHistoryDefault",
        "Something went wrong while loading local chat history."
      )
    }
  )

  const pendingTimelineActionRef = React.useRef<TimelineActionDetail | null>(null)

  const findMessageIndex = React.useCallback(
    (messageId: string) =>
      messages.findIndex(
        (message) =>
          message.id === messageId || message.serverMessageId === messageId
      ),
    [messages]
  )

  const scrollToMessage = React.useCallback(
    (messageId: string) => {
      const container = containerRef.current
      if (!container) return false
      const target = container.querySelector<HTMLElement>(
        `[data-message-id="${messageId}"], [data-server-message-id="${messageId}"]`
      )
      if (!target) return false
      target.scrollIntoView({ block: "center", behavior: "smooth" })
      return true
    },
    [containerRef]
  )

  const dispatchEditMessage = React.useCallback((messageId: string) => {
    if (typeof window === "undefined") return
    window.dispatchEvent(
      new CustomEvent(EDIT_MESSAGE_EVENT, { detail: { messageId } })
    )
  }, [])

  const performTimelineAction = React.useCallback(
    (detail: TimelineActionDetail) => {
      if (!detail?.historyId) return true
      if (detail.historyId !== historyId) return false

      if (detail.action === "branch") {
        if (!detail.messageId) return true
        if (messages.length === 0) return false
        const index = findMessageIndex(detail.messageId)
        if (index < 0) return true
        void createChatBranch(index)
        return true
      }

      if (!detail.messageId) return true

      const scrolled = scrollToMessage(detail.messageId)
      if (!scrolled) {
        if (!containerRef.current) return false
        if (timelineActionRetryTimeoutRef.current) {
          clearTimeout(timelineActionRetryTimeoutRef.current)
        }
        timelineActionRetryTimeoutRef.current = setTimeout(() => {
          timelineActionRetryTimeoutRef.current = null
          const retry = scrollToMessage(detail.messageId)
          if (retry && detail.action === "edit") {
            dispatchEditMessage(detail.messageId)
          }
        }, 80)
        return true
      }

      if (detail.action === "edit") {
        dispatchEditMessage(detail.messageId)
      }
      return true
    },
    [
      containerRef,
      createChatBranch,
      dispatchEditMessage,
      findMessageIndex,
      historyId,
      messages.length,
      scrollToMessage,
      timelineActionRetryTimeoutRef
    ]
  )

  const enqueueTimelineAction = React.useCallback(
    (detail: TimelineActionDetail) => {
      if (!detail?.historyId) return
      if (detail.historyId !== historyId) {
        pendingTimelineActionRef.current = detail
        void loadLocalConversation(detail.historyId)
        return
      }

      const handled = performTimelineAction(detail)
      if (!handled) {
        pendingTimelineActionRef.current = detail
      }
    },
    [historyId, loadLocalConversation, performTimelineAction]
  )

  React.useEffect(() => {
    const pending = pendingTimelineActionRef.current
    if (!pending) return
    const handled = performTimelineAction(pending)
    if (handled) {
      pendingTimelineActionRef.current = null
    }
  }, [historyId, messages, performTimelineAction])

  React.useEffect(() => {
    if (typeof window === "undefined") return

    const handleTimelineActionEvent = (event: Event) => {
      const detail = (event as CustomEvent<TimelineActionDetail>).detail
      if (!detail?.historyId) return
      enqueueTimelineAction(detail)
    }

    const handleOpenHistoryEvent = (event: Event) => {
      const detail = (event as CustomEvent<OpenHistoryDetail>).detail
      if (!detail?.historyId) return
      enqueueTimelineAction({
        action: "go",
        historyId: detail.historyId,
        messageId: detail.messageId
      })
    }

    window.addEventListener(TIMELINE_ACTION_EVENT, handleTimelineActionEvent)
    window.addEventListener(OPEN_HISTORY_EVENT, handleOpenHistoryEvent)
    return () => {
      window.removeEventListener(TIMELINE_ACTION_EVENT, handleTimelineActionEvent)
      window.removeEventListener(OPEN_HISTORY_EVENT, handleOpenHistoryEvent)
    }
  }, [enqueueTimelineAction])

  const compareParentByHistory = useStoreMessageOption(
    (state) => state.compareParentByHistory
  )
  const artifactsOpen = useArtifactsStore((state) => state.isOpen)
  const closeArtifacts = useArtifactsStore((state) => state.closeArtifact)

  const parentMeta =
    historyId && compareParentByHistory
      ? compareParentByHistory[historyId]
      : undefined

  return (
    <div
      ref={drop}
      data-is-dragging={dropState === "dragging"}
      className="relative flex h-full flex-col items-center bg-bg text-text data-[is-dragging=true]:bg-surface2"
      style={
        chatBackgroundImage
          ? {
              backgroundImage: `url(${chatBackgroundImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat"
            }
          : {}
      }>
      {/* Background overlay for opacity effect */}
      {chatBackgroundImage && (
        <div
          className="absolute inset-0 bg-bg"
          style={{ opacity: 0.9, pointerEvents: "none" }}
        />
      )}

      {dropState === "dragging" && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center">
          <div className="rounded-2xl border border-dashed border-border bg-elevated px-6 py-4 text-center text-sm font-medium text-text shadow-card">
            {t("playground:drop.hint", "Drop files to attach them to your message")}
          </div>
        </div>
      )}

      {dropFeedback && (
        <div className="pointer-events-none absolute top-4 left-0 right-0 z-30 flex justify-center px-4">
          <div
            role="status"
            aria-live="polite"
            className={`max-w-lg rounded-full px-4 py-2 text-sm shadow-lg backdrop-blur-sm ${
              dropFeedback.type === "error"
                ? "border border-danger bg-danger text-white"
                : "border border-border bg-elevated text-text"
            }`}
          >
            {dropFeedback.message}
          </div>
        </div>
      )}

      <div className="relative z-10 flex h-full w-full">
        <div className="flex h-full min-w-0 flex-1 flex-col">
          {parentMeta?.parentHistoryId && (
            <div className="flex w-full justify-center px-5 pt-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-primary bg-surface2 px-3 py-1 text-[11px] font-medium text-primaryStrong hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                title={t(
                  "playground:composer.compareBreadcrumb",
                  "Back to comparison chat"
                )}
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("tldw:open-history", {
                      detail: { historyId: parentMeta.parentHistoryId }
                    })
                  )
                }}>
                <span aria-hidden="true">←</span>
                <span>
                  {t(
                    "playground:composer.compareBreadcrumb",
                    "Back to comparison chat"
                  )}
                </span>
              </button>
            </div>
          )}
          <div
            ref={containerRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label={t("playground:aria.chatTranscript", "Chat messages")}
            className="custom-scrollbar flex-1 min-h-0 w-full overflow-x-hidden overflow-y-auto px-4">
            <div className="mx-auto w-full max-w-[52rem] pb-6">
              <PlaygroundChat />
            </div>
          </div>
          <div
            className={`relative w-full ${
              stickyChatInput
                ? "sticky bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur"
                : ""
            }`}
          >
            {!isAutoScrollToBottom && (
              <div className="pointer-events-none absolute -top-10 left-0 right-0 flex justify-center">
                <button
                  onClick={() => autoScrollToBottom()}
                  aria-label={t("playground:composer.scrollToLatest", "Scroll to latest messages")}
                  title={t("playground:composer.scrollToLatest", "Scroll to latest messages") as string}
                  className="pointer-events-auto rounded-full border border-border bg-surface p-2 text-text-subtle shadow-card transition-colors hover:bg-surface2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                  <ChevronDown className="size-4 text-text-subtle" aria-hidden="true" />
                </button>
              </div>
            )}
            <PlaygroundForm droppedFiles={droppedFiles} />
          </div>
        </div>
        {artifactsOpen && (
          <>
            <div className="hidden h-full w-[36%] min-w-[280px] max-w-[520px] shrink-0 lg:flex">
              <ArtifactsPanel />
            </div>
            <div className="lg:hidden">
              <button
                type="button"
                aria-label={t("common:close", "Close")}
                title={t("common:close", "Close") as string}
                onClick={closeArtifacts}
                className="fixed inset-0 z-40 bg-black/40"
              />
              <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[520px]">
                <ArtifactsPanel />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

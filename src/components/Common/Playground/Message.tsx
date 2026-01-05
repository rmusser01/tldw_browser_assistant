import React, { useEffect } from "react"
import { Tag, Image, Tooltip, Collapse, Avatar, Modal, message } from "antd"
import { LoadingStatus } from "./ActionInfo"
import { StopCircle as StopCircleIcon } from "lucide-react"
import { EditMessageForm } from "./EditMessageForm"
import { useTranslation } from "react-i18next"
import { useTTS } from "@/hooks/useTTS"
import { tagColors } from "@/utils/color"
import { removeModelSuffix } from "@/db/dexie/models"
import { parseReasoning } from "@/libs/reasoning"
import {
  decodeChatErrorPayload,
  type ChatErrorPayload
} from "@/utils/chat-error-message"
import { useStorage } from "@plasmohq/storage/hook"
import { PlaygroundUserMessageBubble } from "./PlaygroundUserMessage"
import { copyToClipboard } from "@/utils/clipboard"
import { ChatDocuments } from "@/models/ChatTypes"
import { buildChatTextClass } from "@/utils/chat-style"
import { highlightText } from "@/utils/text-highlight"
import { FeedbackModal } from "@/components/Sidepanel/Chat/FeedbackModal"
import { SourceFeedback } from "@/components/Sidepanel/Chat/SourceFeedback"
import { ToolCallBlock, type ToolCall, type ToolCallResult } from "@/components/Sidepanel/Chat/ToolCallBlock"
import { MessageActionsBar } from "./MessageActionsBar"
import { ReasoningBlock } from "./ReasoningBlock"
import { useFeedback } from "@/hooks/useFeedback"
import { useImplicitFeedback } from "@/hooks/useImplicitFeedback"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"
import { useTldwAudioStatus } from "@/hooks/useTldwAudioStatus"
import { getSourceFeedbackKey } from "@/utils/feedback"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { useUiModeStore } from "@/store/ui-mode"
import { useStoreMessageOption } from "@/store/option"
import type { MessageVariant } from "@/store/option"

const Markdown = React.lazy(() => import("../../Common/Markdown"))

const ErrorBubble: React.FC<{
  payload: ChatErrorPayload
  toggleLabels: { show: string; hide: string }
}> = ({ payload, toggleLabels }) => {
  const [showDetails, setShowDetails] = React.useState(false)

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-100">
      <p className="font-semibold">{payload.summary}</p>
      {payload.hint && (
        <p className="mt-1 text-xs text-red-900 dark:text-red-100">
          {payload.hint}
        </p>
      )}
      {payload.detail && (
        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          title={showDetails ? toggleLabels.hide : toggleLabels.show}
          className="mt-2 text-xs font-medium text-red-800 underline hover:text-red-700 dark:text-red-200 dark:hover:text-red-100">
          {showDetails ? toggleLabels.hide : toggleLabels.show}
        </button>
      )}
      {showDetails && payload.detail && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-red-100/70 p-2 text-xs text-red-900 dark:bg-red-900/40 dark:text-red-100">
          {payload.detail}
        </pre>
      )}
    </div>
  )
}

type Props = {
  message: string
  message_type?: string
  hideCopy?: boolean
  botAvatar?: JSX.Element
  userAvatar?: JSX.Element
  isBot: boolean
  name: string
  images?: string[]
  currentMessageIndex: number
  totalMessages: number
  onRegenerate: () => void
  onEditFormSubmit: (value: string, isSend: boolean) => void
  isProcessing: boolean
  webSearch?: {}
  isSearchingInternet?: boolean
  sources?: any[]
  hideEditAndRegenerate?: boolean
  hideContinue?: boolean
  onSourceClick?: (source: any) => void
  isTTSEnabled?: boolean
  generationInfo?: any
  isStreaming: boolean
  reasoningTimeTaken?: number
  openReasoning?: boolean
  modelImage?: string
  modelName?: string
  onContinue?: () => void
  documents?: ChatDocuments
  actionInfo?: string | null
  onNewBranch?: () => void
  temporaryChat?: boolean
  onStopStreaming?: () => void
  serverChatId?: string | null
  serverMessageId?: string | null
  messageId?: string
  feedbackQuery?: string | null
  searchQuery?: string
  isEmbedding?: boolean
  createdAt?: number | string
  variants?: MessageVariant[]
  activeVariantIndex?: number
  onSwipePrev?: () => void
  onSwipeNext?: () => void
  // Compare/multi-model metadata (optional)
  compareSelectable?: boolean
  compareSelected?: boolean
  onToggleCompareSelect?: () => void
  compareError?: boolean
  compareChosen?: boolean
  // Tool/function calls (optional)
  toolCalls?: ToolCall[]
  toolResults?: ToolCallResult[]
  historyId?: string
  conversationInstanceId: string
  onDeleteMessage?: () => void
}

export const PlaygroundMessage = (props: Props) => {
  const [isBtnPressed, setIsBtnPressed] = React.useState(false)
  const [editMode, setEditMode] = React.useState(false)
  const [checkWideMode] = useStorage("checkWideMode", false)
  const [isUserChatBubble] = useStorage("userChatBubble", true)
  const [autoCopyResponseToClipboard] = useStorage(
    "autoCopyResponseToClipboard",
    false
  )
  const [autoPlayTTS] = useStorage("isTTSAutoPlayEnabled", false)
  const [copyAsFormattedText] = useStorage("copyAsFormattedText", false)
  const [userTextColor] = useStorage("chatUserTextColor", "default")
  const [assistantTextColor] = useStorage("chatAssistantTextColor", "default")
  const [userTextFont] = useStorage("chatUserTextFont", "default")
  const [assistantTextFont] = useStorage("chatAssistantTextFont", "default")
  const [userTextSize] = useStorage("chatUserTextSize", "md")
  const [assistantTextSize] = useStorage("chatAssistantTextSize", "md")
  const [ttsProvider] = useStorage("ttsProvider", "browser")
  const { t } = useTranslation(["common", "playground"])
  const { capabilities } = useServerCapabilities()
  const uiMode = useUiModeStore((state) => state.mode)
  const isProMode = uiMode === "pro"
  const setReplyTarget = useStoreMessageOption((state) => state.setReplyTarget)
  const { cancel, isSpeaking, speak } = useTTS()
  const { healthState: audioHealthState, voicesAvailable } =
    useTldwAudioStatus({
      requireVoices: ttsProvider === "tldw"
    })
  const [isFeedbackOpen, setIsFeedbackOpen] = React.useState(false)
  const [savingKnowledge, setSavingKnowledge] = React.useState<
    "note" | "flashcard" | null
  >(null)
  const isLastMessage: boolean =
    props.currentMessageIndex === props.totalMessages - 1
  const errorPayload = decodeChatErrorPayload(props.message)
  const errorFriendlyText = React.useMemo(() => {
    if (!errorPayload) return null
    return [errorPayload.summary, errorPayload.hint, errorPayload.detail]
    .filter(Boolean)
    .join("\n")
  }, [errorPayload])
  const messageTimestamp = React.useMemo(() => {
    const info = props.generationInfo as
      | { created_at?: string | number; createdAt?: string | number; timestamp?: string | number }
      | undefined
    const raw =
      props.createdAt ??
      info?.created_at ??
      info?.createdAt ??
      info?.timestamp
    if (!raw) return null
    const date =
      typeof raw === "number"
        ? new Date(raw)
        : new Date(Date.parse(String(raw)))
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    })
  }, [props.createdAt, props.generationInfo])
  const variantCount = props.variants?.length ?? 0
  const resolvedVariantIndex = (() => {
    const fallback =
      typeof props.activeVariantIndex === "number"
        ? props.activeVariantIndex
        : variantCount > 0
          ? variantCount - 1
          : 0
    if (variantCount <= 0) return 0
    return Math.max(0, Math.min(fallback, variantCount - 1))
  })()
  const showVariantPager = props.isBot && variantCount > 1
  const canSwipePrev =
    showVariantPager && Boolean(props.onSwipePrev) && resolvedVariantIndex > 0
  const canSwipeNext =
    showVariantPager &&
    Boolean(props.onSwipeNext) &&
    resolvedVariantIndex < variantCount - 1

  const messageKey = React.useMemo(() => {
    if (props.serverMessageId) return `srv:${props.serverMessageId}`
    if (props.messageId) return `local:${props.messageId}`
    // Always include conversation context to prevent key collisions across chats
    const conversationScope =
      props.serverChatId || props.historyId || props.conversationInstanceId
    return `${conversationScope}:${props.currentMessageIndex}`
  }, [
    props.conversationInstanceId,
    props.currentMessageIndex,
    props.historyId,
    props.messageId,
    props.serverChatId,
    props.serverMessageId
  ])

  const {
    thumb,
    detail,
    sourceFeedback,
    canSubmit,
    isSubmitting: isFeedbackSubmitting,
    showThanks,
    submitThumb,
    submitDetail,
    submitSourceThumb
  } = useFeedback({
    messageKey,
    conversationId: props.serverChatId ?? null,
    messageId: props.serverMessageId ?? null,
    query: props.feedbackQuery ?? null
  })

  const feedbackExplicitAvailable = Boolean(capabilities?.hasFeedbackExplicit)
  const feedbackImplicitAvailable = Boolean(capabilities?.hasFeedbackImplicit)
  const canSaveKnowledge =
    Boolean(capabilities?.hasChatKnowledgeSave) &&
    Boolean(capabilities?.hasNotes || capabilities?.hasFlashcards) &&
    Boolean(props.serverChatId) &&
    Boolean(props.serverMessageId) &&
    !props.temporaryChat &&
    !errorPayload
  const canSaveToNotes = canSaveKnowledge && Boolean(capabilities?.hasNotes)
  const canSaveToFlashcards =
    canSaveKnowledge && Boolean(capabilities?.hasFlashcards)
  const canGenerateDocument =
    Boolean(capabilities?.hasChatDocuments) &&
    Boolean(props.serverChatId) &&
    props.isBot &&
    !props.temporaryChat &&
    !errorPayload
  const replyId = props.messageId ?? props.serverMessageId ?? null
  const canReply =
    isProMode &&
    Boolean(replyId) &&
    !props.compareSelectable &&
    !props.message_type?.startsWith("compare")

  const buildReplyPreview = React.useCallback(
    (value: string) => {
      const collapsed = value.replace(/\s+/g, " ").trim()
      if (!collapsed) {
        return t("common:replyTargetFallback", "Message")
      }
      if (collapsed.length > 140) {
        return `${collapsed.slice(0, 137)}...`
      }
      return collapsed
    },
    [t]
  )

  const { trackCopy, trackSourcesExpanded, trackSourceClick } =
    useImplicitFeedback({
      conversationId: props.serverChatId ?? null,
      messageId: props.serverMessageId ?? null,
      query: props.feedbackQuery ?? null,
      sources: props.sources ?? [],
      enabled: feedbackImplicitAvailable
    })

  const handleReply = React.useCallback(() => {
    if (!replyId) return
    setReplyTarget({
      id: replyId,
      preview: buildReplyPreview(errorFriendlyText || props.message),
      name: props.name,
      isBot: props.isBot
    })
  }, [
    replyId,
    setReplyTarget,
    buildReplyPreview,
    errorFriendlyText,
    props.message,
    props.name,
    props.isBot
  ])

  const handleCopy = React.useCallback(async () => {
    await copyToClipboard({
      text: errorFriendlyText || props.message,
      formatted: copyAsFormattedText
    })
    trackCopy()
    setIsBtnPressed(true)
    setTimeout(() => {
      setIsBtnPressed(false)
    }, 2000)
  }, [copyAsFormattedText, errorFriendlyText, props.message, trackCopy])

  const handleGenerateDocument = React.useCallback(() => {
    if (!props.serverChatId || typeof window === "undefined") return
    window.dispatchEvent(
      new CustomEvent("tldw:open-document-generator", {
        detail: {
          conversationId: props.serverChatId,
          message: errorFriendlyText || props.message,
          messageId: props.serverMessageId
        }
      })
    )
  }, [errorFriendlyText, props.message, props.serverChatId, props.serverMessageId])

  const handleSaveKnowledge = async (makeFlashcard: boolean) => {
    if (!props.serverChatId || !props.serverMessageId) return
    const snippet = (errorFriendlyText || props.message || "").trim()
    if (!snippet) {
      message.error(t("saveToNotesEmpty", "Nothing to save yet."))
      return
    }
    setSavingKnowledge(makeFlashcard ? "flashcard" : "note")
    try {
      await tldwClient.initialize().catch(() => null)
      await tldwClient.saveChatKnowledge({
        conversation_id: props.serverChatId,
        message_id: props.serverMessageId,
        snippet,
        make_flashcard: makeFlashcard
      })
      message.success(
        makeFlashcard
          ? t("savedToFlashcards", "Saved to Flashcards")
          : t("savedToNotes", "Saved to Notes")
      )
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("somethingWentWrong")
      message.error(errorMessage)
    } finally {
      setSavingKnowledge(null)
    }
  }

  const autoCopyToClipboard = async () => {
    if (
      autoCopyResponseToClipboard &&
      props.isBot &&
      isLastMessage &&
      !props.isStreaming &&
      !props.isProcessing &&
      props.message.trim().length > 0 &&
      !errorPayload &&
      !ttsActionDisabled
    ) {
      await copyToClipboard({
        text: props.message,
        formatted: copyAsFormattedText
      })
      trackCopy()
      setIsBtnPressed(true)
      setTimeout(() => {
        setIsBtnPressed(false)
      }, 2000)
    }
  }

  useEffect(() => {
    autoCopyToClipboard()
  }, [
    autoCopyResponseToClipboard,
    props.isBot,
    props.currentMessageIndex,
    props.totalMessages,
    props.isStreaming,
    props.isProcessing,
    props.message
  ])

  const userTextClass = React.useMemo(
    () => buildChatTextClass(userTextColor, userTextFont, userTextSize),
    [userTextColor, userTextFont, userTextSize]
  )

  const assistantTextClass = React.useMemo(
    () =>
      buildChatTextClass(
        assistantTextColor,
        assistantTextFont,
        assistantTextSize
      ),
    [assistantTextColor, assistantTextFont, assistantTextSize]
  )

  const chatTextClass = props.isBot ? assistantTextClass : userTextClass

  const shouldShowLoadingStatus =
    props.isBot &&
    isLastMessage &&
    (props.isProcessing ||
      props.isStreaming ||
      props.isSearchingInternet ||
      props.actionInfo ||
      props.isEmbedding)

  const isActiveResponse =
    props.isBot &&
    isLastMessage &&
    (props.isStreaming || props.isProcessing)
  const feedbackDisabled =
    !canSubmit ||
    Boolean(errorPayload) ||
    !feedbackExplicitAvailable ||
    isActiveResponse
  const feedbackDisabledReason =
    !canSubmit || Boolean(errorPayload) || !feedbackExplicitAvailable
      ? t(
          "playground:feedback.unavailable",
          "Feedback is unavailable for this message."
        )
      : t(
          "playground:feedback.disabled",
          "Feedback is available after the response finishes."
        )

  const tldwTtsSelected = ttsProvider === "tldw"
  const ttsBlockedByHealth =
    tldwTtsSelected &&
    (audioHealthState === "unhealthy" || audioHealthState === "unavailable")
  const ttsBlockedByVoices = tldwTtsSelected && voicesAvailable === false
  const ttsActionDisabled = ttsBlockedByHealth || ttsBlockedByVoices
  const ttsDisabledReason = ttsBlockedByHealth
    ? audioHealthState === "unavailable"
      ? t(
          "playground:tts.tldwStatusOffline",
          "Audio API not detected; check your tldw server version."
        )
      : t(
          "playground:tts.chatDisabledUnhealthy",
          "Audio service is unhealthy. Check Settings → Health."
        )
    : ttsBlockedByVoices
      ? t(
          "playground:tts.chatDisabledNoVoices",
          "No TTS voices are available on the server."
        )
      : null

  const handleToggleTts = React.useCallback(() => {
    if (ttsActionDisabled) return
    if (isSpeaking) {
      cancel()
      return
    }
    speak({
      utterance: errorFriendlyText || props.message
    })
  }, [
    ttsActionDisabled,
    isSpeaking,
    cancel,
    speak,
    errorFriendlyText,
    props.message
  ])

  const handleDelete = React.useCallback(() => {
    if (!props.onDeleteMessage) return

    Modal.confirm({
      title: t("common:confirmTitle", "Please confirm"),
      content: t("common:deleteMessageConfirm", "Delete this message?"),
      okText: t("common:delete", "Delete"),
      cancelText: t("common:cancel", "Cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await props.onDeleteMessage?.()
          message.success(t("common:deleted", "Deleted"))
        } catch (err) {
          const fallback = t("common:deleteFailed", "Delete failed")
          const errorMessage = err instanceof Error ? err.message : ""
          message.error(errorMessage || fallback)
        }
      }
    })
  }, [props.onDeleteMessage, t])

  const actionRowVisibility = isProMode
    ? "flex"
    : "hidden group-hover:flex group-focus-within:flex"
  const overflowChipVisibility = isProMode
    ? "hidden"
    : "inline-flex group-hover:hidden"
  const showInlineActions = !props.isProcessing && !editMode

  const handleThumbUp = React.useCallback(() => {
    void submitThumb("up")
  }, [submitThumb])

  const handleThumbDown = React.useCallback(() => {
    setIsFeedbackOpen(true)
    void submitThumb("down")
  }, [submitThumb])

  const handleOpenDetails = React.useCallback(() => {
    setIsFeedbackOpen(true)
  }, [])

  useEffect(() => {
    if (
      autoPlayTTS &&
      props.isTTSEnabled &&
      props.isBot &&
      isLastMessage &&
      !props.isStreaming &&
      !props.isProcessing &&
      props.message.trim().length > 0 &&
      !errorPayload
    ) {
      let messageToSpeak = props.message

      speak({
        utterance: messageToSpeak
      })
    }
  }, [
    autoPlayTTS,
    props.isTTSEnabled,
    props.isBot,
    props.currentMessageIndex,
    props.totalMessages,
    props.isStreaming,
    props.isProcessing,
    props.message,
    errorPayload,
    ttsActionDisabled
  ])

  const compareLabel = t("playground:composer.compareTag", "Compare")

  if (isUserChatBubble && !props.isBot) {
    return (
      <PlaygroundUserMessageBubble
        {...props}
        onDelete={props.onDeleteMessage ? handleDelete : undefined}
      />
    )
  }

  const MARKDOWN_BASE_CLASSES =
    "prose break-words text-message dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 dark:prose-dark"
  const hasSources = props.isBot && Boolean(props?.sources?.length)
  const messageSpacing = isProMode
    ? `gap-2 px-4 pt-3 ${hasSources ? "pb-4" : "pb-2.5"}`
    : `gap-1.5 px-3 pt-2 ${hasSources ? "pb-3" : "pb-2"}`
  const messageCardClass = props.isBot
    ? `flex flex-col rounded-2xl border border-border bg-surface/70 shadow-sm ${messageSpacing}`
    : `flex flex-col rounded-2xl border border-border bg-surface2/70 shadow-sm ${messageSpacing}`
  return (
    <div
      data-testid="chat-message"
      data-role={props.isBot ? "assistant" : "user"}
      data-index={props.currentMessageIndex}
      className={`group relative flex w-full max-w-3xl flex-col items-end justify-center text-text ${
        isProMode ? "pb-2 md:px-4" : "pb-1 md:px-3"
      } ${checkWideMode ? "max-w-none" : ""}`}>
      {/* Inline stop button while streaming on the latest assistant message */}
      {props.isBot && (props.isStreaming || props.isProcessing) && isLastMessage && props.onStopStreaming && (
        <div className="absolute right-2 top-0 z-10">
          <Tooltip title={t("playground:tooltip.stopStreaming") as string}>
            <button
              type="button"
              onClick={props.onStopStreaming}
              data-testid="chat-message-stop-streaming"
              title={t("playground:composer.stopStreaming") as string}
              className="rounded-md border border-border bg-surface/70 p-1 text-text backdrop-blur hover:bg-surface">
              <StopCircleIcon className="w-5 h-5" />
              <span className="sr-only">{t("playground:composer.stopStreaming")}</span>
            </button>
          </Tooltip>
        </div>
      )}
      {/* <div className="text-base md:max-w-2xl lg:max-w-xl xl:max-w-3xl flex lg:px-0 m-auto w-full"> */}
      <div
        className={`flex flex-row m-auto w-full ${
          isProMode ? "gap-4 md:gap-6 my-2" : "gap-3 md:gap-4 my-1.5"
        }`}>
        <div className="w-8 flex flex-col relative items-end">
          {props.isBot ? (
            !props.modelImage ? (
              <div className="relative h-7 w-7 p-1 rounded-sm text-white flex items-center justify-center  text-opacity-100">
                <div className="absolute h-8 w-8 rounded-full bg-gradient-to-r from-green-300 to-purple-400"></div>
              </div>
            ) : (
              <Avatar
                src={props.modelImage}
                alt={props.name}
                className="size-8"
              />
            )
          ) : !props.userAvatar ? (
            <div className="relative h-7 w-7 p-1 rounded-sm text-white flex items-center justify-center  text-opacity-100">
              <div className="absolute h-8 w-8 rounded-full from-blue-400 to-blue-600 bg-gradient-to-r"></div>
            </div>
          ) : (
            props.userAvatar
          )}
        </div>
        <div className="flex w-[calc(100%-50px)] flex-col gap-2 lg:w-[calc(100%-115px)]">
          <div className={messageCardClass}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-caption font-semibold text-text">
                  {props.isBot
                    ? removeModelSuffix(
                        `${props?.modelName || props?.name}`?.replaceAll(
                          /accounts\/[^\/]+\/models\//g,
                          ""
                        )
                      )
                    : "You"}
                </span>
                {messageTimestamp && (
                  <span className="text-[11px] text-text-muted">
                    • {messageTimestamp}
                  </span>
                )}
                {props?.message_type && (
                  <Tag
                    className="!m-0"
                    color={tagColors[props?.message_type] || "default"}>
                    {t(`copilot.${props?.message_type}`)}
                  </Tag>
                )}
                {props.isBot && props.message_type === "compare:reply" && (
                  <div className="flex items-center gap-2">
                    {props.compareSelectable && props.onToggleCompareSelect ? (
                      <button
                        type="button"
                        onClick={props.onToggleCompareSelect}
                        aria-label={compareLabel}
                        aria-pressed={props.compareSelected}
                        title={compareLabel}
                        className={`rounded-full px-2 py-1 text-[10px] font-medium border transition ${
                          props.compareSelected
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
                        }`}
                      >
                        {compareLabel}
                      </button>
                    ) : (
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {compareLabel}
                      </span>
                    )}
                    {props.compareError && (
                      <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-200">
                        {t("error.label", "Error")}
                      </span>
                    )}
                    {props.compareChosen && (
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                        {t(
                          "playground:composer.compareChosenLabel",
                          "Chosen"
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

          {/* Unified loading status indicator */}
          {shouldShowLoadingStatus && (
            <LoadingStatus
              isProcessing={props.isProcessing}
              isStreaming={props.isStreaming}
              isSearchingInternet={props.isSearchingInternet}
              isEmbedding={props.isEmbedding}
              actionInfo={props.actionInfo}
            />
          )}
          {isProMode && props.isBot && props.generationInfo?.usage && (
            <div className="text-[11px] text-text-muted tabular-nums">
              {props.generationInfo.usage.prompt_tokens ?? 0}{" "}
              {t("playground:tokens.prompt", "prompt")} +{" "}
              {props.generationInfo.usage.completion_tokens ?? 0}{" "}
              {t("playground:tokens.completion", "completion")} ={" "}
              {props.generationInfo.usage.total_tokens ?? 0}{" "}
              {t("playground:tokens.total", "tokens")}
            </div>
          )}
          <div className="flex flex-grow flex-col">
            {!editMode ? (
              props.isBot ? (
                errorPayload ? (
                  <ErrorBubble
                    payload={errorPayload}
                    toggleLabels={{
                      show: t(
                        "error.showDetails",
                        "Show technical details"
                      ) as string,
                      hide: t(
                        "error.hideDetails",
                        "Hide technical details"
                      ) as string
                    }}
                  />
                ) : (
                  <>
                    {parseReasoning(props.message).map((e, i) => {
                      if (e.type === "reasoning") {
                        return (
                          <ReasoningBlock
                            key={`reasoning-${i}`}
                            content={e.content}
                            isStreaming={props.isStreaming}
                            reasoningRunning={e.reasoning_running}
                            openReasoning={props.openReasoning}
                            reasoningTimeTaken={props.reasoningTimeTaken}
                            assistantTextClass={assistantTextClass}
                            markdownBaseClasses={MARKDOWN_BASE_CLASSES}
                            searchQuery={props.searchQuery}
                            t={t}
                          />
                        )
                      }

                      return (
                        <React.Suspense
                          key={`message-${i}`}
                          fallback={
                            <p
                              className={`text-body text-text-muted ${assistantTextClass}`}>
                              {t("loading.content")}
                            </p>
                          }>
                          <Markdown
                            message={e.content}
                            className={`${MARKDOWN_BASE_CLASSES} ${assistantTextClass}`}
                            searchQuery={props.searchQuery}
                          />
                        </React.Suspense>
                      )
                    })}
                  </>
                )
              ) : (
                <p
                  className={`prose dark:prose-invert whitespace-pre-line prose-p:leading-relaxed prose-pre:p-0 dark:prose-dark ${chatTextClass} ${
                    props.message_type &&
                    "italic text-text-muted text-body"
                  }
                  ${checkWideMode ? "max-w-none" : ""}
                  `}>
                  {props.searchQuery
                    ? highlightText(props.message, props.searchQuery)
                    : props.message}
                </p>
              )
            ) : (
              <EditMessageForm
                value={props.message}
                onSumbit={props.onEditFormSubmit}
                onClose={() => setEditMode(false)}
                isBot={props.isBot}
              />
            )}
          </div>
          {/* images if available */}
          {props.images &&
            props.images.filter((img) => img.length > 0).length > 0 && (
              <div>
                {props.images
                  .filter((image) => image.length > 0)
                  .map((image, index) => (
                    <Image
                      key={index}
                      src={image}
                      alt="Uploaded Image"
                      width={180}
                      className="rounded-md relative"
                    />
                  ))}
              </div>
            )}

          {showInlineActions && (
            <MessageActionsBar
              t={t}
              isProMode={isProMode}
              isBot={props.isBot}
              showVariantPager={showVariantPager}
              resolvedVariantIndex={resolvedVariantIndex}
              variantCount={variantCount}
              canSwipePrev={canSwipePrev}
              canSwipeNext={canSwipeNext}
              onSwipePrev={props.onSwipePrev}
              onSwipeNext={props.onSwipeNext}
              overflowChipVisibility={overflowChipVisibility}
              actionRowVisibility={actionRowVisibility}
              isTtsEnabled={props.isTTSEnabled}
              ttsDisabledReason={ttsDisabledReason}
              ttsActionDisabled={ttsActionDisabled}
              isSpeaking={isSpeaking}
              onToggleTts={handleToggleTts}
              hideCopy={props.hideCopy}
              copyPressed={isBtnPressed}
              onCopy={handleCopy}
              canReply={canReply}
              onReply={handleReply}
              canSaveToNotes={canSaveToNotes}
              canSaveToFlashcards={canSaveToFlashcards}
              canGenerateDocument={canGenerateDocument}
              onGenerateDocument={handleGenerateDocument}
              onSaveKnowledge={handleSaveKnowledge}
              savingKnowledge={savingKnowledge}
              generationInfo={props.generationInfo}
              isLastMessage={isLastMessage}
              hideEditAndRegenerate={props.hideEditAndRegenerate}
              onRegenerate={props.onRegenerate}
              onNewBranch={props.onNewBranch}
              temporaryChat={props.temporaryChat}
              hideContinue={props.hideContinue}
              onContinue={props.onContinue}
              onEdit={() => setEditMode(true)}
              editMode={editMode}
              feedbackSelected={thumb}
              feedbackDisabled={feedbackDisabled}
              feedbackDisabledReason={feedbackDisabledReason}
              isFeedbackSubmitting={isFeedbackSubmitting}
              showThanks={showThanks}
              onThumbUp={handleThumbUp}
              onThumbDown={handleThumbDown}
              onOpenDetails={handleOpenDetails}
              onDelete={props.onDeleteMessage ? handleDelete : undefined}
            />
          )}

          {/* uploaded documents if available */}
          {/* {props.documents && props.documents.length > 0 && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                {props.documents.map((doc, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm border border-blue-200 dark:border-blue-800">
                    <FileIcon className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-medium">{doc.filename || "Unknown file"}</span>
                      {doc.fileSize && (
                        <span className="text-xs opacity-70">
                          {(doc.fileSize / 1024).toFixed(1)} KB
                          {doc.processed !== undefined && (
                            <span className="ml-2">
                              {doc.processed ? "✓ Processed" : "⚠ Processing..."}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )} */}

          {/* Tool calls (for assistant messages with function calls) */}
          {props.isBot && props.toolCalls && props.toolCalls.length > 0 && (
            <ToolCallBlock
              toolCalls={props.toolCalls}
              results={props.toolResults}
            />
          )}

          {props.isBot && props?.sources && props?.sources.length > 0 && (
            <Collapse
              className="mt-6"
              ghost
              onChange={(activeKey) => {
                const opened = Array.isArray(activeKey)
                  ? activeKey.length > 0
                  : Boolean(activeKey)
                if (opened) {
                  trackSourcesExpanded()
                }
              }}
              items={[
                {
                  key: "1",
                  label: (
                    <div className="italic text-text-muted">
                      {t("citations")}
                    </div>
                  ),
                  children: (
                    <div className="mb-3 flex flex-col gap-2">
                      {props?.sources?.map((source, index) => {
                        const sourceKey = getSourceFeedbackKey(source, index)
                        const selected =
                          sourceFeedback?.[sourceKey]?.thumb ?? null
                        return (
                          <SourceFeedback
                            key={sourceKey}
                            source={source}
                            sourceKey={sourceKey}
                            sourceIndex={index}
                            selected={selected}
                            disabled={feedbackDisabled || isFeedbackSubmitting}
                            onRate={(key, payload, thumb) =>
                              submitSourceThumb({
                                sourceKey: key,
                                source: payload,
                                thumb
                              })
                            }
                            onSourceClick={props.onSourceClick}
                            onTrackClick={trackSourceClick}
                          />
                        )
                      })}
                    </div>
                  )
                }
              ]}
            />
          )}
          </div>
        </div>
      </div>
      {/* </div> */}
      {props.isBot && (
        <FeedbackModal
          open={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
          onSubmit={submitDetail}
          isSubmitting={isFeedbackSubmitting}
          initialRating={detail?.rating ?? null}
          initialIssues={detail?.issues ?? []}
          initialNotes={detail?.notes ?? ""}
        />
      )}
    </div>
  )
}

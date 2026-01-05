import React from "react"
import { useQuery } from "@tanstack/react-query"
import { useMessageOption } from "@/hooks/useMessageOption"
import { PlaygroundEmpty } from "./PlaygroundEmpty"
import { PlaygroundMessage } from "@/components/Common/Playground/Message"
import { ProviderIcons } from "@/components/Common/ProviderIcon"
import { useStorage } from "@plasmohq/storage/hook"
import { useTranslation } from "react-i18next"
import { notification } from "antd"
import { Clock, Hash } from "lucide-react"
import { decodeChatErrorPayload } from "@/utils/chat-error-message"
import { humanizeMilliseconds } from "@/utils/humanize-milliseconds"
import { trackCompareMetric } from "@/utils/compare-metrics"
import { fetchChatModels } from "@/services/tldw-server"
import { tldwModels } from "@/services/tldw"
import { applyVariantToMessage } from "@/utils/message-variants"

type TimelineBlock =
  | { kind: "single"; index: number }
  | {
      kind: "compare"
      userIndex: number
      assistantIndices: number[]
      clusterId: string
    }

const PerModelMiniComposer: React.FC<{
  placeholder: string
  disabled?: boolean
  helperText?: string | null
  onSend: (text: string) => Promise<void> | void
}> = ({ placeholder, disabled = false, helperText, onSend }) => {
  const { t } = useTranslation(["common"])
  const [value, setValue] = React.useState("")

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || disabled) {
      return
    }
    await onSend(trimmed)
    setValue("")
  }

  return (
    <div className="mt-2 space-y-1 text-[11px]">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          className="flex-1 rounded border border-border bg-surface px-2 py-1 text-[11px] text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={disabled || value.trim().length === 0}
          title={t("common:send", "Send") as string}
          className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-surface disabled:cursor-not-allowed disabled:opacity-60 hover:bg-primaryStrong">
          {t("common:send", "Send")}
        </button>
      </form>
      {helperText && (
        <div className="text-[10px] text-text-subtle">
          {helperText}
        </div>
      )}
    </div>
  )
}

const buildBlocks = (messages: { messageType?: string; clusterId?: string }[]): TimelineBlock[] => {
  const blocks: TimelineBlock[] = []
  const used = new Set<number>()

  messages.forEach((msg, idx) => {
    if (used.has(idx)) return

    if (msg.messageType === "compare:user" && msg.clusterId) {
      const assistants: number[] = []
      messages.forEach((m, j) => {
        if (j !== idx && m.clusterId === msg.clusterId) {
          if (m.messageType === "compare:reply") {
            assistants.push(j)
          }
          used.add(j)
        }
      })
      used.add(idx)
      blocks.push({
        kind: "compare",
        userIndex: idx,
        assistantIndices: assistants,
        clusterId: msg.clusterId
      })
    } else {
      blocks.push({ kind: "single", index: idx })
    }
  })

  return blocks
}

export const PlaygroundChat = () => {
  const { t } = useTranslation(["playground", "common"])
  const {
    messages,
    setMessages,
    streaming,
    isProcessing,
    regenerateLastMessage,
    isSearchingInternet,
    editMessage,
    ttsEnabled,
    onSubmit,
    actionInfo,
    createChatBranch,
    createCompareBranch,
    temporaryChat,
    serverChatId,
    stopStreamingRequest,
    isEmbedding,
    compareMode,
    compareFeatureEnabled,
    compareSelectionByCluster,
    setCompareSelectionForCluster,
    compareActiveModelsByCluster,
    setCompareActiveModelsForCluster,
    setCompareSelectedModels,
    historyId,
    setSelectedModel,
    setCompareMode,
    sendPerModelReply,
    compareCanonicalByCluster,
    setCompareCanonicalForCluster,
    setCompareParentForHistory,
    compareSplitChats,
    setCompareSplitChat,
    compareMaxModels
  } = useMessageOption()
  const [openReasoning] = useStorage("openReasoning", false)
  const { data: chatModels = [] } = useQuery({
    queryKey: ["playground:chatModels"],
    queryFn: () => fetchChatModels({ returnEmpty: true }),
    enabled: true
  })
  const [collapsedClusters, setCollapsedClusters] = React.useState<
    Record<string, boolean>
  >({})
  const [hiddenModelsByCluster, setHiddenModelsByCluster] = React.useState<
    Record<string, string[]>
  >({})
  const compareModeActive = compareFeatureEnabled && compareMode
  const blocks = React.useMemo(() => buildBlocks(messages), [messages])
  const getPreviousUserMessage = React.useCallback(
    (index: number) => {
      for (let i = index - 1; i >= 0; i--) {
        const candidate = messages[i]
        if (!candidate?.isBot) {
          return candidate
        }
      }
      return null
    },
    [messages]
  )
  const modelMetaById = React.useMemo(() => {
    const map = new Map<string, { label: string; provider: string }>()
    const models = (chatModels as any[]) || []
    models.forEach((model) => {
      if (!model?.model) {
        return
      }
      map.set(model.model, {
        label: model.nickname || model.model,
        provider: String(model.provider || "custom").toLowerCase()
      })
    })
    return map
  }, [chatModels])
  const getTokenCount = React.useCallback((generationInfo?: any) => {
    if (!generationInfo || typeof generationInfo !== "object") {
      return null
    }
    const toNumber = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value) ? value : null
    const usage = (generationInfo as any)?.usage
    const prompt =
      toNumber(generationInfo.prompt_eval_count) ??
      toNumber(generationInfo.prompt_tokens) ??
      toNumber(generationInfo.input_tokens) ??
      toNumber(usage?.prompt_tokens) ??
      toNumber(usage?.input_tokens)
    const completion =
      toNumber(generationInfo.eval_count) ??
      toNumber(generationInfo.completion_tokens) ??
      toNumber(generationInfo.output_tokens) ??
      toNumber(usage?.completion_tokens) ??
      toNumber(usage?.output_tokens)
    const total =
      toNumber(generationInfo.total_tokens) ??
      toNumber(generationInfo.total_token_count) ??
      toNumber(usage?.total_tokens)
    const resolvedTotal =
      total ?? (prompt != null && completion != null ? prompt + completion : null)
    if (resolvedTotal == null) {
      return null
    }
    return Math.round(resolvedTotal)
  }, [])

  const handleVariantSwipe = React.useCallback(
    (messageId: string | undefined, direction: "prev" | "next") => {
      if (!messageId) return
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg
          const variants = msg.variants ?? []
          if (variants.length < 2) return msg
          const currentIndex =
            typeof msg.activeVariantIndex === "number"
              ? msg.activeVariantIndex
              : variants.length - 1
          const nextIndex =
            direction === "prev" ? currentIndex - 1 : currentIndex + 1
          if (nextIndex < 0 || nextIndex >= variants.length) return msg
          return applyVariantToMessage(msg, variants[nextIndex], nextIndex)
        })
      )
    },
    [setMessages]
  )

  return (
    <>
      <div className="relative flex w-full flex-col items-center pt-16 pb-4">
        {messages.length === 0 && (
          <div className="mt-32 w-full">
            <PlaygroundEmpty />
          </div>
        )}
        {blocks.map((block, blockIndex) => {
          if (block.kind === "single") {
            const message = messages[block.index]
            const previousUserMessage = getPreviousUserMessage(block.index)
            return (
              <PlaygroundMessage
                key={`m-${blockIndex}`}
                isBot={message.isBot}
                message={message.message}
                name={message.name}
                images={message.images || []}
                currentMessageIndex={block.index}
                totalMessages={messages.length}
                onRegenerate={regenerateLastMessage}
                isProcessing={isProcessing}
                isSearchingInternet={isSearchingInternet}
                sources={message.sources}
                onEditFormSubmit={(value, isSend) => {
                  editMessage(block.index, value, !message.isBot, isSend)
                }}
                onNewBranch={() => {
                  createChatBranch(block.index)
                }}
                isTTSEnabled={ttsEnabled}
                generationInfo={message?.generationInfo}
                isStreaming={streaming}
                reasoningTimeTaken={message?.reasoning_time_taken}
                openReasoning={openReasoning}
                modelImage={message?.modelImage}
                modelName={message?.modelName}
                createdAt={message?.createdAt}
                temporaryChat={temporaryChat}
                onStopStreaming={stopStreamingRequest}
                onContinue={() => {
                  onSubmit({
                    image: "",
                    message: "",
                    isContinue: true
                  })
                }}
                documents={message?.documents}
                actionInfo={actionInfo}
                serverChatId={serverChatId}
                serverMessageId={message.serverMessageId}
                messageId={message.id}
                feedbackQuery={previousUserMessage?.message ?? null}
                isEmbedding={isEmbedding}
                message_type={message.messageType}
                variants={message.variants}
                activeVariantIndex={message.activeVariantIndex}
                onSwipePrev={() => handleVariantSwipe(message.id, "prev")}
                onSwipeNext={() => handleVariantSwipe(message.id, "next")}
              />
            )
          }

          const userMessage = messages[block.userIndex]
          const previousUserMessage = getPreviousUserMessage(block.userIndex)
          const replyItems = block.assistantIndices.map((i) => {
            const message = messages[i]
            const modelKey =
              (message as any).modelId || message.modelName || message.name
            return {
              index: i,
              message,
              modelKey
            }
          })
          const clusterSelection =
            compareSelectionByCluster[block.clusterId] || []
          const clusterActiveModels =
            compareActiveModelsByCluster[block.clusterId] || clusterSelection
          const modelLabels = new Map<string, string>()
          replyItems.forEach(({ message, modelKey }) => {
            if (!modelLabels.has(modelKey)) {
              modelLabels.set(
                modelKey,
                message?.modelName || message.name || modelKey
              )
            }
          })
          const getModelLabel = (modelKey: string) =>
            modelMetaById.get(modelKey)?.label ||
            modelLabels.get(modelKey) ||
            modelKey
          const getModelProvider = (modelKey: string) =>
            modelMetaById.get(modelKey)?.provider || "custom"
          const clusterModelKeys = Array.from(
            new Set(replyItems.map((item) => item.modelKey))
          )
          const selectedModelKey =
            clusterSelection.length === 1 ? clusterSelection[0] : null
          const isChosenState = !compareModeActive && !!selectedModelKey
          const hiddenModels = hiddenModelsByCluster[block.clusterId] || []
          const filteredReplyItems =
            hiddenModels.length > 0
              ? replyItems.filter((item) => !hiddenModels.includes(item.modelKey))
              : replyItems
          const chosenItem = selectedModelKey
            ? replyItems.find((item) => item.modelKey === selectedModelKey) || null
            : null
          const isCollapsed = isChosenState
            ? collapsedClusters[block.clusterId] ?? true
            : false
          let visibleReplyItems =
            isCollapsed && isChosenState && selectedModelKey
              ? filteredReplyItems.filter(
                  (item) => item.modelKey === selectedModelKey
                )
              : filteredReplyItems
          if (visibleReplyItems.length === 0 && chosenItem) {
            visibleReplyItems = [chosenItem]
          }
          const alternativeCount = selectedModelKey
            ? Math.max(replyItems.length - 1, 0)
            : 0
          const setClusterCollapsed = (next: boolean) => {
            setCollapsedClusters((prev) => ({
              ...prev,
              [block.clusterId]: next
            }))
          }
          const toggleModelFilter = (modelKey: string) => {
            setHiddenModelsByCluster((prev) => {
              const hidden = new Set(prev[block.clusterId] || [])
              if (hidden.has(modelKey)) {
                hidden.delete(modelKey)
              } else {
                hidden.add(modelKey)
              }
              return {
                ...prev,
                [block.clusterId]: Array.from(hidden)
              }
            })
          }
          const clearModelFilter = () => {
            setHiddenModelsByCluster((prev) => {
              const next = { ...prev }
              delete next[block.clusterId]
              return next
            })
          }
          const handleContinueWithModel = (modelKey: string) => {
            setCompareMode(false)
            setSelectedModel(modelKey)
            setCompareSelectedModels([modelKey])
            setCompareActiveModelsForCluster(block.clusterId, [modelKey])
            setClusterCollapsed(true)
          }
          const handleCompareAgain = () => {
            if (!compareFeatureEnabled) {
              return
            }
            const maxModels =
              typeof compareMaxModels === "number" && compareMaxModels > 0
                ? compareMaxModels
                : clusterModelKeys.length
            setCompareSelectedModels(clusterModelKeys.slice(0, maxModels))
            setCompareMode(true)
            setClusterCollapsed(false)
          }

          const handleBulkSplit = async () => {
            if (!compareFeatureEnabled) {
              return
            }
            const createdIds: string[] = []
            const failedModels: string[] = []
            for (const modelKey of clusterSelection) {
              try {
                const newHistoryId = await createCompareBranch({
                  clusterId: block.clusterId,
                  modelId: modelKey,
                  open: false
                })
                if (newHistoryId && historyId) {
                  setCompareParentForHistory(newHistoryId, {
                    parentHistoryId: historyId,
                    clusterId: block.clusterId
                  })
                  setCompareSplitChat(block.clusterId, modelKey, newHistoryId)
                  createdIds.push(newHistoryId)
                } else {
                  failedModels.push(modelKey)
                }
              } catch (error) {
                console.error(`Failed to create branch for ${modelKey}:`, error)
                failedModels.push(modelKey)
              }
            }
            if (createdIds.length > 0) {
              void trackCompareMetric({
                type: "split_bulk",
                count: createdIds.length
              })
              notification.success({
                message: t(
                  "playground:composer.compareBulkSplitSuccess",
                  "Created {{count}} chats",
                  { count: createdIds.length }
                )
              })
            }
            if (failedModels.length > 0) {
              notification.warning({
                message: t(
                  "playground:composer.compareBulkSplitPartialFail",
                  "Failed to create {{count}} chats",
                  { count: failedModels.length }
                )
              })
            }
          }

          return (
            <div
              key={`c-${blockIndex}`}
              className="w-full max-w-3xl md:px-4 mb-4 space-y-2">
              <PlaygroundMessage
                isBot={userMessage.isBot}
                message={userMessage.message}
                name={userMessage.name}
                images={userMessage.images || []}
                currentMessageIndex={block.userIndex}
                totalMessages={messages.length}
                onRegenerate={regenerateLastMessage}
                isProcessing={isProcessing}
                isSearchingInternet={isSearchingInternet}
                sources={userMessage.sources}
                onEditFormSubmit={(value, isSend) => {
                  editMessage(
                    block.userIndex,
                    value,
                    !userMessage.isBot,
                    isSend
                  )
                }}
                onNewBranch={() => {
                  createChatBranch(block.userIndex)
                }}
                isTTSEnabled={ttsEnabled}
                generationInfo={userMessage?.generationInfo}
                isStreaming={streaming}
                reasoningTimeTaken={userMessage?.reasoning_time_taken}
                openReasoning={openReasoning}
                modelImage={userMessage?.modelImage}
                modelName={userMessage?.modelName}
                createdAt={userMessage?.createdAt}
                temporaryChat={temporaryChat}
                onStopStreaming={stopStreamingRequest}
                onContinue={() => {
                  onSubmit({
                    image: "",
                    message: "",
                    isContinue: true
                  })
                }}
                documents={userMessage?.documents}
                actionInfo={actionInfo}
                serverChatId={serverChatId}
                serverMessageId={userMessage.serverMessageId}
                messageId={userMessage.id}
                feedbackQuery={previousUserMessage?.message ?? null}
                isEmbedding={isEmbedding}
                message_type={userMessage.messageType}
                variants={userMessage.variants}
                activeVariantIndex={userMessage.activeVariantIndex}
                onSwipePrev={() => handleVariantSwipe(userMessage.id, "prev")}
                onSwipeNext={() => handleVariantSwipe(userMessage.id, "next")}
              />
              <div className="ml-10 space-y-2 border-l border-dashed border-border pl-4">
                <div className="mb-1 flex items-center justify-between text-[11px] text-text-muted">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-medium text-text">
                      {t(
                        "playground:composer.compareClusterLabel",
                        "Multi-model answers"
                      )}
                    </span>
                    <span className="text-[10px] text-text-subtle">
                      {t(
                        "playground:composer.compareClusterCount",
                        "{{count}} models",
                        { count: replyItems.length }
                      )}
                    </span>
                  </div>
                  {isChosenState && alternativeCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setClusterCollapsed(!isCollapsed)}
                      title={
                        isCollapsed
                          ? (t(
                              "common:timeline.expandAllAlternatives",
                              "Expand all alternatives"
                            ) as string)
                          : (t(
                              "common:timeline.collapseAllAlternatives",
                              "Collapse all alternatives"
                            ) as string)
                      }
                      className="text-[10px] font-medium text-primary hover:underline">
                      {isCollapsed
                        ? t(
                            "common:timeline.expandAllAlternatives",
                            "Expand all alternatives"
                          )
                        : t(
                            "common:timeline.collapseAllAlternatives",
                            "Collapse all alternatives"
                        )}{" "}
                      ({alternativeCount})
                    </button>
                  )}
                </div>
                {clusterModelKeys.length > 1 && (
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-text-muted">
                    <span className="text-[10px] font-semibold uppercase tracking-wide">
                      {t(
                        "playground:composer.compareFilterLabel",
                        "Filter models"
                      )}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {clusterModelKeys.map((modelKey) => {
                        const isHidden = hiddenModels.includes(modelKey)
                        const providerKey = getModelProvider(modelKey)
                        return (
                          <button
                            key={`filter-${block.clusterId}-${modelKey}`}
                            type="button"
                            onClick={() => toggleModelFilter(modelKey)}
                            title={getModelLabel(modelKey)}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                              isHidden
                                ? "border-border bg-surface text-text-subtle"
                                : "border-primary bg-surface2 text-primaryStrong"
                            }`}
                          >
                            <ProviderIcons
                              provider={providerKey}
                              className="h-3 w-3"
                            />
                            <span className="max-w-[120px] truncate">
                              {getModelLabel(modelKey)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {hiddenModels.length > 0 && (
                      <button
                        type="button"
                        onClick={clearModelFilter}
                        title={t(
                          "playground:composer.compareFilterClear",
                          "Show all"
                        ) as string}
                        className="text-[10px] font-medium text-primary hover:underline"
                      >
                        {t(
                          "playground:composer.compareFilterClear",
                          "Show all"
                        )}
                      </button>
                    )}
                    <span className="text-[10px] text-text-subtle">
                      {t(
                        "playground:composer.compareFilterCount",
                        "Showing {{visible}} / {{total}}",
                        {
                          visible: filteredReplyItems.length,
                          total: replyItems.length
                        }
                      )}
                    </span>
                  </div>
                )}
                {compareFeatureEnabled && clusterSelection.length > 1 && (
                  <div className="mb-2 flex items-center justify-between text-[11px] text-text-muted">
                    <span>
                      {t(
                        "playground:composer.compareBulkSplitHint",
                        "Selected models: {{count}}",
                        { count: clusterSelection.length }
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={handleBulkSplit}
                      disabled={!compareFeatureEnabled}
                      title={t(
                        "playground:composer.compareBulkSplit",
                        "Open each selected answer as its own chat"
                      ) as string}
                      className={`rounded border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-text hover:bg-surface2 ${
                        !compareFeatureEnabled
                          ? "cursor-not-allowed opacity-50"
                          : ""
                      }`}>
                      {t(
                        "playground:composer.compareBulkSplit",
                        "Open each selected answer as its own chat"
                      )}
                    </button>
                  </div>
                )}
                {visibleReplyItems.map(({ index, message, modelKey }) => {
                  const isSelected = clusterSelection.includes(modelKey)
                  const errorPayload = decodeChatErrorPayload(message.message)
                  const hasError = Boolean(errorPayload)
                  const isSelectable = compareFeatureEnabled && !hasError
                  const isChosenCard =
                    isChosenState && selectedModelKey === modelKey
                  const latencyLabel =
                    typeof message?.reasoning_time_taken === "number" &&
                    message.reasoning_time_taken > 0
                      ? humanizeMilliseconds(message.reasoning_time_taken)
                      : null
                  const providerKey = getModelProvider(modelKey)
                  const providerLabel = tldwModels.getProviderDisplayName(
                    providerKey
                  )
                  const tokenCount = getTokenCount(message?.generationInfo)
                  const tokenLabel =
                    tokenCount !== null
                      ? t(
                          "playground:composer.compareTokens",
                          "Tokens: {{count}}",
                          { count: tokenCount }
                        )
                      : null
                  const splitMap = compareSplitChats[block.clusterId] || {}
                  const spawnedHistoryId = splitMap[modelKey]

                  const handleToggle = () => {
                    if (!isSelectable) {
                      return
                    }
                    const next = isSelected
                      ? clusterSelection.filter((id) => id !== modelKey)
                      : [...clusterSelection, modelKey]

                    if (
                      !isSelected &&
                      compareMaxModels &&
                      clusterSelection.length >= compareMaxModels
                    ) {
                      notification.warning({
                        message: t(
                          "playground:composer.compareMaxModelsTitle",
                          "Compare limit reached"
                        ),
                        description: t(
                          "playground:composer.compareMaxModels",
                          "You can compare up to {{limit}} models per turn.",
                          { count: compareMaxModels, limit: compareMaxModels }
                        )
                      })
                      return
                    }
                    setCompareSelectionForCluster(block.clusterId, next)
                    setCompareActiveModelsForCluster(block.clusterId, next)
                    setCompareSelectedModels(next)
                    void trackCompareMetric({
                      type: "selection",
                      count: next.length
                    })
                  }

                  const displayName = message?.modelName || message.name

                  const clusterMessagesForModel = messages
                    .map((m: any, idx) => ({ m, idx }))
                    .filter(
                      ({ m }) =>
                        m.clusterId === block.clusterId &&
                        (m.messageType === "compare:user" ||
                          ((m as any).modelId || m.modelName || m.name) ===
                            modelKey)
                    )

                  const threadPreviewItems = clusterMessagesForModel.slice(-4)

                  const handleOpenFullChat = async () => {
                    if (!compareFeatureEnabled) {
                      return
                    }
                    const newHistoryId = await createCompareBranch({
                      clusterId: block.clusterId,
                      modelId: modelKey
                    })
                    if (newHistoryId && historyId) {
                      setCompareParentForHistory(newHistoryId, {
                        parentHistoryId: historyId,
                        clusterId: block.clusterId
                      })
                      setCompareSplitChat(
                        block.clusterId,
                        modelKey,
                        newHistoryId
                      )
                    }
                    if (modelKey) {
                      setCompareMode(false)
                      setSelectedModel(modelKey)
                      setCompareSelectedModels([modelKey])
                    }
                  }

                  const placeholder = t(
                    "playground:composer.perModelReplyPlaceholder",
                    "Reply only to {{model}}",
                    { model: displayName }
                  )
                  const perModelDisabledReason = !compareFeatureEnabled
                    ? t(
                        "playground:composer.compareDisabled",
                        "Compare mode is disabled in settings."
                      )
                    : null
                  const perModelDisabled =
                    isProcessing || streaming || Boolean(perModelDisabledReason)

                  const handlePerModelSend = async (text: string) => {
                    await sendPerModelReply({
                      clusterId: block.clusterId,
                      modelId: modelKey,
                      message: text
                    })
                  }
                  const previousUserMessage = getPreviousUserMessage(index)

                  return (
                    <div
                      key={`c-${blockIndex}-${index}`}
                      className={`rounded-md border border-border bg-surface p-2 shadow-sm ${
                        isChosenCard
                          ? "ring-1 ring-success"
                          : ""
                      }`}>
                      <PlaygroundMessage
                        isBot={message.isBot}
                        message={message.message}
                        name={message.name}
                        images={message.images || []}
                        currentMessageIndex={index}
                        totalMessages={messages.length}
                        onRegenerate={regenerateLastMessage}
                        isProcessing={isProcessing}
                        isSearchingInternet={isSearchingInternet}
                        sources={message.sources}
                        onEditFormSubmit={(value, isSend) => {
                          editMessage(index, value, !message.isBot, isSend)
                        }}
                        onNewBranch={() => {
                          createChatBranch(index)
                        }}
                        isTTSEnabled={ttsEnabled}
                        generationInfo={message?.generationInfo}
                        isStreaming={streaming}
                        reasoningTimeTaken={message?.reasoning_time_taken}
                        openReasoning={openReasoning}
                        modelImage={message?.modelImage}
                        modelName={message?.modelName}
                        createdAt={message?.createdAt}
                        temporaryChat={temporaryChat}
                        onStopStreaming={stopStreamingRequest}
                        onContinue={() => {
                          onSubmit({
                            image: "",
                            message: "",
                            isContinue: true
                          })
                        }}
                        documents={message?.documents}
                        actionInfo={actionInfo}
                        serverChatId={serverChatId}
                        serverMessageId={message.serverMessageId}
                        messageId={message.id}
                        feedbackQuery={previousUserMessage?.message ?? null}
                        isEmbedding={isEmbedding}
                        message_type={message.messageType}
                        compareSelectable={isSelectable}
                        compareSelected={isSelected}
                        onToggleCompareSelect={handleToggle}
                        compareError={hasError}
                        compareChosen={isChosenCard}
                        variants={message.variants}
                        activeVariantIndex={message.activeVariantIndex}
                        onSwipePrev={() => handleVariantSwipe(message.id, "prev")}
                        onSwipeNext={() => handleVariantSwipe(message.id, "next")}
                      />

                      {threadPreviewItems.length > 1 && (
                        <div className="mt-2 space-y-1 rounded-md bg-surface2 p-2 text-[11px] text-text">
                          <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-text-subtle">
                            {t(
                              "playground:composer.compareThreadLabel",
                              "Per-model thread"
                            )}
                          </div>
                          {threadPreviewItems.map(({ m, idx: threadIndex }) => (
                            <div
                              key={`thread-${block.clusterId}-${modelKey}-${threadIndex}`}
                              className="flex gap-1">
                              <span className="font-semibold">
                                {m.isBot
                                  ? m.modelName || m.name
                                  : m.messageType === "compare:user"
                                    ? t(
                                        "playground:composer.compareThreadShared",
                                        "You (shared)"
                                      )
                                    : t(
                                        "playground:composer.compareThreadYou",
                                        "You"
                                      )}
                                :
                              </span>
                              <span className="line-clamp-2">
                                {m.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <PerModelMiniComposer
                        placeholder={placeholder}
                        disabled={perModelDisabled}
                        helperText={perModelDisabledReason}
                        onSend={handlePerModelSend}
                      />

                      <div className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleOpenFullChat}
                            disabled={!compareFeatureEnabled}
                            title={t(
                              "playground:composer.compareOpenFullChat",
                              "Open as full chat"
                            ) as string}
                            className={`text-primary hover:underline ${
                              !compareFeatureEnabled
                                ? "cursor-not-allowed opacity-50 no-underline"
                                : ""
                            }`}>
                            {t(
                              "playground:composer.compareOpenFullChat",
                              "Open as full chat"
                            )}
                          </button>
                          {providerLabel && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] text-text-subtle"
                              aria-label={providerLabel}
                            >
                              <ProviderIcons
                                provider={providerKey}
                                className="h-3 w-3"
                              />
                              {providerLabel}
                            </span>
                          )}
                          {tokenLabel && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] text-text-subtle"
                              aria-label={tokenLabel}
                            >
                              <Hash className="h-3 w-3" aria-hidden="true" />
                              {tokenLabel}
                            </span>
                          )}
                          {latencyLabel && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] text-text-subtle"
                              aria-label={t(
                                "playground:composer.compareLatency",
                                "Latency"
                              )}>
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              {latencyLabel}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {spawnedHistoryId && (
                            <button
                              type="button"
                              onClick={() => {
                                window.dispatchEvent(
                                  new CustomEvent("tldw:open-history", {
                                    detail: { historyId: spawnedHistoryId }
                                  })
                                )
                              }}
                              title={t(
                                "playground:composer.compareSpawnedChat",
                                "Open split chat"
                              ) as string}
                              className="text-[10px] text-text-muted hover:text-text underline">
                              {t(
                                "playground:composer.compareSpawnedChat",
                                "Open split chat"
                              )}
                            </button>
                          )}
                          {message.id && (
                            <button
                              type="button"
                              onClick={() => {
                                const currentCanonical =
                                  compareCanonicalByCluster[block.clusterId] || null
                                const next =
                                  currentCanonical === message.id ? null : message.id
                                setCompareCanonicalForCluster(block.clusterId, next)
                              }}
                              title={
                                compareCanonicalByCluster[block.clusterId] === message.id
                                  ? (t(
                                      "playground:composer.compareCanonicalOn",
                                      "Canonical"
                                    ) as string)
                                  : (t(
                                      "playground:composer.compareCanonicalOff",
                                      "Pin as canonical"
                                    ) as string)
                              }
                              className={`rounded px-2 py-0.5 text-[10px] font-medium border transition ${
                                compareCanonicalByCluster[block.clusterId] ===
                                message.id
                                  ? "border-success bg-success text-white"
                                  : "border-success/40 bg-success/10 text-success"
                              }`}>
                              {compareCanonicalByCluster[block.clusterId] ===
                              message.id
                                ? t(
                                    "playground:composer.compareCanonicalOn",
                                    "Canonical"
                                  )
                                : t(
                                    "playground:composer.compareCanonicalOff",
                                    "Pin as canonical"
                                  )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {clusterSelection.length > 0 && (
                  <div className="mt-2 rounded-md border border-border bg-surface2 px-3 py-2 text-[11px] text-text-muted">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {t(
                          "playground:composer.compareSelectedLabel",
                          "Selected as answer:"
                        )}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {clusterSelection.map((modelKey) => (
                          <span
                            key={`selected-${block.clusterId}-${modelKey}`}
                            className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-text shadow-sm">
                            {getModelLabel(modelKey)}
                          </span>
                        ))}
                      </div>
                    </div>
                    {clusterActiveModels.length === 1 ? (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-text-muted">
                          {compareModeActive
                            ? t(
                                "playground:composer.compareContinueHint",
                                "Continue this chat with the selected model."
                              )
                            : t(
                                "playground:composer.compareChosenHint",
                                "Continue with the chosen answer or compare again."
                              )}
                        </span>
                        {compareModeActive ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleContinueWithModel(clusterActiveModels[0])
                            }
                            title={t(
                              "playground:composer.compareContinue",
                              "Continue with this model"
                            ) as string}
                            className="rounded border border-primary bg-primary px-2 py-0.5 text-[10px] font-medium text-white hover:bg-primaryStrong">
                            {t(
                              "playground:composer.compareContinue",
                              "Continue with this model"
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleCompareAgain}
                            disabled={!compareFeatureEnabled}
                            title={t(
                              "playground:composer.compareButton",
                              "Compare models"
                            ) as string}
                            className={`rounded border border-primary px-2 py-0.5 text-[10px] font-medium ${
                              compareFeatureEnabled
                                ? "border-primary bg-surface text-primary hover:bg-surface2"
                                : "border-primary/40 bg-surface text-text-subtle cursor-not-allowed opacity-60"
                            }`}>
                            {t(
                              "playground:composer.compareButton",
                              "Compare models"
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 text-[10px] text-text-muted">
                        {t(
                          "playground:composer.compareActiveModelsHint",
                          "Your next message will be sent to each active model."
                        )}
                      </div>
                    )}
                  </div>
                )}

                {(() => {
                  const canonicalId =
                    compareCanonicalByCluster[block.clusterId] || null
                  if (!canonicalId) {
                    return null
                  }
                  const canonical = (messages as any[]).find(
                    (m) => m.id && m.id === canonicalId
                  )
                  if (!canonical) {
                    return null
                  }
                  return (
                    <div className="mt-3 rounded-md border border-success bg-success/10 px-3 py-2 text-[13px] text-success">
                      <div className="mb-1 flex items-center gap-2 text-[11px] font-medium">
                        <span className="uppercase tracking-wide">
                          {t(
                            "playground:composer.compareCanonicalLabel",
                            "Canonical answer"
                          )}
                        </span>
                        <span className="text-success/80">
                          {canonical.modelName || canonical.name}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap">
                        {canonical.message}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

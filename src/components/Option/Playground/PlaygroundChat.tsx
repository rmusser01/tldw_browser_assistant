import React from "react"
import { useMessageOption } from "@/hooks/useMessageOption"
import { PlaygroundEmpty } from "./PlaygroundEmpty"
import { PlaygroundMessage } from "@/components/Common/Playground/Message"
import { MessageSourcePopup } from "@/components/Common/Playground/MessageSourcePopup"
import { useStorage } from "@plasmohq/storage/hook"
import { useTranslation } from "react-i18next"
import { notification } from "antd"

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
  onSend: (text: string) => Promise<void> | void
}> = ({ placeholder, disabled = false, onSend }) => {
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
    <form
      onSubmit={handleSubmit}
      className="mt-2 flex items-center gap-2 text-[11px]">
      <input
        className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        className="rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">
        {t("common:send", "Send")}
      </button>
    </form>
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
  const [isSourceOpen, setIsSourceOpen] = React.useState(false)
  const [source, setSource] = React.useState<any>(null)
  const [openReasoning] = useStorage("openReasoning", false)
  const blocks = React.useMemo(() => buildBlocks(messages), [messages])

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
                onSourceClick={(data) => {
                  setSource(data)
                  setIsSourceOpen(true)
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
                isEmbedding={isEmbedding}
                message_type={message.messageType}
              />
            )
          }

          const userMessage = messages[block.userIndex]
          const replies = block.assistantIndices.map((i) => ({
            index: i,
            message: messages[i]
          }))
          const clusterSelection =
            compareSelectionByCluster[block.clusterId] || []
          const clusterActiveModels =
            compareActiveModelsByCluster[block.clusterId] || clusterSelection
          const modelLabels = new Map<string, string>()
          replies.forEach(({ message }) => {
            const key =
              (message as any).modelId || message.modelName || message.name
            if (!modelLabels.has(key)) {
              modelLabels.set(key, message?.modelName || message.name || key)
            }
          })
          const getModelLabel = (modelKey: string) =>
            modelLabels.get(modelKey) || modelKey
          const handleContinueWithModel = (modelKey: string) => {
            setCompareMode(false)
            setSelectedModel(modelKey)
            setCompareSelectedModels([modelKey])
            setCompareActiveModelsForCluster(block.clusterId, [modelKey])
          }

          const handleBulkSplit = async () => {
            const createdIds: string[] = []
            for (const modelKey of clusterSelection) {
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
              }
            }
            if (createdIds.length > 0) {
              notification.success({
                message: t(
                  "playground:composer.compareBulkSplitSuccess",
                  "Created {{count}} chats",
                  { count: createdIds.length }
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
                onSourceClick={(data) => {
                  setSource(data)
                  setIsSourceOpen(true)
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
                isEmbedding={isEmbedding}
                message_type={userMessage.messageType}
              />
              <div className="ml-10 space-y-2 border-l border-dashed border-gray-200 pl-4 dark:border-gray-700">
                <div className="mb-1 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {t(
                      "playground:composer.compareClusterLabel",
                      "Multi-model answers"
                    )}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {t(
                      "playground:composer.compareClusterCount",
                      "{{count}} models",
                      { count: replies.length }
                    )}
                  </span>
                </div>
                {clusterSelection.length > 1 && (
                  <div className="mb-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
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
                      className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800">
                      {t(
                        "playground:composer.compareBulkSplit",
                        "Open each selected answer as its own chat"
                      )}
                    </button>
                  </div>
                )}
                {replies.map(({ index, message }) => {
                  const modelKey =
                    (message as any).modelId || message.modelName || message.name
                  const isSelected = clusterSelection.includes(modelKey)
                  const splitMap = compareSplitChats[block.clusterId] || {}
                  const spawnedHistoryId = splitMap[modelKey]

                  const handleToggle = () => {
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
                          { limit: compareMaxModels }
                        )
                      })
                      return
                    }
                    setCompareSelectionForCluster(block.clusterId, next)
                    setCompareActiveModelsForCluster(block.clusterId, next)
                    setCompareSelectedModels(next)
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

                  const handlePerModelSend = async (text: string) => {
                    await sendPerModelReply({
                      clusterId: block.clusterId,
                      modelId: modelKey,
                      message: text
                    })
                  }

                  return (
                    <div
                      key={`c-${blockIndex}-${index}`}
                      className="rounded-md bg-white/60 p-2 shadow-sm dark:bg-gray-900/40">
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
                        onSourceClick={(data) => {
                          setSource(data)
                          setIsSourceOpen(true)
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
                        isEmbedding={isEmbedding}
                        message_type={message.messageType}
                        compareSelectable
                        compareSelected={isSelected}
                        onToggleCompareSelect={handleToggle}
                      />

                      {threadPreviewItems.length > 1 && (
                        <div className="mt-2 space-y-1 rounded-md bg-gray-50 p-2 text-[11px] text-gray-700 dark:bg-gray-900/60 dark:text-gray-200">
                          <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
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
                        disabled={isProcessing || streaming}
                        onSend={handlePerModelSend}
                      />

                      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                        <button
                          type="button"
                          onClick={handleOpenFullChat}
                          className="text-blue-600 hover:underline dark:text-blue-400">
                          {t(
                            "playground:composer.compareOpenFullChat",
                            "Open as full chat"
                          )}
                        </button>
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
                            className="text-[10px] text-gray-500 hover:text-gray-700 underline dark:text-gray-300 dark:hover:text-gray-100">
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
                            className={`ml-2 rounded px-2 py-0.5 text-[10px] font-medium border transition ${
                              compareCanonicalByCluster[block.clusterId] ===
                              message.id
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700"
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
                  )
                })}

                {clusterSelection.length > 0 && (
                  <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
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
                            className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-200">
                            {getModelLabel(modelKey)}
                          </span>
                        ))}
                      </div>
                    </div>
                    {clusterActiveModels.length === 1 ? (
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          {t(
                            "playground:composer.compareContinueHint",
                            "Continue this chat with the selected model."
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleContinueWithModel(clusterActiveModels[0])
                          }
                          className="rounded border border-blue-500 bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-blue-500">
                          {t(
                            "playground:composer.compareContinue",
                            "Continue with this model"
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
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
                    <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-100">
                      <div className="mb-1 flex items-center gap-2 text-[11px] font-medium">
                        <span className="uppercase tracking-wide">
                          {t(
                            "playground:composer.compareCanonicalLabel",
                            "Canonical answer"
                          )}
                        </span>
                        <span className="text-emerald-700/80 dark:text-emerald-300/80">
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
      <MessageSourcePopup
        open={isSourceOpen}
        setOpen={setIsSourceOpen}
        source={source}
      />
    </>
  )
}

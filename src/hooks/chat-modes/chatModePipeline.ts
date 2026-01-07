import { startTransition } from "react"
import { generateID } from "@/db/dexie/helpers"
import { getModelNicknameByID } from "@/db/dexie/nickname"
import { isReasoningEnded, isReasoningStarted } from "@/libs/reasoning"
import { pageAssistModel } from "@/models"
import type { ActorSettings } from "@/types/actor"
import type { ChatDocuments } from "@/models/ChatTypes"
import type { SaveMessageData, SaveMessageErrorData } from "@/types/chat-modes"
import { buildAssistantErrorContent } from "@/utils/chat-error-message"
import {
  buildMessageVariant,
  getLastUserMessageId,
  normalizeMessageVariants,
  type MessageVariant,
  updateActiveVariant
} from "@/utils/message-variants"
import {
  consumeStreamingChunk,
  type StreamingChunk
} from "@/utils/streaming-chunks"
import type { ChatHistory, Message, ToolChoice } from "~/store/option"

const STREAMING_UPDATE_INTERVAL_MS = 80

export type ChatModeParamsBase = {
  selectedModel: string
  useOCR: boolean
  toolChoice?: ToolChoice
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
  saveMessageOnSuccess: (data: SaveMessageData) => Promise<string | null>
  saveMessageOnError: (data: SaveMessageErrorData) => Promise<string | null>
  setHistory: (history: ChatHistory) => void
  setIsProcessing: (value: boolean) => void
  setStreaming: (value: boolean) => void
  setAbortController: (controller: AbortController | null) => void
  historyId: string | null
  setHistoryId: (id: string) => void
  actorSettings?: ActorSettings
  documents?: ChatDocuments
  clusterId?: string
  userMessageType?: string
  assistantMessageType?: string
  modelIdOverride?: string
  userMessageId?: string
  assistantMessageId?: string
  userParentMessageId?: string | null
  assistantParentMessageId?: string | null
  historyForModel?: ChatHistory
  regenerateFromMessage?: Message
}

export type ChatModeContext<TParams extends ChatModeParamsBase> = TParams & {
  message: string
  image: string
  isRegenerate: boolean
  messages: Message[]
  history: ChatHistory
  signal: AbortSignal
  createdAt: number
  generateMessageId: string
  resolvedUserMessageId?: string
  resolvedAssistantMessageId: string
  resolvedAssistantParentMessageId: string | null
  resolvedModelId: string
  userModelId?: string
  modelInfo: { model_name: string; model_avatar?: string } | null
  regenerateVariants: MessageVariant[]
}

export type ChatModePrompt = {
  chatHistory: ChatHistory
  humanMessage?: any
  sources?: unknown[]
  promptId?: string
  promptContent?: string
}

export type ChatModePreflightResult = {
  handled: true
  fullText: string
  sources?: unknown[]
  generationInfo?: unknown
  promptId?: string
  promptContent?: string
  saveToDb?: boolean
  conversationId?: string
}

export type ChatModeMessageSetup = {
  targetMessageId: string
  initialFullText?: string
}

export type ChatModeDefinition<TParams extends ChatModeParamsBase> = {
  id: string
  buildUserMessage?: (ctx: ChatModeContext<TParams>) => Message
  buildAssistantMessage?: (ctx: ChatModeContext<TParams>) => Message
  setupMessages?: (ctx: ChatModeContext<TParams>) => ChatModeMessageSetup
  preparePrompt: (ctx: ChatModeContext<TParams>) => Promise<ChatModePrompt>
  preflight?: (
    ctx: ChatModeContext<TParams>
  ) => Promise<ChatModePreflightResult | null>
  updateHistory?: (ctx: ChatModeContext<TParams>, fullText: string) => ChatHistory
  isContinue?: boolean
  extractGenerationInfo?: (output: unknown) => unknown
}

const defaultExtractGenerationInfo = (output: any) =>
  output?.generations?.[0][0]?.generationInfo

export const runChatPipeline = async <TParams extends ChatModeParamsBase>(
  mode: ChatModeDefinition<TParams>,
  message: string,
  image: string,
  isRegenerate: boolean,
  messages: Message[],
  history: ChatHistory,
  signal: AbortSignal,
  params: TParams
) => {
  const {
    selectedModel,
    toolChoice,
    setMessages,
    saveMessageOnSuccess,
    saveMessageOnError,
    setHistory,
    setIsProcessing,
    setStreaming,
    setAbortController,
    historyId,
    setHistoryId,
    clusterId,
    userMessageType,
    assistantMessageType,
    modelIdOverride,
    userMessageId,
    assistantMessageId,
    userParentMessageId,
    assistantParentMessageId,
    documents,
    regenerateFromMessage
  } = params

  const resolvedAssistantMessageId = assistantMessageId ?? generateID()
  const resolvedUserMessageId =
    !isRegenerate ? userMessageId ?? generateID() : undefined
  const createdAt = Date.now()
  let generateMessageId = resolvedAssistantMessageId
  const modelInfo = await getModelNicknameByID(selectedModel)

  const isSharedCompareUser = userMessageType === "compare:user"
  const resolvedModelId = modelIdOverride || selectedModel
  const userModelId = isSharedCompareUser ? undefined : resolvedModelId
  const fallbackParentMessageId = getLastUserMessageId(messages)
  const resolvedAssistantParentMessageId =
    assistantParentMessageId ??
    (isRegenerate
      ? regenerateFromMessage?.parentMessageId ?? fallbackParentMessageId
      : resolvedUserMessageId ?? null)
  const regenerateVariants =
    isRegenerate && regenerateFromMessage
      ? normalizeMessageVariants(regenerateFromMessage)
      : []

  const context: ChatModeContext<TParams> = {
    ...params,
    message,
    image,
    isRegenerate,
    messages,
    history,
    signal,
    createdAt,
    generateMessageId,
    resolvedUserMessageId,
    resolvedAssistantMessageId,
    resolvedAssistantParentMessageId,
    resolvedModelId,
    userModelId,
    modelInfo,
    regenerateVariants
  }

  let fullText = ""
  let contentToSave = ""
  let timetaken = 0
  let promptContent: string | undefined = undefined
  let promptId: string | undefined = undefined
  let streamingTimer: ReturnType<typeof setTimeout> | null = null
  let lastStreamingUpdateAt = 0
  let pendingStreamingText = ""
  let pendingReasoningTime = 0

  const flushStreamingUpdate = () => {
    streamingTimer = null
    lastStreamingUpdateAt = Date.now()
    startTransition(() => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === generateMessageId
            ? updateActiveVariant(msg, {
                message: pendingStreamingText,
                reasoning_time_taken: pendingReasoningTime
              })
            : msg
        )
      )
    })
  }

  // Throttle streaming UI updates to keep the input responsive.
  const scheduleStreamingUpdate = (text: string, reasoningTime: number) => {
    pendingStreamingText = text
    pendingReasoningTime = reasoningTime
    if (streamingTimer != null) return
    const now = Date.now()
    const elapsed = now - lastStreamingUpdateAt
    const delay = Math.max(0, STREAMING_UPDATE_INTERVAL_MS - elapsed)
    streamingTimer = setTimeout(flushStreamingUpdate, delay)
  }

  const cancelStreamingUpdate = () => {
    if (streamingTimer == null) return
    clearTimeout(streamingTimer)
    streamingTimer = null
  }

  if (mode.setupMessages) {
    const setup = mode.setupMessages(context)
    generateMessageId = setup.targetMessageId
    context.generateMessageId = generateMessageId
    context.resolvedAssistantMessageId = generateMessageId
    if (typeof setup.initialFullText === "string") {
      fullText = setup.initialFullText
      contentToSave = setup.initialFullText
    }
  } else {
    if (!mode.buildAssistantMessage || !mode.buildUserMessage) {
      throw new Error(`Chat mode "${mode.id}" is missing message builders.`)
    }
    setMessages((prev) => {
      const assistantStub = mode.buildAssistantMessage!(context)
      if (!isRegenerate) {
        const userMessageEntry = mode.buildUserMessage!(context)
        return [...prev, userMessageEntry, assistantStub]
      }
      return [...prev, assistantStub]
    })

    if (regenerateVariants.length > 0) {
      setMessages((prev) => {
        const next = [...prev]
        const lastIndex = next.findLastIndex(
          (msg) => msg.id === resolvedAssistantMessageId
        )
        if (lastIndex >= 0) {
          const stub = next[lastIndex]
          const variants = [
            ...regenerateVariants,
            buildMessageVariant(stub)
          ]
          next[lastIndex] = {
            ...stub,
            variants,
            activeVariantIndex: variants.length - 1
          }
        }
        return next
      })
    }
  }

  try {
    const preflight = mode.preflight ? await mode.preflight(context) : null
    if (preflight?.handled) {
      fullText = preflight.fullText
      const sources = preflight.sources ?? []
      const nextHistory = mode.updateHistory
        ? mode.updateHistory(context, fullText)
        : ([
            ...history,
            { role: "user", content: message, image },
            { role: "assistant", content: fullText }
          ] as ChatHistory)

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === generateMessageId
            ? updateActiveVariant(msg, {
                message: fullText,
                sources,
                generationInfo: preflight.generationInfo,
                reasoning_time_taken: timetaken
              })
            : msg
        )
      )
      setHistory(nextHistory)

      await saveMessageOnSuccess({
        historyId,
        setHistoryId,
        isRegenerate,
        selectedModel,
        message,
        image,
        fullText,
        source: sources,
        userMessageType,
        assistantMessageType,
        clusterId,
        modelId: resolvedModelId,
        userModelId,
        userMessageId: resolvedUserMessageId,
        assistantMessageId: resolvedAssistantMessageId,
        userParentMessageId: userParentMessageId ?? null,
        assistantParentMessageId: resolvedAssistantParentMessageId ?? null,
        documents,
        isContinue: mode.isContinue,
        generationInfo: preflight.generationInfo as any,
        prompt_content: preflight.promptContent,
        prompt_id: preflight.promptId,
        reasoning_time_taken: timetaken,
        saveToDb: preflight.saveToDb ?? false,
        conversationId: preflight.conversationId
      })

      setIsProcessing(false)
      setStreaming(false)
      return
    }

    const promptData = await mode.preparePrompt(context)
    promptContent = promptData.promptContent
    promptId = promptData.promptId
    const sources = promptData.sources ?? []
    const humanMessage = promptData.humanMessage

    const modelClient = await pageAssistModel({
      model: selectedModel,
      toolChoice
    })

    let generationInfo: unknown = undefined
    const chunks = await modelClient.stream(
      humanMessage
        ? [...promptData.chatHistory, humanMessage]
        : [...promptData.chatHistory],
      {
        signal,
        callbacks: [
          {
            handleLLMEnd(output: unknown): void {
              const extractor =
                mode.extractGenerationInfo ?? defaultExtractGenerationInfo
              generationInfo = extractor(output)
            }
          }
        ]
      }
    )

    let count = 0
    let reasoningStartTime: Date | null = null
    let reasoningEndTime: Date | null = null
    let apiReasoning = false

    for await (const chunk of chunks) {
      const chunkState = consumeStreamingChunk(
        { fullText, contentToSave, apiReasoning },
        chunk as StreamingChunk
      )
      fullText = chunkState.fullText
      contentToSave = chunkState.contentToSave
      apiReasoning = chunkState.apiReasoning

      if (isReasoningStarted(fullText) && !reasoningStartTime) {
        reasoningStartTime = new Date()
      }

      if (
        reasoningStartTime &&
        !reasoningEndTime &&
        isReasoningEnded(fullText)
      ) {
        reasoningEndTime = new Date()
        const reasoningTime =
          reasoningEndTime.getTime() - reasoningStartTime.getTime()
        timetaken = reasoningTime
      }

      if (count === 0) {
        setIsProcessing(true)
      }

      scheduleStreamingUpdate(`${fullText}▋`, timetaken)
      count++
    }

    cancelStreamingUpdate()
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === generateMessageId
          ? updateActiveVariant(msg, {
              message: fullText,
              sources,
              generationInfo,
              reasoning_time_taken: timetaken
            })
          : msg
      )
    )

    setHistory(
      mode.updateHistory
        ? mode.updateHistory(context, fullText)
        : ([
            ...history,
            { role: "user", content: message, image },
            { role: "assistant", content: fullText }
          ] as ChatHistory)
    )

    await saveMessageOnSuccess({
      historyId,
      setHistoryId,
      isRegenerate,
      selectedModel,
      message,
      image,
      fullText,
      source: sources,
      userMessageType,
      assistantMessageType,
      clusterId,
      modelId: resolvedModelId,
      userModelId,
      userMessageId: resolvedUserMessageId,
      assistantMessageId: resolvedAssistantMessageId,
      userParentMessageId: userParentMessageId ?? null,
      assistantParentMessageId: resolvedAssistantParentMessageId ?? null,
      documents,
      isContinue: mode.isContinue,
      generationInfo: generationInfo as any,
      prompt_content: promptContent,
      prompt_id: promptId,
      reasoning_time_taken: timetaken,
      saveToDb: Boolean(modelClient.saveToDb),
      conversationId: modelClient.conversationId
    })

    setIsProcessing(false)
    setStreaming(false)
  } catch (e) {
    cancelStreamingUpdate()
    const assistantContent = buildAssistantErrorContent(fullText, e)
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === generateMessageId
          ? updateActiveVariant(msg, { message: assistantContent })
          : msg
      )
    )

    const errorSave = await saveMessageOnError({
      e,
      botMessage: assistantContent,
      history,
      historyId,
      image,
      selectedModel,
      setHistory,
      setHistoryId,
      userMessage: message,
      isRegenerating: isRegenerate,
      userMessageType,
      assistantMessageType,
      clusterId,
      modelId: resolvedModelId,
      userModelId,
      userMessageId: resolvedUserMessageId,
      assistantMessageId: resolvedAssistantMessageId,
      userParentMessageId: userParentMessageId ?? null,
      assistantParentMessageId: assistantParentMessageId ?? null,
      documents,
      isContinue: mode.isContinue,
      prompt_content: promptContent,
      prompt_id: promptId
    })

    if (!errorSave) {
      throw e
    }
    setIsProcessing(false)
    setStreaming(false)
  } finally {
    setAbortController(null)
  }
}

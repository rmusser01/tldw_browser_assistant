import { promptForRag } from "~/services/tldw-server"
import { type ChatHistory, type Message, type ToolChoice } from "~/store/option"
import { generateID } from "@/db/dexie/helpers"
import { generateHistory } from "@/utils/generate-history"
import { pageAssistModel } from "@/models"
import { humanMessageFormatter } from "@/utils/human-message"
import { extractGenerationInfo } from "@/utils/llm-helpers"
import {
  isReasoningEnded,
  isReasoningStarted,
  mergeReasoningContent
} from "@/libs/reasoning"
import { getModelNicknameByID } from "@/db/dexie/nickname"
import { ChatDocuments } from "@/models/ChatTypes"
import type { ActorSettings } from "@/types/actor"
import { maybeInjectActorMessage } from "@/utils/actor"
import { getTabContents } from "@/libs/get-tab-contents"
import type { SaveMessageData, SaveMessageErrorData } from "@/types/chat-modes"
import { buildAssistantErrorContent } from "@/utils/chat-error-message"
import {
  buildMessageVariant,
  getLastUserMessageId,
  normalizeMessageVariants,
  updateActiveVariant
} from "@/utils/message-variants"

export const tabChatMode = async (
  message: string,
  image: string,
  documents: ChatDocuments,
  isRegenerate: boolean,
  messages: Message[],
  history: ChatHistory,
  signal: AbortSignal,
  {
    selectedModel,
    useOCR,
    selectedSystemPrompt,
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
    actorSettings,
    clusterId,
    userMessageType,
    assistantMessageType,
    modelIdOverride,
    userMessageId,
    assistantMessageId,
    userParentMessageId,
    assistantParentMessageId,
    historyForModel,
    regenerateFromMessage
  }: {
    selectedModel: string
    useOCR: boolean
    selectedSystemPrompt: string
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
) => {
  console.log("Using tabChatMode")
  const ollama = await pageAssistModel({ model: selectedModel, toolChoice })

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

  setMessages((prev) => {
    if (!isRegenerate) {
      return [
        ...prev,
        {
          isBot: false,
          name: "You",
          message,
          sources: [],
          images: image ? [image] : [],
          createdAt,
          documents,
          id: resolvedUserMessageId,
          messageType: userMessageType,
          clusterId,
          modelId: userModelId,
          parentMessageId: userParentMessageId ?? null
        },
        {
          isBot: true,
          name: selectedModel,
          message: "▋",
          sources: [],
          createdAt,
          id: resolvedAssistantMessageId,
          modelImage: modelInfo?.model_avatar,
          modelName: modelInfo?.model_name || selectedModel,
          messageType: assistantMessageType,
          clusterId,
          modelId: resolvedModelId,
          parentMessageId: resolvedAssistantParentMessageId ?? null
        }
      ]
    }

    return [
      ...prev,
      {
        isBot: true,
        name: selectedModel,
        message: "▋",
        sources: [],
        createdAt,
        id: resolvedAssistantMessageId,
        modelImage: modelInfo?.model_avatar,
        modelName: modelInfo?.model_name || selectedModel,
        messageType: assistantMessageType,
        clusterId,
        modelId: resolvedModelId,
        parentMessageId: resolvedAssistantParentMessageId ?? null
      }
    ]
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
  let fullText = ""
  let contentToSave = ""


  let timetaken = 0
  try {
    const { ragPrompt: systemPrompt } = await promptForRag()
    let context = await getTabContents(documents)

    let humanMessage = await humanMessageFormatter({
      content: [
        {
          text: systemPrompt
            .replace("{context}", context)
            .replace("{question}", message),
          type: "text"
        }
      ],
      model: selectedModel,
      useOCR: useOCR
    })
    if (image.length > 0) {
      humanMessage = await humanMessageFormatter({
        content: [
          {
            text: message,
            type: "text"
          },
          {
            image_url: image,
            type: "image_url"
          }
        ],
        model: selectedModel,
        useOCR: useOCR
      })
    }
    const source: unknown[] = [] // Empty for tab chat mode; sources not applicable


    let applicationChatHistory = generateHistory(
      historyForModel ?? history,
      selectedModel
    )

    const templatesActive = !!selectedSystemPrompt
    applicationChatHistory = await maybeInjectActorMessage(
      applicationChatHistory,
      actorSettings || null,
      templatesActive
    )

    let generationInfo: Record<string, unknown> | undefined = undefined

    const chunks = await ollama.stream(
      [...applicationChatHistory, humanMessage],
      {
        signal: signal,
        callbacks: [
          {
            handleLLMEnd(output: unknown): void {
              const info = extractGenerationInfo(output)
              if (info) {
                generationInfo = info
              }
            }
          }
        ]
      }
    )
    let count = 0
    let reasoningStartTime: Date | undefined = undefined
    let reasoningEndTime: Date | undefined = undefined
    let apiReasoning = false

    for await (const chunk of chunks) {
      const token = typeof chunk === 'string' ? chunk : (chunk?.content ?? (chunk?.choices?.[0]?.delta?.content ?? ''))
      if (chunk?.additional_kwargs?.reasoning_content) {
        const reasoningContent = mergeReasoningContent(
          fullText,
          chunk?.additional_kwargs?.reasoning_content || ""
        )
        contentToSave = reasoningContent
        fullText = reasoningContent
        apiReasoning = true
      } else {
        if (apiReasoning) {
          fullText += "</think>"
          contentToSave += "</think>"
          apiReasoning = false
        }
      }

      if (token) {
        contentToSave += token
        fullText += token
      }
      if (count === 0) {
        setIsProcessing(true)
      }
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
      setMessages((prev) => {
        return prev.map((message) => {
          if (message.id === generateMessageId) {
            return updateActiveVariant(message, {
              message: fullText + "▋",
              reasoning_time_taken: timetaken
            })
          }
          return message
        })
      })
      count++
    }
    // update the message with the full text
    setMessages((prev) => {
      return prev.map((message) => {
        if (message.id === generateMessageId) {
          return updateActiveVariant(message, {
            message: fullText,
            sources: source,
            generationInfo,
            reasoning_time_taken: timetaken
          })
        }
        return message
      })
    })

    setHistory([
      ...history,
      {
        role: "user",
        content: message,
        image
      },
      {
        role: "assistant",
        content: fullText
      }
    ])

    await saveMessageOnSuccess({
      historyId,
      setHistoryId,
      isRegenerate,
      selectedModel: selectedModel,
      message,
      image,
      fullText,
      source,
      userMessageType,
      assistantMessageType,
      clusterId,
      modelId: resolvedModelId,
      userModelId,
      userMessageId: resolvedUserMessageId,
      assistantMessageId: resolvedAssistantMessageId,
      userParentMessageId: userParentMessageId ?? null,
      assistantParentMessageId: resolvedAssistantParentMessageId ?? null,
      generationInfo,
      reasoning_time_taken: timetaken,
      documents,
      saveToDb: Boolean(ollama.saveToDb),
      conversationId: ollama.conversationId
    })

    setIsProcessing(false)
    setStreaming(false)
  } catch (e) {
    console.error("tabChatMode error:", e)
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
      assistantParentMessageId: resolvedAssistantParentMessageId ?? null,
      documents,
    })

    if (!errorSave) {
      throw e // Re-throw to be handled by the calling function
    }
    setIsProcessing(false)
    setStreaming(false)
  } finally {
    setAbortController(null)
  }
}

import { promptForRag } from "~/services/tldw-server"
import { type ChatHistory, type Message } from "~/store/option"
import { generateID } from "@/db/dexie/helpers"
import { generateHistory } from "@/utils/generate-history"
import { pageAssistModel } from "@/models"
import { humanMessageFormatter } from "@/utils/human-message"
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
    currentChatModelSettings,
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
    historyForModel
  }: {
    selectedModel: string
    useOCR: boolean
    selectedSystemPrompt: string
    currentChatModelSettings: unknown
    setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
    saveMessageOnSuccess: (data: any) => Promise<string | null>
    saveMessageOnError: (data: any) => Promise<string | null>
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
  }
) => {
  console.log("Using tabChatMode")
  const ollama = await pageAssistModel({ model: selectedModel, baseUrl: "" })

  const resolvedAssistantMessageId = assistantMessageId ?? generateID()
  const resolvedUserMessageId =
    !isRegenerate ? userMessageId ?? generateID() : undefined
  let generateMessageId = resolvedAssistantMessageId
  const modelInfo = await getModelNicknameByID(selectedModel)

  const isSharedCompareUser = userMessageType === "compare:user"
  const resolvedModelId = modelIdOverride || selectedModel
  const userModelId = isSharedCompareUser ? undefined : resolvedModelId

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
          id: resolvedAssistantMessageId,
          modelImage: modelInfo?.model_avatar,
          modelName: modelInfo?.model_name || selectedModel,
          messageType: assistantMessageType,
          clusterId,
          modelId: resolvedModelId,
          parentMessageId: assistantParentMessageId ?? null
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
        id: resolvedAssistantMessageId,
        modelImage: modelInfo?.model_avatar,
        modelName: modelInfo?.model_name || selectedModel,
        messageType: assistantMessageType,
        clusterId,
        modelId: resolvedModelId,
        parentMessageId: assistantParentMessageId ?? null
      }
    ]
  })
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
    let source: any[] = []


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

    let generationInfo: any | undefined = undefined

    const chunks = await ollama.stream(
      [...applicationChatHistory, humanMessage],
      {
        signal: signal,
        callbacks: [
          {
            handleLLMEnd(output: any): any {
              try {
                generationInfo = output?.generations?.[0][0]?.generationInfo
              } catch (e) {
                console.error("handleLLMEnd error", e)
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
            return {
              ...message,
              message: fullText + "▋",
              reasoning_time_taken: timetaken
            }
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
          return {
            ...message,
            message: fullText,
            sources: source,
            generationInfo,
            reasoning_time_taken: timetaken
          }
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
      assistantParentMessageId: assistantParentMessageId ?? null,
      generationInfo,
      reasoning_time_taken: timetaken,
      documents,
    })

    setIsProcessing(false)
    setStreaming(false)
  } catch (e) {
    console.log(e)
    const errorSave = await saveMessageOnError({
      e,
      botMessage: fullText,
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

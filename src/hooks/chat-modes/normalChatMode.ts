import { systemPromptForNonRagOption } from "~/services/tldw-server"
import { type ChatHistory, type Message } from "~/store/option"
import { generateID, getPromptById } from "@/db/dexie/helpers"
import { generateHistory } from "@/utils/generate-history"
import { pageAssistModel } from "@/models"
import { humanMessageFormatter } from "@/utils/human-message"
import { isReasoningEnded, isReasoningStarted } from "@/libs/reasoning"
import { consumeStreamingChunk } from "@/utils/streaming-chunks"
import { getModelNicknameByID } from "@/db/dexie/nickname"
import { systemPromptFormatter } from "@/utils/system-message"
import type { ActorSettings } from "@/types/actor"
import { maybeInjectActorMessage } from "@/utils/actor"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { getSearchSettings } from "@/services/search"
import type { SaveMessageData, SaveMessageErrorData } from "@/types/chat-modes"

interface WebSearchPayload {
  query: string
  aggregate: boolean
  engine?: string
  result_count?: number
}

export const normalChatMode = async (
  message: string,
  image: string,
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
    uploadedFiles,
    actorSettings,
    webSearch,
    setIsSearchingInternet,
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
    currentChatModelSettings: any
    setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
    saveMessageOnSuccess: (data: SaveMessageData) => Promise<string | null>
    saveMessageOnError: (data: SaveMessageErrorData) => Promise<string | null>
    setHistory: (history: ChatHistory) => void
    setIsProcessing: (value: boolean) => void
    setStreaming: (value: boolean) => void
    setAbortController: (controller: AbortController | null) => void
    historyId: string | null
    setHistoryId: (id: string) => void
    uploadedFiles?: any[]
    actorSettings?: ActorSettings
    webSearch?: boolean
    setIsSearchingInternet?: (value: boolean) => void
    // Optional compare/multi-model metadata
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
  console.log("Using normalChatMode")
  let promptId: string | undefined = selectedSystemPrompt
  let promptContent: string | undefined = undefined

  if (image.length > 0) {
    image = `data:image/jpeg;base64,${image.split(",")[1]}`
  }

  const resolvedAssistantMessageId = assistantMessageId ?? generateID()
  const resolvedUserMessageId =
    !isRegenerate ? userMessageId ?? generateID() : undefined
  let generateMessageId = resolvedAssistantMessageId
  const modelInfo = await getModelNicknameByID(selectedModel)
  const isSharedCompareUser = userMessageType === "compare:user"
  const resolvedModelId = modelIdOverride || selectedModel
  const userModelId = isSharedCompareUser ? undefined : resolvedModelId

  setMessages((prev) => {
    const base = prev

    if (!isRegenerate) {
      const userMessage: Message = {
        isBot: false,
        name: "You",
        message,
        sources: [],
        images: image ? [image] : [],
        id: resolvedUserMessageId,
        modelImage: modelInfo?.model_avatar,
        modelName: modelInfo?.model_name || selectedModel,
        documents:
          uploadedFiles?.map((f) => ({
            type: "file",
            filename: f.filename,
            fileSize: f.size,
            processed: f.processed
          })) || [],
        messageType: userMessageType,
        clusterId,
        modelId: userModelId,
        parentMessageId: userParentMessageId ?? null
      }
      const assistantStub: Message = {
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
      return [...base, userMessage, assistantStub]
    }

    const assistantStub: Message = {
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
    return [...base, assistantStub]
  })
  let fullText = ""
  let contentToSave = ""
  let timetaken = 0

  // If web search is enabled, delegate to tldw_server's websearch endpoint
  if (webSearch) {
    try {
      setIsProcessing(true)
      if (setIsSearchingInternet) {
        setIsSearchingInternet(true)
      }

      await tldwClient.initialize()
      const { searchProvider, totalSearchResults } = await getSearchSettings()

      // Map UI provider to server-side engine where possible
      const engineMap: Record<string, string> = {
        google: "google",
        duckduckgo: "duckduckgo",
        brave: "brave",
        "brave-api": "brave",
        searxng: "searx",
        "tavily-api": "tavily",
        exa: "exa",
        firecrawl: "firecrawl"
      }
      const provider = (searchProvider || "").toLowerCase()
      const engine = engineMap[provider]

      const payload: WebSearchPayload = {
        query: message,
        aggregate: true
      }
      if (engine) {
        payload.engine = engine
      }
      if (typeof totalSearchResults === "number" && totalSearchResults > 0) {
        payload.result_count = totalSearchResults
      }

      const res = await tldwClient.webSearch({
        ...payload,
        signal
      })

      if (res?.error) {
        throw new Error(
          typeof res.error === "string"
            ? res.error
            : res.error?.message || "Web search failed"
        )
      }

      const answer =
        (res?.final_answer?.text && String(res.final_answer.text)) ||
        ""

      fullText =
        answer && answer.trim().length > 0
          ? answer
          : "No web search results were returned."

      setMessages((prev) => {
        return prev.map((msg) => {
          if (msg.id === generateMessageId) {
            return {
              ...msg,
              message: fullText
            }
          }
          return msg
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
        source: [],
        userMessageType,
        assistantMessageType,
        clusterId,
        modelId: resolvedModelId,
        userModelId,
        userMessageId: resolvedUserMessageId,
        assistantMessageId: resolvedAssistantMessageId,
        userParentMessageId: userParentMessageId ?? null,
        assistantParentMessageId: assistantParentMessageId ?? null,
        generationInfo: undefined,
        prompt_content: undefined,
        prompt_id: undefined,
        reasoning_time_taken: timetaken
      })

      setIsProcessing(false)
      setStreaming(false)
    } catch (e) {
      console.error(e)
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
        prompt_content: undefined,
        prompt_id: undefined
      })

      if (!errorSave) {
        throw e
      }
      setIsProcessing(false)
      setStreaming(false)
    } finally {
      if (setIsSearchingInternet) {
        setIsSearchingInternet(false)
      }
      setAbortController(null)
    }

    return
  }

  const ollama = await pageAssistModel({ model: selectedModel })

  try {
    const prompt = await systemPromptForNonRagOption()
    const selectedPrompt = await getPromptById(selectedSystemPrompt)

    let humanMessage = await humanMessageFormatter({
      content: [
        {
          text: message,
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

    let applicationChatHistory = generateHistory(
      historyForModel ?? history,
      selectedModel
    )

    if (prompt && !selectedPrompt) {
      applicationChatHistory.unshift(
        await systemPromptFormatter({
          content: prompt
        })
      )
    }

    const isTempSystemprompt =
      currentChatModelSettings.systemPrompt &&
      currentChatModelSettings.systemPrompt?.trim().length > 0

    if (!isTempSystemprompt && selectedPrompt) {
      applicationChatHistory.unshift(
        await systemPromptFormatter({
          content: selectedPrompt.content
        })
      )
      promptContent = selectedPrompt.content
    }

    if (isTempSystemprompt) {
      applicationChatHistory.unshift(
        await systemPromptFormatter({
          content: currentChatModelSettings.systemPrompt
        })
      )
      promptContent = currentChatModelSettings.systemPrompt
    }

    // Inject Actor prompt according to chatPosition / depth / role,
    // respecting templateMode when a scene template is selected
    // in Chat Settings (represented by selectedSystemPrompt).
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
    let reasoningStartTime: Date | null = null
    let reasoningEndTime: Date | null = null
    let apiReasoning: boolean = false

    for await (const chunk of chunks) {
      const chunkState = consumeStreamingChunk(
        { fullText, contentToSave, apiReasoning },
        chunk
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

    setMessages((prev) => {
      return prev.map((message) => {
        if (message.id === generateMessageId) {
          return {
            ...message,
            message: fullText,
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
      source: [],
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
      prompt_content: promptContent,
      prompt_id: promptId,
      reasoning_time_taken: timetaken
    })

    setIsProcessing(false)
    setStreaming(false)
  } catch (e) {
    console.error(e)

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
      prompt_content: promptContent,
      prompt_id: promptId
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

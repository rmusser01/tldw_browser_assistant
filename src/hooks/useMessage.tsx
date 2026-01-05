import React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { promptForRag, systemPromptForNonRag } from "~/services/tldw-server"
import { useStoreMessageOption, type Message } from "~/store/option"
import { useStoreMessage } from "~/store"
import { getContentFromCurrentTab } from "~/libs/get-html"
// RAG now uses tldw_server endpoints instead of local embeddings
import { ChatHistory } from "@/store/option"
import {
  deleteChatForEdit,
  generateID,
  getPromptById,
  removeMessageByIndex,
  updateMessageByIndex
} from "@/db/dexie/helpers"
import { useTranslation } from "react-i18next"
import { usePageAssist } from "@/context"
import { formatDocs } from "@/utils/format-docs"
import { buildAssistantErrorContent } from "@/utils/chat-error-message"
import { useStorage } from "@plasmohq/storage/hook"
import { useStoreChatModelSettings } from "@/store/model"
import { getAllDefaultModelSettings } from "@/services/model-settings"
import { pageAssistModel } from "@/models"
import { getPrompt } from "@/services/application"
import { humanMessageFormatter } from "@/utils/human-message"
import { generateHistory } from "@/utils/generate-history"
import { tldwClient, type ConversationState } from "@/services/tldw/TldwApiClient"
import { getScreenshotFromCurrentTab } from "@/libs/get-screenshot"
import {
  isReasoningEnded,
  isReasoningStarted,
  mergeReasoningContent,
  removeReasoning
} from "@/libs/reasoning"
import { getModelNicknameByID } from "@/db/dexie/nickname"
import { systemPromptFormatter } from "@/utils/system-message"
import type { Character } from "@/types/character"
import { createBranchMessage } from "./handlers/messageHandlers"
import { consumeStreamingChunk } from "@/utils/streaming-chunks"
import {
  createSaveMessageOnError,
  createSaveMessageOnSuccess,
  validateBeforeSubmit
} from "./utils/messageHelpers"
import {
  buildMessageVariant,
  getLastUserMessageId,
  normalizeMessageVariants,
  updateActiveVariant
} from "@/utils/message-variants"
import { normalChatMode } from "./chat-modes/normalChatMode"
import { updatePageTitle } from "@/utils/update-page-title"
import { useAntdNotification } from "./useAntdNotification"
import { useChatBaseState } from "@/hooks/chat/useChatBaseState"
import { normalizeConversationState } from "@/utils/conversation-state"

type ServerBackedMessage = Message & {
  serverMessageId?: string
  serverMessageVersion?: number
}

export const useMessage = () => {
  // Controllers come from Context (for aborting streaming requests)
  const {
    controller: abortController,
    setController: setAbortController,
    embeddingController,
    setEmbeddingController
  } = usePageAssist()

  // Messages now come from Zustand store (single source of truth)
  const messages = useStoreMessageOption((state) => state.messages)
  const setMessages = useStoreMessageOption((state) => state.setMessages)

  const { t } = useTranslation("option")
  const queryClient = useQueryClient()
  const invalidateServerChatHistory = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
  }, [queryClient])
  const [selectedModel, setSelectedModel] = useStorage("selectedModel")
  const currentChatModelSettings = useStoreChatModelSettings()
  const {
    setIsSearchingInternet,
    webSearch,
    setWebSearch,
    toolChoice,
    setToolChoice,
    isSearchingInternet,
    temporaryChat,
    setTemporaryChat,
    queuedMessages,
    addQueuedMessage,
    setQueuedMessages,
    clearQueuedMessages,
    replyTarget,
    clearReplyTarget
  } = useStoreMessageOption()
  const [defaultInternetSearchOn] = useStorage("defaultInternetSearchOn", false)

  const [defaultChatWithWebsite] = useStorage("defaultChatWithWebsite", false)

  const [chatWithWebsiteEmbedding] = useStorage(
    "chatWithWebsiteEmbedding",
    false
  )
  const [maxWebsiteContext] = useStorage("maxWebsiteContext", 4028)
  const [selectedCharacter] = useStorage<Character | null>(
    "selectedCharacter",
    null
  )

  const {
    history,
    setHistory,
    streaming,
    setStreaming,
    isFirstMessage,
    setIsFirstMessage,
    historyId,
    setHistoryId,
    isLoading,
    setIsLoading,
    isProcessing,
    setIsProcessing,
    chatMode,
    setChatMode,
    isEmbedding,
    setIsEmbedding,
    selectedQuickPrompt,
    setSelectedQuickPrompt,
    selectedSystemPrompt,
    setSelectedSystemPrompt,
    useOCR,
    setUseOCR
  } = useChatBaseState(useStoreMessage)
  const { currentURL, setCurrentURL } = useStoreMessage()
  const {
    serverChatId,
    setServerChatId,
    serverChatTitle,
    setServerChatTitle,
    serverChatCharacterId,
    setServerChatCharacterId,
    serverChatMetaLoaded,
    setServerChatMetaLoaded,
    serverChatState,
    setServerChatState,
    setServerChatVersion,
    serverChatTopic,
    setServerChatTopic,
    serverChatClusterId,
    setServerChatClusterId,
    serverChatSource,
    setServerChatSource,
    serverChatExternalRef,
    setServerChatExternalRef
  } = useStoreMessageOption()
  const notification = useAntdNotification()
  const [sidepanelTemporaryChat] = useStorage("sidepanelTemporaryChat", false)
  const [speechToTextLanguage, setSpeechToTextLanguage] = useStorage(
    "speechToTextLanguage",
    "en-US"
  )

  const resetServerChatState = () => {
    setServerChatState("in-progress")
    setServerChatVersion(null)
    setServerChatTitle(null)
    setServerChatCharacterId(null)
    setServerChatMetaLoaded(false)
    setServerChatTopic(null)
    setServerChatClusterId(null)
    setServerChatSource(null)
    setServerChatExternalRef(null)
  }

  React.useEffect(() => {
    if (!serverChatId || serverChatMetaLoaded) return
    const loadChatMeta = async () => {
      try {
        await tldwClient.initialize().catch(() => null)
        const chat = await tldwClient.getChat(serverChatId)
        setServerChatTitle(String((chat as any)?.title || ""))
        setServerChatCharacterId(
          (chat as any)?.character_id ?? (chat as any)?.characterId ?? null
        )
        setServerChatState(
          (chat as any)?.state ??
            (chat as any)?.conversation_state ??
            "in-progress"
        )
        setServerChatVersion((chat as any)?.version ?? null)
        setServerChatTopic((chat as any)?.topic_label ?? null)
        setServerChatClusterId((chat as any)?.cluster_id ?? null)
        setServerChatSource((chat as any)?.source ?? null)
        setServerChatExternalRef((chat as any)?.external_ref ?? null)
        setServerChatMetaLoaded(true)
      } catch {
        // ignore metadata hydration failures
      }
    }
    void loadChatMeta()
  }, [
    serverChatId,
    serverChatMetaLoaded,
    setServerChatCharacterId,
    setServerChatClusterId,
    setServerChatExternalRef,
    setServerChatMetaLoaded,
    setServerChatSource,
    setServerChatState,
    setServerChatTitle,
    setServerChatTopic,
    setServerChatVersion
  ])

  React.useEffect(() => {
    // Reset server chat when character changes
    setServerChatId(null)
    resetServerChatState()
  }, [selectedCharacter?.id])

  // Local embedding store removed; rely on tldw_server RAG

  const clearChat = () => {
    stopStreamingRequest()
    setMessages([])
    setHistory([])
    setHistoryId(null)
    setIsFirstMessage(true)
    setIsLoading(false)
    setIsProcessing(false)
    setStreaming(false)
    updatePageTitle() 
    currentChatModelSettings.reset()
    setServerChatId(null)
    resetServerChatState()
    if (defaultInternetSearchOn) {
      setWebSearch(true)
    }
    if (defaultChatWithWebsite) {
      setChatMode("rag")
    }
    if (sidepanelTemporaryChat) {
      setTemporaryChat(true)
    }
    clearReplyTarget()
  }

  const saveMessageOnSuccess = createSaveMessageOnSuccess(
    temporaryChat,
    setHistoryId as (id: string) => void
  )
  const saveMessageOnError = createSaveMessageOnError(
    temporaryChat,
    history,
    setHistory,
    setHistoryId as (id: string) => void
  )

  const chatWithWebsiteMode = async (
    message: string,
    image: string,
    isRegenerate: boolean,
    messages: Message[],
    history: ChatHistory,
    signal: AbortSignal,
    embeddingSignal: AbortSignal,
    regenerateFromMessage?: Message
  ) => {
    if (!selectedModel || selectedModel.trim().length === 0) {
      notification.error({
        message: t("error"),
        description: t("validationSelectModel")
      })
      return
    }

    const model = selectedModel.trim()
    setStreaming(true)
    const userDefaultModelSettings = await getAllDefaultModelSettings()

    const ollama = await pageAssistModel({
      model
    })

    let newMessage: Message[] = []
    const resolvedAssistantMessageId = generateID()
    const resolvedUserMessageId = !isRegenerate ? generateID() : undefined
    let generateMessageId = resolvedAssistantMessageId
    const createdAt = Date.now()
    const modelInfo = await getModelNicknameByID(model)
    const fallbackParentMessageId = getLastUserMessageId(messages)
    const resolvedAssistantParentMessageId = isRegenerate
      ? regenerateFromMessage?.parentMessageId ?? fallbackParentMessageId
      : resolvedUserMessageId ?? null
    const regenerateVariants =
      isRegenerate && regenerateFromMessage
        ? normalizeMessageVariants(regenerateFromMessage)
        : []

    if (!isRegenerate) {
      newMessage = [
        ...messages,
        {
          isBot: false,
          name: "You",
          message,
          sources: [],
          images: [],
          createdAt,
          id: resolvedUserMessageId,
          parentMessageId: null
        },
        {
          isBot: true,
          name: model,
          message: "▋",
          sources: [],
          createdAt,
          id: generateMessageId,
          modelImage: modelInfo?.model_avatar,
          modelName: modelInfo?.model_name || model,
          parentMessageId: resolvedAssistantParentMessageId ?? null
        }
      ]
    } else {
      newMessage = [
        ...messages,
        {
          isBot: true,
          name: model,
          message: "▋",
          sources: [],
          createdAt,
          id: generateMessageId,
          modelImage: modelInfo?.model_avatar,
          modelName: modelInfo?.model_name || model,
          parentMessageId: resolvedAssistantParentMessageId ?? null
        }
      ]
    }

    setMessages(newMessage)
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
    let embedURL: string, embedHTML: string, embedType: string
    let embedPDF: { content: string; page: number }[] = []

    const {
      content: html,
      url: websiteUrl,
      type,
      pdf
    } = await getContentFromCurrentTab(chatWithWebsiteEmbedding)

    embedHTML = html
    embedURL = websiteUrl
    embedType = type
    embedPDF = pdf
    if (messages.length === 0) {
      setCurrentURL(websiteUrl)
    } else if (currentURL !== websiteUrl) {
      setCurrentURL(websiteUrl)
    } else {
      embedURL = currentURL
    }
    setMessages(newMessage)
    try {
      let query = message
      const { ragPrompt: systemPrompt, ragQuestionPrompt: questionPrompt } =
        await promptForRag()
      if (newMessage.length > 2) {
        const lastTenMessages = newMessage.slice(-10)
        lastTenMessages.pop()
        const chat_history = lastTenMessages
          .map((message) => {
            return `${message.isBot ? "Assistant: " : "Human: "}${message.message}`
          })
          .join("\n")
        const promptForQuestion = questionPrompt
          .replaceAll("{chat_history}", chat_history)
          .replaceAll("{question}", message)
        const questionOllama = await pageAssistModel({
          model,
          toolChoice: "none",
          saveToDb: false
        })
        const questionMessage = await humanMessageFormatter({
          content: [
            {
              text: promptForQuestion,
              type: "text"
            }
          ],
          model,
          useOCR
        })
        const response = await questionOllama.invoke([questionMessage])
        query = response.content.toString()
        query = removeReasoning(query)
      }

      let context: string = ""
      let source: {
        name: any
        type: any
        mode: string
        url: string
        pageContent: string
        metadata: Record<string, any>
      }[] = []

      if (chatWithWebsiteEmbedding) {
        try {
          await tldwClient.initialize()
          // Optionally ensure server has the page content in the media index
          if (embedURL) {
            try { await tldwClient.addMedia(embedURL, {}) } catch {}
          }
          const ragRes = await tldwClient.ragSearch(query, { top_k: 4, filters: { url: embedURL } })
          const docs = ragRes?.results || ragRes?.documents || ragRes?.docs || []
          context = formatDocs(
            docs.map((d: any) => ({ pageContent: d.content || d.text || d.chunk || "", metadata: d.metadata || {} }))
          )
          source = docs.map((d: any) => ({
            name: d.metadata?.source || d.metadata?.title || "untitled",
            type: d.metadata?.type || "unknown",
            mode: "chat",
            url: d.metadata?.url || "",
            pageContent: d.content || d.text || d.chunk || "",
            metadata: d.metadata || {}
          }))
        } catch (e) {
          console.error('tldw ragSearch failed, falling back to inline context', e)
        }
      }
      if (!context) {
        if (type === "html") {
          context = embedHTML.slice(0, maxWebsiteContext)
        } else {
          context = embedPDF
            .map((pdf) => pdf.content)
            .join(" ")
            .slice(0, maxWebsiteContext)
        }

        source = [
          {
            name: embedURL,
            type: type,
            mode: "chat",
            url: embedURL,
            pageContent: context,
            metadata: {
              source: embedURL,
              url: embedURL
            }
          }
        ]
      }

      let humanMessage = await humanMessageFormatter({
        content: [
          {
            text: systemPrompt
              .replace("{context}", context)
              .replace("{question}", query),
            type: "text"
          }
        ],
        model,
        useOCR
      })

      const applicationChatHistory = generateHistory(history, model)

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
      let timetaken = 0
      let apiReasoning = false
      for await (const chunk of chunks) {
        const chunkState = consumeStreamingChunk(
          { fullText, contentToSave, apiReasoning },
          chunk
        )
        fullText = chunkState.fullText
        contentToSave = chunkState.contentToSave
        apiReasoning = chunkState.apiReasoning
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
        selectedModel: model,
        message,
        image,
        fullText,
        source,
        message_source: "copilot",
        generationInfo,
        reasoning_time_taken: timetaken,
        userMessageId: resolvedUserMessageId,
        assistantMessageId: resolvedAssistantMessageId,
        assistantParentMessageId: resolvedAssistantParentMessageId ?? null
      })

      setIsProcessing(false)
      setStreaming(false)
    } catch (e) {
      console.error(e)
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
        selectedModel: model,
        setHistory,
        setHistoryId,
        userMessage: message,
        isRegenerating: isRegenerate,
        message_source: "copilot",
        userMessageId: resolvedUserMessageId,
        assistantMessageId: resolvedAssistantMessageId,
        assistantParentMessageId: resolvedAssistantParentMessageId ?? null
      })

      if (!errorSave) {
        notification.error({
          message: t("error"),
          description: e?.message || t("somethingWentWrong")
        })
      }
      setIsProcessing(false)
      setStreaming(false)
      setIsEmbedding(false)
    } finally {
      setAbortController(null)
      setEmbeddingController(null)
    }
  }

  const visionChatMode = async (
    message: string,
    image: string,
    isRegenerate: boolean,
    messages: Message[],
    history: ChatHistory,
    signal: AbortSignal,
    regenerateFromMessage?: Message
  ) => {
    if (!selectedModel || selectedModel.trim().length === 0) {
      notification.error({
        message: t("error"),
        description: t("validationSelectModel")
      })
      return
    }

    const model = selectedModel.trim()
    setStreaming(true)
    const ollama = await pageAssistModel({ model })

    let newMessage: Message[] = []
    const resolvedAssistantMessageId = generateID()
    const resolvedUserMessageId = !isRegenerate ? generateID() : undefined
    let generateMessageId = resolvedAssistantMessageId
    const createdAt = Date.now()
    const modelInfo = await getModelNicknameByID(model)
    const fallbackParentMessageId = getLastUserMessageId(messages)
    const resolvedAssistantParentMessageId = isRegenerate
      ? regenerateFromMessage?.parentMessageId ?? fallbackParentMessageId
      : resolvedUserMessageId ?? null
    const regenerateVariants =
      isRegenerate && regenerateFromMessage
        ? normalizeMessageVariants(regenerateFromMessage)
        : []

    if (!isRegenerate) {
      newMessage = [
        ...messages,
        {
          isBot: false,
          name: "You",
          message,
          sources: [],
          images: [],
          createdAt,
          id: resolvedUserMessageId,
          parentMessageId: null
        },
        {
          isBot: true,
          name: model,
          message: "▋",
          sources: [],
          createdAt,
          id: generateMessageId,
          modelImage: modelInfo?.model_avatar,
          modelName: modelInfo?.model_name || model,
          parentMessageId: resolvedAssistantParentMessageId ?? null
        }
      ]
    } else {
      newMessage = [
        ...messages,
        {
          isBot: true,
          name: model,
          message: "▋",
          sources: [],
          createdAt,
          id: generateMessageId,
          modelImage: modelInfo?.model_avatar,
          modelName: modelInfo?.model_name || model,
          parentMessageId: resolvedAssistantParentMessageId ?? null
        }
      ]
    }
    setMessages(newMessage)
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

    try {
      const prompt = await systemPromptForNonRag()
      const selectedPrompt = await getPromptById(selectedSystemPrompt)

      const applicationChatHistory = []
      // Inject selected character's system prompt at highest priority
      if (selectedCharacter?.system_prompt) {
        applicationChatHistory.unshift(
          await systemPromptFormatter({ content: selectedCharacter.system_prompt })
        )
      }

      const data = await getScreenshotFromCurrentTab()

      const visionImage = data?.screenshot || ""

      if (visionImage === "") {
        throw new Error(
          data?.error ||
            "Please close and reopen the side panel. This is a bug that will be fixed soon."
        )
      }

      if (!selectedCharacter?.system_prompt && prompt && !selectedPrompt) {
        applicationChatHistory.unshift(
          await systemPromptFormatter({
            content: prompt
          })
        )
      }
      if (!selectedCharacter?.system_prompt && selectedPrompt) {
        const selectedPromptContent =
          selectedPrompt.system_prompt ?? selectedPrompt.content
        applicationChatHistory.unshift(
          await systemPromptFormatter({
            content: selectedPromptContent
          })
        )
      }

      let humanMessage = await humanMessageFormatter({
        content: [
          {
            text: message,
            type: "text"
          },
          {
            image_url: visionImage,
            type: "image_url"
          }
        ],
        model,
        useOCR
      })

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
      let timetaken = 0
      let apiReasoning = false
      for await (const chunk of chunks) {
        const chunkState = consumeStreamingChunk(
          { fullText, contentToSave, apiReasoning },
          chunk
        )
        fullText = chunkState.fullText
        contentToSave = chunkState.contentToSave
        apiReasoning = chunkState.apiReasoning
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
      setMessages((prev) => {
        return prev.map((message) => {
          if (message.id === generateMessageId) {
            return updateActiveVariant(message, {
              message: fullText,
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
          content: message
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
        selectedModel: model,
        message,
        image,
        fullText,
        source: [],
        message_source: "copilot",
        generationInfo,
        reasoning_time_taken: timetaken,
        userMessageId: resolvedUserMessageId,
        assistantMessageId: resolvedAssistantMessageId,
        assistantParentMessageId: resolvedAssistantParentMessageId ?? null
      })

      setIsProcessing(false)
      setStreaming(false)
    } catch (e) {
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
        selectedModel: model,
        setHistory,
        setHistoryId,
        userMessage: message,
        isRegenerating: isRegenerate,
        message_source: "copilot",
        userMessageId: resolvedUserMessageId,
        assistantMessageId: resolvedAssistantMessageId,
        assistantParentMessageId: resolvedAssistantParentMessageId ?? null
      })

      if (!errorSave) {
        notification.error({
          message: t("error"),
          description: e?.message || t("somethingWentWrong")
        })
      }
      setIsProcessing(false)
      setStreaming(false)
      setIsEmbedding(false)
    } finally {
      setAbortController(null)
      setEmbeddingController(null)
    }
  }

  const characterChatMode = async (
    message: string,
    image: string,
    isRegenerate: boolean,
    messages: Message[],
    history: ChatHistory,
    signal: AbortSignal,
    model: string,
    regenerateFromMessage?: Message
  ) => {
    setStreaming(true)
    let fullText = ""
    let contentToSave = ""
    const resolvedAssistantMessageId = generateID()
    const resolvedUserMessageId = !isRegenerate ? generateID() : undefined
    let generateMessageId = resolvedAssistantMessageId
    const fallbackParentMessageId = getLastUserMessageId(messages)
    const resolvedAssistantParentMessageId = isRegenerate
      ? regenerateFromMessage?.parentMessageId ?? fallbackParentMessageId
      : resolvedUserMessageId ?? null
    const regenerateVariants =
      isRegenerate && regenerateFromMessage
        ? normalizeMessageVariants(regenerateFromMessage)
        : []

    if (!selectedCharacter?.id) {
      throw new Error("No character selected")
    }

    try {
      await tldwClient.initialize()

      // Visual placeholder
      const modelInfo = await getModelNicknameByID(model)
      const createdAt = Date.now()
      const assistantStub: Message = {
        isBot: true,
        name: model,
        message: "▋",
        sources: [],
        createdAt,
        id: generateMessageId,
        modelImage: modelInfo?.model_avatar,
        modelName: modelInfo?.model_name || model,
        parentMessageId: resolvedAssistantParentMessageId ?? null
      }
      if (regenerateVariants.length > 0) {
        const variants = [
          ...regenerateVariants,
          buildMessageVariant(assistantStub)
        ]
        assistantStub.variants = variants
        assistantStub.activeVariantIndex = variants.length - 1
      }

      const newMessageList: Message[] = !isRegenerate
        ? [
            ...messages,
            {
              isBot: false,
              name: "You",
              message,
              sources: [],
              images: [],
              createdAt,
              id: resolvedUserMessageId,
              parentMessageId: null
            },
            assistantStub
          ]
        : [...messages, assistantStub]
      setMessages(newMessageList)

      // Ensure server chat session exists
      let chatId = serverChatId
      if (!chatId) {
        type TldwChatMeta =
          | {
              id?: string | number
              chat_id?: string | number
              state?: string
              conversation_state?: string
              topic_label?: string | null
              cluster_id?: string | null
              source?: string | null
              external_ref?: string | null
            }
          | string
          | number
          | null
          | undefined

        const created = (await tldwClient.createChat({
          character_id: selectedCharacter.id,
          state: serverChatState || "in-progress",
          topic_label: serverChatTopic || undefined,
          cluster_id: serverChatClusterId || undefined,
          source: serverChatSource || undefined,
          external_ref: serverChatExternalRef || undefined
        })) as TldwChatMeta

        let rawId: string | number | undefined
        if (created && typeof created === "object") {
          const {
            id,
            chat_id,
            version,
            state,
            conversation_state,
            topic_label,
            cluster_id,
            source,
            external_ref
          } = created as {
            id?: string | number
            chat_id?: string | number
            version?: number
            state?: string | null
            conversation_state?: string | null
            topic_label?: string | null
            cluster_id?: string | null
            source?: string | null
            external_ref?: string | null
          }
          rawId = id ?? chat_id
          const normalizedState = normalizeConversationState(
            state ?? conversation_state ?? null
          )
          setServerChatState(normalizedState)
          setServerChatVersion(typeof version === "number" ? version : null)
          setServerChatTopic(topic_label ?? null)
          setServerChatClusterId(cluster_id ?? null)
          setServerChatSource(source ?? null)
          setServerChatExternalRef(external_ref ?? null)
        } else if (typeof created === "string" || typeof created === "number") {
          rawId = created
        }

        const normalizedId = rawId != null ? String(rawId) : ""
        if (!normalizedId) {
          throw new Error('Failed to create character chat session')
        }
        chatId = normalizedId
        setServerChatId(normalizedId)
        setServerChatTitle(String((created as any)?.title || ""))
        setServerChatCharacterId(
          (created as any)?.character_id ?? selectedCharacter?.id ?? null
        )
        setServerChatMetaLoaded(true)
        invalidateServerChatHistory()
      }

      // Add user message to server (only if not regenerate)
      if (!isRegenerate) {
        type TldwChatMessage = {
          id?: string | number
          version?: number
          role?: string
          content?: string
          image_base64?: string
        }

        const payload: TldwChatMessage = { role: "user", content: message }
        if (image && image.startsWith("data:")) {
          const b64 = image.includes(",") ? image.split(",")[1] : undefined
          if (b64) {
            payload.image_base64 = b64
          }
        }
        const createdUser = (await tldwClient.addChatMessage(
          chatId,
          payload
        )) as TldwChatMessage | null
        setMessages((prev) => {
          const updated = [...prev] as ServerBackedMessage[]
          const serverMessageId =
            createdUser?.id != null ? String(createdUser.id) : undefined
          const serverMessageVersion = createdUser?.version
          for (let i = updated.length - 1; i >= 0; i--) {
            if (!updated[i].isBot) {
              updated[i] = {
                ...updated[i],
                serverMessageId,
                serverMessageVersion
              }
              break
            }
          }
          return updated as Message[]
        })
      }

      // Stream completion from server /chats/{id}/complete-v2
      let count = 0
      let reasoningStartTime: Date | null = null
      let reasoningEndTime: Date | null = null
      let timetaken = 0
      let apiReasoning = false

      const resolvedApiProvider =
        currentChatModelSettings.apiProvider &&
        currentChatModelSettings.apiProvider.trim().length > 0
          ? currentChatModelSettings.apiProvider.trim()
          : undefined

      for await (const chunk of tldwClient.streamCharacterChatCompletion(
        chatId,
        {
          include_character_context: true,
          model,
          provider: resolvedApiProvider,
          save_to_db: false
        },
        { signal }
      )) {
        const chunkState = consumeStreamingChunk(
          { fullText, contentToSave, apiReasoning },
          chunk
        )
        fullText = chunkState.fullText
        contentToSave = chunkState.contentToSave
        apiReasoning = chunkState.apiReasoning

        if (chunkState.token) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === generateMessageId
                ? updateActiveVariant(m, {
                    message: fullText + "▋",
                    reasoning_time_taken: timetaken
                  })
                : m
            )
          )
        }
        if (count === 0) setIsProcessing(true)

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

        count++
        if (signal?.aborted) break
      }
      if (signal?.aborted) {
        const abortError = new Error("AbortError")
        ;(abortError as any).name = "AbortError"
        throw abortError
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === generateMessageId
            ? updateActiveVariant(m, {
                message: fullText,
                reasoning_time_taken: timetaken
              })
            : m
        )
      )

      // Persist assistant reply on server
      try {
        const createdAsst = (await tldwClient.addChatMessage(chatId, {
          role: "assistant",
          content: fullText
        })) as { id?: string | number; version?: number } | null
        setMessages((prev) =>
          ((prev as ServerBackedMessage[]).map((m) => {
            if (m.id !== generateMessageId) return m
            const serverMessageId =
              createdAsst?.id != null ? String(createdAsst.id) : undefined
            return updateActiveVariant(m, {
              serverMessageId,
              serverMessageVersion: createdAsst?.version
            })
          }) as Message[])
        )
      } catch (e) {
        console.error("Failed to persist assistant message to server:", e)
      }

      // Update local history as well (keeps local features consistent)
      setHistory([
        ...history,
        { role: 'user', content: message, image },
        { role: 'assistant', content: fullText }
      ])

      await saveMessageOnSuccess({
        historyId,
        setHistoryId,
        isRegenerate,
        selectedModel: model,
        modelId: model,
        message,
        image,
        fullText,
        source: [],
        message_source: "copilot",
        reasoning_time_taken: timetaken,
        userMessageId: resolvedUserMessageId,
        assistantMessageId: resolvedAssistantMessageId,
        assistantParentMessageId: resolvedAssistantParentMessageId ?? null
      })

      setIsProcessing(false)
      setStreaming(false)
    } catch (e) {
      const assistantContent = buildAssistantErrorContent(fullText, e)
      if (generateMessageId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === generateMessageId
              ? updateActiveVariant(msg, { message: assistantContent })
              : msg
          )
        )
      }
      const errorSave = await saveMessageOnError({
        e,
        botMessage: assistantContent,
        history,
        historyId,
        image,
        selectedModel: model,
        modelId: model,
        setHistory,
        setHistoryId,
        userMessage: message,
        isRegenerating: isRegenerate,
        message_source: "copilot",
        userMessageId: resolvedUserMessageId,
        assistantMessageId: resolvedAssistantMessageId,
        assistantParentMessageId: resolvedAssistantParentMessageId ?? null
      })

      if (!errorSave) {
        notification.error({
          message: t("error"),
          description: e?.message || t("somethingWentWrong")
        })
      }
      setIsProcessing(false)
      setStreaming(false)
    } finally {
      setAbortController(null)
    }
  }

  // Web search mode removed - use tldw_server for search functionality

  const presetChatMode = async (
    message: string,
    image: string,
    isRegenerate: boolean,
    messages: Message[],
    history: ChatHistory,
    signal: AbortSignal,
    messageType: string,
    regenerateFromMessage?: Message
  ) => {
    if (!selectedModel || selectedModel.trim().length === 0) {
      notification.error({
        message: t("error"),
        description: t("validationSelectModel")
      })
      return
    }

    const model = selectedModel.trim()
    setStreaming(true)

    if (image.length > 0) {
      if (!image.startsWith("data:")) {
        const payload = image.includes(",") ? image.split(",")[1] : image
        if (payload && payload.length > 0) {
          image = `data:image/jpeg;base64,${payload}`
        }
      }
    }

    const ollama = await pageAssistModel({ model })

    let newMessage: Message[] = []
    const resolvedAssistantMessageId = generateID()
    const resolvedUserMessageId = !isRegenerate ? generateID() : undefined
    let generateMessageId = resolvedAssistantMessageId
    const createdAt = Date.now()
    const modelInfo = await getModelNicknameByID(model)
    const fallbackParentMessageId = getLastUserMessageId(messages)
    const resolvedAssistantParentMessageId = isRegenerate
      ? regenerateFromMessage?.parentMessageId ?? fallbackParentMessageId
      : resolvedUserMessageId ?? null
    const regenerateVariants =
      isRegenerate && regenerateFromMessage
        ? normalizeMessageVariants(regenerateFromMessage)
        : []

    if (!isRegenerate) {
      newMessage = [
        ...messages,
        {
          isBot: false,
          name: "You",
          message,
          sources: [],
          images: [image],
          createdAt,
          id: resolvedUserMessageId,
          messageType: messageType,
          parentMessageId: null
        },
        {
          isBot: true,
          name: model,
          message: "▋",
          sources: [],
          createdAt,
          id: generateMessageId,
          modelImage: modelInfo?.model_avatar,
          modelName: modelInfo?.model_name || model,
          parentMessageId: resolvedAssistantParentMessageId ?? null
        }
      ]
    } else {
      newMessage = [
        ...messages,
        {
          isBot: true,
          name: model,
          message: "▋",
          sources: [],
          createdAt,
          id: generateMessageId,
          modelImage: modelInfo?.model_avatar,
          modelName: modelInfo?.model_name || model,
          parentMessageId: resolvedAssistantParentMessageId ?? null
        }
      ]
    }
    setMessages(newMessage)
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

    try {
      const prompt = await getPrompt(messageType)
      let humanMessage = await humanMessageFormatter({
        content: [
          {
            text: prompt.replace("{text}", message),
            type: "text"
          }
        ],
        model,
        useOCR
      })
      if (image.length > 0) {
        humanMessage = await humanMessageFormatter({
          content: [
            {
              text: prompt.replace("{text}", message),
              type: "text"
            },
            {
              image_url: image,
              type: "image_url"
            }
          ],
          model,
          useOCR
        })
      }

      let generationInfo: any | undefined = undefined

      const chunks = await ollama.stream([humanMessage], {
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
      })
      let count = 0
      let reasoningStartTime: Date | null = null
      let reasoningEndTime: Date | null = null
      let timetaken = 0
      let apiReasoning = false
      for await (const chunk of chunks) {
        const chunkState = consumeStreamingChunk(
          { fullText, contentToSave, apiReasoning },
          chunk
        )
        fullText = chunkState.fullText
        contentToSave = chunkState.contentToSave
        apiReasoning = chunkState.apiReasoning
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

      setMessages((prev) => {
        return prev.map((message) => {
          if (message.id === generateMessageId) {
            return updateActiveVariant(message, {
              message: fullText,
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
          image,
          messageType
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
        selectedModel: model,
        message,
        image,
        fullText,
        source: [],
        message_source: "copilot",
        message_type: messageType,
        generationInfo,
        reasoning_time_taken: timetaken,
        userMessageId: resolvedUserMessageId,
        assistantMessageId: resolvedAssistantMessageId,
        assistantParentMessageId: resolvedAssistantParentMessageId ?? null
      })

      setIsProcessing(false)
      setStreaming(false)
    } catch (e) {
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
        selectedModel: model,
        setHistory,
        setHistoryId,
        userMessage: message,
        isRegenerating: isRegenerate,
        message_source: "copilot",
        message_type: messageType,
        userMessageId: resolvedUserMessageId,
        assistantMessageId: resolvedAssistantMessageId,
        assistantParentMessageId: resolvedAssistantParentMessageId ?? null
      })

      if (!errorSave) {
        notification.error({
          message: t("error"),
          description: e?.message || t("somethingWentWrong")
        })
      }
      setIsProcessing(false)
      setStreaming(false)
    } finally {
      setAbortController(null)
    }
  }

  const onSubmit = async ({
    message,
    image,
    isRegenerate,
    controller,
    memory,
    messages: chatHistory,
    messageType,
    regenerateFromMessage
  }: {
    message: string
    image: string
    isRegenerate?: boolean
    messages?: Message[]
    memory?: ChatHistory
    controller?: AbortController
    messageType?: string
    regenerateFromMessage?: Message
  }) => {
    if (!validateBeforeSubmit(selectedModel || "", t, notification)) {
      return
    }

    const model = selectedModel.trim()
    let signal: AbortSignal
    if (!controller) {
      const newController = new AbortController()
      signal = newController.signal
      setAbortController(newController)
    } else {
      setAbortController(controller)
      signal = controller.signal
    }
    const replyActive =
      Boolean(replyTarget) &&
      !isRegenerate &&
      !messageType &&
      chatMode === "normal" &&
      !selectedCharacter?.id
    const replyOverrides = replyActive
      ? (() => {
          const userMessageId = generateID()
          const assistantMessageId = generateID()
          return {
            userMessageId,
            assistantMessageId,
            userParentMessageId: replyTarget?.id ?? null,
            assistantParentMessageId: userMessageId
          }
        })()
      : {}

    try {
      // this means that the user is trying to send something from a selected text on the web
      if (messageType) {
        await presetChatMode(
          message,
          image,
          isRegenerate,
          chatHistory || messages,
          memory || history,
          signal,
          messageType,
          regenerateFromMessage
        )
      } else {
        if (chatMode === "normal") {
          if (selectedCharacter?.id) {
            await characterChatMode(
              message,
              image,
              isRegenerate,
              chatHistory || messages,
              memory || history,
              signal,
              model,
              regenerateFromMessage
            )
          } else {
            await normalChatMode(
              message,
              image,
              isRegenerate,
              chatHistory || messages,
              memory || history,
              signal,
              {
                selectedModel: model,
                useOCR,
                selectedSystemPrompt: selectedSystemPrompt ?? "",
                currentChatModelSettings,
                setMessages,
                saveMessageOnSuccess,
                saveMessageOnError,
                setHistory,
                setIsProcessing,
                setStreaming,
                setAbortController,
                historyId,
                setHistoryId: setHistoryId as (id: string) => void,
                webSearch,
                setIsSearchingInternet,
                regenerateFromMessage,
                ...replyOverrides
              }
            )
          }
        } else if (chatMode === "vision") {
          await visionChatMode(
            message,
            image,
            isRegenerate,
            chatHistory || messages,
            memory || history,
            signal,
            regenerateFromMessage
          )
        } else {
          const newEmbeddingController = new AbortController()
          let embeddingSignal = newEmbeddingController.signal
          setEmbeddingController(newEmbeddingController)
          await chatWithWebsiteMode(
            message,
            image,
            isRegenerate,
            chatHistory || messages,
            memory || history,
            signal,
            embeddingSignal,
            regenerateFromMessage
          )
        }
      }
    } finally {
      if (replyActive) {
        clearReplyTarget()
      }
    }
  }

  const stopStreamingRequest = () => {
    if (isEmbedding) {
      if (embeddingController) {
        embeddingController.abort()
        setEmbeddingController(null)
      }
    }
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
  }

  const editMessage = async (
    index: number,
    message: string,
    isHuman: boolean
  ) => {
    const newHistory = history

    if (isHuman) {
      const currentHumanMessage = (messages as ServerBackedMessage[])[index]
      const updatedMessages = messages.map((msg, idx) =>
        idx === index ? { ...msg, message } : msg
      )
      const previousMessages = updatedMessages.slice(0, index + 1)
      setMessages(previousMessages)
      const previousHistory = newHistory.slice(0, index)
      setHistory(previousHistory)
      await updateMessageByIndex(historyId, index, message)
      await deleteChatForEdit(historyId, index)
      // Server-backed edit and cleanup
      if (selectedCharacter?.id && serverChatId) {
        if (currentHumanMessage?.serverMessageId) {
          try {
            const srv = await tldwClient.getMessage(currentHumanMessage.serverMessageId)
            const ver = srv?.version
            if (ver != null) {
              await tldwClient.editMessage(
                currentHumanMessage.serverMessageId,
                message,
                Number(ver),
                serverChatId ?? undefined
              )
            }
          } catch {}
        }
        try {
          const res: any = await tldwClient.listChatMessages(serverChatId, { include_deleted: 'false' })
          const list: any[] = Array.isArray(res) ? res : (res?.messages || [])
          const serverIds = list.map((m: any) => m.id)
          const targetSrvId = currentHumanMessage?.serverMessageId
          const startIdx = targetSrvId ? serverIds.indexOf(targetSrvId) : -1
          if (startIdx >= 0) {
            for (let i = startIdx + 1; i < list.length; i++) {
              const m = list[i]
              try {
                await tldwClient.deleteMessage(
                  m.id,
                  Number(m.version),
                  serverChatId ?? undefined
                )
              } catch {}
            }
          }
        } catch {}
      }
      const abortController = new AbortController()
      await onSubmit({
        message: message,
        image: currentHumanMessage.images[0] || "",
        isRegenerate: true,
        messages: previousMessages,
        memory: previousHistory,
        controller: abortController
      })
    } else {
      // Assistant message edited
      const currentAssistant = (messages as ServerBackedMessage[])[index]
      const updatedMessages = messages.map((msg, idx) =>
        idx === index ? { ...msg, message } : msg
      )
      setMessages(updatedMessages)
      const updatedHistory = newHistory.map((item, idx) =>
        idx === index ? { ...item, content: message } : item
      )
      setHistory(updatedHistory)
      await updateMessageByIndex(historyId, index, message)
      // Server-backed: update assistant server message too
      if (selectedCharacter?.id && currentAssistant?.serverMessageId) {
        try {
          const srv = await tldwClient.getMessage(currentAssistant.serverMessageId)
          const ver = srv?.version
          if (ver != null) {
            await tldwClient.editMessage(
              currentAssistant.serverMessageId,
              message,
              Number(ver),
              serverChatId ?? undefined
            )
          }
        } catch {}
      }
    }
  }

  const deleteMessage = React.useCallback(
    async (index: number) => {
      const target = messages[index]
      if (!target) return

      const targetId = target.serverMessageId ?? target.id
      if (replyTarget?.id && targetId && replyTarget.id === targetId) {
        clearReplyTarget()
      }

      if (target.serverMessageId) {
        await tldwClient.initialize().catch(() => null)
        let expectedVersion = target.serverMessageVersion
        if (expectedVersion == null) {
          const serverMessage = await tldwClient.getMessage(target.serverMessageId)
          expectedVersion = serverMessage?.version
        }
        if (expectedVersion == null) {
          throw new Error("Missing server message version")
        }
        await tldwClient.deleteMessage(
          target.serverMessageId,
          Number(expectedVersion),
          serverChatId ?? undefined
        )
        invalidateServerChatHistory()
      }

      if (historyId) {
        await removeMessageByIndex(historyId, index)
      }

      setMessages(messages.filter((_, idx) => idx !== index))
      setHistory(history.filter((_, idx) => idx !== index))
    },
    [
      clearReplyTarget,
      history,
      historyId,
      invalidateServerChatHistory,
      messages,
      replyTarget?.id,
      serverChatId,
      setHistory,
      setMessages
    ]
  )

  const regenerateLastMessage = async () => {
    if (history.length > 0) {
      const lastMessage = history[history.length - 2]
      let newHistory = history.slice(0, -2)
      const currentMessages = messages as ServerBackedMessage[]
      const lastAssistant = currentMessages[currentMessages.length - 1]
      if (!lastAssistant || !lastAssistant.isBot) {
        return
      }
      const mewMessages = currentMessages.slice(0, -1)
      setHistory(newHistory)
      setMessages(mewMessages)
      if (lastMessage.role === "user") {
        const newController = new AbortController()
        await onSubmit({
          message: lastMessage.content,
          image: lastMessage.image || "",
          isRegenerate: true,
          memory: newHistory,
          controller: newController,
          messageType: lastMessage.messageType,
          regenerateFromMessage: lastAssistant
        })
      }
    }
  }
  const createChatBranch = createBranchMessage({
    historyId,
    setHistory,
    setHistoryId,
    setMessages,
    setSelectedSystemPrompt,
    setSystemPrompt: currentChatModelSettings.setSystemPrompt,
    serverChatId,
    setServerChatId,
    setServerChatTitle,
    setServerChatCharacterId,
    setServerChatMetaLoaded,
    serverChatState,
    setServerChatState,
    setServerChatVersion,
    serverChatTopic,
    setServerChatTopic,
    serverChatClusterId,
    setServerChatClusterId,
    serverChatSource,
    setServerChatSource,
    serverChatExternalRef,
    setServerChatExternalRef,
    onServerChatMutated: invalidateServerChatHistory,
    characterId: selectedCharacter?.id ?? null,
    chatTitle: serverChatTitle ?? null,
    messages,
    history
  })
  return {
    messages,
    setMessages,
    editMessage,
    deleteMessage,
    onSubmit,
    setStreaming,
    streaming,
    setHistory,
    historyId,
    setHistoryId,
    setIsFirstMessage,
    isLoading,
    setIsLoading,
    isProcessing,
    setIsProcessing,
    stopStreamingRequest,
    clearChat,
    selectedModel,
    setSelectedModel,
    chatMode,
    setChatMode,
    isEmbedding,
    setIsEmbedding,
    regenerateLastMessage,
    webSearch,
    setWebSearch,
    isSearchingInternet,
    setIsSearchingInternet,
    selectedQuickPrompt,
    setSelectedQuickPrompt,
    selectedSystemPrompt,
    setSelectedSystemPrompt,
    speechToTextLanguage,
    setSpeechToTextLanguage,
    useOCR,
    setUseOCR,
    defaultInternetSearchOn,
    defaultChatWithWebsite,
    serverChatId,
    setServerChatId,
    serverChatState,
    setServerChatState,
    setServerChatVersion,
    serverChatTopic,
    setServerChatTopic,
    serverChatClusterId,
    setServerChatClusterId,
    serverChatSource,
    setServerChatSource,
    serverChatExternalRef,
    setServerChatExternalRef,
    history,
    createChatBranch,
    temporaryChat,
    setTemporaryChat,
    toolChoice,
    setToolChoice,
    sidepanelTemporaryChat,
    queuedMessages,
    addQueuedMessage,
    setQueuedMessages,
    clearQueuedMessages
  }
}

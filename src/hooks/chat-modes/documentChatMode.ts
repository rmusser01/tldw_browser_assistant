import { cleanUrl } from "~/libs/clean-url"
import { promptForRag } from "~/services/tldw-server"
import { type ChatHistory, type Message, type ToolChoice } from "~/store/option"
import { addFileToSession, generateID, getSessionFiles } from "@/db/dexie/helpers"
import { generateHistory } from "@/utils/generate-history"
import { pageAssistModel } from "@/models"
import { humanMessageFormatter } from "@/utils/human-message"
import {
  isReasoningEnded,
  isReasoningStarted,
  mergeReasoningContent,
  removeReasoning
} from "@/libs/reasoning"
import { getModelNicknameByID } from "@/db/dexie/nickname"
import { formatDocs } from "@/utils/format-docs"
import { getAllDefaultModelSettings } from "@/services/model-settings"
import { getNoOfRetrievedDocs } from "@/services/app"
import { UploadedFile } from "@/db/dexie/types"
// Server-backed RAG replaces local vectorstore
import { getMaxContextSize } from "@/services/kb"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import type { ActorSettings } from "@/types/actor"
import { maybeInjectActorMessage } from "@/utils/actor"
import type { ChatModelSettings } from "@/store/model"
import { extractTokenFromChunk } from "@/utils/extract-token-from-chunk"
import { extractGenerationInfo } from "@/utils/llm-helpers"
import type { SaveMessageData, SaveMessageErrorData } from "@/types/chat-modes"
import { buildAssistantErrorContent } from "@/utils/chat-error-message"
import {
  buildMessageVariant,
  getLastUserMessageId,
  normalizeMessageVariants,
  updateActiveVariant
} from "@/utils/message-variants"

interface RagDocumentMetadata {
  filename?: string
  title?: string
  type?: string
  url?: string
  [key: string]: unknown
}

interface RagDocument {
  content?: string
  text?: string
  chunk?: string
  metadata?: RagDocumentMetadata
}

interface RagResponse {
  results?: RagDocument[]
  documents?: RagDocument[]
  docs?: RagDocument[]
}

export const documentChatMode = async (
  message: string,
  image: string,
  isRegenerate: boolean,
  messages: Message[],
  history: ChatHistory,
  signal: AbortSignal,
  uploadedFiles: UploadedFile[],
  {
    selectedModel,
    useOCR,
    currentChatModelSettings,
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
    fileRetrievalEnabled,
    setActionInfo,
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
    currentChatModelSettings: ChatModelSettings | null
    toolChoice?: ToolChoice
    setMessages: (
      messages: Message[] | ((prev: Message[]) => Message[])
    ) => void
    saveMessageOnSuccess: (data: SaveMessageData) => Promise<string | null>
    saveMessageOnError: (data: SaveMessageErrorData) => Promise<string | null>
    setHistory: (history: ChatHistory) => void
    setIsProcessing: (value: boolean) => void
    setStreaming: (value: boolean) => void
    setAbortController: (controller: AbortController | null) => void
    historyId: string | null
    setHistoryId: (id: string) => void
    fileRetrievalEnabled: boolean
    setActionInfo: (actionInfo: string | null) => void
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
  const userDefaultModelSettings = await getAllDefaultModelSettings()

  let sessionFiles: UploadedFile[] = []
  const currentFiles: UploadedFile[] = uploadedFiles

  if (historyId) {
    sessionFiles = await getSessionFiles(historyId)
  }

  const newFiles = currentFiles.filter(
    (f) => !sessionFiles.some((sf) => sf.id === f.id)
  )

  const allFiles = [...sessionFiles, ...newFiles]
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
          documents: newFiles.map((f) => ({
            type: "file",
            filename: f.filename,
            fileSize: f.size
          })),
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
  let fullText = ""
  let contentToSave = ""

  // No local embedding model; will fall back to inline context for files

  let timetaken = 0
  try {
    let query = message
    const { ragPrompt: systemPrompt, ragQuestionPrompt: questionPrompt } =
      await promptForRag()
    const contextMessages = isRegenerate
      ? messages
      : [
          ...messages,
          {
            isBot: false,
            name: "You",
            message,
            sources: [],
            images: image ? [image] : []
          }
        ]

    let context: string = ""
    let source: any[] = []
    const docSize = await getNoOfRetrievedDocs()

    if (contextMessages.length > 2) {
      const lastTenMessages = contextMessages.slice(-10)
      lastTenMessages.pop()
      const chat_history = lastTenMessages
        .map((message) => {
          return `${message.isBot ? "Assistant: " : "Human: "}${message.message}`
        })
        .join("\n")
      const promptForQuestion = questionPrompt
        .replaceAll("{chat_history}", chat_history)
        .replaceAll("{question}", message)
      const questionMessage = await humanMessageFormatter({
        content: [
          {
            text: promptForQuestion,
            type: "text"
          }
        ],
        model: selectedModel,
        useOCR
      })
      const response = await ollama.invoke([questionMessage])
      query = response.content.toString()
      query = removeReasoning(query)
    }
    // Try server-backed RAG over media_db first
    try {
      const keyword_filter = uploadedFiles.map((f) => f.filename).slice(0, 10)
      if (uploadedFiles.length > 10) {
        setActionInfo("Only the first 10 uploaded files are used for filtering")
      }
      const ragPayload = {
        query,
        sources: ["media_db"],
        search_mode: "hybrid",
        hybrid_alpha: 0.7,
        top_k: docSize,
        min_score: 0,
        enable_reranking: true,
        reranking_strategy: "flashrank",
        rerank_top_k: Math.max(docSize * 2, 10),
        keyword_filter,
        enable_cache: true,
        adaptive_cache: true,
        enable_chunk_citations: true,
        enable_generation: false
      } as const
      const ragRes = (await tldwClient.ragSearch(
        query,
        ragPayload
      )) as RagResponse
      const docs: RagDocument[] =
        ragRes?.results || ragRes?.documents || ragRes?.docs || []
      if (docs.length > 0) {
        context += formatDocs(
          docs.map((d) => ({
            pageContent: d.content || d.text || d.chunk || "",
            metadata: d.metadata || {}
          }))
        )
        source = [
          ...source,
          ...docs.map((d) => ({
            name: d.metadata?.filename || d.metadata?.title || "media",
            type: d.metadata?.type || "media",
            mode: "rag",
            url: d.metadata?.url || "",
            pageContent: d.content || d.text || d.chunk || "",
            metadata: d.metadata || {}
          }))
        ]
      }
    } catch (e) {
      console.error("media_db RAG failed; will fallback to inline context", e)
    }

    // Fallback inline if no RAG context
    if (uploadedFiles.length > 0 && context.length === 0) {
      const maxContextSize = await getMaxContextSize()
      context += allFiles
        .map((f) => `File: ${f.filename}\nContent: ${f.content}\n---\n`)
        .join("")
        .substring(0, maxContextSize)
      source = [
        ...source,
        ...allFiles.map((file) => ({
          pageContent: file.content.substring(0, 200) + "...",
          metadata: {
            source: file.filename,
            type: file.type,
            mode: "rag"
          },
          name: file.filename,
          type: file.type,
          mode: "rag",
          url: ""
        }))
      ]
    }

    if (uploadedFiles.length === 0 && context.length === 0) {
      context += "No documents uploaded for this conversation."
    }

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

    let applicationChatHistory = generateHistory(
      historyForModel ?? history,
      selectedModel
    )

    const templatesActive = false
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
      const token = extractTokenFromChunk(chunk)
      if ((chunk as any)?.additional_kwargs?.reasoning_content) {
        const reasoningContent = mergeReasoningContent(
          fullText,
          (chunk as any)?.additional_kwargs?.reasoning_content || ""
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

    const chatHistoryId = await saveMessageOnSuccess({
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
      documents: uploadedFiles.map((f) => ({
        type: "file",
        filename: f.filename,
        fileSize: f.size,
        processed: f.processed
      }))
    })

    if (chatHistoryId) {
      for (const file of newFiles) {
        await addFileToSession(chatHistoryId, file)
      }
    }

    setIsProcessing(false)
    setStreaming(false)
  } catch (e) {
    console.error(e)
    const assistantContent = buildAssistantErrorContent(fullText, e)
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === generateMessageId ? { ...msg, message: assistantContent } : msg
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
      assistantParentMessageId: assistantParentMessageId ?? null
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

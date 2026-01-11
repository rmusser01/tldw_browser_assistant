import { promptForRag } from "~/services/tldw-server" // Reuse prompts storage for now
import { type ChatHistory, type Message, type ToolChoice } from "~/store/option"
import { generateHistory } from "@/utils/generate-history"
import { pageAssistModel } from "@/models"
import { humanMessageFormatter } from "@/utils/human-message"
import { removeReasoning } from "@/libs/reasoning"
import { formatDocs } from "@/utils/format-docs"
import { getNoOfRetrievedDocs } from "@/services/app"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import type { ActorSettings } from "@/types/actor"
import { maybeInjectActorMessage } from "@/utils/actor"
import type { SaveMessageData, SaveMessageErrorData } from "@/types/chat-modes"
import {
  runChatPipeline,
  type ChatModeDefinition
} from "./chatModePipeline"

const RAG_ADVANCED_OPTION_KEYS = new Set([
  "strategy",
  "enable_reranking",
  "enable_cache",
  "top_k",
  "search_mode",
  "enable_generation",
  "enable_citations",
  "sources",
  "filters",
  "rerank_top_k",
  "include_media_ids",
  "timeoutMs",
  "citation_style"
])

const sanitizeRagAdvancedOptions = (options?: Record<string, unknown>) => {
  if (!options) return {}
  const sanitized: Record<string, unknown> = {}
  const ignored: string[] = []
  for (const [key, value] of Object.entries(options)) {
    if (!RAG_ADVANCED_OPTION_KEYS.has(key)) {
      ignored.push(key)
      continue
    }
    if (value === undefined || value === null) continue
    if (typeof value === "string" && value.trim() === "") continue
    sanitized[key] = value
  }
  if (ignored.length > 0) {
    console.debug(
      "[ragMode] Ignoring unsupported ragAdvancedOptions keys:",
      ignored
    )
  }
  return sanitized
}

type RagModeParams = {
  selectedModel: string
  useOCR: boolean
  selectedKnowledge: any
  currentChatModelSettings: any
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
  ragMediaIds: number[] | null
  ragSearchMode: "hybrid" | "vector" | "fts"
  ragTopK: number | null
  ragEnableGeneration: boolean
  ragEnableCitations: boolean
  ragSources: string[]
  ragAdvancedOptions?: Record<string, unknown>
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

const ragModeDefinition: ChatModeDefinition<RagModeParams> = {
  id: "rag",
  buildUserMessage: (ctx) => ({
    isBot: false,
    name: "You",
    message: ctx.message,
    sources: [],
    images: [],
    createdAt: ctx.createdAt,
    id: ctx.resolvedUserMessageId,
    messageType: ctx.userMessageType,
    clusterId: ctx.clusterId,
    modelId: ctx.userModelId,
    parentMessageId: ctx.userParentMessageId ?? null
  }),
  buildAssistantMessage: (ctx) => ({
    isBot: true,
    name: ctx.selectedModel,
    message: "▋",
    sources: [],
    createdAt: ctx.createdAt,
    id: ctx.resolvedAssistantMessageId,
    modelImage: ctx.modelInfo?.model_avatar,
    modelName: ctx.modelInfo?.model_name || ctx.selectedModel,
    messageType: ctx.assistantMessageType,
    clusterId: ctx.clusterId,
    modelId: ctx.resolvedModelId,
    parentMessageId: ctx.resolvedAssistantParentMessageId ?? null
  }),
  preparePrompt: async (ctx) => {
    let query = ctx.message
    const { ragPrompt: systemPrompt, ragQuestionPrompt: questionPrompt } =
      await promptForRag()
    const contextMessages = ctx.isRegenerate
      ? ctx.messages
      : [
          ...ctx.messages,
          {
            isBot: false,
            name: "You",
            message: ctx.message,
            sources: [],
            images: []
          }
        ]

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
        .replaceAll("{question}", ctx.message)
      const questionOllama = await pageAssistModel({
        model: ctx.selectedModel,
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
        model: ctx.selectedModel,
        useOCR: ctx.useOCR
      })
      const response = await questionOllama.invoke([questionMessage])
      query = response.content.toString()
      query = removeReasoning(query)
    }

    const defaultTopK = await getNoOfRetrievedDocs()
    let context = ""
    let source: any[] = []
    try {
      await tldwClient.initialize()
      const top_k =
        typeof ctx.ragTopK === "number" && ctx.ragTopK > 0
          ? ctx.ragTopK
          : defaultTopK
      const ragOptions: Record<string, unknown> = sanitizeRagAdvancedOptions(
        ctx.ragAdvancedOptions
      )
      // Precedence: ctx.ragTopK overrides ragOptions.top_k; defaultTopK applies only
      // when neither is set. ctx.ragSearchMode always overrides ragOptions.search_mode.
      // ctx.ragEnableGeneration/citations control presence of their flags, even if set.
      if (typeof ctx.ragTopK === "number" && ctx.ragTopK > 0) {
        ragOptions.top_k = ctx.ragTopK
      } else if (
        ragOptions.top_k == null ||
        typeof ragOptions.top_k !== "number" ||
        ragOptions.top_k <= 0
      ) {
        ragOptions.top_k = top_k
      }
      ragOptions.search_mode = ctx.ragSearchMode
      if (ctx.ragEnableGeneration) {
        ragOptions.enable_generation = true
      } else {
        delete ragOptions.enable_generation
      }
      if (ctx.ragEnableCitations) {
        ragOptions.enable_citations = true
      } else {
        delete ragOptions.enable_citations
      }
      // Precedence: ctx.ragSources overrides ragAdvancedOptions.sources; ctx.ragMediaIds
      // overrides include_media_ids and forces sources to ["media_db"].
      if (Array.isArray(ctx.ragSources) && ctx.ragSources.length > 0) {
        ragOptions.sources = ctx.ragSources
      }
      if (Array.isArray(ctx.ragMediaIds) && ctx.ragMediaIds.length > 0) {
        ragOptions.include_media_ids = ctx.ragMediaIds
        // When a specific media list is provided, ensure we query the media DB
        ragOptions.sources = ["media_db"]
      }
      const ragRes = await tldwClient.ragSearch(query, ragOptions)
      const docs = ragRes?.results || ragRes?.documents || ragRes?.docs || []
      context = formatDocs(
        docs.map((doc: any) => ({
          pageContent: doc.content || doc.text || doc.chunk || "",
          metadata: doc.metadata || {}
        }))
      )
      source = docs.map((doc: any) => ({
        name: doc.metadata?.source || doc.metadata?.title || "untitled",
        type: doc.metadata?.type || "unknown",
        mode: "rag",
        url: doc.metadata?.url || "",
        pageContent: doc.content || doc.text || doc.chunk || "",
        metadata: doc.metadata || {}
      }))
    } catch (e) {
      console.error("tldw ragSearch failed, continuing without context", e)
      context = ""
      source = []
    }

    const humanMessage = await humanMessageFormatter({
      content: [
        {
          text: systemPrompt
            .replace("{context}", context)
            .replace("{question}", ctx.message),
          type: "text"
        }
      ],
      model: ctx.selectedModel,
      useOCR: ctx.useOCR
    })

    let applicationChatHistory = generateHistory(
      ctx.historyForModel ?? ctx.history,
      ctx.selectedModel
    )

    const templatesActive = false
    applicationChatHistory = await maybeInjectActorMessage(
      applicationChatHistory,
      ctx.actorSettings || null,
      templatesActive
    )

    return {
      chatHistory: applicationChatHistory,
      humanMessage,
      sources: source
    }
  }
}

export const ragMode = async (
  message: string,
  image: string,
  isRegenerate: boolean,
  messages: Message[],
  history: ChatHistory,
  signal: AbortSignal,
  params: RagModeParams
) => {
  console.log("Using ragMode")
  await runChatPipeline(
    ragModeDefinition,
    message,
    image,
    isRegenerate,
    messages,
    history,
    signal,
    params
  )
}

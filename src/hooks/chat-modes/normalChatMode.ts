import { systemPromptForNonRagOption } from "~/services/tldw-server"
import { type ChatHistory, type Message, type ToolChoice } from "~/store/option"
import { getPromptById } from "@/db/dexie/helpers"
import { generateHistory } from "@/utils/generate-history"
import { humanMessageFormatter } from "@/utils/human-message"
import { systemPromptFormatter } from "@/utils/system-message"
import type { ActorSettings } from "@/types/actor"
import { maybeInjectActorMessage } from "@/utils/actor"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { getSearchSettings } from "@/services/search"
import type { SaveMessageData, SaveMessageErrorData } from "@/types/chat-modes"
import {
  runChatPipeline,
  type ChatModeDefinition
} from "./chatModePipeline"

interface WebSearchPayload {
  query: string
  aggregate: boolean
  engine?: string
  result_count?: number
}

type NormalChatModeParams = {
  selectedModel: string
  useOCR: boolean
  selectedSystemPrompt: string
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
  uploadedFiles?: any[]
  actorSettings?: ActorSettings
  webSearch?: boolean
  setIsSearchingInternet?: (value: boolean) => void
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

const normalChatModeDefinition: ChatModeDefinition<NormalChatModeParams> = {
  id: "normal",
  buildUserMessage: (ctx) => ({
    isBot: false,
    name: "You",
    message: ctx.message,
    sources: [],
    images: ctx.image ? [ctx.image] : [],
    createdAt: ctx.createdAt,
    id: ctx.resolvedUserMessageId,
    modelImage: ctx.modelInfo?.model_avatar,
    modelName: ctx.modelInfo?.model_name || ctx.selectedModel,
    documents:
      ctx.uploadedFiles?.map((file) => ({
        type: "file",
        filename: file.filename,
        fileSize: file.size,
        processed: file.processed
      })) || [],
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
  preflight: async (ctx) => {
    if (!ctx.webSearch) {
      return null
    }

    ctx.setIsProcessing(true)
    if (ctx.setIsSearchingInternet) {
      ctx.setIsSearchingInternet(true)
    }

    try {
      await tldwClient.initialize()
      const { searchProvider, totalSearchResults } = await getSearchSettings()

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
        query: ctx.message,
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
        signal: ctx.signal
      })

      if (res?.error) {
        throw new Error(
          typeof res.error === "string"
            ? res.error
            : res.error?.message || "Web search failed"
        )
      }

      const answer =
        (res?.final_answer?.text && String(res.final_answer.text)) || ""

      const fullText =
        answer && answer.trim().length > 0
          ? answer
          : "No web search results were returned."

      return {
        handled: true,
        fullText,
        sources: []
      }
    } finally {
      if (ctx.setIsSearchingInternet) {
        ctx.setIsSearchingInternet(false)
      }
    }
  },
  preparePrompt: async (ctx) => {
    const prompt = await systemPromptForNonRagOption()
    const selectedPrompt = await getPromptById(ctx.selectedSystemPrompt)
    const promptId = ctx.selectedSystemPrompt
    let promptContent: string | undefined = undefined

    let humanMessage = await humanMessageFormatter({
      content: [
        {
          text: ctx.message,
          type: "text"
        }
      ],
      model: ctx.selectedModel,
      useOCR: ctx.useOCR
    })
    if (ctx.image.length > 0) {
      humanMessage = await humanMessageFormatter({
        content: [
          {
            text: ctx.message,
            type: "text"
          },
          {
            image_url: ctx.image,
            type: "image_url"
          }
        ],
        model: ctx.selectedModel,
        useOCR: ctx.useOCR
      })
    }

    let applicationChatHistory = generateHistory(
      ctx.historyForModel ?? ctx.history,
      ctx.selectedModel
    )

    if (prompt && !selectedPrompt) {
      applicationChatHistory.unshift(
        await systemPromptFormatter({
          content: prompt
        })
      )
    }

    const isTempSystemprompt =
      ctx.currentChatModelSettings.systemPrompt &&
      ctx.currentChatModelSettings.systemPrompt?.trim().length > 0

    if (!isTempSystemprompt && selectedPrompt) {
      const selectedPromptContent =
        selectedPrompt.system_prompt ?? selectedPrompt.content
      applicationChatHistory.unshift(
        await systemPromptFormatter({
          content: selectedPromptContent
        })
      )
      promptContent = selectedPromptContent
    }

    if (isTempSystemprompt) {
      applicationChatHistory.unshift(
        await systemPromptFormatter({
          content: ctx.currentChatModelSettings.systemPrompt
        })
      )
      promptContent = ctx.currentChatModelSettings.systemPrompt
    }

    const templatesActive = !!ctx.selectedSystemPrompt
    applicationChatHistory = await maybeInjectActorMessage(
      applicationChatHistory,
      ctx.actorSettings || null,
      templatesActive
    )

    return {
      chatHistory: applicationChatHistory,
      humanMessage,
      sources: [],
      promptId,
      promptContent
    }
  }
}

export const normalChatMode = async (
  message: string,
  image: string,
  isRegenerate: boolean,
  messages: Message[],
  history: ChatHistory,
  signal: AbortSignal,
  params: NormalChatModeParams
) => {
  console.log("Using normalChatMode")
  const resolvedImage =
    image.length > 0 ? `data:image/jpeg;base64,${image.split(",")[1]}` : ""

  await runChatPipeline(
    normalChatModeDefinition,
    message,
    resolvedImage,
    isRegenerate,
    messages,
    history,
    signal,
    params
  )
}

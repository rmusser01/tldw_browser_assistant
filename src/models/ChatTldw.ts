import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage
} from "@/types/messages"
import {
  tldwChat,
  ChatMessage,
  type ChatCompletionContentPart
} from "@/services/tldw"

export interface ChatTldwOptions {
  model: string
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  systemPrompt?: string
  streaming?: boolean
  reasoningEffort?: "low" | "medium" | "high"
  toolChoice?: "auto" | "none" | "required"
  tools?: Record<string, unknown>[]
  supportsMultimodal?: boolean
  saveToDb?: boolean
  conversationId?: string
  historyMessageLimit?: number
  historyMessageOrder?: string
  slashCommandInjectionMode?: string
  apiProvider?: string
  extraHeaders?: Record<string, unknown>
  extraBody?: Record<string, unknown>
}

export class ChatTldw {
  model: string
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  systemPrompt?: string
  streaming: boolean
  reasoningEffort?: "low" | "medium" | "high"
  toolChoice?: "auto" | "none" | "required"
  tools?: Record<string, unknown>[]
  supportsMultimodal: boolean
  saveToDb?: boolean
  conversationId?: string
  historyMessageLimit?: number
  historyMessageOrder?: string
  slashCommandInjectionMode?: string
  apiProvider?: string
  extraHeaders?: Record<string, unknown>
  extraBody?: Record<string, unknown>

  constructor(options: ChatTldwOptions) {
    // Normalize model id: drop internal prefix like "tldw:" so server receives provider/model
    this.model = String(options.model || '').replace(/^tldw:/, '')
    this.temperature = options.temperature ?? 0.7
    this.maxTokens = options.maxTokens
    this.topP = options.topP ?? 1
    this.frequencyPenalty = options.frequencyPenalty ?? 0
    this.presencePenalty = options.presencePenalty ?? 0
    this.systemPrompt = options.systemPrompt
    this.streaming = options.streaming ?? false
    this.reasoningEffort = options.reasoningEffort
    this.toolChoice = options.toolChoice
    this.tools = options.tools
    this.supportsMultimodal = Boolean(options.supportsMultimodal)
    this.saveToDb = options.saveToDb
    this.conversationId = options.conversationId
    this.historyMessageLimit = options.historyMessageLimit
    this.historyMessageOrder = options.historyMessageOrder
    this.slashCommandInjectionMode = options.slashCommandInjectionMode
    this.apiProvider = options.apiProvider
    this.extraHeaders = options.extraHeaders
    this.extraBody = options.extraBody
  }

  /**
   * Streaming API used by existing chat modes.
   *
   * This intentionally mirrors the previous `ollama.stream(...)` contract:
   * - yields plain string tokens
   * - optionally calls `callbacks[i].handleLLMEnd(result)` once at the end
   */
  async stream(
    messages: BaseMessage[],
    options?: {
      signal?: AbortSignal
      // Matches the shape used in normalChatMode/search/rag, where
      // callbacks: [{ handleLLMEnd(output) { ... } }]
      callbacks?: Array<{ handleLLMEnd?: (output: any) => any }>
    }
  ): Promise<AsyncGenerator<any, void, unknown>> {
    const { signal, callbacks } = options || {}

    const tldwMessages = this.convertToTldwMessages(messages)
      const stream = tldwChat.streamMessage(tldwMessages, {
        model: this.model,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        topP: this.topP,
        frequencyPenalty: this.frequencyPenalty,
        presencePenalty: this.presencePenalty,
        systemPrompt: this.systemPrompt,
        stream: true,
        reasoningEffort: this.reasoningEffort,
        toolChoice: this.toolChoice,
        tools: this.tools,
        saveToDb: this.saveToDb,
        conversationId: this.conversationId,
        historyMessageLimit: this.historyMessageLimit,
        historyMessageOrder: this.historyMessageOrder,
        slashCommandInjectionMode: this.slashCommandInjectionMode,
        apiProvider: this.apiProvider,
        extraHeaders: this.extraHeaders,
        extraBody: this.extraBody
      })

    async function* generator() {
      let fullText = ""
      try {
        for await (const token of stream) {
          if (signal?.aborted) {
            break
          }
          if (typeof token !== "string") continue
          fullText += token
          // Downstream chat-modes treat chunks as strings or objects with
          // `content` / `choices[0].delta.content`. Yielding the plain
          // string keeps the simple path working (`typeof chunk === 'string'`).
          yield token
        }
      } finally {
        // Synthesize a minimal LangChain-style result for handleLLMEnd
        if (callbacks && callbacks.length > 0) {
          const result = {
            generations: [[{ text: fullText, generationInfo: undefined }]]
          }
          for (const cb of callbacks) {
            try {
              await cb?.handleLLMEnd?.(result)
            } catch {
              // Ignore callback errors to avoid breaking chat flow
            }
          }
        }
      }
    }

    return generator()
  }

  // Non-streaming helper mirroring the LangChain-style _generate,
  // used only internally if needed.
  async generateOnce(
    messages: BaseMessage[]
  ): Promise<{ text: string; message: AIMessage }> {
    const tldwMessages = this.convertToTldwMessages(messages)
    
    const response = await tldwChat.sendMessage(tldwMessages, {
      model: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      topP: this.topP,
      frequencyPenalty: this.frequencyPenalty,
      presencePenalty: this.presencePenalty,
      systemPrompt: this.systemPrompt,
      stream: false,
      reasoningEffort: this.reasoningEffort,
      toolChoice: this.toolChoice,
      tools: this.tools,
      saveToDb: this.saveToDb,
      conversationId: this.conversationId,
      historyMessageLimit: this.historyMessageLimit,
      historyMessageOrder: this.historyMessageOrder,
      slashCommandInjectionMode: this.slashCommandInjectionMode,
      apiProvider: this.apiProvider,
      extraHeaders: this.extraHeaders,
      extraBody: this.extraBody
    })

    return {
      text: response,
      message: new AIMessage(response)
    }
  }

  // We don't rely on BaseChatModel's default stream helper in the current
  // chat pipeline; see the custom `stream` implementation above which
  // matches the expected `ollama.stream` contract.

  /**
   * Non-streaming invoke helper to match the simple `.invoke()` shape used
   * by title generation and other one-off calls.
   */
  async invoke(messages: BaseMessage[]): Promise<{ content: string }> {
    const { text } = await this.generateOnce(messages)
    return { content: text }
  }

  private normalizeImageUrl(
    value: unknown
  ): { url: string; detail?: "auto" | "low" | "high" | null } | null {
    if (typeof value === "string") {
      return { url: value }
    }
    if (value && typeof value === "object") {
      const candidate = value as { url?: unknown; detail?: unknown }
      if (typeof candidate.url === "string") {
        let detail: "auto" | "low" | "high" | null | undefined
        if (
          candidate.detail === "auto" ||
          candidate.detail === "low" ||
          candidate.detail === "high" ||
          candidate.detail === null
        ) {
          detail = candidate.detail as "auto" | "low" | "high" | null
        }
        return detail === undefined
          ? { url: candidate.url }
          : { url: candidate.url, detail }
      }
    }
    return null
  }

  private normalizeContentPart(
    part: unknown
  ): ChatCompletionContentPart | null {
    if (typeof part === "string") {
      return { type: "text", text: part }
    }
    if (!part || typeof part !== "object") {
      return null
    }
    const candidate = part as { type?: unknown; text?: unknown; image_url?: unknown }
    if (candidate.type === "text" && typeof candidate.text === "string") {
      return { type: "text", text: candidate.text }
    }
    if (candidate.type === "image_url") {
      const imageUrl = this.normalizeImageUrl(candidate.image_url)
      if (!imageUrl) return null
      return { type: "image_url", image_url: imageUrl }
    }
    return null
  }

  private coerceTextContent(content: unknown): string {
    if (typeof content === "string") {
      return content
    }
    if (!Array.isArray(content)) {
      return ""
    }
    return content
      .map((item) => {
        if (typeof item === "string") return item
        if (item && typeof item === "object") {
          const candidate = item as { type?: unknown; text?: unknown }
          if (candidate.type === "text" && typeof candidate.text === "string") {
            return candidate.text
          }
        }
        return ""
      })
      .filter(Boolean)
      .join(" ")
  }

  private normalizeUserContent(content: unknown): string | ChatCompletionContentPart[] {
    if (typeof content === "string") {
      return content
    }
    if (!Array.isArray(content)) {
      return ""
    }
    const parts = content
      .map((item) => this.normalizeContentPart(item))
      .filter(Boolean) as ChatCompletionContentPart[]
    if (parts.length === 0) {
      return ""
    }
    const hasImage = parts.some((part) => part.type === "image_url")
    if (!hasImage) {
      return this.coerceTextContent(content)
    }
    return parts
  }

  private convertToTldwMessages(messages: BaseMessage[]): ChatMessage[] {
    return messages.map((msg) => {
      if (msg instanceof SystemMessage) {
        return {
          role: "system",
          content: this.coerceTextContent(msg.content)
        }
      }
      if (msg instanceof ToolMessage) {
        return {
          role: "tool",
          content: this.coerceTextContent(msg.content),
          tool_call_id: msg.tool_call_id
        }
      }
      if (msg instanceof AIMessage) {
        return {
          role: "assistant",
          content: this.coerceTextContent(msg.content)
        }
      }
      if (msg instanceof HumanMessage) {
        return {
          role: "user",
          content: this.supportsMultimodal
            ? this.normalizeUserContent(msg.content)
            : this.coerceTextContent(msg.content)
        }
      }

      return {
        role: "user",
        content: this.coerceTextContent(msg.content)
      }
    })
  }

  // Method to check if tldw is available
  static async isAvailable(): Promise<boolean> {
    try {
      return await tldwChat.isReady()
    } catch {
      return false
    }
  }

  // Method to cancel the current stream
  cancelStream(): void {
    tldwChat.cancelStream()
  }
}

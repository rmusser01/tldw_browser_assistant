import { tldwClient, ChatMessage, ChatCompletionRequest } from "./TldwApiClient"
import { extractTokenFromChunk } from "@/utils/extract-token-from-chunk"

type ToolFunctionSchema = Record<string, unknown>
type ToolFunction = {
  name: string
  description?: string
  parameters?: ToolFunctionSchema
}
type OpenAiTool = {
  type: "function"
  function: ToolFunction
}

const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/

const normalizeProvider = (value?: string): string =>
  String(value || "").trim().toLowerCase()

const shouldUseTextParts = (provider?: string, model?: string): boolean => {
  const normalized = normalizeProvider(provider)
  if (normalized) return normalized === "google" || normalized === "gemini"
  const normalizedModel = String(model || "").toLowerCase()
  return normalizedModel.includes("gemini")
}

const normalizeMessagesForProvider = (
  messages: ChatMessage[],
  provider?: string,
  model?: string
): ChatMessage[] => {
  if (!shouldUseTextParts(provider, model)) return messages
  return messages.map((msg) => {
    if (msg.role !== "user") return msg
    if (typeof msg.content === "string") {
      return {
        ...msg,
        content: [{ type: "text", text: msg.content }]
      }
    }
    return msg
  })
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const sanitizeToolName = (name: string): string | null => {
  const trimmed = name.trim()
  if (!trimmed) return null
  if (TOOL_NAME_PATTERN.test(trimmed)) return trimmed

  let sanitized = trimmed.replace(/[^a-zA-Z0-9_-]+/g, "_")
  sanitized = sanitized.replace(/^_+|_+$/g, "")
  if (!sanitized) return null
  if (sanitized.length > 64) sanitized = sanitized.slice(0, 64)
  return TOOL_NAME_PATTERN.test(sanitized) ? sanitized : null
}

const normalizeChatTools = (
  tools?: Record<string, unknown>[]
): Record<string, unknown>[] | undefined => {
  if (!Array.isArray(tools) || tools.length === 0) return undefined

  const seen = new Set<string>()
  const normalized = tools
    .map((tool) => {
      if (!isRecord(tool)) return null

      const functionRecord = isRecord(tool.function) ? tool.function : undefined
      const rawName =
        (typeof tool.name === "string" && tool.name) ||
        (functionRecord &&
        typeof functionRecord.name === "string" &&
        functionRecord.name
          ? functionRecord.name
          : "")
      const name = rawName ? sanitizeToolName(rawName) : null
      if (!name || seen.has(name)) return null

      if (rawName !== name) {
        console.warn(
          `[tldw] Tool name "${rawName}" normalized to "${name}" to satisfy server schema.`
        )
      }
      seen.add(name)

      const description =
        typeof tool.description === "string"
          ? tool.description
          : functionRecord &&
              typeof functionRecord.description === "string"
            ? functionRecord.description
            : undefined

      const schemaCandidates: Array<unknown> = [
        functionRecord?.parameters,
        tool.parameters,
        tool.input_schema,
        tool.json_schema
      ]
      const parameters =
        (schemaCandidates.find((candidate) =>
          isRecord(candidate)
        ) as ToolFunctionSchema | undefined) || {
          type: "object",
          properties: {}
        }

      return {
        type: "function",
        function: {
          name,
          description,
          parameters
        }
      } as OpenAiTool
    })
    .filter(Boolean) as Record<string, unknown>[]

  return normalized.length > 0 ? normalized : undefined
}

export interface TldwChatOptions {
  model: string
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stream?: boolean
  systemPrompt?: string
  reasoningEffort?: "low" | "medium" | "high"
  toolChoice?: "auto" | "none" | "required"
  tools?: Record<string, unknown>[]
  saveToDb?: boolean
  conversationId?: string
  historyMessageLimit?: number
  historyMessageOrder?: string
  slashCommandInjectionMode?: string
  apiProvider?: string
  extraHeaders?: Record<string, unknown>
  extraBody?: Record<string, unknown>
  jsonMode?: boolean
}

export interface ChatStreamChunk {
  id?: string
  object?: string
  created?: number
  model?: string
  choices?: Array<{
    index: number
    delta: {
      role?: string
      content?: string
    }
    finish_reason?: string | null
  }>
}

export class TldwChatService {
  private currentController: AbortController | null = null

  /**
   * Send a chat completion request
   */
  async sendMessage(
    messages: ChatMessage[],
    options: TldwChatOptions
  ): Promise<string> {
    try {
      await tldwClient.initialize()
      const normalizedTools = normalizeChatTools(options.tools)
      const toolChoice = normalizedTools ? options.toolChoice : undefined

      const request: ChatCompletionRequest = {
        messages: normalizeMessagesForProvider(
          messages,
          options.apiProvider,
          options.model
        ),
        model: options.model,
        stream: false,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        reasoning_effort: options.reasoningEffort,
        tool_choice: toolChoice,
        tools: normalizedTools,
        save_to_db: options.saveToDb,
        conversation_id: options.conversationId,
        history_message_limit: options.historyMessageLimit,
        history_message_order: options.historyMessageOrder,
        slash_command_injection_mode: options.slashCommandInjectionMode,
        api_provider: options.apiProvider,
        extra_headers: options.extraHeaders,
        extra_body: options.extraBody,
        response_format: options.jsonMode ? { type: "json_object" } : undefined
      }

      // Add system prompt if provided
      if (options.systemPrompt && messages[0]?.role !== 'system') {
        request.messages = [
          { role: 'system', content: options.systemPrompt },
          ...messages
        ]
      }

      const response = await tldwClient.createChatCompletion(request)
      const data = await response.json().catch(() => null)
      const content = data?.choices?.[0]?.message?.content || data?.content || data?.text
      if (typeof content === 'string') {
        return content
      }
      throw new Error('Invalid response format from tldw server')
    } catch (error) {
      console.error('Chat completion failed:', error)
      throw error
    }
  }

  /**
   * Send a streaming chat completion request
   */
  async *streamMessage(
    messages: ChatMessage[],
    options: TldwChatOptions,
    onChunk?: (chunk: ChatStreamChunk) => void
  ): AsyncGenerator<string, void, unknown> {
    try {
      await tldwClient.initialize()
      const normalizedTools = normalizeChatTools(options.tools)
      const toolChoice = normalizedTools ? options.toolChoice : undefined

      // Cancel any existing stream
      this.cancelStream()

      // Create new abort controller
      this.currentController = new AbortController()

      const request: ChatCompletionRequest = {
        messages: normalizeMessagesForProvider(
          messages,
          options.apiProvider,
          options.model
        ),
        model: options.model,
        stream: true,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        reasoning_effort: options.reasoningEffort,
        tool_choice: toolChoice,
        tools: normalizedTools,
        save_to_db: options.saveToDb,
        conversation_id: options.conversationId,
        history_message_limit: options.historyMessageLimit,
        history_message_order: options.historyMessageOrder,
        slash_command_injection_mode: options.slashCommandInjectionMode,
        api_provider: options.apiProvider,
        extra_headers: options.extraHeaders,
        extra_body: options.extraBody,
        response_format: options.jsonMode ? { type: "json_object" } : undefined
      }

      // Add system prompt if provided
      if (options.systemPrompt && messages[0]?.role !== 'system') {
        request.messages = [
          { role: 'system', content: options.systemPrompt },
          ...messages
        ]
      }

      const stream = tldwClient.streamChatCompletion(request, { signal: this.currentController.signal })

      for await (const chunk of stream) {
        // Check if stream was cancelled
        if (this.currentController?.signal.aborted) {
          break
        }

        // Call the onChunk callback if provided
        if (onChunk) {
          onChunk(chunk)
        }

        const token = extractTokenFromChunk(chunk)
        if (token) {
          yield token
        }
      }
    } catch (error) {
      console.error('Stream completion failed:', error)
      throw error
    } finally {
      this.currentController = null
    }
  }

  /**
   * Cancel the current streaming request
   */
  cancelStream(): void {
    if (this.currentController) {
      this.currentController.abort()
      this.currentController = null
    }
  }

  /**
   * Create a conversation with context
   */
  buildConversation(
    history: ChatMessage[],
    newMessage: string,
    systemPrompt?: string
  ): ChatMessage[] {
    const messages: ChatMessage[] = []

    // Add system prompt if provided
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }

    // Add history
    messages.push(...history)

    // Add new user message
    messages.push({ role: 'user', content: newMessage })

    return messages
  }

  /**
   * Format a response for display
   */
  formatResponse(content: string): string {
    // Basic formatting - can be enhanced
    return content.trim()
  }

  /**
   * Check if the service is ready
   */
  async isReady(): Promise<boolean> {
    try {
      await tldwClient.initialize()
      return await tldwClient.healthCheck()
    } catch {
      return false
    }
  }

  /**
   * Get token estimate for messages
   * This is a rough estimate - actual tokens depend on the model
   */
  estimateTokens(messages: ChatMessage[]): number {
    let totalChars = 0
    for (const msg of messages) {
      const content = msg.content
      if (typeof content === "string") {
        totalChars += content.length
      } else if (Array.isArray(content)) {
        // Roughly approximate by concatenating any text fields
        const text = content
          .map((part: any) => {
            if (typeof part === "string") return part
            if (part?.type === "text" && typeof part.text === "string") {
              return part.text
            }
            return ""
          })
          .join(" ")
        totalChars += text.length
      } else if (content != null) {
        try {
          totalChars += JSON.stringify(content).length
        } catch {
          // Fallback if serialization fails
        }
      }
    }
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(totalChars / 4)
  }

  /**
   * Truncate messages to fit within token limit
   */
  truncateMessages(
    messages: ChatMessage[],
    maxTokens: number,
    keepSystemPrompt: boolean = true
  ): ChatMessage[] {
    const result: ChatMessage[] = []
    let currentTokens = 0

    // Keep system prompt if requested
    if (keepSystemPrompt && messages[0]?.role === 'system') {
      result.push(messages[0])
      currentTokens += this.estimateTokens([messages[0]])
    }

    // Add messages from the end (most recent first)
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      
      // Skip system prompt if already added
      if (msg.role === 'system' && result.length > 0 && result[0].role === 'system') {
        continue
      }

      const msgTokens = this.estimateTokens([msg])
      if (currentTokens + msgTokens <= maxTokens) {
        result.splice(keepSystemPrompt ? 1 : 0, 0, msg)
        currentTokens += msgTokens
      } else {
        break
      }
    }

    return result
  }
}

// Singleton instance
export const tldwChat = new TldwChatService()

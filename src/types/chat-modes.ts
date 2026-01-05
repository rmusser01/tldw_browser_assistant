import type { ChatHistory } from "~/store/option"
import type { ChatDocuments } from "@/models/ChatTypes"

export interface SaveMessageBase {
  historyId: string | null
  setHistoryId: (id: string) => void
  selectedModel: string
  image: string
  userMessageType?: string
  assistantMessageType?: string
  clusterId?: string
  modelId: string
  userModelId?: string
  userMessageId?: string
  assistantMessageId: string
  userParentMessageId?: string | null
  assistantParentMessageId?: string | null
  documents?: ChatDocuments
  saveToDb?: boolean
  conversationId?: string
}

export interface SaveMessageData extends SaveMessageBase {
  isRegenerate: boolean
  message: string
  fullText: string
  source: unknown[]
  generationInfo?: Record<string, unknown>
  reasoning_time_taken: number
  prompt_content?: string
  prompt_id?: string
}

export interface SaveMessageErrorData extends SaveMessageBase {
  e: unknown
  botMessage: string
  history: ChatHistory
  setHistory: (history: ChatHistory) => void
  userMessage: string
  isRegenerating: boolean
  prompt_content?: string
  prompt_id?: string
}

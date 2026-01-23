import type { ChatCompletionToolCall } from "@/services/tldw"

export type ToolCall = ChatCompletionToolCall

export type ToolCallResult = {
  tool_call_id: string
  content: string
  error?: boolean
}

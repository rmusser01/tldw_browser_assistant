import type { ConversationState } from "@/services/tldw/TldwApiClient"

const VALID_CONVERSATION_STATES = new Set<ConversationState>([
  "in-progress",
  "resolved",
  "backlog",
  "non-viable"
])

export const normalizeConversationState = (
  value?: string | null
): ConversationState => {
  if (VALID_CONVERSATION_STATES.has(value as ConversationState)) {
    return value as ConversationState
  }
  return "in-progress"
}


import type { ConversationState } from "@/services/tldw/TldwApiClient"

export const CONVERSATION_STATE_OPTIONS = [
  {
    value: "in-progress",
    labelToken: "playground:composer.state.inProgress",
    defaultLabel: "in-progress"
  },
  {
    value: "resolved",
    labelToken: "playground:composer.state.resolved",
    defaultLabel: "resolved"
  },
  {
    value: "backlog",
    labelToken: "playground:composer.state.backlog",
    defaultLabel: "backlog"
  },
  {
    value: "non-viable",
    labelToken: "playground:composer.state.nonViable",
    defaultLabel: "non-viable"
  }
] as const

export const CONVERSATION_STATE_VALUES = CONVERSATION_STATE_OPTIONS.map(
  (option) => option.value
)

const VALID_CONVERSATION_STATES = new Set<ConversationState>(
  CONVERSATION_STATE_VALUES
)

export const normalizeConversationState = (
  value?: string | null
): ConversationState => {
  if (VALID_CONVERSATION_STATES.has(value as ConversationState)) {
    return value as ConversationState
  }
  return "in-progress"
}

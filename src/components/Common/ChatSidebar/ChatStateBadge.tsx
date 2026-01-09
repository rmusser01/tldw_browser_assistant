import React from "react"
import type { ConversationState } from "@/services/tldw/TldwApiClient"
import { normalizeConversationState } from "@/utils/conversation-state"

interface ChatStateBadgeProps {
  state?: ConversationState | string | null
}

export function ChatStateBadge({ state }: ChatStateBadgeProps) {
  const displayState = normalizeConversationState(state)
  return (
    <span className="inline-flex items-center rounded-full bg-surface2 px-2 py-1 text-[11px] font-medium lowercase text-text">
      {displayState}
    </span>
  )
}

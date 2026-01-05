import React from "react"

interface ChatStateBadgeProps {
  state: string
}

export function ChatStateBadge({ state }: ChatStateBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface2 px-2 py-1 text-[11px] font-medium lowercase text-text">
      {state || "in-progress"}
    </span>
  )
}

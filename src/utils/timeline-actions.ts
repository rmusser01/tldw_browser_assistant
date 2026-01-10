export const TIMELINE_ACTION_EVENT = "tldw:timeline-action"
export const OPEN_HISTORY_EVENT = "tldw:open-history"
export const EDIT_MESSAGE_EVENT = "tldw:edit-message"

export type TimelineAction = "go" | "branch" | "edit"

export type TimelineActionDetail = {
  action: TimelineAction
  historyId: string
  messageId?: string
}

export type OpenHistoryDetail = {
  historyId: string
  messageId?: string
}

export type EditMessageDetail = {
  messageId: string
}

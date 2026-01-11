export type ChatMenuDensity = "comfortable" | "compact"

export interface ChatSettingsConfig {
  copilotResumeLastChat: boolean
  defaultChatWithWebsite: boolean
  webUIResumeLastChat: boolean
  restoreLastChatModel: boolean
  hideCurrentChatModelSettings: boolean
  hideQuickChatHelper: boolean
  titleGenEnabled: boolean
  checkWideMode: boolean
  openReasoning: boolean
  userChatBubble: boolean
  autoCopyResponseToClipboard: boolean
  useMarkdownForUserMessage: boolean
  copyAsFormattedText: boolean
  tabMentionsEnabled: boolean
  pasteLargeTextAsFile: boolean
  sidepanelTemporaryChat: boolean
  menuDensity: ChatMenuDensity
  chatUserTextColor: string
  chatAssistantTextColor: string
  chatUserTextFont: string
  chatAssistantTextFont: string
  chatUserTextSize: "sm" | "md" | "lg"
  chatAssistantTextSize: "sm" | "md" | "lg"
  removeReasoningTagFromCopy: boolean
  promptSearchIncludeServer: boolean
  stickyChatInput: boolean
  allowExternalImages: boolean
}

export const DEFAULT_CHAT_SETTINGS: ChatSettingsConfig = {
  copilotResumeLastChat: false,
  defaultChatWithWebsite: false,
  webUIResumeLastChat: false,
  restoreLastChatModel: false,
  hideCurrentChatModelSettings: false,
  hideQuickChatHelper: false,
  titleGenEnabled: false,
  checkWideMode: false,
  openReasoning: false,
  userChatBubble: true,
  autoCopyResponseToClipboard: false,
  useMarkdownForUserMessage: false,
  copyAsFormattedText: false,
  tabMentionsEnabled: false,
  pasteLargeTextAsFile: false,
  sidepanelTemporaryChat: false,
  menuDensity: "comfortable",
  chatUserTextColor: "default",
  chatAssistantTextColor: "default",
  chatUserTextFont: "default",
  chatAssistantTextFont: "default",
  chatUserTextSize: "md",
  chatAssistantTextSize: "md",
  removeReasoningTagFromCopy: true,
  promptSearchIncludeServer: false,
  stickyChatInput: false,
  allowExternalImages: false
}

import { Select, Switch, Tag } from "antd"
import { useTranslation } from "react-i18next"
import { useStorage } from "@plasmohq/storage/hook"
import { DEFAULT_CHAT_SETTINGS } from "@/types/chat-settings"
import { BetaTag } from "@/components/Common/Beta"

const SELECT_WIDTH = 200

export const ChatSettings = () => {
  const { t } = useTranslation("settings")

  const [copilotResumeLastChat, setCopilotResumeLastChat] = useStorage(
    "copilotResumeLastChat",
    DEFAULT_CHAT_SETTINGS.copilotResumeLastChat
  )
  const [defaultChatWithWebsite, setDefaultChatWithWebsite] = useStorage(
    "defaultChatWithWebsite",
    DEFAULT_CHAT_SETTINGS.defaultChatWithWebsite
  )
  const [webUIResumeLastChat, setWebUIResumeLastChat] = useStorage(
    "webUIResumeLastChat",
    DEFAULT_CHAT_SETTINGS.webUIResumeLastChat
  )
  const [hideCurrentChatModelSettings, setHideCurrentChatModelSettings] =
    useStorage(
      "hideCurrentChatModelSettings",
      DEFAULT_CHAT_SETTINGS.hideCurrentChatModelSettings
    )
  const [hideQuickChatHelper, setHideQuickChatHelper] = useStorage(
    "hideQuickChatHelper",
    DEFAULT_CHAT_SETTINGS.hideQuickChatHelper
  )
  const [restoreLastChatModel, setRestoreLastChatModel] = useStorage(
    "restoreLastChatModel",
    DEFAULT_CHAT_SETTINGS.restoreLastChatModel
  )
  const [generateTitle, setGenerateTitle] = useStorage(
    "titleGenEnabled",
    DEFAULT_CHAT_SETTINGS.titleGenEnabled
  )
  const [checkWideMode, setCheckWideMode] = useStorage(
    "checkWideMode",
    DEFAULT_CHAT_SETTINGS.checkWideMode
  )
  const [stickyChatInput, setStickyChatInput] = useStorage(
    "stickyChatInput",
    DEFAULT_CHAT_SETTINGS.stickyChatInput
  )
  const [menuDensity, setMenuDensity] = useStorage(
    "menuDensity",
    DEFAULT_CHAT_SETTINGS.menuDensity
  )
  const [openReasoning, setOpenReasoning] = useStorage(
    "openReasoning",
    DEFAULT_CHAT_SETTINGS.openReasoning
  )
  const [userChatBubble, setUserChatBubble] = useStorage(
    "userChatBubble",
    DEFAULT_CHAT_SETTINGS.userChatBubble
  )
  const [autoCopyResponseToClipboard, setAutoCopyResponseToClipboard] =
    useStorage(
      "autoCopyResponseToClipboard",
      DEFAULT_CHAT_SETTINGS.autoCopyResponseToClipboard
    )
  const [useMarkdownForUserMessage, setUseMarkdownForUserMessage] = useStorage(
    "useMarkdownForUserMessage",
    DEFAULT_CHAT_SETTINGS.useMarkdownForUserMessage
  )
  const [copyAsFormattedText, setCopyAsFormattedText] = useStorage(
    "copyAsFormattedText",
    DEFAULT_CHAT_SETTINGS.copyAsFormattedText
  )
  const [tabMentionsEnabled, setTabMentionsEnabled] = useStorage(
    "tabMentionsEnabled",
    DEFAULT_CHAT_SETTINGS.tabMentionsEnabled
  )
  const [pasteLargeTextAsFile, setPasteLargeTextAsFile] = useStorage(
    "pasteLargeTextAsFile",
    DEFAULT_CHAT_SETTINGS.pasteLargeTextAsFile
  )
  const [sidepanelTemporaryChat, setSidepanelTemporaryChat] = useStorage(
    "sidepanelTemporaryChat",
    DEFAULT_CHAT_SETTINGS.sidepanelTemporaryChat
  )
  const [removeReasoningTagFromCopy, setRemoveReasoningTagFromCopy] =
    useStorage(
      "removeReasoningTagFromCopy",
      DEFAULT_CHAT_SETTINGS.removeReasoningTagFromCopy
    )
  const [promptSearchIncludeServer, setPromptSearchIncludeServer] =
    useStorage(
      "promptSearchIncludeServer",
      DEFAULT_CHAT_SETTINGS.promptSearchIncludeServer
    )

  const [userTextColor, setUserTextColor] = useStorage(
    "chatUserTextColor",
    DEFAULT_CHAT_SETTINGS.chatUserTextColor
  )
  const [assistantTextColor, setAssistantTextColor] = useStorage(
    "chatAssistantTextColor",
    DEFAULT_CHAT_SETTINGS.chatAssistantTextColor
  )
  const [userTextFont, setUserTextFont] = useStorage(
    "chatUserTextFont",
    DEFAULT_CHAT_SETTINGS.chatUserTextFont
  )
  const [assistantTextFont, setAssistantTextFont] = useStorage(
    "chatAssistantTextFont",
    DEFAULT_CHAT_SETTINGS.chatAssistantTextFont
  )
  const [userTextSize, setUserTextSize] = useStorage(
    "chatUserTextSize",
    DEFAULT_CHAT_SETTINGS.chatUserTextSize
  )
  const [assistantTextSize, setAssistantTextSize] = useStorage(
    "chatAssistantTextSize",
    DEFAULT_CHAT_SETTINGS.chatAssistantTextSize
  )

  const colorOptions = [
    {
      value: "default",
      label: t("chatAppearance.color.default", "Default")
    },
    { value: "blue", label: t("chatAppearance.color.blue", "Blue") },
    { value: "green", label: t("chatAppearance.color.green", "Green") },
    { value: "purple", label: t("chatAppearance.color.purple", "Purple") },
    { value: "orange", label: t("chatAppearance.color.orange", "Orange") },
    { value: "red", label: t("chatAppearance.color.red", "Red") }
  ]

  const fontOptions = [
    {
      value: "default",
      label: t("chatAppearance.font.default", "Default")
    },
    { value: "sans", label: t("chatAppearance.font.sans", "Sans serif") },
    { value: "serif", label: t("chatAppearance.font.serif", "Serif") },
    { value: "mono", label: t("chatAppearance.font.mono", "Monospace") }
  ]

  const sizeOptions = [
    { value: "sm", label: t("chatAppearance.size.sm", "Small") },
    { value: "md", label: t("chatAppearance.size.md", "Medium") },
    { value: "lg", label: t("chatAppearance.size.lg", "Large") }
  ]

  return (
    <dl className="flex flex-col space-y-6 text-sm">
      <div>
        <h2 className="text-base font-semibold leading-7 text-text">
          {t("chatBehavior.title", "Chat behavior")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t(
            "chatBehavior.description",
            "Control chat defaults, layout, and message handling."
          )}
        </p>
        <div className="border-b border-border mt-3" />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.copilotResumeLastChat.label")}
          </span>
        </div>
        <Switch
          checked={copilotResumeLastChat}
          onChange={(checked) => setCopilotResumeLastChat(checked)}
          aria-label={t("generalSettings.settings.copilotResumeLastChat.label")}
        />
      </div>
      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.turnOnChatWithWebsite.label")}
          </span>
        </div>
        <Switch
          checked={defaultChatWithWebsite}
          onChange={(checked) => setDefaultChatWithWebsite(checked)}
          aria-label={t("generalSettings.settings.turnOnChatWithWebsite.label")}
        />
      </div>
      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.webUIResumeLastChat.label")}
          </span>
          {webUIResumeLastChat === DEFAULT_CHAT_SETTINGS.webUIResumeLastChat && (
            <Tag className="text-[10px] py-0 px-1.5 leading-4">
              {t("generalSettings.settings.defaultBadge", "default")}
            </Tag>
          )}
        </div>
        <Switch
          checked={webUIResumeLastChat}
          onChange={(checked) => setWebUIResumeLastChat(checked)}
          aria-label={t("generalSettings.settings.webUIResumeLastChat.label")}
        />
      </div>
      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.hideCurrentChatModelSettings.label")}
          </span>
          {hideCurrentChatModelSettings ===
            DEFAULT_CHAT_SETTINGS.hideCurrentChatModelSettings && (
            <Tag className="text-[10px] py-0 px-1.5 leading-4">
              {t("generalSettings.settings.defaultBadge", "default")}
            </Tag>
          )}
        </div>

        <Switch
          checked={hideCurrentChatModelSettings}
          onChange={(checked) => setHideCurrentChatModelSettings(checked)}
          aria-label={t("generalSettings.settings.hideCurrentChatModelSettings.label")}
        />
      </div>
      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t(
              "generalSettings.settings.hideQuickChatHelper.label",
              "Hide Quick Chat Helper button"
            )}
          </span>
        </div>

        <Switch
          checked={hideQuickChatHelper}
          onChange={(checked) => setHideQuickChatHelper(checked)}
          aria-label={t(
            "generalSettings.settings.hideQuickChatHelper.label",
            "Hide Quick Chat Helper button"
          )}
        />
      </div>
      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.restoreLastChatModel.label")}
          </span>
          {restoreLastChatModel === DEFAULT_CHAT_SETTINGS.restoreLastChatModel && (
            <Tag className="text-[10px] py-0 px-1.5 leading-4">
              {t("generalSettings.settings.defaultBadge", "default")}
            </Tag>
          )}
        </div>

        <Switch
          checked={restoreLastChatModel}
          onChange={(checked) => setRestoreLastChatModel(checked)}
          aria-label={t("generalSettings.settings.restoreLastChatModel.label")}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.generateTitle.label")}
          </span>
        </div>

        <Switch
          checked={generateTitle}
          onChange={(checked) => setGenerateTitle(checked)}
          aria-label={t("generalSettings.settings.generateTitle.label")}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.wideMode.label")}
          </span>
          {checkWideMode === DEFAULT_CHAT_SETTINGS.checkWideMode && (
            <Tag className="text-[10px] py-0 px-1.5 leading-4">
              {t("generalSettings.settings.defaultBadge", "default")}
            </Tag>
          )}
        </div>

        <Switch
          checked={checkWideMode}
          onChange={(checked) => setCheckWideMode(checked)}
          aria-label={t("generalSettings.settings.wideMode.label")}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.stickyChatInput.label")}
          </span>
          {stickyChatInput === DEFAULT_CHAT_SETTINGS.stickyChatInput && (
            <Tag className="text-[10px] py-0 px-1.5 leading-4">
              {t("generalSettings.settings.defaultBadge", "default")}
            </Tag>
          )}
        </div>

        <Switch
          checked={stickyChatInput}
          onChange={(checked) => setStickyChatInput(checked)}
          aria-label={t("generalSettings.settings.stickyChatInput.label")}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.menuDensity.label", "Menu density")}
          </span>
          {menuDensity === DEFAULT_CHAT_SETTINGS.menuDensity && (
            <Tag className="text-[10px] py-0 px-1.5 leading-4">
              {t("generalSettings.settings.defaultBadge", "default")}
            </Tag>
          )}
        </div>
        <Select
          aria-label={t("generalSettings.settings.menuDensity.label", "Menu density")}
          style={{ width: SELECT_WIDTH }}
          value={menuDensity}
          onChange={(v) => setMenuDensity(v)}
          options={[
            {
              value: "comfortable",
              label: t(
                "generalSettings.settings.menuDensity.comfortable",
                "Comfortable"
              )
            },
            {
              value: "compact",
              label: t(
                "generalSettings.settings.menuDensity.compact",
                "Compact"
              )
            }
          ]}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.openReasoning.label")}
          </span>
          {openReasoning === DEFAULT_CHAT_SETTINGS.openReasoning && (
            <Tag className="text-[10px] py-0 px-1.5 leading-4">
              {t("generalSettings.settings.defaultBadge", "default")}
            </Tag>
          )}
        </div>

        <Switch
          checked={openReasoning}
          onChange={(checked) => setOpenReasoning(checked)}
          aria-label={t("generalSettings.settings.openReasoning.label")}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.userChatBubble.label")}
          </span>
          {userChatBubble === DEFAULT_CHAT_SETTINGS.userChatBubble && (
            <Tag className="text-[10px] py-0 px-1.5 leading-4">
              {t("generalSettings.settings.defaultBadge", "default")}
            </Tag>
          )}
        </div>

        <Switch
          checked={userChatBubble}
          onChange={(checked) => setUserChatBubble(checked)}
          aria-label={t("generalSettings.settings.userChatBubble.label")}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.autoCopyResponseToClipboard.label")}
          </span>
          {autoCopyResponseToClipboard ===
            DEFAULT_CHAT_SETTINGS.autoCopyResponseToClipboard && (
            <Tag className="text-[10px] py-0 px-1.5 leading-4">
              {t("generalSettings.settings.defaultBadge", "default")}
            </Tag>
          )}
        </div>

        <Switch
          checked={autoCopyResponseToClipboard}
          onChange={(checked) => setAutoCopyResponseToClipboard(checked)}
          aria-label={t("generalSettings.settings.autoCopyResponseToClipboard.label")}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.useMarkdownForUserMessage.label")}
          </span>
          {useMarkdownForUserMessage ===
            DEFAULT_CHAT_SETTINGS.useMarkdownForUserMessage && (
            <Tag className="text-[10px] py-0 px-1.5 leading-4">
              {t("generalSettings.settings.defaultBadge", "default")}
            </Tag>
          )}
        </div>

        <Switch
          checked={useMarkdownForUserMessage}
          onChange={(checked) => setUseMarkdownForUserMessage(checked)}
          aria-label={t("generalSettings.settings.useMarkdownForUserMessage.label")}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.copyAsFormattedText.label")}
          </span>
          {copyAsFormattedText === DEFAULT_CHAT_SETTINGS.copyAsFormattedText && (
            <Tag className="text-[10px] py-0 px-1.5 leading-4">
              {t("generalSettings.settings.defaultBadge", "default")}
            </Tag>
          )}
        </div>

        <Switch
          checked={copyAsFormattedText}
          onChange={(checked) => setCopyAsFormattedText(checked)}
          aria-label={t("generalSettings.settings.copyAsFormattedText.label")}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <BetaTag />
          <span className="text-text">
            {t("generalSettings.settings.tabMentionsEnabled.label")}
          </span>
        </div>

        <Switch
          checked={tabMentionsEnabled}
          onChange={(checked) => setTabMentionsEnabled(checked)}
          aria-label={t("generalSettings.settings.tabMentionsEnabled.label")}
        />
      </div>
      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.pasteLargeTextAsFile.label")}
          </span>
        </div>

        <Switch
          checked={pasteLargeTextAsFile}
          onChange={(checked) => setPasteLargeTextAsFile(checked)}
          aria-label={t("generalSettings.settings.pasteLargeTextAsFile.label")}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.sidepanelTemporaryChat.label")}
          </span>
        </div>

        <Switch
          checked={sidepanelTemporaryChat}
          onChange={(checked) => setSidepanelTemporaryChat(checked)}
          aria-label={t("generalSettings.settings.sidepanelTemporaryChat.label")}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.removeReasoningTagFromCopy.label")}
          </span>
          {removeReasoningTagFromCopy ===
            DEFAULT_CHAT_SETTINGS.removeReasoningTagFromCopy && (
            <Tag className="text-[10px] py-0 px-1.5 leading-4">
              {t("generalSettings.settings.defaultBadge", "default")}
            </Tag>
          )}
        </div>

        <Switch
          checked={removeReasoningTagFromCopy}
          onChange={(checked) => setRemoveReasoningTagFromCopy(checked)}
          aria-label={t("generalSettings.settings.removeReasoningTagFromCopy.label")}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.promptSearchIncludeServer.label")}
          </span>
        </div>
        <Switch
          checked={promptSearchIncludeServer}
          onChange={(checked) => setPromptSearchIncludeServer(checked)}
          aria-label={t("generalSettings.settings.promptSearchIncludeServer.label")}
        />
      </div>

      <div>
        <h2 className="text-base font-semibold leading-7 text-text">
          {t("chatAppearance.title", "Chat Appearance")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t(
            "chatAppearance.description",
            "Customize colors, fonts, and text sizes for chat messages."
          )}
        </p>
        <div className="border-b border-border mt-3" />
      </div>

      <div className="pt-4">
        <h3 className="text-sm font-semibold leading-6 text-text">
          {t("chatAppearance.userHeading", "User messages")}
        </h3>
      </div>

      <div className="flex flex-row justify-between">
        <label
          htmlFor="user-text-color"
          className="inline-flex items-center gap-2 text-text"
        >
          {t("chatAppearance.userColor", "User text color")}
        </label>
        <Select
          id="user-text-color"
          style={{ width: SELECT_WIDTH }}
          value={userTextColor}
          onChange={(value) => setUserTextColor(value)}
          options={colorOptions}
        />
      </div>

      <div className="flex flex-row justify-between">
        <label
          htmlFor="user-text-font"
          className="inline-flex items-center gap-2 text-text"
        >
          {t("chatAppearance.userFont", "User font")}
        </label>
        <Select
          id="user-text-font"
          style={{ width: SELECT_WIDTH }}
          value={userTextFont}
          onChange={(value) => setUserTextFont(value)}
          options={fontOptions}
        />
      </div>

      <div className="flex flex-row justify-between">
        <label
          htmlFor="user-text-size"
          className="inline-flex items-center gap-2 text-text"
        >
          {t("chatAppearance.userSize", "User text size")}
        </label>
        <Select
          id="user-text-size"
          style={{ width: SELECT_WIDTH }}
          value={userTextSize}
          onChange={(value) => setUserTextSize(value)}
          options={sizeOptions}
        />
      </div>

      <div className="pt-4">
        <h3 className="text-sm font-semibold leading-6 text-text">
          {t("chatAppearance.assistantHeading", "Assistant messages")}
        </h3>
      </div>

      <div className="flex flex-row justify-between">
        <label
          htmlFor="assistant-text-color"
          className="inline-flex items-center gap-2 text-text"
        >
          {t("chatAppearance.assistantColor", "Assistant text color")}
        </label>
        <Select
          id="assistant-text-color"
          style={{ width: SELECT_WIDTH }}
          value={assistantTextColor}
          onChange={(value) => setAssistantTextColor(value)}
          options={colorOptions}
        />
      </div>

      <div className="flex flex-row justify-between">
        <label
          htmlFor="assistant-text-font"
          className="inline-flex items-center gap-2 text-text"
        >
          {t("chatAppearance.assistantFont", "Assistant font")}
        </label>
        <Select
          id="assistant-text-font"
          style={{ width: SELECT_WIDTH }}
          value={assistantTextFont}
          onChange={(value) => setAssistantTextFont(value)}
          options={fontOptions}
        />
      </div>

      <div className="flex flex-row justify-between">
        <label
          htmlFor="assistant-text-size"
          className="inline-flex items-center gap-2 text-text"
        >
          {t("chatAppearance.assistantSize", "Assistant text size")}
        </label>
        <Select
          id="assistant-text-size"
          style={{ width: SELECT_WIDTH }}
          value={assistantTextSize}
          onChange={(value) => setAssistantTextSize(value)}
          options={sizeOptions}
        />
      </div>
    </dl>
  )
}

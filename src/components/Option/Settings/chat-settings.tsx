import { Select, Switch, Tag } from "antd"
import { type ReactNode, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useStorage } from "@plasmohq/storage/hook"
import { DEFAULT_CHAT_SETTINGS } from "@/types/chat-settings"
import { BetaTag } from "@/components/Common/Beta"

const SELECT_WIDTH = 200

type SettingRowProps = {
  label: string
  value?: boolean | string
  defaultValue?: boolean | string
  beta?: boolean
  labelFor?: string
  control: ReactNode
}

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
  const [allowExternalImages, setAllowExternalImages] = useStorage(
    "allowExternalImages",
    DEFAULT_CHAT_SETTINGS.allowExternalImages
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

  const handleMenuDensityChange = useCallback(
    (value: string) =>
      setMenuDensity(value as "comfortable" | "compact"),
    [setMenuDensity]
  )
  const handleUserTextSizeChange = useCallback(
    (value: string) => setUserTextSize(value as "sm" | "md" | "lg"),
    [setUserTextSize]
  )
  const handleAssistantTextSizeChange = useCallback(
    (value: string) =>
      setAssistantTextSize(value as "sm" | "md" | "lg"),
    [setAssistantTextSize]
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

  const menuDensityOptions = [
    {
      value: "comfortable",
      label: t("generalSettings.settings.menuDensity.comfortable", "Comfortable")
    },
    {
      value: "compact",
      label: t("generalSettings.settings.menuDensity.compact", "Compact")
    }
  ]

  const defaultBadgeLabel = t("generalSettings.settings.defaultBadge", "default")

  const SettingRow = ({
    label,
    value,
    defaultValue,
    beta = false,
    labelFor,
    control
  }: SettingRowProps) => {
    const showDefaultBadge =
      defaultValue !== undefined && value === defaultValue

    return (
      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          {beta && <BetaTag />}
          {labelFor ? (
            <label htmlFor={labelFor} className="text-text">
              {label}
            </label>
          ) : (
            <span className="text-text">{label}</span>
          )}
          {showDefaultBadge && (
            <Tag className="text-[10px] py-0 px-1.5 leading-4">
              {defaultBadgeLabel}
            </Tag>
          )}
        </div>
        {control}
      </div>
    )
  }

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

      <SettingRow
        label={t("generalSettings.settings.copilotResumeLastChat.label")}
        value={copilotResumeLastChat}
        defaultValue={DEFAULT_CHAT_SETTINGS.copilotResumeLastChat}
        control={
          <Switch
            checked={copilotResumeLastChat}
            onChange={setCopilotResumeLastChat}
            aria-label={t("generalSettings.settings.copilotResumeLastChat.label")}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.turnOnChatWithWebsite.label")}
        value={defaultChatWithWebsite}
        defaultValue={DEFAULT_CHAT_SETTINGS.defaultChatWithWebsite}
        control={
          <Switch
            checked={defaultChatWithWebsite}
            onChange={setDefaultChatWithWebsite}
            aria-label={t("generalSettings.settings.turnOnChatWithWebsite.label")}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.webUIResumeLastChat.label")}
        value={webUIResumeLastChat}
        defaultValue={DEFAULT_CHAT_SETTINGS.webUIResumeLastChat}
        control={
          <Switch
            checked={webUIResumeLastChat}
            onChange={setWebUIResumeLastChat}
            aria-label={t("generalSettings.settings.webUIResumeLastChat.label")}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.hideCurrentChatModelSettings.label")}
        value={hideCurrentChatModelSettings}
        defaultValue={DEFAULT_CHAT_SETTINGS.hideCurrentChatModelSettings}
        control={
          <Switch
            checked={hideCurrentChatModelSettings}
            onChange={setHideCurrentChatModelSettings}
            aria-label={t(
              "generalSettings.settings.hideCurrentChatModelSettings.label"
            )}
          />
        }
      />
      <SettingRow
        label={t(
          "generalSettings.settings.hideQuickChatHelper.label",
          "Hide Quick Chat Helper button"
        )}
        value={hideQuickChatHelper}
        defaultValue={DEFAULT_CHAT_SETTINGS.hideQuickChatHelper}
        control={
          <Switch
            checked={hideQuickChatHelper}
            onChange={setHideQuickChatHelper}
            aria-label={t(
              "generalSettings.settings.hideQuickChatHelper.label",
              "Hide Quick Chat Helper button"
            )}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.restoreLastChatModel.label")}
        value={restoreLastChatModel}
        defaultValue={DEFAULT_CHAT_SETTINGS.restoreLastChatModel}
        control={
          <Switch
            checked={restoreLastChatModel}
            onChange={setRestoreLastChatModel}
            aria-label={t("generalSettings.settings.restoreLastChatModel.label")}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.generateTitle.label")}
        value={generateTitle}
        defaultValue={DEFAULT_CHAT_SETTINGS.titleGenEnabled}
        control={
          <Switch
            checked={generateTitle}
            onChange={setGenerateTitle}
            aria-label={t("generalSettings.settings.generateTitle.label")}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.wideMode.label")}
        value={checkWideMode}
        defaultValue={DEFAULT_CHAT_SETTINGS.checkWideMode}
        control={
          <Switch
            checked={checkWideMode}
            onChange={setCheckWideMode}
            aria-label={t("generalSettings.settings.wideMode.label")}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.stickyChatInput.label")}
        value={stickyChatInput}
        defaultValue={DEFAULT_CHAT_SETTINGS.stickyChatInput}
        control={
          <Switch
            checked={stickyChatInput}
            onChange={setStickyChatInput}
            aria-label={t("generalSettings.settings.stickyChatInput.label")}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.menuDensity.label", "Menu density")}
        value={menuDensity}
        defaultValue={DEFAULT_CHAT_SETTINGS.menuDensity}
        control={
          <Select
            aria-label={t(
              "generalSettings.settings.menuDensity.label",
              "Menu density"
            )}
            style={{ width: SELECT_WIDTH }}
            value={menuDensity}
            onChange={handleMenuDensityChange}
            options={menuDensityOptions}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.openReasoning.label")}
        value={openReasoning}
        defaultValue={DEFAULT_CHAT_SETTINGS.openReasoning}
        control={
          <Switch
            checked={openReasoning}
            onChange={setOpenReasoning}
            aria-label={t("generalSettings.settings.openReasoning.label")}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.userChatBubble.label")}
        value={userChatBubble}
        defaultValue={DEFAULT_CHAT_SETTINGS.userChatBubble}
        control={
          <Switch
            checked={userChatBubble}
            onChange={setUserChatBubble}
            aria-label={t("generalSettings.settings.userChatBubble.label")}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.autoCopyResponseToClipboard.label")}
        value={autoCopyResponseToClipboard}
        defaultValue={DEFAULT_CHAT_SETTINGS.autoCopyResponseToClipboard}
        control={
          <Switch
            checked={autoCopyResponseToClipboard}
            onChange={setAutoCopyResponseToClipboard}
            aria-label={t(
              "generalSettings.settings.autoCopyResponseToClipboard.label"
            )}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.useMarkdownForUserMessage.label")}
        value={useMarkdownForUserMessage}
        defaultValue={DEFAULT_CHAT_SETTINGS.useMarkdownForUserMessage}
        control={
          <Switch
            checked={useMarkdownForUserMessage}
            onChange={setUseMarkdownForUserMessage}
            aria-label={t("generalSettings.settings.useMarkdownForUserMessage.label")}
          />
        }
      />
      <SettingRow
        label={t(
          "generalSettings.settings.allowExternalImages.label",
          "Load external images in messages"
        )}
        value={allowExternalImages}
        defaultValue={DEFAULT_CHAT_SETTINGS.allowExternalImages}
        control={
          <Switch
            checked={allowExternalImages}
            onChange={setAllowExternalImages}
            aria-label={t(
              "generalSettings.settings.allowExternalImages.label",
              "Load external images in messages"
            )}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.copyAsFormattedText.label")}
        value={copyAsFormattedText}
        defaultValue={DEFAULT_CHAT_SETTINGS.copyAsFormattedText}
        control={
          <Switch
            checked={copyAsFormattedText}
            onChange={setCopyAsFormattedText}
            aria-label={t("generalSettings.settings.copyAsFormattedText.label")}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.tabMentionsEnabled.label")}
        value={tabMentionsEnabled}
        defaultValue={DEFAULT_CHAT_SETTINGS.tabMentionsEnabled}
        beta
        control={
          <Switch
            checked={tabMentionsEnabled}
            onChange={setTabMentionsEnabled}
            aria-label={t("generalSettings.settings.tabMentionsEnabled.label")}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.pasteLargeTextAsFile.label")}
        value={pasteLargeTextAsFile}
        defaultValue={DEFAULT_CHAT_SETTINGS.pasteLargeTextAsFile}
        control={
          <Switch
            checked={pasteLargeTextAsFile}
            onChange={setPasteLargeTextAsFile}
            aria-label={t("generalSettings.settings.pasteLargeTextAsFile.label")}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.sidepanelTemporaryChat.label")}
        value={sidepanelTemporaryChat}
        defaultValue={DEFAULT_CHAT_SETTINGS.sidepanelTemporaryChat}
        control={
          <Switch
            checked={sidepanelTemporaryChat}
            onChange={setSidepanelTemporaryChat}
            aria-label={t("generalSettings.settings.sidepanelTemporaryChat.label")}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.removeReasoningTagFromCopy.label")}
        value={removeReasoningTagFromCopy}
        defaultValue={DEFAULT_CHAT_SETTINGS.removeReasoningTagFromCopy}
        control={
          <Switch
            checked={removeReasoningTagFromCopy}
            onChange={setRemoveReasoningTagFromCopy}
            aria-label={t("generalSettings.settings.removeReasoningTagFromCopy.label")}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.promptSearchIncludeServer.label")}
        value={promptSearchIncludeServer}
        defaultValue={DEFAULT_CHAT_SETTINGS.promptSearchIncludeServer}
        control={
          <Switch
            checked={promptSearchIncludeServer}
            onChange={setPromptSearchIncludeServer}
            aria-label={t("generalSettings.settings.promptSearchIncludeServer.label")}
          />
        }
      />

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

      <SettingRow
        label={t("chatAppearance.userColor", "User text color")}
        labelFor="user-text-color"
        control={
          <Select
            id="user-text-color"
            style={{ width: SELECT_WIDTH }}
            value={userTextColor}
            onChange={setUserTextColor}
            options={colorOptions}
          />
        }
      />

      <SettingRow
        label={t("chatAppearance.userFont", "User font")}
        labelFor="user-text-font"
        control={
          <Select
            id="user-text-font"
            style={{ width: SELECT_WIDTH }}
            value={userTextFont}
            onChange={setUserTextFont}
            options={fontOptions}
          />
        }
      />

      <SettingRow
        label={t("chatAppearance.userSize", "User text size")}
        labelFor="user-text-size"
        control={
          <Select
            id="user-text-size"
            style={{ width: SELECT_WIDTH }}
            value={userTextSize}
            onChange={handleUserTextSizeChange}
            options={sizeOptions}
          />
        }
      />

      <div className="pt-4">
        <h3 className="text-sm font-semibold leading-6 text-text">
          {t("chatAppearance.assistantHeading", "Assistant messages")}
        </h3>
      </div>

      <SettingRow
        label={t("chatAppearance.assistantColor", "Assistant text color")}
        labelFor="assistant-text-color"
        control={
          <Select
            id="assistant-text-color"
            style={{ width: SELECT_WIDTH }}
            value={assistantTextColor}
            onChange={setAssistantTextColor}
            options={colorOptions}
          />
        }
      />

      <SettingRow
        label={t("chatAppearance.assistantFont", "Assistant font")}
        labelFor="assistant-text-font"
        control={
          <Select
            id="assistant-text-font"
            style={{ width: SELECT_WIDTH }}
            value={assistantTextFont}
            onChange={setAssistantTextFont}
            options={fontOptions}
          />
        }
      />

      <SettingRow
        label={t("chatAppearance.assistantSize", "Assistant text size")}
        labelFor="assistant-text-size"
        control={
          <Select
            id="assistant-text-size"
            style={{ width: SELECT_WIDTH }}
            value={assistantTextSize}
            onChange={handleAssistantTextSizeChange}
            options={sizeOptions}
          />
        }
      />
    </dl>
  )
}

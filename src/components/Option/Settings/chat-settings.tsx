import { Select, Switch } from "antd"
import { useTranslation } from "react-i18next"
import { useStorage } from "@plasmohq/storage/hook"
import { DEFAULT_CHAT_SETTINGS } from "@/types/chat-settings"
import { BetaTag } from "@/components/Common/Beta"
import { SettingRow } from "@/components/Common/SettingRow"

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

  const getResetProps = <T extends boolean | string>(
    value: T,
    defaultValue: T,
    setter: (next: T) => void | Promise<void>
  ) => ({
    modified: value !== defaultValue,
    onReset: () => void setter(defaultValue)
  })

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
        {...getResetProps(
          copilotResumeLastChat,
          DEFAULT_CHAT_SETTINGS.copilotResumeLastChat,
          setCopilotResumeLastChat
        )}
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
        {...getResetProps(
          defaultChatWithWebsite,
          DEFAULT_CHAT_SETTINGS.defaultChatWithWebsite,
          setDefaultChatWithWebsite
        )}
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
        {...getResetProps(
          webUIResumeLastChat,
          DEFAULT_CHAT_SETTINGS.webUIResumeLastChat,
          setWebUIResumeLastChat
        )}
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
        {...getResetProps(
          hideCurrentChatModelSettings,
          DEFAULT_CHAT_SETTINGS.hideCurrentChatModelSettings,
          setHideCurrentChatModelSettings
        )}
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
        {...getResetProps(
          hideQuickChatHelper,
          DEFAULT_CHAT_SETTINGS.hideQuickChatHelper,
          setHideQuickChatHelper
        )}
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
        {...getResetProps(
          restoreLastChatModel,
          DEFAULT_CHAT_SETTINGS.restoreLastChatModel,
          setRestoreLastChatModel
        )}
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
        {...getResetProps(
          generateTitle,
          DEFAULT_CHAT_SETTINGS.titleGenEnabled,
          setGenerateTitle
        )}
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
        {...getResetProps(
          checkWideMode,
          DEFAULT_CHAT_SETTINGS.checkWideMode,
          setCheckWideMode
        )}
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
        {...getResetProps(
          stickyChatInput,
          DEFAULT_CHAT_SETTINGS.stickyChatInput,
          setStickyChatInput
        )}
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
        {...getResetProps(
          menuDensity,
          DEFAULT_CHAT_SETTINGS.menuDensity,
          setMenuDensity
        )}
        control={
          <Select
            aria-label={t(
              "generalSettings.settings.menuDensity.label",
              "Menu density"
            )}
            style={{ width: SELECT_WIDTH }}
            value={menuDensity}
            onChange={(value) =>
              setMenuDensity(value as "comfortable" | "compact")
            }
            options={menuDensityOptions}
          />
        }
      />
      <SettingRow
        label={t("generalSettings.settings.openReasoning.label")}
        {...getResetProps(
          openReasoning,
          DEFAULT_CHAT_SETTINGS.openReasoning,
          setOpenReasoning
        )}
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
        {...getResetProps(
          userChatBubble,
          DEFAULT_CHAT_SETTINGS.userChatBubble,
          setUserChatBubble
        )}
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
        {...getResetProps(
          autoCopyResponseToClipboard,
          DEFAULT_CHAT_SETTINGS.autoCopyResponseToClipboard,
          setAutoCopyResponseToClipboard
        )}
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
        {...getResetProps(
          useMarkdownForUserMessage,
          DEFAULT_CHAT_SETTINGS.useMarkdownForUserMessage,
          setUseMarkdownForUserMessage
        )}
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
        {...getResetProps(
          allowExternalImages,
          DEFAULT_CHAT_SETTINGS.allowExternalImages,
          setAllowExternalImages
        )}
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
        {...getResetProps(
          copyAsFormattedText,
          DEFAULT_CHAT_SETTINGS.copyAsFormattedText,
          setCopyAsFormattedText
        )}
        control={
          <Switch
            checked={copyAsFormattedText}
            onChange={setCopyAsFormattedText}
            aria-label={t("generalSettings.settings.copyAsFormattedText.label")}
          />
        }
      />
      <SettingRow
        label={
          <span className="inline-flex items-center gap-2">
            {t("generalSettings.settings.tabMentionsEnabled.label")}
            <BetaTag />
          </span>
        }
        {...getResetProps(
          tabMentionsEnabled,
          DEFAULT_CHAT_SETTINGS.tabMentionsEnabled,
          setTabMentionsEnabled
        )}
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
        {...getResetProps(
          pasteLargeTextAsFile,
          DEFAULT_CHAT_SETTINGS.pasteLargeTextAsFile,
          setPasteLargeTextAsFile
        )}
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
        {...getResetProps(
          sidepanelTemporaryChat,
          DEFAULT_CHAT_SETTINGS.sidepanelTemporaryChat,
          setSidepanelTemporaryChat
        )}
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
        {...getResetProps(
          removeReasoningTagFromCopy,
          DEFAULT_CHAT_SETTINGS.removeReasoningTagFromCopy,
          setRemoveReasoningTagFromCopy
        )}
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
        {...getResetProps(
          promptSearchIncludeServer,
          DEFAULT_CHAT_SETTINGS.promptSearchIncludeServer,
          setPromptSearchIncludeServer
        )}
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
        id="user-text-color"
        {...getResetProps(
          userTextColor,
          DEFAULT_CHAT_SETTINGS.chatUserTextColor,
          setUserTextColor
        )}
        control={
          <Select
            id="user-text-color"
            style={{ width: SELECT_WIDTH }}
            value={userTextColor}
            onChange={(value) => setUserTextColor(value)}
            options={colorOptions}
          />
        }
      />

      <SettingRow
        label={t("chatAppearance.userFont", "User font")}
        id="user-text-font"
        {...getResetProps(
          userTextFont,
          DEFAULT_CHAT_SETTINGS.chatUserTextFont,
          setUserTextFont
        )}
        control={
          <Select
            id="user-text-font"
            style={{ width: SELECT_WIDTH }}
            value={userTextFont}
            onChange={(value) => setUserTextFont(value)}
            options={fontOptions}
          />
        }
      />

      <SettingRow
        label={t("chatAppearance.userSize", "User text size")}
        id="user-text-size"
        {...getResetProps(
          userTextSize,
          DEFAULT_CHAT_SETTINGS.chatUserTextSize,
          setUserTextSize
        )}
        control={
          <Select
            id="user-text-size"
            style={{ width: SELECT_WIDTH }}
            value={userTextSize}
            onChange={(value) => setUserTextSize(value as "sm" | "md" | "lg")}
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
        id="assistant-text-color"
        {...getResetProps(
          assistantTextColor,
          DEFAULT_CHAT_SETTINGS.chatAssistantTextColor,
          setAssistantTextColor
        )}
        control={
          <Select
            id="assistant-text-color"
            style={{ width: SELECT_WIDTH }}
            value={assistantTextColor}
            onChange={(value) => setAssistantTextColor(value)}
            options={colorOptions}
          />
        }
      />

      <SettingRow
        label={t("chatAppearance.assistantFont", "Assistant font")}
        id="assistant-text-font"
        {...getResetProps(
          assistantTextFont,
          DEFAULT_CHAT_SETTINGS.chatAssistantTextFont,
          setAssistantTextFont
        )}
        control={
          <Select
            id="assistant-text-font"
            style={{ width: SELECT_WIDTH }}
            value={assistantTextFont}
            onChange={(value) => setAssistantTextFont(value)}
            options={fontOptions}
          />
        }
      />

      <SettingRow
        label={t("chatAppearance.assistantSize", "Assistant text size")}
        id="assistant-text-size"
        {...getResetProps(
          assistantTextSize,
          DEFAULT_CHAT_SETTINGS.chatAssistantTextSize,
          setAssistantTextSize
        )}
        control={
          <Select
            id="assistant-text-size"
            style={{ width: SELECT_WIDTH }}
            value={assistantTextSize}
            onChange={(value) =>
              setAssistantTextSize(value as "sm" | "md" | "lg")
            }
            options={sizeOptions}
          />
        }
      />
    </dl>
  )
}

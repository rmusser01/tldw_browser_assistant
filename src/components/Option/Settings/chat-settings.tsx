import { Alert, Select } from "antd"
import { useTranslation } from "react-i18next"
import { useStorage } from "@plasmohq/storage/hook"
import { Link } from "react-router-dom"
import { DEFAULT_CHAT_SETTINGS } from "@/types/chat-settings"

export const ChatSettings = () => {
  const { t } = useTranslation("settings")

  // Chat appearance settings (unique to this page)
  // Behavioral settings (wide mode, reasoning, copy behavior, etc.) are in General Settings

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
      label: t("chatSettings.color.default", "Default")
    },
    { value: "blue", label: t("chatSettings.color.blue", "Blue") },
    { value: "green", label: t("chatSettings.color.green", "Green") },
    { value: "purple", label: t("chatSettings.color.purple", "Purple") },
    { value: "orange", label: t("chatSettings.color.orange", "Orange") },
    { value: "red", label: t("chatSettings.color.red", "Red") }
  ]

  const fontOptions = [
    {
      value: "default",
      label: t("chatSettings.font.default", "Default")
    },
    { value: "sans", label: t("chatSettings.font.sans", "Sans serif") },
    { value: "serif", label: t("chatSettings.font.serif", "Serif") },
    { value: "mono", label: t("chatSettings.font.mono", "Monospace") }
  ]

  const sizeOptions = [
    { value: "sm", label: t("chatSettings.size.sm", "Small") },
    { value: "md", label: t("chatSettings.size.md", "Medium") },
    { value: "lg", label: t("chatSettings.size.lg", "Large") }
  ]

  return (
    <dl className="flex flex-col space-y-6 text-sm">
      <div>
        <h2 className="text-base font-semibold leading-7 text-gray-900 dark:text-white">
          {t("chatSettings.title", "Chat Appearance")}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {t(
            "chatSettings.description",
            "Customize colors, fonts, and text sizes for chat messages."
          )}
        </p>
        <div className="border border-b border-gray-200 dark:border-gray-600 mt-3" />
      </div>

      {/* Note about behavioral settings */}
      <Alert
        type="info"
        showIcon
        message={
          <span>
            {t(
              "chatSettings.behaviorNote",
              "Looking for chat behavior settings (wide mode, reasoning, copy options)?"
            )}{" "}
            <Link
              to="/settings"
              className="text-blue-600 hover:text-blue-500 dark:text-blue-400 underline"
            >
              {t("chatSettings.goToGeneral", "Go to General Settings")}
            </Link>
          </span>
        }
        className="!py-2"
      />

      <div className="pt-4">
        <h3 className="text-sm font-semibold leading-6 text-gray-900 dark:text-white">
          {t("chatSettings.userHeading", "User messages")}
        </h3>
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-gray-700 dark:text-neutral-50">
            {t("chatSettings.userColor", "User text color")}
          </span>
        </div>
        <Select
          style={{ width: 200 }}
          value={userTextColor}
          onChange={(value) => setUserTextColor(value)}
          options={colorOptions}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-gray-700 dark:text-neutral-50">
            {t("chatSettings.userFont", "User font")}
          </span>
        </div>
        <Select
          style={{ width: 200 }}
          value={userTextFont}
          onChange={(value) => setUserTextFont(value)}
          options={fontOptions}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-gray-700 dark:text-neutral-50">
            {t("chatSettings.userSize", "User text size")}
          </span>
        </div>
        <Select
          style={{ width: 200 }}
          value={userTextSize}
          onChange={(value) => setUserTextSize(value)}
          options={sizeOptions}
        />
      </div>

      <div className="pt-4">
        <h3 className="text-sm font-semibold leading-6 text-gray-900 dark:text-white">
          {t("chatSettings.assistantHeading", "Assistant messages")}
        </h3>
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-gray-700 dark:text-neutral-50">
            {t("chatSettings.assistantColor", "Assistant text color")}
          </span>
        </div>
        <Select
          style={{ width: 200 }}
          value={assistantTextColor}
          onChange={(value) => setAssistantTextColor(value)}
          options={colorOptions}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-gray-700 dark:text-neutral-50">
            {t("chatSettings.assistantFont", "Assistant font")}
          </span>
        </div>
        <Select
          style={{ width: 200 }}
          value={assistantTextFont}
          onChange={(value) => setAssistantTextFont(value)}
          options={fontOptions}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-gray-700 dark:text-neutral-50">
            {t("chatSettings.assistantSize", "Assistant text size")}
          </span>
        </div>
        <Select
          style={{ width: 200 }}
          value={assistantTextSize}
          onChange={(value) => setAssistantTextSize(value)}
          options={sizeOptions}
        />
      </div>
    </dl>
  )
}

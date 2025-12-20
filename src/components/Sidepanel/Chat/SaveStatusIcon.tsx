import { Tooltip } from "antd"
import { Save } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useEffect, useRef } from "react"
import { useAntdNotification } from "@/hooks/useAntdNotification"

type SaveMode = "ephemeral" | "local" | "server"

interface SaveStatusIconProps {
  temporaryChat: boolean
  serverChatId?: string | null
  onClick?: () => void
}

/**
 * Save status indicator icon with color-coded state.
 *
 * Colors:
 * - Blue: Ephemeral (not saved)
 * - Gray: Saved locally
 * - Green: Saved to server
 */
export const SaveStatusIcon = ({
  temporaryChat,
  serverChatId,
  onClick
}: SaveStatusIconProps) => {
  const { t } = useTranslation(["sidepanel", "playground"])
  const notification = useAntdNotification()
  const previousServerChatIdRef = useRef<string | null | undefined>(serverChatId)

  // Monitor serverChatId for unexpected failures
  useEffect(() => {
    const previous = previousServerChatIdRef.current
    const current = serverChatId

    // If we had a server chat ID and it became null (save failed)
    if (previous && previous !== "" && !current && !temporaryChat) {
      notification.warning({
        message: t(
          "sidepanel:saveStatus.saveFailed",
          "Failed to save chat to server"
        ),
        description: t(
          "sidepanel:saveStatus.saveFailedDescription",
          "Chat is now saving locally only. Check your connection and try again."
        ),
        placement: "bottomRight",
        duration: 4
      })
    }

    previousServerChatIdRef.current = current
  }, [serverChatId, temporaryChat, notification, t])

  const saveMode: SaveMode = (() => {
    if (temporaryChat) return "ephemeral"
    if (serverChatId) return "server"
    return "local"
  })()

  const iconClassName = (() => {
    const base = "size-4 transition-colors"
    switch (saveMode) {
      case "ephemeral":
        return `${base} text-blue-500`
      case "server":
        return `${base} text-emerald-500`
      case "local":
      default:
        return `${base} text-gray-400 dark:text-gray-500`
    }
  })()

  const tooltip = (() => {
    switch (saveMode) {
      case "ephemeral":
        return t(
          "sidepanel:saveStatus.ephemeral",
          "Ephemeral: Not saved, cleared on close"
        )
      case "server":
        return t(
          "sidepanel:saveStatus.server",
          "Saved to server"
        )
      case "local":
      default:
        return t(
          "sidepanel:saveStatus.local",
          "Saved locally in this browser"
        )
    }
  })()

  return (
    <Tooltip title={tooltip}>
      <button
        type="button"
        onClick={onClick}
        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700"
        aria-label={tooltip}
      >
        <Save className={iconClassName} />
      </button>
    </Tooltip>
  )
}

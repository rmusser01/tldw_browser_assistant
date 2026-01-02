import logoImage from "~/assets/icon.png"
import { useMessage } from "~/hooks/useMessage"
import { Link } from "react-router-dom"
import { Tooltip } from "antd"
import { CogIcon, Menu } from "lucide-react"
import { useTranslation } from "react-i18next"
import React from "react"
import { StatusDot } from "./StatusDot"

type SidepanelHeaderSimpleProps = {
  sidebarOpen?: boolean
  setSidebarOpen?: (open: boolean) => void
  activeTitle?: string
}

/**
 * Simplified sidepanel header with minimal controls:
 * - Status dot (connection indicator)
 * - Logo + title
 * - New chat button
 * - Settings link
 *
 * All other controls moved to ControlRow in the composer area.
 */
export const SidepanelHeaderSimple = ({
  sidebarOpen: propSidebarOpen,
  setSidebarOpen: propSetSidebarOpen,
  activeTitle
}: SidepanelHeaderSimpleProps = {}) => {
  const { temporaryChat } = useMessage()
  const { t } = useTranslation(["sidepanel", "common", "option"])
  const [localSidebarOpen, setLocalSidebarOpen] = React.useState(false)
  const isControlled = typeof propSidebarOpen === "boolean"
  const sidebarOpen = isControlled
    ? (propSidebarOpen as boolean)
    : localSidebarOpen

  const handleSidebarToggle = () => {
    const next = !sidebarOpen
    if (!isControlled) {
      setLocalSidebarOpen(next)
      return
    }
    propSetSidebarOpen?.(next)
  }

  return (
    <div
      data-istemporary-chat={temporaryChat}
      data-testid="chat-header"
      className="absolute top-0 z-10 flex h-12 w-full items-center justify-between border-b border-border bg-surface px-4 py-2 text-body text-text data-[istemporary-chat='true']:bg-purple-50 data-[istemporary-chat='true']:dark:bg-purple-900/30"
    >
      {/* Left: Sidebar toggle + Status dot + Logo + Title */}
      <div className="flex items-center gap-2">
        <Tooltip
          title={
            sidebarOpen
              ? t("common:chatSidebar.collapse", "Collapse sidebar")
              : t("common:chatSidebar.expand", "Expand sidebar")
          }>
          <button
            type="button"
            aria-label={t("common:chatSidebar.expand", "Open sidebar")}
            onClick={handleSidebarToggle}
            className="rounded-md p-2 text-text-muted hover:bg-surface2 hover:text-text">
            <Menu className="size-4" />
          </button>
        </Tooltip>
        <StatusDot />
        <div className="flex items-center text-text">
          <img
            className="h-5 w-auto"
            src={logoImage}
            alt={t("common:pageAssist")}
          />
          <span className="ml-2 text-body font-medium">
            {t("common:pageAssist")}
          </span>
        </div>
        {activeTitle && (
          <span className="ml-2 hidden max-w-[12rem] truncate text-caption text-text-muted sm:inline">
            {activeTitle}
          </span>
        )}
      </div>

      {/* Right: Settings */}
      <div className="flex items-center gap-1">
        <Tooltip title={t("sidepanel:header.settingsShortLabel", "Settings")}>
          <Link
            to="/settings"
            aria-label={t("sidepanel:header.openSettingsAria") as string}
            className="rounded-md p-2 text-text-muted hover:bg-surface2 hover:text-text"
          >
            <CogIcon
              className="size-4"
              aria-hidden="true"
            />
          </Link>
        </Tooltip>
      </div>
    </div>
  )
}

import React from "react"
import type { TFunction } from "i18next"
import { Tooltip, Input } from "antd"
import { CogIcon, Menu, Search, Signpost, SquarePen, Keyboard, GitBranch } from "lucide-react"
import { ConnectionStatus } from "./ConnectionStatus"
import { HeaderShortcuts } from "./HeaderShortcuts"
import logoImage from "~/assets/icon.png"

type ChatHeaderProps = {
  t: TFunction
  temporaryChat: boolean
  historyId?: string | null
  chatTitle: string
  isEditingTitle: boolean
  onTitleChange: (value: string) => void
  onTitleEditStart: () => void
  onTitleCommit: (value: string) => void | Promise<void>
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
  onOpenCommandPalette: () => void
  onOpenShortcutsModal: () => void
  onOpenSettings: () => void
  onClearChat: () => void
  showTimelineButton?: boolean
  onOpenTimeline?: () => void
  shortcutsExpanded: boolean
  onToggleShortcuts: () => void
  commandKeyLabel: string
}

export function ChatHeader({
  t,
  temporaryChat,
  historyId,
  chatTitle,
  isEditingTitle,
  onTitleChange,
  onTitleEditStart,
  onTitleCommit,
  onToggleSidebar,
  sidebarCollapsed = false,
  onOpenCommandPalette,
  onOpenShortcutsModal,
  onOpenSettings,
  onClearChat,
  showTimelineButton = false,
  onOpenTimeline,
  shortcutsExpanded,
  onToggleShortcuts,
  commandKeyLabel
}: ChatHeaderProps) {
  const showSidebarToggle = Boolean(onToggleSidebar)
  const sidebarLabel = sidebarCollapsed
    ? t("common:chatSidebar.expand", "Expand sidebar")
    : t("common:chatSidebar.collapse", "Collapse sidebar")
  const shortcutsToggleLabel = shortcutsExpanded
    ? t("option:header.hideShortcuts", "Hide shortcuts")
    : t("option:header.showShortcuts", "Show shortcuts")
  const canEditTitle = !temporaryChat && historyId && historyId !== "temp"
  const timelineLabel = t("option:header.timeline", "Timeline")

  return (
    <header
      data-istemporary-chat={temporaryChat}
      data-ischat-route="true"
      className="z-30 flex w-full flex-col border-b border-border bg-surface/95 backdrop-blur data-[istemporary-chat='true']:bg-purple-900 data-[ischat-route='true']:bg-surface/95"
    >
      <div className="flex w-full items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {showSidebarToggle && (
            <Tooltip title={sidebarLabel} placement="bottom">
              <button
                type="button"
                onClick={onToggleSidebar}
                aria-label={sidebarLabel as string}
                className="rounded-md p-2 text-text-muted hover:bg-surface2 hover:text-text"
                title={sidebarLabel as string}
              >
                <Menu className="size-4" aria-hidden="true" />
              </button>
            </Tooltip>
          )}
          <ConnectionStatus showLabel={false} className="px-2 py-1" />
          <div className="flex items-center gap-2 text-text">
            <img
              src={logoImage}
              alt={t("common:pageAssist", "tldw Assistant")}
              className="h-5 w-auto"
            />
            <span className="text-sm font-medium">
              {t("common:pageAssist", "tldw Assistant")}
            </span>
            <Tooltip title={shortcutsToggleLabel} placement="bottom">
              <button
                type="button"
                onClick={onToggleShortcuts}
                aria-label={shortcutsToggleLabel as string}
                className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted hover:bg-surface2 hover:text-text"
                title={shortcutsToggleLabel}
              >
                <Signpost className="size-4" aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
          {canEditTitle && (
            <div className="hidden min-w-[140px] max-w-[220px] sm:block">
              {isEditingTitle ? (
                <Input
                  size="small"
                  autoFocus
                  value={chatTitle}
                  onChange={(e) => onTitleChange(e.target.value)}
                  onPressEnter={() => {
                    void onTitleCommit(chatTitle)
                  }}
                  onBlur={() => {
                    void onTitleCommit(chatTitle)
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={onTitleEditStart}
                  className="truncate text-left text-xs text-text-muted hover:text-text"
                  title={chatTitle || "Untitled"}
                >
                  {chatTitle || t("option:header.untitledChat", "Untitled")}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-text-muted transition hover:bg-surface2 hover:text-text sm:inline-flex"
            title={t("common:search", "Search")}
          >
            <Search className="size-4" aria-hidden="true" />
            <span>{t("common:search", "Search")}</span>
            <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-text-subtle">
              {commandKeyLabel}K
            </span>
          </button>
          <Tooltip
            title={t(
              "common:shortcuts.showKeyboardShortcuts",
              "Show keyboard shortcuts"
            )}
          >
            <button
              type="button"
              onClick={onOpenShortcutsModal}
              aria-label={
                t(
                  "common:shortcuts.showKeyboardShortcuts",
                  "Show keyboard shortcuts"
                ) as string
              }
              className="inline-flex items-center justify-center rounded-md border border-border p-2 text-text-muted hover:bg-surface2 hover:text-text"
              title={t(
                "common:shortcuts.showKeyboardShortcuts",
                "Show keyboard shortcuts"
              )}
            >
              <Keyboard className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
          {showTimelineButton && onOpenTimeline && (
            <Tooltip title={timelineLabel}>
              <button
                type="button"
                onClick={onOpenTimeline}
                aria-label={timelineLabel as string}
                className="inline-flex items-center justify-center rounded-md border border-border p-2 text-text-muted hover:bg-surface2 hover:text-text"
                title={timelineLabel}
              >
                <GitBranch className="size-4" aria-hidden="true" />
              </button>
            </Tooltip>
          )}
          <Tooltip title={t("common:newChat", "New chat")}>
            <button
              type="button"
              onClick={onClearChat}
              aria-label={t("common:newChat", "New chat") as string}
              className="inline-flex items-center justify-center rounded-md border border-border p-2 text-text-muted hover:bg-surface2 hover:text-text"
              title={t("common:newChat", "New chat")}
            >
              <SquarePen className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip title={t("sidepanel:header.settingsShortLabel", "Settings")}>
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={t("sidepanel:header.openSettingsAria", "Open settings") as string}
              className="inline-flex items-center justify-center rounded-md border border-border p-2 text-text-muted hover:bg-surface2 hover:text-text"
              title={t("sidepanel:header.settingsShortLabel", "Settings")}
            >
              <CogIcon className="size-4" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>
      <HeaderShortcuts className="px-4 pb-2 pt-1" showToggle={false} />
    </header>
  )
}

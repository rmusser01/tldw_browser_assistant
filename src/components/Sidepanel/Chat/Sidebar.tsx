import React from "react"
import { Tooltip } from "antd"
import {
  ChevronLeft,
  Pin,
  PinOff,
  Plus,
  Search,
  X
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { classNames } from "@/libs/class-name"
import type { SidepanelChatTab } from "@/store/sidepanel-chat-tabs"
import { useSidepanelChatTabsStore } from "@/store/sidepanel-chat-tabs"
import { useUiModeStore } from "@/store/ui-mode"
import { ModeToggle } from "./ModeToggle"

type SidebarGroup = {
  label: string
  items: SidepanelChatTab[]
}

type SidepanelChatSidebarProps = {
  open: boolean
  variant: "docked" | "overlay"
  tabs: SidepanelChatTab[]
  activeTabId: string | null
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onNewTab: () => void
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onClose?: () => void
}

const buildGroups = (tabs: SidepanelChatTab[], t: (key: string, fallback: string) => string): SidebarGroup[] => {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfToday.getDate() - 1)

  const today: SidepanelChatTab[] = []
  const yesterday: SidepanelChatTab[] = []
  const older: SidepanelChatTab[] = []

  tabs.forEach((tab) => {
    const updatedAt = new Date(tab.updatedAt)
    if (updatedAt >= startOfToday) {
      today.push(tab)
    } else if (updatedAt >= startOfYesterday) {
      yesterday.push(tab)
    } else {
      older.push(tab)
    }
  })

  const groups: SidebarGroup[] = []
  if (today.length > 0) {
    groups.push({
      label: t("common:today", "Today"),
      items: today
    })
  }
  if (yesterday.length > 0) {
    groups.push({
      label: t("common:yesterday", "Yesterday"),
      items: yesterday
    })
  }
  if (older.length > 0) {
    groups.push({
      label: t("common:older", "Older"),
      items: older
    })
  }
  return groups
}

export const SidepanelChatSidebar = ({
  open,
  variant,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  searchQuery,
  onSearchQueryChange,
  onClose
}: SidepanelChatSidebarProps) => {
  const { t } = useTranslation(["common", "sidepanel"])
  const togglePinned = useSidepanelChatTabsStore(
    (state) => state.togglePinned
  )
  const uiMode = useUiModeStore((state) => state.mode)
  const setUiMode = useUiModeStore((state) => state.setMode)
  const isPro = uiMode === "pro"
  const itemClass = isPro ? "px-2 py-1 text-caption" : "px-3 py-2 text-body"
  const groupGap = isPro ? "gap-1" : "gap-2"
  const groupSpacing = isPro ? "mb-3" : "mb-4"

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const sortedTabs = React.useMemo(
    () =>
      [...tabs].sort((a, b) => b.updatedAt - a.updatedAt),
    [tabs]
  )

  const filteredTabs = React.useMemo(() => {
    if (!normalizedQuery) return sortedTabs
    return sortedTabs.filter((tab) =>
      tab.label.toLowerCase().includes(normalizedQuery)
    )
  }, [normalizedQuery, sortedTabs])

  const pinnedTabs = filteredTabs.filter((tab) => tab.pinned)
  const unpinnedTabs = filteredTabs.filter((tab) => !tab.pinned)
  const groups = buildGroups(unpinnedTabs, (key, fallback) =>
    t(key as any, fallback)
  )

  const panelClass = classNames(
    "flex h-full min-h-0 flex-col border-r border-border bg-surface",
    variant === "overlay"
      ? `fixed left-0 top-0 z-40 w-72 shadow-card transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        }`
      : "w-72"
  )

  return (
    <aside className={panelClass} data-testid="sidepanel-chat-sidebar">
      <div
        className={classNames(
          "flex items-center justify-between border-b border-border",
          isPro ? "px-4 py-2" : "px-4 py-3"
        )}
      >
        <div className="text-body font-semibold text-text">
          {t("common:chatSidebar.title", "Chats")}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip title={t("common:chatSidebar.newChat", "New Chat")}>
            <button
              type="button"
              data-testid="sidepanel-sidebar-new-chat"
              onClick={onNewTab}
              className="rounded-md p-2 text-text-muted hover:bg-surface2 hover:text-text">
              <Plus className="size-4" />
            </button>
          </Tooltip>
          {variant === "overlay" ? (
            <Tooltip title={t("common:close", "Close")}>
              <button
                type="button"
                aria-label={t("common:close", "Close")}
                onClick={() => onClose?.()}
                className="rounded-md p-2 text-text-muted hover:bg-surface2 hover:text-text">
                <X className="size-4" />
              </button>
            </Tooltip>
          ) : (
            <Tooltip title={t("common:chatSidebar.collapse", "Collapse sidebar")}>
              <button
                type="button"
                aria-label={t("common:chatSidebar.collapse", "Collapse sidebar")}
                onClick={() => {
                  if (isPro) {
                    setUiMode("casual")
                    return
                  }
                  onClose?.()
                }}
                className="rounded-md p-2 text-text-muted hover:bg-surface2 hover:text-text">
                <ChevronLeft className="size-4" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="border-b border-border px-4 py-3">
        <label className="panel-input flex items-center gap-2">
          <Search className="size-4 text-text-subtle" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={t("common:chatSidebar.search", "Search chats...") as string}
            data-testid="sidepanel-sidebar-search"
            className="w-full bg-transparent text-body text-text outline-none placeholder:text-text-subtle"
          />
        </label>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        {pinnedTabs.length > 0 && (
          <div className={groupSpacing}>
            <div className="panel-section-label">
              {t("common:pinned", "Pinned")}
            </div>
            <div className={classNames("flex flex-col", groupGap)}>
              {pinnedTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={classNames(
                    "flex items-center justify-between rounded-md",
                    itemClass,
                    tab.id === activeTabId
                      ? "bg-surface2 text-text"
                      : "text-text-muted hover:bg-surface2 hover:text-text"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectTab(tab.id)}
                    className="flex-1 truncate text-left"
                    title={tab.label}
                  >
                    {tab.label}
                  </button>
                  <div className="flex items-center gap-1">
                    <Tooltip title={t("common:unpin", "Unpin")}>
                      <button
                        type="button"
                        onClick={() => togglePinned(tab.id)}
                        className="rounded p-1 text-text-subtle hover:bg-surface2 hover:text-text"
                        aria-label={t("common:unpin", "Unpin")}
                      >
                        <PinOff className="size-3" />
                      </button>
                    </Tooltip>
                    <Tooltip title={t("common:close", "Close")}>
                      <button
                        type="button"
                        onClick={() => onCloseTab(tab.id)}
                        className="rounded p-1 text-text-subtle hover:bg-surface2 hover:text-text"
                        aria-label={t("common:close", "Close")}
                      >
                        <X className="size-3" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label} className={groupSpacing}>
            <div className="panel-section-label">
              {group.label}
            </div>
            <div className={classNames("flex flex-col", groupGap)}>
              {group.items.map((tab) => (
                <div
                  key={tab.id}
                  className={classNames(
                    "flex items-center justify-between rounded-md",
                    itemClass,
                    tab.id === activeTabId
                      ? "bg-surface2 text-text"
                      : "text-text-muted hover:bg-surface2 hover:text-text"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectTab(tab.id)}
                    className="flex-1 truncate text-left"
                    title={tab.label}
                  >
                    {tab.label}
                  </button>
                  <div className="flex items-center gap-1">
                    <Tooltip title={t("common:pin", "Pin")}>
                      <button
                        type="button"
                        onClick={() => togglePinned(tab.id)}
                        className="rounded p-1 text-text-subtle hover:bg-surface2 hover:text-text"
                        aria-label={t("common:pin", "Pin")}
                      >
                        <Pin className="size-3" />
                      </button>
                    </Tooltip>
                    <Tooltip title={t("common:close", "Close")}>
                      <button
                        type="button"
                        onClick={() => onCloseTab(tab.id)}
                        className="rounded p-1 text-text-subtle hover:bg-surface2 hover:text-text"
                        aria-label={t("common:close", "Close")}
                      >
                        <X className="size-3" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-4 py-3">
        <ModeToggle />
      </div>

    </aside>
  )
}

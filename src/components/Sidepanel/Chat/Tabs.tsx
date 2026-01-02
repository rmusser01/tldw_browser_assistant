import React from "react"
import { Plus, X } from "lucide-react"
import { Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import { classNames } from "@/libs/class-name"
import type { SidepanelChatTab } from "@/store/sidepanel-chat-tabs"

type SidepanelChatTabsProps = {
  tabs: SidepanelChatTab[]
  activeTabId: string | null
  onSelect: (tabId: string) => void
  onClose: (tabId: string) => void
  onNewTab: () => void
}

export const SidepanelChatTabs = ({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onNewTab
}: SidepanelChatTabsProps) => {
  const { t } = useTranslation(["sidepanel", "common"])

  return (
    <div className="border-b border-border bg-surface">
      <div className="flex items-center gap-2 px-2 h-10">
        <div className="flex-1 overflow-x-auto custom-scrollbar" role="tablist">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId
              return (
                <div
                  key={tab.id}
                  className={classNames(
                    "flex items-center gap-1 rounded-md border px-2",
                    isActive
                      ? "border-border bg-surface2 text-text"
                      : "border-transparent text-text-muted hover:bg-surface2"
                  )}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onSelect(tab.id)}
                    className={classNames(
                      "max-w-[10rem] truncate px-2 py-1 text-xs font-medium",
                      isActive ? "text-text" : ""
                    )}
                    title={tab.label}
                  >
                    {tab.label}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onClose(tab.id)
                    }}
                    aria-label={t(
                      "sidepanel:tabs.closeTabAria",
                      "Close chat tab"
                    )}
                    className="rounded p-1 text-text-subtle hover:bg-surface2 hover:text-text"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
        <Tooltip title={t("sidepanel:tabs.newTabAria", "New chat tab")}>
          <button
            type="button"
            onClick={onNewTab}
            aria-label={t("sidepanel:tabs.newTabAria", "New chat tab")}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-muted hover:bg-surface2 hover:text-text"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

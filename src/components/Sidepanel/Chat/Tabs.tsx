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
    <div className="border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-[#171717]">
      <div className="flex items-center gap-2 px-2 h-10">
        <div className="flex-1 overflow-x-auto custom-scrollbar" role="tablist">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId
              return (
                <div
                  key={tab.id}
                  className={classNames(
                    "flex items-center gap-1 rounded-md border px-1.5",
                    isActive
                      ? "border-gray-400 bg-gray-100 text-gray-900 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100"
                      : "border-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  )}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onSelect(tab.id)}
                    className={classNames(
                      "max-w-[10rem] truncate px-1.5 py-1 text-xs font-medium",
                      isActive ? "text-gray-900 dark:text-gray-100" : ""
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
                    className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
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
            className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

import React, { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Input, Tooltip, Segmented } from "antd"
import {
  Plus,
  Search,
  UploadCloud,
  BookText,
  StickyNote,
  Settings,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { useStorage } from "@plasmohq/storage/hook"
import { Storage } from "@plasmohq/storage"

import { PageAssistDatabase } from "@/db/dexie/chat"
import type { HistoryInfo } from "@/db/dexie/types"
import { useConnectionState } from "@/hooks/useConnectionState"
import { useDebounce } from "@/hooks/useDebounce"
import { useServerChatHistory } from "@/hooks/useServerChatHistory"
import { useMessageOption } from "@/hooks/useMessageOption"
import { useFolderStore } from "@/store/folder"
import { cn } from "@/libs/utils"
import { LocalChatList } from "./ChatSidebar/LocalChatList"
import { ServerChatList } from "./ChatSidebar/ServerChatList"
import { FolderChatList } from "./ChatSidebar/FolderChatList"

const storage = new Storage({ area: "local" })

interface ChatSidebarProps {
  /** Whether sidebar is collapsed */
  collapsed?: boolean
  /** Toggle collapsed state */
  onToggleCollapse?: () => void
  /** Optional override for selected chat ID */
  selectedChatId?: string | null
  /** Optional callback when chat is selected */
  onSelectChat?: (chatId: string) => void
  /** Optional callback for new chat action */
  onNewChat?: () => void
  /** Optional callback for ingest action */
  onIngest?: () => void
  /** Additional class names */
  className?: string
}

type ChatGroup = {
  label: string
  items: HistoryInfo[]
}

type SidebarTab = "local" | "server" | "folders"

export function ChatSidebar({
  collapsed = false,
  onToggleCollapse,
  selectedChatId,
  onSelectChat,
  onNewChat,
  onIngest,
  className
}: ChatSidebarProps) {
  const { t } = useTranslation(["common", "sidepanel", "option"])
  const navigate = useNavigate()
  const { isConnected } = useConnectionState()
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Tab state persisted in localStorage
  const [activeTab, setActiveTab] = useStorage<SidebarTab>({
    key: "tldw:sidebar:activeTab",
    instance: storage
  })
  const currentTab = activeTab || "local"

  // Chat state
  const { historyId, clearChat, temporaryChat } = useMessageOption()

  // Folder conversation count for tab badge
  const conversationKeywordLinks = useFolderStore((s) => s.conversationKeywordLinks)
  const folderConversationCount = useMemo(
    () => new Set(conversationKeywordLinks.map((link) => link.conversation_id)).size,
    [conversationKeywordLinks]
  )

  // Server chat count for tab badge
  const { data: serverChatData } = useServerChatHistory(debouncedSearchQuery)
  const serverChats = serverChatData || []

  // Local chat count for tab badge
  const { data: chatHistoriesData } = useInfiniteQuery({
    queryKey: ["fetchChatHistory", debouncedSearchQuery],
    queryFn: async ({ pageParam = 1 }) => {
      try {
        const db = new PageAssistDatabase()
        const result = await db.getChatHistoriesPaginated(
          pageParam,
          debouncedSearchQuery || undefined
        )

        // Search mode: single "searchResults" group
        if (debouncedSearchQuery) {
          return {
            groups:
              result.histories.length > 0
                ? [{ label: "searchResults", items: result.histories }]
                : [],
            hasMore: result.hasMore,
            totalCount: result.totalCount
          }
        }

        // Date + pinned grouping with validated timestamps
        const now = new Date()
        const today = new Date(now.setHours(0, 0, 0, 0))
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const lastWeek = new Date(today)
        lastWeek.setDate(lastWeek.getDate() - 7)

        const pinnedItems: HistoryInfo[] = []
        const todayItems: HistoryInfo[] = []
        const yesterdayItems: HistoryInfo[] = []
        const lastWeekItems: HistoryInfo[] = []
        const olderItems: HistoryInfo[] = []

        for (const item of result.histories) {
          if (item.is_pinned) {
            pinnedItems.push(item)
            continue
          }

          const date = new Date(item.createdAt)
          const time = Number.isNaN(date.getTime()) ? null : date

          if (!time) {
            olderItems.push(item)
            continue
          }

          if (time >= today) {
            todayItems.push(item)
          } else if (time >= yesterday) {
            yesterdayItems.push(item)
          } else if (time >= lastWeek) {
            lastWeekItems.push(item)
          } else {
            olderItems.push(item)
          }
        }

        const groups: ChatGroup[] = []
        if (pinnedItems.length) groups.push({ label: "pinned", items: pinnedItems })
        if (todayItems.length) groups.push({ label: "today", items: todayItems })
        if (yesterdayItems.length) groups.push({ label: "yesterday", items: yesterdayItems })
        if (lastWeekItems.length)
          groups.push({ label: "last7Days", items: lastWeekItems })
        if (olderItems.length) groups.push({ label: "older", items: olderItems })

        return {
          groups,
          hasMore: result.hasMore,
          totalCount: result.totalCount
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch chat histories:", error)
        return {
          groups: [],
          hasMore: false,
          totalCount: 0
        }
      }
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
    initialPageParam: 1
  })

  // Calculate local chat count
  const localChatCount = useMemo(
    () =>
      chatHistoriesData?.pages.reduce((total, page) => {
        return total + page.groups.reduce((sum, group) => sum + group.items.length, 0)
      }, 0) || 0,
    [chatHistoriesData]
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const effectiveSelectedChatId = selectedChatId ?? historyId ?? null

  const handleNewChat = () => {
    if (onNewChat) {
      onNewChat()
    } else {
      clearChat()
    }
  }

  const handleIngest = () => {
    if (onIngest) {
      onIngest()
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tldw:open-quick-ingest"))
    }
  }

  // Build tab options with counts
  const tabOptions = [
    {
      value: "local" as SidebarTab,
      label: `${t("common:chatSidebar.tabs.local", "Local")}${localChatCount > 0 ? ` (${localChatCount})` : ""}`
    },
    {
      value: "server" as SidebarTab,
      label: `${t("common:chatSidebar.tabs.server", "Server")}${serverChats.length > 0 ? ` (${serverChats.length})` : ""}`
    },
    {
      value: "folders" as SidebarTab,
      label: `${t("common:chatSidebar.tabs.folders", "Folders")}${folderConversationCount > 0 ? ` (${folderConversationCount})` : ""}`
    }
  ]

  // Collapsed view - just icons
  if (collapsed) {
    return (
      <div
        data-testid="chat-sidebar"
        className={cn(
          "flex flex-col h-screen items-center py-4 gap-2 w-12 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900",
          className
        )}
      >
        <Tooltip
          title={t("common:chatSidebar.expand", "Expand sidebar")}
          placement="right"
        >
          <button
            data-testid="chat-sidebar-toggle"
            onClick={onToggleCollapse}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500"
          >
            <ChevronRight className="size-4" />
          </button>
        </Tooltip>

        <div className="h-px w-6 bg-gray-200 dark:bg-gray-700 my-2" />

        <Tooltip
          title={t("common:chatSidebar.newChat", "New Chat")}
          placement="right"
        >
          <button
            data-testid="chat-sidebar-new-chat"
            onClick={handleNewChat}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 hover:text-pink-600"
          >
            <Plus className="size-4" />
          </button>
        </Tooltip>

        <Tooltip
          title={t("common:chatSidebar.ingest", "Ingest Page")}
          placement="right"
        >
          <button
            onClick={handleIngest}
            disabled={!isConnected}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 hover:text-pink-600 disabled:opacity-50"
          >
            <UploadCloud className="size-4" />
            <span className="sr-only">
              {t("common:chatSidebar.ingest", "Ingest Page")}
            </span>
          </button>
        </Tooltip>

        <div className="h-px w-6 bg-gray-200 dark:bg-gray-700 my-2" />

        <Tooltip
          title={t("common:chatSidebar.media", "Media")}
          placement="right"
        >
          <button
            onClick={() => navigate("/media")}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500"
          >
            <BookText className="size-4" />
          </button>
        </Tooltip>

        <Tooltip
          title={t("common:chatSidebar.notes", "Notes")}
          placement="right"
        >
          <button
            onClick={() => navigate("/notes")}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500"
          >
            <StickyNote className="size-4" />
          </button>
        </Tooltip>

        <div className="flex-1" />

        <Tooltip
          title={t("common:chatSidebar.settings", "Settings")}
          placement="right"
        >
          <button
            onClick={() => navigate("/settings")}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500"
          >
            <Settings className="size-4" />
          </button>
        </Tooltip>
      </div>
    )
  }

  // Expanded view
  return (
    <div
      data-testid="chat-sidebar"
      className={cn(
        "flex flex-col h-screen w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">
          {t("common:chatSidebar.title", "Chats")}
        </h2>
        <div className="flex items-center gap-1">
          <Tooltip title={t("common:chatSidebar.newChat", "New Chat")}>
            <button
              data-testid="chat-sidebar-new-chat"
              onClick={handleNewChat}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 hover:text-pink-600"
            >
              <Plus className="size-4" />
            </button>
          </Tooltip>
          <Tooltip
            title={t("common:chatSidebar.collapse", "Collapse sidebar")}
          >
            <button
              data-testid="chat-sidebar-toggle"
              onClick={onToggleCollapse}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500"
            >
              <ChevronLeft className="size-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <Input
          data-testid="chat-sidebar-search"
          prefix={<Search className="size-3.5 text-gray-400" />}
          placeholder={t("common:chatSidebar.search", "Search chats...")}
          value={searchQuery}
          onChange={handleSearchChange}
          size="small"
          className="bg-white dark:bg-gray-800"
          allowClear
        />
      </div>

      {/* Tabs */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <Segmented
          value={currentTab}
          onChange={(value) => setActiveTab(value as SidebarTab)}
          options={tabOptions}
          block
          size="small"
          className="w-full"
        />
      </div>

      {/* Quick Actions */}
      <div className="px-3 py-2 space-y-1">
        <button
          onClick={handleIngest}
          disabled={!isConnected}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          <UploadCloud className="size-4" />
          <span>{t("common:chatSidebar.ingest", "Ingest Page")}</span>
        </button>
        <button
          onClick={() => navigate("/media")}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
        >
          <BookText className="size-4" />
          <span>{t("common:chatSidebar.media", "Media")}</span>
        </button>
        <button
          onClick={() => navigate("/notes")}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
        >
          <StickyNote className="size-4" />
          <span>{t("common:chatSidebar.notes", "Notes")}</span>
        </button>
      </div>

      <div className="h-px bg-gray-200 dark:bg-gray-700 mx-3" />

      {/* Tab Content */}
      <div
        className={cn(
          "flex-1 overflow-y-auto",
          temporaryChat ? "pointer-events-none opacity-50" : ""
        )}
      >
        {currentTab === "local" && (
          <LocalChatList
            searchQuery={debouncedSearchQuery}
            selectedChatId={effectiveSelectedChatId}
            onSelectChat={onSelectChat}
          />
        )}

        {currentTab === "server" && (
          <ServerChatList
            searchQuery={debouncedSearchQuery}
          />
        )}

        {currentTab === "folders" && (
          <FolderChatList
            onSelectChat={onSelectChat}
          />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2">
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
        >
          <Settings className="size-4" />
          <span>{t("common:chatSidebar.settings", "Settings")}</span>
        </button>
      </div>
    </div>
  )
}

export default ChatSidebar

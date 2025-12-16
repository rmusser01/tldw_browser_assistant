import React, { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { Input, Tooltip, Spin } from "antd"
import {
  MessageSquare,
  Plus,
  Search,
  UploadCloud,
  BookText,
  StickyNote,
  Settings,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Edit3,
  Clock,
} from "lucide-react"
import { PageAssistDatabase } from "@/db/dexie/chat"
import { useConnectionState } from "@/hooks/useConnectionState"
import { cn } from "@/libs/utils"

interface ChatSidebarProps {
  /** Whether sidebar is collapsed */
  collapsed?: boolean
  /** Toggle collapsed state */
  onToggleCollapse?: () => void
  /** Currently selected chat ID */
  selectedChatId?: string | null
  /** Callback when chat is selected */
  onSelectChat?: (chatId: string) => void
  /** Callback for new chat action */
  onNewChat?: () => void
  /** Callback for ingest action */
  onIngest?: () => void
  /** Additional class names */
  className?: string
}

/** Chat item with normalized timestamp fields */
interface ChatHistoryItem {
  id: string
  title: string
  createdAtMs: number
  updatedAtMs?: number | null
}

/**
 * Group chats by date (Today, Yesterday, This Week, Older)
 */
function groupChatsByDate(chats: ChatHistoryItem[]): Record<string, ChatHistoryItem[]> {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: Record<string, ChatHistoryItem[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  }

  for (const chat of chats) {
    const chatDate = new Date(chat.updatedAtMs || chat.createdAtMs)
    if (chatDate >= today) {
      groups.today.push(chat)
    } else if (chatDate >= yesterday) {
      groups.yesterday.push(chat)
    } else if (chatDate >= weekAgo) {
      groups.thisWeek.push(chat)
    } else {
      groups.older.push(chat)
    }
  }

  return groups
}

/**
 * Format relative time (e.g., "2h ago", "Yesterday")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

export function ChatSidebar({
  collapsed = false,
  onToggleCollapse,
  selectedChatId,
  onSelectChat,
  onNewChat,
  onIngest,
  className,
}: ChatSidebarProps) {
  const { t } = useTranslation(["common", "sidepanel"])
  const navigate = useNavigate()
  const { isConnected } = useConnectionState()
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch local chats from IndexedDB
  const { data: chats, isLoading, error } = useQuery({
    queryKey: ["localChatHistory", searchQuery],
    queryFn: async (): Promise<ChatHistoryItem[]> => {
      const db = new PageAssistDatabase()
      const result = await db.getChatHistoriesPaginated(1, searchQuery || undefined)
      return result.histories.map((h) => ({
        id: h.id,
        title: h.title,
        createdAtMs: h.createdAt,
        updatedAtMs: h.createdAt, // HistoryInfo doesn't have updatedAt, use createdAt
      }))
    },
    staleTime: 10_000,
  })

  const groupedChats = useMemo(() => {
    if (!chats) return null
    return groupChatsByDate(chats)
  }, [chats])

  const groupLabels: Record<string, string> = {
    today: t("common:chatSidebar.today", "Today"),
    yesterday: t("common:chatSidebar.yesterday", "Yesterday"),
    thisWeek: t("common:chatSidebar.thisWeek", "This Week"),
    older: t("common:chatSidebar.older", "Older"),
  }

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
        <Tooltip title={t("common:chatSidebar.expand", "Expand sidebar")} placement="right">
          <button
            data-testid="chat-sidebar-toggle"
            onClick={onToggleCollapse}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500"
          >
            <ChevronRight className="size-4" />
          </button>
        </Tooltip>

        <div className="h-px w-6 bg-gray-200 dark:bg-gray-700 my-2" />

        <Tooltip title={t("common:chatSidebar.newChat", "New Chat")} placement="right">
          <button
            data-testid="chat-sidebar-new-chat"
            onClick={onNewChat}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 hover:text-pink-600"
          >
            <Plus className="size-4" />
          </button>
        </Tooltip>

        <Tooltip title={t("common:chatSidebar.ingest", "Ingest Page")} placement="right">
          <button
            onClick={onIngest}
            disabled={!isConnected}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 hover:text-pink-600 disabled:opacity-50"
          >
            <UploadCloud className="size-4" />
          </button>
        </Tooltip>

        <div className="h-px w-6 bg-gray-200 dark:bg-gray-700 my-2" />

        <Tooltip title={t("common:chatSidebar.media", "Media")} placement="right">
          <button
            onClick={() => navigate("/media")}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500"
          >
            <BookText className="size-4" />
          </button>
        </Tooltip>

        <Tooltip title={t("common:chatSidebar.notes", "Notes")} placement="right">
          <button
            onClick={() => navigate("/notes")}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500"
          >
            <StickyNote className="size-4" />
          </button>
        </Tooltip>

        <div className="flex-1" />

        <Tooltip title={t("common:chatSidebar.settings", "Settings")} placement="right">
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
              onClick={onNewChat}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 hover:text-pink-600"
            >
              <Plus className="size-4" />
            </button>
          </Tooltip>
          <Tooltip title={t("common:chatSidebar.collapse", "Collapse sidebar")}>
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
      <div className="px-3 py-2">
        <Input
          data-testid="chat-sidebar-search"
          prefix={<Search className="size-3.5 text-gray-400" />}
          placeholder={t("common:chatSidebar.search", "Search chats...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          className="bg-white dark:bg-gray-800"
          allowClear
        />
      </div>

      {/* Quick Actions */}
      <div className="px-3 py-2 space-y-1">
        <button
          onClick={onIngest}
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

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-1 py-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spin size="small" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-sm text-gray-500">
            {t("common:chatSidebar.loadError", "Failed to load chats")}
          </div>
        ) : !groupedChats || Object.values(groupedChats).every((g) => g.length === 0) ? (
          <div className="text-center py-8 text-sm text-gray-500">
            {searchQuery
              ? t("common:chatSidebar.noResults", "No matching chats")
              : t("common:chatSidebar.empty", "No chats yet")}
          </div>
        ) : (
          <>
            {(["today", "yesterday", "thisWeek", "older"] as const).map((group) => {
              const items = groupedChats[group]
              if (!items?.length) return null

              return (
                <div key={group} className="mb-3">
                  <div className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                    {groupLabels[group]}
                  </div>
                  {items.map((chat) => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      selected={chat.id === selectedChatId}
                      onClick={() => onSelectChat?.(chat.id)}
                    />
                  ))}
                </div>
              )
            })}
          </>
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

/**
 * Individual chat item in the sidebar
 */
function ChatItem({
  chat,
  selected,
  onClick,
}: {
  chat: ChatHistoryItem
  selected: boolean
  onClick: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        setShowMenu(true)
      }}
      className={cn(
        "group flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left text-sm transition-colors",
        selected
          ? "bg-pink-100 dark:bg-pink-900/30 text-pink-900 dark:text-pink-100"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
      )}
    >
      <MessageSquare className={cn("size-4 shrink-0", selected ? "text-pink-600" : "text-gray-400")} />
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">
          {chat.title || "Untitled Chat"}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <Clock className="size-2.5" />
          <span>{formatRelativeTime(chat.updatedAtMs || chat.createdAtMs)}</span>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setShowMenu(!showMenu)
        }}
        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-300 dark:hover:bg-gray-700"
      >
        <MoreHorizontal className="size-3.5 text-gray-400" />
      </button>
    </button>
  )
}

export default ChatSidebar

import React, { useState, useMemo, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query"
import {
  Input,
  Tooltip,
  Spin,
  Empty,
  Skeleton,
  Dropdown,
  Menu,
  Modal,
  Button,
  message
} from "antd"
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
  Trash2,
  Edit3,
  Clock,
  MoreHorizontal,
  ChevronDown,
  PinIcon,
  PinOffIcon,
  BotIcon,
  GitBranch,
  FolderIcon
} from "lucide-react"

import { PageAssistDatabase } from "@/db/dexie/chat"
import {
  deleteByHistoryId,
  deleteHistoriesByDateRange,
  formatToChatHistory,
  formatToMessage,
  getSessionFiles,
  getPromptById,
  getHistoriesWithMetadata,
  updateHistory,
  pinHistory
} from "@/db/dexie/helpers"
import { lastUsedChatModelEnabled } from "@/services/model-settings"
import { isDatabaseClosedError } from "@/utils/ff-error"
import { updatePageTitle } from "@/utils/update-page-title"
import { useConnectionState } from "@/hooks/useConnectionState"
import { useDebounce } from "@/hooks/useDebounce"
import { useConfirmDanger } from "@/components/Common/confirm-danger"
import { IconButton } from "../Common/IconButton"
import { useServerChatHistory } from "@/hooks/useServerChatHistory"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { useMessageOption } from "@/hooks/useMessageOption"
import { useStoreChatModelSettings } from "@/store/model"
import { FolderTree, FolderToolbar } from "@/components/Folders"
import {
  useFolderStore,
  useFolderViewMode,
  useFolderActions
} from "@/store/folder"
import { cn } from "@/libs/utils"

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

// Relative time helper (aligned with legacy sidebar translations)
const formatRelativeTime = (
  timestamp: number,
  t: (key: string, options?: any) => string
) => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return t("common:justNow", { defaultValue: "Just now" })
  if (minutes < 60) {
    return t("common:minutesAgo", {
      count: minutes,
      defaultValue: `${minutes}m ago`
    })
  }
  if (hours < 24) {
    return t("common:hoursAgo", {
      count: hours,
      defaultValue: `${hours}h ago`
    })
  }
  if (days < 7) {
    return t("common:daysAgo", {
      count: days,
      defaultValue: `${days}d ago`
    })
  }
  return new Date(timestamp).toLocaleDateString()
}

// Message preview helper
const truncateMessage = (content: string, maxLength: number = 60) => {
  if (!content) return ""
  const cleaned = content.replace(/[#*_`~\[\]]/g, "").trim()
  if (cleaned.length <= maxLength) return cleaned
  return cleaned.substring(0, maxLength).trim() + "..."
}

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
  const queryClient = useQueryClient()
  const confirmDanger = useConfirmDanger()

  // Chat state shared with main chat view
  const {
    setMessages,
    setHistory,
    setHistoryId,
    historyId,
    clearChat,
    setSelectedModel,
    setSelectedSystemPrompt,
    setContextFiles,
    temporaryChat,
    serverChatId,
    setServerChatId,
    setServerChatState,
    setServerChatTopic,
    setServerChatClusterId,
    setServerChatSource,
    setServerChatExternalRef
  } = useMessageOption()
  const { setSystemPrompt } = useStoreChatModelSettings()

  // Folder system state
  const viewMode = useFolderViewMode()
  const folderKeywordLinks = useFolderStore((s) => s.folderKeywordLinks)
  const conversationKeywordLinks = useFolderStore((s) => s.conversationKeywordLinks)
  const { refreshFromServer, addConversationToFolder, removeConversationFromFolder } =
    useFolderActions()
  const [folderPickerOpen, setFolderPickerOpen] = useState(false)
  const [folderPickerChatId, setFolderPickerChatId] = useState<string | null>(null)
  const folderRefreshInFlightRef = useRef<Promise<void> | null>(null)

  const FolderPicker = useMemo(
    () =>
      React.lazy(
        () =>
          import("@/components/Folders/FolderPicker").then((m) => ({
            default: m.FolderPicker
          }))
      ),
    []
  )

  // Load folders when folder view is active
  useEffect(() => {
    if (isConnected && viewMode === "folders") {
      if (folderRefreshInFlightRef.current) return
      const refreshPromise = refreshFromServer().finally(() => {
        if (folderRefreshInFlightRef.current === refreshPromise) {
          folderRefreshInFlightRef.current = null
        }
      })
      folderRefreshInFlightRef.current = refreshPromise
    }
  }, [isConnected, viewMode, refreshFromServer])

  // Server chat history
  const {
    data: serverChatData,
    status: serverStatus,
    isLoading: isServerLoading
  } = useServerChatHistory(debouncedSearchQuery)
  const serverChats = serverChatData || []

  // Local chat history (mirrors legacy sidebar)
  const [dexiePrivateWindowError, setDexiePrivateWindowError] = useState(false)
  const [deleteGroup, setDeleteGroup] = useState<string | null>(null)
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null)

  const {
    data: chatHistoriesData,
    status,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLocalLoading
  } = useInfiniteQuery({
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

        // Date + pinned grouping
        const now = new Date()
        const today = new Date(now.setHours(0, 0, 0, 0))
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const lastWeek = new Date(today)
        lastWeek.setDate(lastWeek.getDate() - 7)

        const pinnedItems = result.histories.filter((item) => item.is_pinned)
        const todayItems = result.histories.filter(
          (item) => !item.is_pinned && new Date(item?.createdAt) >= today
        )
        const yesterdayItems = result.histories.filter(
          (item) =>
            !item.is_pinned &&
            new Date(item?.createdAt) >= yesterday &&
            new Date(item?.createdAt) < today
        )
        const lastWeekItems = result.histories.filter(
          (item) =>
            !item.is_pinned &&
            new Date(item?.createdAt) >= lastWeek &&
            new Date(item?.createdAt) < yesterday
        )
        const olderItems = result.histories.filter(
          (item) => !item.is_pinned && new Date(item?.createdAt) < lastWeek
        )

        const groups: Array<{ label: string; items: any[] }> = []
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
      } catch (e) {
        setDexiePrivateWindowError(isDatabaseClosedError(e))
        return {
          groups: [],
          hasMore: false,
          totalCount: 0
        }
      }
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
    placeholderData: undefined,
    enabled: true,
    initialPageParam: 1
  })

  // Flatten all groups from all pages
  const chatHistories =
    chatHistoriesData?.pages.reduce(
      (acc, page) => {
        page.groups.forEach((group: { label: string; items: any[] }) => {
          const existingGroup = acc.find((g) => g.label === group.label)
          if (existingGroup) {
            existingGroup.items.push(...group.items)
          } else {
            acc.push({ ...group })
          }
        })
        return acc
      },
      [] as Array<{ label: string; items: any[] }>
    ) || []

  // Collect all history IDs for metadata fetching
  const allHistoryIds = chatHistories.flatMap((group) =>
    group.items.map((item) => item.id)
  )

  const { data: historyMetadata } = useQuery({
    queryKey: ["historyMetadata", allHistoryIds.join(",")],
    queryFn: async () => {
      if (allHistoryIds.length === 0) return new Map()
      return getHistoriesWithMetadata(allHistoryIds)
    },
    enabled: allHistoryIds.length > 0,
    staleTime: 30_000
  })

  // Delete single history
  const { mutate: deleteHistory } = useMutation({
    mutationKey: ["deleteHistory"],
    mutationFn: deleteByHistoryId,
    onSuccess: (deletedId: string) => {
      queryClient.invalidateQueries({ queryKey: ["fetchChatHistory"] })
      if (historyId === deletedId) {
        clearChat()
        updatePageTitle()
      }
    }
  })

  // Edit history title
  const { mutate: editHistory } = useMutation({
    mutationKey: ["editHistory"],
    mutationFn: async (data: { id: string; title: string }) => {
      return await updateHistory(data.id, data.title)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fetchChatHistory"] })
    }
  })

  // Delete by date range
  const { mutate: deleteHistoriesByRange, isPending: deleteRangeLoading } = useMutation({
    mutationKey: ["deleteHistoriesByRange"],
    mutationFn: async (rangeLabel: string) => {
      setDeleteGroup(rangeLabel)
      return await deleteHistoriesByDateRange(rangeLabel)
    },
    onSuccess: (deletedIds: string[]) => {
      queryClient.invalidateQueries({ queryKey: ["fetchChatHistory"] })
      if (deletedIds.includes(historyId as string)) {
        clearChat()
      }
      message.success(t("common:historiesDeleted", { count: deletedIds.length }))
    },
    onError: (error) => {
      // eslint-disable-next-line no-console
      console.error("Failed to delete histories:", error)
      message.error(t("common:deleteHistoriesError"))
    }
  })

  const handleDeleteHistoriesByRange = async (rangeLabel: string) => {
    const ok = await confirmDanger({
      title: t("common:confirmTitle", { defaultValue: "Please confirm" }),
      content: t(`common:range:deleteConfirm:${rangeLabel}`),
      okText: t("common:delete", { defaultValue: "Delete" }),
      cancelText: t("common:cancel", { defaultValue: "Cancel" })
    })
    if (!ok) return
    deleteHistoriesByRange(rangeLabel)
  }

  // Pin/unpin
  const { mutate: pinChatHistory, isPending: pinLoading } = useMutation({
    mutationKey: ["pinHistory"],
    mutationFn: async (data: { id: string; is_pinned: boolean }) => {
      return await pinHistory(data.id, data.is_pinned)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fetchChatHistory"] })
    }
  })

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const clearSearch = () => {
    setSearchQuery("")
  }

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }

  // Load a local Dexie-backed conversation
  const loadLocalConversation = React.useCallback(
    async (conversationId: string) => {
      try {
        const db = new PageAssistDatabase()
        const [history, historyDetails] = await Promise.all([
          db.getChatHistory(conversationId),
          db.getHistoryInfo(conversationId)
        ])

        setServerChatId(null)
        setHistoryId(conversationId)
        setHistory(formatToChatHistory(history))
        setMessages(formatToMessage(history))

        const isLastUsedChatModel = await lastUsedChatModelEnabled()
        if (isLastUsedChatModel && historyDetails?.model_id) {
          setSelectedModel(historyDetails.model_id)
        }

        const lastUsedPrompt = historyDetails?.last_used_prompt
        if (lastUsedPrompt) {
          let promptContent = lastUsedPrompt.prompt_content ?? ""
          if (lastUsedPrompt.prompt_id) {
            const prompt = await getPromptById(lastUsedPrompt.prompt_id)
            if (prompt) {
              setSelectedSystemPrompt(prompt.id)
              if (!promptContent.trim()) {
                promptContent = prompt.content
              }
            }
          }
          setSystemPrompt(promptContent)
        }

        const session = await getSessionFiles(conversationId)
        setContextFiles(session)

        updatePageTitle(
          historyDetails?.title || t("common:untitled", { defaultValue: "Untitled" })
        )
        navigate("/")

        return { history, historyDetails }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to load local chat history from local storage:", error)
        message.error(
          t("common:error.friendlyLocalHistorySummary", {
            defaultValue: "Something went wrong while loading local chat history."
          })
        )
        return null
      }
    },
    [
      navigate,
      setContextFiles,
      setHistory,
      setHistoryId,
      setMessages,
      setSelectedModel,
      setSelectedSystemPrompt,
      setServerChatId,
      setSystemPrompt,
      t
    ]
  )

  // Handle folder selection for a chat
  const handleFolderSelect = async (folderIds: number[]) => {
    const conversationId = folderPickerChatId
    try {
      if (!conversationId) return

      const uniqueFolderIds = Array.from(new Set(folderIds))
      const results = await Promise.allSettled(
        uniqueFolderIds.map((folderId) =>
          addConversationToFolder(conversationId, folderId)
        )
      )

      const succeededFolderIds: number[] = []
      const failedFolderAdds: Array<{ folderId: number; reason: unknown }> = []

      results.forEach((result, index) => {
        const folderId = uniqueFolderIds[index]
        if (result.status === "fulfilled" && result.value) {
          succeededFolderIds.push(folderId)
          return
        }

        failedFolderAdds.push({
          folderId,
          reason:
            result.status === "rejected"
              ? result.reason
              : "addConversationToFolder returned false"
        })
      })

      if (failedFolderAdds.length > 0) {
        // eslint-disable-next-line no-console
        console.error("Failed to move chat to folder(s):", {
          conversationId,
          failedFolderAdds,
          succeededFolderIds
        })

        if (succeededFolderIds.length > 0) {
          const rollbackResults = await Promise.allSettled(
            succeededFolderIds.map((folderId) =>
              removeConversationFromFolder(conversationId, folderId)
            )
          )

          const rollbackFailures: Array<{ folderId: number; reason: unknown }> = []

          rollbackResults.forEach((result, index) => {
            const folderId = succeededFolderIds[index]
            if (result.status === "fulfilled" && result.value) {
              return
            }

            rollbackFailures.push({
              folderId,
              reason:
                result.status === "rejected"
                  ? result.reason
                  : "removeConversationFromFolder returned false"
            })
          })

          if (rollbackFailures.length > 0) {
            // eslint-disable-next-line no-console
            console.error("Failed to rollback folder move after errors:", {
              conversationId,
              rollbackFailures
            })
          }
        }

        message.error(
          t("common:error.friendlyGenericSummary", {
            defaultValue: "Something went wrong while talking to your tldw server."
          })
        )
        return
      }

      message.success(t("common:success"))
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to move chat to folder(s):", error)
      message.error(
        t("common:error.friendlyGenericSummary", {
          defaultValue: "Something went wrong while talking to your tldw server."
        })
      )
    } finally {
      setFolderPickerOpen(false)
      setFolderPickerChatId(null)
    }
  }

  // Conversations referenced by folders (for FolderTree)
  const folderConversationIds = useMemo(() => {
    if (folderKeywordLinks.length === 0 || conversationKeywordLinks.length === 0) {
      return []
    }

    const folderKeywordIdSet = new Set(
      folderKeywordLinks.map((link) => link.keyword_id)
    )
    const conversationIdSet = new Set<string>()

    conversationKeywordLinks.forEach((link) => {
      if (folderKeywordIdSet.has(link.keyword_id)) {
        conversationIdSet.add(link.conversation_id)
      }
    })

    return Array.from(conversationIdSet)
  }, [conversationKeywordLinks, folderKeywordLinks])

  const loadedConversationTitleById = useMemo(() => {
    const titleById = new Map<string, string>()
    chatHistories.forEach((group) => {
      group.items.forEach((item) => {
        if (item?.id) {
          titleById.set(String(item.id), String(item.title ?? ""))
        }
      })
    })
    return titleById
  }, [chatHistories])

  const missingFolderConversationIds = useMemo(
    () =>
      folderConversationIds.filter(
        (conversationId) => !loadedConversationTitleById.has(conversationId)
      ),
    [folderConversationIds, loadedConversationTitleById]
  )

  const stableMissingFolderConversationIds = useMemo(
    () => [...missingFolderConversationIds].sort(),
    [missingFolderConversationIds]
  )

  const { data: missingFolderConversationTitles = [] } = useQuery({
    queryKey: ["folderConversationTitles", stableMissingFolderConversationIds],
    queryFn: async () => {
      const db = new PageAssistDatabase()
      const results = await Promise.all(
        stableMissingFolderConversationIds.map(async (conversationId) => {
          try {
            const historyInfo = await db.getHistoryInfo(conversationId)
            return {
              id: conversationId,
              title: historyInfo?.title || ""
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              "Failed to load local history info for folder conversation:",
              conversationId,
              error
            )
            return {
              id: conversationId,
              title: ""
            }
          }
        })
      )
      return results
    },
    enabled:
      isConnected &&
      viewMode === "folders" &&
      stableMissingFolderConversationIds.length > 0,
    staleTime: 30_000
  })

  const folderTreeConversations = useMemo(() => {
    const titleById = new Map<string, string>(loadedConversationTitleById)
    missingFolderConversationTitles.forEach((entry) => {
      titleById.set(entry.id, entry.title)
    })

    return folderConversationIds.map((conversationId) => ({
      id: conversationId,
      title: titleById.get(conversationId) || ""
    }))
  }, [
    folderConversationIds,
    loadedConversationTitleById,
    missingFolderConversationTitles
  ])

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

      {/* Search + Folder view toggle */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
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
          {isConnected && <FolderToolbar compact />}
        </div>
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

      {/* Chat History + Folders */}
      <div
        className={cn(
          "flex-1 overflow-y-auto px-2 py-2",
          temporaryChat ? "pointer-events-none opacity-50" : ""
        )}
      >
        {/* Empty state when nothing to show */}
        {status === "success" &&
          chatHistories.length === 0 &&
          serverStatus === "success" &&
          serverChats.length === 0 &&
          !dexiePrivateWindowError && (
            <div className="flex justify-center items-center mt-10 overflow-hidden">
              <Empty description={t("common:noHistory")} />
            </div>
          )}

        {/* Dexie private window error (Firefox private mode) */}
        {dexiePrivateWindowError && (
          <div className="flex justify-center items-center mt-10 overflow-hidden">
            <Empty
              description={t("common:privateWindow", {
                defaultValue:
                  "Don't worry, this is a known issue on Firefox: IndexedDB does not work in private mode. Please open the extension in a normal window to view your chat history."
              })}
            />
          </div>
        )}

        {/* Local history loading */}
        {(status === "pending" || isLocalLoading) && (
          <div className="flex justify-center items-center mt-5">
            <Skeleton active paragraph={{ rows: 8 }} />
          </div>
        )}

        {/* Server chat loading skeleton */}
        {serverStatus === "pending" && isServerLoading && (
          <div className="flex justify-center items-center mt-2">
            <Skeleton active paragraph={{ rows: 2 }} />
          </div>
        )}

        {/* Server chat list error */}
        {serverStatus === "error" && (
          <div className="flex justify-center items-center mt-2 px-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t("common:serverChatsUnavailable", {
                defaultValue: isConnected
                  ? "Server chats unavailable right now. Check your server logs or try again."
                  : "Server chats are available once you connect to your tldw server."
              })}
            </span>
          </div>
        )}

        {/* Local history query error */}
        {status === "error" && (
          <div className="flex justify-center items-center">
            <span className="text-red-500">
              {t("common:chatSidebar.loadError", "Failed to load chats")}
            </span>
          </div>
        )}

        {/* Local history timeline with groups + actions */}
        {status === "success" && chatHistories.length > 0 && (
          <div className="flex flex-col gap-2">
            {chatHistories.map((group, groupIndex) => (
              <div key={groupIndex}>
                <div className="flex items-center justify-between mt-2 px-1">
                  <h3 className="px-2 text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                    {group.label === "searchResults"
                      ? t("common:searchResults")
                      : t(`common:date:${group.label}`)}
                  </h3>
                  {group.label !== "searchResults" && (
                    <Tooltip
                      title={t(`common:range:tooltip:${group.label}`)}
                      placement="top"
                    >
                      <button
                        onClick={() => handleDeleteHistoriesByRange(group.label)}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800"
                      >
                        {deleteRangeLoading && deleteGroup === group.label ? (
                          <Spin size="small" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200" />
                        )}
                      </button>
                    </Tooltip>
                  )}
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  {group.items.map((chat: any) => (
                    <div
                      key={chat.id}
                      className={cn(
                        "flex py-2 px-2 items-start gap-2 relative rounded-md group transition-opacity duration-300 ease-in-out border",
                        effectiveSelectedChatId === chat.id
                          ? "bg-gray-200 dark:bg-[#454242] border-gray-400 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                          : "bg-gray-50 dark:bg-[#232222] dark:text-gray-100 text-gray-800 border-gray-300 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-[#2d2d2d]"
                      )}
                    >
                      {chat?.message_source === "copilot" && (
                        <BotIcon className="size-3 text-gray-500 dark:text-gray-400 mt-1 flex-shrink-0" />
                      )}
                      {chat?.message_source === "branch" && (
                        <GitBranch className="size-3 text-gray-500 dark:text-gray-400 mt-1 flex-shrink-0" />
                      )}
                      <button
                        className="flex-1 overflow-hidden text-start w-full min-w-0"
                        onClick={() => {
                          void loadLocalConversation(chat.id)
                          onSelectChat?.(chat.id)
                        }}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="truncate font-medium">
                            {chat.title}
                          </span>
                          {historyMetadata?.get(chat.id) && (
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="size-3" />
                                {historyMetadata.get(chat.id)?.messageCount || 0}
                              </span>
                              {historyMetadata.get(chat.id)?.lastMessage && (
                                <span>
                                  {formatRelativeTime(
                                    historyMetadata.get(chat.id)?.lastMessage
                                      ?.createdAt || chat.createdAt,
                                    t
                                  )}
                                </span>
                              )}
                            </div>
                          )}
                          {historyMetadata?.get(chat.id)?.lastMessage && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {truncateMessage(
                                historyMetadata.get(chat.id)?.lastMessage?.content ||
                                  ""
                              )}
                            </span>
                          )}
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <Dropdown
                          overlay={
                            <Menu id={`history-actions-${chat.id}`}>
                              <Menu.Item
                                key="pin"
                                icon={
                                  chat.is_pinned ? (
                                    <PinOffIcon className="w-4 h-4" />
                                  ) : (
                                    <PinIcon className="w-4 h-4" />
                                  )
                                }
                                onClick={() =>
                                  pinChatHistory({
                                    id: chat.id,
                                    is_pinned: !chat.is_pinned
                                  })
                                }
                                disabled={pinLoading}
                              >
                                {chat.is_pinned
                                  ? t("common:unpin")
                                  : t("common:pin")}
                              </Menu.Item>
                              {isConnected && (
                                <Menu.Item
                                  key="moveToFolder"
                                  icon={<FolderIcon className="w-4 h-4" />}
                                  onClick={() => {
                                    setFolderPickerChatId(chat.id)
                                    setFolderPickerOpen(true)
                                    setOpenMenuFor(null)
                                  }}
                                >
                                  {t("common:moveToFolder")}
                                </Menu.Item>
                              )}
                              <Menu.Item
                                key="edit"
                                icon={<Edit3 className="w-4 h-4" />}
                                onClick={async () => {
                                  const newTitle = window.prompt(
                                    t("common:renameChat", {
                                      defaultValue: "Rename chat"
                                    }),
                                    chat.title
                                  )
                                  if (newTitle && newTitle.trim() !== chat.title) {
                                    editHistory({
                                      id: chat.id,
                                      title: newTitle.trim()
                                    })
                                  }
                                }}
                              >
                                {t("common:rename")}
                              </Menu.Item>
                              <Menu.Item
                                key="delete"
                                icon={<Trash2 className="w-4 h-4" />}
                                onClick={async () => {
                                  const ok = await confirmDanger({
                                    title: t("common:confirmTitle", {
                                      defaultValue: "Please confirm"
                                    }),
                                    content: t("deleteHistoryConfirmation"),
                                    okText: t("common:delete", {
                                      defaultValue: "Delete"
                                    }),
                                    cancelText: t("common:cancel", {
                                      defaultValue: "Cancel"
                                    })
                                  })
                                  if (!ok) return
                                  deleteHistory(chat.id)
                                }}
                              >
                                {t("common:delete")}
                              </Menu.Item>
                            </Menu>
                          }
                          trigger={["click"]}
                          placement="bottomRight"
                          open={openMenuFor === chat.id}
                          onOpenChange={(open) =>
                            setOpenMenuFor(open ? chat.id : null)
                          }
                        >
                          <IconButton
                            className="text-gray-500 dark:text-gray-400 opacity-80 hover:opacity-100"
                            ariaLabel={`${t(
                              "option:header.moreActions",
                              "More actions"
                            )}: ${chat.title}`}
                            hasPopup="menu"
                            ariaExpanded={openMenuFor === chat.id}
                            ariaControls={`history-actions-${chat.id}`}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </IconButton>
                        </Dropdown>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Load More Button */}
            {hasNextPage && (
              <div className="flex justify-center mt-4 mb-2">
                <Button
                  type="default"
                  onClick={handleLoadMore}
                  loading={isFetchingNextPage}
                  icon={
                    !isFetchingNextPage ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : undefined
                  }
                  className="flex items-center gap-2 text-sm"
                >
                  {isFetchingNextPage
                    ? t("common:loading")
                    : t("common:loadMore")}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Server chats */}
        {serverStatus === "success" && serverChats.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 border-t border-gray-200 dark:border-gray-800 pt-3">
            <div className="flex items-center justify-between mt-1 px-1">
              <h3 className="px-2 text-sm font-medium text-gray-500">
                {t("common:serverChats", { defaultValue: "Server chats" })}
              </h3>
            </div>
            <div className="flex flex-col gap-2 mt-1">
              {serverChats.map((chat: any) => (
                <button
                  key={chat.id}
                  className={cn(
                    "flex py-2 px-2 items-center gap-3 relative rounded-md truncate group transition-opacity duration-300 ease-in-out border text-left",
                    serverChatId === chat.id
                      ? "bg-gray-200 dark:bg-[#454242] border-gray-400 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                      : "bg-gray-50 dark:bg-[#232222] dark:text-gray-100 text-gray-800 border-gray-300 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-[#2d2d2d]"
                  )}
                  onClick={async () => {
                    try {
                      setHistoryId(null)
                      setServerChatId(chat.id)
                      setServerChatState(
                        (chat as any)?.state ??
                          (chat as any)?.conversation_state ??
                          "in-progress"
                      )
                      setServerChatTopic((chat as any)?.topic_label ?? null)
                      setServerChatClusterId(
                        (chat as any)?.cluster_id ?? null
                      )
                      setServerChatSource((chat as any)?.source ?? null)
                      setServerChatExternalRef(
                        (chat as any)?.external_ref ?? null
                      )

                      let assistantName = "Assistant"
                      if (chat.character_id != null) {
                        try {
                          const character = await tldwClient.getCharacter(
                            chat.character_id
                          )
                          if (character) {
                            assistantName =
                              character.name || character.title || assistantName
                          }
                        } catch {
                          // ignore character lookup failure
                        }
                      }

                      const messages = await tldwClient.listChatMessages(
                        chat.id,
                        {
                          include_deleted: "false"
                        } as any
                      )
                      const history = messages.map((m) => ({
                        role: m.role,
                        content: m.content
                      }))
                      const mappedMessages = messages.map((m) => ({
                        isBot: m.role === "assistant",
                        name:
                          m.role === "assistant"
                            ? assistantName
                            : m.role === "system"
                              ? "System"
                              : "You",
                        message: m.content,
                        sources: [],
                        images: [],
                        serverMessageId: m.id,
                        serverMessageVersion: m.version
                      }))
                      setHistory(history as any)
                      setMessages(mappedMessages as any)
                      updatePageTitle(chat.title)
                      navigate("/")
                    } catch (e) {
                      // eslint-disable-next-line no-console
                      console.error("Failed to load server chat", e)
                      message.error(
                        t("common:serverChatLoadError", {
                          defaultValue:
                            "Failed to load server chat. Check your connection and try again."
                        })
                      )
                    }
                  }}
                >
                  <div className="flex flex-col overflow-hidden flex-1">
                    <span className="truncate text-sm">{chat.title}</span>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium lowercase text-gray-700 dark:bg-gray-700 dark:text-gray-100">
                        {(chat.state as string) || "in-progress"}
                      </span>
                      {chat.topic_label && (
                        <span
                          className="truncate max-w-[12rem]"
                          title={String(chat.topic_label)}
                        >
                          {String(chat.topic_label)}
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      {chat.parent_conversation_id ? (
                        <Tooltip
                          title={t("common:serverChatForkedTooltip", {
                            defaultValue: `Forked from chat ${String(
                              chat.parent_conversation_id
                            ).slice(0, 8)}`
                          })}
                        >
                          <span className="inline-flex items-center gap-1">
                            <GitBranch className="size-3" />
                            <span>
                              {t("common:serverChatForkedLabel", {
                                defaultValue: "Forked chat"
                              })}
                            </span>
                          </span>
                        </Tooltip>
                      ) : (
                        <span>
                          {t("common:serverChatSourceLabel", {
                            defaultValue: "Server"
                          })}
                        </span>
                      )}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Folder Tree View - shown when viewMode is 'folders' */}
        {isConnected && viewMode === "folders" && (
          <div className="mt-4 border-t border-gray-200 dark:border-gray-800 pt-3">
            <FolderTree
              onConversationSelect={(conversationId) => {
                void loadLocalConversation(conversationId)
                onSelectChat?.(conversationId)
              }}
              conversations={folderTreeConversations}
              showConversations
            />
          </div>
        )}

        {/* Folder Picker Modal */}
        <React.Suspense
          fallback={
            folderPickerOpen ? (
              <Modal
                open={folderPickerOpen}
                onCancel={() => {
                  setFolderPickerOpen(false)
                  setFolderPickerChatId(null)
                }}
                footer={null}
                title={t("common:moveToFolder")}
              >
                <div className="flex items-center justify-center py-6">
                  <Spin />
                </div>
              </Modal>
            ) : null
          }
        >
          <FolderPicker
            open={folderPickerOpen}
            onClose={() => {
              setFolderPickerOpen(false)
              setFolderPickerChatId(null)
            }}
            onSelect={handleFolderSelect}
            title={t("common:moveToFolder")}
            allowMultiple
            showCreateNew
          />
        </React.Suspense>
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


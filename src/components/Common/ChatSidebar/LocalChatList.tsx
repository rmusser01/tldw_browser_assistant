import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from "@tanstack/react-query"
import {
  Tooltip,
  Spin,
  Empty,
  Skeleton,
  Dropdown,
  Menu,
  Button,
  message
} from "antd"
import {
  MessageSquare,
  Trash2,
  Edit3,
  MoreHorizontal,
  ChevronDown,
  PinIcon,
  PinOffIcon,
  BotIcon,
  GitBranch,
  FolderIcon
} from "lucide-react"

import { PageAssistDatabase } from "@/db/dexie/chat"
import type { HistoryInfo } from "@/db/dexie/types"
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
import { useConfirmDanger } from "@/components/Common/confirm-danger"
import { IconButton } from "@/components/Common/IconButton"
import { useMessageOption } from "@/hooks/useMessageOption"
import { useStoreChatModelSettings } from "@/store/model"
import { useFolderActions } from "@/store/folder"
import { cn } from "@/libs/utils"

type ChatGroup = {
  label: string
  items: HistoryInfo[]
}

interface LocalChatListProps {
  searchQuery: string
  selectedChatId: string | null
  onSelectChat?: (chatId: string) => void
  onOpenFolderPicker?: (chatId: string) => void
  className?: string
}

// Relative time helper
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

export function LocalChatList({
  searchQuery,
  selectedChatId,
  onSelectChat,
  onOpenFolderPicker,
  className
}: LocalChatListProps) {
  const { t } = useTranslation(["common", "sidepanel", "option"])
  const { isConnected } = useConnectionState()
  const queryClient = useQueryClient()
  const confirmDanger = useConfirmDanger()

  const {
    setMessages,
    setHistory,
    setHistoryId,
    historyId,
    clearChat,
    setSelectedModel,
    setSelectedSystemPrompt,
    setContextFiles,
    setServerChatId
  } = useMessageOption()
  const { setSystemPrompt } = useStoreChatModelSettings()

  const [dexiePrivateWindowError, setDexiePrivateWindowError] = useState(false)
  const [deleteGroup, setDeleteGroup] = useState<string | null>(null)
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null)

  // Local chat history query
  const {
    data: chatHistoriesData,
    status,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading
  } = useInfiniteQuery({
    queryKey: ["fetchChatHistory", searchQuery],
    queryFn: async ({ pageParam = 1 }) => {
      try {
        const db = new PageAssistDatabase()
        const result = await db.getChatHistoriesPaginated(
          pageParam,
          searchQuery || undefined
        )

        if (searchQuery) {
          return {
            groups:
              result.histories.length > 0
                ? [{ label: "searchResults", items: result.histories }]
                : [],
            hasMore: result.hasMore,
            totalCount: result.totalCount
          }
        }

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

        for (const item of result.histories as HistoryInfo[]) {
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
        if (lastWeekItems.length) groups.push({ label: "last7Days", items: lastWeekItems })
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

  const chatHistories =
    chatHistoriesData?.pages.reduce(
      (acc, page) => {
        page.groups.forEach((group) => {
          const existingGroup = acc.find((g) => g.label === group.label)
          if (existingGroup) {
            existingGroup.items.push(...group.items)
          } else {
            acc.push({ ...group })
          }
        })
        return acc
      },
      [] as ChatGroup[]
    ) || []

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

  // Mutations
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

  const { mutate: editHistory } = useMutation({
    mutationKey: ["editHistory"],
    mutationFn: async (data: { id: string; title: string }) => {
      return await updateHistory(data.id, data.title)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fetchChatHistory"] })
    }
  })

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
    onError: () => {
      message.error(t("common:deleteHistoriesError"))
    }
  })

  const { mutate: pinChatHistory, isPending: pinLoading } = useMutation({
    mutationKey: ["pinHistory"],
    mutationFn: async (data: { id: string; is_pinned: boolean }) => {
      return await pinHistory(data.id, data.is_pinned)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fetchChatHistory"] })
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
      } catch (error) {
        console.error("Failed to load local chat history:", error)
        message.error(
          t("common:error.friendlyLocalHistorySummary", {
            defaultValue: "Something went wrong while loading local chat history."
          })
        )
      }
    },
    [
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

  const effectiveSelectedChatId = selectedChatId ?? historyId ?? null

  // Loading state
  if (status === "pending" || isLoading) {
    return (
      <div className={cn("flex justify-center items-center py-8", className)}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    )
  }

  // Error state
  if (status === "error") {
    return (
      <div className={cn("flex justify-center items-center py-8", className)}>
        <span className="text-red-500">
          {t("common:chatSidebar.loadError", "Failed to load chats")}
        </span>
      </div>
    )
  }

  // Firefox private window error
  if (dexiePrivateWindowError) {
    return (
      <div className={cn("flex justify-center items-center py-8", className)}>
        <Empty
          description={t("common:privateWindow", {
            defaultValue:
              "IndexedDB does not work in private mode. Please open the extension in a normal window."
          })}
        />
      </div>
    )
  }

  // Empty state
  if (chatHistories.length === 0) {
    return (
      <div className={cn("flex justify-center items-center py-8", className)}>
        <Empty description={t("common:noHistory")} />
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {chatHistories.map((group, groupIndex) => (
        <div key={groupIndex}>
          <div className="flex items-center justify-between mt-2 px-1">
            <h3 className="px-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
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
            {group.items.map((chat: HistoryInfo) => (
              <div
                key={chat.id}
                className={cn(
                  "flex py-2 px-2 items-start gap-2 relative rounded-md group transition-opacity duration-300 ease-in-out border",
                  effectiveSelectedChatId === chat.id
                    ? "bg-gray-200 dark:bg-[#454242] border-gray-400 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    : "bg-gray-50 dark:bg-[#2d2d2d] dark:text-gray-100 text-gray-800 border-gray-300 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-[#3d3d3d]"
                )}
              >
                {chat?.message_source === "copilot" && (
                  <BotIcon className="size-3 text-gray-500 dark:text-gray-400 mt-1 flex-shrink-0" />
                )}
                {chat?.message_source === "branch" && (
                  <GitBranch className="size-3 text-gray-500 dark:text-gray-400 mt-1 flex-shrink-0" />
                )}
                <button
                  className="flex-1 overflow-hidden text-start w-full min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-1 rounded"
                  onClick={() => {
                    void loadLocalConversation(chat.id)
                    onSelectChat?.(chat.id)
                  }}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="truncate font-medium" title={chat.title}>
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
                              historyMetadata.get(chat.id)?.lastMessage?.createdAt ||
                                chat.createdAt,
                              t
                            )}
                          </span>
                        )}
                      </div>
                    )}
                    {historyMetadata?.get(chat.id)?.lastMessage && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {truncateMessage(
                          historyMetadata.get(chat.id)?.lastMessage?.content || ""
                        )}
                      </span>
                    )}
                  </div>
                </button>
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
                        {chat.is_pinned ? t("common:unpin") : t("common:pin")}
                      </Menu.Item>
                      {isConnected && onOpenFolderPicker && (
                        <Menu.Item
                          key="moveToFolder"
                          icon={<FolderIcon className="w-4 h-4" />}
                          onClick={() => {
                            onOpenFolderPicker(chat.id)
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
                            t("common:renameChat", { defaultValue: "Rename chat" }),
                            chat.title
                          )
                          if (newTitle && newTitle.trim() !== chat.title) {
                            editHistory({ id: chat.id, title: newTitle.trim() })
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
                            title: t("common:confirmTitle"),
                            content: t("deleteHistoryConfirmation"),
                            okText: t("common:delete"),
                            cancelText: t("common:cancel")
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
                  onOpenChange={(open) => setOpenMenuFor(open ? chat.id : null)}
                >
                  <IconButton
                    className="text-gray-500 dark:text-gray-400 opacity-80 hover:opacity-100"
                    ariaLabel={`${t("option:header.moreActions", "More actions")}: ${chat.title}`}
                    hasPopup="menu"
                    ariaExpanded={openMenuFor === chat.id}
                    ariaControls={`history-actions-${chat.id}`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </IconButton>
                </Dropdown>
              </div>
            ))}
          </div>
        </div>
      ))}

      {hasNextPage && (
        <div className="flex justify-center mt-4 mb-2">
          <Button
            type="default"
            onClick={() => fetchNextPage()}
            loading={isFetchingNextPage}
            icon={!isFetchingNextPage ? <ChevronDown className="w-4 h-4" /> : undefined}
            className="flex items-center gap-2 text-sm"
          >
            {isFetchingNextPage ? t("common:loading") : t("common:loadMore")}
          </Button>
        </div>
      )}
    </div>
  )
}

export default LocalChatList

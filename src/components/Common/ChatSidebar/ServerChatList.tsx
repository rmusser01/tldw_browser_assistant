import React from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Tooltip, Empty, Skeleton, Dropdown, Input, Modal, message } from "antd"
import {
  Pin,
  PinOff,
  GitBranch,
  MoreHorizontal,
  Pencil,
  Settings2,
  Trash2,
  Circle,
  CheckCircle2,
  Clock,
  XCircle,
  Tag
} from "lucide-react"
import { useStorage } from "@plasmohq/storage/hook"

import { useConfirmDanger } from "@/components/Common/confirm-danger"
import { useConnectionState } from "@/hooks/useConnectionState"
import { useServerChatHistory, type ServerChatHistoryItem } from "@/hooks/useServerChatHistory"
import { useMessageOption } from "@/hooks/useMessageOption"
import { tldwClient, type ConversationState } from "@/services/tldw/TldwApiClient"
import { updatePageTitle } from "@/utils/update-page-title"
import { formatRelativeTime } from "@/utils/dateFormatters"
import { cn } from "@/libs/utils"
import {
  CONVERSATION_STATE_OPTIONS,
  normalizeConversationState
} from "@/utils/conversation-state"
import { ChatStateBadge } from "./ChatStateBadge"

interface ServerChatListProps {
  searchQuery: string
  className?: string
}

const STATE_ICON_BY_VALUE: Record<ConversationState, React.ReactElement> = {
  "in-progress": <Circle className="size-3 text-blue-500" />,
  resolved: <CheckCircle2 className="size-3 text-green-500" />,
  backlog: <Clock className="size-3 text-gray-400" />,
  "non-viable": <XCircle className="size-3 text-red-400" />
}

export function ServerChatList({ searchQuery, className }: ServerChatListProps) {
  const { t } = useTranslation(["common", "sidepanel", "option", "playground"])
  const navigate = useNavigate()
  const { isConnected } = useConnectionState()
  const queryClient = useQueryClient()
  const confirmDanger = useConfirmDanger()
  const [pinnedChatIds, setPinnedChatIds] = useStorage<string[]>(
    "tldw:server-chat-pins",
    []
  )

  const {
    serverChatId,
    setServerChatTitle,
    setServerChatState,
    setServerChatVersion,
    setServerChatTopic,
    selectServerChat,
    clearChat
  } = useMessageOption()
  const [openMenuFor, setOpenMenuFor] = React.useState<string | null>(null)
  const [renamingChat, setRenamingChat] =
    React.useState<ServerChatHistoryItem | null>(null)
  const [renameValue, setRenameValue] = React.useState("")
  const [renameError, setRenameError] = React.useState<string | null>(null)
  const [editingTopicChat, setEditingTopicChat] =
    React.useState<ServerChatHistoryItem | null>(null)
  const [topicValue, setTopicValue] = React.useState("")

  const { mutate: updateChatMetadata, isPending: updateChatLoading } =
    useMutation({
      mutationFn: async (payload: {
        chatId: string
        data: Record<string, unknown>
        expectedVersion?: number | null
      }) =>
        tldwClient.updateChat(
          payload.chatId,
          payload.data,
          payload.expectedVersion != null
            ? { expectedVersion: payload.expectedVersion }
            : undefined
        )
    })

  const {
    data: serverChatData,
    status,
    isLoading
  } = useServerChatHistory(searchQuery)
  const serverChats = serverChatData || []
  const pinnedChatSet = React.useMemo(
    () => new Set(pinnedChatIds || []),
    [pinnedChatIds]
  )
  const pinnedChats = serverChats.filter((chat) => pinnedChatSet.has(chat.id))
  const unpinnedChats = serverChats.filter(
    (chat) => !pinnedChatSet.has(chat.id)
  )

  const togglePinned = React.useCallback(
    (chatId: string) => {
      setPinnedChatIds((prev) => {
        const current = prev || []
        if (current.includes(chatId)) {
          return current.filter((id) => id !== chatId)
        }
        return [...current, chatId]
      })
    },
    [setPinnedChatIds]
  )

  const handleRenameSubmit = () => {
    if (!renamingChat) return

    const newTitle = renameValue.trim()
    if (!newTitle) {
      setRenameError(
        t("common:renameChatEmptyError", {
          defaultValue: "Title cannot be empty."
        })
      )
      return
    }

    setRenameError(null)
    updateChatMetadata(
      {
        chatId: renamingChat.id,
        data: { title: newTitle },
        expectedVersion: renamingChat.version ?? null
      },
      {
        onSuccess: (updated) => {
          const resolvedTitle = updated?.title || newTitle
          if (serverChatId === renamingChat.id) {
            setServerChatTitle(resolvedTitle)
            setServerChatVersion(updated?.version ?? null)
            updatePageTitle(resolvedTitle)
          }
          queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
          setRenamingChat(null)
          setRenameValue("")
        },
        onError: () => {
          message.error(
            t("common:renameChatError", {
              defaultValue: "Failed to rename chat."
            })
          )
        }
      }
    )
  }

  const handleTopicSubmit = () => {
    if (!editingTopicChat) return

    const nextTopic = topicValue.trim()
    updateChatMetadata(
      {
        chatId: editingTopicChat.id,
        data: { topic_label: nextTopic || null },
        expectedVersion: editingTopicChat.version ?? null
      },
      {
        onSuccess: (updated) => {
          const resolvedTopic =
            (updated as ServerChatHistoryItem | undefined)?.topic_label ??
            (nextTopic || null)
          if (serverChatId === editingTopicChat.id) {
            setServerChatTopic(resolvedTopic)
            setServerChatVersion(updated?.version ?? null)
          }
          queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
          setEditingTopicChat(null)
          setTopicValue("")
        },
        onError: () => {
          message.error(
            t("option:somethingWentWrong", {
              defaultValue: "Something went wrong"
            })
          )
        }
      }
    )
  }

  const handleUpdateState = (
    chat: ServerChatHistoryItem,
    nextState: ConversationState
  ) => {
    updateChatMetadata(
      {
        chatId: chat.id,
        data: { state: nextState },
        expectedVersion: chat.version ?? null
      },
      {
        onSuccess: (updated) => {
          const resolvedState = normalizeConversationState(
            (updated as ServerChatHistoryItem | undefined)?.state ?? nextState
          )
          if (serverChatId === chat.id) {
            setServerChatState(resolvedState)
            setServerChatVersion(updated?.version ?? null)
          }
          queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
        },
        onError: () => {
          message.error(
            t("option:somethingWentWrong", {
              defaultValue: "Something went wrong"
            })
          )
        }
      }
    )
  }

  const handleDeleteChat = async (chat: ServerChatHistoryItem) => {
    const ok = await confirmDanger({
      title: t("common:confirmTitle", { defaultValue: "Please confirm" }),
      content: t("common:deleteHistoryConfirmation", {
        defaultValue: "Are you sure you want to delete this chat?"
      }),
      okText: t("common:delete", { defaultValue: "Delete" }),
      cancelText: t("common:cancel", { defaultValue: "Cancel" })
    })
    if (!ok) return

    try {
      await tldwClient.deleteChat(chat.id)
      setPinnedChatIds((prev) =>
        (prev || []).filter((id) => id !== chat.id)
      )
      queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
      if (serverChatId === chat.id) {
        clearChat()
      }
    } catch {
      message.error(
        t("common:deleteChatError", {
          defaultValue: "Failed to delete chat."
        })
      )
    }
  }

  const handleOpenSettings = (chat: ServerChatHistoryItem) => {
    if (serverChatId !== chat.id) {
      selectServerChat(chat)
    }
    if (typeof window === "undefined") return
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("tldw:open-model-settings"))
    }, 0)
  }

  // Not connected state
  if (!isConnected) {
    return (
      <div className={cn("flex justify-center items-center py-8", className)}>
        <Empty
          description={t("common:serverChatsUnavailableNotConnected", {
            defaultValue:
              "Server chats are available once you connect to your tldw server."
          })}
        />
      </div>
    )
  }

  // Loading state
  if (status === "pending" || isLoading) {
    return (
      <div className={cn("flex justify-center items-center py-8", className)}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    )
  }

  // Error state
  if (status === "error") {
    return (
      <div className={cn("flex justify-center items-center py-8 px-2", className)}>
        <span className="text-xs text-text-subtle text-center">
          {t("common:serverChatsUnavailableServerError", {
            defaultValue:
              "Server chats unavailable right now. Check your server logs or try again."
          })}
        </span>
      </div>
    )
  }

  // Empty state
  if (serverChats.length === 0) {
    return (
      <div className={cn("flex justify-center items-center py-8", className)}>
        <Empty
          description={t("common:chatSidebar.noServerChats", {
            defaultValue: "No server chats yet"
          })}
        />
      </div>
    )
  }

  const renderSourceInfo = (chat: ServerChatHistoryItem) => {
    if (chat.parent_conversation_id) {
      return (
        <Tooltip
          title={t("common:serverChatForkedTooltip", {
            chatId: String(chat.parent_conversation_id).slice(0, 8),
            defaultValue: "Forked from chat {{chatId}}"
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
      )
    }
    return (
      <span>
        {t("common:serverChatSourceLabel", {
          defaultValue: "Server"
        })}
      </span>
    )
  }

  const renderChatRow = (chat: ServerChatHistoryItem) => {
    const isPinned = pinnedChatSet.has(chat.id)
    const updatedAtMs = chat.updated_at ? Date.parse(chat.updated_at) : NaN
    const createdAtMs = chat.created_at ? Date.parse(chat.created_at) : NaN
    const lastModifiedMs = !Number.isNaN(updatedAtMs)
      ? updatedAtMs
      : createdAtMs
    const lastModifiedLabel = Number.isNaN(lastModifiedMs)
      ? null
      : formatRelativeTime(new Date(lastModifiedMs).toISOString(), t)
    const lastModifiedTitle = Number.isNaN(lastModifiedMs)
      ? undefined
      : new Date(lastModifiedMs).toLocaleString()
    const stateMenuItems = CONVERSATION_STATE_OPTIONS.map((option) => ({
      key: `state-${option.value}`,
      icon: STATE_ICON_BY_VALUE[option.value],
      label: t(option.labelToken, option.defaultLabel),
      onClick: () => {
        setOpenMenuFor(null)
        handleUpdateState(chat, option.value)
      }
    }))
    const menuItems = [
      {
        key: "settings",
        icon: <Settings2 className="size-3" />,
        label: t("playground:composer.openModelSettings", {
          defaultValue: "Open current chat settings"
        }),
        onClick: () => {
          setOpenMenuFor(null)
          handleOpenSettings(chat)
        }
      },
      {
        key: "rename",
        icon: <Pencil className="size-3" />,
        label: t("common:rename", { defaultValue: "Rename" }),
        onClick: () => {
          setRenamingChat(chat)
          setRenameValue(chat.title || "")
          setRenameError(null)
          setOpenMenuFor(null)
        }
      },
      {
        key: "state",
        label: t("sidepanel:contextMenu.status", "Status"),
        children: stateMenuItems
      },
      {
        key: "topic",
        icon: <Tag className="size-3" />,
        label: t("playground:composer.topicPlaceholder", "Topic label (optional)"),
        onClick: () => {
          setEditingTopicChat(chat)
          setTopicValue(chat.topic_label || "")
          setOpenMenuFor(null)
        }
      },
      { type: "divider" as const },
      {
        key: "delete",
        icon: <Trash2 className="size-3" />,
        label: t("common:delete", { defaultValue: "Delete" }),
        danger: true,
        onClick: () => {
          setOpenMenuFor(null)
          void handleDeleteChat(chat)
        }
      }
    ]
    return (
      <div
        key={chat.id}
        className={cn(
          "flex py-2 px-2 items-center gap-3 relative rounded-md truncate group transition-opacity duration-300 ease-in-out border",
          serverChatId === chat.id
            ? "bg-surface2 border-borderStrong text-text"
            : "bg-surface text-text border-border hover:bg-surface2"
        )}
      >
        <button
          className="flex flex-col overflow-hidden flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 rounded"
          onClick={() => void selectServerChat(chat)}
        >
          <span className="truncate text-sm" title={chat.title}>
            {chat.title}
          </span>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-subtle mt-1">
            <ChatStateBadge state={chat.state as string} />
            {lastModifiedLabel && (
              <span
                className="text-[11px] text-text-subtle"
                title={lastModifiedTitle}
              >
                {t("common:updated", { defaultValue: "Updated" })}{" "}
                {lastModifiedLabel}
              </span>
            )}
            {chat.topic_label && (
              <span
                className="truncate max-w-[12rem]"
                title={String(chat.topic_label)}
              >
                {String(chat.topic_label)}
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 text-xs text-text-subtle">
            {renderSourceInfo(chat)}
          </span>
        </button>
        <div className="flex flex-col items-center gap-1">
          <Tooltip title={isPinned ? t("common:unpin") : t("common:pin")}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                togglePinned(chat.id)
              }}
              className="rounded p-1 text-text-subtle hover:bg-surface2 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] h-7 w-7 sm:min-w-0 sm:min-h-0"
              aria-label={isPinned ? t("common:unpin") : t("common:pin")}
              aria-pressed={isPinned}
            >
              {isPinned ? (
                <PinOff className="size-3" />
              ) : (
                <Pin className="size-3" />
              )}
            </button>
          </Tooltip>
          <Dropdown
            menu={{ items: menuItems }}
            trigger={["click"]}
            placement="bottomRight"
            open={openMenuFor === chat.id}
            onOpenChange={(open) => setOpenMenuFor(open ? chat.id : null)}
          >
            <button
              type="button"
              onClick={(event) => event.stopPropagation()}
              className="rounded p-1 text-text-subtle hover:bg-surface2 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] h-7 w-7 sm:min-w-0 sm:min-h-0"
              aria-label={`${t("option:header.moreActions", {
                defaultValue: "More actions"
              })}: ${chat.title}`}
              aria-haspopup="menu"
              aria-expanded={openMenuFor === chat.id}
              aria-controls={`server-chat-actions-${chat.id}`}
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </Dropdown>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Modal
        title={t("common:renameChat", { defaultValue: "Rename chat" })}
        open={!!renamingChat}
        onCancel={() => {
          setRenamingChat(null)
          setRenameValue("")
          setRenameError(null)
        }}
        onOk={handleRenameSubmit}
        confirmLoading={updateChatLoading}
        okButtonProps={{
          disabled: !renameValue.trim()
        }}
      >
        <Input
          autoFocus
          value={renameValue}
          onChange={(e) => {
            setRenameValue(e.target.value)
            if (renameError) {
              setRenameError(null)
            }
          }}
          onPressEnter={handleRenameSubmit}
          status={renameError ? "error" : undefined}
        />
        {renameError && (
          <div className="mt-1 text-xs text-red-500">{renameError}</div>
        )}
      </Modal>
      <Modal
        title={t("playground:composer.topicPlaceholder", "Topic label (optional)")}
        open={!!editingTopicChat}
        onCancel={() => {
          setEditingTopicChat(null)
          setTopicValue("")
        }}
        onOk={handleTopicSubmit}
        confirmLoading={updateChatLoading}
      >
        <Input
          autoFocus
          value={topicValue}
          onChange={(e) => setTopicValue(e.target.value)}
          onPressEnter={handleTopicSubmit}
          placeholder={t("playground:composer.topicPlaceholder", "Topic label (optional)")}
        />
      </Modal>
      {pinnedChats.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="px-2 text-[11px] font-medium text-text-subtle uppercase tracking-wide">
            {t("common:pinned", { defaultValue: "Pinned" })}
          </div>
          {pinnedChats.map(renderChatRow)}
        </div>
      )}
      {unpinnedChats.length > 0 && (
        <div className={cn("flex flex-col gap-2", pinnedChats.length > 0 && "mt-3")}>
          {unpinnedChats.map(renderChatRow)}
        </div>
      )}
    </div>
  )
}

export default ServerChatList

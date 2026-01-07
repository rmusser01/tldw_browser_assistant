import React from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Empty, Skeleton, Input, Modal, message } from "antd"
import { useStorage } from "@plasmohq/storage/hook"

import { useConfirmDanger } from "@/components/Common/confirm-danger"
import { useConnectionState } from "@/hooks/useConnectionState"
import { useServerChatHistory, type ServerChatHistoryItem } from "@/hooks/useServerChatHistory"
import { useMessageOption } from "@/hooks/useMessageOption"
import { tldwClient, type ConversationState } from "@/services/tldw/TldwApiClient"
import { updatePageTitle } from "@/utils/update-page-title"
import { cn } from "@/libs/utils"
import { normalizeConversationState } from "@/utils/conversation-state"
import { ServerChatRow } from "./ServerChatRow"

interface ServerChatListProps {
  searchQuery: string
  className?: string
}

export function ServerChatList({ searchQuery, className }: ServerChatListProps) {
  const { t } = useTranslation(["common", "sidepanel", "option", "playground"])
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

  const updateChatRequest = React.useCallback(
    async (payload: {
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
      ),
    []
  )

  const { mutate: updateChatMetadata } = useMutation({
    mutationFn: updateChatRequest,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
    }
  })

  const { mutate: renameChat, isPending: renameLoading } = useMutation({
    mutationFn: updateChatRequest
  })

  const { mutate: updateChatTopic, isPending: topicLoading } = useMutation({
    mutationFn: updateChatRequest
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
    if (renameLoading) return
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
    if (renameLoading) return
    renameChat(
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
    if (topicLoading) return
    if (!editingTopicChat) return

    const nextTopic = topicValue.trim()
    if (topicLoading) return
    updateChatTopic(
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

  const handleUpdateState = React.useCallback(
    (chat: ServerChatHistoryItem, nextState: ConversationState) => {
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
    },
    [
      queryClient,
      serverChatId,
      setServerChatState,
      setServerChatVersion,
      t,
      updateChatMetadata
    ]
  )

  const handleDeleteChat = React.useCallback(
    async (chat: ServerChatHistoryItem) => {
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
      } catch (err) {
        console.error("[ServerChatList] Failed to delete chat:", err)
        message.error(
          t("common:deleteChatError", {
            defaultValue: "Failed to delete chat."
          })
        )
      }
    },
    [clearChat, confirmDanger, queryClient, serverChatId, setPinnedChatIds, t]
  )

  const handleOpenSettings = React.useCallback(
    (chat: ServerChatHistoryItem) => {
      if (serverChatId !== chat.id) {
        selectServerChat(chat)
      }
      if (typeof window === "undefined") return
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("tldw:open-model-settings"))
      }, 0)
    },
    [selectServerChat, serverChatId]
  )

  const handleRenameChat = React.useCallback(
    (chat: ServerChatHistoryItem) => {
      setRenamingChat(chat)
      setRenameValue(chat.title || "")
      setRenameError(null)
    },
    [setRenameError, setRenameValue, setRenamingChat]
  )

  const handleEditTopic = React.useCallback(
    (chat: ServerChatHistoryItem) => {
      setEditingTopicChat(chat)
      setTopicValue(chat.topic_label || "")
    },
    [setEditingTopicChat, setTopicValue]
  )

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

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {renamingChat && (
        <Modal
          title={t("common:renameChat", { defaultValue: "Rename chat" })}
          open
          destroyOnClose
          onCancel={() => {
            setRenamingChat(null)
            setRenameValue("")
            setRenameError(null)
          }}
          onOk={handleRenameSubmit}
          confirmLoading={renameLoading}
          okButtonProps={{
            disabled: renameLoading || !renameValue.trim()
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
            disabled={renameLoading}
          />
          {renameError && (
            <div className="mt-1 text-xs text-red-500">{renameError}</div>
          )}
        </Modal>
      )}
      {editingTopicChat && (
        <Modal
          title={t("playground:composer.topicPlaceholder", "Topic label (optional)")}
          open
          destroyOnClose
          onCancel={() => {
            setEditingTopicChat(null)
            setTopicValue("")
          }}
          onOk={handleTopicSubmit}
          confirmLoading={topicLoading}
          okButtonProps={{ disabled: topicLoading }}
        >
          <Input
            autoFocus
            value={topicValue}
            onChange={(e) => setTopicValue(e.target.value)}
            onPressEnter={handleTopicSubmit}
            placeholder={t(
              "playground:composer.topicPlaceholder",
              "Topic label (optional)"
            )}
            disabled={topicLoading}
          />
        </Modal>
      )}
      {pinnedChats.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="px-2 text-[11px] font-medium text-text-subtle uppercase tracking-wide">
            {t("common:pinned", { defaultValue: "Pinned" })}
          </div>
          {pinnedChats.map((chat) => (
            <ServerChatRow
              key={chat.id}
              chat={chat}
              isPinned={pinnedChatSet.has(chat.id)}
              isActive={serverChatId === chat.id}
              openMenuFor={openMenuFor}
              setOpenMenuFor={setOpenMenuFor}
              onSelectChat={selectServerChat}
              onTogglePinned={togglePinned}
              onOpenSettings={handleOpenSettings}
              onRenameChat={handleRenameChat}
              onEditTopic={handleEditTopic}
              onDeleteChat={handleDeleteChat}
              onUpdateState={handleUpdateState}
              t={t}
            />
          ))}
        </div>
      )}
      {unpinnedChats.length > 0 && (
        <div className={cn("flex flex-col gap-2", pinnedChats.length > 0 && "mt-3")}>
          {unpinnedChats.map((chat) => (
            <ServerChatRow
              key={chat.id}
              chat={chat}
              isPinned={pinnedChatSet.has(chat.id)}
              isActive={serverChatId === chat.id}
              openMenuFor={openMenuFor}
              setOpenMenuFor={setOpenMenuFor}
              onSelectChat={selectServerChat}
              onTogglePinned={togglePinned}
              onOpenSettings={handleOpenSettings}
              onRenameChat={handleRenameChat}
              onEditTopic={handleEditTopic}
              onDeleteChat={handleDeleteChat}
              onUpdateState={handleUpdateState}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default ServerChatList

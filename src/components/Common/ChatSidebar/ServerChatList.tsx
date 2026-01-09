import React from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Empty, Skeleton, Input, Modal, message } from "antd"
import { useStorage } from "@plasmohq/storage/hook"
import { FolderPlus, Tag, Trash2 } from "lucide-react"

import { useConfirmDanger } from "@/components/Common/confirm-danger"
import { useConnectionState } from "@/hooks/useConnectionState"
import { useServerChatHistory, type ServerChatHistoryItem } from "@/hooks/useServerChatHistory"
import { useClearChat } from "@/hooks/chat/useClearChat"
import { useSelectServerChat } from "@/hooks/chat/useSelectServerChat"
import { useStoreMessageOption } from "@/store/option"
import { useFolderStore } from "@/store/folder"
import { shallow } from "zustand/shallow"
import {
  tldwClient,
  type ConversationState,
  type ServerChatSummary
} from "@/services/tldw/TldwApiClient"
import { updatePageTitle } from "@/utils/update-page-title"
import { cn } from "@/libs/utils"
import { normalizeConversationState } from "@/utils/conversation-state"
import { ServerChatRow } from "./ServerChatRow"
import { BulkFolderPickerModal } from "@/components/Sidepanel/Chat/BulkFolderPickerModal"
import { BulkTagPickerModal } from "@/components/Sidepanel/Chat/BulkTagPickerModal"

interface ServerChatListProps {
  searchQuery: string
  className?: string
  selectionMode?: boolean
}

type UpdateChatRequestPayload = {
  chatId: string
  data: Record<string, unknown>
  expectedVersion?: number | null
}

export function ServerChatList({
  searchQuery,
  className,
  selectionMode: selectionModeProp
}: ServerChatListProps) {
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
    setServerChatTopic
  } = useStoreMessageOption(
    (state) => ({
      serverChatId: state.serverChatId,
      setServerChatTitle: state.setServerChatTitle,
      setServerChatState: state.setServerChatState,
      setServerChatVersion: state.setServerChatVersion,
      setServerChatTopic: state.setServerChatTopic
    }),
    shallow
  )
  const selectServerChat = useSelectServerChat()
  const clearChat = useClearChat()
  const [openMenuFor, setOpenMenuFor] = React.useState<string | null>(null)
  const [renamingChat, setRenamingChat] =
    React.useState<ServerChatHistoryItem | null>(null)
  const [renameValue, setRenameValue] = React.useState("")
  const [renameError, setRenameError] = React.useState<string | null>(null)
  const [editingTopicChat, setEditingTopicChat] =
    React.useState<ServerChatHistoryItem | null>(null)
  const [topicValue, setTopicValue] = React.useState("")
  const selectionMode = selectionModeProp ?? false
  const [selectedChatIds, setSelectedChatIds] = React.useState<string[]>([])
  const [bulkFolderPickerOpen, setBulkFolderPickerOpen] = React.useState(false)
  const [bulkTagPickerOpen, setBulkTagPickerOpen] = React.useState(false)
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = React.useState(false)

  const {
    folderApiAvailable,
    ensureKeyword,
    addKeywordToConversation
  } = useFolderStore((state) => ({
    folderApiAvailable: state.folderApiAvailable,
    ensureKeyword: state.ensureKeyword,
    addKeywordToConversation: state.addKeywordToConversation
  }))

  const updateChatRequest = React.useCallback(
    async (payload: UpdateChatRequestPayload): Promise<ServerChatSummary> =>
      tldwClient.updateChat(
        payload.chatId,
        payload.data,
        payload.expectedVersion != null
          ? { expectedVersion: payload.expectedVersion }
          : undefined
      ),
    []
  )

  const { mutate: updateChatMetadata } = useMutation<
    ServerChatSummary,
    Error,
    UpdateChatRequestPayload
  >({
    mutationFn: updateChatRequest,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
    }
  })

  const { mutate: renameChat, isPending: renameLoading } = useMutation<
    ServerChatSummary,
    Error,
    UpdateChatRequestPayload
  >({
    mutationFn: updateChatRequest,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
    }
  })

  const { mutate: updateChatTopic, isPending: topicLoading } = useMutation<
    ServerChatSummary,
    Error,
    UpdateChatRequestPayload
  >({
    mutationFn: updateChatRequest,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
    }
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
  const visibleChatIds = React.useMemo(
    () => Array.from(new Set(serverChats.map((chat) => chat.id))),
    [serverChats]
  )
  const chatById = React.useMemo(
    () => new Map(serverChats.map((chat) => [chat.id, chat])),
    [serverChats]
  )
  const selectedChats = React.useMemo(
    () =>
      selectedChatIds
        .map((id) => chatById.get(id))
        .filter(Boolean) as ServerChatHistoryItem[],
    [selectedChatIds, chatById]
  )
  const selectedConversationIds = React.useMemo(
    () => selectedChats.map((chat) => chat.id),
    [selectedChats]
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

  React.useEffect(() => {
    if (!selectionMode) {
      setSelectedChatIds([])
      return
    }
    setSelectedChatIds((prev) =>
      prev.filter((id) => visibleChatIds.includes(id))
    )
  }, [selectionMode, visibleChatIds])

  React.useEffect(() => {
    if (selectionMode) {
      setOpenMenuFor(null)
    }
  }, [selectionMode])

  const toggleChatSelected = React.useCallback((chatId: string) => {
    setSelectedChatIds((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    )
  }, [])

  const handleSelectAllVisible = () => {
    setSelectedChatIds(visibleChatIds)
  }

  const clearSelection = () => {
    setSelectedChatIds([])
  }

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
    updateChatTopic(
      {
        chatId: editingTopicChat.id,
        data: { topic_label: nextTopic || null },
        expectedVersion: editingTopicChat.version ?? null
      },
      {
        onSuccess: (updated) => {
          const resolvedTopic = updated?.topic_label ?? (nextTopic || null)
          if (serverChatId === editingTopicChat.id) {
            setServerChatTopic(resolvedTopic)
            setServerChatVersion(updated?.version ?? null)
          }
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
              updated?.state ?? nextState
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
    []
  )

  const handleEditTopic = React.useCallback(
    (chat: ServerChatHistoryItem) => {
      setEditingTopicChat(chat)
      setTopicValue(chat.topic_label || "")
    },
    []
  )

  const handleRowClick = React.useCallback(
    (chat: ServerChatHistoryItem) => {
      if (selectionMode) {
        toggleChatSelected(chat.id)
        return
      }
      selectServerChat(chat)
    },
    [selectionMode, selectServerChat, toggleChatSelected]
  )

  const openBulkFolderPicker = () => {
    if (folderApiAvailable === false) {
      message.error(
        t(
          "sidepanel:folderPicker.notAvailable",
          "Folder organization is not available on this server"
        )
      )
      return
    }
    if (selectedConversationIds.length === 0) {
      message.warning(
        t(
          "sidepanel:multiSelect.serverOnlyWarning",
          "Select chats saved on the server to apply this action."
        )
      )
      return
    }
    setBulkFolderPickerOpen(true)
  }

  const openBulkTagPicker = () => {
    if (folderApiAvailable === false) {
      message.error(
        t(
          "sidepanel:multiSelect.tagsUnavailable",
          "Tags are not available on this server"
        )
      )
      return
    }
    if (selectedConversationIds.length === 0) {
      message.warning(
        t(
          "sidepanel:multiSelect.serverOnlyWarning",
          "Select chats saved on the server to apply this action."
        )
      )
      return
    }
    setBulkTagPickerOpen(true)
  }

  const handleBulkDelete = async () => {
    if (selectedConversationIds.length === 0) return

    const failedConversationIds = new Set<string>()
    const trashKeyword = await ensureKeyword("Trash")
    if (!trashKeyword) {
      message.error(
        t(
          "sidepanel:multiSelect.deleteFailed",
          "Unable to move chats to trash."
        )
      )
      return
    }

    const results = await Promise.allSettled(
      selectedConversationIds.map((conversationId) =>
        addKeywordToConversation(conversationId, trashKeyword.id)
      )
    )
    let failures = 0
    results.forEach((result, index) => {
      if (result.status === "rejected" || !result.value) {
        failures += 1
        failedConversationIds.add(selectedConversationIds[index])
      }
    })

    if (failures > 0) {
      message.error(
        t(
          "sidepanel:multiSelect.deletePartial",
          "Some chats could not be moved to trash."
        )
      )
    } else {
      message.success(
        t(
          "sidepanel:multiSelect.deleteSuccess",
          "Chats moved to trash."
        )
      )
    }

    setPinnedChatIds((prev) =>
      (prev || []).filter(
        (id) =>
          !selectedConversationIds.includes(id) ||
          failedConversationIds.has(id)
      )
    )
    queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
    setSelectedChatIds(
      selectedConversationIds.filter((id) => failedConversationIds.has(id))
    )
    setBulkDeleteConfirmOpen(false)
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
      {selectionMode && (
        <div className="sticky top-0 z-10 border-b border-border bg-surface2 px-2 py-2">
          <div className="flex items-center justify-between text-xs text-text-subtle">
            <span>
              {t("sidepanel:multiSelect.count", {
                defaultValue: "{{count}} selected",
                count: selectedChatIds.length
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="text-text-subtle hover:text-text"
                disabled={visibleChatIds.length === 0}
              >
                {t("sidepanel:multiSelect.selectAll", "Select all")}
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="text-text-subtle hover:text-text"
                disabled={selectedChatIds.length === 0}
              >
                {t("sidepanel:multiSelect.clear", "Clear")}
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openBulkFolderPicker}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text hover:bg-surface"
              disabled={selectedChatIds.length === 0}
            >
              <FolderPlus className="size-3.5" />
              {t("sidepanel:multiSelect.addToFolder", "Add to folders")}
            </button>
            <button
              type="button"
              onClick={openBulkTagPicker}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text hover:bg-surface"
              disabled={selectedChatIds.length === 0}
            >
              <Tag className="size-3.5" />
              {t("sidepanel:multiSelect.addTags", "Add tags")}
            </button>
            <button
              type="button"
              onClick={() => setBulkDeleteConfirmOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-red-600 hover:bg-surface"
              disabled={selectedChatIds.length === 0}
            >
              <Trash2 className="size-3.5" />
              {t("common:delete", "Delete")}
            </button>
          </div>
        </div>
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
              selectionMode={selectionMode}
              isSelected={selectedChatIds.includes(chat.id)}
              openMenuFor={openMenuFor}
              setOpenMenuFor={setOpenMenuFor}
              onSelectChat={handleRowClick}
              onTogglePinned={togglePinned}
              onOpenSettings={handleOpenSettings}
              onRenameChat={handleRenameChat}
              onEditTopic={handleEditTopic}
              onDeleteChat={handleDeleteChat}
              onUpdateState={handleUpdateState}
              onToggleSelected={toggleChatSelected}
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
              selectionMode={selectionMode}
              isSelected={selectedChatIds.includes(chat.id)}
              openMenuFor={openMenuFor}
              setOpenMenuFor={setOpenMenuFor}
              onSelectChat={handleRowClick}
              onTogglePinned={togglePinned}
              onOpenSettings={handleOpenSettings}
              onRenameChat={handleRenameChat}
              onEditTopic={handleEditTopic}
              onDeleteChat={handleDeleteChat}
              onUpdateState={handleUpdateState}
              onToggleSelected={toggleChatSelected}
              t={t}
            />
          ))}
        </div>
      )}
      <BulkFolderPickerModal
        open={bulkFolderPickerOpen}
        conversationIds={selectedConversationIds}
        onClose={() => setBulkFolderPickerOpen(false)}
        onSuccess={() => clearSelection()}
      />
      <BulkTagPickerModal
        open={bulkTagPickerOpen}
        conversationIds={selectedConversationIds}
        onClose={() => setBulkTagPickerOpen(false)}
        onSuccess={() => clearSelection()}
      />
      <Modal
        open={bulkDeleteConfirmOpen}
        onCancel={() => setBulkDeleteConfirmOpen(false)}
        onOk={handleBulkDelete}
        okText={t("sidepanel:multiSelect.deleteConfirmOk", "Move to trash")}
        cancelText={t("common:cancel", "Cancel")}
        okButtonProps={{ danger: true }}
        title={t(
          "sidepanel:multiSelect.deleteConfirmTitle",
          "Move chats to trash?"
        )}
        destroyOnClose
      >
        <p>
          {t(
            "sidepanel:multiSelect.deleteConfirmBody",
            "This will hide the selected chats by tagging them as Trash."
          )}
        </p>
      </Modal>
    </div>
  )
}

export default ServerChatList

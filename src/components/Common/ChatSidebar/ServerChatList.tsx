import React from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Tooltip, Empty, Skeleton, message } from "antd"
import { PinIcon, PinOffIcon, GitBranch } from "lucide-react"
import { useStorage } from "@plasmohq/storage/hook"

import { useConnectionState } from "@/hooks/useConnectionState"
import { useServerChatHistory, type ServerChatHistoryItem } from "@/hooks/useServerChatHistory"
import { useMessageOption } from "@/hooks/useMessageOption"
import { tldwClient, type ConversationState } from "@/services/tldw/TldwApiClient"
import { updatePageTitle } from "@/utils/update-page-title"
import { cn } from "@/libs/utils"

interface ServerChatListProps {
  searchQuery: string
  className?: string
}

export function ServerChatList({ searchQuery, className }: ServerChatListProps) {
  const { t } = useTranslation(["common", "sidepanel"])
  const navigate = useNavigate()
  const { isConnected } = useConnectionState()
  const mountedRef = React.useRef(true)
  const [pinnedChatIds, setPinnedChatIds] = useStorage<string[]>(
    "tldw:server-chat-pins",
    []
  )

  React.useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const {
    setMessages,
    setHistory,
    setHistoryId,
    serverChatId,
    setServerChatId,
    setServerChatState,
    setServerChatTopic,
    setServerChatClusterId,
    setServerChatSource,
    setServerChatExternalRef
  } = useMessageOption()

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

  const loadServerChat = async (chat: ServerChatHistoryItem) => {
    try {
      setHistoryId(null)
      setServerChatId(chat.id)
      const rawState = chat.state
      const normalizedState: ConversationState =
        rawState === "in-progress" ||
        rawState === "resolved" ||
        rawState === "backlog" ||
        rawState === "non-viable"
          ? rawState
          : "in-progress"
      setServerChatState(normalizedState)
      setServerChatTopic(chat.topic_label ?? null)
      setServerChatClusterId(chat.cluster_id ?? null)
      setServerChatSource(chat.source ?? null)
      setServerChatExternalRef(chat.external_ref ?? null)

      let assistantName = "Assistant"
      if (chat.character_id !== null && chat.character_id !== undefined) {
        try {
          const character = await tldwClient.getCharacter(chat.character_id)
          if (character) {
            assistantName = character.name || character.title || assistantName
          }
        } catch {
          // ignore character lookup failure
        }
      }

      if (!mountedRef.current) return

      const messages = await tldwClient.listChatMessages(chat.id, {
        include_deleted: false
      })
      if (!mountedRef.current) return
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
      if (!mountedRef.current) return
      setHistory(history)
      setMessages(mappedMessages)
      updatePageTitle(chat.title)
      navigate("/")
    } catch (e) {
      if (!mountedRef.current) return
      console.error("Failed to load server chat", e)
      message.error(
        t("common:serverChatLoadError", {
          defaultValue:
            "Failed to load server chat. Check your connection and try again."
        })
      )
    }
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

  const renderChatRow = (chat: ServerChatHistoryItem) => {
    const isPinned = pinnedChatSet.has(chat.id)
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
          onClick={() => void loadServerChat(chat)}
        >
          <span className="truncate text-sm" title={chat.title}>
            {chat.title}
          </span>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-subtle mt-1">
            <span className="inline-flex items-center rounded-full bg-surface2 px-2 py-1 text-[11px] font-medium lowercase text-text">
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
          <span className="flex items-center gap-1 text-xs text-text-subtle">
            {chat.parent_conversation_id ? (
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
            ) : (
              <span>
                {t("common:serverChatSourceLabel", {
                  defaultValue: "Server"
                })}
              </span>
            )}
          </span>
        </button>
        <Tooltip title={isPinned ? t("common:unpin") : t("common:pin")}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              togglePinned(chat.id)
            }}
            className="rounded p-1 text-text-subtle hover:bg-surface2 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
            aria-label={isPinned ? t("common:unpin") : t("common:pin")}
            aria-pressed={isPinned}
          >
            {isPinned ? (
              <PinOffIcon className="size-3" />
            ) : (
              <PinIcon className="size-3" />
            )}
          </button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {pinnedChats.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="px-2 text-[11px] font-medium text-text-subtle uppercase tracking-wide">
            {t("common:pinned", { defaultValue: "Pinned" })}
          </div>
          {pinnedChats.map(renderChatRow)}
        </div>
      )}
      {unpinnedChats.length > 0 && (
        <div className={pinnedChats.length > 0 ? "mt-3 flex flex-col gap-2" : "flex flex-col gap-2"}>
          {unpinnedChats.map(renderChatRow)}
        </div>
      )}
    </div>
  )
}

export default ServerChatList

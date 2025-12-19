import React from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Tooltip, Empty, Skeleton, message } from "antd"
import { GitBranch } from "lucide-react"

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
        <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
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
      {serverChats.map((chat: ServerChatHistoryItem) => (
        <button
          key={chat.id}
          className={cn(
            "flex py-2 px-2 items-center gap-3 relative rounded-md truncate group transition-opacity duration-300 ease-in-out border text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-1",
            serverChatId === chat.id
              ? "bg-gray-200 dark:bg-[#454242] border-gray-400 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              : "bg-gray-50 dark:bg-[#2d2d2d] dark:text-gray-100 text-gray-800 border-gray-300 dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-[#3d3d3d]"
          )}
          onClick={() => void loadServerChat(chat)}
        >
          <div className="flex flex-col overflow-hidden flex-1">
            <span className="truncate text-sm" title={chat.title}>
              {chat.title}
            </span>
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
          </div>
        </button>
      ))}
    </div>
  )
}

export default ServerChatList

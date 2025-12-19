import React, { useEffect, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Empty, Skeleton, message } from "antd"
import { useQuery } from "@tanstack/react-query"

import { useConnectionState } from "@/hooks/useConnectionState"
import { FolderTree } from "@/components/Folders"
import {
  useFolderStore,
  useFolderActions
} from "@/store/folder"
import { PageAssistDatabase } from "@/db/dexie/chat"
import { formatToChatHistory, formatToMessage, getSessionFiles, getPromptById } from "@/db/dexie/helpers"
import { lastUsedChatModelEnabled } from "@/services/model-settings"
import { updatePageTitle } from "@/utils/update-page-title"
import { useMessageOption } from "@/hooks/useMessageOption"
import { useStoreChatModelSettings } from "@/store/model"
import { cn } from "@/libs/utils"

interface FolderChatListProps {
  onSelectChat?: (chatId: string) => void
  className?: string
}

export function FolderChatList({ onSelectChat, className }: FolderChatListProps) {
  const { t } = useTranslation(["common"])
  const { isConnected } = useConnectionState()
  const { refreshFromServer } = useFolderActions()
  const folderRefreshInFlightRef = useRef<Promise<void> | null>(null)

  const {
    setMessages,
    setHistory,
    setHistoryId,
    setSelectedModel,
    setSelectedSystemPrompt,
    setContextFiles,
    setServerChatId
  } = useMessageOption()
  const { setSystemPrompt } = useStoreChatModelSettings()

  // Folder data
  const conversationKeywordLinks = useFolderStore((s) => s.conversationKeywordLinks)

  // Load folders when component mounts
  useEffect(() => {
    if (!isConnected) return
    if (folderRefreshInFlightRef.current) return

    const refreshPromise = refreshFromServer().finally(() => {
      if (folderRefreshInFlightRef.current === refreshPromise) {
        folderRefreshInFlightRef.current = null
      }
    })
    folderRefreshInFlightRef.current = refreshPromise
  }, [isConnected, refreshFromServer])

  // Get all conversation IDs from folder links
  const folderConversationIds = useMemo(() => {
    const ids = new Set<string>()
    conversationKeywordLinks.forEach((link) => {
      if (link.conversation_id) {
        ids.add(link.conversation_id)
      }
    })
    return Array.from(ids)
  }, [conversationKeywordLinks])

  // Fetch titles for folder conversations
  const { data: loadedConversationTitleById, isLoading: isTitlesLoading } = useQuery({
    queryKey: ["folderConversationTitles", folderConversationIds.join(",")],
    queryFn: async () => {
      if (folderConversationIds.length === 0) return new Map<string, string>()
      const db = new PageAssistDatabase()
      const historyPromises = folderConversationIds.map(async (id) => {
        try {
          const info = await db.getHistoryInfo(id)
          return [id, info?.title ?? id] as const
        } catch {
          return [id, id] as const
        }
      })
      const results = await Promise.all(historyPromises)
      return new Map(results)
    },
    enabled: folderConversationIds.length > 0 && isConnected,
    staleTime: 60_000
  })

  // Build conversations list for folder tree
  const folderTreeConversations = useMemo(() => {
    if (!loadedConversationTitleById) return []
    return folderConversationIds.map((conversationId) => ({
      id: conversationId,
      title: loadedConversationTitleById.get(conversationId) || conversationId
    }))
  }, [folderConversationIds, loadedConversationTitleById])

  // Load a local conversation
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
        console.error("Failed to load conversation from folder:", error)
        message.error(
          t("common:error.friendlyLocalHistorySummary", {
            defaultValue: "Something went wrong while loading the conversation."
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

  // Not connected state
  if (!isConnected) {
    return (
      <div className={cn("flex justify-center items-center py-8", className)}>
        <Empty
          description={t("common:chatSidebar.foldersRequireConnection", {
            defaultValue: "Folders require a server connection"
          })}
        />
      </div>
    )
  }

  // Loading state
  if (isTitlesLoading) {
    return (
      <div className={cn("flex justify-center items-center py-8", className)}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    )
  }

  // Empty state
  if (folderTreeConversations.length === 0) {
    return (
      <div className={cn("flex justify-center items-center py-8", className)}>
        <Empty
          description={t("common:noFolders", {
            defaultValue: "No folders yet. Create a folder to organize your chats."
          })}
        />
      </div>
    )
  }

  return (
    <div className={cn("", className)}>
      <FolderTree
        onConversationSelect={(conversationId) => {
          void loadLocalConversation(conversationId)
          onSelectChat?.(conversationId)
        }}
        conversations={folderTreeConversations}
        showConversations
      />
    </div>
  )
}

export default FolderChatList

import React, { useEffect, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Empty, Skeleton } from "antd"
import { useQuery } from "@tanstack/react-query"

import { useConnectionState } from "@/hooks/useConnectionState"
import { FolderTree } from "@/components/Folders"
import {
  useFolderStore,
  useFolderActions
} from "@/store/folder"
import { PageAssistDatabase } from "@/db/dexie/chat"
import { useMessageOption } from "@/hooks/useMessageOption"
import { useStoreChatModelSettings } from "@/store/model"
import { useLoadLocalConversation } from "@/hooks/useLoadLocalConversation"
import { cn } from "@/libs/utils"

// Module-level singleton database instance
const db = new PageAssistDatabase()

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
  const folders = useFolderStore((s) => s.folders)
  const isFolderLoading = useFolderStore((s) => s.isLoading)

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
    return Array.from(ids).sort((a, b) => a.localeCompare(b))
  }, [conversationKeywordLinks])

  // Fetch titles for folder conversations
  const { data: loadedConversationTitleById, isLoading: isTitlesLoading } = useQuery({
    queryKey: ["folderConversationTitles", folderConversationIds],
    queryFn: async () => {
      if (folderConversationIds.length === 0) return new Map<string, string>()
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

  const hasFolders = useMemo(
    () => folders.some((folder) => !folder.deleted),
    [folders]
  )

  // Load a local conversation
  const loadLocalConversation = useLoadLocalConversation(
    {
      setServerChatId,
      setHistoryId,
      setHistory,
      setMessages,
      setSelectedModel,
      setSelectedSystemPrompt,
      setSystemPrompt,
      setContextFiles
    },
    {
      t,
      errorLogPrefix: "Failed to load conversation from folder",
      errorDefaultMessage: "Something went wrong while loading the conversation."
    }
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
  if (isTitlesLoading || isFolderLoading) {
    return (
      <div className={cn("flex justify-center items-center py-8", className)}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    )
  }

  // Empty state
  if (!hasFolders) {
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

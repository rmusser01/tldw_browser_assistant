import React from "react"
import { useNavigate } from "react-router-dom"
import { Modal } from "antd"
import { shallow } from "zustand/shallow"
import { useChatBaseState } from "@/hooks/chat/useChatBaseState"
import { useStoreMessageOption } from "@/store/option"
import { cleanupAntOverlays } from "@/utils/cleanup-ant-overlays"
import { normalizeConversationState } from "@/utils/conversation-state"
import { updatePageTitle } from "@/utils/update-page-title"
import type { ServerChatSummary } from "@/services/tldw/TldwApiClient"

export const useSelectServerChat = () => {
  const navigate = useNavigate()
  const {
    setHistory,
    setHistoryId,
    setMessages,
    setIsLoading,
    setIsProcessing,
    setStreaming,
    setIsEmbedding
  } = useChatBaseState(useStoreMessageOption)
  const {
    setIsSearchingInternet,
    clearReplyTarget,
    setServerChatId,
    setServerChatTitle,
    setServerChatCharacterId,
    setServerChatVersion,
    setServerChatState,
    setServerChatTopic,
    setServerChatClusterId,
    setServerChatSource,
    setServerChatExternalRef,
    setServerChatMetaLoaded
  } = useStoreMessageOption(
    (state) => ({
      setIsSearchingInternet: state.setIsSearchingInternet,
      clearReplyTarget: state.clearReplyTarget,
      setServerChatId: state.setServerChatId,
      setServerChatTitle: state.setServerChatTitle,
      setServerChatCharacterId: state.setServerChatCharacterId,
      setServerChatVersion: state.setServerChatVersion,
      setServerChatState: state.setServerChatState,
      setServerChatTopic: state.setServerChatTopic,
      setServerChatClusterId: state.setServerChatClusterId,
      setServerChatSource: state.setServerChatSource,
      setServerChatExternalRef: state.setServerChatExternalRef,
      setServerChatMetaLoaded: state.setServerChatMetaLoaded
    }),
    shallow
  )

  return React.useCallback(
    (chat: ServerChatSummary) => {
      if (typeof window !== "undefined") {
        Modal.destroyAll()
        cleanupAntOverlays()
      }
      setIsLoading(true)
      setHistoryId(null)
      setHistory([])
      setMessages([])
      setServerChatId(chat.id)
      setServerChatTitle(chat.title || "")
      setServerChatCharacterId(chat.character_id ?? null)
      setIsProcessing(false)
      setStreaming(false)
      setIsEmbedding(false)
      setIsSearchingInternet(false)
      clearReplyTarget()
      setServerChatVersion(chat.version ?? null)
      setServerChatState(normalizeConversationState(chat.state))
      setServerChatTopic(chat.topic_label ?? null)
      setServerChatClusterId(chat.cluster_id ?? null)
      setServerChatSource(chat.source ?? null)
      setServerChatExternalRef(chat.external_ref ?? null)
      setServerChatMetaLoaded(true)
      updatePageTitle(chat.title)
      navigate("/")
    },
    [
      clearReplyTarget,
      navigate,
      setHistory,
      setHistoryId,
      setIsEmbedding,
      setIsLoading,
      setIsProcessing,
      setIsSearchingInternet,
      setMessages,
      setServerChatCharacterId,
      setServerChatClusterId,
      setServerChatExternalRef,
      setServerChatId,
      setServerChatMetaLoaded,
      setServerChatSource,
      setServerChatState,
      setServerChatTitle,
      setServerChatTopic,
      setServerChatVersion,
      setStreaming
    ]
  )
}

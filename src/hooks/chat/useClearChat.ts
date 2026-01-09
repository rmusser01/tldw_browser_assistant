import React from "react"
import { useNavigate } from "react-router-dom"
import { Modal } from "antd"
import { shallow } from "zustand/shallow"
import { useStorage } from "@plasmohq/storage/hook"
import { useChatBaseState } from "@/hooks/chat/useChatBaseState"
import { focusTextArea } from "@/hooks/utils/messageHelpers"
import { useStoreMessageOption } from "@/store/option"
import { usePlaygroundSessionStore } from "@/store/playground-session"
import { useStoreChatModelSettings } from "@/store/model"
import { cleanupAntOverlays } from "@/utils/cleanup-ant-overlays"
import { updatePageTitle } from "@/utils/update-page-title"

type UseClearChatOptions = {
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
}

export const useClearChat = ({ textareaRef }: UseClearChatOptions = {}) => {
  const navigate = useNavigate()
  const currentChatModelSettings = useStoreChatModelSettings()
  const [defaultInternetSearchOn] = useStorage("defaultInternetSearchOn", false)

  const {
    setMessages,
    setHistory,
    setHistoryId,
    setIsFirstMessage,
    setIsLoading,
    setIsProcessing,
    setStreaming
  } = useChatBaseState(useStoreMessageOption)
  const {
    setServerChatId,
    setServerChatVersion,
    setContextFiles,
    setDocumentContext,
    setUploadedFiles,
    setFileRetrievalEnabled,
    setActionInfo,
    setRagMediaIds,
    setRagSearchMode,
    setRagTopK,
    setRagEnableGeneration,
    setRagEnableCitations,
    setRagSources,
    clearQueuedMessages,
    setCompareMode,
    setCompareSelectedModels,
    clearReplyTarget,
    setWebSearch
  } = useStoreMessageOption(
    (state) => ({
      setServerChatId: state.setServerChatId,
      setServerChatVersion: state.setServerChatVersion,
      setContextFiles: state.setContextFiles,
      setDocumentContext: state.setDocumentContext,
      setUploadedFiles: state.setUploadedFiles,
      setFileRetrievalEnabled: state.setFileRetrievalEnabled,
      setActionInfo: state.setActionInfo,
      setRagMediaIds: state.setRagMediaIds,
      setRagSearchMode: state.setRagSearchMode,
      setRagTopK: state.setRagTopK,
      setRagEnableGeneration: state.setRagEnableGeneration,
      setRagEnableCitations: state.setRagEnableCitations,
      setRagSources: state.setRagSources,
      clearQueuedMessages: state.clearQueuedMessages,
      setCompareMode: state.setCompareMode,
      setCompareSelectedModels: state.setCompareSelectedModels,
      clearReplyTarget: state.clearReplyTarget,
      setWebSearch: state.setWebSearch
    }),
    shallow
  )

  return React.useCallback(() => {
    if (typeof window !== "undefined") {
      Modal.destroyAll()
      cleanupAntOverlays()
    }
    navigate("/")
    setMessages([])
    setHistory([])
    setHistoryId(null)
    setServerChatId(null)
    setServerChatVersion(null)
    setIsFirstMessage(true)
    setIsLoading(false)
    setIsProcessing(false)
    setStreaming(false)
    setContextFiles([])
    updatePageTitle()
    currentChatModelSettings.reset()
    if (defaultInternetSearchOn) {
      setWebSearch(true)
    }
    focusTextArea(textareaRef)
    setDocumentContext(null)
    setUploadedFiles([])
    setFileRetrievalEnabled(false)
    setActionInfo(null)
    setRagMediaIds(null)
    setRagSearchMode("hybrid")
    setRagTopK(null)
    setRagEnableGeneration(false)
    setRagEnableCitations(false)
    setRagSources([])
    clearQueuedMessages()
    setServerChatId(null)
    setServerChatVersion(null)
    setCompareMode(false)
    setCompareSelectedModels([])
    useStoreMessageOption.setState({
      compareSelectionByCluster: {},
      compareCanonicalByCluster: {},
      compareSplitChats: {},
      compareActiveModelsByCluster: {}
    })
    clearReplyTarget()
    usePlaygroundSessionStore.getState().clearSession()
  }, [
    clearQueuedMessages,
    clearReplyTarget,
    currentChatModelSettings,
    defaultInternetSearchOn,
    navigate,
    setActionInfo,
    setCompareMode,
    setCompareSelectedModels,
    setContextFiles,
    setDocumentContext,
    setFileRetrievalEnabled,
    setHistory,
    setHistoryId,
    setIsFirstMessage,
    setIsLoading,
    setIsProcessing,
    setMessages,
    setRagEnableCitations,
    setRagEnableGeneration,
    setRagMediaIds,
    setRagSearchMode,
    setRagSources,
    setRagTopK,
    setServerChatId,
    setServerChatVersion,
    setStreaming,
    setUploadedFiles,
    setWebSearch,
    textareaRef
  ])
}

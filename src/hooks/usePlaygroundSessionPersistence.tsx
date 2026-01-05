import { useCallback, useEffect, useRef } from "react"
import { usePlaygroundSessionStore } from "@/store/playground-session"
import { useStoreMessageOption } from "@/store/option"
import {
  formatToChatHistory,
  formatToMessage,
  getFullChatData,
  getPromptById
} from "@/db/dexie/helpers"
import { useStoreChatModelSettings } from "@/store/model"

const DEBOUNCE_MS = 1000

/**
 * Hook to persist and restore playground session state.
 *
 * - Automatically saves session state (debounced) when relevant state changes
 * - Provides restoreSession() to restore from persisted state on mount
 * - Clears session when user starts a new chat
 */
export function usePlaygroundSessionPersistence() {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRestoringRef = useRef(false)

  // Session store
  const sessionStore = usePlaygroundSessionStore()
  const saveSession = usePlaygroundSessionStore((s) => s.saveSession)
  const clearSession = usePlaygroundSessionStore((s) => s.clearSession)
  const isSessionValid = usePlaygroundSessionStore((s) => s.isSessionValid)

  // Main message option store
  const {
    historyId,
    serverChatId,
    chatMode,
    webSearch,
    compareMode,
    compareSelectedModels,
    ragMediaIds,
    ragSearchMode,
    ragTopK,
    ragEnableGeneration,
    ragEnableCitations,
    temporaryChat,
    setHistoryId,
    setServerChatId,
    setChatMode,
    setWebSearch,
    setCompareMode,
    setCompareSelectedModels,
    setRagMediaIds,
    setRagSearchMode,
    setRagTopK,
    setRagEnableGeneration,
    setRagEnableCitations,
    setHistory,
    setMessages,
    setSelectedSystemPrompt
  } = useStoreMessageOption()

  const { setSystemPrompt } = useStoreChatModelSettings()

  // Debounced save
  const saveCurrentSession = useCallback(() => {
    // Don't save if restoring or if temporary chat
    if (isRestoringRef.current || temporaryChat) return

    // Don't save if no conversation started
    if (!historyId && !serverChatId) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(() => {
      saveSession({
        historyId,
        serverChatId,
        chatMode,
        webSearch,
        compareMode,
        compareSelectedModels,
        ragMediaIds,
        ragSearchMode,
        ragTopK,
        ragEnableGeneration,
        ragEnableCitations
      })
    }, DEBOUNCE_MS)
  }, [
    historyId,
    serverChatId,
    chatMode,
    webSearch,
    compareMode,
    compareSelectedModels,
    ragMediaIds,
    ragSearchMode,
    ragTopK,
    ragEnableGeneration,
    ragEnableCitations,
    temporaryChat,
    saveSession
  ])

  // Auto-save when state changes
  useEffect(() => {
    saveCurrentSession()
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [saveCurrentSession])

  // Restore session from persisted state
  const restoreSession = useCallback(async (): Promise<boolean> => {
    if (!isSessionValid()) {
      clearSession()
      return false
    }

    const savedHistoryId = sessionStore.historyId
    if (!savedHistoryId) return false

    isRestoringRef.current = true

    try {
      // Restore messages from Dexie
      const chatData = await getFullChatData(savedHistoryId)
      if (!chatData) {
        // History was deleted, clear session
        clearSession()
        return false
      }

      // Restore messages and history
      setHistoryId(savedHistoryId)
      setHistory(formatToChatHistory(chatData.messages))
      setMessages(formatToMessage(chatData.messages))

      // Restore system prompt if present
      const lastUsedPrompt = (chatData.historyInfo as any)?.last_used_prompt
      if (lastUsedPrompt?.prompt_id) {
        const prompt = await getPromptById(lastUsedPrompt.prompt_id)
        if (prompt) {
          setSelectedSystemPrompt(lastUsedPrompt.prompt_id)
          setSystemPrompt(prompt.content)
        }
      } else if (lastUsedPrompt?.prompt_content) {
        setSystemPrompt(lastUsedPrompt.prompt_content)
      }

      // Restore settings from session store
      if (sessionStore.serverChatId) {
        setServerChatId(sessionStore.serverChatId)
      }
      setChatMode(sessionStore.chatMode)
      setWebSearch(sessionStore.webSearch)
      setCompareMode(sessionStore.compareMode)
      if (sessionStore.compareSelectedModels.length > 0) {
        setCompareSelectedModels(sessionStore.compareSelectedModels)
      }

      // Restore RAG settings
      if (sessionStore.ragMediaIds) {
        setRagMediaIds(sessionStore.ragMediaIds)
      }
      setRagSearchMode(sessionStore.ragSearchMode)
      if (sessionStore.ragTopK !== null) {
        setRagTopK(sessionStore.ragTopK)
      }
      setRagEnableGeneration(sessionStore.ragEnableGeneration)
      setRagEnableCitations(sessionStore.ragEnableCitations)

      return true
    } catch (error) {
      console.warn("Failed to restore session:", error)
      clearSession()
      return false
    } finally {
      isRestoringRef.current = false
    }
  }, [
    isSessionValid,
    sessionStore,
    clearSession,
    setHistoryId,
    setServerChatId,
    setHistory,
    setMessages,
    setSelectedSystemPrompt,
    setSystemPrompt,
    setChatMode,
    setWebSearch,
    setCompareMode,
    setCompareSelectedModels,
    setRagMediaIds,
    setRagSearchMode,
    setRagTopK,
    setRagEnableGeneration,
    setRagEnableCitations
  ])

  // Clear persisted session (call when user starts new chat)
  const clearPersistedSession = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    clearSession()
  }, [clearSession])

  return {
    restoreSession,
    clearPersistedSession,
    hasPersistedSession: isSessionValid()
  }
}

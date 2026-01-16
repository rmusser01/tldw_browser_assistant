import React, { useEffect, useRef } from "react"
import { Select } from "antd"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useQuickChatStore } from "@/store/quick-chat"
import { useQuickChat } from "@/hooks/useQuickChat"
import { fetchChatModels } from "@/services/tldw-server"
import { QuickChatMessage as QuickChatMessageView } from "@/components/Common/QuickChatHelper/QuickChatMessage"
import { QuickChatInput } from "@/components/Common/QuickChatHelper/QuickChatInput"
import { AlertCircle } from "lucide-react"
import { useChatModelsSelect } from "@/hooks/useChatModelsSelect"
import type { QuickChatMessage } from "@/store/quick-chat"

const QuickChatPopout: React.FC = () => {
  const { t } = useTranslation(["option", "common"])
  const [searchParams] = useSearchParams()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasRestoredRef = useRef(false)

  const {
    messages,
    sendMessage,
    cancelStream,
    isStreaming,
    hasModel,
    activeModel,
    currentModel,
    modelOverride,
    setModelOverride
  } = useQuickChat()
  const {
    data: modelsData,
    isLoading: modelsLoading,
    isError: modelsError
  } = useQuery({
    queryKey: ["quickChatModels"],
    queryFn: () => fetchChatModels({ returnEmpty: false }),
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    select: (data) => data.filter((model) => model?.model)
  })
  const models = modelsData ?? []
  const showModelsError = modelsError && models.length === 0
  const modelsErrorHintId = "quick-chat-models-error-hint"

  // Restore state from sessionStorage on mount
  useEffect(() => {
    if (hasRestoredRef.current) return

    const stateKey = searchParams.get("state")
    if (!stateKey) {
      hasRestoredRef.current = true
      return
    }
    if (!/^[a-zA-Z0-9:_-]{1,128}$/.test(stateKey)) {
      console.warn("Invalid quick chat state key")
      hasRestoredRef.current = true
      return
    }
    try {
      const savedState = sessionStorage.getItem(stateKey)
      if (!savedState) return

      const parsed = JSON.parse(savedState) as unknown
      // Validate parsed state structure before restoring
      if (
        parsed &&
        typeof parsed === "object" &&
        "messages" in parsed &&
        Array.isArray((parsed as { messages: unknown }).messages)
      ) {
        const parsedState = parsed as {
          messages: unknown[]
          modelOverride?: unknown
        }
        const isValidMsg = (m: unknown): m is QuickChatMessage => {
          if (!m || typeof m !== "object") return false
          if (
            !("id" in m) ||
            !("role" in m) ||
            !("content" in m) ||
            !("timestamp" in m)
          ) {
            return false
          }
          const candidate = m as {
            id: unknown
            role: unknown
            content: unknown
            timestamp: unknown
          }
          return (
            typeof candidate.id === "string" &&
            (candidate.role === "user" || candidate.role === "assistant") &&
            typeof candidate.content === "string" &&
            typeof candidate.timestamp === "number"
          )
        }

        const nextMessages = parsedState.messages.filter(isValidMsg)
        const nextModelOverride =
          typeof parsedState.modelOverride === "string"
            ? parsedState.modelOverride
            : null
        useQuickChatStore.getState().restoreFromState({
          messages: nextMessages,
          modelOverride: nextModelOverride
        })
      } else {
        console.warn("Invalid quick chat state structure in sessionStorage")
      }
    } catch (error) {
      console.error("Failed to restore quick chat state:", error)
    } finally {
      // Clean up sessionStorage regardless of validity or parse errors
      sessionStorage.removeItem(stateKey)
      hasRestoredRef.current = true
    }
  }, [searchParams])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Clear messages and cancel any active stream on window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      cancelStream()
      useQuickChatStore.getState().clearMessages()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [cancelStream])

  const title = t("option:quickChatHelper.title", "Quick Chat Helper")
  const emptyState = t(
    "option:quickChatHelper.emptyState",
    "Start a quick side chat to keep your main thread clean."
  )
  let notFoundContent: string | undefined
  if (showModelsError) {
    notFoundContent = t(
      "option:quickChatHelper.modelsLoadError",
      "Unable to load models"
    )
  } else if (models.length === 0 && !modelsLoading) {
    notFoundContent = t(
      "option:quickChatHelper.noModelsAvailable",
      "No models available"
    )
  }
  const { allowClear, modelOptions, modelPlaceholder, handleModelChange } =
    useChatModelsSelect({
      models,
      currentModel,
      modelOverride,
      setModelOverride,
      t
    })

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h1>
      </div>
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <Select
          className="w-full"
          size="small"
          showSearch
          options={modelOptions}
          value={activeModel || undefined}
          placeholder={modelPlaceholder}
          loading={modelsLoading}
          disabled={showModelsError}
          status={showModelsError ? "error" : undefined}
          optionFilterProp="label"
          allowClear={allowClear}
          aria-label={t("option:quickChatHelper.modelLabel", "Model")}
          aria-describedby={showModelsError ? modelsErrorHintId : undefined}
          onChange={handleModelChange}
          notFoundContent={notFoundContent}
        />
        {showModelsError && (
          <div
            className="mt-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400"
            id={modelsErrorHintId}>
            <AlertCircle className="h-4 w-4" />
            <span>
              {t(
                "option:quickChatHelper.modelsLoadErrorHint",
                "Check your server connection, then try again."
              )}
            </span>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3"
        role="log"
        aria-live="polite"
        aria-label={t("common:chatMessages", "Chat messages")}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 text-center px-4">
            <p className="text-sm">{emptyState}</p>
            {!hasModel && (
              <div className="mt-3 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs">
                <AlertCircle className="h-4 w-4" />
                <span>
                  {t(
                    "option:quickChatHelper.noModelWarning",
                    "Select a model in the main chat or choose one here."
                  )}
                </span>
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <QuickChatMessageView
                key={message.id}
                message={message}
                isStreaming={isStreaming}
                isLast={index === messages.length - 1}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <QuickChatInput
          onSend={sendMessage}
          onCancel={cancelStream}
          isStreaming={isStreaming}
          disabled={!hasModel}
        />
      </div>
    </div>
  )
}

export default QuickChatPopout

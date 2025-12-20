import React, { useRef, useEffect, useCallback } from "react"
import { Modal, Button, Tooltip } from "antd"
import { ExternalLink, AlertCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useQuickChat } from "@/hooks/useQuickChat"
import { useQuickChatStore } from "@/store/quick-chat"
import { QuickChatMessage } from "./QuickChatMessage"
import { QuickChatInput } from "./QuickChatInput"
import { browser } from "wxt/browser"
import { useConnectionPhase, useIsConnected } from "@/hooks/useConnectionState"
import { ConnectionPhase } from "@/types/connection"

const EMPTY_POP_OUT_TOOLTIP_STYLES = {
  root: { maxWidth: "200px" }
}

type Props = {
  open: boolean
  onClose: () => void
}

export const QuickChatHelperModal: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation(["option", "common"])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const {
    messages,
    sendMessage,
    cancelStream,
    isStreaming,
    hasModel
  } = useQuickChat()
  const phase = useConnectionPhase()
  const isConnected = useIsConnected()
  const isConnectionReady = isConnected && phase === ConnectionPhase.CONNECTED

  // Scroll to bottom when messages change or streaming completes
  useEffect(() => {
    if (!messagesEndRef.current || messages.length === 0) {
      return
    }
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStreaming])

  const handlePopOut = useCallback(() => {
    // Serialize current state to sessionStorage
    const state = useQuickChatStore.getState().getSerializableState()
    const stateKey = `quickchat_${Date.now()}`
    sessionStorage.setItem(stateKey, JSON.stringify(state))

    // Open pop-out window
    const popoutUrl = browser.runtime.getURL(
      `/options.html#/quick-chat-popout?state=${stateKey}`
    )
    const popoutWindow = window.open(
      popoutUrl,
      "quickChatHelper",
      "width=480,height=600,menubar=no,toolbar=no,location=no,status=no"
    )

    if (popoutWindow) {
      useQuickChatStore.getState().setPopoutWindow(popoutWindow)
      onClose()
    }
  }, [onClose])

  const title = t("quickChatHelper.title", "Quick Chat Helper")
  const emptyState = t(
    "quickChatHelper.emptyState",
    "Start a quick side chat to keep your main thread clean."
  )
  const popOutLabel = t("quickChatHelper.popOutButton", "Pop out")
  const popOutDisabledTooltip = t(
    "quickChatHelper.popOutDisabled",
    "Pop-out is disabled when there are no messages. Start a conversation first."
  )
  const connectionLabel = isConnectionReady
    ? t("common:connected", "Connected")
    : t("common:notConnected", "Not connected")
  const connectionBadgeClass = isConnectionReady
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100"
    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
  const connectionDotClass = isConnectionReady
    ? "bg-emerald-500"
    : "bg-amber-500"
  const descriptionId =
    messages.length === 0 ? "quick-chat-description" : undefined

  return (
    <Modal
      title={
        <div className="flex items-center justify-between pr-8">
          <span id="quick-chat-title">{title}</span>
          <Tooltip
            title={messages.length === 0 ? popOutDisabledTooltip : popOutLabel}
            styles={
              messages.length === 0 ? EMPTY_POP_OUT_TOOLTIP_STYLES : undefined
            }>
            <Button
              type="text"
              size="small"
              icon={<ExternalLink className="h-4 w-4" />}
              onClick={handlePopOut}
              aria-label={popOutLabel}
              disabled={messages.length === 0}
            />
          </Tooltip>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      className="quick-chat-helper-modal"
      destroyOnClose={false}
      maskClosable={true}
      keyboard={true}
      aria-labelledby="quick-chat-title"
      aria-describedby={descriptionId}>
      <div className="flex flex-col h-[50vh] max-h-[400px]">
        <div className="flex items-center justify-end px-1 pb-2">
          <span
            role="status"
            aria-live="polite"
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${connectionBadgeClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${connectionDotClass}`} />
            <span>{connectionLabel}</span>
          </span>
        </div>
        {/* Messages area */}
        <div
          className="flex-1 overflow-y-auto px-1 py-2"
          role="log"
          aria-live="polite"
          aria-label={t("common:chatMessages", "Chat messages")}>
          {messages.length === 0 ? (
            <div
              id="quick-chat-description"
              className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 text-center px-4">
              <p className="text-sm">{emptyState}</p>
              {!hasModel && (
                <div className="mt-3 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs">
                  <AlertCircle className="h-4 w-4" />
                  <span>
                    {t(
                      "quickChatHelper.noModelWarning",
                      "Please select a model in the main chat first."
                    )}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <QuickChatMessage
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
        <QuickChatInput
          onSend={sendMessage}
          onCancel={cancelStream}
          isStreaming={isStreaming}
          disabled={!hasModel}
        />
      </div>
    </Modal>
  )
}

export default QuickChatHelperModal

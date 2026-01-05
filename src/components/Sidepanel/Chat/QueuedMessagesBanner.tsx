import { message, Modal, Tooltip } from "antd"
import React from "react"
import { useTranslation } from "react-i18next"

export interface QueuedMessage {
  message: string
  image: string
}

export interface QueuedMessagesBannerProps {
  queuedMessages: QueuedMessage[]
  isConnectionReady: boolean
  isFlushingQueue: boolean
  onFlushQueue: () => Promise<void>
  onClearQueue: () => void
  onOpenDiagnostics: () => void
}

export const QueuedMessagesBanner: React.FC<QueuedMessagesBannerProps> = ({
  queuedMessages,
  isConnectionReady,
  isFlushingQueue,
  onFlushQueue,
  onClearQueue,
  onOpenDiagnostics
}) => {
  const { t } = useTranslation(["playground", "sidepanel", "settings", "common"])

  if (queuedMessages.length === 0) {
    return null
  }

  const handleClearClick = () => {
    const count = queuedMessages.length
    Modal.confirm({
      title: t(
        "sidepanel:composer.clearQueueConfirmTitle",
        "Clear message queue?"
      ),
      content: t(
        "sidepanel:composer.clearQueueConfirmContent",
        "This will delete {{count}} queued message(s) that haven't been sent yet.",
        { count }
      ),
      okText: t("common:confirm", "Confirm"),
      cancelText: t("common:cancel", "Cancel"),
      onOk: () => {
        onClearQueue()
        message.success(
          t(
            "playground:composer.queuedBanner.cleared",
            "Queue cleared ({{count}} messages)",
            { count }
          )
        )
      }
    })
  }

  const getTooltipTitle = () => {
    if (!isConnectionReady) {
      return t(
        "playground:composer.queuedBanner.waitForConnection",
        "Wait for server connection to send queued messages"
      )
    }
    if (isFlushingQueue) {
      return t("playground:composer.queuedBanner.sending", "Sending...")
    }
    return undefined
  }

  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-success bg-success/10 px-3 py-2 text-xs text-success">
      <p className="max-w-xs text-left">
        <span className="block font-medium">
          {t(
            "playground:composer.queuedBanner.title",
            "Queued from existing drafts"
          )}
        </span>
        {t(
          "playground:composer.queuedBanner.body",
          "These drafts were created while offline. We'll send them once your tldw server is connected."
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip title={getTooltipTitle()}>
          <span className="inline-block">
            <button
              type="button"
              onClick={onFlushQueue}
              disabled={!isConnectionReady || isFlushingQueue}
              className={`rounded-md border border-success bg-surface px-2 py-1 text-xs font-medium text-success hover:bg-surface2 ${
                !isConnectionReady || isFlushingQueue
                  ? "cursor-not-allowed opacity-60"
                  : ""
              }`}>
              title={t(
                "playground:composer.queuedBanner.sendNow",
                "Send queued messages"
              )}
              {t(
                "playground:composer.queuedBanner.sendNow",
                "Send queued messages"
              )}
            </button>
          </span>
        </Tooltip>
        <button
          type="button"
          onClick={handleClearClick}
          className="text-xs font-medium text-success underline hover:text-success"
          title={t("playground:composer.queuedBanner.clear", "Clear queue")}
        >
          {t("playground:composer.queuedBanner.clear", "Clear queue")}
        </button>
        <button
          type="button"
          onClick={onOpenDiagnostics}
          className="text-xs font-medium text-success underline hover:text-success"
          title={t("settings:healthSummary.diagnostics", "Health & diagnostics")}
        >
          {t("settings:healthSummary.diagnostics", "Health & diagnostics")}
        </button>
      </div>
    </div>
  )
}

export default QueuedMessagesBanner

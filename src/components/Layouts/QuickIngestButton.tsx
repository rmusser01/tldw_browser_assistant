import React, { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { UploadCloud } from "lucide-react"
import { useQuickIngestStore } from "@/store/quick-ingest"
import QuickIngestModal from "../Common/QuickIngestModal"
import { createEventHost } from "@/utils/create-event-host"

const classNames = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ")

interface QuickIngestButtonProps {
  /** Additional CSS classes */
  className?: string
}

type QuickIngestOpenOptions = {
  autoProcessQueued?: boolean
  focusTrigger?: boolean
}

type QuickIngestEventsOptions = {
  focusTriggerRef?: React.RefObject<HTMLElement>
}

export const useQuickIngestEvents = (options?: QuickIngestEventsOptions) => {
  const focusTriggerRef = options?.focusTriggerRef
  const [quickIngestOpen, setQuickIngestOpen] = useState(false)
  const [quickIngestAutoProcessQueued, setQuickIngestAutoProcessQueued] =
    useState(false)
  const quickIngestReadyRef = useRef(false)
  const pendingQuickIngestIntroRef = useRef(false)

  const openQuickIngest = useCallback(
    (options?: QuickIngestOpenOptions) => {
      const { autoProcessQueued = false, focusTrigger = true } = options || {}
      setQuickIngestAutoProcessQueued(autoProcessQueued)
      setQuickIngestOpen(true)
      if (focusTrigger && focusTriggerRef?.current) {
        requestAnimationFrame(() => {
          focusTriggerRef.current?.focus()
        })
      }
    },
    [focusTriggerRef]
  )

  const closeQuickIngest = useCallback(
    (options?: { focusTrigger?: boolean }) => {
      setQuickIngestOpen(false)
      setQuickIngestAutoProcessQueued(false)
      if ((options?.focusTrigger ?? true) && focusTriggerRef?.current) {
        requestAnimationFrame(() => {
          focusTriggerRef.current?.focus()
        })
      }
    },
    [focusTriggerRef]
  )

  // Global event listeners for opening quick ingest
  useEffect(() => {
    const handler = () => {
      openQuickIngest()
    }
    window.addEventListener("tldw:open-quick-ingest", handler)
    return () => {
      window.removeEventListener("tldw:open-quick-ingest", handler)
    }
  }, [openQuickIngest])

  useEffect(() => {
    const markQuickIngestReady = () => {
      quickIngestReadyRef.current = true
      if (pendingQuickIngestIntroRef.current) {
        pendingQuickIngestIntroRef.current = false
        window.dispatchEvent(new CustomEvent("tldw:quick-ingest-force-intro"))
      }
    }
    window.addEventListener("tldw:quick-ingest-ready", markQuickIngestReady)
    return () => {
      window.removeEventListener(
        "tldw:quick-ingest-ready",
        markQuickIngestReady
      )
    }
  }, [])

  useEffect(() => {
    const handler = () => {
      openQuickIngest({ focusTrigger: false })
      if (quickIngestReadyRef.current) {
        window.dispatchEvent(new CustomEvent("tldw:quick-ingest-force-intro"))
      } else {
        pendingQuickIngestIntroRef.current = true
      }
    }
    window.addEventListener("tldw:open-quick-ingest-intro", handler)
    return () => {
      window.removeEventListener("tldw:open-quick-ingest-intro", handler)
    }
  }, [openQuickIngest])

  return {
    quickIngestOpen,
    quickIngestAutoProcessQueued,
    openQuickIngest,
    closeQuickIngest
  }
}

/**
 * Quick ingest button with badge for queued items and modal.
 * Extracted from Header.tsx for better maintainability.
 */
export function QuickIngestButton({ className }: QuickIngestButtonProps) {
  const { t } = useTranslation(["option", "playground", "quickIngest"])
  const quickIngestBtnRef = useRef<HTMLButtonElement>(null)
  const {
    quickIngestOpen,
    quickIngestAutoProcessQueued,
    openQuickIngest,
    closeQuickIngest
  } = useQuickIngestEvents({ focusTriggerRef: quickIngestBtnRef })

  const { queuedQuickIngestCount, quickIngestHadFailure } = useQuickIngestStore(
    (s) => ({
      queuedQuickIngestCount: s.queuedCount,
      quickIngestHadFailure: s.hadRecentFailure,
    })
  )

  const hasQueuedQuickIngest = queuedQuickIngestCount > 0

  const quickIngestAriaLabel = React.useMemo(() => {
    const base = t("option:header.quickIngest", "Quick ingest")
    if (!hasQueuedQuickIngest) {
      return base
    }

    const queuedText = t(
      "option:header.quickIngestQueuedAria",
      "{{label}} - {{count}} items queued - click to review and process",
      {
        label: base,
        count: queuedQuickIngestCount,
      }
    )

    if (quickIngestHadFailure) {
      const failureHint = t(
        "quickIngest:healthAriaHint",
        "Recent runs failed - open Health & diagnostics from the header for more details."
      )
      return `${queuedText} ${failureHint}`
    }

    return queuedText
  }, [hasQueuedQuickIngest, queuedQuickIngestCount, quickIngestHadFailure, t])

  return (
    <>
      <div className={`flex items-center gap-3 ${className || ""}`}>
        <button
          type="button"
          ref={quickIngestBtnRef}
          onClick={() => openQuickIngest()}
          data-testid="open-quick-ingest"
          aria-label={quickIngestAriaLabel}
          title={
            t(
              "playground:tooltip.quickIngest",
              t(
                "option:header.quickIngestHelp",
                "Stage URLs and files for processing, even while your server is offline."
              )
            ) as string
          }
          className={classNames(
            "relative inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full border border-transparent px-4 py-2 text-sm font-medium transition hover:border-border hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            "text-text-muted"
          )}
          data-has-queued-ingest={hasQueuedQuickIngest ? "true" : "false"}
          aria-disabled={false}
        >
          <UploadCloud className="h-3 w-3" aria-hidden="true" />
          <span>{t("option:header.quickIngest", "Quick ingest")}</span>
          {hasQueuedQuickIngest && (
            <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-white">
              {queuedQuickIngestCount > 9 ? "9+" : queuedQuickIngestCount}
            </span>
          )}
        </button>

        {hasQueuedQuickIngest && (
          <button
            type="button"
            data-testid="process-queued-ingest-header"
            onClick={() =>
              openQuickIngest({
                autoProcessQueued: true,
                focusTrigger: false,
              })
            }
            className="inline-flex items-center rounded-full border border-transparent px-2 py-1 text-xs text-primary hover:text-primaryStrong"
            title={t(
              "quickIngest:processQueuedItemsShort",
              "Process queued items"
            )}
          >
            {t(
              "quickIngest:processQueuedItemsShort",
              "Process queued items"
            )}
          </button>
        )}
      </div>

      <QuickIngestModal
        open={quickIngestOpen}
        autoProcessQueued={quickIngestAutoProcessQueued}
        onClose={closeQuickIngest}
      />
    </>
  )
}

export const QuickIngestModalHost = createEventHost({
  useEvents: useQuickIngestEvents,
  isActive: ({ quickIngestOpen }) => quickIngestOpen,
  render: ({ quickIngestOpen, quickIngestAutoProcessQueued, closeQuickIngest }) => (
    <QuickIngestModal
      open={quickIngestOpen}
      autoProcessQueued={quickIngestAutoProcessQueued}
      onClose={() => closeQuickIngest({ focusTrigger: false })}
    />
  )
})

export default QuickIngestButton

import React, { Suspense, lazy, useCallback, useEffect, useState } from "react"
import { Tooltip, Switch } from "antd"
import { MessageCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useStorage } from "@plasmohq/storage/hook"
import { useQuickChatStore } from "@/store/quick-chat"
import { classNames } from "@/libs/class-name"

// Lazy load the modal for bundle optimization
const QuickChatHelperModal = lazy(() =>
  import("./QuickChatHelperModal").then((m) => ({ default: m.QuickChatHelperModal }))
)

export const QuickChatHelperButton: React.FC = () => {
  const { t } = useTranslation("option")
  const [hideQuickChatHelper, setHideQuickChatHelper] = useStorage(
    "hideQuickChatHelper",
    false
  )
  const { isOpen, setIsOpen } = useQuickChatStore()
  const [isCompactViewport, setIsCompactViewport] = useState(false)

  const handleOpen = useCallback(() => {
    setIsOpen(true)
  }, [setIsOpen])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [setIsOpen])

  const tooltip = t("quickChatHelper.tooltip", "Quick Chat Helper")
  const toggleLabel = hideQuickChatHelper
    ? t(
        "settings:generalSettings.settings.hideQuickChatHelper.showLabel",
        "Show Quick Chat Helper button"
      )
    : t(
        "settings:generalSettings.settings.hideQuickChatHelper.label",
        "Hide Quick Chat Helper button"
      )

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mediaQuery = window.matchMedia("(max-width: 520px)")
    const update = () => setIsCompactViewport(mediaQuery.matches)
    update()
    mediaQuery.addEventListener("change", update)
    return () => {
      mediaQuery.removeEventListener("change", update)
    }
  }, [])

  const isSidepanel =
    typeof window !== "undefined" &&
    window.location?.pathname?.includes("sidepanel")
  const isDocked = isSidepanel && isCompactViewport

  return (
    <>
      {!isDocked && (
        <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-center gap-3">
          {!hideQuickChatHelper && (
            <Tooltip title={tooltip} placement="left">
              <button
                onClick={handleOpen}
                className={classNames(
                  "flex items-center justify-center",
                  "w-12 h-12 rounded-full",
                  "bg-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-strong)]",
                  "text-white shadow-lg",
                  "transition-all duration-200",
                  "hover:scale-105 active:scale-95",
                  "focus:outline-none focus:ring-2 focus:ring-[color:var(--color-focus)] focus:ring-offset-2",
                  "focus:ring-offset-[color:var(--color-surface)]"
                )}
                aria-label={tooltip}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                type="button">
                <MessageCircle className="h-6 w-6" />
              </button>
            </Tooltip>
          )}

          <Tooltip title={toggleLabel} placement="left">
            <Switch
              checked={!hideQuickChatHelper}
              onChange={(checked) => setHideQuickChatHelper(!checked)}
              aria-label={toggleLabel}
            />
          </Tooltip>
        </div>
      )}

      {/* Modal - lazy loaded */}
      <Suspense fallback={null}>
        <QuickChatHelperModal open={isOpen} onClose={handleClose} />
      </Suspense>
    </>
  )
}

export default QuickChatHelperButton

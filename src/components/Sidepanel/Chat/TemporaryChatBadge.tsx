import React from "react"
import { useTranslation } from "react-i18next"
import { Tooltip } from "antd"
import { EyeOff } from "lucide-react"
import { BsIncognito } from "react-icons/bs"

type TemporaryChatBadgeProps = {
  isTemporary: boolean
  onClick?: () => void
  className?: string
}

/**
 * Compact badge indicating temporary/ephemeral chat mode.
 * Shows an incognito icon with tooltip explaining the mode.
 * Click to toggle temporary mode (with confirmation if messages exist).
 */
export const TemporaryChatBadge: React.FC<TemporaryChatBadgeProps> = ({
  isTemporary,
  onClick,
  className
}) => {
  const { t } = useTranslation(["sidepanel", "common"])

  if (!isTemporary) {
    return null
  }

  return (
    <Tooltip
      title={
        <div className="text-center">
          <p className="font-medium">
            {t("sidepanel:temporaryBadge.title", "Temporary Chat")}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {t(
              "sidepanel:temporaryBadge.description",
              "This chat won't be saved. Messages will be cleared when you close or start a new chat."
            )}
          </p>
          {onClick && (
            <p className="mt-1 text-xs text-text-subtle">
              {t("sidepanel:temporaryBadge.clickHint", "Click to disable")}
            </p>
          )}
        </div>
      }
      placement="top"
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`
          inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
          bg-purple-100 text-purple-700 border border-purple-200
          dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700
          hover:bg-purple-200 dark:hover:bg-purple-900/60
          focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1
          disabled:cursor-default disabled:hover:bg-purple-100 dark:disabled:hover:bg-purple-900/40
          transition-colors
          ${className || ""}
        `}
        aria-label={t(
          "sidepanel:temporaryBadge.ariaLabel",
          "Temporary chat mode is active. Click to toggle."
        )}
      >
        <BsIncognito className="size-3" aria-hidden="true" />
        <span>{t("sidepanel:temporaryBadge.label", "Temp")}</span>
      </button>
    </Tooltip>
  )
}

/**
 * Inline indicator for temporary chat (smaller, no click handler).
 * Used in header or other compact spaces.
 */
export const TemporaryChatIndicator: React.FC<{
  isTemporary: boolean
  className?: string
}> = ({ isTemporary, className }) => {
  const { t } = useTranslation(["sidepanel"])

  if (!isTemporary) {
    return null
  }

  return (
    <Tooltip
      title={t(
        "sidepanel:temporaryBadge.indicatorTooltip",
        "Messages in this chat won't be saved"
      )}
    >
      <div
        className={`
          inline-flex items-center gap-1 px-2 py-1 rounded text-xs
          bg-purple-100 text-purple-600
          dark:bg-purple-900/30 dark:text-purple-400
          ${className || ""}
        `}
        aria-label={t("sidepanel:temporaryBadge.indicatorAria", "Temporary chat")}
      >
        <EyeOff className="size-3" aria-hidden="true" />
      </div>
    </Tooltip>
  )
}

export default TemporaryChatBadge

import React from "react"
import { Button, Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import { AlertTriangle } from "lucide-react"

type ProcessButtonProps = {
  /** Number of items ready to process */
  plannedCount: number
  /** Whether processing is currently running */
  running: boolean
  /** Whether ingest is blocked (e.g., offline) */
  ingestBlocked: boolean
  /** Whether there are missing files that need reattachment */
  hasMissingFiles: boolean
  /** Number of missing files */
  missingFileCount: number
  /** Callback to start processing */
  onRun: () => void
  /** Whether to store remotely or process locally */
  storeRemote: boolean
  /** Optional className */
  className?: string
}

export const ProcessButton: React.FC<ProcessButtonProps> = ({
  plannedCount,
  running,
  ingestBlocked,
  hasMissingFiles,
  missingFileCount,
  onRun,
  storeRemote,
  className
}) => {
  const { t } = useTranslation(["option"])

  const qi = React.useCallback(
    (key: string, defaultValue: string, options?: Record<string, unknown>) =>
      options
        ? t(`quickIngest.${key}`, { defaultValue, ...options })
        : t(`quickIngest.${key}`, defaultValue),
    [t]
  )

  const isDisabled = running || plannedCount === 0 || ingestBlocked || hasMissingFiles
  const buttonLabel = storeRemote
    ? qi("runIngest", "Ingest {{count}} item(s)", { count: plannedCount })
    : qi("runProcessOnly", "Process {{count}} item(s)", { count: plannedCount })

  const getTooltip = () => {
    if (hasMissingFiles) {
      return qi(
        "missingFilesTooltip",
        "{{count}} file(s) need reattachment before processing",
        { count: missingFileCount }
      )
    }
    if (ingestBlocked) {
      return qi("ingestBlockedTooltip", "Server connection required to process")
    }
    if (plannedCount === 0) {
      return qi("noItemsTooltip", "Add items to the queue first")
    }
    return null
  }

  const tooltip = getTooltip()
  const button = (
    <Button
      type="primary"
      size="large"
      onClick={onRun}
      disabled={isDisabled}
      loading={running}
      className={className}
      data-testid="quick-ingest-run"
      aria-label={buttonLabel}
    >
      {hasMissingFiles && (
        <AlertTriangle className="mr-1.5 h-4 w-4" aria-hidden="true" />
      )}
      {running ? qi("processing", "Processing...") : buttonLabel}
    </Button>
  )

  if (tooltip) {
    return (
      <Tooltip title={tooltip}>
        <span>{button}</span>
      </Tooltip>
    )
  }

  return button
}

export default ProcessButton

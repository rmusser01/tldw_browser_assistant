import React from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { useConnectionState } from "@/hooks/useConnectionState"
import { ConnectionPhase } from "@/types/connection"

type StatusKind = "unknown" | "ok" | "fail"

interface ConnectionStatusProps {
  /** Custom click handler (defaults to navigating to /settings/health) */
  onClick?: () => void
  /** Whether to show the label text (default: true) */
  showLabel?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Connection status indicator with clickable health diagnostics link.
 * Extracted from Header.tsx for reuse.
 */
export function ConnectionStatus({
  onClick,
  showLabel = true,
  className,
}: ConnectionStatusProps) {
  const { t } = useTranslation(["settings", "common"])
  const navigate = useNavigate()
  const { phase, isConnected } = useConnectionState()

  const coreStatus: StatusKind =
    phase === ConnectionPhase.SEARCHING
      ? "unknown"
      : isConnected && phase === ConnectionPhase.CONNECTED
        ? "ok"
        : phase === ConnectionPhase.ERROR
          ? "fail"
          : "unknown"

  const statusLabelForCore = (status: StatusKind): string => {
    if (phase === ConnectionPhase.UNCONFIGURED) {
      return t(
        "settings:healthSummary.coreUnconfigured",
        "Server: Not configured"
      )
    }
    if (status === "ok") {
      return t("settings:healthSummary.coreOnline", "Server: Online")
    }
    if (status === "fail") {
      return t("settings:healthSummary.coreOffline", "Server: Offline")
    }
    return t("settings:healthSummary.coreChecking", "Server: Checking...")
  }

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      navigate("/settings/health")
    }
  }

  const statusBgClass =
    coreStatus === "ok"
      ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
      : coreStatus === "fail"
        ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
        : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"

  const statusTextClass =
    coreStatus === "ok"
      ? "text-green-700 dark:text-green-300"
      : coreStatus === "fail"
        ? "text-red-700 dark:text-red-300"
        : "text-gray-600 dark:text-gray-300"

  return (
    <button
      type="button"
      data-testid="connection-status"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${statusBgClass} ${className || ""}`}
      title={
        t(
          "settings:healthSummary.coreAria",
          "Server status - click for diagnostics"
        ) as string
      }
      aria-label={
        t(
          "settings:healthSummary.fullDiagnosticsAria",
          "{{label}}. {{status}}. {{help}}",
          {
            label: t(
              "settings:healthSummary.diagnostics",
              "Health & diagnostics"
            ),
            status: statusLabelForCore(coreStatus),
            help: t(
              "settings:healthSummary.diagnosticsTooltip",
              "Open detailed diagnostics to troubleshoot or inspect health checks."
            ),
          }
        )
      }
    >
      <StatusDot status={coreStatus} />
      {showLabel && (
        <span className={statusTextClass}>
          {statusLabelForCore(coreStatus)}
        </span>
      )}
    </button>
  )
}

/**
 * Simple status dot indicator with animation for unknown state
 */
export function StatusDot({ status }: { status: StatusKind }) {
  return (
    <span
      data-testid="connection-status-dot"
      aria-hidden
      className={`inline-block h-2 w-2 rounded-full ${
        status === "ok"
          ? "bg-green-500"
          : status === "fail"
            ? "bg-red-500"
            : "bg-gray-400 animate-pulse"
      }`}
    />
  )
}

export default ConnectionStatus

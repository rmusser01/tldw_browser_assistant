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

  return (
    <button
      type="button"
      data-testid="connection-status"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 rounded-full border border-transparent px-2 py-1 text-xs transition hover:border-gray-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 dark:hover:border-gray-500 dark:hover:bg-[#1f1f1f] ${className || ""}`}
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
        <span className="text-gray-600 dark:text-gray-300">
          {t("settings:healthSummary.diagnostics", "Health & diagnostics")}
        </span>
      )}
    </button>
  )
}

/**
 * Simple status dot indicator
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
            : "bg-gray-400"
      }`}
    />
  )
}

export default ConnectionStatus

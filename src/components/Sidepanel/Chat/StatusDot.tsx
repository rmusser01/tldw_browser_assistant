import { Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import { Check, Loader2, AlertCircle } from "lucide-react"
import {
  useConnectionActions,
  useConnectionUxState
} from "@/hooks/useConnectionState"

/**
 * Compact connection status indicator with icon and color for accessibility.
 *
 * States:
 * - Connected: Green checkmark
 * - Checking: Yellow spinner
 * - Disconnected/Error: Amber warning icon
 *
 * Uses both color AND shape for color-blind accessibility.
 */
export const StatusDot = () => {
  const { t } = useTranslation(["sidepanel"])
  const { uxState, mode, isConnectedUx, isChecking, isConfigOrError } =
    useConnectionUxState()
  const { checkOnce } = useConnectionActions()

  const tooltip = (() => {
    if (isChecking) {
      return t(
        "sidepanel:header.connection.checking",
        "Checking connection to your tldw server…"
      )
    }
    if (isConnectedUx && mode === "demo") {
      return t(
        "sidepanel:header.connection.demo",
        "Demo mode: explore with a sample workspace."
      )
    }
    if (isConnectedUx) {
      return t(
        "sidepanel:header.connection.ok",
        "Connected to your tldw server"
      )
    }
    if (isConfigOrError) {
      return t(
        "sidepanel:header.connection.unconfigured",
        "Not connected. Open Settings to configure."
      )
    }
    return t(
      "sidepanel:header.connection.failed",
      "Connection failed. Click to retry."
    )
  })()

  const handleClick = () => {
    if (isChecking) return
    if (!isConnectedUx && !isConfigOrError) {
      // Retry connection
      void checkOnce()
    }
  }

  // Render icon based on state - uses shape AND color for accessibility
  const renderStatusIcon = () => {
    if (isChecking) {
      return (
        <Loader2 className="h-3.5 w-3.5 text-yellow-500 animate-spin" />
      )
    }
    if (isConnectedUx) {
      return (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      )
    }
    return (
      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
    )
  }

  return (
    <Tooltip title={tooltip}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isChecking}
        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 disabled:cursor-default"
        aria-label={tooltip}
      >
        {renderStatusIcon()}
      </button>
    </Tooltip>
  )
}

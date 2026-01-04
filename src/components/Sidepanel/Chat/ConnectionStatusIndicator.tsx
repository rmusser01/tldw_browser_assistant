import React from "react"
import { useTranslation } from "react-i18next"
import type { ConnectionUxState } from "@/types/connection"

export interface ConnectionStatusIndicatorProps {
  isConnectionReady: boolean
  uxState: ConnectionUxState
  onOpenSettings: () => void
}

export const ConnectionStatusIndicator: React.FC<
  ConnectionStatusIndicatorProps
> = ({ isConnectionReady, uxState, onOpenSettings }) => {
  const { t } = useTranslation(["sidepanel"])

  if (isConnectionReady) {
    return null
  }

  const isConnecting = uxState === "testing"
  const textColorClass = isConnecting
    ? "text-amber-700 dark:text-amber-300"
    : "text-red-700 dark:text-red-300"
  const dotPingClass = isConnecting ? "bg-amber-400" : "bg-red-400"
  const dotSolidClass = isConnecting ? "bg-amber-500" : "bg-red-500"

  return (
    <div className={`flex items-center gap-2 px-2 py-2 text-xs ${textColorClass}`}>
      {/* Pulsing dot indicator */}
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotPingClass}`}
        />
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${dotSolidClass}`}
        />
      </span>

      {/* Status text */}
      <span>
        {isConnecting
          ? t("sidepanel:composer.connectingStatus", "Connecting to server...")
          : t("sidepanel:composer.disconnectedStatus", "Not connected")}
      </span>

      {/* Settings link when disconnected */}
      {!isConnecting && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="ml-auto text-[11px] font-medium text-red-700 underline hover:text-red-800 dark:text-red-300 dark:hover:text-red-200">
          {t("sidepanel:composer.openSettings", "Open Settings")}
        </button>
      )}
    </div>
  )
}

export default ConnectionStatusIndicator

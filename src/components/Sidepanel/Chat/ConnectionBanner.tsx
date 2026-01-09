import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { Alert, Button, Input, message } from "antd"
import { Settings, RefreshCw, WifiOff, KeyRound, Loader2, Check, Eye, EyeOff } from "lucide-react"
import {
  useConnectionState,
  useConnectionUxState,
  useConnectionActions
} from "@/hooks/useConnectionState"
import { ConnectionPhase } from "@/types/connection"
import { useStorage } from "@plasmohq/storage/hook"

type ConnectionBannerProps = {
  className?: string
}

/**
 * Connection status banner displayed below the header when not connected.
 * Shows contextual messages and actions based on connection state.
 *
 * States:
 * - Connecting: Shows spinner with "Connecting..." message
 * - Auth error: Shows key icon with "API key needs attention" message
 * - Unreachable: Shows wifi-off icon with "Can't reach server" message
 * - Unconfigured: Shows settings icon with "Set up connection" message
 */
export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({
  className
}) => {
  const { t } = useTranslation(["sidepanel", "settings", "common"])
  const { phase, isConnected, serverUrl } = useConnectionState()
  const { uxState, isChecking, hasCompletedFirstRun } = useConnectionUxState()
  const { checkOnce } = useConnectionActions()

  // Inline API key form state
  const [showApiKeyForm, setShowApiKeyForm] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [, setStoredApiKey] = useStorage("tldwApiKey", "")

  // Don't show banner if connected
  const isConnectionReady = isConnected && phase === ConnectionPhase.CONNECTED
  if (isConnectionReady) {
    return null
  }

  const openSettings = () => {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage()
        return
      }
    } catch {}
    window.open("/options.html#/settings/tldw", "_blank")
  }

  const handleRetry = () => {
    void checkOnce()
  }

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) {
      message.error(t("sidepanel:connectionBanner.apiKeyRequired", "Please enter an API key"))
      return
    }

    setIsSaving(true)
    try {
      await setStoredApiKey(apiKeyInput.trim())
      message.success(t("sidepanel:connectionBanner.apiKeySaved", "API key saved"))
      setShowApiKeyForm(false)
      setApiKeyInput("")
      // Trigger a connection check
      setTimeout(() => {
        void checkOnce()
      }, 500)
    } catch (err) {
      message.error(t("sidepanel:connectionBanner.apiKeySaveError", "Failed to save API key"))
    } finally {
      setIsSaving(false)
    }
  }

  // Determine banner content based on state
  const getBannerConfig = () => {
    if (isChecking || uxState === "testing") {
      return {
        type: "info" as const,
        icon: <Loader2 className="size-4 animate-spin" />,
        message: t(
          "sidepanel:connectionBanner.connecting",
          "Connecting to your tldw server..."
        ),
        description: null,
        showRetry: false,
        showSettings: false
      }
    }

    if (uxState === "error_auth") {
      return {
        type: "warning" as const,
        icon: <KeyRound className="size-4" />,
        message: t(
          "sidepanel:connectionBanner.authErrorTitle",
          "API key needs attention"
        ),
        description: t(
          "sidepanel:connectionBanner.authErrorBody",
          "Your server is reachable but the API key is wrong or missing."
        ),
        showRetry: true,
        showSettings: true
      }
    }

    if (uxState === "error_unreachable") {
      return {
        type: "error" as const,
        icon: <WifiOff className="size-4" />,
        message: t(
          "sidepanel:connectionBanner.unreachableTitle",
          "Can't reach your tldw server"
        ),
        description: serverUrl
          ? t(
              "sidepanel:connectionBanner.unreachableBody",
              "Check that your server is running and accessible."
            )
          : t(
              "sidepanel:connectionBanner.noUrlBody",
              "Add your server URL in Settings to get started."
            ),
        showRetry: !!serverUrl,
        showSettings: true
      }
    }

    // Default: unconfigured or unknown state
    return {
      type: "info" as const,
      icon: <Settings className="size-4" />,
      message: hasCompletedFirstRun
        ? t(
            "sidepanel:connectionBanner.disconnectedTitle",
            "Not connected to tldw server"
          )
        : t(
            "sidepanel:connectionBanner.setupTitle",
            "Finish setup to start chatting"
          ),
      description: hasCompletedFirstRun
        ? t(
            "sidepanel:connectionBanner.disconnectedBody",
            "Open Settings to configure your server connection."
          )
        : t(
            "sidepanel:connectionBanner.setupBody",
            "Complete the setup wizard in Settings to connect."
          ),
      showRetry: false,
      showSettings: true
    }
  }

  const config = getBannerConfig()

  return (
    <div className={`px-3 py-2 ${className || ""}`}>
      <Alert
        type={config.type}
        showIcon
        icon={config.icon}
        message={
          <span className="text-sm font-medium">{config.message}</span>
        }
        description={
          config.description && (
            <div className="mt-1">
              <p className="text-xs text-text-muted">
                {config.description}
              </p>

              {/* Inline API key form for auth errors */}
              {uxState === "error_auth" && showApiKeyForm ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input.Password
                      size="small"
                      placeholder={t("sidepanel:connectionBanner.apiKeyPlaceholder", "Enter your API key")}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      onPressEnter={handleSaveApiKey}
                      visibilityToggle={{
                        visible: showApiKey,
                        onVisibleChange: setShowApiKey
                      }}
                      className="flex-1"
                      autoFocus
                    />
                    <Button
                      size="small"
                      type="primary"
                      icon={<Check className="size-3" />}
                      onClick={handleSaveApiKey}
                      loading={isSaving}
                      title={t("common:save", "Save")}
                    >
                      {t("common:save", "Save")}
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowApiKeyForm(false)
                      setApiKeyInput("")
                    }}
                    className="text-xs text-text-subtle hover:text-text underline"
                    title={t("common:cancel", "Cancel")}
                  >
                    {t("common:cancel", "Cancel")}
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {/* Quick fix button for auth errors */}
                  {uxState === "error_auth" && (
                    <Button
                      size="small"
                      type="primary"
                      icon={<KeyRound className="size-3" />}
                      onClick={() => setShowApiKeyForm(true)}
                      title={t("sidepanel:connectionBanner.enterApiKey", "Enter API Key")}
                    >
                      {t("sidepanel:connectionBanner.enterApiKey", "Enter API Key")}
                    </Button>
                  )}
                  {config.showRetry && (
                    <Button
                      size="small"
                      icon={<RefreshCw className="size-3" />}
                      onClick={handleRetry}
                      loading={isChecking}
                      title={t("common:retry", "Retry")}
                    >
                      {t("common:retry", "Retry")}
                    </Button>
                  )}
                  {config.showSettings && (
                    <Button
                      size="small"
                      type={uxState === "error_auth" ? "default" : "primary"}
                      icon={<Settings className="size-3" />}
                      onClick={openSettings}
                      title={t("sidepanel:connectionBanner.openSettings", "Open Settings")}
                    >
                      {t("sidepanel:connectionBanner.openSettings", "Open Settings")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        }
        className="border-0"
      />
    </div>
  )
}

export default ConnectionBanner

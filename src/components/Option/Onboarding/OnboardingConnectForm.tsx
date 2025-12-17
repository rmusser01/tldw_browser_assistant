import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Input, Button, Tooltip, message } from "antd"
import type { InputRef } from "antd"
import type { TFunction } from "i18next"
import {
  Check,
  X,
  Loader2,
  Server,
  Key,
  User,
  Lock,
  AlertCircle,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { getTldwServerURL, DEFAULT_TLDW_API_KEY } from "@/services/tldw-server"
import { tldwAuth } from "@/services/tldw/TldwAuth"
import { mapMultiUserLoginErrorMessage } from "@/services/auth-errors"
import {
  useConnectionState,
  useConnectionActions,
  useConnectionUxState,
} from "@/hooks/useConnectionState"
import { useConnectionStore } from "@/store/connection"
import { useDemoMode } from "@/context/demo-mode"
import { openSidepanelForActiveTab } from "@/utils/sidepanel"
import { cn } from "@/libs/utils"

type AuthMode = "single-user" | "multi-user"

type ConnectionProgress = {
  serverReachable: "idle" | "checking" | "success" | "error"
  authentication: "idle" | "checking" | "success" | "error"
  knowledgeIndex: "idle" | "checking" | "success" | "error" | "empty"
}

type ConnectionErrorKind =
  | "dns_failed"
  | "refused"
  | "timeout"
  | "ssl_error"
  | "auth_invalid"
  | "server_error"
  | null

type ValidationResult = {
  success: boolean
  error?: string
  errorKind?: ConnectionErrorKind
}

interface Props {
  onFinish?: () => void
}

const validateMultiUserAuth = async (
  username: string,
  password: string,
  t: TFunction
): Promise<ValidationResult> => {
  try {
    await tldwAuth.login({ username, password })
    return { success: true }
  } catch (error: unknown) {
    const friendly = mapMultiUserLoginErrorMessage(t, error, "onboarding")
    return {
      success: false,
      errorKind: "auth_invalid",
      error: friendly,
    }
  }
}

const validateApiKey = async (
  serverUrl: string,
  apiKey: string,
  t: TFunction
): Promise<ValidationResult> => {
  try {
    const isValid = await tldwAuth.testApiKey(serverUrl, apiKey)
    if (!isValid) {
      return {
        success: false,
        errorKind: "auth_invalid",
        error: t(
          "settings:onboarding.errors.invalidApiKey",
          "Invalid API key. Please check your key and try again."
        ),
      }
    }
    return { success: true }
  } catch (error: unknown) {
    return {
      success: false,
      errorKind: "auth_invalid",
      error:
        (error as Error)?.message ||
        t(
          "settings:onboarding.errors.apiKeyValidationFailed",
          "API key validation failed"
        ),
    }
  }
}

const ProgressItem = ({
  label,
  status,
}: {
  label: string
  status: ConnectionProgress[keyof ConnectionProgress]
}) => {
  const { t } = useTranslation(["settings", "common"])

  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center",
          status === "idle" && "bg-gray-200 dark:bg-gray-700",
          status === "checking" && "bg-blue-100 dark:bg-blue-900/30",
          status === "success" && "bg-green-100 dark:bg-green-900/30",
          status === "error" && "bg-red-100 dark:bg-red-900/30",
          status === "empty" && "bg-amber-100 dark:bg-amber-900/30"
        )}
      >
        {status === "idle" && (
          <div className="w-2 h-2 rounded-full bg-gray-400" />
        )}
        {status === "checking" && (
          <Loader2 className="size-3 text-blue-600 animate-spin" />
        )}
        {status === "success" && <Check className="size-3 text-green-600" />}
        {status === "error" && <X className="size-3 text-red-600" />}
        {status === "empty" && (
          <AlertCircle className="size-3 text-amber-600" />
        )}
      </div>
      <span
        className={cn(
          "text-gray-700 dark:text-gray-300",
          status === "checking" &&
            "font-medium text-blue-600 dark:text-blue-400",
          status === "success" && "text-green-600 dark:text-green-400",
          status === "error" && "text-red-600 dark:text-red-400"
        )}
      >
        {label}
      </span>
      {status === "checking" && (
        <span className="text-xs text-gray-400 animate-pulse">
          {t("common:checking", "Checking...")}
        </span>
      )}
      {status === "empty" && (
        <span className="text-xs text-amber-600 dark:text-amber-400">
          {t(
            "settings:onboarding.progress.noIndex",
            "No documents indexed yet"
          )}
        </span>
      )}
    </div>
  )
}

/**
 * Single-step onboarding form for the new UX redesign.
 * Features:
 * - Progressive connection testing with real-time feedback
 * - Demo mode prominently displayed
 * - Granular error messages
 * - All fields on one page (no multi-step wizard)
 */
export function OnboardingConnectForm({ onFinish }: Props) {
  const { t } = useTranslation(["settings", "common"])
  const { setDemoEnabled } = useDemoMode()
  const connectionState = useConnectionState()
  const { uxState } = useConnectionUxState()
  const actions = useConnectionActions()

  // Form state
  const [serverUrl, setServerUrl] = useState("")
  const [authMode, setAuthMode] = useState<AuthMode>("single-user")
  const [apiKey, setApiKey] = useState(DEFAULT_TLDW_API_KEY)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)

  // UI state
  const [isConnecting, setIsConnecting] = useState(false)
  const [progress, setProgress] = useState<ConnectionProgress>({
    serverReachable: "idle",
    authentication: "idle",
    knowledgeIndex: "idle",
  })
  const [errorKind, setErrorKind] = useState<ConnectionErrorKind>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [hasRunConnectionTest, setHasRunConnectionTest] = useState(false)

  const urlInputRef = useRef<InputRef | null>(null)
  const hasLoadedInitialConfigRef = useRef(false)

  // Load initial config
  useEffect(() => {
    if (hasLoadedInitialConfigRef.current) return
    hasLoadedInitialConfigRef.current = true

    ;(async () => {
      try {
        actions.beginOnboarding()
        const cfg = await tldwClient.getConfig()
        if (cfg?.serverUrl) setServerUrl(cfg.serverUrl)
        if (cfg?.authMode) setAuthMode(cfg.authMode)
        if (cfg?.apiKey) setApiKey(cfg.apiKey)

        if (!cfg?.serverUrl) {
          const fallback = await getTldwServerURL()
          if (fallback) setServerUrl(fallback)
        }
      } catch {
        // Ignore config load errors
      }
    })()
  }, [actions])
  // ^ Guarded by ref to effectively run only once while keeping actions in dependencies

  // URL validation
  const urlValidation = useMemo(() => {
    const trimmed = serverUrl.trim()
    if (!trimmed) return { valid: false, reason: "empty" as const }
    try {
      const parsed = new URL(trimmed)
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return { valid: false, reason: "protocol" as const }
      }
      return { valid: true, reason: "ok" as const }
    } catch {
      return { valid: false, reason: "invalid" as const }
    }
  }, [serverUrl])

  // Derive error messages from errorKind
  const errorHint = useMemo(() => {
    switch (errorKind) {
      case "dns_failed":
        return t(
          "settings:onboarding.errors.dns",
          "Could not find server. Check the URL hostname."
        )
      case "refused":
        return t(
          "settings:onboarding.errors.refused",
          "Connection refused. Is the server running?"
        )
      case "timeout":
        return t(
          "settings:onboarding.errors.timeout",
          "Connection timed out. The server may be slow or unreachable."
        )
      case "ssl_error":
        return t(
          "settings:onboarding.errors.ssl",
          "SSL certificate error. Check your server's HTTPS configuration."
        )
      case "auth_invalid":
        return t(
          "settings:onboarding.errors.auth",
          "Invalid credentials. Check your API key or login details."
        )
      case "server_error":
        return t(
          "settings:onboarding.errors.server",
          "Server error (500). Check the server logs for details."
        )
      default:
        return null
    }
  }, [errorKind, t])

  // Categorize errors from status code and error message
  const categorizeError = useCallback(
    (status: number | null, error: string | null): ConnectionErrorKind => {
      if (status === 401 || status === 403) return "auth_invalid"
      if (status && status >= 500) return "server_error"
      if (error?.includes("timeout")) return "timeout"
      if (error?.includes("ENOTFOUND") || error?.includes("getaddrinfo"))
        return "dns_failed"
      if (error?.includes("ECONNREFUSED")) return "refused"
      if (error?.includes("SSL") || error?.includes("certificate"))
        return "ssl_error"
      if (!status && error) return "refused"
      return null
    },
    []
  )

  // Handle progressive connection test
  const handleConnect = useCallback(async () => {
    if (!urlValidation.valid) return

    setHasRunConnectionTest(true)
    setIsConnecting(true)
    setErrorKind(null)
    setErrorMessage(null)
    setProgress({
      serverReachable: "checking",
      authentication: "idle",
      knowledgeIndex: "idle",
    })

    try {
      // Phase 1: Set server URL and check reachability
      await actions.setConfigPartial({ serverUrl })

      // Give a moment for the UI to show "checking"
      await new Promise((r) => setTimeout(r, 300))

      // Phase 2: Test auth
      setProgress((p) => ({
        ...p,
        serverReachable: "success",
        authentication: "checking",
      }))

      // Validate auth credentials
      let authResult: ValidationResult | null = null
      if (authMode === "multi-user" && username && password) {
        authResult = await validateMultiUserAuth(username, password, t)
      } else if (authMode === "single-user" && apiKey) {
        // Validate API key before saving
        authResult = await validateApiKey(serverUrl, apiKey, t)
      }

      if (authResult && !authResult.success) {
        setProgress((p) => ({
          ...p,
          authentication: "error",
        }))
        if (authResult.errorKind) {
          setErrorKind(authResult.errorKind)
        }
        if (authResult.error) {
          setErrorMessage(authResult.error)
        }

        setIsConnecting(false)
        return
      }

      await actions.setConfigPartial({
        authMode,
        apiKey: authMode === "single-user" ? apiKey : undefined,
      })

      // Phase 3: Run full connection test (authentication is verified here)
      setProgress((p) => ({
        ...p,
        authentication: "checking",
        knowledgeIndex: "idle",
      }))

      try {
        await actions.testConnectionFromOnboarding()
      } catch (error) {
        // If full connection test fails, reflect auth error if we're still in that phase
        setProgress((p) => ({
          ...p,
          authentication:
            p.authentication === "checking" ? "error" : p.authentication,
        }))
        throw error
      }
    } catch (error) {
      setProgress((p) => ({
        ...p,
        // Only set serverReachable to error if we never marked it successful
        serverReachable:
          p.serverReachable === "checking" ? "error" : p.serverReachable,
      }))
      const message = (error as Error)?.message || null
      const kind =
        categorizeError(null, message) ?? ("refused" as ConnectionErrorKind)
      setErrorKind(kind)
      setErrorMessage(message || "Connection failed")
    } finally {
      setIsConnecting(false)
    }
  }, [
    urlValidation.valid,
    serverUrl,
    authMode,
    apiKey,
    username,
    password,
    categorizeError,
    t,
    actions,
  ])

  // React to connection test results using hook state
  useEffect(() => {
    if (!hasRunConnectionTest) return

    const state = connectionState
    const isConnected = state.isConnected

    if (isConnected) {
      const knowledgeOk =
        state.knowledgeStatus === "ready" ||
        state.knowledgeStatus === "indexing"
      const knowledgeEmpty = state.knowledgeStatus === "empty"

      setProgress((p) => ({
        ...p,
        authentication: "success",
        knowledgeIndex: knowledgeEmpty
          ? "empty"
          : knowledgeOk
            ? "success"
            : "error",
      }))

      // Show success state
      setShowSuccess(true)
    } else if (!state.isChecking) {
      // Connection failed
      const kind = categorizeError(state.lastStatusCode, state.lastError)
      setErrorKind(kind)
      setErrorMessage(state.lastError)

      if (state.errorKind === "auth") {
        setProgress((p) => ({
          ...p,
          serverReachable: "success",
          authentication: "error",
          knowledgeIndex: "idle",
        }))
      } else {
        setProgress((p) => ({
          ...p,
          serverReachable: "error",
          authentication: "idle",
          knowledgeIndex: "idle",
        }))
      }
    }
  }, [hasRunConnectionTest, connectionState, categorizeError])

  // Handle demo mode
  const handleDemoMode = useCallback(async () => {
    setDemoEnabled(true)
    actions.setDemoMode()
    try {
      await actions.markFirstRunComplete()
    } catch {
      // ignore persistence errors; demo mode remains active in memory
    }
    onFinish?.()
  }, [setDemoEnabled, actions, onFinish])

  // Handle finish
  const handleFinish = useCallback(async () => {
    try {
      await actions.markFirstRunComplete()
    } catch {
      // ignore persistence errors; UI has already completed onboarding
    }
    onFinish?.()
  }, [actions, onFinish])

  // Copy server command
  const handleCopyCommand = useCallback(
    (cmd: string) => {
      if (!navigator.clipboard?.writeText) {
        message.error(t("common:copyFailed", "Copy failed"))
        return
      }

      navigator.clipboard.writeText(cmd).then(
        () => message.success(t("common:copied", "Copied!")),
        () => message.error(t("common:copyFailed", "Copy failed"))
      )
    },
    [t]
  )

  // Open docs
  const openDocs = useCallback(() => {
    window.open(
      "https://github.com/rmusser01/tldw_browser_assistant",
      "_blank",
      "noopener,noreferrer"
    )
  }, [])

  // Success screen
  if (showSuccess) {
    return (
      <div className="mx-auto w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
            <Check className="size-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {t("settings:onboarding.success.title", "You're connected!")}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t(
              "settings:onboarding.success.subtitle",
              "Your tldw server is ready. What would you like to do first?"
            )}
          </p>
        </div>

        <div className="grid gap-3">
          <button
            onClick={async () => {
              try {
                await openSidepanelForActiveTab()
              } catch (err) {
                console.debug(
                  "[OnboardingConnectForm] Failed to open sidepanel",
                  err
                )
                message.warning(
                  t(
                    "settings:onboarding.success.sidepanelOpenFailed",
                    "Could not open sidepanel automatically. Please try opening it manually from the extension icon."
                  )
                )
              }
              handleFinish()
            }}
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
              <Sparkles className="size-5 text-pink-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {t("settings:onboarding.success.chat", "Start chatting")}
              </div>
              <div className="text-xs text-gray-500">
                {t(
                  "settings:onboarding.success.chatDesc",
                  "Open the sidepanel and ask your first question"
                )}
              </div>
            </div>
            <ArrowRight className="size-4 text-gray-400" />
          </button>

          <button
            onClick={handleFinish}
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Server className="size-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {t("settings:onboarding.success.explore", "Explore settings")}
              </div>
              <div className="text-xs text-gray-500">
                {t(
                  "settings:onboarding.success.exploreDesc",
                  "Configure models, prompts, and more"
                )}
              </div>
            </div>
            <ArrowRight className="size-4 text-gray-400" />
          </button>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={handleFinish}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            {t("common:done", "Done")}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {t("settings:onboarding.title", "Welcome to tldw Assistant")}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t(
            "settings:onboarding.valueProp",
            "Chat with AI, save web content, and build your personal knowledge base."
          )}
        </p>
      </div>

      {/* Demo Mode - Prominent placement for users without a server */}
      <div className="mb-6 p-4 rounded-lg border-2 border-dashed border-purple-300 dark:border-purple-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shrink-0">
            <Sparkles className="size-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              {t("settings:onboarding.demo.titleNoServer", "No server? Try Demo Mode")}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {t(
                "settings:onboarding.demo.descriptionShort",
                "Explore the extension with sample data - no setup required."
              )}
            </p>
          </div>
          <Button
            type="primary"
            onClick={handleDemoMode}
            className="shrink-0 bg-gradient-to-r from-purple-500 to-pink-500 border-0 hover:from-purple-600 hover:to-pink-600"
          >
            {t("settings:onboarding.demo.buttonTry", "Try Demo")}
          </Button>
        </div>
      </div>

      {/* Divider with "or connect to your server" */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white dark:bg-gray-900 px-2 text-gray-500">
            {t("settings:onboarding.orConnectServer", "or connect to your server")}
          </span>
        </div>
      </div>

      {/* Server URL */}
      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <Server className="size-4" />
            {t("settings:onboarding.serverUrl.label", "Server URL")}
          </label>
          <div className="relative">
            <Input
              ref={urlInputRef}
              placeholder={t(
                "settings:onboarding.serverUrl.placeholder",
                "http://127.0.0.1:8000"
              )}
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              status={
                serverUrl && !urlValidation.valid ? "error" : undefined
              }
              disabled={isConnecting}
              size="large"
              suffix={
                serverUrl && urlValidation.valid ? (
                  <Check className="size-4 text-green-500" aria-label={t("common:valid", "Valid")} />
                ) : serverUrl && !urlValidation.valid ? (
                  <X className="size-4 text-red-500" aria-label={t("common:invalid", "Invalid")} />
                ) : null
              }
              aria-describedby={serverUrl && !urlValidation.valid ? "url-error" : undefined}
            />
          </div>
          {serverUrl && !urlValidation.valid && (
            <p id="url-error" role="alert" className="mt-1 text-xs text-red-500">
              {urlValidation.reason === "protocol"
                ? t(
                    "settings:onboarding.serverUrl.protocolError",
                    "URL must start with http:// or https://"
                  )
                : t(
                    "settings:onboarding.serverUrl.invalidError",
                    "Please enter a valid URL"
                  )}
            </p>
          )}
          {serverUrl && urlValidation.valid && !isConnecting && progress.serverReachable === "idle" && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">
              {t("settings:onboarding.serverUrl.validUrl", "URL format is valid. Click Connect to test the connection.")}
            </p>
          )}
        </div>

        {/* Auth Mode Toggle */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
            {t("settings:onboarding.authMode.label", "Authentication")}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAuthMode("single-user")}
              disabled={isConnecting}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
                authMode === "single-user"
                  ? "border-pink-500 bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-300"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
            >
              <Key className="size-4" />
              {t("settings:onboarding.authMode.single", "API Key")}
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("multi-user")}
              disabled={isConnecting}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors",
                authMode === "multi-user"
                  ? "border-pink-500 bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-300"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
            >
              <User className="size-4" />
              {t("settings:onboarding.authMode.multi", "Login")}
            </button>
          </div>
        </div>

        {/* Auth Fields */}
        {authMode === "single-user" ? (
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              <Key className="size-4" />
              {t("settings:onboarding.apiKey.label", "API Key")}
            </label>
            <Input.Password
              placeholder={t(
                "settings:onboarding.apiKey.placeholder",
                "Enter your API key"
              )}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isConnecting}
            />
            <p className="mt-1 text-xs text-gray-500">
              {t(
                "settings:onboarding.apiKeyHelp",
                "Find your API key in tldw_server Settings"
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <User className="size-4" />
                {t("settings:onboarding.username.label", "Username")}
              </label>
              <Input
                placeholder={t(
                  "settings:onboarding.username.placeholder",
                  "Enter username"
                )}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isConnecting}
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <Lock className="size-4" />
                {t("settings:onboarding.password.label", "Password")}
              </label>
              <Input.Password
                placeholder={t(
                  "settings:onboarding.password.placeholder",
                  "Enter password"
                )}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isConnecting}
              />
            </div>
          </div>
        )}

        {/* Connection Progress */}
        {(progress.serverReachable !== "idle" || isConnecting) && (
          <div
            className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 space-y-2"
            role="status"
            aria-live="polite"
            aria-busy={isConnecting}
          >
            <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2">
              {isConnecting && <Loader2 className="size-3 animate-spin" />}
              {t("settings:onboarding.progress.title", "Connection Status")}
            </div>
            <ProgressItem
              label={t("settings:onboarding.progress.server", "Server reachable")}
              status={progress.serverReachable}
            />
            <ProgressItem
              label={t("settings:onboarding.progress.auth", "Authentication")}
              status={progress.authentication}
            />
            <ProgressItem
              label={t("settings:onboarding.progress.knowledge", "Knowledge index")}
              status={progress.knowledgeIndex}
            />
          </div>
        )}

        {/* Error display */}
        {errorKind && (
          <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 text-red-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium text-red-800 dark:text-red-200">
                  {t("settings:onboarding.connectionFailed", "Connection failed")}
                </div>
                {errorHint && (
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                    {errorHint}
                  </p>
                )}
                {errorMessage && errorMessage !== errorHint && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-mono">
                    {errorMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Connect Button */}
        <Button
          type="primary"
          size="large"
          block
          onClick={handleConnect}
          disabled={!urlValidation.valid || isConnecting}
          loading={isConnecting}
          icon={isConnecting ? undefined : <ArrowRight className="size-4" />}
        >
          {isConnecting
            ? t("settings:onboarding.buttons.connecting", "Connecting...")
            : t("settings:onboarding.buttons.connect", "Connect")}
        </Button>

        {/* Retry if error */}
        {errorKind && !isConnecting && (
          <Button
            type="default"
            block
            onClick={handleConnect}
            icon={<RefreshCw className="size-4" />}
          >
            {t("common:retry", "Retry")}
          </Button>
        )}
      </div>

      {/* Advanced: Server commands */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          {showAdvanced ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          {t(
            "settings:onboarding.advanced.title",
            "Need to start your server?"
          )}
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-2 text-xs">
            {[
              {
                label: t(
                  "settings:onboarding.startServer.optionLocal",
                  "Run locally with Python"
                ),
                command:
                  "python -m uvicorn tldw_Server_API.app.main:app --reload",
              },
              {
                label: t(
                  "settings:onboarding.startServer.optionDocker",
                  "Run with Docker"
                ),
                command:
                  "docker compose -f Dockerfiles/docker-compose.yml up -d --build",
              },
            ].map((cmd) => (
              <div
                key={cmd.command}
                className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {cmd.label}
                  </span>
                  <Tooltip title={t("common:copy", "Copy")}>
                    <button
                      onClick={() => handleCopyCommand(cmd.command)}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <Copy className="size-3 text-gray-400" />
                    </button>
                  </Tooltip>
                </div>
                <pre className="px-2 py-1 rounded bg-gray-900 text-gray-100 overflow-x-auto">
                  <code>{cmd.command}</code>
                </pre>
              </div>
            ))}

            <button
              onClick={openDocs}
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {t("settings:onboarding.serverDocsCta", "View full setup guide")}
              <ExternalLink className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* Skip link */}
      <div className="mt-6 text-center">
        <button
          onClick={handleFinish}
          className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {t("settings:onboarding.buttons.skip", "Skip for now")}
        </button>
      </div>
    </div>
  )
}

export default OnboardingConnectForm

import { useState, useEffect, useMemo, useCallback, useRef, useReducer } from "react"
import { Input, Button, Tooltip, message, Select } from "antd"
import type { InputRef } from "antd"
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
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useStorage } from "@plasmohq/storage/hook"
import { DOCUMENTATION_URL } from "@/config/constants"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import {
  getTldwServerURL,
  DEFAULT_TLDW_API_KEY,
  fetchChatModels,
} from "@/services/tldw-server"
import {
  useConnectionState,
  useConnectionActions,
  useConnectionUxState,
} from "@/hooks/useConnectionState"
import { useConnectionStore } from "@/store/connection"
import { useDemoMode } from "@/context/demo-mode"
import { openSidepanelForActiveTab } from "@/utils/sidepanel"
import { cn } from "@/libs/utils"
import { getProviderDisplayName, normalizeProviderKey } from "@/utils/provider-registry"
import {
  validateApiKey,
  validateMultiUserAuth,
  categorizeConnectionError,
  type ConnectionErrorKind,
  type ValidationResult,
} from "./validation"
import { ProgressItem, type ProgressStatus } from "./ProgressItem"

type AuthMode = "single-user" | "multi-user"

type ConnectionProgress = {
  serverReachable: ProgressStatus
  authentication: ProgressStatus
  knowledgeIndex: ProgressStatus
}

type ConnectionUiState = {
  isConnecting: boolean
  progress: ConnectionProgress
  errorKind: ConnectionErrorKind
  errorMessage: string | null
  showSuccess: boolean
  hasRunConnectionTest: boolean
}

type ConnectionUiAction =
  | { type: "START_CONNECT" }
  | { type: "FINISH_CONNECT" }
  | {
      type: "UPDATE_PROGRESS"
      updater: (prev: ConnectionProgress) => ConnectionProgress
    }
  | {
      type: "SET_ERROR"
      errorKind: ConnectionErrorKind
      errorMessage: string | null
    }
  | {
      type: "SET_SHOW_SUCCESS"
      showSuccess: boolean
    }
  | {
      type: "SET_HAS_RUN_TEST"
      hasRunConnectionTest: boolean
    }

const initialConnectionUiState: ConnectionUiState = {
  isConnecting: false,
  progress: {
    serverReachable: "idle",
    authentication: "idle",
    knowledgeIndex: "idle",
  },
  errorKind: null,
  errorMessage: null,
  showSuccess: false,
  hasRunConnectionTest: false,
}

function connectionUiReducer(
  state: ConnectionUiState,
  action: ConnectionUiAction
): ConnectionUiState {
  switch (action.type) {
    case "START_CONNECT":
      return {
        ...state,
        hasRunConnectionTest: true,
        isConnecting: true,
        errorKind: null,
        errorMessage: null,
        progress: {
          serverReachable: "checking",
          authentication: "idle",
          knowledgeIndex: "idle",
        },
        showSuccess: false,
      }
    case "FINISH_CONNECT":
      return {
        ...state,
        isConnecting: false,
      }
    case "UPDATE_PROGRESS":
      return {
        ...state,
        progress: action.updater(state.progress),
      }
    case "SET_ERROR":
      return {
        ...state,
        errorKind: action.errorKind,
        errorMessage: action.errorMessage,
      }
    case "SET_SHOW_SUCCESS":
      return {
        ...state,
        showSuccess: action.showSuccess,
      }
    case "SET_HAS_RUN_TEST":
      return {
        ...state,
        hasRunConnectionTest: action.hasRunConnectionTest,
      }
    default:
      return state
  }
}

interface Props {
  onFinish?: () => void
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
  const [authTouched, setAuthTouched] = useState(false)
  const [selectedModel, setSelectedModel] = useStorage<string | null>(
    "selectedModel",
    null
  )
  const [defaultApiProvider, setDefaultApiProvider] = useStorage<
    string | null
  >("defaultApiProvider", null)

  // UI state (managed via reducer)
  const [uiState, dispatchUi] = useReducer(
    connectionUiReducer,
    initialConnectionUiState
  )
  const {
    isConnecting,
    progress,
    errorKind,
    errorMessage,
    showSuccess,
    hasRunConnectionTest,
  } = uiState

  const {
    data: availableModels = [],
    isLoading: modelsLoading,
  } = useQuery({
    queryKey: ["onboarding-chat-models", serverUrl],
    queryFn: async () => fetchChatModels({ returnEmpty: true }),
    enabled: showSuccess,
    staleTime: 5 * 60 * 1000,
  })

  const normalizeProviderValue = useCallback(
    (value?: string | null) => String(value || "").trim().toLowerCase(),
    []
  )
  const normalizedDefaultProvider = normalizeProviderValue(defaultApiProvider)
  const providerSelectValue = normalizedDefaultProvider || "auto"

  const providerOptions = useMemo(() => {
    const providers = new Map<string, string>()
    for (const model of availableModels) {
      const rawProvider = model.details?.provider ?? model.provider
      if (!rawProvider) continue
      const key = normalizeProviderKey(rawProvider)
      if (!key || key === "unknown") continue
      if (!providers.has(key)) {
        providers.set(key, getProviderDisplayName(rawProvider))
      }
    }
    return Array.from(providers.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [availableModels])

  const modelOptions = useMemo(() => {
    return availableModels
      .filter((model) => {
        if (!normalizedDefaultProvider) return true
        const rawProvider = model.details?.provider ?? model.provider
        if (!rawProvider) return false
        return (
          normalizeProviderKey(rawProvider) === normalizedDefaultProvider
        )
      })
      .map((model) => {
        const rawProvider = model.details?.provider ?? model.provider
        const providerLabel = rawProvider
          ? getProviderDisplayName(rawProvider)
          : t("settings:onboarding.defaults.providerUnknown", "Provider")
        const modelLabel = model.nickname || model.model
        return {
          value: model.model,
          label: `${providerLabel} - ${modelLabel}`,
        }
      })
  }, [availableModels, normalizedDefaultProvider, t])

  useEffect(() => {
    if (!normalizedDefaultProvider || !selectedModel) return
    if (availableModels.length === 0) return
    const selectedEntry = availableModels.find(
      (model) => model.model === selectedModel
    )
    if (!selectedEntry) return
    const rawProvider = selectedEntry.details?.provider ?? selectedEntry.provider
    if (!rawProvider) return
    if (normalizeProviderKey(rawProvider) !== normalizedDefaultProvider) {
      setSelectedModel(null)
    }
  }, [
    availableModels,
    normalizedDefaultProvider,
    selectedModel,
    setSelectedModel,
  ])

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

  const authValidation = useMemo(() => {
    if (authMode === "single-user") {
      const missingApiKey = apiKey.trim().length === 0
      return {
        valid: !missingApiKey,
        missingApiKey,
        missingUsername: false,
        missingPassword: false,
      }
    }

    const missingUsername = username.trim().length === 0
    const missingPassword = password.trim().length === 0
    return {
      valid: !missingUsername && !missingPassword,
      missingApiKey: false,
      missingUsername,
      missingPassword,
    }
  }, [authMode, apiKey, username, password])

  const showAuthErrors = authTouched && !authValidation.valid

  useEffect(() => {
    setAuthTouched(false)
  }, [authMode])

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

  // Handle progressive connection test
  const handleConnect = useCallback(async () => {
    if (!urlValidation.valid) return
    setAuthTouched(true)
    if (!authValidation.valid) {
      dispatchUi({ type: "SET_ERROR", errorKind: null, errorMessage: null })
      return
    }

    dispatchUi({ type: "START_CONNECT" })

    try {
      // Phase 1: Set server URL and check reachability
      await actions.setConfigPartial({ serverUrl })

      // Give a moment for the UI to show "checking"
      await new Promise((r) => setTimeout(r, 300))

      // Phase 2: Test auth
      dispatchUi({
        type: "UPDATE_PROGRESS",
        updater: (p) => ({
          ...p,
          serverReachable: "success",
          authentication: "checking",
        }),
      })

      // Validate auth credentials
      let authResult: ValidationResult | null = null
      if (authMode === "multi-user" && username && password) {
        authResult = await validateMultiUserAuth(username, password, t)
      } else if (authMode === "single-user" && apiKey) {
        // Validate API key before saving
        authResult = await validateApiKey(serverUrl, apiKey, t)
      }

      if (authResult && !authResult.success) {
        dispatchUi({
          type: "UPDATE_PROGRESS",
          updater: (p) => ({
            ...p,
            authentication: "error",
          }),
        })
        if (authResult.errorKind || authResult.error) {
          dispatchUi({
            type: "SET_ERROR",
            errorKind: authResult.errorKind ?? null,
            errorMessage: authResult.error ?? null,
          })
        }

        dispatchUi({ type: "FINISH_CONNECT" })
        return
      }

      await actions.setConfigPartial({
        authMode,
        apiKey: authMode === "single-user" ? apiKey : undefined,
      })

      // Phase 3: Run full connection test (authentication is verified here)
      dispatchUi({
        type: "UPDATE_PROGRESS",
        updater: (p) => ({
          ...p,
          authentication: "checking",
          knowledgeIndex: "idle",
        }),
      })

      try {
        await actions.testConnectionFromOnboarding()
      } catch (error) {
        // If full connection test fails, reflect auth error if we're still in that phase
        dispatchUi({
          type: "UPDATE_PROGRESS",
          updater: (p) => ({
            ...p,
            authentication:
              p.authentication === "checking" ? "error" : p.authentication,
          }),
        })
        throw error
      }
    } catch (error) {
      dispatchUi({
        type: "UPDATE_PROGRESS",
        updater: (p) => ({
          ...p,
          // Only set serverReachable to error if we never marked it successful
          serverReachable:
            p.serverReachable === "checking" ? "error" : p.serverReachable,
        }),
      })
      const message = (error as Error)?.message || null
      const status =
        (error as any)?.status ??
        (error as any)?.response?.status ??
        (error as any)?.statusCode ??
        null
      const kind =
        categorizeConnectionError(status, message) ??
        ("refused" as ConnectionErrorKind)
      dispatchUi({
        type: "SET_ERROR",
        errorKind: kind,
        errorMessage: message || "Connection failed",
      })
    } finally {
      dispatchUi({ type: "FINISH_CONNECT" })
    }
  }, [
    urlValidation.valid,
    authValidation.valid,
    serverUrl,
    authMode,
    apiKey,
    username,
    password,
    t,
    actions,
    dispatchUi,
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

      dispatchUi({
        type: "UPDATE_PROGRESS",
        updater: (p) => ({
          ...p,
          authentication: "success",
          knowledgeIndex: knowledgeEmpty
            ? "empty"
            : knowledgeOk
              ? "success"
              : "error",
        }),
      })

      // Show success state
      dispatchUi({ type: "SET_SHOW_SUCCESS", showSuccess: true })
    } else if (!state.isChecking) {
      // Connection failed
      const kind = categorizeConnectionError(
        state.lastStatusCode,
        state.lastError
      )
      dispatchUi({
        type: "SET_ERROR",
        errorKind: kind,
        errorMessage: state.lastError ?? null,
      })

      if (state.errorKind === "auth") {
        dispatchUi({
          type: "UPDATE_PROGRESS",
          updater: (p) => ({
            ...p,
            serverReachable: "success",
            authentication: "error",
            knowledgeIndex: "idle",
          }),
        })
      } else {
        dispatchUi({
          type: "UPDATE_PROGRESS",
          updater: (p) => ({
            ...p,
            serverReachable: "error",
            authentication: "idle",
            knowledgeIndex: "idle",
          }),
        })
      }
    }
  }, [hasRunConnectionTest, connectionState, dispatchUi])

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
    window.open(DOCUMENTATION_URL, "_blank", "noopener,noreferrer")
  }, [])

  // Success screen
  if (showSuccess) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-border/70 bg-surface/95 p-8 shadow-lg shadow-black/5 backdrop-blur">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10">
            <Check className="size-7 text-success" />
          </div>
          <h2 className="text-2xl font-semibold text-text tracking-tight">
            {t("settings:onboarding.success.title", "You're connected!")}
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            {t(
              "settings:onboarding.success.subtitle",
              "Your tldw server is ready. What would you like to do first?"
            )}
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-border/70 bg-surface p-4">
          <div className="mb-3">
            <div className="text-sm font-semibold text-text">
              {t("settings:onboarding.defaults.title", "Set your defaults")}
            </div>
            <p className="text-xs text-text-subtle">
              {t(
                "settings:onboarding.defaults.subtitle",
                "Pick a default provider and model for new chats."
              )}
            </p>
          </div>
          {modelsLoading ? (
            <div className="flex items-center gap-2 text-xs text-text-subtle">
              <Loader2 className="size-3 animate-spin" />
              {t(
                "settings:onboarding.defaults.loading",
                "Loading models..."
              )}
            </div>
          ) : availableModels.length === 0 ? (
            <p className="text-xs text-text-subtle">
              {t(
                "settings:onboarding.defaults.empty",
                "No models are available yet. You can set this later in Settings > Models."
              )}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text">
                  {t(
                    "settings:onboarding.defaults.providerLabel",
                    "Default API provider"
                  )}
                </label>
                <Select
                  size="large"
                  value={providerSelectValue}
                  onChange={(value) => {
                    const normalized =
                      value === "auto"
                        ? null
                        : normalizeProviderValue(value)
                    setDefaultApiProvider(normalized)
                  }}
                  options={[
                    {
                      value: "auto",
                      label: t(
                        "settings:onboarding.defaults.providerAuto",
                        "Auto (from model)"
                      ),
                    },
                    ...providerOptions,
                  ]}
                  className="w-full"
                />
                <p className="mt-1 text-[11px] text-text-subtle">
                  {t(
                    "settings:onboarding.defaults.providerHelp",
                    "Leave on Auto to use the provider attached to each model."
                  )}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text">
                  {t(
                    "settings:onboarding.defaults.modelLabel",
                    "Default model"
                  )}
                </label>
                <Select
                  showSearch
                  size="large"
                  value={selectedModel || undefined}
                  onChange={(value) => setSelectedModel(value || null)}
                  placeholder={t(
                    "settings:onboarding.defaults.modelPlaceholder",
                    "Select a model"
                  )}
                  options={modelOptions}
                  optionFilterProp="label"
                  className="w-full"
                  allowClear
                />
                <p className="mt-1 text-[11px] text-text-subtle">
                  {t(
                    "settings:onboarding.defaults.modelHelp",
                    "This becomes the starting model when you open a new chat."
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4">
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
            className="flex items-center gap-3 rounded-2xl border border-border/70 bg-surface p-4 text-left transition-colors hover:bg-surface2"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
              <Sparkles className="size-5 text-accent" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-text">
                {t("settings:onboarding.success.chat", "Start chatting")}
              </div>
              <div className="text-xs text-text-subtle">
                {t(
                  "settings:onboarding.success.chatDesc",
                  "Open the sidepanel and ask your first question"
                )}
              </div>
            </div>
            <ArrowRight className="size-4 text-text-subtle" />
          </button>

          <button
            onClick={handleFinish}
            className="flex items-center gap-3 rounded-2xl border border-border/70 bg-surface p-4 text-left transition-colors hover:bg-surface2"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Server className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-text">
                {t("settings:onboarding.success.explore", "Explore settings")}
              </div>
              <div className="text-xs text-text-subtle">
                {t(
                  "settings:onboarding.success.exploreDesc",
                  "Configure models, prompts, and more"
                )}
              </div>
            </div>
            <ArrowRight className="size-4 text-text-subtle" />
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={handleFinish}
            className="text-sm text-text-subtle hover:text-text"
          >
            {t("common:done", "Done")}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl rounded-3xl border border-border/70 bg-surface/95 p-8 shadow-lg shadow-black/5 backdrop-blur">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-text tracking-tight">
          {t("settings:onboarding.title", "Welcome to tldw Assistant")}
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          {t(
            "settings:onboarding.valueProp",
            "Chat with AI, save web content, and build your personal knowledge base."
          )}
        </p>
      </div>

      {/* Demo Mode - Prominent placement for users without a server */}
      <div className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-accent/10 to-surface p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-sm shadow-primary/20">
            <Sparkles className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-text">
              {t("settings:onboarding.demo.titleNoServer", "No server? Try Demo Mode")}
            </h3>
            <p className="text-xs text-text-muted">
              {t(
                "settings:onboarding.demo.descriptionShort",
                "Explore the extension with sample data - no setup required."
              )}
            </p>
          </div>
          <Button
            type="primary"
            onClick={handleDemoMode}
            className="shrink-0 rounded-full border-0 bg-primary px-4 font-medium text-white hover:bg-primaryStrong"
          >
            {t("settings:onboarding.demo.buttonTry", "Try Demo")}
          </Button>
        </div>
      </div>

      {/* Divider with "or connect to your server" */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-surface px-2 text-text-subtle">
            {t("settings:onboarding.orConnectServer", "or connect to your server")}
          </span>
        </div>
      </div>

      {/* Server URL */}
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-text">
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
              className="rounded-2xl"
              suffix={
                <span
                  className="inline-flex h-4 w-4 items-center justify-center"
                  aria-hidden={!serverUrl}
                  style={{ visibility: serverUrl ? "visible" : "hidden" }}
                >
                  {serverUrl && urlValidation.valid ? (
                    <Check
                      className="size-4 text-success"
                      aria-label={t("common:valid", "Valid")}
                    />
                  ) : serverUrl && !urlValidation.valid ? (
                    <X
                      className="size-4 text-danger"
                      aria-label={t("common:invalid", "Invalid")}
                    />
                  ) : null}
                </span>
              }
              aria-describedby={serverUrl && !urlValidation.valid ? "url-error" : undefined}
            />
          </div>
          {serverUrl && !urlValidation.valid && (
            <p id="url-error" role="alert" className="mt-1 text-xs text-danger">
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
            <p className="mt-1 text-xs text-success">
              {t("settings:onboarding.serverUrl.validUrl", "URL format is valid. Click Connect to test the connection.")}
            </p>
          )}
        </div>

        {/* Auth Mode Toggle */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text">
            {t("settings:onboarding.authMode.label", "Authentication")}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAuthMode("single-user")}
              disabled={isConnecting}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                authMode === "single-user"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/70 text-text-muted hover:bg-surface2"
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
                "flex-1 flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                authMode === "multi-user"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/70 text-text-muted hover:bg-surface2"
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
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-text">
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
              size="large"
              className="rounded-2xl"
              status={
                showAuthErrors && authValidation.missingApiKey ? "error" : undefined
              }
              aria-describedby={
                showAuthErrors && authValidation.missingApiKey
                  ? "api-key-error"
                  : undefined
              }
            />
            {showAuthErrors && authValidation.missingApiKey ? (
              <p
                id="api-key-error"
                role="alert"
                className="mt-1 text-xs text-danger"
              >
                {t(
                  "settings:onboarding.apiKeyRequired",
                  "Enter your API key to continue."
                )}
              </p>
            ) : (
              <p className="mt-1 text-xs text-text-subtle">
                {t(
                  "settings:onboarding.apiKeyHelp",
                  "Find your API key in tldw_server Settings"
                )}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-text">
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
                size="large"
                className="rounded-2xl"
                status={
                  showAuthErrors && authValidation.missingUsername ? "error" : undefined
                }
                aria-describedby={
                  showAuthErrors && authValidation.missingUsername
                    ? "username-error"
                    : undefined
                }
              />
              {showAuthErrors && authValidation.missingUsername && (
                <p
                  id="username-error"
                  role="alert"
                  className="mt-1 text-xs text-danger"
                >
                  {t(
                    "settings:onboarding.usernameRequired",
                    "Enter your username to continue."
                  )}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-text">
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
                size="large"
                className="rounded-2xl"
                status={
                  showAuthErrors && authValidation.missingPassword ? "error" : undefined
                }
                aria-describedby={
                  showAuthErrors && authValidation.missingPassword
                    ? "password-error"
                    : undefined
                }
              />
              {showAuthErrors && authValidation.missingPassword && (
                <p
                  id="password-error"
                  role="alert"
                  className="mt-1 text-xs text-danger"
                >
                  {t(
                    "settings:onboarding.passwordRequired",
                    "Enter your password to continue."
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Connection Progress */}
        {(progress.serverReachable !== "idle" || isConnecting) && (
          <div
            className="space-y-2 rounded-2xl border border-primary/20 bg-primary/5 p-4"
            role="status"
            aria-live="polite"
            aria-busy={isConnecting}
          >
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
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
          <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
              <div>
                <div className="text-sm font-medium text-danger">
                  {t("settings:onboarding.connectionFailed", "Connection failed")}
                </div>
                {errorHint && (
                  <p className="mt-1 text-xs text-danger">
                    {errorHint}
                  </p>
                )}
                {errorMessage && errorMessage !== errorHint && (
                  <p className="mt-1 font-mono text-xs text-danger">
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
          className="!h-12 rounded-full font-medium"
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
            className="!h-11 rounded-full"
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
          className="flex items-center gap-2 rounded-full px-2 py-1 text-sm text-text-subtle transition-colors hover:bg-surface2 hover:text-text"
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
          <div className="mt-3 space-y-3 text-xs">
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
                className="rounded-2xl border border-border/70 bg-surface p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium text-text">{cmd.label}</span>
                  <Tooltip title={t("common:copy", "Copy")}>
                    <button
                      onClick={() => handleCopyCommand(cmd.command)}
                      className="rounded-full p-1 hover:bg-surface2"
                    >
                      <Copy className="size-3 text-text-subtle" />
                    </button>
                  </Tooltip>
                </div>
                <pre className="overflow-x-auto rounded-xl bg-surface2 px-2 py-2 text-text">
                  <code>{cmd.command}</code>
                </pre>
              </div>
            ))}

            <button
              onClick={openDocs}
              className="inline-flex items-center gap-1 text-primary hover:text-primaryStrong"
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
          className="text-sm text-text-subtle hover:text-text"
        >
          {t("settings:onboarding.buttons.skip", "Skip for now")}
        </button>
      </div>
    </div>
  )
}

export default OnboardingConnectForm

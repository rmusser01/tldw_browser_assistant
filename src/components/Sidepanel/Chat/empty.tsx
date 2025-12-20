import React from "react"
import { useTranslation } from "react-i18next"
import { Button, Tooltip } from "antd"
import {
  useConnectionState,
  useConnectionUxState
} from "@/hooks/useConnectionState"
import { ConnectionPhase } from "@/types/connection"
import { cleanUrl } from "@/libs/clean-url"
import {
  MessageSquare,
  Settings,
  KeyRound,
  Wifi,
  WifiOff,
  Sparkles,
  FileText,
  Search,
  BookOpen
} from "lucide-react"

type EmptySidePanelProps = {
  inputRef?: React.RefObject<HTMLTextAreaElement>
}

export const EmptySidePanel = ({ inputRef }: EmptySidePanelProps) => {
  const { t } = useTranslation(["sidepanel", "settings", "option", "playground"])
  const { phase, isConnected, serverUrl } = useConnectionState()
  const { uxState, mode, configStep, hasCompletedFirstRun } =
    useConnectionUxState()
  const isConnectionReady =
    isConnected && phase === ConnectionPhase.CONNECTED
  const primaryButtonRef = React.useRef<HTMLButtonElement | null>(null)

  const openExtensionUrl = (path: string) => {
    try {
      // Prefer opening the extension's options.html directly so users land
      // on the tldw settings page instead of the generic extensions manager.
      // `browser` is provided by the WebExtension polyfill in WXT.
      // @ts-ignore
      if (typeof browser !== "undefined" && browser.runtime?.getURL) {
        // @ts-ignore
        const url = browser.runtime.getURL(path)
        // @ts-ignore
        if (browser.tabs?.create) {
          // @ts-ignore
          browser.tabs.create({ url })
        } else {
          window.open(url, "_blank")
        }
        return
      }
    } catch (err) {
      // Fall through to chrome.* / window.open below.
      console.debug("[EmptySidePanel] openExtensionUrl browser API unavailable:", err)
    }

    try {
      // @ts-ignore
      if (chrome?.runtime?.getURL) {
        // @ts-ignore
        const url = chrome.runtime.getURL(path)
        window.open(url, "_blank")
        return
      }
      // @ts-ignore
      if (chrome?.runtime?.openOptionsPage && path.includes("/options.html")) {
        // @ts-ignore
        chrome.runtime.openOptionsPage()
        return
      }
    } catch (err) {
      // ignore and fall back to plain window.open
      console.debug("[EmptySidePanel] openExtensionUrl chrome API unavailable:", err)
    }

    window.open(path, "_blank")
  }

  const showConnectionCard = !isConnectionReady
  const host = serverUrl ? cleanUrl(serverUrl) : "tldw_server"

  const activeStep = (() => {
    if (configStep === "url") return 1
    if (configStep === "auth") return 2
    if (configStep === "health") return 3
    if (uxState === "configuring_url" || uxState === "unconfigured") return 1
    if (uxState === "configuring_auth") return 2
    if (
      uxState === "testing" ||
      uxState === "connected_ok" ||
      uxState === "connected_degraded" ||
      uxState === "error_auth" ||
      uxState === "error_unreachable"
    ) {
      return 3
    }
    return 1
  })()

  const stepSummary = (() => {
    if (hasCompletedFirstRun) return null
    if (activeStep === 1) {
      return t(
        "sidepanel:firstRun.step1",
        "Step 1 of 3 — Add your server URL in Options → tldw Server."
      )
    }
    if (activeStep === 2) {
      return t(
        "sidepanel:firstRun.step2",
        "Step 2 of 3 — Add your API key or log in on the tldw Server settings page."
      )
    }
    return t(
      "sidepanel:firstRun.step3",
      "Step 3 of 3 — Check connection & Knowledge in Health & diagnostics."
    )
  })()

  const openOnboarding = () => {
    openExtensionUrl("/options.html#/")
  }

  const bannerHeading = (() => {
    if (uxState === "error_auth") {
      return t(
        "option:connectionCard.headlineErrorAuth",
        "API key needs attention"
      )
    }
    if (uxState === "error_unreachable") {
      return t(
        "option:connectionCard.headlineError",
        "Can’t reach your tldw server"
      )
    }
    // First-run emphasis: make it clear that setup must be finished
    // before chat is available from the sidepanel.
    return hasCompletedFirstRun
      ? t(
          "option:connectionCard.headlineMissing",
          "Connect tldw Assistant to your server to start chatting"
        )
      : t(
          "sidepanel:firstRun.headline",
          "Finish setup to start chatting"
        )
  })()

  const bannerBody = (() => {
    if (uxState === "error_auth") {
      return t(
        "option:connectionCard.descriptionErrorAuth",
        "Your server is up but the API key is wrong or missing. Fix the key in Settings → tldw server, then retry."
      )
    }
    if (uxState === "error_unreachable") {
      return t(
        "option:connectionCard.descriptionError",
        "We couldn’t reach {{host}}. Check that your tldw_server is running and that your browser can reach it, then open diagnostics or update the URL.",
        { host }
      )
    }
    if (!hasCompletedFirstRun) {
      return t(
        "sidepanel:firstRun.description",
        "Before you can chat here, finish the short setup flow in Options to connect tldw Assistant to your tldw server or choose demo mode."
      )
    }
    return t(
      "option:connectionCard.descriptionMissing",
      "tldw_server is your private AI workspace that keeps chats, notes, and media on your own machine. Add your server URL to get started."
    )
  })()

  const insertPrompt = (text: string) => {
    const input =
      inputRef?.current ??
      document.querySelector<HTMLTextAreaElement>('[data-testid="chat-input"]')
    if (input) {
      input.value = text
      input.focus()
      input.dispatchEvent(new Event("input", { bubbles: true }))
    }
  }

  React.useEffect(() => {
    if (!showConnectionCard) return
    if (!primaryButtonRef.current) return
    if (hasCompletedFirstRun) return
    try {
      primaryButtonRef.current.focus()
    } catch {
      // ignore focus failures
    }
  }, [showConnectionCard, hasCompletedFirstRun])

  if (showConnectionCard) {
    // Determine the icon based on error state
    const StatusIcon = uxState === "error_auth"
      ? KeyRound
      : uxState === "error_unreachable"
        ? WifiOff
        : Settings

    const iconColorClass = uxState === "error_auth" || uxState === "error_unreachable"
      ? "text-amber-600 dark:text-amber-400"
      : "text-blue-500 dark:text-blue-400"

    return (
      <div className="mt-4 flex w-full flex-col items-stretch gap-3 px-3">
        {/* Main card with icon */}
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#1a1a1a] overflow-hidden">
          {/* Header with icon */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className={`flex-shrink-0 p-2 rounded-full ${
              uxState === "error_auth" || uxState === "error_unreachable"
                ? "bg-amber-100 dark:bg-amber-900/30"
                : "bg-blue-100 dark:bg-blue-900/30"
            }`}>
              <StatusIcon className={`size-5 ${iconColorClass}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {bannerHeading}
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-3">
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {bannerBody}
            </p>

            {/* Action button */}
            <button
              type="button"
              onClick={openOnboarding}
              ref={primaryButtonRef}
              className={`w-full flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                uxState === "error_auth" || uxState === "error_unreachable"
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
            >
              <Settings className="size-3.5" />
              {!hasCompletedFirstRun
                ? t("sidepanel:firstRun.finishSetup", "Finish setup")
                : uxState === "error_auth" || uxState === "error_unreachable"
                  ? t("sidepanel:firstRun.reviewSettings", "Review settings")
                  : t("sidepanel:firstRun.openOptionsPrimary", "Open tldw Settings")}
            </button>
          </div>

          {/* Step indicator for first-run */}
          {stepSummary && (
            <div className="px-4 py-2 bg-gray-50 dark:bg-[#111] border-t border-gray-100 dark:border-gray-800">
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {stepSummary}
              </p>
            </div>
          )}
        </div>

        {/* Quick tips for first-time users */}
        {!hasCompletedFirstRun && (
          <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
            {t("sidepanel:firstRun.quickTip", "Need help? Check our docs or try demo mode.")}
          </div>
        )}
      </div>
    )
  }

  // Connected state: show welcoming empty chat guidance
  return (
    <div className="mt-4 w-full px-4 flex flex-col items-center justify-center">
      {/* Animated icon */}
      <div className="mb-3 relative">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center">
          <MessageSquare className="size-6 text-green-600 dark:text-green-400" />
        </div>
        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-[#1a1a1a]" />
      </div>

      {/* Status and heading */}
      <div className="mb-1 text-green-600 dark:text-green-400 text-xs font-medium flex items-center gap-1">
        <Wifi className="size-3" />
        {t("sidepanel:emptyChat.connected", "Connected")}
      </div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-4">
        {mode === "demo"
          ? t("sidepanel:emptyChat.demoHint", "Demo mode — try sending a message")
          : t("sidepanel:emptyChat.hint", "Start a conversation below")}
      </p>

      {/* Suggestion cards */}
      <div className="w-full space-y-2 text-left">
        <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 font-medium px-1">
          {t("sidepanel:emptyChat.suggestions", "Try asking")}
        </p>
        <button
          type="button"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors text-left group"
          onClick={() =>
            insertPrompt(
              t(
                "sidepanel:emptyChat.examplePrompt1Text",
                "Summarize this page"
              )
            )
          }
        >
          <FileText className="size-4 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 flex-shrink-0" />
          <span className="text-xs text-gray-600 dark:text-gray-300">
            {t("sidepanel:emptyChat.examplePrompt1", "\"Summarize this page\"")}
          </span>
        </button>
        <button
          type="button"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors text-left group"
          onClick={() =>
            insertPrompt(
              t(
                "sidepanel:emptyChat.examplePrompt2Text",
                "What are the key points?"
              )
            )
          }
        >
          <Search className="size-4 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 flex-shrink-0" />
          <span className="text-xs text-gray-600 dark:text-gray-300">
            {t("sidepanel:emptyChat.examplePrompt2", "\"What are the key points?\"")}
          </span>
        </button>
        <button
          type="button"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors text-left group"
          onClick={() =>
            insertPrompt(
              t(
                "sidepanel:emptyChat.examplePrompt3Text",
                "Explain this in simple terms"
              )
            )
          }
        >
          <BookOpen className="size-4 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 flex-shrink-0" />
          <span className="text-xs text-gray-600 dark:text-gray-300">
            {t("sidepanel:emptyChat.examplePrompt3", "\"Explain this in simple terms\"")}
          </span>
        </button>
      </div>

      {/* Demo mode indicator with limitations */}
      {mode === "demo" && (
        <div className="mt-4 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-1.5 text-xs font-medium text-purple-700 dark:text-purple-300">
            <Sparkles className="size-3.5" />
            {t("sidepanel:emptyChat.demoIndicator", "Running in demo mode")}
          </div>
          <p className="mt-1 text-[10px] text-purple-600 dark:text-purple-400">
            {t(
              "sidepanel:emptyChat.demoLimitations",
              "Some features are limited. Connect to tldw_server for full functionality."
            )}
          </p>
        </div>
      )}
    </div>
  )
}

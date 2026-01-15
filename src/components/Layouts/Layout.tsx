import React, { lazy, Suspense, useState } from "react"

import { Drawer, Tooltip } from "antd"
import { EraserIcon, XIcon } from "lucide-react"
import { IconButton } from "../Common/IconButton"
import { useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useQueryClient } from "@tanstack/react-query"

import { classNames } from "@/libs/class-name"
import { PageAssistDatabase } from "@/db/dexie/chat"
import { useMessageOption } from "@/hooks/useMessageOption"
import {
  useChatShortcuts,
  useSidebarShortcuts,
  useQuickChatShortcuts
} from "@/hooks/keyboard/useKeyboardShortcuts"
import { useQuickChatStore } from "@/store/quick-chat"
import { useLayoutUiStore } from "@/store/layout-ui"
import { useRouteTransitionStore } from "@/store/route-transition"
import { QuickChatHelperButton } from "@/components/Common/QuickChatHelper"
import { CurrentChatModelSettings } from "../Common/Settings/CurrentChatModelSettings"
import { Sidebar } from "../Option/Sidebar"
import { Header } from "./Header"
import { QuickIngestModalHost } from "@/components/Layouts/QuickIngestButton"
import { useMigration } from "../../hooks/useMigration"
import { useChatSidebar } from "@/hooks/useFeatureFlags"
import { ChatSidebar } from "@/components/Common/ChatSidebar"
import { EventOnlyHosts } from "@/components/Common/EventHosts"
import { PageAssistLoader } from "@/components/Common/PageAssistLoader"

// Lazy-load Timeline to reduce initial bundle size (~1.2MB cytoscape)
const TimelineModal = lazy(() =>
  import("@/components/Timeline").then((m) => ({ default: m.TimelineModal }))
)

// Lazy-load Command Palette and Keyboard Shortcuts modal to reduce bundle size
const CommandPalette = lazy(() =>
  import("@/components/Common/CommandPalette").then((m) => ({
    default: m.CommandPalette
  }))
)

const KeyboardShortcutsModal = lazy(() =>
  import("@/components/Common/KeyboardShortcutsModal").then((m) => ({
    default: m.KeyboardShortcutsModal
  }))
)
import { useConfirmDanger } from "@/components/Common/confirm-danger"
import { DemoModeProvider, useDemoMode } from "@/context/demo-mode"

type OptionLayoutProps = {
  children: React.ReactNode
  hideHeader?: boolean
}

const SHORTCUT_LOADING_MIN_MS = 0
const SHORTCUT_LOADING_MAX_MS = 2500

const OptionLayoutInner: React.FC<OptionLayoutProps> = ({
  children,
  hideHeader = false
}) => {
  const confirmDanger = useConfirmDanger()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const chatSidebarCollapsed = useLayoutUiStore(
    (state) => state.chatSidebarCollapsed
  )
  const setChatSidebarCollapsed = useLayoutUiStore(
    (state) => state.setChatSidebarCollapsed
  )
  const { t } = useTranslation(["option", "common", "settings"])
  const [openModelSettings, setOpenModelSettings] = useState(false)
  const { isLoading: migrationLoading } = useMigration()
  const { demoEnabled } = useDemoMode()
  const [showChatSidebar] = useChatSidebar()
  const location = useLocation()
  const { clearChat, useOCR, chatMode, setChatMode, webSearch, setWebSearch } =
    useMessageOption()
  const queryClient = useQueryClient()
  const {
    active: shortcutLoading,
    pendingPath: shortcutPendingPath,
    startedAt: shortcutStartedAt,
    stop: stopShortcutLoading
  } = useRouteTransitionStore((state) => ({
    active: state.active,
    pendingPath: state.pendingPath,
    startedAt: state.startedAt,
    stop: state.stop
  }))

  // Create toggle function for sidebar
  const toggleSidebar = () => {
    if (showChatSidebar && !hideHeader) {
      setChatSidebarCollapsed((prev) => !prev)
      return
    }
    setSidebarOpen((prev) => !prev)
  }

  const handleIngestPage = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tldw:open-quick-ingest"))
    }
  }

  const commandPaletteProps = {
    onNewChat: clearChat,
    onToggleRag: () => setChatMode(chatMode === "rag" ? "normal" : "rag"),
    onToggleWebSearch: () => setWebSearch(!webSearch),
    onIngestPage: handleIngestPage,
    onSwitchModel: () => setOpenModelSettings(true),
    onToggleSidebar: toggleSidebar
  }

  // Quick Chat Helper toggle
  const { isOpen: quickChatOpen, setIsOpen: setQuickChatOpen } = useQuickChatStore()
  const toggleQuickChat = () => {
    setQuickChatOpen(!quickChatOpen)
  }

  // Initialize shortcuts
  useChatShortcuts(clearChat, true)
  useSidebarShortcuts(toggleSidebar, true)
  useQuickChatShortcuts(toggleQuickChat, true)

  React.useEffect(() => {
    if (!shortcutLoading) return
    if (
      shortcutPendingPath &&
      shortcutPendingPath !== location.pathname
    ) {
      return
    }
    const elapsed = shortcutStartedAt ? Date.now() - shortcutStartedAt : 0
    const delay = Math.max(SHORTCUT_LOADING_MIN_MS - elapsed, 0)
    if (delay <= 0) {
      stopShortcutLoading()
      return
    }
    const timeoutId = window.setTimeout(() => {
      stopShortcutLoading()
    }, delay)
    return () => window.clearTimeout(timeoutId)
  }, [
    shortcutLoading,
    shortcutPendingPath,
    location.pathname,
    shortcutStartedAt,
    stopShortcutLoading
  ])

  React.useEffect(() => {
    if (!shortcutLoading) return
    const timeoutId = window.setTimeout(() => {
      stopShortcutLoading()
    }, SHORTCUT_LOADING_MAX_MS)
    return () => window.clearTimeout(timeoutId)
  }, [shortcutLoading, stopShortcutLoading])



  if (migrationLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-bg ">
        <div className="text-center space-y-2">
          <div className="text-base font-medium text-text ">
            Migrating your chat history…
          </div>
          <div className="text-xs text-text-muted ">
            This runs once after an update and will reload the extension when finished.
          </div>
        </div>
      </div>
    )
  }

  const renderShortcutOverlay = () => (
    <div className="pointer-events-none absolute inset-0 z-30 flex justify-center px-4 sm:px-6 lg:px-8">
      <div className="pointer-events-auto relative w-full max-w-6xl">
        <div className="absolute inset-0 rounded-2xl bg-bg/70 backdrop-blur-[1px]">
          <PageAssistLoader
            label="Loading..."
            fullScreen={false}
            autoFocus={false}
          />
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen w-full">
      {/* Persistent ChatSidebar when feature flag enabled */}
      {showChatSidebar && !hideHeader && (
        <ChatSidebar
          collapsed={chatSidebarCollapsed}
          onToggleCollapse={() => setChatSidebarCollapsed((prev) => !prev)}
          className="sticky top-0 shrink-0 border-r border-border border-border"
        />
      )}
      <main
        className={classNames(
          "relative flex-1 flex flex-col",
          hideHeader ? "bg-bg " : ""
        )}
        data-demo-mode={demoEnabled ? "on" : "off"}>
        {hideHeader ? (
          <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8 overflow-auto">
            {children}
            {shortcutLoading && renderShortcutOverlay()}
          </div>
        ) : (
          <div className="relative flex min-h-[135vh] flex-col pt-2 sm:pt-3">
            <div className="relative z-20 w-full">
              <Header
                onToggleSidebar={toggleSidebar}
                sidebarCollapsed={chatSidebarCollapsed}
              />
            </div>
            <div className="relative flex min-h-0 flex-1 flex-col">
              {children}
              {shortcutLoading && renderShortcutOverlay()}
            </div>
          </div>
        )}
        {/* Legacy Drawer sidebar - only shown when new ChatSidebar feature is disabled */}
        {!hideHeader && !showChatSidebar && (
          <Drawer
            title={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconButton
                    onClick={() => setSidebarOpen(false)}
                    ariaLabel={t('common:close', { defaultValue: 'Close' }) as string}
                    title={t('common:close', { defaultValue: 'Close' }) as string}
                    className="-ml-1 h-11 w-11 sm:h-7 sm:w-7 sm:min-w-0 sm:min-h-0">
                    <XIcon className="h-5 w-5 text-text-muted " />
                  </IconButton>
                  <span>{t("sidebarTitle")}</span>
                </div>

                <div className="flex items-center space-x-3">
                  <Tooltip
                    title={t(
                      "settings:generalSettings.systemData.deleteChatHistory.label",
                      { defaultValue: t("settings:generalSettings.system.deleteChatHistory.label") as string }
                    )}
                    placement="left">
                    <IconButton
                      ariaLabel={t(
                        "settings:generalSettings.systemData.deleteChatHistory.label",
                        { defaultValue: t("settings:generalSettings.system.deleteChatHistory.label") as string }
                      ) as string}
                      onClick={async () => {
                        const ok = await confirmDanger({
                          title: t("common:confirmTitle", {
                            defaultValue: "Please confirm"
                          }),
                          content: t(
                            "settings:generalSettings.systemData.deleteChatHistory.confirm",
                            {
                              defaultValue: t(
                                "settings:generalSettings.system.deleteChatHistory.confirm"
                              ) as string
                            }
                          ),
                          okText: t("common:delete", { defaultValue: "Delete" }),
                          cancelText: t("common:cancel", { defaultValue: "Cancel" })
                        })

                        if (!ok) return

                        const db = new PageAssistDatabase()
                        await db.deleteAllChatHistory()
                        await queryClient.invalidateQueries({
                          queryKey: ["fetchChatHistory"]
                        })
                        clearChat()
                      }}
                      className="text-text-muted hover:text-text h-11 w-11 sm:h-7 sm:w-7 sm:min-w-0 sm:min-h-0">
                      <EraserIcon className="size-5" />
                    </IconButton>
                  </Tooltip>
                </div>
              </div>
            }
            placement="left"
            closeIcon={null}
          onClose={() => setSidebarOpen(false)}
          open={sidebarOpen}>
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        </Drawer>
        )}

        {!hideHeader && (
          <CurrentChatModelSettings
            open={openModelSettings}
            setOpen={setOpenModelSettings}
            useDrawer
            isOCREnabled={useOCR}
          />
        )}

        {/* Quick Chat Helper floating button (legacy layout only) */}
        {!hideHeader && !showChatSidebar && <QuickChatHelperButton />}

        {/* Timeline Modal - lazy-loaded */}
        {!hideHeader && (
          <Suspense fallback={null}>
            <TimelineModal />
          </Suspense>
        )}

        {/* Command Palette - global keyboard shortcut ⌘K */}
        {!hideHeader && (
          <Suspense fallback={null}>
            <CommandPalette
              {...commandPaletteProps}
            />
          </Suspense>
        )}

        {/* Keyboard Shortcuts Help Modal - triggered by ? */}
        {!hideHeader && (
          <Suspense fallback={null}>
            <KeyboardShortcutsModal />
          </Suspense>
        )}

        {/* Quick Ingest Modal Host - listens for global open events */}
        <QuickIngestModalHost />

        {/* Ensure event-driven modals are available even when the header is hidden */}
        {hideHeader && <EventOnlyHosts commandPaletteProps={commandPaletteProps} />}
      </main>
    </div>
  )
}

export default function OptionLayout(props: OptionLayoutProps) {
  return (
    <DemoModeProvider>
      <OptionLayoutInner {...props} />
    </DemoModeProvider>
  )
}

import React from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { isMac } from "@/hooks/keyboard/useKeyboardShortcuts"
import { getTitleById, updateHistory } from "@/db"
import { useMessageOption } from "~/hooks/useMessageOption"
import { useTimelineStore } from "@/store/timeline"
import { useSetting } from "@/hooks/useSetting"
import { HEADER_SHORTCUTS_EXPANDED_SETTING } from "@/services/settings/ui-settings"
import { ChatHeader } from "./ChatHeader"
import { TtsClipsDrawer } from "@/components/Sidepanel/Chat/TtsClipsDrawer"

type Props = {
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
}

export const Header: React.FC<Props> = ({
  onToggleSidebar,
  sidebarCollapsed = false
}) => {
  const { t } = useTranslation([
    "option",
    "common",
    "settings",
    "playground"
  ])
  const cmdKey = isMac ? "⌘" : "Ctrl+"
  const [headerShortcutsExpanded, setHeaderShortcutsExpanded] = useSetting(
    HEADER_SHORTCUTS_EXPANDED_SETTING
  )
  const { clearChat, streaming, historyId, temporaryChat } = useMessageOption()
  const openTimeline = useTimelineStore((state) => state.openTimeline)
  const navigate = useNavigate()
  const [chatTitle, setChatTitle] = React.useState("")
  const [isEditingTitle, setIsEditingTitle] = React.useState(false)
  const [ttsClipsOpen, setTtsClipsOpen] = React.useState(false)

  const canOpenTimeline = Boolean(historyId) && !temporaryChat && historyId !== "temp"
  const showTimelineButton = canOpenTimeline && !streaming

  React.useEffect(() => {
    ;(async () => {
      try {
        if (historyId && historyId !== "temp" && !temporaryChat) {
          const title = await getTitleById(historyId)
          setChatTitle(title || "")
        } else {
          setChatTitle("")
        }
      } catch {}
    })()
  }, [historyId, temporaryChat])

  const saveTitle = async (value: string) => {
    try {
      if (historyId && historyId !== "temp" && !temporaryChat) {
        await updateHistory(historyId, value.trim() || "Untitled")
      }
    } catch (e) {
      console.error("Failed to update chat title", e)
    }
  }

  const handleOpenTimeline = React.useCallback(() => {
    if (!historyId || temporaryChat || historyId === "temp") return
    void openTimeline(historyId)
  }, [historyId, openTimeline, temporaryChat])

  const openCommandPalette = React.useCallback(() => {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent("tldw:open-command-palette"))
  }, [])

  const openShortcutsModal = React.useCallback(() => {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent("tldw:open-shortcuts-modal"))
  }, [])

  const toggleHeaderShortcuts = React.useCallback(() => {
    void setHeaderShortcutsExpanded(!headerShortcutsExpanded).catch(() => {
      // ignore storage write failures
    })
  }, [headerShortcutsExpanded, setHeaderShortcutsExpanded])

  const handleTitleEditStart = React.useCallback(() => {
    setIsEditingTitle(true)
  }, [])

  const handleTitleCommit = React.useCallback(
    async (value: string) => {
      setIsEditingTitle(false)
      await saveTitle(value)
    },
    [saveTitle]
  )

  return (
    <>
      <ChatHeader
        t={t}
        temporaryChat={temporaryChat}
        historyId={historyId}
        chatTitle={chatTitle}
        isEditingTitle={isEditingTitle}
        onTitleChange={setChatTitle}
        onTitleEditStart={handleTitleEditStart}
        onTitleCommit={handleTitleCommit}
        onToggleSidebar={onToggleSidebar}
        sidebarCollapsed={sidebarCollapsed}
        onOpenCommandPalette={openCommandPalette}
        onOpenShortcutsModal={openShortcutsModal}
        onOpenSettings={() => navigate("/settings/tldw")}
        onOpenTtsClips={() => setTtsClipsOpen(true)}
        onClearChat={clearChat}
        showTimelineButton={showTimelineButton}
        onOpenTimeline={handleOpenTimeline}
        shortcutsExpanded={headerShortcutsExpanded}
        onToggleShortcuts={toggleHeaderShortcuts}
        commandKeyLabel={cmdKey}
      />
      <TtsClipsDrawer
        open={ttsClipsOpen}
        onClose={() => setTtsClipsOpen(false)}
      />
    </>
  )
}

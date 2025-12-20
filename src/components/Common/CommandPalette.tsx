import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  Search,
  MessageSquare,
  Settings,
  BookText,
  StickyNote,
  Layers,
  UploadCloud,
  Globe,
  Eye,
  BrainCircuit,
  Activity,
  X,
  Command,
  ArrowRight,
} from "lucide-react"
import { useShortcut, formatShortcut } from "@/hooks/useKeyboardShortcuts"
import { searchSettings, type SettingDefinition } from "@/data/settings-index"
import { cn } from "@/libs/utils"

export interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  shortcut?: { key: string; modifiers: ("meta" | "ctrl" | "alt" | "shift")[] }
  action: () => void
  category: "navigation" | "action" | "setting" | "recent"
  keywords?: string[]
}

interface CommandPaletteProps {
  /** Custom commands to add to the palette */
  additionalCommands?: CommandItem[]
  /** Callbacks for actions */
  onNewChat?: () => void
  onToggleRag?: () => void
  onToggleWebSearch?: () => void
  onIngestPage?: () => void
  onSwitchModel?: () => void
  onToggleSidebar?: () => void
}

export function CommandPalette({
  additionalCommands = [],
  onNewChat,
  onToggleRag,
  onToggleWebSearch,
  onIngestPage,
  onSwitchModel,
  onToggleSidebar,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { t } = useTranslation(["common", "settings"])

  // Register ⌘K shortcut to open
  useShortcut({
    key: "k",
    modifiers: ["meta"],
    action: () => setOpen(true),
    description: "Open command palette",
    allowInInput: true,
  })

  // Also allow Escape to close
  useShortcut({
    key: "Escape",
    modifiers: [],
    action: () => setOpen(false),
    description: "Close command palette",
    allowInInput: true,
  })

  // Build default commands
  const defaultCommands: CommandItem[] = useMemo(() => [
    // Navigation
    {
      id: "nav-chat",
      label: t("common:commandPalette.goToChat", "Go to Chat"),
      icon: <MessageSquare className="size-4" />,
      action: () => { navigate("/"); setOpen(false) },
      category: "navigation",
      keywords: ["playground", "conversation"],
    },
    {
      id: "nav-media",
      label: t("common:commandPalette.goToMedia", "Go to Media"),
      icon: <BookText className="size-4" />,
      shortcut: { key: "m", modifiers: ["meta", "shift"] },
      action: () => { navigate("/media"); setOpen(false) },
      category: "navigation",
      keywords: ["documents", "files", "library"],
    },
    {
      id: "nav-notes",
      label: t("common:commandPalette.goToNotes", "Go to Notes"),
      icon: <StickyNote className="size-4" />,
      action: () => { navigate("/notes"); setOpen(false) },
      category: "navigation",
      keywords: ["notes", "notebook"],
    },
    {
      id: "nav-flashcards",
      label: t("common:commandPalette.goToFlashcards", "Go to Flashcards"),
      icon: <Layers className="size-4" />,
      action: () => { navigate("/flashcards"); setOpen(false) },
      category: "navigation",
      keywords: ["study", "cards", "learn"],
    },
    {
      id: "nav-settings",
      label: t("common:commandPalette.goToSettings", "Go to Settings"),
      icon: <Settings className="size-4" />,
      shortcut: { key: ",", modifiers: ["meta"] },
      action: () => { navigate("/settings"); setOpen(false) },
      category: "navigation",
      keywords: ["preferences", "config", "options"],
    },
    {
      id: "nav-health",
      label: t("common:commandPalette.goToHealth", "Health & Diagnostics"),
      icon: <Activity className="size-4" />,
      action: () => { navigate("/settings/health"); setOpen(false) },
      category: "navigation",
      keywords: ["status", "connection", "diagnostic"],
    },

    // Actions
    {
      id: "action-new-chat",
      label: t("common:commandPalette.newChat", "New Chat"),
      icon: <MessageSquare className="size-4" />,
      shortcut: { key: "u", modifiers: ["ctrl", "shift"] },
      action: () => { onNewChat?.(); setOpen(false) },
      category: "action",
      keywords: ["create", "start", "conversation"],
    },
    {
      id: "action-toggle-rag",
      label: t("common:commandPalette.toggleKnowledgeSearch", "Toggle Knowledge Search"),
      description: t("common:commandPalette.toggleKnowledgeSearchDesc", "Search your knowledge base"),
      icon: <Search className="size-4" />,
      shortcut: { key: "r", modifiers: ["alt"] },
      action: () => { onToggleRag?.(); setOpen(false) },
      category: "action",
      keywords: ["search", "knowledge", "retrieve", "rag"],
    },
    {
      id: "action-toggle-web",
      label: t("common:commandPalette.toggleWebSearch", "Toggle Web Search"),
      description: t("common:commandPalette.toggleWebDesc", "Search the internet"),
      icon: <Globe className="size-4" />,
      shortcut: { key: "w", modifiers: ["alt"] },
      action: () => { onToggleWebSearch?.(); setOpen(false) },
      category: "action",
      keywords: ["internet", "online", "browse"],
    },
    {
      id: "action-ingest",
      label: t("common:commandPalette.ingestPage", "Ingest Current Page"),
      description: t("common:commandPalette.ingestDesc", "Save this page to your knowledge base"),
      icon: <UploadCloud className="size-4" />,
      shortcut: { key: "i", modifiers: ["meta"] },
      action: () => { onIngestPage?.(); setOpen(false) },
      category: "action",
      keywords: ["save", "import", "add", "upload"],
    },
    {
      id: "action-switch-model",
      label: t("common:commandPalette.switchModel", "Switch Model"),
      icon: <BrainCircuit className="size-4" />,
      shortcut: { key: "e", modifiers: ["meta"] },
      action: () => { onSwitchModel?.(); setOpen(false) },
      category: "action",
      keywords: ["model", "ai", "llm", "change"],
    },
    {
      id: "action-toggle-sidebar",
      label: t("common:commandPalette.toggleSidebar", "Toggle Sidebar"),
      description: t(
        "common:commandPalette.toggleSidebarDesc",
        "Show or hide the chat sidebar"
      ),
      icon: <Eye className="size-4" />,
      shortcut: { key: "b", modifiers: ["ctrl", "shift"] },
      action: () => {
        onToggleSidebar?.()
        setOpen(false)
      },
      category: "action",
      keywords: ["sidebar", "layout", "panel"],
    },
  ], [t, navigate, onNewChat, onToggleRag, onToggleWebSearch, onIngestPage, onSwitchModel, onToggleSidebar])

  // Convert settings to commands
  const settingCommands: CommandItem[] = useMemo(() => {
    if (!query) return []
    // Create a translation wrapper that matches searchSettings expected signature
    const translateFn = (key: string, defaultValue?: string): string => {
      return t(key, defaultValue ?? key) as string
    }
    const results = searchSettings(query, translateFn)
    return results.slice(0, 5).map((setting) => ({
      id: `setting-${setting.id}`,
      label: t(setting.labelKey, setting.defaultLabel),
      description: setting.descriptionKey
        ? t(setting.descriptionKey, setting.defaultDescription)
        : setting.defaultDescription,
      icon: <Settings className="size-4" />,
      action: () => { navigate(setting.route); setOpen(false) },
      category: "setting" as const,
      keywords: setting.keywords,
    }))
  }, [query, t, navigate])

  // Combine all commands
  const allCommands = useMemo(() => {
    return [...defaultCommands, ...additionalCommands, ...settingCommands]
  }, [defaultCommands, additionalCommands, settingCommands])

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query) {
      // Show all non-setting commands when no query
      return allCommands.filter(c => c.category !== "setting")
    }

    const q = query.toLowerCase()
    return allCommands.filter((cmd) => {
      const labelMatch = cmd.label.toLowerCase().includes(q)
      const descMatch = cmd.description?.toLowerCase().includes(q)
      const keywordMatch = cmd.keywords?.some((kw) => kw.toLowerCase().includes(q))
      return labelMatch || descMatch || keywordMatch
    })
  }, [allCommands, query])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    // "recent" is reserved for future MRU/history commands and may be populated
    // by additionalCommands when that feature is implemented.
    const groups: Record<string, CommandItem[]> = {
      action: [],
      navigation: [],
      setting: [],
      recent: [],
    }
    for (const cmd of filteredCommands) {
      groups[cmd.category]?.push(cmd)
    }
    return groups
  }, [filteredCommands])

  // Reset selection when filtered results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("")
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.querySelector('[data-selected="true"]')
    selected?.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      const palette = listRef.current?.parentElement
      if (!palette) return

      const focusableSelectors =
        'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
      const focusableElements = Array.from(
        palette.querySelectorAll<HTMLElement>(focusableSelectors)
      ).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          el.getAttribute("aria-hidden") !== "true"
      )

      if (focusableElements.length === 0) {
        return
      }

      const currentIndex = focusableElements.indexOf(
        document.activeElement as HTMLElement
      )
      let nextIndex = currentIndex

      if (e.shiftKey) {
        nextIndex =
          currentIndex <= 0
            ? focusableElements.length - 1
            : currentIndex - 1
      } else {
        nextIndex =
          currentIndex === -1 || currentIndex === focusableElements.length - 1
            ? 0
            : currentIndex + 1
      }

      e.preventDefault()
      focusableElements[nextIndex]?.focus()
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1))
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        break
      case "Enter":
        e.preventDefault()
        filteredCommands[selectedIndex]?.action()
        break
      // Escape is handled by useShortcut hook to avoid duplicate handlers
    }
  }, [filteredCommands, selectedIndex])

  // Execute command
  const executeCommand = useCallback((cmd: CommandItem) => {
    cmd.action()
  }, [])

  if (!open) return null
  if (typeof document === "undefined") return null

  const categories = ["recent", "action", "navigation", "setting"] as const

  const categoryLabels: Record<string, string> = {
    action: t("common:commandPalette.categoryActions", "Actions"),
    navigation: t("common:commandPalette.categoryNavigation", "Navigation"),
    setting: t("common:commandPalette.categorySettings", "Settings"),
    recent: t("common:commandPalette.categoryRecent", "Recent"),
  }

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div
        className="fixed left-1/2 top-[15%] sm:top-[20%] z-50 w-[calc(100%-2rem)] sm:w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        role="dialog"
        aria-modal="true"
        aria-label={t("common:commandPalette.title", "Command Palette")}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <Search className="size-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("common:commandPalette.placeholder", "Type a command or search...")}
            className="flex-1 bg-transparent text-base outline-none placeholder:text-gray-400 dark:text-white"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <kbd className="hidden items-center gap-1 rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:border-gray-600 dark:bg-gray-800 sm:flex">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto p-2"
          role="listbox"
        >
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              {t("common:commandPalette.noResults", "No results found")}
            </div>
          ) : (
            <>
              {categories.map((category) => {
                const items = groupedCommands[category]
                if (!items?.length) return null

                const categoryStartIndex = categories
                  .slice(0, categories.indexOf(category))
                  .reduce((sum, cat) => sum + (groupedCommands[cat]?.length ?? 0), 0)

                return (
                  <div key={category} className="mb-2">
                    <div className="px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {categoryLabels[category]}
                    </div>
                    {items.map((cmd, idx) => {
                      const currentIndex = categoryStartIndex + idx
                      const isSelected = currentIndex === selectedIndex

                      return (
                        <button
                          key={cmd.id}
                          onClick={() => executeCommand(cmd)}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                          data-selected={isSelected}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                            isSelected
                              ? "bg-pink-50 text-pink-900 dark:bg-pink-900/20 dark:text-pink-100"
                              : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                          )}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <span className={`${isSelected ? "text-pink-600 dark:text-pink-400" : "text-gray-400"}`}>
                            {cmd.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{cmd.label}</div>
                            {cmd.description && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {cmd.description}
                              </div>
                            )}
                          </div>
                          {cmd.shortcut && (
                            <kbd className="ml-2 flex items-center gap-0.5 rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:border-gray-600 dark:bg-gray-800">
                              {formatShortcut(cmd.shortcut)}
                            </kbd>
                          )}
                          {isSelected && (
                            <ArrowRight className="size-4 text-pink-500" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-gray-200 bg-gray-100 px-1 dark:border-gray-600 dark:bg-gray-800">
                ↑
              </kbd>
              <kbd className="rounded border border-gray-200 bg-gray-100 px-1 dark:border-gray-600 dark:bg-gray-800">
                ↓
              </kbd>
              <span className="ml-1">{t("common:commandPalette.navigate", "navigate")}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-gray-200 bg-gray-100 px-1 dark:border-gray-600 dark:bg-gray-800">
                ↵
              </kbd>
              <span className="ml-1">{t("common:commandPalette.select", "select")}</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Command className="size-3" />
            <span>K</span>
            <span className="ml-1">{t("common:commandPalette.toOpen", "to open")}</span>
          </span>
        </div>
      </div>
    </>
  )

  return createPortal(modalContent, document.body)
}

export default CommandPalette

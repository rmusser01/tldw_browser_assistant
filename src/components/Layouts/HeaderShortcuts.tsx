import React, { useEffect, useRef, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { NavLink, useLocation } from "react-router-dom"
import { useShortcut } from "@/hooks/useKeyboardShortcuts"
import { useSetting } from "@/hooks/useSetting"
import { HEADER_SHORTCUTS_EXPANDED_SETTING } from "@/services/settings/ui-settings"
import {
  CogIcon,
  Mic,
  Volume2,
  UserCircle2,
  Microscope,
  BookText,
  LayoutGrid,
  StickyNote,
  Layers,
  NotebookPen,
  BookMarked,
  BookOpen,
  ClipboardList,
  ChevronDown,
  Scissors,
  Gauge,
  Signpost,
  FileText,
  Rss,
  Kanban,
  Table2,
  Library,
  CombineIcon,
  Headphones,
  SquarePen,
  ShieldCheck,
} from "lucide-react"

const classNames = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ")

type NavigationItem =
  | {
      type: "link"
      to: string
      icon: React.ComponentType<{ className?: string }>
      label: string
    }
  | {
      type: "component"
      key: string
      node: React.ReactNode
    }

interface HeaderShortcutsProps {
  /** Whether to initially show shortcuts expanded */
  defaultExpanded?: boolean
  /** Additional CSS classes */
  className?: string
  /** Whether to render the toggle button */
  showToggle?: boolean
}

/**
 * Collapsible shortcuts section for the header.
 * Contains navigation groups for quick access to different features.
 * Extracted from Header.tsx for better maintainability.
 */
export function HeaderShortcuts({
  defaultExpanded = false,
  className,
  showToggle = true,
}: HeaderShortcutsProps) {
  const { t } = useTranslation(["option", "common", "settings"])

  const [shortcutsPreference, setShortcutsPreference] = useSetting(
    HEADER_SHORTCUTS_EXPANDED_SETTING
  )

  type DebouncedShortcutsSetter = ((value: boolean) => void) & {
    cancel: () => void
  }

  const debouncedSetShortcutsPreference =
    React.useMemo<DebouncedShortcutsSetter>(() => {
      let timeoutId: number | undefined

      const fn = ((value: boolean) => {
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId)
        }
        timeoutId = window.setTimeout(() => {
          timeoutId = undefined
          void setShortcutsPreference(value).catch(() => {
            // ignore storage write failures
          })
        }, 500)
      }) as DebouncedShortcutsSetter

      fn.cancel = () => {
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId)
          timeoutId = undefined
        }
      }

      return fn
    }, [setShortcutsPreference])

  const [shortcutsExpanded, setShortcutsExpanded] = useState(() =>
    Boolean(shortcutsPreference ?? defaultExpanded)
  )
  const location = useLocation()
  const shortcutsToggleRef = useRef<HTMLButtonElement>(null)
  const shortcutsContainerRef = useRef<HTMLDivElement>(null)
  const shortcutsSectionId = "header-shortcuts-section"
  const previousPathRef = useRef(location.pathname)

  // Navigation groups
  const navigationGroups = React.useMemo(
    (): Array<{ title: string; items: NavigationItem[] }> => [
      {
        title: t("option:header.groupChatting", "Chatting"),
        items: [
          {
            type: "link" as const,
            to: "/",
            icon: Layers,
            label: t("option:header.modePlayground", "Chat"),
          },
          {
            type: "link" as const,
            to: "/prompts",
            icon: NotebookPen,
            label: t("option:header.modePromptsPlayground", "Prompts"),
          },
          {
            type: "link" as const,
            to: "/characters",
            icon: UserCircle2,
            label: t("option:header.modeCharacters", "Characters"),
          },
          {
            type: "link" as const,
            to: "/dictionaries",
            icon: BookMarked,
            label: t("option:header.modeDictionaries", "Chat dictionaries"),
          },
          {
            type: "link" as const,
            to: "/world-books",
            icon: BookOpen,
            label: t("option:header.modeWorldBooks", "World Books"),
          },
        ],
      },
      {
        title: t("option:header.groupKnowledge", "Knowledge"),
        items: [
          {
            type: "link" as const,
            to: "/knowledge",
            icon: CombineIcon,
            label: t("option:header.modeKnowledge", "Knowledge QA"),
          },
          {
            type: "link" as const,
            to: "/media",
            icon: BookText,
            label: t("option:header.media", "Media"),
          },
          {
            type: "link" as const,
            to: "/media-multi",
            icon: LayoutGrid,
            label: t("option:header.libraryView", "Multi-Item Review"),
          },
          {
            type: "link" as const,
            to: "/flashcards",
            icon: Layers,
            label: t("option:header.flashcards", "Flashcards"),
          },
          {
            type: "link" as const,
            to: "/notes",
            icon: StickyNote,
            label: t("option:header.notes", "Notes"),
          },
          {
            type: "link" as const,
            to: "/watchlists",
            icon: Rss,
            label: t("option:header.modeWatchlists", "Watchlists"),
          },
          {
            type: "link" as const,
            to: "/collections",
            icon: Library,
            label: t("option:header.modeCollections", "Collections"),
          },
        ],
      },
      {
        title: t("option:header.groupWorkspace", "Workspace"),
        items: [
          {
            type: "link" as const,
            to: "/writing-playground",
            icon: SquarePen,
            label: t(
              "option:header.writingPlayground",
              "Writing Playground"
            ),
          },
          {
            type: "link" as const,
            to: "/quiz",
            icon: ClipboardList,
            label: t("option:header.quiz", "Quizzes"),
          },
          {
            type: "link" as const,
            to: "/evaluations",
            icon: Microscope,
            label: t("option:header.evaluations", "Evaluations"),
          },
          {
            type: "link" as const,
            to: "/stt",
            icon: Mic,
            label: t("option:header.modeStt", "STT Playground"),
          },
          {
            type: "link" as const,
            to: "/tts",
            icon: Volume2,
            label: t("option:tts.playground", "TTS Playground"),
          },
          {
            type: "link" as const,
            to: "/chunking-playground",
            icon: Scissors,
            label: t("settings:chunkingPlayground.nav", "Chunking Playground"),
          },
          {
            type: "link" as const,
            to: "/kanban",
            icon: Kanban,
            label: t("option:header.modeKanban", "Kanban Playground"),
          },
          {
            type: "link" as const,
            to: "/data-tables",
            icon: Table2,
            label: t("option:header.dataTables", "Data Tables"),
          },
          {
            type: "link" as const,
            to: "/prompt-studio",
            icon: NotebookPen,
            label: t("option:header.modePromptStudio", "Prompt Studio"),
          },
          {
            type: "link" as const,
            to: "/audiobook-studio",
            icon: Headphones,
            label: t("option:header.audiobookStudio", "Audiobook Studio"),
          },
        ],
      },
      {
        title: t("option:header.groupAdministration", "Administration"),
        items: [
          {
            type: "link" as const,
            to: "/admin/server",
            icon: CogIcon,
            label: t("option:header.adminServer", "Server Admin"),
          },
          {
            type: "link" as const,
            to: "/documentation",
            icon: FileText,
            label: t("option:header.modeDocumentation", "Documentation"),
          },
          {
            type: "link" as const,
            to: "/chatbooks",
            icon: BookOpen,
            label: t("option:header.chatbooksPlayground", "Chatbooks Playground"),
          },
          {
            type: "link" as const,
            to: "/moderation-playground",
            icon: ShieldCheck,
            label: t("option:moderationPlayground.nav", "Moderation Playground"),
          },
          {
            type: "link" as const,
            to: "/admin/llamacpp",
            icon: Microscope,
            label: t("option:header.adminLlamacpp", "Llama.cpp Admin"),
          },
          {
            type: "link" as const,
            to: "/admin/mlx",
            icon: Gauge,
            label: t("option:header.adminMlx", "MLX LM Admin"),
          },
        ],
      },
      {
        title: t("option:header.groupSettings", "Settings shortcuts"),
        items: [
          {
            type: "link" as const,
            to: "/settings",
            icon: CogIcon,
            label: t("settings"),
          },
        ],
      },
    ],
    [t]
  )

  // Sync with storage preference
  useEffect(() => {
    setShortcutsExpanded(Boolean(shortcutsPreference))
  }, [shortcutsPreference])

  // Cleanup debounced setter
  useEffect(() => {
    return () => {
      debouncedSetShortcutsPreference.cancel()
    }
  }, [debouncedSetShortcutsPreference])

  // Manage focus for accessibility when expanding/collapsing
  useEffect(() => {
    if (shortcutsExpanded) {
      requestAnimationFrame(() => {
        const container = shortcutsContainerRef.current
        if (!container) return
        const firstFocusable = container.querySelector<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"])'
        )
        firstFocusable?.focus()
      })
    } else {
      const container = shortcutsContainerRef.current
      const active = document.activeElement
      if (container && active && container.contains(active)) {
        shortcutsToggleRef.current?.focus()
      }
    }
  }, [shortcutsExpanded])

  const handleToggle = useCallback(() => {
    const next = !shortcutsExpanded
    setShortcutsExpanded(next)
    debouncedSetShortcutsPreference(next)
  }, [shortcutsExpanded, debouncedSetShortcutsPreference])

  const handleShortcutNavigate = useCallback(() => {
    if (!shortcutsExpanded) return
    setShortcutsExpanded(false)
    debouncedSetShortcutsPreference(false)
  }, [shortcutsExpanded, debouncedSetShortcutsPreference])

  // Register "?" keyboard shortcut to toggle shortcuts
  useShortcut({
    key: "?",
    modifiers: ["shift"],
    action: handleToggle,
    description: "Toggle keyboard shortcuts",
    allowInInput: false,
  })

  useEffect(() => {
    if (previousPathRef.current !== location.pathname) {
      previousPathRef.current = location.pathname
      if (shortcutsExpanded) {
        setShortcutsExpanded(false)
        debouncedSetShortcutsPreference(false)
      }
    }
  }, [location.pathname, shortcutsExpanded, debouncedSetShortcutsPreference])

  if (!showToggle && !shortcutsExpanded) {
    return null
  }

  return (
    <div className={`flex flex-col gap-2 ${className || ""}`}>
      {showToggle && (
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={shortcutsExpanded}
          aria-controls={shortcutsSectionId}
          ref={shortcutsToggleRef}
          title={t(
            "option:header.shortcutsKeyHint",
            "Press ? to toggle shortcuts"
          )}
          className="inline-flex items-center self-start rounded-md border border-transparent px-2 py-1 text-xs font-semibold uppercase tracking-wide text-text-muted transition hover:border-border hover:bg-surface"
        >
          <ChevronDown
            className={classNames(
              "mr-1 h-4 w-4 transition-transform",
              shortcutsExpanded ? "rotate-180" : ""
            )}
          />
          <Signpost className="mr-1 h-4 w-4" aria-hidden="true" />
          {shortcutsExpanded
            ? t("option:header.hideShortcuts", "Hide shortcuts")
            : t("option:header.showShortcuts", "Show shortcuts")}
          {!shortcutsExpanded && (
            <span className="ml-1.5 text-[10px] font-normal normal-case tracking-normal text-text-subtle">
              {t("option:header.shortcutsKeyHintInline", "(Press ?)")}
            </span>
          )}
        </button>
      )}

      {shortcutsExpanded && (
        <div
          id={shortcutsSectionId}
          ref={shortcutsContainerRef}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault()
              setShortcutsExpanded(false)
              debouncedSetShortcutsPreference(false)
              requestAnimationFrame(() => {
                shortcutsToggleRef.current?.focus()
              })
            }
          }}
          className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
          role="region"
          aria-label={t("option:header.showShortcuts", "Shortcuts")}
        >
          <div className="flex flex-col gap-4 lg:flex-1">
            {navigationGroups.map((group, index) => {
              const groupId = `header-shortcuts-group-${index}`
              return (
                <section
                  key={group.title}
                  className="flex flex-col gap-2"
                  aria-labelledby={groupId}
                >
                  <h3
                    id={groupId}
                    className="text-xs font-semibold uppercase tracking-wide text-text-subtle"
                  >
                    {group.title}
                  </h3>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {group.items.map((item) => {
                      if (item.type === "component") {
                        return (
                          <div key={item.key} className="w-full sm:w-auto">
                            {item.node}
                          </div>
                        )
                      }
                      const Icon = item.icon
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={handleShortcutNavigate}
                          className={({ isActive }) =>
                            classNames(
                              "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:w-auto",
                              isActive
                                ? "border-border bg-surface text-text"
                                : "border-transparent text-text-muted hover:border-border hover:bg-surface"
                            )
                          }
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </NavLink>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default HeaderShortcuts

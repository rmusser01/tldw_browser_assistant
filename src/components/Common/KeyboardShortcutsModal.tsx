import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { X, Keyboard, Command } from "lucide-react"
import { defaultShortcuts, formatShortcut } from "@/hooks/keyboard/useShortcutConfig"
import { isMac } from "@/hooks/keyboard/useKeyboardShortcuts"

interface ShortcutGroup {
  title: string
  shortcuts: {
    label: string
    keys: string
  }[]
}

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const modalRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null)
  const { t } = useTranslation(["common", "playground"])

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    if (open) {
      previouslyFocusedElementRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null

      if (closeButtonRef.current) {
        closeButtonRef.current.focus()
      }
      return
    }

    if (!open && previouslyFocusedElementRef.current) {
      const element = previouslyFocusedElementRef.current
      previouslyFocusedElementRef.current = null

      if (document.contains(element)) {
        element.focus()
      }
    }
  }, [open])

  // Listen for ? key to open the modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable

      if (e.key === "?" && !isInputField) {
        e.preventDefault()
        setOpen(true)
      }

      if (e.key === "Escape" && openRef.current) {
        setOpen(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const modKey = isMac ? "⌘" : "Ctrl"

  const shortcutGroups: ShortcutGroup[] = useMemo(
    () => [
      {
        title: t("common:shortcuts.groups.general", "General"),
        shortcuts: [
          {
            label: t("common:shortcuts.openCommandPalette", "Open command palette"),
            keys: `${modKey} + K`
          },
          {
            label: t("common:shortcuts.showKeyboardShortcuts", "Show keyboard shortcuts"),
            keys: "?"
          },
          {
            label: t("common:shortcuts.focusTextarea", "Focus message input"),
            keys: formatShortcut(defaultShortcuts.focusTextarea)
          }
        ]
      },
      {
        title: t("common:shortcuts.groups.chat", "Chat"),
        shortcuts: [
          {
            label: t("common:shortcuts.newChat", "Start new chat"),
            keys: formatShortcut(defaultShortcuts.newChat)
          },
          {
            label: t("common:shortcuts.toggleChatMode", "Toggle chat with current page"),
            keys: formatShortcut(defaultShortcuts.toggleChatMode)
          },
          {
            label: t("common:shortcuts.toggleWebSearch", "Toggle web search"),
            keys: formatShortcut(defaultShortcuts.toggleWebSearch)
          },
          {
            label: t("common:shortcuts.toggleQuickChat", "Toggle Quick Chat Helper"),
            keys: formatShortcut(defaultShortcuts.toggleQuickChatHelper)
          }
        ]
      },
      {
        title: t("common:shortcuts.groups.navigation", "Navigation"),
        shortcuts: [
          {
            label: t("common:shortcuts.toggleSidebar", "Toggle sidebar"),
            keys: formatShortcut(defaultShortcuts.toggleSidebar)
          },
          {
            label: t("common:shortcuts.goToPlayground", "Go to Playground"),
            keys: formatShortcut(defaultShortcuts.modePlayground)
          },
          {
            label: t("common:shortcuts.goToMedia", "Go to Media"),
            keys: formatShortcut(defaultShortcuts.modeMedia)
          },
          {
            label: t("common:shortcuts.goToKnowledge", "Go to Knowledge"),
            keys: formatShortcut(defaultShortcuts.modeKnowledge)
          },
          {
            label: t("common:shortcuts.goToNotes", "Go to Notes"),
            keys: formatShortcut(defaultShortcuts.modeNotes)
          },
          {
            label: t("common:shortcuts.goToPrompts", "Go to Prompts"),
            keys: formatShortcut(defaultShortcuts.modePrompts)
          },
          {
            label: t("common:shortcuts.goToFlashcards", "Go to Flashcards"),
            keys: formatShortcut(defaultShortcuts.modeFlashcards)
          }
        ]
      }
    ],
    [modKey, t]
  )

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [])

  const handleKeyDownInModal = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !modalRef.current) {
      return
    }

    const focusableSelectors =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    const focusableElements = Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter(
      (element) =>
        !element.hasAttribute("disabled") &&
        element.getAttribute("aria-hidden") !== "true" &&
        element.tabIndex !== -1
    )

    if (focusableElements.length === 0) {
      event.preventDefault()
      return
    }

    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement)
    let nextIndex = currentIndex

    if (event.shiftKey) {
      nextIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1
    } else {
      nextIndex = currentIndex === -1 || currentIndex === focusableElements.length - 1 ? 0 : currentIndex + 1
    }

    focusableElements[nextIndex].focus()
    event.preventDefault()
  }, [])

  if (!open) return null
  if (typeof document === "undefined") return null

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="fixed left-1/2 top-[10%] sm:top-[15%] z-50 w-[calc(100%-2rem)] sm:w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 max-h-[80vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        onKeyDown={handleKeyDownInModal}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Keyboard className="size-5 text-gray-500 dark:text-gray-400" />
            <h2
              id="shortcuts-modal-title"
              className="text-base font-semibold text-gray-900 dark:text-gray-100"
            >
              {t("common:shortcuts.title", "Keyboard Shortcuts")}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className="rounded-lg p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500"
            aria-label={t("common:close", "Close")}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {shortcutGroups.map((group, groupIndex) => (
            <div key={group.title} className={groupIndex > 0 ? "mt-5" : ""}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.label}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {shortcut.label}
                    </span>
                    <kbd className="ml-4 flex items-center gap-1 rounded border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2.5 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("common:shortcuts.customizeHint", "Shortcuts can be customized in Settings")}
          </p>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Command className="size-3" />
            <span>K</span>
            <span className="ml-1">{t("common:shortcuts.forCommands", "for commands")}</span>
          </div>
        </div>
      </div>
    </>
  )

  return createPortal(modalContent, document.body)
}

export default KeyboardShortcutsModal

import React from "react"
import { useTranslation } from "react-i18next"
import { Dropdown } from "antd"
import { useQuery } from "@tanstack/react-query"
import { useServerOnline } from "@/hooks/useServerOnline"
import { hasPromptStudio } from "@/services/prompt-studio"
import {
  useShortcutConfig,
  formatShortcut,
} from "@/hooks/keyboard/useShortcutConfig"
import type { KeyboardShortcut } from "@/hooks/keyboard/useKeyboardShortcuts"

const classNames = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(" ")

export type CoreMode =
  | "playground"
  | "media"
  | "mediaMulti"
  | "knowledge"
  | "notes"
  | "prompts"
  | "speech"
  | "promptStudio"
  | "flashcards"
  | "chunkingPlayground"
  | "worldBooks"
  | "dictionaries"
  | "characters"

interface ModeSelectorProps {
  currentMode: CoreMode
  onModeChange: (mode: CoreMode) => void
}

/**
 * Mode selector tabs for switching between app modes.
 * Extracted from Header.tsx for better maintainability.
 */
export function ModeSelector({ currentMode, onModeChange }: ModeSelectorProps) {
  const { t } = useTranslation(["option", "common", "settings"])
  const isOnline = useServerOnline()
  const { shortcuts: shortcutConfig } = useShortcutConfig()

  const promptStudioCapability = useQuery({
    queryKey: ["prompt-studio", "capability-mode-selector"],
    queryFn: hasPromptStudio,
    enabled: isOnline,
    staleTime: 60_000,
  })

  const primaryModes: Array<{
    key: CoreMode
    label: string
    shortcut?: KeyboardShortcut
  }> = [
    {
      key: "playground",
      label: t("option:header.modePlayground", "Chat"),
      shortcut: shortcutConfig.modePlayground,
    },
    {
      key: "media",
      label: t("option:header.modeMedia", "Media"),
      shortcut: shortcutConfig.modeMedia,
    },
    {
      key: "mediaMulti",
      label: t("option:header.libraryView", "Multi-Item Review"),
      shortcut: undefined,
    },
    {
      key: "knowledge",
      label: t("option:header.modeKnowledge", "Knowledge QA"),
      shortcut: shortcutConfig.modeKnowledge,
    },
    {
      key: "notes",
      label: t("option:header.modeNotes", "Notes"),
      shortcut: shortcutConfig.modeNotes,
    },
    {
      key: "flashcards",
      label: t("option:header.modeFlashcards", "Flashcards"),
      shortcut: shortcutConfig.modeFlashcards,
    },
    {
      key: "prompts",
      label: t("option:header.modePromptsPlayground", "Prompts"),
      shortcut: shortcutConfig.modePrompts,
    },
    {
      key: "chunkingPlayground",
      label: t("settings:chunkingPlayground.nav", "Chunking Playground"),
      shortcut: undefined,
    },
  ]

  const secondaryModes: Array<{
    key: CoreMode
    label: string
    shortcut?: KeyboardShortcut
  }> = [
    {
      key: "speech",
      label: t("option:header.modeSpeech", "Speech"),
      shortcut: undefined,
    },
    {
      key: "promptStudio",
      label: t("option:header.modePromptStudio", "Prompt Studio"),
      shortcut: undefined,
    },
    {
      key: "worldBooks",
      label: t("option:header.modeWorldBooks", "World Books"),
      shortcut: shortcutConfig.modeWorldBooks,
    },
    {
      key: "dictionaries",
      label: t("option:header.modeDictionaries", "Chat dictionaries"),
      shortcut: shortcutConfig.modeDictionaries,
    },
    {
      key: "characters",
      label: t("option:header.modeCharacters", "Characters"),
      shortcut: shortcutConfig.modeCharacters,
    },
  ]

  const renderModeButton = (mode: (typeof primaryModes)[0]) => {
    const promptStudioUnavailable =
      mode.key === "promptStudio" && promptStudioCapability.data === false
    const isSelected = currentMode === mode.key

    return (
      <button
        key={mode.key}
        type="button"
        role="tab"
        aria-selected={isSelected}
        onClick={() => {
          if (promptStudioUnavailable) return
          onModeChange(mode.key)
        }}
        disabled={promptStudioUnavailable}
        aria-disabled={promptStudioUnavailable}
        title={
          mode.shortcut
            ? (t("option:header.modeShortcutHint", "{{shortcut}} to switch", {
                shortcut: formatShortcut(mode.shortcut),
              }) as string) || undefined
            : undefined
        }
        className={classNames(
          "core-mode-button rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
          isSelected
            ? "core-mode-button--active active bg-amber-500 text-gray-900 shadow-sm dark:bg-amber-400 dark:text-gray-900"
            : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-[#262626] dark:text-gray-200 dark:hover:bg-[#333333]",
          promptStudioUnavailable ? "opacity-60 cursor-not-allowed" : ""
        )}
        data-active={isSelected ? "true" : undefined}
      >
        {mode.label}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t("option:header.modesLabel", "Modes")}
      </span>
      <div
        className="flex flex-wrap gap-1"
        role="tablist"
        aria-label={t("option:header.modesAriaLabel", "Application modes")}
      >
        {primaryModes.map(renderModeButton)}
        <Dropdown
          menu={{
            items: secondaryModes.map((mode) => ({
              key: mode.key,
              label: mode.label,
              disabled:
                mode.key === "promptStudio" &&
                promptStudioCapability.data === false,
            })),
            onClick: ({ key }) => onModeChange(key as CoreMode),
          }}
        >
          <button
            type="button"
            className={classNames(
              "core-mode-button rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
              "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-[#262626] dark:text-gray-200 dark:hover:bg-[#333333]"
            )}
          >
            {t("option:header.moreTools", "More...")}
          </button>
        </Dropdown>
      </div>
    </div>
  )
}

export default ModeSelector

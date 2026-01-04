import React from "react"
import { useTranslation } from "react-i18next"

export interface SlashCommandItem {
  id: string
  command: string
  label: string
  description: string
  keywords?: string[]
  action: () => void
}

interface UseSlashCommandsOptions {
  chatMode: string
  webSearch: boolean
  setChatMode: (mode: string) => void
  setWebSearch: (enabled: boolean) => void
  onOpenModelSettings: () => void
}

interface UseSlashCommandsResult {
  slashCommands: SlashCommandItem[]
  filteredSlashCommands: SlashCommandItem[]
  slashMatch: RegExpMatchArray | null
  slashQuery: string
  showSlashMenu: boolean
  slashActiveIndex: number
  setSlashActiveIndex: (index: number) => void
  slashCommandLookup: Map<string, SlashCommandItem>
  applySlashCommand: (command: SlashCommandItem) => void
}

/**
 * Hook for managing slash command autocomplete in the chat composer.
 * Extracted from form.tsx for better separation of concerns.
 */
export const useSlashCommands = ({
  chatMode,
  webSearch,
  setChatMode,
  setWebSearch,
  onOpenModelSettings
}: UseSlashCommandsOptions): UseSlashCommandsResult => {
  const { t } = useTranslation(["common", "sidepanel"])
  const [slashActiveIndex, setSlashActiveIndex] = React.useState(0)
  const [inputValue, setInputValue] = React.useState("")

  const slashCommands = React.useMemo<SlashCommandItem[]>(
    () => [
      {
        id: "slash-search",
        command: "search",
        label: t(
          "common:commandPalette.toggleKnowledgeSearch",
          "Toggle Knowledge Search"
        ),
        description: t(
          "common:commandPalette.toggleKnowledgeSearchDesc",
          "Search your knowledge base"
        ),
        keywords: ["rag", "context", "knowledge", "search"],
        action: () => setChatMode(chatMode === "rag" ? "normal" : "rag")
      },
      {
        id: "slash-web",
        command: "web",
        label: t("common:commandPalette.toggleWebSearch", "Toggle Web Search"),
        description: t(
          "common:commandPalette.toggleWebDesc",
          "Search the internet"
        ),
        keywords: ["web", "internet", "browse"],
        action: () => setWebSearch(!webSearch)
      },
      {
        id: "slash-vision",
        command: "vision",
        label: t("sidepanel:controlRow.vision", "Vision"),
        description: t(
          "sidepanel:controlRow.visionTooltip",
          "Enable Vision to analyze images"
        ),
        keywords: ["image", "ocr", "vision"],
        action: () => setChatMode(chatMode === "vision" ? "normal" : "vision")
      },
      {
        id: "slash-model",
        command: "model",
        label: t("common:commandPalette.switchModel", "Switch Model"),
        description: t(
          "common:currentChatModelSettings",
          "Open current chat settings"
        ),
        keywords: ["settings", "parameters", "temperature"],
        action: onOpenModelSettings
      }
    ],
    [chatMode, t, webSearch, setChatMode, setWebSearch, onOpenModelSettings]
  )

  const slashCommandLookup = React.useMemo(
    () => new Map(slashCommands.map((command) => [command.command, command])),
    [slashCommands]
  )

  const slashMatch = React.useMemo(
    () => inputValue.match(/^\s*\/(\w*)$/),
    [inputValue]
  )

  const slashQuery = slashMatch?.[1] ?? ""
  const showSlashMenu = Boolean(slashMatch)

  const filteredSlashCommands = React.useMemo(() => {
    if (!slashQuery) return slashCommands
    const q = slashQuery.toLowerCase()
    return slashCommands.filter((command) => {
      if (command.command.startsWith(q)) return true
      if (command.label.toLowerCase().includes(q)) return true
      return (command.keywords || []).some((keyword) =>
        keyword.toLowerCase().includes(q)
      )
    })
  }, [slashCommands, slashQuery])

  // Reset active index when filtered list changes
  React.useEffect(() => {
    setSlashActiveIndex(0)
  }, [filteredSlashCommands.length])

  const applySlashCommand = React.useCallback(
    (command: SlashCommandItem) => {
      command.action()
      setInputValue("")
    },
    []
  )

  return {
    slashCommands,
    filteredSlashCommands,
    slashMatch,
    slashQuery,
    showSlashMenu,
    slashActiveIndex,
    setSlashActiveIndex,
    slashCommandLookup,
    applySlashCommand
  }
}

/**
 * Helper hook to sync input value for slash command detection.
 * Use this in combination with useSlashCommands.
 */
export const useSlashCommandInput = (
  inputValue: string,
  slashCommands: SlashCommandItem[]
) => {
  const slashMatch = React.useMemo(
    () => inputValue.match(/^\s*\/(\w*)$/),
    [inputValue]
  )

  const slashQuery = slashMatch?.[1] ?? ""
  const showSlashMenu = Boolean(slashMatch)

  const filteredSlashCommands = React.useMemo(() => {
    if (!slashQuery) return slashCommands
    const q = slashQuery.toLowerCase()
    return slashCommands.filter((command) => {
      if (command.command.startsWith(q)) return true
      if (command.label.toLowerCase().includes(q)) return true
      return (command.keywords || []).some((keyword) =>
        keyword.toLowerCase().includes(q)
      )
    })
  }, [slashCommands, slashQuery])

  return {
    slashMatch,
    slashQuery,
    showSlashMenu,
    filteredSlashCommands
  }
}

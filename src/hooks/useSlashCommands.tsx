import React from "react"
import { useTranslation } from "react-i18next"
import { tldwClient } from "@/services/tldw/TldwApiClient"

type ServerSlashCommand = {
  id?: string | number
  command?: string
  name?: string
  label?: string
  description?: string
  keywords?: string[]
  permissions?: string[] | string
  required_permissions?: string[] | string
  requiredPermissions?: string[] | string
  permission?: string
  allowed?: boolean
  enabled?: boolean
}

type ServerCommandsResponse = {
  commands?: ServerSlashCommand[]
  data?: ServerSlashCommand[]
  results?: ServerSlashCommand[]
  permissions?: string[]
  user_permissions?: string[]
  userPermissions?: string[]
  allowed_commands?: string[]
  allowedCommands?: string[]
}

export interface SlashCommandItem {
  id: string
  command: string
  label: string
  description?: string
  keywords?: string[]
  action?: () => void
  source?: "server" | "local"
}

interface UseSlashCommandsOptions {
  chatMode: string
  webSearch: boolean
  setChatMode: (mode: string) => void
  setWebSearch: (enabled: boolean) => void
  onOpenModelSettings: () => void
  inputValue: string
  setInputValue?: (value: string) => void
}

interface UseSlashCommandsResult {
  slashCommands: SlashCommandItem[]
  filteredSlashCommands: SlashCommandItem[]
  slashMatch: RegExpMatchArray | null
  slashQuery: string
  showSlashMenu: boolean
  slashActiveIndex: number
  setSlashActiveIndex: React.Dispatch<React.SetStateAction<number>>
  slashCommandLookup: Map<string, SlashCommandItem>
  applySlashCommand: (text: string) => { handled: boolean; message: string }
  handleSlashCommandSelect: (command: SlashCommandItem) => void
}

const normalizeCommand = (value: string) =>
  value.replace(/^\/+/, "").trim().toLowerCase()

const normalizeStringArray = (
  value?: string[] | string | null
): string[] => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean)
  }
  return [String(value)]
}

const extractServerCommands = (payload: ServerCommandsResponse | any) => {
  if (Array.isArray(payload)) return payload as ServerSlashCommand[]
  if (!payload || typeof payload !== "object") return []
  if (Array.isArray(payload.commands)) return payload.commands
  if (Array.isArray(payload.data)) return payload.data
  if (Array.isArray(payload.results)) return payload.results
  return []
}

const extractPermissions = (payload: ServerCommandsResponse | any): string[] => {
  if (!payload || typeof payload !== "object") return []
  const perms =
    payload.permissions || payload.user_permissions || payload.userPermissions
  return normalizeStringArray(perms)
}

const extractAllowedCommands = (
  payload: ServerCommandsResponse | any
): string[] | null => {
  if (!payload || typeof payload !== "object") return null
  const allowed = payload.allowed_commands || payload.allowedCommands
  const list = normalizeStringArray(allowed)
  return list.length > 0 ? list.map(normalizeCommand) : null
}

/**
 * Hook for managing slash command autocomplete in the chat composer.
 * Server commands are fetched from /api/v1/chat/commands and filtered by permissions.
 */
export const useSlashCommands = ({
  chatMode,
  webSearch,
  setChatMode,
  setWebSearch,
  onOpenModelSettings,
  inputValue,
  setInputValue
}: UseSlashCommandsOptions): UseSlashCommandsResult => {
  const { t } = useTranslation(["common", "sidepanel"])
  const [slashActiveIndex, setSlashActiveIndex] = React.useState(0)
  const [serverPayload, setServerPayload] =
    React.useState<ServerCommandsResponse | null>(null)

  React.useEffect(() => {
    let isActive = true
    const loadCommands = async () => {
      try {
        await tldwClient.initialize()
        const payload = (await tldwClient.listChatCommands()) as
          | ServerCommandsResponse
          | ServerSlashCommand[]
        if (isActive) {
          if (Array.isArray(payload)) {
            setServerPayload({ commands: payload })
          } else {
            setServerPayload(payload || null)
          }
        }
      } catch {
        if (isActive) {
          setServerPayload(null)
        }
      }
    }
    void loadCommands()
    return () => {
      isActive = false
    }
  }, [])

  const fallbackMeta = React.useMemo(
    () => ({
      search: {
        label: t(
          "common:commandPalette.toggleKnowledgeSearch",
          "Toggle Knowledge Search"
        ),
        description: t(
          "common:commandPalette.toggleKnowledgeSearchDesc",
          "Search your knowledge base"
        ),
        keywords: ["rag", "context", "knowledge", "search"]
      },
      web: {
        label: t("common:commandPalette.toggleWebSearch", "Toggle Web Search"),
        description: t(
          "common:commandPalette.toggleWebDesc",
          "Search the internet"
        ),
        keywords: ["web", "internet", "browse"]
      },
      vision: {
        label: t("sidepanel:controlRow.vision", "Vision"),
        description: t(
          "sidepanel:controlRow.visionTooltip",
          "Enable Vision to analyze images"
        ),
        keywords: ["image", "ocr", "vision"]
      },
      model: {
        label: t("common:commandPalette.switchModel", "Switch Model"),
        description: t(
          "common:currentChatModelSettings",
          "Open current chat settings"
        ),
        keywords: ["settings", "parameters", "temperature"]
      }
    }),
    [t]
  )

  const localActions = React.useMemo(
    () => ({
      search: () => setChatMode(chatMode === "rag" ? "normal" : "rag"),
      web: () => setWebSearch(!webSearch),
      vision: () => setChatMode(chatMode === "vision" ? "normal" : "vision"),
      model: onOpenModelSettings
    }),
    [chatMode, onOpenModelSettings, setChatMode, setWebSearch, webSearch]
  )

  const fallbackCommands = React.useMemo<SlashCommandItem[]>(
    () =>
      Object.entries(fallbackMeta).map(([command, meta]) => ({
        id: `slash-${command}`,
        command,
        label: meta.label,
        description: meta.description,
        keywords: meta.keywords,
        action: localActions[command as keyof typeof localActions],
        source: "local"
      })),
    [fallbackMeta, localActions]
  )

  const serverCommands = React.useMemo<SlashCommandItem[]>(() => {
    if (!serverPayload) return []
    const commands = extractServerCommands(serverPayload)
    if (commands.length === 0) return []
    const allowedCommands = extractAllowedCommands(serverPayload)
    const userPermissions = extractPermissions(serverPayload)

    return commands
      .map((command, index) => {
        const commandName = normalizeCommand(
          command.command || command.name || ""
        )
        if (!commandName) return null
        if (command.allowed === false || command.enabled === false) return null
        if (
          allowedCommands &&
          !allowedCommands.includes(commandName)
        ) {
          return null
        }
        const requiredPermissions = normalizeStringArray(
          command.required_permissions ||
            command.requiredPermissions ||
            command.permissions ||
            command.permission
        )
        if (
          requiredPermissions.length > 0 &&
          userPermissions.length > 0 &&
          !requiredPermissions.every((perm) =>
            userPermissions.includes(perm)
          )
        ) {
          return null
        }
        const fallback = fallbackMeta[commandName as keyof typeof fallbackMeta]
        return {
          id: String(command.id ?? `server-${commandName}-${index}`),
          command: commandName,
          label: command.label || command.name || fallback?.label || commandName,
          description:
            command.description || fallback?.description || undefined,
          keywords: command.keywords || fallback?.keywords,
          action: localActions[commandName as keyof typeof localActions],
          source: "server"
        }
      })
      .filter(Boolean) as SlashCommandItem[]
  }, [fallbackMeta, localActions, serverPayload])

  const slashCommands =
    serverCommands.length > 0 ? serverCommands : fallbackCommands

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

  React.useEffect(() => {
    if (!showSlashMenu) {
      setSlashActiveIndex(0)
      return
    }
    setSlashActiveIndex((prev) => {
      if (filteredSlashCommands.length === 0) return 0
      return Math.min(prev, filteredSlashCommands.length - 1)
    })
  }, [filteredSlashCommands.length, showSlashMenu])

  const parseSlashInput = React.useCallback((text: string) => {
    const trimmed = text.trimStart()
    const match = trimmed.match(/^\/(\w+)(?:\s+([\s\S]*))?$/)
    if (!match) return null
    return {
      command: match[1].toLowerCase(),
      remainder: match[2] || ""
    }
  }, [])

  const applySlashCommand = React.useCallback(
    (text: string) => {
      const parsed = parseSlashInput(text)
      if (!parsed) {
        return { handled: false, message: text }
      }
      const command = slashCommandLookup.get(parsed.command)
      if (!command) {
        return { handled: false, message: text }
      }
      if (command.action) {
        command.action()
        return { handled: true, message: parsed.remainder }
      }
      return { handled: false, message: text }
    },
    [parseSlashInput, slashCommandLookup]
  )

  const handleSlashCommandSelect = React.useCallback(
    (command: SlashCommandItem) => {
      if (!setInputValue) return
      const parsed = parseSlashInput(inputValue)
      if (command.action) {
        command.action()
        setInputValue(parsed?.remainder || "")
        return
      }
      setInputValue(`/${command.command} `)
    },
    [inputValue, parseSlashInput, setInputValue]
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
    applySlashCommand,
    handleSlashCommandSelect
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

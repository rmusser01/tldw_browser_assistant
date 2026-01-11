import React from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { useServerOnline } from "@/hooks/useServerOnline"

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const normalizeStringArray = (value?: unknown): string[] => {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean)
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)]
  }
  return []
}

const isServerSlashCommand = (value: unknown): value is ServerSlashCommand => {
  if (!isRecord(value)) return false
  const id = value.id
  if (id != null && typeof id !== "string" && typeof id !== "number") {
    return false
  }
  const stringFields = ["command", "name", "label", "description"] as const
  for (const field of stringFields) {
    const fieldValue = value[field]
    if (fieldValue != null && typeof fieldValue !== "string") {
      return false
    }
  }
  const booleanFields = ["allowed", "enabled"] as const
  for (const field of booleanFields) {
    const fieldValue = value[field]
    if (fieldValue != null && typeof fieldValue !== "boolean") {
      return false
    }
  }
  return true
}

const extractServerCommands = (payload: unknown): ServerSlashCommand[] => {
  if (Array.isArray(payload)) {
    return payload.filter(isServerSlashCommand)
  }
  if (!isRecord(payload)) return []
  if (Array.isArray(payload.commands)) {
    return payload.commands.filter(isServerSlashCommand)
  }
  if (Array.isArray(payload.data)) {
    return payload.data.filter(isServerSlashCommand)
  }
  if (Array.isArray(payload.results)) {
    return payload.results.filter(isServerSlashCommand)
  }
  return []
}

const extractPermissions = (payload: unknown): string[] => {
  if (!isRecord(payload)) return []
  const perms =
    payload.permissions || payload.user_permissions || payload.userPermissions
  return normalizeStringArray(perms)
}

const extractAllowedCommands = (
  payload: unknown
): string[] | null => {
  if (!isRecord(payload)) return null
  const allowed = payload.allowed_commands || payload.allowedCommands
  const list = normalizeStringArray(allowed)
  return list.length > 0 ? list.map(normalizeCommand) : null
}

const normalizeServerCommandsPayload = (
  payload: unknown
): ServerCommandsResponse | null => {
  if (payload == null) return null
  if (Array.isArray(payload)) {
    return { commands: payload.filter(isServerSlashCommand) }
  }
  if (!isRecord(payload)) return null
  const hasCommandArray =
    Array.isArray(payload.commands) ||
    Array.isArray(payload.data) ||
    Array.isArray(payload.results)
  const commands = extractServerCommands(payload)
  const permissions = extractPermissions(payload)
  const allowedCommands = extractAllowedCommands(payload)
  if (!hasCommandArray && permissions.length === 0 && !allowedCommands) {
    return null
  }
  return {
    ...(hasCommandArray ? { commands } : {}),
    ...(permissions.length ? { permissions } : {}),
    ...(allowedCommands ? { allowed_commands: allowedCommands } : {})
  }
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
  const isOnline = useServerOnline()
  const [slashActiveIndex, setSlashActiveIndex] = React.useState(0)
  const { data: serverPayload } = useQuery({
    queryKey: ["tldw:chat:slashCommands"],
    queryFn: async (): Promise<ServerCommandsResponse | null> => {
      const payload = (await tldwClient.listChatCommands()) as unknown
      const normalized = normalizeServerCommandsPayload(payload)
      if (!normalized && payload != null) {
        console.warn("Unable to parse slash commands response:", payload)
      }
      return normalized
    },
    enabled: isOnline,
    staleTime: 60_000,
    retry: 2
  })

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
        if (requiredPermissions.length > 0) {
          if (!userPermissions || userPermissions.length === 0) {
            return null
          }
          if (
            !requiredPermissions.every((perm) =>
              userPermissions.includes(perm)
            )
          ) {
            return null
          }
        }
        const fallback = fallbackMeta[commandName as keyof typeof fallbackMeta]
        return {
          id: String(command.id ?? `server-${commandName}-${index}`),
          command: commandName,
          label: command.label || command.name || fallback?.label || commandName,
          description:
            command.description || fallback?.description || undefined,
          keywords: normalizeStringArray(command.keywords || fallback?.keywords),
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

  // Match incomplete slash commands for autocomplete (allows just "/").
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

  // Reset or clamp active index when menu state or filtered list changes.
  React.useEffect(() => {
    if (!showSlashMenu || filteredSlashCommands.length === 0) {
      setSlashActiveIndex(0)
      return
    }
    setSlashActiveIndex((prev) =>
      Math.min(prev, filteredSlashCommands.length - 1)
    )
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

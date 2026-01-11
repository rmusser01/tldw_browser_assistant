import {
  coerceBoolean,
  coerceOptionalString,
  coerceNumber,
  coerceString,
  defineSetting
} from "@/services/settings/registry"

const THEME_VALUES = ["system", "dark", "light"] as const
export type ThemeValue = (typeof THEME_VALUES)[number]

const resolveSystemTheme = (): "dark" | "light" => {
  if (typeof window === "undefined") return "light"
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
    ? "dark"
    : "light"
}

const normalizeThemeValue = (value: unknown, fallback: ThemeValue) => {
  const normalized = String(value || "").toLowerCase()
  return THEME_VALUES.includes(normalized as ThemeValue)
    ? (normalized as ThemeValue)
    : fallback
}

export const THEME_SETTING = defineSetting(
  "theme",
  "system" as ThemeValue,
  (value) => normalizeThemeValue(value, "system"),
  {
    area: "local",
    validate: (value) => THEME_VALUES.includes(value),
    localStorageKey: "theme",
    mirrorToLocalStorage: true,
    localStorageSerialize: (value) =>
      value === "system" ? resolveSystemTheme() : value
  }
)

export const I18N_LANGUAGE_SETTING = defineSetting(
  "i18nextLng",
  "en",
  (value) => coerceString(value, "en"),
  {
    area: "local",
    localStorageKey: "i18nextLng",
    mirrorToLocalStorage: true
  }
)

export const CHAT_BACKGROUND_IMAGE_SETTING = defineSetting(
  "chatBackgroundImage",
  undefined as string | undefined,
  coerceOptionalString
)

export const CONTEXT_FILE_SIZE_MB_SETTING = defineSetting(
  "tldw:contextFileMaxSizeMb",
  10,
  (value) => coerceNumber(value, 10),
  {
    area: "local",
    validate: (value) => Number.isFinite(value) && value > 0
  }
)

const UI_MODE_VALUES = ["sidePanel", "webui"] as const
export type UiModeValue = (typeof UI_MODE_VALUES)[number]

const normalizeUiModeValue = (value: unknown, fallback: UiModeValue) => {
  const normalized = String(value || "")
  return UI_MODE_VALUES.includes(normalized as UiModeValue)
    ? (normalized as UiModeValue)
    : fallback
}

export const UI_MODE_SETTING = defineSetting(
  "uiMode",
  "sidePanel" as UiModeValue,
  (value) => normalizeUiModeValue(value, "sidePanel"),
  {
    validate: (value) => UI_MODE_VALUES.includes(value)
  }
)

const SIDEBAR_TAB_VALUES = ["server", "folders"] as const
type SidebarTabValue = (typeof SIDEBAR_TAB_VALUES)[number]

export const SIDEBAR_ACTIVE_TAB_SETTING = defineSetting(
  "tldw:sidebar:activeTab",
  "server" as SidebarTabValue,
  (value) => {
    const normalized = String(value || "").toLowerCase()
    return SIDEBAR_TAB_VALUES.includes(normalized as SidebarTabValue)
      ? (normalized as SidebarTabValue)
      : "server"
  },
  {
    area: "local",
    validate: (value) => SIDEBAR_TAB_VALUES.includes(value)
  }
)

export const SIDEBAR_SHORTCUTS_COLLAPSED_SETTING = defineSetting(
  "tldw:sidebar:shortcutsCollapsed",
  false,
  (value) => coerceBoolean(value, false),
  {
    area: "local"
  }
)

export const HEADER_SHORTCUTS_EXPANDED_SETTING = defineSetting(
  "headerShortcutsExpanded",
  false,
  (value) => coerceBoolean(value, false),
  {
    area: "local"
  }
)

const coerceBooleanRecord = (value: unknown): Record<string, boolean> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return value as Record<string, boolean>
  const hasInvalid = entries.some(([, entry]) => typeof entry !== "boolean")
  if (!hasInvalid) return value as Record<string, boolean>
  const normalized: Record<string, boolean> = {}
  for (const [key, entry] of entries) {
    if (typeof entry === "boolean") normalized[key] = entry
  }
  return normalized
}

export const SEEN_HINTS_SETTING = defineSetting(
  "tldw:seenHints",
  {} as Record<string, boolean>,
  (value) => coerceBooleanRecord(value),
  {
    area: "local"
  }
)

export const MEDIA_REVIEW_ORIENTATION_SETTING = defineSetting(
  "media-review-orientation",
  "vertical" as "vertical" | "horizontal",
  (value) => {
    const normalized = String(value || "").toLowerCase()
    return normalized === "horizontal" ? "horizontal" : "vertical"
  },
  {
    area: "local"
  }
)

export type DiscussMediaPrompt = {
  mediaId?: string
  url?: string
  title?: string
  content?: string
}

const coerceDiscussMediaPrompt = (
  value: unknown
): DiscussMediaPrompt | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const payload = value as Record<string, unknown>
  const result: DiscussMediaPrompt = {}
  if (typeof payload.mediaId === "string" && payload.mediaId.length > 0) {
    result.mediaId = payload.mediaId
  }
  if (typeof payload.url === "string" && payload.url.length > 0) {
    result.url = payload.url
  }
  if (typeof payload.title === "string" && payload.title.length > 0) {
    result.title = payload.title
  }
  if (typeof payload.content === "string" && payload.content.length > 0) {
    result.content = payload.content
  }
  return Object.keys(result).length > 0 ? result : undefined
}

export const DISCUSS_MEDIA_PROMPT_SETTING = defineSetting(
  "tldw:discussMediaPrompt",
  undefined as DiscussMediaPrompt | undefined,
  (value) => coerceDiscussMediaPrompt(value),
  {
    area: "local",
    localStorageKey: "tldw:discussMediaPrompt",
    mirrorToLocalStorage: true
  }
)

export const LAST_MEDIA_ID_SETTING = defineSetting(
  "tldw:lastMediaId",
  undefined as string | undefined,
  coerceOptionalString,
  {
    area: "local",
    localStorageKey: "tldw:lastMediaId",
    mirrorToLocalStorage: true
  }
)

export const LAST_NOTE_ID_SETTING = defineSetting(
  "tldw:lastNoteId",
  undefined as string | undefined,
  coerceOptionalString,
  {
    area: "local",
    localStorageKey: "tldw:lastNoteId",
    mirrorToLocalStorage: true
  }
)

export const LAST_DECK_ID_SETTING = defineSetting(
  "tldw:lastDeckId",
  undefined as string | undefined,
  coerceOptionalString,
  {
    area: "local",
    localStorageKey: "tldw:lastDeckId",
    mirrorToLocalStorage: true
  }
)

export const DEFAULT_MEDIA_COLLAPSED_SECTIONS: Record<string, boolean> = {
  statistics: false,
  content: false,
  metadata: true,
  analysis: false
}

export const MEDIA_COLLAPSED_SECTIONS_SETTING = defineSetting(
  "tldw:media:collapsedSections",
  DEFAULT_MEDIA_COLLAPSED_SECTIONS,
  (value) => coerceBooleanRecord(value),
  {
    area: "local"
  }
)

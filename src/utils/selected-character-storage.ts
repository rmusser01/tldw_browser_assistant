import { createSafeStorage } from "@/utils/safe-storage"

export const SELECTED_CHARACTER_STORAGE_KEY = "selectedCharacter"

export const selectedCharacterStorage = createSafeStorage({ area: "local" })
export const selectedCharacterSyncStorage = createSafeStorage({ area: "sync" })

const tryParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export const parseSelectedCharacterValue = <T = unknown>(
  value: unknown
): T | null => {
  if (!value) return null
  if (typeof value === "string") {
    const parsed = tryParseJson(value)
    if (parsed && typeof parsed === "object") {
      return parsed as T
    }
    if (typeof parsed === "string") {
      const nested = tryParseJson(parsed)
      if (nested && typeof nested === "object") {
        return nested as T
      }
    }
    return null
  }
  if (typeof value === "object") {
    return value as T
  }
  return null
}

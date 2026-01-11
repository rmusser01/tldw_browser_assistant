import { createSafeStorage } from "@/utils/safe-storage"

export const SELECTED_CHARACTER_STORAGE_KEY = "selectedCharacter"

export const selectedCharacterStorage = createSafeStorage({ area: "local" })
export const selectedCharacterSyncStorage = createSafeStorage({ area: "sync" })

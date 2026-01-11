import React from "react"
import { useStorage } from "@plasmohq/storage/hook"
import type { Character } from "@/types/character"
import {
  SELECTED_CHARACTER_STORAGE_KEY,
  selectedCharacterStorage,
  selectedCharacterSyncStorage
} from "@/utils/selected-character-storage"

type StoredCharacter = Character

const hasValidId = (value: unknown): value is { id: string | number } => {
  if (!value || typeof value !== "object" || !("id" in value)) return false
  const id = (value as { id?: unknown }).id
  if (typeof id === "string") return id.trim().length > 0
  if (typeof id === "number") return Number.isFinite(id)
  return false
}

// selectedCharacter can include large greetings; use local storage to avoid sync quotas.
export const useSelectedCharacter = <T = StoredCharacter>(
  initialValue: T | null = null
) => {
  const [selectedCharacter, setSelectedCharacter, meta] = useStorage<T | null>(
    { key: SELECTED_CHARACTER_STORAGE_KEY, instance: selectedCharacterStorage },
    initialValue
  )
  const migratedRef = React.useRef(false)

  React.useEffect(() => {
    if (meta.isLoading || migratedRef.current) return
    if (hasValidId(selectedCharacter)) return

    migratedRef.current = true
    let cancelled = false

    const migrate = async () => {
      try {
        const stored = await selectedCharacterSyncStorage.get<T | null>(
          SELECTED_CHARACTER_STORAGE_KEY
        )
        if (!hasValidId(stored) || cancelled) return
        await setSelectedCharacter(stored)
        await selectedCharacterSyncStorage.remove(SELECTED_CHARACTER_STORAGE_KEY)
      } catch {
        // ignore migration failures
      }
    }

    void migrate()
    return () => {
      cancelled = true
    }
  }, [meta.isLoading, selectedCharacter, setSelectedCharacter])

  return [selectedCharacter, setSelectedCharacter, meta] as const
}

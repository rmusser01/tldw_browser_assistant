import React from "react"
import { useStorage } from "@plasmohq/storage/hook"
import type { Character } from "@/types/character"
import {
  SELECTED_CHARACTER_STORAGE_KEY,
  selectedCharacterStorage,
  selectedCharacterSyncStorage
} from "@/utils/selected-character-storage"

type StoredCharacter = Character | null

// selectedCharacter can include large greetings; use local storage to avoid sync quotas.
export const useSelectedCharacter = <T = StoredCharacter>(
  initialValue: T = null as T
) => {
  const [selectedCharacter, setSelectedCharacter, meta] = useStorage<T>(
    { key: SELECTED_CHARACTER_STORAGE_KEY, instance: selectedCharacterStorage },
    initialValue
  )
  const migratedRef = React.useRef(false)

  React.useEffect(() => {
    if (meta.isLoading || migratedRef.current) return
    const hasId =
      selectedCharacter &&
      typeof selectedCharacter === "object" &&
      "id" in selectedCharacter &&
      Boolean((selectedCharacter as any).id)
    if (hasId) return

    migratedRef.current = true
    let cancelled = false

    const migrate = async () => {
      try {
        const stored = await selectedCharacterSyncStorage.get<T>(
          SELECTED_CHARACTER_STORAGE_KEY
        )
        const storedId =
          stored &&
          typeof stored === "object" &&
          "id" in stored &&
          Boolean((stored as any).id)
        if (!storedId || cancelled) return
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

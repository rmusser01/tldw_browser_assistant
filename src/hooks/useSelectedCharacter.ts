import React from "react"
import { useStorage } from "@plasmohq/storage/hook"
import type { Character } from "@/types/character"
import {
  SELECTED_CHARACTER_STORAGE_KEY,
  selectedCharacterStorage,
  selectedCharacterSyncStorage,
  parseSelectedCharacterValue
} from "@/utils/selected-character-storage"

type StoredCharacter = Character

type Subscriber<T> = (value: T | null) => void

const selectedCharacterSubscribers = new Set<Subscriber<any>>()

const notifySelectedCharacterSubscribers = (value: unknown) => {
  selectedCharacterSubscribers.forEach((subscriber) => {
    subscriber(value)
  })
}

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
  const normalizingRef = React.useRef(false)
  const setRenderValueRef = React.useRef(meta.setRenderValue)

  React.useEffect(() => {
    setRenderValueRef.current = meta.setRenderValue
  }, [meta.setRenderValue])

  React.useEffect(() => {
    const subscriber: Subscriber<T> = (value) => {
      setRenderValueRef.current(value as T | null)
    }
    selectedCharacterSubscribers.add(subscriber)
    return () => {
      selectedCharacterSubscribers.delete(subscriber)
    }
  }, [])

  const setSelectedCharacterWithBroadcast = React.useCallback(
    async (next: T | null) => {
      await setSelectedCharacter(next)
      notifySelectedCharacterSubscribers(next)
    },
    [setSelectedCharacter]
  )

  React.useEffect(() => {
    if (meta.isLoading || migratedRef.current) return
    if (hasValidId(selectedCharacter)) return

    migratedRef.current = true
    let cancelled = false

    const migrate = async () => {
      try {
        const storedRaw = await selectedCharacterSyncStorage.get<T | null>(
          SELECTED_CHARACTER_STORAGE_KEY
        )
        const stored = parseSelectedCharacterValue<T>(storedRaw)
        if (!hasValidId(stored) || cancelled) return
        await setSelectedCharacterWithBroadcast(stored)
        await selectedCharacterSyncStorage.remove(SELECTED_CHARACTER_STORAGE_KEY)
      } catch {
        // ignore migration failures
      }
    }

    void migrate()
    return () => {
      cancelled = true
    }
  }, [meta.isLoading, selectedCharacter, setSelectedCharacterWithBroadcast])

  React.useEffect(() => {
    if (meta.isLoading || normalizingRef.current) return
    if (hasValidId(selectedCharacter)) return
    const normalized = parseSelectedCharacterValue<T>(selectedCharacter)
    if (!hasValidId(normalized)) return
    normalizingRef.current = true
    void setSelectedCharacterWithBroadcast(normalized).finally(() => {
      normalizingRef.current = false
    })
  }, [meta.isLoading, selectedCharacter, setSelectedCharacterWithBroadcast])

  return [selectedCharacter, setSelectedCharacterWithBroadcast, meta] as const
}

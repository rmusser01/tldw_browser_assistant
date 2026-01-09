import React from "react"
import { COMPOSER_CONSTANTS } from "@/config/ui-constants"
import { createLocalRegistryBucket } from "@/services/settings/local-bucket"

const DRAFT_BUCKET_PREFIX = "registry:draft:"
const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000

const draftBucket = createLocalRegistryBucket<string>({
  prefix: DRAFT_BUCKET_PREFIX,
  ttlMs: DRAFT_TTL_MS
})

const readLegacyDraft = (storageKey: string): string | null => {
  if (typeof window === "undefined") return null
  try {
    const draft = window.localStorage.getItem(storageKey)
    if (!draft || draft.length === 0) return null
    return draft
  } catch {
    return null
  }
}

const clearLegacyDraft = (storageKey: string) => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(storageKey)
  } catch {
    // ignore legacy storage errors
  }
}

interface DraftPersistenceOptions {
  storageKey: string
  getValue: () => string
  setValue: (value: string) => void
  enabled?: boolean
}

interface DraftPersistenceResult {
  draftSaved: boolean
  clearDraft: () => void
}

/**
 * Hook for persisting draft messages to a local-only registry bucket.
 *
 * - Restores draft on mount
 * - Persists draft whenever value changes
 * - Shows "Draft saved" indicator briefly after save
 * - Cleans up timeouts on unmount
 */
export const useDraftPersistence = ({
  storageKey,
  getValue,
  setValue,
  enabled = true
}: DraftPersistenceOptions): DraftPersistenceResult => {
  const [draftSaved, setDraftSaved] = React.useState(false)
  const draftSavedTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const setValueRef = React.useRef(setValue)

  React.useEffect(() => {
    setValueRef.current = setValue
  }, [setValue])

  // Restore unsent draft on mount
  React.useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const restoreDraft = async () => {
      const record = await draftBucket.get(storageKey)
      let draftValue = record?.value ?? null

      if (!draftValue) {
        const legacyDraft = readLegacyDraft(storageKey)
        if (legacyDraft) {
          await draftBucket.set(storageKey, legacyDraft)
          clearLegacyDraft(storageKey)
          draftValue = legacyDraft
        }
      } else {
        clearLegacyDraft(storageKey)
      }

      if (!cancelled && draftValue) {
        setValueRef.current(draftValue)
      }
    }

    void restoreDraft()
    return () => {
      cancelled = true
    }
  }, [storageKey, enabled])

  React.useEffect(() => {
    if (!enabled) return
    void draftBucket.cleanup()
  }, [enabled])

  // Get current value for effect dependency
  const currentValue = getValue()

  // Persist draft whenever the message changes
  React.useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const value = currentValue
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current)
      persistTimeoutRef.current = null
    }
    if (draftSavedTimeoutRef.current) {
      clearTimeout(draftSavedTimeoutRef.current)
      draftSavedTimeoutRef.current = null
    }
    if (typeof value !== "string") return

    if (value.trim().length === 0) {
      void draftBucket.remove(storageKey)
      clearLegacyDraft(storageKey)
      if (!cancelled) {
        setDraftSaved(false)
      }
      return
    }

    setDraftSaved(false)
    persistTimeoutRef.current = setTimeout(() => {
      void (async () => {
        await draftBucket.set(storageKey, value)
        clearLegacyDraft(storageKey)
        if (cancelled) return

        setDraftSaved(true)
        draftSavedTimeoutRef.current = setTimeout(() => {
          setDraftSaved(false)
        }, COMPOSER_CONSTANTS.DRAFT_SAVED_DISPLAY_MS)
      })()
    }, COMPOSER_CONSTANTS.DRAFT_SAVE_DEBOUNCE_MS)

    return () => {
      cancelled = true
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current)
        persistTimeoutRef.current = null
      }
    }
  }, [currentValue, storageKey, enabled])

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (draftSavedTimeoutRef.current) {
        clearTimeout(draftSavedTimeoutRef.current)
      }
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current)
      }
    }
  }, [])

  const clearDraft = React.useCallback(() => {
    void draftBucket.remove(storageKey)
    clearLegacyDraft(storageKey)
    setDraftSaved(false)
  }, [storageKey])

  return {
    draftSaved,
    clearDraft
  }
}

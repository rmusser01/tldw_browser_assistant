import React from "react"
import { COMPOSER_CONSTANTS } from "@/config/ui-constants"

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
 * Hook for persisting draft messages to localStorage.
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

  // Restore unsent draft on mount
  React.useEffect(() => {
    if (!enabled) return
    try {
      if (typeof window === "undefined") return
      const draft = window.localStorage.getItem(storageKey)
      if (draft && draft.length > 0) {
        setValue(draft)
      }
    } catch {
      // Ignore draft restore errors (e.g., quota exceeded, private mode)
    }
    // Only run on mount and when storageKey changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, enabled])

  // Get current value for effect dependency
  const currentValue = getValue()

  // Persist draft whenever the message changes
  React.useEffect(() => {
    if (!enabled) return
    try {
      if (typeof window === "undefined") return
      const value = currentValue
      if (typeof value !== "string") return

      if (value.trim().length === 0) {
        window.localStorage.removeItem(storageKey)
        setDraftSaved(false)
      } else {
        window.localStorage.setItem(storageKey, value)
        // Show "Draft saved" briefly
        setDraftSaved(true)
        if (draftSavedTimeoutRef.current) {
          clearTimeout(draftSavedTimeoutRef.current)
        }
        draftSavedTimeoutRef.current = setTimeout(() => {
          setDraftSaved(false)
        }, COMPOSER_CONSTANTS.DRAFT_SAVED_DISPLAY_MS)
      }
    } catch {
      // Ignore persistence errors (e.g., quota exceeded, private mode)
    }
  }, [currentValue, storageKey, enabled])

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (draftSavedTimeoutRef.current) {
        clearTimeout(draftSavedTimeoutRef.current)
      }
    }
  }, [])

  const clearDraft = React.useCallback(() => {
    try {
      if (typeof window === "undefined") return
      window.localStorage.removeItem(storageKey)
      setDraftSaved(false)
    } catch {
      // Ignore errors
    }
  }, [storageKey])

  return {
    draftSaved,
    clearDraft
  }
}

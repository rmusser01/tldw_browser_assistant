import { useEffect, useRef, useCallback } from "react"
import type { AnswerValue } from "@/services/quizzes"
import { createLocalRegistryBucket } from "@/services/settings/local-bucket"

interface SavedAttempt {
  attemptId: number
  quizId: number
  answers: Record<number, AnswerValue>
  timestamp: number
}

const BUCKET_PREFIX = "registry:quiz-attempt:"
const LEGACY_STORAGE_PREFIX = "quiz-attempt-"
const DEBOUNCE_MS = 500
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 hours

const quizAttemptBucket = createLocalRegistryBucket<SavedAttempt>({
  prefix: BUCKET_PREFIX,
  ttlMs: STALE_THRESHOLD_MS
})

const legacyKeyForAttempt = (attemptId: number) => `${LEGACY_STORAGE_PREFIX}${attemptId}`

const isStaleAttempt = (timestamp: number) =>
  Date.now() - timestamp > STALE_THRESHOLD_MS

const readLegacyAttempt = (attemptId: number): SavedAttempt | null => {
  if (typeof window === "undefined") return null
  try {
    const saved = window.localStorage.getItem(legacyKeyForAttempt(attemptId))
    if (!saved) return null
    const data = JSON.parse(saved) as SavedAttempt
    if (
      typeof data !== "object" ||
      data === null ||
      data.attemptId !== attemptId ||
      typeof data.quizId !== "number" ||
      typeof data.timestamp !== "number" ||
      typeof data.answers !== "object" ||
      data.answers === null
    ) {
      return null
    }
    if (isStaleAttempt(data.timestamp)) return null
    return data
  } catch {
    return null
  }
}

const clearLegacyAttempt = (attemptId: number) => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(legacyKeyForAttempt(attemptId))
  } catch {
    // ignore legacy storage errors
  }
}

const migrateLegacyAttempt = async (attemptId: number): Promise<SavedAttempt | null> => {
  const legacy = readLegacyAttempt(attemptId)
  if (!legacy) {
    clearLegacyAttempt(attemptId)
    return null
  }
  await quizAttemptBucket.set(String(attemptId), legacy, legacy.timestamp)
  clearLegacyAttempt(attemptId)
  return legacy
}

const cleanupLegacyAttempts = async () => {
  if (typeof window === "undefined") return
  try {
    const keys = Object.keys(window.localStorage).filter((key) =>
      key.startsWith(LEGACY_STORAGE_PREFIX)
    )
    if (keys.length === 0) return

    await Promise.all(
      keys.map(async (key) => {
        try {
          const raw = window.localStorage.getItem(key)
          if (!raw) {
            window.localStorage.removeItem(key)
            return
          }
          const data = JSON.parse(raw) as SavedAttempt
          if (
            typeof data !== "object" ||
            data === null ||
            typeof data.attemptId !== "number" ||
            typeof data.quizId !== "number" ||
            typeof data.timestamp !== "number" ||
            typeof data.answers !== "object" ||
            data.answers === null
          ) {
            window.localStorage.removeItem(key)
            return
          }
          if (isStaleAttempt(data.timestamp)) {
            window.localStorage.removeItem(key)
            return
          }
          await quizAttemptBucket.set(String(data.attemptId), data, data.timestamp)
          window.localStorage.removeItem(key)
        } catch {
          window.localStorage.removeItem(key)
        }
      })
    )
  } catch {
    // ignore legacy cleanup errors
  }
}

/**
 * Hook for auto-saving quiz attempt progress to a local-only registry bucket.
 * Provides save, restore, and clear functionality with debouncing.
 */
export function useQuizAutoSave(
  attemptId: number | null,
  quizId: number | null,
  answers: Record<number, AnswerValue>,
  setAnswers: (answers: Record<number, AnswerValue>) => void
) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string | null>(null)

  // Save answers to local-only storage with debouncing
  const saveAnswers = useCallback(async () => {
    if (!attemptId || !quizId || Object.keys(answers).length === 0) return

    const timestamp = Date.now()
    const data: SavedAttempt = {
      attemptId,
      quizId,
      answers,
      timestamp
    }
    const serialized = JSON.stringify(data)

    // Avoid redundant saves
    if (serialized === lastSavedRef.current) return

    try {
      await quizAttemptBucket.set(String(attemptId), data, timestamp)
      lastSavedRef.current = serialized
    } catch (error) {
      console.warn("Failed to save quiz progress:", error)
    }
  }, [attemptId, quizId, answers])

  // Debounced save effect
  useEffect(() => {
    if (!attemptId || Object.keys(answers).length === 0) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(() => {
      void saveAnswers()
    }, DEBOUNCE_MS)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [answers, attemptId, saveAnswers])

  // Restore saved answers when attempt is loaded
  const restoreSavedAnswers = useCallback(async (): Promise<boolean> => {
    if (!attemptId) return false

    try {
      const record = await quizAttemptBucket.get(String(attemptId))
      const data = record?.value ?? (await migrateLegacyAttempt(attemptId))
      if (!data) return false

      // Verify it's the same attempt
      if (data.attemptId === attemptId && Object.keys(data.answers).length > 0) {
        setAnswers(data.answers)
        lastSavedRef.current = JSON.stringify(data)
        return true
      }
    } catch (error) {
      console.warn("Failed to restore quiz progress:", error)
    }

    return false
  }, [attemptId, setAnswers])

  // Check if there's saved progress for an attempt
  const hasSavedProgress = useCallback(async (checkAttemptId: number): Promise<boolean> => {
    try {
      const record = await quizAttemptBucket.get(String(checkAttemptId))
      if (record?.value) return true
      const legacy = await migrateLegacyAttempt(checkAttemptId)
      return Boolean(legacy)
    } catch {
      return false
    }
  }, [])

  // Get saved progress details
  const getSavedProgress = useCallback(
    async (checkAttemptId: number): Promise<SavedAttempt | null> => {
      try {
        const record = await quizAttemptBucket.get(String(checkAttemptId))
        if (record?.value) return record.value
        return await migrateLegacyAttempt(checkAttemptId)
      } catch {
        return null
      }
    },
    []
  )

  // Clear saved progress (call on successful submit or abandon)
  const clearSavedProgress = useCallback(async () => {
    if (!attemptId) return

    try {
      await quizAttemptBucket.remove(String(attemptId))
      clearLegacyAttempt(attemptId)
      lastSavedRef.current = null
    } catch (error) {
      console.warn("Failed to clear quiz progress:", error)
    }
  }, [attemptId])

  // Force immediate save (for "Save & Exit" button)
  const forceSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    await saveAnswers()
  }, [saveAnswers])

  // Cleanup old saved attempts on mount
  useEffect(() => {
    void quizAttemptBucket.cleanup()
    void cleanupLegacyAttempts()
  }, [])

  return {
    restoreSavedAnswers,
    hasSavedProgress,
    getSavedProgress,
    clearSavedProgress,
    forceSave
  }
}

export default useQuizAutoSave

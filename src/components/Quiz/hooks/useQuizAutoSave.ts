import { useEffect, useRef, useCallback } from "react"
import type { AnswerValue } from "@/services/quizzes"

interface SavedAttempt {
  attemptId: number
  quizId: number
  answers: Record<number, AnswerValue>
  timestamp: number
}

const STORAGE_PREFIX = "quiz-attempt-"
const DEBOUNCE_MS = 500
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Hook for auto-saving quiz attempt progress to localStorage.
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

  const getStorageKey = useCallback((id: number) => `${STORAGE_PREFIX}${id}`, [])

  // Save answers to localStorage with debouncing
  const saveAnswers = useCallback(() => {
    if (!attemptId || !quizId || Object.keys(answers).length === 0) return

    const data: SavedAttempt = {
      attemptId,
      quizId,
      answers,
      timestamp: Date.now()
    }
    const serialized = JSON.stringify(data)

    // Avoid redundant saves
    if (serialized === lastSavedRef.current) return

    try {
      localStorage.setItem(getStorageKey(attemptId), serialized)
      lastSavedRef.current = serialized
    } catch (error) {
      console.warn("Failed to save quiz progress:", error)
    }
  }, [attemptId, quizId, answers, getStorageKey])

  // Debounced save effect
  useEffect(() => {
    if (!attemptId || Object.keys(answers).length === 0) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(saveAnswers, DEBOUNCE_MS)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [answers, attemptId, saveAnswers])

  // Restore saved answers when attempt is loaded
  const restoreSavedAnswers = useCallback((): boolean => {
    if (!attemptId) return false

    try {
      const saved = localStorage.getItem(getStorageKey(attemptId))
      if (!saved) return false

      const data: SavedAttempt = JSON.parse(saved)

      // Check if saved data is stale
      if (Date.now() - data.timestamp > STALE_THRESHOLD_MS) {
        localStorage.removeItem(getStorageKey(attemptId))
        return false
      }

      // Verify it's the same attempt
      if (data.attemptId === attemptId && Object.keys(data.answers).length > 0) {
        setAnswers(data.answers)
        lastSavedRef.current = saved
        return true
      }
    } catch (error) {
      console.warn("Failed to restore quiz progress:", error)
    }

    return false
  }, [attemptId, getStorageKey, setAnswers])

  // Check if there's saved progress for an attempt
  const hasSavedProgress = useCallback((checkAttemptId: number): boolean => {
    try {
      const saved = localStorage.getItem(getStorageKey(checkAttemptId))
      if (!saved) return false

      const data: SavedAttempt = JSON.parse(saved)
      return Date.now() - data.timestamp <= STALE_THRESHOLD_MS
    } catch {
      return false
    }
  }, [getStorageKey])

  // Get saved progress details
  const getSavedProgress = useCallback((checkAttemptId: number): SavedAttempt | null => {
    try {
      const saved = localStorage.getItem(getStorageKey(checkAttemptId))
      if (!saved) return null

      const data: SavedAttempt = JSON.parse(saved)
      if (Date.now() - data.timestamp > STALE_THRESHOLD_MS) {
        localStorage.removeItem(getStorageKey(checkAttemptId))
        return null
      }

      return data
    } catch {
      return null
    }
  }, [getStorageKey])

  // Clear saved progress (call on successful submit or abandon)
  const clearSavedProgress = useCallback(() => {
    if (!attemptId) return

    try {
      localStorage.removeItem(getStorageKey(attemptId))
      lastSavedRef.current = null
    } catch (error) {
      console.warn("Failed to clear quiz progress:", error)
    }
  }, [attemptId, getStorageKey])

  // Force immediate save (for "Save & Exit" button)
  const forceSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveAnswers()
  }, [saveAnswers])

  // Cleanup old saved attempts on mount
  useEffect(() => {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX))
      keys.forEach((key) => {
        const saved = localStorage.getItem(key)
        if (saved) {
          try {
            const data: SavedAttempt = JSON.parse(saved)
            if (Date.now() - data.timestamp > STALE_THRESHOLD_MS) {
              localStorage.removeItem(key)
            }
          } catch {
            localStorage.removeItem(key)
          }
        }
      })
    } catch {
      // Ignore cleanup errors
    }
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

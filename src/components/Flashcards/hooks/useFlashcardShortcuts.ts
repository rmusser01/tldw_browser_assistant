import { useEffect, useCallback } from "react"

const RATING_MAP: Record<string, number> = {
  "1": 0, // Again
  "2": 2, // Hard
  "3": 3, // Good
  "4": 5 // Easy
}

interface FlashcardShortcutsOptions {
  /** Whether shortcuts are enabled */
  enabled?: boolean
  /** Whether the answer is currently shown */
  showingAnswer: boolean
  /** Callback to flip the card (show answer) */
  onFlip: () => void
  /** Callback to submit a rating (0=Again, 2=Hard, 3=Good, 5=Easy) */
  onRate: (rating: number) => void
}

/**
 * Hook for keyboard shortcuts in flashcard review.
 *
 * Shortcuts:
 * - Space: Flip card (show answer)
 * - 1: Rate Again (0)
 * - 2: Rate Hard (2)
 * - 3: Rate Good (3)
 * - 4: Rate Easy (5)
 */
export function useFlashcardShortcuts({
  enabled = true,
  showingAnswer,
  onFlip,
  onRate
}: FlashcardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return
      }

      // Space to flip
      if (e.key === " ") {
        e.preventDefault()
        if (!showingAnswer) {
          onFlip()
        }
        return
      }

      // Number keys for rating (only when answer is shown)
      if (showingAnswer) {
        if (e.key in RATING_MAP) {
          e.preventDefault()
          onRate(RATING_MAP[e.key])
        }
      }
    },
    [showingAnswer, onFlip, onRate]
  )

  useEffect(() => {
    if (!enabled) return

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [enabled, handleKeyDown])
}

export default useFlashcardShortcuts

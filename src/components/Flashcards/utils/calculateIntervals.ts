import type { Flashcard } from "@/services/flashcards"

export interface CalculatedIntervals {
  again: string
  hard: string
  good: string
  easy: string
}

/**
 * Calculate the next review intervals for each rating option based on SM-2 algorithm.
 * These are approximate values shown to users as preview before they rate a card.
 */
export function calculateIntervals(card: Flashcard): CalculatedIntervals {
  const { ef, interval_days, repetitions } = card

  // Rating 0 (Again): Reset to learning phase
  const again = "< 1 min"

  // Rating 2 (Hard): Reduce interval, minimum 1 day
  const hardDays = Math.max(1, Math.round(interval_days * 0.8))
  const hard = formatInterval(hardDays)

  // Rating 3 (Good): Normal SM-2 progression
  const goodDays =
    repetitions === 0 ? 1 : repetitions === 1 ? 6 : Math.round(interval_days * ef)
  const good = formatInterval(goodDays)

  // Rating 5 (Easy): Accelerated progression (1.3x multiplier)
  const easyDays = Math.round(goodDays * 1.3)
  const easy = formatInterval(easyDays)

  return { again, hard, good, easy }
}

/**
 * Format a number of days into a human-readable interval string.
 */
function formatInterval(days: number): string {
  if (days < 1) return "< 1 day"
  if (days === 1) return "1 day"
  if (days < 30) return `${days} days`
  if (days < 365) return `${Math.round(days / 30)} mo`
  return `${(days / 365).toFixed(1)} yr`
}

import { useState, useEffect, useCallback, useRef } from "react"

interface UseQuizTimerOptions {
  timeLimitSeconds: number | null | undefined
  startedAt: string | null | undefined
  onExpire?: () => void
  enabled?: boolean
}

interface TimerState {
  minutes: number
  seconds: number
  totalSeconds: number
  isWarning: boolean  // < 5 minutes
  isDanger: boolean   // < 1 minute
  isExpired: boolean
  formattedTime: string
}

const WARNING_THRESHOLD = 5 * 60  // 5 minutes in seconds
const DANGER_THRESHOLD = 60       // 1 minute in seconds

/**
 * Hook for managing a countdown timer during timed quizzes.
 * Updates every second and provides warning states.
 */
export function useQuizTimer({
  timeLimitSeconds,
  startedAt,
  onExpire,
  enabled = true
}: UseQuizTimerOptions): TimerState | null {
  const [timerState, setTimerState] = useState<TimerState | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasExpiredRef = useRef(false)

  const calculateRemainingTime = useCallback(() => {
    if (!timeLimitSeconds || !startedAt) return null

    const startTime = new Date(startedAt).getTime()
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    const remaining = Math.max(0, timeLimitSeconds - elapsed)

    return remaining
  }, [timeLimitSeconds, startedAt])

  const updateTimer = useCallback(() => {
    const remaining = calculateRemainingTime()

    if (remaining === null) {
      setTimerState(null)
      return
    }

    const minutes = Math.floor(remaining / 60)
    const seconds = remaining % 60
    const isExpired = remaining <= 0
    const isWarning = remaining <= WARNING_THRESHOLD && remaining > DANGER_THRESHOLD
    const isDanger = remaining <= DANGER_THRESHOLD && remaining > 0

    const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`

    setTimerState({
      minutes,
      seconds,
      totalSeconds: remaining,
      isWarning,
      isDanger,
      isExpired,
      formattedTime
    })

    // Trigger onExpire callback only once
    if (isExpired && !hasExpiredRef.current) {
      hasExpiredRef.current = true
      onExpire?.()
    }
  }, [calculateRemainingTime, onExpire])

  useEffect(() => {
    if (!enabled || !timeLimitSeconds || !startedAt) {
      setTimerState(null)
      return
    }

    // Reset expired flag when timer is re-enabled
    hasExpiredRef.current = false

    // Initial update
    updateTimer()

    // Set up interval to update every second
    intervalRef.current = setInterval(updateTimer, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, timeLimitSeconds, startedAt, updateTimer])

  return timerState
}

export default useQuizTimer

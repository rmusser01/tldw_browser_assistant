import React from "react"
import { Tooltip } from "antd"
import { Clock } from "lucide-react"

interface CronDisplayProps {
  expression: string | null | undefined
  showIcon?: boolean
}

/**
 * Simple cron expression to human-readable converter
 * Handles common patterns; falls back to raw expression for complex ones
 */
const cronToHuman = (expr: string): string => {
  if (!expr) return "No schedule"

  const parts = expr.trim().split(/\s+/)
  if (parts.length < 5) return expr

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  // Every minute
  if (minute === "*" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return "Every minute"
  }

  // Every X minutes
  if (minute.startsWith("*/") && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const interval = minute.slice(2)
    return `Every ${interval} minutes`
  }

  // Every hour at specific minute
  if (!minute.includes("*") && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `Every hour at :${minute.padStart(2, "0")}`
  }

  // Every X hours
  if (minute === "0" && hour.startsWith("*/") && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const interval = hour.slice(2)
    return `Every ${interval} hours`
  }

  // Daily at specific time
  if (!minute.includes("*") && !hour.includes("*") && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `Daily at ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
  }

  // Weekly on specific day
  if (!minute.includes("*") && !hour.includes("*") && dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
    const days: Record<string, string> = {
      "0": "Sunday",
      "1": "Monday",
      "2": "Tuesday",
      "3": "Wednesday",
      "4": "Thursday",
      "5": "Friday",
      "6": "Saturday",
      "7": "Sunday",
      SUN: "Sunday",
      MON: "Monday",
      TUE: "Tuesday",
      WED: "Wednesday",
      THU: "Thursday",
      FRI: "Friday",
      SAT: "Saturday"
    }
    const dayName = days[dayOfWeek.toUpperCase()] || dayOfWeek
    return `${dayName}s at ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
  }

  // Monthly on specific day
  if (!minute.includes("*") && !hour.includes("*") && !dayOfMonth.includes("*") && month === "*" && dayOfWeek === "*") {
    const suffix = getDaySuffix(parseInt(dayOfMonth, 10))
    return `${dayOfMonth}${suffix} of each month at ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`
  }

  // Fallback to raw expression
  return expr
}

const getDaySuffix = (day: number): string => {
  if (day >= 11 && day <= 13) return "th"
  switch (day % 10) {
    case 1:
      return "st"
    case 2:
      return "nd"
    case 3:
      return "rd"
    default:
      return "th"
  }
}

export const CronDisplay: React.FC<CronDisplayProps> = ({
  expression,
  showIcon = true
}) => {
  if (!expression) {
    return (
      <span className="text-zinc-400 text-sm italic">
        No schedule
      </span>
    )
  }

  const humanReadable = cronToHuman(expression)
  const showTooltip = humanReadable !== expression

  const content = (
    <span className="flex items-center gap-1.5 text-sm">
      {showIcon && <Clock className="h-3.5 w-3.5 text-zinc-400" />}
      <span>{humanReadable}</span>
    </span>
  )

  if (showTooltip) {
    return (
      <Tooltip title={`Cron: ${expression}`}>
        {content}
      </Tooltip>
    )
  }

  return content
}

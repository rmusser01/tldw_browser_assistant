import type { TFunction } from "i18next"

export const formatRelativeTime = (
  isoString: string,
  t: TFunction
): string => {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) {
    return t("relativeTime.justNow", "Just now")
  }

  if (diffMins < 60) {
    const defaultLabel = `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`
    return t("relativeTime.minutesAgo", {
      count: diffMins,
      defaultValue: defaultLabel
    })
  }

  if (diffHours < 24) {
    const defaultLabel = `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`
    return t("relativeTime.hoursAgo", {
      count: diffHours,
      defaultValue: defaultLabel
    })
  }

  if (diffDays < 7) {
    const defaultLabel = `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`
    return t("relativeTime.daysAgo", {
      count: diffDays,
      defaultValue: defaultLabel
    })
  }

  return date.toLocaleDateString()
}


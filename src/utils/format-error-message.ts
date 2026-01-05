const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const formatLoc = (loc: unknown): string => {
  if (Array.isArray(loc)) {
    const parts = loc.map((item) => String(item)).filter(Boolean)
    return parts.join(".")
  }
  if (typeof loc === "string" || typeof loc === "number") {
    return String(loc)
  }
  return ""
}

const formatErrorMessageInternal = (
  error: unknown,
  fallback: string,
  depth: number
): string => {
  if (typeof error === "string") {
    const trimmed = error.trim()
    return trimmed ? error : fallback
  }
  if (error instanceof Error) return error.message || fallback
  if (error == null) return fallback
  if (depth > 3) return safeStringify(error) || fallback

  if (Array.isArray(error)) {
    const parts = error
      .map((item) => formatErrorMessageInternal(item, "", depth + 1))
      .map((item) => item.trim())
      .filter(Boolean)
    if (parts.length > 0) return parts.join("; ")
    return safeStringify(error) || fallback
  }

  if (isRecord(error)) {
    const msgValue = error.msg
    if (typeof msgValue !== "undefined") {
      const msg = formatErrorMessageInternal(msgValue, fallback, depth + 1)
      const loc = formatLoc(error.loc)
      if (msg) return loc ? `${msg} (${loc})` : msg
    }

    const detailValue =
      error.detail ?? error.error ?? error.message ?? error.errors
    if (typeof detailValue !== "undefined") {
      const msg = formatErrorMessageInternal(detailValue, fallback, depth + 1)
      if (msg) return msg
    }

    return safeStringify(error) || fallback
  }

  return String(error)
}

export const formatErrorMessage = (
  error: unknown,
  fallback = "Request failed"
): string => formatErrorMessageInternal(error, fallback, 0)

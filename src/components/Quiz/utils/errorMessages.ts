import type { TFunction } from "i18next"

export type ErrorKind = "auth" | "network" | "server" | "validation" | "unknown"

export interface CategorizedError {
  kind: ErrorKind
  message: string
  canRetry: boolean
}

/**
 * Categorizes an error and returns a user-friendly message
 */
export function categorizeError(
  error: unknown,
  t: TFunction,
  context?: string
): CategorizedError {
  // Check if it's an axios-like error with response
  const axiosError = error as {
    response?: { status?: number; data?: { detail?: string; message?: string } }
    message?: string
    code?: string
  }

  const status = axiosError?.response?.status
  const serverMessage = axiosError?.response?.data?.detail || axiosError?.response?.data?.message

  // Network errors
  if (axiosError?.code === "ERR_NETWORK" || axiosError?.message?.includes("Network Error")) {
    return {
      kind: "network",
      message: t("option:quiz.errors.network", {
        defaultValue: "Connection lost. Please check your internet connection and try again."
      }),
      canRetry: true
    }
  }

  // Auth errors
  if (status === 401 || status === 403) {
    return {
      kind: "auth",
      message: t("option:quiz.errors.auth", {
        defaultValue: "Your session has expired. Please log in again."
      }),
      canRetry: false
    }
  }

  // Validation errors (400)
  if (status === 400) {
    return {
      kind: "validation",
      message: serverMessage || t("option:quiz.errors.validation", {
        defaultValue: "Invalid data submitted. Please check your input and try again."
      }),
      canRetry: false
    }
  }

  // Not found (404)
  if (status === 404) {
    return {
      kind: "unknown",
      message: t("option:quiz.errors.notFound", {
        defaultValue: "The requested item was not found. It may have been deleted."
      }),
      canRetry: false
    }
  }

  // Conflict (409) - version mismatch
  if (status === 409) {
    return {
      kind: "validation",
      message: t("option:quiz.errors.conflict", {
        defaultValue: "This item was modified by someone else. Please refresh and try again."
      }),
      canRetry: true
    }
  }

  // Server errors (5xx)
  if (status && status >= 500) {
    return {
      kind: "server",
      message: t("option:quiz.errors.server", {
        defaultValue: "Server error. Please try again later."
      }),
      canRetry: true
    }
  }

  // Generic fallback
  const contextMessage = context
    ? t(`option:quiz.errors.${context}`, { defaultValue: `Failed to ${context}` })
    : t("option:quiz.errors.unknown", { defaultValue: "An unexpected error occurred" })

  return {
    kind: "unknown",
    message: contextMessage,
    canRetry: true
  }
}

/**
 * Helper to show error with retry option
 */
export function getErrorWithRetry(
  categorized: CategorizedError,
  t: TFunction
): { message: string; description?: string } {
  if (categorized.canRetry) {
    return {
      message: categorized.message,
      description: t("option:quiz.errors.tryAgain", { defaultValue: "Please try again." })
    }
  }
  return { message: categorized.message }
}

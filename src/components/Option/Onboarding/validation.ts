import type { TFunction } from "i18next"
import { tldwAuth } from "@/services/tldw/TldwAuth"
import { mapMultiUserLoginErrorMessage } from "@/services/auth-errors"

export type ConnectionErrorKind =
  | "dns_failed"
  | "refused"
  | "timeout"
  | "ssl_error"
  | "auth_invalid"
  | "server_error"
  | null

export type ValidationResult = {
  success: boolean
  error?: string
  errorKind?: ConnectionErrorKind
}

const extractStatusAndMessage = (
  error: unknown
): { status: number | null; message: string | null } => {
  let status: number | null = null
  let message: string | null = null

  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === "string") {
    message = error
  }

  if (typeof error === "object" && error !== null) {
    const errObj = error as {
      status?: unknown
      statusCode?: unknown
      response?: { status?: unknown }
      message?: unknown
    }

    if (message === null && typeof errObj.message === "string") {
      message = errObj.message
    }

    const responseStatus =
      typeof errObj.response?.status === "number"
        ? errObj.response.status
        : null
    const directStatus =
      typeof errObj.status === "number"
        ? errObj.status
        : typeof errObj.statusCode === "number"
          ? errObj.statusCode
          : null

    status = responseStatus ?? directStatus ?? null
  }

  return { status, message }
}

export const categorizeConnectionError = (
  status: number | null,
  error: string | null
): ConnectionErrorKind => {
  if (status === 401 || status === 403) return "auth_invalid"
  if (status && status >= 500) return "server_error"
  if (error?.includes("timeout")) return "timeout"
  if (error?.includes("ENOTFOUND") || error?.includes("getaddrinfo"))
    return "dns_failed"
  if (error?.includes("ECONNREFUSED")) return "refused"
  if (error?.includes("SSL") || error?.includes("certificate"))
    return "ssl_error"
  if (!status && error) return "refused"
  return null
}

export const validateMultiUserAuth = async (
  username: string,
  password: string,
  t: TFunction
): Promise<ValidationResult> => {
  try {
    await tldwAuth.login({ username, password })
    return { success: true }
  } catch (error: unknown) {
    const friendly = mapMultiUserLoginErrorMessage(t, error, "onboarding")
    const { status, message } = extractStatusAndMessage(error)
    const errorKind =
      categorizeConnectionError(status, message) ?? "auth_invalid"

    return {
      success: false,
      errorKind,
      error: friendly
    }
  }
}

export const validateApiKey = async (
  serverUrl: string,
  apiKey: string,
  t: TFunction
): Promise<ValidationResult> => {
  try {
    const isValid = await tldwAuth.testApiKey(serverUrl, apiKey)
    if (!isValid) {
      return {
        success: false,
        errorKind: "auth_invalid",
        error: t(
          "settings:onboarding.errors.invalidApiKey",
          "Invalid API key. Please check your key and try again."
        )
      }
    }
    return { success: true }
  } catch (error: unknown) {
    const { status, message } = extractStatusAndMessage(error)
    const errorMessage =
      message ??
      t(
        "settings:onboarding.errors.apiKeyValidationFailed",
        "API key validation failed"
      )
    const errorKind =
      categorizeConnectionError(status, message) ?? "auth_invalid"

    return {
      success: false,
      errorKind,
      error: errorMessage
    }
  }
}

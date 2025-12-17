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
    return {
      success: false,
      errorKind: "auth_invalid",
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
    return {
      success: false,
      errorKind: "auth_invalid",
      error:
        (error as Error)?.message ||
        t(
          "settings:onboarding.errors.apiKeyValidationFailed",
          "API key validation failed"
        )
    }
  }
}


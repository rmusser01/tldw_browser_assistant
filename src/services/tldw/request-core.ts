import { formatErrorMessage } from "@/utils/format-error-message"
import { isPlaceholderApiKey } from "@/utils/api-key"
import type { PathOrUrl } from "@/services/tldw/openapi-guard"
import type { ApiSendResponse } from "@/services/api-send"

export type TldwRequestPayload = {
  path: PathOrUrl
  method?: string
  headers?: Record<string, string>
  body?: any
  noAuth?: boolean
  timeoutMs?: number
  abortSignal?: AbortSignal
}

type TldwConfigLike = Record<string, any> | null | undefined

type TldwRequestRuntime = {
  getConfig: () => Promise<TldwConfigLike>
  refreshAuth?: () => Promise<void>
  fetchFn?: typeof fetch
}

export const deriveRequestTimeout = (
  cfg: TldwConfigLike,
  path: PathOrUrl,
  override?: number
): number => {
  if (override && override > 0) return override
  const p = String(path || "")
  if (p.includes("/api/v1/chat/completions")) {
    return Number(cfg?.chatRequestTimeoutMs) > 0
      ? Number(cfg.chatRequestTimeoutMs)
      : Number(cfg?.requestTimeoutMs) > 0
        ? Number(cfg.requestTimeoutMs)
        : 10000
  }
  if (p.includes("/api/v1/rag/")) {
    return Number(cfg?.ragRequestTimeoutMs) > 0
      ? Number(cfg.ragRequestTimeoutMs)
      : Number(cfg?.requestTimeoutMs) > 0
        ? Number(cfg.requestTimeoutMs)
        : 10000
  }
  if (p.includes("/api/v1/media/")) {
    return Number(cfg?.mediaRequestTimeoutMs) > 0
      ? Number(cfg.mediaRequestTimeoutMs)
      : Number(cfg?.requestTimeoutMs) > 0
        ? Number(cfg.requestTimeoutMs)
        : 10000
  }
  return Number(cfg?.requestTimeoutMs) > 0
    ? Number(cfg.requestTimeoutMs)
    : 10000
}

export const parseRetryAfter = (headerValue?: string | null): number | null => {
  if (!headerValue) return null
  const asNumber = Number(headerValue)
  if (!Number.isNaN(asNumber)) {
    return Math.max(0, asNumber * 1000)
  }
  const asDate = Date.parse(headerValue)
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now())
  }
  return null
}

export const tldwRequest = async (
  payload: TldwRequestPayload,
  runtime: TldwRequestRuntime
): Promise<ApiSendResponse> => {
  const {
    path,
    method = "GET",
    headers = {},
    body,
    noAuth = false,
    timeoutMs: overrideTimeoutMs,
    abortSignal
  } = payload || {}
  const fetchFn = runtime.fetchFn || fetch
  const cfg = await runtime.getConfig()
  const isAbsolute = typeof path === "string" && /^https?:/i.test(path)
  if (!cfg?.serverUrl && !isAbsolute) {
    return { ok: false, status: 400, error: "tldw server not configured" }
  }
  if (!path) {
    return { ok: false, status: 400, error: "Request path is required" }
  }
  const baseUrl = cfg?.serverUrl ? String(cfg.serverUrl).replace(/\/$/, "") : ""
  const url = isAbsolute ? path : `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`
  const h: Record<string, string> = { ...(headers || {}) }
  const hasContentType = Object.keys(h).some(
    (key) => key.toLowerCase() === "content-type"
  )
  const isBinaryBody = (value: any) => {
    if (!value || typeof value !== "object") return false
    if (typeof FormData !== "undefined" && value instanceof FormData) return true
    if (typeof Blob !== "undefined" && value instanceof Blob) return true
    if (
      typeof URLSearchParams !== "undefined" &&
      value instanceof URLSearchParams
    ) {
      return true
    }
    if (typeof ArrayBuffer !== "undefined") {
      if (value instanceof ArrayBuffer) return true
      if (ArrayBuffer.isView?.(value)) return true
    }
    return false
  }
  if (body != null && !hasContentType && typeof body !== "string" && !isBinaryBody(body)) {
    h["Content-Type"] = "application/json"
  }
  if (!noAuth) {
    for (const k of Object.keys(h)) {
      const kl = k.toLowerCase()
      if (kl === "x-api-key" || kl === "authorization") delete h[k]
    }
    if (cfg?.authMode === "single-user") {
      const key = (cfg?.apiKey || "").trim()
      if (!key) {
        return {
          ok: false,
          status: 401,
          error:
            "Add or update your API key in Settings -> tldw server, then try again."
        }
      }
      if (isPlaceholderApiKey(key)) {
        return {
          ok: false,
          status: 401,
          error:
            "tldw server API key is still set to the default demo value. Replace it with your real API key in Settings -> tldw server before continuing."
        }
      }
      h["X-API-KEY"] = key
    } else if (cfg?.authMode === "multi-user") {
      const token = (cfg?.accessToken || "").trim()
      if (token) h["Authorization"] = `Bearer ${token}`
      else {
        return {
          ok: false,
          status: 401,
          error: "Not authenticated. Please login under Settings > tldw."
        }
      }
    }
  }

  const controller = new AbortController()
  const timeoutMs = deriveRequestTimeout(cfg, path, Number(overrideTimeoutMs))
  const onAbort = () => {
    try {
      controller.abort()
    } catch {}
  }
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let retryTimeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    if (abortSignal) {
      if (abortSignal.aborted) {
        controller.abort()
      } else {
        abortSignal.addEventListener("abort", onAbort, { once: true })
      }
    }

    let resp = await fetchFn(url, {
      method,
      headers: h,
      body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal
    })
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    if (resp.status === 401 && cfg?.authMode === "multi-user" && cfg?.refreshToken && runtime.refreshAuth) {
      try {
        await runtime.refreshAuth()
      } catch {}
      const updated = await runtime.getConfig()
      const retryHeaders = { ...h }
      for (const k of Object.keys(retryHeaders)) {
        const kl = k.toLowerCase()
        if (kl === "authorization" || kl === "x-api-key") delete retryHeaders[k]
      }
      if (updated?.accessToken) retryHeaders["Authorization"] = `Bearer ${updated.accessToken}`
      const retryController = new AbortController()
      retryTimeoutId = setTimeout(() => retryController.abort(), timeoutMs)
      resp = await fetchFn(url, {
        method,
        headers: retryHeaders,
        body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
        signal: retryController.signal
      })
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId)
        retryTimeoutId = null
      }
    }

    const headersOut: Record<string, string> = {}
    try {
      resp.headers.forEach((value, key) => {
        headersOut[key] = value
      })
    } catch {}

    const retryAfterMs = parseRetryAfter(resp.headers?.get?.("retry-after"))
    const contentType = resp.headers.get("content-type") || ""
    let data: any = null
    if (contentType.includes("application/json")) {
      data = await resp.json().catch(() => null)
    } else {
      data = await resp.text().catch(() => null)
    }

    if (!resp.ok) {
      const detail =
        typeof data === "object" &&
        data &&
        (data.detail || data.error || data.message)
      const errorMessage = formatErrorMessage(
        typeof detail !== "undefined" && detail !== null
          ? detail
          : resp.statusText || `HTTP ${resp.status}`,
        `HTTP ${resp.status}`
      )
      return {
        ok: false,
        status: resp.status,
        error: errorMessage,
        data,
        headers: headersOut,
        retryAfterMs
      }
    }

    return { ok: true, status: resp.status, data, headers: headersOut, retryAfterMs }
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      error: formatErrorMessage(e, "Network error")
    }
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    if (retryTimeoutId) {
      clearTimeout(retryTimeoutId)
    }
    if (abortSignal) {
      try {
        abortSignal.removeEventListener("abort", onAbort)
      } catch {}
    }
  }
}

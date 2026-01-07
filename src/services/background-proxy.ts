import { browser } from "wxt/browser"
import { Storage } from "@plasmohq/storage"
import { createSafeStorage } from "@/utils/safe-storage"
import { formatErrorMessage } from "@/utils/format-error-message"
import { tldwRequest } from "@/services/tldw/request-core"
import type {
  AllowedMethodFor,
  AllowedPath,
  ClientPathOrUrlWithQuery,
  ClientPathRuntimeWithQuery,
  PathOrUrl,
  UpperLower
} from "@/services/tldw/openapi-guard"

const ERROR_LOG_THROTTLE_MS = 15_000
const RATE_LIMIT_LOG_THROTTLE_MS = 60_000
const ERROR_LOG_MAX_ENTRIES = 200
const errorLogHistory = new Map<string, number>()

const isRateLimitEntry = (entry: { status?: number; error?: string }): boolean => {
  if (entry.status === 429) return true
  const msg = String(entry.error || "").toLowerCase()
  return msg.includes("rate limit") || msg.includes("429")
}

const shouldRecordRequestError = (entry: {
  method: string
  path: string
  status?: number
  error?: string
  source: "background" | "direct"
}): boolean => {
  const now = Date.now()
  const key = `${entry.source}:${entry.method}:${entry.path}:${entry.status ?? "na"}:${entry.error ?? ""}`
  const lastAt = errorLogHistory.get(key)
  const throttleMs = isRateLimitEntry(entry)
    ? RATE_LIMIT_LOG_THROTTLE_MS
    : ERROR_LOG_THROTTLE_MS
  if (lastAt && now - lastAt < throttleMs) return false
  errorLogHistory.set(key, now)
  if (errorLogHistory.size > ERROR_LOG_MAX_ENTRIES) {
    const sorted = Array.from(errorLogHistory.entries()).sort((a, b) => a[1] - b[1])
    const overflow = sorted.length - ERROR_LOG_MAX_ENTRIES
    for (let i = 0; i < overflow; i++) {
      errorLogHistory.delete(sorted[i][0])
    }
  }
  return true
}

export interface BgRequestInit<
  P extends PathOrUrl = AllowedPath,
  M extends AllowedMethodFor<P> = AllowedMethodFor<P>
> {
  path: P
  method?: UpperLower<M>
  headers?: Record<string, string>
  body?: any
  noAuth?: boolean
  timeoutMs?: number
  abortSignal?: AbortSignal
}

export async function bgRequest<
  T = any,
  P extends PathOrUrl = AllowedPath,
  M extends AllowedMethodFor<P> = AllowedMethodFor<P>
>(
  { path, method = 'GET' as UpperLower<M>, headers = {}, body, noAuth = false, timeoutMs, abortSignal }: BgRequestInit<P, M>
): Promise<T> {
  const recordRequestError = async (entry: {
    method: string
    path: string
    status?: number
    error?: string
    source: "background" | "direct"
  }) => {
    try {
      if (!shouldRecordRequestError(entry)) return
      const storage = createSafeStorage({ area: "local" })
      const at = new Date().toISOString()
      const payload = { ...entry, at }
      const existing = (await storage.get<any[]>("__tldwRequestErrors").catch(() => [])) || []
      const next = Array.isArray(existing) ? existing : []
      next.unshift(payload)
      if (next.length > 20) next.length = 20
      await storage.set("__tldwRequestErrors", next)
      await storage.set("__tldwLastRequestError", payload)
    } catch {
      // best-effort logging only
    }
  }
  const isAbortErrorMessage = (value?: string) =>
    typeof value === "string" && value.toLowerCase().includes("abort")

  // If extension messaging is available, use it (extension context)
  try {
    // @ts-ignore
    if (browser?.runtime?.sendMessage) {
      const payload = {
        type: 'tldw:request',
        payload: { path, method, headers, body, noAuth, timeoutMs }
      }

      if (!abortSignal) {
        const resp = await browser.runtime.sendMessage(payload) as { ok: boolean; error?: string; status?: number; data: T } | undefined
        if (!resp?.ok) {
          const msg = formatErrorMessage(
            resp?.error,
            `Request failed: ${resp?.status}`
          )
          if (!isAbortErrorMessage(msg)) {
            console.warn("[tldw:request]", method, path, resp?.status, msg)
            await recordRequestError({
              method: String(method),
              path: String(path),
              status: resp?.status,
              error: msg,
              source: "background"
            })
          }
          const error = new Error(`${msg} (${method} ${path})`) as Error & {
            status?: number
          }
          error.status = resp?.status
          throw error
        }
        return resp.data as T
      }

      if (abortSignal.aborted) {
        throw new Error('Aborted')
      }

      const messagePromise = browser.runtime.sendMessage(payload) as Promise<
        { ok: boolean; error?: string; status?: number; data: T } | undefined
      >

      const resp = await new Promise<
        { ok: boolean; error?: string; status?: number; data: T } | undefined
      >((resolve, reject) => {
        const onAbort = () => {
          reject(new Error('Aborted'))
        }
        abortSignal.addEventListener('abort', onAbort, { once: true })
        messagePromise
          .then((r) => {
            abortSignal.removeEventListener('abort', onAbort)
            resolve(r)
          })
          .catch((e) => {
            abortSignal.removeEventListener('abort', onAbort)
            reject(e)
          })
      })

      if (!resp?.ok) {
        const msg = formatErrorMessage(
          resp?.error,
          `Request failed: ${resp?.status}`
        )
        if (!isAbortErrorMessage(msg)) {
          console.warn("[tldw:request]", method, path, resp?.status, msg)
          await recordRequestError({
            method: String(method),
            path: String(path),
            status: resp?.status,
            error: msg,
            source: "background"
          })
        }
        const error = new Error(`${msg} (${method} ${path})`) as Error & {
          status?: number
        }
        error.status = resp?.status
        throw error
      }
      return resp.data as T
    }
  } catch (e) {
    // fallthrough to direct fetch
  }

  // Fallback: direct fetch (web/dev context)
  const storage = createSafeStorage()
  const resp = await tldwRequest(
    { path, method, headers, body, noAuth, timeoutMs, abortSignal },
    { getConfig: () => storage.get("tldwConfig").catch(() => null) }
  )
  if (!resp?.ok) {
    const msg = formatErrorMessage(
      resp?.error,
      `Request failed: ${resp?.status}`
    )
    if (!isAbortErrorMessage(msg)) {
      console.warn("[tldw:request]", method, path, resp?.status, msg)
      await recordRequestError({
        method: String(method),
        path: String(path),
        status: resp?.status,
        error: msg,
        source: "direct"
      })
    }
    const error = new Error(`${msg} (${method} ${path})`) as Error & {
      status?: number
    }
    error.status = resp?.status
    throw error
  }
  return resp.data as T
}

export interface BgStreamInit<
  P extends AllowedPath = AllowedPath,
  M extends AllowedMethodFor<P> = AllowedMethodFor<P>
> {
  path: P
  method?: UpperLower<M>
  headers?: Record<string, string>
  body?: any
  streamIdleTimeoutMs?: number
  abortSignal?: AbortSignal
}

export async function* bgStream<
  P extends AllowedPath = AllowedPath,
  M extends AllowedMethodFor<P> = AllowedMethodFor<P>
>(
  { path, method = 'POST' as UpperLower<M>, headers = {}, body, streamIdleTimeoutMs, abortSignal }: BgStreamInit<P, M>
): AsyncGenerator<string> {
  const port = browser.runtime.connect({ name: 'tldw:stream' })
  const encoder = new TextEncoder()
  const queue: string[] = []
  let done = false
  let error: any = null

  const onMessage = (msg: any) => {
    if (msg?.event === 'data') {
      queue.push(msg.data as string)
    } else if (msg?.event === 'done') {
      done = true
    } else if (msg?.event === 'error') {
      error = new Error(msg.message || 'Stream error')
      done = true
    }
  }
  port.onMessage.addListener(onMessage)
  const onDisconnect = () => {
    if (!done) {
      if (!error) error = new Error('Stream disconnected')
      done = true
    }
  }
  port.onDisconnect.addListener(onDisconnect)
  const onAbort = () => {
    if (!error) error = new Error('Aborted')
    done = true
    try { port.disconnect() } catch {}
  }
  if (abortSignal) {
    if (abortSignal.aborted) onAbort()
    else abortSignal.addEventListener('abort', onAbort, { once: true })
  }
  if (!done) {
    try {
      port.postMessage({ path, method, headers, body, streamIdleTimeoutMs })
    } catch (e) {
      if (!error) error = e
      done = true
    }
  }

  try {
    while (!done || queue.length > 0) {
      if (queue.length > 0) {
        yield queue.shift() as string
      } else {
        await new Promise((r) => setTimeout(r, 10))
      }
    }
    if (error) throw error
  } finally {
    try { port.onMessage.removeListener(onMessage); } catch {}
    try { port.onDisconnect.removeListener(onDisconnect); } catch {}
    try { port.disconnect(); } catch {}
    if (abortSignal) {
      try { abortSignal.removeEventListener('abort', onAbort) } catch {}
    }
  }
}

export interface BgUploadInit<P extends AllowedPath = AllowedPath, M extends AllowedMethodFor<P> = AllowedMethodFor<P>> {
  path: P
  method?: UpperLower<M>
  // key/value fields to include alongside file in FormData
  fields?: Record<string, any>
  // File payload as raw bytes with metadata (ArrayBuffer is structured-cloneable)
  file?: { name?: string; type?: string; data: ArrayBuffer }
}

export async function bgUpload<T = any, P extends AllowedPath = AllowedPath, M extends AllowedMethodFor<P> = AllowedMethodFor<P>>(
  { path, method = 'POST' as UpperLower<M>, fields = {}, file }: BgUploadInit<P, M>
): Promise<T> {
  const resp = await browser.runtime.sendMessage({
    type: 'tldw:upload',
    payload: { path, method, fields, file }
  }) as { ok: boolean; error?: string; status?: number; data: T } | undefined
  if (!resp?.ok) {
    const msg = formatErrorMessage(
      resp?.error,
      `Upload failed: ${resp?.status}`
    )
    throw new Error(msg)
  }
  return resp.data as T
}

export async function bgRequestValidated<
  T = any,
  P extends PathOrUrl = AllowedPath,
  M extends AllowedMethodFor<P> = AllowedMethodFor<P>
>(
  init: BgRequestInit<P, M>,
  validate?: (data: unknown) => T
): Promise<T> {
  const data = await bgRequest<any, P, M>(init)
  return validate ? validate(data) : (data as T)
}

// Strict variants: enforce that call sites use ClientPath-derived strings by default.
export async function bgRequestClient<
  T = any,
  P extends ClientPathOrUrlWithQuery = ClientPathOrUrlWithQuery,
  M extends AllowedMethodFor<P> = AllowedMethodFor<P>
>(init: BgRequestInit<P, M>): Promise<T> {
  return bgRequest<T, P, M>(init)
}

export async function* bgStreamClient<
  P extends ClientPathRuntimeWithQuery = ClientPathRuntimeWithQuery,
  M extends AllowedMethodFor<P> = AllowedMethodFor<P>
>(init: BgStreamInit<P, M>): AsyncGenerator<string> {
  for await (const chunk of bgStream<P, M>(init)) {
    yield chunk
  }
}

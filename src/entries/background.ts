import { browser } from "wxt/browser"
import { createSafeStorage } from "@/utils/safe-storage"
import { formatErrorMessage } from "@/utils/format-error-message"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { tldwAuth } from "@/services/tldw/TldwAuth"
import { tldwModels } from "@/services/tldw"
import { apiSend } from "@/services/api-send"
import { tldwRequest } from "@/services/tldw/request-core"
import {
  getProcessPathForType,
  getProcessPathForUrl,
  inferMediaTypeFromUrl,
  inferUploadMediaTypeFromFile,
  normalizeMediaType
} from "@/services/tldw/media-routing"
import {
  ensureSidepanelOpen,
  pickFirstString,
  extractTranscriptionPieces,
  clampText,
  notify
} from "@/services/background-helpers"
import { ModelDb } from "@/db/models"
import { generateID } from "@/db"
import {
  initBackground,
  MODEL_WARM_ALARM_NAME
} from "@/entries/shared/background-init"

type BackgroundDiagnostics = {
  startedAt: number
  modelWarmCount: number
  lastModelWarmAt: number | null
  lastModelWarmError: string | null
  alarmFires: number
  lastAlarmAt: number | null
  ports: {
    stream: number
    stt: number
    copilot: number
  }
  lastStreamAt: number | null
  lastSttAt: number | null
  lastCopilotAt: number | null
}

const backgroundDiagnostics: BackgroundDiagnostics = {
  startedAt: Date.now(),
  modelWarmCount: 0,
  lastModelWarmAt: null,
  lastModelWarmError: null,
  alarmFires: 0,
  lastAlarmAt: null,
  ports: {
    stream: 0,
    stt: 0,
    copilot: 0
  },
  lastStreamAt: null,
  lastSttAt: null,
  lastCopilotAt: null
}

const logBackgroundError = (label: string, error: unknown) => {
  console.debug(`[tldw] background ${label} failed`, error)
}

const warmModels = async (
  force = false,
  throwOnError = false
): Promise<any[] | null> => {
  backgroundDiagnostics.modelWarmCount += 1
  backgroundDiagnostics.lastModelWarmAt = Date.now()
  backgroundDiagnostics.lastModelWarmError = null
  try {
    const models = await tldwModels.warmCache(Boolean(force))

    // Sync models to local database
    if (models && models.length > 0) {
      const db = new ModelDb()
      const existing = await db.getAll()
      const existingLookups = new Set(
        existing.map((m: any) => m?.lookup).filter(Boolean)
      )

      for (const model of models) {
        try {
          const lookup = `${model.id}_tldw_${model.provider}`
          if (existingLookups.has(lookup)) continue

          // Transform ModelInfo to Model format
          const dbModel = {
            id: `${model.id}_${generateID()}`,
            model_id: model.id,
            name: model.name,
            provider_id: `tldw_${model.provider}`,
            lookup,
            model_type: model.type || 'chat',
            db_type: 'openai_model'
          }

          await db.create(dbModel)
          existingLookups.add(lookup)
        } catch (err) {
          // Log but don't fail the entire sync if one model fails
          console.debug('[tldw] Failed to sync model to DB:', model.id, err)
        }
      }
    }

    return models
  } catch (e) {
    console.debug("[tldw] model warmup failed", e)
    backgroundDiagnostics.lastModelWarmError =
      (e as any)?.message || "model warmup failed"
    if (throwOnError) {
      throw e
    }
    return null
  }
}

export default defineBackground({
  main() {
    const storage = createSafeStorage()
    let isCopilotRunning: boolean = false
    let actionIconClick: string = "webui"
    let contextMenuClick: string = "sidePanel"
    const contextMenuId = {
      webui: "open-web-ui-pa",
      sidePanel: "open-side-panel-pa"
    }
    const transcribeMenuId = {
      transcribe: "transcribe-media-pa",
      transcribeAndSummarize: "transcribe-and-summarize-media-pa"
    }
    const saveToNotesMenuId = "save-to-notes-pa"
    const getActionApi = () => {
      const anyBrowser = browser as any
      const anyChrome = (globalThis as any).chrome
      return (
        anyBrowser?.action ||
        anyBrowser?.browserAction ||
        anyChrome?.action ||
        anyChrome?.browserAction
      )
    }

    const initialize = async () => {
      try {
        await initBackground({
          storage,
          contextMenuId,
          saveToNotesMenuId,
          transcribeMenuId,
          warmModels,
          capabilities: {
            sendToTldw: true,
            processLocal: true,
            transcribe: true,
            openApiCheck: true
          },
          onActionIconClickChange: (value) => {
            actionIconClick = value
          },
          onContextMenuClickChange: (value) => {
            contextMenuClick = value
          }
        })
      } catch (error) {
        console.error("Error in initLogic:", error)
      }
    }

    const buildBackgroundDiagnostics = () => {
      const memory = (globalThis as any)?.performance?.memory
      return {
        ...backgroundDiagnostics,
        chatQueueDepth: chatQueue.length,
        chatActiveCount,
        chatBackoffMs,
        chatBackoffUntil,
        memory:
          memory && typeof memory.usedJSHeapSize === "number"
            ? {
                usedJSHeapSize: memory.usedJSHeapSize,
                totalJSHeapSize: memory.totalJSHeapSize,
                jsHeapSizeLimit: memory.jsHeapSizeLimit
              }
            : null
      }
    }


    let refreshInFlight: Promise<any> | null = null
    let streamDebugEnabled = false

    const handleTranscribeClick = async (
      info: any,
      tab: any,
      mode: 'transcribe' | 'transcribe+summary'
    ) => {
      const pageUrl = info.pageUrl || (tab && tab.url) || ''
      const targetUrl = (info.linkUrl && /^https?:/i.test(info.linkUrl)) ? info.linkUrl : pageUrl
      if (!targetUrl) {
        notify('tldw_server', 'No URL found to transcribe.')
        return
      }
      const path = getProcessPathForUrl(targetUrl)
      if (path !== '/api/v1/media/process-audios' && path !== '/api/v1/media/process-videos') {
        notify('tldw_server', 'Transcription is available for audio or video URLs only.')
        return
      }

      try {
        const resp = await apiSend({
          path,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {
            urls: [targetUrl],
            perform_analysis: mode === 'transcribe+summary',
            perform_chunking: false,
            summarize_recursively: mode === 'transcribe+summary',
            timestamp_option: true
          },
          timeoutMs: 180000
        })
        if (!resp?.ok) {
          notify('tldw_server', resp?.error || 'Transcription failed. Check your connection and server config.')
          return
        }
        const { transcript, summary } = extractTranscriptionPieces(resp.data)
        const safeTranscript = clampText(transcript)
        const safeSummary = clampText(summary)
        const label = mode === 'transcribe+summary' ? 'Transcription + summary' : 'Transcription'
        const bodyParts = []
        if (safeTranscript) bodyParts.push(`Transcript:\n${safeTranscript}`)
        if (safeSummary) bodyParts.push(`Summary:\n${safeSummary}`)
        const combinedText = bodyParts.join('\n\n') || 'Request completed. Open Media or the sidebar to view results.'

        ensureSidepanelOpen(tab?.id)
        try {
          await browser.runtime.sendMessage({
            from: 'background',
            type: mode === 'transcribe+summary' ? 'transcription+summary' : 'transcription',
            text: combinedText,
            payload: {
              url: targetUrl,
              transcript: safeTranscript,
              summary: safeSummary,
              mode
            }
          })
        } catch (error) {
          logBackgroundError("send transcription result", error)
          setTimeout(() => {
            try {
              browser.runtime.sendMessage({
                from: 'background',
                type: mode === 'transcribe+summary' ? 'transcription+summary' : 'transcription',
                text: combinedText,
                payload: {
                  url: targetUrl,
                  transcript: safeTranscript,
                  summary: safeSummary,
                  mode
                }
              })
            } catch (fallbackError) {
              logBackgroundError("send transcription result (retry)", fallbackError)
            }
          }, 500)
        }
        notify('tldw_server', `${label} sent to sidebar. You can also review it under Media in the Web UI.`)
      } catch (e: any) {
        notify('tldw_server', e?.message || 'Transcription request failed.')
      }
    }

    const deriveStreamIdleTimeout = (cfg: any, path: string, override?: number) => {
      if (override && override > 0) return override
      const p = String(path || '')
      const defaultIdle = 45000 // bump default idle timeout to 45s to tolerate slow providers
      if (p.includes('/api/v1/chat/completions')) {
        return Number(cfg?.chatStreamIdleTimeoutMs) > 0
          ? Number(cfg.chatStreamIdleTimeoutMs)
          : (Number(cfg?.streamIdleTimeoutMs) > 0 ? Number(cfg.streamIdleTimeoutMs) : defaultIdle)
      }
      return Number(cfg?.streamIdleTimeoutMs) > 0 ? Number(cfg.streamIdleTimeoutMs) : defaultIdle
    }

    const CHAT_QUEUE_CONCURRENCY = 2
    const CHAT_BACKOFF_BASE_MS = 1000
    const CHAT_BACKOFF_MAX_MS = 30_000
    let chatBackoffUntil = 0
    let chatBackoffMs = CHAT_BACKOFF_BASE_MS
    let chatQueueTimer: ReturnType<typeof setTimeout> | null = null
    let chatActiveCount = 0
    const chatQueue: Array<{
      run: () => Promise<any>
      resolve: (value: any) => void
      reject: (reason?: any) => void
    }> = []

    const isChatEndpoint = (path: string): boolean => {
      const raw = String(path || "")
      let pathname = raw
      if (/^https?:/i.test(raw)) {
        try {
          pathname = new URL(raw).pathname
        } catch (error) {
          logBackgroundError("parse chat endpoint url", error)
          pathname = raw
        }
      }
      const normalized = pathname.toLowerCase()
      return (
        normalized.startsWith("/api/v1/chat/") ||
        normalized.startsWith("/api/v1/chats/")
      )
    }

    const updateChatBackoff = (resp: any) => {
      if (!resp || typeof resp.status !== "number") return
      if (resp.status === 429) {
        const retryDelay =
          typeof resp.retryAfterMs === "number" && resp.retryAfterMs > 0
            ? resp.retryAfterMs
            : chatBackoffMs
        chatBackoffUntil = Math.max(chatBackoffUntil, Date.now() + retryDelay)
        chatBackoffMs = Math.min(chatBackoffMs * 2, CHAT_BACKOFF_MAX_MS)
        return
      }
      if (resp.ok) {
        chatBackoffUntil = 0
        chatBackoffMs = CHAT_BACKOFF_BASE_MS
      }
    }

    const scheduleChatDrain = () => {
      if (chatQueueTimer) return
      const delay = Math.max(0, chatBackoffUntil - Date.now())
      chatQueueTimer = setTimeout(() => {
        chatQueueTimer = null
        drainChatQueue()
      }, delay)
    }

    const drainChatQueue = () => {
      if (chatActiveCount >= CHAT_QUEUE_CONCURRENCY) return
      if (chatQueue.length === 0) return
      const now = Date.now()
      if (chatBackoffUntil > now) {
        scheduleChatDrain()
        return
      }
      const task = chatQueue.shift()
      if (!task) return
      chatActiveCount += 1
      task
        .run()
        .then((resp) => {
          chatActiveCount -= 1
          updateChatBackoff(resp)
          task.resolve(resp)
          drainChatQueue()
        })
        .catch((err) => {
          chatActiveCount -= 1
          task.reject(err)
          drainChatQueue()
        })
    }

    const enqueueChatRequest = <T,>(run: () => Promise<T>): Promise<T> =>
      new Promise((resolve, reject) => {
        chatQueue.push({ run, resolve, reject })
        drainChatQueue()
      })

    const normalizeFileData = (input: any): Uint8Array | null => {
      if (!input) return null
      if (input instanceof ArrayBuffer) return new Uint8Array(input)
      if (typeof SharedArrayBuffer !== "undefined" && input instanceof SharedArrayBuffer) {
        return new Uint8Array(input)
      }
      if (ArrayBuffer.isView(input)) {
        return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
      }
      if (
        typeof input === "object" &&
        input !== null &&
        typeof (input as { byteLength?: number }).byteLength === "number" &&
        typeof (input as { slice?: unknown }).slice === "function" &&
        (input instanceof ArrayBuffer ||
          Object.prototype.toString.call(input) === "[object ArrayBuffer]" ||
          ArrayBuffer.isView(input))
      ) {
        try {
          return new Uint8Array(input as ArrayBuffer)
        } catch (error) {
          logBackgroundError("normalize arraybuffer-like input", error)
          return null
        }
      }
      // Accept common structured-clone shapes (e.g., { data: [...] })
      if (Array.isArray((input as any)?.data)) return new Uint8Array((input as any).data)
      if (Array.isArray(input)) return new Uint8Array(input)
      if (typeof input === 'string' && input.startsWith('data:')) {
        try {
          const base64 = input.split(',', 2)[1] || ''
          const binary = atob(base64)
          const out = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
          return out
        } catch (error) {
          logBackgroundError("decode file data url", error)
          return null
        }
      }
      return null
    }

    const handleUpload = async (payload: {
      path?: string
      method?: string
      fields?: Record<string, any>
      file?: { name?: string; type?: string; data?: ArrayBuffer | Uint8Array | { data?: number[] } | number[] | string }
      fileFieldName?: string
    }) => {
      const { path, method = 'POST', fields = {}, file, fileFieldName } = payload || {}
      const cfg = await storage.get<any>('tldwConfig')
      const isAbsolute = typeof path === 'string' && /^https?:/i.test(path)
      if (!cfg?.serverUrl && !isAbsolute) {
        return { ok: false, status: 400, error: 'tldw server not configured' }
      }
      const baseUrl = cfg?.serverUrl ? String(cfg.serverUrl).replace(/\/$/, '') : ''
      const url = isAbsolute ? path : `${baseUrl}${path?.startsWith('/') ? '' : '/'}${path}`
      try {
        const form = new FormData()
        for (const [k, v] of Object.entries(fields || {})) {
          // Preserve arrays (e.g., urls) instead of stringifying them into JSON blobs
          if (Array.isArray(v)) {
            v.forEach((item) => form.append(k, typeof item === 'string' ? item : JSON.stringify(item)))
          } else {
            form.append(k, typeof v === 'string' ? v : JSON.stringify(v))
          }
        }
        if (file?.data !== undefined && file?.data !== null) {
          const bytes = normalizeFileData(file.data)
          if (!bytes || bytes.byteLength === 0) {
            return { ok: false, status: 400, error: 'File data missing or unreadable. Please re-select the file and try again.' }
          }
          const blob = new Blob([bytes], {
            type: file.type || 'application/octet-stream'
          })
          const filename = file.name || 'file'
          const trimmedFieldName =
            typeof fileFieldName === 'string' ? fileFieldName.trim() : ''
          if (trimmedFieldName) {
            form.append(trimmedFieldName, blob, filename)
          } else {
            try {
              const fileCtor =
                typeof File === "function" ? File : null
              if (fileCtor) {
                form.append('files', new fileCtor([blob], filename, { type: blob.type }))
              } else {
                form.append('files', blob, filename)
              }
            } catch (error) {
              logBackgroundError("append upload file", error)
              form.append('files', blob, filename)
            }
            // Backward-compat: also include singular key some servers accept
            form.append('file', blob, filename)
          }
        }
        const headers: Record<string, string> = {}
        if (cfg?.authMode === 'single-user') {
          const key = (cfg?.apiKey || '').trim()
          if (!key) {
            return {
              ok: false,
              status: 401,
              error: 'Add or update your API key in Settings → tldw server, then try again.'
            }
          }
          headers['X-API-KEY'] = key
        }
        if (cfg?.authMode === 'multi-user') {
          const token = (cfg?.accessToken || '').trim()
          if (!token) return { ok: false, status: 401, error: 'Not authenticated. Please login under Settings > tldw.' }
          headers['Authorization'] = `Bearer ${token}`
        }
        const controller = new AbortController()
        const timeoutMs =
          Number(cfg?.uploadRequestTimeoutMs) > 0
            ? Number(cfg.uploadRequestTimeoutMs)
            : Number(cfg?.requestTimeoutMs) > 0
              ? Number(cfg.requestTimeoutMs)
              : 10000
        const timeout = setTimeout(() => controller.abort(), timeoutMs)
        const resp = await fetch(url, { method, headers, body: form, signal: controller.signal })
        clearTimeout(timeout)
        const contentType = resp.headers.get('content-type') || ''
        let data: any = null
        if (contentType.includes('application/json')) data = await resp.json().catch(() => null)
        else data = await resp.text().catch(() => null)
        const error = resp.ok
          ? undefined
          : formatErrorMessage(data, `Upload failed: ${resp.status}`)
        return { ok: resp.ok, status: resp.status, data, error }
      } catch (e: any) {
        return { ok: false, status: 0, error: e?.message || 'Upload failed' }
      }
    }

    const runTldwRequest = async (payload: any) =>
      tldwRequest(payload, {
        getConfig: () => storage.get<any>('tldwConfig'),
        refreshAuth: async () => {
          if (!refreshInFlight) {
            refreshInFlight = (async () => {
              try {
                await tldwAuth.refreshToken()
              } finally {
                refreshInFlight = null
              }
            })()
          }
          try {
            await refreshInFlight
          } catch (error) {
            logBackgroundError("refresh auth", error)
          }
        }
      })

    const handleTldwRequest = async (payload: any) => {
      const path = payload?.path
      if (isChatEndpoint(String(path || ""))) {
        return enqueueChatRequest(() => runTldwRequest(payload))
      }
      return runTldwRequest(payload)
    }

    browser.runtime.onMessage.addListener(async (message, sender) => {
      if (message.type === "tldw:diagnostics") {
        return { ok: true, data: buildBackgroundDiagnostics() }
      }
      if (message.type === 'tldw:debug') {
        streamDebugEnabled = Boolean(message?.enable)
        return { ok: true }
      }
      if (message.type === 'tldw:models:refresh') {
        try {
          const models = await warmModels(true, true)
          const count = Array.isArray(models) ? models.length : 0
          return { ok: true, count }
        } catch (e: any) {
          return { ok: false, error: e?.message || 'Model refresh failed' }
        }
      }
      if (message.type === 'tldw:get-tab-id') {
        const tabId = sender?.tab?.id ?? null
        return { ok: tabId != null, tabId }
      }
      if (message.type === 'tldw:quick-ingest-batch') {
        const payload = message.payload || {}
        const entries = Array.isArray(payload.entries) ? payload.entries : []
        const files = Array.isArray(payload.files) ? payload.files : []
        const storeRemote = Boolean(payload.storeRemote)
        const processOnly = Boolean(payload.processOnly)
        const common = payload.common || {}
        const advancedValues = payload.advancedValues && typeof payload.advancedValues === 'object'
          ? payload.advancedValues
          : {}
        const fileDefaults = payload.fileDefaults && typeof payload.fileDefaults === 'object'
          ? payload.fileDefaults
          : {}
        // processOnly=true forces local-only processing even if storeRemote was requested
        const shouldStoreRemote = storeRemote && !processOnly

        const totalCount = entries.length + files.length
        let processedCount = 0

        const assignPath = (obj: any, path: string[], val: any) => {
          let cur = obj
          for (let i = 0; i < path.length; i++) {
            const seg = path[i]
            if (i === path.length - 1) cur[seg] = val
            else cur = (cur[seg] = cur[seg] || {})
          }
        }

        const buildFields = (rawType: string, entry?: any, defaults?: any) => {
          const mediaType = normalizeMediaType(rawType)
          const fields: Record<string, any> = {
            media_type: mediaType,
            perform_analysis: Boolean(common.perform_analysis),
            perform_chunking: Boolean(common.perform_chunking),
            overwrite_existing: Boolean(common.overwrite_existing)
          }
          const resolvedDefaults: {
            audio?: { language?: string; diarize?: boolean }
            document?: { ocr?: boolean }
            video?: { captions?: boolean }
          } = (() => {
            if (!defaults || typeof defaults !== 'object') return {}
            if (mediaType === 'audio') return { audio: defaults.audio }
            if (mediaType === 'video') return { video: defaults.video }
            if (mediaType === 'document' || mediaType === 'pdf' || mediaType === 'ebook') {
              return { document: defaults.document }
            }
            return {}
          })()
          const nested: Record<string, any> = {}
          for (const [k, v] of Object.entries(advancedValues as Record<string, any>)) {
            if (k.includes('.')) assignPath(nested, k.split('.'), v)
            else fields[k] = v
          }
          for (const [k, v] of Object.entries(nested)) fields[k] = v
          const audio = { ...(resolvedDefaults.audio || {}), ...(entry?.audio || {}) }
          const video = { ...(resolvedDefaults.video || {}), ...(entry?.video || {}) }
          const document = { ...(resolvedDefaults.document || {}), ...(entry?.document || {}) }
          if (audio.language) fields['transcription_language'] = audio.language
          if (typeof audio.diarize === 'boolean') fields['diarize'] = audio.diarize
          if (typeof video.captions === 'boolean') fields['timestamp_option'] = video.captions
          if (typeof document.ocr === 'boolean') {
            fields['pdf_parsing_engine'] = document.ocr ? 'pymupdf4llm' : ''
          }
          return fields
        }

        const processWebScrape = async (url: string) => {
          const nestedBody: Record<string, any> = {}
          for (const [k, v] of Object.entries(advancedValues as Record<string, any>)) {
            if (k.includes('.')) assignPath(nestedBody, k.split('.'), v)
            else nestedBody[k] = v
          }
          const body: any = {
            scrape_method: 'individual',
            url_input: url,
            mode: 'ephemeral',
            summarize_checkbox: Boolean(common.perform_analysis),
            ...nestedBody
          }
          const resp = await handleTldwRequest({
            path: '/api/v1/media/process-web-scraping',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
          }) as { ok: boolean; error?: string; status?: number; data?: any } | undefined
          if (!resp?.ok) {
            const msg = resp?.error || `Request failed: ${resp?.status}`
            throw new Error(msg)
          }
          return resp.data
        }

        const out: any[] = []

        const emitProgress = (result: any) => {
          processedCount += 1
          // Best-effort OS notification
          try {
            const label =
              result?.url ||
              result?.fileName ||
              (result?.type === 'file' ? 'File' : 'Item')
            const statusLabel =
              result?.status === 'ok'
                ? 'Completed'
                : result?.status === 'error'
                  ? 'Failed'
                  : 'Processed'
            const chromeNotifications = (
              globalThis as {
                chrome?: {
                  notifications?: {
                    create?: (options: {
                      type: string
                      iconUrl: string
                      title: string
                      message: string
                    }) => void
                  }
                }
              }
            ).chrome?.notifications
            chromeNotifications?.create?.({
              type: 'basic',
              iconUrl: '/icon.png',
              title: 'Quick Ingest',
              message: `${processedCount}/${totalCount}: ${label} – ${statusLabel}`
            })
          } catch (error) {
            logBackgroundError("quick ingest notification", error)
          }

          // In-app progress event for any open UI
          try {
            void browser.runtime
              .sendMessage({
                type: 'tldw:quick-ingest-progress',
                payload: {
                  result,
                  processedCount,
                  totalCount
                }
              })
              .catch((error) => {
                logBackgroundError("quick ingest progress message", error)
              })
          } catch (error) {
            logBackgroundError("quick ingest progress message", error)
          }
        }

        // Process URL entries
        for (const r of entries) {
          const url = String(r?.url || '').trim()
          if (!url) continue
          const explicitType = r?.type && typeof r.type === 'string' ? r.type : 'auto'
          const t = explicitType === 'auto' ? inferMediaTypeFromUrl(url) : explicitType
          try {
            let data: any
            if (shouldStoreRemote) {
              // Ingest & store via multipart form
              const fields: Record<string, any> = buildFields(t, r)
              fields.urls = [url]
              const resp = await handleUpload({ path: '/api/v1/media/add', method: 'POST', fields })
              if (!resp?.ok) {
                const msg = resp?.error || `Upload failed: ${resp?.status}`
                throw new Error(msg)
              }
              data = resp.data
            } else {
              // Process only (no store)
              if (t === 'html') {
                data = await processWebScrape(url)
              } else {
                const fields = buildFields(t, r)
                fields.urls = [url]
                const resp = await handleUpload({
                  path: getProcessPathForType(t),
                  method: 'POST',
                  fields
                })
                if (!resp?.ok) {
                  const msg = resp?.error || `Upload failed: ${resp?.status}`
                  throw new Error(msg)
                }
                data = resp.data
              }
            }
            const result = { id: r.id, status: 'ok', url, type: t, data }
            out.push(result)
            emitProgress(result)
          } catch (e: any) {
            const result = {
              id: r.id,
              status: 'error',
              url,
              type: t,
              error: e?.message || 'Request failed'
            }
            out.push(result)
            emitProgress(result)
          }
        }

        // Process local files (upload or process)
        for (const f of files) {
          const id = f?.id || crypto.randomUUID()
          const name = f?.name || 'upload'
          const mediaType = inferUploadMediaTypeFromFile(name, f?.type)
          const resolvedFileDefaults =
            f?.defaults && typeof f.defaults === 'object'
              ? f.defaults
              : fileDefaults
          try {
            let data: any
            if (shouldStoreRemote) {
              const fields: Record<string, any> = buildFields(
                mediaType,
                undefined,
                resolvedFileDefaults
              )
              const resp = await handleUpload({
                path: '/api/v1/media/add',
                method: 'POST',
                fields,
                file: { name, type: f?.type || 'application/octet-stream', data: f?.data }
              })
              if (!resp?.ok) {
                const msg = resp?.error || `Upload failed: ${resp?.status}`
                throw new Error(msg)
              }
              data = resp.data
            } else {
              const fields: Record<string, any> = buildFields(
                mediaType,
                undefined,
                resolvedFileDefaults
              )
              const resp = await handleUpload({
                path: getProcessPathForType(mediaType),
                method: 'POST',
                fields,
                file: { name, type: f?.type || 'application/octet-stream', data: f?.data }
              })
              if (!resp?.ok) {
                const msg = resp?.error || `Upload failed: ${resp?.status}`
                throw new Error(msg)
              }
              data = resp.data
            }
            const result = { id, status: 'ok', fileName: name, type: mediaType, data }
            out.push(result)
            emitProgress(result)
          } catch (e: any) {
            const result = {
              id,
              status: 'error',
              fileName: name,
              type: 'file',
              error: e?.message || 'Upload failed'
            }
            out.push(result)
            emitProgress(result)
          }
        }

        return { ok: true, results: out }
      }
      if (message.type === "sidepanel") {
        try {
          const tabId = sender?.tab?.id ?? undefined
          ensureSidepanelOpen(tabId)
        } catch (error) {
          logBackgroundError("ensure sidepanel open", error)
        }
      } else if (message.type === 'tldw:upload') {
        return handleUpload(message.payload || {})
      } else if (message.type === 'tldw:request') {
        return handleTldwRequest(message.payload || {})
      } else if (message.type === 'tldw:ingest') {
        try {
          const tabs = await browser.tabs.query({ active: true, currentWindow: true })
          const tab = tabs[0]
          const pageUrl = tab?.url || ''
          if (!pageUrl) return { ok: false, status: 400, error: 'No active tab URL' }
          const path = message.mode === 'process' ? getProcessPathForUrl(pageUrl) : '/api/v1/media/add'
          const resp = await apiSend({ path, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { url: pageUrl }, timeoutMs: 120000 })
          return resp
        } catch (e: any) {
          return { ok: false, status: 0, error: e?.message || 'Ingest failed' }
        }
      }
    })

    browser.runtime.onConnect.addListener((port) => {
      if (port.name === "pgCopilot") {
        isCopilotRunning = true
        backgroundDiagnostics.ports.copilot += 1
        backgroundDiagnostics.lastCopilotAt = Date.now()
        port.onDisconnect.addListener(() => {
          isCopilotRunning = false
          backgroundDiagnostics.ports.copilot = Math.max(
            0,
            backgroundDiagnostics.ports.copilot - 1
          )
        })
      } else if (port.name === 'tldw:stt') {
        backgroundDiagnostics.ports.stt += 1
        backgroundDiagnostics.lastSttAt = Date.now()
        let ws: WebSocket | null = null
        let disconnected = false
        let connectTimer: ReturnType<typeof setTimeout> | null = null
        const safePost = (msg: any) => {
          if (disconnected) return
          try {
            port.postMessage(msg)
          } catch (error) {
            logBackgroundError("stt port postMessage", error)
          }
        }
        const onMsg = async (msg: any) => {
          try {
            if (msg?.action === 'connect') {
              const cfg = await storage.get<any>('tldwConfig')
              if (!cfg?.serverUrl) throw new Error('tldw server not configured')
              const base = cfg.serverUrl.replace(/^http/, 'ws').replace(/\/$/, '')
              const rawToken = cfg.authMode === 'single-user' ? cfg.apiKey : cfg.accessToken
              const token = String(rawToken || '').trim()
              if (!token) {
                throw new Error('Not authenticated. Configure tldw credentials in Settings > tldw.')
              }
              const url = `${base}/api/v1/audio/stream/transcribe?token=${encodeURIComponent(token)}`
              ws = new WebSocket(url)
              ws.binaryType = 'arraybuffer'
              connectTimer = setTimeout(() => {
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                  safePost({ event: 'error', message: 'STT connection timeout. Check tldw server health.' })
                  try {
                    ws?.close()
                  } catch (error) {
                    logBackgroundError("stt websocket close (timeout)", error)
                  }
                  ws = null
                }
              }, 10000)
              ws.onopen = () => {
                if (connectTimer) {
                  clearTimeout(connectTimer)
                  connectTimer = null
                }
                safePost({ event: 'open' })
              }
              ws.onmessage = (ev) => safePost({ event: 'data', data: ev.data })
              ws.onerror = () => safePost({ event: 'error', message: 'STT websocket error' })
              ws.onclose = () => {
                if (connectTimer) {
                  clearTimeout(connectTimer)
                  connectTimer = null
                }
                safePost({ event: 'close' })
              }
            } else if (msg?.action === 'audio' && ws && ws.readyState === WebSocket.OPEN) {
              if (msg.data instanceof ArrayBuffer) {
                ws.send(msg.data)
              } else if (msg.data?.buffer) {
                ws.send(msg.data.buffer)
              }
            } else if (msg?.action === 'close') {
              try {
                ws?.close()
              } catch (error) {
                logBackgroundError("stt websocket close", error)
              }
              ws = null
            }
          } catch (e: any) {
            safePost({ event: 'error', message: e?.message || 'ws error' })
          }
        }
        port.onMessage.addListener(onMsg)
        port.onDisconnect.addListener(() => {
          disconnected = true
          backgroundDiagnostics.ports.stt = Math.max(
            0,
            backgroundDiagnostics.ports.stt - 1
          )
          try {
            port.onMessage.removeListener(onMsg)
          } catch (error) {
            logBackgroundError("stt port removeListener", error)
          }
          if (connectTimer) {
            clearTimeout(connectTimer)
            connectTimer = null
          }
          try {
            ws?.close()
          } catch (error) {
            logBackgroundError("stt websocket close (disconnect)", error)
          }
        })
      }
    })

    const actionApi = getActionApi()
    actionApi?.onClicked?.addListener((tab: any) => {
      if (actionIconClick === "webui") {
        browser.tabs.create({ url: browser.runtime.getURL("/options.html") })
      } else {
        ensureSidepanelOpen(tab?.id)
      }
    })

    browser.contextMenus.onClicked.addListener(async (info, tab) => {
      if (info.menuItemId === "open-side-panel-pa") {
        ensureSidepanelOpen(tab?.id)
      } else if (info.menuItemId === "open-web-ui-pa") {
        browser.tabs.create({
          url: browser.runtime.getURL("/options.html")
        })
      } else if (info.menuItemId === transcribeMenuId.transcribe) {
        await handleTranscribeClick(info, tab, 'transcribe')
      } else if (info.menuItemId === transcribeMenuId.transcribeAndSummarize) {
        await handleTranscribeClick(info, tab, 'transcribe+summary')
      } else if (info.menuItemId === saveToNotesMenuId) {
        const selection = String(info.selectionText || '').trim()
        if (!selection) {
          notify(browser.i18n.getMessage("contextSaveToNotes"), browser.i18n.getMessage("contextSaveToNotesNoSelection"))
          return
        }
        const title = browser.i18n.getMessage("contextSaveToNotes") || "Save to Notes"
        const openingMessage =
          browser.i18n.getMessage("contextSaveToNotesOpeningSidebar") ||
          "Opening sidebar to save note…"
        notify(title, openingMessage)
        setTimeout(
          async () => {
            try {
              await ensureSidepanelOpen(tab.id!)
              await browser.runtime.sendMessage({
                from: "background",
                type: "save-to-notes",
                text: selection,
                payload: {
                  selectionText: selection,
                  pageUrl: info.pageUrl || (tab && tab.url) || "",
                  pageTitle: tab?.title || ""
                }
              })
            } catch (e: any) {
              const failureMessage =
                browser.i18n.getMessage("contextSaveToNotesDeliveryFailed") ||
                "Could not open the sidebar to save this note. Check that the tldw Assistant sidepanel is allowed on this site and try again."
              notify(title, failureMessage)
            }
          },
          isCopilotRunning ? 0 : 5000
        )
      } else if (info.menuItemId === "send-to-tldw") {
        try {
          const pageUrl = info.pageUrl || (tab && tab.url) || ''
          const targetUrl = (info.linkUrl && /^https?:/i.test(info.linkUrl)) ? info.linkUrl : pageUrl
          if (!targetUrl) return
          await browser.runtime.sendMessage({
            type: 'tldw:request',
            payload: { path: '/api/v1/media/add', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { url: targetUrl } }
          })
          notify('tldw_server', 'Sent to tldw_server for processing')
        } catch (e) {
          console.error('Failed to send to tldw_server:', e)
        }
      } else if (info.menuItemId === 'process-local-tldw') {
        try {
          const pageUrl = info.pageUrl || (tab && tab.url) || ''
          const targetUrl = (info.linkUrl && /^https?:/i.test(info.linkUrl)) ? info.linkUrl : pageUrl
          if (!targetUrl) return
          await browser.runtime.sendMessage({
            type: 'tldw:request',
            payload: { path: getProcessPathForUrl(targetUrl), method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { url: targetUrl } }
          })
          notify('tldw_server', 'Processed page (not saved to server)')
        } catch (e) {
          console.error('Failed to process locally:', e)
        }
      } else if (info.menuItemId === "summarize-pa") {
        ensureSidepanelOpen(tab?.id)
        // this is a bad method hope somone can fix it :)
        setTimeout(
          async () => {
            await browser.runtime.sendMessage({
              from: "background",
              type: "summary",
              text: info.selectionText
            })
          },
          isCopilotRunning ? 0 : 5000
        )
      } else if (info.menuItemId === "rephrase-pa") {
        ensureSidepanelOpen(tab?.id)
        setTimeout(
          async () => {
            await browser.runtime.sendMessage({
              type: "rephrase",
              from: "background",
              text: info.selectionText
            })
          },
          isCopilotRunning ? 0 : 5000
        )
      } else if (info.menuItemId === "translate-pg") {
        ensureSidepanelOpen(tab?.id)

        setTimeout(
          async () => {
            await browser.runtime.sendMessage({
              type: "translate",
              from: "background",
              text: info.selectionText
            })
          },
          isCopilotRunning ? 0 : 5000
        )
      } else if (info.menuItemId === "explain-pa") {
        ensureSidepanelOpen(tab?.id)

        setTimeout(
          async () => {
            await browser.runtime.sendMessage({
              type: "explain",
              from: "background",
              text: info.selectionText
            })
          },
          isCopilotRunning ? 0 : 5000
        )
      } else if (info.menuItemId === "custom-pg") {
        ensureSidepanelOpen(tab?.id)

        setTimeout(
          async () => {
            await browser.runtime.sendMessage({
              type: "custom",
              from: "background",
              text: info.selectionText
            })
          },
          isCopilotRunning ? 0 : 5000
        )
      }
    })

    browser.commands.onCommand.addListener((command) => {
      switch (command) {
        case "execute_side_panel":
          browser.tabs
            .query({ active: true, currentWindow: true })
            .then((tabs) => {
              const tab = tabs[0]
              ensureSidepanelOpen(tab?.id)
            })
            .catch(() => {
              ensureSidepanelOpen()
            })
          break
        default:
          break
      }
    })

    // Stream handler via Port API
    browser.runtime.onConnect.addListener((port) => {
      if (port.name === 'tldw:stream') {
        backgroundDiagnostics.ports.stream += 1
        backgroundDiagnostics.lastStreamAt = Date.now()
        let abort: AbortController | null = null
        let idleTimer: any = null
        let closed = false
        let disconnected = false
        const safePost = (msg: any) => {
          if (disconnected) return
          try {
            port.postMessage(msg)
          } catch (error) {
            logBackgroundError("stream port postMessage", error)
          }
        }
        const onMsg = async (msg: any) => {
          try {
            const cfg = await storage.get<any>('tldwConfig')
            if (!cfg?.serverUrl) throw new Error('tldw server not configured')
            const baseUrl = String(cfg.serverUrl).replace(/\/$/, '')
            const path = msg.path as string
            const url = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
            const headers: Record<string, string> = { ...(msg.headers || {}) }
            for (const k of Object.keys(headers)) {
              const kl = k.toLowerCase()
              if (kl === 'x-api-key' || kl === 'authorization') delete headers[k]
            }
            if (cfg.authMode === 'single-user') {
              const key = (cfg.apiKey || '').trim()
              if (!key) {
                safePost({
                  event: 'error',
                  message:
                    'Add or update your API key in Settings → tldw server, then try again.'
                })
                return
              }
              headers['X-API-KEY'] = key
            } else if (cfg.authMode === 'multi-user') {
              const token = (cfg.accessToken || '').trim()
              if (token) headers['Authorization'] = `Bearer ${token}`
              else { safePost({ event: 'error', message: 'Not authenticated. Please login under Settings > tldw.' }); return }
            }
            headers['Accept'] = 'text/event-stream'
            headers['Cache-Control'] = headers['Cache-Control'] || 'no-cache'
            headers['Connection'] = headers['Connection'] || 'keep-alive'
            abort = new AbortController()
            const idleMs = deriveStreamIdleTimeout(cfg, path, Number(msg?.streamIdleTimeoutMs))
            const resetIdle = () => {
              if (idleTimer) clearTimeout(idleTimer)
              idleTimer = setTimeout(() => {
                if (!closed) {
                  try {
                    abort?.abort()
                  } catch (error) {
                    logBackgroundError("stream abort", error)
                  }
                  safePost({ event: 'error', message: 'Stream timeout: no updates received' })
                }
              }, idleMs)
            }
            // Ensure SSE-friendly headers
            headers['Accept'] = headers['Accept'] || 'text/event-stream'
            headers['Cache-Control'] = headers['Cache-Control'] || 'no-cache'
            headers['Connection'] = headers['Connection'] || 'keep-alive'

            let resp = await fetch(url, {
              method: msg.method || 'POST',
              headers,
              body: typeof msg.body === 'string' ? msg.body : JSON.stringify(msg.body),
              signal: abort.signal
            })
            if (resp.status === 401 && cfg.authMode === 'multi-user' && cfg.refreshToken) {
              if (!refreshInFlight) {
                refreshInFlight = (async () => {
                  try {
                    await tldwAuth.refreshToken()
                  } finally {
                    refreshInFlight = null
                  }
                })()
              }
              try {
                await refreshInFlight
              } catch (error) {
                logBackgroundError("refresh auth (stream)", error)
              }
              const updated = await storage.get<any>('tldwConfig')
              if (updated?.accessToken) headers['Authorization'] = `Bearer ${updated.accessToken}`
              const retryController = new AbortController()
              abort = retryController
              resp = await fetch(url, {
                method: msg.method || 'POST',
                headers,
                body: typeof msg.body === 'string' ? msg.body : JSON.stringify(msg.body),
                signal: retryController.signal
              })
            }
            if (!resp.ok) {
              const ct = resp.headers.get('content-type') || ''
              let errMsg: any = resp.statusText
              if (ct.includes('application/json')) {
                const j = await resp.json().catch(() => null)
                if (j && (j.detail || j.error || j.message)) errMsg = j.detail || j.error || j.message
              } else {
                const t = await resp.text().catch(() => null)
                if (t) errMsg = t
              }
              safePost({
                event: "error",
                message: formatErrorMessage(errMsg, `HTTP ${resp.status}`)
              })
              return
            }
            if (!resp.body) throw new Error('No response body')
            const reader = resp.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            resetIdle()
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              resetIdle()
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''
              for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed) continue
                // Any SSE activity resets idle timer
                resetIdle()
                if (trimmed.startsWith('event:')) {
                  const name = trimmed.slice(6).trim()
                  if (streamDebugEnabled) {
                    try {
                      await browser.runtime.sendMessage({
                        type: 'tldw:stream-debug',
                        payload: { kind: 'event', name, time: Date.now() }
                      })
                    } catch (error) {
                      logBackgroundError("stream debug event", error)
                    }
                  }
                } else if (trimmed.startsWith('data:')) {
                  const data = trimmed.slice(5).trim()
                  if (streamDebugEnabled) {
                    try {
                      await browser.runtime.sendMessage({
                        type: 'tldw:stream-debug',
                        payload: { kind: 'data', data, time: Date.now() }
                      })
                    } catch (error) {
                      logBackgroundError("stream debug data", error)
                    }
                  }
                  if (data === '[DONE]') {
                    closed = true
                    if (idleTimer) clearTimeout(idleTimer)
                    safePost({ event: 'done' })
                    return
                  }
                  safePost({ event: 'data', data })
                } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                  // Some servers may omit the 'data:' prefix; treat JSON lines as data
                  const data = trimmed
                  if (streamDebugEnabled) {
                    try {
                      await browser.runtime.sendMessage({
                        type: 'tldw:stream-debug',
                        payload: { kind: 'data', data, time: Date.now() }
                      })
                    } catch (error) {
                      logBackgroundError("stream debug json", error)
                    }
                  }
                  safePost({ event: 'data', data })
                }
              }
            }
            closed = true
            if (idleTimer) clearTimeout(idleTimer)
            safePost({ event: 'done' })
          } catch (e: any) {
            if (idleTimer) clearTimeout(idleTimer)
            safePost({
              event: "error",
              message: formatErrorMessage(e, "Stream error")
            })
          }
        }
        port.onMessage.addListener(onMsg)
        port.onDisconnect.addListener(() => {
          disconnected = true
          backgroundDiagnostics.ports.stream = Math.max(
            0,
            backgroundDiagnostics.ports.stream - 1
          )
          try {
            port.onMessage.removeListener(onMsg)
          } catch (error) {
            logBackgroundError("stream port removeListener", error)
          }
          try {
            abort?.abort()
          } catch (error) {
            logBackgroundError("stream abort (disconnect)", error)
          }
        })
      }
    })

    if (browser?.alarms) {
      browser.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name !== MODEL_WARM_ALARM_NAME) return
        backgroundDiagnostics.alarmFires += 1
        backgroundDiagnostics.lastAlarmAt = Date.now()
        void warmModels(true)
      })
    }

    initialize()
  },
  persistent: false
})

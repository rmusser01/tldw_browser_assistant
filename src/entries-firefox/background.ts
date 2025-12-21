import { browser } from "wxt/browser"
import { Storage } from "@plasmohq/storage"
import { createSafeStorage } from "@/utils/safe-storage"
import type { AllowedPath } from "@/services/tldw/openapi-guard"
import { getInitialConfig } from "@/services/action"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { tldwAuth } from "@/services/tldw/TldwAuth"
import { tldwModels } from "@/services/tldw"
import { apiSend } from "@/services/api-send"
import {
  ensureSidepanelOpen,
  pickFirstString,
  extractTranscriptionPieces,
  clampText,
  notify
} from "@/services/background-helpers"

export default defineBackground({
  main() {
    const storage = createSafeStorage({ area: "local" })
    let isCopilotRunning: boolean = false
    let actionIconClick: string = "webui"
    let contextMenuClick: string = "sidePanel"
    let modelWarmTimer: ReturnType<typeof setInterval> | null = null

    const initialize = async () => {
      try {
        // Clear any existing context menus to avoid duplicate-id errors
        try {
          await browser.contextMenus.removeAll()
        } catch (e) {
          console.debug(
            "[tldw] (firefox) contextMenus.removeAll failed:",
            (e as any)?.message || e
          )
        }

        storage.watch({
          "actionIconClick": (value) => {
            const oldValue = value?.oldValue || "webui"
            const newValue = value?.newValue || "webui"
            if (oldValue !== newValue) {
              actionIconClick = newValue
            }
          },
          "contextMenuClick": (value) => {
            const oldValue = value?.oldValue || "sidePanel"
            const newValue = value?.newValue || "sidePanel"
            if (oldValue !== newValue) {
              contextMenuClick = newValue
              browser.contextMenus.remove(contextMenuId[oldValue])
              browser.contextMenus.create({
                id: contextMenuId[newValue],
                title: contextMenuTitle[newValue],
                contexts: ["page", "selection"]
              })
            }
          }
        })
        const data = await getInitialConfig()
        contextMenuClick = data.contextMenuClick
        actionIconClick = data.actionIconClick
        browser.contextMenus.create({
          id: contextMenuId[contextMenuClick],
          title: contextMenuTitle[contextMenuClick],
          contexts: ["page", "selection"]
        })
        browser.contextMenus.create({
          id: "summarize-pa",
          title: browser.i18n.getMessage("contextSummarize"),
          contexts: ["selection"]
        })
    
        browser.contextMenus.create({
          id: "explain-pa",
          title: browser.i18n.getMessage("contextExplain"),
          contexts: ["selection"]
        })
    
        browser.contextMenus.create({
          id: "rephrase-pa",
          title: browser.i18n.getMessage("contextRephrase"),
          contexts: ["selection"]
        })
    
        browser.contextMenus.create({
          id: "translate-pg",
          title: browser.i18n.getMessage("contextTranslate"),
          contexts: ["selection"]
        })
    
        browser.contextMenus.create({
          id: "custom-pg",
          title: browser.i18n.getMessage("contextCustom"),
          contexts: ["selection"]
        })

        browser.contextMenus.create({
          id: saveToNotesMenuId,
          title: browser.i18n.getMessage("contextSaveToNotes"),
          contexts: ["selection"]
        })

        const warmModels = async (force?: boolean) => {
          try {
            await tldwModels.warmCache(Boolean(force))
          } catch (e) {
            console.debug("[tldw] model warmup failed", e)
          }
        }
        await warmModels(true)
        if (modelWarmTimer) clearInterval(modelWarmTimer)
        modelWarmTimer = setInterval(() => {
          void warmModels(true)
        }, 15 * 60 * 1000)
    
      } catch (error) {
        console.error("Error in initLogic:", error)
      }
    }


    let refreshInFlight: Promise<any> | null = null
    let streamDebugEnabled = false

    const getProcessPathForUrl = (url: string): AllowedPath => {
      const u = (url || '').toLowerCase()
      const endsWith = (exts: string[]) => exts.some((e) => u.endsWith(e))
      if (endsWith(['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg'])) return '/api/v1/media/process-audios'
      if (endsWith(['.mp4', '.webm', '.mkv', '.mov', '.avi'])) return '/api/v1/media/process-videos'
      if (endsWith(['.pdf'])) return '/api/v1/media/process-pdfs'
      if (endsWith(['.epub', '.mobi'])) return '/api/v1/media/process-ebooks'
      if (endsWith(['.doc', '.docx', '.rtf', '.odt', '.txt', '.md'])) return '/api/v1/media/process-documents'
      return '/api/v1/media/process-web-scraping'
    }

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

        ensureSidepanelOpen()
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
        } catch {
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
            } catch {}
          }, 500)
        }
        notify('tldw_server', `${label} sent to sidebar. You can also review it under Media in the Web UI.`)
      } catch (e: any) {
        notify('tldw_server', e?.message || 'Transcription request failed.')
      }
    }

    const parseRetryAfter = (headerValue?: string | null): number | null => {
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

    const deriveStreamIdleTimeout = (cfg: any, path: string, override?: number) => {
      if (override && override > 0) return override
      const p = String(path || '')
      const defaultIdle = 45000
      if (p.includes('/api/v1/chat/completions')) {
        return Number(cfg?.chatStreamIdleTimeoutMs) > 0
          ? Number(cfg.chatStreamIdleTimeoutMs)
          : (Number(cfg?.streamIdleTimeoutMs) > 0 ? Number(cfg.streamIdleTimeoutMs) : defaultIdle)
      }
      return Number(cfg?.streamIdleTimeoutMs) > 0 ? Number(cfg.streamIdleTimeoutMs) : defaultIdle
    }

    const normalizeFileData = (input: any): Uint8Array | null => {
      if (!input) return null
      if (input instanceof ArrayBuffer) return new Uint8Array(input)
      if (ArrayBuffer.isView(input)) {
        return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
      }
      if (Array.isArray((input as any)?.data)) return new Uint8Array((input as any).data)
      if (Array.isArray(input)) return new Uint8Array(input)
      if (typeof input === 'string' && input.startsWith('data:')) {
        try {
          const base64 = input.split(',', 2)[1] || ''
          const binary = atob(base64)
          const out = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
          return out
        } catch {
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
    }) => {
      const { path, method = 'POST', fields = {}, file } = payload || {}
      const cfg = await storage.get<any>('tldwConfig')
      const isAbsolute = typeof path === 'string' && /^https?:/i.test(path)
      if (!path && !isAbsolute) {
        return { ok: false, status: 400, error: 'Upload path missing' }
      }
      if (!cfg?.serverUrl && !isAbsolute) {
        return { ok: false, status: 400, error: 'tldw server not configured' }
      }
      const baseUrl = cfg?.serverUrl ? String(cfg.serverUrl).replace(/\/$/, '') : ''
      const url = isAbsolute ? path : `${baseUrl}${path?.startsWith('/') ? '' : '/'}${path}`
      try {
        const form = new FormData()
        for (const [k, v] of Object.entries(fields || {})) {
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
          const blob = new Blob([bytes], { type: file.type || 'application/octet-stream' })
          const filename = file.name || 'file'
          // @ts-ignore File may not exist in some workers; Blob is accepted by FormData
          try {
            form.append('files', new File([blob], filename, { type: blob.type }))
          } catch {
            form.append('files', blob, filename)
          }
          form.append('file', blob, filename)
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
        return { ok: resp.ok, status: resp.status, data }
      } catch (e: any) {
        return { ok: false, status: 0, error: e?.message || 'Upload failed' }
      }
    }

    const handleTldwRequest = async (payload: any) => {
      const { path, method = 'GET', headers = {}, body, noAuth = false, timeoutMs: overrideTimeoutMs } = payload || {}
      if (typeof path !== 'string' || path.trim() === '') {
        return { ok: false, status: 400, error: 'Invalid path' }
      }
      const pathStr = path.trim()
      const cfg = await storage.get<any>('tldwConfig')
      const isAbsolute = /^https?:/i.test(pathStr)
      if (!cfg?.serverUrl && !isAbsolute) {
        return { ok: false, status: 400, error: 'tldw server not configured' }
      }
      const baseUrl = cfg?.serverUrl ? String(cfg.serverUrl).replace(/\/$/, '') : ''
      const url = isAbsolute ? pathStr : `${baseUrl}${pathStr.startsWith('/') ? '' : '/'}${pathStr}`
      const h: Record<string, string> = { ...(headers || {}) }
      if (!noAuth) {
        for (const k of Object.keys(h)) {
          const kl = k.toLowerCase()
          if (kl === 'x-api-key' || kl === 'authorization') delete h[k]
        }
        if (cfg?.authMode === 'single-user') {
          if (cfg?.apiKey) h['X-API-KEY'] = String(cfg.apiKey).trim()
          else return { ok: false, status: 401, error: 'Add or update your API key in Settings → tldw server, then try again.' }
        } else if (cfg?.authMode === 'multi-user') {
          if (cfg?.accessToken) h['Authorization'] = `Bearer ${String(cfg.accessToken).trim()}`
          else return { ok: false, status: 401, error: 'Not authenticated. Please login under Settings > tldw.' }
        }
      }
      try {
        const controller = new AbortController()
        const timeoutMs = Number(overrideTimeoutMs) > 0 ? Number(overrideTimeoutMs) : (Number(cfg?.requestTimeoutMs) > 0 ? Number(cfg.requestTimeoutMs) : 10000)
        const timeout = setTimeout(() => controller.abort(), timeoutMs)
        let resp = await fetch(url, {
          method,
          headers: h,
          body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
          signal: controller.signal
        })
        clearTimeout(timeout)
        if (resp.status === 401 && cfg.authMode === 'multi-user' && cfg.refreshToken) {
          if (!refreshInFlight) {
            refreshInFlight = (async () => {
              try { await tldwAuth.refreshToken() } finally { refreshInFlight = null }
            })()
          }
          try { await refreshInFlight } catch {}
          const updated = await storage.get<any>('tldwConfig')
          const retryHeaders = { ...h }
          for (const k of Object.keys(retryHeaders)) {
            const kl = k.toLowerCase()
            if (kl === 'authorization' || kl === 'x-api-key') delete retryHeaders[k]
          }
          if (updated?.accessToken) retryHeaders['Authorization'] = `Bearer ${updated.accessToken}`
          const retryController = new AbortController()
          const retryTimeout = setTimeout(() => retryController.abort(), timeoutMs)
          resp = await fetch(url, {
            method,
            headers: retryHeaders,
            body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
            signal: retryController.signal
          })
          clearTimeout(retryTimeout)
        }
        const headersOut: Record<string, string> = {}
        try {
          resp.headers.forEach((v, k) => {
            headersOut[k] = v
          })
        } catch {}
        const retryAfterMs = parseRetryAfter(resp.headers?.get?.('retry-after'))
        const contentType = resp.headers.get('content-type') || ''
        let data: any = null
        if (contentType.includes('application/json')) {
          data = await resp.json().catch(() => null)
        } else {
          data = await resp.text().catch(() => null)
        }
        if (!resp.ok) {
          const detail = typeof data === 'object' && data && (data.detail || data.error || data.message)
          return { ok: false, status: resp.status, error: detail || resp.statusText || `HTTP ${resp.status}`, data, headers: headersOut, retryAfterMs }
        }
        return { ok: true, status: resp.status, data, headers: headersOut, retryAfterMs }
      } catch (e: any) {
        return { ok: false, status: 0, error: e?.message || 'Network error' }
      }
    }

    browser.runtime.onMessage.addListener(async (message, sender) => {
      if (message.type === 'tldw:debug') {
        streamDebugEnabled = Boolean(message?.enable)
        return { ok: true }
      }
      if (message.type === 'tldw:models:refresh') {
        try {
          const models = await tldwModels.warmCache(true)
          return { ok: true, count: Array.isArray(models) ? models.length : 0 }
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
        const advancedValues =
          payload.advancedValues && typeof payload.advancedValues === 'object'
            ? payload.advancedValues
            : {}
        const shouldStoreRemote = storeRemote && !processOnly

        const totalCount = entries.length + files.length
        let processedCount = 0

        const detectTypeFromUrl = (raw: string): string => {
          try {
            const u = new URL(raw)
            const p = (u.pathname || '').toLowerCase()
            if (p.match(/\.(mp3|wav|flac|m4a|aac)$/)) return 'audio'
            if (p.match(/\.(mp4|mov|mkv|webm)$/)) return 'video'
            if (p.match(/\.(pdf)$/)) return 'pdf'
            if (p.match(/\.(doc|docx|txt|rtf|md)$/)) return 'document'
            return 'html'
          } catch {
            return 'auto'
          }
        }

        const assignPath = (obj: any, path: string[], val: any) => {
          let cur = obj
          for (let i = 0; i < path.length; i++) {
            const seg = path[i]
            if (i === path.length - 1) cur[seg] = val
            else cur = (cur[seg] = cur[seg] || {})
          }
        }

        const normalizeMediaType = (rawType: string): string => {
          if (!rawType) return rawType
          const t = rawType.toLowerCase()
          if (t === 'html') return 'document'
          return t
        }

        const processPathForType = (rawType: string): string => {
          const t = normalizeMediaType(rawType)
          switch (t) {
            case 'audio':
              return '/api/v1/media/process-audios'
            case 'video':
              return '/api/v1/media/process-videos'
            case 'pdf':
              return '/api/v1/media/process-pdfs'
            default:
              return '/api/v1/media/process-documents'
          }
        }

        const buildFields = (rawType: string, entry?: any) => {
          const mediaType = normalizeMediaType(rawType)
          const fields: Record<string, any> = {
            media_type: mediaType,
            perform_analysis: Boolean(common.perform_analysis),
            perform_chunking: Boolean(common.perform_chunking),
            overwrite_existing: Boolean(common.overwrite_existing)
          }
          const nested: Record<string, any> = {}
          for (const [k, v] of Object.entries(advancedValues as Record<string, any>)) {
            if (k.includes('.')) assignPath(nested, k.split('.'), v)
            else fields[k] = v
          }
          for (const [k, v] of Object.entries(nested)) fields[k] = v
          if (entry?.audio?.language) fields['transcription_language'] = entry.audio.language
          if (typeof entry?.audio?.diarize === 'boolean') fields['diarize'] = entry.audio.diarize
          if (typeof entry?.video?.captions === 'boolean') fields['timestamp_option'] = entry.video.captions
          if (typeof entry?.document?.ocr === 'boolean') {
            fields['pdf_parsing_engine'] = entry.document.ocr ? 'pymupdf4llm' : ''
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
            void browser.notifications?.create?.({
              type: 'basic',
              iconUrl: '/icon.png',
              title: 'Quick Ingest',
              message: `${processedCount}/${totalCount}: ${label} - ${statusLabel}`
            })
          } catch {}

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
              .catch(() => {})
          } catch {}
        }

        for (const r of entries) {
          const explicitType = r?.type && typeof r.type === 'string' ? r.type : 'auto'
          const url = String(r?.url || '').trim()
          if (!url) {
            const result = {
              id: r?.id,
              status: 'error',
              url: '',
              type: explicitType === 'auto' ? 'auto' : explicitType,
              error: 'Missing URL'
            }
            out.push(result)
            emitProgress(result)
            continue
          }
          const t = explicitType === 'auto' ? detectTypeFromUrl(url) : explicitType
          try {
            let data: any
            if (shouldStoreRemote) {
              const fields: Record<string, any> = buildFields(t, r)
              fields.urls = [url]
              const resp = await handleUpload({ path: '/api/v1/media/add', method: 'POST', fields })
              if (!resp?.ok) {
                const msg = resp?.error || `Upload failed: ${resp?.status}`
                throw new Error(msg)
              }
              data = resp.data
            } else {
              if (t === 'html') {
                data = await processWebScrape(url)
              } else {
                const fields = buildFields(t, r)
                fields.urls = [url]
                const resp = await handleUpload({
                  path: processPathForType(t),
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

        for (const f of files) {
          const id = f?.id || crypto.randomUUID()
          const name = f?.name || 'upload'
          const fileType = String(f?.type || '').toLowerCase()
          const mediaType: 'audio' | 'video' | 'pdf' | 'document' =
            fileType.startsWith('audio/')
              ? 'audio'
              : fileType.startsWith('video/')
                ? 'video'
                : fileType.includes('pdf')
                  ? 'pdf'
                  : 'document'
          try {
            let data: any
            if (shouldStoreRemote) {
              const fields: Record<string, any> = buildFields(mediaType)
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
              const fields: Record<string, any> = buildFields(mediaType)
              const resp = await handleUpload({
                path: processPathForType(mediaType),
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
        await browser.sidebarAction.open()
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
        port.onDisconnect.addListener(() => {
          isCopilotRunning = false
        })
      } else if (port.name === 'tldw:stt') {
        const storage = createSafeStorage({ area: 'local' })
        let ws: WebSocket | null = null
        let disconnected = false
        const safePost = (msg: any) => {
          if (disconnected) return
          try { port.postMessage(msg) } catch {}
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
              ws.onopen = () => safePost({ event: 'open' })
              ws.onmessage = (ev) => safePost({ event: 'data', data: ev.data })
              ws.onerror = () => safePost({ event: 'error', message: 'ws error' })
              ws.onclose = () => safePost({ event: 'close' })
            } else if (msg?.action === 'audio' && ws && ws.readyState === WebSocket.OPEN) {
              if (msg.data instanceof ArrayBuffer) {
                ws.send(msg.data)
              } else if (msg.data?.buffer) {
                ws.send(msg.data.buffer)
              }
            } else if (msg?.action === 'close') {
              try { ws?.close() } catch {}
              ws = null
            }
          } catch (e: any) {
            safePost({ event: 'error', message: e?.message || 'ws error' })
          }
        }
        port.onMessage.addListener(onMsg)
        port.onDisconnect.addListener(() => {
          disconnected = true
          try { port.onMessage.removeListener(onMsg) } catch {}
          try { ws?.close() } catch {}
        })
      }
    })

    browser.browserAction.onClicked.addListener((tab) => {
      if (actionIconClick === "webui") {
        browser.tabs.create({ url: browser.runtime.getURL("/options.html") })
      } else {
        browser.sidebarAction.toggle()
      }
    })

    const contextMenuTitle = {
      webui: browser.i18n.getMessage("openOptionToChat"),
      sidePanel: browser.i18n.getMessage("openSidePanelToChat")
    }

    const contextMenuId = {
      webui: "open-web-ui-pa",
      sidePanel: "open-side-panel-pa"
    }
    const transcribeMenuId = {
      transcribe: "transcribe-media-pa",
      transcribeAndSummarize: "transcribe-and-summarize-media-pa"
    }
    const saveToNotesMenuId = "save-to-notes-pa"


    // Add context menu for tldw ingest
    try {
      browser.contextMenus.create({
        id: 'send-to-tldw',
        title: browser.i18n.getMessage("contextSendToTldw"),
        contexts: ["page", "link"]
      })
      browser.contextMenus.create({
        id: 'process-local-tldw',
        title: browser.i18n.getMessage("contextProcessLocalTldw"),
        contexts: ["page", "link"]
      })
      browser.contextMenus.create({
        id: transcribeMenuId.transcribe,
        title: browser.i18n.getMessage("contextTranscribeMedia"),
        contexts: ["page", "link"]
      })
      browser.contextMenus.create({
        id: transcribeMenuId.transcribeAndSummarize,
        title: browser.i18n.getMessage("contextTranscribeAndSummarizeMedia"),
        contexts: ["page", "link"]
      })
    } catch {}

    browser.contextMenus.onClicked.addListener(async (info, tab) => {
      if (info.menuItemId === "open-side-panel-pa") {
        browser.sidebarAction.toggle()
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
        if (!isCopilotRunning) {
          ensureSidepanelOpen()
          notify(
            browser.i18n.getMessage("contextSaveToNotes"),
            browser.i18n.getMessage("contextSaveToNotesOpeningSidebar")
          )
        }
        setTimeout(async () => {
          try {
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
            notify(
              browser.i18n.getMessage("contextSaveToNotes") || "Save to Notes",
              browser.i18n.getMessage("contextSaveToNotesDeliveryFailed") ||
                "Could not open the sidebar to save this note. Check that the tldw Assistant sidebar is allowed on this site and try again."
            )
          }
        }, isCopilotRunning ? 0 : 1000)
      } else if (info.menuItemId === 'send-to-tldw') {
        const pageUrl = info.pageUrl || (tab && tab.url) || ''
        const targetUrl = (info.linkUrl && /^https?:/i.test(info.linkUrl)) ? info.linkUrl : pageUrl
        if (!targetUrl) return
        browser.runtime.sendMessage({
          type: 'tldw:request',
          payload: { path: '/api/v1/media/add', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { url: targetUrl } }
        })
      } else if (info.menuItemId === 'process-local-tldw') {
        const pageUrl = info.pageUrl || (tab && tab.url) || ''
        const targetUrl = (info.linkUrl && /^https?:/i.test(info.linkUrl)) ? info.linkUrl : pageUrl
        if (!targetUrl) return
        browser.runtime.sendMessage({
          type: 'tldw:request',
          payload: { path: getProcessPathForUrl(targetUrl), method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { url: targetUrl } }
        })
      } else if (info.menuItemId === "summarize-pa") {
        if (!isCopilotRunning) {
          browser.sidebarAction.toggle()
          notify(
            browser.i18n.getMessage("contextSummarize"),
            browser.i18n.getMessage("contextSidebarOpening")
          )
        }
        setTimeout(async () => {
          await browser.runtime.sendMessage({
            from: "background",
            type: "summary",
            text: info.selectionText
          })
        }, isCopilotRunning ? 0 : 1000)
      } else if (info.menuItemId === "rephrase-pa") {
        if (!isCopilotRunning) {
          browser.sidebarAction.toggle()
          notify(
            browser.i18n.getMessage("contextRephrase"),
            browser.i18n.getMessage("contextSidebarOpening")
          )
        }
        setTimeout(async () => {
          await browser.runtime.sendMessage({
            type: "rephrase",
            from: "background",
            text: info.selectionText
          })
        }, isCopilotRunning ? 0 : 1000)
      } else if (info.menuItemId === "translate-pg") {
        if (!isCopilotRunning) {
          browser.sidebarAction.toggle()
          notify(
            browser.i18n.getMessage("contextTranslate"),
            browser.i18n.getMessage("contextSidebarOpening")
          )
        }
        setTimeout(async () => {
          await browser.runtime.sendMessage({
            type: "translate",
            from: "background",
            text: info.selectionText
          })
        }, isCopilotRunning ? 0 : 1000)
      } else if (info.menuItemId === "explain-pa") {
        if (!isCopilotRunning) {
          browser.sidebarAction.toggle()
          notify(
            browser.i18n.getMessage("contextExplain"),
            browser.i18n.getMessage("contextSidebarOpening")
          )
        }
        setTimeout(async () => {
          await browser.runtime.sendMessage({
            type: "explain",
            from: "background",
            text: info.selectionText
          })
        }, isCopilotRunning ? 0 : 1000)
      } else if (info.menuItemId === "custom-pg") {
        if (!isCopilotRunning) {
          browser.sidebarAction.toggle()
          notify(
            browser.i18n.getMessage("contextCustom"),
            browser.i18n.getMessage("contextSidebarOpening")
          )
        }
        setTimeout(async () => {
          await browser.runtime.sendMessage({
            type: "custom",
            from: "background",
            text: info.selectionText
          })
        }, isCopilotRunning ? 0 : 1000)
      }
    })

    // Stream handler via Port API
    browser.runtime.onConnect.addListener((port) => {
      if (port.name === 'tldw:stream') {
        const storage = createSafeStorage({ area: 'local' })
        let abort: AbortController | null = null
        let idleTimer: any = null
        let closed = false
        let disconnected = false
        const safePost = (msg: any) => {
          if (disconnected) return
          try { port.postMessage(msg) } catch {}
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
              if (key) headers['X-API-KEY'] = key
              else { safePost({ event: 'error', message: 'Add or update your API key in Settings → tldw server, then try again.' }); return }
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
                  try { abort?.abort() } catch {}
                  safePost({ event: 'error', message: 'Stream timeout: no updates received' })
                }
              }, idleMs)
            }
            let resp = await fetch(url, {
              method: msg.method || 'POST',
              headers,
              body: typeof msg.body === 'string' ? msg.body : JSON.stringify(msg.body),
              signal: abort.signal
            })
            if (resp.status === 401 && cfg.authMode === 'multi-user' && cfg.refreshToken) {
              if (!refreshInFlight) {
                refreshInFlight = (async () => {
                  try { await tldwAuth.refreshToken() } finally { refreshInFlight = null }
                })()
              }
              try { await refreshInFlight } catch {}
              const updated = await storage.get<any>('tldwConfig')
              const retryHeaders = { ...headers }
              for (const k of Object.keys(retryHeaders)) {
                const kl = k.toLowerCase()
                if (kl === 'authorization' || kl === 'x-api-key') delete retryHeaders[k]
              }
              if (updated?.accessToken) retryHeaders['Authorization'] = `Bearer ${updated.accessToken}`
              const retryController = new AbortController()
              abort = retryController
              resp = await fetch(url, {
                method: msg.method || 'POST',
                headers: retryHeaders,
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
              safePost({ event: 'error', message: String(errMsg || `HTTP ${resp.status}`) })
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
                if (trimmed.startsWith('event:')) {
                  const name = trimmed.slice(6).trim()
                  if (streamDebugEnabled) {
                    try { await browser.runtime.sendMessage({ type: 'tldw:stream-debug', payload: { kind: 'event', name, time: Date.now() } }) } catch {}
                  }
                }
                resetIdle()
                if (trimmed.startsWith('data:')) {
                  const data = trimmed.slice(5).trim()
                  if (streamDebugEnabled) {
                    try { await browser.runtime.sendMessage({ type: 'tldw:stream-debug', payload: { kind: 'data', data, time: Date.now() } }) } catch {}
                  }
                  if (data === '[DONE]') {
                    closed = true
                    if (idleTimer) clearTimeout(idleTimer)
                    safePost({ event: 'done' })
                    return
                  }
                  safePost({ event: 'data', data })
                } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                  const data = trimmed
                  if (streamDebugEnabled) {
                    try { await browser.runtime.sendMessage({ type: 'tldw:stream-debug', payload: { kind: 'data', data, time: Date.now() } }) } catch {}
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
            safePost({ event: 'error', message: e?.message || 'Stream error' })
          }
        }
        port.onMessage.addListener(onMsg)
        port.onDisconnect.addListener(() => {
          disconnected = true
          try { port.onMessage.removeListener(onMsg) } catch {}
          try { abort?.abort() } catch {}
        })
      }
    })

    browser.commands.onCommand.addListener((command) => {
      switch (command) {
        case "execute_side_panel":
          browser.sidebarAction.toggle()
          break
        default:
          break
      }
    })

    initialize()

  },
  persistent: true
})

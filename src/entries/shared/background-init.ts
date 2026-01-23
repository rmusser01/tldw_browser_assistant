import type { Storage } from "@plasmohq/storage"
import { browser } from "wxt/browser"
import { getInitialConfig } from "@/services/action"

export type BackgroundCapabilities = {
  sendToTldw: boolean
  processLocal: boolean
  transcribe: boolean
  openApiCheck: boolean
}

export type BackgroundInitOptions = {
  storage: Storage
  contextMenuId: { webui: string; sidePanel: string }
  saveToNotesMenuId: string
  narrateSelectionMenuId: string
  transcribeMenuId: { transcribe: string; transcribeAndSummarize: string }
  warmModels: (force?: boolean, throwOnError?: boolean) => Promise<any[] | null>
  capabilities: BackgroundCapabilities
  onActionIconClickChange: (value: string) => void
  onContextMenuClickChange: (value: string) => void
}

export type BackgroundInitResult = {
  modelWarmAlarmName: string
}

export const MODEL_WARM_ALARM_NAME = "tldw:model-warm"
const MODEL_WARM_INTERVAL_MINUTES = 60

const getServerUrl = (cfg: any): string => {
  if (!cfg || typeof cfg !== "object") return ""
  return String(cfg.serverUrl || "").trim()
}

const scheduleModelWarmAlarm = async (enabled: boolean) => {
  try {
    if (!browser?.alarms) return
    if (!enabled) {
      await browser.alarms.clear(MODEL_WARM_ALARM_NAME)
      return
    }
    await browser.alarms.clear(MODEL_WARM_ALARM_NAME)
    await browser.alarms.create(MODEL_WARM_ALARM_NAME, {
      periodInMinutes: MODEL_WARM_INTERVAL_MINUTES
    })
  } catch (error) {
    console.debug(
      "[tldw] model warm alarm setup failed:",
      (error as any)?.message || error
    )
  }
}

const checkOpenApiDrift = async (storage: Storage) => {
  try {
    const cfg = await storage.get<any>("tldwConfig")
    const base = String(cfg?.serverUrl || "").replace(/\/$/, "")
    if (!base) return

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const headers: Record<string, string> = {}

    if (cfg?.authMode === "single-user") {
      const key = String(cfg?.apiKey || "").trim()
      if (key) headers["X-API-KEY"] = key
    } else if (cfg?.authMode === "multi-user") {
      const token = String(cfg?.accessToken || "").trim()
      if (token) headers["Authorization"] = `Bearer ${token}`
    }

    const res = await fetch(`${base}/openapi.json`, {
      headers,
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!res.ok) return

    const spec = await res.json().catch(() => null)
    const paths = spec && spec.paths ? spec.paths : {}
    const required = [
      "/api/v1/chat/completions",
      "/api/v1/rag/search",
      "/api/v1/rag/search/stream",
      "/api/v1/media/add",
      "/api/v1/media/process-videos",
      "/api/v1/media/process-audios",
      "/api/v1/media/process-pdfs",
      "/api/v1/media/process-ebooks",
      "/api/v1/media/process-documents",
      "/api/v1/media/process-web-scraping",
      "/api/v1/reading/save",
      "/api/v1/reading/items",
      "/api/v1/audio/transcriptions",
      "/api/v1/audio/speech",
      "/api/v1/llm/models",
      "/api/v1/llm/models/metadata",
      "/api/v1/llm/providers",
      // Workspace features
      "/api/v1/notes/",
      "/api/v1/notes/search/",
      "/api/v1/flashcards",
      "/api/v1/flashcards/decks",
      "/api/v1/characters/world-books",
      "/api/v1/chat/dictionaries"
    ]
    const missing = required.filter((path) => !(path in paths))
    if (missing.length > 0) {
      console.warn("[tldw] OpenAPI drift detected - missing endpoints:", missing)
      try {
        await browser.runtime.sendMessage({
          type: "tldw:openapi-warn",
          payload: { missing }
        })
      } catch {}
    }
  } catch (error) {
    console.debug(
      "[tldw] OpenAPI check skipped:",
      (error as any)?.message || error
    )
  }
}

export const initBackground = async (
  options: BackgroundInitOptions
): Promise<BackgroundInitResult> => {
  const {
    storage,
    contextMenuId,
    saveToNotesMenuId,
    narrateSelectionMenuId,
    transcribeMenuId,
    warmModels,
    capabilities,
    onActionIconClickChange,
    onContextMenuClickChange
  } = options

  try {
    await browser.contextMenus.removeAll()
  } catch (error) {
    console.debug(
      "[tldw] contextMenus.removeAll failed:",
      (error as any)?.message || error
    )
  }

  const contextMenuTitle = {
    webui: browser.i18n.getMessage("openOptionToChat"),
    sidePanel: browser.i18n.getMessage("openSidePanelToChat")
  }

  storage.watch({
    actionIconClick: (value) => {
      const oldValue = value?.oldValue || "webui"
      const newValue = value?.newValue || "webui"
      if (oldValue !== newValue) {
        onActionIconClickChange(newValue)
      }
    },
    contextMenuClick: (value) => {
      const oldValue = value?.oldValue || "sidePanel"
      const newValue = value?.newValue || "sidePanel"
      if (oldValue !== newValue) {
        onContextMenuClickChange(newValue)
        browser.contextMenus.remove(contextMenuId[oldValue])
        browser.contextMenus.create({
          id: contextMenuId[newValue],
          title: contextMenuTitle[newValue],
          contexts: ["page", "selection"]
        })
      }
    },
    tldwConfig: (value) => {
      const nextUrl = getServerUrl(value?.newValue)
      const prevUrl = getServerUrl(value?.oldValue)
      const hasServer = nextUrl.length > 0
      void scheduleModelWarmAlarm(hasServer)
      if (hasServer && nextUrl !== prevUrl) {
        void warmModels(true)
      }
    }
  })

  const data = await getInitialConfig()
  onContextMenuClickChange(data.contextMenuClick)
  onActionIconClickChange(data.actionIconClick)

  browser.contextMenus.create({
    id: contextMenuId[data.contextMenuClick],
    title: contextMenuTitle[data.contextMenuClick],
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
    id: "contextual-popup-pa",
    title: browser.i18n.getMessage("contextCopilotPopup"),
    contexts: ["selection"]
  })
  browser.contextMenus.create({
    id: narrateSelectionMenuId,
    title: browser.i18n.getMessage("contextNarrateSelection"),
    contexts: ["selection"]
  })
  browser.contextMenus.create({
    id: saveToNotesMenuId,
    title: browser.i18n.getMessage("contextSaveToNotes"),
    contexts: ["selection"]
  })

  if (capabilities.sendToTldw) {
    browser.contextMenus.create({
      id: "send-to-tldw",
      title: browser.i18n.getMessage("contextSendToTldw"),
      contexts: ["page", "link"]
    })
  }

  if (capabilities.processLocal) {
    browser.contextMenus.create({
      id: "process-local-tldw",
      title: browser.i18n.getMessage("contextProcessLocalTldw"),
      contexts: ["page", "link"]
    })
  }

  if (capabilities.transcribe) {
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
  }

  if (capabilities.openApiCheck) {
    await checkOpenApiDrift(storage)
  }

  let hasServer = false
  try {
    const cfg = await storage.get<any>("tldwConfig")
    hasServer = getServerUrl(cfg).length > 0
  } catch {
    hasServer = false
  }

  if (hasServer) {
    await warmModels(true)
  }
  await scheduleModelWarmAlarm(hasServer)

  return { modelWarmAlarmName: MODEL_WARM_ALARM_NAME }
}

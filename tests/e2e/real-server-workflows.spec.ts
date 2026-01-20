import { expect, test, type Locator, type Page } from "@playwright/test"
import { launchWithExtension } from "./utils/extension"
import { grantHostPermission } from "./utils/permissions"
import { requireRealServerConfig } from "./utils/real-server"
import {
  logConnectionSnapshot,
  setSelectedModel,
  waitForConnectionStore
} from "./utils/connection"
import { FEATURE_FLAG_KEYS, withFeatures } from "./utils/feature-flags"

const normalizeServerUrl = (value: string) =>
  value.match(/^https?:\/\//) ? value : `http://${value}`

const normalizePath = (value: string) => {
  const trimmed = String(value || "").trim().replace(/^\/+|\/+$/g, "")
  return trimmed ? `/${trimmed}` : ""
}

const joinUrl = (base: string, path: string) => {
  const trimmedBase = base.replace(/\/$/, "")
  const trimmedPath = path.startsWith("/") ? path : `/${path}`
  return `${trimmedBase}${trimmedPath}`
}

const getFirstModelId = (payload: any): string | null => {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.models)
      ? payload.models
      : []
  const candidate = list.find((m: any) => m?.id || m?.model || m?.name)
  const id = candidate?.id || candidate?.model || candidate?.name
  return id ? String(id) : null
}

const fetchWithKey = async (
  url: string,
  apiKey: string,
  init: RequestInit = {}
) => {
  const headers = {
    "x-api-key": apiKey,
    ...(init.headers || {})
  }
  return fetch(url, { ...init, headers })
}

const fetchWithKeyTimeout = async (
  url: string,
  apiKey: string,
  init: RequestInit = {},
  timeoutMs = 15000
) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchWithKey(url, apiKey, {
      ...init,
      signal: controller.signal
    })
  } catch (error: any) {
    if (error?.name === "AbortError") return null
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

const resolveMediaApi = async (serverUrl: string, apiKey: string) => {
  const normalized = serverUrl.replace(/\/$/, "")
  let apiBase = normalized
  const override = process.env.TLDW_E2E_MEDIA_BASE
  let mediaBasePath = normalizePath(override || "/api/v1/media")

  const openApi = await fetchWithKey(
    `${normalized}/openapi.json`,
    apiKey
  ).catch(() => null)
  if (openApi?.ok) {
    const payload = await openApi.json().catch(() => null)
    const servers = Array.isArray(payload?.servers) ? payload.servers : []
    const serverEntry = servers.find(
      (entry: any) => typeof entry?.url === "string"
    )
    const openApiServerUrl =
      typeof serverEntry?.url === "string" ? serverEntry.url : ""
    if (openApiServerUrl && openApiServerUrl !== "/") {
      if (
        openApiServerUrl.startsWith("http://") ||
        openApiServerUrl.startsWith("https://")
      ) {
        apiBase = openApiServerUrl.replace(/\/$/, "")
      } else {
        apiBase = `${normalized}${openApiServerUrl.startsWith("/") ? "" : "/"}${openApiServerUrl}`.replace(
          /\/$/,
          ""
        )
      }
    }

    if (!override) {
      const paths =
        payload?.paths && typeof payload.paths === "object"
          ? Object.keys(payload.paths)
          : []
      const candidates = ["/api/v1/media", "/api/media", "/media"]
      for (const candidate of candidates) {
        const normalizedCandidate = normalizePath(candidate)
        if (
          paths.includes(normalizedCandidate) ||
          paths.includes(`${normalizedCandidate}/`) ||
          paths.includes(`${normalizedCandidate}/search`)
        ) {
          mediaBasePath = normalizedCandidate
          break
        }
      }
    }
  }

  return { apiBase, mediaBasePath }
}

const preflightMediaApi = async (
  apiBase: string,
  mediaBasePath: string,
  apiKey: string
) => {
  const listUrl = joinUrl(
    apiBase,
    `${mediaBasePath}?page=1&results_per_page=1`
  )
  const listRes = await fetchWithKey(listUrl, apiKey).catch(() => null)
  if (listRes?.ok) return
  if (listRes && listRes.status !== 404) {
    const body = await listRes.text().catch(() => "")
    throw new Error(
      `Media API preflight failed: ${listRes.status} ${listRes.statusText} ${body}`
    )
  }

  const searchUrl = joinUrl(
    apiBase,
    `${mediaBasePath}/search?page=1&results_per_page=1`
  )
  const searchRes = await fetchWithKey(searchUrl, apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "e2e-preflight",
      fields: ["title", "content"],
      sort_by: "relevance"
    })
  }).catch(() => null)
  if (searchRes?.ok) return
  const body = await searchRes?.text().catch(() => "")
  throw new Error(
    `Media API preflight failed: ${searchRes?.status ?? "no response"} ${searchRes?.statusText ?? ""} ${body}`
  )
}

const skipOrThrow = (condition: boolean, message: string) => {
  if (!condition) return
  throw new Error(message)
}

const waitForConnected = async (page: Page, label: string) => {
  await waitForConnectionStore(page, label)
  await page.evaluate(() => {
    const store = (window as any).__tldw_useConnectionStore
    try {
      store?.getState?.().markFirstRunComplete?.()
      store?.getState?.().checkOnce?.()
    } catch {
      // ignore check errors
    }
    window.dispatchEvent(new CustomEvent("tldw:check-connection"))
  })
  try {
    await page.waitForFunction(
      () => {
        const store = (window as any).__tldw_useConnectionStore
        const state = store?.getState?.().state
        return state?.isConnected === true && state?.phase === "connected"
      },
      undefined,
      { timeout: 20000 }
    )
  } catch (error) {
    await logConnectionSnapshot(page, `${label}-timeout`)
    throw error
  }
}

const ensureServerPersistence = async (page: Page) => {
  const persistenceSwitch = page.getByRole("switch", {
    name: /Save chat to history|Temporary chat/i
  })
  if ((await persistenceSwitch.count()) === 0) return
  const checked = await persistenceSwitch
    .getAttribute("aria-checked")
    .catch(() => null)
  if (checked !== "true") {
    await persistenceSwitch.click()
  }
}

const ensureChatSidebarExpanded = async (page: Page) => {
  const sidebar = page.getByTestId("chat-sidebar")
  await expect(sidebar).toBeVisible({ timeout: 20000 })
  const search = page.getByTestId("chat-sidebar-search")
  const expanded = await search.isVisible().catch(() => false)
  if (!expanded) {
    const toggle = page.getByTestId("chat-sidebar-toggle")
    if ((await toggle.count()) > 0) {
      await toggle.first().click()
      await expect(search).toBeVisible({ timeout: 15000 })
    }
  }
  return sidebar
}

const sendChatMessage = async (page: Page, message: string) => {
  let input = page.getByTestId("chat-input")
  if ((await input.count()) === 0) {
    input = page.getByPlaceholder(/Ask anything|Type a message/i)
  }
  const visible = await input.isVisible().catch(() => false)
  if (!visible) {
    const startButton = page.getByRole("button", {
      name: /Start chatting/i
    })
    if (await startButton.isVisible().catch(() => false)) {
      await startButton.click()
    }
  }
  if (!(await input.isVisible().catch(() => false))) {
    input = page.getByPlaceholder(/Ask anything|Type a message/i)
  }
  await expect(input).toBeVisible({ timeout: 15000 })
  await expect(input).toBeEditable({ timeout: 15000 })
  await input.fill(message)

  const sendButton = page.locator('[data-testid="chat-send"]')
  if ((await sendButton.count()) > 0) {
    await sendButton.click()
  } else {
    await input.press("Enter")
  }
}

const waitForAssistantMessage = async (page: Page) => {
  const assistantMessages = page.locator(
    '[data-testid="chat-message"][data-role="assistant"]'
  )
  await expect
    .poll(async () => assistantMessages.count(), { timeout: 60000 })
    .toBeGreaterThan(0)
  const lastAssistant = assistantMessages.last()
  await expect(lastAssistant).toBeVisible({ timeout: 60000 })
  const stopButton = page.getByRole("button", {
    name: /Stop streaming/i
  })
  if ((await stopButton.count()) > 0) {
    await stopButton.waitFor({ state: "visible", timeout: 10000 }).catch(() => {})
    await stopButton.waitFor({ state: "hidden", timeout: 60000 }).catch(() => {})
  }
  return lastAssistant
}

const getAssistantText = async (assistant: Locator) => {
  const body = assistant.locator(".prose").first()
  const bodyText = await body.innerText().catch(() => "")
  if (bodyText && bodyText.trim()) {
    return bodyText
  }
  return (await assistant.innerText().catch(() => "")) || ""
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const parseListPayload = (
  payload: any,
  extraKeys: string[] = []
): any[] => {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== "object") return []
  const keys = [
    ...extraKeys,
    "items",
    "results",
    "data",
    "documents",
    "docs",
    "characters",
    "media"
  ]
  for (const key of keys) {
    const value = (payload as any)[key]
    if (Array.isArray(value)) return value
  }
  return []
}

const fetchNoteByTitle = async (
  serverUrl: string,
  apiKey: string,
  title: string
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const searchUrl = `${normalized}/api/v1/notes/search/?query=${encodeURIComponent(
    title
  )}&limit=50&offset=0&include_keywords=true`
  let list: any[] = []
  const searchRes = await fetchWithKey(searchUrl, apiKey).catch(() => null)
  if (searchRes?.ok) {
    const payload = await searchRes.json().catch(() => [])
    list = parseListPayload(payload)
  }

  if (!list.length) {
    const listRes = await fetchWithKey(
      `${normalized}/api/v1/notes/?page=1&results_per_page=50`,
      apiKey
    ).catch(() => null)
    if (listRes?.ok) {
      const payload = await listRes.json().catch(() => [])
      list = parseListPayload(payload)
    }
  }

  const exact = list.find(
    (note: any) => String(note?.title || "") === title
  )
  if (exact) return exact
  return (
    list.find(
      (note: any) =>
        String(note?.title || "").includes(title)
    ) || null
  )
}

const pollForNoteByTitle = async (
  serverUrl: string,
  apiKey: string,
  title: string,
  timeoutMs = 30000
) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const note = await fetchNoteByTitle(serverUrl, apiKey, title)
    if (note) return note
    await new Promise((r) => setTimeout(r, 1000))
  }
  return null
}

const extractNoteBacklink = (note: any) => {
  const meta = note?.metadata || {}
  const backlinks = meta?.backlinks || meta || {}
  const conversation =
    note?.conversation_id ??
    backlinks?.conversation_id ??
    backlinks?.conversationId ??
    meta?.conversation_id ??
    null
  const message =
    note?.message_id ??
    backlinks?.message_id ??
    backlinks?.messageId ??
    meta?.message_id ??
    null
  return {
    conversation_id: conversation != null ? String(conversation) : null,
    message_id: message != null ? String(message) : null
  }
}

const pollForNoteByConversation = async (
  serverUrl: string,
  apiKey: string,
  conversationId: string,
  messageId?: string | null,
  timeoutMs = 60000
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const deadline = Date.now() + timeoutMs
  const targetConversation = String(conversationId)
  const targetMessage = messageId ? String(messageId) : null
  while (Date.now() < deadline) {
    const listRes = await fetchWithKeyTimeout(
      `${normalized}/api/v1/notes/?page=1&results_per_page=50`,
      apiKey
    ).catch(() => null)
    if (listRes?.ok) {
      const payload = await listRes.json().catch(() => [])
      const list = parseListPayload(payload)
      const match = list.find((note: any) => {
        const links = extractNoteBacklink(note)
        if (links.conversation_id === targetConversation) return true
        if (targetMessage && links.message_id === targetMessage) return true
        return false
      })
      if (match) return match
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return null
}

const findNoteRowInList = async (
  page: Page,
  conversationId: string | null,
  query: string,
  maxPages = 5
) => {
  const targetConversation = conversationId ? String(conversationId) : ""
  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const conversationLocator = targetConversation
      ? page.locator("button").filter({ hasText: targetConversation })
      : null
    const queryLocator = page.locator("button").filter({ hasText: query })
    if (conversationLocator && (await conversationLocator.count()) > 0) {
      return conversationLocator.first()
    }
    if ((await queryLocator.count()) > 0) {
      return queryLocator.first()
    }
    const nextPage = page.getByRole("button", { name: /Next Page/i })
    if ((await nextPage.count()) === 0) return null
    const disabled = await nextPage.getAttribute("aria-disabled")
    if (disabled === "true") return null
    await nextPage.click()
    await page.waitForTimeout(1000)
  }
  return null
}

const createSeedNoteForRag = async (
  serverUrl: string,
  apiKey: string,
  token: string
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const title = `E2E RAG Seed ${token}`
  const content = `# E2E RAG Seed\n\nToken: ${token}\n\nThis note exists to seed Knowledge QA.`
  const res = await fetchWithKey(`${normalized}/api/v1/notes/`, apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      content,
      keywords: [`e2e-rag-${token}`]
    })
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `RAG seed note create failed: ${res.status} ${res.statusText} ${body}`
    )
  }
  const payload = await res.json().catch(() => null)
  return { note: payload, title, content }
}

const pollForRagSearch = async (
  serverUrl: string,
  apiKey: string,
  query: string,
  timeoutMs = 90000
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const deadline = Date.now() + timeoutMs
  let lastStatus: number | null = null
  let lastBody = ""
  while (Date.now() < deadline) {
    const res = await fetchWithKey(`${normalized}/api/v1/rag/search`, apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        sources: ["notes"]
      })
    }).catch(() => null)
    if (res?.ok) {
      const payload = await res.json().catch(() => null)
      const docs = parseListPayload(payload)
      const answer =
        payload?.generated_answer ||
        payload?.answer ||
        payload?.response ||
        ""
      if (Array.isArray(docs) && docs.length > 0) return payload
      if (typeof answer === "string" && answer.trim()) return payload
    } else if (res) {
      lastStatus = res.status
      lastBody = await res.text().catch(() => "")
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error(
    `RAG search did not return results for "${query}". Last status: ${String(
      lastStatus ?? "unknown"
    )} ${lastBody}`
  )
}

const createSeedFlashcard = async (
  serverUrl: string,
  apiKey: string,
  front: string,
  back: string
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const decksRes = await fetchWithKey(
    `${normalized}/api/v1/flashcards/decks`,
    apiKey
  )
  if (!decksRes.ok) {
    const body = await decksRes.text().catch(() => "")
    throw new Error(
      `Flashcards decks fetch failed: ${decksRes.status} ${decksRes.statusText} ${body}`
    )
  }
  const decksPayload = await decksRes.json().catch(() => [])
  const decks = parseListPayload(decksPayload, ["decks"])
  const deckId =
    decks.length > 0 && decks[0]?.id != null ? decks[0].id : undefined
  const createRes = await fetchWithKey(
    `${normalized}/api/v1/flashcards`,
    apiKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deck_id: deckId,
        front,
        back
      })
    }
  )
  if (!createRes.ok) {
    const body = await createRes.text().catch(() => "")
    throw new Error(
      `Flashcard create failed: ${createRes.status} ${createRes.statusText} ${body}`
    )
  }
  const card = await createRes.json().catch(() => null)
  return { deckId, card }
}

const clearRequestErrors = async (page: Page) => {
  await page.evaluate(async () => {
    const w: any = window as any
    const area = w?.chrome?.storage?.local
    if (!area?.set) return
    await new Promise<void>((resolve) => {
      area.set({ __tldwLastRequestError: null, __tldwRequestErrors: [] }, () =>
        resolve()
      )
    })
  })
}

const readLastRequestError = async (page: Page) =>
  await page.evaluate(async () => {
    const w: any = window as any
    const area = w?.chrome?.storage?.local
    if (!area?.get) return null
    return await new Promise<{
      last: any | null
      recent: any[] | null
    }>((resolve) => {
      area.get(
        ["__tldwLastRequestError", "__tldwRequestErrors"],
        (items: any) => {
          resolve({
            last: items?.__tldwLastRequestError ?? null,
            recent: Array.isArray(items?.__tldwRequestErrors)
              ? items.__tldwRequestErrors.slice(0, 5)
              : null
          })
        }
      )
    })
  })

const logFlashcardsSnapshot = async (
  serverUrl: string,
  apiKey: string,
  label: string
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const res = await fetchWithKey(
    `${normalized}/api/v1/flashcards?limit=5&offset=0&due_status=all&order_by=created_at`,
    apiKey
  ).catch(() => null)
  if (!res?.ok) {
    const body = await res?.text().catch(() => "")
    console.log(
      `[e2e] flashcards snapshot ${label} failed: ${res?.status} ${res?.statusText} ${body}`
    )
    return
  }
  const payload = await res.json().catch(() => null)
  const items = parseListPayload(payload, ["items", "results", "data"]).slice(
    0,
    5
  )
  const summary = items.map((item: any) => ({
    uuid: item?.uuid ?? null,
    deck_id: item?.deck_id ?? null,
    due_at: item?.due_at ?? null,
    front:
      typeof item?.front === "string"
        ? item.front.slice(0, 80)
        : String(item?.front || "").slice(0, 80),
    back:
      typeof item?.back === "string"
        ? item.back.slice(0, 80)
        : String(item?.back || "").slice(0, 80)
  }))
  console.log(
    `[e2e] flashcards snapshot ${label}`,
    JSON.stringify({
      count: payload?.count ?? null,
      items: summary
    })
  )
}

const logChatMessagesSnapshot = async (
  serverUrl: string,
  apiKey: string,
  chatId: string,
  label: string
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const res = await fetchWithKey(
    `${normalized}/api/v1/chats/${encodeURIComponent(chatId)}/messages`,
    apiKey
  ).catch(() => null)
  if (!res?.ok) {
    const body = await res?.text().catch(() => "")
    console.log(
      `[e2e] chat messages snapshot ${label} failed: ${res?.status} ${res?.statusText} ${body}`
    )
    return
  }
  const payload = await res.json().catch(() => null)
  const list: any[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.messages)
      ? payload.messages
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload?.data)
            ? payload.data
            : []
  const summary = list.slice(-5).map((item) => ({
    id: item?.id ?? item?.message_id ?? null,
    role: item?.role ?? item?.sender ?? item?.author ?? null,
    content:
      typeof item?.content === "string"
        ? item.content.slice(0, 80)
        : typeof item?.message?.content === "string"
          ? item.message.content.slice(0, 80)
          : null
  }))
  console.log(
    `[e2e] chat messages snapshot ${label}`,
    JSON.stringify({
      count: list.length,
      tail: summary
    })
  )
}

const probeSaveChatKnowledge = async (
  serverUrl: string,
  apiKey: string,
  payload: {
    conversation_id: string
    message_id: string
    snippet: string
    make_flashcard: boolean
  },
  label: string
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const res = await fetchWithKey(
    `${normalized}/api/v1/chat/knowledge/save`,
    apiKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  ).catch(() => null)
  if (!res) {
    console.log(`[e2e] chat knowledge save probe ${label} failed: no response`)
    return
  }
  const bodyText = await res.text().catch(() => "")
  let parsed: any = null
  if (bodyText) {
    try {
      parsed = JSON.parse(bodyText)
    } catch {
      parsed = null
    }
  }
  const bodySnippet =
    bodyText.length > 500
      ? `${bodyText.slice(0, 500)}...(truncated)`
      : bodyText
  console.log(
    `[e2e] chat knowledge save probe ${label}`,
    JSON.stringify({
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      response: parsed ?? bodySnippet,
      payload: {
        conversation_id: payload.conversation_id,
        message_id: payload.message_id,
        snippet_preview: payload.snippet.slice(0, 120),
        snippet_length: payload.snippet.length,
        make_flashcard: payload.make_flashcard
      }
    })
  )
}

const fetchRecentFlashcards = async (
  serverUrl: string,
  apiKey: string,
  limit = 10
): Promise<any[]> => {
  const normalized = serverUrl.replace(/\/$/, "")
  const res = await fetchWithKey(
    `${normalized}/api/v1/flashcards?limit=${limit}&offset=0&due_status=all&order_by=created_at`,
    apiKey
  ).catch(() => null)
  if (!res?.ok) {
    const body = await res?.text().catch(() => "")
    throw new Error(
      `Flashcards list fetch failed: ${res?.status} ${res?.statusText} ${body}`
    )
  }
  const payload = await res.json().catch(() => null)
  return parseListPayload(payload, ["items", "results", "data"])
}

const pollForNewFlashcard = async (
  serverUrl: string,
  apiKey: string,
  baselineIds: Set<string>,
  snippet: string,
  timeoutMs = 60000
) => {
  const deadline = Date.now() + timeoutMs
  const target = normalizeMessageContent(snippet).slice(0, 80)
  while (Date.now() < deadline) {
    const items = await fetchRecentFlashcards(serverUrl, apiKey, 20)
    const match = items.find((item: any) => {
      const id = item?.uuid != null ? String(item.uuid) : ""
      if (!id || baselineIds.has(id)) return false
      if (!target) return true
      const front = normalizeMessageContent(item?.front ?? "")
      const back = normalizeMessageContent(item?.back ?? "")
      return front.includes(target) || back.includes(target)
    })
    if (match) return match
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error("New flashcard did not appear after saving.")
}

const clearReviewDeckSelection = async (page: Page) => {
  const reviewDeckSelect = page.getByTestId("flashcards-review-deck-select")
  if ((await reviewDeckSelect.count()) === 0) return
  const clearButton = reviewDeckSelect.locator(".ant-select-clear")
  const clearVisible = await clearButton.isVisible().catch(() => false)
  if (clearVisible) {
    await clearButton.click()
    return
  }
  await reviewDeckSelect.click().catch(() => {})
  await page.keyboard.press("Backspace").catch(() => {})
}

const normalizeCharacterForStorage = (record: any) => {
  const id =
    record?.id ??
    record?.slug ??
    record?.name ??
    record?.title ??
    null
  const name =
    record?.name ??
    record?.title ??
    record?.slug ??
    ""
  return {
    id: id != null ? String(id) : "",
    name: String(name),
    system_prompt:
      record?.system_prompt ??
      record?.systemPrompt ??
      record?.instructions ??
      "",
    greeting:
      record?.greeting ??
      record?.first_message ??
      record?.firstMessage ??
      record?.greet ??
      "",
    avatar_url: record?.avatar_url ?? ""
  }
}

const setSelectedCharacterInStorage = async (
  page: Page,
  character: ReturnType<typeof normalizeCharacterForStorage>
) => {
  await page.evaluate(async (payload) => {
    const w: any = window as any
    const hasLocal =
      w?.chrome?.storage?.local?.set && w?.chrome?.storage?.local?.get
    const hasSync =
      w?.chrome?.storage?.sync?.set && w?.chrome?.storage?.sync?.get

    const setValue = (
      area: typeof chrome.storage.local | typeof chrome.storage.sync,
      items: Record<string, unknown>
    ) =>
      new Promise<void>((resolve, reject) => {
        area.set(items, () => {
          const err = w?.chrome?.runtime?.lastError
          if (err) reject(err)
          else resolve()
        })
      })

    const stored = JSON.stringify(payload)
    if (hasLocal) {
      await setValue(w.chrome.storage.local, { selectedCharacter: stored })
    }
    if (hasSync) {
      await setValue(w.chrome.storage.sync, { selectedCharacter: stored })
    }
  }, character)
}

const setLastNoteId = async (page: Page, noteId: string) => {
  await page.evaluate(async (id) => {
    const w: any = window as any
    try {
      window.localStorage.setItem("tldw:lastNoteId", String(id))
    } catch {
      // ignore localStorage errors
    }
    const area = w?.chrome?.storage?.local
    if (!area?.set) return
    await new Promise<void>((resolve) => {
      area.set({ "tldw:lastNoteId": String(id) }, () => resolve())
    })
  }, noteId)
}

const pollForCharacterByName = async (
  serverUrl: string,
  apiKey: string,
  name: string,
  timeoutMs = 30000
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const searchRes = await fetchWithKey(
      `${normalized}/api/v1/characters/search?query=${encodeURIComponent(
        name
      )}`,
      apiKey
    ).catch(() => null)
    if (searchRes?.ok) {
      const payload = await searchRes.json().catch(() => [])
      const list = parseListPayload(payload)
      const match = list.find((item: any) => {
        const candidate =
          item?.name ?? item?.title ?? item?.slug ?? ""
        return String(candidate) === String(name)
      })
      if (match) return match
    }

    const listRes = await fetchWithKey(
      `${normalized}/api/v1/characters/`,
      apiKey
    ).catch(() => null)
    if (listRes?.ok) {
      const payload = await listRes.json().catch(() => [])
      const list = parseListPayload(payload, ["characters"])
      const match = list.find((item: any) => {
        const candidate =
          item?.name ?? item?.title ?? item?.slug ?? ""
        return String(candidate) === String(name)
      })
      if (match) return match
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return null
}

const normalizeMessageContent = (value: unknown) =>
  String(value || "").replace(/\s+/g, " ").trim()

const pollForServerAssistantMessageId = async (
  serverUrl: string,
  apiKey: string,
  chatId: string,
  assistantText: string,
  timeoutMs = 60000
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const deadline = Date.now() + timeoutMs
  const target = normalizeMessageContent(assistantText)
  const targetPrefix = target.slice(0, 80)
  while (Date.now() < deadline) {
    const res = await fetchWithKeyTimeout(
      `${normalized}/api/v1/chats/${encodeURIComponent(chatId)}/messages`,
      apiKey
    ).catch(() => null)
    if (res?.ok) {
      const payload = await res.json().catch(() => null)
      const list: any[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.messages)
          ? payload.messages
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.results)
              ? payload.results
              : Array.isArray(payload?.data)
                ? payload.data
                : []
      const assistants = list.filter((item) => {
        const roleCandidate =
          item?.role ?? item?.sender ?? item?.author ?? item?.message?.role
        const isBot =
          item?.is_bot === true ||
          item?.isBot === true ||
          String(roleCandidate || "")
            .toLowerCase()
            .includes("assistant")
        return isBot
      })
      if (assistants.length > 0) {
        const exactMatch = assistants.find((item) => {
          const content = normalizeMessageContent(
            item?.content ?? item?.message?.content ?? ""
          )
          return content && (content === target || content.startsWith(targetPrefix))
        })
        const match = exactMatch ?? assistants[assistants.length - 1]
        if (match?.id != null) {
          return String(match.id)
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  return null
}

const pollForMediaMatch = async (
  serverUrl: string,
  apiKey: string,
  query: string,
  timeoutMs = 180000,
  mediaBasePath = "/api/v1/media"
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const basePath = normalizePath(mediaBasePath || "/api/v1/media")
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await fetchWithKeyTimeout(
      `${normalized}${basePath}/search?page=1&results_per_page=20`,
      apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          fields: ["title", "content"],
          sort_by: "relevance"
        })
      }
    ).catch(() => null)
    if (res?.ok) {
      const payload = await res.json().catch(() => null)
      const items = parseListPayload(payload, ["items", "results"])
      if (items.length > 0) return items[0]
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error(`Timed out waiting for media search results for "${query}".`)
}

const deleteCharacterByName = async (
  serverUrl: string,
  apiKey: string,
  name: string
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const primary = await fetchWithKeyTimeout(
    `${normalized}/api/v1/characters/`,
    apiKey
  ).catch(() => null)
  const res =
    primary && primary.ok
      ? primary
      : await fetchWithKeyTimeout(
          `${normalized}/api/v1/characters`,
          apiKey
        ).catch(() => null)
  if (!res?.ok) return
  const payload = await res.json().catch(() => null)
  const characters = parseListPayload(payload, ["characters"])
  const match = characters.find((c: any) => {
    const label = String(c?.name || c?.title || "").trim()
    return label === name
  })
  if (!match?.id) return
  await fetchWithKeyTimeout(
    `${normalized}/api/v1/characters/${encodeURIComponent(String(match.id))}`,
    apiKey,
    { method: "DELETE" }
  ).catch(() => {})
}

const createCharacterByName = async (
  serverUrl: string,
  apiKey: string,
  name: string
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const payload = { name }
  const createPrimary = await fetchWithKey(
    `${normalized}/api/v1/characters/`,
    apiKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  ).catch(() => null)
  const createRes =
    createPrimary && createPrimary.ok
      ? createPrimary
      : await fetchWithKey(`${normalized}/api/v1/characters`, apiKey, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).catch(() => null)
  if (!createRes?.ok) {
    const body = await createRes?.text().catch(() => "")
    throw new Error(
      `Character create failed: ${createRes?.status} ${createRes?.statusText} ${body}`
    )
  }
  const created = await createRes.json().catch(() => null)
  return created?.id ?? created?.uuid ?? null
}

const deleteWorldBookByName = async (
  serverUrl: string,
  apiKey: string,
  name: string
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const list = await fetchWithKey(
    `${normalized}/api/v1/characters/world-books`,
    apiKey
  ).catch(() => null)
  if (!list?.ok) return
  const payload = await list.json().catch(() => null)
  const books = parseListPayload(payload, ["world_books"])
  const match = books.find((b: any) => String(b?.name || "") === name)
  if (!match?.id) return
  await fetchWithKey(
    `${normalized}/api/v1/characters/world-books/${encodeURIComponent(
      String(match.id)
    )}`,
    apiKey,
    { method: "DELETE" }
  ).catch(() => {})
}

const deleteDictionaryByName = async (
  serverUrl: string,
  apiKey: string,
  name: string
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const list = await fetchWithKey(
    `${normalized}/api/v1/chat/dictionaries?include_inactive=true`,
    apiKey
  ).catch(() => null)
  if (!list?.ok) return
  const payload = await list.json().catch(() => null)
  const dictionaries = parseListPayload(payload, ["dictionaries"])
  const match = dictionaries.find((d: any) => String(d?.name || "") === name)
  if (!match?.id) return
  await fetchWithKey(
    `${normalized}/api/v1/chat/dictionaries/${encodeURIComponent(
      String(match.id)
    )}`,
    apiKey,
    { method: "DELETE" }
  ).catch(() => {})
}

const createPrompt = async (
  serverUrl: string,
  apiKey: string,
  payload: {
    name: string
    system_prompt: string
    user_prompt: string
    keywords?: string[]
  }
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const createPrimary = await fetchWithKey(
    `${normalized}/api/v1/prompts`,
    apiKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  ).catch(() => null)
  const createRes =
    createPrimary && createPrimary.ok
      ? createPrimary
      : await fetchWithKey(`${normalized}/api/v1/prompts/`, apiKey, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).catch(() => null)
  if (!createRes?.ok) {
    const body = await createRes?.text().catch(() => "")
    throw new Error(
      `Prompt create failed: ${createRes?.status} ${createRes?.statusText} ${body}`
    )
  }
  const created = await createRes.json().catch(() => null)
  return created?.id ?? created?.uuid ?? created?.name ?? null
}

const deletePromptById = async (
  serverUrl: string,
  apiKey: string,
  promptId: string | number
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  await fetchWithKey(
    `${normalized}/api/v1/prompts/${encodeURIComponent(String(promptId))}`,
    apiKey,
    { method: "DELETE" }
  ).catch(() => {})
}

const pollForChatByTitle = async (
  serverUrl: string,
  apiKey: string,
  title: string,
  timeoutMs = 45000
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const deadline = Date.now() + timeoutMs
  const urls = [
    `${normalized}/api/v1/chats/?limit=50&offset=0`,
    `${normalized}/api/v1/chats?limit=50&offset=0`,
    `${normalized}/api/v1/chats/`,
    `${normalized}/api/v1/chats`
  ]
  while (Date.now() < deadline) {
    for (const url of urls) {
      const res = await fetchWithKey(url, apiKey).catch(() => null)
      if (!res?.ok) continue
      const payload = await res.json().catch(() => [])
      const list = parseListPayload(payload, ["chats"])
      const match = list.find((chat: any) => {
        const label = String(chat?.title ?? chat?.name ?? "").trim()
        return label === title
      })
      if (match) return match
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return null
}

const deleteChatById = async (
  serverUrl: string,
  apiKey: string,
  chatId: string
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  await fetchWithKey(
    `${normalized}/api/v1/chats/${encodeURIComponent(String(chatId))}`,
    apiKey,
    { method: "DELETE" }
  ).catch(() => {})
}

const createQuiz = async (
  serverUrl: string,
  apiKey: string,
  name: string
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const payload = {
    name,
    description: "Quiz created by Playwright."
  }
  const createPrimary = await fetchWithKey(
    `${normalized}/api/v1/quizzes`,
    apiKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  ).catch(() => null)
  const createRes =
    createPrimary && createPrimary.ok
      ? createPrimary
      : await fetchWithKey(`${normalized}/api/v1/quizzes/`, apiKey, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).catch(() => null)
  if (!createRes?.ok) {
    const body = await createRes?.text().catch(() => "")
    throw new Error(
      `Quiz create failed: ${createRes?.status} ${createRes?.statusText} ${body}`
    )
  }
  const created = await createRes.json().catch(() => null)
  return created?.id ?? created?.quiz_id ?? null
}

const addQuizQuestion = async (
  serverUrl: string,
  apiKey: string,
  quizId: string | number,
  payload: Record<string, any>
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const res = await fetchWithKey(
    `${normalized}/api/v1/quizzes/${encodeURIComponent(
      String(quizId)
    )}/questions`,
    apiKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  ).catch(() => null)
  if (!res?.ok) {
    const body = await res?.text().catch(() => "")
    throw new Error(
      `Quiz question create failed: ${res?.status} ${res?.statusText} ${body}`
    )
  }
  return res.json().catch(() => null)
}

const deleteQuizById = async (
  serverUrl: string,
  apiKey: string,
  quizId: string | number
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  await fetchWithKey(
    `${normalized}/api/v1/quizzes/${encodeURIComponent(String(quizId))}`,
    apiKey,
    { method: "DELETE" }
  ).catch(() => {})
}

const createChatWithMessage = async (
  serverUrl: string,
  apiKey: string,
  characterId: string | number,
  title: string,
  message: string
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const payload = {
    title,
    character_id: characterId,
    state: "in-progress",
    source: "e2e"
  }
  const createPrimary = await fetchWithKey(
    `${normalized}/api/v1/chats/`,
    apiKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  ).catch(() => null)
  const createRes =
    createPrimary && createPrimary.ok
      ? createPrimary
      : await fetchWithKey(`${normalized}/api/v1/chats`, apiKey, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).catch(() => null)
  if (!createRes?.ok) {
    const body = await createRes?.text().catch(() => "")
    throw new Error(
      `Chat create failed: ${createRes?.status} ${createRes?.statusText} ${body}`
    )
  }
  const created = await createRes.json().catch(() => null)
  const rawId = created?.id ?? created?.chat_id ?? created?.conversation_id ?? null
  if (!rawId) {
    throw new Error("Chat create did not return an id.")
  }
  const chatId = String(rawId)
  if (message.trim()) {
    await fetchWithKey(
      `${normalized}/api/v1/chats/${encodeURIComponent(chatId)}/messages`,
      apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: message })
      }
    ).catch(() => {})
  }
  return chatId
}

const deleteDataTableByName = async (
  serverUrl: string,
  apiKey: string,
  name: string
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const list = await fetchWithKey(
    `${normalized}/api/v1/data-tables?page=1&page_size=50`,
    apiKey
  ).catch(() => null)
  if (!list?.ok) return
  const payload = await list.json().catch(() => null)
  const tables = parseListPayload(payload, ["tables"])
  const match = tables.find((t: any) => String(t?.name || "") === name)
  if (!match?.id) return
  await fetchWithKey(
    `${normalized}/api/v1/data-tables/${encodeURIComponent(String(match.id))}`,
    apiKey,
    { method: "DELETE" }
  ).catch(() => {})
}

const cleanupMediaItem = async (
  serverUrl: string,
  apiKey: string,
  mediaId: string | number
) => {
  const normalized = serverUrl.replace(/\/$/, "")
  await fetchWithKey(
    `${normalized}/api/v1/media/${encodeURIComponent(String(mediaId))}`,
    apiKey,
    { method: "DELETE" }
  ).catch(() => {})
  await fetchWithKey(
    `${normalized}/api/v1/media/${encodeURIComponent(
      String(mediaId)
    )}/permanent`,
    apiKey,
    { method: "DELETE" }
  ).catch(() => {})
}

const fetchAudioProviders = async (serverUrl: string, apiKey: string) => {
  const normalized = serverUrl.replace(/\/$/, "")
  const res = await fetchWithKey(
    `${normalized}/api/v1/audio/providers`,
    apiKey
  ).catch(() => null)
  if (!res?.ok) return null
  const payload = await res.json().catch(() => null)
  const providers = payload?.providers ?? payload
  if (
    !providers ||
    typeof providers !== "object" ||
    Object.keys(providers).length === 0
  ) {
    return null
  }
  return payload
}

const selectTldwProvider = async (page: Page) => {
  await page.getByText("Text to speech").scrollIntoViewIfNeeded()
  const providerSelect = page.getByText("Browser TTS", { exact: false })
  await providerSelect.click()
  const option = page.getByRole("option", {
    name: /tldw server \(audio\/speech\)/i
  })
  const visible = await option
    .waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false)
  if (!visible) return false
  await option.click()
  return true
}

const selectServerTab = async (sidebar: Locator) => {
  const radio = sidebar.getByRole("radio", { name: /^Server/i })
  if ((await radio.count()) > 0) {
    await radio.first().click()
    return
  }
  const button = sidebar.getByRole("button", { name: /^Server/i })
  if ((await button.count()) > 0) {
    await button.first().click()
    return
  }
  await sidebar.getByText(/^Server/i).first().click()
}

test.describe("Real server end-to-end workflows", () => {
  test(
    "chat -> save to notes -> open linked conversation",
    async ({}, testInfo) => {
      test.setTimeout(180000)
      const debugLines: string[] = []
      const startedAt = Date.now()
      const safeStringify = (value: unknown) => {
        try {
          return JSON.stringify(value)
        } catch {
          return "\"[unserializable]\""
        }
      }
      const logStep = (message: string, details?: Record<string, unknown>) => {
        const payload = {
          elapsedMs: Date.now() - startedAt,
          ...(details || {})
        }
        const line = `[real-server-notes] ${message} ${safeStringify(
          payload
        )}`
        debugLines.push(line)
        console.log(line)
      }
      const step = async <T>(label: string, fn: () => Promise<T>) => {
        logStep(`start ${label}`)
        const stepStart = Date.now()
        try {
          const result = await test.step(label, fn)
          logStep(`done ${label}`, {
            durationMs: Date.now() - stepStart
          })
          return result
        } catch (error) {
          logStep(`error ${label}`, {
            durationMs: Date.now() - stepStart,
            error: String(error)
          })
          throw error
        }
      }
      const { serverUrl, apiKey } = requireRealServerConfig(test)
      const normalizedServerUrl = normalizeServerUrl(serverUrl)
      logStep("test config", { serverUrl: normalizedServerUrl })

      const modelsResponse = await step("preflight: models", async () => {
        const response = await fetchWithKey(
          `${normalizedServerUrl}/api/v1/llm/models/metadata`,
          apiKey
        )
        logStep("models preflight response", {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText
        })
        return response
      })
      if (!modelsResponse.ok) {
        const body = await modelsResponse.text().catch(() => "")
        skipOrThrow(
          true,
          `Chat models preflight failed: ${modelsResponse.status} ${modelsResponse.statusText} ${body}`
        )
        return
      }
      const modelId = getFirstModelId(
        await modelsResponse.json().catch(() => [])
      )
      if (!modelId) {
        skipOrThrow(true, "No chat models returned from tldw_server.")
        return
      }
      const selectedModelId = modelId.startsWith("tldw:")
        ? modelId
        : `tldw:${modelId}`
      logStep("selected model resolved", { selectedModelId })
  
      const notesResponse = await step("preflight: notes list", async () => {
        const response = await fetchWithKey(
          `${normalizedServerUrl}/api/v1/notes/?page=1&results_per_page=1`,
          apiKey
        )
        logStep("notes preflight response", {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText
        })
        return response
      })
      if (!notesResponse.ok) {
        const body = await notesResponse.text().catch(() => "")
        skipOrThrow(
          true,
          `Notes API preflight failed: ${notesResponse.status} ${notesResponse.statusText} ${body}`
        )
        return
      }
  
      const unique = Date.now()
      const characterName = `E2E Notes Character ${unique}`
      logStep("generated test identifiers", { unique, characterName })
      let createdCharacter = false
      let characterRecord: any | null = null
  
      const launchResult = await step("launch extension", async () =>
        launchWithExtension("", {
          seedConfig: {
            __tldw_first_run_complete: true,
            tldwConfig: {
              serverUrl: normalizedServerUrl,
              authMode: "single-user",
              apiKey
            }
          }
        })
      )
      const {
        context,
        page,
        openSidepanel,
        extensionId,
        optionsUrl,
        sidepanelUrl
      } = launchResult
      logStep("extension launched", { extensionId, optionsUrl, sidepanelUrl })
      const attachPageLogging = (targetPage: Page, tag: string) => {
        targetPage.on("console", (msg) => {
          const type = msg.type()
          if (type === "error" || type === "warning") {
            logStep(`${tag} console`, { type, text: msg.text() })
          }
        })
        targetPage.on("pageerror", (error) => {
          logStep(`${tag} pageerror`, { error: String(error) })
        })
      }
      attachPageLogging(page, "options")
  
      try {
        const origin = new URL(normalizedServerUrl).origin + "/*"
        const granted = await step("grant host permission", async () => {
          const result = await grantHostPermission(
            context,
            extensionId,
            origin
          )
          logStep("host permission result", { origin, granted: result })
          return result
        })
        if (!granted) {
          skipOrThrow(
            true,
            "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
          )
          return
        }
  
        const characterListResponse = await step(
          "preflight: characters list",
          async () => {
            const response = await fetchWithKey(
              `${normalizedServerUrl}/api/v1/characters/?page=1&results_per_page=1`,
              apiKey
            ).catch(() => null)
            logStep("characters preflight response", {
              ok: response?.ok ?? false,
              status: response?.status ?? null,
              statusText: response?.statusText ?? ""
            })
            return response
          }
        )
        if (!characterListResponse?.ok) {
          const body = await characterListResponse?.text().catch(() => "")
          skipOrThrow(
            true,
            `Characters API preflight failed: ${characterListResponse?.status} ${characterListResponse?.statusText} ${body}`
          )
          return
        }
        const characterId = await step("create character", async () => {
          const id = await createCharacterByName(
            normalizedServerUrl,
            apiKey,
            characterName
          )
          logStep("character created", { characterId: id })
          return id
        })
        if (!characterId) {
          skipOrThrow(true, "Unable to create character for notes flow.")
          return
        }
        createdCharacter = true
        characterRecord = await step("poll for character", async () => {
          const record = await pollForCharacterByName(
            normalizedServerUrl,
            apiKey,
            characterName,
            30000
          )
          logStep("character record resolved", {
            found: !!record,
            recordId: record?.id ?? record?.uuid ?? null
          })
          return record
        })
        if (!characterRecord) {
          skipOrThrow(
            true,
            "Character created but not returned by search; skipping notes flow."
          )
          return
        }
  
        await step("seed model selection", async () => {
          await setSelectedModel(page, selectedModelId)
        })
        await step("seed selected character", async () => {
          await setSelectedCharacterInStorage(
            page,
            normalizeCharacterForStorage(characterRecord)
          )
        })
  
        const chatPage = await step("open sidepanel", async () => {
          const panel = await openSidepanel()
          logStep("sidepanel opened", { url: panel.url() })
          return panel
        })
        attachPageLogging(chatPage, "sidepanel")
        await step("wait for sidepanel connected", async () => {
          await waitForConnected(chatPage, "workflow-chat-notes")
        })
        await step("ensure server persistence", async () => {
          await ensureServerPersistence(chatPage)
        })
  
        const userMessage = `E2E notes flow ${unique}`
        logStep("sending chat message", { userMessage })
        await step("send chat message", async () => {
          await sendChatMessage(chatPage, userMessage)
        })
        const assistantSnapshot = await step(
          "wait for assistant snapshot",
          async () =>
            chatPage
              .waitForFunction(
                () => {
                  const store = (window as any).__tldw_useStoreMessageOption
                  const state = store?.getState?.()
                  if (!state?.serverChatId) return null
                  const messages = Array.isArray(state?.messages)
                    ? state.messages
                    : []
                  for (let i = messages.length - 1; i >= 0; i -= 1) {
                    const msg = messages[i]
                    if (!msg?.isBot) continue
                    if (msg?.messageType === "character:greeting") continue
                    const content =
                      typeof msg?.message === "string" ? msg.message : ""
                    const trimmed = content.replace(/\s+/g, " ").trim()
                    if (!trimmed || trimmed.includes("▋")) return null
                    return {
                      text: trimmed,
                      localId: msg?.id != null ? String(msg.id) : null,
                      serverMessageId:
                        msg?.serverMessageId != null
                          ? String(msg.serverMessageId)
                          : null,
                      serverChatId: String(state.serverChatId)
                    }
                  }
                  return null
                },
                undefined,
                { timeout: 90000 }
              )
              .then((handle) => handle.jsonValue())
        )
        if (!assistantSnapshot?.serverChatId || !assistantSnapshot?.text) {
          skipOrThrow(
            true,
            "Assistant server message not available after streaming."
          )
          return
        }
        logStep("assistant snapshot resolved", {
          serverChatId: assistantSnapshot.serverChatId,
          serverMessageId: assistantSnapshot.serverMessageId,
          localId: assistantSnapshot.localId
        })
        const assistantText = normalizeMessageContent(assistantSnapshot.text)
        const serverChatId = String(assistantSnapshot.serverChatId)
        let serverMessageId = assistantSnapshot.serverMessageId
          ? String(assistantSnapshot.serverMessageId)
          : null
        logStep("assistant text captured", {
          serverChatId,
          serverMessageId,
          textPreview: assistantText.slice(0, 80)
        })
        if (!serverMessageId) {
          serverMessageId = await step("poll server message id", async () => {
            const resolved = await pollForServerAssistantMessageId(
              normalizedServerUrl,
              apiKey,
              serverChatId,
              assistantText
            )
            logStep("server message id polled", { serverMessageId: resolved })
            return resolved
          })
          if (serverMessageId) {
            await step("sync server message id into store", async () => {
              await chatPage.evaluate(
                ({ localId, serverMessageId }) => {
                  const store = (window as any).__tldw_useStoreMessageOption
                  if (!store?.getState || !store?.setState) return false
                  const state = store.getState?.()
                  const messages = Array.isArray(state?.messages)
                    ? [...state.messages]
                    : []
                  if (messages.length === 0) return false
                  let targetIndex = -1
                  if (localId) {
                    targetIndex = messages.findIndex(
                      (msg) => String(msg?.id || "") === String(localId)
                    )
                  }
                  if (targetIndex === -1) {
                    for (let i = messages.length - 1; i >= 0; i -= 1) {
                      const msg = messages[i]
                      if (!msg?.isBot) continue
                      if (msg?.messageType === "character:greeting") continue
                      targetIndex = i
                      break
                    }
                  }
                  if (targetIndex === -1) return false
                  const target = messages[targetIndex]
                  if (target?.serverMessageId === serverMessageId) return true
                  const updatedVariants = Array.isArray(target?.variants)
                    ? target.variants.map((variant) => ({
                        ...variant,
                        serverMessageId:
                          variant?.serverMessageId ?? serverMessageId
                      }))
                    : target?.variants
                  messages[targetIndex] = {
                    ...target,
                    serverMessageId,
                    variants: updatedVariants
                  }
                  store.setState({ messages })
                  return true
                },
                { localId: assistantSnapshot.localId, serverMessageId }
              )
            })
          }
        }
        if (!serverMessageId) {
          skipOrThrow(
            true,
            "Assistant server message not available after streaming."
          )
          return
        }
        const lastAssistant = chatPage.locator(
          `[data-testid="chat-message"][data-server-message-id="${serverMessageId}"]`
        )
        await step("locate assistant message", async () => {
          await expect(lastAssistant).toBeVisible({ timeout: 30000 })
        })
        const snippet = assistantText.slice(0, 80)
        logStep("assistant snippet", { snippet })
  
        await step("save assistant to notes", async () => {
          await lastAssistant.hover().catch(() => {})
          const saveToNotes = lastAssistant.getByRole("button", {
            name: /Save to Notes/i
          })
          await expect
            .poll(() => saveToNotes.count(), { timeout: 15000 })
            .toBeGreaterThan(0)
          await saveToNotes.first().click()
        })
        const savedNote = await step("poll for saved note", async () => {
          const note = await pollForNoteByConversation(
            normalizedServerUrl,
            apiKey,
            serverChatId,
            serverMessageId
          )
          logStep("saved note poll result", {
            found: !!note,
            noteId: note?.id ?? note?.uuid ?? null
          })
          return note
        })
        if (!savedNote) {
          skipOrThrow(true, "Saved note not found for conversation.")
          return
        }
        const backlink = extractNoteBacklink(savedNote)
        logStep("saved note backlink", backlink)
        if (!backlink.conversation_id) {
          skipOrThrow(true, "Saved note missing linked conversation id.")
          return
        }
        const savedNoteId =
          savedNote?.id ??
          savedNote?.note_id ??
          savedNote?.noteId ??
          null
        if (savedNoteId == null) {
          skipOrThrow(true, "Saved note missing id.")
          return
        }
        logStep("saved note id resolved", { savedNoteId })
        await step("seed last note id", async () => {
          await setLastNoteId(page, String(savedNoteId))
        })
  
        await step("open notes page", async () => {
          await page.goto(`${optionsUrl}#/notes`, {
            waitUntil: "domcontentloaded"
          })
        })
        await step("wait for notes connected", async () => {
          await waitForConnected(page, "workflow-notes-view")
        })
  
        const noteTitle = String(savedNote?.title || "").trim()
        const query =
          noteTitle.length > 0 ? noteTitle.slice(0, 40) : snippet.slice(0, 40)
        logStep("notes search query", { noteTitle, query })
        const openConversation = page.getByRole("button", {
          name: /Open conversation/i
        })
        const openVisible = await step("wait for note selection", async () =>
          openConversation
            .waitFor({ state: "visible", timeout: 30000 })
            .then(() => true)
            .catch(() => false)
        )
        logStep("open conversation visible", { openVisible })
        if (!openVisible) {
          await step("clear notes search", async () => {
            const searchInput = page.getByPlaceholder(
              /Search titles and contents|Search notes/i
            )
            await searchInput.fill("")
            await searchInput.press("Enter")
          })
  
          const resultRow = await step("find note row", async () =>
            findNoteRowInList(page, backlink.conversation_id, query, 6)
          )
          if (!resultRow) {
            skipOrThrow(true, "Note row not visible in notes list.")
            return
          }
          await step("select note row", async () => {
            await expect(resultRow).toBeVisible({ timeout: 10000 })
            await resultRow.click()
          })
          await expect(openConversation).toBeVisible({ timeout: 15000 })
        }
  
      await step("verify linked conversation", async () => {
        const editorPanel = page.locator('div[aria-disabled]').first()
        await expect(
          editorPanel.getByText(/Linked to conversation/i)
        ).toBeVisible({ timeout: 10000 })
        await expect(
          editorPanel.getByText(backlink.conversation_id, { exact: false })
        ).toBeVisible({ timeout: 10000 })
      })
  
      await step("open linked conversation", async () => {
        const openConversationCount = await openConversation.count()
        logStep("open conversation button count", {
          count: openConversationCount
        })
        if (openConversationCount > 0) {
          logStep("open conversation url before", { url: page.url() })
          await openConversation.click()
          await page.waitForFunction(
            () => {
              const hash = window.location.hash || ""
              return hash === "#/" || hash === ""
            },
            undefined,
            { timeout: 20000 }
          )
          logStep("open conversation url after", { url: page.url() })
          await expect(
            page.locator("#textarea-message")
          ).toBeVisible({ timeout: 20000 })
        }
      })
      } finally {
        await testInfo.attach("notes-flow-debug", {
          body: debugLines.join("\n"),
          contentType: "text/plain"
        })
        await context.close()
        if (createdCharacter) {
          await deleteCharacterByName(
            normalizedServerUrl,
            apiKey,
            characterName
          )
        }
      }
  })

  test("notes lifecycle: create, tag, preview, export, delete", async () => {
    test.setTimeout(150000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const notesResponse = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/notes/?page=1&results_per_page=1`,
      apiKey
    )
    if (!notesResponse.ok) {
      const body = await notesResponse.text().catch(() => "")
      skipOrThrow(
        true,
        `Notes API preflight failed: ${notesResponse.status} ${notesResponse.statusText} ${body}`
      )
      return
    }

    const { context, page, extensionId, optionsUrl } =
      await launchWithExtension("", {
        seedConfig: {
          __tldw_first_run_complete: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })

    try {
      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        skipOrThrow(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
        return
      }

      await page.goto(`${optionsUrl}#/notes`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-notes-lifecycle")
      page.setDefaultTimeout(15000)

      const unique = Date.now()
      const title = `E2E Note ${unique}`
      const content = `# Note ${unique}\n\nThis is a real-server notes workflow.`
      const keyword = `e2e-${unique}`

      await page.getByTestId("notes-new-button").click()
      const titleInput = page.getByPlaceholder("Title", { exact: true })
      await titleInput.waitFor({ state: "visible", timeout: 15000 })
      const titleEditable = await titleInput.isEditable().catch(() => false)
      if (!titleEditable) {
        const notesUnavailable = await page
          .getByText(
            /Connect to use Notes|Notes API not available on this server/i
          )
          .isVisible()
          .catch(() => false)
        if (notesUnavailable) {
          skipOrThrow(
            true,
            "Notes editor is disabled; server not connected or Notes API unavailable."
          )
          return
        }
        await expect(titleInput).toBeEditable({ timeout: 15000 })
      }
      await titleInput.fill(title, { timeout: 15000 })
      await page
        .getByPlaceholder(/Write your note here/i)
        .fill(content, { timeout: 15000 })

      const keywordInput = page.getByTestId("notes-keywords-editor")
      await expect(keywordInput).toBeVisible({ timeout: 15000 })
      await keywordInput.click({ timeout: 15000 })
      await page.keyboard.type(keyword)
      await page.keyboard.press("Enter")
      await page.keyboard.press("Escape").catch(() => {})

      const saveButton = page.getByRole("button", { name: /Save note/i })
      await expect(saveButton).toBeEnabled({ timeout: 15000 })
      await saveButton.click({ timeout: 15000 })
      const savedNotePromise = pollForNoteByTitle(
        normalizedServerUrl,
        apiKey,
        title,
        30000
      )
      try {
        await expect(
          page.getByText(/Note created|Note updated/i)
        ).toBeVisible({ timeout: 15000 })
      } catch (error: any) {
        const savedNote = await savedNotePromise
        const noteHint = savedNote
          ? `found id=${savedNote?.id ?? "unknown"} title=${savedNote?.title ?? "unknown"}`
          : "not found"
        throw new Error(`Save toast missing; note lookup after save: ${noteHint}`, {
          cause: error
        })
      }

      const savedNote = await savedNotePromise

      const expandSidebar = page.getByRole("button", {
        name: /Expand sidebar/i
      })
      if (await expandSidebar.isVisible().catch(() => false)) {
        await expandSidebar.click({ timeout: 15000 })
      }

      const searchInput = page.getByPlaceholder(/Search notes/i)
      const searchVisible = await searchInput.isVisible().catch(() => false)
      if (searchVisible) {
        await searchInput.fill(title, { timeout: 15000 })
        await searchInput.press("Enter", { timeout: 15000 })
        const resultRow = page
          .locator("button")
          .filter({ hasText: title })
          .first()
        await expect(resultRow).toBeVisible({ timeout: 20000 })
        await resultRow.click({ timeout: 15000 })
      } else {
        await expect(titleInput).toHaveValue(title, { timeout: 15000 })
      }

      const previewToggle = page.getByRole("button", {
        name: /Preview rendered Markdown|Preview/i
      })
      if ((await previewToggle.count()) > 0) {
        await previewToggle.click()
        await expect(
          page.getByText(/Preview \(Markdown/i)
        ).toBeVisible({ timeout: 10000 })
      }

      const exportButton = page.getByRole("button", {
        name: /Export note as Markdown/i
      })
      await expect(exportButton).toBeEnabled({ timeout: 15000 })
      const downloadPromise = page
        .waitForEvent("download", { timeout: 15000 })
        .catch(() => null)
      await exportButton.click({ timeout: 15000 })
      const download = await downloadPromise
      if (download) {
        await download.path().catch(() => {})
      }
      await expect(
        page.getByText(/Exported/i)
      ).toBeVisible({ timeout: 15000 })

      const deleteButton = page.getByRole("button", { name: /Delete note/i })
      await expect(deleteButton).toBeEnabled({ timeout: 15000 })
      await deleteButton.click({ timeout: 15000 })
      const confirmDelete = page.getByRole("button", { name: /^Delete$/ })
      await expect(confirmDelete).toBeVisible({ timeout: 15000 })
      const deleteResponsePromise =
        savedNote?.id != null
          ? page
              .waitForResponse(
                (response) => {
                  const url = response.url()
                  if (!url.includes("/api/v1/notes/")) return false
                  if (!url.includes(String(savedNote.id))) return false
                  const method = response.request().method()
                  return method === "DELETE" || method === "POST"
                },
                { timeout: 15000 }
              )
              .catch(() => null)
          : null
      await confirmDelete.click({ timeout: 15000 })
      if (deleteResponsePromise) {
        const deleteResponse = await deleteResponsePromise
        if (deleteResponse) {
          let bodyText = ""
          try {
            bodyText = await deleteResponse.text()
          } catch (error) {
            console.log(
              "[e2e] delete response: failed to read body",
              error
            )
          }
          const bodySnippet =
            bodyText.length > 500
              ? `${bodyText.slice(0, 500)}...(truncated)`
              : bodyText
          console.log(
            `[e2e] delete response: status=${deleteResponse.status()} ok=${deleteResponse.ok()} body=${bodySnippet}`
          )
        } else {
          console.log("[e2e] delete response: not captured")
        }
      }
      if (savedNote?.id != null) {
        let deletePollAttempt = 0
        await expect
          .poll(async () => {
            deletePollAttempt += 1
            let res: Response | null = null
            try {
              res = await fetchWithKey(
                `${normalizedServerUrl.replace(/\/$/, "")}/api/v1/notes/${encodeURIComponent(
                  String(savedNote.id)
                )}`,
                apiKey
              )
            } catch (error) {
              console.log(
                `[e2e] delete poll attempt ${deletePollAttempt}: fetch error`,
                error
              )
              return false
            }
            if (!res) return false
            let bodyText = ""
            try {
              bodyText = await res.text()
            } catch (error) {
              console.log(
                `[e2e] delete poll attempt ${deletePollAttempt}: read body error`,
                error
              )
            }
            const bodySnippet =
              bodyText.length > 500
                ? `${bodyText.slice(0, 500)}...(truncated)`
                : bodyText
            console.log(
              `[e2e] delete poll attempt ${deletePollAttempt}: status=${res.status} ok=${res.ok} body=${bodySnippet}`
            )
            if (res.status === 404) return true
            if (!res.ok) return false
            let payload: { id?: string | number } | null = null
            if (bodyText) {
              try {
                payload = JSON.parse(bodyText)
              } catch {
                payload = null
              }
            }
            if (!payload || payload?.id == null) return true
            if ((payload as any)?.deleted === true) return true
            return false
          }, { timeout: 30000 })
          .toBe(true)
      } else if (searchVisible) {
        await searchInput.fill(title, { timeout: 15000 })
        await searchInput.press("Enter", { timeout: 15000 })
        await expect
          .poll(
            async () =>
              page
                .locator("button")
                .filter({ hasText: title })
                .count(),
            { timeout: 30000 }
          )
          .toBe(0)
      } else {
        await expect(
          page.getByText(/Note deleted|Deleted/i)
        ).toBeVisible({ timeout: 15000 })
      }
    } finally {
      await context.close()
    }
  })

  test("chat -> save to flashcards -> review card", async () => {
    test.setTimeout(180000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const decksResponse = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/flashcards/decks`,
      apiKey
    )
    if (!decksResponse.ok) {
      const body = await decksResponse.text().catch(() => "")
      skipOrThrow(
        true,
        `Flashcards API preflight failed: ${decksResponse.status} ${decksResponse.statusText} ${body}`
      )
      return
    }

    const modelsResponse = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/llm/models/metadata`,
      apiKey
    )
    if (!modelsResponse.ok) {
      const body = await modelsResponse.text().catch(() => "")
      skipOrThrow(
        true,
        `Chat models preflight failed: ${modelsResponse.status} ${modelsResponse.statusText} ${body}`
      )
      return
    }
    const modelId = getFirstModelId(
      await modelsResponse.json().catch(() => [])
    )
    if (!modelId) {
      skipOrThrow(true, "No chat models returned from tldw_server.")
      return
    }
    const selectedModelId = modelId.startsWith("tldw:")
      ? modelId
      : `tldw:${modelId}`

    const unique = Date.now()
    const characterName = `E2E Flashcards Character ${unique}`
    let createdCharacter = false
    let characterRecord: any | null = null
    const characterListResponse = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/characters/?page=1&results_per_page=1`,
      apiKey
    ).catch(() => null)
    if (!characterListResponse?.ok) {
      const body = await characterListResponse?.text().catch(() => "")
      skipOrThrow(
        true,
        `Characters API preflight failed: ${characterListResponse?.status} ${characterListResponse?.statusText} ${body}`
      )
      return
    }
    const characterId = await createCharacterByName(
      normalizedServerUrl,
      apiKey,
      characterName
    )
    if (!characterId) {
      skipOrThrow(true, "Unable to create character for flashcards flow.")
      return
    }
    createdCharacter = true
    characterRecord = await pollForCharacterByName(
      normalizedServerUrl,
      apiKey,
      characterName,
      30000
    )
    if (!characterRecord) {
      skipOrThrow(
        true,
        "Character created but not returned by search; skipping flashcards flow."
      )
      return
    }

    const launchResult = await launchWithExtension("", {
      seedConfig: {
        __tldw_first_run_complete: true,
        tldwConfig: {
          serverUrl: normalizedServerUrl,
          authMode: "single-user",
          apiKey
        }
      }
    })
    const { context, page, openSidepanel, extensionId, optionsUrl } =
      launchResult

    try {
      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        skipOrThrow(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
        return
      }

      await setSelectedModel(page, selectedModelId)
      await setSelectedCharacterInStorage(
        page,
        normalizeCharacterForStorage(characterRecord)
      )

      const chatPage = await openSidepanel()
      await waitForConnected(chatPage, "workflow-chat-flashcards")
      await ensureServerPersistence(chatPage)

      const userMessage = `E2E flashcards flow ${unique}`
      await sendChatMessage(chatPage, userMessage)
      await waitForAssistantMessage(chatPage)
      const assistantSnapshot = await chatPage
        .waitForFunction(
          () => {
            const store = (window as any).__tldw_useStoreMessageOption
            const state = store?.getState?.()
            if (!state?.serverChatId) return null
            const messages = Array.isArray(state?.messages)
              ? state.messages
              : []
            for (let i = messages.length - 1; i >= 0; i -= 1) {
              const msg = messages[i]
              if (!msg?.isBot) continue
              if (msg?.messageType === "character:greeting") continue
              const content =
                typeof msg?.message === "string" ? msg.message : ""
              const trimmed = content.replace(/\s+/g, " ").trim()
              if (!trimmed || trimmed.includes("▋")) return null
              return {
                text: trimmed,
                localId: msg?.id != null ? String(msg.id) : null,
                serverMessageId:
                  msg?.serverMessageId != null
                    ? String(msg.serverMessageId)
                    : null,
                serverChatId: String(state.serverChatId)
              }
            }
            return null
          },
          undefined,
          { timeout: 90000 }
        )
        .then((handle) => handle.jsonValue())
      if (!assistantSnapshot?.serverChatId || !assistantSnapshot?.text) {
        skipOrThrow(
          true,
          "Assistant server message not available after streaming."
        )
        return
      }
      const assistantText = normalizeMessageContent(assistantSnapshot.text)
      if (!assistantText) {
        throw new Error("Assistant message did not contain text.")
      }
      const serverChatId = String(assistantSnapshot.serverChatId)
      let serverMessageId = assistantSnapshot.serverMessageId
        ? String(assistantSnapshot.serverMessageId)
        : null
      if (!serverMessageId) {
        serverMessageId = await pollForServerAssistantMessageId(
          normalizedServerUrl,
          apiKey,
          serverChatId,
          assistantText
        )
        if (serverMessageId) {
          await chatPage.evaluate(
            ({ localId, serverMessageId }) => {
              const store = (window as any).__tldw_useStoreMessageOption
              if (!store?.getState || !store?.setState) return false
              const state = store.getState?.()
              const messages = Array.isArray(state?.messages)
                ? [...state.messages]
                : []
              if (messages.length === 0) return false
              let targetIndex = -1
              if (localId) {
                targetIndex = messages.findIndex(
                  (msg) => String(msg?.id || "") === String(localId)
                )
              }
              if (targetIndex === -1) {
                for (let i = messages.length - 1; i >= 0; i -= 1) {
                  const msg = messages[i]
                  if (!msg?.isBot) continue
                  if (msg?.messageType === "character:greeting") continue
                  targetIndex = i
                  break
                }
              }
              if (targetIndex === -1) return false
              const target = messages[targetIndex]
              if (target?.serverMessageId === serverMessageId) return true
              const updatedVariants = Array.isArray(target?.variants)
                ? target.variants.map((variant) => ({
                    ...variant,
                    serverMessageId:
                      variant?.serverMessageId ?? serverMessageId
                  }))
                : target?.variants
              messages[targetIndex] = {
                ...target,
                serverMessageId,
                variants: updatedVariants
              }
              store.setState({ messages })
              return true
            },
            { localId: assistantSnapshot.localId, serverMessageId }
          )
        }
      }
      if (!serverMessageId) {
        skipOrThrow(
          true,
          "Assistant server message not available after streaming."
        )
        return
      }
      const lastAssistant = chatPage.locator(
        `[data-testid="chat-message"][data-server-message-id="${serverMessageId}"]`
      )
      await expect(lastAssistant).toBeVisible({ timeout: 30000 })
      const baselineFlashcards = await fetchRecentFlashcards(
        normalizedServerUrl,
        apiKey,
        20
      )
      const baselineFlashcardIds = new Set(
        baselineFlashcards
          .map((item: any) => (item?.uuid != null ? String(item.uuid) : null))
          .filter((id: string | null): id is string => Boolean(id))
      )

      await lastAssistant.hover().catch(() => {})
      const saveToFlashcards = lastAssistant.getByRole("button", {
        name: /Save to Flashcards/i
      })
      await expect
        .poll(() => saveToFlashcards.count(), { timeout: 15000 })
        .toBeGreaterThan(0)
      await clearRequestErrors(chatPage)
      await saveToFlashcards.first().click()
      await expect(
        chatPage.getByText(/Saved to Flashcards/i)
      ).toBeVisible({ timeout: 15000 })
      const requestErrors = await readLastRequestError(chatPage)
      if (requestErrors?.last || requestErrors?.recent?.length) {
        console.log(
          "[e2e] flashcards save request errors",
          JSON.stringify(requestErrors)
        )
      }
      await logFlashcardsSnapshot(
        normalizedServerUrl,
        apiKey,
        "after-save"
      )
      try {
        await pollForNewFlashcard(
          normalizedServerUrl,
          apiKey,
          baselineFlashcardIds,
          assistantText
        )
      } catch (error) {
        await probeSaveChatKnowledge(
          normalizedServerUrl,
          apiKey,
          {
            conversation_id: serverChatId,
            message_id: serverMessageId,
            snippet: assistantText.slice(0, 1000),
            make_flashcard: true
          },
          "after-save-timeout"
        )
        await logChatMessagesSnapshot(
          normalizedServerUrl,
          apiKey,
          serverChatId,
          "after-save-timeout"
        )
        await logFlashcardsSnapshot(
          normalizedServerUrl,
          apiKey,
          "after-save-timeout"
        )
        throw error
      }

      await page.goto(`${optionsUrl}#/flashcards`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-flashcards-view")

      const cardsTab = page.getByRole("tab", { name: /Cards/i })
      await cardsTab.click()

      const cardRow = page
        .locator('[data-testid^="flashcard-item-"]')
        .first()
      await expect(cardRow).toBeVisible({ timeout: 30000 })

      const reviewTab = page.getByRole("tab", { name: /Review/i })
      await reviewTab.click()

      const showAnswer = page.getByTestId("flashcards-review-show-answer")
      const emptyState = page.getByText(
        /No cards are due for review|Create your first flashcard/i
      )
      await expect
        .poll(
          async () =>
            (await showAnswer.isVisible().catch(() => false)) ||
            (await emptyState.isVisible().catch(() => false)),
          { timeout: 30000 }
        )
        .toBe(true)
      const showAnswerVisible = await showAnswer.isVisible().catch(() => false)
      if (!showAnswerVisible) {
        const emptyVisible = await emptyState.isVisible().catch(() => false)
        if (emptyVisible) {
          const seedToken = `e2e-review-${Date.now()}`
          await createSeedFlashcard(
            normalizedServerUrl,
            apiKey,
            `E2E Seed Front ${seedToken}`,
            `E2E Seed Back ${seedToken}`
          )
          await page.reload({ waitUntil: "domcontentloaded" })
          await waitForConnected(page, "workflow-flashcards-review-seed")
          await reviewTab.click()
          await clearReviewDeckSelection(page)
          await expect(showAnswer).toBeVisible({ timeout: 30000 })
        }
      }

      await expect(showAnswer).toBeVisible({ timeout: 15000 })
      await showAnswer.click()
      const rateButton = page.getByTestId("flashcards-review-rate-2")
      await rateButton.click()
    } finally {
      await context.close()
      if (createdCharacter) {
        await deleteCharacterByName(
          normalizedServerUrl,
          apiKey,
          characterName
        )
      }
    }
  })

  test("quick ingest -> media review", async ({}, testInfo) => {
    test.setTimeout(240000)
    const debugLines: string[] = []
    const startedAt = Date.now()
    const safeStringify = (value: unknown) => {
      try {
        return JSON.stringify(value)
      } catch {
        return "\"[unserializable]\""
      }
    }
    const logStep = (message: string, details?: Record<string, unknown>) => {
      const payload = {
        elapsedMs: Date.now() - startedAt,
        ...(details || {})
      }
      const line = `[real-server-quick-ingest] ${message} ${safeStringify(
        payload
      )}`
      debugLines.push(line)
      console.log(line)
    }
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)
    const { apiBase: mediaApiBase, mediaBasePath } = await resolveMediaApi(
      normalizedServerUrl,
      apiKey
    )
    await preflightMediaApi(mediaApiBase, mediaBasePath, apiKey)

    const { context, page, extensionId, optionsUrl } =
      await launchWithExtension("", {
        seedConfig: {
          __tldw_first_run_complete: true,
          tldwConfig: {
            serverUrl: mediaApiBase,
            authMode: "single-user",
            apiKey
          }
        }
      })

    try {
      const origin = new URL(mediaApiBase).origin + "/*"
      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        skipOrThrow(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
        return
      }

      await page.goto(`${optionsUrl}#/media`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-quick-ingest")

      const resolveQuickIngestTrigger = async () => {
        const byTestId = page.getByTestId("open-quick-ingest")
        if (await byTestId.count()) return byTestId.first()
        return page.getByRole("button", { name: /Quick ingest/i }).first()
      }

      let trigger = await resolveQuickIngestTrigger()
      if (!(await trigger.count())) {
        await page.goto(`${optionsUrl}#/playground`, {
          waitUntil: "domcontentloaded"
        })
        await waitForConnected(page, "workflow-quick-ingest-fallback")
        trigger = await resolveQuickIngestTrigger()
      }
      await expect(trigger).toBeVisible({ timeout: 15000 })
      await trigger.click()

      const modal = page.locator(".quick-ingest-modal .ant-modal-content")
      await expect(modal).toBeVisible({ timeout: 15000 })
      await expect(
        page.locator('.quick-ingest-modal [data-state="ready"]')
      ).toBeVisible({ timeout: 20000 })

      const unique = Date.now()
      const fileName = `e2e-media-${unique}.txt`
      await page.setInputFiles('[data-testid="qi-file-input"]', {
        name: fileName,
        mimeType: "text/plain",
        buffer: Buffer.from(`E2E Quick ingest ${unique}`)
      })

      const fileRow = modal.getByText(fileName).first()
      await expect(fileRow).toBeVisible({ timeout: 15000 })
      const dismissInspectorIntro = async () => {
        const drawer = page
          .locator(".ant-drawer")
          .filter({ hasText: /Inspector/i })
          .first()
        const gotIt = drawer.getByRole("button", { name: /Got it/i })
        const gotItVisible = await gotIt.isVisible().catch(() => false)
        if (gotItVisible) {
          await gotIt.click()
          await expect(page.locator(".ant-drawer-mask")).toBeHidden({
            timeout: 5000
          })
          return
        }
        const closeButton = drawer.getByRole("button", { name: /Close/i })
        const closeVisible = await closeButton.isVisible().catch(() => false)
        if (closeVisible) {
          await closeButton.click()
          await expect(page.locator(".ant-drawer-mask")).toBeHidden({
            timeout: 5000
          })
        }
      }
      await dismissInspectorIntro()

      const analysisToggle = page.getByLabel(/Ingestion options .*analysis/i)
      if ((await analysisToggle.count()) > 0) {
        await analysisToggle.click()
      }
      const chunkingToggle = page.getByLabel(/Ingestion options .*chunking/i)
      if ((await chunkingToggle.count()) > 0) {
        await chunkingToggle.click()
      }

      const runButton = modal.getByTestId("quick-ingest-run")
      await expect(runButton).toBeEnabled({ timeout: 15000 })
      logStep("pre-run state", {
        url: page.url(),
        connection: await page
          .evaluate(() => {
            const store = (window as any).__tldw_useConnectionStore
            return store?.getState?.().state ?? null
          })
          .catch(() => null),
        quickIngest: await page
          .evaluate(() => {
            const store = (window as any).__tldw_useQuickIngestStore
            return store?.getState?.() ?? null
          })
          .catch(() => null),
        runLabel: await runButton.textContent().catch(() => null)
      })
      logStep("run click")
      await runButton.click()
      try {
        await expect(runButton).toBeDisabled({ timeout: 15000 })
      } catch (error) {
        logStep("run did not start", {
          runLabel: await runButton.textContent().catch(() => null),
          runDisabled: await runButton.isDisabled().catch(() => null),
          connection: await page
            .evaluate(() => {
              const store = (window as any).__tldw_useConnectionStore
              return store?.getState?.().state ?? null
            })
            .catch(() => null)
        })
        throw error
      }

      logStep("waiting for completion")
      try {
        await expect(
          modal.getByText(/Quick ingest completed/i)
        ).toBeVisible({ timeout: 180000 })
      } catch (error) {
        logStep("completion timeout", {
          activeTab: await page
            .evaluate(() => {
              const tab = document.querySelector(
                '[role="tab"][aria-selected="true"]'
              )
              return tab?.getAttribute("id") || tab?.textContent || null
            })
            .catch(() => null),
          connection: await page
            .evaluate(() => {
              const store = (window as any).__tldw_useConnectionStore
              return store?.getState?.().state ?? null
            })
            .catch(() => null)
        })
        throw error
      }
      logStep("completion visible")

      logStep("polling media", { query: String(unique) })
      const mediaMatch = await pollForMediaMatch(
        mediaApiBase,
        apiKey,
        String(unique),
        180000,
        mediaBasePath
      )
      logStep("media found", {
        id: mediaMatch?.id ?? null,
        title: mediaMatch?.title ?? null
      })

      const closeQuickIngestModal = async () => {
        const modalRoot = page.locator(".quick-ingest-modal")
        const modalContent = modalRoot.locator(".ant-modal-content")
        const isOpen = await modalContent.isVisible().catch(() => false)
        if (!isOpen) return
        logStep("closing quick ingest modal")
        const closeButton = modalRoot.locator(".ant-modal-close")
        const closeVisible = await closeButton.isVisible().catch(() => false)
        if (closeVisible) {
          await closeButton.click()
        } else {
          await page.keyboard.press("Escape").catch(() => {})
        }
        await expect(modalContent).toBeHidden({ timeout: 10000 })
      }
      await closeQuickIngestModal()

      await page.goto(`${optionsUrl}#/media`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-media-review")

      const searchInput = page.getByPlaceholder(
        /Search media \(title\/content\)/i
      )
      await searchInput.fill(String(unique))
      await page.getByRole("button", { name: /^Search$/i }).click()

      const expectedTitle = fileName.replace(/\.txt$/i, "")
      const resultsRow = page
        .getByRole("button", { name: new RegExp(expectedTitle, "i") })
        .first()
      await expect(resultsRow).toBeVisible({ timeout: 30000 })
    } finally {
      await testInfo.attach("quick-ingest-debug", {
        body: debugLines.join("\n"),
        contentType: "text/plain"
      })
      await context.close()
    }
  })

  test("knowledge QA search -> open chat with RAG settings", async () => {
    test.setTimeout(200000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const ragHealth = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/rag/health`,
      apiKey
    )
    if (!ragHealth.ok) {
      const body = await ragHealth.text().catch(() => "")
      skipOrThrow(
        true,
        `RAG health preflight failed: ${ragHealth.status} ${ragHealth.statusText} ${body}`
      )
      return
    }

    const modelsResponse = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/llm/models/metadata`,
      apiKey
    )
    if (!modelsResponse.ok) {
      const body = await modelsResponse.text().catch(() => "")
      skipOrThrow(
        true,
        `Chat models preflight failed: ${modelsResponse.status} ${modelsResponse.statusText} ${body}`
      )
      return
    }
    const modelId = getFirstModelId(
      await modelsResponse.json().catch(() => [])
    )
    if (!modelId) {
      skipOrThrow(true, "No chat models returned from tldw_server.")
      return
    }
    const selectedModelId = modelId.startsWith("tldw:")
      ? modelId
      : `tldw:${modelId}`

    const ragSeedToken = `e2e-rag-${Date.now()}`
    await createSeedNoteForRag(
      normalizedServerUrl,
      apiKey,
      ragSeedToken
    )
    await pollForRagSearch(
      normalizedServerUrl,
      apiKey,
      ragSeedToken,
      120000
    )

    const { context, page, extensionId, optionsUrl } =
      await launchWithExtension("", {
        seedConfig: {
          __tldw_first_run_complete: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })

    try {
      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        skipOrThrow(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
        return
      }

      await setSelectedModel(page, selectedModelId)

      await page.goto(`${optionsUrl}#/knowledge`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-knowledge-search")

      const noSources = await page
        .getByText(/Index knowledge to use Knowledge QA|No sources yet/i)
        .isVisible()
        .catch(() => false)
      if (noSources) {
        await page.reload({ waitUntil: "domcontentloaded" })
        await waitForConnected(page, "workflow-knowledge-search-retry")
        await expect(
          page.getByText(/Index knowledge to use Knowledge QA|No sources yet/i)
        ).toBeHidden({ timeout: 30000 })
      }
      const ragUnsupportedBanner = await page
        .getByText(/RAG search is not available on this server/i)
        .isVisible()
        .catch(() => false)
      if (ragUnsupportedBanner) {
        throw new Error(
          "RAG search is unavailable according to server capabilities."
        )
      }

      const query = ragSeedToken
      const searchInput = page.getByPlaceholder(
        /Search across configured RAG sources|Search your knowledge/i
      )
      await searchInput.fill(query)
      await page.getByRole("button", { name: /^Search$/i }).click()

      const listItem = page.locator(".ant-list-item")
      const hasResults = await listItem
        .first()
        .waitFor({ state: "visible", timeout: 30000 })
        .then(() => true)
        .catch(() => false)
      const ragErrorVisible = await page
        .getByText(/RAG search failed/i)
        .isVisible()
        .catch(() => false)
      if (ragErrorVisible) {
        throw new Error("RAG search failed in Knowledge QA flow.")
      }
      const hasAnswer = await page
        .getByText(/RAG answer/i)
        .isVisible()
        .catch(() => false)
      if (!hasResults && !hasAnswer) {
        const noResults = await page
          .getByText(/No RAG results yet/i)
          .isVisible()
          .catch(() => false)
        if (noResults) {
          throw new Error(
            `Knowledge QA returned no results for seeded query "${query}".`
          )
        }
      }

      const copySnippet = page.getByRole("button", {
        name: /Copy snippet/i
      })
      if ((await copySnippet.count()) > 0) {
        await copySnippet.first().click()
      }

      const openChatButtons = page
        .locator("button")
        .filter({ hasText: /Open Chat with/i })
      if ((await openChatButtons.count()) === 0) {
        skipOrThrow(
          true,
          "Knowledge chat panel not available; ensure Knowledge workspace is visible."
        )
        return
      }
      const knowledgeButton = openChatButtons.filter({
        hasText: /knowledge search settings/i
      })
      const ragButton = openChatButtons.filter({ hasText: /RAG/i })
      const openChatButton =
        (await knowledgeButton.count()) > 0
          ? knowledgeButton.first()
          : (await ragButton.count()) > 0
            ? ragButton.first()
            : openChatButtons.first()
      await expect(openChatButton).toBeVisible({ timeout: 15000 })
      let chatPage = page
      try {
        await openChatButton.click({ noWaitAfter: true })
      } catch (error) {
        if (!page.isClosed()) {
          throw error
        }
      }
      if (page.isClosed()) {
        chatPage = await context.newPage()
        await chatPage.goto(`${optionsUrl}#/`, {
          waitUntil: "domcontentloaded"
        })
        await waitForConnected(chatPage, "workflow-knowledge-chat")
      }
      await expect(
        chatPage.getByPlaceholder(/Ask anything|Type a message/i)
      ).toBeVisible({ timeout: 20000 })

      await sendChatMessage(
        chatPage,
        `Summarize what you know about "${query}".`
      )
      await waitForAssistantMessage(chatPage)
    } finally {
      await context.close()
    }
  })

  test("prompts -> use in chat -> send message", async () => {
    test.setTimeout(180000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const modelsResponse = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/llm/models/metadata`,
      apiKey
    )
    if (!modelsResponse.ok) {
      const body = await modelsResponse.text().catch(() => "")
      skipOrThrow(
        true,
        `Chat models preflight failed: ${modelsResponse.status} ${modelsResponse.statusText} ${body}`
      )
      return
    }
    const modelId = getFirstModelId(
      await modelsResponse.json().catch(() => [])
    )
    if (!modelId) {
      skipOrThrow(true, "No chat models returned from tldw_server.")
      return
    }
    const selectedModelId = modelId.startsWith("tldw:")
      ? modelId
      : `tldw:${modelId}`

    const { context, page, extensionId, optionsUrl } =
      await launchWithExtension("", {
        seedConfig: {
          __tldw_first_run_complete: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })

    const promptName = `E2E Prompt ${Date.now()}`
    const promptUser = `${promptName} User prompt`

    try {
      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        skipOrThrow(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
        return
      }

      await setSelectedModel(page, selectedModelId)

      await page.goto(`${optionsUrl}#/prompts`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-prompts")

      await expect(page.getByTestId("prompts-custom")).toBeVisible({
        timeout: 15000
      })

      await page.getByTestId("prompts-add").click()
      const drawer = page
        .locator(".ant-drawer")
        .filter({ has: page.getByTestId("prompt-drawer-name") })
        .first()
      await expect(page.getByTestId("prompt-drawer-name")).toBeVisible({
        timeout: 15000
      })
      await page.getByTestId("prompt-drawer-name").fill(promptName)
      await page
        .getByTestId("prompt-drawer-system")
        .fill(`${promptName} System prompt`)
      await page.getByTestId("prompt-drawer-user").fill(promptUser)
      const saveButton = drawer.getByRole("button", { name: /save/i })
      await saveButton.click()
      await expect(page.getByTestId("prompt-drawer-name")).toBeHidden({
        timeout: 15000
      })

      const searchInput = page.getByTestId("prompts-search")
      await searchInput.fill(promptName)

      const promptRow = page
        .locator("tr")
        .filter({ hasText: promptName })
        .first()
      await expect(promptRow).toBeVisible({ timeout: 20000 })

      const useButton = promptRow.getByRole("button", {
        name: /Use in chat/i
      })
      await useButton.click()

      const insertQuick = page.getByTestId("prompt-insert-quick")
      if ((await insertQuick.count()) > 0) {
        await insertQuick.click()
      }

      await waitForConnected(page, "workflow-prompts-chat")

      const chatInput = page.getByPlaceholder(/Ask anything|Type a message/i)
      await expect(chatInput).toBeVisible({ timeout: 20000 })
      await expect
        .poll(async () => chatInput.inputValue(), { timeout: 15000 })
        .toContain(promptUser)

      const overwriteButton = page.getByRole("button", {
        name: /Overwrite message/i
      })
      if (await overwriteButton.isVisible().catch(() => false)) {
        await overwriteButton.click()
      }

      const sendButton = page.locator('[data-testid="chat-send"]')
      if ((await sendButton.count()) > 0) {
        await sendButton.click()
      } else {
        await chatInput.press("Enter")
      }

      await waitForAssistantMessage(page)

      await page.goto(`${optionsUrl}#/prompts`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-prompts-cleanup")

      await searchInput.fill(promptName)
      await expect(promptRow).toBeVisible({ timeout: 15000 })

      const moreButton = promptRow.getByRole("button", {
        name: /More actions/i
      })
      await moreButton.click()

      const deleteItem = page.getByRole("menuitem", { name: /Delete/i })
      await deleteItem.click()
      await page.getByRole("button", { name: /^Delete$/ }).click()

      await expect(
        page.locator("tr").filter({ hasText: promptName })
      ).toHaveCount(0, { timeout: 20000 })
    } finally {
      await context.close()
    }
  })

  test("world books -> entries -> attach -> export -> stats", async () => {
    test.setTimeout(200000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const worldBooksResponse = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/characters/world-books`,
      apiKey
    )
    if (!worldBooksResponse.ok) {
      const body = await worldBooksResponse.text().catch(() => "")
      skipOrThrow(
        true,
        `World books API preflight failed: ${worldBooksResponse.status} ${worldBooksResponse.statusText} ${body}`
      )
      return
    }

    const { context, page, extensionId, optionsUrl } =
      await launchWithExtension("", {
        seedConfig: {
          __tldw_first_run_complete: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })

    const unique = Date.now()
    const worldBookName = `E2E World Book ${unique}`
    const characterName = `E2E WB Character ${unique}`

    try {
      await createCharacterByName(normalizedServerUrl, apiKey, characterName)
      await pollForCharacterByName(
        normalizedServerUrl,
        apiKey,
        characterName,
        30000
      )

      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        skipOrThrow(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
        return
      }

      await page.goto(`${optionsUrl}#/world-books`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-world-books")

      await page.getByRole("button", { name: /New World Book/i }).click()
      const createModal = page.getByRole("dialog", {
        name: /Create World Book/i
      })
      await expect(createModal).toBeVisible({ timeout: 15000 })
      await createModal.getByLabel("Name").fill(worldBookName)
      await createModal
        .getByLabel("Description")
        .fill("World book created by Playwright.")
      await createModal.getByRole("button", { name: /^Create$/i }).click()

      const row = page
        .locator("tr")
        .filter({ hasText: worldBookName })
        .first()
      await expect(row).toBeVisible({ timeout: 20000 })

      const entriesButton = row.getByRole("button", {
        name: /^Entries$/i
      })
      await entriesButton.click()
      const entriesModal = page.getByRole("dialog", {
        name: /Manage Entries/i
      })
      await expect(entriesModal).toBeVisible({ timeout: 15000 })
      await entriesModal
        .getByLabel(/Keywords/i)
        .fill("e2e,workflow")
      await entriesModal
        .getByLabel("Content")
        .fill("World book entry from real-server workflow.")
      await entriesModal
        .getByRole("button", { name: /Add Entry/i })
        .click()
      await expect(
        entriesModal.getByText(/World book entry from real-server workflow/i)
      ).toBeVisible({ timeout: 20000 })
      await page.keyboard.press("Escape")

      const attachButton = row.getByRole("button", { name: /Attach/i })
      await attachButton.click()
      const attachModal = page.getByRole("dialog", {
        name: /Attach to Character/i
      })
      await expect(attachModal).toBeVisible({ timeout: 15000 })
      const characterSelect = attachModal.getByLabel(/Character/i)
      await characterSelect.click()
      const characterInput = attachModal
        .getByRole("combobox", { name: /Character/i })
        .first()
      if ((await characterInput.count()) > 0) {
        await characterInput.fill(characterName)
      } else {
        const fallbackInput = attachModal
          .locator('input[role="combobox"]')
          .first()
        if ((await fallbackInput.count()) > 0) {
          await fallbackInput.fill(characterName)
        }
      }
      const dropdown = page.locator(
        ".ant-select-dropdown:not(.ant-select-dropdown-hidden)"
      )
      await expect(dropdown).toBeVisible({ timeout: 15000 })
      const option = dropdown.locator(".ant-select-item-option-content", {
        hasText: characterName
      })
      await expect(option).toBeVisible({ timeout: 15000 })
      await option.click()
      await attachModal.getByRole("button", { name: /^Attach$/i }).click()
      await expect(page.getByText(/Attached/i)).toBeVisible({ timeout: 15000 })

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 15000 }),
        row.getByRole("button", { name: /Export/i }).click()
      ])
      expect(download.suggestedFilename()).toMatch(/\.json$/i)

      await row.getByRole("button", { name: /Stats/i }).click()
      const statsModal = page.getByRole("dialog", {
        name: /World Book Statistics/i
      })
      await expect(statsModal).toBeVisible({ timeout: 15000 })
      await statsModal.getByRole("button", { name: /Close/i }).click()
      await expect(statsModal).toBeHidden({ timeout: 15000 })

      const deleteButton = row.locator("button").last()
      await deleteButton.click()
      await page.getByRole("button", { name: /^Delete$/ }).click()
      const listRows = page.locator(".ant-table-tbody tr")
      await expect(
        listRows.filter({ hasText: worldBookName })
      ).toHaveCount(0, { timeout: 20000 })
    } finally {
      await context.close()
      await deleteWorldBookByName(normalizedServerUrl, apiKey, worldBookName)
      await deleteCharacterByName(normalizedServerUrl, apiKey, characterName)
    }
  })

  test("dictionaries -> entries -> validate -> preview -> export -> stats", async () => {
    test.setTimeout(220000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const dictionariesResponse = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/chat/dictionaries?include_inactive=true`,
      apiKey
    )
    if (!dictionariesResponse.ok) {
      const body = await dictionariesResponse.text().catch(() => "")
      skipOrThrow(
        true,
        `Dictionaries API preflight failed: ${dictionariesResponse.status} ${dictionariesResponse.statusText} ${body}`
      )
      return
    }

    const { context, page, extensionId, optionsUrl } =
      await launchWithExtension("", {
        seedConfig: {
          __tldw_first_run_complete: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })

    const unique = Date.now()
    const dictionaryName = `E2E Dictionary ${unique}`

    try {
      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        skipOrThrow(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
        return
      }

      await page.goto(`${optionsUrl}#/dictionaries`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-dictionaries")

      await page.getByRole("button", { name: /New Dictionary/i }).click()
      const createModal = page.getByRole("dialog", {
        name: /Create Dictionary/i
      })
      await expect(createModal).toBeVisible({ timeout: 15000 })
      await createModal.getByLabel("Name").fill(dictionaryName)
      await createModal
        .getByLabel("Description")
        .fill("Dictionary created by Playwright.")
      await createModal.getByRole("button", { name: /^Create$/i }).click()

      const row = page
        .locator("tr")
        .filter({ hasText: dictionaryName })
        .first()
      await expect(row).toBeVisible({ timeout: 20000 })

      const entriesButton = row.getByRole("button", {
        name: /^Entries$/i
      })
      await entriesButton.click()
      const entriesModal = page.getByRole("dialog", {
        name: /Manage Entries/i
      })
      await expect(entriesModal).toBeVisible({ timeout: 15000 })
      await entriesModal.getByLabel("Pattern").fill("hello")
      const replacementInput = entriesModal.locator("#replacement")
      if ((await replacementInput.count()) > 0) {
        await replacementInput.fill("hi")
      } else {
        await entriesModal
          .getByRole("textbox", { name: /Replacement/i })
          .first()
          .fill("hi")
      }
      await entriesModal.getByRole("button", { name: /Add Entry/i }).click()
      await expect(entriesModal.getByText("hello")).toBeVisible({
        timeout: 15000
      })

      await entriesModal.getByText(/Validate dictionary/i).click()
      const validateButton = entriesModal.getByRole("button", {
        name: /Run validation/i
      })
      await validateButton.click()
      await expect(
        entriesModal.getByText(/No errors found|Valid/i)
      ).toBeVisible({ timeout: 20000 })

      await entriesModal.getByText(/Preview transforms/i).click()
      const sampleText = "hello world"
      await entriesModal
        .getByPlaceholder(/Paste text to preview dictionary substitutions/i)
        .fill(sampleText)
      await entriesModal.getByRole("button", { name: /Run preview/i }).click()
      await expect(
        entriesModal.getByText(/Processed text/i)
      ).toBeVisible({ timeout: 15000 })
      await expect(
        entriesModal.getByDisplayValue(/hi world/i)
      ).toBeVisible({ timeout: 20000 })

      await page.keyboard.press("Escape")

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 15000 }),
        row.getByRole("button", { name: /Export JSON/i }).click()
      ])
      expect(download.suggestedFilename()).toMatch(/\.json$/i)

      await row.getByRole("button", { name: /Stats/i }).click()
      await expect(
        page.getByText(/Dictionary Statistics/i)
      ).toBeVisible({ timeout: 15000 })
      await page.keyboard.press("Escape")

      const deleteButton = row.locator("button").last()
      await deleteButton.click()
      await page.getByRole("button", { name: /^Delete$/ }).click()
      await expect(
        page.locator("tr").filter({ hasText: dictionaryName })
      ).toHaveCount(0, { timeout: 20000 })
    } finally {
      await context.close()
      await deleteDictionaryByName(normalizedServerUrl, apiKey, dictionaryName)
    }
  })

  test("playground -> server chat -> open history -> pin/unpin", async () => {
    test.setTimeout(200000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const chatResponse = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/chats/?limit=1&offset=0`,
      apiKey
    ).catch(() => null)
    if (!chatResponse?.ok) {
      const body = await chatResponse?.text().catch(() => "")
      skipOrThrow(
        true,
        `Server chats preflight failed: ${chatResponse?.status} ${chatResponse?.statusText} ${body}`
      )
      return
    }

    const modelsResponse = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/llm/models/metadata`,
      apiKey
    )
    if (!modelsResponse.ok) {
      const body = await modelsResponse.text().catch(() => "")
      skipOrThrow(
        true,
        `Chat models preflight failed: ${modelsResponse.status} ${modelsResponse.statusText} ${body}`
      )
      return
    }
    const modelId = getFirstModelId(
      await modelsResponse.json().catch(() => [])
    )
    if (!modelId) {
      skipOrThrow(true, "No chat models returned from tldw_server.")
      return
    }
    const selectedModelId = modelId.startsWith("tldw:")
      ? modelId
      : `tldw:${modelId}`

    const { context, page, extensionId, optionsUrl } =
      await launchWithExtension("", {
        seedConfig: {
          __tldw_first_run_complete: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })

    const unique = Date.now()
    const chatTitle = `E2E Server Chat ${unique}`
    let chatId: string | null = null

    try {
      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        skipOrThrow(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
        return
      }

      await page.goto(`${optionsUrl}#/`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-server-chat")
      await setSelectedModel(page, selectedModelId)
      await ensureServerPersistence(page)

      await sendChatMessage(page, chatTitle)
      await waitForAssistantMessage(page)

      const savedHint = page
        .getByText(/Chat now saved on server|Saved locally \+ on your server/i)
        .first()
      await savedHint.waitFor({ state: "visible", timeout: 10000 }).catch(() => {})

      const chatRecord = await pollForChatByTitle(
        normalizedServerUrl,
        apiKey,
        chatTitle,
        60000
      )
      if (!chatRecord?.id) {
        skipOrThrow(
          true,
          `Server chat "${chatTitle}" was not found after saving.`
        )
        return
      }
      chatId = String(chatRecord.id)

      const sidebar = await ensureChatSidebarExpanded(page)
      await selectServerTab(sidebar)

      const chatButton = sidebar.getByRole("button", {
        name: new RegExp(escapeRegExp(chatTitle))
      })
      await expect(chatButton).toBeVisible({ timeout: 30000 })
      await chatButton.click()

      const chatRow = chatButton.locator("..")
      const pinButton = chatRow.getByRole("button", { name: /^Pin$/i })
      if ((await pinButton.count()) > 0) {
        await pinButton.click()
        await expect(
          chatRow.getByRole("button", { name: /^Unpin$/i })
        ).toBeVisible({ timeout: 10000 })
        await chatRow.getByRole("button", { name: /^Unpin$/i }).click()
      } else {
        skipOrThrow(true, "Pin action not available on server chat rows.")
      }

      const transcript = page
        .locator('[data-testid="chat-message"]')
        .filter({ hasText: chatTitle })
        .first()
      await expect(transcript).toBeVisible({ timeout: 20000 })
    } finally {
      await context.close()
      if (chatId) {
        await deleteChatById(normalizedServerUrl, apiKey, chatId)
      }
    }
  })

  test("quiz -> take attempt -> review score", async () => {
    test.setTimeout(200000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const preflight = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/quizzes?limit=1&offset=0`,
      apiKey
    ).catch(() => null)
    if (!preflight?.ok) {
      const body = await preflight?.text().catch(() => "")
      skipOrThrow(
        true,
        `Quiz API preflight failed: ${preflight?.status} ${preflight?.statusText} ${body}`
      )
      return
    }

    const { context, page, extensionId, optionsUrl } =
      await launchWithExtension("", {
        seedConfig: {
          __tldw_first_run_complete: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })

    const unique = Date.now()
    const quizName = `E2E Quiz ${unique}`
    let quizId: string | number | null = null

    try {
      quizId = await createQuiz(normalizedServerUrl, apiKey, quizName)
      if (!quizId) {
        skipOrThrow(true, "Quiz creation did not return an id.")
        return
      }

      await addQuizQuestion(normalizedServerUrl, apiKey, quizId, {
        question_type: "multiple_choice",
        question_text: `${quizName} Q1: 1 + 1 = ?`,
        options: ["2", "1", "3"],
        correct_answer: 0,
        points: 1,
        order_index: 0
      })
      await addQuizQuestion(normalizedServerUrl, apiKey, quizId, {
        question_type: "true_false",
        question_text: `${quizName} Q2: The sky is blue.`,
        correct_answer: "true",
        points: 1,
        order_index: 1
      })

      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        skipOrThrow(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
        return
      }

      await page.goto(`${optionsUrl}#/quiz`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-quiz")

      const unsupportedBanner = page.getByText(/Quiz API not available/i)
      if (await unsupportedBanner.isVisible().catch(() => false)) {
        skipOrThrow(true, "Quiz API not available on configured server.")
        return
      }
      const connectBanner = page.getByText(/Connect to use Quiz Playground/i)
      if (await connectBanner.isVisible().catch(() => false)) {
        skipOrThrow(true, "Quiz workspace is offline or not connected.")
        return
      }

      const takeTab = page.getByRole("tab", { name: /Take Quiz/i })
      await takeTab.click()

      let quizCard = page
        .locator(".ant-card")
        .filter({ hasText: quizName })
        .first()
      await expect(quizCard).toBeVisible({ timeout: 30000 })
      await quizCard.getByRole("button", { name: /Start Quiz/i }).click()

      let quizCardForAnswers = page
        .locator(".ant-card")
        .filter({ hasText: quizName })
        .first()
      if ((await quizCardForAnswers.count()) === 0) {
        quizCardForAnswers = page.locator(".ant-card").first()
      }
      const questionItems = quizCardForAnswers.locator(".ant-list-item")
      await expect(questionItems.first()).toBeVisible({ timeout: 15000 })
      const questionCount = await questionItems.count()
      for (let i = 0; i < questionCount; i += 1) {
        const item = questionItems.nth(i)
        const radios = item.locator('input[type="radio"]')
        if ((await radios.count()) > 0) {
          await radios.first().click()
          continue
        }
        const textbox = item.getByRole("textbox").first()
        if ((await textbox.count()) > 0) {
          await textbox.fill("test")
        }
      }

      await page.getByRole("button", { name: /Submit/i }).click()
      await expect(page.getByText(/Score:/i)).toBeVisible({
        timeout: 30000
      })
      await expect(
        page.getByRole("button", { name: /Retake Quiz/i })
      ).toBeVisible({ timeout: 30000 })
    } finally {
      await context.close()
      if (quizId != null) {
        await deleteQuizById(normalizedServerUrl, apiKey, quizId)
      }
    }
  })

  test("chatbooks export -> download archive", async () => {
    test.setTimeout(220000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const healthRes = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/chatbooks/health`,
      apiKey
    ).catch(() => null)
    if (!healthRes?.ok) {
      const body = await healthRes?.text().catch(() => "")
      skipOrThrow(
        true,
        `Chatbooks API preflight failed: ${healthRes?.status} ${healthRes?.statusText} ${body}`
      )
      return
    }
    const healthPayload = await healthRes.json().catch(() => null)
    if (healthPayload?.available === false) {
      skipOrThrow(true, "Chatbooks API disabled on the configured server.")
      return
    }

    const promptName = `E2E Chatbook Prompt ${Date.now()}`
    let promptId: string | number | null = null

    const { context, page, extensionId, optionsUrl } =
      await launchWithExtension("", {
        seedConfig: {
          __tldw_first_run_complete: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })

    try {
      promptId = await createPrompt(normalizedServerUrl, apiKey, {
        name: promptName,
        system_prompt: "You are an export prompt for chatbooks.",
        user_prompt: "Generate a short answer.",
        keywords: ["e2e", "chatbook"]
      })

      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        skipOrThrow(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
        return
      }

      await page.goto(`${optionsUrl}#/chatbooks`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-chatbooks")

      await expect(
        page.getByRole("heading", { name: /Chatbooks Playground/i })
      ).toBeVisible({ timeout: 15000 })

      const unavailableAlert = page.getByText(
        /Chatbooks is not available on this server/i
      )
      if (await unavailableAlert.isVisible().catch(() => false)) {
        skipOrThrow(true, "Chatbooks API not available on this server.")
        return
      }

      const exportName = `E2E Chatbook ${Date.now()}`
      await page.getByPlaceholder(/^Name$/i).fill(exportName)
      await page.getByPlaceholder(/Description/i).fill("E2E chatbook export")

      const promptCard = page
        .locator(".ant-card")
        .filter({ has: page.getByText(/Prompts/i) })
        .first()
      await expect(promptCard).toBeVisible({ timeout: 15000 })

      const includeAllSwitch = promptCard.getByRole("switch")
      if ((await includeAllSwitch.count()) > 0) {
        const checked = await includeAllSwitch.getAttribute("aria-checked")
        if (checked !== "true") {
          await includeAllSwitch.click()
        }
      }

      await page.getByRole("button", { name: /Export chatbook/i }).click()

      const errorNotice = page
        .getByText(
          /Select at least one item to export|Name and description are required|Export failed/i
        )
        .first()
      const errorVisible = await errorNotice
        .waitFor({ state: "visible", timeout: 5000 })
        .then(() => true)
        .catch(() => false)
      if (errorVisible) {
        const errorText = await errorNotice.textContent()
        throw new Error(
          `Chatbook export failed: ${errorText?.trim() || "unknown error"}`
        )
      }

      await page
        .getByText(/Export job created|Export complete/i)
        .first()
        .waitFor({ state: "visible", timeout: 30000 })
        .catch(() => {})

      const jobsTab = page.getByRole("tab", { name: /Jobs/i })
      await jobsTab.click()
      const jobsPanelId = await jobsTab.getAttribute("aria-controls")
      const jobsPanel = jobsPanelId ? page.locator(`#${jobsPanelId}`) : page

      const exportCard = jobsPanel
        .locator(".ant-card")
        .filter({ hasText: /Export jobs/i })
        .first()
      await expect(exportCard).toBeVisible({ timeout: 15000 })

      const exportRow = exportCard
        .locator(".ant-table-row")
        .filter({ hasText: exportName })
        .first()
      await expect(exportRow).toBeVisible({ timeout: 90000 })

      const downloadButton = exportRow.getByRole("button", {
        name: /Download/i
      })
      await expect(downloadButton).toBeVisible({ timeout: 120000 })

      await page.evaluate(() => {
        const win = window as any
        if (!win.__e2e_downloadHooked) {
          win.__e2e_downloadHooked = true
          const original = URL.createObjectURL
          win.__e2e_downloadOriginal = original
          URL.createObjectURL = function (blob: Blob) {
            win.__e2e_lastDownload = { size: blob.size, type: blob.type }
            return original.call(URL, blob)
          }
        }
        win.__e2e_lastDownload = null
      })

      const downloadEvent = page
        .waitForEvent("download", { timeout: 15000 })
        .catch(() => null)
      await downloadButton.click()
      const download = await downloadEvent
      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.zip$/i)
      } else {
        await page.waitForFunction(
          () => (window as any).__e2e_lastDownload != null,
          undefined,
          { timeout: 15000 }
        )
        const meta = await page.evaluate(
          () => (window as any).__e2e_lastDownload
        )
        const type = String(meta?.type || "")
        expect(type).toMatch(/zip|octet-stream/i)
      }
    } finally {
      await context.close()
      if (promptId != null) {
        await deletePromptById(normalizedServerUrl, apiKey, promptId)
      }
    }
  })

  test("tts playback -> server provider -> audio segments", async () => {
    test.setTimeout(200000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const providers = await fetchAudioProviders(normalizedServerUrl, apiKey)
    if (!providers) {
      skipOrThrow(true, "Audio providers not available on the configured server.")
      return
    }

    const { context, page, extensionId, optionsUrl } =
      await launchWithExtension("", {
        seedConfig: {
          __tldw_first_run_complete: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })

    try {
      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        skipOrThrow(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
        return
      }

      await page.goto(`${optionsUrl}#/tts`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-tts")

      await expect(page.getByText(/Current provider/i)).toBeVisible({
        timeout: 15000
      })

      const providerSelected = await selectTldwProvider(page)
      if (!providerSelected) {
        skipOrThrow(true, "tldw server option not available in provider list.")
        return
      }

      const saveButton = page.getByRole("button", { name: /save/i }).first()
      if ((await saveButton.count()) > 0 && !(await saveButton.isDisabled())) {
        await saveButton.click()
      }

      const textarea = page.getByPlaceholder(
        /Type or paste text here, then use Play to listen./i
      )
      await textarea.fill("Hello from the TTS playback workflow.")

      await page.getByRole("button", { name: /^Play$/i }).click()

      await expect(
        page.getByText(/Generated audio segments/i)
      ).toBeVisible({ timeout: 20000 })
      await expect(page.locator("audio")).toBeVisible({ timeout: 20000 })
    } finally {
      await context.close()
    }
  })

  test("compare mode -> multi-model answers -> choose winner", async () => {
    test.setTimeout(240000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const modelsResponse = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/llm/models/metadata`,
      apiKey
    )
    if (!modelsResponse.ok) {
      const body = await modelsResponse.text().catch(() => "")
      skipOrThrow(
        true,
        `Compare mode preflight failed: ${modelsResponse.status} ${modelsResponse.statusText} ${body}`
      )
      return
    }
    const modelsPayload = await modelsResponse.json().catch(() => [])
    const modelsList = Array.isArray(modelsPayload)
      ? modelsPayload
      : Array.isArray((modelsPayload as any)?.models)
        ? (modelsPayload as any).models
        : []
    const modelIds = modelsList
      .map((model: any) => model?.model || model?.id || model?.name)
      .filter(Boolean)
    if (modelIds.length < 2) {
      skipOrThrow(true, "Need at least 2 models to run compare workflow.")
      return
    }

    const { context, page, extensionId } = await launchWithExtension("", {
      seedConfig: withFeatures([FEATURE_FLAG_KEYS.COMPARE_MODE], {
        __tldw_first_run_complete: true,
        tldwConfig: {
          serverUrl: normalizedServerUrl,
          authMode: "single-user",
          apiKey
        }
      })
    })

    try {
      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        skipOrThrow(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
        return
      }

      await waitForConnected(page, "workflow-compare-mode")
      await setSelectedModel(page, String(modelIds[0]))
      await page.evaluate(async () => {
        const setFlag = (area: typeof chrome.storage.local) =>
          new Promise<void>((resolve) => {
            area.set({ ff_compareMode: true }, () => resolve())
          })
        if (chrome?.storage?.local) {
          await setFlag(chrome.storage.local)
        }
        if (chrome?.storage?.sync) {
          await setFlag(chrome.storage.sync)
        }
      })

      const compareButtons = page.getByRole("button", {
        name: /^Compare$/i
      })
      const compareButton =
        (await compareButtons.count()) > 0
          ? compareButtons.first()
          : page.getByRole("button", { name: /compare models/i }).first()
      await expect(compareButton).toBeVisible({ timeout: 15000 })
      await compareButton.click()

      const dialog = page.getByRole("dialog", { name: /compare settings/i })
      await expect(dialog).toBeVisible({ timeout: 10000 })

      const switches = dialog.getByRole("switch")
      const ensureSwitchOn = async (index: number) => {
        const toggle = switches.nth(index)
        const checked = await toggle.getAttribute("aria-checked")
        if (checked !== "true") {
          await toggle.click()
        }
      }
      if ((await switches.count()) >= 2) {
        await ensureSwitchOn(0)
        await ensureSwitchOn(1)
      } else {
        await ensureSwitchOn(0)
      }

      const modelPicker = dialog.locator(".ant-select-multiple").first()
      await modelPicker.click()
      const options = page.locator(
        ".ant-select-dropdown:visible .ant-select-item-option"
      )
      const optionCount = await options.count()
      if (optionCount < 2) {
        skipOrThrow(true, "Compare model picker returned fewer than 2 options.")
        return
      }
      await options.nth(0).click()
      await options.nth(1).click()
      await page.keyboard.press("Escape")
      await expect(dialog).toBeHidden({ timeout: 10000 })

      const input = page.locator("#textarea-message")
      await expect(input).toBeVisible({ timeout: 15000 })
      await input.fill(
        "Compare mode workflow: summarize key differences in one sentence."
      )
      const sendButton = page.getByRole("button", { name: /send/i }).first()
      await sendButton.click()

      const clusterLabel = page.getByText("Multi-model answers").first()
      await expect(clusterLabel).toBeVisible({ timeout: 60000 })

      const compareAnswerButtons = page.getByRole("button", {
        name: /^Compare$/
      })
      await expect(compareAnswerButtons.first()).toBeVisible({
        timeout: 60000
      })
      const compareCount = await compareAnswerButtons.count()
      if (compareCount < 2) {
        skipOrThrow(true, "Need at least 2 compare responses to continue.")
        return
      }

      await compareAnswerButtons.nth(0).click()
      await compareAnswerButtons.nth(1).click()

      const bulkSplit = page.getByRole("button", {
        name: /open each selected answer as its own chat/i
      })
      if ((await bulkSplit.count()) > 0) {
        await bulkSplit.first().click()
      }

      await compareAnswerButtons.nth(1).click()
      const continueButton = page.getByRole("button", {
        name: /continue with this model/i
      })
      await expect(continueButton).toBeVisible({ timeout: 15000 })
      await continueButton.click()

      await expect(page.getByText("Chosen").first()).toBeVisible({
        timeout: 15000
      })

      const compareAgainHint = page.getByText(
        "Continue with the chosen answer or compare again."
      )
      if (await compareAgainHint.isVisible().catch(() => false)) {
        const compareAgainButton = compareAgainHint
          .locator("..")
          .getByRole("button", { name: /compare/i })
        await compareAgainButton.click()
      }

      const canonicalButton = page
        .getByRole("button", { name: /pin as canonical/i })
        .first()
      if ((await canonicalButton.count()) > 0) {
        await canonicalButton.click()
      }
    } finally {
      await context.close()
    }
  })

  test("data tables -> chat source -> generate -> save -> delete", async () => {
    test.setTimeout(240000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const tablesResponse = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/data-tables?page=1&page_size=1`,
      apiKey
    ).catch(() => null)
    if (!tablesResponse?.ok) {
      const body = await tablesResponse?.text().catch(() => "")
      skipOrThrow(
        true,
        `Data tables preflight failed: ${tablesResponse?.status} ${tablesResponse?.statusText} ${body}`
      )
      return
    }

    const unique = Date.now()
    const characterName = `E2E DataTables Character ${unique}`
    const chatTitle = `E2E DataTables Chat ${unique}`
    const tableName = `E2E Table ${unique}`
    let characterId: string | number | null = null
    let chatId: string | null = null

    const { context, page, extensionId, optionsUrl } =
      await launchWithExtension("", {
        seedConfig: {
          __tldw_first_run_complete: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })

    try {
      characterId = await createCharacterByName(
        normalizedServerUrl,
        apiKey,
        characterName
      )
      if (!characterId) {
        skipOrThrow(true, "Unable to create character for data tables chat.")
        return
      }
      chatId = await createChatWithMessage(
        normalizedServerUrl,
        apiKey,
        characterId,
        chatTitle,
        `Data tables source message ${unique}`
      )
      await pollForChatByTitle(
        normalizedServerUrl,
        apiKey,
        chatTitle,
        30000
      )

      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        skipOrThrow(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
        return
      }

      await page.goto(`${optionsUrl}#/data-tables`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-data-tables")

      await expect(page.getByText(/Data Tables Studio/i)).toBeVisible({
        timeout: 15000
      })

      const createTab = page.getByRole("tab", {
        name: /Create Table/i
      })
      await createTab.click()

      const chatsSegment = page.getByRole("radio", { name: /Chats/i })
      if ((await chatsSegment.count()) > 0) {
        await chatsSegment.first().click()
      } else {
        const chatsButton = page.getByRole("button", { name: /Chats/i })
        if ((await chatsButton.count()) > 0) {
          await chatsButton.first().click()
        }
      }

      const searchInput = page.getByPlaceholder(/Search\.\.\./i)
      await expect(searchInput).toBeVisible({ timeout: 15000 })
      await searchInput.fill(chatTitle)

      const chatRow = page
        .locator(".ant-list-item")
        .filter({ hasText: chatTitle })
        .first()
      await expect(chatRow).toBeVisible({ timeout: 20000 })
      await chatRow.click()
      await expect(chatRow.getByText(/Selected/i)).toBeVisible({
        timeout: 10000
      })

      await page.getByRole("button", { name: /^Next$/i }).click()

      const nameInput = page.getByPlaceholder(/Enter a name for your table/i)
      await expect(nameInput).toBeVisible({ timeout: 15000 })
      await nameInput.fill(tableName)

      const promptInput = page.getByPlaceholder(/E\.g\., Create a table/i)
      await expect(promptInput).toBeVisible({ timeout: 15000 })
      await promptInput.fill(
        "Create a table with columns for topic and key takeaway."
      )

      await page.getByRole("button", { name: /^Next$/i }).click()

      const previewReady = await Promise.race([
        page
          .locator(".ant-table")
          .first()
          .waitFor({ state: "visible", timeout: 120000 })
          .then(() => "table"),
        page
          .getByText(/Generation Failed/i)
          .waitFor({ state: "visible", timeout: 120000 })
          .then(() => "error")
      ])
      if (previewReady !== "table") {
        throw new Error("Data table generation failed.")
      }

      await page.getByRole("button", { name: /^Next$/i }).click()

      const downloadPromise = page
        .waitForEvent("download", { timeout: 15000 })
        .catch(() => null)
      await page.getByRole("button", { name: /^CSV$/i }).click()
      const download = await downloadPromise
      if (download) {
        await download.path().catch(() => {})
      }

      await page.getByRole("button", { name: /Save to Library/i }).click()
      await expect(page.getByText(/Table Saved!/i)).toBeVisible({
        timeout: 20000
      })

      await page.getByRole("button", { name: /View My Tables/i }).click()
      const tablesSearch = page.getByPlaceholder(/Search tables\.\.\./i)
      await tablesSearch.fill(tableName)

      const tableRow = page
        .locator(".ant-table-row")
        .filter({ hasText: tableName })
        .first()
      await expect(tableRow).toBeVisible({ timeout: 20000 })
      const deleteButton = tableRow.locator("button").last()
      await deleteButton.click()
      await page.getByRole("button", { name: /^Delete$/ }).click()

      await expect(
        page.locator(".ant-table-row").filter({ hasText: tableName })
      ).toHaveCount(0, { timeout: 20000 })
    } finally {
      await context.close()
      await deleteDataTableByName(normalizedServerUrl, apiKey, tableName)
      if (chatId) {
        await deleteChatById(normalizedServerUrl, apiKey, chatId)
      }
      if (characterId) {
        await deleteCharacterByName(
          normalizedServerUrl,
          apiKey,
          characterName
        )
      }
    }
  })

  test("media trash -> delete -> restore", async () => {
    test.setTimeout(240000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const trashResponse = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/media/trash?page=1&results_per_page=1`,
      apiKey
    ).catch(() => null)
    if (!trashResponse?.ok) {
      const body = await trashResponse?.text().catch(() => "")
      skipOrThrow(
        true,
        `Media trash preflight failed: ${trashResponse?.status} ${trashResponse?.statusText} ${body}`
      )
      return
    }

    const { context, page, extensionId, optionsUrl } =
      await launchWithExtension("", {
        seedConfig: {
          __tldw_first_run_complete: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })

    const unique = Date.now()
    const fileName = `e2e-trash-${unique}.txt`
    let mediaId: string | number | null = null

    try {
      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        skipOrThrow(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
        return
      }

      await page.goto(`${optionsUrl}#/media`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-media-trash-ingest")

      const resolveQuickIngestTrigger = async () => {
        const byTestId = page.getByTestId("open-quick-ingest")
        if (await byTestId.count()) return byTestId.first()
        return page.getByRole("button", { name: /Quick ingest/i }).first()
      }

      let trigger = await resolveQuickIngestTrigger()
      if (!(await trigger.count())) {
        await page.goto(`${optionsUrl}#/playground`, {
          waitUntil: "domcontentloaded"
        })
        await waitForConnected(page, "workflow-media-trash-ingest-fallback")
        trigger = await resolveQuickIngestTrigger()
      }
      await expect(trigger).toBeVisible({ timeout: 15000 })
      await trigger.click()

      const modal = page.locator(".quick-ingest-modal .ant-modal-content")
      await expect(modal).toBeVisible({ timeout: 15000 })
      await expect(
        page.locator('.quick-ingest-modal [data-state="ready"]')
      ).toBeVisible({ timeout: 20000 })

      await page.setInputFiles('[data-testid="qi-file-input"]', {
        name: fileName,
        mimeType: "text/plain",
        buffer: Buffer.from(`E2E media trash ${unique}`)
      })

      const fileRow = modal.getByText(fileName).first()
      await expect(fileRow).toBeVisible({ timeout: 15000 })
      await fileRow.click()

      const runButton = modal
        .getByRole("button", {
          name: /Run quick ingest|Ingest|Process/i
        })
        .first()
      await expect(runButton).toBeEnabled({ timeout: 15000 })
      await runButton.click()

      await expect(
        modal.getByText(/Quick ingest completed/i)
      ).toBeVisible({ timeout: 180000 })

      const mediaMatch = await pollForMediaMatch(
        normalizedServerUrl,
        apiKey,
        String(unique),
        180000
      )
      mediaId = mediaMatch?.id ?? null

      await page.goto(`${optionsUrl}#/media`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-media-trash-delete")

      const searchInput = page.getByPlaceholder(
        /Search media \(title\/content\)/i
      )
      await searchInput.fill(String(unique))
      await page.getByRole("button", { name: /^Search$/i }).click()

      const resultRow = page
        .locator('[role="button"]')
        .filter({ hasText: fileName })
        .first()
      await expect(resultRow).toBeVisible({ timeout: 30000 })
      await resultRow.click()

      const deleteButton = page.getByRole("button", {
        name: /Delete item/i
      })
      await expect(deleteButton).toBeVisible({ timeout: 15000 })
      await deleteButton.click()
      await page.getByRole("button", { name: /^Delete$/ }).click()

      await expect(page.getByText(/Moved to trash/i)).toBeVisible({
        timeout: 15000
      })

      const trashButton = page.getByRole("button", { name: /^Trash$/i })
      await trashButton.click()
      await waitForConnected(page, "workflow-media-trash-view")

      const trashRow = page
        .locator("div")
        .filter({
          has: page.getByText(fileName)
        })
        .filter({
          has: page.getByRole("button", { name: /^Restore$/i })
        })
        .first()
      await expect(trashRow).toBeVisible({ timeout: 30000 })
      const restoreButton = trashRow.getByRole("button", {
        name: /^Restore$/i
      })
      await restoreButton.click()

      await expect(page.getByText(/Item restored/i)).toBeVisible({
        timeout: 20000
      })
      await expect(page.getByText(fileName)).toHaveCount(0, {
        timeout: 20000
      })
    } finally {
      await context.close()
      if (mediaId != null) {
        await cleanupMediaItem(normalizedServerUrl, apiKey, mediaId)
      }
    }
  })

  test("media ingestion -> analysis -> review -> re-analyze", async () => {
    test.setTimeout(300000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const mediaResponse = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/media?page=1&results_per_page=1`,
      apiKey
    )
    if (!mediaResponse.ok) {
      const body = await mediaResponse.text().catch(() => "")
      skipOrThrow(
        true,
        `Media API preflight failed: ${mediaResponse.status} ${mediaResponse.statusText} ${body}`
      )
      return
    }

    const modelsResponse = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/llm/models/metadata`,
      apiKey
    )
    if (!modelsResponse.ok) {
      const body = await modelsResponse.text().catch(() => "")
      skipOrThrow(
        true,
        `Chat models preflight failed: ${modelsResponse.status} ${modelsResponse.statusText} ${body}`
      )
      return
    }
    const modelId = getFirstModelId(
      await modelsResponse.json().catch(() => [])
    )
    if (!modelId) {
      skipOrThrow(true, "No chat models returned from tldw_server.")
      return
    }
    const selectedModelId = modelId.startsWith("tldw:")
      ? modelId
      : `tldw:${modelId}`

    const { context, page, extensionId, optionsUrl } =
      await launchWithExtension("", {
        seedConfig: {
          __tldw_first_run_complete: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })

    const unique = Date.now()
    const fileName = `e2e-analysis-${unique}.txt`
    const token1 = `analysis-token-1-${unique}`
    const token2 = `analysis-token-2-${unique}`
    let mediaId: string | number | null = null

    const runAnalysis = async (token: string) => {
      const generateButton = page
        .getByRole("button", { name: /^Generate$/i })
        .first()
      await generateButton.scrollIntoViewIfNeeded()
      await generateButton.click()

      const modal = page.getByRole("dialog", {
        name: /Generate Analysis/i
      })
      await expect(modal).toBeVisible({ timeout: 15000 })

      const systemPrompt = modal.getByLabel(/System Prompt/i)
      await systemPrompt.fill(
        `Return exactly the token "${token}" and nothing else.`
      )
      const userPrefix = modal.getByLabel(/User Prompt Prefix/i)
      await userPrefix.fill("")

      const generateAnalysis = modal.getByRole("button", {
        name: /Generate Analysis/i
      })
      await expect(generateAnalysis).toBeEnabled({ timeout: 30000 })
      await generateAnalysis.click()

      await expect(modal).toBeHidden({ timeout: 180000 })
      await expect(page.getByText(token)).toBeVisible({ timeout: 60000 })
    }

    try {
      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        skipOrThrow(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
        return
      }

      await setSelectedModel(page, selectedModelId)

      const resolveQuickIngestTrigger = async () => {
        const byTestId = page.getByTestId("open-quick-ingest")
        if (await byTestId.count()) return byTestId.first()
        return page.getByRole("button", { name: /Quick ingest/i }).first()
      }

      await waitForConnected(page, "workflow-analysis-ingest")

      let trigger = await resolveQuickIngestTrigger()
      if (!(await trigger.count())) {
        await page.goto(`${optionsUrl}#/playground`, {
          waitUntil: "domcontentloaded"
        })
        await waitForConnected(page, "workflow-analysis-ingest-fallback")
        trigger = await resolveQuickIngestTrigger()
      }
      await expect(trigger).toBeVisible({ timeout: 15000 })
      await trigger.click()

      const modal = page.locator(".quick-ingest-modal .ant-modal-content")
      await expect(modal).toBeVisible({ timeout: 15000 })
      await expect(
        page.locator('.quick-ingest-modal [data-state="ready"]')
      ).toBeVisible({ timeout: 20000 })

      await page.setInputFiles('[data-testid="qi-file-input"]', {
        name: fileName,
        mimeType: "text/plain",
        buffer: Buffer.from(`E2E analysis content ${unique}`)
      })

      const fileRow = modal.getByText(fileName).first()
      await expect(fileRow).toBeVisible({ timeout: 15000 })
      await fileRow.click()

      const runButton = modal
        .getByRole("button", {
          name: /Run quick ingest|Ingest|Process/i
        })
        .first()
      await expect(runButton).toBeEnabled({ timeout: 15000 })
      await runButton.click()

      await expect(
        modal.getByText(/Quick ingest completed/i)
      ).toBeVisible({ timeout: 180000 })

      const mediaMatch = await pollForMediaMatch(
        normalizedServerUrl,
        apiKey,
        String(unique),
        180000
      )
      mediaId = mediaMatch?.id ?? null

      await page.goto(`${optionsUrl}#/media`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-analysis-media")

      const searchInput = page.getByPlaceholder(
        /Search media \(title\/content\)/i
      )
      await searchInput.fill(String(unique))
      await page.getByRole("button", { name: /^Search$/i }).click()

      const resultRow = page
        .locator('[role="button"]')
        .filter({ hasText: fileName })
        .first()
      await expect(resultRow).toBeVisible({ timeout: 30000 })
      await resultRow.click()

      await runAnalysis(token1)

      await page.goto(`${optionsUrl}#/media-multi`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-analysis-review")

      const reviewSearch = page.getByPlaceholder(/Search media/i)
      await expect(reviewSearch).toBeVisible({ timeout: 15000 })
      await reviewSearch.fill(String(unique))
      await page.getByRole("button", { name: /^Search$/i }).click()

      const reviewRow = page
        .locator(".ant-list-item")
        .filter({ hasText: fileName })
        .first()
      await expect(reviewRow).toBeVisible({ timeout: 30000 })
      await reviewRow.click()

      const getReviewButton = page.getByRole("button", {
        name: /Get review/i
      })
      await expect(getReviewButton).toBeVisible({ timeout: 15000 })
      await getReviewButton.click()

      const analysisEditor = page.getByPlaceholder(
        /Run Review or Summarize/i
      )
      await expect
        .poll(async () => analysisEditor.inputValue(), {
          timeout: 120000
        })
        .toMatch(/\S+/)

      await page.goto(`${optionsUrl}#/media`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-analysis-reanalyze")

      await searchInput.fill(String(unique))
      await page.getByRole("button", { name: /^Search$/i }).click()
      await expect(resultRow).toBeVisible({ timeout: 30000 })
      await resultRow.click()

      await runAnalysis(token2)
    } finally {
      await context.close()
      if (mediaId != null) {
        await cleanupMediaItem(normalizedServerUrl, apiKey, mediaId)
      }
    }
  })

  test("characters -> chat persona -> send message", async () => {
    test.setTimeout(200000)
    const { serverUrl, apiKey } = requireRealServerConfig(test)
    const normalizedServerUrl = normalizeServerUrl(serverUrl)

    const characterList = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/characters/`,
      apiKey
    )
    if (!characterList.ok) {
      const body = await characterList.text().catch(() => "")
      skipOrThrow(
        true,
        `Characters API preflight failed: ${characterList.status} ${characterList.statusText} ${body}`
      )
      return
    }

    const modelsResponse = await fetchWithKey(
      `${normalizedServerUrl}/api/v1/llm/models/metadata`,
      apiKey
    )
    if (!modelsResponse.ok) {
      const body = await modelsResponse.text().catch(() => "")
      skipOrThrow(
        true,
        `Chat models preflight failed: ${modelsResponse.status} ${modelsResponse.statusText} ${body}`
      )
      return
    }
    const modelId = getFirstModelId(
      await modelsResponse.json().catch(() => [])
    )
    if (!modelId) {
      skipOrThrow(true, "No chat models returned from tldw_server.")
      return
    }
    const selectedModelId = modelId.startsWith("tldw:")
      ? modelId
      : `tldw:${modelId}`

    const { context, page, extensionId, optionsUrl } =
      await launchWithExtension("", {
        seedConfig: {
          __tldw_first_run_complete: true,
          tldwConfig: {
            serverUrl: normalizedServerUrl,
            authMode: "single-user",
            apiKey
          }
        }
      })

    const unique = Date.now()
    const characterName = `E2E Persona ${unique}`

    try {
      const origin = new URL(normalizedServerUrl).origin + "/*"
      const granted = await grantHostPermission(
        context,
        extensionId,
        origin
      )
      if (!granted) {
        skipOrThrow(
          true,
          "Host permission not granted for tldw_server origin; allow it in chrome://extensions > tldw Assistant > Site access, then re-run"
        )
        return
      }

      await setSelectedModel(page, selectedModelId)

      await page.goto(`${optionsUrl}#/characters`, {
        waitUntil: "domcontentloaded"
      })
      await waitForConnected(page, "workflow-characters")

      const newCharacterButton = page
        .getByRole("button", { name: /New character|Create character/i })
        .first()
      await expect(newCharacterButton).toBeVisible({ timeout: 15000 })
      await newCharacterButton.click()

      const createModal = page.getByRole("dialog", {
        name: /New character/i
      })
      await expect(createModal).toBeVisible({ timeout: 15000 })

      await createModal.getByLabel(/Name/i).fill(characterName)
      await createModal
        .getByLabel(/Description/i)
        .fill("Created by Playwright for persona workflow.")
      const tagsInput = createModal.getByRole("combobox", {
        name: /^Tags$/i
      })
      if ((await tagsInput.count()) > 0) {
        await tagsInput.click()
        await page.keyboard.type("e2e")
        await page.keyboard.press("Enter")
      }
      await createModal
        .getByLabel(/Greeting message/i)
        .fill("Hello from the E2E persona.")
      await createModal
        .getByLabel(/Behavior \/ instructions|System prompt/i)
        .fill("Be concise and friendly.")

      const createButton = createModal
        .getByRole("button", { name: /Create character|Save changes/i })
        .first()
      await createButton.click()
      await expect(
        page.getByText(/Character created/i)
      ).toBeVisible({ timeout: 15000 })
      await expect(createModal).toBeHidden({ timeout: 15000 })

      const searchCharacters = page.getByRole("textbox", {
        name: /Search characters/i
      })
      if ((await searchCharacters.count()) > 0) {
        await searchCharacters.fill(characterName)
        await page.waitForTimeout(400)
      }
      const characterRow = page
        .locator("tbody tr")
        .filter({ hasText: characterName })
        .first()
      let usedChatButton = false
      const rowVisible = await characterRow
        .waitFor({ state: "visible", timeout: 15000 })
        .then(() => true)
        .catch(() => false)
      if (rowVisible) {
        const chatAsButton = characterRow.getByRole("button", {
          name: new RegExp(`Chat as ${escapeRegExp(characterName)}`)
        })
        const chatVisible = await chatAsButton
          .isVisible()
          .catch(() => false)
        if (chatVisible) {
          await chatAsButton.click({ timeout: 15000 })
          usedChatButton = true
        }
      }

      if (!usedChatButton) {
        const record = await pollForCharacterByName(
          normalizedServerUrl,
          apiKey,
          characterName,
          30000
        )
        if (!record) {
          skipOrThrow(
            true,
            "Character created but not returned by search; skipping chat step."
          )
          return
        }
        await setSelectedCharacterInStorage(
          page,
          normalizeCharacterForStorage(record)
        )
        await page.goto(`${optionsUrl}#/`, {
          waitUntil: "domcontentloaded"
        })
        await waitForConnected(page, "workflow-characters-chat")
      } else {
        await page
          .waitForURL(/#\/?$/, { timeout: 15000 })
          .catch(() => {})
        await waitForConnected(page, "workflow-characters-chat")
      }

      const selectedCharacterButton = page.getByRole("button", {
        name: new RegExp(
          `${escapeRegExp(characterName)}.*Clear character`,
          "i"
        )
      })
      await expect(selectedCharacterButton).toBeVisible({ timeout: 20000 })

      const startChat = page.getByRole("button", {
        name: /Start chatting/i
      })
      if (await startChat.isVisible().catch(() => false)) {
        await startChat.click({ timeout: 15000 })
      }

      await expect(
        page.getByPlaceholder(/Ask anything|Type a message/i)
      ).toBeVisible({ timeout: 20000 })
      await expect(
        page
          .getByText(
            new RegExp(`You are chatting with ${escapeRegExp(characterName)}`)
          )
          .first()
      ).toBeVisible({ timeout: 15000 })

      await sendChatMessage(
        page,
        `Hello ${characterName}, give me a quick intro.`
      )
      await waitForAssistantMessage(page)
    } finally {
      await context.close()
      await deleteCharacterByName(normalizedServerUrl, apiKey, characterName)
    }
  })
})

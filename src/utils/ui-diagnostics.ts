import { useArtifactsStore } from "@/store/artifacts"
import { useFolderStore } from "@/store/folder"
import { usePlaygroundSessionStore } from "@/store/playground-session"
import { useQuickChatStore } from "@/store/quick-chat"
import { useSidepanelChatTabsStore } from "@/store/sidepanel-chat-tabs"
import { useStoreMessage } from "@/store"
import { useStoreMessageOption } from "@/store/option"
import { useTimelineStore } from "@/store/timeline"
import { useWebUI } from "@/store/webui"
import { getQueryClient } from "@/services/query-client"
import i18n from "@/i18n"

type MessageLike = {
  message?: string
  sources?: any[]
  images?: string[]
  variants?: Array<{ message?: string }>
}

const sumString = (value: unknown): number =>
  typeof value === "string" ? value.length : 0

const sumSourceText = (source: any): number => {
  if (!source || typeof source !== "object") return 0
  return (
    sumString(source.text) +
    sumString(source.content) +
    sumString(source.snippet) +
    sumString(source.summary)
  )
}

const summarizeMessages = (messages: MessageLike[]) => {
  let textChars = 0
  let imageChars = 0
  let sourceItems = 0
  let sourceTextChars = 0
  let variantCount = 0
  let variantTextChars = 0

  for (const msg of messages) {
    textChars += sumString(msg?.message)
    if (Array.isArray(msg?.images)) {
      for (const image of msg.images) {
        imageChars += sumString(image)
      }
    }
    if (Array.isArray(msg?.sources)) {
      sourceItems += msg.sources.length
      for (const source of msg.sources) {
        sourceTextChars += sumSourceText(source)
      }
    }
    if (Array.isArray(msg?.variants)) {
      variantCount += msg.variants.length
      for (const variant of msg.variants) {
        variantTextChars += sumString(variant?.message)
      }
    }
  }

  return {
    count: messages.length,
    textChars,
    imageChars,
    sourceItems,
    sourceTextChars,
    variantCount,
    variantTextChars
  }
}

const summarizeHistory = (history: Array<{ content?: string }>) => {
  let contentChars = 0
  for (const entry of history) {
    contentChars += sumString(entry?.content)
  }
  return { count: history.length, contentChars }
}

const summarizeSidepanelSnapshots = () => {
  const { tabs, activeTabId, snapshotsById } =
    useSidepanelChatTabsStore.getState()
  const perTab = Object.entries(snapshotsById).map(([id, snapshot]) => ({
    tabId: id,
    messageStats: summarizeMessages(snapshot.messages as MessageLike[]),
    historyStats: summarizeHistory(snapshot.history),
    queuedCount: snapshot.queuedMessages?.length ?? 0,
    isActive: id === activeTabId
  }))
  const totals = perTab.reduce(
    (acc, entry) => ({
      messageCount: acc.messageCount + entry.messageStats.count,
      messageTextChars: acc.messageTextChars + entry.messageStats.textChars,
      messageImageChars: acc.messageImageChars + entry.messageStats.imageChars,
      sourceItems: acc.sourceItems + entry.messageStats.sourceItems,
      sourceTextChars:
        acc.sourceTextChars + entry.messageStats.sourceTextChars,
      variantCount: acc.variantCount + entry.messageStats.variantCount,
      variantTextChars:
        acc.variantTextChars + entry.messageStats.variantTextChars,
      historyCount: acc.historyCount + entry.historyStats.count,
      historyChars: acc.historyChars + entry.historyStats.contentChars,
      queuedCount: acc.queuedCount + entry.queuedCount
    }),
    {
      messageCount: 0,
      messageTextChars: 0,
      messageImageChars: 0,
      sourceItems: 0,
      sourceTextChars: 0,
      variantCount: 0,
      variantTextChars: 0,
      historyCount: 0,
      historyChars: 0,
      queuedCount: 0
    }
  )

  return { tabCount: tabs.length, activeTabId, totals, perTab }
}

const summarizeArtifacts = () => {
  const { active, isOpen, isPinned } = useArtifactsStore.getState()
  return {
    isOpen,
    isPinned,
    hasActive: Boolean(active),
    contentChars: sumString(active?.content),
    titleChars: sumString(active?.title),
    tableCells: active?.table
      ? active.table.rows.length * active.table.headers.length
      : 0
  }
}

const summarizeTimeline = () => {
  const { isOpen, graph, searchResults } = useTimelineStore.getState()
  return {
    isOpen,
    nodeCount: graph?.nodes?.length ?? 0,
    edgeCount: graph?.edges?.length ?? 0,
    searchResults: searchResults.length
  }
}

const summarizeFolders = () => {
  const {
    folders,
    keywords,
    folderKeywordLinks,
    conversationKeywordLinks
  } = useFolderStore.getState()
  return {
    folderCount: folders.length,
    keywordCount: keywords.length,
    folderKeywordLinks: folderKeywordLinks.length,
    conversationKeywordLinks: conversationKeywordLinks.length
  }
}

const summarizeWebUiSettings = () => {
  const { sendWhenEnter, ttsEnabled } = useWebUI.getState()
  return { sendWhenEnter, ttsEnabled }
}

const summarizeQuickChat = () => {
  const { messages, isOpen, isStreaming } = useQuickChatStore.getState()
  return {
    isOpen,
    isStreaming,
    messageStats: summarizeMessages(messages as MessageLike[])
  }
}

const summarizePlaygroundSession = () => {
  const { historyId, serverChatId, lastUpdated } =
    usePlaygroundSessionStore.getState()
  return {
    historyId,
    serverChatId,
    lastUpdated
  }
}

const summarizeMessageStore = () => {
  const { messages, history } = useStoreMessage.getState()
  return {
    messageStats: summarizeMessages(messages as MessageLike[]),
    historyStats: summarizeHistory(history)
  }
}

const summarizeMessageOptionStore = () => {
  const {
    messages,
    history,
    selectedModel,
    serverChatId,
    serverChatState,
    temporaryChat
  } = useStoreMessageOption.getState()
  return {
    selectedModel,
    serverChatId,
    serverChatState,
    temporaryChat,
    messageStats: summarizeMessages(messages as MessageLike[]),
    historyStats: summarizeHistory(history)
  }
}

const getJsHeap = () => {
  const memory = (globalThis as any)?.performance?.memory
  if (!memory || typeof memory.usedJSHeapSize !== "number") return null
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit
  }
}

const MAX_ESTIMATE_DEPTH = 6
const MAX_ESTIMATE_BREADTH = 50

const estimateValueSize = (
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): { bytes: number; truncated: boolean } => {
  if (value == null) return { bytes: 0, truncated: false }
  if (typeof value === "string") {
    return { bytes: value.length * 2, truncated: false }
  }
  if (typeof value === "number") return { bytes: 8, truncated: false }
  if (typeof value === "boolean") return { bytes: 4, truncated: false }
  if (typeof value === "bigint") return { bytes: 8, truncated: false }
  if (typeof value !== "object") return { bytes: 0, truncated: false }

  if (seen.has(value as object)) return { bytes: 0, truncated: false }
  seen.add(value as object)

  if (depth >= MAX_ESTIMATE_DEPTH) return { bytes: 0, truncated: true }

  if (Array.isArray(value)) {
    const len = value.length
    const sampleCount = Math.min(len, MAX_ESTIMATE_BREADTH)
    let total = 0
    let truncated = len > sampleCount
    for (let i = 0; i < sampleCount; i += 1) {
      const res = estimateValueSize(value[i], depth + 1, seen)
      total += res.bytes
      truncated = truncated || res.truncated
    }
    if (sampleCount > 0 && len > sampleCount) {
      total = Math.round(total * (len / sampleCount))
    }
    return { bytes: total, truncated }
  }

  const keys = Object.keys(value as object)
  const sampleCount = Math.min(keys.length, MAX_ESTIMATE_BREADTH)
  let total = 0
  let truncated = keys.length > sampleCount
  for (let i = 0; i < sampleCount; i += 1) {
    const key = keys[i]
    total += key.length * 2
    const res = estimateValueSize(
      (value as Record<string, unknown>)[key],
      depth + 1,
      seen
    )
    total += res.bytes
    truncated = truncated || res.truncated
  }
  if (sampleCount > 0 && keys.length > sampleCount) {
    total = Math.round(total * (keys.length / sampleCount))
  }
  return { bytes: total, truncated }
}

const formatQueryKey = (key: unknown) => {
  try {
    const json = JSON.stringify(key)
    if (json.length <= 200) return json
    return `${json.slice(0, 200)}…`
  } catch {
    return String(key)
  }
}

const summarizeQueryCache = () => {
  const queryClient = getQueryClient()
  const cache = queryClient.getQueryCache().getAll()
  const entries = cache.map((query) => {
    const data = query.state.data
    const seen = new WeakSet<object>()
    const { bytes, truncated } = estimateValueSize(data, 0, seen)
    const dataType = Array.isArray(data)
      ? "array"
      : data === null
        ? "null"
        : typeof data
    const dataLength = Array.isArray(data)
      ? data.length
      : typeof data === "string"
        ? data.length
        : undefined
    return {
      key: formatQueryKey(query.queryKey),
      hash: query.queryHash,
      status: query.state.status,
      fetchStatus: query.state.fetchStatus,
      updatedAt: query.state.dataUpdatedAt,
      dataType,
      dataLength,
      approxBytes: bytes,
      truncated
    }
  })
  const totalApproxBytes = entries.reduce(
    (sum, entry) => sum + entry.approxBytes,
    0
  )
  const top = entries
    .slice()
    .sort((a, b) => b.approxBytes - a.approxBytes)
    .slice(0, 12)
  return {
    count: entries.length,
    totalApproxBytes,
    top
  }
}

const summarizeI18n = () => {
  const data =
    (i18n as any)?.store?.data && typeof (i18n as any).store.data === "object"
      ? (i18n as any).store.data
      : {}
  const { bytes, truncated } = estimateValueSize(
    data,
    0,
    new WeakSet<object>()
  )
  return {
    languageCount: Object.keys(data).length,
    languages: Object.keys(data),
    approxBytes: bytes,
    truncated
  }
}

export const registerUiDiagnostics = (
  context: "options" | "sidepanel"
) => {
  if (typeof window === "undefined") return
  const root = window as Window & {
    __tldwDiagnostics?: Record<string, any>
  }
  if (!root.__tldwDiagnostics) {
    root.__tldwDiagnostics = {}
  }
  if (root.__tldwDiagnostics.uiRegistered) return

  root.__tldwDiagnostics.uiRegistered = true
  root.__tldwDiagnostics.getUiDiagnostics = () => ({
    context,
    at: Date.now(),
    memory: getJsHeap(),
    queryCache: summarizeQueryCache(),
    i18n: summarizeI18n(),
    sidepanelTabs: summarizeSidepanelSnapshots(),
    optionStore: summarizeMessageOptionStore(),
    legacyStore: summarizeMessageStore(),
    artifacts: summarizeArtifacts(),
    timeline: summarizeTimeline(),
    folders: summarizeFolders(),
    quickChat: summarizeQuickChat(),
    playgroundSession: summarizePlaygroundSession(),
    webUi: summarizeWebUiSettings()
  })
}

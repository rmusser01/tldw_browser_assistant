import { useForm } from "@mantine/form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import React from "react"
import useDynamicTextareaSize from "~/hooks/useDynamicTextareaSize"
import { toBase64 } from "~/libs/to-base64"
import { useMessageOption, MAX_COMPARE_MODELS } from "~/hooks/useMessageOption"
import {
  Checkbox,
  Dropdown,
  Radio,
  Select,
  Switch,
  Tooltip,
  notification,
  Popover,
  Modal,
  Button
} from "antd"
import { Image } from "antd"
import { useWebUI } from "~/store/webui"
import { defaultEmbeddingModelForRag } from "~/services/tldw-server"
import {
  EraserIcon,
  GitBranch,
  ImageIcon,
  MicIcon,
  Hash,
  SlidersHorizontal,
  StopCircleIcon,
  X,
  FileIcon,
  FileText,
  PaperclipIcon,
  Gauge,
  Search,
  CornerUpLeft
} from "lucide-react"
import { getVariable } from "@/utils/select-variable"
import { useTranslation } from "react-i18next"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { handleChatInputKeyDown } from "@/utils/key-down"
import { getIsSimpleInternetSearch } from "@/services/search"
import { useStorage } from "@plasmohq/storage/hook"
import { useTabMentions } from "~/hooks/useTabMentions"
import { useFocusShortcuts } from "~/hooks/keyboard"
import { useDraftPersistence } from "@/hooks/useDraftPersistence"
import { MentionsDropdown } from "./MentionsDropdown"
import { DocumentChip } from "./DocumentChip"
import { otherUnsupportedTypes } from "../Knowledge/utils/unsupported-types"
import { PASTED_TEXT_CHAR_LIMIT } from "@/utils/constant"
import { isFireFoxPrivateMode } from "@/utils/is-private-mode"
import { CurrentChatModelSettings } from "@/components/Common/Settings/CurrentChatModelSettings"
import { ActorPopout } from "@/components/Common/Settings/ActorPopout"
import { PromptSelect } from "@/components/Common/PromptSelect"
import { useConnectionState } from "@/hooks/useConnectionState"
import { ConnectionPhase } from "@/types/connection"
import { Link, useNavigate } from "react-router-dom"
import { fetchChatModels } from "@/services/tldw-server"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"
import { useTldwAudioStatus } from "@/hooks/useTldwAudioStatus"
import { useMcpTools } from "@/hooks/useMcpTools"
import { tldwChat, tldwModels, type ChatMessage } from "@/services/tldw"
import { tldwClient, type ConversationState } from "@/services/tldw/TldwApiClient"
import { CharacterSelect } from "@/components/Common/CharacterSelect"
import { ProviderIcons } from "@/components/Common/ProviderIcon"
import type { Character } from "@/types/character"
import { RagSearchBar } from "@/components/Sidepanel/Chat/RagSearchBar"
import { BetaTag } from "@/components/Common/Beta"
import {
  SlashCommandMenu,
  type SlashCommandItem
} from "@/components/Sidepanel/Chat/SlashCommandMenu"
import { DocumentGeneratorDrawer } from "@/components/Common/Playground/DocumentGeneratorDrawer"
import { useUiModeStore } from "@/store/ui-mode"
import { useStoreChatModelSettings } from "@/store/model"
import { TokenProgressBar } from "./TokenProgressBar"
import { AttachmentsSummary } from "./AttachmentsSummary"
import { CompareToggle } from "./CompareToggle"
import { useMobile } from "@/hooks/useMediaQuery"
import { Button as TldwButton } from "@/components/Common/Button"

const getPersistenceModeLabel = (
  t: (...args: any[]) => any,
  temporaryChat: boolean,
  isConnectionReady: boolean,
  serverChatId: string | null
) => {
  if (temporaryChat) {
    return t(
      "playground:composer.persistence.ephemeral",
      "Not saved: cleared when you close this window."
    )
  }
  if (serverChatId || isConnectionReady) {
    return t(
      "playground:composer.persistence.server",
      "Saved to your tldw server (and locally)."
    )
  }
  return t(
    "playground:composer.persistence.local",
    "Saved locally until your tldw server is connected."
  )
}

type Props = {
  dropedFile: File | undefined
}

export const PlaygroundForm = ({ dropedFile }: Props) => {
  const { t } = useTranslation(["playground", "common", "option"])
  const inputRef = React.useRef<HTMLInputElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const [typing, setTyping] = React.useState<boolean>(false)
  const [checkWideMode] = useStorage("checkWideMode", false)
  const {
    onSubmit,
    messages,
    selectedModel,
    setSelectedModel,
    chatMode,
    setChatMode,
    compareMode,
    setCompareMode,
    compareFeatureEnabled,
    setCompareFeatureEnabled,
    compareSelectedModels,
    setCompareSelectedModels,
    compareMaxModels,
    setCompareMaxModels,
    speechToTextLanguage,
    stopStreamingRequest,
    streaming: isSending,
    webSearch,
    setWebSearch,
    toolChoice,
    setToolChoice,
    selectedQuickPrompt,
    textareaRef,
    setSelectedQuickPrompt,
    selectedSystemPrompt,
    setSelectedSystemPrompt,
    temporaryChat,
    setTemporaryChat,
    clearChat,
    useOCR,
    setUseOCR,
    defaultInternetSearchOn,
    setHistory,
    history,
    uploadedFiles,
    fileRetrievalEnabled,
    setFileRetrievalEnabled,
    handleFileUpload,
    removeUploadedFile,
    clearUploadedFiles,
    queuedMessages,
    addQueuedMessage,
    clearQueuedMessages,
    serverChatId,
    setServerChatId,
    serverChatState,
    setServerChatState,
    serverChatSource,
    setServerChatSource,
    setServerChatVersion,
    replyTarget,
    clearReplyTarget
  } = useMessageOption()

  const [autoSubmitVoiceMessage] = useStorage("autoSubmitVoiceMessage", false)
  const isMobileViewport = useMobile()
  const [openModelSettings, setOpenModelSettings] = React.useState(false)
  const [openActorSettings, setOpenActorSettings] = React.useState(false)
  const [compareSettingsOpen, setCompareSettingsOpen] = React.useState(false)
  const apiProvider = useStoreChatModelSettings((state) => state.apiProvider)
  const numCtx = useStoreChatModelSettings((state) => state.numCtx)
  const systemPrompt = useStoreChatModelSettings((state) => state.systemPrompt)

  const { phase, isConnected } = useConnectionState()
  const isConnectionReady = isConnected && phase === ConnectionPhase.CONNECTED
  const { capabilities, loading: capsLoading } = useServerCapabilities()
  const {
    hasMcp,
    healthState: mcpHealthState,
    tools: mcpTools,
    toolsLoading: mcpToolsLoading
  } = useMcpTools()
  const hasServerAudio =
    isConnectionReady && !capsLoading && capabilities?.hasAudio
  const { healthState: audioHealthState } = useTldwAudioStatus()
  const canUseServerAudio = hasServerAudio && audioHealthState !== "unhealthy"
  const [hasShownConnectBanner, setHasShownConnectBanner] = React.useState(false)
  const [showConnectBanner, setShowConnectBanner] = React.useState(false)
  const [showQueuedBanner, setShowQueuedBanner] = React.useState(true)
  const [documentGeneratorOpen, setDocumentGeneratorOpen] =
    React.useState(false)
  const [documentGeneratorSeed, setDocumentGeneratorSeed] = React.useState<{
    conversationId?: string | null
    message?: string | null
    messageId?: string | null
  }>({})
  const [autoStopTimeout] = useStorage("autoStopTimeout", 2000)
  const [sttModel] = useStorage("sttModel", "whisper-1")
  const [sttUseSegmentation] = useStorage("sttUseSegmentation", false)
  const [sttTimestampGranularities] = useStorage(
    "sttTimestampGranularities",
    "segment"
  )
  const [sttPrompt] = useStorage("sttPrompt", "")
  const [sttTask] = useStorage("sttTask", "transcribe")
  const [sttResponseFormat] = useStorage("sttResponseFormat", "json")
  const [sttTemperature] = useStorage("sttTemperature", 0)
  const [sttSegK] = useStorage("sttSegK", 6)
  const [sttSegMinSegmentSize] = useStorage("sttSegMinSegmentSize", 5)
  const [sttSegLambdaBalance] = useStorage("sttSegLambdaBalance", 0.01)
  const [sttSegUtteranceExpansionWidth] = useStorage(
    "sttSegUtteranceExpansionWidth",
    2
  )
  const [sttSegEmbeddingsProvider] = useStorage("sttSegEmbeddingsProvider", "")
  const [sttSegEmbeddingsModel] = useStorage("sttSegEmbeddingsModel", "")
  const [selectedCharacter] = useStorage<Character | null>(
    "selectedCharacter",
    null
  )
  const [serverPersistenceHintSeen, setServerPersistenceHintSeen] = useStorage(
    "serverPersistenceHintSeen",
    false
  )
  const [showServerPersistenceHint, setShowServerPersistenceHint] =
    React.useState(false)
  const serverSaveInFlightRef = React.useRef(false)
  const uiMode = useUiModeStore((state) => state.mode)
  const isProMode = uiMode === "pro"
  const [contextToolsOpen, setContextToolsOpen] = useStorage(
    "playgroundKnowledgeSearchOpen",
    false
  )
  const replyLabel = replyTarget
    ? [
        t("common:replyingTo", "Replying to"),
        replyTarget.name ? `${replyTarget.name}:` : null,
        replyTarget.preview
      ]
        .filter(Boolean)
        .join(" ")
    : ""

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const handler = () => setOpenActorSettings(true)
    window.addEventListener("tldw:open-actor-settings", handler)
    return () => {
      window.removeEventListener("tldw:open-actor-settings", handler)
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const handler = (event: Event) => {
      const detail = (event as CustomEvent)?.detail || {}
      setDocumentGeneratorSeed({
        conversationId: detail?.conversationId ?? serverChatId ?? null,
        message: detail?.message ?? null,
        messageId: detail?.messageId ?? null
      })
      setDocumentGeneratorOpen(true)
    }
    window.addEventListener("tldw:open-document-generator", handler)
    return () => {
      window.removeEventListener("tldw:open-document-generator", handler)
    }
  }, [serverChatId])

  const {
    tabMentionsEnabled,
    showMentions,
    mentionPosition,
    filteredTabs,
    availableTabs,
    selectedDocuments,
    handleTextChange,
    insertMention,
    closeMentions,
    addDocument,
    removeDocument,
    clearSelectedDocuments,
    reloadTabs,
    handleMentionsOpen
  } = useTabMentions(textareaRef)

  const { data: composerModels } = useQuery({
    queryKey: ["playground:chatModels"],
    queryFn: () => fetchChatModels({ returnEmpty: true }),
    enabled: true
  })

  // Ensure compare selection has a sensible default when enabling compare mode
  React.useEffect(() => {
    if (
      compareFeatureEnabled &&
      compareMode &&
      compareSelectedModels.length === 0 &&
      selectedModel
    ) {
      setCompareSelectedModels([selectedModel])
    }
  }, [
    compareFeatureEnabled,
    compareMode,
    compareSelectedModels.length,
    selectedModel,
    setCompareSelectedModels
  ])

  React.useEffect(() => {
    if (!compareFeatureEnabled && compareMode) {
      setCompareMode(false)
    }
  }, [compareFeatureEnabled, compareMode, setCompareMode])

  const compareModeActive = compareFeatureEnabled && compareMode

  const modelSummaryLabel = React.useMemo(() => {
    if (!selectedModel) {
      return t(
        "playground:composer.modelPlaceholder",
        "API / model"
      )
    }
    const models = (composerModels as any[]) || []
    const match = models.find((m) => m.model === selectedModel)
    return (
      match?.nickname ||
      match?.model ||
      selectedModel
    )
  }, [composerModels, selectedModel, t])

  const selectedModelMeta = React.useMemo(() => {
    if (!selectedModel) return null
    const models = (composerModels as any[]) || []
    return models.find((model) => model.model === selectedModel) || null
  }, [composerModels, selectedModel])

  const modelContextLength = React.useMemo(() => {
    const value =
      selectedModelMeta?.context_length ??
      selectedModelMeta?.contextLength ??
      selectedModelMeta?.details?.context_length
    return typeof value === "number" && Number.isFinite(value) ? value : null
  }, [selectedModelMeta])

  const resolvedMaxContext = React.useMemo(() => {
    if (typeof numCtx === "number" && Number.isFinite(numCtx) && numCtx > 0) {
      return numCtx
    }
    if (typeof modelContextLength === "number" && modelContextLength > 0) {
      return modelContextLength
    }
    return null
  }, [modelContextLength, numCtx])

  const resolvedProviderKey = React.useMemo(() => {
    const fromOverride = typeof apiProvider === "string" ? apiProvider.trim() : ""
    if (fromOverride) return fromOverride.toLowerCase()
    const provider =
      typeof selectedModelMeta?.provider === "string"
        ? selectedModelMeta.provider
        : "custom"
    return provider.toLowerCase()
  }, [apiProvider, selectedModelMeta])

  const providerLabel = React.useMemo(
    () => tldwModels.getProviderDisplayName(resolvedProviderKey || "custom"),
    [resolvedProviderKey]
  )

  const apiModelLabel = React.useMemo(() => {
    if (!selectedModel) {
      return t(
        "playground:composer.modelPlaceholder",
        "API / model"
      )
    }
    return `${providerLabel} / ${modelSummaryLabel}`
  }, [modelSummaryLabel, providerLabel, selectedModel, t])

  const compareSummaryLabel = React.useMemo(() => {
    if (!compareModeActive) {
      return null
    }
    const count = compareSelectedModels.length
    if (count === 0) {
      return t("playground:composer.compareNoneSelected", "No models selected for compare")
    }
    if (count === 1) {
      return t("playground:composer.compareSingle", "Comparing 1 model")
    }
    return t("playground:composer.compareMany", "Comparing {{count}} models", { count })
  }, [compareModeActive, compareSelectedModels.length, t])

  const compareModelLabelById = React.useMemo(() => {
    const map = new Map<string, string>()
    const models = (composerModels as any[]) || []
    models.forEach((model) => {
      const label = model.nickname || model.model
      if (model.model && !map.has(model.model)) {
        map.set(model.model, label)
      }
    })
    return map
  }, [composerModels])

  const compareActiveSummary = React.useMemo(() => {
    if (!compareModeActive || compareSelectedModels.length === 0) {
      return null
    }
    const maxNames = 2
    const names = compareSelectedModels
      .slice(0, maxNames)
      .map((modelId) => compareModelLabelById.get(modelId) || modelId)
    const moreCount = compareSelectedModels.length - names.length
    const label = names.join(", ") + (moreCount > 0 ? ` +${moreCount}` : "")
    return t(
      "playground:composer.compareActiveSummary",
      "Active models next turn: {{label}}",
      { label }
    )
  }, [compareModeActive, compareModelLabelById, compareSelectedModels, t])

  const compareButtonLabel = React.useMemo(() => {
    if (!compareModeActive) {
      return t("playground:composer.compareButton", "Compare models")
    }
    if (compareSelectedModels.length > 0) {
      return t(
        "playground:composer.compareButtonActive",
        "Compare: {{count}} models",
        { count: compareSelectedModels.length }
      )
    }
    return t("playground:composer.compareButtonOn", "Compare enabled")
  }, [compareModeActive, compareSelectedModels.length, t])

  const compareModelOptions = React.useMemo(() => {
    const models = (composerModels as any[]) || []
    return models.map((model) => ({
      value: model.model,
      label: (
        <div className="flex items-center gap-2">
          <ProviderIcons provider={model.provider} className="h-3 w-3 text-text-subtle" />
          <span className="truncate">
            {model.nickname || model.model}
          </span>
        </div>
      )
    }))
  }, [composerModels])

  // Grouped menu items for quick model selection dropdown
  const modelDropdownItems = React.useMemo(() => {
    const models = (composerModels as any[]) || []
    const groups = new Map<string, any[]>()
    const providerDisplayName = (provider?: string) => {
      const key = String(provider || "unknown").toLowerCase()
      if (key === "openai") return "OpenAI"
      if (key === "anthropic") return "Anthropic"
      if (key === "google") return "Google"
      if (key === "mistral") return "Mistral"
      if (key === "groq") return "Groq"
      if (key === "openrouter") return "OpenRouter"
      if (key === "ollama") return "Ollama"
      if (key === "deepseek") return "DeepSeek"
      return provider || "API"
    }

    for (const model of models) {
      const groupKey = model.provider?.toLowerCase() || "other"
      if (!groups.has(groupKey)) groups.set(groupKey, [])
      groups.get(groupKey)!.push({
        key: model.model,
        label: (
          <div className="flex items-center gap-2 text-sm">
            <ProviderIcons provider={model.provider} className="h-3 w-3 text-text-subtle" />
            <span className="truncate">{model.nickname || model.model}</span>
          </div>
        ),
        onClick: () => setSelectedModel(model.model)
      })
    }

    return Array.from(groups).map(([key, children]) => ({
      type: "group" as const,
      key: `group-${key}`,
      label: (
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-text-subtle">
          <ProviderIcons provider={key} className="h-3 w-3" />
          <span>{providerDisplayName(key)}</span>
        </div>
      ),
      children
    }))
  }, [composerModels, setSelectedModel])

  const handleCompareModelChange = (values: string[]) => {
    if (!compareFeatureEnabled) {
      return
    }
    const max =
      typeof compareMaxModels === "number" && compareMaxModels > 0
        ? compareMaxModels
        : MAX_COMPARE_MODELS
    const next = values.slice(0, max)
    if (values.length > max) {
      notification.warning({
        message: t("playground:composer.compareMaxModelsTitle", "Compare limit reached"),
        description: t(
          "playground:composer.compareMaxModels",
          "You can compare up to {{limit}} models per turn.",
          { count: max, limit: max }
        )
      })
    }
    setCompareSelectedModels(next)
  }

  const removeCompareModel = (modelId: string) => {
    if (!compareFeatureEnabled) {
      return
    }
    const next = compareSelectedModels.filter((id) => id !== modelId)
    setCompareSelectedModels(next)
  }

  const sendLabel = React.useMemo(() => {
    if (compareModeActive && compareSelectedModels.length > 1) {
      return t("playground:composer.compareSendToModels", "Send to {{count}} models", {
        count: compareSelectedModels.length
      })
    }
    return t("common:send", "Send")
  }, [compareModeActive, compareSelectedModels.length, t])

  const promptSummaryLabel = React.useMemo(() => {
    if (selectedSystemPrompt) {
      return t(
        "playground:composer.summary.systemPrompt",
        "System prompt"
      )
    }
    if (selectedQuickPrompt) {
      return t(
        "playground:composer.summary.customPrompt",
        "Custom prompt"
      )
    }
    return t(
      "playground:composer.summary.noPrompt",
      "No prompt"
    )
  }, [selectedQuickPrompt, selectedSystemPrompt, t])

  // Enable focus shortcuts (Shift+Esc to focus textarea)
  useFocusShortcuts(textareaRef, true)

  const [pasteLargeTextAsFile] = useStorage("pasteLargeTextAsFile", false)
  const textAreaFocus = React.useCallback(() => {
    const el = textareaRef.current
    if (!el) {
      return
    }
    if (el.selectionStart === el.selectionEnd) {
      const ua =
        typeof navigator !== "undefined" ? navigator.userAgent : ""
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          ua
        )
      if (!isMobile) {
        el.focus()
      } else {
        el.blur()
      }
    }
  }, [])

  const form = useForm({
    initialValues: {
      message: "",
      image: ""
    }
  })

  // Draft persistence - saves/restores message draft to localStorage
  const { draftSaved } = useDraftPersistence({
    storageKey: "tldw:playgroundChatDraft",
    getValue: () => form.values.message,
    setValue: (value) => form.setFieldValue("message", value)
  })

  const numberFormatter = React.useMemo(() => new Intl.NumberFormat(), [])
  const formatNumber = React.useCallback(
    (value: number | null) => {
      if (typeof value !== "number" || !Number.isFinite(value)) return "—"
      return numberFormatter.format(Math.round(value))
    },
    [numberFormatter]
  )

  const estimateTokensForText = React.useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return 0
    return tldwChat.estimateTokens([
      { role: "user", content: trimmed }
    ])
  }, [])

  const draftTokenCount = React.useMemo(
    () => estimateTokensForText(form.values.message || ""),
    [estimateTokensForText, form.values.message]
  )

  const conversationTokenCount = React.useMemo(() => {
    const convoMessages: ChatMessage[] = []
    const trimmedSystem = systemPrompt?.trim()
    if (trimmedSystem) {
      convoMessages.push({ role: "system", content: trimmedSystem })
    }
    messages.forEach((message) => {
      const content = typeof message.message === "string" ? message.message.trim() : ""
      if (!content) return
      if (message.isBot) {
        convoMessages.push({ role: "assistant", content })
      } else {
        convoMessages.push({ role: "user", content })
      }
    })
    if (convoMessages.length === 0) return 0
    return tldwChat.estimateTokens(convoMessages)
  }, [messages, systemPrompt])

  const promptTokenLabel = React.useMemo(
    () =>
      `${t("playground:tokens.prompt", "prompt")} ${formatNumber(draftTokenCount)}`,
    [draftTokenCount, formatNumber, t]
  )
  const convoTokenLabel = React.useMemo(
    () =>
      `${t("playground:tokens.total", "tokens")} ${formatNumber(conversationTokenCount)}`,
    [conversationTokenCount, formatNumber, t]
  )
  const contextTokenLabel = React.useMemo(
    () => `${formatNumber(resolvedMaxContext)} ctx`,
    [formatNumber, resolvedMaxContext]
  )
  const tokenUsageLabel = React.useMemo(
    () => `${promptTokenLabel} · ${convoTokenLabel} / ${contextTokenLabel}`,
    [contextTokenLabel, convoTokenLabel, promptTokenLabel]
  )
  const tokenUsageCompactLabel = React.useMemo(() => {
    const prompt = formatNumber(draftTokenCount)
    const convo = formatNumber(conversationTokenCount)
    const ctx = formatNumber(resolvedMaxContext)
    return `${prompt} · ${convo}/${ctx} ctx`
  }, [conversationTokenCount, draftTokenCount, formatNumber, resolvedMaxContext])
  const tokenUsageDisplay = isProMode
    ? tokenUsageLabel
    : tokenUsageCompactLabel
  const contextLabel = React.useMemo(
    () =>
      t(
        "common:modelSettings.form.numCtx.label",
        "Context Window Size (num_ctx)"
      ),
    [t]
  )
  const tokenUsageTooltip = React.useMemo(
    () =>
      `${apiModelLabel} · ${promptTokenLabel} · ${convoTokenLabel} · ${contextLabel} ${formatNumber(resolvedMaxContext)}`,
    [
      apiModelLabel,
      contextLabel,
      convoTokenLabel,
      formatNumber,
      promptTokenLabel,
      resolvedMaxContext
    ]
  )

  const showModelLabel = !isProMode
  const modelUsageBadge = (
    <div className="inline-flex items-center gap-2">
      {showModelLabel && (
        <Dropdown
          menu={{
            items: modelDropdownItems,
            style: { maxHeight: 400, overflowY: "auto" },
            className: "no-scrollbar",
            activeKey: selectedModel ?? undefined
          }}
          trigger={["click"]}
          placement="topLeft"
        >
          <Tooltip title={apiModelLabel} placement="top">
            <button
              type="button"
              title={apiModelLabel}
              aria-label={apiModelLabel}
              className="inline-flex min-w-0 items-center gap-1 rounded-full border border-border bg-surface px-2 h-9 text-[10px] cursor-pointer hover:bg-surface-hover transition-colors"
            >
              <ProviderIcons
                provider={resolvedProviderKey}
                className="h-3 w-3 text-text-subtle"
              />
              <span className="truncate max-w-[120px]">
                {apiModelLabel}
              </span>
            </button>
          </Tooltip>
        </Dropdown>
      )}
      <TokenProgressBar
        conversationTokens={conversationTokenCount}
        draftTokens={draftTokenCount}
        maxTokens={resolvedMaxContext}
        modelLabel={isProMode ? apiModelLabel : undefined}
        compact={!isProMode}
      />
    </div>
  )

  // Allow other components (e.g., connection card) to request focus
  React.useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        textAreaFocus()
      }
    }
    window.addEventListener('tldw:focus-composer', handler)
    return () => window.removeEventListener('tldw:focus-composer', handler)
  }, [textAreaFocus])

  const buildDiscussMediaHint = (payload: {
    mediaId?: string
    url?: string
    title?: string
    content?: string
  }): string => {
    if (payload?.content && (payload.title || payload.mediaId)) {
      const header = `Chat with this media: ${
        payload.title || payload.mediaId
      }`.trim()
      return `${header}\n\n${payload.content}`.trim()
    }
    if (payload?.url) {
      return `Let's talk about the media I just ingested: ${payload.url}`
    }
    if (payload?.mediaId) {
      return `Let's talk about media ${payload.mediaId}.`
    }
    return ""
  }

  // Seed composer when a media item requests discussion (e.g., from Quick ingest or Review page)
  React.useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const raw = localStorage.getItem("tldw:discussMediaPrompt")
      if (!raw) return
      localStorage.removeItem("tldw:discussMediaPrompt")
      const payload = JSON.parse(raw) as {
        mediaId?: string
        url?: string
        title?: string
        content?: string
      }
      const hint = buildDiscussMediaHint(payload)
      if (!hint) return
      form.setFieldValue("message", hint)
      textAreaFocus()
    } catch {
      // ignore storage/parse errors
    }
  }, [form, textAreaFocus])

  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as any
      if (!detail) return
      const hint = buildDiscussMediaHint(detail || {})
      if (!hint) return
      form.setFieldValue("message", hint)
      textAreaFocus()
    }
    window.addEventListener("tldw:discuss-media", handler as any)
    return () => {
      window.removeEventListener("tldw:discuss-media", handler as any)
    }
  }, [form, textAreaFocus])

  React.useEffect(() => {
    textAreaFocus()
  }, [textAreaFocus])

  React.useEffect(() => {
    if (defaultInternetSearchOn) {
      setWebSearch(true)
    }
  }, [defaultInternetSearchOn, setWebSearch])

  React.useEffect(() => {
    if (isConnectionReady) {
      setShowConnectBanner(false)
    }
  }, [isConnectionReady])

  React.useEffect(() => {
    if (queuedMessages.length > 0) {
      setShowQueuedBanner(true)
    } else {
      setShowQueuedBanner(false)
    }
  }, [queuedMessages])

  const onFileInputChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0]

        const isUnsupported = otherUnsupportedTypes.includes(file.type)

        if (isUnsupported) {
          console.error("File type not supported:", file.type)
          return
        }

        const isImage = file.type.startsWith("image/")
        if (isImage) {
          const base64 = await toBase64(file)
          form.setFieldValue("image", base64)
        } else {
          await handleFileUpload(file)
        }
      }
    },
    [form, handleFileUpload, otherUnsupportedTypes, toBase64]
  )

  const onInputChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement> | File) => {
      if (e instanceof File) {
        const isUnsupported = otherUnsupportedTypes.includes(e.type)

        if (isUnsupported) {
          console.error("File type not supported:", e.type)
          return
        }

        const isImage = e.type.startsWith("image/")
        if (isImage) {
          const base64 = await toBase64(e)
          form.setFieldValue("image", base64)
        } else {
          await handleFileUpload(e)
        }
      } else {
        if (e.target.files) {
          onFileInputChange(e)
        }
      }
    },
    [form, handleFileUpload, onFileInputChange, otherUnsupportedTypes, toBase64]
  )
  const handlePaste = async (e: React.ClipboardEvent) => {
    if (e.clipboardData.files.length > 0) {
      onInputChange(e.clipboardData.files[0])
      return
    }

    const pastedText = e.clipboardData.getData("text/plain")

    if (
      pasteLargeTextAsFile &&
      pastedText &&
      pastedText.length > PASTED_TEXT_CHAR_LIMIT
    ) {
      e.preventDefault()
      const blob = new Blob([pastedText], { type: "text/plain" })
      const file = new File([blob], `pasted-text-${Date.now()}.txt`, {
        type: "text/plain"
      })

      await handleFileUpload(file)
      return
    }
  }
  React.useEffect(() => {
    if (dropedFile) {
      onInputChange(dropedFile)
    }
  }, [dropedFile, onInputChange])

  const handleDisconnectedFocus = () => {
    if (!isConnectionReady && !hasShownConnectBanner) {
      setShowConnectBanner(true)
      setHasShownConnectBanner(true)
    }
  }

  // Match sidepanel textarea sizing: Pro mode gets more space
  const textareaMaxHeight = isProMode ? 160 : 120
  useDynamicTextareaSize(textareaRef, form.values.message, textareaMaxHeight)

  const {
    transcript,
    isListening,
    resetTranscript,
    start: startListening,
    stop: stopSpeechRecognition,
    supported: browserSupportsSpeechRecognition
  } = useSpeechRecognition({
    autoStop: autoSubmitVoiceMessage,
    autoStopTimeout,
    onEnd: async () => {
      if (autoSubmitVoiceMessage) {
        submitForm()
      }
    }
  })
  const { sendWhenEnter, setSendWhenEnter } = useWebUI()
  const speechAvailable =
    browserSupportsSpeechRecognition || canUseServerAudio
  const speechUsesServer = canUseServerAudio

  React.useEffect(() => {
    if (isListening) {
      form.setFieldValue("message", transcript)
    }
  }, [transcript])

  React.useEffect(() => {
    if (!selectedQuickPrompt) {
      return
    }

    const currentMessage = form.values.message || ""
    const promptText = selectedQuickPrompt

    const applyOverwrite = () => {
      const word = getVariable(promptText)
      form.setFieldValue("message", promptText)
      if (word) {
        textareaRef.current?.focus()
        const interval = setTimeout(() => {
          textareaRef.current?.setSelectionRange(word.start, word.end)
          setSelectedQuickPrompt(null)
        }, 100)
        return () => {
          clearInterval(interval)
        }
      }
      setSelectedQuickPrompt(null)
      return
    }

    const applyAppend = () => {
      const next =
        currentMessage.trim().length > 0
          ? `${currentMessage}\n\n${promptText}`
          : promptText
      form.setFieldValue("message", next)
      setSelectedQuickPrompt(null)
    }

    if (!currentMessage.trim()) {
      applyOverwrite()
      return
    }

    Modal.confirm({
      title: t("option:promptInsert.confirmTitle", {
        defaultValue: "Use prompt in chat?"
      }),
      content: t("option:promptInsert.confirmDescription", {
        defaultValue:
          "Your message already has text. Do you want to overwrite it with this prompt or append the prompt below it?"
      }),
      okText: t("option:promptInsert.overwrite", {
        defaultValue: "Overwrite message"
      }),
      cancelText: t("option:promptInsert.append", {
        defaultValue: "Append"
      }),
      closable: false,
      maskClosable: false,
      onOk: () => {
        applyOverwrite()
      },
      onCancel: () => {
        applyAppend()
      }
    })
  }, [selectedQuickPrompt])

  const queryClient = useQueryClient()
  const invalidateServerChatHistory = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["serverChatHistory"] })
  }, [queryClient])

  const { mutateAsync: sendMessage } = useMutation({
    mutationFn: onSubmit,
    onSuccess: () => {
      textAreaFocus()
      queryClient.invalidateQueries({
        queryKey: ["fetchChatHistory"]
      })
    },
    onError: (error) => {
      textAreaFocus()
    }
  })

  const submitForm = () => {
    form.onSubmit(async (value) => {
      const slashResult = applySlashCommand(value.message)
      if (slashResult.handled) {
        form.setFieldValue("message", slashResult.message)
      }
      const nextMessage = slashResult.handled
        ? slashResult.message
        : value.message
      const trimmed = nextMessage.trim()
      if (
        trimmed.length === 0 &&
        value.image.length === 0 &&
        selectedDocuments.length === 0 &&
        uploadedFiles.length === 0
      ) {
        return
      }
      if (!isConnectionReady) {
        addQueuedMessage({
          message: trimmed,
          image: value.image
        })
        form.reset()
        clearSelectedDocuments()
        clearUploadedFiles()
        return
      }
      const defaultEM = await defaultEmbeddingModelForRag()
      if (!compareModeActive) {
        if (!selectedModel || selectedModel.length === 0) {
          form.setFieldError("message", t("formError.noModel"))
          return
        }
      } else if (!compareSelectedModels || compareSelectedModels.length === 0) {
        form.setFieldError(
          "message",
          t(
            "playground:composer.validationCompareSelectModelsInline",
            "Select at least one model for Compare mode."
          )
        )
        return
      }

      if (webSearch) {
        const simpleSearch = await getIsSimpleInternetSearch()
        if (!defaultEM && !simpleSearch) {
          form.setFieldError("message", t("formError.noEmbeddingModel"))
          return
        }
      }
      form.reset()
      clearSelectedDocuments()
      clearUploadedFiles()
      textAreaFocus()
      await sendMessage({
        image: value.image,
        message: trimmed,
        docs: selectedDocuments.map((doc) => ({
          type: "tab",
          tabId: doc.id,
          title: doc.title,
          url: doc.url,
          favIconUrl: doc.favIconUrl
        }))
      })
    })()
  }

  const submitFormFromQueued = (message: string, image: string) => {
    if (!isConnectionReady) {
      return
    }
    form.onSubmit(async () => {
      const slashResult = applySlashCommand(message)
      const nextMessage = slashResult.handled
        ? slashResult.message
        : message
      const trimmed = nextMessage.trim()
      if (
        trimmed.length === 0 &&
        image.length === 0 &&
        selectedDocuments.length === 0 &&
        uploadedFiles.length === 0
      ) {
        return
      }
      const defaultEM = await defaultEmbeddingModelForRag()
      if (!compareModeActive) {
        if (!selectedModel || selectedModel.length === 0) {
          form.setFieldError("message", t("formError.noModel"))
          return
        }
      } else if (!compareSelectedModels || compareSelectedModels.length === 0) {
        form.setFieldError(
          "message",
          t(
            "playground:composer.validationCompareSelectModelsInline",
            "Select at least one model for Compare mode."
          )
        )
        return
      }
      if (webSearch) {
        const simpleSearch = await getIsSimpleInternetSearch()
        if (!defaultEM && !simpleSearch) {
          form.setFieldError("message", t("formError.noEmbeddingModel"))
          return
        }
      }
      form.reset()
      clearSelectedDocuments()
      clearUploadedFiles()
      textAreaFocus()
      await sendMessage({
        image,
        message: trimmed,
        docs: selectedDocuments.map((doc) => ({
          type: "tab",
          tabId: doc.id,
          title: doc.title,
          url: doc.url,
          favIconUrl: doc.favIconUrl
        }))
      })
    })()
  }

  const handleToggleTemporaryChat = React.useCallback(
    (next: boolean) => {
      if (isFireFoxPrivateMode) {
        notification.error({
          message: t(
            "common:privateModeSaveErrorTitle",
            "tldw Assistant can't save data"
          ),
          description: t(
            "playground:errors.privateModeDescription",
            "Firefox Private Mode does not support saving chat. Temporary chat is enabled by default. More fixes coming soon."
          )
        })
        return
      }

      const hasExistingHistory = history.length > 0

      // Show confirmation when enabling temporary mode with existing messages
      if (next && hasExistingHistory) {
        Modal.confirm({
          title: t(
            "playground:composer.tempChatConfirmTitle",
            "Enable temporary mode?"
          ),
          content: t(
            "playground:composer.tempChatConfirmContent",
            "This will clear your current conversation. Messages won't be saved."
          ),
          okText: t("common:confirm", "Confirm"),
          cancelText: t("common:cancel", "Cancel"),
          onOk: () => {
            setTemporaryChat(next)
            clearChat()
            const modeLabel = getPersistenceModeLabel(
              t,
              next,
              isConnectionReady,
              serverChatId
            )
            notification.info({
              message: modeLabel,
              placement: "bottomRight",
              duration: 2.5
            })
          }
        })
        return
      }

      // No confirmation needed when disabling temporary mode or no existing messages
      setTemporaryChat(next)
      if (hasExistingHistory) {
        clearChat()
      }

      const modeLabel = getPersistenceModeLabel(
        t,
        next,
        isConnectionReady,
        serverChatId
      )

      notification.info({
        message: modeLabel,
        placement: "bottomRight",
        duration: 2.5
      })
    },
    [clearChat, history.length, isConnectionReady, serverChatId, setTemporaryChat, t]
  )

  const handleSaveChatToServer = React.useCallback(async () => {
    if (
      !isConnectionReady ||
      temporaryChat ||
      serverChatId ||
      history.length === 0
    ) {
      return
    }
    try {
      await tldwClient.initialize()

      const snapshot = [...history]
      const firstUser = snapshot.find((m) => m.role === "user")
      const fallbackTitle = t(
        "playground:composer.persistence.serverDefaultTitle",
        "Extension chat"
      )
      const titleSource =
        typeof firstUser?.content === "string" &&
        firstUser.content.trim().length > 0
          ? firstUser.content.trim()
          : fallbackTitle
      const title =
        titleSource.length > 80 ? `${titleSource.slice(0, 77)}…` : titleSource

      let characterId: string | number | null =
        (selectedCharacter as any)?.id ?? null

      if (!characterId) {
        const DEFAULT_NAME = "Helpful AI Assistant"
        try {
          const characters = await tldwClient.listCharacters()
          const existing = (characters || []).find((c: any) => {
            const name = String(c?.name || "").trim().toLowerCase()
            return name === DEFAULT_NAME.toLowerCase()
          })
          let target = existing
          if (!target) {
            target = await tldwClient.createCharacter({
              name: DEFAULT_NAME
            })
          }
          characterId =
            target && typeof target.id !== "undefined" ? target.id : null
        } catch {
          characterId = null
        }
      }

      if (characterId == null) {
        notification.error({
          message: t("error"),
          description: t(
            "playground:composer.persistence.serverCharacterRequired",
            "Unable to find or create a default assistant character on the server. Try again from the Characters page."
          ),
          btn: (
            <Button
              type="primary"
              size="small"
              title={t(
                "playground:composer.persistence.serverCharacterCta",
                "Open Characters workspace"
              ) as string}
              onClick={() => {
                navigate("/characters?from=server-chat-persistence-error")
              }}>
              {t(
                "playground:composer.persistence.serverCharacterCta",
                "Open Characters workspace"
              )}
            </Button>
          ),
          duration: 6
        })
        return
      }

      const created = await tldwClient.createChat({
        title,
        character_id: characterId,
        state: serverChatState || "in-progress",
        source:
          serverChatSource && serverChatSource.trim().length > 0
            ? serverChatSource.trim()
            : undefined
      })
      const rawId = (created as any)?.id ?? (created as any)?.chat_id ?? created
      const cid = rawId != null ? String(rawId) : ""
      if (!cid) {
        throw new Error("Failed to create server chat")
      }
      setServerChatId(cid)
      setServerChatState(
        (created as any)?.state ??
          (created as any)?.conversation_state ??
          serverChatState ??
          "in-progress"
      )
      setServerChatSource((created as any)?.source ?? serverChatSource ?? null)
      setServerChatVersion((created as any)?.version ?? null)
      invalidateServerChatHistory()

      for (const msg of snapshot) {
        const content = (msg.content || "").trim()
        if (!content) continue
        const role =
          msg.role === "system" ||
          msg.role === "assistant" ||
          msg.role === "user"
            ? msg.role
            : "user"
        await tldwClient.addChatMessage(cid, {
          role,
          content
        })
      }

      if (!serverPersistenceHintSeen) {
        notification.success({
          message: t(
            "playground:composer.persistence.serverSavedTitle",
            "Chat now saved on server"
          ),
          description:
            t(
              "playground:composer.persistence.serverSaved",
              "Future messages in this chat will sync to your tldw server."
            ) +
            " " +
            t(
              "playground:composer.persistence.serverBenefits",
              "This keeps a durable record in server history so you can reopen the conversation later, access it from other browsers, and run server-side analytics over your chats."
            )
        })
        setServerPersistenceHintSeen(true)
        setShowServerPersistenceHint(true)
      }
    } catch (e: any) {
      notification.error({
        message: t("error"),
        description: e?.message || t("somethingWentWrong")
      })
    }
  }, [
    history,
    invalidateServerChatHistory,
    isConnectionReady,
    temporaryChat,
    serverChatId,
    setServerChatId,
    navigate,
    serverPersistenceHintSeen,
    setServerPersistenceHintSeen,
    t
  ])

  React.useEffect(() => {
    if (
      !isConnectionReady ||
      temporaryChat ||
      serverChatId ||
      history.length === 0
    ) {
      return
    }
    if (serverSaveInFlightRef.current) {
      return
    }
    serverSaveInFlightRef.current = true
    Promise.resolve(handleSaveChatToServer()).finally(() => {
      serverSaveInFlightRef.current = false
    })
  }, [
    handleSaveChatToServer,
    history.length,
    isConnectionReady,
    serverChatId,
    temporaryChat
  ])

  const handleClearContext = React.useCallback(() => {
    // Only show confirmation if there's history to clear
    if (history.length === 0) {
      return
    }

    Modal.confirm({
      title: t(
        "playground:composer.clearContextConfirmTitle",
        "Clear conversation?"
      ),
      content: t(
        "playground:composer.clearContextConfirmContent",
        "This will remove all messages from the current conversation. This action cannot be undone."
      ),
      okText: t("common:confirm", "Confirm"),
      okButtonProps: { danger: true },
      cancelText: t("common:cancel", "Cancel"),
      onOk: () => {
        setHistory([])
        notification.success({
          message: t(
            "playground:composer.clearContextSuccess",
            "Conversation cleared"
          ),
          duration: 2
        })
      }
    })
  }, [history.length, setHistory, t])

  const handleToggleContextTools = React.useCallback(() => {
    setContextToolsOpen(!contextToolsOpen)
  }, [contextToolsOpen, setContextToolsOpen])

  const handleImageUpload = React.useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleDocumentUpload = React.useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const slashCommands = React.useMemo<SlashCommandItem[]>(
    () => [
      {
        id: "slash-search",
        command: "search",
        label: t(
          "common:commandPalette.toggleKnowledgeSearch",
          "Toggle Knowledge Search"
        ),
        description: t(
          "common:commandPalette.toggleKnowledgeSearchDesc",
          "Search your knowledge base"
        ),
        keywords: ["rag", "context", "knowledge", "search"],
        action: () => setChatMode(chatMode === "rag" ? "normal" : "rag")
      },
      {
        id: "slash-web",
        command: "web",
        label: t(
          "common:commandPalette.toggleWebSearch",
          "Toggle Web Search"
        ),
        description: t(
          "common:commandPalette.toggleWebDesc",
          "Search the internet"
        ),
        keywords: ["web", "internet", "browse"],
        action: () => setWebSearch(!webSearch)
      },
      {
        id: "slash-vision",
        command: "vision",
        label: t("playground:actions.upload", "Attach image"),
        description: t(
          "playground:composer.slashVisionDesc",
          "Attach an image for vision"
        ),
        keywords: ["image", "ocr", "vision"],
        action: handleImageUpload
      },
      {
        id: "slash-model",
        command: "model",
        label: t("common:commandPalette.switchModel", "Switch Model"),
        description: t(
          "common:currentChatModelSettings",
          "Open current chat settings"
        ),
        keywords: ["settings", "parameters", "temperature"],
        action: () => setOpenModelSettings(true)
      }
    ],
    [chatMode, handleImageUpload, setChatMode, setWebSearch, t, webSearch, setOpenModelSettings]
  )

  const slashCommandLookup = React.useMemo(
    () => new Map(slashCommands.map((command) => [command.command, command])),
    [slashCommands]
  )

  const slashMatch = React.useMemo(
    () => form.values.message.match(/^\s*\/(\w*)$/),
    [form.values.message]
  )
  const slashQuery = slashMatch?.[1] ?? ""
  const showSlashMenu = Boolean(slashMatch)
  const [slashActiveIndex, setSlashActiveIndex] = React.useState(0)

  const filteredSlashCommands = React.useMemo(() => {
    if (!slashQuery) return slashCommands
    const q = slashQuery.toLowerCase()
    return slashCommands.filter((command) => {
      if (command.command.startsWith(q)) return true
      if (command.label.toLowerCase().includes(q)) return true
      return (command.keywords || []).some((keyword) =>
        keyword.toLowerCase().includes(q)
      )
    })
  }, [slashCommands, slashQuery])

  React.useEffect(() => {
    if (!showSlashMenu) {
      setSlashActiveIndex(0)
      return
    }
    setSlashActiveIndex((prev) => {
      if (filteredSlashCommands.length === 0) return 0
      return Math.min(prev, filteredSlashCommands.length - 1)
    })
  }, [showSlashMenu, filteredSlashCommands.length, slashQuery])

  const parseSlashInput = React.useCallback((text: string) => {
    const trimmed = text.trimStart()
    const match = trimmed.match(/^\/(\w+)(?:\s+([\s\S]*))?$/)
    if (!match) return null
    return {
      command: match[1].toLowerCase(),
      remainder: match[2] || ""
    }
  }, [])

  const applySlashCommand = React.useCallback(
    (text: string) => {
      const parsed = parseSlashInput(text)
      if (!parsed) {
        return { handled: false, message: text }
      }
      const command = slashCommandLookup.get(parsed.command)
      if (!command) {
        return { handled: false, message: text }
      }
      command.action()
      return { handled: true, message: parsed.remainder }
    },
    [parseSlashInput, slashCommandLookup]
  )

  const handleSlashCommandSelect = React.useCallback(
    (command: SlashCommandItem) => {
      const parsed = parseSlashInput(form.values.message)
      command.action()
      form.setFieldValue("message", parsed?.remainder || "")
      requestAnimationFrame(() => textareaRef.current?.focus())
    },
    [form, parseSlashInput, textareaRef]
  )

  const serverRecorderRef = React.useRef<MediaRecorder | null>(null)
  const serverChunksRef = React.useRef<BlobPart[]>([])
  const [isServerDictating, setIsServerDictating] = React.useState(false)

  const stopServerDictation = React.useCallback(() => {
    const rec = serverRecorderRef.current
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop()
      } catch {}
    }
  }, [])

  const handleSpeechToggle = React.useCallback(() => {
    if (isListening) {
      stopSpeechRecognition()
    } else {
      resetTranscript()
      startListening({
        continuous: true,
        lang: speechToTextLanguage
      })
    }
  }, [isListening, resetTranscript, speechToTextLanguage, startListening, stopSpeechRecognition])

  const persistChatMetadata = React.useCallback(
    async (patch: Record<string, any>) => {
      if (!serverChatId) return
      try {
        const updated = await tldwClient.updateChat(serverChatId, patch)
        setServerChatState(
          (updated as any)?.state ??
            (updated as any)?.conversation_state ??
            "in-progress"
        )
        setServerChatSource((updated as any)?.source ?? null)
        setServerChatVersion((updated as any)?.version ?? null)
        invalidateServerChatHistory()
      } catch (e: any) {
        notification.error({
          message: t("error", { defaultValue: "Error" }),
          description:
            e?.message ||
            t("somethingWentWrong", { defaultValue: "Something went wrong" })
        })
      }
    },
    [
      invalidateServerChatHistory,
      serverChatId,
      setServerChatSource,
      setServerChatState,
      setServerChatVersion,
      t
    ]
  )

  const handleServerDictationToggle = React.useCallback(async () => {
    if (isServerDictating) {
      stopServerDictation()
      return
    }
    if (!canUseServerAudio) {
      notification.error({
        message: t(
          "playground:actions.speechUnavailableTitle",
          "Dictation unavailable"
        ),
        description: t(
          "playground:actions.speechUnavailableBody",
          "Connect to a tldw server that exposes the audio transcriptions API to use dictation."
        )
      })
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      serverChunksRef.current = []
      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          serverChunksRef.current.push(ev.data)
        }
      }
      recorder.onerror = (event: Event) => {
        console.error("MediaRecorder error", event)
        notification.error({
          message: t("playground:actions.speechErrorTitle", "Dictation failed"),
          description: t(
            "playground:actions.speechErrorBody",
            "Microphone recording error. Check your permissions and try again."
          )
        })
      }
      recorder.onstop = async () => {
        try {
          const blob = new Blob(serverChunksRef.current, {
            type: recorder.mimeType || "audio/webm"
          })
          if (blob.size === 0) {
            return
          }
          const sttOptions: Record<string, any> = {
            language: speechToTextLanguage
          }
          if (sttModel && sttModel.trim().length > 0) {
            sttOptions.model = sttModel.trim()
          }
          if (sttTimestampGranularities) {
            sttOptions.timestamp_granularities = sttTimestampGranularities
          }
          if (sttPrompt && sttPrompt.trim().length > 0) {
            sttOptions.prompt = sttPrompt.trim()
          }
          if (sttTask) {
            sttOptions.task = sttTask
          }
          if (sttResponseFormat) {
            sttOptions.response_format = sttResponseFormat
          }
          if (typeof sttTemperature === "number") {
            sttOptions.temperature = sttTemperature
          }
          if (sttUseSegmentation) {
            sttOptions.segment = true
            if (typeof sttSegK === "number") {
              sttOptions.seg_K = sttSegK
            }
            if (typeof sttSegMinSegmentSize === "number") {
              sttOptions.seg_min_segment_size = sttSegMinSegmentSize
            }
            if (typeof sttSegLambdaBalance === "number") {
              sttOptions.seg_lambda_balance = sttSegLambdaBalance
            }
            if (typeof sttSegUtteranceExpansionWidth === "number") {
              sttOptions.seg_utterance_expansion_width =
                sttSegUtteranceExpansionWidth
            }
            if (sttSegEmbeddingsProvider?.trim()) {
              sttOptions.seg_embeddings_provider =
                sttSegEmbeddingsProvider.trim()
            }
            if (sttSegEmbeddingsModel?.trim()) {
              sttOptions.seg_embeddings_model = sttSegEmbeddingsModel.trim()
            }
          }
          const res = await tldwClient.transcribeAudio(blob, sttOptions)
          let text = ""
          if (res) {
            if (typeof res === "string") {
              text = res
            } else if (typeof (res as any).text === "string") {
              text = (res as any).text
            } else if (typeof (res as any).transcript === "string") {
              text = (res as any).transcript
            } else if (Array.isArray((res as any).segments)) {
              text = (res as any).segments
                .map((s: any) => s?.text || "")
                .join(" ")
                .trim()
            }
          }
          if (text) {
            form.setFieldValue("message", text)
          } else {
            notification.error({
              message: t("playground:actions.speechErrorTitle", "Dictation failed"),
              description: t(
                "playground:actions.speechNoText",
                "The transcription did not return any text."
              )
            })
          }
        } catch (e: any) {
          notification.error({
            message: t("playground:actions.speechErrorTitle", "Dictation failed"),
            description: e?.message || t(
              "playground:actions.speechErrorBody",
              "Transcription request failed. Check tldw server health."
            )
          })
        } finally {
          try {
            stream.getTracks().forEach((trk) => trk.stop())
          } catch {}
          serverRecorderRef.current = null
          setIsServerDictating(false)
        }
      }
      serverRecorderRef.current = recorder
      recorder.start()
      setIsServerDictating(true)
    } catch (e: any) {
      notification.error({
        message: t("playground:actions.speechErrorTitle", "Dictation failed"),
        description: t(
          "playground:actions.speechMicError",
          "Unable to access your microphone. Check browser permissions and try again."
        )
      })
    }
  }, [
    canUseServerAudio,
    isServerDictating,
    speechToTextLanguage,
    sttModel,
    sttTimestampGranularities,
    sttUseSegmentation,
    stopServerDictation,
    t,
    form
  ])

  React.useEffect(() => {
    if (contextToolsOpen) {
      reloadTabs()
    }
  }, [contextToolsOpen, reloadTabs])

  const moreToolsContent = React.useMemo(
    () => (
      <div className="flex w-64 flex-col gap-3">
        <button
          type="button"
          onClick={handleToggleContextTools}
          aria-pressed={contextToolsOpen}
          title={
            contextToolsOpen
              ? (t(
                  "playground:composer.contextKnowledgeClose",
                  "Close Ctx + Media"
                ) as string)
              : (t(
                  "playground:composer.contextKnowledge",
                  "Ctx + Media"
                ) as string)
          }
          className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-sm transition ${
            contextToolsOpen
              ? "bg-surface2 text-accent"
              : "text-text hover:bg-surface2"
          }`}
        >
          <span>
            {contextToolsOpen
              ? t(
                  "playground:composer.contextKnowledgeClose",
                  "Close Ctx + Media"
                )
              : t(
                  "playground:composer.contextKnowledge",
                  "Ctx + Media"
                )}
          </span>
          <Search className="h-4 w-4" />
        </button>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text">
            {webSearch
              ? t("playground:actions.webSearchOn")
              : t("playground:actions.webSearchOff")}
          </span>
          <Switch
            size="small"
            checked={webSearch}
            onChange={(value) => setWebSearch(value)}
            checkedChildren={t("form.webSearch.on")}
            unCheckedChildren={t("form.webSearch.off")}
          />
        </div>
        <div className="panel-divider my-1" />
        <div className="text-xs font-semibold text-text-muted">
          {t("playground:composer.toolChoiceLabel", "Tool choice")}
        </div>
        <Tooltip
          title={
            !hasMcp
              ? t(
                  "playground:composer.mcpToolsUnavailable",
                  "MCP tools unavailable"
                )
              : mcpHealthState === "unhealthy"
                ? t("playground:composer.mcpToolsUnhealthy", "MCP tools are offline")
                : mcpToolsLoading
                  ? t("playground:composer.mcpToolsLoading", "Loading tools...")
                  : mcpTools.length === 0
                    ? t("playground:composer.mcpToolsEmpty", "No MCP tools available")
                    : ""
          }
          open={
            !hasMcp ||
            mcpHealthState === "unhealthy" ||
            mcpToolsLoading ||
            mcpTools.length === 0
              ? undefined
              : false
          }
        >
          <Radio.Group
            size="small"
            value={toolChoice}
            onChange={(e) => setToolChoice(e.target.value as typeof toolChoice)}
            className="flex flex-wrap gap-2"
            aria-label={t("playground:composer.toolChoiceLabel", "Tool choice")}
            disabled={
              !hasMcp ||
              mcpHealthState === "unhealthy" ||
              mcpToolsLoading ||
              mcpTools.length === 0
            }
          >
            <Radio.Button value="auto">
              {t("playground:composer.toolChoiceAuto", "Auto")}
            </Radio.Button>
            <Radio.Button value="required">
              {t("playground:composer.toolChoiceRequired", "Required")}
            </Radio.Button>
            <Radio.Button value="none">
              {t("playground:composer.toolChoiceNone", "None")}
            </Radio.Button>
          </Radio.Group>
        </Tooltip>
        <div className="text-xs font-semibold text-text-muted">
          {t("playground:composer.mcpToolsLabel", "MCP tools")}
        </div>
        {mcpToolsLoading ? (
          <div className="text-xs text-text-muted">
            {t("playground:composer.mcpToolsLoading", "Loading tools...")}
          </div>
        ) : mcpTools.length === 0 ? (
          <div className="text-xs text-text-muted">
            {!hasMcp
              ? t(
                  "playground:composer.mcpToolsUnavailable",
                  "MCP tools unavailable"
                )
              : mcpHealthState === "unhealthy"
                ? t("playground:composer.mcpToolsUnhealthy", "MCP tools are offline")
                : t("playground:composer.mcpToolsEmpty", "No MCP tools available")}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {mcpTools.slice(0, 6).map((tool, index) => {
              const toolFn = (tool as any)?.function
              const name =
                (typeof tool?.name === "string" && tool.name) ||
                (typeof toolFn?.name === "string" && toolFn.name) ||
                (typeof (tool as any)?.id === "string" && (tool as any).id) ||
                `tool-${index + 1}`
              const description =
                (typeof tool?.description === "string" && tool.description) ||
                (typeof toolFn?.description === "string" && toolFn.description) ||
                ""
              return (
                <span
                  key={`${name}-${index}`}
                  title={description || name}
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text"
                >
                  {name}
                </span>
              )
            })}
            {mcpTools.length > 6 && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
                +{mcpTools.length - 6}
              </span>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setCompareSettingsOpen(true)}
          title={compareButtonLabel}
          className="flex w-full items-center justify-between rounded-md px-2 py-1 text-sm text-text transition hover:bg-surface2"
        >
          <span>{compareButtonLabel}</span>
          <GitBranch className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleImageUpload}
          disabled={chatMode === "rag"}
          title={t("playground:actions.upload", "Attach image") as string}
          className="flex w-full items-center justify-between rounded-md px-2 py-1 text-sm text-text transition hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-40 disabled:text-text-muted"
        >
          <span>{t("playground:actions.upload", "Attach image")}</span>
          <ImageIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleDocumentUpload}
          title={t("tooltip.uploadDocuments") as string}
          className="flex w-full items-center justify-between rounded-md px-2 py-1 text-sm text-text transition hover:bg-surface2"
        >
          <span>{t("tooltip.uploadDocuments")}</span>
          <PaperclipIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleClearContext}
          disabled={history.length === 0}
          title={t("tooltip.clearContext") as string}
          className="flex w-full items-center justify-between rounded-md px-2 py-1 text-sm text-text transition hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-40 disabled:text-text-muted"
        >
          <span>{t("tooltip.clearContext")}</span>
          <EraserIcon className="h-4 w-4" />
        </button>
      </div>
    ),
    [
      chatMode,
      compareButtonLabel,
      contextToolsOpen,
      handleClearContext,
      handleDocumentUpload,
      handleImageUpload,
      handleToggleContextTools,
      history.length,
      setCompareSettingsOpen,
      setWebSearch,
      setToolChoice,
      t,
      toolChoice,
      webSearch,
      hasMcp,
      mcpHealthState,
      mcpTools,
      mcpToolsLoading
    ]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (import.meta.env.BROWSER !== "firefox") {
      if (e.key === "Process" || e.key === "229") return
    }

    if (showSlashMenu) {
      if (e.key === "ArrowDown" && filteredSlashCommands.length > 0) {
        e.preventDefault()
        setSlashActiveIndex((prev) =>
          prev + 1 >= filteredSlashCommands.length ? 0 : prev + 1
        )
        return
      }
      if (e.key === "ArrowUp" && filteredSlashCommands.length > 0) {
        e.preventDefault()
        setSlashActiveIndex((prev) =>
          prev <= 0 ? filteredSlashCommands.length - 1 : prev - 1
        )
        return
      }
      if (
        (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) &&
        filteredSlashCommands.length > 0
      ) {
        e.preventDefault()
        const command = filteredSlashCommands[slashActiveIndex]
        if (command) {
          handleSlashCommandSelect(command)
        }
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        form.setFieldValue(
          "message",
          form.values.message.replace(/^\s*\//, "")
        )
        return
      }
    }

    if (
      showMentions &&
      (e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Enter" ||
        e.key === "Escape")
    ) {
      return
    }

    if (!isConnectionReady) {
      if (e.key === "Enter") {
        e.preventDefault()
      }
      return
    }

    if (
      handleChatInputKeyDown({
        e,
        sendWhenEnter,
        typing,
        isSending
      })
    ) {
      e.preventDefault()
      stopListening()
      submitForm()
    }
  }

  const stopListening = async () => {
    if (isListening) {
      stopSpeechRecognition()
    }
  }

  const persistenceModeLabel = React.useMemo(
    () =>
      getPersistenceModeLabel(
        t,
        temporaryChat,
        isConnectionReady,
        serverChatId
      ),
    [isConnectionReady, serverChatId, temporaryChat, t]
  )

  const persistencePillLabel = React.useMemo(() => {
    if (temporaryChat) {
      return t(
        "playground:composer.persistence.ephemeralPill",
        "Not saved"
      )
    }
    if (serverChatId || isConnectionReady) {
      return t(
        "playground:composer.persistence.serverPill",
        "Server"
      )
    }
    return t(
      "playground:composer.persistence.localPill",
      "Local"
    )
  }, [isConnectionReady, serverChatId, temporaryChat, t])

  const persistenceTooltip = React.useMemo(
    () => (
      <div className="flex flex-col gap-0.5 text-xs">
        <span className="font-medium">{persistencePillLabel}</span>
        <span className="text-text-subtle">{persistenceModeLabel}</span>
      </div>
    ),
    [persistenceModeLabel, persistencePillLabel]
  )

  const focusConnectionCard = React.useCallback(() => {
    try {
      const card = document.getElementById("server-connection-card")
      if (card) {
        card.scrollIntoView({ block: "nearest", behavior: "smooth" })
        ;(card as HTMLElement).focus()
        return
      }
    } catch {
      // ignore DOM errors and fall through to hash navigation
    }
    try {
      const base =
        window.location.href.replace(/#.*$/, "") || "/options.html"
      const target = `${base}#/settings/tldw`
      window.location.href = target
    } catch {
      // ignore navigation failures
    }
  }, [])

  const hasContext =
    form.values.image.length > 0 ||
    selectedDocuments.length > 0 ||
    uploadedFiles.length > 0

  const toolsButton = (
    <Popover
      trigger="click"
      placement="topRight"
      content={moreToolsContent}
      overlayClassName="playground-more-tools">
      <TldwButton
        variant="outline"
        size="sm"
        shape={isProMode ? "rounded" : "pill"}
        iconOnly={!isProMode}
        ariaLabel={t("playground:composer.moreTools", "More tools") as string}
        title={t("playground:composer.moreTools", "More tools") as string}>
        {isProMode ? (
          <span>{t("playground:composer.toolsButton", "+Tools")}</span>
        ) : (
          <>
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">
              {t("playground:composer.moreTools", "More tools")}
            </span>
          </>
        )}
      </TldwButton>
    </Popover>
  )

  const sendControl = !isSending ? (
    <Dropdown.Button
      size={isProMode ? "middle" : "small"}
      htmlType="submit"
      disabled={isSending || !isConnectionReady}
      title={
        !isConnectionReady
          ? (t(
              "playground:composer.connectToSend",
              "Connect to your tldw server to start chatting."
            ) as string)
          : (t("playground:composer.submitAria", "Send message") as string)
      }
      aria-label={
        t("playground:composer.submitAria", "Send message") as string
      }
      className={`!justify-end !w-auto ${
        isProMode ? "" : "!h-9 !rounded-full !px-3 !text-xs"
      }`}
      icon={
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className={isProMode ? "w-5 h-5" : "w-4 h-4"}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m19.5 8.25-7.5 7.5-7.5-7.5"
          />
        </svg>
      }
      menu={{
        items: [
          {
            key: 1,
            label: (
              <Checkbox
                checked={sendWhenEnter}
                onChange={(e) =>
                  setSendWhenEnter(e.target.checked)
                }>
                {t("sendWhenEnter")}
              </Checkbox>
            )
          },
          {
            key: 2,
            label: (
              <Checkbox
                checked={useOCR}
                onChange={(e) =>
                  setUseOCR(e.target.checked)
                }>
                {t("useOCR")}
              </Checkbox>
            )
          }
        ]
      }}>
      <div
        className={`inline-flex items-center ${
          isProMode ? "gap-2" : "gap-1"
        }`}
      >
        {sendWhenEnter ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-5 w-5"
            viewBox="0 0 24 24">
            <path d="M9 10L4 15 9 20"></path>
            <path d="M20 4v7a4 4 0 01-4 4H4"></path>
          </svg>
        ) : null}
        <span
          className={
            isProMode
              ? ""
              : "text-[11px] font-semibold uppercase tracking-[0.12em]"
          }>
          {sendLabel}
        </span>
      </div>
    </Dropdown.Button>
  ) : (
    <Tooltip
      title={
        t("tooltip.stopStreaming") as string
      }>
      <TldwButton
        variant="outline"
        size={isMobileViewport ? "lg" : "md"}
        iconOnly
        onClick={stopStreamingRequest}
        ariaLabel={t("tooltip.stopStreaming") as string}>
        <StopCircleIcon className="size-5 sm:size-4" />
      </TldwButton>
    </Tooltip>
  )

  return (
    <div className="flex w-full flex-col items-center px-4 pb-6">
      <div
        data-checkwidemode={checkWideMode}
        data-ui-mode={uiMode}
        className="relative z-10 flex w-full max-w-[52rem] flex-col items-center justify-center gap-2 text-base data-[checkwidemode='true']:max-w-none">
        <div className="relative flex w-full flex-row justify-center">
          <div
            data-istemporary-chat={temporaryChat}
            className={`relative w-full rounded-3xl border border-border/80 bg-surface/95 p-3 text-text shadow-card backdrop-blur-lg transition-all duration-200 data-[istemporary-chat='true']:border-t-4 data-[istemporary-chat='true']:border-t-purple-500 data-[istemporary-chat='true']:border-dashed data-[istemporary-chat='true']:opacity-90 ${
              !isConnectionReady ? "opacity-80" : ""
            }`}>
            {/* Attachments summary (collapsed context management) */}
            <AttachmentsSummary
              image={form.values.image}
              documents={selectedDocuments}
              files={uploadedFiles}
              fileRetrievalEnabled={fileRetrievalEnabled}
              onFileRetrievalChange={setFileRetrievalEnabled}
              onRemoveImage={() => form.setFieldValue("image", "")}
              onRemoveDocument={removeDocument}
              onClearDocuments={clearSelectedDocuments}
              onRemoveFile={removeUploadedFile}
              onClearFiles={clearUploadedFiles}
            />
            {/* Compare Toggle - surfaced in main toolbar for better discoverability */}
            {compareFeatureEnabled && (
              <div className="px-3 pb-2">
                <div className="flex flex-wrap items-center gap-3">
                  <CompareToggle
                    featureEnabled={compareFeatureEnabled}
                    active={compareModeActive}
                    onToggle={() => setCompareMode(!compareMode)}
                    selectedModels={compareSelectedModels}
                    availableModels={(composerModels as any[]) || []}
                    maxModels={compareMaxModels || 4}
                    onAddModel={(modelId) => {
                      if (!compareSelectedModels.includes(modelId)) {
                        setCompareSelectedModels([...compareSelectedModels, modelId])
                      }
                    }}
                    onRemoveModel={removeCompareModel}
                    onOpenSettings={() => setCompareSettingsOpen(true)}
                  />
                  {compareModeActive && compareSelectedModels.length > 1 && (
                    <span className="text-[10px] text-text-muted">
                      {t(
                        "playground:composer.compareActiveModelsHint",
                        "Your next message will be sent to each active model."
                      )}
                    </span>
                  )}
                </div>
              </div>
            )}
            <Modal
              title={t(
                "playground:composer.compareSettingsTitle",
                "Compare settings"
              )}
              open={compareSettingsOpen}
              onCancel={() => setCompareSettingsOpen(false)}
              footer={null}
            >
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-text">
                      {t(
                        "playground:composer.compareFeatureToggle",
                        "Enable Compare mode"
                      )}
                      <BetaTag className="!m-0" />
                    </div>
                    <div className="text-xs text-text-muted">
                      {t(
                        "playground:composer.compareFeatureToggleHint",
                        "Unlock experimental multi-model compare features."
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={compareFeatureEnabled}
                    onChange={setCompareFeatureEnabled}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-text">
                      {t(
                        "playground:composer.compareSettingsToggle",
                        "Enable Compare mode"
                      )}
                    </div>
                    <div className="text-xs text-text-muted">
                      {t(
                        "playground:composer.compareSettingsToggleHint",
                        "Send your next message to multiple models."
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={compareMode}
                    onChange={setCompareMode}
                    disabled={!compareFeatureEnabled}
                  />
                </div>

                <div
                  className={
                    compareModeActive
                      ? "space-y-2"
                      : "space-y-2 opacity-50 pointer-events-none"
                  }
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
                    {t(
                      "playground:composer.compareModelPickerLabel",
                      "Select models"
                    )}
                  </div>
                  <Select
                    mode="multiple"
                    value={compareSelectedModels}
                    onChange={handleCompareModelChange}
                    options={compareModelOptions}
                    placeholder={t(
                      "playground:composer.compareModelPickerPlaceholder",
                      "Choose models to compare"
                    )}
                    maxTagCount="responsive"
                    style={{ width: "100%" }}
                  />
                  {compareSummaryLabel && (
                    <div className="text-xs text-text-muted">
                      {compareSummaryLabel}
                    </div>
                  )}
                  {compareActiveSummary && (
                    <div className="text-xs text-text-muted">
                      {compareActiveSummary}
                    </div>
                  )}
                </div>

                <div
                  className={
                    compareModeActive
                      ? "flex items-center gap-2 text-xs text-text-muted"
                      : "flex items-center gap-2 text-xs text-text-muted opacity-50 pointer-events-none"
                  }
                >
                  <span>
                    {t(
                      "playground:composer.compareMaxLabel",
                      "Max models per turn"
                    )}
                    :
                  </span>
                  <Select
                    size="small"
                    value={compareMaxModels}
                    style={{ width: 70 }}
                    onChange={(value: number) => {
                      const next = Math.min(Math.max(value, 2), 4)
                      setCompareMaxModels(next)
                      if (
                        compareSelectedModels &&
                        compareSelectedModels.length > next
                      ) {
                        setCompareSelectedModels(
                          compareSelectedModels.slice(0, next)
                        )
                      }
                    }}
                    options={[2, 3, 4].map((v) => ({
                      value: v,
                      label: v.toString()
                    }))}
                  />
                  <span
                    className={`ml-1 ${
                      compareSelectedModels.length >=
                      (compareMaxModels || MAX_COMPARE_MODELS)
                        ? "text-warn"
                        : ""
                    }`}
                  >
                    {t(
                      "playground:composer.compareMaxHelper",
                      "Selected {{current}} / {{limit}}",
                      {
                        current: compareSelectedModels.length,
                        limit: compareMaxModels || MAX_COMPARE_MODELS
                      }
                    )}
                  </span>
                </div>
              </div>
            </Modal>
            <div>
              <div className={`flex  bg-transparent `}>
                <form
                  onSubmit={form.onSubmit(async (value) => {
                    stopListening()
                    if (!compareModeActive) {
                      if (!selectedModel || selectedModel.length === 0) {
                        form.setFieldError("message", t("formError.noModel"))
                        return
                      }
                    } else if (
                      !compareSelectedModels ||
                      compareSelectedModels.length === 0
                    ) {
                      form.setFieldError(
                        "message",
                        t(
                          "playground:composer.validationCompareSelectModelsInline",
                          "Select at least one model for Compare mode."
                        )
                      )
                      return
                    }
                    const defaultEM = await defaultEmbeddingModelForRag()

                    if (webSearch) {
                      const simpleSearch = await getIsSimpleInternetSearch()
                      if (!defaultEM && !simpleSearch) {
                        form.setFieldError(
                          "message",
                          t("formError.noEmbeddingModel")
                        )
                        return
                      }
                    }
                    if (
                      value.message.trim().length === 0 &&
                      value.image.length === 0 &&
                      selectedDocuments.length === 0 &&
                      uploadedFiles.length === 0
                    ) {
                      return
                    }
                    form.reset()
                    clearSelectedDocuments()
                    clearUploadedFiles()
                    textAreaFocus()
                    await sendMessage({
                      image: value.image,
                      message: value.message.trim(),
                      docs: selectedDocuments.map((doc) => ({
                        type: "tab",
                        tabId: doc.id,
                        title: doc.title,
                        url: doc.url
                      }))
                    })
                  })}
                  className="shrink-0 flex-grow  flex flex-col items-center ">
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    ref={inputRef}
                    accept="image/*"
                    multiple={false}
                    onChange={onInputChange}
                  />
                  <input
                    id="document-upload"
                    name="document-upload"
                    type="file"
                    className="sr-only"
                    ref={fileInputRef}
                    accept=".pdf,.doc,.docx,.txt,.csv"
                    multiple={false}
                    onChange={onFileInputChange}
                  />

                  <div
                    className={`w-full flex flex-col px-2 ${
                      !isConnectionReady
                        ? "rounded-md border border-dashed border-border bg-surface2"
                        : ""
                    }`}>
                    <div
                      className={contextToolsOpen ? "mb-2" : "hidden"}
                      aria-hidden={!contextToolsOpen}
                    >
                      <div className="rounded-md border border-border bg-surface p-3">
                        <div className="flex flex-col gap-4">
                          <div>
                            <div className="mb-2 text-xs font-semibold text-text">
                              {t(
                                "playground:composer.knowledgeSearch",
                                "Knowledge search"
                              )}
                            </div>
                            <RagSearchBar
                              onInsert={(text) => {
                                const current = form.values.message || ""
                                const next = current ? `${current}\n\n${text}` : text
                                form.setFieldValue("message", next)
                                textAreaFocus()
                              }}
                              onAsk={(text) => {
                                const trimmed = text.trim()
                                if (!trimmed) return
                                form.setFieldValue("message", text)
                                setTimeout(() => submitForm(), 0)
                              }}
                              isConnected={isConnectionReady}
                              open={contextToolsOpen}
                              onOpenChange={(nextOpen) => setContextToolsOpen(nextOpen)}
                              autoFocus
                              showToggle={false}
                              variant="embedded"
                            />
                          </div>
                          <div className="border-t border-border pt-4">
                            <div className="mb-3 text-xs font-semibold text-text">
                              {t(
                                "playground:composer.contextManagerTitle",
                                "Context Management"
                              )}
                            </div>
                            <div className="flex flex-col gap-5">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-text">
                                    {t(
                                      "playground:composer.contextTabsTitle",
                                      "Tabs in context"
                                    )}
                                  </div>
                                  <p className="text-xs text-text-muted">
                                    {t(
                                      "playground:composer.contextTabsHint",
                                      "Review or remove referenced tabs, or add more from your open browser tabs."
                                    )}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => reloadTabs()}
                                    title={t("common:refresh", "Refresh") as string}
                                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text hover:bg-surface2">
                                    {t("common:refresh", "Refresh")}
                                  </button>
                                  {selectedDocuments.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={clearSelectedDocuments}
                                      title={
                                        t(
                                          "playground:composer.clearTabs",
                                          "Remove all tabs"
                                        ) as string
                                      }
                                      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text hover:bg-surface2">
                                      {t(
                                        "playground:composer.clearTabs",
                                        "Remove all tabs"
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="rounded-lg border border-border bg-surface p-3">
                                {selectedDocuments.length > 0 ? (
                                  <div className="flex flex-col gap-2">
                                    {selectedDocuments.map((doc) => (
                                      <div
                                        key={doc.id}
                                        className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface2 px-3 py-2">
                                        <div className="min-w-0">
                                          <div className="truncate text-sm font-medium text-text">
                                            {doc.title}
                                          </div>
                                          <div className="truncate text-xs text-text-muted">
                                            {doc.url}
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => removeDocument(doc.id)}
                                          aria-label={t("common:remove", "Remove") as string}
                                          title={t("common:remove", "Remove") as string}
                                          className="rounded-full border border-border p-1 text-text-muted hover:bg-surface2 hover:text-text">
                                          <X className="h-4 w-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-sm text-text-muted">
                                    {t(
                                      "playground:composer.contextTabsEmpty",
                                      "No tabs added yet."
                                    )}
                                  </div>
                                )}
                                <div className="mt-3">
                                  <div className="text-xs font-semibold text-text">
                                    {t(
                                      "playground:composer.contextTabsAvailable",
                                      "Open tabs"
                                    )}
                                  </div>
                                  <div className="mt-2 max-h-40 overflow-y-auto space-y-2">
                                    {availableTabs.length > 0 ? (
                                      availableTabs.map((tab) => (
                                        <div
                                          key={tab.id}
                                          className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 shadow-sm">
                                          <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-text">
                                              {tab.title}
                                            </div>
                                            <div className="truncate text-xs text-text-muted">
                                              {tab.url}
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => addDocument(tab)}
                                            title={t("common:add", "Add") as string}
                                            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-text hover:bg-surface2">
                                            {t("common:add", "Add")}
                                          </button>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-xs text-text-muted">
                                        {t(
                                          "playground:composer.noTabsFound",
                                          "No eligible open tabs found."
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-text">
                                    {t(
                                      "playground:composer.contextFilesTitle",
                                      "Files in context"
                                    )}
                                  </div>
                                  <p className="text-xs text-text-muted">
                                    {t(
                                      "playground:composer.contextFilesHint",
                                      "Review attached files, remove them, or add more."
                                    )}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      fileInputRef.current?.click()
                                    }}
                                    title={
                                      t(
                                        "playground:composer.addFile",
                                        "Add file"
                                      ) as string
                                    }
                                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text hover:bg-surface2">
                                    {t("playground:composer.addFile", "Add file")}
                                  </button>
                                  {uploadedFiles.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={clearUploadedFiles}
                                      title={
                                        t(
                                          "playground:composer.clearFiles",
                                          "Remove all files"
                                        ) as string
                                      }
                                      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text hover:bg-surface2">
                                      {t(
                                        "playground:composer.clearFiles",
                                        "Remove all files"
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="rounded-lg border border-border bg-surface p-3">
                                {uploadedFiles.length > 0 ? (
                                  <div className="flex flex-col gap-2">
                                    {uploadedFiles.map((file) => (
                                      <div
                                        key={file.id}
                                        className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface2 px-3 py-2">
                                        <div className="min-w-0">
                                          <div className="truncate text-sm font-medium text-text">
                                            {file.filename}
                                          </div>
                                          <div className="text-xs text-text-muted">
                                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => removeUploadedFile(file.id)}
                                          aria-label={t("common:remove", "Remove") as string}
                                          title={t("common:remove", "Remove") as string}
                                          className="rounded-full border border-border p-1 text-text-muted hover:bg-surface2 hover:text-text">
                                          <X className="h-4 w-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-sm text-text-muted">
                                    {t(
                                      "playground:composer.contextFilesEmpty",
                                      "No files attached yet."
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="relative">
                      {isProMode && replyTarget && (
                        <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-border bg-surface2 px-3 py-2 text-xs text-text">
                          <div className="flex min-w-0 items-center gap-2">
                            <CornerUpLeft className="h-3.5 w-3.5 text-text-subtle" />
                            <span className="min-w-0 truncate">
                              {replyLabel}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={clearReplyTarget}
                            aria-label={t(
                              "common:clearReply",
                              "Clear reply target"
                            )}
                            title={t(
                              "common:clearReply",
                              "Clear reply target"
                            ) as string}
                            className="rounded p-1 text-text-subtle hover:bg-surface hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                      <div className="relative rounded-2xl border border-border/70 bg-surface/80 px-1 py-1.5 transition focus-within:border-focus/60 focus-within:ring-2 focus-within:ring-focus/30">
                        <SlashCommandMenu
                          open={showSlashMenu}
                          commands={filteredSlashCommands}
                          activeIndex={slashActiveIndex}
                          onActiveIndexChange={setSlashActiveIndex}
                          onSelect={handleSlashCommandSelect}
                          emptyLabel={t(
                            "common:commandPalette.noResults",
                            "No results found"
                          )}
                          className="absolute bottom-full left-3 right-3 mb-2"
                        />
                        <textarea
                          id="textarea-message"
                          onCompositionStart={() => {
                            if (import.meta.env.BROWSER !== "firefox") {
                              setTyping(true)
                            }
                          }}
                          onCompositionEnd={() => {
                            if (import.meta.env.BROWSER !== "firefox") {
                              setTyping(false)
                            }
                          }}
                          onKeyDown={(e) => {
                            handleKeyDown(e)
                          }}
                          onFocus={handleDisconnectedFocus}
                          ref={textareaRef}
                          className={`w-full resize-none bg-transparent text-base leading-6 text-text placeholder:text-text-muted/80 focus-within:outline-none focus:ring-0 focus-visible:ring-0 ring-0 border-0 ${
                            !isConnectionReady
                              ? "cursor-not-allowed text-text-muted placeholder:text-text-subtle"
                              : ""
                          } ${isProMode ? "px-3 py-2.5" : "px-3 py-2"}`}
                          onPaste={handlePaste}
                          rows={1}
                          style={{ minHeight: isProMode ? "60px" : "44px" }}
                          tabIndex={0}
                          placeholder={
                            isConnectionReady
                              ? t("form.textarea.placeholder")
                              : t(
                                  "playground:composer.connectionPlaceholder",
                                  "Connect to tldw to start chatting."
                                )
                          }
                          {...form.getInputProps("message")}
                          onChange={(e) => {
                            form.getInputProps("message").onChange(e)
                            if (tabMentionsEnabled && textareaRef.current) {
                              handleTextChange(
                                e.target.value,
                                textareaRef.current.selectionStart || 0
                              )
                            }
                          }}
                          onSelect={() => {
                            if (tabMentionsEnabled && textareaRef.current) {
                              handleTextChange(
                                textareaRef.current.value,
                                textareaRef.current.selectionStart || 0
                              )
                            }
                          }}
                        />

                        <MentionsDropdown
                          show={showMentions}
                          tabs={filteredTabs}
                          mentionPosition={mentionPosition}
                          onSelectTab={(tab) =>
                            insertMention(tab, form.values.message, (value) =>
                              form.setFieldValue("message", value)
                            )
                          }
                          onClose={closeMentions}
                          textareaRef={textareaRef}
                          refetchTabs={async () => {
                            await reloadTabs()
                          }}
                          onMentionsOpen={handleMentionsOpen}
                        />
                        {/* Draft saved indicator */}
                        {draftSaved && (
                          <span
                            className="absolute bottom-1 right-2 text-label text-text-subtle animate-pulse pointer-events-none"
                            role="status"
                            aria-live="polite"
                          >
                            {t("sidepanel:composer.draftSaved", "Draft saved")}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Inline error message with shake animation */}
                    {form.errors.message && (
                      <div
                        role="alert"
                        aria-live="assertive"
                        aria-atomic="true"
                        className="flex items-center justify-between gap-2 px-2 py-1 text-xs text-red-600 dark:text-red-400 animate-shake"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span>{form.errors.message}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => form.clearFieldError("message")}
                          className="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          aria-label={t("common:dismiss", "Dismiss") as string}
                          title={t("common:dismiss", "Dismiss") as string}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {/* Proactive validation hints - show why send might be disabled */}
                    {!form.errors.message && isConnectionReady && !isSending && isProMode && (
                      <div className="px-2 py-1 text-label text-text-subtle">
                        {!selectedModel ? (
                          <span className="flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {t("sidepanel:composer.hints.selectModel", "Select a model above to start chatting")}
                          </span>
                        ) : form.values.message.trim().length === 0 && form.values.image.length === 0 ? (
                          <span>
                            {sendWhenEnter
                              ? t("sidepanel:composer.hints.typeAndEnter", "Type a message and press Enter to send")
                              : t("sidepanel:composer.hints.typeAndClick", "Type a message and click Send")}
                          </span>
                        ) : null}
                      </div>
                    )}
                    {isProMode ? (
                      <div className="mt-2 flex flex-col gap-1">
                        <div className="mt-1 flex flex-col gap-2">
                          <div className="flex flex-wrap items-start gap-3">
                            <div className="flex flex-col gap-0.5 text-xs text-text">
                              <Tooltip title={persistenceTooltip}>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <Switch
                                    size="small"
                                    checked={!temporaryChat}
                                    onChange={(checked) =>
                                      handleToggleTemporaryChat(!checked)
                                    }
                                    aria-label={
                                      temporaryChat
                                        ? (t(
                                            "playground:actions.temporaryOn",
                                            "Don't save chat"
                                          ) as string)
                                        : (t(
                                            "playground:actions.temporaryOff",
                                            "Save chat to history"
                                          ) as string)
                                    }
                                  />
                                  <span>
                                    {temporaryChat
                                      ? t(
                                          "playground:actions.temporaryOn",
                                          "Don't save chat"
                                        )
                                      : t(
                                          "playground:actions.temporaryOff",
                                          "Save chat to history"
                                        )}
                                  </span>
                                </div>
                              </Tooltip>
                              {!temporaryChat && !isConnectionReady && (
                                <button
                                  type="button"
                                  onClick={focusConnectionCard}
                                  title={
                                    t(
                                      "playground:composer.persistence.connectToSave",
                                      "Connect your server to sync chats."
                                    ) as string
                                  }
                                  className="mt-1 inline-flex w-fit items-center gap-1 text-[11px] font-medium text-primary hover:text-primaryStrong">
                                  {t(
                                    "playground:composer.persistence.connectToSave",
                                    "Connect your server to sync chats."
                                  )}
                                </button>
                              )}
                              {!temporaryChat && serverChatId && showServerPersistenceHint && (
                                <p className="mt-1 max-w-md text-[11px] text-text-muted">
                                  <span className="font-semibold">
                                    {t(
                                      "playground:composer.persistence.serverInlineTitle",
                                      "Saved locally + on your server"
                                    )}
                                    {": "}
                                  </span>
                                  {t(
                                    "playground:composer.persistence.serverInlineBody",
                                    "This chat is stored both in this browser and on your tldw server, so you can reopen it from server history, keep a long-term record, and analyze it alongside other conversations."
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setShowServerPersistenceHint(false)}
                                    title={t("common:dismiss", "Dismiss") as string}
                                    className="ml-1 text-[11px] font-medium text-primary hover:text-primaryStrong"
                                  >
                                    {t("common:dismiss", "Dismiss")}
                                  </button>
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                              <button
                                type="button"
                                onClick={handleToggleContextTools}
                                title={
                                  contextToolsOpen
                                    ? (t(
                                        "playground:composer.contextKnowledgeClose",
                                        "Close Ctx + Media"
                                      ) as string)
                                    : (t(
                                        "playground:composer.contextKnowledge",
                                        "Ctx + Media"
                                      ) as string)
                                }
                                aria-pressed={contextToolsOpen}
                                aria-expanded={contextToolsOpen}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                                  contextToolsOpen
                                    ? "border-accent bg-surface2 text-accent hover:bg-surface"
                                    : "border-border text-text-muted hover:bg-surface2 hover:text-text"
                                }`}
                              >
                                <Search className="h-3 w-3" />
                                <span>
                                  {contextToolsOpen
                                    ? t(
                                        "playground:composer.contextKnowledgeClose",
                                        "Close Ctx + Media"
                                      )
                                    : t(
                                        "playground:composer.contextKnowledge",
                                        "Ctx + Media"
                                      )}
                                </span>
                              </button>
                              {selectedDocuments.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const chips =
                                      document.querySelector<HTMLElement>(
                                        "[data-playground-tabs='true']"
                                      )
                                    if (chips) {
                                      chips.focus()
                                      chips.scrollIntoView({ block: "nearest" })
                                    }
                                  }}
                                  title={
                                    t(
                                      "playground:composer.contextTabsHint",
                                      "Review or remove referenced tabs, or add more from your open browser tabs."
                                    ) as string
                                  }
                                  className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 hover:border-border hover:bg-surface2">
                                  <FileText className="h-3 w-3 text-text-subtle" />
                                  <span>
                                    {t("playground:composer.contextTabs", {
                                      defaultValue: "{{count}} tabs",
                                      count: selectedDocuments.length
                                    } as any) as string}
                                  </span>
                                </button>
                              )}
                              {uploadedFiles.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const files =
                                      document.querySelector<HTMLElement>(
                                        "[data-playground-uploads='true']"
                                      )
                                    if (files) {
                                      files.focus()
                                      files.scrollIntoView({ block: "nearest" })
                                    }
                                  }}
                                  title={
                                    t(
                                      "playground:composer.contextFilesHint",
                                      "Review attached files, remove them, or add more."
                                    ) as string
                                  }
                                  className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 hover:border-border hover:bg-surface2">
                                  <FileIcon className="h-3 w-3 text-text-subtle" />
                                  <span>
                                    {t("playground:composer.contextFiles", {
                                      defaultValue: "{{count}} files",
                                      count: uploadedFiles.length
                                    } as any) as string}
                                  </span>
                                </button>
                              )}
                            </div>
                            <div className="flex items-center justify-end gap-3 flex-wrap">
                              <CharacterSelect
                                className="min-w-0 min-h-0 rounded-full border border-border px-2 py-1 text-text-muted hover:bg-surface2 hover:text-text"
                                iconClassName="h-4 w-4"
                              />
                              {(browserSupportsSpeechRecognition || hasServerAudio) && (
                                <>
                                  <Tooltip
                                    title={
                                      !speechAvailable
                                        ? t(
                                            "playground:actions.speechUnavailableBody",
                                            "Connect to a tldw server that exposes the audio transcriptions API to use dictation."
                                          )
                                        : speechUsesServer
                                          ? t(
                                              "playground:tooltip.speechToTextServer",
                                              "Dictation via your tldw server"
                                            ) +
                                            " " +
                                            t(
                                              "playground:tooltip.speechToTextDetails",
                                              "Uses {{model}} · {{task}} · {{format}}. Configure in Settings → General → Speech-to-Text.",
                                              {
                                                model: sttModel || "whisper-1",
                                                task:
                                                  sttTask === "translate"
                                                    ? "translate"
                                                    : "transcribe",
                                                format: (sttResponseFormat || "json").toUpperCase()
                                              } as any
                                            )
                                          : t(
                                              "playground:tooltip.speechToTextBrowser",
                                              "Dictation via browser speech recognition"
                                            )
                                    }>
                                  <button
                                    type="button"
                                    onClick={speechUsesServer ? handleServerDictationToggle : handleSpeechToggle}
                                    disabled={!speechAvailable}
                                    className={`inline-flex items-center justify-center rounded-full border text-xs transition hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-50 ${
                                      speechAvailable &&
                                      ((speechUsesServer && isServerDictating) ||
                                        (!speechUsesServer && isListening))
                                        ? "border-primary text-primaryStrong"
                                        : "border-border text-text-muted"
                                    } ${
                                      isProMode ? "px-2 py-1" : "h-9 w-9 p-0"
                                    }`}
                                    aria-label={
                                      !speechAvailable
                                        ? (t(
                                              "playground:actions.speechUnavailableTitle",
                                              "Dictation unavailable"
                                            ) as string)
                                          : speechUsesServer
                                            ? (isServerDictating
                                                ? (t("playground:actions.speechStop", "Stop dictation") as string)
                                                : (t("playground:actions.speechStart", "Start dictation") as string))
                                            : (isListening
                                                ? (t("playground:actions.speechStop", "Stop dictation") as string)
                                                : (t("playground:actions.speechStart", "Start dictation") as string))
                                      }>
                                      <MicIcon className="h-4 w-4" />
                                    </button>
                                  </Tooltip>
                                </>
                              )}
                              {modelUsageBadge}
                              <Tooltip
                                title={
                                  t(
                                    "common:currentChatModelSettings"
                                  ) as string
                                }>
                                <button
                                  type="button"
                                  onClick={() => setOpenModelSettings(true)}
                                  aria-label={
                                    t(
                                      "common:currentChatModelSettings"
                                    ) as string
                                  }
                                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-text transition hover:bg-surface2">
                                  <Gauge
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  <span className="flex flex-col items-start text-left">
                                    <span className="font-medium">
                                      {t("playground:composer.chatSettings", "Chat Settings")}
                                    </span>
                                    <span className="text-[11px] text-text-muted">
                                      {modelSummaryLabel} • {promptSummaryLabel}
                                    </span>
                                  </span>
                                </button>
                              </Tooltip>
                              {toolsButton}
                              {sendControl}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-nowrap">
                          <Tooltip title={persistenceTooltip}>
                            <div className="flex items-center gap-1">
                              <Switch
                                size="small"
                                checked={!temporaryChat}
                                onChange={(checked) =>
                                  handleToggleTemporaryChat(!checked)
                                }
                                aria-label={
                                  temporaryChat
                                    ? (t(
                                        "playground:actions.temporaryOn",
                                        "Don't save chat"
                                      ) as string)
                                    : (t(
                                        "playground:actions.temporaryOff",
                                        "Save chat to history"
                                      ) as string)
                                }
                              />
                              <span className="text-xs text-text whitespace-nowrap">
                                {temporaryChat
                                  ? t(
                                      "playground:actions.temporaryOn",
                                      "Don't save chat"
                                    )
                                  : t(
                                      "playground:actions.temporaryOff",
                                      "Save chat to history"
                                    )}
                              </span>
                            </div>
                          </Tooltip>
                          <button
                            type="button"
                            onClick={handleToggleContextTools}
                            title={
                              contextToolsOpen
                                ? (t(
                                    "playground:composer.contextKnowledgeClose",
                                    "Close Ctx + Media"
                                  ) as string)
                                : (t(
                                    "playground:composer.contextKnowledge",
                                    "Ctx + Media"
                                  ) as string)
                            }
                            aria-pressed={contextToolsOpen}
                            aria-expanded={contextToolsOpen}
                            className={`inline-flex min-w-0 max-w-[140px] items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition ${
                              contextToolsOpen
                                ? "border-accent bg-surface2 text-accent hover:bg-surface"
                                : "border-border text-text-muted hover:bg-surface2 hover:text-text"
                            }`}
                          >
                            <Search className="h-3 w-3" />
                            <span className="truncate">
                              {contextToolsOpen
                                ? t(
                                    "playground:composer.contextKnowledgeClose",
                                    "Close Ctx + Media"
                                  )
                                : t(
                                    "playground:composer.contextKnowledge",
                                    "Ctx + Media"
                                  )}
                            </span>
                          </button>
                        </div>
                        <div className="flex items-center gap-2 flex-nowrap">
                          <CharacterSelect
                            showLabel={false}
                            className="min-w-0 min-h-0 h-9 w-9 rounded-full border border-border text-text-muted hover:bg-surface2 hover:text-text"
                            iconClassName="h-4 w-4"
                          />
                          {(browserSupportsSpeechRecognition || hasServerAudio) && (
                            <Tooltip
                              title={
                                !speechAvailable
                                  ? t(
                                      "playground:actions.speechUnavailableBody",
                                      "Connect to a tldw server that exposes the audio transcriptions API to use dictation."
                                    )
                                  : speechUsesServer
                                    ? t(
                                        "playground:tooltip.speechToTextServer",
                                        "Dictation via your tldw server"
                                      )
                                    : t(
                                        "playground:tooltip.speechToTextBrowser",
                                        "Dictation via browser speech recognition"
                                      )
                              }>
                              <button
                                type="button"
                                onClick={speechUsesServer ? handleServerDictationToggle : handleSpeechToggle}
                                disabled={!speechAvailable}
                                className={`inline-flex items-center justify-center rounded-full border px-2 py-1 text-xs transition hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-50 ${
                                  speechAvailable &&
                                  ((speechUsesServer && isServerDictating) ||
                                    (!speechUsesServer && isListening))
                                    ? "border-primary text-primaryStrong"
                                    : "border-border text-text-muted"
                                }`}
                                aria-label={
                                  !speechAvailable
                                    ? (t(
                                        "playground:actions.speechUnavailableTitle",
                                        "Dictation unavailable"
                                      ) as string)
                                    : speechUsesServer
                                      ? (isServerDictating
                                          ? (t("playground:actions.speechStop", "Stop dictation") as string)
                                          : (t("playground:actions.speechStart", "Start dictation") as string))
                                      : (isListening
                                          ? (t("playground:actions.speechStop", "Stop dictation") as string)
                                          : (t("playground:actions.speechStart", "Start dictation") as string))
                                }>
                                <MicIcon className="h-4 w-4" />
                              </button>
                            </Tooltip>
                          )}
                          {modelUsageBadge}
                          <Tooltip
                            title={
                              t(
                                "common:currentChatModelSettings"
                              ) as string
                            }>
                            <TldwButton
                              variant="outline"
                              shape="pill"
                              iconOnly
                              onClick={() => setOpenModelSettings(true)}
                              ariaLabel={
                                t(
                                  "common:currentChatModelSettings"
                                ) as string
                              }
                              className="text-text-muted">
                              <Gauge className="h-4 w-4" aria-hidden="true" />
                              <span className="sr-only">
                                {t(
                                  "playground:composer.chatSettings",
                                  "Chat Settings"
                                )}
                              </span>
                            </TldwButton>
                          </Tooltip>
                          {toolsButton}
                          {sendControl}
                        </div>
                      </div>
                    )}
                    {showConnectBanner && !isConnectionReady && (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500 dark:bg-[#2a2310] dark:text-amber-100">
                        <p className="max-w-xs text-left">
                          {t(
                            "playground:composer.connectNotice",
                            "Connect to your tldw server in Settings to send messages."
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to="/settings/tldw"
                            className="text-xs font-medium text-amber-900 underline hover:text-amber-700 dark:text-amber-100 dark:hover:text-amber-300"
                          >
                            {t("settings:tldw.setupLink", "Set up server")}
                          </Link>
                          <Link
                            to="/settings/health"
                            className="text-xs font-medium text-amber-900 underline hover:text-amber-700 dark:text-amber-100 dark:hover:text-amber-300"
                          >
                            {t(
                              "settings:healthSummary.diagnostics",
                              "Health & diagnostics"
                            )}
                          </Link>
                          <button
                            type="button"
                            onClick={() => setShowConnectBanner(false)}
                            className="inline-flex items-center rounded-full p-1 text-amber-700 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-[#3a2b10]"
                            aria-label={t("common:close", "Dismiss")}
                            title={t("common:close", "Dismiss") as string}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                    {queuedMessages.length > 0 && showQueuedBanner && (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-900 dark:border-green-500 dark:bg-[#102a10] dark:text-green-100">
                        <p className="max-w-xs text-left">
                          <span className="block font-medium">
                            {t(
                              "playground:composer.queuedBanner.title",
                              "Queued while offline"
                            )}
                          </span>
                          {t(
                            "playground:composer.queuedBanner.body",
                            "We’ll hold these messages and send them once your tldw server is connected."
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className={`rounded-md border border-green-300 bg-white px-2 py-1 text-xs font-medium text-green-900 hover:bg-green-100 dark:bg-[#163816] dark:text-green-50 dark:hover:bg-[#194419] ${
                              !isConnectionReady ? "cursor-not-allowed opacity-60" : ""
                            }`}
                            title={t(
                              "playground:composer.queuedBanner.sendNow",
                              "Send queued messages"
                            ) as string}
                            disabled={!isConnectionReady}
                            onClick={async () => {
                              if (!isConnectionReady) return
                              for (const item of queuedMessages) {
                                await submitFormFromQueued(item.message, item.image)
                              }
                              clearQueuedMessages()
                            }}>
                            {t(
                              "playground:composer.queuedBanner.sendNow",
                              "Send queued messages"
                            )}
                          </button>
                          <button
                            type="button"
                            className="text-xs font-medium text-green-900 underline hover:text-green-700 dark:text-green-100 dark:hover:text-green-300"
                            title={t(
                              "playground:composer.queuedBanner.clear",
                              "Clear queue"
                            ) as string}
                            onClick={() => {
                              clearQueuedMessages()
                            }}>
                            {t(
                              "playground:composer.queuedBanner.clear",
                              "Clear queue"
                            )}
                          </button>
                          <Link
                            to="/settings/health"
                            className="text-xs font-medium text-green-900 underline hover:text-green-700 dark:text-green-100 dark:hover:text-green-300"
                          >
                            {t(
                              "settings:healthSummary.diagnostics",
                              "Health & diagnostics"
                            )}
                          </Link>
                          <button
                            type="button"
                            onClick={() => setShowQueuedBanner(false)}
                            className="inline-flex items-center rounded-full p-1 text-green-700 hover:bg-green-100 dark:text-green-200 dark:hover:bg-[#163816]"
                            aria-label={t("common:close", "Dismiss")}
                            title={t("common:close", "Dismiss") as string}>
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      <CurrentChatModelSettings
        open={openModelSettings}
        setOpen={setOpenModelSettings}
        isOCREnabled={useOCR}
      />
      <ActorPopout open={openActorSettings} setOpen={setOpenActorSettings} />
      <DocumentGeneratorDrawer
        open={documentGeneratorOpen}
        onClose={() => {
          setDocumentGeneratorOpen(false)
          setDocumentGeneratorSeed({})
        }}
        conversationId={
          documentGeneratorSeed?.conversationId ?? serverChatId ?? null
        }
        defaultModel={selectedModel || null}
        seedMessage={documentGeneratorSeed?.message ?? null}
        seedMessageId={documentGeneratorSeed?.messageId ?? null}
      />
    </div>
  )
}

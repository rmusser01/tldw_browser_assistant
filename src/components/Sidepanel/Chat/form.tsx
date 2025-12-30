import { useForm } from "@mantine/form"
import { useMutation } from "@tanstack/react-query"
import React from "react"
import useDynamicTextareaSize from "~/hooks/useDynamicTextareaSize"
import { useMessage } from "~/hooks/useMessage"
import { toBase64 } from "~/libs/to-base64"
import { Checkbox, Dropdown, Switch, Image, Tooltip, message, Modal } from "antd"
import { useWebUI } from "~/store/webui"
import { defaultEmbeddingModelForRag } from "~/services/tldw-server"
import {
  ImageIcon,
  MicIcon,
  StopCircleIcon,
  X,
  EyeIcon,
  EyeOffIcon,
  Gauge
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { getVariable } from "@/utils/select-variable"
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition"
import { useTldwStt } from "@/hooks/useTldwStt"
import { useMicStream } from "@/hooks/useMicStream"
import { BsIncognito } from "react-icons/bs"
import { handleChatInputKeyDown } from "@/utils/key-down"
import { getIsSimpleInternetSearch } from "@/services/search"
import { useStorage } from "@plasmohq/storage/hook"
import { isFireFoxPrivateMode } from "@/utils/is-private-mode"
import { useFocusShortcuts } from "@/hooks/keyboard"
import { RagSearchBar } from "@/components/Sidepanel/Chat/RagSearchBar"
import { ControlRow } from "@/components/Sidepanel/Chat/ControlRow"
import { CurrentChatModelSettings } from "@/components/Common/Settings/CurrentChatModelSettings"
import { ActorPopout } from "@/components/Common/Settings/ActorPopout"
import QuickIngestModal from "@/components/Common/QuickIngestModal"
import {
  useConnectionState,
  useConnectionUxState
} from "@/hooks/useConnectionState"
import { ConnectionPhase } from "@/types/connection"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { useAntdNotification } from "@/hooks/useAntdNotification"
import { useFocusComposerOnConnect } from "@/hooks/useComposerFocus"
import { useQuickIngestStore } from "@/store/quick-ingest"

type Props = {
  dropedFile: File | undefined
  inputRef?: React.RefObject<HTMLTextAreaElement>
  onHeightChange?: (height: number) => void
  draftKey?: string
}

export const SidepanelForm = ({
  dropedFile,
  inputRef,
  onHeightChange,
  draftKey
}: Props) => {
  const formContainerRef = React.useRef<HTMLDivElement>(null)
  const localTextareaRef = React.useRef<HTMLTextAreaElement>(null)
  const textareaRef = inputRef ?? localTextareaRef
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const { sendWhenEnter, setSendWhenEnter } = useWebUI()
  const [typing, setTyping] = React.useState<boolean>(false)
  const { t } = useTranslation(["playground", "common", "option", "sidepanel"])
  const notification = useAntdNotification()
  const [chatWithWebsiteEmbedding] = useStorage(
    "chatWithWebsiteEmbedding",
    false
  )
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
  const queuedQuickIngestCount = useQuickIngestStore((s) => s.queuedCount)
  const quickIngestHadFailure = useQuickIngestStore((s) => s.hadRecentFailure)
  const storageKey = draftKey || "tldw:sidepanelChatDraft"
  const form = useForm({
    initialValues: {
      message: "",
      image: ""
    }
  })
  const {
    transcript,
    isListening,
    resetTranscript,
    start: startListening,
    stop: stopSpeechRecognition,
    supported: browserSupportsSpeechRecognition
  } = useSpeechRecognition()

  const stopListening = async () => {
    if (isListening) {
      stopSpeechRecognition()
    }
  }

  // Restore unsent draft on mount
  React.useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const draft = window.localStorage.getItem(storageKey)
      if (draft && draft.length > 0) {
        form.setFieldValue("message", draft)
      }
    } catch {
      // ignore draft restore errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Warn Firefox private mode users on mount that data won't persist
  React.useEffect(() => {
    if (isFireFoxPrivateMode) {
      notification.warning({
        message: t(
          "sidepanel:errors.privateModeTitle",
          "tldw Assistant can't save data"
        ),
        description: t(
          "sidepanel:errors.privateModeDescription",
          "Firefox Private Mode does not support saving chat history. Your conversations won't be saved."
        ),
        duration: 6
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist draft whenever the message changes
  const [draftSaved, setDraftSaved] = React.useState(false)
  const draftSavedTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const value = form.values.message
      if (typeof value !== "string") return
      if (value.trim().length === 0) {
        window.localStorage.removeItem(storageKey)
        setDraftSaved(false)
      } else {
        window.localStorage.setItem(storageKey, value)
        // Show "Draft saved" briefly
        setDraftSaved(true)
        if (draftSavedTimeoutRef.current) {
          clearTimeout(draftSavedTimeoutRef.current)
        }
        draftSavedTimeoutRef.current = setTimeout(() => {
          setDraftSaved(false)
        }, 4000)
      }
    } catch {
      // ignore persistence errors
    }
  }, [form.values.message, storageKey])

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (draftSavedTimeoutRef.current) {
        clearTimeout(draftSavedTimeoutRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    if (!onHeightChange) return
    const node = formContainerRef.current
    if (!node || typeof ResizeObserver === "undefined") return

    const notifyHeight = (height: number) => {
      onHeightChange(Math.max(0, Math.ceil(height)))
    }

    notifyHeight(node.getBoundingClientRect().height)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      notifyHeight(entry.contentRect.height)
    })
    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [onHeightChange])

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

  // tldw WS STT
  const {
    connect: sttConnect,
    sendAudio,
    close: sttClose,
    connected: sttConnected,
    lastError: sttError
  } = useTldwStt()
  const {
    start: micStart,
    stop: micStop,
    active: micActive
  } = useMicStream((chunk) => {
    try {
      sendAudio(chunk)
    } catch {}
  })
  const [wsSttActive, setWsSttActive] = React.useState(false)
  const [ingestOpen, setIngestOpen] = React.useState(false)
  const [autoProcessQueuedIngest, setAutoProcessQueuedIngest] =
    React.useState(false)
  const quickIngestBtnRef = React.useRef<HTMLButtonElement>(null)
  const [openActorSettings, setOpenActorSettings] = React.useState(false)
  const { phase, isConnected, serverUrl } = useConnectionState()
  const { uxState } = useConnectionUxState()
  const isConnectionReady = isConnected && phase === ConnectionPhase.CONNECTED
  const { capabilities, loading: capsLoading } = useServerCapabilities()
  const hasServerAudio =
    isConnectionReady && !capsLoading && capabilities?.hasAudio
  const [isFlushingQueue, setIsFlushingQueue] = React.useState(false)
  const [debouncedPlaceholder, setDebouncedPlaceholder] = React.useState<string>(
    t("form.textarea.placeholder")
  )
  const placeholderTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const onInputChange = async (
    e: React.ChangeEvent<HTMLInputElement> | File
  ) => {
    try {
      let file: File
      if (e instanceof File) {
        file = e
      } else if (e.target.files && e.target.files[0]) {
        file = e.target.files[0]
      } else {
        return
      }

      // Validate that the file is an image
      if (!file.type.startsWith("image/")) {
        message.error({
          content: t(
            "sidepanel:composer.imageTypeError",
            "Please select an image file"
          ),
          duration: 3
        })
        return
      }

      const base64 = await toBase64(file)
      form.setFieldValue("image", base64)

      // Show success feedback
      message.success({
        content: t("sidepanel:composer.imageUploaded", {
          defaultValue: "Image added: {{name}}",
          name: file.name.length > 20 ? `${file.name.slice(0, 17)}...` : file.name
        }),
        duration: 2
      })
    } catch (err) {
      message.error({
        content: t("sidepanel:composer.imageUploadError", "Failed to process image"),
        duration: 3
      })
    }
  }
  const textAreaFocus = () => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const handler = () => setOpenActorSettings(true)
    window.addEventListener("tldw:open-actor-settings", handler)
    return () => {
      window.removeEventListener("tldw:open-actor-settings", handler)
    }
  }, [])

  // When sidepanel connection transitions to CONNECTED, focus the composer
  useFocusComposerOnConnect(phase)

  // Allow other components (e.g., connection card) to request focus
  React.useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        textAreaFocus()
      }
    }
    window.addEventListener("tldw:focus-composer", handler)
    return () => window.removeEventListener("tldw:focus-composer", handler)
  }, [])

  const {
    onSubmit,
    selectedModel,
    chatMode,
    stopStreamingRequest,
    streaming,
    setChatMode,
    webSearch,
    setWebSearch,
    selectedQuickPrompt,
    setSelectedQuickPrompt,
    selectedSystemPrompt,
    setSelectedSystemPrompt,
    speechToTextLanguage,
    useOCR,
    setUseOCR,
    defaultInternetSearchOn,
    defaultChatWithWebsite,
    temporaryChat,
    setTemporaryChat,
    messages,
    clearChat,
    queuedMessages,
    addQueuedMessage,
    clearQueuedMessages,
    serverChatId
  } = useMessage()


  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0]
      // Only handle image files from paste
      if (file.type.startsWith("image/")) {
        e.preventDefault()
        onInputChange(file)
      }
    }
  }

  useFocusShortcuts(textareaRef, true)

  const ensureEmbeddingModelAvailable = async (): Promise<boolean> => {
    // Fast path: no RAG or web search enabled
    if (chatMode !== "rag" && !webSearch) {
      return true
    }

    let defaultEM: string | null | undefined

    // When chatting with the current page via embeddings, require a default embedding model
    if (chatMode === "rag" && chatWithWebsiteEmbedding) {
      defaultEM = await defaultEmbeddingModelForRag()
      if (!defaultEM) {
        form.setFieldError("message", t("formError.noEmbeddingModel"))
        return false
      }
    }

    // When web search is enabled and not in simple-search mode, also require an embedding model
    if (webSearch) {
      if (typeof defaultEM === "undefined") {
        defaultEM = await defaultEmbeddingModelForRag()
      }
      const simpleSearch = await getIsSimpleInternetSearch()
      if (!defaultEM && !simpleSearch) {
        form.setFieldError("message", t("formError.noEmbeddingModel"))
        return false
      }
    }

    return true
  }

  async function sendCurrentFormMessage(
    rawMessage: string,
    image: string
  ): Promise<void> {
    const trimmed = rawMessage.trim()
    if (trimmed.length === 0 && image.length === 0) {
      return
    }
    await stopListening()
    if (!selectedModel || selectedModel.length === 0) {
      form.setFieldError("message", t("formError.noModel"))
      return
    }
    const hasEmbedding = await ensureEmbeddingModelAvailable()
    if (!hasEmbedding) {
      return
    }
    form.reset()
    textAreaFocus()
    await sendMessage({
      image,
      message: trimmed
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isConnectionReady) {
      if (e.key === "Enter") {
        e.preventDefault()
        form.onSubmit(async (value) => {
          if (value.message.trim().length === 0 && value.image.length === 0) {
            return
          }
          addQueuedMessage({
            message: value.message.trim(),
            image: value.image
          })
          form.reset()
        })()
      }
      return
    }
    if (e.key === "Process" || e.key === "229") return
    if (
      handleChatInputKeyDown({
        e,
        sendWhenEnter,
        typing,
        isSending
      })
    ) {
      e.preventDefault()
      form.onSubmit(async (value) => {
        await sendCurrentFormMessage(value.message, value.image)
      })()
    }
  }

  const [openModelSettings, setOpenModelSettings] = React.useState(false)
  const openSettings = React.useCallback(() => {
    try {
      // @ts-ignore
      if (chrome?.runtime?.openOptionsPage) {
        // @ts-ignore
        chrome.runtime.openOptionsPage()
        return
      }
    } catch {}
    window.open("/options.html#/", "_blank")
  }, [])

  const openDiagnostics = React.useCallback(() => {
    window.open("/options.html#/settings/health", "_blank")
  }, [])

  const getPersistenceModeLabel = React.useCallback(
    (isTemporary: boolean) =>
      isTemporary
        ? t(
            "playground:composer.persistence.ephemeral",
            "Temporary chat: not saved in history and cleared when you close this window."
          )
        : t(
            "playground:composer.persistence.local",
            "Saved in this browser only."
          ),
    [t]
  )

  const getPersistenceModeChipLabel = React.useCallback(
    (isTemporary: boolean) =>
      isTemporary
        ? t(
            "playground:composer.persistence.ephemeralShort",
            "Temporary (not saved)"
          )
        : t("playground:composer.persistence.localShort", "Saved locally"),
    [t]
  )

  const handleToggleTemporaryChat = React.useCallback(
    (next: boolean) => {
      if (isFireFoxPrivateMode) {
        notification.error({
          message: t(
            "sidepanel:errors.privateModeTitle",
            "tldw Assistant can't save data"
          ),
          description: t(
            "sidepanel:errors.privateModeDescription",
            "Firefox Private Mode does not support saving chat history. Temporary chat is enabled by default. More fixes coming soon."
          )
        })
        return
      }

      const hadMessages = messages.length > 0

      // Show confirmation when enabling temporary mode with existing messages
      if (next && hadMessages) {
        Modal.confirm({
          title: t(
            "sidepanel:composer.tempChatConfirmTitle",
            "Enable temporary mode?"
          ),
          content: t(
            "sidepanel:composer.tempChatConfirmContent",
            "This will clear your current conversation. Messages won't be saved."
          ),
          okText: t("common:confirm", "Confirm"),
          cancelText: t("common:cancel", "Cancel"),
          onOk: () => {
            setTemporaryChat(next)
            clearChat()
            notification.info({
              message: t(
                "sidepanel:composer.tempChatClearedMessages",
                "Temporary chat enabled. Previous messages cleared."
              ),
              placement: "bottomRight",
              duration: 2.5
            })
          }
        })
        return
      }

      // Show confirmation when disabling temporary mode with existing messages
      if (!next && hadMessages) {
        Modal.confirm({
          title: t(
            "sidepanel:composer.tempChatDisableConfirmTitle",
            "Disable temporary mode?"
          ),
          content: t(
            "sidepanel:composer.tempChatDisableConfirmContent",
            "This will clear your current conversation. Messages will start saving again."
          ),
          okText: t("common:confirm", "Confirm"),
          cancelText: t("common:cancel", "Cancel"),
          onOk: () => {
            setTemporaryChat(next)
            clearChat()
            notification.info({
              message: t(
                "sidepanel:composer.tempChatDisabledClearedMessages",
                "Temporary chat disabled. Previous messages cleared."
              ),
              placement: "bottomRight",
              duration: 2.5
            })
          }
        })
        return
      }

      // No confirmation needed when toggling with no messages
      setTemporaryChat(next)
      if (hadMessages) {
        clearChat()
      }

      const modeLabel = getPersistenceModeLabel(next)
      notification.info({
        message: modeLabel,
        placement: "bottomRight",
        duration: 2.5
      })
    },
    [
      clearChat,
      getPersistenceModeLabel,
      messages.length,
      notification,
      setTemporaryChat,
      t
    ]
  )

  const handleWebSearchToggle = React.useCallback(() => {
    setWebSearch(!webSearch)
  }, [setWebSearch, webSearch])

  const handleSpeechToggle = React.useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      resetTranscript()
      startListening({
        continuous: true,
        lang: speechToTextLanguage
      })
    }
  }, [
    isListening,
    resetTranscript,
    speechToTextLanguage,
    startListening,
    stopListening
  ])

  const handleServerDictationToggle = React.useCallback(async () => {
    if (isServerDictating) {
      stopServerDictation()
      return
    }
    if (!hasServerAudio) {
      notification.error({
        message: t(
          "playground:actions.speechErrorTitle",
          "Dictation unavailable"
        ),
        description: t(
          "playground:actions.speechErrorBody",
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
        setIsServerDictating(false)
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
              message: t(
                "playground:actions.speechErrorTitle",
                "Dictation failed"
              ),
              description: t(
                "playground:actions.speechNoText",
                "The transcription did not return any text."
              )
            })
          }
        } catch (e: any) {
          notification.error({
            message: t(
              "playground:actions.speechErrorTitle",
              "Dictation failed"
            ),
            description:
              e?.message ||
              t(
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
      // L19: Add permissions guidance for microphone errors
      const isChromeOrEdge = typeof chrome !== 'undefined' && chrome.permissions
      notification.error({
        message: t("playground:actions.speechErrorTitle", "Dictation failed"),
        description: (
          <div>
            <p className="mb-2">
              {t(
                "playground:actions.speechMicError",
                "Unable to access your microphone. Check browser permissions and try again."
              )}
            </p>
            {isChromeOrEdge && (
              <span className="text-xs text-blue-600 dark:text-blue-400">
                {t(
                  "playground:actions.micPermissionsHint",
                  "Check Site Settings > Microphone in your browser"
                )}
              </span>
            )}
          </div>
        )
      })
    }
  }, [
    hasServerAudio,
    isServerDictating,
    speechToTextLanguage,
    sttModel,
    sttTimestampGranularities,
    sttPrompt,
    sttTask,
    sttResponseFormat,
    sttTemperature,
    sttUseSegmentation,
    sttSegK,
    sttSegMinSegmentSize,
    sttSegLambdaBalance,
    sttSegUtteranceExpansionWidth,
    sttSegEmbeddingsProvider,
    sttSegEmbeddingsModel,
    stopServerDictation,
    t,
    form,
    notification
  ])

  const handleLiveCaptionsToggle = React.useCallback(async () => {
    if (wsSttActive) {
      try {
        micStop()
      } catch {}
      try {
        sttClose()
      } catch {}
      setWsSttActive(false)
    } else {
      try {
        sttConnect()
        await micStart()
        setWsSttActive(true)
      } catch (e: any) {
        notification.error({
          message: t(
            "playground:actions.streamErrorTitle",
            "Live captions unavailable"
          ),
          description:
            e?.message ||
            t(
              "playground:actions.streamMicError",
              "Unable to start live captions. Check microphone permissions and server health, then try again."
            )
        })
        try {
          micStop()
        } catch {}
        try {
          sttClose()
        } catch {}
        setWsSttActive(false)
      }
    }
  }, [micStart, micStop, notification, sttClose, sttConnect, t, wsSttActive])

  const handleVisionToggle = React.useCallback(() => {
    setChatMode(chatMode === "vision" ? "normal" : "vision")
  }, [chatMode, setChatMode])

  const handleImageUpload = React.useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleRagToggle = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent("tldw:toggle-rag"))
  }, [])

  const handleQuickIngestOpen = React.useCallback(() => {
    setAutoProcessQueuedIngest(false)
    setIngestOpen(true)
  }, [])

  const handleProcessQueuedIngest = React.useCallback(() => {
    if (!isConnectionReady) return

    // Snapshot the current queue size; if it has been cleared between
    // render and click, we still open the modal but skip auto-processing.
    if (queuedQuickIngestCount <= 0) {
      setAutoProcessQueuedIngest(false)
      setIngestOpen(true)
      return
    }

    setAutoProcessQueuedIngest(true)
    setIngestOpen(true)
  }, [isConnectionReady, queuedQuickIngestCount])

  React.useEffect(() => {
    const handler = () => {
      setAutoProcessQueuedIngest(false)
      setIngestOpen(true)
      requestAnimationFrame(() => {
        quickIngestBtnRef.current?.focus()
      })
    }
    window.addEventListener("tldw:open-quick-ingest", handler)
    return () => {
      window.removeEventListener("tldw:open-quick-ingest", handler)
    }
  }, [isConnectionReady])

  React.useEffect(() => {
    if (!sttError) return
    notification.error({
      message: t(
        "playground:actions.streamErrorTitle",
        "Live captions unavailable"
      ),
      description: sttError
    })
    try {
      micStop()
    } catch {}
    try {
      sttClose()
    } catch {}
    setWsSttActive(false)
  }, [micStop, setWsSttActive, sttClose, sttError, t])

  const persistenceModeLabel = React.useMemo(
    () => getPersistenceModeLabel(temporaryChat),
    [getPersistenceModeLabel, temporaryChat]
  )
  const persistenceModeChipLabel = React.useMemo(
    () => getPersistenceModeChipLabel(temporaryChat),
    [getPersistenceModeChipLabel, temporaryChat]
  )

  React.useEffect(() => {
    if (dropedFile) {
      onInputChange(dropedFile)
    }
  }, [dropedFile])

  useDynamicTextareaSize(textareaRef, form.values.message, 120)

  React.useEffect(() => {
    if (isListening) {
      form.setFieldValue("message", transcript)
    }
  }, [transcript])

  React.useEffect(() => {
    if (selectedQuickPrompt) {
      const word = getVariable(selectedQuickPrompt)
      form.setFieldValue("message", selectedQuickPrompt)
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
    }
  }, [selectedQuickPrompt])
  const { mutateAsync: sendMessage, isPending: isSending } = useMutation({
    mutationFn: onSubmit,
    onSuccess: () => {
      textAreaFocus()
    },
    onError: (error) => {
      textAreaFocus()
    }
  })

  const submitQueuedInSidepanel = async (message: string, image: string) => {
    if (!isConnectionReady) return
    await stopListening()
    stopServerDictation()
    if (!selectedModel || selectedModel.length === 0) {
      form.setFieldError("message", t("formError.noModel"))
      return
    }
    await sendMessage({
      image,
      message
    })
  }

  React.useEffect(() => {
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer?.items) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          if (e.dataTransfer.items[i].type === "text/plain") {
            e.dataTransfer.items[i].getAsString((text) => {
              form.setFieldValue("message", text)
            })
          }
        }
      }
    }
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }
    textareaRef.current?.addEventListener("drop", handleDrop)
    textareaRef.current?.addEventListener("dragover", handleDragOver)

    if (defaultInternetSearchOn) {
      setWebSearch(true)
    }

    if (defaultChatWithWebsite) {
      setChatMode("rag")
    }

    return () => {
      textareaRef.current?.removeEventListener("drop", handleDrop)
      textareaRef.current?.removeEventListener("dragover", handleDragOver)
    }
  }, [])

  React.useEffect(() => {
    if (defaultInternetSearchOn) {
      setWebSearch(true)
    }
  }, [defaultInternetSearchOn])

  // Clear error messages when user starts typing (they're taking action)
  // Errors persist until user interaction rather than auto-dismissing
  React.useEffect(() => {
    if (form.values.message && form.errors.message) {
      form.clearFieldError("message")
    }
  }, [form.values.message, form.errors.message, form.clearFieldError])

  // Clear "no model" error when a model is selected
  React.useEffect(() => {
    if (selectedModel && form.errors.message) {
      form.clearFieldError("message")
    }
  }, [selectedModel, form.errors.message, form.clearFieldError])

  // Debounce placeholder changes to prevent flashing on flaky connections
  React.useEffect(() => {
    const targetPlaceholder = isConnectionReady
      ? t("form.textarea.placeholder")
      : uxState === "testing"
        ? t(
            "sidepanel:composer.connectingPlaceholder",
            "Connecting..."
          )
        : t(
            "sidepanel:composer.disconnectedPlaceholder",
            "Not connected — open Settings to connect"
          )

    // Clear any existing timeout
    if (placeholderTimeoutRef.current) {
      clearTimeout(placeholderTimeoutRef.current)
    }

    // Debounce by ~400ms to avoid flashing while keeping the UI responsive
    placeholderTimeoutRef.current = setTimeout(() => {
      setDebouncedPlaceholder(targetPlaceholder)
    }, 400)

    return () => {
      if (placeholderTimeoutRef.current) {
        clearTimeout(placeholderTimeoutRef.current)
        placeholderTimeoutRef.current = null
      }
    }
  }, [isConnectionReady, uxState, t])

  return (
    <div ref={formContainerRef} className="flex w-full flex-col items-center px-2">
      <div className="relative z-10 flex w-full flex-col items-center justify-center gap-2 text-base">
        <div className="relative flex w-full flex-row justify-center gap-2">
          <div
            aria-disabled={!isConnectionReady}
            className="bg-neutral-50 dark:bg-[#262626] relative w-full max-w-[48rem] p-1 backdrop-blur-lg duration-100 border border-gray-300 rounded-t-xl dark:border-gray-600">
            <div
              className={`border-b border-gray-200 dark:border-gray-600 relative ${
                form.values.image.length === 0 ? "hidden" : "block"
              }`}>
              <button
                type="button"
                onClick={() => {
                  form.setFieldValue("image", "")
                }}
                aria-label={t("sidepanel:composer.removeImage", "Remove uploaded image")}
                className="absolute top-1 left-1 flex items-center justify-center z-10 bg-white dark:bg-[#262626] p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 text-black dark:text-gray-100">
                <X className="h-3 w-3" />
              </button>{" "}
              <Image
                src={form.values.image}
                alt="Uploaded Image"
                preview={false}
                className="rounded-md max-h-32"
              />
            </div>
            <div>
              <div className="flex">
                <form
                  onSubmit={form.onSubmit(async (value) => {
                    await sendCurrentFormMessage(value.message, value.image)
                  })}
                  className="shrink-0 flex-grow  flex flex-col items-center ">
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    ref={fileInputRef}
                    accept="image/*"
                    multiple={false}
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={onInputChange}
                  />
                  <div
                    className={`w-full flex flex-col px-1 ${
                      !isConnectionReady
                        ? "rounded-md border border-dashed border-amber-400 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-900/10"
                        : ""
                    }`}>
                    {/* Connection status indicator when disconnected */}
                    {!isConnectionReady && (
                      <div className={`flex items-center gap-2 px-2 py-1.5 text-xs ${
                        uxState === "testing"
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-red-700 dark:text-red-300"
                      }`}>
                        <span className="relative flex h-2 w-2">
                          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                            uxState === "testing" ? "bg-amber-400" : "bg-red-400"
                          }`}></span>
                          <span className={`relative inline-flex h-2 w-2 rounded-full ${
                            uxState === "testing" ? "bg-amber-500" : "bg-red-500"
                          }`}></span>
                        </span>
                        <span>
                          {uxState === "testing"
                            ? t("sidepanel:composer.connectingStatus", "Connecting to server...")
                            : t("sidepanel:composer.disconnectedStatus", "Not connected")}
                        </span>
                        {uxState !== "testing" && (
                          <button
                            type="button"
                            onClick={openSettings}
                            className="ml-auto text-[11px] font-medium text-red-700 underline hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
                          >
                            {t("sidepanel:composer.openSettings", "Open Settings")}
                          </button>
                        )}
                      </div>
                    )}
                    {/* RAG Search Bar: search KB, insert snippets, ask directly */}
                    <RagSearchBar
                      onInsert={(text) => {
                        const current = form.values.message || ""
                        const next = current ? `${current}\n\n${text}` : text
                        form.setFieldValue("message", next)
                        // Focus textarea for quick edits
                        textareaRef.current?.focus()
                      }}
                      onAsk={async (text) => {
                        // Set message and submit immediately
                        const trimmed = text.trim()
                        if (!trimmed) return
                        form.setFieldValue("message", text)
                        if (!isConnectionReady) {
                          addQueuedMessage({
                            message: trimmed,
                            image: form.values.image
                          })
                          form.reset()
                          return
                        }
                        await sendCurrentFormMessage(trimmed, "")
                      }}
                    />
                    {/* Queued messages banner - shown above input area */}
                    {queuedMessages.length > 0 && (
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-900 dark:border-green-500 dark:bg-[#102a10] dark:text-green-100">
                        <p className="max-w-xs text-left">
                          <span className="block font-medium">
                            {t(
                              "playground:composer.queuedBanner.title",
                              "Queued from existing drafts"
                            )}
                          </span>
                          {t(
                            "playground:composer.queuedBanner.body",
                            "These drafts were created while offline. We'll send them once your tldw server is connected."
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Tooltip
                            title={
                              !isConnectionReady || isFlushingQueue
                                ? !isConnectionReady
                                  ? t(
                                      "playground:composer.queuedBanner.waitForConnection",
                                      "Wait for server connection to send queued messages"
                                    )
                                  : t(
                                      "playground:composer.queuedBanner.sending",
                                      "Sending..."
                                    )
                                : undefined
                            }>
                            <span className="inline-block">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!isConnectionReady || isFlushingQueue) return
                                  setIsFlushingQueue(true)
                                  try {
                                    const hasEmbedding =
                                      await ensureEmbeddingModelAvailable()
                                    if (!hasEmbedding) {
                                      return
                                    }
                                    const successfullySentIndices = new Set<number>()
                                    for (const [index, item] of queuedMessages.entries()) {
                                      try {
                                        await submitQueuedInSidepanel(
                                          item.message,
                                          item.image
                                        )
                                        successfullySentIndices.add(index)
                                      } catch (error) {
                                        console.error(
                                          "Failed to send queued sidepanel message",
                                          error
                                        )
                                      }
                                    }

                                    if (successfullySentIndices.size > 0) {
                                      const remainingQueued = queuedMessages.filter(
                                        (_, index) => !successfullySentIndices.has(index)
                                      )
                                      clearQueuedMessages()
                                      for (const item of remainingQueued) {
                                        addQueuedMessage(item)
                                      }
                                    }
                                  } finally {
                                    setIsFlushingQueue(false)
                                  }
                                }}
                                disabled={!isConnectionReady || isFlushingQueue}
                                className={`rounded-md border border-green-300 bg-white px-2 py-1 text-xs font-medium text-green-900 hover:bg-green-100 dark:bg-[#163816] dark:text-green-50 dark:hover:bg-[#194419] ${
                                  !isConnectionReady || isFlushingQueue
                                    ? "cursor-not-allowed opacity-60"
                                    : ""
                                }`}>
                                {t(
                                  "playground:composer.queuedBanner.sendNow",
                                  "Send queued messages"
                                )}
                              </button>
                            </span>
                          </Tooltip>
                          <button
                            type="button"
                            onClick={() => {
                              const count = queuedMessages.length
                              Modal.confirm({
                                title: t(
                                  "sidepanel:composer.clearQueueConfirmTitle",
                                  "Clear message queue?"
                                ),
                                content: t(
                                  "sidepanel:composer.clearQueueConfirmContent",
                                  "This will delete {{count}} queued message(s) that haven't been sent yet.",
                                  { count }
                                ),
                                okText: t("common:confirm", "Confirm"),
                                cancelText: t("common:cancel", "Cancel"),
                                onOk: () => {
                                  clearQueuedMessages()
                                  message.success(
                                    t(
                                      "playground:composer.queuedBanner.cleared",
                                      "Queue cleared ({{count}} messages)",
                                      { count }
                                    )
                                  )
                                }
                              })
                            }}
                            className="text-xs font-medium text-green-900 underline hover:text-green-700 dark:text-green-100 dark:hover:text-green-300">
                            {t(
                              "playground:composer.queuedBanner.clear",
                              "Clear queue"
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={openDiagnostics}
                            className="text-xs font-medium text-green-900 underline hover:text-green-700 dark:text-green-100 dark:hover:text-green-300">
                            {t(
                              "settings:healthSummary.diagnostics",
                              "Health & diagnostics"
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="relative">
                      <textarea
                        onKeyDown={(e) => handleKeyDown(e)}
                        ref={textareaRef}
                        data-testid="chat-input"
                        className={`px-2 py-2 w-full resize-none focus-within:outline-none focus:ring-0 focus-visible:ring-0 ring-0 dark:ring-0 border-0 dark:text-gray-100 ${
                          !isConnectionReady
                            ? "cursor-not-allowed text-gray-400 placeholder:text-gray-400 dark:text-gray-500 dark:placeholder:text-gray-500 bg-transparent"
                            : "bg-transparent"
                        }`}
                        readOnly={!isConnectionReady}
                        aria-readonly={!isConnectionReady}
                        aria-disabled={!isConnectionReady}
                        aria-label={
                          !isConnectionReady
                            ? t(
                                "sidepanel:composer.disconnectedAriaLabel",
                                "Message input (read-only: not connected to server)"
                              )
                            : t("sidepanel:composer.messageAriaLabel", "Message input")
                        }
                        onPaste={handlePaste}
                        rows={1}
                        style={{ minHeight: "60px" }}
                        tabIndex={0}
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
                        placeholder={debouncedPlaceholder || t("form.textarea.placeholder")}
                        {...form.getInputProps("message")}
                      />
                      {/* Draft saved indicator */}
                      {draftSaved && (
                        <span
                          className="absolute bottom-1 right-2 text-[10px] text-gray-500 dark:text-gray-400 animate-pulse pointer-events-none"
                          role="status"
                          aria-live="polite"
                        >
                          {t("sidepanel:composer.draftSaved", "Draft saved")}
                        </span>
                      )}
                    </div>
                    {/* Inline error message - positioned right after textarea for visibility */}
                    {form.errors.message && (
                      <div
                        role="alert"
                        aria-live="assertive"
                        aria-atomic="true"
                        className="flex items-center justify-between gap-1.5 px-2 py-1 text-xs text-red-600 dark:text-red-400 animate-shake"
                      >
                        <div className="flex items-center gap-1.5">
                          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span>{form.errors.message}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => form.clearFieldError("message")}
                          className="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          aria-label={t("common:dismiss", "Dismiss")}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {/* Proactive validation hints - show why send might be disabled */}
                    {!form.errors.message && isConnectionReady && !streaming && (
                      <div className="px-2 py-0.5 text-[10px] text-gray-400 dark:text-gray-500">
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
                    <div className="mt-2 flex w-full flex-row items-center justify-between gap-2">
                      {/* Control Row - contains Prompt, Model, RAG, Save, and More tools */}
                      <ControlRow
                        selectedSystemPrompt={selectedSystemPrompt}
                        setSelectedSystemPrompt={setSelectedSystemPrompt}
                        setSelectedQuickPrompt={setSelectedQuickPrompt}
                        temporaryChat={temporaryChat}
                        serverChatId={serverChatId}
                        setTemporaryChat={handleToggleTemporaryChat}
                        webSearch={webSearch}
                        setWebSearch={setWebSearch}
                        chatMode={chatMode}
                        setChatMode={setChatMode}
                        onImageUpload={onInputChange}
                        onToggleRag={handleRagToggle}
                        isConnected={isConnectionReady}
                      />
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <div
                          role="group"
                          aria-label={t(
                            "playground:composer.actions",
                            "Send options"
                          )}
                          className="flex items-center gap-2">
                          {/* L15: gap-2 provides visual separation */}
                          {!streaming ? (
                            <>
                              <Dropdown.Button
                                aria-label={t(
                                  "playground:composer.submitAria",
                                  "Send message"
                                )}
                                data-testid="chat-send"
                                title={
                                  !isConnectionReady
                                    ? (t(
                                        "playground:composer.connectToSend",
                                        "Connect to your tldw server to start chatting."
                                      ) as string)
                                    : sendWhenEnter
                                      ? (t(
                                          "playground:sendWhenEnter"
                                        ) as string)
                                      : undefined
                                }
                                htmlType="submit"
                                disabled={isSending || !isConnectionReady}
                                className="!justify-end !w-auto"
                                icon={
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="w-4 h-4">
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
                                      key: "send-section",
                                      type: "group",
                                      label: t(
                                        "playground:composer.actions",
                                        "Send options"
                                      ),
                                      children: [
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
                                        }
                                      ]
                                    },
                                    {
                                      type: "divider",
                                      key: "divider-1"
                                    },
                                    {
                                      key: "context-section",
                                      type: "group",
                                      label: t(
                                        "playground:composer.coreTools",
                                        "Conversation options"
                                      ),
                                      children: [
                                        {
                                          key: 2,
                                          label: (
                                            <Checkbox
                                              checked={chatMode === "rag"}
                                              onChange={(e) => {
                                                setChatMode(
                                                  e.target.checked
                                                    ? "rag"
                                                    : "normal"
                                                )
                                              }}>
                                              {t("common:chatWithCurrentPage")}
                                            </Checkbox>
                                          )
                                        },
                                        {
                                          key: 3,
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
                                    }
                                  ]
                                }}>
                                <div className="inline-flex gap-2">
                                  {sendWhenEnter ? (
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      className="h-4 w-4"
                                      viewBox="0 0 24 24">
                                      <path d="M9 10L4 15 9 20"></path>
                                      <path d="M20 4v7a4 4 0 01-4 4H4"></path>
                                    </svg>
                                  ) : null}
                                  {t("common:send", "Send")}
                                </div>
                              </Dropdown.Button>
                              {/* Current Conversation Settings button to the right of submit */}
                              <Tooltip
                                title={
                                  t("common:currentChatModelSettings") as string
                                }>
                                <button
                                  type="button"
                                  onClick={() => setOpenModelSettings(true)}
                                  className="text-gray-700 dark:text-gray-300 p-1 hover:text-gray-900 dark:hover:text-gray-100">
                                  <Gauge className="h-5 w-5" />
                                  <span className="sr-only">
                                    {t(
                                      "playground:composer.openModelSettings",
                                      "Open current chat settings"
                                    )}
                                  </span>
                                </button>
                              </Tooltip>
                            </>
                          ) : (
                            <>
                              <Tooltip title={t("tooltip.stopStreaming")}>
                                <button
                                  type="button"
                                  onClick={stopStreamingRequest}
                                  data-testid="chat-stop-streaming"
                                  className="text-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md p-1">
                                  <StopCircleIcon className="h-5 w-5" />
                                  <span className="sr-only">
                                    {t(
                                      "playground:composer.stopStreaming",
                                      "Stop streaming response"
                                    )}
                                  </span>
                                </button>
                              </Tooltip>
                              {/* L15: Visual separator between Stop and settings buttons */}
                              <Tooltip
                                title={
                                  t("common:currentChatModelSettings") as string
                                }>
                                <button
                                  type="button"
                                  onClick={() => setOpenModelSettings(true)}
                                  className="text-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md p-1">
                                  <Gauge className="h-5 w-5" />
                                  <span className="sr-only">
                                    {t(
                                      "playground:composer.openModelSettings",
                                      "Open current chat settings"
                                    )}
                                  </span>
                                </button>
                              </Tooltip>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Modal/Drawer for current conversation settings */}
      <CurrentChatModelSettings
        open={openModelSettings}
        setOpen={setOpenModelSettings}
        isOCREnabled={useOCR}
      />
      <ActorPopout open={openActorSettings} setOpen={setOpenActorSettings} />
      {/* Quick ingest modal */}
      <QuickIngestModal
        open={ingestOpen}
        autoProcessQueued={autoProcessQueuedIngest}
        onClose={() => {
          setIngestOpen(false)
          setAutoProcessQueuedIngest(false)
          requestAnimationFrame(() => quickIngestBtnRef.current?.focus())
        }}
      />
    </div>
  )
}

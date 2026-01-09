import { getPromptById } from "@/db/dexie/helpers"
import { useMessageOption } from "@/hooks/useMessageOption"
import { getAllModelSettings } from "@/services/model-settings"
import { useStoreChatModelSettings, type ChatModelSettings } from "@/store/model"
import { useActorStore } from "@/store/actor"
import { useQuery } from "@tanstack/react-query"
import {
  Drawer,
  Form,
  Modal,
  Skeleton,
  Tabs
} from "antd"
import React, { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { SaveButton } from "../SaveButton"
import { getOCRLanguage } from "@/services/ocr"
import { ocrLanguages } from "@/data/ocr-language"
import { fetchChatModels } from "@/services/tldw-server"
import { ProviderIcons } from "@/components/Common/ProviderIcon"
import { getProviderDisplayName } from "@/utils/provider-registry"
import type { ActorSettings, ActorTarget } from "@/types/actor"
import { createDefaultActorSettings } from "@/types/actor"
import {
  getActorSettingsForChatWithCharacterFallback,
  saveActorSettingsForChat
} from "@/services/actor-settings"
import {
  buildActorPrompt,
  buildActorSettingsFromForm,
  estimateActorTokens
} from "@/utils/actor"
import type { Character } from "@/types/character"
import { useStorage } from "@plasmohq/storage/hook"
import {
  ModelBasicsTab,
  ConversationTab,
  AdvancedParamsTab,
  ActorTab
} from "./tabs"

type Props = {
  open: boolean
  setOpen: (open: boolean) => void
  useDrawer?: boolean
  isOCREnabled?: boolean
}

type ModelConfigData = {
  temperature?: number
  topK?: number
  topP?: number
  keepAlive?: string
  numCtx?: number
  numGpu?: number
  numPredict?: number
  useMMap?: boolean
  minP?: number
  repeatLastN?: number
  repeatPenalty?: number
  useMlock?: boolean
  tfsZ?: number
  numKeep?: number
  numThread?: number
}

type ModelDetails = {
  provider?: string
  capabilities?: string[]
}

type ChatModel = {
  model: string
  nickname?: string
  provider?: string
  details?: ModelDetails
}

type ActorFormValues = {
  actorEnabled?: boolean
  actorNotes?: ActorSettings["notes"]
  actorNotesGmOnly?: ActorSettings["notesGmOnly"]
  actorChatPosition?: ActorSettings["chatPosition"]
  actorChatDepth?: ActorSettings["chatDepth"]
  actorChatRole?: ActorSettings["chatRole"]
  actorTemplateMode?: ActorSettings["templateMode"]
  [key: `actor_${string}`]: string | undefined
  [key: `actor_key_${string}`]: string | undefined
}

type CurrentChatModelFormValues = Partial<ChatModelSettings> & ActorFormValues

const CHAT_MODEL_SETTING_KEYS: ReadonlySet<keyof ChatModelSettings> = new Set([
  "temperature",
  "topK",
  "topP",
  "keepAlive",
  "numCtx",
  "seed",
  "numGpu",
  "numPredict",
  "useMMap",
  "minP",
  "repeatLastN",
  "repeatPenalty",
  "useMlock",
  "tfsZ",
  "numKeep",
  "numThread",
  "reasoningEffort",
  "historyMessageLimit",
  "historyMessageOrder",
  "slashCommandInjectionMode",
  "apiProvider",
  "extraHeaders",
  "extraBody",
  "jsonMode"
])

const isChatModelSettingKey = (
  key: string
): key is keyof ChatModelSettings =>
  CHAT_MODEL_SETTING_KEYS.has(key as keyof ChatModelSettings)

export const CurrentChatModelSettings = ({
  open,
  setOpen,
  useDrawer,
  isOCREnabled
}: Props) => {
  const { t } = useTranslation("common")
  const [form] = Form.useForm<CurrentChatModelFormValues>()
  const cUserSettings = useStoreChatModelSettings()
  const {
    historyId,
    selectedSystemPrompt,
    uploadedFiles,
    removeUploadedFile,
    selectedModel,
    setSelectedModel,
    fileRetrievalEnabled,
    setFileRetrievalEnabled,
    serverChatId,
    serverChatTopic,
    setServerChatTopic,
    serverChatState,
    setServerChatState,
    setServerChatVersion
  } = useMessageOption()

  const [selectedCharacter] = useStorage<Character | null>(
    "selectedCharacter",
    null
  )

  const {
    settings: actorSettings,
    setSettings: setActorSettings,
    preview: actorPreview,
    tokenCount: actorTokenCount,
    setPreviewAndTokens
  } = useActorStore()
  const [newAspectTarget, setNewAspectTarget] =
    React.useState<ActorTarget>("user")
  const [newAspectName, setNewAspectName] = React.useState<string>("")
  const actorPositionValue = Form.useWatch("actorChatPosition", form)

  const savePrompt = useCallback(
    (value: string) => {
      cUserSettings.updateSetting("systemPrompt", value)
    },
    [cUserSettings]
  )

  const recomputeActorPreview = useCallback(() => {
    const values = form.getFieldsValue()
    const base = actorSettings ?? createDefaultActorSettings()

    const next: ActorSettings = buildActorSettingsFromForm(base, values)

    const preview = buildActorPrompt(next)
    setPreviewAndTokens(preview, estimateActorTokens(preview))
  }, [actorSettings, form, setPreviewAndTokens])

  const timeoutRef = React.useRef<number | undefined>()

  const debouncedRecomputeActorPreview = React.useMemo(() => {
    return () => {
      if (timeoutRef.current !== undefined) {
        window.clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = window.setTimeout(() => {
        recomputeActorPreview()
      }, 150)
    }
  }, [recomputeActorPreview])

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current !== undefined) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    if (!open) return
    recomputeActorPreview()
  }, [actorSettings, open, recomputeActorPreview])

  const saveSettings = useCallback(
    (values: CurrentChatModelFormValues) => {
      Object.keys(values).forEach((key) => {
        if (!isChatModelSettingKey(key)) return
        cUserSettings.updateSetting(key, values[key])
      })

      const base = actorSettings ?? createDefaultActorSettings()
      const next: ActorSettings = buildActorSettingsFromForm(base, values)

      setActorSettings(next)
      void saveActorSettingsForChat({
        historyId,
        serverChatId,
        settings: next
      })
    },
    [actorSettings, cUserSettings, historyId, serverChatId]
  )

  const buildBaseValues = useCallback(
    (data?: ModelConfigData | null, promptFallback?: string) => ({
      temperature: cUserSettings.temperature ?? data?.temperature,
      topK: cUserSettings.topK ?? data?.topK,
      topP: cUserSettings.topP ?? data?.topP,
      keepAlive: cUserSettings.keepAlive ?? data?.keepAlive,
      numCtx: cUserSettings.numCtx ?? data?.numCtx,
      seed: cUserSettings.seed,
      numGpu: cUserSettings.numGpu ?? data?.numGpu,
      numPredict: cUserSettings.numPredict ?? data?.numPredict,
      systemPrompt: cUserSettings.systemPrompt ?? promptFallback ?? "",
      useMMap: cUserSettings.useMMap ?? data?.useMMap,
      minP: cUserSettings.minP ?? data?.minP,
      repeatLastN: cUserSettings.repeatLastN ?? data?.repeatLastN,
      repeatPenalty: cUserSettings.repeatPenalty ?? data?.repeatPenalty,
      useMlock: cUserSettings.useMlock ?? data?.useMlock,
      tfsZ: cUserSettings.tfsZ ?? data?.tfsZ,
      numKeep: cUserSettings.numKeep ?? data?.numKeep,
      numThread: cUserSettings.numThread ?? data?.numThread,
      reasoningEffort: cUserSettings?.reasoningEffort,
      thinking: cUserSettings?.thinking,
      historyMessageLimit: cUserSettings.historyMessageLimit,
      historyMessageOrder: cUserSettings.historyMessageOrder,
      slashCommandInjectionMode: cUserSettings.slashCommandInjectionMode,
      apiProvider: cUserSettings.apiProvider,
      extraHeaders: cUserSettings.extraHeaders,
      extraBody: cUserSettings.extraBody,
      jsonMode: cUserSettings.jsonMode
    }),
    [cUserSettings]
  )

  const { isLoading } = useQuery({
    queryKey: ["fetchModelConfig2", open],
    queryFn: async () => {
      const data = await getAllModelSettings()

      const ocrLang = await getOCRLanguage()

      if (isOCREnabled) {
        cUserSettings.setOcrLanguage(ocrLang)
      }
      let tempSystemPrompt = ""

      if (selectedSystemPrompt) {
        const prompt = await getPromptById(selectedSystemPrompt)
        tempSystemPrompt = prompt?.content ?? ""
      }

      const baseValues = buildBaseValues(data, tempSystemPrompt)

      const actor =
        actorSettings ??
        (await getActorSettingsForChatWithCharacterFallback({
          historyId,
          serverChatId,
          characterId: selectedCharacter?.id ?? null
        }))
      setActorSettings(actor)

      const actorFields: Record<string, any> = {
        actorEnabled: actor.isEnabled,
        actorNotes: actor.notes,
        actorNotesGmOnly: actor.notesGmOnly ?? false,
        actorChatPosition: actor.chatPosition,
        actorChatDepth: actor.chatDepth,
        actorChatRole: actor.chatRole,
        actorTemplateMode: actor.templateMode ?? "merge"
      }
      for (const aspect of actor.aspects || []) {
        actorFields[`actor_${aspect.id}`] = aspect.value
        actorFields[`actor_key_${aspect.id}`] = aspect.key
      }

      form.setFieldsValue({
        ...baseValues,
        ...actorFields
      })

      const preview = buildActorPrompt(actor)
      setPreviewAndTokens(preview, estimateActorTokens(preview))
      return data
    },
    enabled: open,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })

  const { data: composerModels = [], isLoading: modelsLoading } = useQuery<
    ChatModel[]
  >({
    queryKey: ["playground:chatModels", open],
    queryFn: async () => {
      try {
        return await fetchChatModels({ returnEmpty: true })
      } catch (error) {
        console.error("Failed to fetch chat models:", error)
        throw error
      }
    },
    enabled: open,
    retry: 2
  })

  const modelOptions = useMemo(() => {
    type GroupOption = {
      label: React.ReactNode
      options: Array<{
        label: React.ReactNode
        value: string
        searchLabel: string
      }>
    }
    const models = composerModels
    if (!models.length) {
      if (selectedModel) {
        const displayText = `Custom - ${selectedModel}`
        const fallbackGroup: GroupOption = {
          label: <span className="truncate">Custom</span>,
          options: [
            {
              label: <span className="truncate">{displayText}</span>,
              value: selectedModel,
              searchLabel: displayText.toLowerCase()
            }
          ]
        }
        return [fallbackGroup]
      }
      return []
    }

    const groups = new Map<string, GroupOption>()

    for (const m of models) {
      const rawProvider = m.details?.provider ?? m.provider
      const providerKey = String(rawProvider || "other").toLowerCase()
      const providerLabel = getProviderDisplayName(rawProvider)
      const modelLabel = m.nickname || m.model
      const details = m.details
      const caps = Array.isArray(details?.capabilities)
        ? (details.capabilities ?? [])
        : []
      const hasVision = caps.includes("vision")
      const hasTools = caps.includes("tools")
      const hasFast = caps.includes("fast")
      const providerIconKey = rawProvider ?? "default"

      const optionDisplay = `${providerLabel} - ${modelLabel}`
      const optionLabel = (
        <div className="flex items-center gap-2" data-title={`${providerLabel} - ${modelLabel}`}>
          <ProviderIcons provider={providerIconKey} className="h-4 w-4" />
          <div className="flex flex-col min-w-0">
            <span className="truncate">{optionDisplay}</span>
            {(hasVision || hasTools || hasFast) && (
              <div className="mt-0.5 flex flex-wrap gap-1 text-[10px]">
                {hasVision && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">
                    Vision
                  </span>
                )}
                {hasTools && (
                  <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-accent">
                    Tools
                  </span>
                )}
                {hasFast && (
                  <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-success">
                    Fast
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )

      if (!groups.has(providerKey)) {
        groups.set(providerKey, {
          label: (
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-subtle">
              <ProviderIcons provider={providerIconKey} className="h-3 w-3" />
              <span>{providerLabel}</span>
            </div>
          ),
          options: []
        })
      }
      const group = groups.get(providerKey)!
      group.options.push({
        label: optionLabel,
        value: m.model,
        searchLabel: optionDisplay.toLowerCase()
      })
    }

    const groupedOptions: GroupOption[] = Array.from(groups.values())

    if (selectedModel) {
      const hasSelected = groupedOptions.some((group) =>
        group.options.some((option) => option.value === selectedModel)
      )

      if (!hasSelected) {
        const displayText = `Custom - ${selectedModel}`
        groupedOptions.push({
          label: <span className="truncate">Custom</span>,
          options: [
            {
              label: <span className="truncate">{displayText}</span>,
              value: selectedModel,
              searchLabel: displayText.toLowerCase()
            }
          ]
        })
      }
    }

    return groupedOptions
  }, [composerModels, selectedModel])

  const providerOptions = useMemo(() => {
    const models = composerModels
    const providers = new Map<string, string>()
    for (const model of models) {
      const rawProvider = model.details?.provider ?? model.provider
      if (!rawProvider) continue
      const key = String(rawProvider)
      if (!providers.has(key)) {
        providers.set(key, getProviderDisplayName(rawProvider))
      }
    }
    return Array.from(providers.entries()).map(([value, label]) => ({
      value,
      label
    }))
  }, [composerModels])

  const tabItems = useMemo(
    () => [
      {
        key: "model",
        label: t("modelSettings.tabs.model", "Model"),
        children: (
          <ModelBasicsTab
            form={form}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            modelOptions={modelOptions}
            modelsLoading={modelsLoading}
            isOCREnabled={isOCREnabled}
            ocrLanguage={cUserSettings.ocrLanguage}
            ocrLanguages={ocrLanguages}
            onOcrLanguageChange={(value) => cUserSettings.setOcrLanguage(value)}
          />
        )
      },
      {
        key: "conversation",
        label: t("modelSettings.tabs.conversation", "Conversation"),
        children: (
          <ConversationTab
            useDrawer={useDrawer}
            selectedSystemPrompt={selectedSystemPrompt}
            onSystemPromptChange={savePrompt}
            uploadedFiles={uploadedFiles}
            onRemoveFile={removeUploadedFile}
            fileRetrievalEnabled={fileRetrievalEnabled}
            onFileRetrievalChange={setFileRetrievalEnabled}
            serverChatId={serverChatId}
            serverChatState={serverChatState}
            onStateChange={(state) => setServerChatState(state)}
            serverChatTopic={serverChatTopic}
            onTopicChange={setServerChatTopic}
            onVersionChange={setServerChatVersion}
          />
        )
      },
      {
        key: "advanced",
        label: t("modelSettings.tabs.advanced", "Advanced"),
        children: (
          <AdvancedParamsTab
            form={form}
            providerOptions={providerOptions}
          />
        )
      },
      {
        key: "actor",
        label: t("modelSettings.tabs.actor", "Scene Director"),
        children: (
          <ActorTab
            form={form}
            actorSettings={actorSettings}
            setActorSettings={setActorSettings}
            actorPreview={actorPreview}
            actorTokenCount={actorTokenCount}
            onRecompute={recomputeActorPreview}
            newAspectTarget={newAspectTarget}
            setNewAspectTarget={setNewAspectTarget}
            newAspectName={newAspectName}
            setNewAspectName={setNewAspectName}
            actorPositionValue={actorPositionValue}
          />
        )
      }
    ],
    [
      t,
      form,
      selectedModel,
      setSelectedModel,
      modelOptions,
      modelsLoading,
      isOCREnabled,
      cUserSettings,
      useDrawer,
      selectedSystemPrompt,
      savePrompt,
      uploadedFiles,
      removeUploadedFile,
      fileRetrievalEnabled,
      setFileRetrievalEnabled,
      serverChatId,
      serverChatState,
      setServerChatState,
      serverChatTopic,
      setServerChatTopic,
      setServerChatVersion,
      providerOptions,
      actorSettings,
      setActorSettings,
      actorPreview,
      actorTokenCount,
      recomputeActorPreview,
      newAspectTarget,
      newAspectName,
      actorPositionValue
    ]
  )

  const renderBody = () => {
    return (
      <>
        {!isLoading ? (
          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => {
              saveSettings(values)
              setOpen(false)
            }}
            onValuesChange={(changedValues) => {
              const keys = Object.keys(changedValues || {})
              const shouldUpdate = keys.some(
                (k) =>
                  k === "actorEnabled" ||
                  k === "actorNotes" ||
                  k === "actorNotesGmOnly" ||
                  k === "actorChatPosition" ||
                  k === "actorChatDepth" ||
                  k === "actorChatRole" ||
                  k.startsWith("actor_")
              )
              if (shouldUpdate) {
                debouncedRecomputeActorPreview()
              }
            }}>
            <Tabs
              defaultActiveKey="model"
              destroyInactiveTabPane={false}
              items={tabItems}
              className="settings-tabs"
            />
            <div className="mt-4 border-t border-border pt-4">
              <SaveButton
                className="w-full text-center inline-flex items-center justify-center"
                btnType="submit"
              />
            </div>
          </Form>
        ) : (
          <Skeleton active />
        )}
      </>
    )
  }

  if (useDrawer) {
    return (
      <Drawer
        placement="right"
        open={open}
        onClose={() => setOpen(false)}
        width={500}
        title={t("currentChatModelSettings")}>
        {renderBody()}
      </Drawer>
    )
  }

  return (
    <Modal
      title={t("currentChatModelSettings")}
      open={open}
      onOk={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      footer={null}>
      {renderBody()}
    </Modal>
  )
}

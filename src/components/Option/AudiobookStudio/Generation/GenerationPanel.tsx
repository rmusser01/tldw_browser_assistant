import React from "react"
import {
  Card,
  Typography,
  Button,
  Space,
  Progress,
  Alert,
  Empty,
  Select
} from "antd"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { Play, Square, AlertCircle, Check, Loader2 } from "lucide-react"
import { useAudiobookStudioStore } from "@/store/audiobook-studio"
import { useAudiobookGeneration } from "@/hooks/useAudiobookGeneration"
import { getTTSSettings } from "@/services/tts"
import { getTtsProviderLabel } from "@/services/tts-providers"
import {
  useTtsProviderData,
  OPENAI_TTS_VOICES,
  OPENAI_TTS_MODELS
} from "@/hooks/useTtsProviderData"
import { inferTldwProviderFromModel } from "@/services/tts-provider"

const { Text, Title } = Typography

export const GenerationPanel: React.FC = () => {
  const { t } = useTranslation(["audiobook", "playground", "common"])

  const chapters = useAudiobookStudioStore((s) => s.chapters)
  const isGenerating = useAudiobookStudioStore((s) => s.isGenerating)
  const currentGeneratingId = useAudiobookStudioStore(
    (s) => s.currentGeneratingId
  )
  const defaultVoiceConfig = useAudiobookStudioStore((s) => s.defaultVoiceConfig)
  const setDefaultVoiceConfig = useAudiobookStudioStore(
    (s) => s.setDefaultVoiceConfig
  )

  const { generateAllChapters, cancelGeneration } = useAudiobookGeneration()

  const { data: ttsSettings } = useQuery({
    queryKey: ["fetchTTSSettings"],
    queryFn: getTTSSettings
  })

  const provider = defaultVoiceConfig.provider || ttsSettings?.ttsProvider || "browser"
  const isTldw = provider === "tldw"
  const inferredProviderKey = React.useMemo(() => {
    if (!isTldw) return null
    return inferTldwProviderFromModel(
      defaultVoiceConfig.tldwModel || ttsSettings?.tldwTtsModel
    )
  }, [isTldw, defaultVoiceConfig.tldwModel, ttsSettings?.tldwTtsModel])

  const {
    hasAudio,
    tldwTtsModels,
    tldwVoiceCatalog,
    elevenLabsData
  } = useTtsProviderData({
    provider,
    elevenLabsApiKey: ttsSettings?.elevenLabsApiKey,
    inferredProviderKey
  })

  const completedCount = chapters.filter((ch) => ch.status === "completed").length
  const errorCount = chapters.filter((ch) => ch.status === "error").length
  const pendingCount = chapters.filter(
    (ch) => ch.status === "pending" || ch.status === "error"
  ).length

  const currentIndex = chapters.findIndex((ch) => ch.id === currentGeneratingId)
  const progress =
    chapters.length > 0
      ? Math.round((completedCount / chapters.length) * 100)
      : 0

  const handleGenerateAll = async () => {
    await generateAllChapters({ chapters })
  }

  const providerLabel = getTtsProviderLabel(provider)
  const isBrowserTts = provider === "browser"

  const providerVoices = React.useMemo(() => {
    if (tldwVoiceCatalog && tldwVoiceCatalog.length > 0) {
      return tldwVoiceCatalog
    }
    return []
  }, [tldwVoiceCatalog])

  const openAiVoiceOptions = React.useMemo(() => {
    const model = defaultVoiceConfig.openAiModel || ttsSettings?.openAITTSModel
    if (!model) {
      const seen = new Set<string>()
      const all: { label: string; value: string }[] = []
      Object.values(OPENAI_TTS_VOICES).forEach((list) => {
        list.forEach((v) => {
          if (!seen.has(v.value)) {
            seen.add(v.value)
            all.push(v)
          }
        })
      })
      return all
    }
    return OPENAI_TTS_VOICES[model] || []
  }, [defaultVoiceConfig.openAiModel, ttsSettings?.openAITTSModel])

  if (chapters.length === 0) {
    return (
      <Card>
        <Empty
          description={
            <Text type="secondary">
              {t(
                "audiobook:generation.noChapters",
                "Add chapters first to generate audio."
              )}
            </Text>
          }
        />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {isBrowserTts && (
        <Alert
          type="warning"
          showIcon
          icon={<AlertCircle className="h-4 w-4" />}
          message={t(
            "audiobook:generation.browserWarningTitle",
            "Browser TTS cannot export audio"
          )}
          description={t(
            "audiobook:generation.browserWarningDesc",
            "The browser TTS provider streams audio directly and cannot be saved to files. Please switch to a different TTS provider (tldw, ElevenLabs, or OpenAI) in your settings to generate downloadable audiobook files."
          )}
        />
      )}

      <Card>
        <div className="space-y-4">
          <div>
            <Title level={5} className="!mb-1">
              {t("audiobook:generation.voiceSettings", "Voice Settings")}
            </Title>
            <Text type="secondary" className="text-sm">
              {t(
                "audiobook:generation.voiceSettingsDesc",
                "Configure the default voice for all chapters. Using provider: {{provider}}",
                { provider: providerLabel }
              )}
            </Text>
          </div>

          {isTldw && providerVoices.length > 0 && (
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs mb-1">
                  {t("audiobook:generation.model", "Model")}
                </label>
                {tldwTtsModels && tldwTtsModels.length > 0 ? (
                  <Select
                    style={{ minWidth: 180 }}
                    placeholder={t("audiobook:generation.selectModel", "Select model")}
                    showSearch
                    optionFilterProp="label"
                    options={tldwTtsModels.map((m) => ({
                      label: m.label,
                      value: m.id
                    }))}
                    value={defaultVoiceConfig.tldwModel || ttsSettings?.tldwTtsModel}
                    onChange={(val) =>
                      setDefaultVoiceConfig({ ...defaultVoiceConfig, tldwModel: val })
                    }
                  />
                ) : (
                  <Text type="secondary" className="text-xs">
                    {t("audiobook:generation.noModels", "No models available")}
                  </Text>
                )}
              </div>
              <div>
                <label className="block text-xs mb-1">
                  {t("audiobook:generation.voice", "Voice")}
                </label>
                <Select
                  style={{ minWidth: 200 }}
                  placeholder={t("audiobook:generation.selectVoice", "Select voice")}
                  options={providerVoices.map((v, idx) => ({
                    label: `${v.name || v.id || `Voice ${idx + 1}`}${
                      v.language ? ` (${v.language})` : ""
                    }`,
                    value: v.id || v.name || ""
                  }))}
                  value={defaultVoiceConfig.tldwVoice || ttsSettings?.tldwTtsVoice}
                  onChange={(val) =>
                    setDefaultVoiceConfig({ ...defaultVoiceConfig, tldwVoice: val })
                  }
                />
              </div>
            </div>
          )}

          {provider === "elevenlabs" && elevenLabsData && (
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs mb-1">
                  {t("audiobook:generation.model", "Model")}
                </label>
                <Select
                  style={{ minWidth: 180 }}
                  placeholder={t("audiobook:generation.selectModel", "Select model")}
                  options={elevenLabsData.models.map((m: any) => ({
                    label: m.name,
                    value: m.model_id
                  }))}
                  value={
                    defaultVoiceConfig.elevenLabsModel ||
                    ttsSettings?.elevenLabsModel
                  }
                  onChange={(val) =>
                    setDefaultVoiceConfig({
                      ...defaultVoiceConfig,
                      elevenLabsModel: val
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs mb-1">
                  {t("audiobook:generation.voice", "Voice")}
                </label>
                <Select
                  style={{ minWidth: 200 }}
                  placeholder={t("audiobook:generation.selectVoice", "Select voice")}
                  options={elevenLabsData.voices.map((v: any) => ({
                    label: v.name,
                    value: v.voice_id
                  }))}
                  value={
                    defaultVoiceConfig.elevenLabsVoiceId ||
                    ttsSettings?.elevenLabsVoiceId
                  }
                  onChange={(val) =>
                    setDefaultVoiceConfig({
                      ...defaultVoiceConfig,
                      elevenLabsVoiceId: val
                    })
                  }
                />
              </div>
            </div>
          )}

          {provider === "openai" && (
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs mb-1">
                  {t("audiobook:generation.model", "Model")}
                </label>
                <Select
                  style={{ minWidth: 150 }}
                  placeholder={t("audiobook:generation.selectModel", "Select model")}
                  options={OPENAI_TTS_MODELS}
                  value={
                    defaultVoiceConfig.openAiModel || ttsSettings?.openAITTSModel
                  }
                  onChange={(val) =>
                    setDefaultVoiceConfig({
                      ...defaultVoiceConfig,
                      openAiModel: val
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-xs mb-1">
                  {t("audiobook:generation.voice", "Voice")}
                </label>
                <Select
                  style={{ minWidth: 150 }}
                  placeholder={t("audiobook:generation.selectVoice", "Select voice")}
                  options={openAiVoiceOptions}
                  value={
                    defaultVoiceConfig.openAiVoice || ttsSettings?.openAITTSVoice
                  }
                  onChange={(val) =>
                    setDefaultVoiceConfig({
                      ...defaultVoiceConfig,
                      openAiVoice: val
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div>
            <Title level={5} className="!mb-1">
              {t("audiobook:generation.title", "Generate Audio")}
            </Title>
            <Text type="secondary" className="text-sm">
              {t(
                "audiobook:generation.description",
                "Generate audio for all pending chapters sequentially."
              )}
            </Text>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Text>
                {t("audiobook:generation.completed", "Completed:")}
              </Text>
              <Text strong className="text-green-600">
                {completedCount}/{chapters.length}
              </Text>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-2">
                <Text>{t("audiobook:generation.errors", "Errors:")}</Text>
                <Text strong className="text-red-500">
                  {errorCount}
                </Text>
              </div>
            )}
            {pendingCount > 0 && (
              <div className="flex items-center gap-2">
                <Text>{t("audiobook:generation.pending", "Pending:")}</Text>
                <Text strong>{pendingCount}</Text>
              </div>
            )}
          </div>

          <Progress
            percent={progress}
            status={isGenerating ? "active" : errorCount > 0 ? "exception" : "normal"}
            strokeColor={errorCount > 0 ? undefined : { from: "#108ee9", to: "#87d068" }}
          />

          {isGenerating && currentIndex >= 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <Text>
                {t(
                  "audiobook:generation.currentlyGenerating",
                  "Generating chapter {{current}} of {{total}}: {{title}}",
                  {
                    current: currentIndex + 1,
                    total: chapters.length,
                    title: chapters[currentIndex]?.title
                  }
                )}
              </Text>
            </div>
          )}

          <Space>
            {!isGenerating ? (
              <Button
                type="primary"
                icon={<Play className="h-4 w-4" />}
                onClick={handleGenerateAll}
                disabled={pendingCount === 0 || isBrowserTts}
              >
                {pendingCount === chapters.length
                  ? t("audiobook:generation.generateAll", "Generate all")
                  : t("audiobook:generation.generateRemaining", "Generate remaining ({{count}})", {
                      count: pendingCount
                    })}
              </Button>
            ) : (
              <Button
                danger
                icon={<Square className="h-4 w-4" />}
                onClick={cancelGeneration}
              >
                {t("audiobook:generation.cancel", "Cancel")}
              </Button>
            )}
          </Space>

          {completedCount === chapters.length && chapters.length > 0 && (
            <Alert
              type="success"
              showIcon
              icon={<Check className="h-4 w-4" />}
              message={t(
                "audiobook:generation.allComplete",
                "All chapters generated successfully!"
              )}
              description={t(
                "audiobook:generation.allCompleteDesc",
                "Go to the Output tab to download your audiobook files."
              )}
            />
          )}
        </div>
      </Card>
    </div>
  )
}

export default GenerationPanel

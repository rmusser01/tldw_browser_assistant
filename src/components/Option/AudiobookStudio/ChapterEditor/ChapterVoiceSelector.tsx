import React, { useMemo } from "react"
import { Select, Space, Typography, Spin } from "antd"
import { useTranslation } from "react-i18next"
import { Mic } from "lucide-react"
import { useStorage } from "@plasmohq/storage/hook"
import {
  useTtsProviderData,
  OPENAI_TTS_MODELS,
  OPENAI_TTS_VOICES
} from "@/hooks/useTtsProviderData"
import type { TtsProviderOverrides } from "@/services/tts-provider"

const { Text } = Typography

type ChapterVoiceSelectorProps = {
  voiceConfig: TtsProviderOverrides
  onChange: (config: TtsProviderOverrides) => void
  compact?: boolean
}

export const ChapterVoiceSelector: React.FC<ChapterVoiceSelectorProps> = ({
  voiceConfig,
  onChange,
  compact = true
}) => {
  const { t } = useTranslation(["audiobook", "playground"])
  const [elevenLabsApiKey] = useStorage<string | null>("elevenLabsApiKey", null)

  const provider = voiceConfig.provider || "tldw"
  const inferredProviderKey = voiceConfig.tldwProviderKey || null

  const {
    hasAudio,
    providersInfo,
    tldwTtsModels,
    tldwVoiceCatalog,
    elevenLabsData,
    elevenLabsLoading
  } = useTtsProviderData({
    provider,
    elevenLabsApiKey,
    inferredProviderKey
  })

  // Provider options
  const providerOptions = useMemo(() => {
    const options = [
      { value: "browser", label: t("playground:tts.provider.browser", "Browser") }
    ]
    if (hasAudio) {
      options.unshift({
        value: "tldw",
        label: t("playground:tts.provider.tldw", "Server TTS")
      })
    }
    if (elevenLabsApiKey) {
      options.push({
        value: "elevenlabs",
        label: t("playground:tts.provider.elevenlabs", "ElevenLabs")
      })
    }
    options.push({
      value: "openai",
      label: t("playground:tts.provider.openai", "OpenAI")
    })
    return options
  }, [hasAudio, elevenLabsApiKey, t])

  // Model options based on provider
  const modelOptions = useMemo(() => {
    if (provider === "openai") {
      return OPENAI_TTS_MODELS
    }
    if (provider === "tldw" && tldwTtsModels) {
      return tldwTtsModels.map((m) => ({
        value: m.model_id,
        label: m.name || m.model_id
      }))
    }
    if (provider === "elevenlabs" && elevenLabsData?.models) {
      return elevenLabsData.models.map((m) => ({
        value: m.model_id,
        label: m.name
      }))
    }
    return []
  }, [provider, tldwTtsModels, elevenLabsData])

  // Voice options based on provider
  const voiceOptions = useMemo(() => {
    if (provider === "openai") {
      const model = voiceConfig.modelId || "tts-1"
      return OPENAI_TTS_VOICES[model] || OPENAI_TTS_VOICES["tts-1"]
    }
    if (provider === "tldw" && tldwVoiceCatalog) {
      return tldwVoiceCatalog.map((v) => ({
        value: v.id,
        label: v.name
      }))
    }
    if (provider === "elevenlabs" && elevenLabsData?.voices) {
      return elevenLabsData.voices.map((v) => ({
        value: v.voice_id,
        label: v.name
      }))
    }
    return []
  }, [provider, voiceConfig.modelId, tldwVoiceCatalog, elevenLabsData])

  // TLDW provider key options
  const tldwProviderOptions = useMemo(() => {
    if (!providersInfo?.available) return []
    return providersInfo.available.map((p) => ({
      value: p.key,
      label: p.name
    }))
  }, [providersInfo])

  const handleProviderChange = (value: string) => {
    onChange({
      ...voiceConfig,
      provider: value,
      modelId: undefined,
      voiceId: undefined,
      tldwProviderKey: undefined
    })
  }

  const handleTldwProviderKeyChange = (value: string) => {
    onChange({
      ...voiceConfig,
      tldwProviderKey: value,
      modelId: undefined,
      voiceId: undefined
    })
  }

  const handleModelChange = (value: string) => {
    onChange({
      ...voiceConfig,
      modelId: value,
      voiceId: undefined
    })
  }

  const handleVoiceChange = (value: string) => {
    onChange({
      ...voiceConfig,
      voiceId: value
    })
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Mic className="h-4 w-4 text-text-muted" />
        <Select
          size="small"
          value={provider}
          onChange={handleProviderChange}
          options={providerOptions}
          style={{ minWidth: 100 }}
          dropdownStyle={{ minWidth: 120 }}
        />
        {provider === "tldw" && tldwProviderOptions.length > 0 && (
          <Select
            size="small"
            value={voiceConfig.tldwProviderKey}
            onChange={handleTldwProviderKeyChange}
            options={tldwProviderOptions}
            placeholder={t("audiobook:voice.selectProvider", "Provider")}
            style={{ minWidth: 100 }}
            allowClear
          />
        )}
        {modelOptions.length > 0 && (
          <Select
            size="small"
            value={voiceConfig.modelId}
            onChange={handleModelChange}
            options={modelOptions}
            placeholder={t("audiobook:voice.selectModel", "Model")}
            style={{ minWidth: 100 }}
            loading={elevenLabsLoading}
            allowClear
          />
        )}
        {voiceOptions.length > 0 && (
          <Select
            size="small"
            value={voiceConfig.voiceId}
            onChange={handleVoiceChange}
            options={voiceOptions}
            placeholder={t("audiobook:voice.selectVoice", "Voice")}
            style={{ minWidth: 120 }}
            showSearch
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
            }
            allowClear
          />
        )}
      </div>
    )
  }

  return (
    <Space direction="vertical" className="w-full" size="small">
      <div>
        <Text type="secondary" className="text-xs block mb-1">
          {t("audiobook:voice.providerLabel", "Provider")}
        </Text>
        <Select
          value={provider}
          onChange={handleProviderChange}
          options={providerOptions}
          className="w-full"
        />
      </div>

      {provider === "tldw" && tldwProviderOptions.length > 0 && (
        <div>
          <Text type="secondary" className="text-xs block mb-1">
            {t("audiobook:voice.tldwProviderLabel", "TTS Backend")}
          </Text>
          <Select
            value={voiceConfig.tldwProviderKey}
            onChange={handleTldwProviderKeyChange}
            options={tldwProviderOptions}
            placeholder={t("audiobook:voice.selectProvider", "Select provider...")}
            className="w-full"
            allowClear
          />
        </div>
      )}

      {modelOptions.length > 0 && (
        <div>
          <Text type="secondary" className="text-xs block mb-1">
            {t("audiobook:voice.modelLabel", "Model")}
          </Text>
          <Select
            value={voiceConfig.modelId}
            onChange={handleModelChange}
            options={modelOptions}
            placeholder={t("audiobook:voice.selectModel", "Select model...")}
            className="w-full"
            loading={elevenLabsLoading}
            allowClear
          />
        </div>
      )}

      {voiceOptions.length > 0 && (
        <div>
          <Text type="secondary" className="text-xs block mb-1">
            {t("audiobook:voice.voiceLabel", "Voice")}
          </Text>
          <Select
            value={voiceConfig.voiceId}
            onChange={handleVoiceChange}
            options={voiceOptions}
            placeholder={t("audiobook:voice.selectVoice", "Select voice...")}
            className="w-full"
            showSearch
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
            }
            allowClear
          />
        </div>
      )}
    </Space>
  )
}

export default ChapterVoiceSelector

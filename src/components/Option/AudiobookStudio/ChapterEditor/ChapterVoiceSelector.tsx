import React, { useMemo } from "react"
import { Select, Space, Typography } from "antd"
import { useTranslation } from "react-i18next"
import { Mic } from "lucide-react"
import { useStorage } from "@plasmohq/storage/hook"
import {
  useTtsProviderData,
  OPENAI_TTS_MODELS,
  OPENAI_TTS_VOICES
} from "@/hooks/useTtsProviderData"
import {
  inferTldwProviderFromModel,
  type TtsProviderOverrides
} from "@/services/tts-provider"

const { Text } = Typography

type ChapterVoiceSelectorProps = {
  voiceConfig: TtsProviderOverrides & { speed?: number }
  onChange: (config: TtsProviderOverrides & { speed?: number }) => void
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
  // Infer tldw provider key from the selected model
  const inferredProviderKey = inferTldwProviderFromModel(voiceConfig.tldwModel)

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
        value: m.id,
        label: m.label || m.id
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
      const model = voiceConfig.openAiModel || "tts-1"
      return OPENAI_TTS_VOICES[model] || OPENAI_TTS_VOICES["tts-1"]
    }
    if (provider === "tldw" && tldwVoiceCatalog) {
      return tldwVoiceCatalog.map((v) => ({
        value: v.id || v.name,
        label: v.name || v.id
      }))
    }
    if (provider === "elevenlabs" && elevenLabsData?.voices) {
      return elevenLabsData.voices.map((v) => ({
        value: v.voice_id,
        label: v.name
      }))
    }
    return []
  }, [provider, voiceConfig.openAiModel, tldwVoiceCatalog, elevenLabsData])

  // TLDW provider key options (from providers object)
  const tldwProviderOptions = useMemo(() => {
    if (!providersInfo?.providers) return []
    return Object.entries(providersInfo.providers).map(([key, info]) => ({
      value: key,
      label: info.provider_name || key
    }))
  }, [providersInfo])

  const handleProviderChange = (value: string) => {
    // Clear all provider-specific settings when switching
    onChange({
      provider: value,
      speed: voiceConfig.speed
    })
  }

  const handleModelChange = (value: string) => {
    if (provider === "openai") {
      onChange({
        ...voiceConfig,
        openAiModel: value,
        openAiVoice: undefined
      })
    } else if (provider === "elevenlabs") {
      onChange({
        ...voiceConfig,
        elevenLabsModel: value,
        elevenLabsVoiceId: undefined
      })
    } else {
      // tldw
      onChange({
        ...voiceConfig,
        tldwModel: value,
        tldwVoice: undefined
      })
    }
  }

  const handleVoiceChange = (value: string) => {
    if (provider === "openai") {
      onChange({
        ...voiceConfig,
        openAiVoice: value
      })
    } else if (provider === "elevenlabs") {
      onChange({
        ...voiceConfig,
        elevenLabsVoiceId: value
      })
    } else {
      // tldw
      onChange({
        ...voiceConfig,
        tldwVoice: value
      })
    }
  }

  // Get current model value based on provider
  const getCurrentModel = () => {
    if (provider === "openai") return voiceConfig.openAiModel
    if (provider === "elevenlabs") return voiceConfig.elevenLabsModel
    return voiceConfig.tldwModel
  }

  // Get current voice value based on provider
  const getCurrentVoice = () => {
    if (provider === "openai") return voiceConfig.openAiVoice
    if (provider === "elevenlabs") return voiceConfig.elevenLabsVoiceId
    return voiceConfig.tldwVoice
  }

  const currentModel = getCurrentModel()
  const currentVoice = getCurrentVoice()

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
        {modelOptions.length > 0 && (
          <Select
            size="small"
            value={currentModel}
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
            value={currentVoice}
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

      {modelOptions.length > 0 && (
        <div>
          <Text type="secondary" className="text-xs block mb-1">
            {t("audiobook:voice.modelLabel", "Model")}
          </Text>
          <Select
            value={currentModel}
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
            value={currentVoice}
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

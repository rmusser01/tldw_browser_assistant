import React from "react"
import {
  Button,
  Card,
  Divider,
  Popover,
  Space,
  Tag,
  Tooltip,
  Typography
} from "antd"
import { useTranslation } from "react-i18next"
import { TTSModeSettings } from "@/components/Option/Settings/TTSModeSettings"
import type { getTTSSettings } from "@/services/tts"
import type {
  TldwTtsProviderCapabilities,
  TldwTtsProvidersInfo,
  TldwTtsVoiceInfo
} from "@/services/tldw/audio-providers"

type TtsSettings = Awaited<ReturnType<typeof getTTSSettings>>

type ProviderCaps = { key: string; caps: TldwTtsProviderCapabilities } | null

type Props = {
  providerLabel: string
  provider: string
  ttsSettings?: TtsSettings | null
  isTldw: boolean
  hasAudio: boolean
  activeProviderCaps: ProviderCaps
  activeVoices: TldwTtsVoiceInfo[]
  providersInfo?: TldwTtsProvidersInfo | null
  withCard?: boolean
}

const { Paragraph, Text } = Typography

export const TtsProviderPanel: React.FC<Props> = ({
  providerLabel,
  provider,
  ttsSettings,
  isTldw,
  hasAudio,
  activeProviderCaps,
  activeVoices,
  providersInfo,
  withCard = true
}) => {
  const { t } = useTranslation("playground")

  const handleFocusProviderSelect = () => {
    const el = document.getElementById("tts-provider-select")
    if (el) {
      ;(el as HTMLElement).focus()
      ;(el as HTMLElement).click()
    }
  }

  const content = (
    <Space direction="vertical" className="w-full" size="middle">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="space-y-1">
            <Text strong>
              {t("playground:tts.currentProvider", "Current provider")}:{" "}
              {providerLabel}
            </Text>
            <div>
              <Tooltip
                title={t(
                  "playground:tts.providerChangeHelper",
                  "Open the provider selector below to switch between Browser, tldw, OpenAI, or Supersonic."
                ) as string}
              >
                <Button size="small" type="link" onClick={handleFocusProviderSelect}>
                  {t("playground:tts.changeProvider", "Change provider")}
                </Button>
              </Tooltip>
            </div>
            {isTldw && ttsSettings && (
              <div className="text-xs text-text-subtle space-y-0.5">
                <div>
                  <Text strong>Model:</Text>{" "}
                  <Text code>{ttsSettings.tldwTtsModel || "kokoro"}</Text>
                </div>
                <div>
                  <Text strong>Voice:</Text>{" "}
                  <Text code>{ttsSettings.tldwTtsVoice || "af_heart"}</Text>
                </div>
                <div>
                  <Text strong>Response format:</Text>{" "}
                  <Text code>{ttsSettings.tldwTtsResponseFormat || "mp3"}</Text>
                </div>
                <div>
                  <Text strong>Speed:</Text>{" "}
                  <Text code>
                    {ttsSettings.tldwTtsSpeed != null ? ttsSettings.tldwTtsSpeed : 1}
                  </Text>
                </div>
                {activeProviderCaps && (
                  <div className="pt-1 flex flex-wrap items-center gap-1">
                    <Text className="mr-1">
                      {t(
                        "playground:tts.providerCapabilities",
                        "Provider capabilities"
                      )}
                      :
                    </Text>
                    {activeProviderCaps.caps.supports_streaming && (
                      <Tag color="blue" bordered>
                        Streaming
                      </Tag>
                    )}
                    {activeProviderCaps.caps.supports_voice_cloning && (
                      <Tag color="magenta" bordered>
                        Voice cloning
                      </Tag>
                    )}
                    {activeProviderCaps.caps.supports_ssml && (
                      <Tag color="gold" bordered>
                        SSML
                      </Tag>
                    )}
                    {activeProviderCaps.caps.supports_speech_rate && (
                      <Tag color="green" bordered>
                        Speed control
                      </Tag>
                    )}
                    {activeProviderCaps.caps.supports_emotion_control && (
                      <Tag color="purple" bordered>
                        Emotion/style
                      </Tag>
                    )}
                  </div>
                )}
                {activeVoices.length > 0 && (
                  <div className="pt-1 text-[11px]">
                    <Text strong>
                      {t("playground:tts.voicesPreview", "Server voices")}:
                    </Text>{" "}
                    {activeVoices.map((v, idx) => (
                      <span key={v.id || v.name || idx}>
                        <Text code>{v.name || v.id}</Text>
                        {v.language && (
                          <span className="ml-0.5 text-text-subtle">
                            ({v.language})
                          </span>
                        )}
                        {idx < activeVoices.length - 1 && <span>, </span>}
                      </span>
                    ))}
                    {providersInfo &&
                      activeProviderCaps &&
                      Array.isArray(providersInfo.voices?.[activeProviderCaps.key]) &&
                      providersInfo.voices[activeProviderCaps.key].length >
                        activeVoices.length && (
                        <span className="ml-1 text-text-subtle">…</span>
                      )}
                  </div>
                )}
                {activeProviderCaps && (
                  <div className="pt-1">
                    <Popover
                      placement="right"
                      content={
                        <pre className="max-w-xs max-h-64 overflow-auto text-[11px] leading-snug">
                          {JSON.stringify(activeProviderCaps.caps, null, 2)}
                        </pre>
                      }
                      title={t(
                        "playground:tts.providerDetailsTitle",
                        "Provider details"
                      )}
                    >
                      <Button size="small" type="link">
                        {t(
                          "playground:tts.providerDetails",
                          "View raw provider config"
                        )}
                      </Button>
                    </Popover>
                  </div>
                )}
              </div>
            )}
          </div>
          {isTldw && (
            <Text type="secondary" className="text-xs">
              {hasAudio
                ? t(
                    "playground:tts.tldwStatusOnline",
                    "tldw server audio API detected (audio/speech)"
                  )
                : t(
                    "playground:tts.tldwStatusOffline",
                    "Audio API not detected; check your tldw server version."
                  )}
            </Text>
          )}
        </div>

        <Divider className="!my-2" />

        <div>
          <Paragraph className="!mb-1">
            {t(
              "playground:tts.settingsIntro",
              "Adjust your TTS provider, model, and voice. These settings are reused when you play audio from chat or media."
            )}
          </Paragraph>
          {provider === "browser" && (
            <Text type="secondary" className="text-xs block">
              {t(
                "playground:tts.browserInfoDescription",
                "Browser TTS plays using your system synthesizer and does not expose an audio file. Use another provider to choose voices and see segments."
              )}
            </Text>
          )}
          <TTSModeSettings hideBorder />
        </div>
      </Space>
  )

  if (!withCard) {
    return content
  }

  return <Card>{content}</Card>
}

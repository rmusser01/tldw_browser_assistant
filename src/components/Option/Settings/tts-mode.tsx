import { SaveButton } from "@/components/Common/SaveButton"
import { getModels, getVoices } from "@/services/elevenlabs"
import { getTTSSettings, setTTSSettings } from "@/services/tts"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchTldwVoices, type TldwVoice } from "@/services/tldw/audio-voices"
import {
  fetchTldwTtsModels,
  type TldwTtsModel
} from "@/services/tldw/audio-models"
import { useWebUI } from "@/store/webui"
import { useForm } from "@mantine/form"
import { Alert, Button, Input, InputNumber, Select, Skeleton, Switch, Space } from "antd"
import { useTranslation } from "react-i18next"
import React, { useState } from "react"
import { useAntdMessage } from "@/hooks/useAntdMessage"

export const TTSModeSettings = ({ hideBorder }: { hideBorder?: boolean }) => {
  const { t } = useTranslation("settings")
  const message = useAntdMessage()
  const { setTTSEnabled } = useWebUI()
  const queryClient = useQueryClient()

  // API key test states
  const [elevenLabsTestResult, setElevenLabsTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testingElevenLabs, setTestingElevenLabs] = useState(false)

  const ids = {
    ttsEnabled: "tts-enabled-toggle",
    ttsAutoPlay: "tts-auto-play-toggle",
    ttsProvider: "tts-provider-select",
    browserVoice: "browser-voice-select",
    elevenVoice: "elevenlabs-voice-select",
    elevenModel: "elevenlabs-model-select",
    tldwModel: "tldw-model-select",
    tldwVoice: "tldw-voice-select",
    tldwResponseFormat: "tldw-response-format",
    tldwSpeed: "tldw-speed-input",
    ssmlEnabled: "tts-ssml-toggle",
    removeReasoning: "tts-remove-reasoning-toggle",
    playbackSpeed: "tts-playback-speed-input",
    openAiModel: "openai-model-select",
    openAiVoice: "openai-voice-select"
  }

  const form = useForm({
    initialValues: {
      ttsEnabled: false,
      ttsProvider: "",
      voice: "",
      ssmlEnabled: false,
      removeReasoningTagTTS: true,
      elevenLabsApiKey: "",
      elevenLabsVoiceId: "",
      elevenLabsModel: "",
      responseSplitting: "",
      openAITTSBaseUrl: "",
      openAITTSApiKey: "",
      openAITTSModel: "",
      openAITTSVoice: "",
      ttsAutoPlay: false,
      playbackSpeed: 1,
      tldwTtsModel: "",
      tldwTtsVoice: "",
      tldwTtsResponseFormat: "mp3",
      tldwTtsSpeed: 1
    },
    validate: {
      playbackSpeed: (value) =>
        value === null || value === undefined
          ? (t(
              "generalSettings.tts.playbackSpeed.required",
              "Playback speed is required"
            ) as string)
          : null
    }
  })

  const { status, data } = useQuery({
    queryKey: ["fetchTTSSettings"],
    queryFn: async () => {
      const data = await getTTSSettings()
      form.setValues(data)
      return data
    }
  })

  const { data: elevenLabsData, error: elevenLabsError } = useQuery({
    queryKey: ["fetchElevenLabsData", form.values.elevenLabsApiKey],
    queryFn: async () => {
      const [voices, models] = await Promise.all([
        getVoices(form.values.elevenLabsApiKey),
        getModels(form.values.elevenLabsApiKey)
      ])
      return { voices, models }
    },
    enabled:
      form.values.ttsProvider === "elevenlabs" && !!form.values.elevenLabsApiKey
  })

  const { data: tldwVoices } = useQuery({
    queryKey: ["fetchTldwVoices"],
    queryFn: fetchTldwVoices,
    enabled: form.values.ttsProvider === "tldw"
  })

  const { data: tldwModels } = useQuery<TldwTtsModel[]>({
    queryKey: ["fetchTldwTtsModels"],
    queryFn: fetchTldwTtsModels,
    enabled: form.values.ttsProvider === "tldw"
  })

  // Save mutation with loading state
  const { mutate: saveTTSMutation, isPending: isSaving } = useMutation({
    mutationFn: async (values: typeof form.values) => {
      await setTTSSettings(values)
      setTTSEnabled(values.ttsEnabled)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fetchTTSSettings"] })
    },
    onError: (error: unknown) => {
      // Surface a user-visible error and log for diagnostics
      // eslint-disable-next-line no-console
      console.error("Failed to save TTS settings:", error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : (t(
              "generalSettings.tts.saveError",
              "Failed to save TTS settings. Please try again."
            ) as string)
      message.error(
        errorMessage
      )
    }
  })

  // Test ElevenLabs API key
  const testElevenLabsApiKey = async () => {
    if (!form.values.elevenLabsApiKey) {
      setElevenLabsTestResult({ ok: false, message: t("generalSettings.tts.apiKeyTest.enterKey", "Please enter an API key first") })
      return
    }
    setTestingElevenLabs(true)
    setElevenLabsTestResult(null)
    try {
      const [voices, models] = await Promise.all([
        getVoices(form.values.elevenLabsApiKey),
        getModels(form.values.elevenLabsApiKey)
      ])
      const hasVoices = Array.isArray(voices) && voices.length > 0
      const hasModels = Array.isArray(models) && models.length > 0

      if (hasVoices && hasModels) {
        const successMessage = t(
          "generalSettings.tts.apiKeyTest.success",
          "API key valid! Found {{voiceCount}} voices and {{modelCount}} models.",
          { voiceCount: voices.length, modelCount: models.length }
        )
        message.success(successMessage as string)
        setElevenLabsTestResult({
          ok: true,
          message: successMessage as string
        })
      } else {
        const noResourcesMessage = t(
          "generalSettings.tts.apiKeyTest.noVoices",
          "API key accepted but no voices or models found"
        )
        setElevenLabsTestResult({
          ok: false,
          message: noResourcesMessage as string
        })
      }
    } catch (e: unknown) {
      // eslint-disable-next-line no-console
      console.error("Failed to test ElevenLabs API key:", e)
      const baseMessage = t(
        "generalSettings.tts.apiKeyTest.failed",
        "Invalid API key or connection error"
      ) as string
      const errorDetail =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : JSON.stringify(e)
      const failureMessage = `${baseMessage} (${errorDetail})`
      message.error(failureMessage)
      setElevenLabsTestResult({
        ok: false,
        message: failureMessage
      })
    } finally {
      setTestingElevenLabs(false)
    }
  }

  if (status === "pending" || status === "error") {
    return <Skeleton active />
  }

  return (
    <div>
      <div className="mb-5">
        <h2
          className={`${
            !hideBorder ? "text-base font-semibold leading-7" : "text-md"
          } text-gray-900 dark:text-white`}>
          {t("generalSettings.tts.heading")}
        </h2>
        {!hideBorder && (
          <div className="border border-b border-gray-200 dark:border-gray-600 mt-3"></div>
        )}
      </div>
      <form
        onSubmit={form.onSubmit((values) => {
          saveTTSMutation(values)
        })}
        className="space-y-4">
        <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
          <label
            className="text-gray-700 dark:text-neutral-50 "
            htmlFor={ids.ttsEnabled}>
            {t("generalSettings.tts.ttsEnabled.label")}
          </label>
          <div>
            <Switch
              id={ids.ttsEnabled}
              aria-label={t("generalSettings.tts.ttsEnabled.label") as string}
              className="mt-4 sm:mt-0 focus-ring"
              {...form.getInputProps("ttsEnabled", {
                type: "checkbox"
              })}
            />
          </div>
        </div>
        <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
          <label
            className="text-gray-700 dark:text-neutral-50 "
            htmlFor={ids.ttsAutoPlay}>
            {t("generalSettings.tts.ttsAutoPlay.label")}
          </label>
          <div>
            <Switch
              id={ids.ttsAutoPlay}
              aria-label={t("generalSettings.tts.ttsAutoPlay.label") as string}
              className="mt-4 sm:mt-0 focus-ring"
              {...form.getInputProps("ttsAutoPlay", {
                type: "checkbox"
              })}
            />
          </div>
        </div>
        <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
          <label
            className="text-gray-700 dark:text-neutral-50 "
            htmlFor={ids.ttsProvider}>
            {t("generalSettings.tts.ttsProvider.label")}
          </label>
          <div>
            <Select
              id={ids.ttsProvider}
              aria-label={t("generalSettings.tts.ttsProvider.label") as string}
              placeholder={t("generalSettings.tts.ttsProvider.placeholder")}
              className="w-full mt-4 sm:mt-0 sm:w-[200px] focus-ring"
              options={[
                { label: "Browser TTS", value: "browser" },
                {
                  label: "ElevenLabs",
                  value: "elevenlabs"
                },
                {
                  label: "OpenAI TTS",
                  value: "openai"
                },
                {
                  label: "tldw server (audio/speech)",
                  value: "tldw"
                }
              ]}
              {...form.getInputProps("ttsProvider")}
            />
          </div>
        </div>
        {form.values.ttsProvider === "browser" && (
          <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
            <span className="text-gray-700 dark:text-neutral-50 ">
              {t("generalSettings.tts.ttsVoice.label")}
            </span>
            <div>
              <Select
                id={ids.browserVoice}
                aria-label={t("generalSettings.tts.ttsVoice.label") as string}
                placeholder={t("generalSettings.tts.ttsVoice.placeholder")}
                className="w-full mt-4 sm:mt-0 sm:w-[200px] focus-ring"
                options={data?.browserTTSVoices?.map((voice) => ({
                  label: `${voice.voiceName} - ${voice.lang}`.trim(),
                  value: voice.voiceName
                }))}
                {...form.getInputProps("voice")}
              />
            </div>
          </div>
        )}
        {form.values.ttsProvider === "elevenlabs" && (
          <>
            <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
              <span className="text-gray-700 dark:text-neutral-50">
                {t("generalSettings.tts.elevenLabs.apiKey", "API Key")}
              </span>
              <Space.Compact className="mt-4 sm:mt-0">
                <Input.Password
                  placeholder="sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="!w-[220px]"
                  required
                  {...form.getInputProps("elevenLabsApiKey")}
                  onFocus={() => setElevenLabsTestResult(null)}
                />
                <Button
                  type="default"
                  aria-label={t("generalSettings.tts.apiKeyTest.test", "Test")}
                  onClick={testElevenLabsApiKey}
                  loading={testingElevenLabs}
                >
                  {t("generalSettings.tts.apiKeyTest.test", "Test")}
                </Button>
              </Space.Compact>
            </div>
            {elevenLabsTestResult && (
              <Alert
                type={elevenLabsTestResult.ok ? "success" : "error"}
                message={elevenLabsTestResult.message}
                showIcon
                closable
                onClose={() => setElevenLabsTestResult(null)}
                className="mt-2"
              />
            )}

            {elevenLabsError && (
              <Alert
                type="error"
                message={t("generalSettings.tts.elevenLabs.fetchError", "Failed to fetch voices and models")}
                description={t("generalSettings.tts.elevenLabs.fetchErrorHelp", "Check your API key and internet connection, then try again.")}
                showIcon
                className="mt-2"
              />
            )}

            {elevenLabsData && (
              <>
                <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
                  <span className="text-gray-700 dark:text-neutral-50">
                    {t("generalSettings.tts.elevenLabs.voice", "TTS Voice")}
                  </span>
                  <Select
                    id={ids.elevenVoice}
                    aria-label="ElevenLabs voice"
                    options={elevenLabsData.voices.map((v) => ({
                      label: v.name,
                      value: v.voice_id
                    }))}
                    className="w-full mt-4 sm:mt-0 sm:w-[200px] focus-ring"
                    placeholder="Select a voice"
                    {...form.getInputProps("elevenLabsVoiceId")}
                  />
                </div>

                <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
                  <span className="text-gray-700 dark:text-neutral-50">
                    {t("generalSettings.tts.elevenLabs.model", "TTS Model")}
                  </span>
                  <Select
                    id={ids.elevenModel}
                    aria-label="ElevenLabs model"
                    className="w-full mt-4 sm:mt-0 sm:w-[200px] focus-ring"
                    placeholder="Select a model"
                    options={elevenLabsData.models.map((m) => ({
                      label: m.name,
                      value: m.model_id
                    }))}
                    {...form.getInputProps("elevenLabsModel")}
                  />
                </div>
                <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
                  <span className="text-gray-700 dark:text-neutral-50 ">
                    {t("generalSettings.tts.responseSplitting.label")}
                  </span>
                  <div>
                    <Select
                      placeholder={t(
                        "generalSettings.tts.responseSplitting.placeholder"
                      )}
                      className="w-full mt-4 sm:mt-0 sm:w-[200px]"
                      options={[
                        { label: "None", value: "none" },
                        { label: "Punctuation", value: "punctuation" },
                        { label: "Paragraph", value: "paragraph" }
                      ]}
                      {...form.getInputProps("responseSplitting")}
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}
        {form.values.ttsProvider === "openai" && (
          <>
            <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
              <span className="text-gray-700 dark:text-neutral-50">
                Base URL
              </span>
              <Input
                placeholder="http://localhost:5000/v1"
                className=" mt-4 sm:mt-0 !w-[300px] sm:w-[200px]"
                required
                {...form.getInputProps("openAITTSBaseUrl")}
              />
            </div>

            <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
              <span className="text-gray-700 dark:text-neutral-50">
                API Key
              </span>
              <Input.Password
                placeholder="sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className=" mt-4 sm:mt-0 !w-[300px] sm:w-[200px]"
                {...form.getInputProps("openAITTSApiKey")}
              />
            </div>

            <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
              <span className="text-gray-700 dark:text-neutral-50">
                TTS Voice
              </span>
              <Select
                id={ids.openAiVoice}
                aria-label="OpenAI TTS voice"
                className=" mt-4 sm:mt-0 !w-[300px] sm:w-[200px] focus-ring"
                placeholder="Select a voice"
                options={[
                  { label: "alloy", value: "alloy" },
                  { label: "echo", value: "echo" },
                  { label: "fable", value: "fable" },
                  { label: "onyx", value: "onyx" },
                  { label: "nova", value: "nova" },
                  { label: "shimmer", value: "shimmer" }
                ]}
                {...form.getInputProps("openAITTSVoice")}
              />
            </div>

            <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
              <span className="text-gray-700 dark:text-neutral-50">
                TTS Model
              </span>
              <Select
                id={ids.openAiModel}
                aria-label="OpenAI TTS model"
                className=" mt-4 sm:mt-0 !w-[300px] sm:w-[200px] focus-ring"
                placeholder="Select a model"
                options={[
                  { label: "tts-1", value: "tts-1" },
                  { label: "tts-1-hd", value: "tts-1-hd" }
                ]}
                {...form.getInputProps("openAITTSModel")}
              />
            </div>
          </>
        )}
        {form.values.ttsProvider === "tldw" && (
          <>
            <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
              <span className="text-gray-700 dark:text-neutral-50">
                TTS Model
              </span>
              {tldwModels && tldwModels.length > 0 ? (
                <Select
                  id={ids.tldwModel}
                  aria-label="tldw TTS model"
                  className=" mt-4 sm:mt-0 !w-[300px] sm:w-[200px] focus-ring"
                  placeholder="Select a model"
                  options={tldwModels.map((m: TldwTtsModel) => ({
                    label: m.label,
                    value: m.id
                  }))}
                  {...form.getInputProps("tldwTtsModel")}
                />
              ) : (
                <Input
                  placeholder="kokoro"
                  className=" mt-4 sm:mt-0 !w-[300px] sm:w-[200px]"
                  {...form.getInputProps("tldwTtsModel")}
                />
              )}
            </div>
            <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
              <span className="text-gray-700 dark:text-neutral-50">
                TTS Voice
              </span>
              {tldwVoices && tldwVoices.length > 0 ? (
                <Select
                  id={ids.tldwVoice}
                  aria-label="tldw TTS voice"
                  className="w-full mt-4 sm:mt-0 sm:w-[200px] focus-ring"
                  placeholder="Select a voice"
                  options={tldwVoices.map((v: TldwVoice) => ({
                    label: v.name || v.voice_id || v.id || "Voice",
                    value: v.voice_id || v.id || v.name || ""
                  }))}
                  {...form.getInputProps("tldwTtsVoice")}
                />
              ) : (
                <Input
                  placeholder="af_heart"
                  className=" mt-4 sm:mt-0 !w-[300px] sm:w-[200px]"
                  {...form.getInputProps("tldwTtsVoice")}
                />
              )}
          </div>
            <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
              <span className="text-gray-700 dark:text-neutral-50">
                Response format
              </span>
              <Select
                id={ids.tldwResponseFormat}
                aria-label="tldw response format"
                className="w-full mt-4 sm:mt-0 sm:w-[200px] focus-ring"
                options={[
                  { label: "mp3", value: "mp3" },
                  { label: "opus", value: "opus" },
                  { label: "flac", value: "flac" },
                  { label: "wav", value: "wav" },
                  { label: "pcm", value: "pcm" }
                ]}
                {...form.getInputProps("tldwTtsResponseFormat")}
              />
            </div>
            <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
              <span className="text-gray-700 dark:text-neutral-50">
                Synthesis speed
              </span>
              <InputNumber
                id={ids.tldwSpeed}
                aria-label="tldw synthesis speed"
                placeholder="1"
                min={0.25}
                max={4}
                step={0.05}
                className=" mt-4 sm:mt-0 !w-[300px] sm:w-[200px]"
                {...form.getInputProps("tldwTtsSpeed")}
              />
            </div>
          </>
        )}
        <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
          <label
            className="text-gray-700 dark:text-neutral-50 "
            htmlFor={ids.ssmlEnabled}>
            {t("generalSettings.tts.ssmlEnabled.label")}
          </label>
          <div>
            <Switch
              id={ids.ssmlEnabled}
              aria-label={t("generalSettings.tts.ssmlEnabled.label") as string}
              className="mt-4 sm:mt-0 focus-ring"
              {...form.getInputProps("ssmlEnabled", {
                type: "checkbox"
              })}
            />
          </div>
        </div>

        <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
          <label
            className="text-gray-700 dark:text-neutral-50 "
            htmlFor={ids.removeReasoning}>
            {t("generalSettings.tts.removeReasoningTagTTS.label")}
          </label>
          <div>
            <Switch
              id={ids.removeReasoning}
              aria-label={
                t("generalSettings.tts.removeReasoningTagTTS.label") as string
              }
              className="mt-4 sm:mt-0 focus-ring"
              {...form.getInputProps("removeReasoningTagTTS", {
                type: "checkbox"
              })}
            />
          </div>
        </div>

        <div className="flex sm:flex-row flex-col space-y-4 sm:space-y-0 sm:justify-between">
          <label
            className="text-gray-700 dark:text-neutral-50"
            htmlFor={ids.playbackSpeed}>
            {t("generalSettings.tts.playbackSpeed.label", "Playback Speed")}
          </label>
          <div className="flex flex-col gap-1">
            <InputNumber
              id={ids.playbackSpeed}
              aria-label="Playback speed"
              placeholder="1"
              min={0.25}
              max={2}
              step={0.05}
              className=" mt-4 sm:mt-0 !w-[300px] sm:w-[200px]"
              {...form.getInputProps("playbackSpeed")}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 sm:text-right">
              {t("generalSettings.tts.playbackSpeed.range", "0.25-2x")}
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <SaveButton
            btnType="submit"
            disabled={!form.isDirty()}
            loading={isSaving}
            className="disabled:cursor-not-allowed"
            text={form.isDirty() ? "save" : "saved"}
            textOnSave="saved"
          />
        </div>
      </form>
    </div>
  )
}

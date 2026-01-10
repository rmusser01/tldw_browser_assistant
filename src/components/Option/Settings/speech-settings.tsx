import { useTranslation } from "react-i18next"
import { SSTSettings } from "./sst-settings"
import { TTSModeSettings } from "./tts-mode"

export const SpeechSettings = () => {
  const { t } = useTranslation("settings")

  return (
    <div className="flex flex-col space-y-6 text-sm">
      <div>
        <h2 className="text-base font-semibold leading-7 text-text">
          {t("speechSettings.title", "Speech settings")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t(
            "speechSettings.subtitle",
            "Manage Speech-to-Text and Text-to-Speech defaults for dictation and playback."
          )}
        </p>
        <div className="border-b border-border mt-3" />
      </div>

      <SSTSettings hideBorder />
      <TTSModeSettings hideBorder />
    </div>
  )
}

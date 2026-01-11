import { useDarkMode } from "~/hooks/useDarkmode"
import { Alert, Modal, Select, Switch, notification } from "antd"
import { MoonIcon, SunIcon } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { SearchModeSettings } from "./search-mode"
import { useTranslation } from "react-i18next"
import { useI18n } from "@/hooks/useI18n"
import { useStorage } from "@plasmohq/storage/hook"
import { SystemSettings } from "./system-settings"
import { getDefaultOcrLanguage, ocrLanguages } from "@/data/ocr-language"
import { useServerOnline } from "@/hooks/useServerOnline"
import { useConnectionActions } from "@/hooks/useConnectionState"
import FeatureEmptyState from "@/components/Common/FeatureEmptyState"
import ConnectFeatureBanner from "@/components/Common/ConnectFeatureBanner"

export const GeneralSettings = () => {
  // Persisted preference: auto-finish onboarding when connection & RAG are healthy
  const [onboardingAutoFinish, setOnboardingAutoFinish] = useStorage(
    "onboardingAutoFinish",
    false
  )

  const [sendNotificationAfterIndexing, setSendNotificationAfterIndexing] =
    useStorage("sendNotificationAfterIndexing", false)

  const [checkOllamaStatus, setCheckOllamaStatus] = useStorage(
    "checkOllamaStatus",
    true
  )

  const [defaultOCRLanguage, setDefaultOCRLanguage] = useStorage(
    "defaultOCRLanguage",
    getDefaultOcrLanguage()
  )
  const [enableOcrAssets, setEnableOcrAssets] = useStorage(
    "enableOcrAssets",
    false
  )

  const [settingsIntroDismissed, setSettingsIntroDismissed] = useStorage(
    "settingsIntroDismissed",
    false
  )

  const { mode, toggleDarkMode } = useDarkMode()
  const { t } = useTranslation("settings")
  const { changeLocale, locale, supportLanguage } = useI18n()
  const isOnline = useServerOnline()
  const navigate = useNavigate()
  const { beginOnboarding } = useConnectionActions()

  return (
    <dl className="flex flex-col space-y-6 text-sm">
      {!isOnline && (
        <div>
          <ConnectFeatureBanner
            title={t("generalSettings.empty.connectTitle", {
              defaultValue: "Connect tldw Assistant to your server"
            })}
            description={t("generalSettings.empty.connectDescription", {
              defaultValue:
                "Some settings only take effect when your tldw server is reachable. Connect your server to get the full experience."
            })}
            examples={[
              t("generalSettings.empty.connectExample1", {
                defaultValue:
                  "Open Settings → tldw server to add your server URL and API key."
              }),
              t("generalSettings.empty.connectExample2", {
                defaultValue:
                  "Use Diagnostics to confirm your server is healthy before trying advanced tools."
              })
            ]}
          />
        </div>
      )}

      {isOnline && !settingsIntroDismissed && (
        <div>
          <FeatureEmptyState
            title={t("generalSettings.empty.title", {
              defaultValue: "Tune how tldw Assistant behaves"
            })}
            description={t("generalSettings.empty.description", {
              defaultValue:
                "Adjust defaults for the Web UI, sidepanel, speech, search, and data handling from one place."
            })}
            examples={[
              t("generalSettings.empty.example1", {
                defaultValue:
                  "Choose your default language, theme, and chat resume behavior."
              }),
              t("generalSettings.empty.example2", {
                defaultValue:
                  "Control whether chats are temporary, how large pastes are handled, and how reasoning is displayed."
              })
            ]}
            primaryActionLabel={t("generalSettings.empty.primaryCta", {
              defaultValue: "Configure server & auth"
            })}
            onPrimaryAction={() => navigate("/settings/tldw")}
            secondaryActionLabel={t("generalSettings.empty.secondaryCta", {
              defaultValue: "Dismiss"
            })}
            onSecondaryAction={() => setSettingsIntroDismissed(true)}
          />
        </div>
      )}
      <div>
        <h2 className="text-base font-semibold leading-7 text-text">
          {t("generalSettings.title")}
        </h2>
        <div className="border-b border-border mt-3"></div>
      </div>

      <div className="flex flex-row justify-between">
        <span className="text-text">
          {t("generalSettings.settings.language.label")}
        </span>

        <Select
          aria-label={t("generalSettings.settings.language.label")}
          placeholder={t("generalSettings.settings.language.placeholder")}
          allowClear
          showSearch
          style={{ width: "200px" }}
          options={supportLanguage}
          value={locale}
          filterOption={(input, option) =>
            option!.label.toLowerCase().indexOf(input.toLowerCase()) >= 0 ||
            option!.value.toLowerCase().indexOf(input.toLowerCase()) >= 0
          }
          onChange={(value) => {
            changeLocale(value)
          }}
        />
      </div>
      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.sendNotificationAfterIndexing.label")}
          </span>
        </div>

        <Switch
          checked={sendNotificationAfterIndexing}
          onChange={setSendNotificationAfterIndexing}
          aria-label={t("generalSettings.settings.sendNotificationAfterIndexing.label")}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t("generalSettings.settings.ollamaStatus.label")}
          </span>
        </div>

        <Switch
          checked={checkOllamaStatus}
          onChange={(checked) => setCheckOllamaStatus(checked)}
          aria-label={t("generalSettings.settings.ollamaStatus.label")}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t(
              "generalSettings.settings.onboardingAutoFinish.label",
              "Auto-finish onboarding after successful connection"
            )}
          </span>
        </div>

        <Switch
          checked={onboardingAutoFinish}
          onChange={(checked) => setOnboardingAutoFinish(checked)}
          aria-label={t("generalSettings.settings.onboardingAutoFinish.label", "Auto-finish onboarding after successful connection")}
        />
      </div>

      <div className="flex flex-row justify-between">
        <div className="inline-flex items-center gap-2">
          <span className="text-text">
            {t(
              "generalSettings.settings.restartOnboarding.label",
              "Restart onboarding from the beginning"
            )}
          </span>
        </div>

        <button
          type="button"
          className="text-xs text-primary hover:text-primaryStrong"
          onClick={() => {
            Modal.confirm({
              title: t(
                "generalSettings.settings.restartOnboarding.confirmTitle",
                "Restart onboarding?"
              ),
              content: t(
                "generalSettings.settings.restartOnboarding.confirmMessage",
                "This will reset your onboarding state and take you back to the setup flow."
              ),
              onOk: async () => {
                try {
                  await beginOnboarding()
                  notification.success({
                    message: t(
                      "generalSettings.settings.restartOnboarding.toast",
                      "Onboarding has been reset"
                    )
                  })
                  navigate("/")
                } catch (err) {
                  console.error("Failed to restart onboarding:", err)
                  notification.error({
                    message: t(
                      "generalSettings.settings.restartOnboarding.error",
                      "Failed to restart onboarding. Please try again."
                    )
                  })
                }
              }
            })
          }}
        >
          {t(
            "generalSettings.settings.restartOnboarding.button",
            "Restart onboarding"
          )}
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex flex-row justify-between">
          <span className="text-text">
            {t("generalSettings.settings.enableOcrAssets.label")}
          </span>

          <Switch
            checked={enableOcrAssets}
            onChange={(checked) => setEnableOcrAssets(checked)}
            aria-label={t("generalSettings.settings.enableOcrAssets.label")}
          />
        </div>
        {!enableOcrAssets && (
          <Alert
            type="info"
            showIcon
            message={t(
              "generalSettings.settings.enableOcrAssets.downloadNotice",
              "Enable to download OCR language assets for image text recognition"
            )}
            className="!py-1.5 !text-xs"
          />
        )}
        {enableOcrAssets && (
          <Alert
            type="success"
            showIcon
            message={t(
              "generalSettings.settings.enableOcrAssets.assetsEnabled",
              "OCR assets enabled and ready"
            )}
            className="!py-1.5 !text-xs"
          />
        )}
      </div>

      <div className="flex flex-row justify-between">
        <span className="text-text">
          {t("generalSettings.settings.ocrLanguage.label")}
        </span>

        <Select
          aria-label={t("generalSettings.settings.ocrLanguage.label")}
          placeholder={t("generalSettings.settings.ocrLanguage.placeholder")}
          showSearch
          style={{ width: "200px" }}
          options={ocrLanguages}
          value={defaultOCRLanguage}
          filterOption={(input, option) =>
            option!.label.toLowerCase().indexOf(input.toLowerCase()) >= 0 ||
            option!.value.toLowerCase().indexOf(input.toLowerCase()) >= 0
          }
          onChange={(value) => {
            setDefaultOCRLanguage(value)
          }}
        />
      </div>

      <div className="flex flex-row justify-between">
        <span className="text-text">
          {t("generalSettings.settings.darkMode.label")}
        </span>

        <button
          onClick={toggleDarkMode}
          className="mt-4 inline-flex items-center rounded-md border border-transparent bg-primary px-2 py-2 text-sm font-medium leading-4 text-white shadow-sm hover:bg-primaryStrong focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50 whitespace-nowrap"
        >
          {mode === "dark" ? (
            <SunIcon className="w-4 h-4 mr-2" />
          ) : (
            <MoonIcon className="w-4 h-4 mr-2" />
          )}
          {mode === "dark"
            ? t("generalSettings.settings.darkMode.options.light")
            : t("generalSettings.settings.darkMode.options.dark")}
        </button>
      </div>
      <SearchModeSettings />
      <SystemSettings />
    </dl>
  )
}

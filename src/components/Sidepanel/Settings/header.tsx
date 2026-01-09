import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Select } from "antd"
import logoImage from "~/assets/icon.png"
import { useSetting } from "@/hooks/useSetting"
import { setSetting } from "@/services/settings/registry"
import { UI_MODE_SETTING } from "@/services/settings/ui-settings"
import {
  ACTION_ICON_CLICK_SETTING,
  CONTEXT_MENU_CLICK_SETTING
} from "@/services/action"

export const SidepanelSettingsHeader = () => {
  const { t , i18n} = useTranslation("common")
  const isRTL = i18n?.dir?.() === "rtl"
 
  const [uiMode, setUiMode] = useSetting(UI_MODE_SETTING)

  return (
    <div className="flex px-3 justify-between gap-3 bg-surface border-b border-border py-4 items-center">
      <Link to="/">
      {
        isRTL ? (
          <ChevronRight className="h-5 w-5 text-text-muted" />
        ) : (
          <ChevronLeft className="h-5 w-5 text-text-muted" />
        )
      }
      </Link>
      <div className="focus:outline-none focus-visible:ring-2 focus-visible:ring-focus flex items-center text-text">
        <img className="h-6 w-auto" src={logoImage} alt={t("pageAssist")} />
        <span className="ml-1 text-sm ">{t("pageAssist")}</span>
      </div>
      <div className="ml-auto">
        <Select
          size="small"
          className="w-[180px]"
          value={uiMode}
          options={[
            { label: t('settings:generalSettings.systemBasics.uiMode.options.sidePanel', { defaultValue: 'Sidebar' }), value: 'sidePanel' },
            { label: t('settings:generalSettings.systemBasics.uiMode.options.webui', { defaultValue: 'Full Screen (Web UI)' }), value: 'webui' }
          ]}
          onChange={async (value) => {
            await setUiMode(value)
            await setSetting(ACTION_ICON_CLICK_SETTING, value)
            // Keep context menu to sidePanel for consistency
            await setSetting(CONTEXT_MENU_CLICK_SETTING, "sidePanel")
            if (value === 'webui') {
              const url = browser.runtime.getURL('/options.html')
              browser.tabs.create({ url })
            }
          }}
        />
      </div>
    </div>
  )
}

import { supportLanguage } from "@/i18n/support-language"
import { useTranslation } from "react-i18next"
import { useSetting } from "@/hooks/useSetting"
import { I18N_LANGUAGE_SETTING } from "@/services/settings/ui-settings"

export const useI18n = () => {
  const { i18n } = useTranslation()
  const [locale, setLocale] = useSetting(I18N_LANGUAGE_SETTING)

  const changeLocale = (lang: string) => {
    void setLocale(lang)
    i18n.changeLanguage(lang)
  }

  return { locale, changeLocale, supportLanguage }
}

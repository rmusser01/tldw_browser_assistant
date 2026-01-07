import { getDefaultOcrLanguage } from "@/data/ocr-language"
import { useStoreChatModelSettings } from "@/store/model"
import {
    coerceBoolean,
    coerceString,
    defineSetting,
    getSetting
} from "@/services/settings/registry"

const OCR_ENABLED_SETTING = defineSetting(
    "enableOcrAssets",
    false,
    (value) => coerceBoolean(value, false)
)

const OCR_LANGUAGE_SETTING = defineSetting(
    "defaultOCRLanguage",
    getDefaultOcrLanguage(),
    (value) => coerceString(value, getDefaultOcrLanguage())
)

export const isOcrEnabled = async (): Promise<boolean> => {
  return await getSetting(OCR_ENABLED_SETTING)
}

export const getOCRLanguage = async () => {
    return await getSetting(OCR_LANGUAGE_SETTING)
}

export const getOCRLanguageToUse = async () => {
    const currentChatModelSettings = useStoreChatModelSettings.getState()
    if (currentChatModelSettings?.ocrLanguage) {
        return currentChatModelSettings.ocrLanguage
    }

    const defaultOCRLanguage = await getOCRLanguage()
    return defaultOCRLanguage
}


export const isOfflineOCR = (lang: string) => {
    return lang !== "eng-fast"
}

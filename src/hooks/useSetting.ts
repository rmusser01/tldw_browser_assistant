import { useCallback, useEffect } from "react"
import { useStorage } from "@plasmohq/storage/hook"
import type { SettingDef } from "@/services/settings/registry"
import {
  getSetting,
  getStorageForSetting,
  normalizeSettingValue,
  setSetting
} from "@/services/settings/registry"

export const useSetting = <T>(setting: SettingDef<T>) => {
  const storage = getStorageForSetting(setting)
  const [rawValue, , meta] = useStorage<T | undefined>(
    { key: setting.key, instance: storage },
    setting.defaultValue
  )

  useEffect(() => {
    if (meta?.isLoading) return
    void getSetting(setting)
  }, [meta?.isLoading, setting])

  const value = normalizeSettingValue(setting, rawValue)

  const setValue = useCallback(
    async (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(value) : next
      await setSetting(setting, resolved)
    },
    [setting, value]
  )

  return [value, setValue, meta] as const
}

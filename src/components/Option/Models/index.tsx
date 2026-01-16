import { Select, Spin } from "antd"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { browser } from "wxt/browser"
import { AvailableModelsList } from "./AvailableModelsList"
import { useAntdNotification } from "@/hooks/useAntdNotification"
import { tldwModels } from "@/services/tldw"
import { useStorage } from "@plasmohq/storage/hook"
import { fetchChatModels } from "@/services/tldw-server"
import {
  getProviderDisplayName,
  normalizeProviderKey
} from "@/utils/provider-registry"

dayjs.extend(relativeTime)

interface RefreshResponse {
  ok: boolean
}

const isRefreshResponse = (res: unknown): res is RefreshResponse =>
  typeof res === "object" &&
  res !== null &&
  typeof (res as { ok?: unknown }).ok === "boolean"

export const ModelsBody = () => {
  // Custom provider models have been removed; we only show
  // tldw_server models discovered from the server.
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null)

  const { t } = useTranslation(["settings", "common"])
  const notification = useAntdNotification()
  const queryClient = useQueryClient()
  const [selectedModel, setSelectedModel] = useStorage<string | null>(
    "selectedModel",
    null
  )
  const [defaultApiProvider, setDefaultApiProvider] = useStorage<
    string | null
  >("defaultApiProvider", null)

  const {
    data: availableModels = [],
    isLoading: modelsLoading
  } = useQuery({
    queryKey: ["tldw-chat-models"],
    queryFn: async () => fetchChatModels({ returnEmpty: true }),
    staleTime: 5 * 60 * 1000
  })

  const normalizedDefaultProvider = useMemo(() => {
    if (!defaultApiProvider) return ""
    const normalized = normalizeProviderKey(defaultApiProvider)
    return normalized === "unknown" ? "" : normalized
  }, [defaultApiProvider])

  const providerSelectValue = useMemo(
    () => normalizedDefaultProvider || "auto",
    [normalizedDefaultProvider]
  )

  const providerOptions = useMemo(() => {
    const providers = new Map<string, string>()
    for (const model of availableModels) {
      const rawProvider = model.details?.provider ?? model.provider
      if (!rawProvider) continue
      const key = normalizeProviderKey(rawProvider)
      if (!key || key === "unknown") continue
      if (!providers.has(key)) {
        providers.set(key, getProviderDisplayName(rawProvider))
      }
    }
    return Array.from(providers.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [availableModels])

  const modelOptions = useMemo(() => {
    return availableModels
      .filter((model) => {
        if (!normalizedDefaultProvider) return true
        const rawProvider = model.details?.provider ?? model.provider
        if (!rawProvider) return false
        return normalizeProviderKey(rawProvider) === normalizedDefaultProvider
      })
      .map((model) => {
        const rawProvider = model.details?.provider ?? model.provider
        const providerLabel = rawProvider
          ? getProviderDisplayName(rawProvider)
          : t("settings:onboarding.defaults.providerUnknown", "Provider")
        const modelLabel = model.nickname || model.model
        return {
          value: model.model,
          label: `${providerLabel} - ${modelLabel}`
        }
      })
  }, [availableModels, normalizedDefaultProvider, t])

  const handleProviderChange = useCallback(
    (value: string) => {
      if (value === "auto") {
        setDefaultApiProvider(null)
        return
      }
      const normalized = normalizeProviderKey(value)
      setDefaultApiProvider(
        normalized && normalized !== "unknown" ? normalized : null
      )
    },
    [setDefaultApiProvider]
  )

  const handleModelChange = useCallback(
    (value: string) => {
      setSelectedModel(value || null)
    },
    [setSelectedModel]
  )

  useEffect(() => {
    if (!normalizedDefaultProvider || !selectedModel) return
    if (availableModels.length === 0) return
    const selectedEntry = availableModels.find(
      (model) => model.model === selectedModel
    )
    if (!selectedEntry) return
    const rawProvider = selectedEntry.details?.provider ?? selectedEntry.provider
    if (!rawProvider) return
    if (normalizeProviderKey(rawProvider) !== normalizedDefaultProvider) {
      setSelectedModel(null)
    }
  }, [
    availableModels,
    normalizedDefaultProvider,
    selectedModel,
    setSelectedModel
  ])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await browser.runtime
        .sendMessage({ type: "tldw:models:refresh" })
        .catch(() => null)
      if (!isRefreshResponse(res) || !res.ok) {
        // Fallback to local warm-up if background message failed
        await tldwModels.warmCache(true)
      }
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["tldw-providers-models"] }),
        queryClient.refetchQueries({ queryKey: ["tldw-models"] }),
        queryClient.refetchQueries({ queryKey: ["tldw-chat-models"] })
      ])
      const providers = queryClient.getQueryData<Record<string, unknown[]>>([
        "tldw-providers-models"
      ])
      setLastRefreshedAt(Date.now())
      if (!providers || Object.keys(providers).length === 0) {
        notification.error({
          message: t("settings:models.refreshEmpty", {
            defaultValue: "No providers available after refresh"
          }),
          description: t("settings:models.refreshEmptyHint", {
            defaultValue:
              "Check your server URL and API key, ensure your tldw_server is running, then try refreshing again."
          })
        })
      } else {
        notification.success({
          message: t("settings:models.refreshSuccess", {
            defaultValue: "Model list refreshed"
          })
        })
      }
    } catch (e: unknown) {
      console.error("[tldw] Failed to refresh models", e)
      const rawMessage = e instanceof Error ? e.message : String(e)
      const message =
        rawMessage.length > 200 ? `${rawMessage.slice(0, 197)}...` : rawMessage
      notification.error({
        message: t("settings:models.refreshFailed", { defaultValue: "Failed to refresh models" }),
        description: message
      })
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div>
      <div>
        <div className="mb-6">
          <div className="-ml-4 -mt-2 flex flex-wrap items-center justify-between sm:flex-nowrap">
            <div className="ml-4 mt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                className="inline-flex items-center rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text shadow-sm hover:bg-surface2 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 disabled:opacity-60">
                {refreshing ? (
                  <>
                    <Spin size="small" className="mr-2" />
                    {t("common:loading.title", {
                      defaultValue: "Loading..."
                    })}
                  </>
                ) : (
                  t("common:refresh", { defaultValue: "Refresh" })
                )}
              </button>
              {lastRefreshedAt && (
                <span className="text-xs text-text-subtle">
                  {t("settings:models.lastRefreshedAt", {
                    defaultValue: "Last checked at {{time}}",
                    time: dayjs(lastRefreshedAt).format("HH:mm")
                  })}
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-border/70 bg-surface p-4">
            <div className="mb-3">
              <div className="text-sm font-semibold text-text">
                {t("settings:onboarding.defaults.title", "Set your defaults")}
              </div>
              <p className="text-xs text-text-subtle">
                {t(
                  "settings:onboarding.defaults.subtitle",
                  "Pick a default provider and model for new chats."
                )}
              </p>
            </div>
            {modelsLoading ? (
              <div className="flex items-center gap-2 text-xs text-text-subtle">
                <Spin size="small" />
                {t("settings:onboarding.defaults.loading", "Loading models...")}
              </div>
            ) : availableModels.length === 0 ? (
              <div className="text-xs text-text-subtle">
                <div className="font-medium text-text">
                  {t(
                    "settings:models.noProvidersTitle",
                    "No providers available."
                  )}
                </div>
                <div className="mt-1">
                  {t(
                    "settings:models.noProvidersBody",
                    "The extension could not load providers from your tldw_server. Check your server URL and API key in Settings, ensure the server is running, then use Retry (or Refresh) to try again."
                  )}
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text">
                    {t(
                      "settings:onboarding.defaults.providerLabel",
                      "Default API provider"
                    )}
                  </label>
                  <Select
                    size="large"
                    value={providerSelectValue}
                    onChange={handleProviderChange}
                    options={[
                      {
                        value: "auto",
                        label: t(
                          "settings:onboarding.defaults.providerAuto",
                          "Auto (from model)"
                        )
                      },
                      ...providerOptions
                    ]}
                    className="w-full"
                  />
                  <p className="mt-1 text-[11px] text-text-subtle">
                    {t(
                      "settings:onboarding.defaults.providerHelp",
                      "Leave on Auto to use the provider attached to each model."
                    )}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text">
                    {t(
                      "settings:onboarding.defaults.modelLabel",
                      "Default model"
                    )}
                  </label>
                  <Select
                    showSearch
                    size="large"
                    value={selectedModel || undefined}
                    onChange={handleModelChange}
                    placeholder={t(
                      "settings:onboarding.defaults.modelPlaceholder",
                      "Select a model"
                    )}
                    options={modelOptions}
                    optionFilterProp="label"
                    className="w-full"
                    allowClear
                  />
                  <p className="mt-1 text-[11px] text-text-subtle">
                    {t(
                      "settings:onboarding.defaults.modelHelp",
                      "This becomes the starting model when you open a new chat."
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
          <AvailableModelsList />
        </div>
      </div>
    </div>
  )
}

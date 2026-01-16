import { useQuery } from "@tanstack/react-query"
import { Button, Select, Skeleton } from "antd"
import React from "react"
import { useTranslation } from "react-i18next"
import { useStorage } from "@plasmohq/storage/hook"
import { browser } from "wxt/browser"
import { useServerCapabilities } from "@/hooks/useServerCapabilities"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import { useStoreMessageOption } from "@/store/option"

/**
 * Dictionary item from API. Supports multiple field name variations
 * to accommodate different API versions or endpoints.
 */
interface DictionaryItem {
  id?: string | number
  dictionary_id?: string | number
  dictionaryId?: string | number
  name?: string
  title?: string
}

interface DictionariesResponse {
  dictionaries?: DictionaryItem[]
  items?: DictionaryItem[]
  results?: DictionaryItem[]
}

const CITATION_STYLE_OPTIONS = [
  { value: "apa", label: "APA" },
  { value: "mla", label: "MLA" },
  { value: "chicago", label: "Chicago" },
  { value: "ieee", label: "IEEE" },
  { value: "harvard", label: "Harvard" }
]

export const CitationDictionarySettings = () => {
  const { t } = useTranslation("settings")
  const [citationStyle, setCitationStyle] = useStorage("ragCitationStyle", "apa")
  const [activeChatDictionaries, setActiveChatDictionaries] = useStorage<
    string[]
  >("activeChatDictionaries", [])
  const { capabilities, loading: capabilitiesLoading } = useServerCapabilities()
  const { ragAdvancedOptions, setRagAdvancedOptions } = useStoreMessageOption(
    (state) => ({
      ragAdvancedOptions: state.ragAdvancedOptions,
      setRagAdvancedOptions: state.setRagAdvancedOptions
    })
  )

  const dictionariesEnabled = Boolean(capabilities?.hasChatDictionaries)

  React.useEffect(() => {
    if (!dictionariesEnabled) return
    void tldwClient.initialize().catch((error) => {
      console.error("Failed to initialize tldwClient:", error)
    })
  }, [dictionariesEnabled])

  const { data: dictionariesData, isLoading: dictionariesLoading } = useQuery<
    DictionariesResponse | DictionaryItem[]
  >({
    queryKey: ["sidepanelChatDictionaries"],
    queryFn: async () => tldwClient.listDictionaries(true),
    enabled: dictionariesEnabled
  })

  const dictionaryOptions = React.useMemo(() => {
    if (!dictionariesData) return []
    const list = Array.isArray(dictionariesData)
      ? dictionariesData
      : dictionariesData?.dictionaries ||
        dictionariesData?.items ||
        dictionariesData?.results ||
        []
    return list.map((dict) => ({
      value: String(dict.id ?? dict.dictionary_id ?? dict.dictionaryId),
      label: dict.name || dict.title || `Dictionary ${dict.id}`
    }))
  }, [dictionariesData])

  React.useEffect(() => {
    const currentStyle = ragAdvancedOptions?.citation_style
    if (currentStyle === citationStyle || !citationStyle) return
    setRagAdvancedOptions({
      ...(ragAdvancedOptions || {}),
      citation_style: citationStyle
    })
  }, [citationStyle, setRagAdvancedOptions])

  return (
    <div className="border border-border rounded p-4 bg-surface">
      <h2 className="text-md font-semibold text-text">
        {t("citationSettings.heading", "Citations & Dictionaries")}
      </h2>
      <div className="mt-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-text">
            {t("citationSettings.styleLabel", "Citation style")}
          </span>
          <Select
            value={citationStyle}
            onChange={(value) => setCitationStyle(value)}
            options={CITATION_STYLE_OPTIONS}
            style={{ width: 200 }}
            aria-label={t("citationSettings.styleLabel", "Citation style")}
          />
        </div>
        <div className="border-b border-border" />
        {capabilitiesLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="text-text">
                  {t(
                    "citationSettings.dictionariesLabel",
                    "Chat dictionaries"
                  )}
                </div>
                <div className="text-xs text-text-muted">
                  {t(
                    "citationSettings.dictionariesHelp",
                    "Select dictionaries to apply to chat messages."
                  )}
                </div>
              </div>
              <Button
                size="small"
                onClick={() =>
                  window.open(
                    browser.runtime.getURL("/options.html#/dictionaries"),
                    "_blank"
                  )
                }
              >
                {t("citationSettings.openWorkspace", "Open workspace")}
              </Button>
            </div>
            <Select
              mode="multiple"
              placeholder={t(
                "citationSettings.dictionariesPlaceholder",
                "Select dictionaries"
              )}
              options={dictionaryOptions}
              value={activeChatDictionaries}
              onChange={(values) =>
                setActiveChatDictionaries(values as string[])
              }
              disabled={!dictionariesEnabled || dictionariesLoading}
              loading={dictionariesLoading}
              aria-label={t(
                "citationSettings.dictionariesLabel",
                "Chat dictionaries"
              )}
            />
            {!dictionariesEnabled && (
              <div className="text-xs text-text-muted">
                {t(
                  "citationSettings.dictionariesUnavailable",
                  "Chat dictionaries are not available on this server."
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CitationDictionarySettings

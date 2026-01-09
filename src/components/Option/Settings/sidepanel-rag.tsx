import { useStorage } from "@plasmohq/storage/hook"
import { InputNumber, Switch, Tag } from "antd"
import { useTranslation } from "react-i18next"

export const SidepanelRag = ({ hideBorder }: { hideBorder?: boolean }) => {
  const { t } = useTranslation("settings")
  const [chatWithWebsiteEmbedding, setChatWithWebsiteEmbedding] = useStorage(
    "chatWithWebsiteEmbedding",
    false
  )
  const [maxWebsiteContext, setMaxWebsiteContext] = useStorage(
    "maxWebsiteContext",
    7028
  )

  return (
    <div>
      <div className="mb-5">
        <h2
          className={`${
            !hideBorder ? "text-base font-semibold leading-7" : "text-md"
          } text-text`}>
          {t("generalSettings.sidepanelRag.heading")}
        </h2>
        {!hideBorder && (
          <div className="border-b border-border mt-3"></div>
        )}
      </div>
      <div className={`${
        !hideBorder ? "text-sm" : ""
      } space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <span className="text-text truncate">
            {t("generalSettings.sidepanelRag.ragEnabled.label")}
          </span>
          <div>
            <Switch
              className="mt-4 sm:mt-0"
              checked={chatWithWebsiteEmbedding}
              onChange={(checked) => setChatWithWebsiteEmbedding(checked)}
              aria-label={t("generalSettings.sidepanelRag.ragEnabled.label")}
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="inline-flex items-center gap-2">
            <span className="text-text truncate">
              {t("generalSettings.sidepanelRag.maxWebsiteContext.label")}
            </span>
            {maxWebsiteContext === 7028 && (
              <Tag className="text-[10px] py-0 px-1.5 leading-4">
                {t("generalSettings.settings.defaultBadge", "default")}
              </Tag>
            )}
          </div>
          <div>
            <InputNumber
              className="mt-4 sm:mt-0"
              value={maxWebsiteContext}
              onChange={(value) => setMaxWebsiteContext(value)}
              placeholder={t(
                "generalSettings.sidepanelRag.maxWebsiteContext.placeholder"
              )}
              aria-label={t("generalSettings.sidepanelRag.maxWebsiteContext.label")}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useConfirmDanger } from "@/components/Common/confirm-danger"

type Props = {
  modelName: string
  cancelDownloadModel: () => void
}

export const CancelPullingModel = ({
  modelName,
  cancelDownloadModel
}: Props) => {
  const { t } = useTranslation("common")
  const confirmDanger = useConfirmDanger()
  return (
    <div className="mb-4 rounded-lg border border-border bg-surface2 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
          <span className="text-sm font-medium text-text">
            {`${t("downloading")} ${modelName}...`}
          </span>
        </div>
        <button
          className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white hover:bg-danger focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
          onClick={async () => {
            const ok = await confirmDanger({
              title: t("common:confirmTitle", { defaultValue: "Please confirm" }),
              content: t("cancelPullingModel.confirm"),
              okText: t("common:cancel", { defaultValue: "Cancel" }),
              cancelText: t("common:close", { defaultValue: "Close" })
            })
            if (ok) {
              cancelDownloadModel()
            }
          }}>
          {t("common:cancel")}
        </button>
      </div>
    </div>
  )
}

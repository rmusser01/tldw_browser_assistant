import React from "react"
import { Globe, X } from "lucide-react"
import { TabInfo } from "~/hooks/useTabMentions"
import { useTranslation } from "react-i18next"
import { IconButton } from "../../Common/IconButton"

interface DocumentChipProps {
  document: TabInfo
  onRemove: (id: number) => void
}

export const DocumentChip: React.FC<DocumentChipProps> = ({
  document,
  onRemove,
}) => {
  const { t } = useTranslation(["option"]) 
  return (
    <div className="inline-flex items-center gap-2 bg-surface2 border border-border rounded-lg px-3 py-1.5 mr-2 mb-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex-shrink-0">
          {document.favIconUrl ? (
            <img
              src={document.favIconUrl}
              alt=""
              className="w-4 h-4 rounded"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = "none"
                target.nextElementSibling?.classList.remove("hidden")
              }}
            />
          ) : null}
          <Globe
            className={`w-4 h-4 text-text-subtle ${document.favIconUrl ? "hidden" : ""}`}
          />
        </div>
        <div className="flex flex-col max-w-60 truncate">
          <span className="text-sm font-medium text-text">
            {document.title}
          </span>
        </div>{" "}
      </div>

      <IconButton
        ariaLabel={t("quickIngest.remove", { defaultValue: "Remove" }) as string}
        onClick={() => onRemove(document.id)}
        className="flex-shrink-0 text-text-subtle hover:text-text transition-colors"
        type="button">
        <X className="w-3 h-3" />
      </IconButton>
    </div>
  )
}

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
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface2 px-3 py-1 text-xs text-text">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex-shrink-0">
          {document.favIconUrl ? (
            <img
              src={document.favIconUrl}
              alt=""
              className="h-3.5 w-3.5 rounded"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = "none"
                target.nextElementSibling?.classList.remove("hidden")
              }}
            />
          ) : null}
          <Globe
            className={`h-3.5 w-3.5 text-text-subtle ${
              document.favIconUrl ? "hidden" : ""
            }`}
          />
        </div>
        <div className="max-w-56 truncate">
          <span className="text-xs font-medium text-text">
            {document.title}
          </span>
        </div>
      </div>

      <IconButton
        ariaLabel={t("quickIngest.remove", { defaultValue: "Remove" }) as string}
        onClick={() => onRemove(document.id)}
        className="flex-shrink-0 text-text-subtle hover:text-text transition-colors h-11 w-11 sm:h-7 sm:w-7 sm:min-w-0 sm:min-h-0"
        type="button">
        <X className="h-3 w-3" />
      </IconButton>
    </div>
  )
}

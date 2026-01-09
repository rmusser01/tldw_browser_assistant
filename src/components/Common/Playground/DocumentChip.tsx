import React, { useState } from "react"
import { Globe, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { translateMessage } from "@/i18n/translateMessage"
import { IconButton } from "@/components/Common/IconButton"

export type DocumentChipVariant = "link" | "compact"

export interface DocumentChipDocument {
  id?: number
  title: string
  url?: string
  favIconUrl?: string
}

interface DocumentChipProps {
  document: DocumentChipDocument
  variant?: DocumentChipVariant
  onRemove?: (id: number) => void
  removeLabel?: string
  showUrl?: boolean
  className?: string
}

export const DocumentChip: React.FC<DocumentChipProps> = ({
  document,
  variant = "link",
  onRemove,
  removeLabel,
  showUrl = true,
  className
}) => {
  const { t } = useTranslation("option")
  const [imgError, setImgError] = useState(false)
  const isCompact = variant === "compact"
  const canRemove =
    typeof onRemove === "function" && typeof document.id === "number"
  const showLink = !isCompact && !canRemove && Boolean(document.url)
  const resolvedRemoveLabel =
    removeLabel ?? translateMessage(t, "option:remove", "Remove")
  const Container: React.ElementType = showLink ? "a" : "div"
  const containerClasses = [
    isCompact
      ? "inline-flex items-center gap-2 rounded-full border border-border bg-surface2 px-3 py-1 text-xs text-text"
      : "mb-2 mr-2 inline-flex items-center gap-2 rounded-2xl border border-border bg-surface2 px-3 py-2 text-text hover:bg-surface",
    className
  ]
    .filter(Boolean)
    .join(" ")
  const iconSizeClass = isCompact ? "h-3.5 w-3.5" : "h-4 w-4"
  const iconColorClass = isCompact ? "text-text-subtle" : "text-text-muted"
  const titleClass = isCompact
    ? "text-xs font-medium text-text"
    : "text-sm font-medium text-text"

  return (
    <Container
      {...(showLink
        ? { href: document.url, target: "_blank", rel: "noreferrer" }
        : {})}
      className={containerClasses}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex-shrink-0">
          {document.favIconUrl && !imgError ? (
            <img
              src={document.favIconUrl}
              alt=""
              className={`${iconSizeClass} rounded`}
              onError={() => setImgError(true)}
            />
          ) : (
            <Globe className={`${iconSizeClass} ${iconColorClass}`} />
          )}
        </div>
        <div className={isCompact ? "max-w-56 truncate" : "flex flex-col max-w-60 truncate"}>
          <span className={titleClass}>{document.title}</span>
          {!isCompact && showUrl && document.url ? (
            <span className="text-xs text-text-muted">{document.url}</span>
          ) : null}
        </div>
      </div>

      {canRemove && (
        <IconButton
          ariaLabel={resolvedRemoveLabel}
          onClick={() => onRemove(document.id as number)}
          className="flex-shrink-0 text-text-subtle hover:text-text transition-colors h-11 w-11 sm:h-7 sm:w-7 sm:min-w-0 sm:min-h-0"
          type="button">
          <X className="h-3 w-3" />
        </IconButton>
      )}
    </Container>
  )
}

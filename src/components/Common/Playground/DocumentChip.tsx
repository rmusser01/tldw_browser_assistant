import React from "react"
import { Globe } from "lucide-react"

interface DocumentChipProps {
  document: {
    title: string
    url: string
    favIconUrl?: string
  }
}

export const DocumentChip: React.FC<DocumentChipProps> = ({ document }) => {
  return (
    <a
      href={document.url}
      target="_blank"
      rel="noreferrer"
      className="mb-2 mr-2 inline-flex items-center gap-2 rounded-2xl border border-border bg-surface2 px-3 py-2 text-text hover:bg-surface">
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
            className={`h-4 w-4 text-text-muted ${document.favIconUrl ? "hidden" : ""}`}
          />
        </div>
        <div className="flex flex-col max-w-60 truncate">
          <span className="text-sm font-medium text-text">
            {document.title}
          </span>
          <span className="text-xs text-text-muted">
            {document.url}
          </span>
        </div>{" "}
      </div>
    </a>
  )
}

import { KnowledgeIcon } from "@/components/Option/Knowledge/KnowledgeIcon"
import { useTranslation } from "react-i18next"

type Props = {
  source: {
    name?: string
    url?: string
    mode?: string
    type?: string
    pageContent?: string
    content?: string
    text?: string
    snippet?: string
    metadata?: {
      source?: string
      title?: string
      page?: number
      loc?: {
        lines?: {
          from?: number
          to?: number
        }
      }
    }
  }
  onSourceClick?: (source: any) => void
  onSourceNavigate?: (source: any) => void
}

export const MessageSource: React.FC<Props> = ({
  source,
  onSourceClick,
  onSourceNavigate
}) => {
  const { t } = useTranslation("common")
  const isKnowledge = source?.mode === "rag" || source?.mode === "chat"
  const label =
    source?.name ||
    source?.metadata?.source ||
    source?.metadata?.title ||
    source?.url ||
    t("sourceLabel", "Source")
  const content =
    source?.pageContent ||
    source?.content ||
    source?.text ||
    source?.snippet ||
    ""
  const url = source?.url
  const page = source?.metadata?.page
  const lineFrom = source?.metadata?.loc?.lines?.from
  const lineTo = source?.metadata?.loc?.lines?.to
  const isExpandable = Boolean(content)

  if (!isExpandable) {
    if (url) {
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            onSourceNavigate && onSourceNavigate(source)
          }}
          className="inline-flex items-center rounded-md border border-border bg-surface2 px-2 py-1 text-caption text-text opacity-80 transition-shadow duration-200 ease-in-out hover:bg-surface hover:opacity-100 hover:shadow-md">
          <span className="text-caption">{label}</span>
        </a>
      )
    }

    return (
      <span className="inline-flex items-center rounded-md border border-border bg-surface2 px-2 py-1 text-caption text-text opacity-80">
        {label}
      </span>
    )
  }

  return (
    <details className="w-full rounded-md border border-border bg-surface2 px-2 py-1">
      <summary
        onClick={() => {
          onSourceClick && onSourceClick(source)
        }}
        className="flex cursor-pointer items-center gap-2 text-caption text-text opacity-80 hover:opacity-100"
      >
        {isKnowledge && (
          <KnowledgeIcon type={source.type} className="h-3 w-3" />
        )}
        <span className="text-caption">{label}</span>
      </summary>
      <div className="mt-2 rounded-md border border-border bg-surface px-2 py-2 text-xs text-text-muted">
        <p className="whitespace-pre-wrap text-xs text-text-muted">{content}</p>
        {(page != null || lineFrom != null || url) && (
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-text-subtle">
            {page != null && (
              <span className="rounded-md border border-border bg-surface2 px-2 py-0.5">
                {`Page ${page}`}
              </span>
            )}
            {lineFrom != null && lineTo != null && (
              <span className="rounded-md border border-border bg-surface2 px-2 py-0.5">
                {`Line ${lineFrom} - ${lineTo}`}
              </span>
            )}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  onSourceNavigate && onSourceNavigate(source)
                }}
                className="rounded-md border border-border bg-surface2 px-2 py-0.5 text-text-subtle hover:text-text"
              >
                {t("sourceOpen", "Open source")}
              </a>
            )}
          </div>
        )}
      </div>
    </details>
  )
}

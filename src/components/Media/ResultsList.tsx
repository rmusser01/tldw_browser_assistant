import { FileText, Loader2, Star } from 'lucide-react'
import { Tooltip, Button } from 'antd'
import { useTranslation } from 'react-i18next'

interface Result {
  id: string | number
  title?: string
  kind: 'media' | 'note'
  snippet?: string
  keywords?: string[]
  meta?: {
    type?: string
    source?: string | null
    duration?: number | null
    status?: any
  }
}

interface ResultsListProps {
  results: Result[]
  selectedId: string | number | null
  onSelect: (id: string | number) => void
  totalCount: number
  loadedCount: number
  isLoading?: boolean
  hasActiveFilters?: boolean
  onClearFilters?: () => void
  favorites?: Set<string>
  onToggleFavorite?: (id: string) => void
}

export function ResultsList({
  results,
  selectedId,
  onSelect,
  totalCount,
  loadedCount,
  isLoading = false,
  hasActiveFilters = false,
  onClearFilters,
  favorites,
  onToggleFavorite
}: ResultsListProps) {
  const { t } = useTranslation(['review'])

  const buildInspectorTooltip = (result: Result) => {
    const title = result.title || `${result.kind} ${result.id}`
    const lines: Array<{
      label: string
      value: string
      multiline?: boolean
      preserveWhitespace?: boolean
    }> = [
      {
        label: t('mediaPage.titleLabel', 'Title'),
        value: title
      },
      {
        label: t('mediaPage.typeLabel', 'Type'),
        value: result.meta?.type || result.kind
      }
    ]
    if (result.meta?.source) {
      lines.push({
        label: t('mediaPage.source', 'Source'),
        value: result.meta.source
      })
    }
    if (result.snippet) {
      lines.push({
        label: t('mediaPage.previewLabel', 'Preview'),
        value: result.snippet,
        multiline: true,
        preserveWhitespace: true
      })
    }
    if (Array.isArray(result.keywords) && result.keywords.length > 0) {
      lines.push({
        label: t('mediaPage.keywords', 'Keywords'),
        value: result.keywords.join(', '),
        multiline: true
      })
    }

    return (
      <div className="space-y-1 text-xs max-w-xs">
        {lines.map((line, index) => (
          <div
            key={`${line.label}-${index}`}
            className={line.multiline ? "flex flex-col gap-1" : "flex gap-1"}
          >
            <span className="font-medium text-text">{line.label}:</span>
            <span
              className={
                line.multiline
                  ? `text-text-subtle break-words line-clamp-4 ${
                      line.preserveWhitespace ? "whitespace-pre-wrap" : "whitespace-normal"
                    }`
                  : "text-text-subtle break-words"
              }
            >
              {line.value}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Results Header */}
      <div className="px-4 py-2 bg-surface2 border-b border-border flex items-center justify-between sticky top-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted font-medium uppercase">
            {t('mediaPage.results', 'Results')}
          </span>
          <span className="text-xs text-text">
            {loadedCount} / {totalCount}
          </span>
        </div>
      </div>

      {/* Results List */}
      <div className="divide-y divide-border">
        {/* Skeleton loading */}
        {isLoading && results.length === 0 ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-4 py-2.5 animate-pulse">
                <div className="flex items-start gap-2.5">
                  <div className="w-4 h-4 bg-surface2 rounded mt-0.5" />
                  <div className="flex-1">
                    <div className="flex gap-1.5 mb-1">
                      <div className="w-12 h-4 bg-surface2 rounded" />
                      <div className="w-16 h-4 bg-surface2 rounded" />
                    </div>
                    <div className="w-3/4 h-4 bg-surface2 rounded mb-1" />
                    <div className="w-1/2 h-3 bg-surface2 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : results.length === 0 && !isLoading ? (
          <div className="px-4 py-6 text-center">
            {hasActiveFilters ? (
              <>
                <p className="text-text-muted text-sm mb-2">
                  {t('mediaPage.noMatchingResults', 'No results match your filters')}
                </p>
                {onClearFilters && (
                  <Button size="small" onClick={onClearFilters}>
                    {t('mediaPage.clearFilters', 'Clear filters')}
                  </Button>
                )}
              </>
            ) : (
              <p className="text-text-muted text-sm">
                {t('mediaPage.noResults', 'No results found')}
              </p>
            )}
          </div>
        ) : (
          results.map((result) => (
            <div
              role="button"
              tabIndex={0}
              key={result.id}
              onClick={() => onSelect(result.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(result.id)
                }
              }}
              aria-label={t('mediaPage.selectResult', 'Select {{type}}: {{title}}', {
                type: result.kind,
                title: result.title || `${result.kind} ${result.id}`
              })}
              aria-selected={selectedId === result.id}
              className={`w-full py-2.5 text-left hover:bg-surface2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset cursor-pointer ${
                selectedId === result.id
                  ? 'bg-surface2 border-l-4 border-l-primary px-3'
                  : 'px-4'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex flex-col items-center gap-1">
                  <FileText className="w-4 h-4 text-text-subtle" />
                  {onToggleFavorite && (
                    <Tooltip title={favorites?.has(String(result.id)) ? t('mediaPage.unfavorite', 'Remove from favorites') : t('mediaPage.favorite', 'Add to favorites')}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleFavorite(String(result.id))
                        }}
                        className="p-0.5 hover:bg-surface2 rounded transition-colors"
                        aria-label={favorites?.has(String(result.id)) ? t('mediaPage.unfavorite', 'Remove from favorites') : t('mediaPage.favorite', 'Add to favorites')}
                        title={favorites?.has(String(result.id)) ? t('mediaPage.unfavorite', 'Remove from favorites') : t('mediaPage.favorite', 'Add to favorites')}
                      >
                        <Star className={`w-3.5 h-3.5 ${
                          favorites?.has(String(result.id))
                            ? 'text-warn fill-warn'
                            : 'text-text-subtle'
                        }`} />
                      </button>
                    </Tooltip>
                  )}
                </div>
                <Tooltip placement="right" title={buildInspectorTooltip(result)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primaryStrong">
                        {result.kind.toUpperCase()}
                      </span>
                    {result.meta?.type && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-surface2 text-text capitalize">
                        {result.meta.type}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-text truncate font-medium">
                    {result.title || `${result.kind} ${result.id}`}
                  </div>
                  {result.snippet && (
                    <div className="text-xs text-text-muted mt-0.5 line-clamp-1">
                      {result.snippet}
                    </div>
                  )}
                  {Array.isArray(result.keywords) && result.keywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {result.keywords.slice(0, 5).map((keyword, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-surface2 text-text line-clamp-1 max-w-[120px]"
                          title={keyword}
                        >
                          {keyword}
                        </span>
                      ))}
                      {result.keywords.length > 5 && (
                        <Tooltip
                          title={t('mediaPage.moreTags', '+{{count}} more tags', { count: result.keywords.length - 5 })}
                        >
                          <span className="inline-flex items-center px-2 py-0.5 text-xs text-text-muted">
                            +{result.keywords.length - 5}
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  )}
                    {result.meta?.source && (
                      <div className="text-xs text-text-subtle mt-0.5">
                        {result.meta.source}
                      </div>
                    )}
                  </div>
                </Tooltip>
              </div>
            </div>
          ))
        )}
        {/* Loading indicator */}
        {isLoading && (
          <div className="px-4 py-3 text-center text-text-muted flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">{t('mediaPage.loadingMore', 'Loading more results...')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

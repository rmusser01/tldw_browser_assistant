import React from "react"
import { Button, List, Select, Tag, Typography } from "antd"
import type { TFunction } from "i18next"
import type {
  ResultFilters,
  ResultItem,
  ResultItemWithMediaId,
  ResultSummary,
  ResultsFilter
} from "@/components/Common/QuickIngest/types"
import { ResultsListItem } from "@/components/Common/QuickIngest/ResultsListItem"

type ResultsPanelProps = {
  data: {
    results: ResultItem[]
    visibleResults: ResultItem[]
    resultSummary: ResultSummary | null
    running: boolean
    filters: {
      value: ResultsFilter
      options: ResultFilters
      onChange: (value: ResultsFilter) => void
    }
  }
  context: {
    shouldStoreRemote: boolean
    firstResultWithMedia?: ResultItem | null
    reviewBatchId?: string | null
    processOnly: boolean
    mediaIdFromPayload: (payload: unknown) => string | number | null
  }
  actions: {
    retryFailedUrls: () => void
    tryOpenContentReview: (batchId: string) => void | Promise<void>
    openInMediaViewer: (item: ResultItem) => void
    discussInChat: (item: ResultItem) => void
    downloadJson: (item: ResultItem) => void
    openHealthDiagnostics: () => void
  }
  i18n: {
    qi: (key: string, defaultValue: string, options?: Record<string, any>) => string
    t: TFunction
  }
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  data,
  context,
  actions,
  i18n
}) => {
  const { results, visibleResults, resultSummary, running, filters } = data
  const {
    shouldStoreRemote,
    firstResultWithMedia,
    reviewBatchId,
    processOnly,
    mediaIdFromPayload
  } = context
  const {
    retryFailedUrls,
    tryOpenContentReview,
    openInMediaViewer,
    discussInChat,
    downloadJson,
    openHealthDiagnostics
  } = actions
  const { qi, t } = i18n

  const resultsWithMediaIds = React.useMemo<ResultItemWithMediaId[]>(() => {
    return results.map((item) => {
      const mediaId =
        item.status === "ok" && shouldStoreRemote
          ? mediaIdFromPayload(item.data)
          : null

      return {
        ...item,
        mediaId
      }
    })
  }, [results, shouldStoreRemote, mediaIdFromPayload])

  const mediaIdCache = React.useMemo(() => {
    return new Map<string, ResultItemWithMediaId["mediaId"]>(
      resultsWithMediaIds.map((item) => [item.id, item.mediaId])
    )
  }, [resultsWithMediaIds])

  const visibleResultsWithMediaIds = React.useMemo<ResultItemWithMediaId[]>(() => {
    return visibleResults.map((item) => ({
      ...item,
      mediaId: mediaIdCache.get(item.id) ?? null
    }))
  }, [mediaIdCache, visibleResults])
  const hasErrors = React.useMemo(
    () => results.some((item) => item.status === "error"),
    [results]
  )
  const handleRetryClick = React.useCallback(() => {
    retryFailedUrls()
  }, [retryFailedUrls])
  const handleFilterChange = React.useCallback(
    (value: ResultsFilter | string) => {
      filters.onChange(value as ResultsFilter)
    },
    [filters]
  )
  const handleOpenFirstInMedia = React.useCallback(() => {
    if (!firstResultWithMedia) return
    openInMediaViewer(firstResultWithMedia)
  }, [firstResultWithMedia, openInMediaViewer])
  const handleOpenContentReview = React.useCallback(() => {
    if (!reviewBatchId) return
    void tryOpenContentReview(reviewBatchId)
  }, [reviewBatchId, tryOpenContentReview])
  const renderResultItem = React.useCallback(
    (item: ResultItemWithMediaId) => (
      <ResultsListItem
        item={item}
        processOnly={processOnly}
        onDownloadJson={downloadJson}
        onOpenMedia={openInMediaViewer}
        onDiscussInChat={discussInChat}
        t={t}
      />
    ),
    [processOnly, downloadJson, openInMediaViewer, discussInChat, t]
  )

  if (results.length === 0) return null

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <Typography.Title level={5} className="!mb-0">
          {t("quickIngest.results") || "Results"}
        </Typography.Title>
        <div className="flex items-center gap-2 text-xs">
          <Tag color="blue">
            {qi("resultsCount", "{{count}} item(s)", {
              count: results.length
            })}
          </Tag>
          <Button
            size="small"
            onClick={handleRetryClick}
            disabled={!hasErrors}
          >
            {qi("retryFailedUrls", "Retry failed URLs")}
          </Button>
          <Select
            size="small"
            className="w-32"
            aria-label={t(
              "quickIngest.resultsFilterAria",
              "Filter results by status"
            )}
            value={filters.value}
            onChange={handleFilterChange}
            options={[
              {
                value: filters.options.ALL,
                label: t("quickIngest.resultsFilterAll", "All")
              },
              {
                value: filters.options.ERROR,
                label: t("quickIngest.resultsFilterFailed", "Failed only")
              },
              {
                value: filters.options.SUCCESS,
                label: t("quickIngest.resultsFilterSucceeded", "Succeeded only")
              }
            ]}
          />
        </div>
      </div>
      {resultSummary && !running && (
        <div className="mt-2 rounded-md border border-border bg-surface2 px-3 py-2 text-xs text-text">
          <div className="font-medium">
            {resultSummary.failCount === 0
              ? t(
                  "quickIngest.summaryAllSucceeded",
                  "Quick ingest completed successfully."
                )
              : t(
                  "quickIngest.summarySomeFailed",
                  "Quick ingest completed with some errors."
                )}
          </div>
          <div className="mt-1">
            {t("quickIngest.summaryCounts", "{{success}} succeeded \u00b7 {{failed}} failed", {
              success: resultSummary.successCount,
              failed: resultSummary.failCount
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {shouldStoreRemote && firstResultWithMedia && (
              <Button
                size="small"
                type="primary"
                data-testid="quick-ingest-open-media-primary"
                aria-label={t(
                  "quickIngest.openFirstInMediaAria",
                  "Open first result in media viewer"
                )}
                onClick={handleOpenFirstInMedia}
              >
                {t("quickIngest.openFirstInMedia", "Open in Media viewer")}
              </Button>
            )}
            {reviewBatchId ? (
              <Button
                size="small"
                type="primary"
                aria-label={qi(
                  "openContentReviewAria",
                  "Open Content Review for batch"
                )}
                onClick={handleOpenContentReview}
              >
                {qi("openContentReview", "Open Content Review")}
              </Button>
            ) : null}
            {resultSummary.failCount > 0 && (
              <Button
                size="small"
                onClick={handleRetryClick}
                aria-label={qi("retryFailedUrlsAria", "Retry all failed URLs")}
              >
                {qi("retryFailedUrls", "Retry failed URLs")}
              </Button>
            )}
            <Button
              size="small"
              type="default"
              onClick={openHealthDiagnostics}
              aria-label={t(
                "settings:healthSummary.diagnosticsAria",
                "Open health and diagnostics"
              )}
            >
              {t("settings:healthSummary.diagnostics", "Health & diagnostics")}
            </Button>
          </div>
        </div>
      )}
      <List
        size="small"
        dataSource={visibleResultsWithMediaIds}
        renderItem={renderResultItem}
      />
    </div>
  )
}

export default ResultsPanel

import React from "react"
import { Button, List, Select, Tag, Typography } from "antd"
import type { TFunction } from "i18next"

type ResultItem = {
  id: string
  status: "ok" | "error"
  url?: string
  fileName?: string
  type: string
  data?: unknown
  error?: string
}

type ResultSummary = {
  successCount: number
  failCount: number
}

type ResultFilters = {
  ALL: string
  ERROR: string
  SUCCESS: string
}

type ResultsFilter = ResultFilters[keyof ResultFilters]

type ResultsPanelProps = {
  results: ResultItem[]
  visibleResults: ResultItem[]
  resultsFilter: ResultsFilter
  setResultsFilter: (value: ResultsFilter) => void
  resultFilters: ResultFilters
  retryFailedUrls: () => void
  resultSummary: ResultSummary | null
  running: boolean
  shouldStoreRemote: boolean
  firstResultWithMedia?: ResultItem | null
  reviewBatchId?: string | null
  tryOpenContentReview: (batchId: string) => void | Promise<void>
  openInMediaViewer: (item: ResultItem) => void
  discussInChat: (item: ResultItem) => void
  downloadJson: (item: ResultItem) => void
  openHealthDiagnostics: () => void
  mediaIdFromPayload: (payload: unknown) => string | number | null
  processOnly: boolean
  qi: (key: string, defaultValue: string, options?: Record<string, any>) => string
  t: TFunction
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  results,
  visibleResults,
  resultsFilter,
  setResultsFilter,
  resultFilters,
  retryFailedUrls,
  resultSummary,
  running,
  shouldStoreRemote,
  firstResultWithMedia,
  reviewBatchId,
  tryOpenContentReview,
  openInMediaViewer,
  discussInChat,
  downloadJson,
  openHealthDiagnostics,
  mediaIdFromPayload,
  processOnly,
  qi,
  t
}) => {
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
            onClick={retryFailedUrls}
            disabled={!results.some((item) => item.status === "error")}
          >
            {qi("retryFailedUrls", "Retry failed URLs")}
          </Button>
          <Select
            size="small"
            className="w-32"
            aria-label={t(
              "quickIngest.resultsFilterAria",
              "Filter results by status"
            ) as string}
            value={resultsFilter}
            onChange={(value) => setResultsFilter(value as ResultsFilter)}
            options={[
              {
                value: resultFilters.ALL,
                label: t("quickIngest.resultsFilterAll", "All")
              },
              {
                value: resultFilters.ERROR,
                label: t("quickIngest.resultsFilterFailed", "Failed only")
              },
              {
                value: resultFilters.SUCCESS,
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
            {t("quickIngest.summaryCounts", "{{success}} succeeded \\u00b7 {{failed}} failed", {
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
                onClick={() => {
                  openInMediaViewer(firstResultWithMedia)
                }}
              >
                {t("quickIngest.openFirstInMedia", "Open in Media viewer")}
              </Button>
            )}
            {reviewBatchId ? (
              <Button
                size="small"
                type="primary"
                onClick={() => {
                  if (!reviewBatchId) return
                  void tryOpenContentReview(reviewBatchId)
                }}
              >
                {qi("openContentReview", "Open Content Review")}
              </Button>
            ) : null}
            {resultSummary.failCount > 0 && (
              <Button size="small" onClick={retryFailedUrls}>
                {qi("retryFailedUrls", "Retry failed URLs")}
              </Button>
            )}
            <Button size="small" type="default" onClick={openHealthDiagnostics}>
              {t("settings:healthSummary.diagnostics", "Health & diagnostics")}
            </Button>
          </div>
        </div>
      )}
      <List
        size="small"
        dataSource={visibleResults}
        renderItem={(item) => {
          const mediaId =
            item.status === "ok" && shouldStoreRemote
              ? mediaIdFromPayload(item.data)
              : null
          const hasMediaId = mediaId != null
          const actions: React.ReactNode[] = []
          if (processOnly && item.status === "ok") {
            actions.push(
              <button
                key="dl"
                type="button"
                onClick={() => downloadJson(item)}
                aria-label={`Download JSON for ${
                  item.url || item.fileName || "item"
                }`}
                className="text-primary hover:underline"
              >
                {t("quickIngest.downloadJson") || "Download JSON"}
              </button>
            )
          }
          if (hasMediaId) {
            actions.push(
              <button
                key="open-media"
                type="button"
                onClick={() => openInMediaViewer(item)}
                className="text-primary hover:underline"
              >
                {t("quickIngest.openInMedia", "Open in Media viewer")}
              </button>
            )
            actions.push(
              <button
                key="discuss-chat"
                type="button"
                onClick={() => discussInChat(item)}
                className="text-primary hover:underline"
              >
                {t("quickIngest.discussInChat", "Discuss in chat")}
              </button>
            )
          }
          return (
            <List.Item actions={actions}>
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <Tag color={item.status === "ok" ? "green" : "red"}>
                    {item.status.toUpperCase()}
                  </Tag>
                  <span>{item.type.toUpperCase()}</span>
                </div>
                <div className="text-xs text-text-subtle break-all">
                  {item.url || item.fileName}
                </div>
                {hasMediaId ? (
                  <div className="text-[11px] text-text-subtle">
                    {t("quickIngest.savedAsMedia", "Saved as media {{id}}", {
                      id: String(mediaId)
                    })}
                  </div>
                ) : null}
                {item.error ? (
                  <div className="text-xs text-danger">{item.error}</div>
                ) : null}
              </div>
            </List.Item>
          )
        }}
      />
    </div>
  )
}

export default ResultsPanel

import React from "react"
import type { TFunction } from "i18next"
import { ResultsPanel } from "../ResultsPanel"
import type { ResultItem, ResultsFilter, ResultFilters, ResultSummary } from "../types"

type ResultsTabProps = {
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
    requeueFailed: () => void
    exportFailedList: () => void
    tryOpenContentReview: (batchId: string) => void | Promise<void>
    openInMediaViewer: (item: ResultItem) => void
    discussInChat: (item: ResultItem) => void
    downloadJson: (item: ResultItem) => void
    openHealthDiagnostics: () => void
  }
  i18n: {
    qi: (key: string, defaultValue: string, options?: Record<string, unknown>) => string
    t: TFunction
  }
}

export const ResultsTab: React.FC<ResultsTabProps> = ({
  data,
  context,
  actions,
  i18n
}) => {
  return (
    <div
      role="tabpanel"
      id="quick-ingest-panel-results"
      aria-labelledby="quick-ingest-tab-results"
      className="py-3"
    >
      <React.Suspense fallback={null}>
        <ResultsPanel
          data={data}
          context={context}
          actions={actions}
          i18n={i18n}
        />
      </React.Suspense>
    </div>
  )
}

export default ResultsTab

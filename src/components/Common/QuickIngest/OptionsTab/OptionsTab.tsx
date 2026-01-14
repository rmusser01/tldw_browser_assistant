import React from "react"
import type { TFunction } from "i18next"
import { IngestOptionsPanel } from "../IngestOptionsPanel"

type CommonOptions = {
  perform_analysis: boolean
  perform_chunking: boolean
  overwrite_existing: boolean
}

type TypeDefaults = {
  audio?: { language?: string; diarize?: boolean }
  document?: { ocr?: boolean }
  video?: { captions?: boolean }
}

type ProgressMeta = {
  total: number
  done: number
  pct: number
  elapsedLabel?: string | null
}

type OptionsTabProps = {
  qi: (
    key: string,
    defaultValue: string,
    options?: Record<string, unknown>
  ) => string
  t: TFunction
  hasAudioItems: boolean
  hasDocumentItems: boolean
  hasVideoItems: boolean
  running: boolean
  ingestBlocked: boolean
  common: CommonOptions
  setCommon: React.Dispatch<React.SetStateAction<CommonOptions>>
  normalizedTypeDefaults: TypeDefaults
  setTypeDefaults: React.Dispatch<React.SetStateAction<TypeDefaults | null>>
  ragEmbeddingLabel?: string | null
  openModelSettings: () => void
  storeRemote: boolean
  setStoreRemote: (value: boolean) => void
  reviewBeforeStorage: boolean
  handleReviewToggle: (value: boolean) => void
  storageLabel: string
  storageHintSeen: boolean
  setStorageHintSeen: (value: boolean) => void
  draftStorageCapLabel: string
  doneCount: number
  totalCount: number
  plannedCount: number
  progressMeta: ProgressMeta
  showProcessQueuedButton: boolean
  run: () => void
  hasMissingFiles: boolean
  missingFileCount: number
  ingestConnectionStatus:
    | "online"
    | "offline"
    | "unconfigured"
    | "offlineBypass"
    | "unknown"
  checkOnce?: () => Promise<void> | void
  disableOfflineBypass?: () => Promise<void>
  onClose: () => void
}

export const OptionsTab: React.FC<OptionsTabProps> = (props) => {
  return (
    <div
      role="tabpanel"
      id="quick-ingest-panel-options"
      aria-labelledby="quick-ingest-tab-options"
      className="py-3"
    >
      <React.Suspense fallback={null}>
        <IngestOptionsPanel {...props} />
      </React.Suspense>
    </div>
  )
}

export default OptionsTab

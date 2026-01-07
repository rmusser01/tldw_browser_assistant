import React from "react"
import { useTranslation } from "react-i18next"
import {
  ChevronDown,
  ChevronUp,
  ImageIcon,
  FileText,
  Globe,
  X,
  Trash2
} from "lucide-react"
import { Image, Switch, Tooltip } from "antd"
import { DocumentChip } from "@/components/Common/Playground/DocumentChip"

interface Document {
  id: number
  title: string
  url: string
  favIconUrl?: string
}

interface UploadedFile {
  id: string
  filename: string
  size: number
}

interface AttachmentsSummaryProps {
  /** Base64 image string */
  image: string
  /** Selected browser tabs/documents */
  documents: Document[]
  /** Uploaded files */
  files: UploadedFile[]
  /** Whether file retrieval (RAG) is enabled */
  fileRetrievalEnabled: boolean
  /** Callback to toggle file retrieval */
  onFileRetrievalChange: (enabled: boolean) => void
  /** Callback to remove the image */
  onRemoveImage: () => void
  /** Callback to remove a document */
  onRemoveDocument: (id: number) => void
  /** Callback to clear all documents */
  onClearDocuments: () => void
  /** Callback to remove a file */
  onRemoveFile: (id: string) => void
  /** Callback to clear all files */
  onClearFiles: () => void
}

export const AttachmentsSummary: React.FC<AttachmentsSummaryProps> = ({
  image,
  documents,
  files,
  fileRetrievalEnabled,
  onFileRetrievalChange,
  onRemoveImage,
  onRemoveDocument,
  onClearDocuments,
  onRemoveFile,
  onClearFiles
}) => {
  const { t } = useTranslation(["playground", "common", "option"])
  const [expanded, setExpanded] = React.useState(false)

  const imageCount = image ? 1 : 0
  const docCount = documents.length
  const fileCount = files.length
  const totalCount = imageCount + docCount + fileCount

  if (totalCount === 0) {
    return null
  }

  const formatFileSize = (bytes: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "unit",
      unit: "megabyte",
      maximumFractionDigits: 2
    }).format(bytes / (1024 * 1024))
  }

  const handleClearAll = () => {
    if (image) onRemoveImage()
    if (documents.length > 0) onClearDocuments()
    if (files.length > 0) onClearFiles()
  }

  return (
    <div className="border-b border-border/70">
      {/* Collapsed summary bar */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-surface2/50"
        aria-expanded={expanded}
        aria-controls="attachments-panel"
        title={`${t("playground:attachments.title", "Attachments")} (${totalCount})`}
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-subtle">
            {t("playground:attachments.title", "Attachments")} ({totalCount})
          </span>
          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            {imageCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <ImageIcon className="h-3 w-3" aria-hidden="true" />
                {imageCount}
              </span>
            )}
            {fileCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3 w-3" aria-hidden="true" />
                {fileCount}
              </span>
            )}
            {docCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Globe className="h-3 w-3" aria-hidden="true" />
                {docCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip title={t("playground:attachments.clearAll", "Clear all")}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClearAll()
              }}
              className="rounded p-1 text-text-subtle hover:bg-surface2 hover:text-text"
              aria-label={t("playground:attachments.clearAll", "Clear all") as string}
              title={t("playground:attachments.clearAll", "Clear all") as string}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-text-subtle" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-subtle" />
          )}
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div
          id="attachments-panel"
          className="space-y-3 px-3 pb-3"
        >
          {/* Image section */}
          {image && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-text-muted">
                <span className="font-medium">
                  {t("playground:attachments.image", "Image")}
                </span>
                <button
                  type="button"
                  onClick={onRemoveImage}
                  className="text-text-subtle hover:text-text"
                  aria-label={t("common:remove", "Remove") as string}
                  title={t("common:remove", "Remove") as string}
                >
                  {t("common:remove", "Remove")}
                </button>
              </div>
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={onRemoveImage}
                  className="absolute -top-1 -left-1 z-10 flex items-center justify-center rounded-full border border-border bg-surface p-0.5 text-text hover:bg-surface2"
                  aria-label={t("common:remove", "Remove") as string}
                  title={t("common:remove", "Remove") as string}
                >
                  <X className="h-3 w-3" />
                </button>
                <Image
                  src={image}
                  alt="Attached image"
                  preview={false}
                  className="rounded-md max-h-20"
                />
              </div>
            </div>
          )}

          {/* Tabs/Documents section */}
          {documents.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-text-muted">
                <span className="font-medium">
                  {t("playground:attachments.tabs", "Browser tabs")} ({documents.length})
                </span>
                <button
                  type="button"
                  onClick={onClearDocuments}
                  className="text-text-subtle hover:text-text"
                  title={t("playground:composer.clearTabs", "Remove all") as string}
                >
                  {t("playground:composer.clearTabs", "Remove all")}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {documents.map((doc) => (
                  <DocumentChip
                    key={doc.id}
                    document={doc}
                    variant="compact"
                    onRemove={onRemoveDocument}
                    removeLabel={t("option:remove", "Remove") as string}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Files section */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-text-muted">
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {t("playground:attachments.files", "Files")} ({files.length})
                  </span>
                  <Tooltip title={t("fileRetrievalEnabled", "Enable Knowledge Search for Documents")}>
                    <div className="inline-flex items-center gap-1.5">
                      <Switch
                        size="small"
                        checked={fileRetrievalEnabled}
                        onChange={onFileRetrievalChange}
                        aria-label={t("fileRetrievalEnabled") as string}
                      />
                      <span className="text-[10px]">
                        {t("playground:attachments.rag", "RAG")}
                      </span>
                    </div>
                  </Tooltip>
                </div>
                <button
                  type="button"
                  onClick={onClearFiles}
                  className="text-text-subtle hover:text-text"
                  title={t("playground:composer.clearFiles", "Remove all") as string}
                >
                  {t("playground:composer.clearFiles", "Remove all")}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="group relative flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs"
                  >
                    <FileText className="h-3.5 w-3.5 text-text-subtle" />
                    <div className="flex flex-col">
                      <span className="font-medium text-text line-clamp-1 max-w-[150px]">
                        {file.filename}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveFile(file.id)}
                      className="absolute -top-1 -right-1 invisible rounded-full border border-border bg-surface p-0.5 text-text shadow-sm group-hover:visible hover:bg-surface2"
                      aria-label={t("common:remove", "Remove") as string}
                      title={t("common:remove", "Remove") as string}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

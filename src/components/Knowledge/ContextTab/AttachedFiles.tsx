import React from "react"
import { Plus, Trash2, X, FileText, FileImage, FileCode, File } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { UploadedFile } from "@/db/dexie/types"

type AttachedFilesProps = {
  files: UploadedFile[]
  onAdd: () => void
  onRemove: (fileId: string) => void
  onClear: () => void
}

/**
 * Get icon for file type
 */
const getFileIcon = (type: string) => {
  if (type.startsWith("image/")) return FileImage
  if (type.includes("pdf") || type.includes("document")) return FileText
  if (
    type.includes("javascript") ||
    type.includes("typescript") ||
    type.includes("json") ||
    type.includes("xml") ||
    type.includes("html") ||
    type.includes("css")
  )
    return FileCode
  return File
}

/**
 * Format file size
 */
const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * AttachedFiles - Files attached as context
 */
export const AttachedFiles: React.FC<AttachedFilesProps> = ({
  files,
  onAdd,
  onRemove,
  onClear
}) => {
  const { t } = useTranslation(["sidepanel"])

  return (
    <div className="rounded border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface2/50">
        <span className="text-xs font-semibold text-text">
          {t("sidepanel:rag.files", "Files")}
          {files.length > 0 && (
            <span className="ml-1.5 text-text-muted">({files.length})</span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onAdd}
            className="p-1 text-text-muted hover:text-text transition-colors rounded hover:bg-surface3"
            aria-label={t("sidepanel:rag.addFile", "Add file")}
            title={t("sidepanel:rag.addFile", "Add file")}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {files.length > 0 && (
            <button
              onClick={onClear}
              className="p-1 text-text-muted hover:text-red-500 transition-colors rounded hover:bg-surface3"
              aria-label={t("sidepanel:rag.clearFiles", "Clear all files")}
              title={t("sidepanel:rag.clearFiles", "Clear all files")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        {files.length > 0 ? (
          <div className="space-y-1.5">
            {files.map((file) => {
              const FileIcon = getFileIcon(file.type)
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface2/50 group"
                >
                  <FileIcon className="h-4 w-4 text-text-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-text truncate block">
                      {file.filename}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {formatSize(file.size)}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemove(file.id)}
                    className="p-0.5 text-text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label={t("sidepanel:rag.removeFile", "Remove file")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <button
            onClick={onAdd}
            className="w-full py-2 text-xs text-text-muted hover:text-text transition-colors rounded border border-dashed border-border hover:border-accent"
          >
            {t("sidepanel:rag.clickToAddFile", "Click to add a file...")}
          </button>
        )}
      </div>
    </div>
  )
}

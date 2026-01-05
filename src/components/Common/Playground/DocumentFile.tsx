import React from "react"
import { FileIcon, Globe } from "lucide-react"

interface DocumentFileProps {
  document: {
    filename: string
    fileSize: number
  }
}

export const DocumentFile: React.FC<DocumentFileProps> = ({ document }) => {
  return (
    <div
      className="relative group max-w-80 w-full flex items-center gap-1 rounded-2xl border border-border bg-surface p-2 text-left text-text hover:bg-surface2"
      title={document.filename}>
      <div className="rounded-xl bg-surface2 p-3 text-text">
        <FileIcon className="size-5 text-text" />
      </div>
      <div className="flex flex-col justify-center -space-y-1 px-3 w-full">
        <div className="mb-1 line-clamp-1 text-sm font-medium text-text">
          {document.filename}
        </div>
        <div className="flex justify-between text-xs text-text-muted line-clamp-1">
          File{" "}
          <span className="capitalize">
            {new Intl.NumberFormat(undefined, {
              style: "unit",
              unit: "megabyte",
              maximumFractionDigits: 2
            }).format(document.fileSize / (1024 * 1024))}
          </span>
        </div>
      </div>
    </div>
  )
}

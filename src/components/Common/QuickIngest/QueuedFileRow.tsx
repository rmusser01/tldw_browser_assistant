import React from "react"
import { Button, Tag, Typography } from "antd"
import { Info } from "lucide-react"
import type { StatusSummary } from "./types"

type QueuedFileStub = {
  id: string
  name: string
  size: number
  type?: string
}

type QueuedFileRowProps = {
  stub: QueuedFileStub
  isSelected: boolean
  status: StatusSummary
  fileType: string
  sizeLabel: string
  runTag?: React.ReactNode
  pendingTag?: React.ReactNode
  processingIndicator?: React.ReactNode
  running: boolean
  showReattach: boolean
  canRetry: boolean
  qi: (key: string, defaultValue: string) => string
  typeIcon: (type: string) => React.ReactNode
  onSelect: () => void
  onOpenInspector: () => void
  onReattach: () => void
  onRetry: () => void
  onRemove: () => void
}

export const QueuedFileRow: React.FC<QueuedFileRowProps> = ({
  stub,
  isSelected,
  status,
  fileType,
  sizeLabel,
  runTag,
  pendingTag,
  processingIndicator,
  running,
  showReattach,
  canRetry,
  qi,
  typeIcon,
  onSelect,
  onOpenInspector,
  onReattach,
  onRetry,
  onRemove
}) => {
  return (
    <div
      className={`group relative rounded-md border px-3 py-2 transition hover:border-primary ${
        isSelected ? "border-primary shadow-sm" : "border-border"
      }`}
      onClick={onSelect}
    >
      <Button
        size="small"
        type="text"
        className={`absolute right-2 top-2 opacity-0 transition focus:opacity-100 group-hover:opacity-100 ${
          isSelected ? "opacity-100" : ""
        }`}
        aria-label={qi("openFileInspectorAria", "Open Inspector for this file")}
        title={qi("openFileInspectorAria", "Open Inspector for this file")}
        onClick={(event) => {
          event.stopPropagation()
          onOpenInspector()
        }}
      >
        <Info className="w-4 h-4 text-text-subtle" />
      </Button>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {typeIcon(fileType)}
          <div className="flex flex-col">
            <Typography.Text className="text-sm font-medium truncate max-w-[360px]">
              {stub.name}
            </Typography.Text>
            <div className="flex items-center gap-2 text-[11px] text-text-subtle">
              <Tag color="geekblue">{fileType.toUpperCase()}</Tag>
              <span>
                {sizeLabel} {stub.type ? `\u00b7 ${stub.type}` : ""}
              </span>
              {status.reason ? (
                <span className="text-orange-600">{status.reason}</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tag color={status.color === "default" ? undefined : status.color}>
            {status.label}
          </Tag>
          {runTag}
          {pendingTag}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
        {showReattach && (
          <Button
            size="small"
            onClick={(event) => {
              event.stopPropagation()
              onReattach()
            }}
            disabled={running}
            aria-label={qi("reattachFileAria", "Reattach this file")}
            title={qi("reattachFileAria", "Reattach this file")}
          >
            {qi("reattachFile", "Reattach")}
          </Button>
        )}
        {canRetry && (
          <Button
            size="small"
            onClick={(event) => {
              event.stopPropagation()
              onRetry()
            }}
            disabled={running}
            aria-label={qi("retryItemAria", "Retry this item")}
            title={qi("retryItemAria", "Retry this item")}
          >
            {qi("retryItem", "Retry")}
          </Button>
        )}
        <Button
          size="small"
          danger
          aria-label={qi("removeFileAria", "Remove this file from queue")}
          title={qi("removeFileAria", "Remove this file from queue")}
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          disabled={running}
        >
          {qi("removeFile", "Remove")}
        </Button>
      </div>
      {processingIndicator}
    </div>
  )
}

export default QueuedFileRow

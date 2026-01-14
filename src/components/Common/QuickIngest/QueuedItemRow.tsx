import React from "react"
import { Button, Input, Select, Tag, Typography } from "antd"
import { Info } from "lucide-react"
import type { StatusSummary } from "./types"

type EntryType = "auto" | "html" | "pdf" | "document" | "audio" | "video"

type Entry = {
  id: string
  url: string
  type: EntryType
}

type QueuedItemRowProps = {
  row: Entry
  isSelected: boolean
  detectedType: string
  status: StatusSummary
  runTag?: React.ReactNode
  pendingTag?: React.ReactNode
  processingIndicator?: React.ReactNode
  running: boolean
  queueDisabled: boolean
  canRetry: boolean
  qi: (key: string, defaultValue: string) => string
  typeIcon: (type: string) => React.ReactNode
  onSelect: () => void
  onOpenInspector: () => void
  onUpdateRow: (updates: Partial<Entry>) => void
  onRetry: () => void
  onRemove: () => void
}

export const QueuedItemRow: React.FC<QueuedItemRowProps> = ({
  row,
  isSelected,
  detectedType,
  status,
  runTag,
  pendingTag,
  processingIndicator,
  running,
  queueDisabled,
  canRetry,
  qi,
  typeIcon,
  onSelect,
  onOpenInspector,
  onUpdateRow,
  onRetry,
  onRemove
}) => {
  const inputDisabled = running || queueDisabled

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
        aria-label={qi("openInspectorAria", "Open Inspector for this item")}
        title={qi("openInspectorAria", "Open Inspector for this item")}
        onClick={(event) => {
          event.stopPropagation()
          onOpenInspector()
        }}
      >
        <Info className="w-4 h-4 text-text-subtle" />
      </Button>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {typeIcon(detectedType)}
          <div className="flex flex-col">
            <Typography.Text className="text-sm font-medium">
              {row.url ? row.url : qi("untitledUrl", "Untitled URL")}
            </Typography.Text>
            <div className="flex items-center gap-2 text-[11px] text-text-subtle">
              <Tag color="geekblue">{detectedType.toUpperCase()}</Tag>
              {status.reason ? (
                <span className="text-orange-600">{status.reason}</span>
              ) : (
                <span>{qi("defaultsApplied", "Defaults will be applied.")}</span>
              )}
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
      <div className="mt-2 flex flex-col gap-2">
        <Input
          placeholder={qi("urlPlaceholder", "https://...")}
          value={row.url}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onUpdateRow({ url: event.target.value })}
          disabled={inputDisabled}
          aria-label={qi("sourceUrlAria", "Source URL")}
          title={qi("sourceUrlAria", "Source URL")}
        />
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-subtle">
          <Select
            className="min-w-32"
            value={row.type}
            onClick={(event) => event.stopPropagation()}
            onChange={(value) => onUpdateRow({ type: value as EntryType })}
            aria-label={qi("forceMediaType", "Force media type")}
            title={qi("forceMediaType", "Force media type")}
            options={[
              { label: qi("typeAuto", "Auto"), value: "auto" },
              { label: qi("typeHtml", "HTML"), value: "html" },
              { label: qi("typePdf", "PDF"), value: "pdf" },
              { label: qi("typeDocument", "Document"), value: "document" },
              { label: qi("typeAudio", "Audio"), value: "audio" },
              { label: qi("typeVideo", "Video"), value: "video" }
            ]}
            disabled={inputDisabled}
          />
          {canRetry && (
            <Button
              size="small"
              onClick={(event) => {
                event.stopPropagation()
                onRetry()
              }}
              disabled={inputDisabled}
              aria-label={qi("retryItemAria", "Retry this item")}
              title={qi("retryItemAria", "Retry this item")}
            >
              {qi("retryItem", "Retry")}
            </Button>
          )}
          <Button
            size="small"
            danger
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
            disabled={running}
            aria-label={qi("removeItemAria", "Remove this row from queue")}
            title={qi("removeItemAria", "Remove this row from queue")}
          >
            {qi("removeItem", "Remove")}
          </Button>
        </div>
        {processingIndicator}
      </div>
    </div>
  )
}

export default QueuedItemRow

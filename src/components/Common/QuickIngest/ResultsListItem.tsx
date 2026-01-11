import React from "react"
import { Button, List, Tag } from "antd"
import type { TFunction } from "i18next"
import type {
  ResultItem,
  ResultItemWithMediaId
} from "@/components/Common/QuickIngest/types"

type ResultsListItemProps = {
  item: ResultItemWithMediaId
  processOnly: boolean
  onDownloadJson: (item: ResultItem) => void
  onOpenMedia: (item: ResultItem) => void
  onDiscussInChat: (item: ResultItem) => void
  t: TFunction
}

export const ResultsListItem: React.FC<ResultsListItemProps> = React.memo(
  ({ item, processOnly, onDownloadJson, onOpenMedia, onDiscussInChat, t }) => {
    const mediaId = item.mediaId
    const hasMediaId = mediaId != null
    const handleDownloadJson = React.useCallback(() => {
      onDownloadJson(item)
    }, [item, onDownloadJson])
    const handleOpenMedia = React.useCallback(() => {
      onOpenMedia(item)
    }, [item, onOpenMedia])
    const handleDiscussInChat = React.useCallback(() => {
      onDiscussInChat(item)
    }, [item, onDiscussInChat])
    const actions: React.ReactNode[] = []

    if (processOnly && item.status === "ok") {
      const downloadName = item.url || item.fileName || "item"
      actions.push(
        <Button
          key="dl"
          type="link"
          size="small"
          onClick={handleDownloadJson}
          aria-label={
            t("quickIngest.downloadJsonAria", "Download JSON for {{name}}", {
              name: downloadName
            }) || `Download JSON for ${downloadName}`
          }
        >
          {t("quickIngest.downloadJson", "Download JSON")}
        </Button>
      )
    }

    if (hasMediaId) {
      actions.push(
        <Button
          key="open-media"
          type="link"
          size="small"
          onClick={handleOpenMedia}
        >
          {t("quickIngest.openInMedia", "Open in Media viewer")}
        </Button>
      )
      actions.push(
        <Button
          key="discuss-chat"
          type="link"
          size="small"
          onClick={handleDiscussInChat}
        >
          {t("quickIngest.discussInChat", "Discuss in chat")}
        </Button>
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
  }
)

ResultsListItem.displayName = "ResultsListItem"

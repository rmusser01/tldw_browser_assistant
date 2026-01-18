import React, { useCallback, useState } from "react"
import { Button, Dropdown, message, Tag, Tooltip } from "antd"
import type { MenuProps } from "antd"
import {
  Star,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  Archive,
  Clock,
  Eye
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useCollectionsStore } from "@/store/collections"
import { useTldwApiClient } from "@/hooks/useTldwApiClient"
import type { ReadingItemSummary, ReadingStatus } from "@/types/collections"
import { StatusBadge } from "../common/StatusBadge"

interface ReadingItemCardProps {
  item: ReadingItemSummary
  onRefresh?: () => void
}

export const ReadingItemCard: React.FC<ReadingItemCardProps> = ({
  item,
  onRefresh
}) => {
  const { t } = useTranslation(["collections", "common"])
  const api = useTldwApiClient()
  const [actionLoading, setActionLoading] = useState(false)

  const openItemDetail = useCollectionsStore((s) => s.openItemDetail)
  const updateItemInList = useCollectionsStore((s) => s.updateItemInList)
  const openDeleteConfirm = useCollectionsStore((s) => s.openDeleteConfirm)

  const handleToggleFavorite = useCallback(async () => {
    setActionLoading(true)
    try {
      await api.updateReadingItem(item.id, {
        favorite: !item.favorite
      })
      updateItemInList(item.id, { favorite: !item.favorite })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to update favorite status"
      message.error(msg)
    } finally {
      setActionLoading(false)
    }
  }, [api, item.id, item.favorite, updateItemInList])

  const handleStatusChange = useCallback(
    async (newStatus: ReadingStatus) => {
      setActionLoading(true)
      try {
        await api.updateReadingItem(item.id, { status: newStatus })
        updateItemInList(item.id, { status: newStatus })
        message.success(
          t("collections:reading.statusUpdated", "Status updated to {{status}}", {
            status: newStatus
          })
        )
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Failed to update status"
        message.error(msg)
      } finally {
        setActionLoading(false)
      }
    },
    [api, item.id, updateItemInList, t]
  )

  const menuItems: MenuProps["items"] = [
    {
      key: "view",
      icon: <Eye className="h-4 w-4" />,
      label: t("collections:reading.viewDetails", "View details"),
      onClick: () => openItemDetail(item.id)
    },
    {
      key: "open",
      icon: <ExternalLink className="h-4 w-4" />,
      label: t("collections:reading.openOriginal", "Open original"),
      onClick: () => item.url && window.open(item.url, "_blank"),
      disabled: !item.url
    },
    { type: "divider" },
    {
      key: "status",
      label: t("collections:reading.changeStatus", "Change status"),
      children: [
        {
          key: "saved",
          label: t("collections:status.saved", "Saved"),
          onClick: () => handleStatusChange("saved"),
          disabled: item.status === "saved"
        },
        {
          key: "reading",
          label: t("collections:status.reading", "Reading"),
          onClick: () => handleStatusChange("reading"),
          disabled: item.status === "reading"
        },
        {
          key: "read",
          label: t("collections:status.read", "Read"),
          onClick: () => handleStatusChange("read"),
          disabled: item.status === "read"
        }
      ]
    },
    { type: "divider" },
    {
      key: "archive",
      icon: <Archive className="h-4 w-4" />,
      label:
        item.status === "archived"
          ? t("collections:reading.unarchive", "Unarchive")
          : t("collections:reading.archive", "Archive"),
      onClick: () =>
        handleStatusChange(item.status === "archived" ? "saved" : "archived")
    },
    {
      key: "delete",
      icon: <Trash2 className="h-4 w-4" />,
      label: t("common:delete", "Delete"),
      danger: true,
      onClick: () => openDeleteConfirm(item.id, "item")
    }
  ]

  const formatTimeAgo = useCallback(
    (dateStr: string) => {
      const date = new Date(dateStr)
      if (Number.isNaN(date.getTime())) {
        return t("common:noData", "No data")
      }
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffMins < 60) {
        return t("collections:time.minutesAgo", "{{count}}m ago", { count: diffMins })
      } else if (diffHours < 24) {
        return t("collections:time.hoursAgo", "{{count}}h ago", { count: diffHours })
      } else if (diffDays < 7) {
        return t("collections:time.daysAgo", "{{count}}d ago", { count: diffDays })
      }
      return date.toLocaleDateString()
    },
    [t]
  )

  return (
    <div
      className="group relative rounded-lg border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800"
      onClick={() => openItemDetail(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          openItemDetail(item.id)
        }
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2">
            {item.favorite && (
              <Star className="h-4 w-4 flex-shrink-0 fill-yellow-400 text-yellow-400" />
            )}
            <h3 className="truncate text-base font-medium text-zinc-900 dark:text-zinc-100">
              {item.title}
            </h3>
          </div>

          {/* Domain & Reading Time */}
          <div className="mt-1 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            {item.domain && <span>{item.domain}</span>}
            {item.domain && item.reading_time_minutes && (
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
            )}
            {item.reading_time_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t("collections:reading.readingTime", "{{count}} min read", {
                  count: item.reading_time_minutes
                })}
              </span>
            )}
          </div>

          {/* Summary */}
          {item.summary && (
            <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">
              {item.summary}
            </p>
          )}

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.tags.slice(0, 5).map((tag) => (
                <Tag
                  key={tag}
                  className="border-0 bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                >
                  {tag}
                </Tag>
              ))}
              {item.tags.length > 5 && (
                <Tag className="border-0 bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                  +{item.tags.length - 5}
                </Tag>
              )}
            </div>
          )}
        </div>

        {/* Right side: status & actions */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={item.status} />
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {item.updated_at ? formatTimeAgo(item.updated_at) : null}
            </span>
          </div>

          <div
            className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <Tooltip title={item.favorite ? t("collections:reading.unfavorite", "Unfavorite") : t("collections:reading.favorite", "Favorite")}>
              <Button
                type="text"
                size="small"
                icon={
                  <Star
                    className={`h-4 w-4 ${item.favorite ? "fill-yellow-400 text-yellow-400" : ""}`}
                  />
                }
                onClick={handleToggleFavorite}
                loading={actionLoading}
              />
            </Tooltip>

            <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
              <Button
                type="text"
                size="small"
                icon={<MoreHorizontal className="h-4 w-4" />}
              />
            </Dropdown>
          </div>
        </div>
      </div>
    </div>
  )
}

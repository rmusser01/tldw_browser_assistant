import React from "react"
import { Tag } from "antd"
import { Bookmark, BookOpen, CheckCircle, Archive } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ReadingStatus } from "@/types/collections"

interface StatusBadgeProps {
  status: ReadingStatus
  size?: "small" | "default"
}

const STATUS_CONFIG: Record<
  ReadingStatus,
  { color: string; icon: React.ComponentType<{ className?: string }>; labelKey: string }
> = {
  saved: {
    color: "blue",
    icon: Bookmark,
    labelKey: "saved"
  },
  reading: {
    color: "orange",
    icon: BookOpen,
    labelKey: "reading"
  },
  read: {
    color: "green",
    icon: CheckCircle,
    labelKey: "read"
  },
  archived: {
    color: "default",
    icon: Archive,
    labelKey: "archived"
  }
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = "default"
}) => {
  const { t } = useTranslation("collections")
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <Tag
      color={config.color}
      className={`flex items-center gap-1 ${size === "small" ? "text-xs py-0" : ""}`}
    >
      <Icon className={size === "small" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      <span>{t(`status.${config.labelKey}`, config.labelKey)}</span>
    </Tag>
  )
}

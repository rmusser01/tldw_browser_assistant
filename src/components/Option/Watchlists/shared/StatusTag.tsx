import React from "react"
import { Tag } from "antd"
import type { RunStatus } from "@/types/watchlists"

interface StatusTagProps {
  status: RunStatus | string
  size?: "small" | "default"
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: "default", label: "Pending" },
  running: { color: "processing", label: "Running" },
  completed: { color: "success", label: "Completed" },
  failed: { color: "error", label: "Failed" },
  cancelled: { color: "warning", label: "Cancelled" }
}

export const StatusTag: React.FC<StatusTagProps> = ({ status, size = "default" }) => {
  const config = STATUS_CONFIG[status] || { color: "default", label: status }

  return (
    <Tag color={config.color} className={size === "small" ? "text-xs" : ""}>
      {config.label}
    </Tag>
  )
}

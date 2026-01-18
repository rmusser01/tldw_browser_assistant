/**
 * StatusBadge component
 * Displays run status with color coding and optional loading animation
 */

import React from "react"
import { Tag } from "antd"
import { Loader2 } from "lucide-react"

export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | string

interface StatusBadgeProps {
  status: RunStatus
  className?: string
}

const statusConfig: Record<
  string,
  { color: string; icon?: React.ReactNode }
> = {
  pending: { color: "default" },
  running: {
    color: "processing",
    icon: <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
  },
  completed: { color: "success" },
  failed: { color: "error" },
  cancelled: { color: "warning" }
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className
}) => {
  const normalizedStatus = String(status || "").toLowerCase()
  const config = statusConfig[normalizedStatus] || { color: "default" }

  return (
    <Tag color={config.color} className={className}>
      {config.icon}
      {status}
    </Tag>
  )
}

export default StatusBadge

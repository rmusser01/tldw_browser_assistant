import React, { useEffect, useState } from "react"
import { Modal, Spin, Table, Tag } from "antd"
import type { ColumnsType } from "antd/es/table"
import { useTranslation } from "react-i18next"
import { previewWatchlistJob } from "@/services/watchlists"
import type { JobPreviewResult, PreviewItem, WatchlistJob } from "@/types/watchlists"

interface JobPreviewModalProps {
  job: WatchlistJob | null
  open: boolean
  onClose: () => void
}

export const JobPreviewModal: React.FC<JobPreviewModalProps> = ({
  job,
  open,
  onClose
}) => {
  const { t } = useTranslation(["watchlists", "common"])
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<JobPreviewResult | null>(null)

  useEffect(() => {
    if (!open || !job) {
      setPreview(null)
      return
    }
    setLoading(true)
    previewWatchlistJob(job.id, { limit: 50, per_source: 10 })
      .then((result) => setPreview(result))
      .catch((err) => {
        console.error("Failed to preview job:", err)
      })
      .finally(() => setLoading(false))
  }, [open, job])

  const columns: ColumnsType<PreviewItem> = [
    {
      title: t("watchlists:jobs.preview.columns.title", "Title"),
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (title: string | null, record) => title || record.url || "-"
    },
    {
      title: t("watchlists:jobs.preview.columns.decision", "Decision"),
      dataIndex: "decision",
      key: "decision",
      width: 120,
      render: (decision: string) => (
        <Tag color={decision === "ingest" ? "green" : "red"}>{decision}</Tag>
      )
    },
    {
      title: t("watchlists:jobs.preview.columns.action", "Action"),
      dataIndex: "matched_action",
      key: "matched_action",
      width: 120,
      render: (action: string) => <Tag>{action}</Tag>
    },
    {
      title: t("watchlists:jobs.preview.columns.source", "Source"),
      dataIndex: "source_id",
      key: "source_id",
      width: 100,
      render: (sourceId: number) => `#${sourceId}`
    }
  ]

  return (
    <Modal
      title={t("watchlists:jobs.preview.title", "Job Preview")}
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spin size="large" />
        </div>
      ) : preview ? (
        <div className="space-y-4">
          <div className="text-sm text-zinc-500">
            {t(
              "watchlists:jobs.preview.summary",
              "{{total}} candidates: {{ingestable}} ingestable, {{filtered}} filtered",
              {
                total: preview.total,
                ingestable: preview.ingestable,
                filtered: preview.filtered
              }
            )}
          </div>
          <Table
            dataSource={preview.items || []}
            columns={columns}
            rowKey={(item) => `${item.source_id}-${item.url ?? ""}`}
            pagination={false}
            size="small"
          />
        </div>
      ) : (
        <div className="text-center text-sm text-zinc-500 py-8">
          {t("watchlists:jobs.preview.empty", "No preview data available")}
        </div>
      )}
    </Modal>
  )
}

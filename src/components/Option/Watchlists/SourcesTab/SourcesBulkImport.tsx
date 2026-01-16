import React, { useMemo, useState } from "react"
import { Alert, Button, Modal, Select, Switch, Table, Upload, message } from "antd"
import type { UploadFile } from "antd/es/upload/interface"
import { UploadCloud } from "lucide-react"
import { useTranslation } from "react-i18next"
import { importOpml } from "@/services/watchlists"
import type { SourcesImportResponse, WatchlistGroup, WatchlistTag } from "@/types/watchlists"

interface SourcesBulkImportProps {
  open: boolean
  onClose: () => void
  groups: WatchlistGroup[]
  tags: WatchlistTag[]
  defaultGroupId?: number | null
  onImported: () => void
}

export const SourcesBulkImport: React.FC<SourcesBulkImportProps> = ({
  open,
  onClose,
  groups,
  tags,
  defaultGroupId,
  onImported
}) => {
  const { t } = useTranslation(["watchlists", "common"])
  const [active, setActive] = useState(true)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(defaultGroupId ?? null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<SourcesImportResponse | null>(null)

  const summary = useMemo(() => {
    if (!result?.items?.length) return null
    const created = result.items.filter((item) => item.status === "created").length
    const skipped = result.items.filter((item) => item.status === "skipped").length
    const errors = result.items.filter((item) => item.status === "error").length
    return { created, skipped, errors }
  }, [result])

  const handleImport = async (file: File) => {
    setImporting(true)
    try {
      const response = await importOpml(file, {
        active,
        tags: selectedTags,
        group_id: selectedGroupId ?? undefined
      })
      setResult(response)
      onImported()
      message.success(t("watchlists:sources.imported", "OPML imported"))
    } catch (err) {
      console.error("OPML import failed:", err)
      message.error(t("watchlists:sources.importError", "Failed to import OPML"))
    } finally {
      setImporting(false)
    }
  }

  const uploadProps = {
    accept: ".opml,.xml",
    multiple: false,
    showUploadList: false,
    beforeUpload: async (file: UploadFile) => {
      if (!file.originFileObj) return false
      await handleImport(file.originFileObj as File)
      return false
    }
  }

  const errorItems = (result?.items || []).filter((item) => item.status === "error")

  return (
    <Modal
      title={t("watchlists:sources.importTitle", "Import OPML")}
      open={open}
      onCancel={onClose}
      footer={
        <Button onClick={onClose}>
          {t("common:close", "Close")}
        </Button>
      }
      width={700}
    >
      <div className="space-y-4">
        <Upload.Dragger {...uploadProps} disabled={importing}>
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-zinc-500">
            <UploadCloud className="h-6 w-6" />
            <div className="text-sm font-medium">
              {t("watchlists:sources.importDrop", "Drop OPML file here or click to upload")}
            </div>
            <div className="text-xs">
              {t("watchlists:sources.importHint", "Supports standard OPML exports")}
            </div>
          </div>
        </Upload.Dragger>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="text-xs font-medium text-zinc-500 mb-1">
              {t("watchlists:sources.importGroup", "Assign Group")}
            </div>
            <Select
              value={selectedGroupId ?? undefined}
              onChange={(value) => setSelectedGroupId(value ?? null)}
              allowClear
              placeholder={t("watchlists:sources.importGroupPlaceholder", "None")}
              options={groups.map((group) => ({
                label: group.name,
                value: group.id
              }))}
              className="w-full"
            />
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500 mb-1">
              {t("watchlists:sources.importTags", "Apply Tags")}
            </div>
            <Select
              mode="multiple"
              value={selectedTags}
              onChange={setSelectedTags}
              placeholder={t("watchlists:sources.importTagsPlaceholder", "Select tags")}
              options={tags.map((tag) => ({ label: tag.name, value: tag.name }))}
              className="w-full"
            />
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500 mb-1">
              {t("watchlists:sources.importActive", "Set Active")}
            </div>
            <Switch checked={active} onChange={setActive} />
          </div>
        </div>

        {summary && (
          <Alert
            type={summary.errors > 0 ? "warning" : "success"}
            message={t("watchlists:sources.importSummary", "Import Summary")}
            description={t(
              "watchlists:sources.importSummaryDesc",
              "{{created}} created, {{skipped}} skipped, {{errors}} errors",
              summary
            )}
            showIcon
          />
        )}

        {errorItems.length > 0 && (
          <Table
            dataSource={errorItems}
            rowKey={(item) => item.url}
            pagination={false}
            size="small"
            columns={[
              {
                title: t("watchlists:sources.columns.name", "Name"),
                dataIndex: "name",
                key: "name",
                render: (name: string | null, record) => name || record.url
              },
              {
                title: t("watchlists:sources.columns.url", "URL"),
                dataIndex: "url",
                key: "url",
                ellipsis: true
              },
              {
                title: t("watchlists:sources.columns.status", "Status"),
                dataIndex: "status",
                key: "status"
              },
              {
                title: t("watchlists:sources.columns.error", "Error"),
                dataIndex: "error",
                key: "error",
                ellipsis: true
              }
            ]}
          />
        )}
      </div>
    </Modal>
  )
}

import React, { useEffect, useMemo, useState } from "react"
import {
  Button,
  Drawer,
  Empty,
  Segmented,
  Spin,
  Tooltip,
  message
} from "antd"
import { Download, ExternalLink } from "lucide-react"
import DOMPurify from "dompurify"
import { useTranslation } from "react-i18next"
import { downloadWatchlistOutput } from "@/services/watchlists"
import type { WatchlistOutput } from "@/types/watchlists"

interface OutputPreviewDrawerProps {
  output: WatchlistOutput | null | undefined
  open: boolean
  onClose: () => void
}

export const OutputPreviewDrawer: React.FC<OutputPreviewDrawerProps> = ({
  output,
  open,
  onClose
}) => {
  const { t } = useTranslation(["watchlists", "common"])
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"rendered" | "source">("rendered")

  // Fetch content when drawer opens
  useEffect(() => {
    if (open && output) {
      setLoading(true)
      setError(null)
      downloadWatchlistOutput(output.id)
        .then((result) => setContent(result))
        .catch((err) => {
          console.error("Failed to fetch output content:", err)
          setError(err.message || "Failed to load content")
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setContent(null)
      setError(null)
    }
  }, [open, output])

  // Handle download
  const handleDownload = async () => {
    if (!output) return
    try {
      const content = await downloadWatchlistOutput(output.id)
      const mimeType = output.format === "html" ? "text/html" : "text/markdown"
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${output.title || `output-${output.id}`}.${output.format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      message.success(t("watchlists:outputs.downloaded", "Output downloaded"))
    } catch (err) {
      console.error("Failed to download output:", err)
      message.error(t("watchlists:outputs.downloadError", "Failed to download output"))
    }
  }

  const sanitizedHtml = useMemo(() => {
    if (!content) return null
    return DOMPurify.sanitize(content, { USE_PROFILES: { html: true } })
  }, [content])

  // Open in new tab (for HTML)
  const handleOpenInNewTab = () => {
    if (!content || output?.format !== "html") return
    const safeHtml = sanitizedHtml || content
    const blob = new Blob([safeHtml], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    window.open(url, "_blank")
    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Drawer
      title={output?.title || t("watchlists:outputs.preview", "Output Preview")}
      placement="right"
      onClose={onClose}
      open={open}
      width={700}
      extra={
        <div className="flex items-center gap-2">
          {output?.format === "html" && (
            <Tooltip title={t("watchlists:outputs.openInNewTab", "Open in new tab")}>
              <Button
                type="text"
                icon={<ExternalLink className="h-4 w-4" />}
                onClick={handleOpenInNewTab}
                disabled={!content}
              />
            </Tooltip>
          )}
          <Tooltip title={t("watchlists:outputs.download", "Download")}>
            <Button
              type="text"
              icon={<Download className="h-4 w-4" />}
              onClick={handleDownload}
            />
          </Tooltip>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spin size="large" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : content ? (
        <div className="space-y-4">
          {/* View mode toggle for HTML */}
          {output?.format === "html" && (
            <div className="flex justify-end">
              <Segmented
                size="small"
                options={[
                  { value: "rendered", label: t("watchlists:outputs.rendered", "Rendered") },
                  { value: "source", label: t("watchlists:outputs.source", "Source") }
                ]}
                value={viewMode}
                onChange={(v) => setViewMode(v as "rendered" | "source")}
              />
            </div>
          )}

          {/* Content display */}
          {output?.format === "html" && viewMode === "rendered" ? (
            <div
              className="prose dark:prose-invert max-w-none p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-auto max-h-[calc(100vh-200px)]"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml || "" }}
            />
          ) : output?.format === "html" && viewMode === "source" ? (
            <pre className="p-4 bg-zinc-900 text-zinc-100 rounded-lg font-mono text-xs overflow-auto max-h-[calc(100vh-200px)] whitespace-pre-wrap">
              {content}
            </pre>
          ) : (
            // Markdown or other formats
            <pre className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg font-mono text-sm overflow-auto max-h-[calc(100vh-200px)] whitespace-pre-wrap border border-zinc-200 dark:border-zinc-700">
              {content}
            </pre>
          )}
        </div>
      ) : (
        <Empty
          description={t("watchlists:outputs.noContent", "No content available")}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </Drawer>
  )
}

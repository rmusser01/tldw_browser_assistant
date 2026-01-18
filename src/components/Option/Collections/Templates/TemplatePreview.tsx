import React, { useCallback, useEffect, useState } from "react"
import { Button, Modal, Spin, Empty, message, Checkbox, List } from "antd"
import { Eye, Download, Copy, Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useCollectionsStore } from "@/store/collections"
import { useTldwApiClient } from "@/hooks/useTldwApiClient"
import type { ReadingItemSummary } from "@/types/collections"

interface TemplatePreviewProps {
  templateId: string
  onClose: () => void
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  templateId,
  onClose
}) => {
  const { t } = useTranslation(["collections", "common"])
  const api = useTldwApiClient()

  const previewContent = useCollectionsStore((s) => s.previewContent)
  const previewLoading = useCollectionsStore((s) => s.previewLoading)
  const previewError = useCollectionsStore((s) => s.previewError)
  const selectedItemsForGeneration = useCollectionsStore((s) => s.selectedItemsForGeneration)

  const setPreviewContent = useCollectionsStore((s) => s.setPreviewContent)
  const setPreviewLoading = useCollectionsStore((s) => s.setPreviewLoading)
  const setPreviewError = useCollectionsStore((s) => s.setPreviewError)
  const setSelectedItemsForGeneration = useCollectionsStore((s) => s.setSelectedItemsForGeneration)
  const toggleItemForGeneration = useCollectionsStore((s) => s.toggleItemForGeneration)

  const [previewItems, setPreviewItems] = useState<ReadingItemSummary[]>([])
  const [previewItemsLoading, setPreviewItemsLoading] = useState(false)
  const [previewItemsError, setPreviewItemsError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [step, setStep] = useState<"select" | "preview" | "output">("select")
  const [previewFormat, setPreviewFormat] = useState<string | null>(null)
  const [generatedContent, setGeneratedContent] = useState<string | null>(null)
  const [generatedFormat, setGeneratedFormat] = useState<string | null>(null)
  const [generatedDownloadUrl, setGeneratedDownloadUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    return () => {
      if (generatedDownloadUrl) {
        URL.revokeObjectURL(generatedDownloadUrl)
      }
    }
  }, [generatedDownloadUrl])

  // Reset on mount
  useEffect(() => {
    setPreviewContent(null)
    setPreviewError(null)
    setSelectedItemsForGeneration([])
    setPreviewFormat(null)
    setGeneratedContent(null)
    setGeneratedFormat(null)
    setGeneratedDownloadUrl(null)
    setStep("select")
  }, [templateId, setPreviewContent, setPreviewError, setSelectedItemsForGeneration])

  useEffect(() => {
    let active = true
    const loadItems = async () => {
      setPreviewItemsLoading(true)
      setPreviewItemsError(null)
      try {
        const response = await api.getReadingList({ page: 1, size: 50 })
        if (!active) return
        setPreviewItems(response.items || [])
      } catch (error: any) {
        if (!active) return
        const msg = error?.message || "Failed to load reading items"
        setPreviewItemsError(msg)
        message.error(msg)
      } finally {
        if (active) setPreviewItemsLoading(false)
      }
    }
    loadItems()
    return () => {
      active = false
    }
  }, [api])

  const buildTemplateContext = useCallback(() => {
    const selected = previewItems.filter((item) =>
      selectedItemsForGeneration.includes(item.id)
    )
    const date = new Date().toISOString()
    const contextItems = selected.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.url || item.canonical_url || "",
      domain: item.domain || "",
      summary: item.summary || "",
      notes: item.notes || "",
      published_at: item.published_at || item.created_at || "",
      tags: Array.isArray(item.tags) ? item.tags : []
    }))
    const tags = Array.from(new Set(contextItems.flatMap((item) => item.tags)))
    return { items: contextItems, date, tags }
  }, [previewItems, selectedItemsForGeneration])

  const handleGeneratePreview = useCallback(async () => {
    if (selectedItemsForGeneration.length === 0) {
      message.warning(t("collections:templates.selectItems", "Please select at least one article"))
      return
    }

    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const response = await api.previewTemplate({
        template_id: templateId,
        data: buildTemplateContext()
      })
      setPreviewContent(response.rendered)
      setPreviewFormat(response.format)
      setStep("preview")
    } catch (error: any) {
      setPreviewError(error?.message || "Failed to generate preview")
      message.error(error?.message || "Failed to generate preview")
    } finally {
      setPreviewLoading(false)
    }
  }, [
    api,
    templateId,
    selectedItemsForGeneration,
    setPreviewLoading,
    setPreviewError,
    setPreviewContent,
    setPreviewFormat,
    buildTemplateContext,
    t
  ])

  const activeContent = step === "output" ? generatedContent : previewContent

  const handleCopy = useCallback(async () => {
    if (!activeContent) return
    try {
      await navigator.clipboard.writeText(activeContent)
      setCopied(true)
      message.success(t("common:copied", "Copied to clipboard"))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      message.error("Failed to copy to clipboard")
    }
  }, [activeContent, t])

  const handleDownload = useCallback(() => {
    if (step === "output" && generatedDownloadUrl) {
      const extension =
        generatedFormat === "html"
          ? "html"
          : generatedFormat === "md"
            ? "md"
            : generatedFormat === "mp3"
              ? "mp3"
              : "txt"
      const a = document.createElement("a")
      a.href = generatedDownloadUrl
      a.download = `template-output-${Date.now()}.${extension}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      return
    }
    if (!activeContent) return
    const extension =
      step === "output"
        ? generatedFormat === "html"
          ? "html"
          : generatedFormat === "md"
            ? "md"
            : "txt"
        : previewFormat === "html"
          ? "html"
          : previewFormat === "md"
            ? "md"
            : "txt"
    const blob = new Blob([activeContent], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `template-${step}-${Date.now()}.${extension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [step, generatedDownloadUrl, activeContent, generatedFormat, previewFormat])

  const handleGenerateOutput = useCallback(async () => {
    if (selectedItemsForGeneration.length === 0) {
      message.warning(t("collections:templates.selectItems", "Please select at least one article"))
      return
    }
    setGenerating(true)
    try {
      const output = await api.generateOutput({
        template_id: templateId,
        data: buildTemplateContext()
      })
      const blob = await api.downloadOutput(output.id, output.format)
      const downloadUrl = URL.createObjectURL(blob)
      setGeneratedFormat(output.format || null)
      setGeneratedDownloadUrl(downloadUrl)
      if (output.format === "mp3") {
        setGeneratedContent(null)
      } else {
        const text = await blob.text()
        setGeneratedContent(text)
      }
      setStep("output")
    } catch (error: any) {
      message.error(error?.message || "Failed to generate output")
    } finally {
      setGenerating(false)
    }
  }, [api, templateId, selectedItemsForGeneration, buildTemplateContext, t])

  const handleSelectAll = useCallback(() => {
    if (selectedItemsForGeneration.length === previewItems.length) {
      setSelectedItemsForGeneration([])
    } else {
      setSelectedItemsForGeneration(previewItems.map((i) => i.id))
    }
  }, [previewItems, selectedItemsForGeneration, setSelectedItemsForGeneration])

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          {t("collections:templates.previewTitle", "Template Preview")}
        </span>
      }
      open={true}
      onCancel={onClose}
      width={800}
      footer={
        step === "select"
          ? [
              <Button key="cancel" onClick={onClose}>
                {t("common:cancel", "Cancel")}
              </Button>,
              <Button
                key="generate"
                type="primary"
                onClick={handleGeneratePreview}
                loading={previewLoading}
                disabled={selectedItemsForGeneration.length === 0}
              >
                {t("collections:templates.generatePreview", "Generate Preview")}
              </Button>
            ]
          : step === "preview"
            ? [
                <Button key="back" onClick={() => setStep("select")}>
                  {t("common:back", "Back")}
                </Button>,
                <Button
                  key="copy"
                  icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  onClick={handleCopy}
                  disabled={!previewContent}
                >
                  {copied ? t("common:copied", "Copied") : t("common:copy", "Copy")}
                </Button>,
                <Button
                  key="download"
                  icon={<Download className="h-4 w-4" />}
                  onClick={handleDownload}
                  disabled={!previewContent}
                >
                  {t("common:download", "Download")}
                </Button>,
                <Button
                  key="generate"
                  type="primary"
                  onClick={handleGenerateOutput}
                  loading={generating}
                  disabled={selectedItemsForGeneration.length === 0}
                >
                  {t("collections:templates.generateOutput", "Generate Output")}
                </Button>,
                <Button key="close" onClick={onClose}>
                  {t("common:close", "Close")}
                </Button>
              ]
            : [
                <Button key="back" onClick={() => setStep("preview")}>
                  {t("common:back", "Back")}
                </Button>,
                generatedFormat !== "mp3" && (
                  <Button
                    key="copy"
                    icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    onClick={handleCopy}
                    disabled={!generatedContent}
                  >
                    {copied ? t("common:copied", "Copied") : t("common:copy", "Copy")}
                  </Button>
                ),
                <Button
                  key="download"
                  icon={<Download className="h-4 w-4" />}
                  onClick={handleDownload}
                  disabled={!generatedContent && !generatedDownloadUrl}
                >
                  {t("common:download", "Download")}
                </Button>,
                <Button key="close" type="primary" onClick={onClose}>
                  {t("common:close", "Close")}
                </Button>
              ]
      }
    >
      {step === "select" ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">
            {t(
              "collections:templates.selectItemsHint",
              "Select articles to include in the preview:"
            )}
          </p>

          <div className="flex items-center justify-between border-b border-zinc-200 pb-2 dark:border-zinc-700">
            <Checkbox
              checked={
                selectedItemsForGeneration.length === previewItems.length &&
                previewItems.length > 0
              }
              indeterminate={
                selectedItemsForGeneration.length > 0 &&
                selectedItemsForGeneration.length < previewItems.length
              }
              onChange={handleSelectAll}
            >
              {t("collections:templates.selectAll", "Select All")}
            </Checkbox>
            <span className="text-sm text-zinc-500">
              {t("collections:templates.selectedCount", "{{count}} selected", {
                count: selectedItemsForGeneration.length
              })}
            </span>
          </div>

          {previewItemsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spin />
            </div>
          ) : previewItemsError ? (
            <Empty description={previewItemsError} />
          ) : previewItems.length === 0 ? (
            <Empty
              description={t(
                "collections:templates.noItems",
                "No articles in your reading list"
              )}
            />
          ) : (
            <List
              className="max-h-80 overflow-auto"
              dataSource={previewItems}
              renderItem={(item) => (
                <List.Item className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <Checkbox
                    checked={selectedItemsForGeneration.includes(item.id)}
                    onChange={() => toggleItemForGeneration(item.id)}
                    className="w-full"
                  >
                    <div className="ml-2">
                      <div className="font-medium">{item.title}</div>
                      {item.domain && (
                        <div className="text-xs text-zinc-500">{item.domain}</div>
                      )}
                    </div>
                  </Checkbox>
                </List.Item>
              )}
            />
          )}
        </div>
      ) : step === "preview" && previewLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spin size="large" />
        </div>
      ) : step === "preview" && previewError ? (
        <Empty description={previewError} image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button onClick={() => setStep("select")}>
            {t("common:back", "Back")}
          </Button>
        </Empty>
      ) : step === "preview" && previewContent ? (
        <div className="max-h-[60vh] overflow-auto">
          {previewFormat === "html" ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: previewContent }}
            />
          ) : (
            <pre className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
              {previewContent}
            </pre>
          )}
        </div>
      ) : step === "output" ? (
        <div className="space-y-4">
          {generatedFormat === "mp3" ? (
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
              {generatedDownloadUrl ? (
                <audio controls src={generatedDownloadUrl} className="w-full" />
              ) : (
                <p className="text-sm text-zinc-500">
                  {t("collections:templates.audioUnavailable", "Audio output unavailable")}
                </p>
              )}
            </div>
          ) : generatedContent ? (
            <div className="max-h-[60vh] overflow-auto">
              <pre className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
                {generatedContent}
              </pre>
            </div>
          ) : (
            <Empty
              description={t(
                "collections:templates.noGeneratedContent",
                "No output generated yet"
              )}
            />
          )}
        </div>
      ) : null}
    </Modal>
  )
}

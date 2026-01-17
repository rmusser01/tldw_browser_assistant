import React, { useCallback, useState } from "react"
import {
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  List,
  message,
  Radio,
  Result,
  Select,
  Spin,
  Steps,
  Upload
} from "antd"
import {
  Upload as UploadIcon,
  Download,
  FileJson,
  FileText,
  Bookmark,
  BookOpen,
  ArrowRight,
  Check,
  AlertCircle
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useCollectionsStore } from "@/store/collections"
import { useTldwApiClient } from "@/hooks/useTldwApiClient"
import type { ImportSource, ExportFormat as CollectionExportFormat } from "@/types/collections"

const IMPORT_SOURCES: {
  value: ImportSource
  label: string
  icon: React.ReactNode
  description: string
  supportsApiKey?: boolean
  apiKeyLabel?: string
}[] = [
  {
    value: "pocket",
    label: "Pocket",
    icon: <Bookmark className="h-6 w-6" />,
    description: "Import your saved articles from Pocket",
    supportsApiKey: true,
    apiKeyLabel: "Pocket API Key"
  },
  {
    value: "kindle",
    label: "Kindle",
    icon: <BookOpen className="h-6 w-6" />,
    description: "Import highlights from Kindle"
  },
  {
    value: "instapaper",
    label: "Instapaper",
    icon: <FileText className="h-6 w-6" />,
    description: "Import articles from Instapaper",
    supportsApiKey: true,
    apiKeyLabel: "Instapaper API Key"
  },
  {
    value: "json",
    label: "JSON File",
    icon: <FileJson className="h-6 w-6" />,
    description: "Import from a JSON export file"
  }
]

const EXPORT_FORMATS: { value: CollectionExportFormat; label: string }[] = [
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV" },
  { value: "markdown", label: "Markdown" }
]

export const ImportExportPanel: React.FC = () => {
  const { t } = useTranslation(["collections", "common"])

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <ImportSection />
      <ExportSection />
    </div>
  )
}

// Import Section
const ImportSection: React.FC = () => {
  const { t } = useTranslation(["collections", "common"])
  const api = useTldwApiClient()

  const importSource = useCollectionsStore((s) => s.importSource)
  const importApiKey = useCollectionsStore((s) => s.importApiKey)
  const importPreviewItems = useCollectionsStore((s) => s.importPreviewItems)
  const importPreviewLoading = useCollectionsStore((s) => s.importPreviewLoading)
  const importPreviewError = useCollectionsStore((s) => s.importPreviewError)
  const importInProgress = useCollectionsStore((s) => s.importInProgress)
  const importResult = useCollectionsStore((s) => s.importResult)
  const importWizardStep = useCollectionsStore((s) => s.importWizardStep)

  const setImportSource = useCollectionsStore((s) => s.setImportSource)
  const setImportFile = useCollectionsStore((s) => s.setImportFile)
  const setImportApiKey = useCollectionsStore((s) => s.setImportApiKey)
  const setImportPreviewItems = useCollectionsStore((s) => s.setImportPreviewItems)
  const setImportPreviewLoading = useCollectionsStore((s) => s.setImportPreviewLoading)
  const setImportPreviewError = useCollectionsStore((s) => s.setImportPreviewError)
  const setImportInProgress = useCollectionsStore((s) => s.setImportInProgress)
  const setImportResult = useCollectionsStore((s) => s.setImportResult)
  const setImportWizardStep = useCollectionsStore((s) => s.setImportWizardStep)
  const resetImportWizard = useCollectionsStore((s) => s.resetImportWizard)

  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [importMethod, setImportMethod] = useState<"file" | "apiKey">("file")

  const activeSource = IMPORT_SOURCES.find((source) => source.value === importSource) || null

  React.useEffect(() => {
    if (!activeSource?.supportsApiKey) {
      setImportMethod("file")
    }
  }, [activeSource])

  const handleSourceSelect = (source: ImportSource) => {
    setImportSource(source)
    setImportFile(null)
    setImportApiKey("")
    setImportPreviewItems([])
    setSelectedItems([])
    setImportWizardStep("upload")
  }

  const handleFileUpload = async (file: File) => {
    setImportFile(file)
    setImportPreviewLoading(true)
    setImportPreviewError(null)

    try {
      const response = await api.previewImport({
        source: importSource!,
        file
      })
      setImportPreviewItems(response.items)
      setSelectedItems(response.items.map((_, i) => i))
      setImportWizardStep("preview")
    } catch (error: any) {
      setImportPreviewError(error?.message || "Failed to preview import")
      message.error(error?.message || "Failed to preview import")
    } finally {
      setImportPreviewLoading(false)
    }
  }

  const handleApiKeyPreview = async () => {
    if (!importSource) return
    if (!importApiKey.trim()) {
      message.warning(t("collections:import.apiKeyRequired", "Please enter an API key"))
      return
    }
    setImportPreviewLoading(true)
    setImportPreviewError(null)

    try {
      const response = await api.previewImport({
        source: importSource,
        api_key: importApiKey.trim()
      })
      setImportPreviewItems(response.items)
      setSelectedItems(response.items.map((_, i) => i))
      setImportWizardStep("preview")
    } catch (error: any) {
      setImportPreviewError(error?.message || "Failed to preview import")
      message.error(error?.message || "Failed to preview import")
    } finally {
      setImportPreviewLoading(false)
    }
  }

  const handleImportConfirm = async () => {
    const itemsToImport = selectedItems.map((i) => importPreviewItems[i])
    if (itemsToImport.length === 0) {
      message.warning(t("collections:import.selectItems", "Please select items to import"))
      return
    }

    setImportInProgress(true)
    try {
      const result = await api.confirmImport({
        items: itemsToImport
      })
      setImportResult(result)
      setImportWizardStep("result")
      message.success(
        t("collections:import.success", "Imported {{count}} items", {
          count: result.imported
        })
      )
    } catch (error: any) {
      message.error(error?.message || "Import failed")
    } finally {
      setImportInProgress(false)
    }
  }

  const stepItems = [
    { title: t("collections:import.steps.source", "Source") },
    { title: t("collections:import.steps.upload", "Upload") },
    { title: t("collections:import.steps.preview", "Preview") },
    { title: t("collections:import.steps.result", "Result") }
  ]

  const currentStep =
    importWizardStep === "source"
      ? 0
      : importWizardStep === "upload"
        ? 1
        : importWizardStep === "preview" || importWizardStep === "confirm"
          ? 2
          : 3

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <UploadIcon className="h-5 w-5" />
          {t("collections:import.title", "Import")}
        </span>
      }
    >
      <Steps current={currentStep} items={stepItems} size="small" className="mb-6" />

      {importWizardStep === "source" && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-500">
            {t("collections:import.selectSource", "Select import source:")}
          </p>
          {IMPORT_SOURCES.map((source) => (
            <button
              key={source.value}
              onClick={() => handleSourceSelect(source.value)}
              className="flex w-full items-center gap-4 rounded-lg border border-zinc-200 p-4 text-left transition-colors hover:border-blue-500 hover:bg-blue-50 dark:border-zinc-700 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                {source.icon}
              </div>
              <div>
                <div className="font-medium">{source.label}</div>
                <div className="text-sm text-zinc-500">{source.description}</div>
              </div>
              <ArrowRight className="ml-auto h-5 w-5 text-zinc-400" />
            </button>
          ))}
        </div>
      )}

      {importWizardStep === "upload" && (
        <div className="space-y-4">
          {activeSource?.supportsApiKey && (
            <Radio.Group
              value={importMethod}
              onChange={(e) => setImportMethod(e.target.value)}
            >
              <Radio.Button value="file">
                {t("collections:import.methodFile", "File Upload")}
              </Radio.Button>
              <Radio.Button value="apiKey">
                {t("collections:import.methodApiKey", "API Key")}
              </Radio.Button>
            </Radio.Group>
          )}

          {importMethod === "file" ? (
            <Upload.Dragger
              accept=".json,.csv,.html"
              maxCount={1}
              beforeUpload={(file) => {
                handleFileUpload(file)
                return false
              }}
              showUploadList={false}
            >
              {importPreviewLoading ? (
                <div className="py-8">
                  <Spin size="large" />
                  <p className="mt-4 text-zinc-500">
                    {t("collections:import.processing", "Processing file...")}
                  </p>
                </div>
              ) : (
                <div className="py-8">
                  <UploadIcon className="mx-auto h-10 w-10 text-zinc-400" />
                  <p className="mt-4 text-zinc-600 dark:text-zinc-300">
                    {t("collections:import.dropzone", "Click or drag file to upload")}
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    {t("collections:import.formats", "Supports JSON, CSV, HTML")}
                  </p>
                </div>
              )}
            </Upload.Dragger>
          ) : (
            <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  {t(
                    "collections:import.apiKeyLabel",
                    activeSource?.apiKeyLabel || "API Key"
                  )}
                </label>
                <Input.Password
                  value={importApiKey}
                  onChange={(e) => setImportApiKey(e.target.value)}
                  placeholder={t(
                    "collections:import.apiKeyPlaceholder",
                    "Paste your API key"
                  )}
                  aria-label={t("collections:import.apiKeyLabel", "API Key")}
                />
              </div>
              <Button
                type="primary"
                onClick={handleApiKeyPreview}
                loading={importPreviewLoading}
                disabled={!importApiKey.trim()}
              >
                {t("collections:import.previewWithKey", "Preview Import")}
              </Button>
            </div>
          )}

          {importPreviewError && (
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{importPreviewError}</span>
            </div>
          )}

          <Button onClick={resetImportWizard}>{t("common:back", "Back")}</Button>
        </div>
      )}

      {(importWizardStep === "preview" || importWizardStep === "confirm") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              {t("collections:import.previewHint", "{{count}} items found", {
                count: importPreviewItems.length
              })}
            </p>
            <Checkbox
              checked={selectedItems.length === importPreviewItems.length}
              indeterminate={
                selectedItems.length > 0 &&
                selectedItems.length < importPreviewItems.length
              }
              onChange={(e) =>
                setSelectedItems(
                  e.target.checked ? importPreviewItems.map((_, i) => i) : []
                )
              }
            >
              {t("collections:import.selectAll", "Select All")}
            </Checkbox>
          </div>

          <List
            className="max-h-60 overflow-auto border border-zinc-200 rounded-lg dark:border-zinc-700"
            dataSource={importPreviewItems}
            renderItem={(item, index) => (
              <List.Item className="px-3">
                <Checkbox
                  checked={selectedItems.includes(index)}
                  onChange={(e) =>
                    setSelectedItems(
                      e.target.checked
                        ? [...selectedItems, index]
                        : selectedItems.filter((i) => i !== index)
                    )
                  }
                >
                  <span className="ml-2 truncate">{item.title}</span>
                </Checkbox>
              </List.Item>
            )}
          />

          <div className="flex gap-2">
            <Button onClick={() => setImportWizardStep("upload")}>
              {t("common:back", "Back")}
            </Button>
            <Button
              type="primary"
              onClick={handleImportConfirm}
              loading={importInProgress}
              disabled={selectedItems.length === 0}
            >
              {t("collections:import.importSelected", "Import {{count}} items", {
                count: selectedItems.length
              })}
            </Button>
          </div>
        </div>
      )}

      {importWizardStep === "result" && importResult && (
        <Result
          status={importResult.errors.length === 0 ? "success" : "warning"}
          title={t("collections:import.complete", "Import Complete")}
          subTitle={t(
            "collections:import.resultSummary",
            "Imported: {{imported}}, Skipped: {{skipped}}",
            { imported: importResult.imported, skipped: importResult.skipped }
          )}
          extra={[
            <Button key="done" type="primary" onClick={resetImportWizard}>
              {t("collections:import.importMore", "Import More")}
            </Button>
          ]}
        />
      )}
    </Card>
  )
}

// Export Section
const ExportSection: React.FC = () => {
  const { t } = useTranslation(["collections", "common"])
  const api = useTldwApiClient()

  const items = useCollectionsStore((s) => s.items)
  const exportFormat = useCollectionsStore((s) => s.exportFormat)
  const exportSelectedItems = useCollectionsStore((s) => s.exportSelectedItems)
  const exportIncludeContent = useCollectionsStore((s) => s.exportIncludeContent)
  const exportIncludeHighlights = useCollectionsStore((s) => s.exportIncludeHighlights)
  const exportInProgress = useCollectionsStore((s) => s.exportInProgress)

  const setExportFormat = useCollectionsStore((s) => s.setExportFormat)
  const setExportSelectedItems = useCollectionsStore((s) => s.setExportSelectedItems)
  const toggleExportItem = useCollectionsStore((s) => s.toggleExportItem)
  const setExportIncludeContent = useCollectionsStore((s) => s.setExportIncludeContent)
  const setExportIncludeHighlights = useCollectionsStore((s) => s.setExportIncludeHighlights)
  const setExportInProgress = useCollectionsStore((s) => s.setExportInProgress)

  const handleExport = async () => {
    setExportInProgress(true)
    try {
      const response = await api.exportReadingList({
        format: exportFormat,
        item_ids: exportSelectedItems.length > 0 ? exportSelectedItems : undefined,
        include_content: exportIncludeContent,
        include_highlights: exportIncludeHighlights
      })

      // Trigger download
      window.open(response.download_url, "_blank")
      message.success(t("collections:export.success", "Export ready for download"))
    } catch (error: any) {
      message.error(error?.message || "Export failed")
    } finally {
      setExportInProgress(false)
    }
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          {t("collections:export.title", "Export")}
        </span>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium">
            {t("collections:export.format", "Format")}
          </label>
          <Radio.Group
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
          >
            {EXPORT_FORMATS.map((fmt) => (
              <Radio.Button key={fmt.value} value={fmt.value}>
                {fmt.label}
              </Radio.Button>
            ))}
          </Radio.Group>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            {t("collections:export.options", "Options")}
          </label>
          <div className="space-y-2">
            <Checkbox
              checked={exportIncludeContent}
              onChange={(e) => setExportIncludeContent(e.target.checked)}
            >
              {t("collections:export.includeContent", "Include full content")}
            </Checkbox>
            <br />
            <Checkbox
              checked={exportIncludeHighlights}
              onChange={(e) => setExportIncludeHighlights(e.target.checked)}
            >
              {t("collections:export.includeHighlights", "Include highlights")}
            </Checkbox>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            {t("collections:export.items", "Items to Export")}
          </label>
          <Select
            mode="multiple"
            placeholder={t("collections:export.allItems", "All items (leave empty)")}
            className="w-full"
            value={exportSelectedItems}
            onChange={setExportSelectedItems}
            options={items.map((item) => ({
              value: item.id,
              label: item.title
            }))}
            maxTagCount={3}
          />
          <p className="mt-1 text-xs text-zinc-500">
            {t(
              "collections:export.itemsHint",
              "Leave empty to export all items, or select specific ones"
            )}
          </p>
        </div>

        <Button
          type="primary"
          icon={<Download className="h-4 w-4" />}
          onClick={handleExport}
          loading={exportInProgress}
          block
        >
          {t("collections:export.download", "Download Export")}
        </Button>
      </div>
    </Card>
  )
}

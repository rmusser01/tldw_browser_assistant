import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  List,
  message,
  Radio,
  Result,
  Spin,
  Steps,
  Upload
} from "antd"
import {
  Upload as UploadIcon,
  Download,
  FileText,
  Bookmark,
  ArrowRight,
  AlertCircle
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useCollectionsStore } from "@/store/collections"
import { useTldwApiClient } from "@/hooks/useTldwApiClient"
import { useSelectionKeyboard } from "@/hooks/useSelectionKeyboard"
import type {
  ImportSource,
  ExportFormat as CollectionExportFormat,
  ReadingItem,
  ReadingItemSummary
} from "@/types/collections"

const IMPORT_SOURCES: {
  value: ImportSource
  label: string
  icon: React.ReactNode
  description: string
}[] = [
  {
    value: "auto",
    label: "Auto-detect",
    icon: <FileText className="h-6 w-6" />,
    description: "Upload a Pocket or Instapaper export file and auto-detect the format"
  },
  {
    value: "pocket",
    label: "Pocket",
    icon: <Bookmark className="h-6 w-6" />,
    description: "Import your saved articles from a Pocket export"
  },
  {
    value: "instapaper",
    label: "Instapaper",
    icon: <FileText className="h-6 w-6" />,
    description: "Import articles from an Instapaper export"
  }
]

const EXPORT_FORMATS: { value: CollectionExportFormat; label: string }[] = [
  { value: "jsonl", label: "JSONL" },
  { value: "zip", label: "ZIP" }
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
  const importInProgress = useCollectionsStore((s) => s.importInProgress)
  const importError = useCollectionsStore((s) => s.importError)
  const importResult = useCollectionsStore((s) => s.importResult)
  const importWizardStep = useCollectionsStore((s) => s.importWizardStep)

  const setImportSource = useCollectionsStore((s) => s.setImportSource)
  const setImportFile = useCollectionsStore((s) => s.setImportFile)
  const setImportInProgress = useCollectionsStore((s) => s.setImportInProgress)
  const setImportError = useCollectionsStore((s) => s.setImportError)
  const setImportResult = useCollectionsStore((s) => s.setImportResult)
  const setImportWizardStep = useCollectionsStore((s) => s.setImportWizardStep)
  const resetImportWizard = useCollectionsStore((s) => s.resetImportWizard)

  const activeSource = IMPORT_SOURCES.find((source) => source.value === importSource) || null

  const handleSourceSelect = (source: ImportSource) => {
    setImportSource(source)
    setImportFile(null)
    setImportError(null)
    setImportResult(null)
    setImportWizardStep("upload")
  }

  const handleFileUpload = async (file: File) => {
    setImportFile(file)
    if (!importSource) {
      message.error(t("collections:import.sourceRequired", "Select a source first"))
      return
    }
    setImportInProgress(true)
    setImportError(null)

    try {
      const result = await api.importReadingList({
        source: importSource,
        file
      })
      setImportResult(result)
      setImportWizardStep("result")
      message.success(
        t("collections:import.success", "Imported {{count}} items", {
          count: result.imported
        })
      )
    } catch (error: any) {
      setImportError(error?.message || "Import failed")
      message.error(error?.message || "Import failed")
    } finally {
      setImportInProgress(false)
    }
  }

  const stepItems = [
    { title: t("collections:import.steps.source", "Source") },
    { title: t("collections:import.steps.upload", "Upload") },
    { title: t("collections:import.steps.result", "Result") }
  ]

  const currentStep =
    importWizardStep === "source"
      ? 0
      : importWizardStep === "upload"
        ? 1
        : 2

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
          <Upload.Dragger
            accept=".json,.csv"
            maxCount={1}
            beforeUpload={(file) => {
              handleFileUpload(file)
              return false
            }}
            showUploadList={false}
          >
            {importInProgress ? (
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
                  {t("collections:import.formats", "Supports Pocket JSON and Instapaper CSV")}
                </p>
              </div>
            )}
          </Upload.Dragger>

          {importError && (
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{importError}</span>
            </div>
          )}

          <Button onClick={resetImportWizard}>{t("common:back", "Back")}</Button>
        </div>
      )}

      {importWizardStep === "result" && importResult && (
        <Result
          status={importResult.errors.length === 0 ? "success" : "warning"}
          title={t("collections:import.complete", "Import Complete")}
          subTitle={t(
            "collections:import.resultSummary",
            "Imported: {{imported}}, Updated: {{updated}}, Skipped: {{skipped}}",
            {
              imported: importResult.imported,
              updated: importResult.updated,
              skipped: importResult.skipped
            }
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

  const storedItems = useCollectionsStore((s) => s.items)
  const exportFormat = useCollectionsStore((s) => s.exportFormat)
  const exportInProgress = useCollectionsStore((s) => s.exportInProgress)

  const setExportFormat = useCollectionsStore((s) => s.setExportFormat)
  const setExportInProgress = useCollectionsStore((s) => s.setExportInProgress)

  const [exportItems, setExportItems] = useState<ReadingItemSummary[]>([])
  const [exportItemsLoading, setExportItemsLoading] = useState(false)
  const [exportItemsError, setExportItemsError] = useState<string | null>(null)
  const [exportSearch, setExportSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [copying, setCopying] = useState(false)
  // Progress tracking for batch loading
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number | null }>({
    loaded: 0,
    total: null
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!window.location.search.includes("e2e=1")) return
    const win = window as unknown as {
      __tldw_exportSelectByTitle?: (title: string) => number
      __tldw_exportSelectAll?: () => number
      __tldw_exportClearSelection?: () => number
      __tldw_exportSetFormat?: (format: string) => void
      __tldw_exportFormat?: string
    }
    win.__tldw_exportSelectByTitle = (title: string) => {
      const next = exportItems
        .filter((item) => item.title === title)
        .map((item) => item.id)
      setSelectedIds(next)
      return next.length
    }
    win.__tldw_exportSelectAll = () => {
      const next = exportItems.map((item) => item.id)
      setSelectedIds(next)
      return next.length
    }
    win.__tldw_exportClearSelection = () => {
      setSelectedIds([])
      return 0
    }
    win.__tldw_exportSetFormat = (format: string) => {
      setExportFormat(format as CollectionExportFormat)
    }
    win.__tldw_exportFormat = exportFormat
    return () => {
      delete win.__tldw_exportSelectByTitle
      delete win.__tldw_exportSelectAll
      delete win.__tldw_exportClearSelection
      delete win.__tldw_exportSetFormat
      delete win.__tldw_exportFormat
    }
  }, [exportFormat, exportItems, setExportFormat])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!window.location.search.includes("e2e=1")) return
    const win = window as unknown as { __tldw_exportSelectedCount?: number }
    win.__tldw_exportSelectedCount = selectedIds.length
  }, [selectedIds.length])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!window.location.search.includes("e2e=1")) return
    const win = window as unknown as { __tldw_exportFormat?: string }
    win.__tldw_exportFormat = exportFormat
  }, [exportFormat])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!window.location.search.includes("e2e=1")) return
    const win = window as unknown as {
      __tldw_exportSelectedCount?: number
      __tldw_lastDownload?: { filename: string; type: string; size: number }
    }
    return () => {
      delete win.__tldw_exportSelectedCount
      delete win.__tldw_lastDownload
    }
  }, [])

  useEffect(() => {
    if (exportItems.length === 0 && storedItems.length > 0) {
      setExportItems(storedItems)
    }
  }, [exportItems.length, storedItems])

  useEffect(() => {
    let active = true
    const loadItems = async () => {
      setExportItemsLoading(true)
      setExportItemsError(null)
      setLoadProgress({ loaded: 0, total: null })
      try {
        const allItems: ReadingItemSummary[] = []
        const pageSize = 200
        let page = 1
        let total: number | null = null
        while (page <= 200) {
          const response = await api.getReadingList({ page, size: pageSize })
          const pageItems = Array.isArray(response?.items) ? response.items : []
          allItems.push(...pageItems)
          if (total === null && typeof response?.total === "number") {
            total = response.total
          }
          // Update progress
          if (active) {
            setLoadProgress({ loaded: allItems.length, total })
          }
          if (pageItems.length === 0) break
          if (total !== null && allItems.length >= total) break
          if (pageItems.length < pageSize) break
          page += 1
        }
        if (!active) return
        setExportItems(allItems)
      } catch (error: any) {
        if (!active) return
        setExportItemsError(error?.message || "Failed to load reading items")
      } finally {
        if (active) {
          setExportItemsLoading(false)
          setLoadProgress({ loaded: 0, total: null })
        }
      }
    }
    loadItems()
    return () => {
      active = false
    }
  }, [api])

  const filteredItems = useMemo(() => {
    const q = exportSearch.trim().toLowerCase()
    if (!q) return exportItems
    return exportItems.filter((item) => {
      const haystack = `${item.title} ${item.url || ""} ${item.domain || ""}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [exportItems, exportSearch])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const allFilteredSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedSet.has(item.id))
  const someFilteredSelected =
    filteredItems.length > 0 && filteredItems.some((item) => selectedSet.has(item.id))

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setSelectedIds((prev) => prev.filter((id) => !filteredItems.some((item) => item.id === id)))
        return
      }
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filteredItems.forEach((item) => next.add(item.id))
        return Array.from(next)
      })
    },
    [filteredItems]
  )

  const handleClearSelection = useCallback(() => {
    setSelectedIds([])
  }, [])

  // Keyboard navigation and Shift+click range selection
  const {
    focusedIndex,
    handleItemClick,
    handleItemToggle,
    handleKeyDown,
    listRef
  } = useSelectionKeyboard({
    items: filteredItems,
    selectedIds,
    getItemId: (item) => item.id,
    onSelectionChange: setSelectedIds
  })
  const lastShiftKeyRef = useRef(false)

  const buildJsonlPayload = (items: ReadingItem[]) =>
    items
      .map((item) =>
        JSON.stringify({
          id: item.id,
          title: item.title,
          url: item.url || item.canonical_url || "",
          canonical_url: item.canonical_url,
          domain: item.domain,
          summary: item.summary,
          notes: item.notes,
          status: item.status,
          favorite: item.favorite,
          tags: item.tags,
          created_at: item.created_at,
          updated_at: item.updated_at,
          published_at: item.published_at
        })
      )
      .join("\n")

  const resolveSelectedItems = useCallback(async (): Promise<ReadingItem[]> => {
    const selected = exportItems.filter((item) => selectedSet.has(item.id))
    const detailed = await Promise.all(
      selected.map(async (item) => {
        try {
          return await api.getReadingItem(item.id)
        } catch {
          return item as ReadingItem
        }
      })
    )
    return detailed as ReadingItem[]
  }, [api, exportItems, selectedSet])

  const triggerDownload = (blob: Blob, filename: string) => {
    if (typeof window !== "undefined" && window.location.search.includes("e2e=1")) {
      const win = window as unknown as {
        __tldw_lastDownload?: { filename: string; type: string; size: number }
      }
      win.__tldw_lastDownload = { filename, type: blob.type, size: blob.size }
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExport = async () => {
    setExportInProgress(true)
    try {
      if (selectedIds.length > 0) {
        if (exportFormat === "zip") {
          message.warning(
            t(
              "collections:export.zipSelectionUnsupported",
              "ZIP export doesn't support item selection yet."
            )
          )
          return
        }
        const items = await resolveSelectedItems()
        const payload = buildJsonlPayload(items)
        const blob = new Blob([payload], { type: "application/x-ndjson" })
        triggerDownload(blob, "reading_export_selection.jsonl")
        message.success(t("collections:export.success", "Export ready for download"))
        return
      }
      const response = await api.exportReadingList({ format: exportFormat })
      triggerDownload(response.blob, response.filename)
      message.success(t("collections:export.success", "Export ready for download"))
    } catch (error: any) {
      message.error(error?.message || "Export failed")
    } finally {
      setExportInProgress(false)
    }
  }

  const handleCopy = useCallback(async () => {
    if (selectedIds.length === 0) {
      message.warning(
        t("collections:export.selectItems", "Select items to copy first")
      )
      return
    }
    setCopying(true)
    try {
      const items = await resolveSelectedItems()
      const payload = buildJsonlPayload(items)
      await navigator.clipboard.writeText(payload)
      message.success(t("collections:export.copied", "Copied to clipboard"))
    } catch (error: any) {
      message.error(error?.message || "Copy failed")
    } finally {
      setCopying(false)
    }
  }, [resolveSelectedItems, selectedIds.length, t])

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
            {t("collections:export.items", "Items to Export")}
          </label>
          <Input
            value={exportSearch}
            onChange={(e) => setExportSearch(e.target.value)}
            placeholder={t("collections:export.searchPlaceholder", "Search items...")}
            size="small"
            allowClear
          />
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
            <Checkbox
              indeterminate={someFilteredSelected && !allFilteredSelected}
              checked={allFilteredSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
            >
              {t("collections:export.selectAll", "Select all")}
            </Checkbox>
            <div className="flex items-center gap-2">
              <span aria-live="polite" aria-atomic="true">
                {t("collections:export.selectedCount", "{{count}} selected", {
                  count: selectedIds.length
                })}
              </span>
              {selectedIds.length > 0 && (
                <Button type="link" size="small" onClick={handleClearSelection}>
                  {t("collections:export.clearSelection", "Clear")}
                </Button>
              )}
            </div>
          </div>
          <div
            ref={listRef as React.RefObject<HTMLDivElement>}
            tabIndex={0}
            onKeyDownCapture={handleKeyDown}
            className="mt-2 max-h-48 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
            role="listbox"
            aria-label={t("collections:export.itemList", "Export items list")}
          >
            {exportItemsLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-6">
                <Spin size="small" />
                {loadProgress.total !== null && (
                  <span className="text-xs text-zinc-500">
                    {t("collections:export.loadingProgress", "Loading {{loaded}} / {{total}} items...", {
                      loaded: loadProgress.loaded,
                      total: loadProgress.total
                    })}
                  </span>
                )}
              </div>
            ) : exportItemsError ? (
              <Empty description={exportItemsError} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : filteredItems.length === 0 ? (
              <Empty
                description={t("collections:export.noItems", "No items found")}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <List
                size="small"
                dataSource={filteredItems}
                renderItem={(item, index) => {
                  const isSelected = selectedSet.has(item.id)
                  const isFocused = index === focusedIndex
                  return (
                    <List.Item
                      data-selection-item
                      className={`cursor-pointer py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                        isFocused ? "ring-2 ring-inset ring-blue-400" : ""
                      }`}
                      onClick={(e) => handleItemClick(index, e)}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <Checkbox
                        key={item.id}
                        checked={isSelected}
                        onClick={(e) => {
                          lastShiftKeyRef.current = e.shiftKey
                          e.stopPropagation()
                        }}
                        onKeyDown={(e) => {
                          lastShiftKeyRef.current = e.shiftKey
                        }}
                        onChange={() => {
                          const shiftKey = lastShiftKeyRef.current
                          lastShiftKeyRef.current = false
                          handleItemToggle(index, { shiftKey })
                        }}
                      >
                        <span className="text-sm">{item.title}</span>
                      </Checkbox>
                    </List.Item>
                  )
                }}
              />
            )}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {t(
              "collections:export.selectionHint",
              "Select items to export, or leave empty to export everything."
            )}
          </p>
        </div>

        {/* Warning when ZIP is selected but items are also selected */}
        {exportFormat === "zip" && selectedIds.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message={t(
              "collections:export.zipSelectionWarning",
              "ZIP export doesn't support item selection"
            )}
            description={
              <span>
                {t(
                  "collections:export.zipSelectionHint",
                  "To export selected items, switch to JSONL format or clear your selection to export all items as ZIP."
                )}
                <Button
                  type="link"
                  size="small"
                  className="ml-1 p-0"
                  onClick={() => setExportFormat("jsonl")}
                >
                  {t("collections:export.switchToJsonl", "Switch to JSONL")}
                </Button>
              </span>
            }
          />
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button onClick={handleCopy} disabled={selectedIds.length === 0} loading={copying}>
            {t("collections:export.copy", "Copy JSONL")}
          </Button>
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
      </div>
    </Card>
  )
}

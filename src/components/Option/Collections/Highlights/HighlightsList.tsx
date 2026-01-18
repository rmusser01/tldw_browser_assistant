import React, { useCallback, useEffect, useState } from "react"
import {
  Button,
  Empty,
  Input,
  Pagination,
  Select,
  Spin,
  Switch,
  message,
  Card,
  Modal
} from "antd"
import { Search, RefreshCw, ExternalLink, Layers } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useCollectionsStore } from "@/store/collections"
import { useTldwApiClient } from "@/hooks/useTldwApiClient"
import type { Highlight, HighlightColor } from "@/types/collections"
import { HighlightCard } from "./HighlightCard"
import { HighlightEditor } from "./HighlightEditor"

const COLOR_OPTIONS: { value: HighlightColor | "all"; label: string; color?: string }[] = [
  { value: "all", label: "All Colors" },
  { value: "yellow", label: "Yellow", color: "#fef08a" },
  { value: "green", label: "Green", color: "#bbf7d0" },
  { value: "blue", label: "Blue", color: "#bfdbfe" },
  { value: "pink", label: "Pink", color: "#fbcfe8" },
  { value: "purple", label: "Purple", color: "#ddd6fe" }
]

export const HighlightsList: React.FC = () => {
  const { t } = useTranslation(["collections", "common"])
  const api = useTldwApiClient()

  // Store state
  const highlights = useCollectionsStore((s) => s.highlights)
  const highlightsLoading = useCollectionsStore((s) => s.highlightsLoading)
  const highlightsError = useCollectionsStore((s) => s.highlightsError)
  const highlightsTotal = useCollectionsStore((s) => s.highlightsTotal)
  const highlightsPage = useCollectionsStore((s) => s.highlightsPage)
  const highlightsPageSize = useCollectionsStore((s) => s.highlightsPageSize)
  const highlightsSearch = useCollectionsStore((s) => s.highlightsSearch)
  const highlightsGroupByItem = useCollectionsStore((s) => s.highlightsGroupByItem)
  const filterColor = useCollectionsStore((s) => s.filterColor)
  const highlightEditorOpen = useCollectionsStore((s) => s.highlightEditorOpen)

  // Store actions
  const setHighlights = useCollectionsStore((s) => s.setHighlights)
  const setHighlightsLoading = useCollectionsStore((s) => s.setHighlightsLoading)
  const setHighlightsError = useCollectionsStore((s) => s.setHighlightsError)
  const setHighlightsPage = useCollectionsStore((s) => s.setHighlightsPage)
  const setHighlightsSearch = useCollectionsStore((s) => s.setHighlightsSearch)
  const setHighlightsGroupByItem = useCollectionsStore((s) => s.setHighlightsGroupByItem)
  const setFilterColor = useCollectionsStore((s) => s.setFilterColor)
  const removeHighlight = useCollectionsStore((s) => s.removeHighlight)
  const openItemDetail = useCollectionsStore((s) => s.openItemDetail)
  const openHighlightEditor = useCollectionsStore((s) => s.openHighlightEditor)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Fetch highlights
  const fetchHighlights = useCallback(async () => {
    setHighlightsLoading(true)
    setHighlightsError(null)
    try {
      const listResponse = await api.getReadingList({ page: 1, size: 50 })
      const sourceItems = Array.isArray(listResponse?.items) ? listResponse.items : []
      const limitedItems = sourceItems.slice(0, 50)
      const results = await Promise.all(
        limitedItems.map(async (item) => {
          const itemHighlights = await api.getHighlights(item.id)
          return itemHighlights.map((highlight: Highlight) => ({
            ...highlight,
            item_title: highlight.item_title || item.title
          }))
        })
      )
      const allHighlights = results.flat()
      const q = highlightsSearch.trim().toLowerCase()
      const filtered = allHighlights.filter((highlight) => {
        if (filterColor !== "all" && highlight.color !== filterColor) return false
        if (!q) return true
        const haystack = `${highlight.quote} ${highlight.note || ""}`.toLowerCase()
        return haystack.includes(q)
      })
      const total = filtered.length
      const start = (highlightsPage - 1) * highlightsPageSize
      const paged = filtered.slice(start, start + highlightsPageSize)
      setHighlights(paged, total)
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to fetch highlights"
      setHighlightsError(errorMsg)
      message.error(errorMsg)
    } finally {
      setHighlightsLoading(false)
    }
  }, [
    api,
    highlightsPage,
    highlightsPageSize,
    highlightsSearch,
    filterColor,
    setHighlights,
    setHighlightsLoading,
    setHighlightsError
  ])

  useEffect(() => {
    fetchHighlights()
  }, [fetchHighlights])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setHighlightsSearch(e.target.value)
    },
    [setHighlightsSearch]
  )

  const handlePageChange = useCallback(
    (page: number) => {
      setHighlightsPage(page)
    },
    [setHighlightsPage]
  )

  const handleDeleteClick = useCallback((id: string) => {
    setDeleteTargetId(id)
    setDeleteModalOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTargetId) return
    setDeleteLoading(true)
    try {
      await api.deleteHighlight(deleteTargetId)
      removeHighlight(deleteTargetId)
      message.success(t("collections:highlights.deleted", "Highlight deleted"))
      setDeleteModalOpen(false)
      setDeleteTargetId(null)
    } catch (error: any) {
      message.error(error?.message || "Failed to delete highlight")
    } finally {
      setDeleteLoading(false)
    }
  }, [api, deleteTargetId, removeHighlight, t])

  // Group highlights by item if enabled
  const groupedHighlights = React.useMemo(() => {
    if (!highlightsGroupByItem) return null
    const groups: Record<string, Highlight[]> = {}
    highlights.forEach((h) => {
      const key = h.item_id
      if (!groups[key]) groups[key] = []
      groups[key].push(h)
    })
    return groups
  }, [highlights, highlightsGroupByItem])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={fetchHighlights}
            loading={highlightsLoading}
          >
            {t("common:refresh", "Refresh")}
          </Button>
        </div>

        <div className="flex flex-1 items-center gap-2 sm:max-w-md">
          <Input
            placeholder={t("collections:highlights.searchPlaceholder", "Search highlights...")}
            prefix={<Search className="h-4 w-4 text-gray-400" />}
            value={highlightsSearch}
            onChange={handleSearchChange}
            allowClear
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filterColor}
          onChange={setFilterColor}
          options={COLOR_OPTIONS.map((opt) => ({
            ...opt,
            label: (
              <span className="flex items-center gap-2">
                {opt.color && (
                  <span
                    className="h-3 w-3 rounded"
                    style={{ backgroundColor: opt.color }}
                  />
                )}
                {t(`collections:colors.${opt.value}`, opt.label)}
              </span>
            )
          }))}
          className="w-36"
          size="small"
        />

        <div className="ml-auto flex items-center gap-2">
          <Layers className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-500">
            {t("collections:highlights.groupByItem", "Group by article")}
          </span>
          <Switch
            checked={highlightsGroupByItem}
            onChange={setHighlightsGroupByItem}
            size="small"
          />
        </div>
      </div>

      {/* Highlights List */}
      {highlightsLoading && highlights.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Spin size="large" />
        </div>
      ) : highlightsError ? (
        <Empty description={highlightsError} image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button onClick={fetchHighlights}>{t("common:retry", "Retry")}</Button>
        </Empty>
      ) : highlights.length === 0 ? (
        <Empty
          description={
            highlightsSearch || filterColor !== "all"
              ? t("collections:highlights.noResults", "No highlights match your filters")
              : t("collections:highlights.empty", "No highlights yet")
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <p className="text-sm text-zinc-500">
            {t(
              "collections:highlights.emptyHint",
              "Highlights you create while reading will appear here."
            )}
          </p>
        </Empty>
      ) : highlightsGroupByItem && groupedHighlights ? (
        <div className="space-y-6">
          {Object.entries(groupedHighlights).map(([itemId, itemHighlights]) => (
            <Card
              key={itemId}
              title={
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {itemHighlights[0]?.item_title || "Untitled"}
                  </span>
                  <Button
                    type="link"
                    size="small"
                    icon={<ExternalLink className="h-3 w-3" />}
                    onClick={() => openItemDetail(itemId)}
                  >
                    {t("collections:highlights.viewArticle", "View Article")}
                  </Button>
                </div>
              }
              size="small"
            >
              <div className="space-y-3">
                {itemHighlights.map((highlight) => (
                  <HighlightCard
                    key={highlight.id}
                    highlight={highlight}
                    onDelete={handleDeleteClick}
                    onEdit={openHighlightEditor}
                    compact
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {highlights.map((highlight) => (
            <HighlightCard
              key={highlight.id}
              highlight={highlight}
              onDelete={handleDeleteClick}
              onEdit={openHighlightEditor}
              onViewArticle={() => openItemDetail(highlight.item_id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {highlightsTotal > highlightsPageSize && (
        <div className="flex justify-center pt-4">
          <Pagination
            current={highlightsPage}
            pageSize={highlightsPageSize}
            total={highlightsTotal}
            onChange={handlePageChange}
            showSizeChanger={false}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        title={t("collections:highlights.deleteConfirm.title", "Delete Highlight")}
        open={deleteModalOpen}
        onCancel={() => setDeleteModalOpen(false)}
        onOk={handleDeleteConfirm}
        okText={t("common:delete", "Delete")}
        okButtonProps={{ danger: true, loading: deleteLoading }}
        cancelText={t("common:cancel", "Cancel")}
      >
        <p>
          {t(
            "collections:highlights.deleteConfirm.message",
            "Are you sure you want to delete this highlight?"
          )}
        </p>
      </Modal>

      {highlightEditorOpen && (
        <HighlightEditor onSuccess={fetchHighlights} />
      )}
    </div>
  )
}

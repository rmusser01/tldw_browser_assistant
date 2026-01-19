import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react"
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Search, RefreshCw, ExternalLink, Layers } from "lucide-react"
import { useTranslation } from "react-i18next"
import { HighlightCard } from "@/components/Option/Collections/Highlights/HighlightCard"
import { useCollectionsStore } from "@/store/collections"
import { useTldwApiClient } from "@/hooks/useTldwApiClient"
import type { Highlight, HighlightColor, ReadingItemSummary } from "@/types/collections"

const HighlightEditor = React.lazy(() =>
  import("@/components/Option/Collections/Highlights/HighlightEditor").then((m) => ({
    default: m.HighlightEditor
  }))
)

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

  const queryClient = useQueryClient()

  // Store state
  const highlightsPage = useCollectionsStore((s) => s.highlightsPage)
  const highlightsPageSize = useCollectionsStore((s) => s.highlightsPageSize)
  const highlightsSearch = useCollectionsStore((s) => s.highlightsSearch)
  const highlightsGroupByItem = useCollectionsStore((s) => s.highlightsGroupByItem)
  const filterColor = useCollectionsStore((s) => s.filterColor)
  const highlightEditorOpen = useCollectionsStore((s) => s.highlightEditorOpen)

  // Store actions
  const setHighlightsPage = useCollectionsStore((s) => s.setHighlightsPage)
  const setHighlightsSearch = useCollectionsStore((s) => s.setHighlightsSearch)
  const setHighlightsGroupByItem = useCollectionsStore((s) => s.setHighlightsGroupByItem)
  const setFilterColor = useCollectionsStore((s) => s.setFilterColor)
  const openItemDetail = useCollectionsStore((s) => s.openItemDetail)
  const openHighlightEditor = useCollectionsStore((s) => s.openHighlightEditor)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const fetchHighlights = useCallback(async (): Promise<Highlight[]> => {
    const allItems: ReadingItemSummary[] = []
    const pageSize = 200
    let page = 1
    let listTotal: number | null = null
    let maxPages: number | null = null
    while (maxPages === null || page <= maxPages) {
      const listResponse = await api.getReadingList({ page, size: pageSize })
      const pageItems = Array.isArray(listResponse?.items) ? listResponse.items : []
      allItems.push(...pageItems)
      if (listTotal === null && typeof listResponse?.total === "number") {
        listTotal = listResponse.total
        maxPages = Math.ceil(listTotal / pageSize)
      }
      if (pageItems.length === 0) break
      if (listTotal !== null && allItems.length >= listTotal) break
      if (pageItems.length < pageSize) break
      page += 1
    }
    const results = await Promise.all(
      allItems.map(async (item) => {
        const itemHighlights = await api.getHighlights(item.id)
        return itemHighlights.map((highlight: Highlight) => ({
          ...highlight,
          item_title: highlight.item_title || item.title
        }))
      })
    )
    return results.flat()
  }, [api])

  const highlightsQuery = useQuery({
    queryKey: ["collections-highlights"],
    queryFn: fetchHighlights,
    staleTime: 30_000
  })

  const highlightsError = highlightsQuery.error
    ? highlightsQuery.error instanceof Error
      ? highlightsQuery.error.message
      : "Failed to fetch highlights"
    : null

  useEffect(() => {
    if (!highlightsQuery.error) return
    const err =
      highlightsQuery.error instanceof Error
        ? highlightsQuery.error
        : new Error(String(highlightsQuery.error))
    console.error("Failed to fetch highlights", err)
    message.error(err.message || "Failed to fetch highlights")
  }, [highlightsQuery.error])

  const filteredHighlights = useMemo(() => {
    const allHighlights = highlightsQuery.data ?? []
    const q = highlightsSearch.trim().toLowerCase()
    return allHighlights.filter((highlight) => {
      if (filterColor !== "all" && highlight.color !== filterColor) return false
      if (!q) return true
      const haystack = `${highlight.quote} ${highlight.note || ""}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [highlightsQuery.data, highlightsSearch, filterColor])

  const highlightsTotal = filteredHighlights.length

  const highlights = useMemo(() => {
    const start = (highlightsPage - 1) * highlightsPageSize
    return filteredHighlights.slice(start, start + highlightsPageSize)
  }, [filteredHighlights, highlightsPage, highlightsPageSize])

  const deleteHighlightMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.deleteHighlight(id)
    }
  })

  const {
    refetch: refetchHighlights,
    isLoading: highlightsLoading,
    isFetching: highlightsFetching
  } = highlightsQuery

  const handleRefresh = useCallback(() => {
    void refetchHighlights()
  }, [refetchHighlights])

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
    try {
      await deleteHighlightMutation.mutateAsync(deleteTargetId)
      await queryClient.invalidateQueries({ queryKey: ["collections-highlights"] })
      message.success(t("collections:highlights.deleted", "Highlight deleted"))
      setDeleteModalOpen(false)
      setDeleteTargetId(null)
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      console.error("Failed to delete highlight", err)
      message.error(err.message || "Failed to delete highlight")
    }
  }, [deleteHighlightMutation, deleteTargetId, queryClient, t])

  // Group highlights by item if enabled
  const groupedHighlights = useMemo(() => {
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
            onClick={handleRefresh}
            loading={highlightsFetching}
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
          <Button onClick={handleRefresh}>{t("common:retry", "Retry")}</Button>
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
        okButtonProps={{ danger: true, loading: deleteHighlightMutation.isPending }}
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
        <Suspense fallback={null}>
          <HighlightEditor onSuccess={handleRefresh} />
        </Suspense>
      )}
    </div>
  )
}

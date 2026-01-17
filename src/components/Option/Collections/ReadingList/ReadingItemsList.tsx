import React, { useCallback, useEffect } from "react"
import { Button, Empty, Input, Modal, Pagination, Select, Spin, message } from "antd"
import { Plus, Search, Filter, Star, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useCollectionsStore } from "@/store/collections"
import { useTldwApiClient } from "@/hooks/useTldwApiClient"
import type { ReadingStatus } from "@/types/collections"
import { ReadingItemCard } from "./ReadingItemCard"
import { ReadingItemDetail } from "./ReadingItemDetail"
import { AddUrlModal } from "./AddUrlModal"

const STATUS_OPTIONS: { value: ReadingStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "saved", label: "Saved" },
  { value: "reading", label: "Reading" },
  { value: "read", label: "Read" },
  { value: "archived", label: "Archived" }
]

const SORT_OPTIONS = [
  { value: "created_at", label: "Date Added" },
  { value: "updated_at", label: "Last Updated" },
  { value: "title", label: "Title" }
]

export const ReadingItemsList: React.FC = () => {
  const { t } = useTranslation(["collections", "common"])
  const api = useTldwApiClient()

  // Store state
  const items = useCollectionsStore((s) => s.items)
  const itemsLoading = useCollectionsStore((s) => s.itemsLoading)
  const itemsError = useCollectionsStore((s) => s.itemsError)
  const itemsTotal = useCollectionsStore((s) => s.itemsTotal)
  const itemsPage = useCollectionsStore((s) => s.itemsPage)
  const itemsPageSize = useCollectionsStore((s) => s.itemsPageSize)
  const itemsSearch = useCollectionsStore((s) => s.itemsSearch)
  const filterStatus = useCollectionsStore((s) => s.filterStatus)
  const filterFavorite = useCollectionsStore((s) => s.filterFavorite)
  const sortBy = useCollectionsStore((s) => s.sortBy)
  const sortOrder = useCollectionsStore((s) => s.sortOrder)
  const itemDetailOpen = useCollectionsStore((s) => s.itemDetailOpen)
  const addUrlModalOpen = useCollectionsStore((s) => s.addUrlModalOpen)
  const deleteConfirmOpen = useCollectionsStore((s) => s.deleteConfirmOpen)
  const deleteTargetId = useCollectionsStore((s) => s.deleteTargetId)
  const deleteTargetType = useCollectionsStore((s) => s.deleteTargetType)

  // Store actions
  const setItems = useCollectionsStore((s) => s.setItems)
  const setItemsLoading = useCollectionsStore((s) => s.setItemsLoading)
  const setItemsError = useCollectionsStore((s) => s.setItemsError)
  const setItemsPage = useCollectionsStore((s) => s.setItemsPage)
  const setItemsSearch = useCollectionsStore((s) => s.setItemsSearch)
  const setFilterStatus = useCollectionsStore((s) => s.setFilterStatus)
  const setFilterFavorite = useCollectionsStore((s) => s.setFilterFavorite)
  const setSortBy = useCollectionsStore((s) => s.setSortBy)
  const setSortOrder = useCollectionsStore((s) => s.setSortOrder)
  const openAddUrlModal = useCollectionsStore((s) => s.openAddUrlModal)
  const resetFilters = useCollectionsStore((s) => s.resetFilters)
  const closeDeleteConfirm = useCollectionsStore((s) => s.closeDeleteConfirm)
  const removeItem = useCollectionsStore((s) => s.removeItem)

  const [deleteLoading, setDeleteLoading] = React.useState(false)

  // Fetch items
  const fetchItems = useCallback(async () => {
    setItemsLoading(true)
    setItemsError(null)
    try {
      const response = await api.getReadingList({
        page: itemsPage,
        page_size: itemsPageSize,
        search: itemsSearch || undefined,
        status: filterStatus !== "all" ? filterStatus : undefined,
        is_favorite: filterFavorite ?? undefined,
        sort_by: sortBy,
        sort_order: sortOrder
      })
      setItems(response.items, response.total)
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to fetch reading list"
      setItemsError(errorMsg)
      message.error(errorMsg)
    } finally {
      setItemsLoading(false)
    }
  }, [
    api,
    itemsPage,
    itemsPageSize,
    itemsSearch,
    filterStatus,
    filterFavorite,
    sortBy,
    sortOrder,
    setItems,
    setItemsLoading,
    setItemsError
  ])

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setItemsSearch(e.target.value)
    },
    [setItemsSearch]
  )

  const handlePageChange = useCallback(
    (page: number) => {
      setItemsPage(page)
    },
    [setItemsPage]
  )

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTargetId || deleteTargetType !== "item") return
    setDeleteLoading(true)
    try {
      await api.deleteReadingItem(deleteTargetId)
      removeItem(deleteTargetId)
      message.success(t("collections:reading.deleted", "Article deleted"))
    } catch (error: any) {
      message.error(error?.message || "Failed to delete article")
    } finally {
      setDeleteLoading(false)
      closeDeleteConfirm()
    }
  }, [api, deleteTargetId, deleteTargetType, removeItem, closeDeleteConfirm, t])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={openAddUrlModal}
          >
            {t("collections:reading.addUrl", "Add URL")}
          </Button>
          <Button
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={fetchItems}
            loading={itemsLoading}
          >
            {t("common:refresh", "Refresh")}
          </Button>
        </div>

        <div className="flex flex-1 items-center gap-2 sm:max-w-md">
          <Input
            placeholder={t("collections:reading.searchPlaceholder", "Search articles...")}
            prefix={<Search className="h-4 w-4 text-gray-400" />}
            value={itemsSearch}
            onChange={handleSearchChange}
            allowClear
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-500">
            {t("collections:reading.filters", "Filters")}:
          </span>
        </div>

        <Select
          value={filterStatus}
          onChange={setFilterStatus}
          options={STATUS_OPTIONS.map((opt) => ({
            ...opt,
            label: t(`collections:status.${opt.value}`, opt.label)
          }))}
          className="w-32"
          size="small"
        />

        <Button
          size="small"
          type={filterFavorite === true ? "primary" : "default"}
          icon={<Star className={`h-3 w-3 ${filterFavorite ? "fill-current" : ""}`} />}
          onClick={() => setFilterFavorite(filterFavorite === true ? null : true)}
        >
          {t("collections:reading.favorites", "Favorites")}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {t("collections:reading.sortBy", "Sort")}:
          </span>
          <Select
            value={sortBy}
            onChange={(v) => setSortBy(v as typeof sortBy)}
            options={SORT_OPTIONS.map((opt) => ({
              ...opt,
              label: t(`collections:sort.${opt.value}`, opt.label)
            }))}
            className="w-36"
            size="small"
          />
          <Button
            size="small"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </Button>
        </div>

        {(filterStatus !== "all" || filterFavorite !== null || itemsSearch) && (
          <Button size="small" type="link" onClick={resetFilters}>
            {t("collections:reading.clearFilters", "Clear filters")}
          </Button>
        )}
      </div>

      {/* Items List */}
      {itemsLoading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Spin size="large" />
        </div>
      ) : itemsError ? (
        <Empty
          description={itemsError}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button onClick={fetchItems}>{t("common:retry", "Retry")}</Button>
        </Empty>
      ) : items.length === 0 ? (
        <Empty
          description={
            itemsSearch || filterStatus !== "all" || filterFavorite !== null
              ? t("collections:reading.noResults", "No articles match your filters")
              : t("collections:reading.empty", "Your reading list is empty")
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          {!itemsSearch && filterStatus === "all" && filterFavorite === null && (
            <Button type="primary" onClick={openAddUrlModal}>
              {t("collections:reading.addFirst", "Add your first article")}
            </Button>
          )}
        </Empty>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ReadingItemCard key={item.id} item={item} onRefresh={fetchItems} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {itemsTotal > itemsPageSize && (
        <div className="flex justify-center pt-4">
          <Pagination
            current={itemsPage}
            pageSize={itemsPageSize}
            total={itemsTotal}
            onChange={handlePageChange}
            showSizeChanger={false}
            showTotal={(total, range) =>
              t("collections:reading.pagination", "{{start}}-{{end}} of {{total}} items", {
                start: range[0],
                end: range[1],
                total
              })
            }
          />
        </div>
      )}

      {/* Modals */}
      {addUrlModalOpen && <AddUrlModal onSuccess={fetchItems} />}
      {itemDetailOpen && <ReadingItemDetail onRefresh={fetchItems} />}

      <Modal
        title={t("collections:reading.deleteConfirm.title", "Delete Article")}
        open={deleteConfirmOpen && deleteTargetType === "item"}
        onCancel={closeDeleteConfirm}
        onOk={handleDeleteConfirm}
        okText={t("common:delete", "Delete")}
        okButtonProps={{ danger: true, loading: deleteLoading }}
        cancelText={t("common:cancel", "Cancel")}
      >
        <p>
          {t(
            "collections:reading.deleteConfirm.message",
            "Are you sure you want to delete this article? This action cannot be undone."
          )}
        </p>
      </Modal>
    </div>
  )
}

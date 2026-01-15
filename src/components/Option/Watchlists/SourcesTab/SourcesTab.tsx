import React, { useCallback, useEffect, useState } from "react"
import {
  Button,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  message
} from "antd"
import type { ColumnsType } from "antd/es/table"
import { Edit2, ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useWatchlistsStore } from "@/store/watchlists"
import {
  createWatchlistSource,
  deleteWatchlistSource,
  fetchWatchlistSources,
  fetchWatchlistTags,
  updateWatchlistSource
} from "@/services/watchlists"
import type { WatchlistSource, SourceType } from "@/types/watchlists"
import { formatRelativeTime } from "@/utils/dateFormatters"
import { SourceFormModal } from "./SourceFormModal"

const { Search } = Input

const SOURCE_TYPE_COLORS: Record<SourceType, string> = {
  rss: "blue",
  site: "green",
  forum: "purple"
}

export const SourcesTab: React.FC = () => {
  const { t } = useTranslation(["watchlists", "common"])

  // Store state
  const sources = useWatchlistsStore((s) => s.sources)
  const sourcesLoading = useWatchlistsStore((s) => s.sourcesLoading)
  const sourcesTotal = useWatchlistsStore((s) => s.sourcesTotal)
  const sourcesSearch = useWatchlistsStore((s) => s.sourcesSearch)
  const sourcesPage = useWatchlistsStore((s) => s.sourcesPage)
  const sourcesPageSize = useWatchlistsStore((s) => s.sourcesPageSize)
  const tags = useWatchlistsStore((s) => s.tags)
  const selectedTagName = useWatchlistsStore((s) => s.selectedTagName)
  const sourceFormOpen = useWatchlistsStore((s) => s.sourceFormOpen)
  const sourceFormEditId = useWatchlistsStore((s) => s.sourceFormEditId)

  // Store actions
  const setSources = useWatchlistsStore((s) => s.setSources)
  const setSourcesLoading = useWatchlistsStore((s) => s.setSourcesLoading)
  const setSourcesSearch = useWatchlistsStore((s) => s.setSourcesSearch)
  const setSourcesPage = useWatchlistsStore((s) => s.setSourcesPage)
  const setSourcesPageSize = useWatchlistsStore((s) => s.setSourcesPageSize)
  const setTags = useWatchlistsStore((s) => s.setTags)
  const setSelectedTagName = useWatchlistsStore((s) => s.setSelectedTagName)
  const openSourceForm = useWatchlistsStore((s) => s.openSourceForm)
  const closeSourceForm = useWatchlistsStore((s) => s.closeSourceForm)
  const addSource = useWatchlistsStore((s) => s.addSource)
  const updateSourceInList = useWatchlistsStore((s) => s.updateSourceInList)
  const removeSource = useWatchlistsStore((s) => s.removeSource)

  // Local state
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(
    null
  )

  // Fetch sources
  const loadSources = useCallback(async () => {
    setSourcesLoading(true)
    try {
      const result = await fetchWatchlistSources({
        search: sourcesSearch || undefined,
        tag: selectedTagName || undefined,
        source_type: selectedTypeFilter || undefined,
        limit: sourcesPageSize,
        offset: (sourcesPage - 1) * sourcesPageSize
      })
      setSources(result.items, result.total)
    } catch (err) {
      console.error("Failed to fetch sources:", err)
      message.error(t("watchlists:sources.fetchError", "Failed to load sources"))
    } finally {
      setSourcesLoading(false)
    }
  }, [
    sourcesSearch,
    selectedTagName,
    selectedTypeFilter,
    sourcesPage,
    sourcesPageSize,
    setSources,
    setSourcesLoading,
    t
  ])

  // Fetch tags
  const loadTags = useCallback(async () => {
    try {
      const result = await fetchWatchlistTags()
      setTags(Array.isArray(result) ? result : [])
    } catch (err) {
      console.error("Failed to fetch tags:", err)
      setTags([])
    }
  }, [setTags])

  // Initial load
  useEffect(() => {
    loadSources()
    loadTags()
  }, [loadSources, loadTags])

  // Handle toggle active
  const handleToggleActive = async (source: WatchlistSource) => {
    try {
      const updated = await updateWatchlistSource(source.id, {
        active: !source.active
      })
      updateSourceInList(source.id, updated)
      message.success(
        source.active
          ? t("watchlists:sources.disabled", "Source disabled")
          : t("watchlists:sources.enabled", "Source enabled")
      )
    } catch (err) {
      console.error("Failed to toggle source:", err)
      message.error(t("watchlists:sources.toggleError", "Failed to update source"))
    }
  }

  // Handle delete
  const handleDelete = async (sourceId: number) => {
    try {
      await deleteWatchlistSource(sourceId)
      removeSource(sourceId)
      message.success(t("watchlists:sources.deleted", "Source deleted"))
    } catch (err) {
      console.error("Failed to delete source:", err)
      message.error(t("watchlists:sources.deleteError", "Failed to delete source"))
    }
  }

  // Handle form submit
  const handleFormSubmit = async (
    values: { name: string; url: string; source_type: SourceType; tags: string[] }
  ) => {
    try {
      if (sourceFormEditId) {
        const updated = await updateWatchlistSource(sourceFormEditId, values)
        updateSourceInList(sourceFormEditId, updated)
        message.success(t("watchlists:sources.updated", "Source updated"))
      } else {
        const created = await createWatchlistSource(values)
        addSource(created)
        message.success(t("watchlists:sources.created", "Source created"))
      }
      closeSourceForm()
      loadTags() // Refresh tags in case new ones were added
    } catch (err) {
      console.error("Failed to save source:", err)
      message.error(t("watchlists:sources.saveError", "Failed to save source"))
    }
  }

  // Get source for editing
  const editingSource = sourceFormEditId
    ? sources.find((s) => s.id === sourceFormEditId)
    : undefined

  // Table columns
  const columns: ColumnsType<WatchlistSource> = [
    {
      title: t("watchlists:sources.columns.name", "Name"),
      dataIndex: "name",
      key: "name",
      ellipsis: true,
      render: (name: string, record) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{name}</span>
          {record.url && (
            <Tooltip title={record.url}>
              <a
                href={record.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-zinc-600"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Tooltip>
          )}
        </div>
      )
    },
    {
      title: t("watchlists:sources.columns.type", "Type"),
      dataIndex: "source_type",
      key: "source_type",
      width: 100,
      render: (type: SourceType) => (
        <Tag color={SOURCE_TYPE_COLORS[type] || "default"}>
          {type.toUpperCase()}
        </Tag>
      )
    },
    {
      title: t("watchlists:sources.columns.tags", "Tags"),
      dataIndex: "tags",
      key: "tags",
      width: 200,
      render: (tags: string[]) => (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <Tag key={tag} className="text-xs">
              {tag}
            </Tag>
          ))}
          {tags.length > 3 && (
            <Tag className="text-xs">+{tags.length - 3}</Tag>
          )}
        </div>
      )
    },
    {
      title: t("watchlists:sources.columns.lastScraped", "Last Scraped"),
      dataIndex: "last_scraped_at",
      key: "last_scraped_at",
      width: 150,
      render: (date: string | null) =>
        date ? (
          <span className="text-sm text-zinc-500">
            {formatRelativeTime(date, t)}
          </span>
        ) : (
          <span className="text-sm text-zinc-400">
            {t("watchlists:sources.never", "Never")}
          </span>
        )
    },
    {
      title: t("watchlists:sources.columns.active", "Active"),
      dataIndex: "active",
      key: "active",
      width: 80,
      align: "center",
      render: (active: boolean, record) => (
        <Switch
          checked={active}
          size="small"
          onChange={() => handleToggleActive(record)}
        />
      )
    },
    {
      title: t("watchlists:sources.columns.actions", "Actions"),
      key: "actions",
      width: 100,
      align: "center",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t("common:edit", "Edit")}>
            <Button
              type="text"
              size="small"
              icon={<Edit2 className="h-4 w-4" />}
              onClick={() => openSourceForm(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title={t("watchlists:sources.deleteConfirm", "Delete this source?")}
            onConfirm={() => handleDelete(record.id)}
            okText={t("common:yes", "Yes")}
            cancelText={t("common:no", "No")}
          >
            <Tooltip title={t("common:delete", "Delete")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<Trash2 className="h-4 w-4" />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Search
            placeholder={t("watchlists:sources.searchPlaceholder", "Search sources...")}
            value={sourcesSearch}
            onChange={(e) => setSourcesSearch(e.target.value)}
            onSearch={loadSources}
            allowClear
            className="w-64"
          />
          <Select
            placeholder={t("watchlists:sources.filterByTag", "Filter by tag")}
            value={selectedTagName}
            onChange={setSelectedTagName}
            allowClear
            className="w-40"
            options={(Array.isArray(tags) ? tags : []).map((tag) => ({
              label: tag.name,
              value: tag.name
            }))}
          />
          <Select
            placeholder={t("watchlists:sources.filterByType", "Filter by type")}
            value={selectedTypeFilter}
            onChange={setSelectedTypeFilter}
            allowClear
            className="w-32"
            options={[
              { label: "RSS", value: "rss" },
              { label: "Site", value: "site" },
              { label: "Forum", value: "forum" }
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={loadSources}
            loading={sourcesLoading}
          >
            {t("common:refresh", "Refresh")}
          </Button>
          <Button
            type="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => openSourceForm()}
          >
            {t("watchlists:sources.addSource", "Add Source")}
          </Button>
        </div>
      </div>

      {/* Table */}
      <Table
        dataSource={Array.isArray(sources) ? sources : []}
        columns={columns}
        rowKey="id"
        loading={sourcesLoading}
        pagination={{
          current: sourcesPage,
          pageSize: sourcesPageSize,
          total: sourcesTotal,
          showSizeChanger: true,
          showTotal: (total) =>
            t("watchlists:sources.totalItems", "{{total}} sources", { total }),
          onChange: (page, pageSize) => {
            setSourcesPage(page)
            if (pageSize !== sourcesPageSize) {
              setSourcesPageSize(pageSize)
            }
          }
        }}
        size="middle"
        scroll={{ x: 800 }}
      />

      {/* Source Form Modal */}
      <SourceFormModal
        open={sourceFormOpen}
        onClose={closeSourceForm}
        onSubmit={handleFormSubmit}
        initialValues={editingSource}
        existingTags={(Array.isArray(tags) ? tags : []).map((t) => t.name)}
      />
    </div>
  )
}

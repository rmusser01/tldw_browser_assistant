import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  Button,
  Input,
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
import { Download, Edit2, ExternalLink, Plus, RefreshCw, Trash2, UploadCloud } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useWatchlistsStore } from "@/store/watchlists"
import {
  createWatchlistSource,
  deleteWatchlistSource,
  exportOpml,
  fetchWatchlistSources,
  fetchWatchlistGroups,
  fetchWatchlistTags,
  updateWatchlistSource
} from "@/services/watchlists"
import type { WatchlistSource, SourceType } from "@/types/watchlists"
import { formatRelativeTime } from "@/utils/dateFormatters"
import { SourceFormModal } from "./SourceFormModal"
import { GroupsTree } from "./GroupsTree"
import { SourcesBulkImport } from "./SourcesBulkImport"

const { Search } = Input

const SOURCE_TYPE_COLORS: Record<SourceType, string> = {
  rss: "blue",
  site: "green",
  forum: "purple"
}
const CLIENT_FILTER_PAGE_SIZE = 200
const CLIENT_FILTER_MAX_ITEMS = 1000

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
  const groups = useWatchlistsStore((s) => s.groups)
  const groupsLoading = useWatchlistsStore((s) => s.groupsLoading)
  const selectedGroupId = useWatchlistsStore((s) => s.selectedGroupId)
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
  const setGroups = useWatchlistsStore((s) => s.setGroups)
  const setGroupsLoading = useWatchlistsStore((s) => s.setGroupsLoading)
  const setSelectedGroupId = useWatchlistsStore((s) => s.setSelectedGroupId)
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [bulkWorking, setBulkWorking] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const selectedSources = useMemo(
    () => sources.filter((source) => selectedRowKeys.includes(source.id)),
    [sources, selectedRowKeys]
  )

  // Fetch sources
  const loadSources = useCallback(async () => {
    setSourcesLoading(true)
    try {
      const useClientFilter = Boolean(selectedGroupId || selectedTypeFilter)
      const baseParams = {
        q: sourcesSearch || undefined,
        tags: selectedTagName ? [selectedTagName] : undefined
      }
      let items: WatchlistSource[] = []
      let total = 0

      if (useClientFilter) {
        let page = 1
        while (items.length < CLIENT_FILTER_MAX_ITEMS) {
          const result = await fetchWatchlistSources({
            ...baseParams,
            page,
            size: CLIENT_FILTER_PAGE_SIZE
          })
          const batch = Array.isArray(result.items) ? result.items : []
          if (page === 1) total = result.total || batch.length
          items = items.concat(batch)
          if (items.length >= total || batch.length < CLIENT_FILTER_PAGE_SIZE) {
            break
          }
          page += 1
        }
      } else {
        const result = await fetchWatchlistSources({
          ...baseParams,
          page: sourcesPage,
          size: sourcesPageSize
        })
        items = Array.isArray(result.items) ? result.items : []
        total = result.total || items.length
      }

      if (selectedGroupId) {
        try {
          const opml = await exportOpml({ group: [selectedGroupId] })
          const parser = new DOMParser()
          const doc = parser.parseFromString(opml, "text/xml")
          const urls = Array.from(doc.querySelectorAll("outline[xmlUrl]"))
            .map((node) => node.getAttribute("xmlUrl"))
            .filter((url): url is string => Boolean(url))
          const urlSet = new Set(urls)
          items = items.filter((source) => urlSet.has(source.url))
        } catch (err) {
          console.error("Failed to load group OPML:", err)
          message.error(t("watchlists:sources.groupFilterError", "Failed to load group filter"))
        }
      }

      if (selectedTypeFilter) {
        items = items.filter((source) => source.source_type === selectedTypeFilter)
      }

      total = useClientFilter ? items.length : total
      const pagedItems = useClientFilter
        ? items.slice((sourcesPage - 1) * sourcesPageSize, sourcesPage * sourcesPageSize)
        : items

      setSources(pagedItems, total)
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
    selectedGroupId,
    sourcesPage,
    sourcesPageSize,
    setSources,
    setSourcesLoading,
    t
  ])

  // Fetch tags
  const loadTags = useCallback(async () => {
    try {
      const result = await fetchWatchlistTags({ page: 1, size: 200 })
      setTags(Array.isArray(result.items) ? result.items : [])
    } catch (err) {
      console.error("Failed to fetch tags:", err)
      setTags([])
    }
  }, [setTags])

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true)
    try {
      const result = await fetchWatchlistGroups({ page: 1, size: 200 })
      setGroups(Array.isArray(result.items) ? result.items : [])
    } catch (err) {
      console.error("Failed to fetch groups:", err)
      setGroups([])
    } finally {
      setGroupsLoading(false)
    }
  }, [setGroups, setGroupsLoading])

  // Initial load
  useEffect(() => {
    loadSources()
    loadTags()
    loadGroups()
  }, [loadSources, loadTags, loadGroups])

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

  const handleBulkToggle = async (active: boolean) => {
    if (selectedSources.length === 0) return
    setBulkWorking(true)
    try {
      const results = await Promise.allSettled(
        selectedSources.map((source) =>
          updateWatchlistSource(source.id, { active })
        )
      )
      let successCount = 0
      results.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          updateSourceInList(selectedSources[idx].id, result.value)
          successCount += 1
        }
      })
      message.success(
        t(
          "watchlists:sources.bulkUpdated",
          "{{count}} sources updated",
          { count: successCount }
        )
      )
    } catch (err) {
      console.error("Bulk update failed:", err)
      message.error(t("watchlists:sources.bulkError", "Bulk update failed"))
    } finally {
      setBulkWorking(false)
      setSelectedRowKeys([])
    }
  }

  const handleBulkDelete = async () => {
    if (selectedSources.length === 0) return
    setBulkWorking(true)
    try {
      const results = await Promise.allSettled(
        selectedSources.map((source) => deleteWatchlistSource(source.id))
      )
      let successCount = 0
      results.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          removeSource(selectedSources[idx].id)
          successCount += 1
        }
      })
      message.success(
        t(
          "watchlists:sources.bulkDeleted",
          "{{count}} sources deleted",
          { count: successCount }
        )
      )
    } catch (err) {
      console.error("Bulk delete failed:", err)
      message.error(t("watchlists:sources.bulkDeleteError", "Bulk delete failed"))
    } finally {
      setBulkWorking(false)
      setSelectedRowKeys([])
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

  const handleExport = async () => {
    try {
      const opml = await exportOpml({
        tag: selectedTagName ? [selectedTagName] : undefined,
        group: selectedGroupId ? [selectedGroupId] : undefined,
        type: selectedTypeFilter || undefined
      })
      const blob = new Blob([opml], { type: "application/xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `watchlists_sources_${Date.now()}.opml`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      message.success(t("watchlists:sources.exported", "OPML exported"))
    } catch (err) {
      console.error("Failed to export OPML:", err)
      message.error(t("watchlists:sources.exportError", "Failed to export OPML"))
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
            onChange={(value) => {
              setSelectedTypeFilter(value)
              setSourcesPage(1)
            }}
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
            icon={<Download className="h-4 w-4" />}
            onClick={handleExport}
          >
            {t("watchlists:sources.export", "Export OPML")}
          </Button>
          <Button
            icon={<UploadCloud className="h-4 w-4" />}
            onClick={() => setImportOpen(true)}
          >
            {t("watchlists:sources.import", "Import OPML")}
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

      {selectedRowKeys.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 p-3 text-sm">
          <span className="text-zinc-600 dark:text-zinc-300">
            {t("watchlists:sources.selectedCount", "{{count}} selected", { count: selectedRowKeys.length })}
          </span>
          <Button size="small" onClick={() => handleBulkToggle(true)} loading={bulkWorking}>
            {t("watchlists:sources.bulkEnable", "Enable")}
          </Button>
          <Button size="small" onClick={() => handleBulkToggle(false)} loading={bulkWorking}>
            {t("watchlists:sources.bulkDisable", "Disable")}
          </Button>
          <Popconfirm
            title={t("watchlists:sources.bulkDeleteConfirm", "Delete selected sources?")}
            onConfirm={handleBulkDelete}
            okText={t("common:yes", "Yes")}
            cancelText={t("common:no", "No")}
          >
            <Button size="small" danger loading={bulkWorking}>
              {t("watchlists:sources.bulkDelete", "Delete")}
            </Button>
          </Popconfirm>
          <Button size="small" onClick={() => setSelectedRowKeys([])}>
            {t("common:clear", "Clear")}
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full lg:w-72 shrink-0 space-y-4">
          <GroupsTree
            groups={groups}
            selectedGroupId={selectedGroupId}
            loading={groupsLoading}
            onSelect={setSelectedGroupId}
            onRefresh={loadGroups}
          />
        </div>

        <div className="flex-1">
          <Table
            dataSource={Array.isArray(sources) ? sources : []}
            columns={columns}
            rowKey="id"
            loading={sourcesLoading}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys
            }}
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
        </div>
      </div>

      <SourceFormModal
        open={sourceFormOpen}
        onClose={closeSourceForm}
        onSubmit={handleFormSubmit}
        initialValues={editingSource}
        existingTags={(Array.isArray(tags) ? tags : []).map((t) => t.name)}
      />

      <SourcesBulkImport
        open={importOpen}
        onClose={() => setImportOpen(false)}
        groups={groups}
        tags={tags}
        defaultGroupId={selectedGroupId}
        onImported={() => {
          loadSources()
          loadTags()
          loadGroups()
        }}
      />
    </div>
  )
}

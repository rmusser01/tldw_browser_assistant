import React, { useEffect, useState } from "react"
import { Select, Tabs, Tag } from "antd"
import { Folder, Rss, Tags } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  fetchWatchlistGroups,
  fetchWatchlistSources,
  fetchWatchlistTags
} from "@/services/watchlists"
import type { JobScope, WatchlistGroup, WatchlistSource, WatchlistTag } from "@/types/watchlists"

interface ScopeSelectorProps {
  value: JobScope
  onChange: (scope: JobScope) => void
}

type ScopeMode = "sources" | "groups" | "tags"

export const ScopeSelector: React.FC<ScopeSelectorProps> = ({
  value,
  onChange
}) => {
  const { t } = useTranslation(["watchlists"])

  const [sources, setSources] = useState<WatchlistSource[]>([])
  const [groups, setGroups] = useState<WatchlistGroup[]>([])
  const [tags, setTags] = useState<WatchlistTag[]>([])
  const [loading, setLoading] = useState(false)

  // Determine active mode based on current value
  const getActiveMode = (): ScopeMode => {
    if (value.sources?.length) return "sources"
    if (value.groups?.length) return "groups"
    if (value.tags?.length) return "tags"
    return "sources"
  }

  const [activeMode, setActiveMode] = useState<ScopeMode>(getActiveMode)

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [sourcesRes, groupsRes, tagsRes] = await Promise.all([
          fetchWatchlistSources({ page: 1, size: 500 }),
          fetchWatchlistGroups({ page: 1, size: 200 }),
          fetchWatchlistTags({ page: 1, size: 200 })
        ])
        setSources(sourcesRes.items || [])
        setGroups(groupsRes.items || [])
        setTags(tagsRes.items || [])
      } catch (err) {
        console.error("Failed to load scope data:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Sync active tab when value changes
  useEffect(() => {
    setActiveMode(getActiveMode())
  }, [value])

  // Handle mode change
  const handleModeChange = (mode: string) => {
    setActiveMode(mode as ScopeMode)
  }

  // Handle source selection
  const handleSourcesChange = (sourceIds: number[]) => {
    onChange({
      ...value,
      sources: sourceIds.length > 0 ? sourceIds : undefined
    })
  }

  // Handle group selection
  const handleGroupsChange = (groupIds: number[]) => {
    onChange({
      ...value,
      groups: groupIds.length > 0 ? groupIds : undefined
    })
  }

  // Handle tag selection
  const handleTagsChange = (tagNames: string[]) => {
    onChange({
      ...value,
      tags: tagNames.length > 0 ? tagNames : undefined
    })
  }

  const tabItems = [
    {
      key: "sources",
      label: (
        <span className="flex items-center gap-1.5">
          <Rss className="h-3.5 w-3.5" />
          {t("watchlists:jobs.scope.sources", "Sources")}
        </span>
      ),
      children: (
        <Select
          mode="multiple"
          placeholder={t("watchlists:jobs.scope.selectSources", "Select sources to include")}
          value={value.sources || []}
          onChange={handleSourcesChange}
          loading={loading}
          className="w-full"
          optionFilterProp="label"
          options={sources.map((s) => ({
            label: s.name,
            value: s.id,
            disabled: !s.active
          }))}
          tagRender={(props) => {
            const source = sources.find((s) => s.id === props.value)
            return (
              <Tag closable={props.closable} onClose={props.onClose} className="mr-1">
                {source?.name || props.value}
              </Tag>
            )
          }}
        />
      )
    },
    {
      key: "groups",
      label: (
        <span className="flex items-center gap-1.5">
          <Folder className="h-3.5 w-3.5" />
          {t("watchlists:jobs.scope.groups", "Groups")}
        </span>
      ),
      children: (
        <Select
          mode="multiple"
          placeholder={t("watchlists:jobs.scope.selectGroups", "Select groups to include")}
          value={value.groups || []}
          onChange={handleGroupsChange}
          loading={loading}
          className="w-full"
          optionFilterProp="label"
          options={groups.map((g) => ({
            label: g.name,
            value: g.id
          }))}
          tagRender={(props) => {
            const group = groups.find((g) => g.id === props.value)
            return (
              <Tag closable={props.closable} onClose={props.onClose} className="mr-1">
                {group?.name || props.value}
              </Tag>
            )
          }}
        />
      )
    },
    {
      key: "tags",
      label: (
        <span className="flex items-center gap-1.5">
          <Tags className="h-3.5 w-3.5" />
          {t("watchlists:jobs.scope.tags", "Tags")}
        </span>
      ),
      children: (
        <Select
          mode="multiple"
          placeholder={t("watchlists:jobs.scope.selectTags", "Select tags to include")}
          value={value.tags || []}
          onChange={handleTagsChange}
          loading={loading}
          className="w-full"
          optionFilterProp="label"
          options={tags.map((t) => ({
            label: t.name,
            value: t.name
          }))}
        />
      )
    }
  ]

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
      <Tabs
        activeKey={activeMode}
        onChange={handleModeChange}
        items={tabItems}
        size="small"
      />
      <div className="mt-2 text-xs text-zinc-500">
        {activeMode === "sources" &&
          t("watchlists:jobs.scope.sourcesHelp", "Job will fetch from selected sources directly")}
        {activeMode === "groups" &&
          t("watchlists:jobs.scope.groupsHelp", "Job will fetch from all sources in selected groups")}
        {activeMode === "tags" &&
          t("watchlists:jobs.scope.tagsHelp", "Job will fetch from all sources with selected tags")}
      </div>
    </div>
  )
}

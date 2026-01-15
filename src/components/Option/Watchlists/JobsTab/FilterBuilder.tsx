import React from "react"
import { Button, Input, Select, Space, Switch, Tag } from "antd"
import { Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { FilterAction, FilterType, WatchlistFilter } from "@/types/watchlists"

interface FilterBuilderProps {
  value: WatchlistFilter[]
  onChange: (filters: WatchlistFilter[]) => void
}

const FILTER_TYPES: { value: FilterType; label: string }[] = [
  { value: "keyword", label: "Keyword" },
  { value: "author", label: "Author" },
  { value: "regex", label: "Regex" },
  { value: "date_range", label: "Date Range" }
]

const FILTER_ACTIONS: { value: FilterAction; label: string; color: string }[] = [
  { value: "include", label: "Include", color: "green" },
  { value: "exclude", label: "Exclude", color: "red" },
  { value: "flag", label: "Flag", color: "orange" }
]

const createEmptyFilter = (): WatchlistFilter => ({
  type: "keyword",
  action: "include",
  value: { keywords: [], mode: "any" },
  is_active: true
})

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  value,
  onChange
}) => {
  const { t } = useTranslation(["watchlists"])

  const handleAddFilter = () => {
    onChange([...value, createEmptyFilter()])
  }

  const handleRemoveFilter = (index: number) => {
    const newFilters = [...value]
    newFilters.splice(index, 1)
    onChange(newFilters)
  }

  const handleUpdateFilter = (index: number, updates: Partial<WatchlistFilter>) => {
    const newFilters = [...value]
    newFilters[index] = { ...newFilters[index], ...updates }
    onChange(newFilters)
  }

  const handleTypeChange = (index: number, type: FilterType) => {
    // Reset value when type changes
    let newValue: Record<string, unknown> = {}
    switch (type) {
      case "keyword":
        newValue = { keywords: [], mode: "any" }
        break
      case "author":
        newValue = { authors: [] }
        break
      case "regex":
        newValue = { pattern: "", field: "title" }
        break
      case "date_range":
        newValue = { start: null, end: null }
        break
    }
    handleUpdateFilter(index, { type, value: newValue })
  }

  const renderFilterValue = (filter: WatchlistFilter, index: number) => {
    const filterValue = filter.value as Record<string, unknown>

    switch (filter.type) {
      case "keyword":
        return (
          <div className="flex-1 space-y-2">
            <Select
              mode="tags"
              placeholder={t("watchlists:filters.keywordsPlaceholder", "Enter keywords")}
              value={(filterValue.keywords as string[]) || []}
              onChange={(keywords) =>
                handleUpdateFilter(index, {
                  value: { ...filterValue, keywords }
                })
              }
              className="w-full"
              tokenSeparators={[","]}
            />
            <Select
              value={(filterValue.mode as string) || "any"}
              onChange={(mode) =>
                handleUpdateFilter(index, {
                  value: { ...filterValue, mode }
                })
              }
              className="w-24"
              size="small"
              options={[
                { value: "any", label: t("watchlists:filters.matchAny", "Match any") },
                { value: "all", label: t("watchlists:filters.matchAll", "Match all") }
              ]}
            />
          </div>
        )

      case "author":
        return (
          <Select
            mode="tags"
            placeholder={t("watchlists:filters.authorsPlaceholder", "Enter author names")}
            value={(filterValue.authors as string[]) || []}
            onChange={(authors) =>
              handleUpdateFilter(index, {
                value: { ...filterValue, authors }
              })
            }
            className="flex-1"
            tokenSeparators={[","]}
          />
        )

      case "regex":
        return (
          <div className="flex-1 flex gap-2">
            <Input
              placeholder={t("watchlists:filters.regexPlaceholder", "Regular expression pattern")}
              value={(filterValue.pattern as string) || ""}
              onChange={(e) =>
                handleUpdateFilter(index, {
                  value: { ...filterValue, pattern: e.target.value }
                })
              }
              className="flex-1"
            />
            <Select
              value={(filterValue.field as string) || "title"}
              onChange={(field) =>
                handleUpdateFilter(index, {
                  value: { ...filterValue, field }
                })
              }
              className="w-28"
              options={[
                { value: "title", label: t("watchlists:filters.fieldTitle", "Title") },
                { value: "summary", label: t("watchlists:filters.fieldSummary", "Summary") },
                { value: "content", label: t("watchlists:filters.fieldContent", "Content") },
                { value: "author", label: t("watchlists:filters.fieldAuthor", "Author") }
              ]}
            />
          </div>
        )

      case "date_range":
        return (
          <div className="flex-1 flex gap-2 items-center">
            <Input
              type="date"
              placeholder={t("watchlists:filters.startDate", "Start date")}
              value={(filterValue.start as string) || ""}
              onChange={(e) =>
                handleUpdateFilter(index, {
                  value: { ...filterValue, start: e.target.value || null }
                })
              }
              className="w-36"
            />
            <span className="text-zinc-400">to</span>
            <Input
              type="date"
              placeholder={t("watchlists:filters.endDate", "End date")}
              value={(filterValue.end as string) || ""}
              onChange={(e) =>
                handleUpdateFilter(index, {
                  value: { ...filterValue, end: e.target.value || null }
                })
              }
              className="w-36"
            />
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <div className="text-center py-4 text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg">
          {t("watchlists:filters.noFilters", "No filters configured. All items will be included.")}
        </div>
      ) : (
        value.map((filter, index) => (
          <div
            key={index}
            className="flex items-start gap-3 p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
          >
            {/* Filter type */}
            <Select
              value={filter.type}
              onChange={(type) => handleTypeChange(index, type)}
              className="w-28"
              options={FILTER_TYPES}
            />

            {/* Filter action */}
            <Select
              value={filter.action}
              onChange={(action) => handleUpdateFilter(index, { action })}
              className="w-24"
              options={FILTER_ACTIONS.map((a) => ({
                ...a,
                label: (
                  <Tag color={a.color} className="m-0">
                    {a.label}
                  </Tag>
                )
              }))}
            />

            {/* Filter value (type-specific) */}
            {renderFilterValue(filter, index)}

            {/* Active toggle and delete */}
            <div className="flex items-center gap-2">
              <Switch
                checked={filter.is_active !== false}
                onChange={(checked) =>
                  handleUpdateFilter(index, { is_active: checked })
                }
                size="small"
              />
              <Button
                type="text"
                size="small"
                danger
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => handleRemoveFilter(index)}
              />
            </div>
          </div>
        ))
      )}

      <Button
        type="dashed"
        icon={<Plus className="h-4 w-4" />}
        onClick={handleAddFilter}
        className="w-full"
      >
        {t("watchlists:filters.addFilter", "Add Filter")}
      </Button>

      <div className="text-xs text-zinc-500">
        {t(
          "watchlists:filters.help",
          "Filters determine which items are included, excluded, or flagged during job runs. Include filters require at least one match."
        )}
      </div>
    </div>
  )
}

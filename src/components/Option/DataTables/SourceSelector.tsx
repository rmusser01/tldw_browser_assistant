import React, { useState, useCallback, useEffect } from "react"
import {
  Button,
  Card,
  Empty,
  Input,
  List,
  Segmented,
  Spin,
  Tag,
  message
} from "antd"
import { MessageSquare, FileText, Search, X, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useDataTablesStore } from "@/store/data-tables"
import { tldwClient } from "@/services/tldw/TldwApiClient"
import type { DataTableSource, DataTableSourceType } from "@/types/data-tables"

/**
 * SourceSelector
 *
 * Component for selecting data sources (chats, documents, RAG queries)
 * to use for table generation.
 */
export const SourceSelector: React.FC = () => {
  const { t } = useTranslation(["dataTables", "common"])

  // Store state
  const selectedSources = useDataTablesStore((s) => s.selectedSources)
  const activeSourceType = useDataTablesStore((s) => s.activeSourceType)
  const sourceSearchQuery = useDataTablesStore((s) => s.sourceSearchQuery)

  // Store actions
  const addSource = useDataTablesStore((s) => s.addSource)
  const removeSource = useDataTablesStore((s) => s.removeSource)
  const setActiveSourceType = useDataTablesStore((s) => s.setActiveSourceType)
  const setSourceSearchQuery = useDataTablesStore((s) => s.setSourceSearchQuery)

  // Local state for fetched items
  const [availableItems, setAvailableItems] = useState<DataTableSource[]>([])
  const [loading, setLoading] = useState(false)
  const [ragQuery, setRagQuery] = useState("")

  // Source type options
  const sourceTypeOptions = [
    {
      value: "chat" as DataTableSourceType,
      label: (
        <span className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          {t("dataTables:sourceTypes.chat", "Chats")}
        </span>
      )
    },
    {
      value: "document" as DataTableSourceType,
      label: (
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {t("dataTables:sourceTypes.document", "Documents")}
        </span>
      )
    },
    {
      value: "rag_query" as DataTableSourceType,
      label: (
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          {t("dataTables:sourceTypes.rag", "RAG Search")}
        </span>
      )
    }
  ]

  // Fetch available items based on source type
  const fetchItems = useCallback(async () => {
    if (activeSourceType === "rag_query") {
      // RAG doesn't have a list, user enters query
      setAvailableItems([])
      return
    }

    setLoading(true)
    try {
      if (activeSourceType === "chat") {
        const chats = await tldwClient.listChats({
          limit: 50,
          search: sourceSearchQuery || undefined
        })
        const sources: DataTableSource[] = chats.map((chat) => ({
          type: "chat" as const,
          id: chat.id,
          title: chat.title || `Chat ${chat.id}`,
          snippet: chat.topic_label || undefined
        }))
        setAvailableItems(sources)
      } else if (activeSourceType === "document") {
        // Note: This assumes a media/documents endpoint exists
        // Adjust based on actual API
        try {
          const response = await tldwClient.listChats({
            limit: 50,
            source: "media",
            search: sourceSearchQuery || undefined
          })
          const sources: DataTableSource[] = (response || []).map((item: any) => ({
            type: "document" as const,
            id: String(item.id),
            title: item.title || item.name || `Document ${item.id}`,
            snippet: item.description || item.summary || undefined
          }))
          setAvailableItems(sources)
        } catch {
          // If media endpoint doesn't work, show empty
          setAvailableItems([])
        }
      }
    } catch (error) {
      console.error("Failed to fetch items:", error)
      message.error(t("dataTables:fetchError", "Failed to load items"))
    } finally {
      setLoading(false)
    }
  }, [activeSourceType, sourceSearchQuery, t])

  // Fetch on mount and when source type changes
  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Handle RAG query submission
  const handleRagSearch = () => {
    if (!ragQuery.trim()) return

    const source: DataTableSource = {
      type: "rag_query",
      id: ragQuery.trim(),
      title: `RAG: "${ragQuery.trim()}"`,
      snippet: t("dataTables:ragQuerySnippet", "Knowledge base search query")
    }
    addSource(source)
    setRagQuery("")
    message.success(t("dataTables:ragAdded", "RAG query added as source"))
  }

  // Check if source is selected
  const isSelected = (id: string) => selectedSources.some((s) => s.id === id)

  return (
    <div className="space-y-4">
      {/* Selected sources */}
      {selectedSources.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            {t("dataTables:selectedSources", "Selected Sources")} ({selectedSources.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {selectedSources.map((source) => (
              <Tag
                key={source.id}
                closable
                onClose={() => removeSource(source.id)}
                className="flex items-center gap-1"
              >
                {source.type === "chat" && <MessageSquare className="h-3 w-3" />}
                {source.type === "document" && <FileText className="h-3 w-3" />}
                {source.type === "rag_query" && <Search className="h-3 w-3" />}
                <span className="max-w-[200px] truncate">{source.title}</span>
              </Tag>
            ))}
          </div>
        </div>
      )}

      {/* Source type selector */}
      <Segmented
        value={activeSourceType}
        onChange={(value) => setActiveSourceType(value as DataTableSourceType)}
        options={sourceTypeOptions}
        block
      />

      {/* Search or RAG input */}
      {activeSourceType === "rag_query" ? (
        <div className="flex gap-2">
          <Input
            placeholder={t("dataTables:ragPlaceholder", "Enter a search query for your knowledge base...")}
            value={ragQuery}
            onChange={(e) => setRagQuery(e.target.value)}
            onPressEnter={handleRagSearch}
            prefix={<Search className="h-4 w-4 text-zinc-400" />}
          />
          <Button
            type="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={handleRagSearch}
            disabled={!ragQuery.trim()}
          >
            {t("common:add", "Add")}
          </Button>
        </div>
      ) : (
        <Input
          placeholder={t("dataTables:searchPlaceholder", "Search...")}
          value={sourceSearchQuery}
          onChange={(e) => setSourceSearchQuery(e.target.value)}
          prefix={<Search className="h-4 w-4 text-zinc-400" />}
          allowClear
        />
      )}

      {/* Available items list */}
      {activeSourceType !== "rag_query" && (
        <Card className="max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spin />
            </div>
          ) : availableItems.length === 0 ? (
            <Empty
              description={t(
                "dataTables:noItemsFound",
                "No items found. Try a different search."
              )}
            />
          ) : (
            <List
              dataSource={availableItems}
              renderItem={(item) => (
                <List.Item
                  className={`cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors ${
                    isSelected(item.id)
                      ? "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500"
                      : ""
                  }`}
                  onClick={() => {
                    if (isSelected(item.id)) {
                      removeSource(item.id)
                    } else {
                      addSource(item)
                    }
                  }}
                >
                  <List.Item.Meta
                    avatar={
                      item.type === "chat" ? (
                        <MessageSquare className="h-5 w-5 text-zinc-400" />
                      ) : (
                        <FileText className="h-5 w-5 text-zinc-400" />
                      )
                    }
                    title={
                      <span className="text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </span>
                    }
                    description={
                      item.snippet && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                          {item.snippet}
                        </span>
                      )
                    }
                  />
                  {isSelected(item.id) ? (
                    <Tag color="blue">{t("common:selected", "Selected")}</Tag>
                  ) : (
                    <Button size="small" type="text" icon={<Plus className="h-4 w-4" />}>
                      {t("common:add", "Add")}
                    </Button>
                  )}
                </List.Item>
              )}
            />
          )}
        </Card>
      )}

      {/* Tip for RAG */}
      {activeSourceType === "rag_query" && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t(
            "dataTables:ragTip",
            "Enter search queries to find relevant content in your knowledge base. Each query will be added as a separate source."
          )}
        </p>
      )}
    </div>
  )
}

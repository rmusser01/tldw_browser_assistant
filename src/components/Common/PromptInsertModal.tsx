import React from "react"
import { useQuery } from "@tanstack/react-query"
import { Empty, Input, List, Modal, Select, Tag } from "antd"
import { useTranslation } from "react-i18next"
import { getAllPrompts } from "@/db/dexie/helpers"
import type { Prompt } from "@/db/dexie/types"

export type PromptInsertItem = {
  id: string
  title: string
  content: string
  isSystem: boolean
  tags: string[]
}

type Props = {
  open: boolean
  onClose: () => void
  onInsertPrompt: (prompt: PromptInsertItem) => void
}

const getPromptTags = (prompt: Prompt) => {
  const raw = prompt.keywords ?? prompt.tags ?? []
  if (!Array.isArray(raw)) return []
  return raw
    .map((tag) => String(tag).trim())
    .filter((tag) => tag.length > 0)
}

export const PromptInsertModal: React.FC<Props> = ({
  open,
  onClose,
  onInsertPrompt
}) => {
  const { t } = useTranslation(["option", "settings"])
  const [query, setQuery] = React.useState("")
  const [tagFilter, setTagFilter] = React.useState<string[]>([])

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ["promptInsertPrompts"],
    queryFn: getAllPrompts,
    enabled: open
  })

  React.useEffect(() => {
    if (!open) {
      setQuery("")
      setTagFilter([])
    }
  }, [open])

  const normalizedPrompts = React.useMemo<PromptInsertItem[]>(() => {
    return (prompts || []).map((prompt) => ({
      id: prompt.id,
      title: prompt.title || prompt.name || "Untitled",
      content: prompt.content || "",
      isSystem: Boolean(prompt.is_system),
      tags: getPromptTags(prompt)
    }))
  }, [prompts])

  const tagOptions = React.useMemo(() => {
    const set = new Set<string>()
    for (const prompt of prompts || []) {
      for (const tag of getPromptTags(prompt)) {
        set.add(tag)
      }
    }
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({ label: tag, value: tag }))
  }, [prompts])

  const filteredPrompts = React.useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase()
    return normalizedPrompts.filter((prompt) => {
      const matchesQuery =
        !trimmedQuery ||
        prompt.title.toLowerCase().includes(trimmedQuery) ||
        prompt.content.toLowerCase().includes(trimmedQuery)
      const matchesTags =
        tagFilter.length === 0 ||
        prompt.tags.some((tag) => tagFilter.includes(tag))
      return matchesQuery && matchesTags
    })
  }, [normalizedPrompts, query, tagFilter])

  const systemLabel = t("settings:managePrompts.systemPrompt", {
    defaultValue: "System prompt"
  })
  const quickLabel = t("settings:managePrompts.quickPrompt", {
    defaultValue: "Quick prompt"
  })
  const noMatches = t("option:noMatchingPrompts", "No matching prompts")

  return (
    <Modal
      title={t("option:promptInsert.useInChat", "Insert prompt")}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      centered
    >
      <div className="space-y-3">
        <Input
          value={query}
          allowClear
          placeholder={t("settings:managePrompts.search", {
            defaultValue: "Search prompts..."
          })}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          mode="multiple"
          allowClear
          value={tagFilter}
          placeholder={t("settings:managePrompts.tags.placeholder", {
            defaultValue: "Filter keywords"
          })}
          options={tagOptions}
          onChange={(value) => setTagFilter(value)}
          disabled={tagOptions.length === 0}
        />
        <div className="max-h-80 overflow-auto rounded-md border border-border">
          {filteredPrompts.length === 0 ? (
            <div className="py-8">
              <Empty description={isLoading ? undefined : noMatches} />
            </div>
          ) : (
            <List
              dataSource={filteredPrompts}
              renderItem={(item) => (
                <List.Item className="!p-0">
                  <button
                    type="button"
                    onClick={() => onInsertPrompt(item)}
                    className="w-full px-3 py-2 text-left transition hover:bg-surface2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{item.title}</span>
                      <Tag
                        className="m-0"
                        color={item.isSystem ? "geekblue" : "default"}
                      >
                        {item.isSystem ? systemLabel : quickLabel}
                      </Tag>
                    </div>
                    <div className="text-xs text-text-subtle line-clamp-2">
                      {item.content}
                    </div>
                    {item.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.tags.slice(0, 6).map((tag) => (
                          <Tag key={`${item.id}-${tag}`} className="m-0">
                            {tag}
                          </Tag>
                        ))}
                      </div>
                    )}
                  </button>
                </List.Item>
              )}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}

export default PromptInsertModal

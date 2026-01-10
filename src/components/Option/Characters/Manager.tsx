import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Button,
  Form,
  Input,
  Modal,
  Skeleton,
  Table,
  Tag,
  Tooltip,
  Select,
  Alert,
  Checkbox
} from "antd"
import type { InputRef } from "antd"
import React from "react"
import { tldwClient, type ServerChatSummary } from "@/services/tldw/TldwApiClient"
import { History, Pen, Trash2, UserCircle2, MessageCircle, Copy, ChevronDown, ChevronUp } from "lucide-react"
import { CharacterPreview } from "./CharacterPreview"
import { AvatarField, extractAvatarValues, createAvatarValue } from "./AvatarField"
import { validateAndCreateImageDataUrl } from "@/utils/image-utils"
import { useTranslation } from "react-i18next"
import { useConfirmDanger } from "@/components/Common/confirm-danger"
import { useNavigate } from "react-router-dom"
import { useStorage } from "@plasmohq/storage/hook"
import FeatureEmptyState from "@/components/Common/FeatureEmptyState"
import { useAntdNotification } from "@/hooks/useAntdNotification"
import { focusComposer } from "@/hooks/useComposerFocus"
import { useStoreMessageOption } from "@/store/option"
import { shallow } from "zustand/shallow"
import { updatePageTitle } from "@/utils/update-page-title"
import { normalizeChatRole } from "@/utils/normalize-chat-role"

const MAX_NAME_LENGTH = 75
const MAX_DESCRIPTION_LENGTH = 65
const MAX_TAG_LENGTH = 20
const MAX_TAGS_DISPLAYED = 6

const truncateText = (value?: string, max?: number) => {
  if (!value) return ""
  if (!max || value.length <= max) return value
  return `${value.slice(0, max)}...`
}

const normalizeAlternateGreetings = (value: any): string[] => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).filter((v) => v.trim().length > 0)
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v)).filter((v) => v.trim().length > 0)
      }
    } catch {
      // fall through to newline splitting
    }
    return value
      .split(/\r?\n|;/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
  }
  return []
}

const hasAdvancedData = (record: any, extensionsValue: string): boolean =>
  !!(
    record.personality ||
    record.scenario ||
    record.post_history_instructions ||
    record.message_example ||
    record.creator_notes ||
    (record.alternate_greetings && record.alternate_greetings.length > 0) ||
    record.creator ||
    record.character_version ||
    extensionsValue
  )

const buildCharacterPayload = (values: any): Record<string, any> => {
  const payload: Record<string, any> = {
    name: values.name,
    description: values.description,
    personality: values.personality,
    scenario: values.scenario,
    system_prompt: values.system_prompt,
    post_history_instructions: values.post_history_instructions,
    first_message: values.greeting || values.first_message,
    message_example: values.message_example,
    creator_notes: values.creator_notes,
    tags: Array.isArray(values.tags)
      ? values.tags.filter((tag: string) => tag && tag.trim().length > 0)
      : values.tags,
    alternate_greetings: Array.isArray(values.alternate_greetings)
      ? values.alternate_greetings.filter((g: string) => g && g.trim().length > 0)
      : values.alternate_greetings,
    creator: values.creator,
    character_version: values.character_version,
    extensions: values.extensions
  }

  // Extract avatar values from unified avatar field
  if (values.avatar) {
    const avatarValues = extractAvatarValues(values.avatar)
    if (avatarValues.avatar_url) {
      payload.avatar_url = avatarValues.avatar_url
    }
    if (avatarValues.image_base64) {
      payload.image_base64 = avatarValues.image_base64
    }
  } else {
    // Fallback for legacy form structure
    if (values.avatar_url) {
      payload.avatar_url = values.avatar_url
    }
    if (values.image_base64) {
      payload.image_base64 = values.image_base64
    }
  }

  // Keep compatibility with mock server / older deployments
  if (values.greeting) {
    payload.greeting = values.greeting
  }

  Object.keys(payload).forEach((key) => {
    const v = payload[key]
    if (
      typeof v === "undefined" ||
      v === null ||
      (typeof v === "string" && v.trim().length === 0) ||
      (Array.isArray(v) && v.length === 0)
    ) {
      delete payload[key]
    }
  })

  // Parse extensions JSON when user provides structured data
  if (typeof values.extensions === "string" && values.extensions.trim().length > 0) {
    try {
      payload.extensions = JSON.parse(values.extensions)
    } catch {
      payload.extensions = values.extensions
    }
  }

  return payload
}

type CharactersManagerProps = {
  forwardedNewButtonRef?: React.RefObject<HTMLButtonElement | null>
  autoOpenCreate?: boolean
}

export const CharactersManager: React.FC<CharactersManagerProps> = ({
  forwardedNewButtonRef,
  autoOpenCreate = false
}) => {
  const { t } = useTranslation(["settings", "common"])
  const qc = useQueryClient()
  const navigate = useNavigate()
  const notification = useAntdNotification()
  const confirmDanger = useConfirmDanger()
  const [open, setOpen] = React.useState(false)
  const [openEdit, setOpenEdit] = React.useState(false)
  const [editId, setEditId] = React.useState<string | null>(null)
  const [editVersion, setEditVersion] = React.useState<number | null>(null)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [, setSelectedCharacter] = useStorage<any>("selectedCharacter", null)
  const newButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const lastEditTriggerRef = React.useRef<HTMLButtonElement | null>(null)
  const createNameRef = React.useRef<InputRef>(null)
  const editNameRef = React.useRef<InputRef>(null)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [filterTags, setFilterTags] = React.useState<string[]>([])
  const [matchAllTags, setMatchAllTags] = React.useState(false)
  const [showEditAdvanced, setShowEditAdvanced] = React.useState(false)
  const [showCreateAdvanced, setShowCreateAdvanced] = React.useState(false)
  const [conversationsOpen, setConversationsOpen] = React.useState(false)
  const [conversationCharacter, setConversationCharacter] = React.useState<any | null>(null)
  const [characterChats, setCharacterChats] = React.useState<ServerChatSummary[]>([])
  const [chatsError, setChatsError] = React.useState<string | null>(null)
  const [loadingChats, setLoadingChats] = React.useState(false)
  const [resumingChatId, setResumingChatId] = React.useState<string | null>(null)
  const [createFormDirty, setCreateFormDirty] = React.useState(false)
  const [editFormDirty, setEditFormDirty] = React.useState(false)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState("")
  const searchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showCreatePreview, setShowCreatePreview] = React.useState(false)
  const [showEditPreview, setShowEditPreview] = React.useState(false)
  const autoOpenCreateHandledRef = React.useRef(false)

  React.useEffect(() => {
    if (forwardedNewButtonRef && newButtonRef.current) {
      // Expose the "New character" button to parent workspaces that may
      // want to focus it (e.g., when coming from a persistence error).
      // The ref object itself is stable; assign its current value once.
      // eslint-disable-next-line no-param-reassign
      ;(forwardedNewButtonRef as any).current = newButtonRef.current
    }
  }, [forwardedNewButtonRef])

  React.useEffect(() => {
    if (!autoOpenCreate) {
      autoOpenCreateHandledRef.current = false
      return
    }
    if (autoOpenCreateHandledRef.current) return
    autoOpenCreateHandledRef.current = true
    setOpen(true)
  }, [autoOpenCreate])

  // C8: Debounce search input to reduce API calls
  React.useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = null
      }
    }
  }, [searchTerm])

  const hasFilters =
    searchTerm.trim().length > 0 || (filterTags && filterTags.length > 0)

  const {
    setHistory,
    setMessages,
    setHistoryId,
    setServerChatId,
    setServerChatState,
    setServerChatTopic,
    setServerChatClusterId,
    setServerChatSource,
    setServerChatExternalRef
  } = useStoreMessageOption(
    (state) => ({
      setHistory: state.setHistory,
      setMessages: state.setMessages,
      setHistoryId: state.setHistoryId,
      setServerChatId: state.setServerChatId,
      setServerChatState: state.setServerChatState,
      setServerChatTopic: state.setServerChatTopic,
      setServerChatClusterId: state.setServerChatClusterId,
      setServerChatSource: state.setServerChatSource,
      setServerChatExternalRef: state.setServerChatExternalRef
    }),
    shallow
  )

  const characterIdentifier = (record: any): string =>
    String(record?.id ?? record?.slug ?? record?.name ?? "")

  const formatUpdatedLabel = (value?: string | null) => {
    const fallback = t("settings:manageCharacters.conversations.unknownTime", {
      defaultValue: "Unknown"
    })
    let formatted = fallback
    if (value) {
      try {
        formatted = new Date(value).toLocaleString()
      } catch {
        formatted = String(value)
      }
    }
    return t("settings:manageCharacters.conversations.updated", {
      defaultValue: "Updated {{time}}",
      time: formatted
    })
  }

  const {
    data,
    status,
    error,
    refetch
  } = useQuery({
    queryKey: [
      "tldw:listCharacters",
      {
        search: debouncedSearchTerm.trim() || "",
        tags: filterTags.slice().sort(),
        matchAll: matchAllTags
      }
    ],
    queryFn: async () => {
      try {
        await tldwClient.initialize()
        const query = debouncedSearchTerm.trim()
        const tags = filterTags.filter((t) => t.trim().length > 0)
        const hasSearch = query.length > 0
        const hasTags = tags.length > 0

        if (!hasSearch && !hasTags) {
          const list = await tldwClient.listCharacters()
          return Array.isArray(list) ? list : []
        }

        if (hasSearch && !hasTags) {
          const list = await tldwClient.searchCharacters(query)
          return Array.isArray(list) ? list : []
        }

        if (!hasSearch && hasTags) {
          const list = await tldwClient.filterCharactersByTags(tags, {
            match_all: matchAllTags
          })
          return Array.isArray(list) ? list : []
        }

        // When both search and tags are active, use server search then filter client-side by tags
        const searched = await tldwClient.searchCharacters(query)
        const normalized = Array.isArray(searched) ? searched : []
        const filtered = normalized.filter((c: any) => {
          const ct: string[] = Array.isArray(c?.tags)
            ? c.tags
            : typeof c?.tags === "string"
              ? [c.tags]
              : []
          if (ct.length === 0) return false
          if (matchAllTags) {
            return tags.every((tag) => ct.includes(tag))
          }
          return tags.some((tag) => ct.includes(tag))
        })
        return filtered
      } catch (e: any) {
        notification.error({
          message: t("settings:manageCharacters.notification.error", {
            defaultValue: "Error"
          }),
          description:
            e?.message ||
            t("settings:manageCharacters.notification.someError", {
              defaultValue: "Something went wrong. Please try again later"
            })
        })
        throw e
      }
    }
  })

  const allTags = React.useMemo(() => {
    const set = new Set<string>()
    ;(data || []).forEach((c: any) =>
      (c?.tags || []).forEach((tag: string) => set.add(tag))
    )
    return Array.from(set.values())
  }, [data])

  const tagFilterOptions = React.useMemo(
    () =>
      Array.from(
        new Set([...(allTags || []), ...(filterTags || [])].filter(Boolean))
      ).map((tag) => ({ label: tag, value: tag })),
    [allTags, filterTags]
  )

  const { mutate: createCharacter, isPending: creating } = useMutation({
    mutationFn: async (values: any) =>
      tldwClient.createCharacter(buildCharacterPayload(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tldw:listCharacters"] })
      setOpen(false)
      createForm.resetFields()
      notification.success({
        message: t("settings:manageCharacters.notification.addSuccess", {
          defaultValue: "Character created"
        })
      })
      setTimeout(() => {
        newButtonRef.current?.focus()
      }, 0)
    },
    onError: (e: any) =>
      notification.error({
        message: t("settings:manageCharacters.notification.error", {
          defaultValue: "Error"
        }),
        description:
          e?.message ||
          t("settings:manageCharacters.notification.someError", {
            defaultValue: "Something went wrong. Please try again later"
          })
      })
  })
  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        createNameRef.current?.focus()
      }, 0)
    }
  }, [open])

  React.useEffect(() => {
    if (openEdit) {
      setTimeout(() => {
        editNameRef.current?.focus()
      }, 0)
    }
  }, [openEdit])

  React.useEffect(() => {
    if (!conversationsOpen || !conversationCharacter) return
    let cancelled = false
    const load = async () => {
      setLoadingChats(true)
      setChatsError(null)
      setCharacterChats([])
      try {
        await tldwClient.initialize()
        const characterId = characterIdentifier(conversationCharacter)
        const chats = await tldwClient.listChats({
          character_id: characterId || undefined,
          limit: 100,
          ordering: "-updated_at"
        })
        if (!cancelled) {
          const filtered = Array.isArray(chats)
            ? chats.filter(
                (c) =>
                  characterId &&
                  String(c.character_id ?? "") === String(characterId)
              )
            : []
          setCharacterChats(filtered)
        }
      } catch {
        if (!cancelled) {
          setChatsError(
            t("settings:manageCharacters.conversations.error", {
              defaultValue:
                "Unable to load conversations for this character."
            })
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingChats(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [conversationsOpen, conversationCharacter, t])

  const { mutate: updateCharacter, isPending: updating } = useMutation({
    mutationFn: async (values: any) => {
      if (!editId) {
        throw new Error("No character selected for editing")
      }
      return await tldwClient.updateCharacter(
        editId,
        buildCharacterPayload(values),
        editVersion ?? undefined
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tldw:listCharacters"] })
      setOpenEdit(false)
      editForm.resetFields()
      setEditId(null)
      notification.success({
        message: t("settings:manageCharacters.notification.updatedSuccess", {
          defaultValue: "Character updated"
        })
      })
      setTimeout(() => {
        lastEditTriggerRef.current?.focus()
      }, 0)
    },
    onError: (e: any) =>
      notification.error({
        message: t("settings:manageCharacters.notification.error", {
          defaultValue: "Error"
        }),
        description:
          e?.message ||
          t("settings:manageCharacters.notification.someError", {
            defaultValue: "Something went wrong. Please try again later"
          })
      })
  })

  const { mutate: deleteCharacter, isPending: deleting } = useMutation({
    mutationFn: async (id: string) => tldwClient.deleteCharacter(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tldw:listCharacters"] })
      notification.success({
        message: t("settings:manageCharacters.notification.deletedSuccess", {
          defaultValue: "Character deleted"
        })
      })
    },
    onError: (e: any) =>
      notification.error({
        message: t("settings:manageCharacters.notification.error", {
          defaultValue: "Error"
        }),
        description:
          e?.message ||
          t("settings:manageCharacters.notification.someError", {
            defaultValue: "Something went wrong. Please try again later"
          })
      })
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="primary"
          ref={newButtonRef}
          onClick={() => setOpen(true)}>
          {t("settings:manageCharacters.addBtn", {
            defaultValue: "New character"
          })}
        </Button>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Input
            allowClear
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t(
              "settings:manageCharacters.search.placeholder",
              {
                defaultValue: "Search characters"
              }
            )}
            aria-label={t("settings:manageCharacters.search.label", {
              defaultValue: "Search characters"
            })}
            className="sm:max-w-xs"
          />
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
            <Select
              mode="multiple"
              allowClear
              className="min-w-[12rem]"
              placeholder={t(
                "settings:manageCharacters.filter.tagsPlaceholder",
                {
                  defaultValue: "Filter by tags"
                }
              )}
              aria-label={t(
                "settings:manageCharacters.filter.tagsAriaLabel",
                {
                  defaultValue: "Filter characters by tags"
                }
              )}
              value={filterTags}
              options={tagFilterOptions}
              onChange={(value) =>
                setFilterTags(
                  (value as string[]).filter((v) => v && v.trim().length > 0)
                )
              }
            />
            <Checkbox
              checked={matchAllTags}
              onChange={(e) => setMatchAllTags(e.target.checked)}>
              {t("settings:manageCharacters.filter.matchAll", {
                defaultValue: "Match all tags"
              })}
            </Checkbox>
          </div>
        </div>
      </div>
      {/* Accessible live region for search results */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {status === "success" &&
          t("settings:manageCharacters.aria.searchResults", {
            defaultValue: "{{count}} characters found",
            count: data?.length ?? 0
          })}
      </div>
      {status === "error" && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4">
          <Alert
            type="error"
            message={t("settings:manageCharacters.loadError.title", {
              defaultValue: "Couldn't load characters"
            })}
            description={
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-danger">
                  {(error as any)?.message ||
                    t("settings:manageCharacters.loadError.description", {
                      defaultValue: "Check your connection and try again."
                    })}
                </span>
                <Button size="small" onClick={() => refetch()}>
                  {t("common:retry", { defaultValue: "Retry" })}
                </Button>
              </div>
            }
            showIcon
            className="border-0 bg-transparent p-0"
          />
        </div>
      )}
      {status === "pending" && <Skeleton active paragraph={{ rows: 6 }} />}
      {status === "success" &&
        Array.isArray(data) &&
        data.length === 0 &&
        !hasFilters && (
          <FeatureEmptyState
            title={t("settings:manageCharacters.emptyTitle", {
              defaultValue: "No characters yet"
            })}
            description={t("settings:manageCharacters.emptyDescription", {
              defaultValue:
                "Create a reusable character with a name, description, and system prompt you can chat with."
            })}
            primaryActionLabel={t(
              "settings:manageCharacters.emptyPrimaryCta",
              {
                defaultValue: "Create character"
              }
            )}
            onPrimaryAction={() => setOpen(true)}
          />
        )}
      {status === "success" &&
        Array.isArray(data) &&
        data.length === 0 &&
        hasFilters && (
          <div className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-text">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {t("settings:manageCharacters.filteredEmptyTitle", {
                    defaultValue: "No characters match your filters"
                  })}
                </span>
                <Button
                  size="small"
                  onClick={() => {
                    setSearchTerm("")
                    setFilterTags([])
                    setMatchAllTags(false)
                    refetch()
                  }}>
                  {t("settings:manageCharacters.filter.clear", {
                    defaultValue: "Clear filters"
                  })}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-subtle">
                {searchTerm.trim() && (
                  <span className="inline-flex items-center gap-1 rounded bg-surface2 px-2 py-0.5">
                    {t("settings:manageCharacters.filter.activeSearch", {
                      defaultValue: "Search: \"{{term}}\"",
                      term: searchTerm.trim()
                    })}
                  </span>
                )}
                {filterTags.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded bg-surface2 px-2 py-0.5">
                    {t("settings:manageCharacters.filter.activeTags", {
                      defaultValue: "Tags: {{tags}}",
                      tags: filterTags.join(", ")
                    })}
                    {matchAllTags && (
                      <span className="text-text-subtle">
                        ({t("settings:manageCharacters.filter.matchAllLabel", { defaultValue: "all" })})
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      {status === "success" && Array.isArray(data) && data.length > 0 && (
        <div className="overflow-x-auto">
          <Table
            rowKey={(r: any) => r.id || r.slug || r.name}
            dataSource={data}
            columns={[
            {
              title: (
                <span className="sr-only">
                  {t("settings:manageCharacters.columns.avatar", {
                    defaultValue: "Avatar"
                  })}
                </span>
              ),
              key: "avatar",
              width: 48,
              render: (_: any, record: any) =>
                record?.avatar_url ? (
                  <img
                    src={record.avatar_url}
                    className="w-6 h-6 rounded-full"
                    alt={
                      record?.name
                        ? t("settings:manageCharacters.avatarAltWithName", {
                            defaultValue: "Avatar of {{name}}",
                            name: record.name
                          })
                        : t("settings:manageCharacters.avatarAlt", {
                            defaultValue: "User avatar"
                          })
                    }
                  />
                ) : (
                  <UserCircle2 className="w-5 h-5" />
                )
            },
            {
              title: t("settings:manageCharacters.columns.name", {
                defaultValue: "Name"
              }),
              dataIndex: "name",
              key: "name",
              sorter: (a: any, b: any) => (a.name || "").localeCompare(b.name || ""),
              sortDirections: ["ascend", "descend"] as const,
              render: (v: string) => (
                <span className="line-clamp-1" title={v || undefined}>
                  {truncateText(v, MAX_NAME_LENGTH)}
                </span>
              )
            },
            {
              title: t("settings:manageCharacters.columns.description", {
                defaultValue: "Description"
              }),
              dataIndex: "description",
              key: "description",
              render: (v: string) => (
                    <span className="line-clamp-1" title={v || undefined}>
                      {v ? (
                        truncateText(v, MAX_DESCRIPTION_LENGTH)
                      ) : (
                    <span className="text-text-subtle">
                      {t("settings:manageCharacters.table.noDescription", {
                        defaultValue: "—"
                      })}
                    </span>
                  )}
                </span>
              )
            },
            {
              title: t("settings:manageCharacters.tags.label", {
                defaultValue: "Tags"
              }),
              dataIndex: "tags",
              key: "tags",
              render: (tags: string[]) => {
                const all = tags || []
                const visible = all.slice(0, MAX_TAGS_DISPLAYED)
                const hasMore = all.length > MAX_TAGS_DISPLAYED
                const hiddenCount = all.length - MAX_TAGS_DISPLAYED
                const hiddenTags = all.slice(MAX_TAGS_DISPLAYED)
                return (
                  <div className="flex flex-wrap gap-1">
                    {visible.map((tag: string, index: number) => (
                      <Tag key={`${tag}-${index}`}>
                        {truncateText(tag, MAX_TAG_LENGTH)}
                      </Tag>
                    ))}
                    {hasMore && (
                      <Tooltip
                        title={
                          <div>
                            <div className="font-medium mb-1">
                              {t("settings:manageCharacters.tags.moreCount", {
                                defaultValue: "+{{count}} more tags",
                                count: hiddenCount
                              })}
                            </div>
                            <div className="text-xs">
                              {hiddenTags.join(", ")}
                            </div>
                          </div>
                        }
                      >
                        <span className="text-xs text-text-subtle cursor-help">
                          +{hiddenCount}
                        </span>
                      </Tooltip>
                    )}
                  </div>
                )
              }
            },
            {
              title: t("settings:manageCharacters.columns.actions", {
                defaultValue: "Actions"
              }),
              key: "actions",
              render: (_: any, record: any) => {
                const chatLabel = t("settings:manageCharacters.actions.chat", {
                  defaultValue: "Chat"
                })
                const editLabel = t(
                  "settings:manageCharacters.actions.edit",
                  {
                    defaultValue: "Edit"
                  }
                )
                const deleteLabel = t(
                  "settings:manageCharacters.actions.delete",
                  {
                    defaultValue: "Delete"
                  }
                )
                const duplicateLabel = t(
                  "settings:manageCharacters.actions.duplicate",
                  {
                    defaultValue: "Duplicate"
                  }
                )
                const name = record?.name || record?.title || record?.slug || ""
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    <Tooltip
                      title={chatLabel}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-primary transition hover:border-primary/30 hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-1 focus:ring-offset-bg"
                        aria-label={t("settings:manageCharacters.aria.chatWith", {
                          defaultValue: "Chat as {{name}}",
                          name
                        })}
                        onClick={() => {
                          const id = record.id || record.slug || record.name
                          setSelectedCharacter({
                            id,
                            name: record.name || record.title || record.slug,
                            system_prompt:
                              record.system_prompt ||
                              record.systemPrompt ||
                              record.instructions ||
                              "",
                            greeting:
                              record.greeting ||
                              record.first_message ||
                              record.greet ||
                              "",
                            avatar_url:
                              record.avatar_url ||
                              validateAndCreateImageDataUrl(record.image_base64) ||
                              ""
                          })
                          navigate("/")
                          setTimeout(() => {
                            focusComposer()
                          }, 0)
                        }}>
                        <MessageCircle className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs font-medium">
                          {chatLabel}
                        </span>
                      </button>
                    </Tooltip>
                    <Tooltip
                      title={t("settings:manageCharacters.actions.viewConversations", {
                        defaultValue: "View conversations"
                      })}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-text-muted transition hover:border-border hover:bg-surface2 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-1 focus:ring-offset-bg"
                        aria-label={t("settings:manageCharacters.aria.viewConversations", {
                          defaultValue: "View conversations for {{name}}",
                          name
                        })}
                        onClick={() => {
                          setConversationCharacter(record)
                          setCharacterChats([])
                          setChatsError(null)
                          setConversationsOpen(true)
                        }}>
                        <History className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs font-medium">
                          {t("settings:manageCharacters.actions.viewConversations", {
                            defaultValue: "View conversations"
                          })}
                        </span>
                      </button>
                    </Tooltip>
                    <Tooltip
                      title={editLabel}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-text-muted transition hover:border-border hover:bg-surface2 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-1 focus:ring-offset-bg"
                        aria-label={t("settings:manageCharacters.aria.edit", {
                          defaultValue: "Edit character {{name}}",
                          name
                        })}
                        onClick={(e) => {
                          lastEditTriggerRef.current = e.currentTarget
                          setEditId(record.id || record.slug || record.name)
                          setEditVersion(record?.version ?? null)
                          const ex = record.extensions
                          const extensionsValue =
                            ex && typeof ex === "object" && !Array.isArray(ex)
                              ? JSON.stringify(ex, null, 2)
                              : typeof ex === "string"
                                ? ex
                                : ""
                          editForm.setFieldsValue({
                            name: record.name,
                            description: record.description,
                            avatar: createAvatarValue(record.avatar_url, record.image_base64),
                            tags: record.tags,
                            greeting:
                              record.greeting ||
                              record.first_message ||
                              record.greet,
                            system_prompt: record.system_prompt,
                            personality: record.personality,
                            scenario: record.scenario,
                            post_history_instructions:
                              record.post_history_instructions,
                            message_example: record.message_example,
                            creator_notes: record.creator_notes,
                            alternate_greetings: normalizeAlternateGreetings(
                              record.alternate_greetings
                            ),
                            creator: record.creator,
                            character_version: record.character_version,
                            extensions: extensionsValue
                          })
                          // Auto-expand advanced section if character has advanced field data
                          setShowEditAdvanced(hasAdvancedData(record, extensionsValue))
                          setOpenEdit(true)
                        }}>
                        <Pen className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs font-medium">
                          {editLabel}
                        </span>
                      </button>
                    </Tooltip>
                    <Tooltip
                      title={duplicateLabel}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-text-muted transition hover:border-border hover:bg-surface2 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-1 focus:ring-offset-bg"
                        aria-label={t("settings:manageCharacters.aria.duplicate", {
                          defaultValue: "Duplicate character {{name}}",
                          name
                        })}
                        onClick={() => {
                          // Pre-fill create form with character data (excluding id/version)
                          const ex = record.extensions
                          const extensionsValue =
                            ex && typeof ex === "object" && !Array.isArray(ex)
                              ? JSON.stringify(ex, null, 2)
                              : typeof ex === "string"
                                ? ex
                                : ""
                          createForm.setFieldsValue({
                            name: `${record.name || ""} (copy)`,
                            description: record.description,
                            avatar: createAvatarValue(record.avatar_url, record.image_base64),
                            tags: record.tags,
                            greeting:
                              record.greeting ||
                              record.first_message ||
                              record.greet,
                            system_prompt: record.system_prompt,
                            personality: record.personality,
                            scenario: record.scenario,
                            post_history_instructions:
                              record.post_history_instructions,
                            message_example: record.message_example,
                            creator_notes: record.creator_notes,
                            alternate_greetings: normalizeAlternateGreetings(
                              record.alternate_greetings
                            ),
                            creator: record.creator,
                            character_version: record.character_version,
                            extensions: extensionsValue
                          })
                          // Auto-expand advanced section if source character has advanced data
                          setShowCreateAdvanced(hasAdvancedData(record, extensionsValue))
                          setOpen(true)
                        }}>
                        <Copy className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs font-medium">
                          {duplicateLabel}
                        </span>
                      </button>
                    </Tooltip>
                    <Tooltip
                      title={deleteLabel}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-danger transition hover:border-danger/30 hover:bg-danger/10 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-1 focus:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={t("settings:manageCharacters.aria.delete", {
                          defaultValue: "Delete character {{name}}",
                          name
                        })}
                        disabled={deleting}
                        onClick={async () => {
                          const ok = await confirmDanger({
                            title: t("common:confirmTitle", {
                              defaultValue: "Please confirm"
                            }),
                            content: t(
                              "settings:manageCharacters.confirm.delete",
                              {
                                defaultValue:
                                  "Are you sure you want to delete this character? This action cannot be undone."
                              }
                            ),
                            okText: t("common:delete", { defaultValue: "Delete" }),
                            cancelText: t("common:cancel", {
                              defaultValue: "Cancel"
                            })
                          })
                          if (ok) {
                            deleteCharacter(record.id || record.slug || record.name)
                          }
                        }}>
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs font-medium">
                          {deleteLabel}
                        </span>
                      </button>
                    </Tooltip>
                  </div>
                )
              }
            }
          ]}
          />
        </div>
      )}

      <Modal
        title={
          conversationCharacter
            ? t("settings:manageCharacters.conversations.title", {
                defaultValue: "Conversations for {{name}}",
                name:
                  conversationCharacter.name ||
                  conversationCharacter.title ||
                  conversationCharacter.slug ||
                  ""
              })
            : t("settings:manageCharacters.conversations.titleGeneric", {
                defaultValue: "Character conversations"
              })
        }
        open={conversationsOpen}
        onCancel={() => {
          setConversationsOpen(false)
          setConversationCharacter(null)
          setCharacterChats([])
          setChatsError(null)
          setResumingChatId(null)
        }}
        footer={null}
        destroyOnHidden>
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            {t("settings:manageCharacters.conversations.subtitle", {
              defaultValue:
                "Select a conversation to continue as this character."
            })}
          </p>
          {chatsError && (
            <Alert
              type="error"
              showIcon
              message={chatsError}
              action={
                <Button
                  size="small"
                  onClick={async () => {
                    if (!conversationCharacter) return
                    setChatsError(null)
                    setLoadingChats(true)
                    setCharacterChats([])
                    try {
                      await tldwClient.initialize()
                      const characterId = characterIdentifier(conversationCharacter)
                      const chats = await tldwClient.listChats({
                        character_id: characterId || undefined,
                        limit: 100,
                        ordering: "-updated_at"
                      })
                      const filtered = Array.isArray(chats)
                        ? chats.filter(
                            (c) =>
                              characterId &&
                              String(c.character_id ?? "") === String(characterId)
                          )
                        : []
                      setCharacterChats(filtered)
                    } catch {
                      setChatsError(
                        t("settings:manageCharacters.conversations.error", {
                          defaultValue:
                            "Unable to load conversations for this character."
                        })
                      )
                    } finally {
                      setLoadingChats(false)
                    }
                  }}>
                  {t("common:retry", { defaultValue: "Retry" })}
                </Button>
              }
            />
          )}
          {loadingChats && <Skeleton active title paragraph={{ rows: 4 }} />}
          {!loadingChats && !chatsError && (
            <>
              {characterChats.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-surface2 p-3 text-sm text-text-muted">
                  {t("settings:manageCharacters.conversations.empty", {
                    defaultValue: "No conversations found for this character yet."
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {characterChats.map((chat, index) => (
                    <div
                      key={chat.id}
                      className={`flex items-start justify-between gap-3 rounded-md border p-3 shadow-sm ${
                        index === 0
                          ? "border-primary/30 bg-primary/10"
                          : "border-border bg-surface"
                      }`}>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text truncate">
                            {chat.title ||
                              t("settings:manageCharacters.conversations.untitled", {
                                defaultValue: "Untitled"
                              })}
                          </span>
                          {index === 0 && (
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              {t("settings:manageCharacters.conversations.mostRecent", {
                                defaultValue: "Most recent"
                              })}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-text-subtle">
                          {formatUpdatedLabel(chat.updated_at || chat.created_at)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-text-subtle">
                          <span className="inline-flex items-center rounded-full bg-surface2 px-2 py-0.5 lowercase text-text-muted">
                            {(chat.state as string) || "in-progress"}
                          </span>
                          {chat.topic_label && (
                            <span
                              className="truncate max-w-[14rem]"
                              title={String(chat.topic_label)}
                            >
                              {String(chat.topic_label)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Tooltip
                        title={t("settings:manageCharacters.conversations.resumeTooltip", {
                          defaultValue: "Load chat history and continue this conversation"
                        })}>
                        <Button
                          type="primary"
                          size="small"
                          loading={resumingChatId === chat.id}
                          onClick={async () => {
                          if (!conversationCharacter) return
                          setResumingChatId(chat.id)
                          try {
                            await tldwClient.initialize()

                            const assistantName =
                              conversationCharacter.name ||
                              conversationCharacter.title ||
                              conversationCharacter.slug ||
                              t("common:assistant", {
                                defaultValue: "Assistant"
                              })

                            const messages = await tldwClient.listChatMessages(
                              chat.id,
                              { include_deleted: "false" } as any
                            )
                            const history = messages.map((m) => ({
                              role: m.role,
                              content: m.content
                            }))
                            const mappedMessages = messages.map((m) => {
                              const createdAt = Date.parse(m.created_at)
                              return {
                                createdAt: Number.isNaN(createdAt)
                                  ? undefined
                                  : createdAt,
                                isBot: m.role === "assistant",
                                role: normalizeChatRole(m.role),
                                name:
                                  m.role === "assistant"
                                    ? assistantName
                                    : m.role === "system"
                                      ? "System"
                                      : "You",
                                message: m.content,
                                sources: [],
                                images: [],
                                serverMessageId: m.id,
                                serverMessageVersion: m.version
                              }
                            })

                            const id = characterIdentifier(conversationCharacter)
                            setSelectedCharacter({
                              id,
                              name:
                                conversationCharacter.name ||
                                conversationCharacter.title ||
                                conversationCharacter.slug,
                              system_prompt:
                                conversationCharacter.system_prompt ||
                                conversationCharacter.systemPrompt ||
                                conversationCharacter.instructions ||
                                "",
                              greeting:
                                conversationCharacter.greeting ||
                                conversationCharacter.first_message ||
                                conversationCharacter.greet ||
                                "",
                              avatar_url:
                                conversationCharacter.avatar_url ||
                                validateAndCreateImageDataUrl(
                                  conversationCharacter.image_base64
                                ) ||
                                ""
                            })

                            setHistoryId(null)
                            setServerChatId(chat.id)
                            setServerChatState(
                              (chat as any)?.state ??
                                (chat as any)?.conversation_state ??
                                "in-progress"
                            )
                            setServerChatTopic(
                              (chat as any)?.topic_label ?? null
                            )
                            setServerChatClusterId(
                              (chat as any)?.cluster_id ?? null
                            )
                            setServerChatSource(
                              (chat as any)?.source ?? null
                            )
                            setServerChatExternalRef(
                              (chat as any)?.external_ref ?? null
                            )
                            setHistory(history)
                            setMessages(mappedMessages)
                            updatePageTitle(chat.title)
                            setConversationsOpen(false)
                            setConversationCharacter(null)
                            navigate("/")
                            setTimeout(() => {
                              focusComposer()
                            }, 0)
                          } catch (e) {
                            setChatsError(
                              t("settings:manageCharacters.conversations.error", {
                                defaultValue:
                                  "Unable to load conversations for this character."
                              })
                            )
                          } finally {
                            setResumingChatId(null)
                          }
                        }}>
                          {t("settings:manageCharacters.conversations.resume", {
                            defaultValue: "Continue chat"
                          })}
                        </Button>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      <Modal
        title={t("settings:manageCharacters.modal.addTitle", {
          defaultValue: "New character"
        })}
        open={open}
        onCancel={() => {
          if (createFormDirty) {
            Modal.confirm({
              title: t("settings:manageCharacters.modal.unsavedTitle", {
                defaultValue: "Discard changes?"
              }),
              content: t("settings:manageCharacters.modal.unsavedContent", {
                defaultValue: "You have unsaved changes. Are you sure you want to close?"
              }),
              okText: t("common:discard", { defaultValue: "Discard" }),
              cancelText: t("common:cancel", { defaultValue: "Cancel" }),
              onOk: () => {
                setOpen(false)
                createForm.resetFields()
                setCreateFormDirty(false)
                setShowCreateAdvanced(false)
                setTimeout(() => {
                  newButtonRef.current?.focus()
                }, 0)
              }
            })
          } else {
            setOpen(false)
            createForm.resetFields()
            setShowCreateAdvanced(false)
            setTimeout(() => {
              newButtonRef.current?.focus()
            }, 0)
          }
        }}
        footer={null}>
        <p className="text-sm text-text-muted mb-4">
          {t("settings:manageCharacters.modal.description", {
            defaultValue: "Define a reusable character you can chat with in the sidebar."
          })}
        </p>
        <Form
          layout="vertical"
          form={createForm}
          className="space-y-3"
          onValuesChange={() => setCreateFormDirty(true)}
          onFinish={(v) => {
            createCharacter(v)
            setCreateFormDirty(false)
            setShowCreateAdvanced(false)
          }}>
          <Form.Item
            name="name"
            label={
              <span>
                {t("settings:manageCharacters.form.name.label", {
                  defaultValue: "Name"
                })}
                <span className="text-danger ml-0.5">*</span>
              </span>
            }
            rules={[
              {
                required: true,
                message: t(
                  "settings:manageCharacters.form.name.required",
                  { defaultValue: "Please enter a name" }
                )
              }
            ]}>
            <Input
              ref={createNameRef}
              placeholder={t(
                "settings:manageCharacters.form.name.placeholder",
                { defaultValue: "e.g. Writing coach" }
              )}
            />
          </Form.Item>
          <Form.Item
            name="description"
            label={t("settings:manageCharacters.form.description.label", {
              defaultValue: "Description"
            })}>
            <Input
              placeholder={t(
                "settings:manageCharacters.form.description.placeholder",
                { defaultValue: "Short description" }
              )}
            />
          </Form.Item>
          <Form.Item
            name="avatar"
            label={t("settings:manageCharacters.avatar.label", {
              defaultValue: "Avatar (optional)"
            })}>
            <AvatarField />
          </Form.Item>
          <Form.Item
            name="tags"
            label={t("settings:manageCharacters.tags.label", {
              defaultValue: "Tags"
            })}
            help={t("settings:manageCharacters.tags.help", {
              defaultValue:
                "Use tags to group characters by use case (e.g., 'writing', 'teaching')."
            })}>
            <Select
              mode="tags"
              allowClear
              placeholder={t(
                "settings:manageCharacters.tags.placeholder",
                {
                  defaultValue: "Add tags"
                }
              )}
              options={allTags.map((tag) => ({ label: tag, value: tag }))}
            />
          </Form.Item>
          <Form.Item
            name="greeting"
            label={t("settings:manageCharacters.form.greeting.label", {
              defaultValue: "Greeting message (optional)"
            })}
            help={t("settings:manageCharacters.form.greeting.help", {
              defaultValue:
                "Optional first message the character will send when you start a chat."
            })}>
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 6 }}
              placeholder={t(
                "settings:manageCharacters.form.greeting.placeholder",
                {
                  defaultValue:
                    "Hi there! I'm your writing coach. Paste your draft and I'll help you tighten it up."
                }
              )}
              showCount
              maxLength={1000}
            />
          </Form.Item>
          <Form.Item
            name="system_prompt"
            label={
              <span>
                {t(
                  "settings:manageCharacters.form.systemPrompt.label",
                  { defaultValue: "Behavior / instructions" }
                )}
                <span className="text-danger ml-0.5" aria-hidden="true">*</span>
                <span className="sr-only"> ({t("common:required", { defaultValue: "required" })})</span>
              </span>
            }
            help={t(
              "settings:manageCharacters.form.systemPrompt.help",
              {
                defaultValue:
                  "Describe how this character should respond, including role, tone, and constraints. (max 2000 characters)"
              }
            )}
            rules={[
              {
                required: true,
                message: t(
                  "settings:manageCharacters.form.systemPrompt.required",
                  {
                    defaultValue:
                      "Please add instructions for how the character should respond."
                  }
                )
              },
              {
                min: 10,
                message: t(
                  "settings:manageCharacters.form.systemPrompt.min",
                  {
                    defaultValue:
                      "Add a short description so the character knows how to respond."
                  }
                )
              },
              {
                max: 2000,
                message: t(
                  "settings:manageCharacters.form.systemPrompt.max",
                  {
                    defaultValue:
                      "System prompt must be 2000 characters or less."
                  }
                )
              }
            ]}>
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 8 }}
              showCount
              maxLength={2000}
              placeholder={t(
                "settings:manageCharacters.form.systemPrompt.placeholder",
                {
                  defaultValue:
                    "E.g., You are a patient math teacher who explains concepts step by step and checks understanding with short examples."
                }
              )}
            />
          </Form.Item>
          <button
            type="button"
            className="mb-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => setShowCreateAdvanced((v) => !v)}>
            {showCreateAdvanced
              ? t("settings:manageCharacters.advanced.hide", {
                  defaultValue: "Hide advanced fields"
                })
              : t("settings:manageCharacters.advanced.show", {
                  defaultValue: "Show advanced fields"
                })}
          </button>
          {showCreateAdvanced && (
            <div className="space-y-3 rounded-md border border-dashed border-border p-3">
              <Form.Item
                name="personality"
                label={t("settings:manageCharacters.form.personality.label", {
                  defaultValue: "Personality"
                })}>
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
              </Form.Item>
              <Form.Item
                name="scenario"
                label={t("settings:manageCharacters.form.scenario.label", {
                  defaultValue: "Scenario"
                })}>
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
              </Form.Item>
              <Form.Item
                name="post_history_instructions"
                label={t("settings:manageCharacters.form.postHistory.label", {
                  defaultValue: "Post-history instructions"
                })}>
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
              </Form.Item>
              <Form.Item
                name="message_example"
                label={t(
                  "settings:manageCharacters.form.messageExample.label",
                  {
                    defaultValue: "Message example"
                  }
                )}>
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
              </Form.Item>
              <Form.Item
                name="creator_notes"
                label={t(
                  "settings:manageCharacters.form.creatorNotes.label",
                  {
                    defaultValue: "Creator notes"
                  }
                )}>
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
              </Form.Item>
              <Form.Item
                name="alternate_greetings"
                label={t(
                  "settings:manageCharacters.form.alternateGreetings.label",
                  {
                    defaultValue: "Alternate greetings"
                  }
                )}
                help={t(
                  "settings:manageCharacters.form.alternateGreetings.help",
                  {
                    defaultValue:
                      "Optional alternate greetings to rotate between when starting chats."
                  }
                )}>
                <Select
                  mode="tags"
                  allowClear
                  placeholder={t(
                    "settings:manageCharacters.form.alternateGreetings.placeholder",
                    {
                      defaultValue: "Add alternate greetings"
                    }
                  )}
                />
              </Form.Item>
              <Form.Item
                name="creator"
                label={t("settings:manageCharacters.form.creator.label", {
                  defaultValue: "Creator"
                })}>
                <Input />
              </Form.Item>
              <Form.Item
                name="character_version"
                label={t(
                  "settings:manageCharacters.form.characterVersion.label",
                  {
                    defaultValue: "Character version"
                  }
                )}
                help={t(
                  "settings:manageCharacters.form.characterVersion.help",
                  {
                    defaultValue: "Free text, e.g. \"1.0\" or \"2024-01\""
                  }
                )}>
                <Input />
              </Form.Item>
              <Form.Item
                name="extensions"
                label={t("settings:manageCharacters.form.extensions.label", {
                  defaultValue: "Extensions (JSON)"
                })}
                help={t(
                  "settings:manageCharacters.form.extensions.help",
                  {
                    defaultValue:
                      "Optional JSON object with additional metadata; invalid JSON will be sent as raw text."
                  }
                )}>
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} />
              </Form.Item>
            </div>
          )}

          {/* Preview toggle */}
          <button
            type="button"
            className="mt-4 mb-2 flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text"
            onClick={() => setShowCreatePreview((v) => !v)}>
            {showCreatePreview ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {showCreatePreview
              ? t("settings:manageCharacters.preview.hide", {
                  defaultValue: "Hide preview"
                })
              : t("settings:manageCharacters.preview.show", {
                  defaultValue: "Show preview"
                })}
          </button>

          {/* Character Preview */}
          {showCreatePreview && (
            <Form.Item noStyle shouldUpdate>
              {() => {
                const avatar = createForm.getFieldValue("avatar")
                const avatarValues = avatar ? extractAvatarValues(avatar) : {}
                return (
                  <CharacterPreview
                    name={createForm.getFieldValue("name")}
                    description={createForm.getFieldValue("description")}
                    avatar_url={avatarValues.avatar_url}
                    image_base64={avatarValues.image_base64}
                    system_prompt={createForm.getFieldValue("system_prompt")}
                    greeting={createForm.getFieldValue("greeting")}
                    tags={createForm.getFieldValue("tags")}
                  />
                )
              }}
            </Form.Item>
          )}

          <Button
            type="primary"
            htmlType="submit"
            loading={creating}
            className="mt-4">
            {creating
              ? t("settings:manageCharacters.form.btnSave.saving", {
                  defaultValue: "Creating character..."
                })
              : t("settings:manageCharacters.form.btnSave.save", {
                  defaultValue: "Create character"
                })}
          </Button>
        </Form>
      </Modal>

      <Modal
        title={t("settings:manageCharacters.modal.editTitle", {
          defaultValue: "Edit character"
        })}
        open={openEdit}
        onCancel={() => {
          if (editFormDirty) {
            Modal.confirm({
              title: t("settings:manageCharacters.modal.unsavedTitle", {
                defaultValue: "Discard changes?"
              }),
              content: t("settings:manageCharacters.modal.unsavedContent", {
                defaultValue: "You have unsaved changes. Are you sure you want to close?"
              }),
              okText: t("common:discard", { defaultValue: "Discard" }),
              cancelText: t("common:cancel", { defaultValue: "Cancel" }),
              onOk: () => {
                setOpenEdit(false)
                editForm.resetFields()
                setEditId(null)
                setEditVersion(null)
                setEditFormDirty(false)
                setTimeout(() => {
                  lastEditTriggerRef.current?.focus()
                }, 0)
              }
            })
          } else {
            setOpenEdit(false)
            editForm.resetFields()
            setEditId(null)
            setEditVersion(null)
            setTimeout(() => {
              lastEditTriggerRef.current?.focus()
            }, 0)
          }
        }}
        footer={null}>
        <p className="text-sm text-text-muted mb-4">
          {t("settings:manageCharacters.modal.editDescription", {
            defaultValue: "Update the character's name, behavior, and other settings."
          })}
        </p>
        <Form
          layout="vertical"
          form={editForm}
          className="space-y-3"
          onValuesChange={() => setEditFormDirty(true)}
          onFinish={(v) => {
            updateCharacter(v)
            setEditFormDirty(false)
          }}>
          <Form.Item
            name="name"
            label={
              <span>
                {t("settings:manageCharacters.form.name.label", {
                  defaultValue: "Name"
                })}
                <span className="text-danger ml-0.5">*</span>
              </span>
            }
            rules={[
              {
                required: true,
                message: t(
                  "settings:manageCharacters.form.name.required",
                  { defaultValue: "Please enter a name" }
                )
              }
            ]}>
            <Input
              ref={editNameRef}
              placeholder={t(
                "settings:manageCharacters.form.name.placeholder",
                { defaultValue: "e.g. Writing coach" }
              )}
            />
          </Form.Item>
          <Form.Item
            name="description"
            label={t("settings:manageCharacters.form.description.label", {
              defaultValue: "Description"
            })}>
            <Input
              placeholder={t(
                "settings:manageCharacters.form.description.placeholder",
                { defaultValue: "Short description" }
              )}
            />
          </Form.Item>
          <Form.Item
            name="avatar"
            label={t("settings:manageCharacters.avatar.label", {
              defaultValue: "Avatar (optional)"
            })}>
            <AvatarField />
          </Form.Item>
          <Form.Item
            name="tags"
            label={t("settings:manageCharacters.tags.label", {
              defaultValue: "Tags"
            })}
            help={t("settings:manageCharacters.tags.help", {
              defaultValue:
                "Use tags to group characters by use case (e.g., 'writing', 'teaching')."
            })}>
            <Select
              mode="tags"
              allowClear
              placeholder={t(
                "settings:manageCharacters.tags.placeholder",
                {
                  defaultValue: "Add tags"
                }
              )}
              options={allTags.map((tag) => ({ label: tag, value: tag }))}
            />
          </Form.Item>
          <Form.Item
            name="greeting"
            label={t("settings:manageCharacters.form.greeting.label", {
              defaultValue: "Greeting message (optional)"
            })}
            help={t("settings:manageCharacters.form.greeting.help", {
              defaultValue:
                "Optional first message the character will send when you start a chat."
            })}>
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 6 }}
              placeholder={t(
                "settings:manageCharacters.form.greeting.placeholder",
                {
                  defaultValue:
                    "Hi there! I'm your writing coach. Paste your draft and I'll help you tighten it up."
                }
              )}
              showCount
              maxLength={1000}
            />
          </Form.Item>
          <Form.Item
            name="system_prompt"
            label={
              <span>
                {t(
                  "settings:manageCharacters.form.systemPrompt.label",
                  { defaultValue: "Behavior / instructions" }
                )}
                <span className="text-danger ml-0.5" aria-hidden="true">*</span>
                <span className="sr-only"> ({t("common:required", { defaultValue: "required" })})</span>
              </span>
            }
            help={t(
              "settings:manageCharacters.form.systemPrompt.help",
              {
                defaultValue:
                  "Describe how this character should respond, including role, tone, and constraints. (max 2000 characters)"
              }
            )}
            rules={[
              {
                required: true,
                message: t(
                  "settings:manageCharacters.form.systemPrompt.required",
                  {
                    defaultValue:
                      "Please add instructions for how the character should respond."
                  }
                )
              },
              {
                min: 10,
                message: t(
                  "settings:manageCharacters.form.systemPrompt.min",
                  {
                    defaultValue:
                      "Add a short description so the character knows how to respond."
                  }
                )
              },
              {
                max: 2000,
                message: t(
                  "settings:manageCharacters.form.systemPrompt.max",
                  {
                    defaultValue:
                      "System prompt must be 2000 characters or less."
                  }
                )
              }
            ]}>
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 8 }}
              showCount
              maxLength={2000}
              placeholder={t(
                "settings:manageCharacters.form.systemPrompt.placeholder",
                {
                  defaultValue:
                    "E.g., You are a patient math teacher who explains concepts step by step and checks understanding with short examples."
                }
              )}
            />
          </Form.Item>
          <button
            type="button"
            className="mb-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => setShowEditAdvanced((v) => !v)}>
            {showEditAdvanced
              ? t("settings:manageCharacters.advanced.hide", {
                  defaultValue: "Hide advanced fields"
                })
              : t("settings:manageCharacters.advanced.show", {
                  defaultValue: "Show advanced fields"
                })}
          </button>
          {showEditAdvanced && (
            <div className="space-y-3 rounded-md border border-dashed border-border p-3">
              <Form.Item
                name="personality"
                label={t("settings:manageCharacters.form.personality.label", {
                  defaultValue: "Personality"
                })}>
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
              </Form.Item>
              <Form.Item
                name="scenario"
                label={t("settings:manageCharacters.form.scenario.label", {
                  defaultValue: "Scenario"
                })}>
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
              </Form.Item>
              <Form.Item
                name="post_history_instructions"
                label={t(
                  "settings:manageCharacters.form.postHistory.label",
                  {
                    defaultValue: "Post-history instructions"
                  }
                )}>
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
              </Form.Item>
              <Form.Item
                name="message_example"
                label={t(
                  "settings:manageCharacters.form.messageExample.label",
                  {
                    defaultValue: "Message example"
                  }
                )}>
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
              </Form.Item>
              <Form.Item
                name="creator_notes"
                label={t(
                  "settings:manageCharacters.form.creatorNotes.label",
                  {
                    defaultValue: "Creator notes"
                  }
                )}>
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
              </Form.Item>
              <Form.Item
                name="alternate_greetings"
                label={t(
                  "settings:manageCharacters.form.alternateGreetings.label",
                  {
                    defaultValue: "Alternate greetings"
                  }
                )}
                help={t(
                  "settings:manageCharacters.form.alternateGreetings.help",
                  {
                    defaultValue:
                      "Optional alternate greetings to rotate between when starting chats."
                  }
                )}>
                <Select
                  mode="tags"
                  allowClear
                  placeholder={t(
                    "settings:manageCharacters.form.alternateGreetings.placeholder",
                    {
                      defaultValue: "Add alternate greetings"
                    }
                  )}
                />
              </Form.Item>
              <Form.Item
                name="creator"
                label={t("settings:manageCharacters.form.creator.label", {
                  defaultValue: "Creator"
                })}>
                <Input />
              </Form.Item>
              <Form.Item
                name="character_version"
                label={t(
                  "settings:manageCharacters.form.characterVersion.label",
                  {
                    defaultValue: "Character version"
                  }
                )}
                help={t(
                  "settings:manageCharacters.form.characterVersion.help",
                  {
                    defaultValue: "Free text, e.g. \"1.0\" or \"2024-01\""
                  }
                )}>
                <Input />
              </Form.Item>
              <Form.Item
                name="extensions"
                label={t("settings:manageCharacters.form.extensions.label", {
                  defaultValue: "Extensions (JSON)"
                })}
                help={t(
                  "settings:manageCharacters.form.extensions.help",
                  {
                    defaultValue:
                      "Optional JSON object with additional metadata; invalid JSON will be sent as raw text."
                  }
                )}>
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} />
              </Form.Item>
            </div>
          )}

          {/* Preview toggle */}
          <button
            type="button"
            className="mt-4 mb-2 flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text"
            onClick={() => setShowEditPreview((v) => !v)}>
            {showEditPreview ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {showEditPreview
              ? t("settings:manageCharacters.preview.hide", {
                  defaultValue: "Hide preview"
                })
              : t("settings:manageCharacters.preview.show", {
                  defaultValue: "Show preview"
                })}
          </button>

          {/* Character Preview */}
          {showEditPreview && (
            <Form.Item noStyle shouldUpdate>
              {() => {
                const avatar = editForm.getFieldValue("avatar")
                const avatarValues = avatar ? extractAvatarValues(avatar) : {}
                return (
                  <CharacterPreview
                    name={editForm.getFieldValue("name")}
                    description={editForm.getFieldValue("description")}
                    avatar_url={avatarValues.avatar_url}
                    image_base64={avatarValues.image_base64}
                    system_prompt={editForm.getFieldValue("system_prompt")}
                    greeting={editForm.getFieldValue("greeting")}
                    tags={editForm.getFieldValue("tags")}
                  />
                )
              }}
            </Form.Item>
          )}

          <Button
            type="primary"
            htmlType="submit"
            loading={updating}
            className="w-full">
            {updating
              ? t("settings:manageCharacters.form.btnEdit.saving", {
                  defaultValue: "Saving changes..."
                })
              : t("settings:manageCharacters.form.btnEdit.save", {
                  defaultValue: "Save changes"
                })}
          </Button>
        </Form>
      </Modal>
    </div>
  )
}

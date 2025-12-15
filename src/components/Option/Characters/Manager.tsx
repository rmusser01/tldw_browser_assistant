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
  Checkbox,
  Upload,
  message
} from "antd"
import type { InputRef } from "antd"
import React from "react"
import { tldwClient, type ServerChatSummary } from "@/services/tldw/TldwApiClient"
import { History, Pen, Trash2, UserCircle2, MessageCircle, ImageIcon, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useConfirmDanger } from "@/components/Common/confirm-danger"
import { useNavigate } from "react-router-dom"
import { useStorage } from "@plasmohq/storage/hook"
import FeatureEmptyState from "@/components/Common/FeatureEmptyState"
import { useAntdNotification } from "@/hooks/useAntdNotification"
import { focusComposer } from "@/hooks/useComposerFocus"
import { useStoreMessageOption } from "@/store/option"
import { updatePageTitle } from "@/utils/update-page-title"

const MAX_NAME_LENGTH = 75
const MAX_DESCRIPTION_LENGTH = 65
const MAX_TAG_LENGTH = 20
const MAX_TAGS_DISPLAYED = 6
const BASE64_IMAGE_PATTERN =
  /^(?:[A-Za-z0-9+/_-]{4})*(?:[A-Za-z0-9+/_-]{2}==|[A-Za-z0-9+/_-]{3}=)?$/
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif"])

const truncateText = (value?: string, max?: number) => {
  if (!value) return ""
  if (!max || value.length <= max) return value
  return `${value.slice(0, max)}...`
}

const detectImageMime = (bytes: Uint8Array): string | null => {
  const isPng =
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  if (isPng) return "image/png"

  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  if (isJpeg) return "image/jpeg"

  const isGif =
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x39 || bytes[4] === 0x37) &&
    bytes[5] === 0x61
  if (isGif) return "image/gif"

  return null
}

const decodeBase64Header = (value: string): Uint8Array | null => {
  if (typeof atob !== "function") return null

  try {
    const decoded = atob(value.slice(0, Math.min(value.length, 128)))
    const headerBytes = new Uint8Array(Math.min(decoded.length, 32))
    for (let i = 0; i < headerBytes.length; i += 1) {
      headerBytes[i] = decoded.charCodeAt(i)
    }
    return headerBytes
  } catch {
    return null
  }
}

/**
 * Lightweight client-side guard: only allows rendering known raster formats.
 * Server-side validation should enforce allowable avatar uploads.
 */
const validateAndCreateImageDataUrl = (value: unknown): string => {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase().startsWith("data:")) return ""
  if (!BASE64_IMAGE_PATTERN.test(trimmed)) return ""

  const headerBytes = decodeBase64Header(trimmed)
  if (!headerBytes) return ""

  const mime = detectImageMime(headerBytes)
  if (!mime || !ALLOWED_IMAGE_MIME_TYPES.has(mime)) return ""

  return `data:${mime};base64,${trimmed}`
}

/**
 * ImageUploadField - Form field component for uploading character avatar images
 * Converts uploaded images to base64 and validates format (PNG/JPEG/GIF only)
 */
interface ImageUploadFieldProps {
  value?: string  // raw base64 string (without data: prefix)
  onChange?: (value: string | undefined) => void
}

const ImageUploadField = ({ value, onChange }: ImageUploadFieldProps) => {
  const { t } = useTranslation(["settings", "common"])
  const [loading, setLoading] = React.useState(false)

  // Convert raw base64 to data URL for preview
  const previewUrl = React.useMemo(() => {
    if (!value) return null
    return validateAndCreateImageDataUrl(value)
  }, [value])

  const handleUpload = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      message.error(t("settings:manageCharacters.form.image.selectImageError", "Please select an image file"))
      return false
    }

    setLoading(true)
    try {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        if (result) {
          // Remove the data:image/...;base64, prefix
          const base64Match = result.match(/^data:image\/[^;]+;base64,(.+)$/)
          if (base64Match) {
            const rawBase64 = base64Match[1]
            // Validate the image format using existing utility
            const headerBytes = decodeBase64Header(rawBase64)
            if (headerBytes) {
              const mime = detectImageMime(headerBytes)
              if (mime && ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
                onChange?.(rawBase64)
              } else {
                message.error(t("settings:manageCharacters.form.image.formatError", "Only PNG, JPEG, and GIF images are supported"))
              }
            } else {
              message.error(t("settings:manageCharacters.form.image.invalidError", "Invalid image file"))
            }
          } else {
            message.error(t("settings:manageCharacters.form.image.processError", "Failed to process image"))
          }
        }
        setLoading(false)
      }
      reader.onerror = () => {
        message.error(t("settings:manageCharacters.form.image.readError", "Failed to read image file"))
        setLoading(false)
      }
      reader.readAsDataURL(file)
    } catch {
      message.error(t("settings:manageCharacters.form.image.processError", "Failed to process image"))
      setLoading(false)
    }
    return false // Prevent default upload behavior
  }

  const handleClear = () => {
    onChange?.(undefined)
  }

  const uploadLabel = t("settings:manageCharacters.form.image.uploadBtn", "Upload Image")
  const clearLabel = t("settings:manageCharacters.form.image.clearBtn", "Clear")
  const formatHint = t("settings:manageCharacters.form.image.formatHint", "PNG, JPEG, or GIF")

  return (
    <div className="flex items-start gap-3">
      {/* Preview */}
      <div className="flex-shrink-0 relative">
        {loading ? (
          <div className="w-16 h-16 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
            <span className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full" />
          </div>
        ) : previewUrl ? (
          <img
            src={previewUrl}
            alt={t("settings:manageCharacters.form.image.previewAlt", "Avatar preview")}
            className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
            <ImageIcon className="w-6 h-6 text-gray-400" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Upload
            accept="image/png,image/jpeg,image/gif"
            showUploadList={false}
            beforeUpload={handleUpload}
            disabled={loading}
          >
            <Button
              size="small"
              icon={<ImageIcon className="w-4 h-4" />}
              loading={loading}
            >
              {uploadLabel}
            </Button>
          </Upload>
          {value && (
            <Button
              size="small"
              icon={<X className="w-4 h-4" />}
              onClick={handleClear}
              danger
              aria-label={clearLabel}
            >
              {clearLabel}
            </Button>
          )}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatHint}
        </span>
      </div>
    </div>
  )
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
    extensions: values.extensions,
    image_base64: values.image_base64
  }

  // Keep compatibility with mock server / older deployments
  if (values.greeting) {
    payload.greeting = values.greeting
  }
  if (values.avatar_url) {
    payload.avatar_url = values.avatar_url
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
}

export const CharactersManager: React.FC<CharactersManagerProps> = ({
  forwardedNewButtonRef
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

  React.useEffect(() => {
    if (forwardedNewButtonRef && newButtonRef.current) {
      // Expose the "New character" button to parent workspaces that may
      // want to focus it (e.g., when coming from a persistence error).
      // The ref object itself is stable; assign its current value once.
      // eslint-disable-next-line no-param-reassign
      ;(forwardedNewButtonRef as any).current = newButtonRef.current
    }
  }, [forwardedNewButtonRef])

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
  } = useStoreMessageOption()

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
      if (!editId) return
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
      {status === "error" && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-4 dark:border-red-400/40 dark:bg-red-500/10">
          <Alert
            type="error"
            message={t("settings:manageCharacters.loadError.title", {
              defaultValue: "Couldn't load characters"
            })}
            description={
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-red-700 dark:text-red-200">
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
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-[#0f1115] dark:text-gray-200">
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
                    setDebouncedSearchTerm("")
                    setFilterTags([])
                    setMatchAllTags(false)
                    refetch()
                  }}>
                  {t("settings:manageCharacters.filter.clear", {
                    defaultValue: "Clear filters"
                  })}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                {searchTerm.trim() && (
                  <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
                    {t("settings:manageCharacters.filter.activeSearch", {
                      defaultValue: "Search: \"{{term}}\"",
                      term: searchTerm.trim()
                    })}
                  </span>
                )}
                {filterTags.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
                    {t("settings:manageCharacters.filter.activeTags", {
                      defaultValue: "Tags: {{tags}}",
                      tags: filterTags.join(", ")
                    })}
                    {matchAllTags && (
                      <span className="text-gray-400 dark:text-gray-500">
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
              render: (v: string) => (
                <span className="line-clamp-1">
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
                <span className="line-clamp-1">
                  {truncateText(v, MAX_DESCRIPTION_LENGTH)}
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
                        <span className="text-xs text-gray-500 dark:text-gray-400 cursor-help">
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
                const name = record?.name || record?.title || record?.slug || ""
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    <Tooltip
                      title={chatLabel}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-blue-600 transition hover:border-blue-100 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:text-blue-400 dark:hover:border-blue-300/40 dark:hover:bg-blue-500/10 dark:focus:ring-offset-gray-900"
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
                        className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-gray-600 transition hover:border-gray-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-[#1f1f1f] dark:focus:ring-offset-gray-900"
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
                        className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-gray-600 transition hover:border-gray-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-[#1f1f1f] dark:focus:ring-offset-gray-900"
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
                            avatar_url: record.avatar_url,
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
                            extensions: extensionsValue,
                            image_base64: record.image_base64
                          })
                          setOpenEdit(true)
                        }}>
                        <Pen className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs font-medium">
                          {editLabel}
                        </span>
                      </button>
                    </Tooltip>
                    <Tooltip
                      title={deleteLabel}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-red-600 transition hover:border-red-100 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:border-red-300/40 dark:hover:bg-red-500/10 dark:focus:ring-offset-gray-900"
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
        destroyOnClose>
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t("settings:manageCharacters.conversations.subtitle", {
              defaultValue:
                "Select a conversation to continue as this character."
            })}
          </p>
          {chatsError && (
            <Alert type="error" showIcon message={chatsError} />
          )}
          {loadingChats && <Skeleton active title paragraph={{ rows: 4 }} />}
          {!loadingChats && !chatsError && (
            <>
              {characterChats.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-[#0f1115] dark:text-gray-300">
                  {t("settings:manageCharacters.conversations.empty", {
                    defaultValue: "No conversations found for this character yet."
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {characterChats.map((chat) => (
                    <div
                      key={chat.id}
                      className="flex items-start justify-between gap-3 rounded-md border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-[#0f1115]">
                      <div className="min-w-0 space-y-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {chat.title ||
                            t("settings:manageCharacters.conversations.untitled", {
                              defaultValue: "Untitled"
                            })}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatUpdatedLabel(chat.updated_at || chat.created_at)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 lowercase text-gray-700 dark:bg-gray-800 dark:text-gray-200">
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
                            const mappedMessages = messages.map((m) => ({
                              isBot: m.role === "assistant",
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
                            }))

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
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
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
                <span className="text-red-500 ml-0.5">*</span>
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
            name="avatar_url"
            label={t("settings:manageCharacters.form.avatarUrl.label", {
              defaultValue: "Avatar URL (optional)"
            })}
            rules={[
              {
                type: "url",
                message: t("settings:manageCharacters.form.avatarUrl.invalidUrl", {
                  defaultValue: "Please enter a valid URL"
                })
              }
            ]}>
            <Input
              placeholder={t(
                "settings:manageCharacters.form.avatarUrl.placeholder",
                { defaultValue: "https://example.com/avatar.png" }
              )}
            />
          </Form.Item>
          <Form.Item
            name="tags"
            label={t("settings:manageCharacters.tags.label", {
              defaultValue: "Tags"
            })}
            help={t("settings:manageCharacters.tags.help", {
              defaultValue:
                "Use tags to group characters by use case (e.g., “writing”, “teaching”)."
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
            label={t(
              "settings:manageCharacters.form.systemPrompt.label",
              { defaultValue: "Behavior / instructions" }
            )}
            help={t(
              "settings:manageCharacters.form.systemPrompt.help",
              {
                defaultValue:
                  "Describe how this character should respond, including role, tone, and constraints. (max 2000 characters)"
              }
            )}
            rules={[
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
            className="mb-2 text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
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
            <div className="space-y-3 rounded-md border border-dashed border-gray-300 p-3 dark:border-gray-700">
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
              <Form.Item
                name="image_base64"
                label={t(
                  "settings:manageCharacters.form.imageBase64.label",
                  {
                    defaultValue: "Avatar image"
                  }
                )}>
                <ImageUploadField />
              </Form.Item>
            </div>
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
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
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
                <span className="text-red-500 ml-0.5">*</span>
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
            name="avatar_url"
            label={t("settings:manageCharacters.form.avatarUrl.label", {
              defaultValue: "Avatar URL (optional)"
            })}
            rules={[
              {
                type: "url",
                message: t("settings:manageCharacters.form.avatarUrl.invalidUrl", {
                  defaultValue: "Please enter a valid URL"
                })
              }
            ]}>
            <Input
              placeholder={t(
                "settings:manageCharacters.form.avatarUrl.placeholder",
                { defaultValue: "https://example.com/avatar.png" }
              )}
            />
          </Form.Item>
          <Form.Item
            name="tags"
            label={t("settings:manageCharacters.tags.label", {
              defaultValue: "Tags"
            })}
            help={t("settings:manageCharacters.tags.help", {
              defaultValue:
                "Use tags to group characters by use case (e.g., “writing”, “teaching”)."
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
            label={t(
              "settings:manageCharacters.form.systemPrompt.label",
              { defaultValue: "Behavior / instructions" }
            )}
            help={t(
              "settings:manageCharacters.form.systemPrompt.help",
              {
                defaultValue:
                  "Describe how this character should respond, including role, tone, and constraints. (max 2000 characters)"
              }
            )}
            rules={[
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
            className="mb-2 text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
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
            <div className="space-y-3 rounded-md border border-dashed border-gray-300 p-3 dark:border-gray-700">
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
              <Form.Item
                name="image_base64"
                label={t(
                  "settings:manageCharacters.form.imageBase64.label",
                  {
                    defaultValue: "Avatar image"
                  }
                )}>
                <ImageUploadField />
              </Form.Item>
            </div>
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

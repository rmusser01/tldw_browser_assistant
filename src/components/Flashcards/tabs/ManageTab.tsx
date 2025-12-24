import React from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Alert,
  Button,
  Checkbox,
  Dropdown,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Pagination,
  Progress,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Typography
} from "antd"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import { useTranslation } from "react-i18next"
import { useConfirmDanger } from "@/components/Common/confirm-danger"
import { useAntdMessage } from "@/hooks/useAntdMessage"
import { processInChunks } from "@/utils/chunk-processing"
import {
  useDecksQuery,
  useManageQuery,
  useReviewFlashcardMutation,
  useUpdateFlashcardMutation,
  useDeleteFlashcardMutation,
  useDebouncedFormField,
  type DueStatus
} from "../hooks"
import { MarkdownWithBoundary } from "../components"
import type { Flashcard, FlashcardUpdate } from "@/services/flashcards"

dayjs.extend(relativeTime)

const { Text } = Typography

const BULK_MUTATION_CHUNK_SIZE = 50

type FlashcardModelType = Flashcard["model_type"]

const normalizeFlashcardTemplateFields = <
  T extends {
    model_type?: FlashcardModelType | null
    reverse?: boolean | null
    is_cloze?: boolean | null
  }
>(
  values: T
): T => {
  const isCloze = values.model_type === "cloze" || values.is_cloze === true
  const isReverse =
    values.model_type === "basic_reverse" || values.reverse === true
  const model_type: FlashcardModelType = isCloze
    ? "cloze"
    : isReverse
      ? "basic_reverse"
      : "basic"

  return {
    ...values,
    model_type,
    reverse: model_type === "basic_reverse",
    is_cloze: model_type === "cloze"
  }
}

interface ManageTabProps {
  onNavigateToCreate: () => void
  onNavigateToImport: () => void
}

/**
 * Manage tab for browsing, filtering, bulk actions, and editing flashcards.
 */
export const ManageTab: React.FC<ManageTabProps> = ({
  onNavigateToCreate,
  onNavigateToImport
}) => {
  const { t } = useTranslation(["option", "common"])
  const qc = useQueryClient()
  const message = useAntdMessage()
  const confirmDanger = useConfirmDanger()

  // Shared: decks
  const decksQuery = useDecksQuery()

  // Quick review mutation
  const reviewMutation = useReviewFlashcardMutation()

  // Filter state
  const [mDeckId, setMDeckId] = React.useState<number | null | undefined>(undefined)
  const [mQuery, setMQuery] = React.useState("")
  const [mQueryInput, setMQueryInput] = React.useState("")
  const [mTag, setMTag] = React.useState<string | undefined>(undefined)
  const [mDue, setMDue] = React.useState<DueStatus>("all")
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)

  // Selection state
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [previewOpen, setPreviewOpen] = React.useState<Set<string>>(new Set())
  const [selectAllAcross, setSelectAllAcross] = React.useState<boolean>(false)
  const [deselectedIds, setDeselectedIds] = React.useState<Set<string>>(new Set())

  // Bulk operation progress state
  const [bulkProgress, setBulkProgress] = React.useState<{
    open: boolean
    current: number
    total: number
    action: string
  } | null>(null)

  // Type-to-confirm modal state for large bulk deletes
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = React.useState(false)
  const [bulkDeleteInput, setBulkDeleteInput] = React.useState("")
  const [bulkDeleteCount, setBulkDeleteCount] = React.useState(0)
  const [pendingDeleteItems, setPendingDeleteItems] = React.useState<Flashcard[]>([])

  const manageQuery = useManageQuery({
    deckId: mDeckId,
    query: mQuery,
    tag: mTag,
    dueStatus: mDue,
    page,
    pageSize
  })

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (mQueryInput === mQuery) return
      setMQuery(mQueryInput)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [mQueryInput, mQuery])

  const toggleSelect = (uuid: string, checked: boolean) => {
    if (selectAllAcross) {
      setDeselectedIds((prev) => {
        const next = new Set(prev)
        if (checked) next.delete(uuid)
        else next.add(uuid)
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (checked) next.add(uuid)
        else next.delete(uuid)
        return next
      })
    }
  }

  const selectAllOnPage = () => {
    const ids = (manageQuery.data?.items || []).map((i) => i.uuid)
    setSelectAllAcross(false)
    setSelectedIds(new Set([...(selectedIds || new Set()), ...ids]))
    setDeselectedIds(new Set())
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setSelectAllAcross(false)
    setDeselectedIds(new Set())
  }

  const selectAllAcrossResults = () => {
    setSelectAllAcross(true)
    setDeselectedIds(new Set())
    setSelectedIds(new Set())
  }

  const togglePreview = (uuid: string) => {
    setPreviewOpen((prev) => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      return next
    })
  }

  // Selection across results helpers
  const totalCount = manageQuery.data?.count || 0
  const selectedCount = selectAllAcross
    ? Math.max(0, totalCount - deselectedIds.size)
    : selectedIds.size
  const anySelection = selectedCount > 0

  const updateMutation = useUpdateFlashcardMutation()
  const deleteMutation = useDeleteFlashcardMutation()

  async function fetchAllItemsAcrossFilters(): Promise<Flashcard[]> {
    const { listFlashcards } = await import("@/services/flashcards")
    const items: Flashcard[] = []
    const maxPerPage = 1000
    const total = totalCount
    for (let offset = 0; offset < total; offset += maxPerPage) {
      const res = await listFlashcards({
        deck_id: mDeckId ?? undefined,
        q: mQuery || undefined,
        tag: mTag || undefined,
        due_status: mDue,
        limit: maxPerPage,
        offset,
        order_by: "due_at"
      })
      items.push(...(res.items || []))
      if (!res.items || res.items.length < maxPerPage) break
    }
    return items
  }

  async function getSelectedItems(): Promise<Flashcard[]> {
    if (!selectAllAcross) {
      const onPage = manageQuery.data?.items || []
      return onPage.filter((i) => selectedIds.has(i.uuid))
    }
    const all = await fetchAllItemsAcrossFilters()
    return all.filter((i) => !deselectedIds.has(i.uuid))
  }

  // Move modal state
  const [moveOpen, setMoveOpen] = React.useState(false)
  const [moveCard, setMoveCard] = React.useState<Flashcard | null>(null)
  const [moveDeckId, setMoveDeckId] = React.useState<number | null>(null)

  const openBulkMove = () => {
    if (!anySelection) return
    setMoveCard(null)
    setMoveOpen(true)
  }

  const executeBulkDelete = async (items: Flashcard[]) => {
    const { deleteFlashcard } = await import("@/services/flashcards")
    const total = items.length
    setBulkProgress({
      open: true,
      current: 0,
      total,
      action: t("option:flashcards.bulkProgressDeleting", {
        defaultValue: "Deleting cards"
      })
    })
    try {
      let processed = 0
      await processInChunks(items, BULK_MUTATION_CHUNK_SIZE, async (chunk) => {
        await Promise.all(chunk.map((c) => deleteFlashcard(c.uuid, c.version)))
        processed += chunk.length
        setBulkProgress((prev) =>
          prev ? { ...prev, current: Math.min(processed, total) } : null
        )
      })
      message.success(t("common:deleted", { defaultValue: "Deleted" }))
      clearSelection()
      await qc.invalidateQueries({ queryKey: ["flashcards:list"] })
    } catch (e: any) {
      message.error(e?.message || "Bulk delete failed")
    } finally {
      setBulkProgress(null)
    }
  }

  const handleBulkDelete = async () => {
    const toDelete = await getSelectedItems()
    if (!toDelete.length) return

    const count = toDelete.length
    const LARGE_DELETE_THRESHOLD = 100

    if (count > LARGE_DELETE_THRESHOLD) {
      setBulkDeleteCount(count)
      setPendingDeleteItems(toDelete)
      setBulkDeleteInput("")
      setBulkDeleteConfirmOpen(true)
    } else {
      const ok = await confirmDanger({
        title: t("common:confirmTitle", { defaultValue: "Please confirm" }),
        content: t("option:flashcards.bulkDeleteConfirm", {
          defaultValue: `Delete ${count} selected cards? This cannot be undone.`
        }),
        okText: t("common:delete", { defaultValue: "Delete" }),
        cancelText: t("common:cancel", { defaultValue: "Cancel" })
      })
      if (!ok) return
      await executeBulkDelete(toDelete)
    }
  }

  const confirmLargeBulkDelete = async () => {
    const items = pendingDeleteItems
    setBulkDeleteConfirmOpen(false)
    setBulkDeleteInput("")
    setPendingDeleteItems([])
    setBulkDeleteCount(0)
    if (!items.length) return
    await executeBulkDelete(items)
  }

  const handleExportSelected = async () => {
    try {
      const items = await getSelectedItems()
      if (!items.length) return
      const header = ["Deck", "Front", "Back", "Tags", "Notes"]
      const decks = decksQuery.data || []
      const nameById = new Map<number, string>()
      decks.forEach((d) => nameById.set(d.id, d.name))
      const rows = items.map((i) =>
        [
          i.deck_id != null
            ? nameById.get(i.deck_id) || `Deck ${i.deck_id}`
            : "",
          i.front || "",
          i.back || "",
          Array.isArray(i.tags) ? i.tags.join(" ") : "",
          i.notes || ""
        ].join("\t")
      )
      const text = [header.join("\t"), ...rows].join("\n")
      const blob = new Blob([text], {
        type: "text/tab-separated-values;charset=utf-8"
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "flashcards-selected.tsv"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      message.error(e?.message || "Export failed")
    }
  }

  // Edit modal
  const [editOpen, setEditOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Flashcard | null>(null)
  const [editForm] = Form.useForm<FlashcardUpdate & { tags_text?: string[] }>()
  const editFrontPreview = useDebouncedFormField(editForm, "front")
  const editBackPreview = useDebouncedFormField(editForm, "back")
  const editExtraPreview = useDebouncedFormField(editForm, "extra")
  const editNotesPreview = useDebouncedFormField(editForm, "notes")

  const syncEditTemplateFields = React.useCallback(
    (
      partial: Partial<
        Pick<FlashcardUpdate, "model_type" | "reverse" | "is_cloze">
      >
    ) => {
      const normalized = normalizeFlashcardTemplateFields(partial)
      editForm.setFieldsValue({
        model_type: normalized.model_type,
        reverse: normalized.reverse,
        is_cloze: normalized.is_cloze
      })
    },
    [editForm]
  )

  // Quick actions: review
  const [quickReviewOpen, setQuickReviewOpen] = React.useState(false)
  const [quickReviewCard, setQuickReviewCard] = React.useState<Flashcard | null>(null)

  const openQuickReview = async (card: Flashcard) => {
    try {
      setQuickReviewCard(card)
      setQuickReviewOpen(true)
    } catch (e: any) {
      message.error(e?.message || "Failed to load card")
    }
  }

  const submitQuickRating = async (rating: number) => {
    try {
      if (!quickReviewCard) return
      await reviewMutation.mutateAsync({
        cardUuid: quickReviewCard.uuid,
        rating
      })
      setQuickReviewOpen(false)
      setQuickReviewCard(null)
      message.success(t("common:success", { defaultValue: "Success" }))
    } catch (e: any) {
      message.error(e?.message || "Review failed")
    }
  }

  // Quick actions: duplicate
  const duplicateCard = async (card: Flashcard) => {
    try {
      const { createFlashcard } = await import("@/services/flashcards")
      await createFlashcard({
        deck_id: card.deck_id ?? undefined,
        front: card.front,
        back: card.back,
        notes: card.notes || undefined,
        extra: card.extra || undefined,
        is_cloze: card.is_cloze,
        tags: card.tags || undefined,
        model_type: card.model_type,
        reverse: card.reverse
      })
      await qc.invalidateQueries({ queryKey: ["flashcards:list"] })
      message.success(t("common:created", { defaultValue: "Created" }))
    } catch (e: any) {
      message.error(e?.message || "Duplicate failed")
    }
  }

  const openMove = async (card: Flashcard) => {
    try {
      setMoveCard(card)
      setMoveDeckId(card.deck_id ?? null)
      setMoveOpen(true)
    } catch (e: any) {
      message.error(e?.message || "Failed to load card")
    }
  }

  const submitMove = async () => {
    const { updateFlashcard } = await import("@/services/flashcards")
    try {
      if (moveCard) {
        await updateFlashcard(moveCard.uuid, {
          deck_id: moveDeckId ?? null,
          expected_version: moveCard.version
        })
      } else {
        if (moveDeckId == null) {
          message.error(
            t("option:flashcards.bulkMoveSelectDeck", {
              defaultValue: "Select a target deck before moving cards."
            })
          )
          return
        }
        const toMove = await getSelectedItems()
        if (toMove.length) {
          await processInChunks(
            toMove,
            BULK_MUTATION_CHUNK_SIZE,
            async (chunk) => {
              await Promise.all(
                chunk.map((c) =>
                  updateFlashcard(c.uuid, {
                    deck_id: moveDeckId,
                    expected_version: c.version
                  })
                )
              )
            }
          )
        }
        clearSelection()
      }
      setMoveOpen(false)
      setMoveCard(null)
      await qc.invalidateQueries({ queryKey: ["flashcards:list"] })
      message.success(t("common:updated", { defaultValue: "Updated" }))
    } catch (e: any) {
      message.error(e?.message || "Move failed")
    }
  }

  const openEdit = async (card: Flashcard) => {
    try {
      setEditing(card)
      editForm.setFieldsValue({
        deck_id: card.deck_id ?? undefined,
        front: card.front,
        back: card.back,
        notes: card.notes || undefined,
        extra: card.extra || undefined,
        is_cloze: card.is_cloze,
        tags: card.tags || undefined,
        model_type: card.model_type,
        reverse: card.reverse,
        expected_version: card.version
      } as any)
      setEditOpen(true)
    } catch (e: any) {
      message.error(e?.message || "Failed to load card")
    }
  }

  const doUpdate = async () => {
    const { updateFlashcard } = await import("@/services/flashcards")
    try {
      if (!editing) return
      const values = normalizeFlashcardTemplateFields(
        (await editForm.validateFields()) as FlashcardUpdate
      )
      await updateFlashcard(editing.uuid, values)
      message.success(t("common:updated", { defaultValue: "Updated" }))
      setEditOpen(false)
      setEditing(null)
      await qc.invalidateQueries({ queryKey: ["flashcards:list"] })
    } catch (e: any) {
      if (e?.errorFields) return
      message.error(e?.message || "Update failed")
    }
  }

  const doDelete = async () => {
    const { deleteFlashcard } = await import("@/services/flashcards")
    try {
      if (!editing) return
      const expected = editForm.getFieldValue("expected_version") as
        | number
        | undefined
      if (typeof expected !== "number") {
        message.error("Missing version; reload and try again")
        return
      }
      await deleteFlashcard(editing.uuid, expected)
      message.success(t("common:deleted", { defaultValue: "Deleted" }))
      setEditOpen(false)
      setEditing(null)
      await qc.invalidateQueries({ queryKey: ["flashcards:list"] })
    } catch (e: any) {
      message.error(e?.message || "Delete failed")
    }
  }

  const ratingOptions = React.useMemo(
    () => [
      {
        value: 0,
        label: t("option:flashcards.ratingAgain", { defaultValue: "Again" }),
        description: t("option:flashcards.ratingAgainHelp", {
          defaultValue: "I didn't remember this card."
        })
      },
      {
        value: 2,
        label: t("option:flashcards.ratingHard", { defaultValue: "Hard" }),
        description: t("option:flashcards.ratingHardHelp", {
          defaultValue: "I barely remembered; it felt difficult."
        })
      },
      {
        value: 3,
        label: t("option:flashcards.ratingGood", { defaultValue: "Good" }),
        description: t("option:flashcards.ratingGoodHelp", {
          defaultValue: "I remembered with a bit of effort."
        })
      },
      {
        value: 5,
        label: t("option:flashcards.ratingEasy", { defaultValue: "Easy" }),
        description: t("option:flashcards.ratingEasyHelp", {
          defaultValue: "I recalled it quickly and confidently."
        })
      }
    ],
    [t]
  )

  return (
    <>
      <div>
        <Space wrap className="mb-3">
          <Input.Search
            placeholder={t("common:search", { defaultValue: "Search" })}
            allowClear
            onSearch={() => {
              setMQuery(mQueryInput)
              setPage(1)
            }}
            value={mQueryInput}
            onChange={(e) => setMQueryInput(e.target.value)}
            className="min-w-64"
            data-testid="flashcards-manage-search"
          />
          <Select
            placeholder={t("option:flashcards.deck", { defaultValue: "Deck" })}
            allowClear
            loading={decksQuery.isLoading}
            value={mDeckId as any}
            onChange={(v) => setMDeckId(v)}
            className="min-w-56"
            data-testid="flashcards-manage-deck-select"
            options={(decksQuery.data || []).map((d) => ({
              label: d.name,
              value: d.id
            }))}
          />
          <Select
            placeholder={t("option:flashcards.dueStatus", {
              defaultValue: "Due status"
            })}
            value={mDue}
            onChange={(v: DueStatus) => setMDue(v)}
            data-testid="flashcards-manage-due-status"
            options={[
              {
                label: t("option:flashcards.dueAll", { defaultValue: "All" }),
                value: "all"
              },
              {
                label: t("option:flashcards.dueNew", { defaultValue: "New" }),
                value: "new"
              },
              {
                label: t("option:flashcards.dueLearning", {
                  defaultValue: "Learning"
                }),
                value: "learning"
              },
              {
                label: t("option:flashcards.dueDue", { defaultValue: "Due" }),
                value: "due"
              }
            ]}
          />
          <Input
            placeholder={t("option:flashcards.tag", { defaultValue: "Tag" })}
            value={mTag}
            onChange={(e) => setMTag(e.target.value || undefined)}
            className="min-w-44"
            data-testid="flashcards-manage-tag"
          />
        </Space>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Text type="secondary">
            {t("option:flashcards.selectedCount", { defaultValue: "Selected" })}
            : {selectedCount}
            {selectAllAcross ? ` / ${totalCount}` : ""}
          </Text>
          <Tooltip
            title={t("option:flashcards.selectAllOnPageTooltip", {
              defaultValue: "Select only the cards visible on this page"
            })}
          >
            <Button size="small" onClick={selectAllOnPage}>
              {t("option:flashcards.selectAllOnPage", {
                defaultValue: "Select all on page"
              })}
            </Button>
          </Tooltip>
          <Tooltip
            title={t("option:flashcards.selectAllAcrossTooltip", {
              defaultValue:
                "Select all cards matching current filters (across all pages)"
            })}
          >
            <Button size="small" onClick={selectAllAcrossResults}>
              {t("option:flashcards.selectAllAcross", {
                defaultValue: "Select all across results"
              })}
            </Button>
          </Tooltip>
          <Tooltip
            title={t("option:flashcards.clearSelectionTooltip", {
              defaultValue: "Deselect all cards"
            })}
          >
            <Button size="small" onClick={clearSelection}>
              {t("option:flashcards.clearSelection", {
                defaultValue: "Clear selection"
              })}
            </Button>
          </Tooltip>
          <Dropdown
            disabled={!anySelection}
            menu={{
              onClick: (info) => {
                if (info.key === "bulk-move") openBulkMove()
                if (info.key === "bulk-delete") handleBulkDelete()
                if (info.key === "bulk-export") handleExportSelected()
              },
              items: [
                {
                  key: "bulk-move",
                  label: t("option:flashcards.bulkMove", {
                    defaultValue: "Bulk Move"
                  })
                },
                {
                  key: "bulk-delete",
                  label: t("option:flashcards.bulkDelete", {
                    defaultValue: "Bulk Delete"
                  })
                },
                { type: "divider" },
                {
                  key: "bulk-export",
                  label: t("option:flashcards.exportSelectedCsv", {
                    defaultValue: "Export selected (CSV/TSV)"
                  })
                }
              ]
            }}
          >
            <Button size="small">
              {t("option:flashcards.bulkActions", {
                defaultValue: "Bulk actions"
              })}
            </Button>
          </Dropdown>
        </div>

        <Text type="secondary" className="mb-2 block text-xs">
          {t("option:flashcards.selectionHelp", {
            defaultValue:
              '"Select all across results" applies actions to every card that matches your filters, not just this page.'
          })}
        </Text>

        <List
          loading={manageQuery.isFetching}
          dataSource={manageQuery.data?.items || []}
          locale={{
            emptyText: (
              <Empty
                description={t("option:flashcards.noCardsTitle", {
                  defaultValue:
                    mQuery || mTag || mDeckId != null || mDue !== "all"
                      ? "No cards match your filters"
                      : "No flashcards yet"
                })}
              >
                <Space direction="vertical" align="center">
                  <Text type="secondary">
                    {t("option:flashcards.noCardsDescription", {
                      defaultValue:
                        mQuery || mTag || mDeckId != null || mDue !== "all"
                          ? "Try adjusting your search, deck, tag, or due filters."
                          : "Create cards from your notes and media, or import an existing deck."
                    })}
                  </Text>
                  <Space>
                    {mQuery || mTag || mDeckId != null || mDue !== "all" ? (
                      <Button
                        onClick={() => {
                          setMQuery("")
                          setMQueryInput("")
                          setMTag(undefined)
                          setMDeckId(undefined)
                          setMDue("all")
                        }}
                      >
                        {t("option:flashcards.clearFilters", {
                          defaultValue: "Clear filters"
                        })}
                      </Button>
                    ) : (
                      <>
                        <Button type="primary" onClick={onNavigateToCreate}>
                          {t("option:flashcards.noCardsCreateCta", {
                            defaultValue: "Create your first card"
                          })}
                        </Button>
                        <Button onClick={onNavigateToImport}>
                          {t("option:flashcards.noCardsImportCta", {
                            defaultValue: "Import flashcards"
                          })}
                        </Button>
                      </>
                    )}
                  </Space>
                </Space>
              </Empty>
            )
          }}
          renderItem={(item) => (
            <List.Item
              data-testid={`flashcard-item-${item.uuid}`}
              actions={[
                <Checkbox
                  key="sel"
                  checked={
                    selectAllAcross
                      ? !deselectedIds.has(item.uuid)
                      : selectedIds.has(item.uuid)
                  }
                  onChange={(e) => toggleSelect(item.uuid, e.target.checked)}
                  aria-label={`Select card: ${item.front.slice(0, 80)}`}
                  data-testid={`flashcard-item-${item.uuid}-select`}
                />,
                <Button
                  key="preview"
                  size="small"
                  onClick={() => togglePreview(item.uuid)}
                  data-testid={`flashcard-item-${item.uuid}-toggle-answer`}
                >
                  {previewOpen.has(item.uuid)
                    ? t("option:flashcards.hideAnswer", {
                        defaultValue: "Hide Answer"
                      })
                    : t("option:flashcards.showAnswer", {
                        defaultValue: "Show Answer"
                      })}
                </Button>,
                <Button
                  key="review"
                  size="small"
                  onClick={() => openQuickReview(item)}
                  data-testid={`flashcard-item-${item.uuid}-review`}
                >
                  {t("option:flashcards.review", { defaultValue: "Review" })}
                </Button>,
                <Button
                  key="duplicate"
                  size="small"
                  onClick={() => duplicateCard(item)}
                  data-testid={`flashcard-item-${item.uuid}-duplicate`}
                >
                  {t("option:flashcards.duplicate", {
                    defaultValue: "Duplicate"
                  })}
                </Button>,
                <Button
                  key="move"
                  size="small"
                  onClick={() => openMove(item)}
                  data-testid={`flashcard-item-${item.uuid}-move`}
                >
                  {t("option:flashcards.move", { defaultValue: "Move" })}
                </Button>,
                <Button
                  key="edit"
                  size="small"
                  onClick={() => openEdit(item)}
                  data-testid={`flashcard-item-${item.uuid}-edit`}
                >
                  {t("common:edit", { defaultValue: "Edit" })}
                </Button>
              ]}
            >
              <List.Item.Meta
                title={
                  <div className="flex items-center gap-2">
                    <Text strong>{item.front.slice(0, 80)}</Text>
                    <span className="text-gray-400">-</span>
                    <Text type="secondary">{item.back.slice(0, 80)}</Text>
                  </div>
                }
                description={
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.deck_id != null && (
                      <Tag color="blue">
                        {(decksQuery.data || []).find(
                          (d) => d.id === item.deck_id
                        )?.name || `Deck ${item.deck_id}`}
                      </Tag>
                    )}
                    <Tag>
                      {item.model_type}
                      {item.reverse ? " - reverse" : ""}
                    </Tag>
                    {(item.tags || []).map((tg) => (
                      <Tag key={tg}>{tg}</Tag>
                    ))}
                    {item.due_at && (
                      <Tag color="green">
                        {t("option:flashcards.due", { defaultValue: "Due" })}:{" "}
                        {dayjs(item.due_at).fromNow()} (
                        {dayjs(item.due_at).format("YYYY-MM-DD HH:mm")})
                      </Tag>
                    )}
                  </div>
                }
              />
              {previewOpen.has(item.uuid) && (
                <div className="mt-2">
                  <div className="border rounded p-2 bg-white dark:bg-[#111] text-xs sm:text-sm">
                    <MarkdownWithBoundary
                      content={item.back}
                      size="xs"
                      className="sm:prose-sm"
                    />
                  </div>
                  {item.extra && (
                    <div className="opacity-80 text-xs mt-1">
                      <MarkdownWithBoundary content={item.extra} size="xs" />
                    </div>
                  )}
                </div>
              )}
            </List.Item>
          )}
        />

        <div className="mt-3 flex justify-end">
          <Pagination
            current={page}
            pageSize={pageSize}
            onChange={(p, ps) => {
              setPage(p)
              setPageSize(ps)
            }}
            total={manageQuery.data?.count || 0}
            showSizeChanger
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </div>
      </div>

      {/* Quick Review Modal */}
      <Modal
        title={t("option:flashcards.review", { defaultValue: "Review" })}
        open={quickReviewOpen}
        onCancel={() => {
          setQuickReviewOpen(false)
          setQuickReviewCard(null)
        }}
        footer={null}
      >
        {quickReviewCard && (
          <div className="flex flex-col gap-3">
            <div className="border rounded p-3 text-sm">
              <MarkdownWithBoundary content={quickReviewCard.front} size="sm" />
            </div>
            <div className="border rounded p-3 text-sm">
              <MarkdownWithBoundary content={quickReviewCard.back} size="sm" />
            </div>
            {quickReviewCard.extra && (
              <div className="opacity-80 text-sm">
                <MarkdownWithBoundary content={quickReviewCard.extra} size="xs" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {ratingOptions.map((opt) => (
                <Tooltip key={opt.value} title={opt.description}>
                  <Button
                    onClick={() => submitQuickRating(opt.value)}
                    aria-label={opt.label}
                  >
                    {opt.label}
                  </Button>
                </Tooltip>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Move Modal */}
      <Modal
        title={
          moveCard
            ? t("option:flashcards.deck", { defaultValue: "Deck" })
            : t("option:flashcards.bulkMove", { defaultValue: "Bulk Move" })
        }
        open={moveOpen}
        onCancel={() => {
          setMoveOpen(false)
          setMoveCard(null)
        }}
        onOk={submitMove}
      >
        <Select
          className="w-full"
          allowClear
          loading={decksQuery.isLoading}
          value={moveDeckId as any}
          onChange={(v) => setMoveDeckId(v)}
          options={(decksQuery.data || []).map((d) => ({
            label: d.name,
            value: d.id
          }))}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={t("option:flashcards.editCard", { defaultValue: "Edit Card" })}
        open={editOpen}
        onCancel={() => {
          setEditOpen(false)
          setEditing(null)
        }}
        onOk={doUpdate}
        okText={t("common:save", { defaultValue: "Save" })}
        okButtonProps={{ loading: false }}
        footer={(_, { OkBtn, CancelBtn }) => (
          <div className="flex w-full justify-between">
            <Button danger onClick={doDelete}>
              {t("common:delete", { defaultValue: "Delete" })}
            </Button>
            <Space>
              <CancelBtn />
              <OkBtn />
            </Space>
          </div>
        )}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="deck_id"
            label={t("option:flashcards.deck", { defaultValue: "Deck" })}
          >
            <Select
              allowClear
              loading={decksQuery.isLoading}
              options={(decksQuery.data || []).map((d) => ({
                label: d.name,
                value: d.id
              }))}
            />
          </Form.Item>
          <Form.Item
            name="model_type"
            label={t("option:flashcards.modelType", {
              defaultValue: "Card template"
            })}
          >
            <Select
              options={[
                {
                  label: t("option:flashcards.templateBasic", {
                    defaultValue: "Basic (Question - Answer)"
                  }),
                  value: "basic"
                },
                {
                  label: t("option:flashcards.templateReverse", {
                    defaultValue: "Basic + Reverse (Both directions)"
                  }),
                  value: "basic_reverse"
                },
                {
                  label: t("option:flashcards.templateCloze", {
                    defaultValue: "Cloze (Fill in the blank)"
                  }),
                  value: "cloze"
                }
              ]}
              onChange={(value: FlashcardModelType) => {
                syncEditTemplateFields({ model_type: value })
              }}
            />
          </Form.Item>
          <Form.Item
            name="reverse"
            label={t("option:flashcards.reverse", { defaultValue: "Reverse" })}
            valuePropName="checked"
          >
            <Switch
              onChange={(checked) => {
                syncEditTemplateFields({ reverse: checked })
              }}
            />
          </Form.Item>
          <Form.Item
            name="is_cloze"
            label={t("option:flashcards.isCloze", { defaultValue: "Is Cloze" })}
            valuePropName="checked"
          >
            <Switch
              onChange={(checked) => {
                syncEditTemplateFields({ is_cloze: checked })
              }}
            />
          </Form.Item>
          <Form.Item
            name="tags"
            label={t("option:flashcards.tags", { defaultValue: "Tags" })}
          >
            <Select mode="tags" open={false} allowClear />
          </Form.Item>
          <Form.Item
            name="front"
            label={t("option:flashcards.front", { defaultValue: "Front" })}
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={3} />
            <Text type="secondary" className="block text-[11px] mt-1">
              Supports Markdown and LaTeX.
            </Text>
            {editFrontPreview && (
              <div className="mt-2 border rounded p-2 text-xs bg-white dark:bg-[#111]">
                <Text type="secondary" className="block text-[11px] mb-1">
                  Preview
                </Text>
                <MarkdownWithBoundary content={editFrontPreview || ""} size="xs" />
              </div>
            )}
          </Form.Item>
          <Form.Item
            name="back"
            label={t("option:flashcards.back", { defaultValue: "Back" })}
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={6} />
            <Text type="secondary" className="block text-[11px] mt-1">
              Supports Markdown and LaTeX.
            </Text>
            {editBackPreview && (
              <div className="mt-2 border rounded p-2 text-xs bg-white dark:bg-[#111]">
                <Text type="secondary" className="block text-[11px] mb-1">
                  Preview
                </Text>
                <MarkdownWithBoundary content={editBackPreview || ""} size="xs" />
              </div>
            )}
          </Form.Item>
          <Form.Item
            name="extra"
            label={t("option:flashcards.extra", { defaultValue: "Extra" })}
          >
            <Input.TextArea rows={3} />
            <Text type="secondary" className="block text-[11px] mt-1">
              Optional hints/explanations (Markdown + LaTeX supported).
            </Text>
            {editExtraPreview && (
              <div className="mt-2 border rounded p-2 text-xs bg-white dark:bg-[#111]">
                <Text type="secondary" className="block text-[11px] mb-1">
                  Preview
                </Text>
                <MarkdownWithBoundary content={editExtraPreview || ""} size="xs" />
              </div>
            )}
          </Form.Item>
          <Form.Item
            name="notes"
            label={t("option:flashcards.notes", { defaultValue: "Notes" })}
          >
            <Input.TextArea rows={2} />
            <Text type="secondary" className="block text-[11px] mt-1">
              Internal notes (Markdown + LaTeX supported).
            </Text>
            {editNotesPreview && (
              <div className="mt-2 border rounded p-2 text-xs bg-white dark:bg-[#111]">
                <Text type="secondary" className="block text-[11px] mb-1">
                  Preview
                </Text>
                <MarkdownWithBoundary content={editNotesPreview || ""} size="xs" />
              </div>
            )}
          </Form.Item>
          <Form.Item name="expected_version" hidden>
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk operation progress modal */}
      <Modal
        open={bulkProgress?.open ?? false}
        closable={false}
        footer={null}
        centered
        title={
          bulkProgress?.action ||
          t("option:flashcards.bulkProgressTitle", { defaultValue: "Processing" })
        }
      >
        <div className="flex flex-col items-center gap-4 py-4">
          <Spin size="large" />
          <div className="text-center">
            <Text className="block text-lg">
              {bulkProgress?.current ?? 0} / {bulkProgress?.total ?? 0}
            </Text>
            <Text type="secondary" className="block mt-1">
              {t("option:flashcards.bulkProgressPleaseWait", {
                defaultValue: "Please wait..."
              })}
            </Text>
          </div>
          <Progress
            percent={Math.round(
              ((bulkProgress?.current ?? 0) / (bulkProgress?.total || 1)) * 100
            )}
            status="active"
            className="w-full max-w-xs"
          />
        </div>
      </Modal>

      {/* Type-to-confirm modal for large bulk deletes */}
      <Modal
        open={bulkDeleteConfirmOpen}
        title={t("option:flashcards.bulkDeleteLargeTitle", {
          defaultValue: "Delete {{count}} cards?",
          count: bulkDeleteCount
        })}
        onCancel={() => {
          setBulkDeleteConfirmOpen(false)
          setBulkDeleteInput("")
          setPendingDeleteItems([])
          setBulkDeleteCount(0)
        }}
        okText={t("common:delete", { defaultValue: "Delete" })}
        cancelText={t("common:cancel", { defaultValue: "Cancel" })}
        okButtonProps={{
          danger: true,
          disabled: bulkDeleteInput.toUpperCase() !== "DELETE"
        }}
        onOk={confirmLargeBulkDelete}
        centered
      >
        <div className="space-y-4">
          <Alert
            type="warning"
            showIcon
            message={t("option:flashcards.bulkDeleteLargeWarning", {
              defaultValue: "You are about to delete a large number of cards."
            })}
          />
          <p className="text-gray-700 dark:text-gray-300">
            {t("option:flashcards.bulkDeleteLargeContent", {
              defaultValue:
                "This will permanently delete {{count}} cards. This action cannot be undone.",
              count: bulkDeleteCount
            })}
          </p>
          <div className="pt-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("option:flashcards.typeDeleteToConfirm", {
                defaultValue: "Type DELETE to confirm:"
              })}
            </p>
            <Input
              value={bulkDeleteInput}
              onChange={(e) => setBulkDeleteInput(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </>
  )
}

export default ManageTab

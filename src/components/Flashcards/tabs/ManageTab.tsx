import React from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Drawer,
  Empty,
  Input,
  List,
  Modal,
  Pagination,
  Popover,
  Progress,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography
} from "antd"
import { Filter, Plus, LayoutList, List as ListIcon } from "lucide-react"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import { useTranslation } from "react-i18next"
import { useConfirmDanger } from "@/components/Common/confirm-danger"
import { useAntdMessage } from "@/hooks/useAntdMessage"
import { useUndoNotification } from "@/hooks/useUndoNotification"
import { processInChunks } from "@/utils/chunk-processing"
import {
  useDecksQuery,
  useManageQuery,
  useUpdateFlashcardMutation,
  useDeleteFlashcardMutation,
  useCardsKeyboardNav,
  type DueStatus
} from "../hooks"
import { MarkdownWithBoundary, FlashcardActionsMenu, FlashcardEditDrawer, FlashcardCreateDrawer } from "../components"
import { formatCardType } from "../utils/model-type-labels"
import type { Flashcard, FlashcardUpdate } from "@/services/flashcards"

dayjs.extend(relativeTime)

const { Text } = Typography

const BULK_MUTATION_CHUNK_SIZE = 50
const DELETE_UNDO_SECONDS = 30
const DELETE_UNDO_MS = DELETE_UNDO_SECONDS * 1000

type PendingDeletion = {
  card: Flashcard
  expiresAt: number
  batchId: string
}

interface ManageTabProps {
  onNavigateToImport: () => void
  onReviewCard: (card: Flashcard) => void
  isActive: boolean
}

/**
 * Cards tab for browsing, filtering, creating, editing, and bulk operations on flashcards.
 * Includes a FAB for quick card creation via a drawer.
 */
export const ManageTab: React.FC<ManageTabProps> = ({
  onNavigateToImport,
  onReviewCard,
  isActive
}) => {
  const { t } = useTranslation(["option", "common"])
  const qc = useQueryClient()
  const message = useAntdMessage()
  const confirmDanger = useConfirmDanger()
  const { showUndoNotification } = useUndoNotification()

  // Track pending deletions for soft-delete with undo + trash view
  const [pendingDeletions, setPendingDeletions] = React.useState<Record<string, PendingDeletion>>({})
  const pendingDeletionsRef = React.useRef<Record<string, PendingDeletion>>({})
  const pendingDeletionBatchesRef = React.useRef<Map<string, { uuids: Set<string>; timeoutId: number }>>(new Map())

  // Track focused card index for keyboard navigation
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1)
  const [viewMode, setViewMode] = React.useState<"cards" | "trash">("cards")
  const [nowMs, setNowMs] = React.useState(() => Date.now())

  // Shared: decks
  const decksQuery = useDecksQuery()

  // Filter state
  const [mDeckId, setMDeckId] = React.useState<number | null | undefined>(undefined)
  const [mQuery, setMQuery] = React.useState("")
  const [mQueryInput, setMQueryInput] = React.useState("")
  const [mTag, setMTag] = React.useState<string | undefined>(undefined)
  const [mDue, setMDue] = React.useState<DueStatus>("all")
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(20)
  const [listDensity, setListDensity] = React.useState<"compact" | "expanded">("compact")

  // Check if any filters are active
  const hasActiveFilters = !!(mQuery || mTag || mDeckId != null || mDue !== "all")

  // Clear all filters
  const clearAllFilters = () => {
    setMQuery("")
    setMQueryInput("")
    setMTag(undefined)
    setMDeckId(undefined)
    setMDue("all")
    setPage(1)
  }

  // Selection state
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [previewOpen, setPreviewOpen] = React.useState<Set<string>>(new Set())
  const [selectAllAcross, setSelectAllAcross] = React.useState<boolean>(false)

  const updatePendingDeletions = React.useCallback(
    (updater: (prev: Record<string, PendingDeletion>) => Record<string, PendingDeletion>) => {
      setPendingDeletions((prev) => {
        const next = updater(prev)
        pendingDeletionsRef.current = next
        return next
      })
    },
    []
  )

  const pendingDeletionCount = Object.keys(pendingDeletions).length

  React.useEffect(() => {
    pendingDeletionsRef.current = pendingDeletions
  }, [pendingDeletions])

  React.useEffect(() => {
    if (pendingDeletionCount === 0) return
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [pendingDeletionCount])

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

  React.useEffect(() => {
    if (!selectAllAcross) {
      setSelectedIds(new Set())
    }
  }, [page, pageSize, selectAllAcross])

  React.useEffect(() => {
    setSelectedIds(new Set())
    setSelectAllAcross(false)
  }, [mDeckId, mQuery, mTag, mDue])

  React.useEffect(() => {
    return () => {
      pendingDeletionBatchesRef.current.forEach((batch) => {
        window.clearTimeout(batch.timeoutId)
      })
      pendingDeletionBatchesRef.current.clear()
    }
  }, [])

  const toggleSelect = (uuid: string, checked: boolean) => {
    if (selectAllAcross) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(uuid)
      else next.delete(uuid)
      return next
    })
  }

  const selectAllOnPage = () => {
    const ids = (manageQuery.data?.items || []).map((i) => i.uuid)
    setSelectAllAcross(false)
    setSelectedIds(new Set([...(selectedIds || new Set()), ...ids]))
  }

  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set())
    setSelectAllAcross(false)
  }, [])

  const selectAllAcrossResults = () => {
    setSelectAllAcross(true)
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

  // Selection across results helpers - filter out pending deletions
  const pageItems = (manageQuery.data?.items || []).filter(
    (item) => !pendingDeletions[item.uuid]
  )
  const pageCount = pageItems.length
  const selectedOnPageCount = selectAllAcross
    ? pageCount
    : pageItems.filter((item) => selectedIds.has(item.uuid)).length
  const totalCount = manageQuery.data?.count || 0
  const selectedCount = selectAllAcross ? totalCount : selectedIds.size
  const anySelection = selectedCount > 0
  const allOnPageSelected = pageCount > 0 && selectedOnPageCount === pageCount
  const someOnPageSelected = selectedOnPageCount > 0 && selectedOnPageCount < pageCount

  const updateMutation = useUpdateFlashcardMutation()
  const deleteMutation = useDeleteFlashcardMutation()

  // Reset focused index when page or filters change
  React.useEffect(() => {
    setFocusedIndex(-1)
  }, [page, pageSize, mDeckId, mQuery, mTag, mDue])

  async function fetchAllItemsAcrossFilters(): Promise<Flashcard[]> {
    const { listFlashcards } = await import("@/services/flashcards")
    const items: Flashcard[] = []
    const maxPerPage = 1000
    const MAX_ITEMS_CAP = 10000
    const total = totalCount
    if (total > MAX_ITEMS_CAP) {
      message.warning(
        t("option:flashcards.bulkLimitWarning", {
          defaultValue: "Operation limited to first {{limit}} items.",
          limit: MAX_ITEMS_CAP
        })
      )
    }
    for (
      let offset = 0;
      offset < Math.min(total, MAX_ITEMS_CAP);
      offset += maxPerPage
    ) {
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
    return all
  }

  // Move modal state
  const [moveOpen, setMoveOpen] = React.useState(false)
  const [moveCard, setMoveCard] = React.useState<Flashcard | null>(null)
  const [moveDeckId, setMoveDeckId] = React.useState<number | null>(null)

  const openBulkMove = () => {
    if (!anySelection) return
    setMoveCard(null)
    setMoveDeckId(null)
    setMoveOpen(true)
  }

  const executeBulkDelete = React.useCallback(
    async (
      items: Flashcard[],
      options?: { showProgress?: boolean; showSuccessMessage?: boolean; clearSelection?: boolean }
    ) => {
      const showProgress = options?.showProgress ?? true
      const showSuccessMessage = options?.showSuccessMessage ?? true
      const shouldClearSelection = options?.clearSelection ?? true
      const { deleteFlashcard } = await import("@/services/flashcards")
      const total = items.length
      if (showProgress) {
        setBulkProgress({
          open: true,
          current: 0,
          total,
          action: t("option:flashcards.bulkProgressDeleting", {
            defaultValue: "Deleting cards"
          })
        })
      }
      try {
        let processed = 0
        const failedIds = new Set<string>()
        await processInChunks(items, BULK_MUTATION_CHUNK_SIZE, async (chunk) => {
          const results = await Promise.allSettled(
            chunk.map((c) => deleteFlashcard(c.uuid, c.version))
          )
          let chunkFailures = 0
          results.forEach((result, index) => {
            if (result.status === "rejected") {
              failedIds.add(chunk[index].uuid)
              chunkFailures += 1
            }
          })
          if (chunkFailures > 0) {
            console.warn(`${chunkFailures} deletions failed in chunk`)
          }
          processed += chunk.length
          if (showProgress) {
            setBulkProgress((prev) =>
              prev ? { ...prev, current: Math.min(processed, total) } : null
            )
          }
        })
        const failedCount = failedIds.size
        const successCount = Math.max(0, total - failedCount)
        if (failedCount > 0) {
          if (showSuccessMessage) {
            message.warning(
              t("option:flashcards.bulkDeleteResult", {
                defaultValue: "{{success}} deleted · {{failed}} failed",
                success: successCount,
                failed: failedCount
              })
            )
          }
          if (shouldClearSelection) clearSelection()
        } else {
          if (showSuccessMessage) {
            message.success(t("common:deleted", { defaultValue: "Deleted" }))
          }
          if (shouldClearSelection) clearSelection()
        }
        await qc.invalidateQueries({ queryKey: ["flashcards:list"] })
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "Bulk delete failed"
        message.error(errorMessage)
      } finally {
        if (showProgress) {
          setBulkProgress(null)
        }
      }
    },
    [clearSelection, message, qc, t]
  )

  const removePendingDeletions = React.useCallback(
    (uuids: string[]) => {
      if (!uuids.length) return
      updatePendingDeletions((prev) => {
        let changed = false
        const next = { ...prev }
        uuids.forEach((uuid) => {
          if (next[uuid]) {
            delete next[uuid]
            changed = true
          }
        })
        return changed ? next : prev
      })
    },
    [updatePendingDeletions]
  )

  const undoDeletionBatch = React.useCallback(
    (batchId: string) => {
      const batch = pendingDeletionBatchesRef.current.get(batchId)
      if (!batch) return
      window.clearTimeout(batch.timeoutId)
      pendingDeletionBatchesRef.current.delete(batchId)
      removePendingDeletions(Array.from(batch.uuids))
    },
    [removePendingDeletions]
  )

  const finalizeDeletionBatch = React.useCallback(
    async (batchId: string) => {
      const batch = pendingDeletionBatchesRef.current.get(batchId)
      if (!batch) return
      pendingDeletionBatchesRef.current.delete(batchId)

      const pending = pendingDeletionsRef.current
      const cardsToDelete = Array.from(batch.uuids)
        .map((uuid) => pending[uuid]?.card)
        .filter((card): card is Flashcard => !!card)

      try {
        if (cardsToDelete.length > 0) {
          await executeBulkDelete(cardsToDelete, {
            showProgress: false,
            showSuccessMessage: true,
            clearSelection: false
          })
        }
      } finally {
        removePendingDeletions(Array.from(batch.uuids))
      }
    },
    [executeBulkDelete, removePendingDeletions]
  )

  const queueDeletionBatch = React.useCallback(
    (cards: Flashcard[], notification: { title: string; description?: string }) => {
      if (!cards.length) return
      const batchId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const expiresAt = Date.now() + DELETE_UNDO_MS
      const uuids = new Set(cards.map((card) => card.uuid))

      updatePendingDeletions((prev) => {
        const next = { ...prev }
        cards.forEach((card) => {
          next[card.uuid] = {
            card,
            expiresAt,
            batchId
          }
        })
        return next
      })

      const timeoutId = window.setTimeout(() => {
        finalizeDeletionBatch(batchId)
      }, DELETE_UNDO_MS)
      pendingDeletionBatchesRef.current.set(batchId, { uuids, timeoutId })

      showUndoNotification({
        title: notification.title,
        description: notification.description,
        duration: DELETE_UNDO_SECONDS,
        onUndo: async () => {
          undoDeletionBatch(batchId)
        }
      })
    },
    [finalizeDeletionBatch, showUndoNotification, undoDeletionBatch, updatePendingDeletions]
  )

  const undoSinglePendingDeletion = React.useCallback(
    (uuid: string) => {
      const pending = pendingDeletionsRef.current[uuid]
      if (!pending) return
      const batch = pendingDeletionBatchesRef.current.get(pending.batchId)
      if (batch) {
        batch.uuids.delete(uuid)
        if (batch.uuids.size === 0) {
          window.clearTimeout(batch.timeoutId)
          pendingDeletionBatchesRef.current.delete(pending.batchId)
        }
      }
      removePendingDeletions([uuid])
    },
    [removePendingDeletions]
  )

  const undoAllPendingDeletions = React.useCallback(() => {
    pendingDeletionBatchesRef.current.forEach((batch) => {
      window.clearTimeout(batch.timeoutId)
    })
    pendingDeletionBatchesRef.current.clear()
    updatePendingDeletions(() => ({}))
  }, [updatePendingDeletions])

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
          defaultValue:
            "Delete {{count}} selected cards? You can undo for {{seconds}} seconds.",
          count,
          seconds: DELETE_UNDO_SECONDS
        }),
        okText: t("common:delete", { defaultValue: "Delete" }),
        cancelText: t("common:cancel", { defaultValue: "Cancel" })
      })
      if (!ok) return
      const undoHint = t("option:flashcards.deleteUndoHint", {
        defaultValue: "Undo within {{seconds}}s to cancel deletion.",
        seconds: DELETE_UNDO_SECONDS
      })
      queueDeletionBatch(toDelete, {
        title: t("option:flashcards.cardsDeleted", {
          defaultValue: "{{count}} cards deleted",
          count
        }),
        description: undoHint
      })
      clearSelection()
    }
  }

  const confirmLargeBulkDelete = async () => {
    const items = pendingDeleteItems
    setBulkDeleteConfirmOpen(false)
    setBulkDeleteInput("")
    setPendingDeleteItems([])
    setBulkDeleteCount(0)
    if (!items.length) return
    const undoHint = t("option:flashcards.deleteUndoHint", {
      defaultValue: "Undo within {{seconds}}s to cancel deletion.",
      seconds: DELETE_UNDO_SECONDS
    })
    queueDeletionBatch(items, {
      title: t("option:flashcards.cardsDeleted", {
        defaultValue: "{{count}} cards deleted",
        count: items.length
      }),
      description: undoHint
    })
    clearSelection()
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
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Export failed"
      message.error(errorMessage)
    }
  }

  // Edit drawer
  const [editOpen, setEditOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Flashcard | null>(null)

  // Create drawer
  const [createOpen, setCreateOpen] = React.useState(false)

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
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Duplicate failed"
      message.error(errorMessage)
    }
  }

  const openMove = async (card: Flashcard) => {
    try {
      setMoveCard(card)
      setMoveDeckId(card.deck_id ?? null)
      setMoveOpen(true)
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Failed to load card"
      message.error(errorMessage)
    }
  }

  const submitMove = async () => {
    const { updateFlashcard, getFlashcard } = await import("@/services/flashcards")
    try {
      if (moveCard) {
        const full = await getFlashcard(moveCard.uuid)
        await updateFlashcard(moveCard.uuid, {
          deck_id: moveDeckId ?? null,
          expected_version: full.version
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
              const results = await Promise.allSettled(
                chunk.map(async (c) => {
                  const full = await getFlashcard(c.uuid)
                  await updateFlashcard(c.uuid, {
                    deck_id: moveDeckId,
                    expected_version: full.version
                  })
                })
              )
              const failures = results.filter((r) => r.status === "rejected")
              if (failures.length > 0) {
                console.warn(`${failures.length} move updates failed in chunk`)
              }
            }
          )
        }
        clearSelection()
      }
      setMoveOpen(false)
      setMoveCard(null)
      setMoveDeckId(null)
      await qc.invalidateQueries({ queryKey: ["flashcards:list"] })
      message.success(t("common:updated", { defaultValue: "Updated" }))
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Move failed"
      message.error(errorMessage)
    }
  }

  const openEdit = (card: Flashcard) => {
    setEditing(card)
    setEditOpen(true)
  }

  // Keyboard navigation for Cards tab
  useCardsKeyboardNav({
    enabled: isActive && viewMode === "cards" && !editOpen && !createOpen && !moveOpen,
    itemCount: pageCount,
    focusedIndex,
    onFocusChange: setFocusedIndex,
    onEdit: (index) => {
      const card = pageItems[index]
      if (card) openEdit(card)
    },
    onToggleSelect: (index) => {
      const card = pageItems[index]
      if (card && !selectAllAcross) {
        toggleSelect(card.uuid, !selectedIds.has(card.uuid))
      }
    },
    onDelete: async (index) => {
      const card = pageItems[index]
      if (card) {
        // Open edit drawer and trigger delete from there for consistency
        setEditing(card)
        setEditOpen(true)
      }
    }
  })

  const doUpdate = async (values: FlashcardUpdate) => {
    const { updateFlashcard } = await import("@/services/flashcards")
    try {
      if (!editing) return
      await updateFlashcard(editing.uuid, values)
      message.success(t("common:updated", { defaultValue: "Updated" }))
      setEditOpen(false)
      setEditing(null)
      await qc.invalidateQueries({ queryKey: ["flashcards:list"] })
    } catch (e: unknown) {
      if (typeof e === "object" && e && "errorFields" in e) {
        const { errorFields } = e as { errorFields?: unknown }
        if (errorFields) return
      }
      const errorMessage = e instanceof Error ? e.message : "Update failed"
      message.error(errorMessage)
    }
  }

  const doDelete = async () => {
    try {
      if (!editing) return
      if (typeof editing.version !== "number") {
        message.error("Missing version; reload and try again")
        return
      }
      const cardToDelete = { ...editing }

      // Close drawer and mark as pending deletion (soft-delete)
      setEditOpen(false)
      setEditing(null)

      // Show undo notification with 30 second timeout
      const preview = cardToDelete.front.slice(0, 60)
      const undoHint = t("option:flashcards.deleteUndoHint", {
        defaultValue: "Undo within {{seconds}}s to cancel deletion.",
        seconds: DELETE_UNDO_SECONDS
      })
      queueDeletionBatch([cardToDelete], {
        title: t("option:flashcards.cardDeleted", { defaultValue: "Card deleted" }),
        description: preview
          ? `${preview}${cardToDelete.front.length > 60 ? "…" : ""} · ${undoHint}`
          : undoHint
      })
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Delete failed"
      message.error(errorMessage)
    }
  }

  return (
    <>
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <Segmented
            value={viewMode}
            onChange={(value) => {
              setViewMode(value as "cards" | "trash")
            }}
            options={[
              {
                label: t("option:flashcards.cards", { defaultValue: "Cards" }),
                value: "cards"
              },
              {
                label: (
                  <span className="inline-flex items-center gap-2">
                    {t("option:flashcards.trash", { defaultValue: "Trash" })}
                    {pendingDeletionCount > 0 && (
                      <Badge count={pendingDeletionCount} size="small" />
                    )}
                  </span>
                ),
                value: "trash"
              }
            ]}
          />
          {viewMode === "trash" && pendingDeletionCount > 0 && (
            <Button size="small" onClick={undoAllPendingDeletions}>
              {t("option:flashcards.trashUndoAll", { defaultValue: "Undo all" })}
            </Button>
          )}
        </div>
        {viewMode === "trash" && (
          <Text type="secondary" className="block text-xs mb-2">
            {t("option:flashcards.trashEmptyDescription", {
              defaultValue: "Deleted cards appear here for 30 seconds."
            })}
          </Text>
        )}

        {/* Simplified Filter UI */}
        {viewMode === "cards" && (
        <div className="mb-3 space-y-3">
          {/* Primary filters: Search + Deck (always visible) */}
          <div className="flex items-center gap-2 flex-wrap">
            <Input.Search
              placeholder={t("common:search", { defaultValue: "Search" })}
              allowClear
              onSearch={() => {
                setMQuery(mQueryInput)
                setPage(1)
              }}
              value={mQueryInput}
              onChange={(e) => setMQueryInput(e.target.value)}
              className="max-w-64"
              data-testid="flashcards-manage-search"
            />
            <Select<number>
              placeholder={t("option:flashcards.deck", { defaultValue: "All decks" })}
              allowClear
              loading={decksQuery.isLoading}
              value={mDeckId ?? undefined}
              onChange={(v) => {
                setMDeckId(v ?? undefined)
                setPage(1)
              }}
              className="min-w-44"
              data-testid="flashcards-manage-deck-select"
              options={(decksQuery.data || []).map((d) => ({
                label: d.name,
                value: d.id
              }))}
            />
            {/* Tag filter in popover */}
            <Popover
              trigger="click"
              placement="bottomLeft"
              content={
                <div className="w-64 space-y-2">
                  <div className="text-sm font-medium text-text-muted">
                    {t("option:flashcards.filterByTag", { defaultValue: "Filter by tag" })}
                  </div>
                  <Input
                    placeholder={t("option:flashcards.tagPlaceholder", { defaultValue: "Enter tag..." })}
                    value={mTag}
                    onChange={(e) => {
                      setMTag(e.target.value || undefined)
                      setPage(1)
                    }}
                    allowClear
                    data-testid="flashcards-manage-tag"
                  />
                </div>
              }
            >
              <Badge dot={!!mTag} offset={[-4, 4]}>
                <Button icon={<Filter className="size-4" />}>
                  {t("option:flashcards.moreFilters", { defaultValue: "More" })}
                </Button>
              </Badge>
            </Popover>
            {hasActiveFilters && (
              <Button size="small" type="link" onClick={clearAllFilters}>
                {t("option:flashcards.clearFilters", { defaultValue: "Clear all" })}
              </Button>
            )}
          </div>

          {/* Due status as segmented control + density toggle */}
          <div className="flex items-center justify-between gap-2">
            <Segmented
              value={mDue}
              onChange={(value) => {
                setMDue(value as DueStatus)
                setPage(1)
              }}
              data-testid="flashcards-manage-due-status"
              options={[
                {
                  label: t("option:flashcards.dueAll", { defaultValue: "All" }),
                  value: "all"
                },
                {
                  label: t("option:flashcards.dueDue", { defaultValue: "Due" }),
                  value: "due"
                },
                {
                  label: t("option:flashcards.dueNew", { defaultValue: "New" }),
                  value: "new"
                },
                {
                  label: t("option:flashcards.dueLearning", { defaultValue: "Learning" }),
                  value: "learning"
                }
              ]}
            />
            <Tooltip
              title={
                listDensity === "compact"
                  ? t("option:flashcards.expandedView", { defaultValue: "Expanded view" })
                  : t("option:flashcards.compactView", { defaultValue: "Compact view" })
              }
            >
              <Button
                type="text"
                icon={listDensity === "compact" ? <LayoutList className="size-4" /> : <ListIcon className="size-4" />}
                onClick={() => setListDensity((d) => (d === "compact" ? "expanded" : "compact"))}
                data-testid="flashcards-density-toggle"
              />
            </Tooltip>
          </div>
        </div>
        )}

        {/* Selection Summary Bar - simplified to two modes */}
        {viewMode === "cards" && (
        <div className="mb-2 flex items-center gap-3">
          <Checkbox
            indeterminate={someOnPageSelected}
            checked={allOnPageSelected}
            onChange={(e) => {
              if (e.target.checked) selectAllOnPage()
              else clearSelection()
            }}
          />
          <Text>
            {selectedCount === 0 ? (
              <span className="text-text-muted">
                {totalCount} {t("option:flashcards.cards", { defaultValue: "cards" })}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Badge
                  count={selectedCount}
                  showZero={false}
                  className="mr-1"
                  style={{ backgroundColor: selectAllAcross ? "#1890ff" : "#52c41a" }}
                />
                <span className="text-text-muted">
                  {selectAllAcross
                    ? t("option:flashcards.selectedAcrossAll", {
                        defaultValue: "selected across all results"
                      })
                    : t("option:flashcards.selectedOnPage", {
                        defaultValue: "selected on this page"
                      })}
                </span>
                {!selectAllAcross && selectedCount > 0 && totalCount > selectedCount && (
                  <button
                    className="text-primary hover:underline text-sm"
                    onClick={selectAllAcrossResults}
                  >
                    {t("option:flashcards.selectAllCount", {
                      defaultValue: "Select all {{count}}",
                      count: totalCount
                    })}
                  </button>
                )}
                <button
                  className="text-text-muted hover:text-text text-sm"
                  onClick={clearSelection}
                >
                  {t("option:flashcards.clear", { defaultValue: "Clear" })}
                </button>
              </span>
            )}
          </Text>
        </div>
        )}

        {viewMode === "cards" ? (
        <List
          loading={manageQuery.isFetching}
          dataSource={pageItems}
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
                        <Button type="primary" onClick={() => setCreateOpen(true)}>
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
          renderItem={(item, index) => {
            const isFocused = index === focusedIndex
            return (
            <List.Item
              data-testid={`flashcard-item-${item.uuid}`}
              className={`cursor-pointer hover:bg-surface2/50 ${isFocused ? "ring-2 ring-primary ring-inset bg-surface2/30" : ""}`}
              onClick={() => {
                setFocusedIndex(index)
                togglePreview(item.uuid)
              }}
              actions={[
                <Checkbox
                  key="sel"
                  checked={selectAllAcross ? true : selectedIds.has(item.uuid)}
                  disabled={selectAllAcross}
                  onChange={(e) => {
                    e.stopPropagation()
                    toggleSelect(item.uuid, e.target.checked)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select card: ${item.front.slice(0, 80)}`}
                  data-testid={`flashcard-item-${item.uuid}-select`}
                />,
                <FlashcardActionsMenu
                  key="actions"
                  card={item}
                  onEdit={() => openEdit(item)}
                  onReview={() => onReviewCard(item)}
                  onDuplicate={() => duplicateCard(item)}
                  onMove={() => openMove(item)}
                />
              ]}
            >
              {listDensity === "compact" ? (
                /* Compact mode: Front text + due indicator + deck name */
                <List.Item.Meta
                  title={
                    <div className="flex items-center gap-2">
                      {/* Due status indicator */}
                      {item.due_at && dayjs(item.due_at).isBefore(dayjs()) && (
                        <Tooltip title={t("option:flashcards.dueNow", { defaultValue: "Due now" })}>
                          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                        </Tooltip>
                      )}
                      <Text className="flex-1 truncate">{item.front}</Text>
                    </div>
                  }
                  description={
                    <div className="flex items-center gap-2 text-xs">
                      {item.deck_id != null && (
                        <span className="text-text-muted">
                          {(decksQuery.data || []).find((d) => d.id === item.deck_id)?.name || `Deck ${item.deck_id}`}
                        </span>
                      )}
                      {item.due_at && (
                        <span className="text-text-subtle">
                          {dayjs(item.due_at).fromNow()}
                        </span>
                      )}
                    </div>
                  }
                />
              ) : (
                /* Expanded mode: Full details with front/back preview */
                <>
                  <List.Item.Meta
                    title={
                      <div className="flex items-center gap-2">
                        <Text strong>{item.front.slice(0, 80)}</Text>
                        <span className="text-text-subtle">-</span>
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
                        <Tag>{formatCardType(item, t)}</Tag>
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
                      <div className="border rounded p-2 bg-surface text-xs sm:text-sm">
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
                </>
              )}
            </List.Item>
          )}}
        />
        ) : (
          <List
            dataSource={Object.values(pendingDeletions).sort(
              (a, b) => a.expiresAt - b.expiresAt
            )}
            locale={{
              emptyText: (
                <Empty
                  description={t("option:flashcards.trashEmptyDescription", {
                    defaultValue: "Deleted cards appear here for 30 seconds."
                  })}
                />
              )
            }}
            renderItem={(item) => {
              const remainingSeconds = Math.max(
                0,
                Math.ceil((item.expiresAt - nowMs) / 1000)
              )
              return (
                <List.Item
                  data-testid={`flashcard-trash-${item.card.uuid}`}
                  actions={[
                    <Button
                      key="undo"
                      size="small"
                      onClick={() => undoSinglePendingDeletion(item.card.uuid)}
                    >
                      {t("option:flashcards.trashUndo", { defaultValue: "Undo" })}
                    </Button>,
                    <Tag key="expires" color="volcano">
                      {t("option:flashcards.trashExpiresIn", {
                        defaultValue: "Deletes in {{seconds}}s",
                        seconds: remainingSeconds
                      })}
                    </Tag>
                  ]}
                >
                  <List.Item.Meta
                    title={<Text>{item.card.front}</Text>}
                    description={
                      item.card.back ? (
                        <Text type="secondary" className="text-xs">
                          {item.card.back.slice(0, 120)}
                          {item.card.back.length > 120 ? "…" : ""}
                        </Text>
                      ) : null
                    }
                  />
                </List.Item>
              )
            }}
          />
        )}

        {viewMode === "cards" && (
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
        )}
      </div>

      {/* Floating Action Bar - appears when items are selected */}
      {viewMode === "cards" && anySelection && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-surface border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-4">
          <Badge
            count={selectedCount}
            showZero={false}
            style={{ backgroundColor: selectAllAcross ? "#1890ff" : "#52c41a" }}
          />
          <span className="text-sm text-text-muted">
            {selectAllAcross
              ? t("option:flashcards.selectedAcrossAll", { defaultValue: "selected across all results" })
              : t("option:flashcards.selected", { defaultValue: "selected" })}
          </span>
          <div className="h-4 w-px bg-border" />
          <Space>
            <Button size="small" onClick={openBulkMove}>
              {t("option:flashcards.bulkMove", { defaultValue: "Move" })}
            </Button>
            <Button size="small" onClick={handleExportSelected}>
              {t("option:flashcards.export", { defaultValue: "Export" })}
            </Button>
            <Button size="small" danger onClick={handleBulkDelete}>
              {t("option:flashcards.bulkDelete", { defaultValue: "Delete" })}
            </Button>
          </Space>
          <div className="h-4 w-px bg-border" />
          <Button type="text" size="small" onClick={clearSelection}>
            {t("option:flashcards.clear", { defaultValue: "Clear" })}
          </Button>
        </div>
      )}

      {/* Move Drawer */}
      <Drawer
        title={
          moveCard
            ? t("option:flashcards.moveToDeck", { defaultValue: "Move to deck" })
            : t("option:flashcards.bulkMove", { defaultValue: "Bulk Move" })
        }
        placement="right"
        width={360}
        open={moveOpen}
        onClose={() => {
          setMoveOpen(false)
          setMoveCard(null)
          setMoveDeckId(null)
        }}
        footer={
          <div className="flex justify-between">
            <Button
              onClick={() => {
                setMoveOpen(false)
                setMoveCard(null)
                setMoveDeckId(null)
              }}
            >
              {t("common:cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              type="primary"
              onClick={submitMove}
              disabled={!moveCard && moveDeckId == null}
            >
              {t("option:flashcards.move", { defaultValue: "Move" })}
            </Button>
          </div>
        }
      >
        <Select<number>
          className="w-full"
          allowClear
          loading={decksQuery.isLoading}
          value={moveDeckId ?? undefined}
          onChange={(v) => setMoveDeckId(v ?? null)}
          options={(decksQuery.data || []).map((d) => ({
            label: d.name,
            value: d.id
          }))}
        />
      </Drawer>

      {/* Edit Drawer */}
      <FlashcardEditDrawer
        open={editOpen}
        onClose={() => {
          setEditOpen(false)
          setEditing(null)
        }}
        card={editing}
        onSave={doUpdate}
        onDelete={doDelete}
        isLoading={updateMutation.isPending}
        decks={decksQuery.data || []}
        decksLoading={decksQuery.isLoading}
      />

      {/* Create Drawer */}
      <FlashcardCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        decks={decksQuery.data || []}
        decksLoading={decksQuery.isLoading}
      />

      {/* Floating Action Button for creating cards */}
      {viewMode === "cards" && !anySelection && (
        <Tooltip title={t("option:flashcards.createCard", { defaultValue: "Create Flashcard" })}>
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={<Plus className="size-5" />}
            className="fixed bottom-6 right-6 z-50 shadow-lg !w-14 !h-14 flex items-center justify-center"
            onClick={() => setCreateOpen(true)}
            data-testid="flashcards-fab-create"
          />
        </Tooltip>
      )}

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
              defaultValue: "These cards will move to Trash for {{seconds}} seconds.",
              seconds: DELETE_UNDO_SECONDS
            })}
          />
          <p className="text-text-muted">
            {t("option:flashcards.bulkDeleteLargeContent", {
              defaultValue:
                "After {{seconds}} seconds, {{count}} cards will be permanently deleted.",
              count: bulkDeleteCount,
              seconds: DELETE_UNDO_SECONDS
            })}
          </p>
          <div className="pt-2">
            <p className="text-sm font-medium text-text-muted mb-2">
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

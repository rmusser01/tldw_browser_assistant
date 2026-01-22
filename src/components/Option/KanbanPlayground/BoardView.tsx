import { useState, useCallback, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button, Input, message, Popconfirm, Dropdown, Modal } from "antd"
import type { MenuProps } from "antd"
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Calendar,
  GripVertical,
  Edit2
} from "lucide-react"
import { DragDropProvider, DragOverlay, type DragDropEvents } from "@dnd-kit/react"
import { useSortable } from "@dnd-kit/react/sortable"
import { closestCorners } from "@dnd-kit/collision"
import { arrayMove } from "@dnd-kit/helpers"

import {
  createList,
  createCard,
  updateBoard,
  deleteList,
  updateCard,
  deleteCard,
  moveCard,
  reorderLists,
  reorderCards,
  generateClientId,
  isCardOverdue,
  getPriorityColor,
  formatDueDate
} from "@/services/kanban"
import type {
  BoardWithLists,
  ListWithCards,
  Card,
  CardUpdate
} from "@/types/kanban"

import { CardDetailPanel } from "./CardDetailPanel"

interface BoardViewProps {
  board: BoardWithLists
  onRefresh: () => void
  onDelete: () => void
}

type DragStartEvent = Parameters<DragDropEvents["dragstart"]>[0]
type DragEndEvent = Parameters<DragDropEvents["dragend"]>[0]

export const BoardView = ({ board, onRefresh, onDelete }: BoardViewProps) => {
  const queryClient = useQueryClient()

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<"list" | "card" | null>(null)

  // Card detail panel state
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [detailPanelOpen, setDetailPanelOpen] = useState(false)

  // Board rename state
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(board.name)

  // Add list state
  const [addingList, setAddingList] = useState(false)
  const [newListName, setNewListName] = useState("")

  // Add card state - tracks which list is in "add card" mode
  const [addingCardListId, setAddingCardListId] = useState<number | null>(null)
  const [newCardTitle, setNewCardTitle] = useState("")

  useEffect(() => {
    setRenameValue(board.name)
  }, [board.id, board.name])

  // Mutations
  const createListMutation = useMutation({
    mutationFn: (name: string) =>
      createList(board.id, { name, client_id: generateClientId() }),
    onSuccess: () => {
      message.success("List created")
      queryClient.invalidateQueries({ queryKey: ["kanban-board", board.id] })
      setAddingList(false)
      setNewListName("")
    },
    onError: (err) => {
      message.error(`Failed to create list: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  })

  const updateBoardMutation = useMutation({
    mutationFn: (name: string) => updateBoard(board.id, { name }),
    onSuccess: () => {
      message.success("Board renamed")
      queryClient.invalidateQueries({ queryKey: ["kanban-boards"] })
      queryClient.invalidateQueries({ queryKey: ["kanban-board", board.id] })
      setRenameModalOpen(false)
    },
    onError: (err) => {
      message.error(
        `Failed to rename board: ${err instanceof Error ? err.message : "Unknown error"}`
      )
    }
  })

  const deleteListMutation = useMutation({
    mutationFn: (listId: number) => deleteList(listId),
    onSuccess: () => {
      message.success("List deleted")
      queryClient.invalidateQueries({ queryKey: ["kanban-board", board.id] })
    },
    onError: (err) => {
      message.error(`Failed to delete list: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  })

  const createCardMutation = useMutation({
    mutationFn: ({ listId, title }: { listId: number; title: string }) =>
      createCard(listId, { title, client_id: generateClientId() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-board", board.id] })
      setAddingCardListId(null)
      setNewCardTitle("")
    },
    onError: (err) => {
      message.error(`Failed to create card: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  })

  const updateCardMutation = useMutation({
    mutationFn: ({ cardId, data }: { cardId: number; data: CardUpdate }) =>
      updateCard(cardId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-board", board.id] })
    },
    onError: (err) => {
      message.error(`Failed to update card: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  })

  const deleteCardMutation = useMutation({
    mutationFn: (cardId: number) => deleteCard(cardId),
    onSuccess: () => {
      message.success("Card deleted")
      queryClient.invalidateQueries({ queryKey: ["kanban-board", board.id] })
      setDetailPanelOpen(false)
      setSelectedCard(null)
    },
    onError: (err) => {
      message.error(`Failed to delete card: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  })

  const moveCardMutation = useMutation({
    mutationFn: ({
      cardId,
      targetListId,
      position
    }: {
      cardId: number
      targetListId: number
      position?: number
    }) => moveCard(cardId, targetListId, position),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-board", board.id] })
    },
    onError: (err) => {
      message.error(`Failed to move card: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  })

  const reorderListsMutation = useMutation({
    mutationFn: (listIds: number[]) => reorderLists(board.id, listIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-board", board.id] })
    },
    onError: (err) => {
      message.error(`Failed to reorder lists: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  })

  const reorderCardsMutation = useMutation({
    mutationFn: ({ listId, cardIds }: { listId: number; cardIds: number[] }) =>
      reorderCards(listId, cardIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-board", board.id] })
    },
    onError: (err) => {
      message.error(`Failed to reorder cards: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  })

  // Handle adding new list
  const handleAddList = useCallback(() => {
    if (!newListName.trim()) return
    createListMutation.mutate(newListName.trim())
  }, [newListName, createListMutation])

  // Handle adding new card
  const handleAddCard = useCallback(
    (listId: number) => {
      if (!newCardTitle.trim()) return
      createCardMutation.mutate({ listId, title: newCardTitle.trim() })
    },
    [newCardTitle, createCardMutation]
  )

  // Open card detail panel
  const handleCardClick = useCallback((card: Card) => {
    setSelectedCard(card)
    setDetailPanelOpen(true)
  }, [])

  // Save card from detail panel
  const handleSaveCard = useCallback(
    (cardId: number, data: CardUpdate) => {
      updateCardMutation.mutate({ cardId, data })
    },
    [updateCardMutation]
  )

  // Delete card
  const handleDeleteCard = useCallback(
    (cardId: number) => {
      deleteCardMutation.mutate(cardId)
    },
    [deleteCardMutation]
  )

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const sourceId = event.operation.source?.id
    if (!sourceId) return
    const idStr = String(sourceId)
    setActiveId(idStr)

    if (idStr.startsWith("list-")) {
      setActiveType("list")
    } else if (idStr.startsWith("card-")) {
      setActiveType("card")
    }
  }, [])

  const handleRenameBoard = useCallback(() => {
    const nextName = renameValue.trim()
    if (!nextName) {
      message.warning("Please enter a board name")
      return
    }
    if (nextName === board.name) {
      setRenameModalOpen(false)
      return
    }
    updateBoardMutation.mutate(nextName)
  }, [renameValue, board.name, updateBoardMutation])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (event.canceled) {
        setActiveId(null)
        setActiveType(null)
        return
      }

      const sourceId = event.operation.source?.id
      const targetId = event.operation.target?.id

      if (!sourceId || !targetId) {
        setActiveId(null)
        setActiveType(null)
        return
      }

      const activeIdStr = String(sourceId)
      const overIdStr = String(targetId)

      // Handle list reordering
      if (activeIdStr.startsWith("list-") && overIdStr.startsWith("list-")) {
        const activeListId = parseInt(activeIdStr.replace("list-", ""))
        const overListId = parseInt(overIdStr.replace("list-", ""))

        if (activeListId !== overListId) {
          const oldIndex = board.lists.findIndex((l) => l.id === activeListId)
          const newIndex = board.lists.findIndex((l) => l.id === overListId)

          if (oldIndex !== -1 && newIndex !== -1) {
            const newOrder = arrayMove(board.lists, oldIndex, newIndex)
            reorderListsMutation.mutate(newOrder.map((l) => l.id))
          }
        }
      }

      // Handle card reordering within same list
      if (activeIdStr.startsWith("card-") && overIdStr.startsWith("card-")) {
        const activeCardId = parseInt(activeIdStr.replace("card-", ""))
        const overCardId = parseInt(overIdStr.replace("card-", ""))

        // Find which list contains the active card
        const sourceList = board.lists.find((l) =>
          l.cards.some((c) => c.id === activeCardId)
        )
        const targetList = board.lists.find((l) =>
          l.cards.some((c) => c.id === overCardId)
        )

        if (sourceList && targetList) {
          if (sourceList.id === targetList.id) {
            // Same list - reorder
            const oldIndex = sourceList.cards.findIndex(
              (c) => c.id === activeCardId
            )
            const newIndex = sourceList.cards.findIndex(
              (c) => c.id === overCardId
            )

            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
              const newOrder = arrayMove(sourceList.cards, oldIndex, newIndex)
              reorderCardsMutation.mutate({
                listId: sourceList.id,
                cardIds: newOrder.map((c) => c.id)
              })
            }
          } else {
            // Different list - move card
            const targetIndex = targetList.cards.findIndex(
              (c) => c.id === overCardId
            )
            moveCardMutation.mutate({
              cardId: activeCardId,
              targetListId: targetList.id,
              position: targetIndex >= 0 ? targetIndex : undefined
            })
          }
        }
      }

      // Handle dropping card on a list (move to end of list)
      if (activeIdStr.startsWith("card-") && overIdStr.startsWith("list-")) {
        const activeCardId = parseInt(activeIdStr.replace("card-", ""))
        const targetListId = parseInt(overIdStr.replace("list-", ""))

        const sourceList = board.lists.find((l) =>
          l.cards.some((c) => c.id === activeCardId)
        )

        if (sourceList && sourceList.id !== targetListId) {
          moveCardMutation.mutate({
            cardId: activeCardId,
            targetListId
          })
        }
      }

      setActiveId(null)
      setActiveType(null)
    },
    [
      board.lists,
      reorderListsMutation,
      reorderCardsMutation,
      moveCardMutation
    ]
  )

  // Find active card for drag overlay
  const getActiveCard = (): Card | null => {
    if (!activeId || activeType !== "card") return null
    const cardId = parseInt(activeId.replace("card-", ""))
    for (const list of board.lists) {
      const card = list.cards.find((c) => c.id === cardId)
      if (card) return card
    }
    return null
  }

  // Find active list for drag overlay
  const getActiveList = (): ListWithCards | null => {
    if (!activeId || activeType !== "list") return null
    const listId = parseInt(activeId.replace("list-", ""))
    return board.lists.find((l) => l.id === listId) || null
  }

  return (
    <div className="board-view">
      {/* Board header with name and actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium">{board.name}</h2>
          <Button
            type="text"
            size="small"
            aria-label="Rename board"
            icon={<Edit2 className="w-4 h-4" />}
            onClick={() => {
              setRenameValue(board.name)
              setRenameModalOpen(true)
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {board.lists.length} lists, {board.total_cards} cards
          </span>
          <Popconfirm
            title="Delete this board?"
            description="All lists and cards will be deleted."
            onConfirm={onDelete}
            okText="Delete"
            okType="danger"
          >
            <Button danger icon={<Trash2 className="w-4 h-4" />} size="small">
              Delete Board
            </Button>
          </Popconfirm>
        </div>
      </div>

      {/* Kanban board with DnD */}
      <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
          {board.lists.map((list, index) => (
            <SortableList
              key={list.id}
              list={list}
              index={index}
              onDeleteList={() => deleteListMutation.mutate(list.id)}
              onCardClick={handleCardClick}
              addingCard={addingCardListId === list.id}
              onStartAddCard={() => setAddingCardListId(list.id)}
              onCancelAddCard={() => {
                setAddingCardListId(null)
                setNewCardTitle("")
              }}
              newCardTitle={newCardTitle}
              onNewCardTitleChange={setNewCardTitle}
              onAddCard={() => handleAddCard(list.id)}
            />
          ))}

          {/* Add list button/input */}
          <div className="flex-shrink-0 w-72">
            {addingList ? (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                <Input
                  placeholder="Enter list name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onPressEnter={handleAddList}
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    type="primary"
                    size="small"
                    onClick={handleAddList}
                    loading={createListMutation.isPending}
                  >
                    Add List
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setAddingList(false)
                      setNewListName("")
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="dashed"
                className="w-full h-10"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setAddingList(true)}
              >
                Add List
              </Button>
            )}
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeType === "card" && getActiveCard() && (
            <KanbanCardPreview card={getActiveCard()!} isDragging />
          )}
          {activeType === "list" && getActiveList() && (
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 w-72 opacity-80">
              <div className="font-medium">{getActiveList()!.name}</div>
              <div className="text-sm text-gray-500">
                {getActiveList()!.cards.length} cards
              </div>
            </div>
          )}
        </DragOverlay>
      </DragDropProvider>

      {/* Card detail panel */}
      <CardDetailPanel
        card={selectedCard}
        lists={board.lists}
        open={detailPanelOpen}
        onClose={() => {
          setDetailPanelOpen(false)
          setSelectedCard(null)
        }}
        onSave={handleSaveCard}
        onDelete={handleDeleteCard}
        onMove={(cardId, targetListId) =>
          moveCardMutation.mutate({ cardId, targetListId })
        }
      />

      <Modal
        title="Rename Board"
        open={renameModalOpen}
        onCancel={() => setRenameModalOpen(false)}
        onOk={handleRenameBoard}
        okText="Save"
        confirmLoading={updateBoardMutation.isPending}
        okButtonProps={{ disabled: !renameValue.trim() }}
      >
        <div className="py-4">
          <label className="block text-sm font-medium mb-2">Board Name</label>
          <Input
            placeholder="Enter board name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onPressEnter={handleRenameBoard}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  )
}

// =============================================================================
// Sortable List Component
// =============================================================================

interface SortableListProps {
  list: ListWithCards
  index: number
  onDeleteList: () => void
  onCardClick: (card: Card) => void
  addingCard: boolean
  onStartAddCard: () => void
  onCancelAddCard: () => void
  newCardTitle: string
  onNewCardTitleChange: (value: string) => void
  onAddCard: () => void
}

const SortableList = ({
  list,
  index,
  onDeleteList,
  onCardClick,
  addingCard,
  onStartAddCard,
  onCancelAddCard,
  newCardTitle,
  onNewCardTitleChange,
  onAddCard
}: SortableListProps) => {
  const {
    ref,
    handleRef,
    isDragging
  } = useSortable({
    id: `list-${list.id}`,
    index,
    collisionDetector: closestCorners,
    group: "lists"
  })

  const style = {
    opacity: isDragging ? 0.5 : 1
  }

  const menuItems: MenuProps["items"] = [
    {
      key: "delete",
      label: "Delete List",
      danger: true,
      icon: <Trash2 className="w-4 h-4" />,
      onClick: onDeleteList
    }
  ]

  return (
    <div
      ref={ref}
      style={style}
      className="kanban-list flex-shrink-0 w-72 bg-gray-100 dark:bg-gray-800 rounded-lg"
    >
      {/* List header */}
      <div
        className="flex items-center justify-between p-3 cursor-grab"
        ref={handleRef}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{list.name}</span>
          <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
            {list.cards.length}
          </span>
        </div>
        <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
          <Button
            type="text"
            size="small"
            icon={<MoreHorizontal className="w-4 h-4" />}
          />
        </Dropdown>
      </div>

      {/* Cards container */}
      <div className="px-2 pb-2 max-h-[500px] overflow-y-auto">
        {list.cards.map((card, cardIndex) => (
          <SortableCard
            key={card.id}
            card={card}
            index={cardIndex}
            group={`cards-${list.id}`}
            onClick={() => onCardClick(card)}
          />
        ))}

        {/* Add card input */}
        {addingCard ? (
          <div className="mt-2">
            <Input.TextArea
              placeholder="Enter card title"
              value={newCardTitle}
              onChange={(e) => onNewCardTitleChange(e.target.value)}
              autoSize={{ minRows: 2, maxRows: 4 }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  onAddCard()
                }
                if (e.key === "Escape") {
                  onCancelAddCard()
                }
              }}
            />
            <div className="flex gap-2 mt-2">
              <Button type="primary" size="small" onClick={onAddCard}>
                Add
              </Button>
              <Button size="small" onClick={onCancelAddCard}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="text"
            className="w-full mt-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            icon={<Plus className="w-4 h-4" />}
            onClick={onStartAddCard}
          >
            Add card
          </Button>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Sortable Card Component
// =============================================================================

interface SortableCardProps {
  card: Card
  index: number
  group: string
  onClick: () => void
}

const SortableCard = ({ card, index, group, onClick }: SortableCardProps) => {
  const {
    ref,
    isDragging
  } = useSortable({
    id: `card-${card.id}`,
    index,
    collisionDetector: closestCorners,
    group
  })

  const style = {
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={ref}
      style={style}
      onClick={onClick}
      className="kanban-card bg-white dark:bg-gray-900 rounded-md p-3 mb-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
    >
      <KanbanCardPreview card={card} />
    </div>
  )
}

// =============================================================================
// Card Preview Component (used in both card and drag overlay)
// =============================================================================

interface KanbanCardPreviewProps {
  card: Card
  isDragging?: boolean
}

const KanbanCardPreview = ({ card, isDragging }: KanbanCardPreviewProps) => {
  const overdue = isCardOverdue(card)

  return (
    <div className={isDragging ? "bg-white dark:bg-gray-900 rounded-md p-3 shadow-lg" : ""}>
      {/* Title */}
      <div className="text-sm font-medium mb-1">{card.title}</div>

      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Priority badge */}
        {card.priority && (
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: getPriorityColor(card.priority) }}
            title={card.priority}
          />
        )}

        {/* Due date badge */}
        {card.due_date && (
          <span
            className={`text-xs flex items-center gap-1 px-1.5 py-0.5 rounded ${
              overdue
                ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                : card.due_complete
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            <Calendar className="w-3 h-3" />
            {formatDueDate(card.due_date)}
          </span>
        )}
      </div>
    </div>
  )
}

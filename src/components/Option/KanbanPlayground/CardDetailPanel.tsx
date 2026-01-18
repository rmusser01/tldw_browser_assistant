import { useState, useEffect } from "react"
import {
  Drawer,
  Input,
  Select,
  DatePicker,
  Button,
  Popconfirm,
  Space
} from "antd"
import { Trash2, MoveRight } from "lucide-react"
import dayjs from "dayjs"

import type { Card, CardUpdate, ListWithCards, PriorityType } from "@/types/kanban"

interface CardDetailPanelProps {
  card: Card | null
  lists: ListWithCards[]
  open: boolean
  onClose: () => void
  onSave: (cardId: number, data: CardUpdate) => void
  onDelete: (cardId: number) => void
  onMove: (cardId: number, targetListId: number) => void
}

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "#3b82f6" },
  { value: "medium", label: "Medium", color: "#eab308" },
  { value: "high", label: "High", color: "#f97316" },
  { value: "urgent", label: "Urgent", color: "#ef4444" }
]

export const CardDetailPanel = ({
  card,
  lists,
  open,
  onClose,
  onSave,
  onDelete,
  onMove
}: CardDetailPanelProps) => {
  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState<dayjs.Dayjs | null>(null)
  const [priority, setPriority] = useState<PriorityType | null>(null)
  const [moveToListId, setMoveToListId] = useState<number | null>(null)

  // Track if form is dirty
  const [isDirty, setIsDirty] = useState(false)

  // Sync form state when card changes
  useEffect(() => {
    if (card) {
      setTitle(card.title)
      setDescription(card.description || "")
      setDueDate(card.due_date ? dayjs(card.due_date) : null)
      setPriority(card.priority || null)
      setMoveToListId(null)
      setIsDirty(false)
    }
  }, [card])

  const handleSave = () => {
    if (!card) return

    const updates: CardUpdate = {}

    if (title !== card.title) updates.title = title
    if (description !== (card.description ?? "")) {
      updates.description = description === "" ? null : description
    }
    const newDueDate = dueDate?.toISOString() ?? null
    const oldDueDate = card.due_date ?? null
    let hasDateChanged = false
    if (dueDate) {
      if (!oldDueDate) {
        hasDateChanged = true
      } else {
        const oldParsed = dayjs(oldDueDate)
        hasDateChanged = !oldParsed.isValid() || !oldParsed.isSame(dueDate)
      }
    } else {
      hasDateChanged = oldDueDate !== null
    }
    if (hasDateChanged) {
      updates.due_date = newDueDate
    }
    if (priority !== (card.priority ?? null)) updates.priority = priority

    // Only save if there are changes
    if (Object.keys(updates).length > 0) {
      onSave(card.id, updates)
    }

    setIsDirty(false)
  }

  const handleMove = () => {
    if (!card || !moveToListId || moveToListId === card.list_id) return
    onMove(card.id, moveToListId)
    setMoveToListId(null)
  }

  const currentList = lists.find((l) => l.id === card?.list_id)

  const listOptions = lists.map((l) => ({
    value: l.id,
    label: l.name,
    disabled: l.id === card?.list_id
  }))

  return (
    <Drawer
      title={
        <div className="flex items-center justify-between">
          <span>Edit Card</span>
          {card && (
            <Popconfirm
              title="Delete this card?"
              description="This action cannot be undone."
              onConfirm={() => onDelete(card.id)}
              okText="Delete"
              okType="danger"
            >
              <Button
                danger
                type="text"
                icon={<Trash2 className="w-4 h-4" />}
              />
            </Popconfirm>
          )}
        </div>
      }
      open={open}
      onClose={onClose}
      width={400}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSave} disabled={!isDirty}>
            Save Changes
          </Button>
        </div>
      }
    >
      {card && (
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setIsDirty(true)
              }}
              placeholder="Card title"
            />
          </div>

          {/* Current list indicator and move option */}
          <div>
            <label className="block text-sm font-medium mb-1">
              In list: <span className="font-normal">{currentList?.name}</span>
            </label>
            <div className="flex gap-2">
              <Select
                placeholder="Move to..."
                style={{ flex: 1 }}
                value={moveToListId}
                onChange={setMoveToListId}
                options={listOptions}
                allowClear
              />
              <Button
                icon={<MoveRight className="w-4 h-4" />}
                onClick={handleMove}
                disabled={!moveToListId || moveToListId === card.list_id}
              >
                Move
              </Button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <Input.TextArea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                setIsDirty(true)
              }}
              placeholder="Add a description..."
              autoSize={{ minRows: 4, maxRows: 10 }}
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium mb-1">Due Date</label>
            <DatePicker
              value={dueDate}
              onChange={(date) => {
                setDueDate(date)
                setIsDirty(true)
              }}
              className="w-full"
              showTime={{ format: "HH:mm" }}
              format="YYYY-MM-DD HH:mm"
              allowClear
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <Select
              value={priority}
              onChange={(value) => {
                setPriority(value ?? null)
                setIsDirty(true)
              }}
              className="w-full"
              placeholder="Select priority"
              allowClear
              options={PRIORITY_OPTIONS.map((opt) => ({
                value: opt.value,
                label: (
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: opt.color }}
                    />
                    {opt.label}
                  </div>
                )
              }))}
            />
          </div>

          {/* Metadata (read-only info) */}
          <div className="pt-4 border-t text-xs text-gray-500 space-y-1">
            <div>Created: {new Date(card.created_at).toLocaleString()}</div>
            <div>Updated: {new Date(card.updated_at).toLocaleString()}</div>
            <div>ID: {card.id}</div>
          </div>
        </div>
      )}
    </Drawer>
  )
}

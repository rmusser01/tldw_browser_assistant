import React, { useEffect, useRef, useState } from "react"
import { Checkbox, DatePicker, Input, InputNumber, Tag } from "antd"
import dayjs from "dayjs"
import type { ColumnType } from "@/types/data-tables"

interface EditableCellProps {
  value: any
  columnType: ColumnType
  columnName: string
  rowIndex: number
  isEditing: boolean
  isModified?: boolean
  onStartEdit: () => void
  onFinishEdit: (value: any) => void
  onCancelEdit: () => void
}

/**
 * EditableCell
 *
 * A cell component that can be clicked to enter edit mode.
 * Renders appropriate input based on column type.
 */
export const EditableCell: React.FC<EditableCellProps> = ({
  value,
  columnType,
  columnName,
  rowIndex,
  isEditing,
  isModified,
  onStartEdit,
  onFinishEdit,
  onCancelEdit
}) => {
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<any>(null)

  // Reset edit value when value changes or when entering edit mode
  useEffect(() => {
    setEditValue(value)
  }, [value, isEditing])

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        inputRef.current?.focus?.()
        inputRef.current?.select?.()
      }, 0)
    }
  }, [isEditing])

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onFinishEdit(editValue)
    } else if (e.key === "Escape") {
      e.preventDefault()
      onCancelEdit()
    }
  }

  // Handle blur (finish editing)
  const handleBlur = () => {
    onFinishEdit(editValue)
  }

  // Render display value (non-editing mode)
  const renderDisplayValue = () => {
    if (value === null || value === undefined) {
      return <span className="text-zinc-400 italic">-</span>
    }

    switch (columnType) {
      case "url":
        if (typeof value === "string" && value) {
          return (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
              onClick={(e) => e.stopPropagation()}
            >
              {value.length > 40 ? `${value.slice(0, 40)}...` : value}
            </a>
          )
        }
        return String(value)

      case "boolean":
        return value ? (
          <Tag color="green">Yes</Tag>
        ) : (
          <Tag color="red">No</Tag>
        )

      case "date":
        if (value) {
          try {
            return dayjs(value).format("YYYY-MM-DD")
          } catch {
            return String(value)
          }
        }
        return String(value)

      case "currency":
        if (typeof value === "number") {
          return `$${value.toFixed(2)}`
        }
        return String(value)

      case "number":
        return typeof value === "number" ? value.toLocaleString() : String(value)

      default:
        return String(value)
    }
  }

  // Render edit input based on column type
  const renderEditInput = () => {
    switch (columnType) {
      case "number":
        return (
          <InputNumber
            ref={inputRef}
            value={editValue}
            onChange={(v) => setEditValue(v)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="w-full"
            size="small"
          />
        )

      case "currency":
        return (
          <InputNumber
            ref={inputRef}
            value={editValue}
            onChange={(v) => setEditValue(v)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            prefix="$"
            precision={2}
            className="w-full"
            size="small"
          />
        )

      case "date":
        return (
          <DatePicker
            ref={inputRef}
            value={editValue ? dayjs(editValue) : null}
            onChange={(date) => {
              const newValue = date ? date.format("YYYY-MM-DD") : null
              setEditValue(newValue)
              // DatePicker doesn't blur properly, so finish on change
              onFinishEdit(newValue)
            }}
            onKeyDown={handleKeyDown}
            className="w-full"
            size="small"
            open
          />
        )

      case "boolean":
        return (
          <Checkbox
            ref={inputRef}
            checked={!!editValue}
            onChange={(e) => {
              const newValue = e.target.checked
              setEditValue(newValue)
              onFinishEdit(newValue)
            }}
            autoFocus
          />
        )

      case "url":
        return (
          <Input
            ref={inputRef}
            value={editValue || ""}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="https://"
            size="small"
          />
        )

      default:
        return (
          <Input
            ref={inputRef}
            value={editValue || ""}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            size="small"
          />
        )
    }
  }

  // Editing mode
  if (isEditing) {
    return (
      <div className="editable-cell-editing" onClick={(e) => e.stopPropagation()}>
        {renderEditInput()}
      </div>
    )
  }

  // Display mode
  return (
    <div
      className={`editable-cell cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 px-1 py-0.5 rounded min-h-[24px] ${
        isModified ? "bg-yellow-50 dark:bg-yellow-900/20 border-l-2 border-yellow-400" : ""
      }`}
      onClick={onStartEdit}
      title="Click to edit"
    >
      {renderDisplayValue()}
    </div>
  )
}

import React from "react"
import { X } from "lucide-react"

export type ContextChipItem = {
  id: string
  label: string
  icon?: React.ReactNode
  previewSrc?: string
  onRemove?: () => void
  removeLabel?: string
}

type ContextChipsProps = {
  items: ContextChipItem[]
  className?: string
  ariaLabel?: string
}

export const ContextChips: React.FC<ContextChipsProps> = ({
  items,
  className = "",
  ariaLabel
}) => {
  if (!items.length) {
    return null
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} aria-label={ariaLabel}>
      {items.map((item) => (
        <div
          key={item.id}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface2 px-2 py-1 text-xs text-text"
        >
          {item.previewSrc ? (
            <img
              src={item.previewSrc}
              alt=""
              className="h-4 w-4 rounded object-cover"
            />
          ) : (
            item.icon
          )}
          <span className="max-w-[160px] truncate">{item.label}</span>
          {item.onRemove && (
            <button
              type="button"
              onClick={item.onRemove}
              className="rounded p-1 text-text-subtle hover:bg-surface hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={item.removeLabel || item.label}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export default ContextChips

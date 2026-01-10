import React from "react"
import { cn } from "@/libs/utils"

export type MentionMenuItem = {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  kind?: "tab" | "knowledge" | "file" | "page"
  payload?: unknown
}

type MentionsMenuProps = {
  open: boolean
  items: MentionMenuItem[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  onSelect: (item: MentionMenuItem) => void
  className?: string
  emptyLabel?: string
}

export const MentionsMenu: React.FC<MentionsMenuProps> = ({
  open,
  items,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  className,
  emptyLabel = "No matches"
}) => {
  if (!open) return null

  return (
    <div className={cn("z-20", className)}>
      <div className="max-h-48 overflow-auto rounded-md border border-border bg-elevated shadow-lg">
        {items.length === 0 ? (
          <div className="px-3 py-2 text-xs text-text-muted">
            {emptyLabel}
          </div>
        ) : (
          items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => onActiveIndexChange(index)}
              onClick={() => onSelect(item)}
              className={cn(
                "flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors",
                index === activeIndex ? "bg-surface2 text-text" : "text-text"
              )}
              title={item.description ? `${item.label} - ${item.description}` : item.label}
            >
              {item.icon && (
                <span className="mt-0.5 text-text-subtle">{item.icon}</span>
              )}
              <span className="flex flex-col">
                <span className="text-text">{item.label}</span>
                {item.description && (
                  <span className="text-xs text-text-subtle">
                    {item.description}
                  </span>
                )}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default MentionsMenu

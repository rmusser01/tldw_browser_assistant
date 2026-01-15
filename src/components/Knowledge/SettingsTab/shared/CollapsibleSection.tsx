import React from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

type CollapsibleSectionProps = {
  title: string
  children: React.ReactNode
  defaultExpanded?: boolean
  visible?: boolean
  helperText?: string
}

/**
 * Collapsible section wrapper for settings groups
 */
export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultExpanded = false,
  visible = true,
  helperText
}) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded)
  const sectionId = `section-${title.toLowerCase().replace(/\s+/g, "-")}`

  if (!visible) return null

  return (
    <div className="rounded border border-border bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-surface2 transition-colors"
        aria-expanded={expanded}
        aria-controls={sectionId}
      >
        <span className="text-xs font-semibold text-text">{title}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-text-muted" />
        ) : (
          <ChevronRight className="h-4 w-4 text-text-muted" />
        )}
      </button>

      {expanded && (
        <div
          id={sectionId}
          className="p-3 pt-0 border-t border-border"
        >
          {helperText && (
            <p className="text-xs text-text-muted mb-3 italic">{helperText}</p>
          )}
          <div className="grid gap-3 md:grid-cols-2">{children}</div>
        </div>
      )}
    </div>
  )
}

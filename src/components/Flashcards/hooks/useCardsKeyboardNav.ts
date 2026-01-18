import { useEffect, useCallback } from "react"

interface CardsKeyboardNavOptions {
  /** Whether navigation is enabled */
  enabled?: boolean
  /** Total number of items in the list */
  itemCount: number
  /** Current focused index (-1 if none) */
  focusedIndex: number
  /** Callback to set the focused index */
  onFocusChange: (index: number) => void
  /** Callback when Enter is pressed on focused item */
  onEdit?: (index: number) => void
  /** Callback when Space is pressed on focused item */
  onToggleSelect?: (index: number) => void
  /** Callback when Delete is pressed on focused item */
  onDelete?: (index: number) => void
}

/**
 * Hook for keyboard navigation in the Cards tab list.
 *
 * Shortcuts:
 * - j / ArrowDown: Move focus down
 * - k / ArrowUp: Move focus up
 * - Enter: Edit focused card
 * - Space: Toggle selection of focused card
 * - Delete / Backspace: Delete focused card
 */
export function useCardsKeyboardNav({
  enabled = true,
  itemCount,
  focusedIndex,
  onFocusChange,
  onEdit,
  onToggleSelect,
  onDelete
}: CardsKeyboardNavOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return
      }

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault()
          if (itemCount > 0) {
            const nextIndex = focusedIndex < 0 ? 0 : Math.min(focusedIndex + 1, itemCount - 1)
            onFocusChange(nextIndex)
          }
          break

        case "k":
        case "ArrowUp":
          e.preventDefault()
          if (itemCount > 0) {
            const prevIndex = focusedIndex < 0 ? itemCount - 1 : Math.max(focusedIndex - 1, 0)
            onFocusChange(prevIndex)
          }
          break

        case "Enter":
          if (focusedIndex >= 0 && focusedIndex < itemCount && onEdit) {
            e.preventDefault()
            onEdit(focusedIndex)
          }
          break

        case " ":
          if (focusedIndex >= 0 && focusedIndex < itemCount && onToggleSelect) {
            e.preventDefault()
            onToggleSelect(focusedIndex)
          }
          break

        case "Delete":
        case "Backspace":
          if (focusedIndex >= 0 && focusedIndex < itemCount && onDelete) {
            e.preventDefault()
            onDelete(focusedIndex)
          }
          break

        case "Escape":
          // Clear focus
          onFocusChange(-1)
          break
      }
    },
    [itemCount, focusedIndex, onFocusChange, onEdit, onToggleSelect, onDelete]
  )

  useEffect(() => {
    if (!enabled) return

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [enabled, handleKeyDown])
}

export default useCardsKeyboardNav

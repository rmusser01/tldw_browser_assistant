import type { KeyboardEvent } from "react"

export const handleQueuedRowKeyDown = (
  event: KeyboardEvent<HTMLElement>,
  onSelect: () => void
) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault()
    onSelect()
  }
}

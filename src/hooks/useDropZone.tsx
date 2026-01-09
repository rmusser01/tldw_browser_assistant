import React from "react"

export type DropState = "idle" | "dragging" | "error"
export type DropFeedback = { type: "info" | "error"; message: string } | null

interface UseDropZoneOptions {
  onFileDrop: (file: File) => void
  validateFile?: (file: File) => boolean
  feedbackDuration?: number
  dragLeaveDebounce?: number
}

interface UseDropZoneResult {
  dropRef: React.RefObject<HTMLDivElement>
  dropState: DropState
  dropFeedback: DropFeedback
  showDropFeedback: (feedback: { type: "info" | "error"; message: string }) => void
  clearDropFeedback: () => void
}

/**
 * Hook for managing drag-and-drop file uploads.
 * Extracted from sidepanel-chat.tsx for reusability.
 *
 * Features:
 * - Debounced drag-leave to prevent false positives from child elements
 * - Auto-clearing feedback after duration
 * - Configurable file validation
 */
export const useDropZone = ({
  onFileDrop,
  validateFile = (file) => file.type.startsWith("image/"),
  feedbackDuration = 4_000,
  dragLeaveDebounce = 50
}: UseDropZoneOptions): UseDropZoneResult => {
  const dropRef = React.useRef<HTMLDivElement>(null)
  const [dropState, setDropState] = React.useState<DropState>("idle")
  const [dropFeedback, setDropFeedback] = React.useState<DropFeedback>(null)

  const feedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const dragLeaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  )

  const showDropFeedback = React.useCallback(
    (feedback: { type: "info" | "error"; message: string }) => {
      setDropFeedback(feedback)
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current)
      }
      feedbackTimerRef.current = setTimeout(() => {
        setDropFeedback(null)
        feedbackTimerRef.current = null
      }, feedbackDuration)
    },
    [feedbackDuration]
  )

  const clearDropFeedback = React.useCallback(() => {
    setDropFeedback(null)
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }
  }, [])

  React.useEffect(() => {
    const element = dropRef.current
    if (!element) return

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDropState("idle")

      const files = Array.from(e.dataTransfer?.files || [])
      const validFiles = files.filter(validateFile)

      if (files.length > 0 && validFiles.length === 0) {
        setDropState("error")
        return
      }

      if (validFiles.length > 0) {
        onFileDrop(validFiles[0])
      }
    }

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // Clear drag-leave debounce timer when re-entering
      if (dragLeaveTimerRef.current) {
        clearTimeout(dragLeaveTimerRef.current)
        dragLeaveTimerRef.current = null
      }
      setDropState("dragging")
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      // Debounce drag-leave to prevent false positives from child elements
      if (dragLeaveTimerRef.current) {
        clearTimeout(dragLeaveTimerRef.current)
      }
      dragLeaveTimerRef.current = setTimeout(() => {
        setDropState("idle")
        dragLeaveTimerRef.current = null
      }, dragLeaveDebounce)
    }

    element.addEventListener("dragover", handleDragOver)
    element.addEventListener("drop", handleDrop)
    element.addEventListener("dragenter", handleDragEnter)
    element.addEventListener("dragleave", handleDragLeave)

    return () => {
      element.removeEventListener("dragover", handleDragOver)
      element.removeEventListener("drop", handleDrop)
      element.removeEventListener("dragenter", handleDragEnter)
      element.removeEventListener("dragleave", handleDragLeave)
    }
  }, [onFileDrop, validateFile, dragLeaveDebounce])

  // Cleanup timers on unmount
  React.useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current)
      }
      if (dragLeaveTimerRef.current) {
        clearTimeout(dragLeaveTimerRef.current)
      }
    }
  }, [])

  return {
    dropRef,
    dropState,
    dropFeedback,
    showDropFeedback,
    clearDropFeedback
  }
}

import React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { type AudioChapter } from "@/store/audiobook-studio"
import { ChapterItem } from "./ChapterItem"

type SortableChapterItemProps = {
  chapter: AudioChapter
  index: number
}

export const SortableChapterItem: React.FC<SortableChapterItemProps> = ({
  chapter,
  index
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: chapter.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : "auto"
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className="absolute left-0 top-0 bottom-0 flex items-center z-10">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 -ml-2 text-text-muted hover:text-text transition-colors"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </div>
      <div className="pl-6">
        <ChapterItem chapter={chapter} index={index} />
      </div>
    </div>
  )
}

export default SortableChapterItem

import React, { useCallback } from "react"
import { Card, Typography, Empty, Button, Space, Input, Popconfirm } from "antd"
import { useTranslation } from "react-i18next"
import { Plus, Trash2 } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from "@dnd-kit/sortable"
import { useAudiobookStudioStore } from "@/store/audiobook-studio"
import { ChapterItem } from "./ChapterItem"
import { SortableChapterItem } from "./SortableChapterItem"

const { Text } = Typography

export const ChapterList: React.FC = () => {
  const { t } = useTranslation(["audiobook", "common"])
  const [newChapterTitle, setNewChapterTitle] = React.useState("")
  const [newChapterContent, setNewChapterContent] = React.useState("")
  const [showAddForm, setShowAddForm] = React.useState(false)

  const chapters = useAudiobookStudioStore((s) => s.chapters)
  const addChapter = useAudiobookStudioStore((s) => s.addChapter)
  const clearChapters = useAudiobookStudioStore((s) => s.clearChapters)
  const reorderChapters = useAudiobookStudioStore((s) => s.reorderChapters)
  const defaultVoiceConfig = useAudiobookStudioStore((s) => s.defaultVoiceConfig)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const sortedChapters = React.useMemo(
    () => [...chapters].sort((a, b) => a.order - b.order),
    [chapters]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = sortedChapters.findIndex((ch) => ch.id === active.id)
      const newIndex = sortedChapters.findIndex((ch) => ch.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderChapters(oldIndex, newIndex)
      }
    },
    [sortedChapters, reorderChapters]
  )

  const handleAddChapter = () => {
    if (!newChapterContent.trim()) return

    addChapter({
      title: newChapterTitle.trim() || `Chapter ${chapters.length + 1}`,
      content: newChapterContent.trim(),
      voiceConfig: { ...defaultVoiceConfig },
      status: "pending"
    })

    setNewChapterTitle("")
    setNewChapterContent("")
    setShowAddForm(false)
  }

  if (chapters.length === 0 && !showAddForm) {
    return (
      <Card>
        <Empty
          description={
            <div className="text-center">
              <Text type="secondary">
                {t(
                  "audiobook:chapters.empty",
                  "No chapters yet. Split your content in the Content tab or add chapters manually."
                )}
              </Text>
            </div>
          }
        >
          <Button type="primary" onClick={() => setShowAddForm(true)}>
            {t("audiobook:chapters.addFirst", "Add first chapter")}
          </Button>
        </Empty>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <Text strong>
              {t("audiobook:chapters.listTitle", "Chapter List")}
            </Text>
            <Text type="secondary" className="ml-2">
              ({chapters.length}{" "}
              {t("audiobook:chapters.chaptersCount", "chapters")})
            </Text>
          </div>
          <Space>
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setShowAddForm(true)}
            >
              {t("audiobook:chapters.add", "Add chapter")}
            </Button>
            {chapters.length > 0 && (
              <Popconfirm
                title={t(
                  "audiobook:chapters.clearConfirmTitle",
                  "Clear all chapters?"
                )}
                description={t(
                  "audiobook:chapters.clearConfirmDesc",
                  "This will delete all chapters and their generated audio."
                )}
                onConfirm={clearChapters}
                okText={t("common:confirm", "Confirm")}
                cancelText={t("common:cancel", "Cancel")}
              >
                <Button danger icon={<Trash2 className="h-4 w-4" />}>
                  {t("audiobook:chapters.clearAll", "Clear all")}
                </Button>
              </Popconfirm>
            )}
          </Space>
        </div>

        {showAddForm && (
          <Card className="mb-4 bg-surface-elevated">
            <div className="space-y-3">
              <Text strong>
                {t("audiobook:chapters.newChapter", "New Chapter")}
              </Text>
              <Input
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                placeholder={t(
                  "audiobook:chapters.titlePlaceholderOptional",
                  "Chapter title (optional)"
                )}
              />
              <Input.TextArea
                value={newChapterContent}
                onChange={(e) => setNewChapterContent(e.target.value)}
                placeholder={t(
                  "audiobook:chapters.contentPlaceholder",
                  "Chapter content..."
                )}
                autoSize={{ minRows: 3, maxRows: 8 }}
              />
              <Space>
                <Button type="primary" onClick={handleAddChapter}>
                  {t("audiobook:chapters.addButton", "Add")}
                </Button>
                <Button
                  onClick={() => {
                    setShowAddForm(false)
                    setNewChapterTitle("")
                    setNewChapterContent("")
                  }}
                >
                  {t("common:cancel", "Cancel")}
                </Button>
              </Space>
            </div>
          </Card>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedChapters.map((ch) => ch.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {sortedChapters.map((chapter, index) => (
                <SortableChapterItem
                  key={chapter.id}
                  chapter={chapter}
                  index={index}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </Card>
    </div>
  )
}

export default ChapterList

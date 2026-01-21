import React from "react"
import { Modal, Empty, Spin, Select, message } from "antd"
import { useTranslation } from "react-i18next"
import { shallow } from "zustand/shallow"
import { useFolderStore } from "@/store/folder"

type BulkTagPickerModalProps = {
  open: boolean
  conversationIds: string[]
  onClose: () => void
  onSuccess?: () => void
}

const normalizeTag = (value: string) => value.trim()

export const BulkTagPickerModal: React.FC<BulkTagPickerModalProps> = ({
  open,
  conversationIds,
  onClose,
  onSuccess
}) => {
  const { t } = useTranslation(["sidepanel", "common"])
  const [selectedTags, setSelectedTags] = React.useState<string[]>([])
  const [isSaving, setIsSaving] = React.useState(false)

  const {
    keywords,
    isLoading,
    folderApiAvailable,
    ensureKeyword,
    addKeywordToConversation,
    refreshFromServer
  } = useFolderStore(
    (state) => ({
      keywords: state.keywords,
      isLoading: state.isLoading,
      folderApiAvailable: state.folderApiAvailable,
      ensureKeyword: state.ensureKeyword,
      addKeywordToConversation: state.addKeywordToConversation,
      refreshFromServer: state.refreshFromServer
    }),
    shallow
  )

  React.useEffect(() => {
    if (open && folderApiAvailable !== false) {
      refreshFromServer()
    }
  }, [open, folderApiAvailable, refreshFromServer])

  React.useEffect(() => {
    if (!open) {
      setSelectedTags([])
    }
  }, [open])

  const keywordOptions = React.useMemo(
    () =>
      keywords
        .filter((keyword) => !keyword.deleted)
        .map((keyword) => ({
          label: keyword.keyword,
          value: keyword.keyword
        })),
    [keywords]
  )

  const handleSave = async () => {
    const normalizedTags = selectedTags
      .map(normalizeTag)
      .filter(Boolean)
    const uniqueTags = Array.from(
      new Map(normalizedTags.map((tag) => [tag.toLowerCase(), tag])).values()
    )

    if (uniqueTags.length === 0) return
    if (conversationIds.length === 0) return

    setIsSaving(true)
    try {
      const keywords = await Promise.all(
        uniqueTags.map((tag) => ensureKeyword(tag))
      )
      const keywordIds = keywords
        .filter(Boolean)
        .map((keyword) => keyword!.id)

      if (keywordIds.length === 0) {
        message.error(
          t("sidepanel:multiSelect.tagsApplyError", "Unable to create tags.")
        )
        return
      }

      const tasks = conversationIds.flatMap((conversationId) =>
        keywordIds.map(async (keywordId) => {
          const ok = await addKeywordToConversation(conversationId, keywordId)
          return { ok, conversationId, keywordId }
        })
      )
      const results = await Promise.allSettled(tasks)
      const failures = results.filter(
        (result) => result.status === "fulfilled" && !result.value.ok
      ).length +
        results.filter((result) => result.status === "rejected").length

      if (failures > 0) {
        message.error(
          t("sidepanel:multiSelect.tagsApplyError", "Some chats could not be tagged.")
        )
      } else {
        message.success(
          t("sidepanel:multiSelect.tagsApplySuccess", "Tags applied to selected chats.")
        )
      }

      onSuccess?.()
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const renderContent = () => {
    if (folderApiAvailable === false) {
      return (
        <Empty
          description={t(
            "sidepanel:multiSelect.tagsUnavailable",
            "Tags are not available on this server"
          )}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Spin />
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <div className="text-caption text-text-muted">
          {t("sidepanel:multiSelect.tagsHint", "Add tags to the selected chats.")}
        </div>
        <Select
          mode="tags"
          value={selectedTags}
          onChange={(vals) => setSelectedTags(vals as string[])}
          options={keywordOptions}
          placeholder={t(
            "sidepanel:multiSelect.tagsPlaceholder",
            "Add tags..."
          )}
          className="w-full"
        />
      </div>
    )
  }

  return (
    <Modal
      open={open}
      title={t("sidepanel:multiSelect.addTags", "Add tags")}
      onCancel={onClose}
      onOk={handleSave}
      okText={t("common:save", "Save")}
      cancelText={t("common:cancel", "Cancel")}
      okButtonProps={{
        loading: isSaving,
        disabled:
          folderApiAvailable === false ||
          conversationIds.length === 0 ||
          selectedTags.length === 0
      }}
      destroyOnHidden
    >
      {renderContent()}
    </Modal>
  )
}

export default BulkTagPickerModal

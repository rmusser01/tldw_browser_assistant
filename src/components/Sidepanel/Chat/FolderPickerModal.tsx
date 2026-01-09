import React from "react"
import { Modal, Tree, Empty, Spin, Input, Button } from "antd"
import type { TreeProps } from "antd"
import { Folder, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useFolderStore } from "@/store/folder"

type FolderPickerModalProps = {
  open: boolean
  onClose: () => void
  conversationId: string | null
  onSuccess?: () => void
}

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({
  open,
  onClose,
  conversationId,
  onSuccess
}) => {
  const { t } = useTranslation(["sidepanel", "common"])
  const [selectedFolderIds, setSelectedFolderIds] = React.useState<number[]>([])
  const [newFolderName, setNewFolderName] = React.useState("")
  const [isCreating, setIsCreating] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  const {
    folders,
    isLoading,
    folderApiAvailable,
    getFolderTree,
    getFoldersForConversation,
    addConversationToFolder,
    removeConversationFromFolder,
    createFolder,
    refreshFromServer
  } = useFolderStore()

  // Refresh folder data when modal opens
  React.useEffect(() => {
    if (open && folderApiAvailable !== false) {
      refreshFromServer()
    }
  }, [open, folderApiAvailable, refreshFromServer])

  // Pre-select folders that already contain this conversation
  React.useEffect(() => {
    if (open && conversationId) {
      const existingFolders = getFoldersForConversation(conversationId)
      setSelectedFolderIds(existingFolders.map((f) => f.id))
    }
  }, [open, conversationId, getFoldersForConversation])

  const folderTree = React.useMemo(() => {
    return getFolderTree()
  }, [getFolderTree, folders])

  const treeData: TreeProps["treeData"] = React.useMemo(() => {
    const buildTreeData = (
      nodes: ReturnType<typeof getFolderTree>
    ): TreeProps["treeData"] => {
      return nodes.map((node) => ({
        key: node.key,
        title: (
          <span className="flex items-center gap-1.5">
            <Folder className="size-3.5 text-text-muted" />
            <span>{node.title}</span>
            {node.itemCount > 0 && (
              <span className="text-xs text-text-subtle">({node.itemCount})</span>
            )}
          </span>
        ),
        children: node.children.length > 0 ? buildTreeData(node.children) : undefined
      }))
    }
    return buildTreeData(folderTree)
  }, [folderTree])

  const handleCheck: TreeProps["onCheck"] = (checked) => {
    if (Array.isArray(checked)) {
      setSelectedFolderIds(checked as number[])
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    setIsCreating(true)
    try {
      const created = await createFolder(newFolderName.trim())
      if (created) {
        setNewFolderName("")
        // Auto-select the newly created folder
        setSelectedFolderIds((prev) => [...prev, created.id])
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleSave = async () => {
    if (!conversationId) return
    setIsSaving(true)
    try {
      const existingFolders = getFoldersForConversation(conversationId)
      const existingIds = new Set(existingFolders.map((f) => f.id))
      const selectedSet = new Set(selectedFolderIds)

      // Remove from folders that are no longer selected
      for (const folder of existingFolders) {
        if (!selectedSet.has(folder.id)) {
          await removeConversationFromFolder(conversationId, folder.id)
        }
      }

      // Add to newly selected folders
      for (const folderId of selectedFolderIds) {
        if (!existingIds.has(folderId)) {
          await addConversationToFolder(conversationId, folderId)
        }
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
            "sidepanel:folderPicker.notAvailable",
            "Folder organization is not available on this server"
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

    if (folders.filter((f) => !f.deleted).length === 0) {
      return (
        <div className="space-y-4">
          <Empty
            description={t(
              "sidepanel:folderPicker.noFolders",
              "No folders yet. Create one below."
            )}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
          <div className="flex gap-2">
            <Input
              placeholder={t(
                "sidepanel:folderPicker.newFolderPlaceholder",
                "New folder name"
              )}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onPressEnter={handleCreateFolder}
            />
            <Button
              type="primary"
              icon={<Plus className="size-4" />}
              onClick={handleCreateFolder}
              loading={isCreating}
              disabled={!newFolderName.trim()}
            >
              {t("common:create", "Create")}
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <Tree
          checkable
          defaultExpandAll
          checkedKeys={selectedFolderIds}
          onCheck={handleCheck}
          treeData={treeData}
          className="bg-transparent"
        />
        <div className="border-t border-border pt-4">
          <div className="text-caption text-text-muted mb-2">
            {t("sidepanel:folderPicker.createNew", "Create new folder")}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={t(
                "sidepanel:folderPicker.newFolderPlaceholder",
                "New folder name"
              )}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onPressEnter={handleCreateFolder}
              size="small"
            />
            <Button
              size="small"
              icon={<Plus className="size-3" />}
              onClick={handleCreateFolder}
              loading={isCreating}
              disabled={!newFolderName.trim()}
            >
              {t("common:add", "Add")}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Modal
      open={open}
      title={t("sidepanel:folderPicker.title", "Add to folder")}
      onCancel={onClose}
      onOk={handleSave}
      okText={t("common:save", "Save")}
      cancelText={t("common:cancel", "Cancel")}
      okButtonProps={{ loading: isSaving, disabled: folderApiAvailable === false }}
      destroyOnClose
    >
      {renderContent()}
    </Modal>
  )
}

export default FolderPickerModal

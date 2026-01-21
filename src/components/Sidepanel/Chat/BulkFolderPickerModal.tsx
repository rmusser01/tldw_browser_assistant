import React from "react"
import { Modal, Tree, Empty, Spin, Input, Button, message } from "antd"
import type { TreeProps } from "antd"
import { Folder, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { shallow } from "zustand/shallow"
import { useFolderStore, type FolderTreeNode } from "@/store/folder"

type BulkFolderPickerModalProps = {
  open: boolean
  conversationIds: string[]
  onClose: () => void
  onSuccess?: () => void
}

export const BulkFolderPickerModal: React.FC<BulkFolderPickerModalProps> = ({
  open,
  conversationIds,
  onClose,
  onSuccess
}) => {
  const { t } = useTranslation(["sidepanel", "common"])
  const [selectedFolderIds, setSelectedFolderIds] = React.useState<number[]>([])
  const [newFolderName, setNewFolderName] = React.useState("")
  const [isCreating, setIsCreating] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  const {
    folderTree,
    isLoading,
    folderApiAvailable,
    addConversationToFolder,
    createFolder,
    refreshFromServer
  } = useFolderStore(
    (state) => ({
      folderTree: state.getFolderTree(),
      isLoading: state.isLoading,
      folderApiAvailable: state.folderApiAvailable,
      addConversationToFolder: state.addConversationToFolder,
      createFolder: state.createFolder,
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
      setSelectedFolderIds([])
      setNewFolderName("")
    }
  }, [open])

  const treeData: TreeProps["treeData"] = React.useMemo(() => {
    const buildTreeData = (
      nodes: FolderTreeNode[]
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
      setSelectedFolderIds(checked.map(Number))
      return
    }

    if (checked && typeof checked === "object" && "checked" in checked) {
      setSelectedFolderIds((checked.checked ?? []).map(Number))
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    setIsCreating(true)
    try {
      const created = await createFolder(newFolderName.trim())
      if (created) {
        setNewFolderName("")
        setSelectedFolderIds((prev) => [...prev, created.id])
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleSave = async () => {
    if (conversationIds.length === 0 || selectedFolderIds.length === 0) return
    setIsSaving(true)
    try {
      const tasks = conversationIds.flatMap((conversationId) =>
        selectedFolderIds.map((folderId) => ({
          conversationId,
          folderId
        }))
      )
      const results: PromiseSettledResult<{
        ok: boolean
        conversationId: string
        folderId: number
      }>[] = []
      // Limit concurrent requests to avoid large bursts on bulk apply.
      const maxConcurrentRequests = 12

      for (let i = 0; i < tasks.length; i += maxConcurrentRequests) {
        const chunk = tasks.slice(i, i + maxConcurrentRequests).map(async (task) => {
          const ok = await addConversationToFolder(
            task.conversationId,
            task.folderId
          )
          return { ok, conversationId: task.conversationId, folderId: task.folderId }
        })
        results.push(...(await Promise.allSettled(chunk)))
      }
      const failures = results.filter(
        (result) => result.status === "fulfilled" && !result.value.ok
      ).length +
        results.filter((result) => result.status === "rejected").length

      if (failures > 0) {
        message.error(
          t("sidepanel:multiSelect.folderApplyError", "Some chats could not be added to folders.")
        )
      } else {
        message.success(
          t("sidepanel:multiSelect.folderApplySuccess", "Folders applied to selected chats.")
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

    if (folderTree.length === 0) {
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
      title={t("sidepanel:multiSelect.addToFolder", "Add to folders")}
      onCancel={onClose}
      onOk={handleSave}
      okText={t("common:save", "Save")}
      cancelText={t("common:cancel", "Cancel")}
      okButtonProps={{
        loading: isSaving,
        disabled:
          folderApiAvailable === false ||
          conversationIds.length === 0 ||
          selectedFolderIds.length === 0
      }}
      destroyOnHidden
    >
      {renderContent()}
    </Modal>
  )
}

export default BulkFolderPickerModal

/**
 * FolderPicker Component
 *
 * Modal/dropdown for selecting folders to add an item to.
 * Allows multi-select and creating new folders inline.
 */

import { useState, useMemo } from "react"
import { Modal, Input, Tree, Button, Empty, Divider } from "antd"
import type { TreeDataNode, TreeProps } from "antd"
import { Folder, FolderPlus, Check } from "lucide-react"
import { buildFolderTree, useFolderStore, type FolderTreeNode } from "@/store/folder"
import { useTranslation } from "react-i18next"
import { useAntdMessage } from "@/hooks/useAntdMessage"
import { useShallow } from "zustand/react/shallow"

interface FolderPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (folderIds: number[]) => void
  selectedFolderIds?: number[]
  title?: string
  allowMultiple?: boolean
  showCreateNew?: boolean
}

export const FolderPicker = ({
  open,
  onClose,
  onSelect,
  selectedFolderIds = [],
  title,
  allowMultiple = true,
  showCreateNew = true
}: FolderPickerProps) => {
  const { t } = useTranslation()
  const message = useAntdMessage()
  const {
    folders,
    keywords,
    folderKeywordLinks,
    conversationKeywordLinks,
    createFolder,
    isLoading
  } = useFolderStore(
    useShallow((s) => ({
      folders: s.folders,
      keywords: s.keywords,
      folderKeywordLinks: s.folderKeywordLinks,
      conversationKeywordLinks: s.conversationKeywordLinks,
      createFolder: s.createFolder,
      isLoading: s.isLoading
    }))
  )

  const folderTree = useMemo(
    () => buildFolderTree(folders, keywords, folderKeywordLinks, conversationKeywordLinks),
    [folders, keywords, folderKeywordLinks, conversationKeywordLinks]
  )

  const [selected, setSelected] = useState<number[]>(selectedFolderIds)
  const [newFolderName, setNewFolderName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)

  // Convert to tree data with checkboxes
  const treeData = useMemo((): TreeDataNode[] => {
    const convertNode = (node: FolderTreeNode): TreeDataNode => ({
      key: node.key,
      title: (
        <span className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-text-muted" />
          <span>{node.title}</span>
          {selected.includes(node.key) && (
            <Check className="w-4 h-4 text-success ml-auto" />
          )}
        </span>
      ),
      children: node.children.length > 0 ? node.children.map(convertNode) : undefined
    })

    return folderTree.map(convertNode)
  }, [folderTree, selected])

  // Handle folder selection
  const handleSelect: TreeProps['onSelect'] = (keys, { node }) => {
    const folderId = Number(node.key)
    if (isNaN(folderId)) return

    if (allowMultiple) {
      setSelected(prev =>
        prev.includes(folderId)
          ? prev.filter(id => id !== folderId)
          : [...prev, folderId]
      )
    } else {
      setSelected([folderId])
    }
  }

  // Handle create new folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    setIsCreating(true)
    try {
      const folder = await createFolder(newFolderName.trim())
      if (folder) {
        setSelected(prev => [...prev, folder.id])
        setNewFolderName("")
        setShowNewFolderInput(false)
        message.success(t("common:success", { defaultValue: "Created folder" }))
      } else {
        message.error(t("common:error.createFolder", { defaultValue: "Failed to create folder" }))
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("Failed to create folder from picker:", e)
      message.error(e?.message || t("common:error.createFolder", { defaultValue: "Failed to create folder" }))
    } finally {
      setIsCreating(false)
    }
  }

  // Handle confirm
  const handleConfirm = () => {
    onSelect(selected)
    onClose()
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={title || t("common:selectFolder")}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t("common:cancel")}
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={handleConfirm}
          disabled={selected.length === 0}
        >
          {t("common:confirm")}
        </Button>
      ]}
      width={400}
    >
      <div className="py-2">
        {treeData.length > 0 ? (
          <Tree
            treeData={treeData}
            onSelect={handleSelect}
            selectedKeys={selected}
            defaultExpandAll
            className="folder-picker-tree"
            blockNode
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("common:noFolders")}
          />
        )}

        {showCreateNew && (
          <>
            <Divider className="my-3" />
            {showNewFolderInput ? (
              <div className="flex gap-2">
                <Input
                  placeholder={t("common:folderName")}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onPressEnter={handleCreateFolder}
                  autoFocus
                  disabled={isCreating}
                />
                <Button
                  type="primary"
                  onClick={handleCreateFolder}
                  loading={isCreating}
                  disabled={!newFolderName.trim()}
                >
                  {t("common:create")}
                </Button>
                <Button onClick={() => setShowNewFolderInput(false)}>
                  {t("common:cancel")}
                </Button>
              </div>
            ) : (
              <Button
                icon={<FolderPlus className="w-4 h-4" />}
                onClick={() => setShowNewFolderInput(true)}
                block
                className="flex items-center justify-center gap-2"
              >
                {t("common:newFolder")}
              </Button>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

export default FolderPicker

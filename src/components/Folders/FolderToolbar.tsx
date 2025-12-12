/**
 * FolderToolbar Component
 *
 * Toolbar with actions for folder management:
 * - New Folder button
 * - Expand All / Collapse All
 * - View mode toggle (folders vs date)
 */

import { Button, Tooltip, Dropdown, Input, Modal } from "antd"
import type { MenuProps } from "antd"
import {
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Calendar,
  Folder,
  MoreHorizontal,
  RefreshCw
} from "lucide-react"
import { useFolderStore, useFolderActions, useFolderViewMode, useFolderIsLoading } from "@/store/folder"
import { useTranslation } from "react-i18next"
import { useState } from "react"

interface FolderToolbarProps {
  compact?: boolean
}

export const FolderToolbar = ({ compact = false }: FolderToolbarProps) => {
  const { t } = useTranslation()
  const viewMode = useFolderViewMode()
  const isLoading = useFolderIsLoading()
  const {
    setViewMode,
    expandAllFolders,
    collapseAllFolders,
    refreshFromServer,
    createFolder
  } = useFolderActions()

  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  // Handle create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    setIsCreating(true)
    try {
      await createFolder(newFolderName.trim())
      setNewFolderName("")
      setNewFolderModalOpen(false)
    } finally {
      setIsCreating(false)
    }
  }

  // More menu items
  const moreMenuItems: MenuProps['items'] = [
    {
      key: 'expandAll',
      icon: <ChevronDown className="w-4 h-4" />,
      label: t("common:expandAll"),
      onClick: expandAllFolders
    },
    {
      key: 'collapseAll',
      icon: <ChevronRight className="w-4 h-4" />,
      label: t("common:collapseAll"),
      onClick: collapseAllFolders
    },
    { type: 'divider' },
    {
      key: 'refresh',
      icon: <RefreshCw className="w-4 h-4" />,
      label: t("common:refresh"),
      onClick: refreshFromServer
    }
  ]

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <Tooltip title={viewMode === 'folders' ? t("common:dateView") : t("common:folderView")}>
          <Button
            type="text"
            size="small"
            icon={viewMode === 'folders'
              ? <Calendar className="w-4 h-4" />
              : <Folder className="w-4 h-4" />
            }
            onClick={() => setViewMode(viewMode === 'folders' ? 'date' : 'folders')}
          />
        </Tooltip>
        {viewMode === 'folders' && (
          <>
            <Tooltip title={t("common:newFolder")}>
              <Button
                type="text"
                size="small"
                icon={<FolderPlus className="w-4 h-4" />}
                onClick={() => setNewFolderModalOpen(true)}
              />
            </Tooltip>
            <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
              <Button
                type="text"
                size="small"
                icon={<MoreHorizontal className="w-4 h-4" />}
              />
            </Dropdown>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between px-2 py-1 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1">
          <Button
            type={viewMode === 'folders' ? 'primary' : 'text'}
            size="small"
            icon={<Folder className="w-4 h-4" />}
            onClick={() => setViewMode('folders')}
            className="flex items-center gap-1"
          >
            {t("common:folders")}
          </Button>
          <Button
            type={viewMode === 'date' ? 'primary' : 'text'}
            size="small"
            icon={<Calendar className="w-4 h-4" />}
            onClick={() => setViewMode('date')}
            className="flex items-center gap-1"
          >
            {t("common:date")}
          </Button>
        </div>

        {viewMode === 'folders' && (
          <div className="flex items-center gap-1">
            <Tooltip title={t("common:newFolder")}>
              <Button
                type="text"
                size="small"
                icon={<FolderPlus className="w-4 h-4" />}
                onClick={() => setNewFolderModalOpen(true)}
              />
            </Tooltip>
            <Tooltip title={t("common:expandAll")}>
              <Button
                type="text"
                size="small"
                icon={<ChevronDown className="w-4 h-4" />}
                onClick={expandAllFolders}
              />
            </Tooltip>
            <Tooltip title={t("common:collapseAll")}>
              <Button
                type="text"
                size="small"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={collapseAllFolders}
              />
            </Tooltip>
            <Tooltip title={t("common:refresh")}>
              <Button
                type="text"
                size="small"
                icon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
                onClick={refreshFromServer}
                loading={isLoading}
              />
            </Tooltip>
          </div>
        )}
      </div>

      {/* New Folder Modal */}
      <Modal
        open={newFolderModalOpen}
        onCancel={() => {
          setNewFolderModalOpen(false)
          setNewFolderName("")
        }}
        title={t("common:newFolder")}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setNewFolderModalOpen(false)
              setNewFolderName("")
            }}
          >
            {t("common:cancel")}
          </Button>,
          <Button
            key="create"
            type="primary"
            onClick={handleCreateFolder}
            loading={isCreating}
            disabled={!newFolderName.trim()}
          >
            {t("common:create")}
          </Button>
        ]}
        width={350}
      >
        <Input
          placeholder={t("common:folderName")}
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onPressEnter={handleCreateFolder}
          autoFocus
        />
      </Modal>
    </>
  )
}

export default FolderToolbar

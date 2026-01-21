import React from "react"
import { Dropdown, Input, Modal } from "antd"
import type { MenuProps } from "antd"
import {
  Pencil,
  Pin,
  PinOff,
  FolderPlus,
  Circle,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  FileJson,
  FileText,
  Trash2
} from "lucide-react"
import { useTranslation } from "react-i18next"
import type { SidepanelChatTab } from "@/store/sidepanel-chat-tabs"

export type ConversationStatus =
  | "in_progress"
  | "resolved"
  | "backlog"
  | "non_viable"
  | null

export type ConversationContextMenuProps = {
  tab: SidepanelChatTab
  children: React.ReactNode
  onRename: (tabId: string, newLabel: string) => void
  onTogglePin: (tabId: string) => void
  onSetStatus: (tabId: string, status: ConversationStatus) => void
  onAddToFolder: (tabId: string) => void
  onExportJSON: (tabId: string) => void
  onExportMarkdown: (tabId: string) => void
  onDelete: (tabId: string) => void
  currentStatus?: ConversationStatus
}

export const ConversationContextMenu: React.FC<
  ConversationContextMenuProps
> = ({
  tab,
  children,
  onRename,
  onTogglePin,
  onSetStatus,
  onAddToFolder,
  onExportJSON,
  onExportMarkdown,
  onDelete,
  currentStatus
}) => {
  const { t } = useTranslation(["common", "sidepanel"])
  const [renameModalOpen, setRenameModalOpen] = React.useState(false)
  const [renameValue, setRenameValue] = React.useState(tab.label)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)

  const handleRenameSubmit = () => {
    if (renameValue.trim()) {
      onRename(tab.id, renameValue.trim())
    }
    setRenameModalOpen(false)
  }

  const handleDeleteConfirm = () => {
    onDelete(tab.id)
    setDeleteConfirmOpen(false)
  }

  const statusItems: MenuProps["items"] = [
    {
      key: "status-in_progress",
      icon: <Circle className="size-3 text-blue-500" />,
      label: t("sidepanel:contextMenu.statusInProgress", "In Progress"),
      onClick: () => onSetStatus(tab.id, "in_progress")
    },
    {
      key: "status-resolved",
      icon: <CheckCircle2 className="size-3 text-green-500" />,
      label: t("sidepanel:contextMenu.statusResolved", "Resolved"),
      onClick: () => onSetStatus(tab.id, "resolved")
    },
    {
      key: "status-backlog",
      icon: <Clock className="size-3 text-gray-500" />,
      label: t("sidepanel:contextMenu.statusBacklog", "Backlog"),
      onClick: () => onSetStatus(tab.id, "backlog")
    },
    {
      key: "status-non_viable",
      icon: <XCircle className="size-3 text-red-500" />,
      label: t("sidepanel:contextMenu.statusNonViable", "Non-viable"),
      onClick: () => onSetStatus(tab.id, "non_viable")
    },
    { type: "divider" },
    {
      key: "status-clear",
      label: t("sidepanel:contextMenu.statusClear", "Clear status"),
      onClick: () => onSetStatus(tab.id, null)
    }
  ]

  const exportItems: MenuProps["items"] = [
    {
      key: "export-json",
      icon: <FileJson className="size-3" />,
      label: t("sidepanel:contextMenu.exportJSON", "Export as JSON"),
      onClick: () => onExportJSON(tab.id)
    },
    {
      key: "export-md",
      icon: <FileText className="size-3" />,
      label: t("sidepanel:contextMenu.exportMarkdown", "Export as Markdown"),
      onClick: () => onExportMarkdown(tab.id)
    }
  ]

  const menuItems: MenuProps["items"] = [
    {
      key: "rename",
      icon: <Pencil className="size-3" />,
      label: t("sidepanel:contextMenu.rename", "Rename"),
      onClick: () => {
        setRenameValue(tab.label)
        setRenameModalOpen(true)
      }
    },
    {
      key: "pin",
      icon: tab.pinned ? (
        <PinOff className="size-3" />
      ) : (
        <Pin className="size-3" />
      ),
      label: tab.pinned
        ? t("common:unpin", "Unpin")
        : t("common:pin", "Pin"),
      onClick: () => onTogglePin(tab.id)
    },
    {
      key: "folder",
      icon: <FolderPlus className="size-3" />,
      label: t("sidepanel:contextMenu.addToFolder", "Add to folder..."),
      onClick: () => onAddToFolder(tab.id)
    },
    { type: "divider" },
    {
      key: "status",
      label: t("sidepanel:contextMenu.status", "Status"),
      children: statusItems
    },
    { type: "divider" },
    {
      key: "export",
      icon: <Download className="size-3" />,
      label: t("sidepanel:contextMenu.export", "Export"),
      children: exportItems
    },
    { type: "divider" },
    {
      key: "delete",
      icon: <Trash2 className="size-3" />,
      label: t("common:delete", "Delete"),
      danger: true,
      onClick: () => setDeleteConfirmOpen(true)
    }
  ]

  return (
    <>
      <Dropdown
        menu={{ items: menuItems }}
        trigger={["contextMenu"]}
        destroyPopupOnHide
      >
        {children}
      </Dropdown>

      {/* Rename Modal */}
      <Modal
        open={renameModalOpen}
        title={t("sidepanel:contextMenu.renameTitle", "Rename conversation")}
        onOk={handleRenameSubmit}
        onCancel={() => setRenameModalOpen(false)}
        okText={t("common:save", "Save")}
        cancelText={t("common:cancel", "Cancel")}
        destroyOnHidden
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={handleRenameSubmit}
          autoFocus
          placeholder={t(
            "sidepanel:contextMenu.renamePlaceholder",
            "Enter conversation name"
          )}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteConfirmOpen}
        title={t("sidepanel:contextMenu.deleteTitle", "Delete conversation")}
        onOk={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmOpen(false)}
        okText={t("common:delete", "Delete")}
        cancelText={t("common:cancel", "Cancel")}
        okButtonProps={{ danger: true }}
        destroyOnHidden
      >
        <p>
          {t(
            "sidepanel:contextMenu.deleteConfirm",
            "Are you sure you want to delete this conversation? This action cannot be undone."
          )}
        </p>
      </Modal>
    </>
  )
}

export default ConversationContextMenu

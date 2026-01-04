import { Dropdown, MenuProps, Tooltip } from "antd"
import { MoreHorizontal, Pen, MessageCircle, CopyIcon, Trash2 } from "lucide-react"
import React from "react"
import { useTranslation } from "react-i18next"

interface PromptActionsMenuProps {
  promptId: string
  disabled?: boolean
  onEdit: () => void
  onDuplicate: () => void
  onUseInChat: () => void
  onDelete: () => void
}

export const PromptActionsMenu: React.FC<PromptActionsMenuProps> = ({
  promptId,
  disabled = false,
  onEdit,
  onDuplicate,
  onUseInChat,
  onDelete
}) => {
  const { t } = useTranslation(["settings", "common", "option"])

  const overflowItems: MenuProps["items"] = [
    {
      key: "duplicate",
      label: t("managePrompts.tooltip.duplicate", { defaultValue: "Duplicate" }),
      icon: <CopyIcon className="size-4" />,
      disabled,
      onClick: onDuplicate
    },
    {
      type: "divider"
    },
    {
      key: "delete",
      label: t("common:delete", { defaultValue: "Delete" }),
      icon: <Trash2 className="size-4" />,
      danger: true,
      disabled,
      onClick: onDelete
    }
  ]

  return (
    <div className="flex items-center gap-2">
      <Tooltip title={t("managePrompts.tooltip.edit")}>
        <button
          type="button"
          aria-label={t("managePrompts.tooltip.edit")}
          data-testid={`prompt-edit-${promptId}`}
          onClick={onEdit}
          disabled={disabled}
          className="inline-flex items-center justify-center p-1 rounded text-text-muted hover:text-text hover:bg-surface2 disabled:opacity-50 transition-colors"
        >
          <Pen className="size-4" />
        </button>
      </Tooltip>

      <Tooltip
        title={t("option:promptInsert.useInChatTooltip", {
          defaultValue: "Open chat and insert this prompt into the composer."
        })}
      >
        <button
          type="button"
          aria-label={t("option:promptInsert.useInChat", { defaultValue: "Use in chat" })}
          data-testid={`prompt-use-${promptId}`}
          onClick={onUseInChat}
          disabled={disabled}
          className="inline-flex items-center justify-center p-1 rounded text-text-muted hover:text-text hover:bg-surface2 disabled:opacity-50 transition-colors"
        >
          <MessageCircle className="size-4" />
        </button>
      </Tooltip>

      <Dropdown
        menu={{ items: overflowItems }}
        trigger={["click"]}
        placement="bottomRight"
      >
        <button
          type="button"
          aria-label={t("common:moreActions", { defaultValue: "More actions" })}
          data-testid={`prompt-more-${promptId}`}
          disabled={disabled}
          className="inline-flex items-center justify-center p-1 rounded text-text-muted hover:text-text hover:bg-surface2 disabled:opacity-50 transition-colors"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </Dropdown>
    </div>
  )
}

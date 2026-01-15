import React, { useMemo, useState } from "react"
import { Button, Empty, Form, Input, Modal, Popconfirm, Select, Skeleton, Tree, message } from "antd"
import { FolderPlus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { createWatchlistGroup, deleteWatchlistGroup } from "@/services/watchlists"
import type { WatchlistGroup } from "@/types/watchlists"

interface GroupsTreeProps {
  groups: WatchlistGroup[]
  selectedGroupId: number | null
  loading: boolean
  onSelect: (groupId: number | null) => void
  onRefresh: () => void
}

type TreeNode = {
  title: string
  key: string
  children?: TreeNode[]
}

const buildTree = (groups: WatchlistGroup[]): TreeNode[] => {
  const nodes = new Map<number, TreeNode>()
  const roots: TreeNode[] = []

  groups.forEach((group) => {
    nodes.set(group.id, { title: group.name, key: String(group.id), children: [] })
  })

  groups.forEach((group) => {
    const node = nodes.get(group.id)
    if (!node) return
    if (group.parent_group_id && nodes.has(group.parent_group_id)) {
      const parent = nodes.get(group.parent_group_id)
      if (parent) parent.children?.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
}

export const GroupsTree: React.FC<GroupsTreeProps> = ({
  groups,
  selectedGroupId,
  loading,
  onSelect,
  onRefresh
}) => {
  const { t } = useTranslation(["watchlists", "common"])
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form] = Form.useForm()

  const treeData = useMemo(() => buildTree(groups), [groups])

  const handleCreate = async () => {
    try {
      const values = await form.validateFields()
      setCreating(true)
      await createWatchlistGroup({
        name: values.name,
        description: values.description || undefined,
        parent_group_id: values.parent_group_id || undefined
      })
      message.success(t("watchlists:groups.created", "Group created"))
      setCreateOpen(false)
      form.resetFields()
      onRefresh()
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return
      console.error("Failed to create group:", err)
      message.error(t("watchlists:groups.createError", "Failed to create group"))
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedGroupId) return
    try {
      await deleteWatchlistGroup(selectedGroupId)
      message.success(t("watchlists:groups.deleted", "Group deleted"))
      onSelect(null)
      onRefresh()
    } catch (err) {
      console.error("Failed to delete group:", err)
      message.error(t("watchlists:groups.deleteError", "Failed to delete group"))
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          {t("watchlists:groups.title", "Groups")}
        </div>
        <Button
          size="small"
          type="text"
          icon={<FolderPlus className="h-4 w-4" />}
          onClick={() => setCreateOpen(true)}
        />
      </div>

      <div className="flex items-center justify-between">
        <Button
          size="small"
          onClick={() => onSelect(null)}
          disabled={!selectedGroupId}
        >
          {t("watchlists:groups.all", "All Sources")}
        </Button>
        {selectedGroupId && (
          <Popconfirm
            title={t("watchlists:groups.deleteConfirm", "Delete this group?")}
            onConfirm={handleDelete}
            okText={t("common:yes", "Yes")}
            cancelText={t("common:no", "No")}
          >
            <Button size="small" danger icon={<Trash2 className="h-3.5 w-3.5" />}>
              {t("common:delete", "Delete")}
            </Button>
          </Popconfirm>
        )}
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : treeData.length === 0 ? (
        <Empty
          description={t("watchlists:groups.empty", "No groups yet")}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Tree
          treeData={treeData}
          selectedKeys={selectedGroupId ? [String(selectedGroupId)] : []}
          onSelect={(keys) => {
            const next = keys.length ? Number(keys[0]) : null
            onSelect(Number.isNaN(next as number) ? null : next)
          }}
          showLine
        />
      )}

      <Modal
        title={t("watchlists:groups.create", "Create Group")}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText={t("common:create", "Create")}
        cancelText={t("common:cancel", "Cancel")}
        confirmLoading={creating}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label={t("watchlists:groups.fields.name", "Name")}
            rules={[
              {
                required: true,
                message: t("watchlists:groups.nameRequired", "Please enter a name")
              }
            ]}
          >
            <Input placeholder={t("watchlists:groups.namePlaceholder", "News Sources")} />
          </Form.Item>
          <Form.Item
            name="description"
            label={t("watchlists:groups.fields.description", "Description")}
          >
            <Input placeholder={t("watchlists:groups.descriptionPlaceholder", "Optional description")} />
          </Form.Item>
          <Form.Item
            name="parent_group_id"
            label={t("watchlists:groups.fields.parent", "Parent Group")}
          >
            <Select
              allowClear
              placeholder={t("watchlists:groups.none", "None")}
              options={groups.map((group) => ({
                label: group.name,
                value: group.id
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

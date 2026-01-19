import React, { useState } from "react"
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Popconfirm,
  Empty,
  Input,
  message
} from "antd"
import { useTranslation } from "react-i18next"
import {
  Plus,
  Trash2,
  Copy,
  FolderOpen,
  Clock,
  CheckCircle,
  Edit2,
  Search
} from "lucide-react"
import { useAudiobookProjects, useCurrentProject } from "@/hooks/useAudiobookProjects"
import type { AudiobookProject } from "@/db/dexie/types"

const { Text, Title } = Typography

type ProjectListViewProps = {
  onOpenProject?: (projectId: string) => void
  onCreateNew?: () => void
}

export const ProjectListView: React.FC<ProjectListViewProps> = ({
  onOpenProject,
  onCreateNew
}) => {
  const { t } = useTranslation(["audiobook", "common"])
  const [searchQuery, setSearchQuery] = useState("")

  const {
    projects,
    isLoading,
    deleteProject,
    isDeleting,
    duplicateProject,
    isDuplicating
  } = useAudiobookProjects()

  const { loadProject, createNewProject } = useCurrentProject()

  const filteredProjects = React.useMemo(() => {
    if (!searchQuery.trim()) return projects
    const query = searchQuery.toLowerCase()
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.author.toLowerCase().includes(query)
    )
  }, [projects, searchQuery])

  const handleOpenProject = async (projectId: string) => {
    const success = await loadProject(projectId)
    if (success) {
      onOpenProject?.(projectId)
    } else {
      message.error(t("audiobook:projects.loadError", "Failed to load project"))
    }
  }

  const handleCreateNew = async () => {
    const id = await createNewProject()
    onCreateNew?.()
  }

  const handleDuplicate = async (projectId: string) => {
    const newId = await duplicateProject({ id: projectId })
    if (newId) {
      message.success(t("audiobook:projects.duplicated", "Project duplicated"))
    }
  }

  const handleDelete = async (projectId: string) => {
    await deleteProject(projectId)
    message.success(t("audiobook:projects.deleted", "Project deleted"))
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "-"
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const getStatusTag = (status: AudiobookProject["status"]) => {
    switch (status) {
      case "completed":
        return (
          <Tag color="success" icon={<CheckCircle className="h-3 w-3" />}>
            {t("audiobook:projects.statusCompleted", "Completed")}
          </Tag>
        )
      case "in_progress":
        return (
          <Tag color="processing" icon={<Clock className="h-3 w-3" />}>
            {t("audiobook:projects.statusInProgress", "In Progress")}
          </Tag>
        )
      default:
        return (
          <Tag color="default" icon={<Edit2 className="h-3 w-3" />}>
            {t("audiobook:projects.statusDraft", "Draft")}
          </Tag>
        )
    }
  }

  const columns = [
    {
      title: t("audiobook:projects.columnTitle", "Title"),
      dataIndex: "title",
      key: "title",
      render: (title: string, record: AudiobookProject) => (
        <div>
          <Text strong className="block">
            {title}
          </Text>
          {record.author && (
            <Text type="secondary" className="text-xs">
              {t("audiobook:projects.by", "by")} {record.author}
            </Text>
          )}
        </div>
      )
    },
    {
      title: t("audiobook:projects.columnStatus", "Status"),
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status: AudiobookProject["status"]) => getStatusTag(status)
    },
    {
      title: t("audiobook:projects.columnChapters", "Chapters"),
      dataIndex: "chapters",
      key: "chapters",
      width: 100,
      render: (chapters: AudiobookProject["chapters"]) => chapters.length
    },
    {
      title: t("audiobook:projects.columnDuration", "Duration"),
      dataIndex: "totalDuration",
      key: "duration",
      width: 100,
      render: (duration?: number) => formatDuration(duration)
    },
    {
      title: t("audiobook:projects.columnModified", "Modified"),
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      render: (timestamp: number) => formatDate(timestamp)
    },
    {
      title: t("audiobook:projects.columnActions", "Actions"),
      key: "actions",
      width: 150,
      render: (_: any, record: AudiobookProject) => (
        <Space size="small">
          <Button
            size="small"
            type="primary"
            icon={<FolderOpen className="h-3 w-3" />}
            onClick={() => handleOpenProject(record.id)}
          >
            {t("audiobook:projects.open", "Open")}
          </Button>
          <Button
            size="small"
            icon={<Copy className="h-3 w-3" />}
            onClick={() => handleDuplicate(record.id)}
            loading={isDuplicating}
          />
          <Popconfirm
            title={t("audiobook:projects.deleteConfirm", "Delete this project?")}
            description={t(
              "audiobook:projects.deleteConfirmDesc",
              "This will permanently delete the project and all its audio."
            )}
            onConfirm={() => handleDelete(record.id)}
            okText={t("common:confirm", "Confirm")}
            cancelText={t("common:cancel", "Cancel")}
          >
            <Button
              size="small"
              danger
              icon={<Trash2 className="h-3 w-3" />}
              loading={isDeleting}
            />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <Title level={5} className="!mb-1">
            {t("audiobook:projects.title", "My Audiobook Projects")}
          </Title>
          <Text type="secondary" className="text-sm">
            {t(
              "audiobook:projects.description",
              "Manage your saved audiobook projects"
            )}
          </Text>
        </div>
        <Space>
          <Input
            placeholder={t("audiobook:projects.search", "Search projects...")}
            prefix={<Search className="h-4 w-4 text-text-muted" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={handleCreateNew}
          >
            {t("audiobook:projects.createNew", "New Project")}
          </Button>
        </Space>
      </div>

      {filteredProjects.length === 0 && !isLoading ? (
        <Empty
          description={
            <Text type="secondary">
              {searchQuery
                ? t("audiobook:projects.noResults", "No projects found")
                : t(
                    "audiobook:projects.empty",
                    "No projects yet. Create your first audiobook project!"
                  )}
            </Text>
          }
        >
          {!searchQuery && (
            <Button type="primary" onClick={handleCreateNew}>
              {t("audiobook:projects.createFirst", "Create First Project")}
            </Button>
          )}
        </Empty>
      ) : (
        <Table
          dataSource={filteredProjects}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            hideOnSinglePage: true
          }}
        />
      )}
    </Card>
  )
}

export default ProjectListView

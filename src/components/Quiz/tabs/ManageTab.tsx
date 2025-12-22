import React from "react"
import {
  Button,
  Card,
  Empty,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  message
} from "antd"
import { useTranslation } from "react-i18next"
import {
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  SearchOutlined
} from "@ant-design/icons"
import { useQuizzesQuery, useDeleteQuizMutation } from "../hooks"
import type { Quiz } from "@/services/quizzes"

interface ManageTabProps {
  onNavigateToCreate: () => void
  onNavigateToGenerate: () => void
}

export const ManageTab: React.FC<ManageTabProps> = ({
  onNavigateToCreate,
  onNavigateToGenerate
}) => {
  const { t } = useTranslation(["option", "common"])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [messageApi, contextHolder] = message.useMessage()

  const { data, isLoading, refetch } = useQuizzesQuery({ q: searchQuery || undefined })
  const deleteMutation = useDeleteQuizMutation()

  const quizzes = data?.items ?? []

  const handleDelete = async (quiz: Quiz) => {
    try {
      await deleteMutation.mutateAsync({ quizId: quiz.id, version: quiz.version })
      messageApi.success(
        t("option:quiz.deleteSuccess", { defaultValue: "Quiz deleted successfully" })
      )
      refetch()
    } catch (error) {
      messageApi.error(
        t("option:quiz.deleteError", { defaultValue: "Failed to delete quiz" })
      )
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {contextHolder}

      <div className="flex justify-between items-center">
        <Input
          placeholder={t("option:quiz.searchQuizzes", { defaultValue: "Search quizzes..." })}
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs"
          allowClear
        />
        <Space>
          <Button onClick={onNavigateToGenerate}>
            {t("option:quiz.generateNew", { defaultValue: "Generate New" })}
          </Button>
          <Button type="primary" onClick={onNavigateToCreate}>
            {t("option:quiz.createNew", { defaultValue: "Create New" })}
          </Button>
        </Space>
      </div>

      {quizzes.length === 0 ? (
        <Empty
          description={
            searchQuery
              ? t("option:quiz.noSearchResults", { defaultValue: "No quizzes match your search" })
              : t("option:quiz.noQuizzesYet", { defaultValue: "No quizzes yet" })
          }
        >
          {!searchQuery && (
            <Space>
              <Button type="primary" onClick={onNavigateToGenerate}>
                {t("option:quiz.generateFromMedia", { defaultValue: "Generate from Media" })}
              </Button>
              <Button onClick={onNavigateToCreate}>
                {t("option:quiz.createManually", { defaultValue: "Create Manually" })}
              </Button>
            </Space>
          )}
        </Empty>
      ) : (
        <List
          dataSource={quizzes}
          renderItem={(quiz) => (
            <List.Item
              actions={[
                <Button
                  key="start"
                  type="link"
                  icon={<PlayCircleOutlined />}
                  onClick={() => {
                    // TODO: Navigate to take quiz
                    console.log("Start quiz:", quiz.id)
                  }}
                >
                  {t("option:quiz.start", { defaultValue: "Start" })}
                </Button>,
                <Button
                  key="edit"
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => {
                    // TODO: Edit quiz
                    console.log("Edit quiz:", quiz.id)
                  }}
                >
                  {t("option:quiz.edit", { defaultValue: "Edit" })}
                </Button>,
                <Popconfirm
                  key="delete"
                  title={t("option:quiz.deleteConfirm", { defaultValue: "Delete this quiz?" })}
                  description={t("option:quiz.deleteConfirmDesc", {
                    defaultValue: "This action cannot be undone."
                  })}
                  onConfirm={() => handleDelete(quiz)}
                  okText={t("common:yes", { defaultValue: "Yes" })}
                  cancelText={t("common:no", { defaultValue: "No" })}
                >
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    loading={deleteMutation.isPending}
                  >
                    {t("option:quiz.delete", { defaultValue: "Delete" })}
                  </Button>
                </Popconfirm>
              ]}
            >
              <List.Item.Meta
                title={
                  <span className="font-medium">
                    {quiz.name}
                  </span>
                }
                description={
                  <div className="space-y-1">
                    {quiz.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                        {quiz.description}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Tag icon={<QuestionCircleOutlined />}>
                        {quiz.total_questions}{" "}
                        {t("option:quiz.questions", { defaultValue: "questions" })}
                      </Tag>
                      {quiz.passing_score && (
                        <Tag color="blue">
                          {t("option:quiz.passingScoreLabel", { defaultValue: "Pass" })}: {quiz.passing_score}%
                        </Tag>
                      )}
                      {quiz.media_id && (
                        <Tag color="green">
                          {t("option:quiz.fromMedia", { defaultValue: "From Media" })}
                        </Tag>
                      )}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  )
}

export default ManageTab

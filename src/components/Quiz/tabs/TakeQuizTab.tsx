import React from "react"
import { Button, Card, Empty, List, Spin, Tag } from "antd"
import { useTranslation } from "react-i18next"
import { PlayCircleOutlined, ClockCircleOutlined, QuestionCircleOutlined } from "@ant-design/icons"
import { useQuizzesQuery } from "../hooks"

interface TakeQuizTabProps {
  onNavigateToGenerate: () => void
  onNavigateToCreate: () => void
}

export const TakeQuizTab: React.FC<TakeQuizTabProps> = ({
  onNavigateToGenerate,
  onNavigateToCreate
}) => {
  const { t } = useTranslation(["option", "common"])
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(12)
  const offset = (page - 1) * pageSize

  const { data, isLoading } = useQuizzesQuery({ limit: pageSize, offset })

  const quizzes = data?.items ?? []
  const total = data?.count ?? 0

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spin size="large" />
      </div>
    )
  }

  if (quizzes.length === 0) {
    return (
      <Empty
        description={
          <div className="space-y-2">
            <p className="text-gray-600 dark:text-gray-400">
              {t("option:quiz.empty.noQuizzes", { defaultValue: "No quizzes yet" })}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {t("option:quiz.empty.createFirst", {
                defaultValue: "Create your first quiz or generate one from media"
              })}
            </p>
          </div>
        }
      >
        <div className="flex gap-2 justify-center">
          <Button type="primary" onClick={onNavigateToGenerate}>
            {t("option:quiz.generateFromMedia", { defaultValue: "Generate from Media" })}
          </Button>
          <Button onClick={onNavigateToCreate}>
            {t("option:quiz.createManually", { defaultValue: "Create Manually" })}
          </Button>
        </div>
      </Empty>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {t("option:quiz.selectQuiz", { defaultValue: "Select a quiz to begin" })}
      </div>

      <List
        grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 4 }}
        dataSource={quizzes}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          locale: {
            items_per_page: t("option:quiz.itemsPerPage", { defaultValue: "items/page" })
          },
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage)
            if (nextPageSize && nextPageSize !== pageSize) {
              setPageSize(nextPageSize)
              setPage(1)
            }
          }
        }}
        renderItem={(quiz) => (
          <List.Item>
            <Card
              hoverable
              className="h-full"
              actions={[
                <Button
                  key="start"
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => {
                    // TODO: Start quiz
                    console.log("Start quiz:", quiz.id)
                  }}
                >
                  {t("option:quiz.startQuiz", { defaultValue: "Start Quiz" })}
                </Button>
              ]}
            >
              <Card.Meta
                title={quiz.name}
                description={
                  <div className="space-y-2">
                    {quiz.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {quiz.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Tag icon={<QuestionCircleOutlined />}>
                        {quiz.total_questions}{" "}
                        {t("option:quiz.questions", { defaultValue: "questions" })}
                      </Tag>
                      {quiz.time_limit_seconds && (
                        <Tag icon={<ClockCircleOutlined />}>
                          {Math.floor(quiz.time_limit_seconds / 60)}{" "}
                          {t("option:quiz.minutes", { defaultValue: "min" })}
                        </Tag>
                      )}
                    </div>
                  </div>
                }
              />
            </Card>
          </List.Item>
        )}
      />
    </div>
  )
}

export default TakeQuizTab

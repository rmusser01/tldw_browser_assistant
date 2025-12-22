import React from "react"
import {
  Card,
  Empty,
  List,
  Progress,
  Spin,
  Statistic,
  Tag,
  Typography
} from "antd"
import { useTranslation } from "react-i18next"
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  TrophyOutlined
} from "@ant-design/icons"
import { useAttemptsQuery, useQuizzesQuery } from "../hooks"

const { Text } = Typography

export const ResultsTab: React.FC = () => {
  const { t } = useTranslation(["option", "common"])

  const { data: attemptsData, isLoading: attemptsLoading } = useAttemptsQuery()
  const { data: quizzesData, isLoading: quizzesLoading } = useQuizzesQuery()

  const attempts = attemptsData?.items ?? []
  const quizzes = quizzesData?.items ?? []

  const quizMap = React.useMemo(() => {
    const map = new Map<number, string>()
    quizzes.forEach((q) => map.set(q.id, q.name))
    return map
  }, [quizzes])

  const isLoading = attemptsLoading || quizzesLoading

  // Calculate stats
  const stats = React.useMemo(() => {
    if (attempts.length === 0) return null

    const completedAttempts = attempts.filter((a) => a.completed_at)
    const totalScore = completedAttempts.reduce((sum, a) => sum + (a.score ?? 0), 0)
    const totalPossible = completedAttempts.reduce((sum, a) => sum + a.total_possible, 0)
    const avgScore = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0

    const totalTime = completedAttempts.reduce((sum, a) => sum + (a.time_spent_seconds ?? 0), 0)
    const avgTime = completedAttempts.length > 0 ? Math.round(totalTime / completedAttempts.length) : 0

    return {
      totalAttempts: completedAttempts.length,
      avgScore,
      avgTime,
      uniqueQuizzes: new Set(completedAttempts.map((a) => a.quiz_id)).size
    }
  }, [attempts])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spin size="large" />
      </div>
    )
  }

  if (attempts.length === 0) {
    return (
      <Empty
        description={
          <div className="space-y-2">
            <p className="text-gray-600 dark:text-gray-400">
              {t("option:quiz.noAttempts", { defaultValue: "No quiz attempts yet" })}
            </p>
            <p className="text-sm text-gray-500">
              {t("option:quiz.noAttemptsHint", {
                defaultValue: "Complete a quiz to see your results here"
              })}
            </p>
          </div>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats summary */}
      {stats && (
        <Card size="small">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Statistic
              title={t("option:quiz.totalAttempts", { defaultValue: "Total Attempts" })}
              value={stats.totalAttempts}
              prefix={<TrophyOutlined />}
            />
            <Statistic
              title={t("option:quiz.avgScore", { defaultValue: "Average Score" })}
              value={stats.avgScore}
              suffix="%"
              valueStyle={{ color: stats.avgScore >= 70 ? "#52c41a" : stats.avgScore >= 50 ? "#faad14" : "#ff4d4f" }}
            />
            <Statistic
              title={t("option:quiz.avgTime", { defaultValue: "Average Time" })}
              value={formatTime(stats.avgTime)}
              prefix={<ClockCircleOutlined />}
            />
            <Statistic
              title={t("option:quiz.uniqueQuizzes", { defaultValue: "Quizzes Taken" })}
              value={stats.uniqueQuizzes}
            />
          </div>
        </Card>
      )}

      {/* Attempt history */}
      <div>
        <h3 className="text-lg font-medium mb-4">
          {t("option:quiz.attemptHistory", { defaultValue: "Attempt History" })}
        </h3>

        <List
          dataSource={attempts}
          renderItem={(attempt) => {
            const quizName = quizMap.get(attempt.quiz_id) || `Quiz #${attempt.quiz_id}`
            const score = attempt.score ?? 0
            const total = attempt.total_possible
            const percentage = total > 0 ? Math.round((score / total) * 100) : 0
            const isPassing = percentage >= 70

            return (
              <List.Item>
                <div className="w-full">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <Text strong>{quizName}</Text>
                      <div className="text-sm text-gray-500">
                        {attempt.completed_at
                          ? formatDate(attempt.completed_at)
                          : t("option:quiz.inProgress", { defaultValue: "In progress" })}
                      </div>
                    </div>
                    <div className="text-right">
                      {attempt.completed_at ? (
                        <Tag
                          color={isPassing ? "success" : "error"}
                          icon={isPassing ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                        >
                          {score}/{total} ({percentage}%)
                        </Tag>
                      ) : (
                        <Tag color="processing">
                          {t("option:quiz.incomplete", { defaultValue: "Incomplete" })}
                        </Tag>
                      )}
                    </div>
                  </div>

                  {attempt.completed_at && (
                    <div className="flex items-center gap-4">
                      <Progress
                        percent={percentage}
                        size="small"
                        strokeColor={isPassing ? "#52c41a" : percentage >= 50 ? "#faad14" : "#ff4d4f"}
                        className="flex-1"
                      />
                      {attempt.time_spent_seconds && (
                        <Text type="secondary" className="text-sm whitespace-nowrap">
                          <ClockCircleOutlined className="mr-1" />
                          {formatTime(attempt.time_spent_seconds)}
                        </Text>
                      )}
                    </div>
                  )}
                </div>
              </List.Item>
            )
          }}
        />
      </div>
    </div>
  )
}

export default ResultsTab

import React from "react"
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  List,
  Progress,
  Radio,
  Space,
  Spin,
  Tag,
  Typography,
  message
} from "antd"
import { useTranslation } from "react-i18next"
import { PlayCircleOutlined, ClockCircleOutlined, QuestionCircleOutlined } from "@ant-design/icons"
import { useQuizzesQuery, useQuizQuery, useStartAttemptMutation, useSubmitAttemptMutation } from "../hooks"
import type { AnswerValue, QuestionPublic, QuizAttempt } from "@/services/quizzes"

interface TakeQuizTabProps {
  onNavigateToGenerate: () => void
  onNavigateToCreate: () => void
  startQuizId?: number | null
  onStartHandled?: () => void
}

export const TakeQuizTab: React.FC<TakeQuizTabProps> = ({
  onNavigateToGenerate,
  onNavigateToCreate,
  startQuizId,
  onStartHandled
}) => {
  const { t } = useTranslation(["option", "common"])
  const [messageApi, contextHolder] = message.useMessage()
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(12)
  const [activeQuizId, setActiveQuizId] = React.useState<number | null>(null)
  const [attempt, setAttempt] = React.useState<QuizAttempt | null>(null)
  const [result, setResult] = React.useState<QuizAttempt | null>(null)
  const [questions, setQuestions] = React.useState<QuestionPublic[]>([])
  const [answers, setAnswers] = React.useState<Record<number, AnswerValue>>({})
  const lastAutoStartId = React.useRef<number | null>(null)
  const offset = (page - 1) * pageSize

  const { data, isLoading } = useQuizzesQuery({ limit: pageSize, offset })
  const { data: quizDetails } = useQuizQuery(activeQuizId, { enabled: activeQuizId != null })
  const startAttemptMutation = useStartAttemptMutation()
  const submitAttemptMutation = useSubmitAttemptMutation()

  const quizzes = data?.items ?? []
  const total = data?.count ?? 0

  const resetSession = () => {
    setAttempt(null)
    setResult(null)
    setQuestions([])
    setAnswers({})
    setActiveQuizId(null)
  }

  const handleStart = async (quizId: number) => {
    try {
      setActiveQuizId(quizId)
      setResult(null)
      setAnswers({})
      const newAttempt = await startAttemptMutation.mutateAsync(quizId)
      setAttempt(newAttempt)
      setQuestions(newAttempt.questions ?? [])
    } catch (error) {
      messageApi.error(
        t("option:quiz.startError", { defaultValue: "Failed to start quiz" })
      )
    }
  }

  React.useEffect(() => {
    if (startQuizId == null || lastAutoStartId.current === startQuizId) {
      return
    }
    lastAutoStartId.current = startQuizId
    handleStart(startQuizId)
    onStartHandled?.()
  }, [startQuizId, onStartHandled])

  const updateAnswer = (questionId: number, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const hasAnswer = (questionId: number) => {
    const value = answers[questionId]
    if (value === null || value === undefined) return false
    if (typeof value === "string") return value.trim().length > 0
    return true
  }

  const answeredCount = questions.filter((q) => hasAnswer(q.id)).length
  const progress = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0

  const handleSubmit = async () => {
    if (!attempt) return
    const missing = questions.filter((q) => !hasAnswer(q.id))
    if (missing.length > 0) {
      messageApi.warning(
        t("option:quiz.answerAll", { defaultValue: "Please answer all questions before submitting." })
      )
      return
    }
    try {
      const payload = questions.map((q) => ({
        question_id: q.id,
        user_answer: answers[q.id]
      }))
      const submission = await submitAttemptMutation.mutateAsync({
        attemptId: attempt.id,
        answers: payload
      })
      setResult(submission)
    } catch (error) {
      messageApi.error(
        t("option:quiz.submitError", { defaultValue: "Failed to submit quiz" })
      )
    }
  }

  const renderAnswerInput = (question: QuestionPublic) => {
    if (question.question_type === "multiple_choice") {
      return (
        <Radio.Group
          value={answers[question.id]}
          onChange={(e) => updateAnswer(question.id, e.target.value)}
        >
          <Space direction="vertical">
            {(question.options ?? []).map((option, index) => (
              <Radio key={index} value={index}>
                {option || `${t("option:quiz.option", { defaultValue: "Option" })} ${index + 1}`}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      )
    }
    if (question.question_type === "true_false") {
      return (
        <Radio.Group
          value={answers[question.id]}
          onChange={(e) => updateAnswer(question.id, e.target.value)}
        >
          <Space direction="vertical">
            <Radio value="true">{t("option:quiz.true", { defaultValue: "True" })}</Radio>
            <Radio value="false">{t("option:quiz.false", { defaultValue: "False" })}</Radio>
          </Space>
        </Radio.Group>
      )
    }
    return (
      <Input
        placeholder={t("option:quiz.correctAnswerPlaceholder", {
          defaultValue: "Enter the correct answer..."
        })}
        value={typeof answers[question.id] === "string" ? (answers[question.id] as string) : ""}
        onChange={(e) => updateAnswer(question.id, e.target.value)}
      />
    )
  }

  const renderResults = () => {
    if (!result) return null
    const total = result.total_possible || 0
    const score = result.score ?? 0
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0
    const passingScore = quizDetails?.passing_score ?? 70
    const passed = percentage >= passingScore
    const answerMap = new Map(result.answers.map((a) => [a.question_id, a]))

    return (
      <div className="space-y-4">
        <Alert
          type={passed ? "success" : "warning"}
          message={t("option:quiz.scoreSummary", {
            defaultValue: "Score: {{score}} / {{total}} ({{percent}}%)",
            score,
            total,
            percent: percentage
          })}
          description={
            quizDetails?.passing_score
              ? t("option:quiz.passingScoreLabel", { defaultValue: "Pass" }) +
                `: ${quizDetails.passing_score}%`
              : undefined
          }
          showIcon
        />

        <List
          dataSource={questions}
          renderItem={(question, index) => {
            const answer = answerMap.get(question.id)
            const isCorrect = answer?.is_correct
            const userAnswer = answer?.user_answer
            const correctAnswer = answer?.correct_answer
            const optionFor = (value: AnswerValue | undefined) => {
              if (value == null) return "-"
              if (question.question_type !== "multiple_choice") return String(value)
              const idx = Number(value)
              const options = question.options ?? []
              return options[idx] ?? String(value)
            }

            return (
              <List.Item>
                <div className="w-full space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium">
                      {index + 1}. {question.question_text}
                    </div>
                    <Tag color={isCorrect ? "green" : "red"}>
                      {isCorrect
                        ? t("option:quiz.correct", { defaultValue: "Correct" })
                        : t("option:quiz.incorrect", { defaultValue: "Incorrect" })}
                    </Tag>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {t("option:quiz.yourAnswer", { defaultValue: "Your answer" })}:{" "}
                    <span className="font-medium">{optionFor(userAnswer)}</span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {t("option:quiz.correctAnswerLabel", { defaultValue: "Correct answer" })}:{" "}
                    <span className="font-medium">{optionFor(correctAnswer)}</span>
                  </div>
                  {answer?.explanation && (
                    <Typography.Paragraph className="text-sm text-gray-500 dark:text-gray-400 mb-0">
                      {answer.explanation}
                    </Typography.Paragraph>
                  )}
                </div>
              </List.Item>
            )
          }}
        />

        <Space>
          <Button onClick={resetSession}>
            {t("option:quiz.backToList", { defaultValue: "Back to list" })}
          </Button>
          <Button
            type="primary"
            onClick={() => activeQuizId != null && handleStart(activeQuizId)}
          >
            {t("option:quiz.retake", { defaultValue: "Retake Quiz" })}
          </Button>
        </Space>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spin size="large" />
      </div>
    )
  }

  if (attempt && result) {
    return (
      <div className="space-y-4">
        {contextHolder}
        {renderResults()}
      </div>
    )
  }

  if (attempt && questions.length > 0) {
    return (
      <div className="space-y-4">
        {contextHolder}
        <Card
          title={quizDetails?.name || t("option:quiz.take", { defaultValue: "Take Quiz" })}
          extra={
            <Tag icon={<QuestionCircleOutlined />}>
              {answeredCount}/{questions.length}
            </Tag>
          }
        >
          <div className="space-y-4">
            <Progress percent={progress} />
            <List
              dataSource={questions}
              renderItem={(question, index) => (
                <List.Item>
                  <div className="w-full space-y-2">
                    <div className="font-medium">
                      {index + 1}. {question.question_text}
                    </div>
                    {renderAnswerInput(question)}
                  </div>
                </List.Item>
              )}
            />
            <Space>
              <Button onClick={resetSession}>
                {t("option:quiz.backToList", { defaultValue: "Back to list" })}
              </Button>
              <Button
                type="primary"
                onClick={handleSubmit}
                loading={submitAttemptMutation.isPending}
              >
                {t("common:submit", { defaultValue: "Submit" })}
              </Button>
            </Space>
          </div>
        </Card>
      </div>
    )
  }

  if (quizzes.length === 0) {
    return (
      <>
        {contextHolder}
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
      </>
    )
  }

  return (
    <div className="space-y-4">
      {contextHolder}
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
                    handleStart(quiz.id)
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

import React from "react"
import {
  Button,
  Card,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message
} from "antd"
import { useTranslation } from "react-i18next"
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  SearchOutlined
} from "@ant-design/icons"
import {
  useCreateQuestionMutation,
  useDeleteQuestionMutation,
  useDeleteQuizMutation,
  useQuestionsQuery,
  useQuizzesQuery,
  useUpdateQuestionMutation,
  useUpdateQuizMutation
} from "../hooks"
import type { AnswerValue, Question, QuestionType, Quiz } from "@/services/quizzes"

interface ManageTabProps {
  onNavigateToCreate: () => void
  onNavigateToGenerate: () => void
  onStartQuiz: (quizId: number) => void
}

type QuestionDraft = {
  id?: number
  question_type: QuestionType
  question_text: string
  options: string[]
  correct_answer: AnswerValue
  explanation?: string | null
  points: number
  order_index: number
}

export const ManageTab: React.FC<ManageTabProps> = ({
  onNavigateToCreate,
  onNavigateToGenerate,
  onStartQuiz
}) => {
  const { t } = useTranslation(["option", "common"])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [messageApi, contextHolder] = message.useMessage()
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  const [editingQuiz, setEditingQuiz] = React.useState<Quiz | null>(null)
  const [editModalOpen, setEditModalOpen] = React.useState(false)
  const [questionModalOpen, setQuestionModalOpen] = React.useState(false)
  const [questionDraft, setQuestionDraft] = React.useState<QuestionDraft | null>(null)
  const [isNewQuestion, setIsNewQuestion] = React.useState(false)
  const [questionPage, setQuestionPage] = React.useState(1)
  const [questionPageSize, setQuestionPageSize] = React.useState(5)
  const [editForm] = Form.useForm()

  React.useEffect(() => {
    setPage(1)
  }, [searchQuery])

  const offset = (page - 1) * pageSize
  const { data, isLoading, refetch } = useQuizzesQuery({
    q: searchQuery || undefined,
    limit: pageSize,
    offset
  })
  const deleteMutation = useDeleteQuizMutation()
  const updateQuizMutation = useUpdateQuizMutation()
  const createQuestionMutation = useCreateQuestionMutation()
  const updateQuestionMutation = useUpdateQuestionMutation()
  const deleteQuestionMutation = useDeleteQuestionMutation()

  const questionOffset = (questionPage - 1) * questionPageSize
  const questionsQuery = useQuestionsQuery(
    editingQuiz?.id,
    {
      include_answers: true,
      limit: questionPageSize,
      offset: questionOffset
    },
    { enabled: editModalOpen && !!editingQuiz }
  )

  const quizzes = data?.items ?? []
  const total = data?.count ?? 0
  const questions = (questionsQuery.data?.items ?? []) as Question[]
  const questionTotal = questionsQuery.data?.count ?? 0

  const questionTypeLabel = (questionType: QuestionType) => {
    if (questionType === "multiple_choice") {
      return t("option:quiz.multipleChoice", { defaultValue: "Multiple Choice" })
    }
    if (questionType === "true_false") {
      return t("option:quiz.trueFalse", { defaultValue: "True/False" })
    }
    return t("option:quiz.fillBlank", { defaultValue: "Fill in the Blank" })
  }

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

  React.useEffect(() => {
    if (!editingQuiz) return
    editForm.setFieldsValue({
      name: editingQuiz.name,
      description: editingQuiz.description ?? "",
      timeLimit: editingQuiz.time_limit_seconds
        ? Math.round(editingQuiz.time_limit_seconds / 60)
        : undefined,
      passingScore: editingQuiz.passing_score ?? undefined
    })
    setQuestionPage(1)
  }, [editingQuiz, editForm])

  const openEditModal = (quiz: Quiz) => {
    setEditingQuiz(quiz)
    setEditModalOpen(true)
  }

  const closeEditModal = () => {
    setEditModalOpen(false)
    setEditingQuiz(null)
    setQuestionModalOpen(false)
    setQuestionDraft(null)
    editForm.resetFields()
  }

  const handleSaveQuiz = async () => {
    if (!editingQuiz) return
    try {
      const values = await editForm.validateFields()
      await updateQuizMutation.mutateAsync({
        quizId: editingQuiz.id,
        update: {
          name: values.name,
          description: values.description || null,
          time_limit_seconds: values.timeLimit ? values.timeLimit * 60 : null,
          passing_score: values.passingScore ?? null,
          expected_version: editingQuiz.version
        }
      })
      messageApi.success(
        t("option:quiz.updateSuccess", { defaultValue: "Quiz updated successfully" })
      )
      closeEditModal()
      refetch()
    } catch (error) {
      messageApi.error(
        t("option:quiz.updateError", { defaultValue: "Failed to update quiz" })
      )
    }
  }

  const baseQuestionDraft = (): QuestionDraft => ({
    question_type: "multiple_choice",
    question_text: "",
    options: ["", "", "", ""],
    correct_answer: 0,
    explanation: "",
    points: 1,
    order_index: questionTotal
  })

  const openQuestionModal = (question?: Question) => {
    if (question) {
      setIsNewQuestion(false)
      setQuestionDraft({
        id: question.id,
        question_type: question.question_type,
        question_text: question.question_text,
        options:
          question.question_type === "multiple_choice"
            ? (question.options ?? ["", "", "", ""])
            : ["", "", "", ""],
        correct_answer: question.correct_answer ?? (question.question_type === "true_false" ? "true" : ""),
        explanation: question.explanation ?? "",
        points: question.points ?? 1,
        order_index: question.order_index ?? 0
      })
    } else {
      setIsNewQuestion(true)
      setQuestionDraft(baseQuestionDraft())
    }
    setQuestionModalOpen(true)
  }

  const closeQuestionModal = () => {
    setQuestionModalOpen(false)
    setQuestionDraft(null)
  }

  const updateQuestionDraft = (updates: Partial<QuestionDraft>) => {
    setQuestionDraft((prev) => (prev ? { ...prev, ...updates } : prev))
  }

  const normalizeOptions = (options: string[]) => {
    const trimmed = options.map((opt) => opt.trim())
    const filtered: string[] = []
    const indexMap = new Map<number, number>()
    trimmed.forEach((opt, idx) => {
      if (!opt) return
      indexMap.set(idx, filtered.length)
      filtered.push(opt)
    })
    return { filtered, indexMap }
  }

  const handleSaveQuestion = async () => {
    if (!editingQuiz || !questionDraft) return
    if (!questionDraft.question_text.trim()) {
      messageApi.warning(
        t("option:quiz.questionTextRequired", { defaultValue: "Question text is required." })
      )
      return
    }

    let optionsPayload: string[] | undefined
    let correctAnswer: AnswerValue = questionDraft.correct_answer

    if (questionDraft.question_type === "multiple_choice") {
      const { filtered, indexMap } = normalizeOptions(questionDraft.options)
      if (filtered.length < 2) {
        messageApi.warning(
          t("option:quiz.optionsRequired", { defaultValue: "Please provide at least two options." })
        )
        return
      }
      const rawIndex = Number(correctAnswer)
      const mapped = indexMap.get(Number.isNaN(rawIndex) ? 0 : rawIndex)
      correctAnswer = mapped ?? 0
      optionsPayload = filtered
    } else if (questionDraft.question_type === "true_false") {
      correctAnswer = String(correctAnswer || "true").toLowerCase() === "true" ? "true" : "false"
    } else {
      correctAnswer = String(correctAnswer || "").trim()
    }

    try {
      if (isNewQuestion) {
        await createQuestionMutation.mutateAsync({
          quizId: editingQuiz.id,
          question: {
            question_type: questionDraft.question_type,
            question_text: questionDraft.question_text,
            options: optionsPayload,
            correct_answer: correctAnswer,
            explanation: questionDraft.explanation || undefined,
            points: questionDraft.points,
            order_index: questionDraft.order_index
          }
        })
        messageApi.success(
          t("option:quiz.questionSaveSuccess", { defaultValue: "Question created successfully." })
        )
      } else if (questionDraft.id != null) {
        await updateQuestionMutation.mutateAsync({
          quizId: editingQuiz.id,
          questionId: questionDraft.id,
          update: {
            question_type: questionDraft.question_type,
            question_text: questionDraft.question_text,
            options: optionsPayload,
            correct_answer: correctAnswer,
            explanation: questionDraft.explanation || undefined,
            points: questionDraft.points,
            order_index: questionDraft.order_index
          }
        })
        messageApi.success(
          t("option:quiz.questionUpdateSuccess", { defaultValue: "Question updated successfully." })
        )
      }
      closeQuestionModal()
      questionsQuery.refetch()
    } catch (error) {
      messageApi.error(
        t("option:quiz.questionSaveError", { defaultValue: "Failed to save question." })
      )
    }
  }

  const handleDeleteQuestion = async (question: Question) => {
    if (!editingQuiz) return
    try {
      await deleteQuestionMutation.mutateAsync({
        quizId: editingQuiz.id,
        questionId: question.id,
        version: question.version
      })
      messageApi.success(
        t("option:quiz.questionDeleteSuccess", { defaultValue: "Question deleted successfully." })
      )
      questionsQuery.refetch()
    } catch (error) {
      messageApi.error(
        t("option:quiz.questionDeleteError", { defaultValue: "Failed to delete question." })
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
            <List.Item
              actions={[
                <Button
                  key="start"
                  type="link"
                  icon={<PlayCircleOutlined />}
                  onClick={() => {
                    onStartQuiz(quiz.id)
                  }}
                  data-testid={`quiz-start-${quiz.id}`}
                >
                  {t("option:quiz.start", { defaultValue: "Start" })}
                </Button>,
                <Button
                  key="edit"
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => {
                    openEditModal(quiz)
                  }}
                  data-testid={`quiz-edit-${quiz.id}`}
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

      <Modal
        title={t("option:quiz.editQuizTitle", { defaultValue: "Edit Quiz" })}
        open={editModalOpen}
        onCancel={closeEditModal}
        onOk={handleSaveQuiz}
        okText={t("common:save", { defaultValue: "Save" })}
        cancelText={t("common:cancel", { defaultValue: "Cancel" })}
        confirmLoading={updateQuizMutation.isPending}
        width={860}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="name"
            label={t("option:quiz.quizName", { defaultValue: "Quiz Name" })}
            rules={[
              {
                required: true,
                message: t("option:quiz.nameRequired", { defaultValue: "Please enter a quiz name" })
              }
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="description"
            label={t("option:quiz.description", { defaultValue: "Description" })}
          >
            <Input.TextArea rows={2} />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="timeLimit"
              label={t("option:quiz.timeLimit", { defaultValue: "Time Limit (minutes)" })}
            >
              <InputNumber min={1} max={180} className="w-full" />
            </Form.Item>
            <Form.Item
              name="passingScore"
              label={t("option:quiz.passingScore", { defaultValue: "Passing Score (%)" })}
            >
              <InputNumber min={1} max={100} className="w-full" />
            </Form.Item>
          </div>
        </Form>

        <Divider />

        <div className="flex items-center justify-between mb-3">
          <Typography.Title level={5} className="!mb-0">
            {t("option:quiz.questionsSection", { defaultValue: "Questions" })}
          </Typography.Title>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => openQuestionModal()}
          >
            {t("option:quiz.addQuestion", { defaultValue: "Add Question" })}
          </Button>
        </div>

        {questionsQuery.isLoading ? (
          <div className="flex justify-center py-6">
            <Spin />
          </div>
        ) : questions.length === 0 ? (
          <Empty
            description={t("option:quiz.noQuestionsYet", { defaultValue: "No questions added yet" })}
          />
        ) : (
          <List
            dataSource={questions}
            pagination={{
              current: questionPage,
              pageSize: questionPageSize,
              total: questionTotal,
              showSizeChanger: true,
              onChange: (nextPage, nextPageSize) => {
                setQuestionPage(nextPage)
                if (nextPageSize && nextPageSize !== questionPageSize) {
                  setQuestionPageSize(nextPageSize)
                  setQuestionPage(1)
                }
              }
            }}
            renderItem={(question) => (
              <List.Item
                actions={[
                  <Button key="edit" type="link" onClick={() => openQuestionModal(question)}>
                    {t("common:edit", { defaultValue: "Edit" })}
                  </Button>,
                  <Popconfirm
                    key="delete"
                    title={t("option:quiz.deleteConfirm", { defaultValue: "Delete this quiz?" })}
                    description={t("option:quiz.deleteConfirmDesc", {
                      defaultValue: "This action cannot be undone."
                    })}
                    onConfirm={() => handleDeleteQuestion(question)}
                    okText={t("common:yes", { defaultValue: "Yes" })}
                    cancelText={t("common:no", { defaultValue: "No" })}
                  >
                    <Button type="link" danger loading={deleteQuestionMutation.isPending}>
                      {t("option:quiz.delete", { defaultValue: "Delete" })}
                    </Button>
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta
                  title={question.question_text}
                  description={
                    <div className="flex flex-wrap gap-2">
                      <Tag>{questionTypeLabel(question.question_type)}</Tag>
                      <Tag>{t("option:quiz.points", { defaultValue: "Points" })}: {question.points}</Tag>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>

      <Modal
        title={
          isNewQuestion
            ? t("option:quiz.addQuestion", { defaultValue: "Add Question" })
            : t("option:quiz.editQuestion", { defaultValue: "Edit Question" })
        }
        open={questionModalOpen}
        onCancel={closeQuestionModal}
        onOk={handleSaveQuestion}
        okText={t("common:save", { defaultValue: "Save" })}
        cancelText={t("common:cancel", { defaultValue: "Cancel" })}
        confirmLoading={createQuestionMutation.isPending || updateQuestionMutation.isPending}
        width={760}
      >
        {questionDraft && (
          <Space direction="vertical" className="w-full">
            <Select
              value={questionDraft.question_type}
              onChange={(value: QuestionType) => {
                const updates: Partial<QuestionDraft> = { question_type: value }
                if (value === "multiple_choice") {
                  updates.correct_answer = 0
                  if (questionDraft.options.length === 0) {
                    updates.options = ["", "", "", ""]
                  }
                } else if (value === "true_false") {
                  updates.correct_answer = "true"
                } else {
                  updates.correct_answer = ""
                }
                updateQuestionDraft(updates)
              }}
              options={[
                { label: t("option:quiz.multipleChoice", { defaultValue: "Multiple Choice" }), value: "multiple_choice" },
                { label: t("option:quiz.trueFalse", { defaultValue: "True/False" }), value: "true_false" },
                { label: t("option:quiz.fillBlank", { defaultValue: "Fill in the Blank" }), value: "fill_blank" }
              ]}
              className="w-60"
            />

            <Input.TextArea
              placeholder={t("option:quiz.questionText", { defaultValue: "Enter your question..." })}
              value={questionDraft.question_text}
              onChange={(e) => updateQuestionDraft({ question_text: e.target.value })}
              rows={2}
            />

            {questionDraft.question_type === "multiple_choice" && (
              <div className="space-y-2">
                <div className="text-sm font-medium">
                  {t("option:quiz.options", { defaultValue: "Options" })}
                </div>
                {questionDraft.options.map((option, optIndex) => (
                  <div key={optIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="edit-correct"
                      checked={Number(questionDraft.correct_answer) === optIndex}
                      onChange={() => updateQuestionDraft({ correct_answer: optIndex })}
                    />
                    <Input
                      placeholder={`${t("option:quiz.option", { defaultValue: "Option" })} ${optIndex + 1}`}
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...questionDraft.options]
                        newOptions[optIndex] = e.target.value
                        updateQuestionDraft({ options: newOptions })
                      }}
                      className="flex-1"
                    />
                  </div>
                ))}
              </div>
            )}

            {questionDraft.question_type === "true_false" && (
              <Radio.Group
                value={questionDraft.correct_answer}
                onChange={(e) => updateQuestionDraft({ correct_answer: e.target.value })}
              >
                <Space direction="vertical">
                  <Radio value="true">{t("option:quiz.true", { defaultValue: "True" })}</Radio>
                  <Radio value="false">{t("option:quiz.false", { defaultValue: "False" })}</Radio>
                </Space>
              </Radio.Group>
            )}

            {questionDraft.question_type === "fill_blank" && (
              <Input
                placeholder={t("option:quiz.correctAnswerPlaceholder", {
                  defaultValue: "Enter the correct answer..."
                })}
                value={typeof questionDraft.correct_answer === "string" ? questionDraft.correct_answer : ""}
                onChange={(e) => updateQuestionDraft({ correct_answer: e.target.value })}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <InputNumber
                min={1}
                className="w-full"
                value={questionDraft.points}
                onChange={(value) => updateQuestionDraft({ points: Number(value) || 1 })}
                placeholder={t("option:quiz.points", { defaultValue: "Points" })}
              />
              <InputNumber
                min={0}
                className="w-full"
                value={questionDraft.order_index}
                onChange={(value) => updateQuestionDraft({ order_index: Number(value) || 0 })}
                placeholder={t("option:quiz.orderIndex", { defaultValue: "Order" })}
              />
            </div>

            <Input.TextArea
              placeholder={t("option:quiz.explanationPlaceholder", {
                defaultValue: "Explanation (shown after answering)..."
              })}
              value={questionDraft.explanation ?? ""}
              onChange={(e) => updateQuestionDraft({ explanation: e.target.value })}
              rows={2}
            />
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default ManageTab

import React from "react"
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  message
} from "antd"
import { useTranslation } from "react-i18next"
import { PlusOutlined, DeleteOutlined, SaveOutlined } from "@ant-design/icons"
import { useCreateQuizMutation, useCreateQuestionMutation } from "../hooks"
import type { QuestionType, QuestionCreate } from "@/services/quizzes"

interface CreateTabProps {
  onNavigateToTake: () => void
}

interface QuestionFormData {
  key: string
  question_type: QuestionType
  question_text: string
  options: string[]
  correct_answer: number | string
  explanation?: string
}

export const CreateTab: React.FC<CreateTabProps> = ({ onNavigateToTake }) => {
  const { t } = useTranslation(["option", "common"])
  const [form] = Form.useForm()
  const [questions, setQuestions] = React.useState<QuestionFormData[]>([])
  const [messageApi, contextHolder] = message.useMessage()

  const createQuizMutation = useCreateQuizMutation()
  const createQuestionMutation = useCreateQuestionMutation()

  const addQuestion = () => {
    const newQuestion: QuestionFormData = {
      key: crypto.randomUUID(),
      question_type: "multiple_choice",
      question_text: "",
      options: ["", "", "", ""],
      correct_answer: 0,
      explanation: ""
    }
    setQuestions([...questions, newQuestion])
  }

  const removeQuestion = (key: string) => {
    setQuestions(questions.filter((q) => q.key !== key))
  }

  const updateQuestion = (key: string, updates: Partial<QuestionFormData>) => {
    setQuestions(
      questions.map((q) => (q.key === key ? { ...q, ...updates } : q))
    )
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()

      if (questions.length === 0) {
        messageApi.warning(
          t("option:quiz.addQuestionsFirst", { defaultValue: "Please add at least one question" })
        )
        return
      }

      // Create the quiz first
      const quiz = await createQuizMutation.mutateAsync({
        name: values.name,
        description: values.description || undefined,
        time_limit_seconds: values.timeLimit ? values.timeLimit * 60 : undefined,
        passing_score: values.passingScore || undefined
      })

      // Then create all questions
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        const questionData: QuestionCreate = {
          question_type: q.question_type,
          question_text: q.question_text,
          options: q.question_type === "multiple_choice" ? q.options.filter(Boolean) : undefined,
          correct_answer: q.correct_answer,
          explanation: q.explanation || undefined,
          order_index: i
        }
        await createQuestionMutation.mutateAsync({
          quizId: quiz.id,
          question: questionData
        })
      }

      messageApi.success(
        t("option:quiz.createSuccess", { defaultValue: "Quiz created successfully!" })
      )

      // Reset form
      form.resetFields()
      setQuestions([])
      onNavigateToTake()
    } catch (error) {
      messageApi.error(
        t("option:quiz.createError", { defaultValue: "Failed to create quiz" })
      )
    }
  }

  const renderQuestionEditor = (question: QuestionFormData, index: number) => {
    return (
      <Card
        key={question.key}
        size="small"
        className="mb-4"
        title={`${t("option:quiz.question", { defaultValue: "Question" })} ${index + 1}`}
        extra={
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => removeQuestion(question.key)}
          />
        }
      >
        <Space direction="vertical" className="w-full">
          <Select
            value={question.question_type}
            onChange={(value) => {
              const updates: Partial<QuestionFormData> = { question_type: value }
              if (value === "multiple_choice") {
                updates.correct_answer = 0
                if (question.options.length === 0) {
                  updates.options = ["", "", "", ""]
                }
              } else if (value === "true_false") {
                updates.correct_answer = "true"
              } else {
                updates.correct_answer = ""
              }
              updateQuestion(question.key, updates)
            }}
            options={[
              { label: t("option:quiz.multipleChoice", { defaultValue: "Multiple Choice" }), value: "multiple_choice" },
              { label: t("option:quiz.trueFalse", { defaultValue: "True/False" }), value: "true_false" },
              { label: t("option:quiz.fillBlank", { defaultValue: "Fill in the Blank" }), value: "fill_blank" }
            ]}
            className="w-48"
          />

          <Input.TextArea
            placeholder={t("option:quiz.questionText", { defaultValue: "Enter your question..." })}
            value={question.question_text}
            onChange={(e) => updateQuestion(question.key, { question_text: e.target.value })}
            rows={2}
          />

          {question.question_type === "multiple_choice" && (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                {t("option:quiz.options", { defaultValue: "Options" })}
              </div>
              {question.options.map((option, optIndex) => (
                <div key={optIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${question.key}`}
                    checked={Number(question.correct_answer) === optIndex}
                    onChange={() => updateQuestion(question.key, { correct_answer: optIndex })}
                  />
                  <Input
                    placeholder={`${t("option:quiz.option", { defaultValue: "Option" })} ${optIndex + 1}`}
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...question.options]
                      newOptions[optIndex] = e.target.value
                      updateQuestion(question.key, { options: newOptions })
                    }}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
          )}

          {question.question_type === "true_false" && (
            <div className="flex items-center gap-2">
              <span>{t("option:quiz.correctAnswer", { defaultValue: "Correct answer" })}:</span>
              <Switch
                checkedChildren={t("option:quiz.true", { defaultValue: "True" })}
                unCheckedChildren={t("option:quiz.false", { defaultValue: "False" })}
                checked={question.correct_answer === "true"}
                onChange={(checked) =>
                  updateQuestion(question.key, { correct_answer: checked ? "true" : "false" })
                }
              />
            </div>
          )}

          {question.question_type === "fill_blank" && (
            <Input
              placeholder={t("option:quiz.correctAnswerPlaceholder", {
                defaultValue: "Enter the correct answer..."
              })}
              value={typeof question.correct_answer === "string" ? question.correct_answer : ""}
              onChange={(e) => updateQuestion(question.key, { correct_answer: e.target.value })}
            />
          )}

          <Input.TextArea
            placeholder={t("option:quiz.explanationPlaceholder", {
              defaultValue: "Explanation (shown after answering)..."
            })}
            value={question.explanation}
            onChange={(e) => updateQuestion(question.key, { explanation: e.target.value })}
            rows={2}
          />
        </Space>
      </Card>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      {contextHolder}

      <Card
        title={t("option:quiz.quizDetails", { defaultValue: "Quiz Details" })}
        size="small"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t("option:quiz.quizName", { defaultValue: "Quiz Name" })}
            rules={[{ required: true, message: t("option:quiz.nameRequired", { defaultValue: "Please enter a quiz name" }) }]}
          >
            <Input placeholder={t("option:quiz.namePlaceholder", { defaultValue: "e.g., Biology Chapter 5" })} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t("option:quiz.description", { defaultValue: "Description" })}
          >
            <Input.TextArea
              placeholder={t("option:quiz.descriptionPlaceholder", { defaultValue: "Optional description..." })}
              rows={2}
            />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="timeLimit"
              label={t("option:quiz.timeLimit", { defaultValue: "Time Limit (minutes)" })}
            >
              <InputNumber min={1} max={180} className="w-full" placeholder="Optional" />
            </Form.Item>

            <Form.Item
              name="passingScore"
              label={t("option:quiz.passingScore", { defaultValue: "Passing Score (%)" })}
            >
              <InputNumber min={1} max={100} className="w-full" placeholder="Optional" />
            </Form.Item>
          </div>
        </Form>
      </Card>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">
            {t("option:quiz.questionsSection", { defaultValue: "Questions" })} ({questions.length})
          </h3>
          <Button type="dashed" icon={<PlusOutlined />} onClick={addQuestion}>
            {t("option:quiz.addQuestion", { defaultValue: "Add Question" })}
          </Button>
        </div>

        {questions.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-gray-500 mb-4">
              {t("option:quiz.noQuestionsYet", { defaultValue: "No questions added yet" })}
            </p>
            <Button type="primary" icon={<PlusOutlined />} onClick={addQuestion}>
              {t("option:quiz.addFirstQuestion", { defaultValue: "Add Your First Question" })}
            </Button>
          </Card>
        ) : (
          questions.map((q, i) => renderQuestionEditor(q, i))
        )}
      </div>

      <Button
        type="primary"
        icon={<SaveOutlined />}
        size="large"
        onClick={handleSave}
        loading={createQuizMutation.isPending || createQuestionMutation.isPending}
        disabled={questions.length === 0}
        block
      >
        {t("option:quiz.saveQuiz", { defaultValue: "Save Quiz" })}
      </Button>
    </div>
  )
}

export default CreateTab
